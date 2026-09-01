package api

import (
	"crypto/ed25519"
	"encoding/csv"
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
	"federated-credit-node/internal/payments/cards"
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
	r.Get("/api/nfc/terminal/server-pubkey", h.getServerPubKey) // diagnóstico
	r.Get("/api/nfc/terminal/{id}/status", h.terminalStatus)
	r.Post("/api/nfc/terminal/session", h.createSession)
	r.Put("/api/nfc/terminal/session/amount", h.setSessionAmount)
	r.Post("/api/nfc/terminal/payment", h.processPayment)
	r.Post("/api/nfc/terminal/payment/community", h.processCommunityPayment)
	r.Post("/api/nfc/terminal/payment/multisig-sign", h.signMultisigPayment)
	r.Get("/api/nfc/terminal/payment/multisig/{pendingId}/status", h.getMultisigPaymentStatus)
	r.Get("/api/nfc/terminal/{id}/session", h.getTerminalSession)

	// Classic card dynamic certificates (terminal-facing, Ed25519 auth)
	r.Post("/api/nfc/terminal/classic/pre-auth", h.classicPreAuth)
	r.Post("/api/nfc/terminal/classic/pre-auth-document", h.classicPreAuthWithDocument)
	r.Post("/api/nfc/terminal/classic/confirm", h.classicConfirm)
	r.Post("/api/nfc/terminal/user-lookup", h.userLookup)

	// NTAG215 dynamic certificates (terminal-facing, Ed25519 auth)
	r.Post("/api/nfc/terminal/ntag215/pre-auth", h.ntag215PreAuth)
	r.Post("/api/nfc/terminal/ntag215/pre-auth-document", h.ntag215PreAuthWithDocument)
	r.Post("/api/nfc/terminal/ntag215/confirm", h.ntag215Confirm)

	// Ultralight C dynamic certificates (terminal-facing, Ed25519 auth)
	r.Post("/api/nfc/terminal/ultralight-c/pre-auth", h.ultralightCPreAuth)
	r.Post("/api/nfc/terminal/ultralight-c/pre-auth-document", h.ultralightCPreAuthWithDocument)
	r.Post("/api/nfc/terminal/ultralight-c/confirm", h.ultralightCConfirm)

	// Card types registry (lista tipos soportados desde el sistema modular)
	r.With(am.RequireAuth).Get("/api/nfc/card-types", h.listCardTypes)

	// Terminal pairing by short code (no auth required for initiate/status)
	r.Post("/api/nfc/terminal/pair/initiate", h.initiatePairing)
	r.Get("/api/nfc/terminal/pair/{code}/status", h.getPairingStatus)

	// POS Web session requests (no auth required for request/status — the POS web
	// needs to request a session before it can login. The DUEÑO of the terminal
	// approves from their account, not the admin.)
	r.Post("/api/pos-web/request-session", h.requestWebSession)
	r.Get("/api/pos-web/session-status/{reqId}", h.getWebSessionStatus)

	// POS Web session management (requires auth — the dueño approves/rejects/revokes)
	r.With(am.RequireAuth).Get("/api/pos-web/pending-sessions", h.listPendingWebSessions)
	r.With(am.RequireAuth).Get("/api/pos-web/pending-sessions/{reqId}/options", h.getWebSessionOptions)
	r.With(am.RequireAuth).Post("/api/pos-web/pending-sessions/{reqId}/approve", h.approveWebSession)
	r.With(am.RequireAuth).Post("/api/pos-web/pending-sessions/{reqId}/reject", h.rejectWebSession)
	r.With(am.RequireAuth).Get("/api/pos-web/sessions", h.listActiveWebSessions)
	r.With(am.RequireAuth).Post("/api/pos-web/sessions/{terminalId}/revoke", h.revokeWebSession)

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
	r.With(am.RequireAuth).Get("/api/nfc/org-terminals/{orgID}/{terminalID}/authorized-users", h.listAuthorizedUsers)
	r.With(am.RequireAuth).Post("/api/nfc/org-terminals/{orgID}/{terminalID}/authorized-users", h.addAuthorizedUser)
	r.With(am.RequireAuth).Delete("/api/nfc/org-terminals/{orgID}/{terminalID}/authorized-users/{userID}", h.removeAuthorizedUser)
	r.With(am.RequireAuth).Get("/api/nfc/org-terminals/{orgID}/{terminalID}/shifts", h.listTerminalShifts)
	r.With(am.RequireAuth).Get("/api/nfc/org-terminals/{orgID}/{terminalID}/transactions", h.listOrgTerminalTransactions)

	// User endpoints: ver y gestionar sus propios terminales asignados
	r.With(am.RequireAuth).Get("/api/nfc/my-terminals", h.listMyTerminals)
	r.With(am.RequireAuth).Post("/api/nfc/my-terminals/{id}/toggle", h.toggleMyTerminal)
	r.With(am.RequireAuth).Put("/api/nfc/my-terminals/{id}/label", h.updateMyTerminalLabel)
	r.With(am.RequireAuth).Get("/api/nfc/my-terminals/{id}/transactions", h.listMyTerminalTransactions)
	r.With(am.RequireAuth).Post("/api/nfc/my-terminals/{id}/shift", h.openShift)
	r.With(am.RequireAuth).Post("/api/nfc/my-terminals/{id}/shift/close", h.closeShift)
	r.With(am.RequireAuth).Post("/api/nfc/my-terminals/{id}/shift/sync-close", h.syncOfflineShiftClose)
	r.With(am.RequireAuth).Get("/api/nfc/my-terminals/{id}/shift", h.getActiveShift)
	r.With(am.RequireAuth).Post("/api/nfc/my-terminals/{id}/shift-pin", h.setShiftPin)
	r.With(am.RequireAuth).Post("/api/nfc/my-terminals/{id}/shift-pin/verify", h.verifyShiftPin)
	r.With(am.RequireAuth).Get("/api/nfc/my-terminals/{id}/shift-pin/configured", h.getShiftPinConfigured)
	r.With(am.RequireAuth).Get("/api/nfc/my-terminals/{id}/shifts", h.listMyTerminalShifts)
	r.With(am.RequireAuth).Get("/api/nfc/my-terminals/{id}/export/transactions", h.exportMyTerminalTransactionsCSV)
	r.With(am.RequireAuth).Get("/api/nfc/my-terminals/{id}/export/shifts", h.exportMyTerminalShiftsCSV)

	// Auto-renovacion de claves del terminal (requiere JWT — solo el merchant
	// asignado al terminal puede renovar las claves cuando se pierden)
	r.With(am.RequireAuth).Post("/api/nfc/terminal/auto-renew", h.autoRenewKeys)

	// Retention config (admin)
	r.With(am.RequirePermission("config.manage")).Get("/api/nfc/retention/config", h.getRetentionConfig)
	r.With(am.RequirePermission("config.manage")).Put("/api/nfc/retention/config", h.updateRetentionConfig)
	r.With(am.RequirePermission("config.manage")).Post("/api/nfc/retention/purge", h.purgeNow)

	r.With(am.RequirePermission("nfc.issue_card")).Post("/api/nfc/cards/issue", h.issueCryptoCard)
	r.With(am.RequirePermission("nfc.issue_card")).Post("/api/nfc/cards/provision-classic", h.provisionClassicCard)
	r.With(am.RequirePermission("nfc.issue_card")).Post("/api/nfc/cards/provision-ntag215", h.provisionNTAG215Card)
	r.With(am.RequirePermission("nfc.issue_card")).Post("/api/nfc/cards/provision-ultralight-c", h.provisionUltralightCCard)
	r.With(am.RequireAuth).Get("/api/nfc/cards", h.listCards)
	r.With(am.RequireAuth).Get("/api/nfc/cards/all", h.listAllCards)
	r.With(am.RequirePermission("nfc.initialize_card")).Get("/api/nfc/cards/pending-initialization", h.listPendingInitializationCards)
	r.With(am.RequirePermission("nfc.initialize_card")).Post("/api/nfc/cards/{uid}/confirm-initialization", h.confirmCardInitialization)
	r.With(am.RequirePermission("nfc.deactivate_card")).Delete("/api/nfc/cards/{uid}", h.deactivateCard)
	r.With(am.RequirePermission("nfc.deactivate_card")).Put("/api/nfc/cards/{uid}/toggle", h.toggleCard)
	// Auto-servicio: el usuario puede desactivar/activar SU PROPIA tarjeta
	// sin permiso de admin. Verifica propiedad y que el admin no la haya bloqueado.
	r.With(am.RequireAuth).Put("/api/nfc/my-cards/{uid}/toggle", h.toggleMyCard)
	r.With(am.RequirePermission("nfc.issue_card")).Delete("/api/nfc/cards/{uid}/permanent", h.deleteCardPermanent)
	r.With(am.RequirePermission("nfc.issue_card")).Put("/api/nfc/cards/{uid}/label", h.updateCardLabel)
	r.With(am.RequireAuth).Put("/api/nfc/cards/{uid}/document", h.setCardDocument)
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

	// Resolver format_settings para el terminal: usar las preferencias del
	// merchant_user_id del terminal, con fallback a los defaults del nodo.
	var merchantUserID *string
	_ = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT merchant_user_id::text FROM nfc_terminals WHERE terminal_id = $1`, req.TerminalID).Scan(&merchantUserID)
	var fs FormatSettings
	if merchantUserID != nil && *merchantUserID != "" {
		fs = resolveFormatSettings(r.Context(), h.NFC.Pool, *merchantUserID, h.NodeDomain)
	} else {
		fs = nodeFormatSettings(r.Context(), h.NFC.Pool, h.NodeDomain)
	}

	serverSig := ed25519.Sign(serverPriv, []byte(sessionToken))
	writeJSON(w, 200, map[string]interface{}{
		"session_token":   sessionToken,
		"signature":       hexEncodeBytes(serverSig),
		"format_settings": fs,
	})
}

// getServerPubKey devuelve la clave pública del servidor para diagnóstico.
// No requiere autenticación — es solo la clave pública, no expone nada secreto.
func (h *NFCTerminalHandler) getServerPubKey(w http.ResponseWriter, r *http.Request) {
	pub, err := h.NFC.GetServerPublicKey(r.Context())
	if err != nil {
		writeError(w, 500, "server keys not configured: "+err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"server_public_key": hexEncodeBytes(pub),
		"node_domain":       h.NFC.NodeDomain,
	})
}

func (h *NFCTerminalHandler) terminalHeartbeat(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TerminalID     string `json:"terminal_id"`
		TerminalPubKey string `json:"terminal_public_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Heartbeat con estado completo: active + registered + key verification
	// El terminal usa esto para saber si el dueño lo desactivo o si fue borrado.
	// Tambien verifica que las claves criptograficas coincidan.
	isActive, isRegistered, registeredPubKey, err := h.NFC.HeartbeatFull(r.Context(), req.TerminalID)
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

	// Verificar si las claves coinciden (si el terminal envio su clave publica)
	keyMatches := true
	if req.TerminalPubKey != "" && registeredPubKey != "" {
		keyMatches = (req.TerminalPubKey == registeredPubKey)
	}

	serverPriv, err := h.NFC.GetServerPrivateKey(r.Context())
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"status":      "ok",
			"active":      isActive,
			"registered":  isRegistered,
			"key_matches": keyMatches,
		})
		return
	}
	// Incluir server_public_key para que el POS pueda detectar si cambio
	// y actualizarlo si es necesario (ej: servidor reinstalado)
	serverPub, _ := h.NFC.GetServerPublicKey(r.Context())
	serverPubHex := ""
	if serverPub != nil {
		serverPubHex = hexEncodeBytes(serverPub)
	}
	sig := ed25519.Sign(serverPriv, []byte(req.TerminalID))
	writeJSON(w, 200, map[string]interface{}{
		"status":            "ok",
		"active":            isActive,
		"registered":        isRegistered,
		"key_matches":       keyMatches,
		"signature":         hexEncodeBytes(sig),
		"server_public_key": serverPubHex,
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
		req.CardType = "classic"
	}
	// uid_only no es soportado: las tarjetas simples solo con UID son inseguras
	// para un sistema bancario. Solo se soportan tipos del registry modular.
	if req.CardType == "uid_only" {
		writeError(w, 400, "tipo de tarjeta no soportado. Use classic, ntag215, ultralight_c, ntag424 o desfire.")
		return
	}
	// Validar que el tipo esté en el registry modular
	if !cards.IsSupportedCardType(req.CardType) {
		writeError(w, 400, "tipo de tarjeta no soportado. Use classic, ntag215, ultralight_c, ntag424 o desfire.")
		return
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
	type NFCCardInfo struct {
		ID              uuid.UUID  `json:"id"`
		UserID          uuid.UUID  `json:"user_id"`
		CardUID         string     `json:"card_uid"`
		IsActive        bool       `json:"is_active"`
		CardType        string     `json:"card_type"`
		CryptoEnabled   bool       `json:"crypto_enabled"`
		HasDynamicCerts bool       `json:"has_dynamic_certs"`
		RequiredDocType *string    `json:"required_doc_type"`
		IssuedAt        time.Time  `json:"issued_at"`
		DeactivatedAt   *time.Time `json:"deactivated_at"`
	}

	rows, err := h.NFC.Pool.Query(r.Context(), `
		SELECT id, user_id, card_uid, is_active, card_type, crypto_enabled,
		       has_dynamic_certs, required_doc_type, issued_at, deactivated_at
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
		if err := rows.Scan(&c.ID, &c.UserID, &c.CardUID, &c.IsActive, &c.CardType, &c.CryptoEnabled,
			&c.HasDynamicCerts, &c.RequiredDocType, &c.IssuedAt, &c.DeactivatedAt); err != nil {
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
		UPDATE nfc_cards SET is_active = false, deactivated_at = NOW(), deactivated_by_admin = true
		WHERE card_uid = $1 AND is_active = true`,
		cardUID,
	)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "deactivated"})
}

