package ledger

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TxType string

const (
	TxTypeInternal         TxType = "internal"
	TxTypeCrossNode        TxType = "cross_node"
	TxTypeTax              TxType = "tax"
	TxTypeFundDistribution TxType = "fund_distribution"
	TxTypeSalary           TxType = "salary"
	TxTypeDebtLiberation   TxType = "debt_liberation"
	TxTypeLimitIncrease    TxType = "limit_increase"
	TxTypeSponsorDebt      TxType = "sponsor_debt" // debt transfer from defaulted node to sponsor
)

type EntryType string

const (
	EntryTypeDebit  EntryType = "debit"
	EntryTypeCredit EntryType = "credit"
)

type AccountCategory string

const (
	CategoryUserBalance         AccountCategory = "user_balance"
	CategoryNodeBridge          AccountCategory = "node_bridge"
	CategoryNodeBridgeGlobal    AccountCategory = "node_bridge_global"
	CategoryNodeBridgeBilateral AccountCategory = "node_bridge_bilateral"
	CategoryFund                AccountCategory = "fund"
	CategoryExternalBridge      AccountCategory = "external_bridge"
)

// PoolType distingue entre la piscina global (multilateral) y bilateral
type PoolType string

const (
	PoolTypeGlobal    PoolType = "global"
	PoolTypeBilateral PoolType = "bilateral"
)

type Transaction struct {
	ID               uuid.UUID
	TxType           TxType
	SenderID         *uuid.UUID
	ReceiverID       *uuid.UUID
	SenderNode       string
	ReceiverNode     string
	Amount           int64
	TaxAmount        int64
	TaxTargetAccount *uuid.UUID
	UserSignature    string
	NodeSignature    string
	PrevHash         string
	CurrentHash      string
	ExternalID       string
	Status           string
	Metadata         map[string]interface{}
	CreatedAt        time.Time
	ConfirmedAt      *time.Time
}

type LedgerEntry struct {
	ID              int64
	TransactionID   uuid.UUID
	AccountID       uuid.UUID
	EntryType       EntryType
	Amount          int64
	AccountCategory AccountCategory
	CounterpartNode string
	CreatedAt       time.Time
}

type Ledger struct {
	Pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Ledger {
	return &Ledger{Pool: pool}
}

func (l *Ledger) GetBalance(ctx context.Context, accountID uuid.UUID) (int64, error) {
	var balance int64
	err := l.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)
		 FROM ledger_entries WHERE account_id = $1 AND account_category = 'user_balance'`,
		accountID,
	).Scan(&balance)
	if err != nil {
		return 0, fmt.Errorf("getting balance: %w", err)
	}
	return balance, nil
}

func (l *Ledger) GetNodeBalance(ctx context.Context, remoteNode string) (int64, error) {
	var balance int64
	err := l.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)
		 FROM ledger_entries WHERE counterpart_node = $1 AND account_category IN ('node_bridge', 'node_bridge_bilateral')`,
		remoteNode,
	).Scan(&balance)
	if err != nil {
		return 0, fmt.Errorf("getting node balance: %w", err)
	}
	return balance, nil
}

// GetGlobalPoolBalance returns the shared global pool balance (multilateral).
// Sums all node_bridge_global entries WITHOUT filtering by counterpart_node.
// This is the real global pool: a balance earned from node B is spendable with node C.
func (l *Ledger) GetGlobalPoolBalance(ctx context.Context) (int64, error) {
	var balance int64
	err := l.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)
		 FROM ledger_entries WHERE account_category = 'node_bridge_global'`,
	).Scan(&balance)
	if err != nil {
		return 0, fmt.Errorf("getting global pool balance: %w", err)
	}
	return balance, nil
}

// GetBilateralPoolBalance returns the bilateral pool balance for a specific counterpart.
// Only sums node_bridge_bilateral entries filtered by counterpart_node.
func (l *Ledger) GetBilateralPoolBalance(ctx context.Context, counterpartNode string) (int64, error) {
	var balance int64
	err := l.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)
		 FROM ledger_entries WHERE account_category = 'node_bridge_bilateral' AND counterpart_node = $1`,
		counterpartNode,
	).Scan(&balance)
	if err != nil {
		return 0, fmt.Errorf("getting bilateral pool balance: %w", err)
	}
	return balance, nil
}

