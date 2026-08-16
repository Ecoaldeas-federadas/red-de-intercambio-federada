package ledger

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Verifier struct {
	Pool *pgxpool.Pool
}

func NewVerifier(pool *pgxpool.Pool) *Verifier {
	return &Verifier{Pool: pool}
}

func (v *Verifier) VerifyHashChain(ctx context.Context) (bool, error) {
	rows, err := v.Pool.Query(ctx, `
		SELECT id, tx_type, sender_node, receiver_node, amount, tax_amount, prev_hash, current_hash
		FROM transactions 
		WHERE current_hash IS NOT NULL 
		ORDER BY created_at ASC`,
	)
	if err != nil {
		return false, fmt.Errorf("querying transactions for verification: %w", err)
	}
	defer rows.Close()

	var prevHash string
	for rows.Next() {
		var id, txType, senderNode, receiverNode, currentHash string
		var amount, taxAmount int64
		var rowPrevHash *string

		err := rows.Scan(&id, &txType, &senderNode, &receiverNode, &amount, &taxAmount, &rowPrevHash, &currentHash)
		if err != nil {
			return false, fmt.Errorf("scanning transaction: %w", err)
		}

		expectedData := fmt.Sprintf("%s|%s|%s|%s|%d|%d|%s",
			id, txType, senderNode, receiverNode, amount, taxAmount, prevHash)
		h := sha256.Sum256([]byte(expectedData))
		expectedHash := hex.EncodeToString(h[:])

		if currentHash != expectedHash {
			return false, fmt.Errorf("hash mismatch at transaction %s: expected %s, got %s", id, expectedHash, currentHash)
		}

		prevHash = currentHash
	}

	return true, nil
}

func (v *Verifier) VerifyZeroSum(ctx context.Context) (bool, error) {
	var sum int64
	err := v.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0) FROM ledger_entries`,
	).Scan(&sum)
	if err != nil {
		return false, fmt.Errorf("querying ledger sum: %w", err)
	}

	if sum != 0 {
		return false, fmt.Errorf("ledger does not sum to zero: %d", sum)
	}

	return true, nil
}

func (v *Verifier) VerifyTransactionIntegrity(ctx context.Context, txID string) (bool, error) {
	var sum int64
	err := v.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)
		 FROM ledger_entries WHERE transaction_id = $1`,
		txID,
	).Scan(&sum)
	if err != nil {
		return false, fmt.Errorf("querying transaction entries: %w", err)
	}

	return sum == 0, nil
}
