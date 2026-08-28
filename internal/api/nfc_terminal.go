package api

import (
	"crypto/ed25519"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"federated-credit-node/internal/db"
	"federated-credit-node/internal/payments"
)

type NFCTerminalHandler struct {
	NFC        *payments.NFCTerminals
	NodeDomain string
	Compiler   *payments.FirmwareCompiler
	MultiSig   *payments.MultiSigPayments
}

func NewNFCTerminalHandler(nfc *payments.NFCTerminals, nodeDomain string, compiler *payments.FirmwareCompiler) *NFCTerminalHandler {
	return &NFCTerminalHandler{NFC: nfc, NodeDomain: nodeDomain, Compiler: compiler}
}

func (h *NFCTerminalHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Terminal-facing endpoints (Ed25519 mutual auth, not JWT)
	r.Post("/api/nfc/terminal/complete-registration", h.completeRegistration)
	r.Post("/api/nfc/terminal/auth", h.terminalAuth)
	r.Post("/api/nfc/terminal/heartbeat", h.terminalHeartbeat)
	r.Get("/api/nfc/terminal/{id}/status", h.terminalStatus)
	r.Post("/api/nfc/terminal/session", h.createSession)
	r.Put("/api/nfc/terminal/session/amount", h.setSessionAmount)
	r.Post("/api/nfc/terminal/payment", h.processPayment)
	r.Post("/api/nfc/terminal/payment/community", h.processCommunityPayment)
	r.Post("/api/nfc/terminal/payment/multisig-sign", h.signMultisigPayment)
	r.Get("/api/nfc/terminal/payment/multisig/{pendingId}/status", h.getMultisigPaymentStatus)
	r.Get("/api/nfc/terminal/{id}/session", h.getTerminalSession)

	// Terminal pairing by short code (no auth required for initiate/status)
	r.Post("/api/nfc/terminal/pair/initiate", h.initiatePairing)
	r.Get("/api/nfc/terminal/pair/{code}/status", h.getPairingStatus)

	// Terminal lookup by public key (no auth required — allows POS to discover
	// it was approved even if polling timed out before receiving the response)
	r.Post("/api/nfc/terminal/lookup", h.lookupTerminalByKey)

	// Block/unblock from the terminal itself (with local code)
	r.Post("/api/nfc/terminal/{id}/block", h.blockTerminal)
	r.Post("/api/nfc/terminal/{id}/unblock", h.unblockTerminal)

	// Management endpoints (JWT + RequirePermission)
	r.With(am.RequirePermission("nfc.register_terminal")).Post("/api/nfc/terminal/register", h.registerTerminal)
	r.With(am.RequirePermission("nfc.register_terminal")).Post("/api/nfc/terminal/provision", h.provisionTerminal)
	r.With(am.RequirePermission("nfc.register_terminal")).Get("/api/nfc/terminal/{id}/config.h", h.downloadConfigH)
	r.With(am.RequirePermission("nfc.register_terminal")).Post("/api/nfc/terminal/{id}/compile", h.compileFirmware)
	r.With(am.RequirePermission("nfc.register_terminal")).Get("/api/nfc/terminal/{id}/firmware.bin", h.downloadFirmware)
	r.With(am.RequireAuth).Get("/api/nfc/terminals", h.listTerminals)
	r.With(am.RequireAuth).Get("/api/nfc/terminals/types", h.listTerminalTypes)
	r.With(am.RequirePermission("nfc.deactivate_terminal")).Delete("/api/nfc/terminal/{id}", h.deactivateTerminal)
	r.With(am.RequirePermission("nfc.register_terminal")).Put("/api/nfc/terminal/{id}", h.updateTerminal)

	// Terminal pairing management (admin)
	// Usa request_id (UUID) en lugar de pairing_code para que el frontend
	// nunca sepa cual es el codigo real. El servidor valida internamente.
	r.With(am.RequirePermission("nfc.register_terminal")).Get("/api/nfc/terminal/pair/pending", h.listPendingPairings)
	r.With(am.RequirePermission("nfc.register_terminal")).Get("/api/nfc/terminal/pair/request/{reqId}/options", h.getPairingOptionsByReqID)
	r.With(am.RequirePermission("nfc.register_terminal")).Post("/api/nfc/terminal/pair/request/{reqId}/approve", h.approvePairingByReqID)
	r.With(am.RequirePermission("nfc.register_terminal")).Post("/api/nfc/terminal/pair/request/{reqId}/reject", h.rejectPairingByReqID)

	// Assign terminal to organization (admin/Asamblea assigns)
	r.With(am.RequirePermission("nfc.register_terminal")).Post("/api/nfc/terminal/{id}/assign", h.assignTerminalToOrg)

	// Organization endpoints: gestionar terminales de la organizacion
	r.With(am.RequireAuth).Get("/api/nfc/org-terminals/{orgID}", h.listOrgTerminals)
	r.With(am.RequireAuth).Post("/api/nfc/org-terminals/{orgID}/{terminalID}/assign-user", h.orgAssignTerminalToUser)
	r.With(am.RequireAuth).Post("/api/nfc/org-terminals/{orgID}/{terminalID}/assign-dept", h.orgAssignTerminalToDept)
	r.With(am.RequireAuth).Post("/api/nfc/org-terminals/{orgID}/{terminalID}/toggle", h.orgToggleTerminal)
	r.With(am.RequireAuth).Get("/api/nfc/org-terminals/{orgID}/{terminalID}/shifts", h.listTerminalShifts)
	r.With(am.RequireAuth).Get("/api/nfc/org-terminals/{orgID}/{terminalID}/transactions", h.listOrgTerminalTransactions)

	// User endpoints: ver y gestionar sus propios terminales asignados
	r.With(am.RequireAuth).Get("/api/nfc/my-terminals", h.listMyTerminals)
	r.With(am.RequireAuth).Post("/api/nfc/my-terminals/{id}/toggle", h.toggleMyTerminal)
	r.With(am.RequireAuth).Get("/api/nfc/my-terminals/{id}/transactions", h.listMyTerminalTransactions)
	r.With(am.RequireAuth).Post("/api/nfc/my-terminals/{id}/shift", h.openShift)
	r.With(am.RequireAuth).Post("/api/nfc/my-terminals/{id}/shift/close", h.closeShift)

	r.With(am.RequirePermission("nfc.issue_card")).Post("/api/nfc/cards/issue", h.issueCryptoCard)
	r.With(am.RequireAuth).Get("/api/nfc/cards", h.listCards)
	r.With(am.RequirePermission("nfc.deactivate_card")).Delete("/api/nfc/cards/{uid}", h.deactivateCard)
	r.With(am.RequireAuth).Put("/api/nfc/cards/pin", h.changeCardPIN)
	r.With(am.RequirePermission("nfc.reset_pin")).Put("/api/nfc/cards/{uid}/pin/reset", h.resetCardPIN)

	r.With(am.RequireAuth).Get("/api/nfc/transactions", h.listTransactions)

	// Descargar sketch chip-id-reader.ino para flashear al ESP32
	r.With(am.RequirePermission("nfc.register_terminal")).Get("/api/nfc/chip-id-reader.ino", h.downloadChipIdReader)
}

// --- Terminal-facing endpoints ---

type CompleteRegistrationRequest struct {
	TerminalID        string `json:"terminal_id"`
	RegistrationToken string `json:"registration_token"`
	TerminalPublicKey string `json:"terminal_public_key"`
	DeviceFingerprint string `json:"device_fingerprint"`
}

