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
)

type EntryType string

const (
	EntryTypeDebit  EntryType = "debit"
	EntryTypeCredit EntryType = "credit"
)

type AccountCategory string

const (
	CategoryUserBalance    AccountCategory = "user_balance"
	CategoryNodeBridge     AccountCategory = "node_bridge"
	CategoryFund           AccountCategory = "fund"
	CategoryExternalBridge AccountCategory = "external_bridge"
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
		 FROM ledger_entries WHERE counterpart_node = $1 AND account_category = 'node_bridge'`,
		remoteNode,
	).Scan(&balance)
	if err != nil {
		return 0, fmt.Errorf("getting node balance: %w", err)
	}
	return balance, nil
}

func (l *Ledger) GetGlobalBaseBalance(ctx context.Context, localNode string) (int64, error) {
	var balance int64
	err := l.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)
		 FROM ledger_entries 
		 WHERE account_category = 'node_bridge' 
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
		_, err := l.Pool.Exec(ctx, `
			INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, account_category, counterpart_node, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
			txID, e.AccountID, e.EntryType, e.Amount, e.AccountCategory, e.CounterpartNode,
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
	SenderID         uuid.UUID
	ReceiverID       uuid.UUID
	SenderNode       string
	ReceiverNode     string
	Amount           int64
	TaxAmount        int64
	TaxTargetAccount *uuid.UUID
	UserSignature    string
	NodeSignature    string
	ExternalID       string
}

func (l *Ledger) CrossNodeTransfer(ctx context.Context, p CrossNodeTransferParams) (*Transaction, error) {
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
		{TransactionID: tx.ID, AccountID: p.SenderID, EntryType: EntryTypeCredit, Amount: p.Amount, AccountCategory: CategoryNodeBridge, CounterpartNode: p.ReceiverNode},
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

	return tx, nil
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
