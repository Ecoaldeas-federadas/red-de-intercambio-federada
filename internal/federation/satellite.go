package federation

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// SatelliteSnapshotResponse es la respuesta del nodo origen al snapshot pull.
// Contiene usuarios activos con sus saldos actuales y password hashes,
// y tarjetas NFC activas. Esto permite al satelite operar offline.
type SatelliteSnapshotResponse struct {
	Users []SatelliteSnapshotUser `json:"users"`
	Cards []SatelliteSnapshotCard `json:"cards"`
}

type SatelliteSnapshotUser struct {
	ID               string `json:"id"`
	NodeDomain       string `json:"node_domain"`
	Username         string `json:"username"`
	DisplayName      string `json:"display_name"`
	Balance          int64  `json:"balance"`
	CreditLimit      int64  `json:"credit_limit"`
	DebitLimit       int64  `json:"debit_limit"`
	MembershipStatus string `json:"membership_status"`
	PasswordHash     string `json:"password_hash"`
}

type SatelliteSnapshotCard struct {
	CardUID    string `json:"card_uid"`
	UserID     string `json:"user_id"`
	NodeDomain string `json:"node_domain"`
	CardType   string `json:"card_type"`
	IsActive   bool   `json:"is_active"`
}

// SatelliteSyncRequest es el body del endpoint de sincronizacion.
// El satelite envia las transacciones que registro offline.
type SatelliteSyncRequest struct {
	TransactionID      string `json:"transaction_id"`
	SenderID           string `json:"sender_id"`
	SenderNode         string `json:"sender_node"`
	ReceiverID         string `json:"receiver_id"`
	ReceiverNode       string `json:"receiver_node"`
	Amount             int64  `json:"amount"`
	SatelliteSignature string `json:"satellite_signature"`
	CreatedAt          string `json:"created_at"`
}

// RegisterSatelliteEndpoints registra los endpoints federados para satelites.
// Se llama desde Server.Start() para anadirlos al mux.
func (s *Server) RegisterSatelliteEndpoints(mux *http.ServeMux) {
	mux.HandleFunc("/federation/satellite/snapshot", s.handleSatelliteSnapshot)
	mux.HandleFunc("/federation/satellite/sync", s.handleSatelliteSync)
}