func (h *NFCTerminalHandler) completeRegistration(w http.ResponseWriter, r *http.Request) {
	var req CompleteRegistrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.TerminalID == "" || req.RegistrationToken == "" || req.TerminalPublicKey == "" {
		writeError(w, 400, "terminal_id, registration_token and terminal_public_key are required")
		return
	}

	serverPubKey, err := h.NFC.CompleteRegistration(r.Context(), req.TerminalID, req.RegistrationToken, req.TerminalPublicKey, req.DeviceFingerprint)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{
		"server_public_key": serverPubKey,
		"status":            "registered",
	})
}

type TerminalAuthRequest struct {
	TerminalID        string `json:"terminal_id"`
	Signature         string `json:"signature"`
	Nonce             string `json:"nonce"`
	DeviceFingerprint string `json:"device_fingerprint"`
}

func (h *NFCTerminalHandler) terminalAuth(w http.ResponseWriter, r *http.Request) {
	var req TerminalAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	serverPriv, err := h.NFC.GetServerPrivateKey(r.Context())
	if err != nil {
		writeError(w, 500, "server keys not configured")
		return
	}

	sig, err := hexDecodeString(req.Signature)
	if err != nil {
		writeError(w, 400, "invalid signature hex")
		return
	}

	sessionToken, err := h.NFC.AuthenticateTerminal(r.Context(), req.TerminalID, sig, req.Nonce, req.DeviceFingerprint, serverPriv)
	if err != nil {
		writeError(w, 401, err.Error())
		return
	}

	serverSig := ed25519.Sign(serverPriv, []byte(sessionToken))
	writeJSON(w, 200, map[string]string{
		"session_token": sessionToken,
		"signature":     hexEncodeBytes(serverSig),
	})
}

func (h *NFCTerminalHandler) terminalHeartbeat(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TerminalID string `json:"terminal_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Heartbeat con estado completo: active + registered
	// El terminal usa esto para saber si el dueño lo desactivo o si fue borrado
	isActive, isRegistered, err := h.NFC.HeartbeatFull(r.Context(), req.TerminalID)
	if err != nil {
		// Terminal no encontrado: responder con registered=false para que el
		// cliente vuelva a la pantalla de emparejamiento
		writeJSON(w, 200, map[string]interface{}{
			"status":     "ok",
			"active":     false,
			"registered": false,
			"not_found":  true,
		})
		return
	}

	serverPriv, err := h.NFC.GetServerPrivateKey(r.Context())
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"status":     "ok",
			"active":     isActive,
			"registered": isRegistered,
		})
		return
	}
	sig := ed25519.Sign(serverPriv, []byte(req.TerminalID))
	writeJSON(w, 200, map[string]interface{}{
		"status":     "ok",
		"active":     isActive,
		"registered": isRegistered,
		"signature":  hexEncodeBytes(sig),
	})
}

func (h *NFCTerminalHandler) terminalStatus(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	if terminalID == "" {
		writeError(w, 400, "terminal id is required")
		return
	}

	status, err := h.NFC.GetTerminalStatus(r.Context(), terminalID)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	writeJSON(w, 200, status)
}

type CreateSessionRequest struct {
	TerminalID     string     `json:"terminal_id"`
	MerchantUserID *uuid.UUID `json:"merchant_user_id"`
}

func (h *NFCTerminalHandler) createSession(w http.ResponseWriter, r *http.Request) {
	var req CreateSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.TerminalID == "" {
		writeError(w, 400, "terminal_id is required")
		return
	}

	session, err := h.NFC.CreateSession(r.Context(), req.TerminalID, req.MerchantUserID)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, session)
}

type SetAmountRequest struct {
	SessionToken string `json:"session_token"`
	Amount       int64  `json:"amount"`
}

func (h *NFCTerminalHandler) setSessionAmount(w http.ResponseWriter, r *http.Request) {
	var req SetAmountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	session, err := h.NFC.SetTerminalAmount(r.Context(), req.SessionToken, req.Amount)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, session)
}

type ProcessPaymentRequest struct {
	TerminalID       string          `json:"terminal_id"`
	EncryptedPayload json.RawMessage `json:"encrypted_payload"`
}

func (h *NFCTerminalHandler) processPayment(w http.ResponseWriter, r *http.Request) {
	var req ProcessPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	plaintext, sharedKey, err := h.NFC.DecodePayload(r.Context(), req.TerminalID, req.EncryptedPayload)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	var payload payments.NFCPaymentPayload
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		writeError(w, 400, "invalid payload format")
		return
	}

	result, err := h.NFC.ProcessNFCPayment(r.Context(), req.TerminalID, payload)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	resultBytes, _ := json.Marshal(result)
	encResp, err := h.NFC.EncodeResponseWithSharedKey(r.Context(), req.TerminalID, resultBytes, sharedKey)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, encResp)
}

func (h *NFCTerminalHandler) processCommunityPayment(w http.ResponseWriter, r *http.Request) {
	var req ProcessPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	plaintext, sharedKey, err := h.NFC.DecodePayload(r.Context(), req.TerminalID, req.EncryptedPayload)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	var payload payments.CommunityPaymentPayload
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		writeError(w, 400, "invalid payload format")
		return
	}

	result, err := h.NFC.ProcessCommunityPayment(r.Context(), req.TerminalID, payload)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	resultBytes, _ := json.Marshal(result)
	encResp, err := h.NFC.EncodeResponseWithSharedKey(r.Context(), req.TerminalID, resultBytes, sharedKey)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, encResp)
}

func (h *NFCTerminalHandler) getTerminalSession(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	if terminalID == "" {
		writeError(w, 400, "terminal id is required")
		return
	}

	session, err := h.NFC.GetSessionByTerminal(r.Context(), terminalID)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	writeJSON(w, 200, session)
}

// --- Management endpoints ---

type RegisterTerminalRequest struct {
	TerminalID        string `json:"terminal_id"`
	Label             string `json:"label"`
	TerminalType      string `json:"terminal_type"`
	Location          string `json:"location"`
	DeviceFingerprint string `json:"device_fingerprint"`
}

func (h *NFCTerminalHandler) registerTerminal(w http.ResponseWriter, r *http.Request) {
	var req RegisterTerminalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.TerminalID == "" {
		writeError(w, 400, "terminal_id is required")
		return
	}
	if req.TerminalType == "" {
		req.TerminalType = "keypad"
	}

	terminal, token, err := h.NFC.RegisterTerminal(r.Context(), req.TerminalID, req.Label, req.TerminalType, req.Location, req.DeviceFingerprint)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, map[string]interface{}{
		"terminal":           terminal,
		"registration_token": token,
	})
}

func (h *NFCTerminalHandler) listTerminals(w http.ResponseWriter, r *http.Request) {
	terminals, err := h.NFC.ListTerminals(r.Context(), db.LOCAL_NODE_DOMAIN)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, terminals)
}

func (h *NFCTerminalHandler) listTerminalTypes(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, h.NFC.ListTerminalTypes())
}

func (h *NFCTerminalHandler) deactivateTerminal(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	if terminalID == "" {
		writeError(w, 400, "terminal id is required")
		return
	}

	if err := h.NFC.DeactivateTerminal(r.Context(), terminalID); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "deactivated"})
}

// updateTerminal actualiza los campos editables de un terminal:
// label, location, terminal_type. No permite editar claves ni tokens.
func (h *NFCTerminalHandler) updateTerminal(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	if terminalID == "" {
		writeError(w, 400, "terminal id is required")
		return
	}

	var req struct {
		Label        *string `json:"label"`
		Location     *string `json:"location"`
		TerminalType *string `json:"terminal_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Construir SET dinamicamente
	setParts := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.Label != nil {
		setParts = append(setParts, fmt.Sprintf("label = $%d", argIdx))
		args = append(args, *req.Label)
		argIdx++
	}
	if req.Location != nil {
		setParts = append(setParts, fmt.Sprintf("location = $%d", argIdx))
		args = append(args, *req.Location)
		argIdx++
	}
	if req.TerminalType != nil && *req.TerminalType != "" {
		setParts = append(setParts, fmt.Sprintf("terminal_type = $%d", argIdx))
		args = append(args, *req.TerminalType)
		argIdx++
	}

	if len(setParts) == 0 {
		writeError(w, 400, "no fields to update")
		return
	}

	setParts = append(setParts, fmt.Sprintf("updated_at = NOW()"))
	args = append(args, terminalID)

	query := fmt.Sprintf("UPDATE nfc_terminals SET %s WHERE terminal_id = $%d",
		strings.Join(setParts, ", "), argIdx)

	_, err := h.NFC.Pool.Exec(r.Context(), query, args...)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("error updating terminal: %v", err))
		return
	}

	writeJSON(w, 200, map[string]string{"status": "updated"})
}