// toggleCard activa o desactiva una tarjeta NFC.
// El usuario puede activar/desactivar sus propias tarjetas.
func (h *NFCTerminalHandler) toggleCard(w http.ResponseWriter, r *http.Request) {
	cardUID := chi.URLParam(r, "uid")
	if cardUID == "" {
		writeError(w, 400, "card uid is required")
		return
	}

	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	var deactivatedAt *time.Time
	if !req.IsActive {
		deactivatedAt = &time.Time{}
		*deactivatedAt = time.Now()
	}

	_, err := h.NFC.Pool.Exec(r.Context(), `
		UPDATE nfc_cards SET is_active = $2, deactivated_at = $3
		WHERE card_uid = $1`,
		cardUID, req.IsActive, deactivatedAt,
	)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	status := "activated"
	if !req.IsActive {
		status = "deactivated"
	}
	writeJSON(w, 200, map[string]string{"status": status})
}

// toggleMyCard permite al usuario activar/desactivar SU PROPIA tarjeta sin
// permiso de admin. Verifica que la tarjeta pertenezca al usuario y que no
// haya sido bloqueada por un admin (deactivated_by_admin = true).
func (h *NFCTerminalHandler) toggleMyCard(w http.ResponseWriter, r *http.Request) {
	cardUID := chi.URLParam(r, "uid")
	if cardUID == "" {
		writeError(w, 400, "card uid is required")
		return
	}

	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "unauthorized")
		return
	}

	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Verificar que la tarjeta pertenezca al usuario
	var ownerID uuid.UUID
	var deactivatedByAdmin bool
	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT user_id, COALESCE(deactivated_by_admin, false) FROM nfc_cards
		WHERE card_uid = $1`,
		cardUID,
	).Scan(&ownerID, &deactivatedByAdmin)
	if err != nil {
		writeError(w, 404, "tarjeta no encontrada")
		return
	}

	if ownerID != userID {
		writeError(w, 403, "no tienes permiso para modificar esta tarjeta")
		return
	}

	// Si el admin la desactivo, el usuario no puede reactivarla
	if deactivatedByAdmin && req.IsActive {
		writeError(w, 403, "esta tarjeta fue bloqueada por un administrador. Contacta al admin para reactivarla")
		return
	}

	var deactivatedAt *time.Time
	if !req.IsActive {
		deactivatedAt = &time.Time{}
		*deactivatedAt = time.Now()
	}

	_, err = h.NFC.Pool.Exec(r.Context(), `
		UPDATE nfc_cards SET is_active = $2, deactivated_at = $3
		WHERE card_uid = $1 AND user_id = $4`,
		cardUID, req.IsActive, deactivatedAt, userID,
	)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	status := "activated"
	if !req.IsActive {
		status = "deactivated"
	}
	writeJSON(w, 200, map[string]string{"status": status})
}

// deleteCardPermanent elimina una tarjeta completamente de la base de datos.
// Solo admin con nfc.issue_card. A diferencia de deactivateCard (que solo
// marca is_active=false), este borra la fila y sus sectores asociados.
func (h *NFCTerminalHandler) deleteCardPermanent(w http.ResponseWriter, r *http.Request) {
	cardUID := chi.URLParam(r, "uid")
	if cardUID == "" {
		writeError(w, 400, "card uid is required")
		return
	}

	// Eliminar sectores asociados (si es Classic)
	_, _ = h.NFC.Pool.Exec(r.Context(), `DELETE FROM nfc_card_sectors WHERE card_uid = $1`, cardUID)
	// Eliminar la tarjeta
	ct, err := h.NFC.Pool.Exec(r.Context(), `DELETE FROM nfc_cards WHERE card_uid = $1`, cardUID)
	if err != nil {
		writeError(w, 500, "error al eliminar tarjeta: "+err.Error())
		return
	}
	if ct.RowsAffected() == 0 {
		writeError(w, 404, "tarjeta no encontrada")
		return
	}
	writeJSON(w, 200, map[string]string{"status": "deleted"})
}

// updateCardLabel actualiza el label (nombre descriptivo) de una tarjeta.
func (h *NFCTerminalHandler) updateCardLabel(w http.ResponseWriter, r *http.Request) {
	cardUID := chi.URLParam(r, "uid")
	if cardUID == "" {
		writeError(w, 400, "card uid is required")
		return
	}
	var req struct {
		Label string `json:"label"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	_, err := h.NFC.Pool.Exec(r.Context(), `UPDATE nfc_cards SET label = $1 WHERE card_uid = $2`, req.Label, cardUID)
	if err != nil {
		writeError(w, 500, "error al actualizar label: "+err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "updated"})
}

