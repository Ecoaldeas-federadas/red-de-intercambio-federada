package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"federated-credit-node/internal/accounts"
	"federated-credit-node/internal/crypto"
	"federated-credit-node/internal/ledger"
	"federated-credit-node/internal/pricing"
)

type Handler struct {
	ledger     *ledger.Ledger
	accounts   *accounts.Accounts
	pricing    *pricing.Pricing
	crypto     *crypto.KeyManager
	nodeDomain string
	Pool       *pgxpool.Pool
}

func NewHandler(l *ledger.Ledger, a *accounts.Accounts, p *pricing.Pricing, c *crypto.KeyManager, nodeDomain string, pool *pgxpool.Pool) *Handler {
	return &Handler{
		ledger:     l,
		accounts:   a,
		pricing:    p,
		crypto:     c,
		nodeDomain: nodeDomain,
		Pool:       pool,
	}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/api/health", h.health)

	r.Get("/api/accounts/{id}", h.getAccount)
	r.Get("/api/accounts/{id}/balance", h.getAccountBalance)
	r.Get("/api/accounts/{id}/history", h.getTransactionHistory)

	r.Post("/api/transfer", h.transfer)

	r.Post("/api/admission/apply", h.applyAdmission)
	r.Get("/api/admission/requests", h.listAdmissionRequests)

	r.Post("/api/calculator/internal", h.calcInternal)
	r.Post("/api/calculator/external", h.calcExternal)
	r.Post("/api/calculator/labor", h.calcLabor)
}

func (h *Handler) RegisterRoutesWithAuth(r chi.Router, am *AuthMiddleware) {
	r.Get("/api/health", h.health)

	r.Get("/api/accounts/{id}", h.getAccount)
	r.Get("/api/accounts/{id}/balance", h.getAccountBalance)
	r.Get("/api/accounts/{id}/history", h.getTransactionHistory)

	r.Post("/api/transfer", h.transfer)

	r.Post("/api/admission/apply", h.applyAdmission)
	r.Get("/api/admission/requests", h.listAdmissionRequests)
	r.With(am.RequirePermission("accounts.approve_admission")).Post("/api/admission/requests/{id}/approve", h.approveAdmission)
	r.With(am.RequirePermission("accounts.reject_admission")).Post("/api/admission/requests/{id}/reject", h.rejectAdmission)

	r.Post("/api/calculator/internal", h.calcInternal)
	r.Post("/api/calculator/external", h.calcExternal)
	r.Post("/api/calculator/labor", h.calcLabor)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func (h *Handler) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]string{"status": "ok", "node": h.nodeDomain})
}

func (h *Handler) getAccount(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, 400, "invalid account id")
		return
	}
	user, err := h.accounts.GetUser(r.Context(), id)
	if err != nil {
		writeError(w, 404, "account not found")
		return
	}
	writeJSON(w, 200, user)
}

func (h *Handler) getAccountBalance(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, 400, "invalid account id")
		return
	}
	balance, err := h.ledger.GetBalance(r.Context(), id)
	if err != nil {
		writeError(w, 500, "error getting balance")
		return
	}
	writeJSON(w, 200, map[string]int64{"balance": balance})
}

func (h *Handler) getTransactionHistory(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, 400, "invalid account id")
		return
	}
	limit := 50
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			limit = v
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil {
			offset = v
		}
	}
	txs, err := h.ledger.GetTransactionHistory(r.Context(), id, limit, offset)
	if err != nil {
		writeError(w, 500, "error getting history")
		return
	}
	writeJSON(w, 200, txs)
}

type TransferRequest struct {
	ReceiverID string `json:"receiver_id"`
	Amount     int64  `json:"amount"`
}