type IssueCryptoCardRequest struct {
	UserID     uuid.UUID `json:"user_id"`
	CardUID    string    `json:"card_uid"`
	CardType   string    `json:"card_type"`
	InitialPIN string    `json:"initial_pin"`
}

func (h *NFCTerminalHandler) issueCryptoCard(w http.ResponseWriter, r *http.Request) {
	var req IssueCryptoCardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.CardUID == "" || req.InitialPIN == "" {
		writeError(w, 400, "card_uid and initial_pin are required")
		return
	}
	if req.CardType == "" {
		req.CardType = "uid_only"
	}

	card, err := h.NFC.IssueCryptoCard(r.Context(), req.UserID, req.CardUID, req.CardType, req.InitialPIN)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, card)
}

func (h *NFCTerminalHandler) listCards(w http.ResponseWriter, r *http.Request) {
	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		writeError(w, 400, "user_id parameter required")
		return
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		writeError(w, 400, "invalid user_id")
		return
	}

	// Query directly
	cards, err := h.listCardsDirect(r, userID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, cards)
}

func (h *NFCTerminalHandler) listCardsDirect(r *http.Request, userID uuid.UUID) (interface{}, error) {
	// Delegate to payments service
	// We'll use the NFC terminal's pool to query nfc_cards
	type NFCCardInfo struct {
		ID            uuid.UUID  `json:"id"`
		UserID        uuid.UUID  `json:"user_id"`
		CardUID       string     `json:"card_uid"`
		IsActive      bool       `json:"is_active"`
		CardType      string     `json:"card_type"`
		CryptoEnabled bool       `json:"crypto_enabled"`
		IssuedAt      time.Time  `json:"issued_at"`
		DeactivatedAt *time.Time `json:"deactivated_at"`
	}

	rows, err := h.NFC.Pool.Query(r.Context(), `
		SELECT id, user_id, card_uid, is_active, card_type, crypto_enabled, issued_at, deactivated_at
		FROM nfc_cards WHERE user_id = $1 ORDER BY issued_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cards []NFCCardInfo
	for rows.Next() {
		var c NFCCardInfo
		if err := rows.Scan(&c.ID, &c.UserID, &c.CardUID, &c.IsActive, &c.CardType, &c.CryptoEnabled, &c.IssuedAt, &c.DeactivatedAt); err != nil {
			return nil, err
		}
		cards = append(cards, c)
	}
	return cards, nil
}

func (h *NFCTerminalHandler) deactivateCard(w http.ResponseWriter, r *http.Request) {
	cardUID := chi.URLParam(r, "uid")
	if cardUID == "" {
		writeError(w, 400, "card uid is required")
		return
	}

	_, err := h.NFC.Pool.Exec(r.Context(), `
		UPDATE nfc_cards SET is_active = false, deactivated_at = NOW()
		WHERE card_uid = $1 AND is_active = true`,
		cardUID,
	)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "deactivated"})
}

type ChangePINRequest struct {
	CardUID string `json:"card_uid"`
	OldPIN  string `json:"old_pin"`
	NewPIN  string `json:"new_pin"`
}

func (h *NFCTerminalHandler) changeCardPIN(w http.ResponseWriter, r *http.Request) {
	var req ChangePINRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.CardUID == "" || req.OldPIN == "" || req.NewPIN == "" {
		writeError(w, 400, "card_uid, old_pin and new_pin are required")
		return
	}

	if err := h.NFC.ChangeCardPIN(r.Context(), req.CardUID, req.OldPIN, req.NewPIN); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "pin_changed"})
}

type ResetPINRequest struct {
	NewPIN string `json:"new_pin"`
}

func (h *NFCTerminalHandler) resetCardPIN(w http.ResponseWriter, r *http.Request) {
	cardUID := chi.URLParam(r, "uid")
	if cardUID == "" {
		writeError(w, 400, "card uid is required")
		return
	}

	var req ResetPINRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.NewPIN == "" {
		writeError(w, 400, "new_pin is required")
		return
	}

	if err := h.NFC.ResetCardPIN(r.Context(), cardUID, req.NewPIN); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "pin_reset"})
}

func (h *NFCTerminalHandler) listTransactions(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if n, err := parseInt(limitStr); err == nil {
			limit = n
		}
	}

	txs, err := h.NFC.ListTransactions(r.Context(), db.LOCAL_NODE_DOMAIN, limit)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, txs)
}

// Helper functions
func hexDecodeString(s string) ([]byte, error) {
	return hex.DecodeString(s)
}

func hexEncodeBytes(b []byte) string {
	return hex.EncodeToString(b)
}

func parseInt(s string) (int, error) {
	var n int
	_, err := fmt.Sscanf(s, "%d", &n)
	return n, err
}

// --- Terminal provisioning (generacion de config.h desde el servidor) ---

type ProvisionTerminalRequest struct {
	ChipID       string `json:"chip_id"`       // MAC/efuse del ESP32 (12 hex chars)
	TerminalType string `json:"terminal_type"` // keypad, touch, web, community
	Label        string `json:"label"`
	Location     string `json:"location"`
	TerminalID   string `json:"terminal_id"` // opcional, se autogenera si vacio
	ServerURL    string `json:"server_url"`  // opcional, se usa NodeDomain si vacio
}

// provisionTerminal registra un terminal vinculado a un chip ID de hardware y
// retorna los datos para generar el config.h (o descargarlo despues).
func (h *NFCTerminalHandler) provisionTerminal(w http.ResponseWriter, r *http.Request) {
	var req ProvisionTerminalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.ChipID == "" {
		writeError(w, 400, "chip_id is required (12 hex chars from ESP.getEfuseMac)")
		return
	}
	if len(req.ChipID) != 12 {
		writeError(w, 400, "chip_id must be 12 hex characters (e.g. AABBCCDDEEFF)")
		return
	}
	if req.TerminalType == "" {
		req.TerminalType = "keypad"
	}

	// Generar terminal_id si no se proporciona
	terminalID := req.TerminalID
	if terminalID == "" {
		terminalID = fmt.Sprintf("TERM-%s-%s", strings.ToUpper(req.TerminalType), req.ChipID[:6])
	}

	terminal, token, err := h.NFC.ProvisionTerminal(r.Context(), terminalID, req.ChipID, req.Label, req.TerminalType, req.Location)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	// Construir server URL
	serverURL := req.ServerURL
	if serverURL == "" {
		serverURL = "https://" + h.NodeDomain
	}

	writeJSON(w, 201, map[string]interface{}{
		"terminal":           terminal,
		"registration_token": token,
		"server_url":         serverURL,
		"config_h_url":       fmt.Sprintf("/api/nfc/terminal/%s/config.h", terminalID),
	})
}

// downloadConfigH genera y devuelve el archivo config.h listo para compilar.
// El admin descarga este archivo, lo coloca en la carpeta del terminal y compila.
func (h *NFCTerminalHandler) downloadConfigH(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	if terminalID == "" {
		writeError(w, 400, "terminal id is required")
		return
	}

	// Buscar el terminal por terminal_id para obtener sus datos
	terminal, token, err := h.NFC.GetTerminalForProvisioning(r.Context(), terminalID)
	if err != nil {
		writeError(w, 404, fmt.Sprintf("terminal not found or already registered: %v", err))
		return
	}

	serverURL := "https://" + h.NodeDomain

	// Obtener chip_id de forma segura (es *string ahora)
	chipID := ""
	if terminal.ChipID != nil {
		chipID = *terminal.ChipID
	}

	// Generar el contenido del config.h
	configContent := fmt.Sprintf(`// config.h — Generado por el servidor para el terminal %s
// NO EDITAR MANUALMENTE. Este archivo se genera automaticamente.
// Vinculado al hardware ESP32 con chip ID: %s
// Si se flashea en otro ESP32, el firmware no arrancara.

#ifndef CONFIG_H
#define CONFIG_H

// Vinculacion al hardware fisico (chip ID unico del ESP32 en efuse)
#define EXPECTED_CHIP_ID  "%s"

// Identidad del terminal (generada por el servidor)
#define TERMINAL_ID        "%s"
#define REGISTRATION_TOKEN "%s"

// URL del servidor (sin barra final)
#define SERVER_URL         "%s"

#endif // CONFIG_H
`,
		terminalID,
		chipID,
		chipID,
		terminalID,
		token,
		serverURL,
	)

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=config.h")
	w.WriteHeader(200)
	w.Write([]byte(configContent))
}

// compileFirmware compila el .bin completo del firmware personalizado para el terminal.
// Usa el contenedor Docker con Arduino CLI. Retorna el build_id para descargar el .bin.
func (h *NFCTerminalHandler) compileFirmware(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	if terminalID == "" {
		writeError(w, 400, "terminal id is required")
		return
	}

	if h.Compiler == nil {
		writeError(w, 503, "firmware compiler not configured on this server")
		return
	}

	// Buscar el terminal para obtener sus datos
	terminal, token, err := h.NFC.GetTerminalForProvisioning(r.Context(), terminalID)
	if err != nil {
		writeError(w, 404, fmt.Sprintf("terminal not found or already registered: %v", err))
		return
	}

	serverURL := "https://" + h.NodeDomain

	// Compilar
	result, err := h.Compiler.CompileFirmware(r.Context(), terminal, token, serverURL)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("compilation failed: %v", err))
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"status":       "compiled",
		"build_id":     result.BuildID,
		"size":         result.Size,
		"download_url": fmt.Sprintf("/api/nfc/terminal/%s/firmware.bin?build_id=%s", terminalID, result.BuildID),
	})
}

// downloadFirmware sirve el .bin compilado para descarga.
func (h *NFCTerminalHandler) downloadFirmware(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	if terminalID == "" {
		writeError(w, 400, "terminal id is required")
		return
	}

	buildID := r.URL.Query().Get("build_id")
	if buildID == "" {
		writeError(w, 400, "build_id parameter is required")
		return
	}

	if h.Compiler == nil {
		writeError(w, 503, "firmware compiler not configured on this server")
		return
	}

	binaryPath := fmt.Sprintf("%s/%s/firmware.bin", h.Compiler.BuildDir, buildID)

	// Verificar que el archivo existe
	if _, err := os.Stat(binaryPath); err != nil {
		writeError(w, 404, "firmware binary not found. You may need to compile first.")
		return
	}

	// Servir el archivo
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s-firmware.bin", terminalID))
	http.ServeFile(w, r, binaryPath)
}

// downloadChipIdReader sirve el sketch chip-id-reader.ino para flashear al ESP32
func (h *NFCTerminalHandler) downloadChipIdReader(w http.ResponseWriter, r *http.Request) {
	// Buscar el archivo en varias ubicaciones posibles
	candidates := []string{
		"/app/firmware/chip-id-reader/chip-id-reader.ino",
		"./firmware/chip-id-reader/chip-id-reader.ino",
		"../firmware/chip-id-reader/chip-id-reader.ino",
	}

	var foundPath string
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			foundPath = p
			break
		}
	}

	if foundPath == "" {
		writeError(w, 404, "chip-id-reader.ino not found on server")
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Header().Set("Content-Disposition", "attachment; filename=chip-id-reader.ino")
	http.ServeFile(w, r, foundPath)
}

// --- Block / Unblock terminal (from the terminal itself, with local code) ---

func (h *NFCTerminalHandler) blockTerminal(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	if terminalID == "" {
		writeError(w, 400, "terminal id is required")
		return
	}

	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if len(req.Code) < 4 {
		writeError(w, 400, "code must be at least 4 characters")
		return
	}

	// Hash the code and store it as the block code
	codeHash, err := bcrypt.GenerateFromPassword([]byte(req.Code), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, 500, "failed to hash code")
		return
	}

	_, err = h.NFC.Pool.Exec(r.Context(), `
		UPDATE nfc_terminals SET is_active = false, block_code_hash = $2, updated_at = NOW()
		WHERE terminal_id = $1`,
		terminalID, string(codeHash),
	)
	if err != nil {
		writeError(w, 500, "failed to block terminal")
		return
	}
	writeJSON(w, 200, map[string]string{"status": "blocked"})
}

func (h *NFCTerminalHandler) unblockTerminal(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	if terminalID == "" {
		writeError(w, 400, "terminal id is required")
		return
	}

	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	var codeHash *string
	err := h.NFC.Pool.QueryRow(r.Context(), `
		SELECT block_code_hash FROM nfc_terminals WHERE terminal_id = $1`,
		terminalID,
	).Scan(&codeHash)
	if err != nil {
		writeError(w, 404, "terminal not found")
		return
	}

	if codeHash == nil || *codeHash == "" {
		writeError(w, 400, "terminal is not blocked with a code")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*codeHash), []byte(req.Code)); err != nil {
		writeError(w, 401, "invalid block code")
		return
	}

	_, err = h.NFC.Pool.Exec(r.Context(), `
		UPDATE nfc_terminals SET is_active = true, block_code_hash = NULL, updated_at = NOW()
		WHERE terminal_id = $1`,
		terminalID,
	)
	if err != nil {
		writeError(w, 500, "failed to unblock terminal")
		return
	}
	writeJSON(w, 200, map[string]string{"status": "unblocked"})
}

// --- Assign terminal to organization (admin/Asamblea assigns) ---

func (h *NFCTerminalHandler) assignTerminalToOrg(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	if terminalID == "" {
		writeError(w, 400, "terminal id is required")
		return
	}

	var req struct {
		OrganizationID string `json:"organization_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.OrganizationID == "" {
		writeError(w, 400, "organization_id is required")
		return
	}

	orgID, err := uuid.Parse(req.OrganizationID)
	if err != nil {
		writeError(w, 400, "invalid organization_id")
		return
	}

	_, err = h.NFC.Pool.Exec(r.Context(), `
		UPDATE nfc_terminals
		SET organization_id = $2, department_id = NULL, merchant_user_id = NULL, updated_at = NOW()
		WHERE terminal_id = $1`,
		terminalID, orgID,
	)
	if err != nil {
		writeError(w, 500, "failed to assign terminal to organization")
		return
	}
	writeJSON(w, 200, map[string]string{"status": "assigned_to_org"})
}

