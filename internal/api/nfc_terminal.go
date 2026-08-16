package api

import (
	"crypto/ed25519"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"federated-credit-node/internal/payments"
)

type NFCTerminalHandler struct {
	NFC        *payments.NFCTerminals
	NodeDomain string
}

func NewNFCTerminalHandler(nfc *payments.NFCTerminals, nodeDomain string) *NFCTerminalHandler {
	return &NFCTerminalHandler{NFC: nfc, NodeDomain: nodeDomain}
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
	r.Get("/api/nfc/terminal/{id}/session", h.getTerminalSession)

	// Management endpoints (JWT + RequirePermission)
	r.With(am.RequirePermission("nfc.register_terminal")).Post("/api/nfc/terminal/register", h.registerTerminal)
	r.With(am.RequirePermission("nfc.register_terminal")).Post("/api/nfc/terminal/provision", h.provisionTerminal)
	r.With(am.RequirePermission("nfc.register_terminal")).Get("/api/nfc/terminal/{id}/config.h", h.downloadConfigH)
	r.With(am.RequireAuth).Get("/api/nfc/terminals", h.listTerminals)
	r.With(am.RequireAuth).Get("/api/nfc/terminals/types", h.listTerminalTypes)
	r.With(am.RequirePermission("nfc.deactivate_terminal")).Delete("/api/nfc/terminal/{id}", h.deactivateTerminal)

	r.With(am.RequirePermission("nfc.issue_card")).Post("/api/nfc/cards/issue", h.issueCryptoCard)
	r.With(am.RequireAuth).Get("/api/nfc/cards", h.listCards)
	r.With(am.RequirePermission("nfc.deactivate_card")).Delete("/api/nfc/cards/{uid}", h.deactivateCard)
	r.With(am.RequireAuth).Put("/api/nfc/cards/pin", h.changeCardPIN)
	r.With(am.RequirePermission("nfc.reset_pin")).Put("/api/nfc/cards/{uid}/pin/reset", h.resetCardPIN)

	r.With(am.RequireAuth).Get("/api/nfc/transactions", h.listTransactions)
}

// --- Terminal-facing endpoints ---

type CompleteRegistrationRequest struct {
	TerminalID        string `json:"terminal_id"`
	RegistrationToken string `json:"registration_token"`
	TerminalPublicKey string `json:"terminal_public_key"`
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

	serverPubKey, err := h.NFC.CompleteRegistration(r.Context(), req.TerminalID, req.RegistrationToken, req.TerminalPublicKey)
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
	TerminalID string `json:"terminal_id"`
	Signature  string `json:"signature"`
	Nonce      string `json:"nonce"`
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

	sessionToken, err := h.NFC.AuthenticateTerminal(r.Context(), req.TerminalID, sig, req.Nonce, serverPriv)
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

	// Heartbeat con estado: el terminal sabe si el dueño lo desactivo
	isActive, err := h.NFC.HeartbeatWithStatus(r.Context(), req.TerminalID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	serverPriv, err := h.NFC.GetServerPrivateKey(r.Context())
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"status": "ok",
			"active": isActive,
		})
		return
	}
	sig := ed25519.Sign(serverPriv, []byte(req.TerminalID))
	writeJSON(w, 200, map[string]interface{}{
		"status":    "ok",
		"active":    isActive,
		"signature": hexEncodeBytes(sig),
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
	TerminalID   string `json:"terminal_id"`
	Label        string `json:"label"`
	TerminalType string `json:"terminal_type"`
	Location     string `json:"location"`
	WifiSSID     string `json:"wifi_ssid"`
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

	terminal, token, err := h.NFC.RegisterTerminal(r.Context(), req.TerminalID, req.Label, req.TerminalType, req.Location, req.WifiSSID)
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
	terminals, err := h.NFC.ListTerminals(r.Context(), h.NodeDomain)
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

	// Use the existing payments handler's listNFCCards
	ph := &PaymentsHandler{Payments: nil}
	_ = ph
	_ = userID

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

	txs, err := h.NFC.ListTransactions(r.Context(), h.NodeDomain, limit)
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
		terminal.ChipID,
		terminal.ChipID,
		terminalID,
		token,
		serverURL,
	)

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=config.h")
	w.WriteHeader(200)
	w.Write([]byte(configContent))
}
