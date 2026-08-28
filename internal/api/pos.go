package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"federated-credit-node/internal/db"
	"federated-credit-node/internal/payments"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// POSHandler maneja los cargos QR del POS web.
// El POS crea un cargo aqui, genera un QR con el token,
// y el cliente paga via /api/pos/charge/{token}/pay
type POSHandler struct {
	Pool       *pgxpool.Pool
	NFC        *payments.NFCTerminals
	NodeDomain string
	MultiSig   *payments.MultiSigPayments
}

func NewPOSHandler(pool *pgxpool.Pool, nfc *payments.NFCTerminals, nodeDomain string) *POSHandler {
	return &POSHandler{Pool: pool, NFC: nfc, NodeDomain: nodeDomain}
}

func (h *POSHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Rutas del terminal (requieren sesion de terminal activa via JWT del merchant)
	r.With(am.RequireAuth).Post("/api/pos/charge", h.createCharge)
	r.With(am.RequireAuth).Get("/api/pos/charge/{id}/status", h.getChargeStatus)
	r.With(am.RequireAuth).Post("/api/pos/charge/{id}/cancel", h.cancelCharge)

	// Ruta publica para que el cliente consulte el cargo antes de pagar
	// No requiere auth - el cliente ve el monto primero, luego inicia sesion
	r.Get("/api/pos/charge/{token}/info", h.getChargeInfo)

	// Ruta para que el cliente cancele el cargo (usa token, no id del merchant)
	// Requiere auth del cliente para que solo el que escaneo el QR pueda cancelar
	r.With(am.RequireAuth).Post("/api/pos/charge/{token}/cancel", h.cancelChargeByToken)

	// Ruta para pagar (requiere auth del cliente/pagador)
	r.With(am.RequireAuth).Post("/api/pos/charge/{token}/pay", h.payCharge)
}

// --- Create Charge ---

type CreateChargeRequest struct {
	Amount      int64  `json:"amount"`
	Description string `json:"description"`
}

type ChargeResponse struct {
	ChargeID    string `json:"charge_id"`
	ChargeToken string `json:"charge_token"`
	Amount      int64  `json:"amount"`
	Status      string `json:"status"`
	ExpiresAt   string `json:"expires_at"`
}

func (h *POSHandler) createCharge(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	var req CreateChargeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Amount <= 0 {
		writeError(w, 400, "amount must be positive")
		return
	}

	// Buscar el terminal web_pos del merchant
	// El terminal_id se envia en el header X-Terminal-ID
	terminalID := r.Header.Get("X-Terminal-ID")
	var termDBID *uuid.UUID
	if terminalID != "" {
		var id uuid.UUID
		err := h.Pool.QueryRow(r.Context(), `
			SELECT id FROM nfc_terminals WHERE terminal_id = $1 AND is_active = true`,
			terminalID,
		).Scan(&id)
		if err == nil {
			termDBID = &id
		}
	}

	chargeToken := uuid.New().String()
	// Timeout de 3 minutos para que el cliente confirme el pago.
	// Si son varias firmas (multi-sig), cada firma resetea el timeout a 3 min mas.
	expiresAt := time.Now().Add(3 * time.Minute)

	var chargeID string
	err = h.Pool.QueryRow(r.Context(), `
		INSERT INTO pos_charges (node_domain, terminal_id, merchant_id, charge_token, amount, status, description, expires_at)
		VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
		RETURNING id::text`,
		db.LOCAL_NODE_DOMAIN, termDBID, userID, chargeToken, req.Amount, req.Description, expiresAt,
	).Scan(&chargeID)
	if err != nil {
		writeError(w, 500, "failed to create charge: "+err.Error())
		return
	}

	writeJSON(w, 201, ChargeResponse{
		ChargeID:    chargeID,
		ChargeToken: chargeToken,
		Amount:      req.Amount,
		Status:      "pending",
		ExpiresAt:   expiresAt.Format(time.RFC3339),
	})
}

// --- Get Charge Status (for POS polling) ---

func (h *POSHandler) getChargeStatus(w http.ResponseWriter, r *http.Request) {
	chargeID := chi.URLParam(r, "id")
	if chargeID == "" {
		writeError(w, 400, "charge id is required")
		return
	}

	var status, paymentMethod string
	var paidAt *time.Time
	var amount int64
	err := h.Pool.QueryRow(r.Context(), `
		SELECT amount, status, payment_method, paid_at FROM pos_charges
		WHERE id::text = $1 OR charge_token = $1`,
		chargeID,
	).Scan(&amount, &status, &paymentMethod, &paidAt)
	if err != nil {
		writeError(w, 404, "charge not found")
		return
	}

	resp := map[string]interface{}{
		"charge_id":      chargeID,
		"amount":         amount,
		"status":         status,
		"payment_method": paymentMethod,
	}
	if paidAt != nil {
		resp["paid_at"] = paidAt.Format(time.RFC3339)
	}
	writeJSON(w, 200, resp)
}

// --- Get Charge Info (public, for customer before login) ---