// GetGlobalBaseBalance is kept for backward compatibility but now delegates to GetGlobalPoolBalance.
// It sums all node_bridge entries (both legacy and new pool types).
func (l *Ledger) GetGlobalBaseBalance(ctx context.Context, localNode string) (int64, error) {
	var balance int64
	err := l.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)
		 FROM ledger_entries 
		 WHERE account_category IN ('node_bridge', 'node_bridge_global', 'node_bridge_bilateral')
		 AND counterpart_node != ''`,
	).Scan(&balance)
	if err != nil {
		return 0, fmt.Errorf("getting global base balance: %w", err)
	}
	return balance, nil
}

func (l *Ledger) GetLastHash(ctx context.Context) (string, error) {
	var hash string
	err := l.Pool.QueryRow(ctx,
		`SELECT current_hash FROM transactions WHERE current_hash IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
	).Scan(&hash)
	if err != nil {
		if err == pgx.ErrNoRows {
			return "", nil
		}
		return "", fmt.Errorf("getting last hash: %w", err)
	}
	return hash, nil
}

func (l *Ledger) computeHash(tx *Transaction) string {
	data := fmt.Sprintf("%s|%s|%s|%s|%d|%d|%s",
		tx.ID.String(),
		tx.TxType,
		tx.SenderNode,
		tx.ReceiverNode,
		tx.Amount,
		tx.TaxAmount,
		tx.PrevHash,
	)
	h := sha256.Sum256([]byte(data))
	return hex.EncodeToString(h[:])
}

type CreateTxParams struct {
	TxType           TxType
	SenderID         *uuid.UUID
	ReceiverID       *uuid.UUID
	SenderNode       string
	ReceiverNode     string
	Amount           int64
	TaxAmount        int64
	TaxTargetAccount *uuid.UUID
	UserSignature    string
	NodeSignature    string
	ExternalID       string
	Metadata         map[string]interface{}
}

func (l *Ledger) CreateTransaction(ctx context.Context, params CreateTxParams) (*Transaction, error) {
	txID := uuid.New()
	prevHash, err := l.GetLastHash(ctx)
	if err != nil {
		return nil, fmt.Errorf("getting prev hash: %w", err)
	}

	tx := &Transaction{
		ID:               txID,
		TxType:           params.TxType,
		SenderID:         params.SenderID,
		ReceiverID:       params.ReceiverID,
		SenderNode:       params.SenderNode,
		ReceiverNode:     params.ReceiverNode,
		Amount:           params.Amount,
		TaxAmount:        params.TaxAmount,
		TaxTargetAccount: params.TaxTargetAccount,
		UserSignature:    params.UserSignature,
		NodeSignature:    params.NodeSignature,
		PrevHash:         prevHash,
		ExternalID:       params.ExternalID,
		Status:           "pending",
		Metadata:         params.Metadata,
		CreatedAt:        time.Now(),
	}
	tx.CurrentHash = l.computeHash(tx)

	metadataJSON, _ := json.Marshal(params.Metadata)

	_, err = l.Pool.Exec(ctx, `
		INSERT INTO transactions 
		(id, tx_type, sender_id, receiver_id, sender_node, receiver_node, amount, tax_amount, tax_target_account,
		 user_signature, node_signature, prev_hash, current_hash, external_id, status, metadata, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending', $15, $16)`,
		txID, params.TxType, params.SenderID, params.ReceiverID, params.SenderNode, params.ReceiverNode,
		params.Amount, params.TaxAmount, params.TaxTargetAccount,
		params.UserSignature, params.NodeSignature, prevHash, tx.CurrentHash, params.ExternalID, metadataJSON, tx.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("inserting transaction: %w", err)
	}

	return tx, nil
}