func (h *Handler) transfer(w http.ResponseWriter, r *http.Request) {
	var req TransferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	receiverID, err := uuid.Parse(req.ReceiverID)
	if err != nil {
		writeError(w, 400, "invalid receiver_id")
		return
	}
	if req.Amount <= 0 {
		writeError(w, 400, "amount must be positive")
		return
	}
	senderIDStr := r.Header.Get("X-User-ID")
	senderID, err := uuid.Parse(senderIDStr)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	// Calcular impuesto
	var taxAmount int64
	var taxTargetAccount *uuid.UUID
	if h.Pool != nil {
		var taxRate float64
		var isActive bool
		var minAmount int64
		var taxAcctID *uuid.UUID
		_ = h.Pool.QueryRow(r.Context(), `
			SELECT tax_rate, is_active, min_amount, tax_account_id
			FROM tax_config WHERE node_domain = $1`, h.nodeDomain).Scan(&taxRate, &isActive, &minAmount, &taxAcctID)
		if isActive && taxRate > 0 && req.Amount >= minAmount {
			taxAmount = int64(float64(req.Amount) * taxRate)
			taxTargetAccount = taxAcctID
		}
	}

	tx, err := h.ledger.InternalTransfer(r.Context(), ledger.InternalTransferParams{
		SenderID:         senderID,
		ReceiverID:       receiverID,
		Amount:           req.Amount,
		TaxAmount:        taxAmount,
		TaxTargetAccount: taxTargetAccount,
		UserSignature:    "",
		NodeSignature:    "",
	})
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	// Audit log
	if h.Pool != nil {
		details, _ := json.Marshal(map[string]interface{}{
			"amount":      req.Amount,
			"receiver_id": receiverID.String(),
			"tax_amount":  taxAmount,
		})
		h.Pool.Exec(r.Context(), `INSERT INTO audit_log (actor_id, action, target_id, details) VALUES ($1, 'transfer', $2, $3)`,
			senderID, receiverID, details)

		// Notificar al receptor
		notify := NewNotifyService(h.Pool)
		// Obtener nombre del remitente
		var senderName string
		h.Pool.QueryRow(r.Context(), `SELECT COALESCE(display_name, username) FROM users WHERE id = $1`, senderID).Scan(&senderName)
		notify.Notify(r.Context(), h.nodeDomain, receiverID, "payment_received",
			"Pago recibido",
			fmt.Sprintf("Recibiste %d %s de %s", req.Amount, "TQ", senderName),
			"/app/history",
			map[string]interface{}{"amount": req.Amount, "sender_id": senderID.String(), "sender_name": senderName})
	}

	writeJSON(w, 201, tx)
}

func (h *Handler) listMemberLevels(w http.ResponseWriter, r *http.Request) {
	levels, err := h.accounts.ListMemberLevels(r.Context(), h.nodeDomain)
	if err != nil {
		writeError(w, 500, "error listing member levels")
		return
	}
	writeJSON(w, 200, levels)
}

type ApplyAdmissionRequest struct {
	Username      string                 `json:"username"`
	DisplayName   string                 `json:"display_name"`
	ProposedLevel string                 `json:"proposed_level"`
	ContactInfo   map[string]interface{} `json:"contact_info"`
}

func (h *Handler) applyAdmission(w http.ResponseWriter, r *http.Request) {
	var req ApplyAdmissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Username == "" {
		writeError(w, 400, "username is required")
		return
	}
	level := req.ProposedLevel
	if level == "" {
		level = "new"
	}
	admissionReq, err := h.accounts.CreateAdmissionRequest(r.Context(), h.nodeDomain, req.Username, req.DisplayName, level, req.ContactInfo)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, admissionReq)
}

func (h *Handler) listAdmissionRequests(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	reqs, err := h.accounts.ListAdmissionRequests(r.Context(), h.nodeDomain, status)
	if err != nil {
		writeError(w, 500, "error listing admission requests")
		return
	}
	writeJSON(w, 200, reqs)
}

func (h *Handler) approveAdmission(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, 400, "invalid request id")
		return
	}
	reviewerIDStr := r.Header.Get("X-User-ID")
	reviewerID, err := uuid.Parse(reviewerIDStr)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}
	user, err := h.accounts.ApproveAdmissionRequest(r.Context(), id, reviewerID)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	// Audit log
	if h.Pool != nil {
		details, _ := json.Marshal(map[string]interface{}{"admission_request_id": id.String(), "new_user": user.Username})
		h.Pool.Exec(r.Context(), `INSERT INTO audit_log (actor_id, action, target_id, details) VALUES ($1, 'admission_approve', $2, $3)`,
			reviewerID, user.ID, details)
	}
	writeJSON(w, 201, user)
}

type RejectAdmissionRequest struct {
	Reason string `json:"reason"`
}

func (h *Handler) rejectAdmission(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, 400, "invalid request id")
		return
	}
	reviewerIDStr := r.Header.Get("X-User-ID")
	reviewerID, err := uuid.Parse(reviewerIDStr)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}
	var req RejectAdmissionRequest
	json.NewDecoder(r.Body).Decode(&req)
	if err := h.accounts.RejectAdmissionRequest(r.Context(), id, reviewerID, req.Reason); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	// Audit log
	if h.Pool != nil {
		details, _ := json.Marshal(map[string]interface{}{"admission_request_id": id.String(), "reason": req.Reason})
		h.Pool.Exec(r.Context(), `INSERT INTO audit_log (actor_id, action, details) VALUES ($1, 'admission_reject', $2)`,
			reviewerID, details)
	}
	writeJSON(w, 200, map[string]string{"status": "rejected"})
}

func (h *Handler) listProducts(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	origin := r.URL.Query().Get("origin")
	products, err := h.pricing.ListProducts(r.Context(), h.nodeDomain, category, origin)
	if err != nil {
		writeError(w, 500, "error listing products")
		return
	}
	writeJSON(w, 200, products)
}