// --- Organization: list their terminals ---

func (h *NFCTerminalHandler) listOrgTerminals(w http.ResponseWriter, r *http.Request) {
	orgIDStr := chi.URLParam(r, "orgID")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		writeError(w, 400, "invalid org id")
		return
	}

	rows, err := h.NFC.Pool.Query(r.Context(), `
		SELECT t.id, t.terminal_id, t.label, t.terminal_type, t.location,
		       t.is_active, t.is_registered, t.last_seen, t.created_at,
		       t.merchant_user_id, t.department_id,
		       t.block_code_hash IS NOT NULL as is_blocked,
		       u.display_name as merchant_name,
		       d.name as dept_name
		FROM nfc_terminals t
		LEFT JOIN users u ON u.id = t.merchant_user_id
		LEFT JOIN departments d ON d.id = t.department_id
		WHERE t.organization_id = $1
		ORDER BY t.created_at DESC`,
		orgID,
	)
	if err != nil {
		writeError(w, 500, "failed to list terminals")
		return
	}
	defer rows.Close()

	var terminals []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var termID, label, termType, location string
		var isActive, isRegistered, isBlocked bool
		var lastSeen *time.Time
		var createdAt time.Time
		var merchantID *uuid.UUID
		var deptID *uuid.UUID
		var merchantName, deptName *string

		if err := rows.Scan(&id, &termID, &label, &termType, &location,
			&isActive, &isRegistered, &lastSeen, &createdAt,
			&merchantID, &deptID, &isBlocked, &merchantName, &deptName); err != nil {
			continue
		}

		t := map[string]interface{}{
			"id":            id,
			"terminal_id":   termID,
			"label":         label,
			"terminal_type": termType,
			"location":      location,
			"is_active":     isActive,
			"is_registered": isRegistered,
			"is_blocked":    isBlocked,
			"created_at":    createdAt,
		}
		if lastSeen != nil {
			t["last_seen"] = *lastSeen
		}
		if merchantID != nil {
			t["merchant_user_id"] = *merchantID
		}
		if merchantName != nil {
			t["merchant_name"] = *merchantName
		}
		if deptID != nil {
			t["department_id"] = *deptID
		}
		if deptName != nil {
			t["dept_name"] = *deptName
		}
		terminals = append(terminals, t)
	}
	if terminals == nil {
		terminals = []map[string]interface{}{}
	}
	writeJSON(w, 200, terminals)
}