// setCardDocument cambia qué documento de identidad usa la tarjeta.
// El usuario debe tener el documento registrado en user_documents.
func (h *NFCTerminalHandler) setCardDocument(w http.ResponseWriter, r *http.Request) {
	cardUID := chi.URLParam(r, "uid")
	if cardUID == "" {
		writeError(w, 400, "card uid is required")
		return
	}

	var req struct {
		DocumentTypeCode string `json:"document_type_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.DocumentTypeCode == "" {
		// Limpiar el documento requerido — usar el default del usuario
		_, err := h.NFC.Pool.Exec(r.Context(), `
			UPDATE nfc_cards SET required_doc_type = NULL WHERE card_uid = $1`,
			cardUID,
		)
		if err != nil {
			writeError(w, 500, err.Error())
			return
		}
		writeJSON(w, 200, map[string]string{"status": "cleared"})
		return
	}

	// Verificar que la tarjeta existe y obtener el user_id
	var userID uuid.UUID
	err := h.NFC.Pool.QueryRow(r.Context(), `
		SELECT user_id FROM nfc_cards WHERE card_uid = $1`, cardUID,
	).Scan(&userID)
	if err != nil {
		writeError(w, 404, "tarjeta no encontrada")
		return
	}

	// Verificar que el usuario tiene ese documento registrado
	var docExists bool
	h.NFC.Pool.QueryRow(r.Context(), `
		SELECT EXISTS(SELECT 1 FROM user_documents WHERE user_id = $1 AND document_type_code = $2)`,
		userID, req.DocumentTypeCode,
	).Scan(&docExists)
	if !docExists {
		writeError(w, 400, "el usuario no tiene registrado ese tipo de documento")
		return
	}

	_, err = h.NFC.Pool.Exec(r.Context(), `
		UPDATE nfc_cards SET required_doc_type = $2 WHERE card_uid = $1`,
		cardUID, req.DocumentTypeCode,
	)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "updated", "document_type": req.DocumentTypeCode})
}

// listAllCards lista todas las tarjetas para el panel de admin.
// Soporta búsqueda por card_uid, username o display_name.
func (h *NFCTerminalHandler) listAllCards(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	activeOnly := r.URL.Query().Get("active") == "true"

	query := `
		SELECT c.id, c.user_id, c.card_uid, c.is_active, c.card_type,
		       c.crypto_enabled, c.has_dynamic_certs, c.required_doc_type,
		       c.issued_at, c.deactivated_at, c.label,
		       u.username, u.display_name
		FROM nfc_cards c
		JOIN users u ON u.id = c.user_id
		WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		query += fmt.Sprintf(` AND (LOWER(c.card_uid) LIKE LOWER($%d) OR LOWER(u.username) LIKE LOWER($%d) OR LOWER(u.display_name) LIKE LOWER($%d) OR LOWER(c.label) LIKE LOWER($%d))`,
			argIdx, argIdx, argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if activeOnly {
		query += fmt.Sprintf(` AND c.is_active = true`)
	}
	query += ` ORDER BY c.issued_at DESC LIMIT 200`

	rows, err := h.NFC.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	type CardWithUser struct {
		ID               uuid.UUID  `json:"id"`
		UserID           uuid.UUID  `json:"user_id"`
		CardUID          string     `json:"card_uid"`
		IsActive         bool       `json:"is_active"`
		CardType         string     `json:"card_type"`
		CryptoEnabled    bool       `json:"crypto_enabled"`
		HasDynamicCerts  bool       `json:"has_dynamic_certs"`
		RequiredDocType  *string    `json:"required_doc_type"`
		IssuedAt         time.Time  `json:"issued_at"`
		DeactivatedAt    *time.Time `json:"deactivated_at"`
		Label            string     `json:"label"`
		Username         string     `json:"username"`
		DisplayName      string     `json:"display_name"`
		OrganizationName *string    `json:"organization_name"`
	}

	var cards []CardWithUser
	for rows.Next() {
		var c CardWithUser
		if err := rows.Scan(&c.ID, &c.UserID, &c.CardUID, &c.IsActive, &c.CardType,
			&c.CryptoEnabled, &c.HasDynamicCerts, &c.RequiredDocType,
			&c.IssuedAt, &c.DeactivatedAt, &c.Label,
			&c.Username, &c.DisplayName); err != nil {
			writeError(w, 500, err.Error())
			return
		}
		cards = append(cards, c)
	}
	if cards == nil {
		cards = []CardWithUser{}
	}
	writeJSON(w, 200, cards)
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

// --- Assign terminal to organization or person (admin/Asamblea assigns) ---

func (h *NFCTerminalHandler) assignTerminalToOrg(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	if terminalID == "" {
		writeError(w, 400, "terminal id is required")
		return
	}

	var req struct {
		OrganizationID string `json:"organization_id"`
		// Campos nuevos para soportar persona u organizacion
		TargetType string `json:"target_type"` // "person" o "organization"
		TargetID   string `json:"target_id"`   // UUID del usuario/organizacion
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Determinar el tipo de target y el ID
	// Si vienen los campos nuevos (target_type + target_id), usar esos
	// Si no, usar el campo viejo (organization_id) para compatibilidad
	var targetID string
	var isPerson bool

	if req.TargetID != "" && req.TargetType != "" {
		targetID = req.TargetID
		isPerson = req.TargetType == "person"
	} else if req.OrganizationID != "" {
		targetID = req.OrganizationID
		isPerson = false
	} else {
		writeError(w, 400, "target_id o organization_id es requerido")
		return
	}

	id, err := uuid.Parse(targetID)
	if err != nil {
		writeError(w, 400, "invalid target id")
		return
	}

	// Verificar que el target existe y obtener su account_type
	var accountType string
	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT account_type FROM users WHERE id = $1`, id,
	).Scan(&accountType)
	if err != nil {
		writeError(w, 404, "usuario/organizacion no encontrado")
		return
	}

	// Determinar si es persona u organizacion segun account_type real
	if accountType == "individual" {
		isPerson = true
	} else if accountType == "organization" {
		isPerson = false
	} else {
		writeError(w, 400, "tipo de cuenta no valido para asignar terminal: "+accountType)
		return
	}

	if isPerson {
		// Asignar a persona: setear merchant_user_id, limpiar organization_id
		_, err = h.NFC.Pool.Exec(r.Context(), `
			UPDATE nfc_terminals
			SET merchant_user_id = $2, organization_id = NULL, department_id = NULL, updated_at = NOW()
			WHERE terminal_id = $1`,
			terminalID, id,
		)
		if err != nil {
			writeError(w, 500, "failed to assign terminal to user")
			return
		}
		writeJSON(w, 200, map[string]string{"status": "assigned_to_user"})
	} else {
		// Asignar a organizacion: setear organization_id, limpiar merchant_user_id
		_, err = h.NFC.Pool.Exec(r.Context(), `
			UPDATE nfc_terminals
			SET organization_id = $2, department_id = NULL, merchant_user_id = NULL, updated_at = NOW()
			WHERE terminal_id = $1`,
			terminalID, id,
		)
		if err != nil {
			writeError(w, 500, "failed to assign terminal to organization")
			return
		}
		writeJSON(w, 200, map[string]string{"status": "assigned_to_org"})
	}
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
	// Tambien insertar en nfc_terminal_authorized_users para que el usuario
	// aparezca en la lista de personas autorizadas y pueda usar el terminal.
	_, _ = h.NFC.Pool.Exec(r.Context(), `
		INSERT INTO nfc_terminal_authorized_users (terminal_id, user_id, assigned_by)
		VALUES ($1, $2, $3)
		ON CONFLICT (terminal_id, user_id) DO NOTHING`,
		terminalID, userID, orgID,
	)
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

// --- Organization: list authorized users for a terminal ---

func (h *NFCTerminalHandler) listAuthorizedUsers(w http.ResponseWriter, r *http.Request) {
	orgIDStr := chi.URLParam(r, "orgID")
	terminalID := chi.URLParam(r, "terminalID")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		writeError(w, 400, "invalid org id")
		return
	}

	// Verificar que el terminal pertenece a la organizacion
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

	// Listar personas en nfc_terminal_authorized_users
	rows, err := h.NFC.Pool.Query(r.Context(), `
		SELECT au.user_id, u.username, COALESCE(u.display_name, u.username), au.assigned_at
		FROM nfc_terminal_authorized_users au
		JOIN users u ON u.id = au.user_id
		WHERE au.terminal_id = $1
		ORDER BY au.assigned_at DESC`,
		terminalID,
	)
	if err != nil {
		writeError(w, 500, "failed to list authorized users")
		return
	}
	defer rows.Close()

	users := []map[string]interface{}{}
	for rows.Next() {
		var userID uuid.UUID
		var username, displayName string
		var assignedAt time.Time
		if err := rows.Scan(&userID, &username, &displayName, &assignedAt); err != nil {
			continue
		}
		users = append(users, map[string]interface{}{
			"user_id":      userID.String(),
			"username":     username,
			"display_name": displayName,
			"assigned_at":  assignedAt,
		})
	}

	// Si el terminal tiene department_id, tambien listar miembros del departamento
	var deptID *uuid.UUID
	_ = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT department_id FROM nfc_terminals WHERE terminal_id = $1`,
		terminalID,
	).Scan(&deptID)
	if deptID != nil {
		deptRows, _ := h.NFC.Pool.Query(r.Context(), `
			SELECT dm.user_id, u.username, COALESCE(u.display_name, u.username), r.name
			FROM department_members dm
			JOIN users u ON u.id = dm.user_id
			JOIN department_roles r ON r.id = dm.role_id
			WHERE dm.department_id = $1
			ORDER BY u.username`,
			*deptID,
		)
		if deptRows != nil {
			defer deptRows.Close()
			for deptRows.Next() {
				var userID uuid.UUID
				var username, displayName, roleName string
				if err := deptRows.Scan(&userID, &username, &displayName, &roleName); err != nil {
					continue
				}
				users = append(users, map[string]interface{}{
					"user_id":      userID.String(),
					"username":     username,
					"display_name": displayName,
					"role":         roleName,
					"source":       "department",
				})
			}
		}
	}

	writeJSON(w, 200, users)
}

// --- Organization: add authorized user to a terminal ---

func (h *NFCTerminalHandler) addAuthorizedUser(w http.ResponseWriter, r *http.Request) {
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

	// Verificar que el terminal pertenece a la organizacion
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

	// Insertar en nfc_terminal_authorized_users
	_, err = h.NFC.Pool.Exec(r.Context(), `
		INSERT INTO nfc_terminal_authorized_users (terminal_id, user_id, assigned_by)
		VALUES ($1, $2, $3)
		ON CONFLICT (terminal_id, user_id) DO NOTHING`,
		terminalID, userID, orgID,
	)
	if err != nil {
		writeError(w, 500, "failed to add authorized user")
		return
	}
	writeJSON(w, 200, map[string]string{"status": "added"})
}

// --- Organization: remove authorized user from a terminal ---

func (h *NFCTerminalHandler) removeAuthorizedUser(w http.ResponseWriter, r *http.Request) {
	orgIDStr := chi.URLParam(r, "orgID")
	terminalID := chi.URLParam(r, "terminalID")
	userIDStr := chi.URLParam(r, "userID")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		writeError(w, 400, "invalid org id")
		return
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		writeError(w, 400, "invalid user id")
		return
	}

	// Verificar que el terminal pertenece a la organizacion
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
		DELETE FROM nfc_terminal_authorized_users
		WHERE terminal_id = $1 AND user_id = $2`,
		terminalID, userID,
	)
	if err != nil {
		writeError(w, 500, "failed to remove authorized user")
		return
	}
	writeJSON(w, 200, map[string]string{"status": "removed"})
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

	// Parse date range (default: last 1 year)
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	if from == "" {
		from = time.Now().AddDate(-1, 0, 0).Format("2006-01-02")
	}
	if to == "" {
		to = time.Now().Format("2006-01-02")
	}
	fromTime, err := time.Parse("2006-01-02", from)
	if err != nil {
		writeError(w, 400, "invalid from date format (use YYYY-MM-DD)")
		return
	}
	toTime, err := time.Parse("2006-01-02", to)
	if err != nil {
		writeError(w, 400, "invalid to date format (use YYYY-MM-DD)")
		return
	}
	toTime = toTime.Add(24*time.Hour - time.Second)

	rows, err := h.NFC.Pool.Query(r.Context(), `
		SELECT s.id, s.user_id, u.display_name, s.status,
		       s.opened_at, s.closed_at, s.total_sales, s.transactions_count, s.notes
		FROM pos_shifts s
		JOIN users u ON u.id = s.user_id
		WHERE s.terminal_id = $1 AND s.opened_at >= $2 AND s.opened_at <= $3
		ORDER BY s.opened_at DESC`,
		termDBID, fromTime, toTime,
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

	// Parse date range (default: last 1 year)
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	if from == "" {
		from = time.Now().AddDate(-1, 0, 0).Format("2006-01-02")
	}
	if to == "" {
		to = time.Now().Format("2006-01-02")
	}
	fromTime, err := time.Parse("2006-01-02", from)
	if err != nil {
		writeError(w, 400, "invalid from date format (use YYYY-MM-DD)")
		return
	}
	toTime, err := time.Parse("2006-01-02", to)
	if err != nil {
		writeError(w, 400, "invalid to date format (use YYYY-MM-DD)")
		return
	}
	toTime = toTime.Add(24*time.Hour - time.Second)

	rows, err := h.NFC.Pool.Query(r.Context(), `
		SELECT id, card_uid, amount, status, pin_verified, transaction_type,
		       error_message, created_at
		FROM nfc_transactions
		WHERE terminal_id = $1 AND created_at >= $2 AND created_at <= $3
		ORDER BY created_at DESC`,
		termDBID, fromTime, toTime,
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

	var req struct {
		OpeningAmount int64  `json:"opening_amount"`
		Notes         string `json:"notes"`
		PIN           string `json:"pin"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	// Get terminal DB id and org
	var termDBID uuid.UUID
	var orgID *uuid.UUID
	var shiftPinHash *string
	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT id, organization_id, shift_pin_hash FROM nfc_terminals
		WHERE terminal_id = $1 AND (merchant_user_id = $2 OR organization_id IS NOT NULL)`,
		terminalID, userID,
	).Scan(&termDBID, &orgID, &shiftPinHash)
	if err != nil {
		writeError(w, 404, "terminal not found or not authorized")
		return
	}

	// Verificar PIN del turno (configurado por el dueño)
	if shiftPinHash == nil || *shiftPinHash == "" {
		writeError(w, 400, "el dueño del terminal debe configurar el PIN del turno desde su panel web")
		return
	}
	if req.PIN == "" {
		writeError(w, 400, "pin is required to open shift")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*shiftPinHash), []byte(req.PIN)); err != nil {
		writeError(w, 403, "PIN del turno incorrecto")
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
		INSERT INTO pos_shifts (terminal_id, user_id, organization_id, status, opening_amount, notes)
		VALUES ($1, $2, $3, 'open', $4, NULLIF($5, ''))
		RETURNING id`,
		termDBID, userID, orgID, req.OpeningAmount, req.Notes,
	).Scan(&shiftID)
	if err != nil {
		writeError(w, 500, "failed to open shift")
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"shift_id":       shiftID,
		"status":         "open",
		"opening_amount": req.OpeningAmount,
	})
}

