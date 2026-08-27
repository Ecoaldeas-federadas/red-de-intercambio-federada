package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"federated-credit-node/internal/payments"
)

// MultiSigHandler maneja los endpoints de pagos multi-firma pendientes.
// Permite a los firmantes autorizados ver, firmar y ejecutar pagos pendientes.
type MultiSigHandler struct {
	MultiSig *payments.MultiSigPayments
	Pool     *pgxpool.Pool
}

func NewMultiSigHandler(msig *payments.MultiSigPayments, pool *pgxpool.Pool) *MultiSigHandler {
	return &MultiSigHandler{MultiSig: msig, Pool: pool}
}

func (h *MultiSigHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Listar pagos pendientes para la cuenta del usuario autenticado
	r.With(am.RequireAuth).Get("/api/multisig/payments", h.listPendingPayments)

	// Obtener un pago pendiente por ID
	r.With(am.RequireAuth).Get("/api/multisig/payments/{id}", h.getPendingPayment)

	// Firmar un pago pendiente (desde web/app)
	r.With(am.RequireAuth).Post("/api/multisig/payments/{id}/sign", h.signPendingPayment)

	// Ejecutar un pago que tiene todas las firmas
	r.With(am.RequireAuth).Post("/api/multisig/payments/{id}/execute", h.executePendingPayment)

	// Cancelar un pago pendiente
	r.With(am.RequireAuth).Post("/api/multisig/payments/{id}/cancel", h.cancelPendingPayment)

	// Configuracion multi-sig del nodo (ver y actualizar)
	r.With(am.RequireAuth).Get("/api/multisig/config", h.getMultisigConfig)
	r.With(am.RequirePermission("config.manage")).Post("/api/multisig/config", h.updateMultisigConfig)
}

// listPendingPayments lista los pagos pendientes para la cuenta del usuario
func (h *MultiSigHandler) listPendingPayments(w http.ResponseWriter, r *http.Request) {
	userIDStr := r.Header.Get("X-User-ID")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	pendingPayments, err := h.MultiSig.ListPendingPayments(r.Context(), userID)
	if err != nil {
		writeError(w, 500, "error listing pending payments: "+err.Error())
		return
	}
	if pendingPayments == nil {
		pendingPayments = []payments.PendingMultiSigPayment{}
	}
	writeJSON(w, 200, pendingPayments)
}

// getPendingPayment obtiene un pago pendiente por ID
func (h *MultiSigHandler) getPendingPayment(w http.ResponseWriter, r *http.Request) {
	paymentID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid payment id")
		return
	}

	p, err := h.MultiSig.GetPendingPayment(r.Context(), paymentID)
	if err != nil {
		writeError(w, 404, "payment not found")
		return
	}

	// Auto-anular si ya expiro
	if p.Status == "pending" || p.Status == "ready" {
		remaining := time.Until(p.ExpiresAt)
		if remaining <= 0 {
			h.MultiSig.CancelPendingPayment(r.Context(), paymentID)
			p.Status = "expired"
			writeJSON(w, 200, map[string]interface{}{
				"id":                  p.ID,
				"status":              "expired",
				"expires_at":          p.ExpiresAt,
				"remaining_seconds":   0,
				"message":             "Tiempo agotado. El pago ha sido anulado.",
				"required_signatures": p.RequiredSignatures,
				"collected_count":     len(p.CollectedSignatures),
			})
			return
		}
		// Retornar con tiempo restante
		writeJSON(w, 200, map[string]interface{}{
			"id":                   p.ID,
			"payment_type":         p.PaymentType,
			"from_account":         p.FromAccount,
			"to_account":           p.ToAccount,
			"amount":               p.Amount,
			"required_signatures":  p.RequiredSignatures,
			"collected_count":      len(p.CollectedSignatures),
			"remaining_sigs":       p.RequiredSignatures - len(p.CollectedSignatures),
			"status":               p.Status,
			"expires_at":           p.ExpiresAt,
			"remaining_seconds":    int(remaining.Seconds()),
			"collected_signatures": p.CollectedSignatures,
			"created_at":           p.CreatedAt,
		})
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"id":                  p.ID,
		"status":              p.Status,
		"expires_at":          p.ExpiresAt,
		"remaining_seconds":   0,
		"required_signatures": p.RequiredSignatures,
		"collected_count":     len(p.CollectedSignatures),
		"executed_at":         p.ExecutedAt,
	})
}

