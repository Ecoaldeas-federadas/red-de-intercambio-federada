package api

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"federated-credit-node/internal/accounts"
	"federated-credit-node/internal/payments"
)

type PaymentsHandler struct {
	Payments   *payments.Payments
	NodeDomain string
	Auth       *AuthMiddleware
	Accounts   accountsService
}

type accountsService interface {
	GetUser(ctx context.Context, id uuid.UUID) (*accounts.User, error)
}

func NewPaymentsHandler(p *payments.Payments, nodeDomain string, am *AuthMiddleware, accts accountsService) *PaymentsHandler {
	return &PaymentsHandler{Payments: p, NodeDomain: nodeDomain, Auth: am, Accounts: accts}
}

func (ph *PaymentsHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	r.Group(func(r chi.Router) {
		r.Use(am.RequireAuth)
		r.Post("/api/payments/qr/generate", ph.generateQR)
		r.Post("/api/payments/qr/parse", ph.parseQR)
		r.Post("/api/payments/qr/pos", ph.posGenerateQR)
		r.Post("/api/payments/manual", ph.manualPayment)

		r.Post("/api/payments/nfc/issue", ph.issueNFCCard)
		r.Post("/api/payments/nfc/lookup", ph.lookupNFCCard)
		r.Delete("/api/payments/nfc/{cardUID}", ph.deactivateNFCCard)
		r.Get("/api/payments/nfc", ph.listNFCCards)
	})
}

type GenerateQRRequest struct {
	DisplayName string `json:"display_name"`
	Amount      *int64 `json:"amount"`
	Label       string `json:"label"`
}

func (ph *PaymentsHandler) generateQR(w http.ResponseWriter, r *http.Request) {
	var req GenerateQRRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Obtener user del contexto (auth middleware)
	userID, err := ph.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	// Obtener datos del usuario desde la BD
	user, err := ph.Accounts.GetUser(r.Context(), userID)
	if err != nil {
		writeError(w, 500, "failed to get user info")
		return
	}

	paymentReq, qrBase64, err := ph.Payments.GenerateQR(r.Context(), payments.GenerateQRParams{
		UserID:      userID,
		Username:    user.Username,
		DisplayName: req.DisplayName,
		Amount:      req.Amount,
		Label:       req.Label,
	})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"qr_data":     qrBase64,
		"payment_req": paymentReq,
	})
}

type ParseQRRequest struct {
	QRData string `json:"qr_data"`
}

func (ph *PaymentsHandler) parseQR(w http.ResponseWriter, r *http.Request) {
	var req ParseQRRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	paymentReq, err := ph.Payments.ParseQR(req.QRData)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	if err := ph.Payments.ValidatePaymentRequest(paymentReq); err != nil {
		writeError(w, 400, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"payment_req":   paymentReq,
		"is_local_node": ph.Payments.IsLocalNode(paymentReq),
	})
}

type POSGenerateQRRequest struct {
	DisplayName string `json:"display_name"`
	Amount      int64  `json:"amount"`
	Label       string `json:"label"`
}

func (ph *PaymentsHandler) posGenerateQR(w http.ResponseWriter, r *http.Request) {
	var req POSGenerateQRRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Amount <= 0 {
		writeError(w, 400, "amount must be positive for POS QR")
		return
	}

	userID, err := ph.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}
	user, err := ph.Accounts.GetUser(r.Context(), userID)
	if err != nil {
		writeError(w, 500, "failed to get user info")
		return
	}

	paymentReq, qrBase64, err := ph.Payments.GenerateQR(r.Context(), payments.GenerateQRParams{
		UserID:      userID,
		Username:    user.Username,
		DisplayName: req.DisplayName,
		Amount:      &req.Amount,
		Label:       req.Label,
	})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"qr_data":     qrBase64,
		"payment_req": paymentReq,
	})
}

type ManualPaymentRequest struct {
	ReceiverID uuid.UUID `json:"receiver_id"`
	Amount     int64     `json:"amount"`
	Reference  string    `json:"reference"`
}

func (ph *PaymentsHandler) manualPayment(w http.ResponseWriter, r *http.Request) {
	var req ManualPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Obtener sender del contexto (auth middleware)
	senderID, err := ph.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	if err := ph.Payments.ManualPayment(r.Context(), payments.ManualPaymentParams{
		SenderID:   senderID,
		ReceiverID: req.ReceiverID,
		Amount:     req.Amount,
		Reference:  req.Reference,
	}); err != nil {
		writeError(w, 400, err.Error())
		return
	}

	writeJSON(w, 200, map[string]string{"status": "validated"})
}

type IssueNFCRequest struct {
	UserID  uuid.UUID `json:"user_id"`
	CardUID string    `json:"card_uid"`
}

func (ph *PaymentsHandler) issueNFCCard(w http.ResponseWriter, r *http.Request) {
	var req IssueNFCRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	if req.CardUID == "" {
		req.CardUID = payments.GenerateCardUID(ph.NodeDomain)
	}

	card, err := ph.Payments.IssueNFCCard(r.Context(), req.UserID, req.CardUID)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, card)
}

type LookupNFCRequest struct {
	CardUID string `json:"card_uid"`
}

func (ph *PaymentsHandler) lookupNFCCard(w http.ResponseWriter, r *http.Request) {
	var req LookupNFCRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	card, err := ph.Payments.LookupNFCCard(r.Context(), req.CardUID)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	writeJSON(w, 200, card)
}

func (ph *PaymentsHandler) deactivateNFCCard(w http.ResponseWriter, r *http.Request) {
	cardUID := chi.URLParam(r, "cardUID")
	if cardUID == "" {
		writeError(w, 400, "cardUID is required")
		return
	}

	if err := ph.Payments.DeactivateNFCCard(r.Context(), cardUID); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "deactivated"})
}

func (ph *PaymentsHandler) listNFCCards(w http.ResponseWriter, r *http.Request) {
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

	cards, err := ph.Payments.ListNFCCards(r.Context(), userID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, cards)
}