// getActiveShift devuelve el turno activo del terminal (si hay uno abierto)
func (h *NFCTerminalHandler) getActiveShift(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")

	var termDBID uuid.UUID
	err := h.NFC.Pool.QueryRow(r.Context(), `
		SELECT id FROM nfc_terminals WHERE terminal_id = $1`,
		terminalID,
	).Scan(&termDBID)
	if err != nil {
		writeError(w, 404, "terminal not found")
		return
	}

	var shiftID uuid.UUID
	var userID uuid.UUID
	var status string
	var openedAt time.Time
	var openingAmount int64
	var totalSales int64
	var txCount int
	var notes *string

	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT id, user_id, status, opened_at, opening_amount,
		       COALESCE(total_sales, 0), COALESCE(transactions_count, 0), notes
		FROM pos_shifts
		WHERE terminal_id = $1 AND status = 'open'
		ORDER BY opened_at DESC LIMIT 1`,
		termDBID,
	).Scan(&shiftID, &userID, &status, &openedAt, &openingAmount, &totalSales, &txCount, &notes)
	if err != nil {
		// No hay turno abierto
		writeJSON(w, 200, map[string]interface{}{
			"active": false,
		})
		return
	}

	// Calcular ventas en tiempo real desde la apertura del turno
	h.NFC.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(SUM(amount), 0), COUNT(*)
		FROM nfc_transactions
		WHERE terminal_id = $1 AND status = 'approved'
		  AND created_at >= $2`,
		termDBID, openedAt,
	).Scan(&totalSales, &txCount)

	resp := map[string]interface{}{
		"active":             true,
		"shift_id":           shiftID,
		"user_id":            userID,
		"status":             status,
		"opened_at":          openedAt,
		"opening_amount":     openingAmount,
		"total_sales":        totalSales,
		"transactions_count": txCount,
		"expected_close":     openingAmount + totalSales,
	}
	if notes != nil {
		resp["notes"] = *notes
	}
	writeJSON(w, 200, resp)
}

func (h *NFCTerminalHandler) closeShift(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	var req struct {
		PIN string `json:"pin"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	var termDBID uuid.UUID
	var shiftPinHash *string
	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT id, shift_pin_hash FROM nfc_terminals WHERE terminal_id = $1`,
		terminalID,
	).Scan(&termDBID, &shiftPinHash)
	if err != nil {
		writeError(w, 404, "terminal not found")
		return
	}

	// Verificar PIN del turno
	if shiftPinHash == nil || *shiftPinHash == "" {
		writeError(w, 400, "el dueño del terminal no ha configurado el PIN del turno")
		return
	}
	if req.PIN == "" {
		writeError(w, 400, "pin is required to close shift")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*shiftPinHash), []byte(req.PIN)); err != nil {
		writeError(w, 403, "PIN del turno incorrecto")
		return
	}

	// Calculate total sales for this shift
	var totalSales int64
	var txCount int
	var openingAmount int64
	h.NFC.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(SUM(amount), 0), COUNT(*)
		FROM nfc_transactions
		WHERE terminal_id = $1 AND status = 'approved'
		  AND created_at >= (SELECT opened_at FROM pos_shifts WHERE terminal_id = $1 AND status = 'open' ORDER BY opened_at DESC LIMIT 1)`,
		termDBID,
	).Scan(&totalSales, &txCount)

	// Obtener el monto de apertura antes de cerrar
	h.NFC.Pool.QueryRow(r.Context(), `
		SELECT opening_amount FROM pos_shifts
		WHERE terminal_id = $1 AND user_id = $2 AND status = 'open'
		ORDER BY opened_at DESC LIMIT 1`,
		termDBID, userID,
	).Scan(&openingAmount)

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
		"opening_amount":     openingAmount,
		"total_sales":        totalSales,
		"transactions_count": txCount,
		"expected_close":     openingAmount + totalSales,
	})
}

// syncOfflineShiftClose sincroniza un cierre de turno que se hizo offline.
// No requiere PIN (el terminal ya está autenticado via JWT).
// Acepta un closed_at timestamp del cliente para registrar la hora real del cierre.
//
// RESOLUCIÓN DE CONFLICTOS: Si el turno ya fue cerrado en el backend (por un admin
// desde el panel web) y el POS también lo cerró offline, el cierre del POS PREVALECE
// porque el POS es donde están las transacciones. Los datos del POS (closed_at,
// closing_amount, notes) reemplazan los del backend.
func (h *NFCTerminalHandler) syncOfflineShiftClose(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	var req struct {
		ClosedAt      *time.Time `json:"closed_at"`
		ClosingAmount *int64     `json:"closing_amount"`
		Notes         *string    `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
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

	// Buscar el turno más reciente de este terminal y usuario.
	// Puede estar abierto (caso normal) o cerrado (conflicto: backend cerró primero).
	var shiftID uuid.UUID
	var openingAmount int64
	var openedAt time.Time
	var currentStatus string
	var wasClosedInBackend bool

	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT id, opening_amount, opened_at, status FROM pos_shifts
		WHERE terminal_id = $1 AND user_id = $2
		ORDER BY opened_at DESC LIMIT 1`,
		termDBID, userID,
	).Scan(&shiftID, &openingAmount, &openedAt, &currentStatus)
	if err != nil {
		writeError(w, 400, "no shift found for this terminal")
		return
	}

	wasClosedInBackend = (currentStatus == "closed")

	// Calcular total de ventas desde nfc_transactions (desde opened_at hasta ahora)
	var totalSales int64
	var txCount int
	h.NFC.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(SUM(amount), 0), COUNT(*)
		FROM nfc_transactions
		WHERE terminal_id = $1 AND status = 'approved'
		  AND created_at >= $2`,
		termDBID, openedAt,
	).Scan(&totalSales, &txCount)

	// Usar el closed_at del POS (cliente) si se proporciona, sino NOW()
	closedAt := time.Now()
	if req.ClosedAt != nil {
		closedAt = *req.ClosedAt
	}

	// Notas: usar las del POS si se proporcionan
	var notes interface{}
	if req.Notes != nil {
		notes = *req.Notes
	} else {
		notes = nil
	}

	// Actualizar el turno con los datos del POS.
	// Si estaba abierto: se cierra con los datos del POS.
	// Si ya estaba cerrado (conflicto): los datos del POS PREVALECEN y reemplazan los del backend.
	_, err = h.NFC.Pool.Exec(r.Context(), `
		UPDATE pos_shifts
		SET status = 'closed', closed_at = $3, total_sales = $4, transactions_count = $5, notes = COALESCE($6, notes)
		WHERE id = $7`,
		termDBID, userID, closedAt, totalSales, txCount, notes, shiftID,
	)
	if err != nil {
		writeError(w, 500, "failed to sync offline close")
		return
	}

	response := map[string]interface{}{
		"status":             "closed",
		"opening_amount":     openingAmount,
		"total_sales":        totalSales,
		"transactions_count": txCount,
		"expected_close":     openingAmount + totalSales,
		"synced":             true,
		"conflict_resolved":  wasClosedInBackend,
	}
	if wasClosedInBackend {
		response["message"] = "Cierre del POS prevaleció sobre el cierre del backend"
	}
	writeJSON(w, 200, response)
}

// --- Shift PIN management (configured by terminal owner) ---

// setShiftPin allows the terminal owner to configure the shift PIN
func (h *NFCTerminalHandler) setShiftPin(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	var req struct {
		PIN string `json:"pin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if len(req.PIN) < 4 || len(req.PIN) > 32 {
		writeError(w, 400, "PIN must be between 4 and 32 characters")
		return
	}

	// Verify the user is the owner of the terminal
	var termDBID uuid.UUID
	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT id FROM nfc_terminals
		WHERE terminal_id = $1 AND merchant_user_id = $2`,
		terminalID, userID,
	).Scan(&termDBID)
	if err != nil {
		writeError(w, 404, "terminal not found or you are not the owner")
		return
	}

	// Hash the PIN with bcrypt
	hashedPIN, err := bcrypt.GenerateFromPassword([]byte(req.PIN), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, 500, "failed to hash PIN")
		return
	}

	_, err = h.NFC.Pool.Exec(r.Context(), `
		UPDATE nfc_terminals SET shift_pin_hash = $1 WHERE id = $2`,
		string(hashedPIN), termDBID,
	)
	if err != nil {
		writeError(w, 500, "failed to save PIN")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"status":  "configured",
		"message": "PIN del turno configurado correctamente",
	})
}

