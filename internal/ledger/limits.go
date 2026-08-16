package ledger

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type LimitsChecker struct {
	Pool *pgxpool.Pool
}

func NewLimitsChecker(pool *pgxpool.Pool) *LimitsChecker {
	return &LimitsChecker{Pool: pool}
}

type UserLimits struct {
	CreditLimit         int64
	DebitLimit          int64
	PerTransactionLimit *int64
	DailyLimit          *int64
	MonthlyLimit        *int64
	CanCrossNodeTrade   bool
}

func (lc *LimitsChecker) GetUserLimits(ctx context.Context, userID uuid.UUID) (*UserLimits, error) {
	var limits UserLimits
	var perTx, daily, monthly *int64
	err := lc.Pool.QueryRow(ctx, `
		SELECT u.credit_limit, u.debit_limit, ml.per_transaction_limit, ml.daily_limit, ml.monthly_limit, ml.can_cross_node_trade
		FROM users u
		LEFT JOIN member_levels ml ON u.member_level_id = ml.id AND u.node_domain = ml.node_domain
		WHERE u.id = $1`,
		userID,
	).Scan(&limits.CreditLimit, &limits.DebitLimit, &perTx, &daily, &monthly, &limits.CanCrossNodeTrade)
	if err != nil {
		return nil, fmt.Errorf("getting user limits: %w", err)
	}
	limits.PerTransactionLimit = perTx
	limits.DailyLimit = daily
	limits.MonthlyLimit = monthly
	return &limits, nil
}