// --- Organization: assign terminal to a user (member of org) ---

func (h *NFCTerminalHandler) orgAssignTerminalToUser(w http.ResponseWriter, r *http.Request) {
	orgIDStr := chi.URLParam(r, "orgID")
	terminalID := chi.URLParam(r, "terminalID")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		writeError(w, 400, "invalid org id")
		return
	}

	var req struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		writeError(w, 400, "invalid user_id")
		return
	}

	// Verify the terminal belongs to this org
	var count int
	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM nfc_terminals
		WHERE terminal_id = $1 AND organization_id = $2`,
		terminalID, orgID,
	).Scan(&count)
	if err != nil || count == 0 {
		writeError(w, 404, "terminal not found or not assigned to this organization")
		return
	}

	_, err = h.NFC.Pool.Exec(r.Context(), `
		UPDATE nfc_terminals SET merchant_user_id = $2, department_id = NULL, updated_at = NOW()
		WHERE terminal_id = $1 AND organization_id = $3`,
		terminalID, userID, orgID,
	)
	if err != nil {
		writeError(w, 500, "failed to assign terminal to user")
		return
	}
	writeJSON(w, 200, map[string]string{"status": "assigned_to_user"})
}

// --- Organization: assign terminal to a department ---

func (h *NFCTerminalHandler) orgAssignTerminalToDept(w http.ResponseWriter, r *http.Request) {
	orgIDStr := chi.URLParam(r, "orgID")
	terminalID := chi.URLParam(r, "terminalID")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		writeError(w, 400, "invalid org id")
		return
	}

	var req struct {
		DepartmentID string `json:"department_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	deptID, err := uuid.Parse(req.DepartmentID)
	if err != nil {
		writeError(w, 400, "invalid department_id")
		return
	}

	_, err = h.NFC.Pool.Exec(r.Context(), `
		UPDATE nfc_terminals SET department_id = $2, updated_at = NOW()
		WHERE terminal_id = $1 AND organization_id = $3`,
		terminalID, deptID, orgID,
	)
	if err != nil {
		writeError(w, 500, "failed to assign terminal to department")
		return
	}
	writeJSON(w, 200, map[string]string{"status": "assigned_to_dept"})
}

// --- Organization: toggle terminal active/inactive ---

func (h *NFCTerminalHandler) orgToggleTerminal(w http.ResponseWriter, r *http.Request) {
	orgIDStr := chi.URLParam(r, "orgID")
	terminalID := chi.URLParam(r, "terminalID")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		writeError(w, 400, "invalid org id")
		return
	}

	var isActive bool
	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT is_active FROM nfc_terminals
		WHERE terminal_id = $1 AND organization_id = $2`,
		terminalID, orgID,
	).Scan(&isActive)
	if err != nil {
		writeError(w, 404, "terminal not found or not assigned to this organization")
		return
	}

	_, err = h.NFC.Pool.Exec(r.Context(), `
		UPDATE nfc_terminals SET is_active = $2, updated_at = NOW()
		WHERE terminal_id = $1 AND organization_id = $3`,
		terminalID, !isActive, orgID,
	)
	if err != nil {
		writeError(w, 500, "failed to toggle terminal")
		return
	}

	status := "activated"
	if isActive {
		status = "deactivated"
	}
	writeJSON(w, 200, map[string]string{"status": status})
}

// --- Organization: list shifts for a terminal ---

func (h *NFCTerminalHandler) listTerminalShifts(w http.ResponseWriter, r *http.Request) {
	orgIDStr := chi.URLParam(r, "orgID")
	terminalID := chi.URLParam(r, "terminalID")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		writeError(w, 400, "invalid org id")
		return
	}

	// Verify terminal belongs to org
	var termDBID uuid.UUID
	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT id FROM nfc_terminals
		WHERE terminal_id = $1 AND organization_id = $2`,
		terminalID, orgID,
	).Scan(&termDBID)
	if err != nil {
		writeError(w, 404, "terminal not found or not assigned to this organization")
		return
	}

	rows, err := h.NFC.Pool.Query(r.Context(), `
		SELECT s.id, s.user_id, u.display_name, s.status,
		       s.opened_at, s.closed_at, s.total_sales, s.transactions_count, s.notes
		FROM pos_shifts s
		JOIN users u ON u.id = s.user_id
		WHERE s.terminal_id = $1
		ORDER BY s.opened_at DESC
		LIMIT 100`,
		termDBID,
	)
	if err != nil {
		writeError(w, 500, "failed to list shifts")
		return
	}
	defer rows.Close()

	var shifts []map[string]interface{}
	for rows.Next() {
		var id, userID uuid.UUID
		var userName, status string
		var openedAt time.Time
		var closedAt *time.Time
		var totalSales int64
		var txCount int
		var notes *string

		if err := rows.Scan(&id, &userID, &userName, &status, &openedAt, &closedAt,
			&totalSales, &txCount, &notes); err != nil {
			continue
		}

		s := map[string]interface{}{
			"id":                 id,
			"user_id":            userID,
			"user_name":          userName,
			"status":             status,
			"opened_at":          openedAt,
			"total_sales":        totalSales,
			"transactions_count": txCount,
		}
		if closedAt != nil {
			s["closed_at"] = *closedAt
		}
		if notes != nil {
			s["notes"] = *notes
		}
		shifts = append(shifts, s)
	}
	if shifts == nil {
		shifts = []map[string]interface{}{}
	}
	writeJSON(w, 200, shifts)
}

// --- Organization: list transactions for a terminal ---

