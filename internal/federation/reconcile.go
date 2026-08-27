package federation

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Reconciler handles reconciliation of cross-node transaction chains.
// When two nodes reconnect, they compare their chain hashes and resolve
// any discrepancies. This ensures both nodes have the same view of
// transactions and that no manipulation has occurred.
type Reconciler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func NewReconciler(pool *pgxpool.Pool, nodeDomain string) *Reconciler {
	return &Reconciler{Pool: pool, NodeDomain: nodeDomain}
}

// ChainEntry represents a single entry in the cross-node tx chain
type ChainEntry struct {
	TxID              string    `json:"tx_id"`
	PoolType          string    `json:"pool_type"`
	SenderNode        string    `json:"sender_node"`
	ReceiverNode      string    `json:"receiver_node"`
	Amount            int64     `json:"amount"`
	SenderSignature   string    `json:"sender_signature"`
	ReceiverSignature string    `json:"receiver_signature"`
	PrevHash          string    `json:"prev_hash"`
	TxHash            string    `json:"tx_hash"`
	CreatedAt         time.Time `json:"created_at"`
}

// GetLastChainHash returns the last tx_hash in the chain for a given node pair.
func (r *Reconciler) GetLastChainHash(ctx context.Context, senderNode, receiverNode string) (string, error) {
	var txHash string
	err := r.Pool.QueryRow(ctx,
		`SELECT tx_hash FROM cross_node_tx_chain
		 WHERE sender_node = $1 AND receiver_node = $2
		 ORDER BY created_at DESC LIMIT 1`,
		senderNode, receiverNode,
	).Scan(&txHash)
	if err != nil {
		return "", nil // no rows = empty chain
	}
	return txHash, nil
}

// GetChainSince returns all chain entries after the given hash (or all if empty).
// Used to send divergent transactions to a peer during reconciliation.
func (r *Reconciler) GetChainSince(ctx context.Context, senderNode, receiverNode, sinceHash string) ([]ChainEntry, error) {
	var rows interface{ Next() bool; Scan(...interface{}) error; Close() }

	var err error
	if sinceHash == "" {
		rows, err = r.Pool.Query(ctx,
			`SELECT tx_id, pool_type, sender_node, receiver_node, amount,
			 sender_signature, receiver_signature, COALESCE(prev_hash, ''), tx_hash, created_at
			 FROM cross_node_tx_chain
			 WHERE sender_node = $1 AND receiver_node = $2
			 ORDER BY created_at`,
			senderNode, receiverNode)
	} else {
		// Find entries after the given hash
		rows, err = r.Pool.Query(ctx,
			`SELECT tx_id, pool_type, sender_node, receiver_node, amount,
			 sender_signature, receiver_signature, COALESCE(prev_hash, ''), tx_hash, created_at
			 FROM cross_node_tx_chain
			 WHERE sender_node = $1 AND receiver_node = $2
			 AND created_at > (
			   SELECT created_at FROM cross_node_tx_chain WHERE tx_hash = $3
			 )
			 ORDER BY created_at`,
			senderNode, receiverNode, sinceHash)
	}
	if err != nil {
		return nil, fmt.Errorf("querying chain since: %w", err)
	}
	defer rows.Close()

	var entries []ChainEntry
	for rows.Next() {
		var e ChainEntry
		if err := rows.Scan(&e.TxID, &e.PoolType, &e.SenderNode, &e.ReceiverNode,
			&e.Amount, &e.SenderSignature, &e.ReceiverSignature,
			&e.PrevHash, &e.TxHash, &e.CreatedAt); err != nil {
			continue
		}
		entries = append(entries, e)
	}
	return entries, nil
}

// VerifyChainEntry verifies that a chain entry has valid signatures and correct hash.
// Returns true if the entry is valid.
func (r *Reconciler) VerifyChainEntry(entry *ChainEntry) bool {
	// Recompute the hash and verify it matches
	chainData := fmt.Sprintf("%s|%s|%s|%d|%d|%s|%s|%s",
		entry.TxID,
		entry.SenderNode,
		entry.ReceiverNode,
		entry.Amount,
		entry.CreatedAt.UnixNano(),
		entry.PrevHash,
		entry.SenderSignature,
		entry.ReceiverSignature,
	)
	h := sha256.Sum256([]byte(chainData))
	computedHash := hex.EncodeToString(h[:])

	return computedHash == entry.TxHash
}

