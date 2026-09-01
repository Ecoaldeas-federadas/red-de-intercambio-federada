package satellite

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Satellite maneja la logica del nodo satelite: snapshot pull/push,
// autenticacion offline, y procesamiento de pagos offline.

type Satellite struct {
	Pool       *pgxpool.Pool
	NodeDomain string
	PrivateKey ed25519.PrivateKey // clave del nodo satelite para firmar transacciones
}

func New(pool *pgxpool.Pool, nodeDomain string) *Satellite {
	return &Satellite{
		Pool:       pool,
		NodeDomain: nodeDomain,
	}
}

// SetPrivateKey configura la clave privada del satelite para firmar.
func (s *Satellite) SetPrivateKey(priv ed25519.PrivateKey) {
	s.PrivateKey = priv
}

// IsSatellite verifica si este nodo es un satelite.
func (s *Satellite) IsSatellite(ctx context.Context) bool {
	var nodeType string
	_ = s.Pool.QueryRow(ctx, `SELECT node_type FROM node_config LIMIT 1`).Scan(&nodeType)
	return nodeType == "satellite"
}

// --- Snapshot Pull ---

// SnapshotUser representa un usuario descargado del nodo origen.
type SnapshotUser struct {
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

// SnapshotCard representa una tarjeta NFC descargada del nodo origen.
type SnapshotCard struct {
	CardUID    string `json:"card_uid"`
	UserID     string `json:"user_id"`
	NodeDomain string `json:"node_domain"`
	CardType   string `json:"card_type"`
	IsActive   bool   `json:"is_active"`
}

// SnapshotResponse es la respuesta del nodo origen al snapshot pull.
type SnapshotResponse struct {
	Users []SnapshotUser `json:"users"`
	Cards []SnapshotCard `json:"cards"`
}

// PullSnapshot descarga el estado actual de usuarios y tarjetas de un nodo remoto.
// remoteNodeURL es la URL del servidor federado mTLS del nodo origen.
func (s *Satellite) PullSnapshot(ctx context.Context, remoteNodeURL string, httpClient *http.Client) (*SnapshotResponse, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", remoteNodeURL+"/federation/satellite/snapshot", nil)
	if err != nil {
		return nil, fmt.Errorf("creating snapshot request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Satellite-Node", s.NodeDomain)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("requesting snapshot: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("remote node returned status %d", resp.StatusCode)
	}

	var result SnapshotResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decoding snapshot response: %w", err)
	}
	return &result, nil
}

// SaveCachedUsers guarda los usuarios descargados en la tabla de cache local.
func (s *Satellite) SaveCachedUsers(ctx context.Context, users []SnapshotUser) error {
	for _, u := range users {
		_, err := s.Pool.Exec(ctx, `
			INSERT INTO satellite_cached_users
				(id, node_domain, username, display_name, balance, credit_limit, debit_limit, membership_status, password_hash, cached_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
			ON CONFLICT (node_domain, username) DO UPDATE SET
				balance = EXCLUDED.balance,
				credit_limit = EXCLUDED.credit_limit,
				debit_limit = EXCLUDED.debit_limit,
				membership_status = EXCLUDED.membership_status,
				password_hash = EXCLUDED.password_hash,
				cached_at = NOW()`,
			u.ID, u.NodeDomain, u.Username, u.DisplayName, u.Balance,
			u.CreditLimit, u.DebitLimit, u.MembershipStatus, u.PasswordHash,
		)
		if err != nil {
			return fmt.Errorf("saving cached user %s: %w", u.Username, err)
		}
	}
	return nil
}

// SaveCachedCards guarda las tarjetas descargadas en la tabla de cache local.
func (s *Satellite) SaveCachedCards(ctx context.Context, cards []SnapshotCard) error {
	for _, c := range cards {
		_, err := s.Pool.Exec(ctx, `
			INSERT INTO satellite_cached_cards
				(card_uid, user_id, node_domain, card_type, is_active, cached_at)
			VALUES ($1, $2, $3, $4, $5, NOW())
			ON CONFLICT (card_uid) DO UPDATE SET
				user_id = EXCLUDED.user_id,
				card_type = EXCLUDED.card_type,
				is_active = EXCLUDED.is_active,
				cached_at = NOW()`,
			c.CardUID, c.UserID, c.NodeDomain, c.CardType, c.IsActive,
		)
		if err != nil {
			return fmt.Errorf("saving cached card %s: %w", c.CardUID, err)
		}
	}
	return nil
}

// --- Autenticacion Offline ---

// CachedUserLookup busca un usuario en el cache local por username.
func (s *Satellite) CachedUserLookup(ctx context.Context, username, nodeDomain string) (*SnapshotUser, error) {
	var u SnapshotUser
	err := s.Pool.QueryRow(ctx, `
		SELECT id::text, node_domain, username, COALESCE(display_name, ''),
		       balance, credit_limit, debit_limit, membership_status, password_hash
		FROM satellite_cached_users
		WHERE LOWER(username) = LOWER($1) AND node_domain = $2`,
		username, nodeDomain,
	).Scan(&u.ID, &u.NodeDomain, &u.Username, &u.DisplayName,
		&u.Balance, &u.CreditLimit, &u.DebitLimit, &u.MembershipStatus, &u.PasswordHash)
	if err != nil {
		return nil, fmt.Errorf("user not in cache: %w", err)
	}
	return &u, nil
}

// --- Pago Offline ---

// OfflinePaymentResult contiene el resultado de un pago offline.
type OfflinePaymentResult struct {
	Approved      bool   `json:"approved"`
	TransactionID string `json:"transaction_id,omitempty"`
	Message       string `json:"message,omitempty"`
	NewBalance    int64  `json:"new_balance,omitempty"`
}

// ProcessOfflinePayment procesa un pago NFC offline contra el cache local.
// Valida el saldo del usuario contra el cache, registra la transaccion
// en satellite_pending_tx, y actualiza el balance en el cache.
func (s *Satellite) ProcessOfflinePayment(ctx context.Context, cardUID string, amount int64, receiverID uuid.UUID, receiverNode string) (*OfflinePaymentResult, error) {
	// 1. Buscar tarjeta en cache
	var userIDStr string
	var userNodeDomain string
	var cardIsActive bool
	err := s.Pool.QueryRow(ctx, `
		SELECT user_id::text, node_domain, is_active
		FROM satellite_cached_cards WHERE card_uid = $1`,
		cardUID,
	).Scan(&userIDStr, &userNodeDomain, &cardIsActive)
	if err != nil {
		return &OfflinePaymentResult{Approved: false, Message: "tarjeta no encontrada en cache"}, nil
	}
	if !cardIsActive {
		return &OfflinePaymentResult{Approved: false, Message: "tarjeta inactiva"}, nil
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return &OfflinePaymentResult{Approved: false, Message: "ID de usuario invalido"}, nil
	}

	// 2. Buscar usuario en cache y validar saldo
	var balance, creditLimit int64
	var membershipStatus string
	err = s.Pool.QueryRow(ctx, `
		SELECT balance, credit_limit, membership_status
		FROM satellite_cached_users WHERE id = $1`,
		userID,
	).Scan(&balance, &creditLimit, &membershipStatus)
	if err != nil {
		return &OfflinePaymentResult{Approved: false, Message: "usuario no encontrado en cache"}, nil
	}

	if membershipStatus != "active" {
		return &OfflinePaymentResult{Approved: false, Message: "usuario no activo"}, nil
	}

	newBalance := balance - amount
	if newBalance < creditLimit {
		return &OfflinePaymentResult{
			Approved: false,
			Message:  fmt.Sprintf("saldo insuficiente: nuevo saldo %.2f < limite %.2f", float64(newBalance)/100, float64(creditLimit)/100),
		}, nil
	}

	// 3. Firmar la transaccion con la clave del satelite
	txID := uuid.New()
	createdAt := time.Now()

	signedData := fmt.Sprintf("%s|%s|%s|%d|%d", txID.String(), userNodeDomain, receiverNode, amount, createdAt.UnixNano())
	var signature string
	if s.PrivateKey != nil {
		sig := ed25519.Sign(s.PrivateKey, []byte(signedData))
		signature = hex.EncodeToString(sig)
	} else {
		return nil, fmt.Errorf("satellite private key not configured")
	}

	// 4. Registrar transaccion pendiente
	_, err = s.Pool.Exec(ctx, `
		INSERT INTO satellite_pending_tx
			(id, sender_id, sender_node, receiver_id, receiver_node, amount,
			 satellite_signature, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		txID, userID, userNodeDomain, receiverID, receiverNode, amount,
		signature, createdAt,
	)
	if err != nil {
		return nil, fmt.Errorf("registering pending tx: %w", err)
	}

	// 5. Actualizar balance en cache
	_, err = s.Pool.Exec(ctx, `
		UPDATE satellite_cached_users SET balance = $1 WHERE id = $2`,
		newBalance, userID)
	if err != nil {
		return nil, fmt.Errorf("updating cached balance: %w", err)
	}

	return &OfflinePaymentResult{
		Approved:      true,
		TransactionID: txID.String(),
		NewBalance:    newBalance,
	}, nil
}

// --- Snapshot Push (sincronizacion al reconectar) ---

// PendingTx representa una transaccion pendiente de sincronizar.
type PendingTx struct {
	ID                 string    `json:"id"`
	SenderID           string    `json:"sender_id"`
	SenderNode         string    `json:"sender_node"`
	ReceiverID         string    `json:"receiver_id"`
	ReceiverNode       string    `json:"receiver_node"`
	Amount             int64     `json:"amount"`
	SatelliteSignature string    `json:"satellite_signature"`
	CreatedAt          time.Time `json:"created_at"`
}

// GetPendingTx retorna las transacciones pendientes de sincronizar.
func (s *Satellite) GetPendingTx(ctx context.Context) ([]PendingTx, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id::text, sender_id::text, sender_node, receiver_id::text,
		       receiver_node, amount, satellite_signature, created_at
		FROM satellite_pending_tx WHERE synced = false
		ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txs []PendingTx
	for rows.Next() {
		var tx PendingTx
		if err := rows.Scan(&tx.ID, &tx.SenderID, &tx.SenderNode, &tx.ReceiverID,
			&tx.ReceiverNode, &tx.Amount, &tx.SatelliteSignature, &tx.CreatedAt); err != nil {
			return nil, err
		}
		txs = append(txs, tx)
	}
	return txs, nil
}

// MarkTxSynced marca una transaccion como sincronizada.
func (s *Satellite) MarkTxSynced(ctx context.Context, txID string) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE satellite_pending_tx SET synced = true, synced_at = NOW() WHERE id = $1`,
		txID)
	return err
}

// MarkTxError marca una transaccion con error de sincronizacion.
func (s *Satellite) MarkTxError(ctx context.Context, txID, errMsg string) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE satellite_pending_tx SET sync_error = $2 WHERE id = $1`,
		txID, errMsg)
	return err
}

// SyncPendingTx envia una transaccion pendiente al nodo origen via mTLS.
func (s *Satellite) SyncPendingTx(ctx context.Context, tx PendingTx, remoteNodeURL string, httpClient *http.Client) error {
	body, _ := json.Marshal(map[string]interface{}{
		"transaction_id":      tx.ID,
		"sender_id":           tx.SenderID,
		"sender_node":         tx.SenderNode,
		"receiver_id":         tx.ReceiverID,
		"receiver_node":       tx.ReceiverNode,
		"amount":              tx.Amount,
		"satellite_signature": tx.SatelliteSignature,
		"created_at":          tx.CreatedAt.UTC().Format(time.RFC3339Nano),
	})

	req, err := http.NewRequestWithContext(ctx, "POST", remoteNodeURL+"/federation/satellite/sync", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("creating sync request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Satellite-Node", s.NodeDomain)

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("sending sync: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		var errResp map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&errResp)
		msg, _ := errResp["error"].(string)
		if msg == "" {
			msg = fmt.Sprintf("remote returned status %d", resp.StatusCode)
		}
		return fmt.Errorf("%s", msg)
	}

	return nil
}

// SyncAllPending envia todas las transacciones pendientes al nodo origen.
// Retorna el numero de transacciones sincronizadas y las que fallaron.
func (s *Satellite) SyncAllPending(ctx context.Context, remoteNodeURL string, httpClient *http.Client) (synced, failed int, err error) {
	txs, err := s.GetPendingTx(ctx)
	if err != nil {
		return 0, 0, fmt.Errorf("getting pending tx: %w", err)
	}

	for _, tx := range txs {
		// Determinar la URL del nodo origen del sender
		// Por ahora usamos remoteNodeURL para todos
		syncErr := s.SyncPendingTx(ctx, tx, remoteNodeURL, httpClient)
		if syncErr != nil {
			_ = s.MarkTxError(ctx, tx.ID, syncErr.Error())
			failed++
			log.Printf("satellite: failed to sync tx %s: %v", tx.ID, syncErr)
			continue
		}
		_ = s.MarkTxSynced(ctx, tx.ID)
		synced++
	}

	return synced, failed, nil
}