func (h *NFCTerminalHandler) listOrgTerminalTransactions(w http.ResponseWriter, r *http.Request) {
	orgIDStr := chi.URLParam(r, "orgID")
	terminalID := chi.URLParam(r, "terminalID")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		writeError(w, 400, "invalid org id")
		return
	}

	var termDBID uuid.UUID
	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT id FROM nfc_terminals
		WHERE terminal_id = $1 AND organization_id = $2`,
		terminalID, orgID,
	).Scan(&termDBID)
	if err != nil {
		writeError(w, 404, "terminal not found or not assigned to this organization")
		return
	}

	rows, err := h.NFC.Pool.Query(r.Context(), `
		SELECT id, card_uid, amount, status, pin_verified, transaction_type,
		       error_message, created_at
		FROM nfc_transactions
		WHERE terminal_id = $1
		ORDER BY created_at DESC
		LIMIT 100`,
		termDBID,
	)
	if err != nil {
		writeError(w, 500, "failed to list transactions")
		return
	}
	defer rows.Close()

	type Tx struct {
		ID              uuid.UUID `json:"id"`
		CardUID         string    `json:"card_uid"`
		Amount          int64     `json:"amount"`
		Status          string    `json:"status"`
		PinVerified     bool      `json:"pin_verified"`
		TransactionType string    `json:"transaction_type"`
		ErrorMessage    string    `json:"error_message,omitempty"`
		CreatedAt       time.Time `json:"created_at"`
	}

	var txs []Tx
	for rows.Next() {
		var t Tx
		if err := rows.Scan(&t.ID, &t.CardUID, &t.Amount, &t.Status,
			&t.PinVerified, &t.TransactionType, &t.ErrorMessage, &t.CreatedAt); err != nil {
			continue
		}
		txs = append(txs, t)
	}
	if txs == nil {
		txs = []Tx{}
	}
	writeJSON(w, 200, txs)
}

// --- Shift management (open/close) ---

func (h *NFCTerminalHandler) openShift(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	// Get terminal DB id and org
	var termDBID uuid.UUID
	var orgID *uuid.UUID
	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT id, organization_id FROM nfc_terminals
		WHERE terminal_id = $1 AND (merchant_user_id = $2 OR organization_id IS NOT NULL)`,
		terminalID, userID,
	).Scan(&termDBID, &orgID)
	if err != nil {
		writeError(w, 404, "terminal not found or not authorized")
		return
	}

	// Check if there's already an open shift
	var openCount int
	h.NFC.Pool.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM pos_shifts WHERE terminal_id = $1 AND status = 'open'`,
		termDBID,
	).Scan(&openCount)
	if openCount > 0 {
		writeError(w, 400, "there is already an open shift - close it first")
		return
	}

	var shiftID uuid.UUID
	err = h.NFC.Pool.QueryRow(r.Context(), `
		INSERT INTO pos_shifts (terminal_id, user_id, organization_id, status)
		VALUES ($1, $2, $3, 'open')
		RETURNING id`,
		termDBID, userID, orgID,
	).Scan(&shiftID)
	if err != nil {
		writeError(w, 500, "failed to open shift")
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"shift_id": shiftID,
		"status":   "open",
	})
}

func (h *NFCTerminalHandler) closeShift(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	var termDBID uuid.UUID
	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT id FROM nfc_terminals WHERE terminal_id = $1`,
		terminalID,
	).Scan(&termDBID)
	if err != nil {
		writeError(w, 404, "terminal not found")
		return
	}

	// Calculate total sales for this shift
	var totalSales int64
	var txCount int
	h.NFC.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(SUM(amount), 0), COUNT(*)
		FROM nfc_transactions
		WHERE terminal_id = $1 AND status = 'approved'
		  AND created_at >= (SELECT opened_at FROM pos_shifts WHERE terminal_id = $1 AND status = 'open' ORDER BY opened_at DESC LIMIT 1)`,
		termDBID,
	).Scan(&totalSales, &txCount)

	_, err = h.NFC.Pool.Exec(r.Context(), `
		UPDATE pos_shifts
		SET status = 'closed', closed_at = NOW(), total_sales = $3, transactions_count = $4
		WHERE terminal_id = $1 AND user_id = $2 AND status = 'open'`,
		termDBID, userID, totalSales, txCount,
	)
	if err != nil {
		writeError(w, 500, "failed to close shift")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"status":             "closed",
		"total_sales":        totalSales,
		"transactions_count": txCount,
	})
}

// --- User: list their assigned terminals ---

func (h *NFCTerminalHandler) listMyTerminals(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	rows, err := h.NFC.Pool.Query(r.Context(), `
		SELECT id, node_domain, terminal_id, label, terminal_type, location,
		       is_active, is_registered, last_seen, firmware_version, created_at, updated_at,
		       block_code_hash IS NOT NULL as is_blocked
		FROM nfc_terminals
		WHERE merchant_user_id = $1
		ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		writeError(w, 500, "failed to list terminals")
		return
	}
	defer rows.Close()

	type MyTerminal struct {
		ID              uuid.UUID  `json:"id"`
		NodeDomain      string     `json:"node_domain"`
		TerminalID      string     `json:"terminal_id"`
		Label           *string    `json:"label"`
		TerminalType    string     `json:"terminal_type"`
		Location        *string    `json:"location"`
		IsActive        bool       `json:"is_active"`
		IsRegistered    bool       `json:"is_registered"`
		IsBlocked       bool       `json:"is_blocked"`
		LastSeen        *time.Time `json:"last_seen"`
		FirmwareVersion *string    `json:"firmware_version"`
		CreatedAt       time.Time  `json:"created_at"`
		UpdatedAt       time.Time  `json:"updated_at"`
	}

	var terminals []MyTerminal
	for rows.Next() {
		var t MyTerminal
		if err := rows.Scan(&t.ID, &t.NodeDomain, &t.TerminalID, &t.Label, &t.TerminalType,
			&t.Location, &t.IsActive, &t.IsRegistered, &t.LastSeen,
			&t.FirmwareVersion, &t.CreatedAt, &t.UpdatedAt, &t.IsBlocked); err != nil {
			continue
		}
		terminals = append(terminals, t)
	}
	if terminals == nil {
		terminals = []MyTerminal{}
	}
	writeJSON(w, 200, terminals)
}

// --- User: toggle terminal active/inactive ---

func (h *NFCTerminalHandler) toggleMyTerminal(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	if terminalID == "" {
		writeError(w, 400, "terminal id is required")
		return
	}

	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	// Verify the terminal belongs to this user
	var isActive bool
	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT is_active FROM nfc_terminals
		WHERE terminal_id = $1 AND merchant_user_id = $2`,
		terminalID, userID,
	).Scan(&isActive)
	if err != nil {
		writeError(w, 404, "terminal not found or not assigned to you")
		return
	}

	// Toggle
	_, err = h.NFC.Pool.Exec(r.Context(), `
		UPDATE nfc_terminals SET is_active = $2, updated_at = NOW()
		WHERE terminal_id = $1 AND merchant_user_id = $3`,
		terminalID, !isActive, userID,
	)
	if err != nil {
		writeError(w, 500, "failed to toggle terminal")
		return
	}

	status := "activated"
	if isActive {
		status = "deactivated"
	}
	writeJSON(w, 200, map[string]string{"status": status})
}

// --- User: list transactions for their terminal ---

func (h *NFCTerminalHandler) listMyTerminalTransactions(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	if terminalID == "" {
		writeError(w, 400, "terminal id is required")
		return
	}

	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	// Verify the terminal belongs to this user
	var termDBID uuid.UUID
	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT id FROM nfc_terminals
		WHERE terminal_id = $1 AND merchant_user_id = $2`,
		terminalID, userID,
	).Scan(&termDBID)
	if err != nil {
		writeError(w, 404, "terminal not found or not assigned to you")
		return
	}

	rows, err := h.NFC.Pool.Query(r.Context(), `
		SELECT id, card_uid, amount, status, pin_verified, transaction_type,
		       error_message, created_at
		FROM nfc_transactions
		WHERE terminal_id = $1
		ORDER BY created_at DESC
		LIMIT 100`,
		termDBID,
	)
	if err != nil {
		writeError(w, 500, "failed to list transactions")
		return
	}
	defer rows.Close()

	type Tx struct {
		ID              uuid.UUID `json:"id"`
		CardUID         string    `json:"card_uid"`
		Amount          int64     `json:"amount"`
		Status          string    `json:"status"`
		PinVerified     bool      `json:"pin_verified"`
		TransactionType string    `json:"transaction_type"`
		ErrorMessage    string    `json:"error_message,omitempty"`
		CreatedAt       time.Time `json:"created_at"`
	}

	var txs []Tx
	for rows.Next() {
		var t Tx
		if err := rows.Scan(&t.ID, &t.CardUID, &t.Amount, &t.Status,
			&t.PinVerified, &t.TransactionType, &t.ErrorMessage, &t.CreatedAt); err != nil {
			continue
		}
		txs = append(txs, t)
	}
	if txs == nil {
		txs = []Tx{}
	}
	writeJSON(w, 200, txs)
}