// verifyShiftPin allows the POS to verify a shift PIN
func (h *NFCTerminalHandler) verifyShiftPin(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")

	var req struct {
		PIN string `json:"pin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.PIN == "" {
		writeError(w, 400, "pin is required")
		return
	}

	var shiftPinHash *string
	err := h.NFC.Pool.QueryRow(r.Context(), `
		SELECT shift_pin_hash FROM nfc_terminals WHERE terminal_id = $1`,
		terminalID,
	).Scan(&shiftPinHash)
	if err != nil {
		writeError(w, 404, "terminal not found")
		return
	}

	if shiftPinHash == nil || *shiftPinHash == "" {
		writeJSON(w, 200, map[string]interface{}{
			"valid":      false,
			"configured": false,
			"message":    "el dueño del terminal no ha configurado el PIN del turno",
		})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*shiftPinHash), []byte(req.PIN)); err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"valid":      false,
			"configured": true,
			"message":    "PIN incorrecto",
		})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"valid":      true,
		"configured": true,
	})
}

// getShiftPinConfigured returns whether the terminal has a shift PIN configured
func (h *NFCTerminalHandler) getShiftPinConfigured(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")

	var shiftPinHash *string
	err := h.NFC.Pool.QueryRow(r.Context(), `
		SELECT shift_pin_hash FROM nfc_terminals WHERE terminal_id = $1`,
		terminalID,
	).Scan(&shiftPinHash)
	if err != nil {
		writeError(w, 404, "terminal not found")
		return
	}

	configured := shiftPinHash != nil && *shiftPinHash != ""
	writeJSON(w, 200, map[string]interface{}{
		"configured": configured,
	})
}

// listMyTerminalShifts lists shifts for a terminal owned by the authenticated user.
// Supports date range filtering with from/to query params (YYYY-MM-DD).
// No artificial LIMIT — returns all shifts in the range (max 1 year default).
func (h *NFCTerminalHandler) listMyTerminalShifts(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	var termDBID uuid.UUID
	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT id FROM nfc_terminals
		WHERE terminal_id = $1 AND (merchant_user_id = $2 OR organization_id IS NOT NULL)`,
		terminalID, userID,
	).Scan(&termDBID)
	if err != nil {
		writeError(w, 404, "terminal not found or not authorized")
		return
	}

	// Parse date range (default: last 1 year)
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	if from == "" {
		from = time.Now().AddDate(-1, 0, 0).Format("2006-01-02")
	}
	if to == "" {
		to = time.Now().Format("2006-01-02")
	}
	fromTime, err := time.Parse("2006-01-02", from)
	if err != nil {
		writeError(w, 400, "invalid from date format (use YYYY-MM-DD)")
		return
	}
	toTime, err := time.Parse("2006-01-02", to)
	if err != nil {
		writeError(w, 400, "invalid to date format (use YYYY-MM-DD)")
		return
	}
	toTime = toTime.Add(24*time.Hour - time.Second) // include the full "to" day

	rows, err := h.NFC.Pool.Query(r.Context(), `
		SELECT s.id, s.user_id, u.display_name, s.status,
		       s.opened_at, s.closed_at, s.opening_amount, s.closing_amount,
		       s.total_sales, s.transactions_count, s.notes
		FROM pos_shifts s
		JOIN users u ON u.id = s.user_id
		WHERE s.terminal_id = $1 AND s.opened_at >= $2 AND s.opened_at <= $3
		ORDER BY s.opened_at DESC`,
		termDBID, fromTime, toTime,
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
		var openingAmount, totalSales int64
		var closingAmount *int64
		var txCount int
		var notes *string

		if err := rows.Scan(&id, &userID, &userName, &status, &openedAt, &closedAt,
			&openingAmount, &closingAmount, &totalSales, &txCount, &notes); err != nil {
			continue
		}

		s := map[string]interface{}{
			"id":                 id,
			"user_id":            userID,
			"user_name":          userName,
			"status":             status,
			"opened_at":          openedAt,
			"opening_amount":     openingAmount,
			"total_sales":        totalSales,
			"transactions_count": txCount,
		}
		if closedAt != nil {
			s["closed_at"] = *closedAt
		}
		if closingAmount != nil {
			s["closing_amount"] = *closingAmount
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

// exportMyTerminalTransactionsCSV exports transactions as CSV for download
func (h *NFCTerminalHandler) exportMyTerminalTransactionsCSV(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	var termDBID uuid.UUID
	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT id FROM nfc_terminals
		WHERE terminal_id = $1 AND (merchant_user_id = $2 OR organization_id IS NOT NULL)`,
		terminalID, userID,
	).Scan(&termDBID)
	if err != nil {
		writeError(w, 404, "terminal not found or not authorized")
		return
	}

	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	if from == "" {
		from = time.Now().AddDate(-1, 0, 0).Format("2006-01-02")
	}
	if to == "" {
		to = time.Now().Format("2006-01-02")
	}
	fromTime, err := time.Parse("2006-01-02", from)
	if err != nil {
		writeError(w, 400, "invalid from date format")
		return
	}
	toTime, err := time.Parse("2006-01-02", to)
	if err != nil {
		writeError(w, 400, "invalid to date format")
		return
	}
	toTime = toTime.Add(24*time.Hour - time.Second)

	rows, err := h.NFC.Pool.Query(r.Context(), `
		SELECT id, card_uid, amount, status, pin_verified, transaction_type,
		       error_message, created_at
		FROM nfc_transactions
		WHERE terminal_id = $1 AND created_at >= $2 AND created_at <= $3
		ORDER BY created_at DESC`,
		termDBID, fromTime, toTime,
	)
	if err != nil {
		writeError(w, 500, "failed to query transactions")
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition",
		fmt.Sprintf("attachment; filename=transacciones_%s_%s_a_%s.csv", terminalID, from, to))

	writer := csv.NewWriter(w)
	writer.Write([]string{"ID Transaccion", "UID Tarjeta", "Monto (centavos)", "Estado",
		"PIN Verificado", "Tipo Transaccion", "Mensaje Error", "Fecha/Hora"})

	for rows.Next() {
		var id uuid.UUID
		var cardUID string
		var amount int64
		var status string
		var pinVerified bool
		var txType string
		var errMsg *string
		var createdAt time.Time

		if err := rows.Scan(&id, &cardUID, &amount, &status, &pinVerified, &txType, &errMsg, &createdAt); err != nil {
			continue
		}
		errStr := ""
		if errMsg != nil {
			errStr = *errMsg
		}
		pinStr := "no"
		if pinVerified {
			pinStr = "si"
		}
		writer.Write([]string{
			id.String(), cardUID, fmt.Sprintf("%d", amount), status,
			pinStr, txType, errStr, createdAt.Format("2006-01-02 15:04:05"),
		})
	}
	writer.Flush()
}

// exportMyTerminalShiftsCSV exports shifts as CSV for download
func (h *NFCTerminalHandler) exportMyTerminalShiftsCSV(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "id")
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	var termDBID uuid.UUID
	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT id FROM nfc_terminals
		WHERE terminal_id = $1 AND (merchant_user_id = $2 OR organization_id IS NOT NULL)`,
		terminalID, userID,
	).Scan(&termDBID)
	if err != nil {
		writeError(w, 404, "terminal not found or not authorized")
		return
	}

	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	if from == "" {
		from = time.Now().AddDate(-1, 0, 0).Format("2006-01-02")
	}
	if to == "" {
		to = time.Now().Format("2006-01-02")
	}
	fromTime, err := time.Parse("2006-01-02", from)
	if err != nil {
		writeError(w, 400, "invalid from date format")
		return
	}
	toTime, err := time.Parse("2006-01-02", to)
	if err != nil {
		writeError(w, 400, "invalid to date format")
		return
	}
	toTime = toTime.Add(24*time.Hour - time.Second)

	rows, err := h.NFC.Pool.Query(r.Context(), `
		SELECT s.id, u.display_name, s.status, s.opened_at, s.closed_at,
		       s.opening_amount, s.closing_amount, s.total_sales, s.transactions_count, s.notes
		FROM pos_shifts s
		JOIN users u ON u.id = s.user_id
		WHERE s.terminal_id = $1 AND s.opened_at >= $2 AND s.opened_at <= $3
		ORDER BY s.opened_at DESC`,
		termDBID, fromTime, toTime,
	)
	if err != nil {
		writeError(w, 500, "failed to query shifts")
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition",
		fmt.Sprintf("attachment; filename=turnos_%s_%s_a_%s.csv", terminalID, from, to))

	writer := csv.NewWriter(w)
	writer.Write([]string{"ID Turno", "Usuario", "Estado", "Apertura",
		"Cierre", "Monto Apertura (centavos)", "Monto Cierre (centavos)",
		"Ventas Totales (centavos)", "Numero Transacciones", "Notas"})

	for rows.Next() {
		var id uuid.UUID
		var userName, status string
		var openedAt time.Time
		var closedAt *time.Time
		var openingAmount, totalSales int64
		var closingAmount *int64
		var txCount int
		var notes *string

		if err := rows.Scan(&id, &userName, &status, &openedAt, &closedAt,
			&openingAmount, &closingAmount, &totalSales, &txCount, &notes); err != nil {
			continue
		}
		closedStr := ""
		if closedAt != nil {
			closedStr = closedAt.Format("2006-01-02 15:04:05")
		}
		closingStr := ""
		if closingAmount != nil {
			closingStr = fmt.Sprintf("%d", *closingAmount)
		}
		notesStr := ""
		if notes != nil {
			notesStr = *notes
		}
		writer.Write([]string{
			id.String(), userName, status,
			openedAt.Format("2006-01-02 15:04:05"), closedStr,
			fmt.Sprintf("%d", openingAmount), closingStr,
			fmt.Sprintf("%d", totalSales), fmt.Sprintf("%d", txCount), notesStr,
		})
	}
	writer.Flush()
}

// --- Retention config (admin) ---

// getRetentionConfig returns the current retention configuration
func (h *NFCTerminalHandler) getRetentionConfig(w http.ResponseWriter, r *http.Request) {
	var retentionDays int
	var enabled bool
	var lastPurgeAt *time.Time
	err := h.NFC.Pool.QueryRow(r.Context(), `
		SELECT retention_days, enabled, last_purge_at
		FROM pos_retention_config WHERE node_domain = $1`,
		"__LOCAL__",
	).Scan(&retentionDays, &enabled, &lastPurgeAt)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"retention_days": 365,
			"enabled":        true,
			"last_purge_at":  nil,
		})
		return
	}
	resp := map[string]interface{}{
		"retention_days": retentionDays,
		"enabled":        enabled,
	}
	if lastPurgeAt != nil {
		resp["last_purge_at"] = *lastPurgeAt
	}
	writeJSON(w, 200, resp)
}

// updateRetentionConfig updates the retention configuration
func (h *NFCTerminalHandler) updateRetentionConfig(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RetentionDays int   `json:"retention_days"`
		Enabled       *bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.RetentionDays < 1 {
		writeError(w, 400, "retention_days must be at least 1")
		return
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	_, err := h.NFC.Pool.Exec(r.Context(), `
		INSERT INTO pos_retention_config (node_domain, retention_days, enabled, updated_at)
		VALUES ('__LOCAL__', $1, $2, NOW())
		ON CONFLICT (node_domain)
		DO UPDATE SET retention_days = $1, enabled = $2, updated_at = NOW()`,
		req.RetentionDays, enabled,
	)
	if err != nil {
		writeError(w, 500, "failed to update retention config")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"retention_days": req.RetentionDays,
		"enabled":        enabled,
	})
}

// purgeNow triggers a manual purge of old transactions
func (h *NFCTerminalHandler) purgeNow(w http.ResponseWriter, r *http.Request) {
	var retentionDays int
	err := h.NFC.Pool.QueryRow(r.Context(), `
		SELECT retention_days FROM pos_retention_config WHERE node_domain = $1`,
		"__LOCAL__",
	).Scan(&retentionDays)
	if err != nil {
		retentionDays = 365
	}

	cutoff := time.Now().AddDate(0, 0, -retentionDays)
	txResult, _ := h.NFC.Pool.Exec(r.Context(),
		`DELETE FROM nfc_transactions WHERE created_at < $1`, cutoff)
	shiftResult, _ := h.NFC.Pool.Exec(r.Context(),
		`DELETE FROM pos_shifts WHERE opened_at < $1`, cutoff)

	h.NFC.Pool.Exec(r.Context(),
		`UPDATE pos_retention_config SET last_purge_at = NOW() WHERE node_domain = $1`,
		"__LOCAL__")

	writeJSON(w, 200, map[string]interface{}{
		"status":               "purged",
		"cutoff":               cutoff,
		"transactions_deleted": txResult.RowsAffected(),
		"shifts_deleted":       shiftResult.RowsAffected(),
	})
}