func (h *POSHandler) getChargeInfo(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	if token == "" {
		writeError(w, 400, "token is required")
		return
	}

	var amount int64
	var status, description, merchantName string
	var expiresAt time.Time
	err := h.Pool.QueryRow(r.Context(), `
		SELECT c.amount, c.status, c.description, c.expires_at,
		       u.display_name
		FROM pos_charges c
		JOIN users u ON u.id = c.merchant_id
		WHERE c.charge_token = $1`,
		token,
	).Scan(&amount, &status, &description, &expiresAt, &merchantName)
	if err != nil {
		writeError(w, 404, "charge not found or expired")
		return
	}

	// Verificar si expiro
	if status == "pending" && time.Now().After(expiresAt) {
		_, _ = h.Pool.Exec(r.Context(), `
			UPDATE pos_charges SET status = 'expired' WHERE charge_token = $1`,
			token,
		)
		status = "expired"
	}

	writeJSON(w, 200, map[string]interface{}{
		"amount":        amount,
		"status":        status,
		"description":   description,
		"merchant_name": merchantName,
		"expires_at":    expiresAt.Format(time.RFC3339),
	})
}

// --- Pay Charge (customer confirms payment) ---

type PayChargeRequest struct {
	PaymentMethod string `json:"payment_method"` // qr, nfc
}

func (h *POSHandler) payCharge(w http.ResponseWriter, r *http.Request) {
	payerID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	token := chi.URLParam(r, "token")
	if token == "" {
		writeError(w, 400, "token is required")
		return
	}

	var req PayChargeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.PaymentMethod = "qr"
	}
	if req.PaymentMethod == "" {
		req.PaymentMethod = "qr"
	}

	// Atomically: verificar y pagar el cargo
	tx, err := h.Pool.Begin(r.Context())
	if err != nil {
		writeError(w, 500, "failed to start transaction")
		return
	}
	defer tx.Rollback(r.Context())

	var chargeID uuid.UUID
	var merchantID uuid.UUID
	var amount int64
	var status string
	var expiresAt time.Time
	err = tx.QueryRow(r.Context(), `
		SELECT id, merchant_id, amount, status, expires_at
		FROM pos_charges
		WHERE charge_token = $1
		FOR UPDATE`,
		token,
	).Scan(&chargeID, &merchantID, &amount, &status, &expiresAt)
	if err != nil {
		writeError(w, 404, "charge not found")
		return
	}

	if status != "pending" {
		writeError(w, 400, "charge is already "+status)
		return
	}

	if time.Now().After(expiresAt) {
		_, _ = tx.Exec(r.Context(), `UPDATE pos_charges SET status = 'expired' WHERE id = $1`, chargeID)
		_ = tx.Commit(r.Context())
		writeError(w, 400, "charge has expired")
		return
	}

	// No permitir pagarse a si mismo
	if payerID == merchantID {
		writeError(w, 400, "cannot pay yourself")
		return
	}

	// Verificar saldo del pagador contra su tope de credito comunitario
	// Filosofia moneda cero (LETS / Credito Mutuo):
	// - El saldo puede ser negativo (deuda con la comunidad).
	// - No existe "saldo insuficiente"; existe el tope negativo (credit_limit).
	// - Al tocar el tope, el miembro debe aportar a la comunidad para recibir nuevamente.
	var balance, creditLimit int64
	err = tx.QueryRow(r.Context(), `SELECT balance, credit_limit FROM users WHERE id = $1`, payerID).Scan(&balance, &creditLimit)
	if err != nil {
		writeError(w, 500, "failed to get payer balance")
		return
	}

	if balance-amount < creditLimit {
		// Formatear montos en TQ (dividir centavos por 100) para el mensaje.
		// El sistema almacena enteros en centavos internamente.
		balanceTQ := float64(balance) / 100.0
		limitTQ := float64(creditLimit) / 100.0
		afterTQ := float64(balance-amount) / 100.0
		writeJSON(w, 400, map[string]interface{}{
			"error":           fmt.Sprintf("Este pago te llevaria a %.2f TQ, por debajo de tu tope de credito comunitario (%.2f TQ). Debes aportar a la comunidad (bienes o trabajo) para poder pagar nuevamente.", afterTQ, limitTQ),
			"balance":         balance,
			"balance_tq":      balanceTQ,
			"credit_limit":    creditLimit,
			"credit_limit_tq": limitTQ,
			"amount":          amount,
		})
		return
	}

	// Verificar si la cuenta del pagador requiere multi-firma
	if h.MultiSig != nil {
		reqSigs, _, err := h.MultiSig.CheckAccountMultiSig(r.Context(), payerID)
		if err == nil && reqSigs > 1 {
			// La cuenta requiere multi-firma: crear pago pendiente
			pending, err := h.MultiSig.CreatePendingPayment(r.Context(), payments.CreatePendingPaymentParams{
				PaymentType:   "pos_qr",
				FromAccount:   payerID,
				ToAccount:     merchantID,
				Amount:        amount,
				PaymentMethod: "qr",
				PosChargeID:   &chargeID,
				Description:   "Pago QR multi-firma",
			})
			if err != nil {
				writeError(w, 500, "error creating pending multi-sig payment: "+err.Error())
				return
			}
			// La primera firma es implicita (el usuario que inicio el pago)
			remaining, _, _ := h.MultiSig.SignPendingPayment(r.Context(), pending.ID, payerID, "web", "", false, false)
			_ = tx.Commit(r.Context())
			writeJSON(w, 202, map[string]interface{}{
				"status":         "pending_multisig",
				"pending_id":     pending.ID,
				"charge_id":      chargeID,
				"required_sigs":  reqSigs,
				"collected_sigs": 1,
				"remaining_sigs": remaining,
				"message":        "Pago pendiente. Faltan " + strconv.Itoa(remaining) + " firma(s) para completar.",
			})
			return
		}
	}

	// Debitar del pagador
	_, err = tx.Exec(r.Context(), `UPDATE users SET balance = balance - $2, updated_at = NOW() WHERE id = $1`, payerID, amount)
	if err != nil {
		writeError(w, 500, "failed to debit payer")
		return
	}

	// Acreditar al merchant
	_, err = tx.Exec(r.Context(), `UPDATE users SET balance = balance + $2, updated_at = NOW() WHERE id = $1`, merchantID, amount)
	if err != nil {
		writeError(w, 500, "failed to credit merchant")
		return
	}

	// Marcar cargo como pagado
	_, err = tx.Exec(r.Context(), `
		UPDATE pos_charges SET status = 'paid', payer_id = $2, paid_at = NOW(), payment_method = $3
		WHERE id = $1`,
		chargeID, payerID, req.PaymentMethod,
	)
	if err != nil {
		writeError(w, 500, "failed to mark charge as paid")
		return
	}

	// Registrar transaccion en el log
	_, err = tx.Exec(r.Context(), `
		INSERT INTO transactions (tx_type, sender_id, receiver_id, amount, status)
		VALUES ('pos_payment', $1, $2, $3, 'completed')`,
		payerID, merchantID, amount,
	)
	if err != nil {
		// No es fatal - el pago ya se completo
	}

	// Log NFC transaction para el terminal
	var termDBID *uuid.UUID
	_ = tx.QueryRow(r.Context(), `SELECT terminal_id FROM pos_charges WHERE id = $1`, chargeID).Scan(&termDBID)
	if termDBID != nil {
		_, _ = tx.Exec(r.Context(), `
			INSERT INTO nfc_transactions (terminal_id, card_uid, user_id, amount, status, pin_verified, transaction_type, buyer_user_id, seller_user_id)
			VALUES ($1, 'qr_payment', $2, $3, 'approved', true, 'pos_qr', $2, $4)`,
			*termDBID, payerID, amount, merchantID,
		)
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, 500, "failed to commit payment")
		return
	}

	// Obtener nuevo balance del pagador
	var newBalance int64
	_ = h.Pool.QueryRow(r.Context(), `SELECT balance FROM users WHERE id = $1`, payerID).Scan(&newBalance)

	writeJSON(w, 200, map[string]interface{}{
		"status":         "paid",
		"amount":         amount,
		"new_balance":    newBalance,
		"payment_method": req.PaymentMethod,
	})
}