// signMultisigPayment permite a un firmante autorizado firmar un pago multi-firma
// pendiente usando su tarjeta NFC + PIN. El pago se completa cuando todas las
// firmas requeridas se han recolectado.
func (h *NFCTerminalHandler) signMultisigPayment(w http.ResponseWriter, r *http.Request) {
	var req ProcessPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	plaintext, sharedKey, err := h.NFC.DecodePayload(r.Context(), req.TerminalID, req.EncryptedPayload)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	var payload payments.MultisigSignPayload
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		writeError(w, 400, "invalid payload format")
		return
	}

	result, err := h.NFC.SignMultisigPaymentWithCard(r.Context(), req.TerminalID, payload)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	resultBytes, _ := json.Marshal(result)
	encResp, err := h.NFC.EncodeResponseWithSharedKey(r.Context(), req.TerminalID, resultBytes, sharedKey)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, encResp)
}

// getMultisigPaymentStatus permite al POS NFC consultar el estado de un pago
// multi-firma pendiente, incluyendo el tiempo restante. Si el tiempo expiro,
// se anula automaticamente. El POS usa esto para mostrar la cuenta regresiva.
func (h *NFCTerminalHandler) getMultisigPaymentStatus(w http.ResponseWriter, r *http.Request) {
	pendingID, err := uuid.Parse(chi.URLParam(r, "pendingId"))
	if err != nil {
		writeError(w, 400, "invalid pending payment id")
		return
	}

	if h.MultiSig == nil {
		writeError(w, 500, "multi-sig not configured")
		return
	}

	p, err := h.MultiSig.GetPendingPayment(r.Context(), pendingID)
	if err != nil {
		writeError(w, 404, "pending payment not found")
		return
	}

	// Auto-anular si ya expiro y sigue pendiente
	if p.Status == "pending" || p.Status == "ready" {
		remaining := time.Until(p.ExpiresAt)
		if remaining <= 0 {
			h.MultiSig.CancelPendingPayment(r.Context(), pendingID)
			writeJSON(w, 200, map[string]interface{}{
				"id":                  p.ID,
				"status":              "expired",
				"remaining_seconds":   0,
				"required_signatures": p.RequiredSignatures,
				"collected_count":     len(p.CollectedSignatures),
				"remaining_sigs":      p.RequiredSignatures - len(p.CollectedSignatures),
				"message":             "Tiempo agotado. El pago ha sido anulado.",
			})
			return
		}
		writeJSON(w, 200, map[string]interface{}{
			"id":                   p.ID,
			"status":               p.Status,
			"amount":               p.Amount,
			"payment_type":         p.PaymentType,
			"from_account":         p.FromAccount,
			"to_account":           p.ToAccount,
			"required_signatures":  p.RequiredSignatures,
			"collected_count":      len(p.CollectedSignatures),
			"remaining_sigs":       p.RequiredSignatures - len(p.CollectedSignatures),
			"expires_at":           p.ExpiresAt,
			"remaining_seconds":    int(remaining.Seconds()),
			"collected_signatures": p.CollectedSignatures,
		})
		return
	}

	// Ya ejecutado, cancelado o expirado
	writeJSON(w, 200, map[string]interface{}{
		"id":                  p.ID,
		"status":              p.Status,
		"remaining_seconds":   0,
		"required_signatures": p.RequiredSignatures,
		"collected_count":     len(p.CollectedSignatures),
		"executed_at":         p.ExecutedAt,
	})
}

// ============================================
// Terminal Pairing by Short Code
// ============================================

// initiatePairing inicia el emparejamiento del terminal con un codigo corto.
// No requiere autenticacion - el terminal envia su clave publica Ed25519
// y el servidor responde con un codigo de 6 digitos que expira en 60 segundos.
func (h *NFCTerminalHandler) initiatePairing(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TerminalPublicKey  string `json:"terminal_public_key"`
		DeviceFingerprint  string `json:"device_fingerprint"`
		TerminalLabel      string `json:"terminal_label"`
		ChipID             string `json:"chip_id"`
		DeviceModel        string `json:"device_model"`
		DeviceManufacturer string `json:"device_manufacturer"`
		AndroidVersion     string `json:"android_version"`
		TerminalType       string `json:"terminal_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.TerminalPublicKey == "" {
		writeError(w, 400, "terminal_public_key is required")
		return
	}

	code, err := h.NFC.InitiatePairing(r.Context(), req.TerminalPublicKey, req.DeviceFingerprint, req.TerminalLabel,
		req.ChipID, req.DeviceModel, req.DeviceManufacturer, req.AndroidVersion, req.TerminalType)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, map[string]interface{}{
		"pairing_code": code,
		"expires_in":   60,
		"message":      "Pida al administrador que apruebe este codigo en su panel.",
	})
}

// getPairingStatus consulta el estado del emparejamiento (polling del terminal).
// No requiere autenticacion.
func (h *NFCTerminalHandler) getPairingStatus(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if code == "" || len(code) != 6 {
		writeError(w, 400, "invalid pairing code")
		return
	}

	status, err := h.NFC.GetPairingStatus(r.Context(), code)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	writeJSON(w, 200, status)
}

// lookupTerminalByKey permite a un POS descubrir si su terminal_public_key
// ya fue registrada en el servidor, incluso si el polling del emparejamiento
// expiro antes de recibir la respuesta "approved".
//
// Esto resuelve el problema de sincronizacion: el admin aprueba en el servidor
// pero el POS no se entera porque su polling expiro. Al arrancar, el POS
// consulta este endpoint con su clave publica. Si el servidor ya la tiene
// registrada, devuelve el terminal_id + server_public_key para que el POS
// complete su registro local.
func (h *NFCTerminalHandler) lookupTerminalByKey(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TerminalPublicKey string `json:"terminal_public_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.TerminalPublicKey == "" {
		writeError(w, 400, "terminal_public_key is required")
		return
	}

	// Buscar el terminal por su clave publica
	var terminalID string
	var isActive, isRegistered bool
	var serverPubKey *string
	err := h.NFC.Pool.QueryRow(r.Context(), `
		SELECT t.terminal_id, t.is_active, t.is_registered, sk.public_key
		FROM nfc_terminals t
		LEFT JOIN nfc_server_keys sk ON sk.node_domain = t.node_domain
		WHERE t.terminal_public_key = $1
		ORDER BY t.updated_at DESC LIMIT 1`,
		req.TerminalPublicKey,
	).Scan(&terminalID, &isActive, &isRegistered, &serverPubKey)
	if err != nil {
		// No encontrado — el terminal no esta registrado en este servidor
		writeJSON(w, 200, map[string]interface{}{
			"registered": false,
			"message":    "Terminal no encontrado en el servidor.",
		})
		return
	}

	if !isRegistered || !isActive {
		writeJSON(w, 200, map[string]interface{}{
			"registered": false,
			"active":     isActive,
			"message":    "Terminal existe pero no esta registrado o inactivo.",
		})
		return
	}

	// Esta registrado y activo — devolver info para que el POS complete
	spk := ""
	if serverPubKey != nil {
		spk = *serverPubKey
	}
	writeJSON(w, 200, map[string]interface{}{
		"registered":        true,
		"active":            true,
		"terminal_id":       terminalID,
		"server_public_key": spk,
		"message":           "Terminal registrado y activo.",
	})
}