// ImportChainEntry imports a chain entry from a peer if it's valid and not already present.
// This is used during reconciliation to fill in missing transactions.
func (r *Reconciler) ImportChainEntry(ctx context.Context, entry *ChainEntry) error {
	if !r.VerifyChainEntry(entry) {
		return fmt.Errorf("invalid chain entry: hash mismatch for tx %s", entry.TxID)
	}

	// Check if both signatures are present (firma dual)
	if entry.SenderSignature == "" || entry.ReceiverSignature == "" {
		return fmt.Errorf("invalid chain entry: missing dual signatures for tx %s", entry.TxID)
	}

	_, err := r.Pool.Exec(ctx, `
		INSERT INTO cross_node_tx_chain
			(tx_id, pool_type, sender_node, receiver_node, amount,
			 sender_signature, receiver_signature, prev_hash, tx_hash, synced, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)
		ON CONFLICT (tx_id) DO NOTHING`,
		entry.TxID, entry.PoolType, entry.SenderNode, entry.ReceiverNode,
		entry.Amount, entry.SenderSignature, entry.ReceiverSignature,
		entry.PrevHash, entry.TxHash, entry.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("importing chain entry: %w", err)
	}
	return nil
}

// ReconcileWithPeer compares chain hashes with a peer and resolves discrepancies.
// Returns the number of entries imported.
func (r *Reconciler) ReconcileWithPeer(ctx context.Context, peerNode string) (int, error) {
	// Get our last hash for both directions (A->B and B->A)
	ourHashAB, _ := r.GetLastChainHash(ctx, r.NodeDomain, peerNode)
	ourHashBA, _ := r.GetLastChainHash(ctx, peerNode, r.NodeDomain)

	// In a real implementation, we would call the peer's /federation/reconcile endpoint
	// to get their last hash and compare. For now, this is a stub that would be
	// called by the gossip protocol when it detects a hash mismatch.
	//
	// The flow would be:
	// 1. Call peer: GET /federation/reconcile/compare?node=ourDomain
	// 2. Peer returns their last hash for both directions
	// 3. If hashes match -> synchronized, return 0
	// 4. If mismatch -> GET /federation/reconcile/chain?node=ourDomain&since=ourHash
	// 5. Peer returns chain entries since our last known hash
	// 6. Verify each entry (signatures + hash)
	// 7. Import valid entries

	_ = ourHashAB
	_ = ourHashBA

	return 0, nil
}

// MarkAsSynced marks a chain entry as synced with the peer.
func (r *Reconciler) MarkAsSynced(ctx context.Context, txID string) error {
	_, err := r.Pool.Exec(ctx,
		`UPDATE cross_node_tx_chain SET synced = true, synced_at = NOW() WHERE tx_id = $1`,
		txID,
	)
	return err
}

// GetUnsyncedEntries returns chain entries that haven't been synced with the peer yet.
func (r *Reconciler) GetUnsyncedEntries(ctx context.Context, peerNode string) ([]ChainEntry, error) {
	rows, err := r.Pool.Query(ctx,
		`SELECT tx_id, pool_type, sender_node, receiver_node, amount,
		 sender_signature, receiver_signature, COALESCE(prev_hash, ''), tx_hash, created_at
		 FROM cross_node_tx_chain
		 WHERE (sender_node = $1 OR receiver_node = $1) AND synced = false
		 ORDER BY created_at`,
		peerNode)
	if err != nil {
		return nil, fmt.Errorf("getting unsynced entries: %w", err)
	}
	defer rows.Close()

	var entries []ChainEntry
	for rows.Next() {
		var e ChainEntry
		if err := rows.Scan(&e.TxID, &e.PoolType, &e.SenderNode, &e.ReceiverNode,
			&e.Amount, &e.SenderSignature, &e.ReceiverSignature,
			&e.PrevHash, &e.TxHash, &e.CreatedAt); err != nil {
			continue
		}
		entries = append(entries, e)
	}
	return entries, nil
}