// --- Cancel Charge ---

func (h *POSHandler) cancelCharge(w http.ResponseWriter, r *http.Request) {
	chargeID := chi.URLParam(r, "id")
	if chargeID == "" {
		writeError(w, 400, "charge id is required")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE pos_charges SET status = 'cancelled'
		WHERE (id::text = $1 OR charge_token = $1) AND status = 'pending'`,
		chargeID,
	)
	if err != nil {
		writeError(w, 500, "failed to cancel charge")
		return
	}
	writeJSON(w, 200, map[string]string{"status": "cancelled"})
}

// cancelChargeByToken permite al CLIENTE cancelar el cargo usando el token del QR.
// Esto notifica al POS (que hace polling de status) que el cliente cancelo,
// en lugar de dejarlo esperando hasta que expire el timeout.
func (h *POSHandler) cancelChargeByToken(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	if token == "" {
		writeError(w, 400, "token is required")
		return
	}

	result, err := h.Pool.Exec(r.Context(), `
		UPDATE pos_charges SET status = 'cancelled'
		WHERE charge_token = $1 AND status = 'pending'`,
		token,
	)
	if err != nil {
		writeError(w, 500, "failed to cancel charge")
		return
	}
	if result.RowsAffected() == 0 {
		// El cargo ya no esta pending (puede estar paid, expired, o cancelled)
		var status string
		_ = h.Pool.QueryRow(r.Context(), `SELECT status FROM pos_charges WHERE charge_token = $1`, token).Scan(&status)
		if status == "" {
			writeError(w, 404, "charge not found")
			return
		}
		writeJSON(w, 200, map[string]interface{}{
			"status":  status,
			"message": "El cargo ya no esta pendiente (estado: " + status + ")",
		})
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"status":  "cancelled",
		"message": "Cargo cancelado por el cliente",
	})
}

var _ = context.Background