// approvePairing aprueba una solicitud de emparejamiento (admin).
// Crea el terminal, registra la clave publica, y marca como approved.
// Si se envia selected_code, se verifica que coincida con el codigo real (verificacion de 4 opciones).
func (h *NFCTerminalHandler) approvePairing(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if code == "" {
		writeError(w, 400, "pairing code is required")
		return
	}

	adminUserID, err := uuid.Parse(r.Header.Get("X-User-ID"))
	if err != nil {
		// Intentar desde el contexto (seteado por el middleware JWT)
		uidStr, ok := r.Context().Value("user_id").(string)
		if !ok || uidStr == "" {
			writeError(w, 401, "invalid admin user")
			return
		}
		adminUserID, err = uuid.Parse(uidStr)
		if err != nil {
			writeError(w, 401, "invalid admin user")
			return
		}
	}

	var body struct {
		Label        string `json:"label"`
		TerminalType string `json:"terminal_type"`
		Location     string `json:"location"`
		Mode         string `json:"mode"`          // "new" (default) o "replace"
		SelectedCode string `json:"selected_code"` // para verificacion de 4 opciones
	}
	// Body es opcional, ignorar error si viene vacio
	_ = json.NewDecoder(r.Body).Decode(&body)

	if body.Mode == "" {
		body.Mode = "new"
	}

	// Si se envia selected_code, verificar que coincida (verificacion de 4 opciones)
	if body.SelectedCode != "" {
		result, err := h.NFC.ApprovePairingWithCode(r.Context(), code, body.SelectedCode, adminUserID, body.Label, body.TerminalType, body.Location, body.Mode)
		if err != nil {
			writeError(w, 400, err.Error())
			return
		}
		writeJSON(w, 200, result)
		return
	}

	result, err := h.NFC.ApprovePairing(r.Context(), code, adminUserID, body.Label, body.TerminalType, body.Location, body.Mode)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, result)
}

// getPairingOptions returns 4 code options for the admin to choose from.
// The admin must choose the correct code, proving out-of-band communication.
func (h *NFCTerminalHandler) getPairingOptions(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if code == "" {
		writeError(w, 400, "pairing code is required")
		return
	}

	options, err := h.NFC.GetPairingOptions(r.Context(), code)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"options": options,
		"message": "Elija el codigo que le comunico la persona del terminal por telefono. Solo uno es correcto.",
	})
}

// rejectPairing rechaza una solicitud de emparejamiento (admin).
func (h *NFCTerminalHandler) rejectPairing(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if code == "" {
		writeError(w, 400, "pairing code is required")
		return
	}

	adminUserID, err := uuid.Parse(r.Header.Get("X-User-ID"))
	if err != nil {
		uidStr, ok := r.Context().Value("user_id").(string)
		if !ok || uidStr == "" {
			writeError(w, 401, "invalid admin user")
			return
		}
		adminUserID, err = uuid.Parse(uidStr)
		if err != nil {
			writeError(w, 401, "invalid admin user")
			return
		}
	}

	if err := h.NFC.RejectPairing(r.Context(), code, adminUserID); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "rejected"})
}

// listPendingPairings lista las solicitudes de emparejamiento pendientes (admin).
func (h *NFCTerminalHandler) listPendingPairings(w http.ResponseWriter, r *http.Request) {
	requests, err := h.NFC.ListPendingPairings(r.Context())
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if requests == nil {
		requests = []payments.PairingRequest{}
	}
	writeJSON(w, 200, requests)
}

// ============================================
// Pairing management by request_id (UUID)
// Estos endpoints usan el UUID de la solicitud en lugar del pairing_code.
// El frontend nunca recibe el pairing_code real — solo el request_id.
// ============================================

// getPairingOptionsByReqID devuelve 4 opciones de codigo para que el admin elija.
// El servidor busca el codigo real internamente por UUID y genera 4 opciones.
func (h *NFCTerminalHandler) getPairingOptionsByReqID(w http.ResponseWriter, r *http.Request) {
	reqIDStr := chi.URLParam(r, "reqId")
	if reqIDStr == "" {
		writeError(w, 400, "request id is required")
		return
	}
	reqID, err := uuid.Parse(reqIDStr)
	if err != nil {
		writeError(w, 400, "invalid request id")
		return
	}

	options, err := h.NFC.GetPairingOptionsByReqID(r.Context(), reqID)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"options": options,
		"message": "Elija el codigo que le comunico la persona del terminal por telefono. Solo uno es correcto.",
	})
}

// approvePairingByReqID aprueba una solicitud por UUID.
// El admin envia selected_code (el que eligio de las 4 opciones).
// El servidor valida internamente si selected_code coincide con el codigo real.
func (h *NFCTerminalHandler) approvePairingByReqID(w http.ResponseWriter, r *http.Request) {
	reqIDStr := chi.URLParam(r, "reqId")
	if reqIDStr == "" {
		writeError(w, 400, "request id is required")
		return
	}
	reqID, err := uuid.Parse(reqIDStr)
	if err != nil {
		writeError(w, 400, "invalid request id")
		return
	}

	adminUserID, err := uuid.Parse(r.Header.Get("X-User-ID"))
	if err != nil {
		uidStr, ok := r.Context().Value("user_id").(string)
		if !ok || uidStr == "" {
			writeError(w, 401, "invalid admin user")
			return
		}
		adminUserID, err = uuid.Parse(uidStr)
		if err != nil {
			writeError(w, 401, "invalid admin user")
			return
		}
	}

	var body struct {
		Label        string `json:"label"`
		TerminalType string `json:"terminal_type"`
		Location     string `json:"location"`
		Mode         string `json:"mode"`
		SelectedCode string `json:"selected_code"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.Mode == "" {
		body.Mode = "new"
	}
	if body.SelectedCode == "" {
		writeError(w, 400, "selected_code is required — debe elegir uno de los 4 codigos")
		return
	}

	result, err := h.NFC.ApprovePairingByReqID(r.Context(), reqID, body.SelectedCode, adminUserID, body.Label, body.TerminalType, body.Location, body.Mode)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, result)
}

// rejectPairingByReqID rechaza una solicitud por UUID.
func (h *NFCTerminalHandler) rejectPairingByReqID(w http.ResponseWriter, r *http.Request) {
	reqIDStr := chi.URLParam(r, "reqId")
	if reqIDStr == "" {
		writeError(w, 400, "request id is required")
		return
	}
	reqID, err := uuid.Parse(reqIDStr)
	if err != nil {
		writeError(w, 400, "invalid request id")
		return
	}

	adminUserID, err := uuid.Parse(r.Header.Get("X-User-ID"))
	if err != nil {
		uidStr, ok := r.Context().Value("user_id").(string)
		if !ok || uidStr == "" {
			writeError(w, 401, "invalid admin user")
			return
		}
		adminUserID, err = uuid.Parse(uidStr)
		if err != nil {
			writeError(w, 401, "invalid admin user")
			return
		}
	}

	if err := h.NFC.RejectPairingByReqID(r.Context(), reqID, adminUserID); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "rejected"})
}