// --- User: list their assigned terminals ---

func (h *NFCTerminalHandler) listMyTerminals(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	// Buscar terminales asignados al usuario actual, ya sea como:
	// - merchant_user_id (persona individual)
	// - organization_id (organizacion, si el usuario logueado es una organizacion)
	rows, err := h.NFC.Pool.Query(r.Context(), `
		SELECT id, node_domain, terminal_id, label, terminal_type, location,
		       is_active, is_registered, last_seen, firmware_version, created_at, updated_at,
		       block_code_hash IS NOT NULL as is_blocked
		FROM nfc_terminals
		WHERE merchant_user_id = $1 OR organization_id = $1
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

// --- User: rename their terminal (update label) ---

func (h *NFCTerminalHandler) updateMyTerminalLabel(w http.ResponseWriter, r *http.Request) {
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

	var req struct {
		Label string `json:"label"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Label == "" {
		writeError(w, 400, "label is required")
		return
	}

	// Verify the terminal belongs to this user and update label
	tag, err := h.NFC.Pool.Exec(r.Context(), `
		UPDATE nfc_terminals SET label = $2, updated_at = NOW()
		WHERE terminal_id = $1 AND merchant_user_id = $3`,
		terminalID, req.Label, userID,
	)
	if err != nil {
		writeError(w, 500, "failed to update terminal label")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, 404, "terminal not found or not assigned to you")
		return
	}

	writeJSON(w, 200, map[string]string{"status": "updated", "label": req.Label})
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

	// Parse date range (default: last 1 year)
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	if from == "" {
		from = time.Now().AddDate(-1, 0, 0).Format("2006-01-02")
	}
	if to == "" {
		to = time.Now().Format("2006-01-02")
	}
	fromTime, err := time.Parse("2006-01-02", from)
	if err != nil {
		writeError(w, 400, "invalid from date format (use YYYY-MM-DD)")
		return
	}
	toTime, err := time.Parse("2006-01-02", to)
	if err != nil {
		writeError(w, 400, "invalid to date format (use YYYY-MM-DD)")
		return
	}
	toTime = toTime.Add(24*time.Hour - time.Second)

	rows, err := h.NFC.Pool.Query(r.Context(), `
		SELECT id, card_uid, amount, status, pin_verified, transaction_type,
		       error_message, created_at
		FROM nfc_transactions
		WHERE terminal_id = $1 AND created_at >= $2 AND created_at <= $3
		ORDER BY created_at DESC`,
		termDBID, fromTime, toTime,
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
		TerminalID         string `json:"terminal_id"`
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
		req.ChipID, req.DeviceModel, req.DeviceManufacturer, req.AndroidVersion, req.TerminalType, req.TerminalID)
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

// ============================================
// POS Web Session Handlers
// ============================================
// A diferencia del pairing de Android/ESP32 (aprobado por el admin),
// las sesiones del POS web son aprobadas por el DUEÑO del terminal.

// requestWebSession es llamado por el POS web (sin auth) para iniciar una
// solicitud de sesion. El POS envia su terminal_id (asignado por el admin),
// su clave publica Ed25519 efimera y la huella del navegador.
// El servidor responde con un codigo de 4 digitos que el POS muestra al usuario.
func (h *NFCTerminalHandler) requestWebSession(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TerminalID        string `json:"terminal_id"`
		TerminalPublicKey string `json:"terminal_public_key"`
		DeviceFingerprint string `json:"device_fingerprint"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.TerminalID == "" || req.TerminalPublicKey == "" {
		writeError(w, 400, "terminal_id y terminal_public_key son requeridos")
		return
	}

	code, requestID, err := h.NFC.RequestWebSession(r.Context(), req.TerminalID, req.TerminalPublicKey, req.DeviceFingerprint)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, map[string]interface{}{
		"pairing_code": code,
		"request_id":   requestID.String(),
		"expires_in":   60,
		"message":      "Pide al dueno del terminal que apruebe este codigo en su cuenta.",
	})
}

// getWebSessionStatus es consultado por el POS web (sin auth) via polling
// para saber si su solicitud de sesion fue aprobada.
func (h *NFCTerminalHandler) getWebSessionStatus(w http.ResponseWriter, r *http.Request) {
	reqIDStr := chi.URLParam(r, "reqId")
	if reqIDStr == "" {
		writeError(w, 400, "reqId is required")
		return
	}
	reqID, err := uuid.Parse(reqIDStr)
	if err != nil {
		writeError(w, 400, "invalid request id")
		return
	}

	status, terminalID, serverPubKey, expiresAt, err := h.NFC.GetWebSessionStatus(r.Context(), reqID)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}

	resp := map[string]interface{}{
		"status":      status,
		"terminal_id": terminalID,
	}
	if serverPubKey != "" {
		resp["server_public_key"] = serverPubKey
	}
	if expiresAt != nil {
		resp["expires_at"] = *expiresAt
	}
	writeJSON(w, 200, resp)
}

// listPendingWebSessions lista las solicitudes de sesion web pendientes
// para los terminales del usuario autenticado (dueño del terminal).
func (h *NFCTerminalHandler) listPendingWebSessions(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}
	requests, err := h.NFC.ListPendingWebSessions(r.Context(), userID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if requests == nil {
		requests = []payments.WebSessionRequest{}
	}
	writeJSON(w, 200, requests)
}

// getWebSessionOptions devuelve 4 opciones de codigo para que el dueno elija.
func (h *NFCTerminalHandler) getWebSessionOptions(w http.ResponseWriter, r *http.Request) {
	reqIDStr := chi.URLParam(r, "reqId")
	if reqIDStr == "" {
		writeError(w, 400, "reqId is required")
		return
	}
	reqID, err := uuid.Parse(reqIDStr)
	if err != nil {
		writeError(w, 400, "invalid request id")
		return
	}

	options, err := h.NFC.GetWebSessionOptions(r.Context(), reqID)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"options": options,
		"message": "Elija el codigo que le comunico la persona del POS web.",
	})
}

// approveWebSession aprueba una solicitud de sesion web.
// El dueno envia el codigo que eligio de las 4 opciones y las horas (1, 5, 24).
func (h *NFCTerminalHandler) approveWebSession(w http.ResponseWriter, r *http.Request) {
	reqIDStr := chi.URLParam(r, "reqId")
	if reqIDStr == "" {
		writeError(w, 400, "reqId is required")
		return
	}
	reqID, err := uuid.Parse(reqIDStr)
	if err != nil {
		writeError(w, 400, "invalid request id")
		return
	}

	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	var body struct {
		SelectedCode  string `json:"selected_code"`
		ApprovedHours int    `json:"approved_hours"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if body.SelectedCode == "" {
		writeError(w, 400, "selected_code es requerido")
		return
	}
	if body.ApprovedHours == 0 {
		body.ApprovedHours = 24 // default
	}

	serverPubKey, err := h.NFC.ApproveWebSession(r.Context(), reqID, body.SelectedCode, body.ApprovedHours, userID)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"status":            "approved",
		"server_public_key": serverPubKey,
	})
}

// rejectWebSession rechaza una solicitud de sesion web.
func (h *NFCTerminalHandler) rejectWebSession(w http.ResponseWriter, r *http.Request) {
	reqIDStr := chi.URLParam(r, "reqId")
	if reqIDStr == "" {
		writeError(w, 400, "reqId is required")
		return
	}
	reqID, err := uuid.Parse(reqIDStr)
	if err != nil {
		writeError(w, 400, "invalid request id")
		return
	}

	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	if err := h.NFC.RejectWebSession(r.Context(), reqID, userID); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "rejected"})
}

// listActiveWebSessions lista las sesiones web activas del usuario.
func (h *NFCTerminalHandler) listActiveWebSessions(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}
	sessions, err := h.NFC.ListActiveWebSessions(r.Context(), userID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if sessions == nil {
		sessions = []map[string]interface{}{}
	}
	writeJSON(w, 200, sessions)
}

// revokeWebSession anula la sesion activa de un terminal web_pos.
func (h *NFCTerminalHandler) revokeWebSession(w http.ResponseWriter, r *http.Request) {
	terminalID := chi.URLParam(r, "terminalId")
	if terminalID == "" {
		writeError(w, 400, "terminalId is required")
		return
	}

	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated")
		return
	}

	if err := h.NFC.RevokeWebSession(r.Context(), terminalID, userID); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "revoked"})
}

// ===== CERTIFICADOS DINAMICOS PARA MIFARE CLASSIC =====