// signPendingPayment permite a un firmante autorizado firmar un pago pendiente
func (h *MultiSigHandler) signPendingPayment(w http.ResponseWriter, r *http.Request) {
	paymentID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid payment id")
		return
	}

	signerID, err := uuid.Parse(r.Header.Get("X-User-ID"))
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	var req struct {
		Method        string `json:"method"` // "web", "nfc_card", "pin"
		CardUID       string `json:"card_uid"`
		PINVerified   bool   `json:"pin_verified"`
		IDDocVerified bool   `json:"id_document_verified"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Method = "web"
	}
	if req.Method == "" {
		req.Method = "web"
	}

	remaining, p, err := h.MultiSig.SignPendingPayment(r.Context(), paymentID, signerID,
		req.Method, req.CardUID, req.PINVerified, req.IDDocVerified)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	// Si todas las firmas estan completas, ejecutar automaticamente
	if remaining == 0 {
		if err := h.MultiSig.ExecutePendingPayment(r.Context(), paymentID); err != nil {
			writeJSON(w, 200, map[string]interface{}{
				"status":         "ready",
				"pending_id":     paymentID,
				"remaining_sigs": 0,
				"message":        "Todas las firmas completadas. Error al ejecutar: " + err.Error(),
				"payment":        p,
			})
			return
		}
		writeJSON(w, 200, map[string]interface{}{
			"status":         "executed",
			"pending_id":     paymentID,
			"remaining_sigs": 0,
			"message":        "Pago ejecutado correctamente",
			"payment":        p,
		})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"status":         "pending",
		"pending_id":     paymentID,
		"remaining_sigs": remaining,
		"message":        "Firma registrada. Faltan " + strconv.Itoa(remaining) + " firma(s).",
		"payment":        p,
	})
}

// executePendingPayment ejecuta un pago que tiene todas las firmas
func (h *MultiSigHandler) executePendingPayment(w http.ResponseWriter, r *http.Request) {
	paymentID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid payment id")
		return
	}

	if err := h.MultiSig.ExecutePendingPayment(r.Context(), paymentID); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "executed"})
}

// cancelPendingPayment cancela un pago pendiente
func (h *MultiSigHandler) cancelPendingPayment(w http.ResponseWriter, r *http.Request) {
	paymentID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid payment id")
		return
	}

	if err := h.MultiSig.CancelPendingPayment(r.Context(), paymentID); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "cancelled"})
}

// getMultisigConfig devuelve la configuracion multi-sig del nodo
func (h *MultiSigHandler) getMultisigConfig(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.MultiSig.NodeDomain
	}

	var expirationMinutes int
	var notifySigners bool
	var notificationMessage string
	err := h.Pool.QueryRow(r.Context(), `
		SELECT expiration_minutes, notify_signers, notification_message
		FROM multisig_config WHERE node_domain = $1`, nodeDomain,
	).Scan(&expirationMinutes, &notifySigners, &notificationMessage)
	if err != nil {
		// Config por defecto
		writeJSON(w, 200, map[string]interface{}{
			"node_domain":          nodeDomain,
			"expiration_minutes":   10,
			"notify_signers":       true,
			"notification_message": "Tienes un pago pendiente que requiere tu firma. Ingresa al sistema para confirmar.",
		})
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"node_domain":          nodeDomain,
		"expiration_minutes":   expirationMinutes,
		"notify_signers":       notifySigners,
		"notification_message": notificationMessage,
	})
}

// updateMultisigConfig actualiza la configuracion multi-sig del nodo
func (h *MultiSigHandler) updateMultisigConfig(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.MultiSig.NodeDomain
	}

	var body struct {
		ExpirationMinutes   int    `json:"expiration_minutes"`
		NotifySigners       bool   `json:"notify_signers"`
		NotificationMessage string `json:"notification_message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if body.ExpirationMinutes <= 0 {
		body.ExpirationMinutes = 10
	}
	if body.ExpirationMinutes > 1440 {
		body.ExpirationMinutes = 1440 // max 24 horas
	}
	if body.NotificationMessage == "" {
		body.NotificationMessage = "Tienes un pago pendiente que requiere tu firma. Ingresa al sistema para confirmar."
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO multisig_config (node_domain, expiration_minutes, notify_signers, notification_message)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (node_domain) DO UPDATE
		SET expiration_minutes = $2, notify_signers = $3, notification_message = $4, updated_at = NOW()`,
		nodeDomain, body.ExpirationMinutes, body.NotifySigners, body.NotificationMessage)
	if err != nil {
		writeError(w, 500, "error saving multisig config")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}
