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
		return fmt.Errorf("transfer would exceed credit limit: new balance %.2f TQ < limit %.2f TQ", float64(newBalance)/100, float64(limits.CreditLimit)/100)
	}

	if limits.PerTransactionLimit != nil && amount > *limits.PerTransactionLimit {
		return fmt.Errorf("amount %.2f TQ exceeds per-transaction limit %.2f TQ", float64(amount)/100, float64(*limits.PerTransactionLimit)/100)
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
			return fmt.Errorf("transfer would exceed daily limit: %.2f TQ + %.2f TQ > %.2f TQ", float64(dailySpent)/100, float64(amount)/100, float64(*limits.DailyLimit)/100)
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
	CreditLimit     int64
	DebitLimit      int64
	IsCustomized    bool
	LocalApproved   bool
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
	// Check unilateral blocks first — if either node blocked the other, reject
	var blocked bool
	err := lc.Pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM federation_unilateral_blocks
		 WHERE (blocker_domain = $1 AND blocked_domain = $2)
		    OR (blocker_domain = $2 AND blocked_domain = $1))`,
		senderNode, receiverNode,
	).Scan(&blocked)
	if err == nil && blocked {
		return fmt.Errorf("comercio bloqueado unilateralmente entre %s y %s", senderNode, receiverNode)
	}

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
		return fmt.Errorf("transfer would exceed credit limit: new balance %.2f TQ < limit %.2f TQ", float64(newBalance)/100, float64(limits.CreditLimit)/100)
	}

	if limits.PerTransactionLimit != nil && amount > *limits.PerTransactionLimit {
		return fmt.Errorf("amount %.2f TQ exceeds per-transaction limit %.2f TQ", float64(amount)/100, float64(*limits.PerTransactionLimit)/100)
	}

	// Determinar el pool: si hay acuerdo bilateral activo y customizado -> bilateral
	// Si no -> global
	bl, err := lc.GetBilateralLimit(ctx, senderNode, receiverNode)
	hasBilateralAgreement := err == nil && bl.IsCustomized && bl.LocalApproved && bl.RemoteConfirmed

	if hasBilateralAgreement {
		// Validar contra la piscina bilateral
		bilateralBalance, err := lc.GetBilateralPoolBalance(ctx, receiverNode)
		if err != nil {
			return err
		}
		newBilateralBalance := bilateralBalance + amount
		if newBilateralBalance > bl.CreditLimit {
			return fmt.Errorf("transfer would exceed bilateral credit limit: %.2f TQ > %.2f TQ", float64(newBilateralBalance)/100, float64(bl.CreditLimit)/100)
		}
		// Las transacciones bilaterales NO afectan la piscina global
		return nil
	}

	// No hay acuerdo bilateral -> usar la piscina global
	// El limite global depende del nivel del nodo (federation_node_membership)
	// Si no hay nivel asignado, usar el default de federation_global_config
	globalLimit, err := lc.GetNodeGlobalLimit(ctx, receiverNode)
	if err != nil || globalLimit <= 0 {
		// Fallback al config global
		fedCfg, err2 := lc.GetFederationConfig(ctx)
		if err2 != nil {
			return err2
		}
		globalLimit = fedCfg.NodeGlobalCreditLimit
	}

	globalBalance, err := lc.GetGlobalPoolBalance(ctx)
	if err != nil {
		return err
	}
	newGlobalBalance := globalBalance + amount
	if newGlobalBalance > globalLimit {
		return fmt.Errorf("transfer would exceed global pool credit limit: %.2f TQ > %.2f TQ", float64(newGlobalBalance)/100, float64(globalLimit)/100)
	}

	return nil
}

// GetNodeGlobalLimit returns the effective global credit limit for a node,
// considering its federation level and any sponsor holdbacks.
func (lc *LimitsChecker) GetNodeGlobalLimit(ctx context.Context, remoteNode string) (int64, error) {
	// Obtener el nivel del nodo desde federation_node_membership
	var levelID string
	err := lc.Pool.QueryRow(ctx,
		`SELECT level_id FROM federation_node_membership WHERE peer_domain = $1`,
		remoteNode,
	).Scan(&levelID)
	if err != nil {
		return 0, nil // no membership -> caller falls back to global config
	}

	// Obtener el limite del nivel
	var globalCreditLimit int64
	err = lc.Pool.QueryRow(ctx,
		`SELECT global_credit_limit FROM federation_node_levels WHERE id = $1 AND is_active = true`,
		levelID,
	).Scan(&globalCreditLimit)
	if err != nil {
		return 0, nil
	}

	// Restar retenciones de patrocinios activos donde este nodo es padrino
	var heldAmount int64
	_ = lc.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(amount_held), 0) FROM federation_sponsorships
		 WHERE sponsor_domain = $1 AND status = 'active'`,
		remoteNode,
	).Scan(&heldAmount)

	effectiveLimit := globalCreditLimit - heldAmount
	if effectiveLimit < 0 {
		effectiveLimit = 0
	}
	return effectiveLimit, nil
}

// GetBilateralPoolBalance returns the bilateral pool balance for a specific counterpart.
func (lc *LimitsChecker) GetBilateralPoolBalance(ctx context.Context, counterpartNode string) (int64, error) {
	var balance int64
	err := lc.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)
		 FROM ledger_entries WHERE account_category = 'node_bridge_bilateral' AND counterpart_node = $1`,
		counterpartNode,
	).Scan(&balance)
	if err != nil {
		return 0, fmt.Errorf("getting bilateral pool balance: %w", err)
	}
	return balance, nil
}

// GetGlobalPoolBalance returns the shared global pool balance (multilateral).
func (lc *LimitsChecker) GetGlobalPoolBalance(ctx context.Context) (int64, error) {
	var balance int64
	err := lc.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)
		 FROM ledger_entries WHERE account_category = 'node_bridge_global'`,
	).Scan(&balance)
	if err != nil {
		return 0, fmt.Errorf("getting global pool balance: %w", err)
	}
	return balance, nil
}

func (lc *LimitsChecker) GetBilateralBalance(ctx context.Context, localNode, remoteNode string) (int64, error) {
	var balance int64
	err := lc.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)
		 FROM ledger_entries WHERE account_category IN ('node_bridge', 'node_bridge_bilateral') AND counterpart_node = $1`,
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
		 FROM ledger_entries WHERE account_category IN ('node_bridge', 'node_bridge_global', 'node_bridge_bilateral')`,
	).Scan(&balance)
	if err != nil {
		return 0, fmt.Errorf("getting global base balance: %w", err)
	}
	return balance, nil
}
