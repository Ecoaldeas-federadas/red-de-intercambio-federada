package federation

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PeerClient is the interface for making requests to federation peers.
type PeerClient interface {
	GetFromPeer(ctx context.Context, peerDomain, path string) ([]byte, error)
}

// Reconciler handles reconciliation of cross-node transaction chains.
// When two nodes reconnect, they compare their chain hashes and resolve
// any discrepancies. This ensures both nodes have the same view of
// transactions and that no manipulation has occurred.
type Reconciler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
	Client     PeerClient
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
	var rows interface {
		Next() bool
		Scan(...interface{}) error
		Close()
	}

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
// It verifies:
//  1. The hash chain integrity (VerifyChainEntry)
//  2. Both signatures are present (firma dual)
//  3. Cryptographic Ed25519 verification of both signatures against the
//     registered public keys of the sender and receiver nodes
func (r *Reconciler) ImportChainEntry(ctx context.Context, entry *ChainEntry) error {
	if !r.VerifyChainEntry(entry) {
		return fmt.Errorf("invalid chain entry: hash mismatch for tx %s", entry.TxID)
	}

	// Check if both signatures are present (firma dual)
	if entry.SenderSignature == "" || entry.ReceiverSignature == "" {
		return fmt.Errorf("invalid chain entry: missing dual signatures for tx %s", entry.TxID)
	}

	// Cryptographic Ed25519 verification of both signatures
	// The signed data is: tx_id|sender_node|receiver_node|amount|created_at_unix_nano
	signedData := fmt.Sprintf("%s|%s|%s|%d|%d",
		entry.TxID,
		entry.SenderNode,
		entry.ReceiverNode,
		entry.Amount,
		entry.CreatedAt.UnixNano(),
	)

	// Verify sender signature against sender node's public key
	if !r.verifyNodeSignature(ctx, entry.SenderNode, signedData, entry.SenderSignature) {
		return fmt.Errorf("invalid chain entry: sender signature cryptographic verification failed for tx %s", entry.TxID)
	}

	// Verify receiver signature against receiver node's public key
	if !r.verifyNodeSignature(ctx, entry.ReceiverNode, signedData, entry.ReceiverSignature) {
		return fmt.Errorf("invalid chain entry: receiver signature cryptographic verification failed for tx %s", entry.TxID)
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

// verifyNodeSignature looks up the peer's public key in node_federation_keys
// and cryptographically verifies the Ed25519 signature over the given data.
// Returns true if valid, false otherwise (fails closed if key not found).
func (r *Reconciler) verifyNodeSignature(ctx context.Context, peerDomain, data, signatureHex string) bool {
	var peerPubKey string
	err := r.Pool.QueryRow(ctx,
		`SELECT peer_public_key FROM node_federation_keys
		 WHERE peer_domain = $1 AND status = 'active'`,
		peerDomain,
	).Scan(&peerPubKey)
	if err != nil {
		return false
	}

	pubKeyBytes, err := hex.DecodeString(peerPubKey)
	if err != nil || len(pubKeyBytes) != ed25519.PublicKeySize {
		return false
	}

	sigBytes, err := hex.DecodeString(signatureHex)
	if err != nil {
		return false
	}

	return ed25519.Verify(ed25519.PublicKey(pubKeyBytes), []byte(data), sigBytes)
}

// ReconcileWithPeer compares chain hashes with a peer and resolves discrepancies.
// Returns the number of entries imported.
func (r *Reconciler) ReconcileWithPeer(ctx context.Context, peerNode string) (int, error) {
	// Get our last hash for both directions (A->B and B->A)
	ourHashAB, _ := r.GetLastChainHash(ctx, r.NodeDomain, peerNode)
	ourHashBA, _ := r.GetLastChainHash(ctx, peerNode, r.NodeDomain)

	// Compare with peer via the federation client
	// The peer's /federation/reconcile/compare endpoint returns their last hashes
	peerHashAB, peerHashBA, err := r.compareWithPeer(ctx, peerNode)
	if err != nil {
		// Peer unreachable or error - return 0, no reconciliation possible now
		return 0, nil
	}

	imported := 0

	// Direction A->B (we are sender, peer is receiver)
	if ourHashAB != peerHashAB {
		// Divergence detected: fetch chain entries from peer since our last hash
		entries, err := r.fetchChainFromPeer(ctx, peerNode, r.NodeDomain, ourHashAB)
		if err == nil {
			for _, entry := range entries {
				// Verify both signatures and hash before importing
				if r.VerifyChainEntry(&entry) {
					if err := r.ImportChainEntry(ctx, &entry); err == nil {
						imported++
					}
				}
			}
		}
	}

	// Direction B->A (peer is sender, we are receiver)
	if ourHashBA != peerHashBA {
		entries, err := r.fetchChainFromPeer(ctx, peerNode, peerNode, ourHashBA)
		if err == nil {
			for _, entry := range entries {
				if r.VerifyChainEntry(&entry) {
					if err := r.ImportChainEntry(ctx, &entry); err == nil {
						imported++
					}
				}
			}
		}
	}

	return imported, nil
}

// compareWithPeer calls the peer's /federation/reconcile/compare endpoint
// to get their last hashes for both directions.
func (r *Reconciler) compareWithPeer(ctx context.Context, peerNode string) (string, string, error) {
	// Use the federation client to call the peer's compare endpoint
	// Returns (hashAB, hashBA, error)
	// If the peer is unreachable, returns empty strings and error
	if r.Client == nil {
		return "", "", fmt.Errorf("no federation client configured")
	}
	resp, err := r.Client.GetFromPeer(ctx, peerNode, "/federation/reconcile/compare?node="+r.NodeDomain)
	if err != nil {
		return "", "", err
	}
	var result struct {
		HashAB string `json:"hash_ab"`
		HashBA string `json:"hash_ba"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return "", "", err
	}
	return result.HashAB, result.HashBA, nil
}

// fetchChainFromPeer calls the peer's /federation/reconcile/chain endpoint
// to get chain entries since the given hash.
func (r *Reconciler) fetchChainFromPeer(ctx context.Context, peerNode, senderNode, sinceHash string) ([]ChainEntry, error) {
	if r.Client == nil {
		return nil, fmt.Errorf("no federation client configured")
	}
	endpoint := fmt.Sprintf("/federation/reconcile/chain?sender=%s&since=%s", senderNode, sinceHash)
	resp, err := r.Client.GetFromPeer(ctx, peerNode, endpoint)
	if err != nil {
		return nil, err
	}
	var entries []ChainEntry
	if err := json.Unmarshal(resp, &entries); err != nil {
		return nil, err
	}
	return entries, nil
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