// provisionClassicCard genera 15 sectores con claves y certificados unicos
func (h *NFCTerminalHandler) provisionClassicCard(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID     string `json:"user_id"`
		CardUID    string `json:"card_uid"`
		InitialPIN string `json:"initial_pin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.CardUID == "" || req.InitialPIN == "" || req.UserID == "" {
		writeError(w, 400, "user_id, card_uid and initial_pin are required")
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		writeError(w, 400, "invalid user_id")
		return
	}

	resp, err := h.NFC.ProvisionClassicCard(r.Context(), userID, req.CardUID, req.InitialPIN)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, resp)
}

// listPendingInitializationCards retorna tarjetas registradas pero no inicializadas.
// El POS Android usa esto para mostrar la lista de tarjetas pendientes de grabar.
func (h *NFCTerminalHandler) listPendingInitializationCards(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	// Tarjetas Classic pendientes (nfc_cards con has_dynamic_certs y initialized_at IS NULL)
	rows, err := h.NFC.Pool.Query(r.Context(), `
		SELECT c.card_uid, c.card_type, c.user_id, u.username, u.display_name,
		       c.issued_at, c.has_dynamic_certs
		FROM nfc_cards c
		JOIN users u ON u.id = c.user_id
		WHERE c.is_active = true
		  AND c.node_domain = $1
		  AND c.initialized_at IS NULL
		ORDER BY c.issued_at DESC`,
		nodeDomain)
	if err != nil {
		writeError(w, 500, "error querying pending cards: "+err.Error())
		return
	}
	defer rows.Close()

	type PendingCard struct {
		CardUID         string `json:"card_uid"`
		CardType        string `json:"card_type"`
		UserID          string `json:"user_id"`
		Username        string `json:"username"`
		DisplayName     string `json:"display_name"`
		HasDynamicCerts bool   `json:"has_dynamic_certs"`
		IssuedAt        string `json:"issued_at"`
	}

	var cards []PendingCard
	for rows.Next() {
		var c PendingCard
		var cardType *string
		var issuedAt time.Time
		if err := rows.Scan(&c.CardUID, &cardType, &c.UserID, &c.Username, &c.DisplayName,
			&issuedAt, &c.HasDynamicCerts); err != nil {
			continue
		}
		if cardType != nil {
			c.CardType = *cardType
		}
		if c.CardType == "" {
			c.CardType = "classic"
		}
		c.IssuedAt = issuedAt.Format(time.RFC3339)
		cards = append(cards, c)
	}

	if cards == nil {
		cards = []PendingCard{}
	}
	writeJSON(w, 200, map[string]interface{}{
		"pending_cards": cards,
		"count":         len(cards),
	})
}

// confirmCardInitialization marca una tarjeta como inicializada (grabada fisicamente).
// El POS Android llama esto despues de escribir los datos en la tarjeta NFC.
func (h *NFCTerminalHandler) confirmCardInitialization(w http.ResponseWriter, r *http.Request) {
	cardUID := chi.URLParam(r, "uid")
	if cardUID == "" {
		writeError(w, 400, "uid requerido")
		return
	}

	userIDStr := r.Header.Get("X-User-ID")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	// Verificar que la tarjeta existe y no ha sido inicializada
	var initializedAt *time.Time
	err = h.NFC.Pool.QueryRow(r.Context(),
		`SELECT initialized_at FROM nfc_cards WHERE card_uid = $1 AND is_active = true`,
		cardUID).Scan(&initializedAt)
	if err != nil {
		writeError(w, 404, "tarjeta no encontrada")
		return
	}
	if initializedAt != nil {
		writeError(w, 400, "esta tarjeta ya fue inicializada")
		return
	}

	_, err = h.NFC.Pool.Exec(r.Context(), `
		UPDATE nfc_cards SET initialized_at = NOW(), initialized_by = $1
		WHERE card_uid = $2`,
		userID, cardUID)
	if err != nil {
		writeError(w, 500, "error confirmando inicializacion: "+err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"card_uid":       cardUID,
		"initialized":    true,
		"initialized_at": time.Now().Format(time.RFC3339),
		"message":        "Tarjeta marcada como inicializada correctamente.",
	})
}

// classicPreAuth valida username + PIN + saldo y prepara la rotacion
func (h *NFCTerminalHandler) classicPreAuth(w http.ResponseWriter, r *http.Request) {
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

	var payload struct {
		TerminalID string `json:"terminal_id"`
		Username   string `json:"username"`
		PIN        string `json:"pin"`
		Amount     int64  `json:"amount"`
	}
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		writeError(w, 400, "invalid payload format")
		return
	}

	if payload.Username == "" || payload.PIN == "" {
		writeError(w, 400, "username and pin are required")
		return
	}

	resp, err := h.NFC.ClassicPreAuth(r.Context(), payload.TerminalID, payload.Username, payload.PIN, payload.Amount)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	respBytes, _ := json.Marshal(resp)
	encResp, err := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, encResp)
}

// classicPreAuthWithDocument valida username + documento + PIN + saldo (para Classic)
func (h *NFCTerminalHandler) classicPreAuthWithDocument(w http.ResponseWriter, r *http.Request) {
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

	var payload struct {
		TerminalID string `json:"terminal_id"`
		Username   string `json:"username"`
		DocType    string `json:"doc_type"`
		DocNumber  string `json:"doc_number"`
		PIN        string `json:"pin"`
		Amount     int64  `json:"amount"`
	}
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		writeError(w, 400, "invalid payload format")
		return
	}

	if payload.Username == "" || payload.DocNumber == "" || payload.PIN == "" {
		writeError(w, 400, "username, doc_number and pin are required")
		return
	}

	resp, err := h.NFC.ClassicPreAuthWithDocument(r.Context(), payload.TerminalID, payload.Username, payload.DocType, payload.DocNumber, payload.PIN, payload.Amount)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	respBytes, _ := json.Marshal(resp)
	encResp, err := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, encResp)
}

// userLookup busca un usuario por username para determinar el tipo de tarjeta
func (h *NFCTerminalHandler) userLookup(w http.ResponseWriter, r *http.Request) {
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

	var payload struct {
		TerminalID string `json:"terminal_id"`
		Username   string `json:"username"`
	}
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		writeError(w, 400, "invalid payload format")
		return
	}

	if payload.Username == "" {
		writeError(w, 400, "username is required")
		return
	}

	resp, err := h.NFC.UserLookup(r.Context(), payload.TerminalID, payload.Username)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	respBytes, _ := json.Marshal(resp)
	encResp, err := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, encResp)
}

// autoRenewKeys permite a un terminal renovar sus claves criptograficas
// automaticamente cuando se pierden (app reinstalada, datos borrados, etc.).
// REQUIERE JWT: solo el merchant_user_id asignado al terminal puede renovar.
// Esto previene que alguien falsifique un terminal y renueve claves con
// credenciales arbitrarias.
//
// Flujo seguro:
// 1. El usuario se loguea en el POS (login JWT, no requiere claves del terminal)
// 2. Si el terminal pierde sus claves, el usuario YA esta logueado
// 3. El POS llama a /auto-renew con el JWT del usuario logueado
// 4. El servidor verifica que el usuario logueado es el merchant_user_id del terminal
// 5. Si coincide, actualiza la clave y devuelve server_public_key
// 6. Si no coincide, rechaza (no es el dueño del terminal)
func (h *NFCTerminalHandler) autoRenewKeys(w http.ResponseWriter, r *http.Request) {
	// 1. Verificar JWT — el usuario debe estar logueado
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "not authenticated: user must be logged in to renew keys")
		return
	}

	var req struct {
		TerminalID        string `json:"terminal_id"`
		TerminalPublicKey string `json:"terminal_public_key"`
		DeviceFingerprint string `json:"device_fingerprint"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	if req.TerminalID == "" {
		writeError(w, 400, "terminal_id is required")
		return
	}
	if req.TerminalPublicKey == "" {
		writeError(w, 400, "terminal_public_key is required")
		return
	}
	if req.DeviceFingerprint == "" {
		writeError(w, 400, "device_fingerprint is required")
		return
	}

	// 2. Verificar que el usuario logueado es el merchant_user_id del terminal
	var storedMerchantID *uuid.UUID
	err = h.NFC.Pool.QueryRow(r.Context(), `
		SELECT merchant_user_id FROM nfc_terminals
		WHERE terminal_id = $1 AND is_registered = true AND is_active = true`,
		req.TerminalID,
	).Scan(&storedMerchantID)
	if err != nil {
		writeError(w, 404, "terminal not found or not registered")
		return
	}

	if storedMerchantID == nil || *storedMerchantID != userID {
		writeError(w, 403, "not authorized: you are not the assigned merchant for this terminal")
		return
	}

	// 3. Auto-renovar (AutoRenewKeys tambien verifica device_fingerprint internamente)
	serverPubKey, err := h.NFC.AutoRenewKeys(r.Context(), req.TerminalID, req.TerminalPublicKey, req.DeviceFingerprint)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"status":            "ok",
		"server_public_key": serverPubKey,
		"terminal_id":       req.TerminalID,
	})
}

// classicConfirm confirma la lectura/escritura de la tarjeta
func (h *NFCTerminalHandler) classicConfirm(w http.ResponseWriter, r *http.Request) {
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

	var payload struct {
		TerminalID    string `json:"terminal_id"`
		CardUID       string `json:"card_uid"`
		ReadOK        bool   `json:"read_ok"`
		WriteOK       bool   `json:"write_ok"`
		WrittenBlocks int    `json:"written_blocks"`
	}
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		writeError(w, 400, "invalid payload format")
		return
	}

	if payload.CardUID == "" {
		writeError(w, 400, "card_uid is required")
		return
	}

	resp, err := h.NFC.ConfirmClassicTransaction(r.Context(), payload.TerminalID, payload.CardUID, payload.ReadOK, payload.WriteOK, payload.WrittenBlocks)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	respBytes, _ := json.Marshal(resp)
	encResp, err := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, encResp)
}

// ===== DRIVERS MODULARES: NTAG215 + Ultralight C =====

// listCardTypes devuelve la lista de tipos de tarjeta soportados desde el registry modular.
func (h *NFCTerminalHandler) listCardTypes(w http.ResponseWriter, r *http.Request) {
	manifests := cards.ListDrivers()
	if manifests == nil {
		manifests = []cards.CardManifest{}
	}
	writeJSON(w, 200, manifests)
}

// provisionNTAG215Card genera 30 slots con certificados y PWD única.
func (h *NFCTerminalHandler) provisionNTAG215Card(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID     string `json:"user_id"`
		CardUID    string `json:"card_uid"`
		InitialPIN string `json:"initial_pin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.CardUID == "" || req.InitialPIN == "" || req.UserID == "" {
		writeError(w, 400, "user_id, card_uid and initial_pin are required")
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		writeError(w, 400, "invalid user_id")
		return
	}

	resp, err := h.NFC.ProvisionNTAG215Card(r.Context(), userID, req.CardUID, req.InitialPIN)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, resp)
}

// provisionUltralightCCard genera 8 slots con certificados y clave 3DES.
func (h *NFCTerminalHandler) provisionUltralightCCard(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID     string `json:"user_id"`
		CardUID    string `json:"card_uid"`
		InitialPIN string `json:"initial_pin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.CardUID == "" || req.InitialPIN == "" || req.UserID == "" {
		writeError(w, 400, "user_id, card_uid and initial_pin are required")
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		writeError(w, 400, "invalid user_id")
		return
	}

	resp, err := h.NFC.ProvisionUltralightCCard(r.Context(), userID, req.CardUID, req.InitialPIN)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, resp)
}

// ntag215PreAuth valida username + PIN + saldo y prepara la rotación NTAG215.
func (h *NFCTerminalHandler) ntag215PreAuth(w http.ResponseWriter, r *http.Request) {
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

	var payload struct {
		TerminalID string `json:"terminal_id"`
		Username   string `json:"username"`
		PIN        string `json:"pin"`
		Amount     int64  `json:"amount"`
	}
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		writeError(w, 400, "invalid payload format")
		return
	}

	if payload.Username == "" || payload.PIN == "" {
		writeError(w, 400, "username and pin are required")
		return
	}

	// 1. Buscar usuario por username
	userID, err := h.NFC.LookupUserByUsername(r.Context(), payload.Username)
	if err != nil {
		resp := map[string]interface{}{"pre_approved": false, "message": err.Error()}
		respBytes, _ := json.Marshal(resp)
		encResp, encErr := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
		if encErr != nil {
			writeError(w, 500, encErr.Error())
			return
		}
		writeJSON(w, 200, encResp)
		return
	}

	// 2. Buscar tarjeta NTAG215 activa
	cardUID, err := h.NFC.FindActiveCardByType(r.Context(), userID, "ntag215")
	if err != nil {
		resp := map[string]interface{}{"pre_approved": false, "message": err.Error()}
		respBytes, _ := json.Marshal(resp)
		encResp, encErr := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
		if encErr != nil {
			writeError(w, 500, encErr.Error())
			return
		}
		writeJSON(w, 200, encResp)
		return
	}

	// 3. Verificar PIN
	if err := h.NFC.VerifyCardPIN(r.Context(), cardUID, payload.PIN); err != nil {
		resp := map[string]interface{}{"pre_approved": false, "message": err.Error()}
		respBytes, _ := json.Marshal(resp)
		encResp, encErr := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
		if encErr != nil {
			writeError(w, 500, encErr.Error())
			return
		}
		writeJSON(w, 200, encResp)
		return
	}

	// 4. Llamar al driver NTAG215
	resp, err := h.NFC.NTAG215PreAuth(r.Context(), payload.TerminalID, userID, payload.Amount)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	respBytes, _ := json.Marshal(resp)
	encResp, err := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, encResp)
}