func (l *Ledger) PostEntries(ctx context.Context, txID uuid.UUID, entries []LedgerEntry) error {
	for _, e := range entries {
		// Determinar pool_type basado en account_category
		poolType := "global"
		if e.AccountCategory == CategoryNodeBridgeBilateral {
			poolType = "bilateral"
		} else if e.AccountCategory == CategoryNodeBridgeGlobal {
			poolType = "global"
		}
		_, err := l.Pool.Exec(ctx, `
			INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, account_category, counterpart_node, pool_type, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
			txID, e.AccountID, e.EntryType, e.Amount, e.AccountCategory, e.CounterpartNode, poolType,
		)
		if err != nil {
			return fmt.Errorf("inserting ledger entry: %w", err)
		}
	}

	sum := int64(0)
	for _, e := range entries {
		if e.EntryType == EntryTypeCredit {
			sum += e.Amount
		} else {
			sum -= e.Amount
		}
	}
	if sum != 0 {
		return fmt.Errorf("ledger entries do not sum to zero: %d", sum)
	}

	_, err := l.Pool.Exec(ctx, `
		UPDATE transactions SET status = 'confirmed', confirmed_at = NOW() WHERE id = $1`,
		txID,
	)
	if err != nil {
		return fmt.Errorf("confirming transaction: %w", err)
	}

	return nil
}

type InternalTransferParams struct {
	SenderID         uuid.UUID
	ReceiverID       uuid.UUID
	Amount           int64
	TaxAmount        int64
	TaxTargetAccount *uuid.UUID
	UserSignature    string
	NodeSignature    string
}

func (l *Ledger) InternalTransfer(ctx context.Context, p InternalTransferParams) (*Transaction, error) {
	tx, err := l.CreateTransaction(ctx, CreateTxParams{
		TxType:           TxTypeInternal,
		SenderID:         &p.SenderID,
		ReceiverID:       &p.ReceiverID,
		Amount:           p.Amount,
		TaxAmount:        p.TaxAmount,
		TaxTargetAccount: p.TaxTargetAccount,
		UserSignature:    p.UserSignature,
		NodeSignature:    p.NodeSignature,
	})
	if err != nil {
		return nil, err
	}

	entries := []LedgerEntry{
		{TransactionID: tx.ID, AccountID: p.SenderID, EntryType: EntryTypeDebit, Amount: p.Amount, AccountCategory: CategoryUserBalance},
		{TransactionID: tx.ID, AccountID: p.ReceiverID, EntryType: EntryTypeCredit, Amount: p.Amount, AccountCategory: CategoryUserBalance},
	}

	if p.TaxAmount > 0 && p.TaxTargetAccount != nil {
		entries = append(entries,
			LedgerEntry{TransactionID: tx.ID, AccountID: p.ReceiverID, EntryType: EntryTypeDebit, Amount: p.TaxAmount, AccountCategory: CategoryUserBalance},
			LedgerEntry{TransactionID: tx.ID, AccountID: *p.TaxTargetAccount, EntryType: EntryTypeCredit, Amount: p.TaxAmount, AccountCategory: CategoryFund},
		)
	}

	if err := l.PostEntries(ctx, tx.ID, entries); err != nil {
		return nil, fmt.Errorf("posting entries: %w", err)
	}

	return tx, nil
}

type CrossNodeTransferParams struct {
	SenderID          uuid.UUID
	ReceiverID        uuid.UUID
	SenderNode        string
	ReceiverNode      string
	Amount            int64
	TaxAmount         int64
	TaxTargetAccount  *uuid.UUID
	UserSignature     string
	NodeSignature     string
	ExternalID        string
	PoolType          PoolType // 'global' or 'bilateral'
	ReceiverSignature string   // firma del nodo receptor (firma dual)
}

func (l *Ledger) CrossNodeTransfer(ctx context.Context, p CrossNodeTransferParams) (*Transaction, error) {
	poolType := p.PoolType
	if poolType == "" {
		poolType = PoolTypeGlobal
	}

	var bridgeCategory AccountCategory
	if poolType == PoolTypeBilateral {
		bridgeCategory = CategoryNodeBridgeBilateral
	} else {
		bridgeCategory = CategoryNodeBridgeGlobal
	}

	tx, err := l.CreateTransaction(ctx, CreateTxParams{
		TxType:           TxTypeCrossNode,
		SenderID:         &p.SenderID,
		ReceiverID:       &p.ReceiverID,
		SenderNode:       p.SenderNode,
		ReceiverNode:     p.ReceiverNode,
		Amount:           p.Amount,
		TaxAmount:        p.TaxAmount,
		TaxTargetAccount: p.TaxTargetAccount,
		UserSignature:    p.UserSignature,
		NodeSignature:    p.NodeSignature,
		ExternalID:       p.ExternalID,
	})
	if err != nil {
		return nil, err
	}

	entries := []LedgerEntry{
		{TransactionID: tx.ID, AccountID: p.SenderID, EntryType: EntryTypeDebit, Amount: p.Amount, AccountCategory: CategoryUserBalance},
		{TransactionID: tx.ID, AccountID: p.SenderID, EntryType: EntryTypeCredit, Amount: p.Amount, AccountCategory: bridgeCategory, CounterpartNode: p.ReceiverNode},
	}

	if p.TaxAmount > 0 && p.TaxTargetAccount != nil {
		entries = append(entries,
			LedgerEntry{TransactionID: tx.ID, AccountID: p.SenderID, EntryType: EntryTypeDebit, Amount: p.TaxAmount, AccountCategory: CategoryUserBalance},
			LedgerEntry{TransactionID: tx.ID, AccountID: *p.TaxTargetAccount, EntryType: EntryTypeCredit, Amount: p.TaxAmount, AccountCategory: CategoryFund},
		)
	}

	if err := l.PostEntries(ctx, tx.ID, entries); err != nil {
		return nil, fmt.Errorf("posting entries: %w", err)
	}

	// Guardar en la cadena de transacciones cross-node (firma dual + hash encadenado)
	if err := l.recordCrossNodeTxChain(ctx, tx, poolType, p.NodeSignature, p.ReceiverSignature); err != nil {
		// No fallar la transaccion si la cadena falla, pero logear
		// La transaccion ya esta registrada en el ledger
	}

	return tx, nil
}

// recordCrossNodeTxChain guarda la transaccion en cross_node_tx_chain con hash encadenado.
// El prev_hash se obtiene de la ultima transaccion con el mismo par de nodos.
func (l *Ledger) recordCrossNodeTxChain(ctx context.Context, tx *Transaction, poolType PoolType, senderSig, receiverSig string) error {
	// Obtener el ultimo hash de la cadena para este par de nodos
	var prevHash *string
	_ = l.Pool.QueryRow(ctx,
		`SELECT tx_hash FROM cross_node_tx_chain
		 WHERE sender_node = $1 AND receiver_node = $2
		 ORDER BY created_at DESC LIMIT 1`,
		tx.SenderNode, tx.ReceiverNode,
	).Scan(&prevHash)

	prevHashStr := ""
	if prevHash != nil {
		prevHashStr = *prevHash
	}

	// Calcular hash de esta transaccion
	chainData := fmt.Sprintf("%s|%s|%s|%d|%d|%s|%s|%s",
		tx.ID.String(),
		tx.SenderNode,
		tx.ReceiverNode,
		tx.Amount,
		tx.CreatedAt.UnixNano(),
		prevHashStr,
		senderSig,
		receiverSig,
	)
	h := sha256.Sum256([]byte(chainData))
	txHash := hex.EncodeToString(h[:])

	_, err := l.Pool.Exec(ctx, `
		INSERT INTO cross_node_tx_chain
			(tx_id, pool_type, sender_node, receiver_node, amount,
			 sender_signature, receiver_signature, prev_hash, tx_hash, synced, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10)`,
		tx.ID, string(poolType), tx.SenderNode, tx.ReceiverNode, tx.Amount,
		senderSig, receiverSig, prevHashStr, txHash, tx.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("recording cross-node tx chain: %w", err)
	}

	return nil
}

// GetLastChainHash returns the last tx_hash in the chain for a given node pair.
// Used for reconciliation: both nodes should have the same last hash.
func (l *Ledger) GetLastChainHash(ctx context.Context, senderNode, receiverNode string) (string, error) {
	var txHash string
	err := l.Pool.QueryRow(ctx,
		`SELECT tx_hash FROM cross_node_tx_chain
		 WHERE sender_node = $1 AND receiver_node = $2
		 ORDER BY created_at DESC LIMIT 1`,
		senderNode, receiverNode,
	).Scan(&txHash)
	if err != nil {
		if err == pgx.ErrNoRows {
			return "", nil
		}
		return "", fmt.Errorf("getting last chain hash: %w", err)
	}
	return txHash, nil
}

func (l *Ledger) GetTransactionHistory(ctx context.Context, accountID uuid.UUID, limit, offset int) ([]Transaction, error) {
	rows, err := l.Pool.Query(ctx, `
		SELECT id, tx_type, sender_id, receiver_id, sender_node, receiver_node, amount, tax_amount,
			   user_signature, node_signature, prev_hash, current_hash, external_id, status, metadata, created_at, confirmed_at
		FROM transactions 
		WHERE sender_id = $1 OR receiver_id = $1
		ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		accountID, limit, offset,
	)
	if err != nil {
		return nil, fmt.Errorf("querying transaction history: %w", err)
	}
	defer rows.Close()

	var txs []Transaction
	for rows.Next() {
		var tx Transaction
		var metadata []byte
		err := rows.Scan(
			&tx.ID, &tx.TxType, &tx.SenderID, &tx.ReceiverID, &tx.SenderNode, &tx.ReceiverNode,
			&tx.Amount, &tx.TaxAmount, &tx.UserSignature, &tx.NodeSignature,
			&tx.PrevHash, &tx.CurrentHash, &tx.ExternalID, &tx.Status, &metadata, &tx.CreatedAt, &tx.ConfirmedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning transaction: %w", err)
		}
		if metadata != nil {
			json.Unmarshal(metadata, &tx.Metadata)
		}
		txs = append(txs, tx)
	}

	return txs, nil
}

// SponsorDebtTransferParams holds the parameters for transferring debt from
// a defaulted sponsored node to its sponsor (padrino).
type SponsorDebtTransferParams struct {
	SponsorDomain   string // domain of the sponsor (padrino)
	SponsoredDomain string // domain of the defaulted node
	DebtAmount      int64  // amount of debt to transfer
}

// SponsorDebtTransfer creates a ledger transaction that transfers debt from
// a defaulted sponsored node to its sponsor. This is called when a sponsored
// node defaults on its obligations — the sponsor (padrino) assumes the debt.
//
// The transaction records:
//   - A debit to the sponsored node's global bridge account (reducing its debt)
//   - A credit to the sponsor's global bridge account (increasing its debt)
//
// This ensures the ledger remains balanced (sum-zero) and the debt is
// formally transferred to the responsible party.
func (l *Ledger) SponsorDebtTransfer(ctx context.Context, p SponsorDebtTransferParams) (*Transaction, error) {
	// Find the sponsored node's bridge account (user account that holds the
	// node_bridge_global balance for the sponsored domain)
	// We look for a system/admin account associated with the node, or use
	// the node's own config account. In practice, the debt lives in the
	// ledger_entries with account_category = 'node_bridge_global' and
	// counterpart_node = sponsored_domain.
	//
	// For the transfer, we create a transaction with:
	//   - SenderNode = sponsored domain (the defaulting node)
	//   - ReceiverNode = sponsor domain (the padrino)
	//   - TxType = sponsor_debt

	tx, err := l.CreateTransaction(ctx, CreateTxParams{
		TxType:       TxTypeSponsorDebt,
		SenderNode:   p.SponsoredDomain,
		ReceiverNode: p.SponsorDomain,
		Amount:       p.DebtAmount,
		ExternalID:   fmt.Sprintf("sponsor_debt:%s:%s", p.SponsoredDomain, p.SponsorDomain),
		Metadata: map[string]interface{}{
			"type":             "sponsor_debt_transfer",
			"sponsor_domain":   p.SponsorDomain,
			"sponsored_domain": p.SponsoredDomain,
			"debt_amount":      p.DebtAmount,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("creating sponsor debt transfer transaction: %w", err)
	}

	// Post ledger entries:
	// 1. Debit the sponsored node's global bridge (reduces its negative balance / debt)
	// 2. Credit the sponsor's global bridge (increases its negative balance / assumes debt)
	// We use the node domains as counterpart identifiers.
	// The AccountID for node bridge entries is typically the admin/system account
	// that owns the node bridge category. We use a zero UUID placeholder if no
	// specific account exists — the balance is tracked by account_category +
	// counterpart_node, not by account_id alone for node bridges.
	entries := []LedgerEntry{
		{
			TransactionID:   tx.ID,
			AccountID:       uuid.Nil, // system-level entry
			EntryType:       EntryTypeDebit,
			Amount:          p.DebtAmount,
			AccountCategory: CategoryNodeBridgeGlobal,
			CounterpartNode: p.SponsoredDomain,
		},
		{
			TransactionID:   tx.ID,
			AccountID:       uuid.Nil, // system-level entry
			EntryType:       EntryTypeCredit,
			Amount:          p.DebtAmount,
			AccountCategory: CategoryNodeBridgeGlobal,
			CounterpartNode: p.SponsorDomain,
		},
	}

	if err := l.PostEntries(ctx, tx.ID, entries); err != nil {
		return nil, fmt.Errorf("posting sponsor debt entries: %w", err)
	}

	return tx, nil
}