func (lc *LimitsChecker) GetBalance(ctx context.Context, userID uuid.UUID) (int64, error) {
	var balance int64
	err := lc.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)
		 FROM ledger_entries WHERE account_id = $1 AND account_category = 'user_balance'`,
		userID,
	).Scan(&balance)
	if err != nil {
		return 0, fmt.Errorf("getting balance: %w", err)
	}
	return balance, nil
}

func (lc *LimitsChecker) ValidateInternalTransfer(ctx context.Context, senderID uuid.UUID, amount int64) error {
	balance, err := lc.GetBalance(ctx, senderID)
	if err != nil {
		return err
	}

	limits, err := lc.GetUserLimits(ctx, senderID)
	if err != nil {
		return err
	}

	newBalance := balance - amount
	if newBalance < limits.CreditLimit {
		return fmt.Errorf("transfer would exceed credit limit: new balance %d < limit %d", newBalance, limits.CreditLimit)
	}

	if limits.PerTransactionLimit != nil && amount > *limits.PerTransactionLimit {
		return fmt.Errorf("amount %d exceeds per-transaction limit %d", amount, *limits.PerTransactionLimit)
	}

	if limits.DailyLimit != nil {
		var dailySpent int64
		err := lc.Pool.QueryRow(ctx, `
			SELECT COALESCE(SUM(amount), 0) FROM transactions
			WHERE sender_id = $1 AND status = 'confirmed' AND created_at > NOW() - INTERVAL '1 day'`,
			senderID,
		).Scan(&dailySpent)
		if err != nil {
			return fmt.Errorf("checking daily limit: %w", err)
		}
		if dailySpent+amount > *limits.DailyLimit {
			return fmt.Errorf("transfer would exceed daily limit: %d + %d > %d", dailySpent, amount, *limits.DailyLimit)
		}
	}

	return nil
}

type FederationGlobalConfig struct {
	NodeGlobalCreditLimit     int64
	NodeGlobalDebitLimit      int64
	NodeBilateralBaseLimit    int64
	WarningThreshold1         int
	WarningThreshold2         int
	WarningThreshold3         int
	ParitySuggestionThreshold int
}

func (lc *LimitsChecker) GetFederationConfig(ctx context.Context) (*FederationGlobalConfig, error) {
	var cfg FederationGlobalConfig
	err := lc.Pool.QueryRow(ctx, `
		SELECT node_global_credit_limit, node_global_debit_limit, node_bilateral_base_limit,
			   warning_threshold_1, warning_threshold_2, warning_threshold_3, parity_suggestion_threshold
		FROM federation_global_config ORDER BY id DESC LIMIT 1`,
	).Scan(&cfg.NodeGlobalCreditLimit, &cfg.NodeGlobalDebitLimit, &cfg.NodeBilateralBaseLimit,
		&cfg.WarningThreshold1, &cfg.WarningThreshold2, &cfg.WarningThreshold3, &cfg.ParitySuggestionThreshold)
	if err != nil {
		return nil, fmt.Errorf("getting federation config: %w", err)
	}
	return &cfg, nil
}

type BilateralLimit struct {
	CreditLimit   int64
	DebitLimit    int64
	IsCustomized  bool
	LocalApproved bool
	RemoteConfirmed bool
}

func (lc *LimitsChecker) GetBilateralLimit(ctx context.Context, localNode, remoteNode string) (*BilateralLimit, error) {
	var bl BilateralLimit
	err := lc.Pool.QueryRow(ctx, `
		SELECT credit_limit, debit_limit, is_customized, local_approved, remote_confirmed
		FROM bilateral_limits
		WHERE local_node = $1 AND remote_node = $2 AND is_active = true`,
		localNode, remoteNode,
	).Scan(&bl.CreditLimit, &bl.DebitLimit, &bl.IsCustomized, &bl.LocalApproved, &bl.RemoteConfirmed)
	if err != nil {
		return nil, fmt.Errorf("getting bilateral limit: %w", err)
	}
	return &bl, nil
}

func (lc *LimitsChecker) ValidateCrossNodeTransfer(ctx context.Context, senderID uuid.UUID, senderNode, receiverNode string, amount int64) error {
	balance, err := lc.GetBalance(ctx, senderID)
	if err != nil {
		return err
	}

	limits, err := lc.GetUserLimits(ctx, senderID)
	if err != nil {
		return err
	}

	if !limits.CanCrossNodeTrade {
		return fmt.Errorf("user does not have permission for cross-node trades")
	}

	newBalance := balance - amount
	if newBalance < limits.CreditLimit {
		return fmt.Errorf("transfer would exceed credit limit: new balance %d < limit %d", newBalance, limits.CreditLimit)
	}

	if limits.PerTransactionLimit != nil && amount > *limits.PerTransactionLimit {
		return fmt.Errorf("amount %d exceeds per-transaction limit %d", amount, *limits.PerTransactionLimit)
	}

	fedCfg, err := lc.GetFederationConfig(ctx)
	if err != nil {
		return err
	}

	bl, err := lc.GetBilateralLimit(ctx, senderNode, receiverNode)
	if err != nil {
		bl = &BilateralLimit{
			CreditLimit: fedCfg.NodeBilateralBaseLimit,
			DebitLimit:  fedCfg.NodeGlobalDebitLimit,
		}
	}

	bilateralBalance, err := lc.GetBilateralBalance(ctx, senderNode, receiverNode)
	if err != nil {
		return err
	}

	newBilateralBalance := bilateralBalance + amount
	if newBilateralBalance > bl.CreditLimit {
		return fmt.Errorf("transfer would exceed bilateral credit limit: %d > %d", newBilateralBalance, bl.CreditLimit)
	}

	if !bl.IsCustomized {
		globalBalance, err := lc.GetGlobalBaseBalance(ctx, senderNode)
		if err != nil {
			return err
		}
		newGlobalBalance := globalBalance + amount
		if newGlobalBalance > fedCfg.NodeGlobalCreditLimit {
			return fmt.Errorf("transfer would exceed global credit limit: %d > %d", newGlobalBalance, fedCfg.NodeGlobalCreditLimit)
		}
	}

	return nil
}

func (lc *LimitsChecker) GetBilateralBalance(ctx context.Context, localNode, remoteNode string) (int64, error) {
	var balance int64
	err := lc.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)
		 FROM ledger_entries WHERE account_category = 'node_bridge' AND counterpart_node = $1`,
		remoteNode,
	).Scan(&balance)
	if err != nil {
		return 0, fmt.Errorf("getting bilateral balance: %w", err)
	}
	return balance, nil
}

func (lc *LimitsChecker) GetGlobalBaseBalance(ctx context.Context, localNode string) (int64, error) {
	var balance int64
	err := lc.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)
		 FROM ledger_entries WHERE account_category = 'node_bridge'`,
	).Scan(&balance)
	if err != nil {
		return 0, fmt.Errorf("getting global base balance: %w", err)
	}
	return balance, nil
}