// ntag215PreAuthWithDocument valida username + documento + PIN + saldo.
func (h *NFCTerminalHandler) ntag215PreAuthWithDocument(w http.ResponseWriter, r *http.Request) {
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

	var payload struct {
		TerminalID string `json:"terminal_id"`
		Username   string `json:"username"`
		DocType    string `json:"doc_type"`
		DocNumber  string `json:"doc_number"`
		PIN        string `json:"pin"`
		Amount     int64  `json:"amount"`
	}
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		writeError(w, 400, "invalid payload format")
		return
	}

	if payload.Username == "" || payload.DocNumber == "" || payload.PIN == "" {
		writeError(w, 400, "username, doc_number and pin are required")
		return
	}

	// 1. Buscar usuario por username
	userID, err := h.NFC.LookupUserByUsername(r.Context(), payload.Username)
	if err != nil {
		resp := map[string]interface{}{"pre_approved": false, "message": err.Error()}
		respBytes, _ := json.Marshal(resp)
		encResp, encErr := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
		if encErr != nil {
			writeError(w, 500, encErr.Error())
			return
		}
		writeJSON(w, 200, encResp)
		return
	}

	// 2. Buscar tarjeta NTAG215 activa
	cardUID, err := h.NFC.FindActiveCardByType(r.Context(), userID, "ntag215")
	if err != nil {
		resp := map[string]interface{}{"pre_approved": false, "message": err.Error()}
		respBytes, _ := json.Marshal(resp)
		encResp, encErr := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
		if encErr != nil {
			writeError(w, 500, encErr.Error())
			return
		}
		writeJSON(w, 200, encResp)
		return
	}

	// 3. Verificar required_doc_type
	reqDocType, _ := h.NFC.GetCardRequiredDocType(r.Context(), cardUID)
	if reqDocType != nil && *reqDocType != "" && payload.DocType != *reqDocType {
		resp := map[string]interface{}{"pre_approved": false, "message": "tipo de documento incorrecto para esta tarjeta"}
		respBytes, _ := json.Marshal(resp)
		encResp, encErr := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
		if encErr != nil {
			writeError(w, 500, encErr.Error())
			return
		}
		writeJSON(w, 200, encResp)
		return
	}

	// 4. Verificar documento
	docOK, err := h.NFC.VerifyUserDocument(r.Context(), userID, payload.DocType, payload.DocNumber)
	if err != nil || !docOK {
		resp := map[string]interface{}{"pre_approved": false, "message": "documento de identidad no coincide"}
		respBytes, _ := json.Marshal(resp)
		encResp, encErr := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
		if encErr != nil {
			writeError(w, 500, encErr.Error())
			return
		}
		writeJSON(w, 200, encResp)
		return
	}

	// 5. Verificar PIN
	if err := h.NFC.VerifyCardPIN(r.Context(), cardUID, payload.PIN); err != nil {
		resp := map[string]interface{}{"pre_approved": false, "message": err.Error()}
		respBytes, _ := json.Marshal(resp)
		encResp, encErr := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
		if encErr != nil {
			writeError(w, 500, encErr.Error())
			return
		}
		writeJSON(w, 200, encResp)
		return
	}

	// 6. Llamar al driver NTAG215
	resp, err := h.NFC.NTAG215PreAuth(r.Context(), payload.TerminalID, userID, payload.Amount)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	respBytes, _ := json.Marshal(resp)
	encResp, err := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, encResp)
}

// ntag215Confirm confirma la lectura/escritura de la tarjeta NTAG215.
func (h *NFCTerminalHandler) ntag215Confirm(w http.ResponseWriter, r *http.Request) {
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

	var payload struct {
		TerminalID   string `json:"terminal_id"`
		CardUID      string `json:"card_uid"`
		ReadOK       bool   `json:"read_ok"`
		WriteOK      bool   `json:"write_ok"`
		WrittenPages int    `json:"written_pages"`
	}
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		writeError(w, 400, "invalid payload format")
		return
	}

	if payload.CardUID == "" {
		writeError(w, 400, "card_uid is required")
		return
	}

	resp, err := h.NFC.NTAG215Confirm(r.Context(), payload.TerminalID, payload.CardUID, payload.ReadOK, payload.WriteOK, payload.WrittenPages)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	respBytes, _ := json.Marshal(resp)
	encResp, err := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, encResp)
}

// ultralightCPreAuth valida username + PIN + saldo y prepara la rotación Ultralight C.
func (h *NFCTerminalHandler) ultralightCPreAuth(w http.ResponseWriter, r *http.Request) {
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

	var payload struct {
		TerminalID string `json:"terminal_id"`
		Username   string `json:"username"`
		PIN        string `json:"pin"`
		Amount     int64  `json:"amount"`
	}
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		writeError(w, 400, "invalid payload format")
		return
	}

	if payload.Username == "" || payload.PIN == "" {
		writeError(w, 400, "username and pin are required")
		return
	}

	// 1. Buscar usuario por username
	userID, err := h.NFC.LookupUserByUsername(r.Context(), payload.Username)
	if err != nil {
		resp := map[string]interface{}{"pre_approved": false, "message": err.Error()}
		respBytes, _ := json.Marshal(resp)
		encResp, encErr := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
		if encErr != nil {
			writeError(w, 500, encErr.Error())
			return
		}
		writeJSON(w, 200, encResp)
		return
	}

	// 2. Buscar tarjeta Ultralight C activa
	cardUID, err := h.NFC.FindActiveCardByType(r.Context(), userID, "ultralight_c")
	if err != nil {
		resp := map[string]interface{}{"pre_approved": false, "message": err.Error()}
		respBytes, _ := json.Marshal(resp)
		encResp, encErr := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
		if encErr != nil {
			writeError(w, 500, encErr.Error())
			return
		}
		writeJSON(w, 200, encResp)
		return
	}

	// 3. Verificar PIN
	if err := h.NFC.VerifyCardPIN(r.Context(), cardUID, payload.PIN); err != nil {
		resp := map[string]interface{}{"pre_approved": false, "message": err.Error()}
		respBytes, _ := json.Marshal(resp)
		encResp, encErr := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
		if encErr != nil {
			writeError(w, 500, encErr.Error())
			return
		}
		writeJSON(w, 200, encResp)
		return
	}

	// 4. Llamar al driver Ultralight C
	resp, err := h.NFC.UltralightCPreAuth(r.Context(), payload.TerminalID, userID, payload.Amount)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	respBytes, _ := json.Marshal(resp)
	encResp, err := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, encResp)
}

// ultralightCPreAuthWithDocument valida username + documento + PIN + saldo.
func (h *NFCTerminalHandler) ultralightCPreAuthWithDocument(w http.ResponseWriter, r *http.Request) {
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

	var payload struct {
		TerminalID string `json:"terminal_id"`
		Username   string `json:"username"`
		DocType    string `json:"doc_type"`
		DocNumber  string `json:"doc_number"`
		PIN        string `json:"pin"`
		Amount     int64  `json:"amount"`
	}
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		writeError(w, 400, "invalid payload format")
		return
	}

	if payload.Username == "" || payload.DocNumber == "" || payload.PIN == "" {
		writeError(w, 400, "username, doc_number and pin are required")
		return
	}

	// 1. Buscar usuario por username
	userID, err := h.NFC.LookupUserByUsername(r.Context(), payload.Username)
	if err != nil {
		resp := map[string]interface{}{"pre_approved": false, "message": err.Error()}
		respBytes, _ := json.Marshal(resp)
		encResp, encErr := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
		if encErr != nil {
			writeError(w, 500, encErr.Error())
			return
		}
		writeJSON(w, 200, encResp)
		return
	}

	// 2. Buscar tarjeta Ultralight C activa
	cardUID, err := h.NFC.FindActiveCardByType(r.Context(), userID, "ultralight_c")
	if err != nil {
		resp := map[string]interface{}{"pre_approved": false, "message": err.Error()}
		respBytes, _ := json.Marshal(resp)
		encResp, encErr := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
		if encErr != nil {
			writeError(w, 500, encErr.Error())
			return
		}
		writeJSON(w, 200, encResp)
		return
	}

	// 3. Verificar required_doc_type
	reqDocType, _ := h.NFC.GetCardRequiredDocType(r.Context(), cardUID)
	if reqDocType != nil && *reqDocType != "" && payload.DocType != *reqDocType {
		resp := map[string]interface{}{"pre_approved": false, "message": "tipo de documento incorrecto para esta tarjeta"}
		respBytes, _ := json.Marshal(resp)
		encResp, encErr := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
		if encErr != nil {
			writeError(w, 500, encErr.Error())
			return
		}
		writeJSON(w, 200, encResp)
		return
	}

	// 4. Verificar documento
	docOK, err := h.NFC.VerifyUserDocument(r.Context(), userID, payload.DocType, payload.DocNumber)
	if err != nil || !docOK {
		resp := map[string]interface{}{"pre_approved": false, "message": "documento de identidad no coincide"}
		respBytes, _ := json.Marshal(resp)
		encResp, encErr := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
		if encErr != nil {
			writeError(w, 500, encErr.Error())
			return
		}
		writeJSON(w, 200, encResp)
		return
	}

	// 5. Verificar PIN
	if err := h.NFC.VerifyCardPIN(r.Context(), cardUID, payload.PIN); err != nil {
		resp := map[string]interface{}{"pre_approved": false, "message": err.Error()}
		respBytes, _ := json.Marshal(resp)
		encResp, encErr := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
		if encErr != nil {
			writeError(w, 500, encErr.Error())
			return
		}
		writeJSON(w, 200, encResp)
		return
	}

	// 6. Llamar al driver Ultralight C
	resp, err := h.NFC.UltralightCPreAuth(r.Context(), payload.TerminalID, userID, payload.Amount)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	respBytes, _ := json.Marshal(resp)
	encResp, err := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, encResp)
}

// ultralightCConfirm confirma la lectura/escritura de la tarjeta Ultralight C.
func (h *NFCTerminalHandler) ultralightCConfirm(w http.ResponseWriter, r *http.Request) {
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

	var payload struct {
		TerminalID   string `json:"terminal_id"`
		CardUID      string `json:"card_uid"`
		ReadOK       bool   `json:"read_ok"`
		WriteOK      bool   `json:"write_ok"`
		WrittenPages int    `json:"written_pages"`
	}
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		writeError(w, 400, "invalid payload format")
		return
	}

	if payload.CardUID == "" {
		writeError(w, 400, "card_uid is required")
		return
	}

	resp, err := h.NFC.UltralightCConfirm(r.Context(), payload.TerminalID, payload.CardUID, payload.ReadOK, payload.WriteOK, payload.WrittenPages)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	respBytes, _ := json.Marshal(resp)
	encResp, err := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, encResp)
}