// handleSatelliteSnapshot devuelve el estado actual de usuarios y tarjetas
// para que el satelite lo cachee. Solo responde a satelites autorizados.
func (s *Server) handleSatelliteSnapshot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeFederationJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	// El satelite se identifica via header X-Satellite-Node
	satelliteDomain := r.Header.Get("X-Satellite-Node")
	if satelliteDomain == "" {
		writeFederationJSON(w, 400, map[string]string{"error": "X-Satellite-Node header required"})
		return
	}

	// Verificar que el satelite este autorizado en node_federation_keys
	var isSatellite bool
	err := s.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(is_satellite, false) FROM node_federation_keys
		WHERE peer_domain = $1 AND status = 'active'`,
		satelliteDomain,
	).Scan(&isSatellite)
	if err != nil || !isSatellite {
		writeFederationJSON(w, 403, map[string]string{"error": "satellite not authorized"})
		return
	}

	// Obtener usuarios activos con password_hash
	rows, err := s.Pool.Query(r.Context(), `
		SELECT u.id::text, u.node_domain, u.username, COALESCE(u.display_name, ''),
		       COALESCE((
		         SELECT SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount ELSE -le.amount END)
		         FROM ledger_entries le WHERE le.account_id = u.id AND le.account_category = 'user_balance'
		       ), 0) as balance,
		       u.credit_limit, u.debit_limit, u.membership_status,
		       uc.password_hash
		FROM users u
		JOIN user_credentials uc ON uc.user_id = u.id
		WHERE u.membership_status = 'active'
		ORDER BY u.username`)
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": fmt.Sprintf("querying users: %v", err)})
		return
	}
	defer rows.Close()

	var users []SatelliteSnapshotUser
	for rows.Next() {
		var u SatelliteSnapshotUser
		if err := rows.Scan(&u.ID, &u.NodeDomain, &u.Username, &u.DisplayName,
			&u.Balance, &u.CreditLimit, &u.DebitLimit, &u.MembershipStatus,
			&u.PasswordHash); err != nil {
			writeFederationJSON(w, 500, map[string]string{"error": fmt.Sprintf("scanning user: %v", err)})
			return
		}
		users = append(users, u)
	}

	// Obtener tarjetas activas
	cardRows, err := s.Pool.Query(r.Context(), `
		SELECT c.card_uid, c.user_id::text, u.node_domain, c.card_type, c.is_active
		FROM nfc_cards c
		JOIN users u ON c.user_id = u.id
		WHERE c.is_active = true AND u.membership_status = 'active'`)
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": fmt.Sprintf("querying cards: %v", err)})
		return
	}
	defer cardRows.Close()

	var cards []SatelliteSnapshotCard
	for cardRows.Next() {
		var c SatelliteSnapshotCard
		if err := cardRows.Scan(&c.CardUID, &c.UserID, &c.NodeDomain, &c.CardType, &c.IsActive); err != nil {
			writeFederationJSON(w, 500, map[string]string{"error": fmt.Sprintf("scanning card: %v", err)})
			return
		}
		cards = append(cards, c)
	}

	writeFederationJSON(w, 200, SatelliteSnapshotResponse{
		Users: users,
		Cards: cards,
	})
}

// handleSatelliteSync recibe transacciones del satelite y las registra.
// NO valida limites — la transaccion ya ocurrio offline.
// Verifica la firma Ed25519 del satelite.
func (s *Server) handleSatelliteSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeFederationJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	satelliteDomain := r.Header.Get("X-Satellite-Node")
	if satelliteDomain == "" {
		writeFederationJSON(w, 400, map[string]string{"error": "X-Satellite-Node header required"})
		return
	}

	var req SatelliteSyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeFederationJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	if req.TransactionID == "" || req.SatelliteSignature == "" {
		writeFederationJSON(w, 400, map[string]string{"error": "transaction_id and satellite_signature required"})
		return
	}

	// Verificar que el satelite este autorizado
	var isSatellite bool
	var peerPubKey string
	err := s.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(is_satellite, false), peer_public_key
		FROM node_federation_keys
		WHERE peer_domain = $1 AND status = 'active'`,
		satelliteDomain,
	).Scan(&isSatellite, &peerPubKey)
	if err != nil || !isSatellite {
		writeFederationJSON(w, 403, map[string]string{"error": "satellite not authorized"})
		return
	}

	// Verificar firma Ed25519 del satelite
	// Datos firmados: transaction_id|sender_node|receiver_node|amount|created_at_unix_nano
	parsedTime, err := time.Parse(time.RFC3339Nano, req.CreatedAt)
	if err != nil {
		writeFederationJSON(w, 400, map[string]string{"error": "invalid created_at format"})
		return
	}

	signedData := fmt.Sprintf("%s|%s|%s|%d|%d",
		req.TransactionID, req.SenderNode, req.ReceiverNode, req.Amount, parsedTime.UnixNano())

	if !verifySatelliteSignature(peerPubKey, signedData, req.SatelliteSignature) {
		writeFederationJSON(w, 400, map[string]string{"error": "invalid satellite signature"})
		return
	}

	// Idempotencia: verificar si ya procesamos esta transaccion
	var exists bool
	_ = s.Pool.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM processed_messages WHERE id = $1)`,
		req.TransactionID,
	).Scan(&exists)
	if exists {
		writeFederationJSON(w, 200, map[string]string{"status": "already_processed"})
		return
	}

	// Registrar como procesada
	_, err = s.Pool.Exec(r.Context(), `
		INSERT INTO processed_messages (id, source_node) VALUES ($1, $2)
		ON CONFLICT (id) DO NOTHING`,
		req.TransactionID, satelliteDomain,
	)
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": "processing message"})
		return
	}

	txUUID, err := uuid.Parse(req.TransactionID)
	if err != nil {
		txUUID = uuid.New()
	}

	senderID, err := uuid.Parse(req.SenderID)
	if err != nil {
		writeFederationJSON(w, 400, map[string]string{"error": "invalid sender_id"})
		return
	}

	// Registrar entradas del ledger en el nodo origen:
	// 1. Debitar el balance del usuario (gasto offline)
	// 2. Acreditar el node_bridge (deuda del nodo receptor al satelite/padre)
	_, err = s.Pool.Exec(r.Context(), `
		INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, account_category, counterpart_node)
		VALUES ($1, $2, 'debit', $3, 'user_balance', $4)`,
		txUUID, senderID, req.Amount, req.ReceiverNode,
	)
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": fmt.Sprintf("debiting user: %v", err)})
		return
	}

	_, err = s.Pool.Exec(r.Context(), `
		INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, account_category, counterpart_node)
		VALUES ($1, $2, 'credit', $3, 'node_bridge_global', $4)`,
		txUUID, senderID, req.Amount, req.ReceiverNode,
	)
	if err != nil {
		writeFederationJSON(w, 500, map[string]string{"error": fmt.Sprintf("crediting bridge: %v", err)})
		return
	}

	// Guardar en cross_node_tx_chain
	chainData := fmt.Sprintf("%s|%s|%s|%d|%d|%s|%s",
		req.TransactionID, req.SenderNode, req.ReceiverNode, req.Amount,
		parsedTime.UnixNano(), "", req.SatelliteSignature)
	hash := sha256Sum(chainData)

	_, _ = s.Pool.Exec(r.Context(), `
		INSERT INTO cross_node_tx_chain
		(tx_id, pool_type, sender_node, receiver_node, amount,
		 sender_signature, receiver_signature, prev_hash, tx_hash, synced, created_at)
		VALUES ($1, 'global', $2, $3, $4, $5, $6, '', $7, true, $8)
		ON CONFLICT DO NOTHING`,
		txUUID, req.SenderNode, req.ReceiverNode, req.Amount,
		req.SatelliteSignature, "", hash, parsedTime,
	)

	// Verificar si el usuario quedo sobre su limite
	var balance, creditLimit int64
	_ = s.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0),
		       u.credit_limit
		FROM ledger_entries le
		JOIN users u ON u.id = le.account_id
		WHERE le.account_id = $1 AND le.account_category = 'user_balance'
		GROUP BY u.credit_limit`,
		senderID,
	).Scan(&balance, &creditLimit)

	if balance < creditLimit {
		_, _ = s.Pool.Exec(r.Context(),
			`UPDATE users SET is_over_limit = true WHERE id = $1`, senderID)
		// TODO: notificar al usuario y al admin
	}

	writeFederationJSON(w, 200, map[string]interface{}{
		"status":         "accepted",
		"transaction_id": req.TransactionID,
	})
}

// verifySatelliteSignature verifica la firma Ed25519 del satelite.
func verifySatelliteSignature(peerPubKeyHex, data, signatureHex string) bool {
	pubKeyBytes, err := hex.DecodeString(peerPubKeyHex)
	if err != nil || len(pubKeyBytes) != ed25519.PublicKeySize {
		return false
	}

	sigBytes, err := hex.DecodeString(signatureHex)
	if err != nil {
		return false
	}

	return ed25519.Verify(ed25519.PublicKey(pubKeyBytes), []byte(data), sigBytes)
}

func sha256Sum(data string) string {
	h := sha256.Sum256([]byte(data))
	return hex.EncodeToString(h[:])
}