func (h *Handler) getProduct(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, 400, "invalid product id")
		return
	}
	product, err := h.pricing.GetProduct(r.Context(), id)
	if err != nil {
		writeError(w, 404, "product not found")
		return
	}
	writeJSON(w, 200, product)
}

type CreateProductRequest struct {
	Name               string   `json:"name"`
	Category           string   `json:"category"`
	Origin             string   `json:"origin"`
	Unit               string   `json:"unit"`
	QuantityPerBatch   int      `json:"quantity_per_batch"`
	EnergyDirect       float64  `json:"energy_direct"`
	EnergyHuman        float64  `json:"energy_human"`
	EnergyInputs       float64  `json:"energy_inputs"`
	EnergyAmortization float64  `json:"energy_amortization"`
	PricePerUnit       float64  `json:"price_per_unit"`
	ExternalPriceUSD   *float64 `json:"external_price_usd"`
	ExternalTaxRate    float64  `json:"external_tax_rate"`
	Description        string   `json:"description"`
}

func (h *Handler) createProduct(w http.ResponseWriter, r *http.Request) {
	var req CreateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	createdByIDStr := r.Header.Get("X-User-ID")
	createdBy, _ := uuid.Parse(createdByIDStr)
	origin := req.Origin
	if origin == "" {
		origin = "internal"
	}
	product, err := h.pricing.CreateProduct(r.Context(), pricing.CreateProductParams{
		NodeDomain:         h.nodeDomain,
		Name:               req.Name,
		Category:           req.Category,
		Origin:             origin,
		Unit:               req.Unit,
		QuantityPerBatch:   req.QuantityPerBatch,
		EnergyDirect:       req.EnergyDirect,
		EnergyHuman:        req.EnergyHuman,
		EnergyInputs:       req.EnergyInputs,
		EnergyAmortization: req.EnergyAmortization,
		PricePerUnit:       req.PricePerUnit,
		ExternalPriceUSD:   req.ExternalPriceUSD,
		ExternalTaxRate:    req.ExternalTaxRate,
		Description:        req.Description,
		CreatedBy:          createdBy,
	})
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, product)
}

func (h *Handler) getTariff(w http.ResponseWriter, r *http.Request) {
	tariff, err := h.pricing.GetTariff(r.Context(), h.nodeDomain)
	if err != nil {
		writeError(w, 500, "error getting tariff")
		return
	}
	writeJSON(w, 200, tariff)
}

type CalcInternalRequest struct {
	Quantity           int     `json:"quantity"`
	EnergyDirect       float64 `json:"energy_direct"`
	HoursHuman         float64 `json:"hours_human"`
	LaborType          string  `json:"labor_type"`
	EnergyInputs       float64 `json:"energy_inputs"`
	EnergyAmortization float64 `json:"energy_amortization"`
}

func (h *Handler) calcInternal(w http.ResponseWriter, r *http.Request) {
	var req CalcInternalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.LaborType == "" {
		req.LaborType = "admin"
	}
	result, err := h.pricing.CalculateInternal(r.Context(), h.nodeDomain, pricing.CalculateInternalParams{
		Quantity:           req.Quantity,
		EnergyDirect:       req.EnergyDirect,
		HoursHuman:         req.HoursHuman,
		LaborType:          req.LaborType,
		EnergyInputs:       req.EnergyInputs,
		EnergyAmortization: req.EnergyAmortization,
	})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, result)
}

type CalcExternalRequest struct {
	ExternalPriceUSD float64 `json:"external_price_usd"`
	LogisticsPct     float64 `json:"logistics_pct"`
	ExternalTaxRate  float64 `json:"external_tax_rate"`
}

func (h *Handler) calcExternal(w http.ResponseWriter, r *http.Request) {
	var req CalcExternalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	result, err := h.pricing.CalculateExternal(r.Context(), h.nodeDomain, pricing.CalculateExternalParams{
		ExternalPriceUSD: req.ExternalPriceUSD,
		LogisticsPct:     req.LogisticsPct,
		ExternalTaxRate:  req.ExternalTaxRate,
	})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, result)
}

type CalcLaborRequest struct {
	LaborType     string `json:"labor_type"`
	HoursPerMonth int    `json:"hours_per_month"`
}

func (h *Handler) calcLabor(w http.ResponseWriter, r *http.Request) {
	var req CalcLaborRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.LaborType == "" {
		req.LaborType = "admin"
	}
	tariff, err := h.pricing.GetTariff(r.Context(), h.nodeDomain)
	if err != nil {
		writeError(w, 500, "error getting tariff")
		return
	}
	rate := tariff.RateForLaborType(req.LaborType)
	salary := tariff.MonthlySalary(req.LaborType, req.HoursPerMonth)
	writeJSON(w, 200, map[string]interface{}{
		"labor_type":      req.LaborType,
		"rate_per_hour":   rate,
		"hours_per_month": req.HoursPerMonth,
		"monthly_salary":  salary,
	})
}
