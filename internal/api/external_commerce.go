package api

import (
	"encoding/json"
	"federated-credit-node/internal/db"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ExternalCommerceHandler maneja las cuentas bancarias y operaciones
// detalladas del Comercio Exterior (DEX).
type ExternalCommerceHandler struct {
	Pool       *pgxpool.Pool
	Auth       *AuthMiddleware
	nodeDomain string
}

func NewExternalCommerceHandler(pool *pgxpool.Pool, am *AuthMiddleware, nodeDomain string) *ExternalCommerceHandler {
	return &ExternalCommerceHandler{Pool: pool, Auth: am, nodeDomain: nodeDomain}
}

func (h *ExternalCommerceHandler) RegisterRoutesWithAuth(r chi.Router, am *AuthMiddleware) {
	// Cuentas bancarias externas
	r.With(am.RequireAuth).Get("/api/external/bank-accounts", h.listBankAccounts)
	r.With(am.RequirePermission("external.manage")).Post("/api/external/bank-accounts", h.createBankAccount)
	r.With(am.RequirePermission("external.manage")).Put("/api/external/bank-accounts/{id}", h.updateBankAccount)
	r.With(am.RequirePermission("external.manage")).Delete("/api/external/bank-accounts/{id}", h.deactivateBankAccount)

	// Configuracion del DEX
	r.With(am.RequireAuth).Get("/api/external/config", h.getDEXConfig)
	r.With(am.RequirePermission("external.manage")).Put("/api/external/config", h.updateDEXConfig)

	// Compras detalladas (import)
	r.With(am.RequireAuth).Get("/api/external/purchases", h.listPurchases)
	r.With(am.RequireAuth).Post("/api/external/purchases", h.createPurchase)
	r.With(am.RequirePermission("external.approve_operation")).Post("/api/external/purchases/{id}/approve", h.approvePurchase)

	// Ventas detalladas (export)
	r.With(am.RequireAuth).Get("/api/external/sales", h.listSales)
	r.With(am.RequireAuth).Post("/api/external/sales", h.createSale)
	r.With(am.RequirePermission("external.approve_operation")).Post("/api/external/sales/{id}/approve", h.approveSale)

	// Recalculo de canasta
	r.With(am.RequireAuth).Get("/api/external/basket-recalculations", h.listBasketRecalculations)
	r.With(am.RequirePermission("external.store_fc")).Post("/api/external/basket-recalculations/{id}/approve", h.approveBasketRecalculation)

	// Resumen del DEX
	r.With(am.RequireAuth).Get("/api/external/summary", h.getSummary)
}

// ===== CUENTAS BANCARIAS =====

func (h *ExternalCommerceHandler) listBankAccounts(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, account_name, COALESCE(bank_name, ''), COALESCE(account_number, ''), currency, balance, is_cash, is_active, created_at, updated_at
		FROM external_bank_accounts WHERE node_domain = $1 AND is_active = true ORDER BY is_cash, currency, account_name`,
		nodeDomain)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()
	type BankAccount struct {
		ID            uuid.UUID `json:"id"`
		AccountName   string    `json:"account_name"`
		BankName      string    `json:"bank_name"`
		AccountNumber string    `json:"account_number"`
		Currency      string    `json:"currency"`
		Balance       float64   `json:"balance"`
		IsCash        bool      `json:"is_cash"`
		IsActive      bool      `json:"is_active"`
		CreatedAt     time.Time `json:"created_at"`
		UpdatedAt     time.Time `json:"updated_at"`
	}
	accounts := []BankAccount{}
	for rows.Next() {
		var a BankAccount
		rows.Scan(&a.ID, &a.AccountName, &a.BankName, &a.AccountNumber, &a.Currency, &a.Balance, &a.IsCash, &a.IsActive, &a.CreatedAt, &a.UpdatedAt)
		accounts = append(accounts, a)
	}
	writeJSON(w, 200, accounts)
}

type CreateBankAccountRequest struct {
	AccountName   string  `json:"account_name"`
	BankName      string  `json:"bank_name"`
	AccountNumber string  `json:"account_number"`
	Currency      string  `json:"currency"`
	Balance       float64 `json:"balance"`
	IsCash        bool    `json:"is_cash"`
}

func (h *ExternalCommerceHandler) createBankAccount(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	var req CreateBankAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.AccountName == "" {
		writeError(w, 400, "account_name is required")
		return
	}
	if req.Currency == "" {
		req.Currency = "USD"
	}
	var id uuid.UUID
	err := h.Pool.QueryRow(r.Context(), `
		INSERT INTO external_bank_accounts (node_domain, account_name, bank_name, account_number, currency, balance, is_cash, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, true)
		RETURNING id`,
		nodeDomain, req.AccountName, req.BankName, req.AccountNumber, req.Currency, req.Balance, req.IsCash).Scan(&id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, map[string]interface{}{"id": id.String(), "status": "created"})
}

func (h *ExternalCommerceHandler) updateBankAccount(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	var req CreateBankAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	_, err = h.Pool.Exec(r.Context(), `
		UPDATE external_bank_accounts SET account_name = $2, bank_name = $3, account_number = $4, currency = $5, is_cash = $6, updated_at = NOW()
		WHERE id = $1`,
		id, req.AccountName, req.BankName, req.AccountNumber, req.Currency, req.IsCash)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "updated"})
}

func (h *ExternalCommerceHandler) deactivateBankAccount(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	_, err = h.Pool.Exec(r.Context(), `UPDATE external_bank_accounts SET is_active = false, updated_at = NOW() WHERE id = $1`, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "deactivated"})
}

// ===== CONFIGURACION DEX =====

func (h *ExternalCommerceHandler) getDEXConfig(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	var orgID *uuid.UUID
	var requiresMultisig bool
	var requiredSignatures int
	var isActive bool
	err := h.Pool.QueryRow(r.Context(), `
		SELECT organization_id, requires_multisig, required_signatures, is_active
		FROM external_commerce_config WHERE node_domain = $1`, nodeDomain).Scan(&orgID, &requiresMultisig, &requiredSignatures, &isActive)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"organization_id":     nil,
			"requires_multisig":   false,
			"required_signatures": 1,
			"is_active":           false,
			"message":             "No hay configuracion de Comercio Exterior. La Asamblea debe crear la organizacion DEX.",
		})
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"organization_id":     derefUUID(orgID),
		"requires_multisig":   requiresMultisig,
		"required_signatures": requiredSignatures,
		"is_active":           isActive,
	})
}

type UpdateDEXConfigRequest struct {
	OrganizationID     string `json:"organization_id"`
	RequiresMultisig   bool   `json:"requires_multisig"`
	RequiredSignatures int    `json:"required_signatures"`
}

func (h *ExternalCommerceHandler) updateDEXConfig(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	var req UpdateDEXConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	var orgUUID *uuid.UUID
	if req.OrganizationID != "" {
		id, err := uuid.Parse(req.OrganizationID)
		if err == nil {
			orgUUID = &id
		}
	}
	if req.RequiredSignatures == 0 {
		req.RequiredSignatures = 1
	}
	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO external_commerce_config (node_domain, organization_id, requires_multisig, required_signatures, is_active)
		VALUES ($1, $2, $3, $4, true)
		ON CONFLICT (node_domain) DO UPDATE SET organization_id = $2, requires_multisig = $3, required_signatures = $4, updated_at = NOW()`,
		nodeDomain, orgUUID, req.RequiresMultisig, req.RequiredSignatures)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "updated"})
}

// ===== COMPRAS (IMPORT) =====

func (h *ExternalCommerceHandler) listPurchases(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	rows, err := h.Pool.Query(r.Context(), `
		SELECT p.id, p.product_name, p.quantity, COALESCE(p.unit, ''), p.unit_cost_external, p.currency,
		       p.total_external, p.exchange_rate_used, p.total_local_tq, p.suggested_internal_price,
		       p.purchase_date, COALESCE(p.supplier, ''), COALESCE(p.invoice_number, ''), COALESCE(p.notes, ''),
		       p.status, p.created_at, COALESCE(p.approved_at, NULL),
		       COALESCE(ba.account_name, '') AS bank_account_name
		FROM external_purchases p
		LEFT JOIN external_bank_accounts ba ON p.bank_account_id = ba.id
		WHERE p.node_domain = $1 ORDER BY p.purchase_date DESC`, nodeDomain)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()
	type Purchase struct {
		ID                     uuid.UUID  `json:"id"`
		ProductName            string     `json:"product_name"`
		Quantity               int        `json:"quantity"`
		Unit                   string     `json:"unit"`
		UnitCostExternal       float64    `json:"unit_cost_external"`
		Currency               string     `json:"currency"`
		TotalExternal          float64    `json:"total_external"`
		ExchangeRateUsed       float64    `json:"exchange_rate_used"`
		TotalLocalTQ           int64      `json:"total_local_tq"`
		SuggestedInternalPrice float64    `json:"suggested_internal_price"`
		PurchaseDate           time.Time  `json:"purchase_date"`
		Supplier               string     `json:"supplier"`
		InvoiceNumber          string     `json:"invoice_number"`
		Notes                  string     `json:"notes"`
		Status                 string     `json:"status"`
		CreatedAt              time.Time  `json:"created_at"`
		ApprovedAt             *time.Time `json:"approved_at"`
		BankAccountName        string     `json:"bank_account_name"`
	}
	purchases := []Purchase{}
	for rows.Next() {
		var p Purchase
		rows.Scan(&p.ID, &p.ProductName, &p.Quantity, &p.Unit, &p.UnitCostExternal, &p.Currency,
			&p.TotalExternal, &p.ExchangeRateUsed, &p.TotalLocalTQ, &p.SuggestedInternalPrice,
			&p.PurchaseDate, &p.Supplier, &p.InvoiceNumber, &p.Notes,
			&p.Status, &p.CreatedAt, &p.ApprovedAt, &p.BankAccountName)
		purchases = append(purchases, p)
	}
	writeJSON(w, 200, purchases)
}

type CreatePurchaseRequest struct {
	ProductName      string  `json:"product_name"`
	Quantity         int     `json:"quantity"`
	Unit             string  `json:"unit"`
	UnitCostExternal float64 `json:"unit_cost_external"`
	Currency         string  `json:"currency"`
	BankAccountID    string  `json:"bank_account_id"`
	Supplier         string  `json:"supplier"`
	InvoiceNumber    string  `json:"invoice_number"`
	Notes            string  `json:"notes"`
}

func (h *ExternalCommerceHandler) createPurchase(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	var req CreatePurchaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.ProductName == "" || req.Quantity <= 0 {
		writeError(w, 400, "product_name and quantity are required")
		return
	}
	if req.Currency == "" {
		req.Currency = "USD"
	}

	// Obtener FC actual
	var fcFactor float64
	h.Pool.QueryRow(r.Context(), `SELECT COALESCE(factor, 5.0) FROM conversion_factor WHERE node_domain = $1 ORDER BY calculated_at DESC LIMIT 1`, nodeDomain).Scan(&fcFactor)
	if fcFactor == 0 {
		fcFactor = 5.0
	}

	totalExternal := req.UnitCostExternal * float64(req.Quantity)
	totalTQ := int64(totalExternal * fcFactor)
	suggestedPrice := float64(totalTQ) / float64(req.Quantity)

	var bankUUID *uuid.UUID
	if req.BankAccountID != "" {
		id, err := uuid.Parse(req.BankAccountID)
		if err == nil {
			bankUUID = &id
		}
	}

	var id uuid.UUID
	err := h.Pool.QueryRow(r.Context(), `
		INSERT INTO external_purchases (node_domain, product_name, quantity, unit, unit_cost_external, currency, total_external, bank_account_id, exchange_rate_used, total_local_tq, suggested_internal_price, supplier, invoice_number, notes, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending')
		RETURNING id`,
		nodeDomain, req.ProductName, req.Quantity, req.Unit, req.UnitCostExternal, req.Currency,
		totalExternal, bankUUID, fcFactor, totalTQ, suggestedPrice, req.Supplier, req.InvoiceNumber, req.Notes).Scan(&id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, map[string]interface{}{
		"id":                       id.String(),
		"total_external":           totalExternal,
		"total_local_tq":           totalTQ,
		"suggested_internal_price": suggestedPrice,
		"fc_used":                  fcFactor,
		"status":                   "pending",
		"message":                  "Compra registrada. Pendiente de aprobacion.",
	})
}

func (h *ExternalCommerceHandler) approvePurchase(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)

	// Obtener la compra para actualizar el saldo bancario
	var bankAccountID *uuid.UUID
	var totalExternal float64
	var currency string
	h.Pool.QueryRow(r.Context(), `SELECT bank_account_id, total_external, currency FROM external_purchases WHERE id = $1 AND node_domain = $2`, id, nodeDomain).Scan(&bankAccountID, &totalExternal, &currency)

	// Aprobar la compra
	_, err = h.Pool.Exec(r.Context(), `UPDATE external_purchases SET status = 'completed', approved_at = NOW() WHERE id = $1`, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Descontar del saldo bancario
	if bankAccountID != nil {
		h.Pool.Exec(r.Context(), `UPDATE external_bank_accounts SET balance = balance - $2, updated_at = NOW() WHERE id = $1 AND currency = $3`,
			bankAccountID, totalExternal, currency)
	}

	writeJSON(w, 200, map[string]string{"status": "completed", "message": "Compra aprobada. Saldo bancario actualizado."})
}

// ===== VENTAS (EXPORT) =====

func (h *ExternalCommerceHandler) listSales(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	rows, err := h.Pool.Query(r.Context(), `
		SELECT s.id, s.product_name, s.quantity, COALESCE(s.unit, ''), s.unit_price_external, s.currency,
		       s.total_external, s.exchange_rate_used, s.total_local_tq,
		       s.sale_date, COALESCE(s.buyer, ''), COALESCE(s.notes, ''),
		       s.status, s.created_at, COALESCE(s.approved_at, NULL),
		       COALESCE(ba.account_name, '') AS bank_account_name
		FROM external_sales s
		LEFT JOIN external_bank_accounts ba ON s.bank_account_id = ba.id
		WHERE s.node_domain = $1 ORDER BY s.sale_date DESC`, nodeDomain)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()
	type Sale struct {
		ID                uuid.UUID  `json:"id"`
		ProductName       string     `json:"product_name"`
		Quantity          int        `json:"quantity"`
		Unit              string     `json:"unit"`
		UnitPriceExternal float64    `json:"unit_price_external"`
		Currency          string     `json:"currency"`
		TotalExternal     float64    `json:"total_external"`
		ExchangeRateUsed  float64    `json:"exchange_rate_used"`
		TotalLocalTQ      int64      `json:"total_local_tq"`
		SaleDate          time.Time  `json:"sale_date"`
		Buyer             string     `json:"buyer"`
		Notes             string     `json:"notes"`
		Status            string     `json:"status"`
		CreatedAt         time.Time  `json:"created_at"`
		ApprovedAt        *time.Time `json:"approved_at"`
		BankAccountName   string     `json:"bank_account_name"`
	}
	sales := []Sale{}
	for rows.Next() {
		var s Sale
		rows.Scan(&s.ID, &s.ProductName, &s.Quantity, &s.Unit, &s.UnitPriceExternal, &s.Currency,
			&s.TotalExternal, &s.ExchangeRateUsed, &s.TotalLocalTQ,
			&s.SaleDate, &s.Buyer, &s.Notes,
			&s.Status, &s.CreatedAt, &s.ApprovedAt, &s.BankAccountName)
		sales = append(sales, s)
	}
	writeJSON(w, 200, sales)
}

type CreateSaleRequest struct {
	ProductName       string  `json:"product_name"`
	Quantity          int     `json:"quantity"`
	Unit              string  `json:"unit"`
	UnitPriceExternal float64 `json:"unit_price_external"`
	Currency          string  `json:"currency"`
	BankAccountID     string  `json:"bank_account_id"`
	Buyer             string  `json:"buyer"`
	Notes             string  `json:"notes"`
}

func (h *ExternalCommerceHandler) createSale(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	var req CreateSaleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.ProductName == "" || req.Quantity <= 0 {
		writeError(w, 400, "product_name and quantity are required")
		return
	}
	if req.Currency == "" {
		req.Currency = "USD"
	}

	var fcFactor float64
	h.Pool.QueryRow(r.Context(), `SELECT COALESCE(factor, 5.0) FROM conversion_factor WHERE node_domain = $1 ORDER BY calculated_at DESC LIMIT 1`, nodeDomain).Scan(&fcFactor)
	if fcFactor == 0 {
		fcFactor = 5.0
	}

	totalExternal := req.UnitPriceExternal * float64(req.Quantity)
	totalTQ := int64(totalExternal * fcFactor)

	var bankUUID *uuid.UUID
	if req.BankAccountID != "" {
		id, err := uuid.Parse(req.BankAccountID)
		if err == nil {
			bankUUID = &id
		}
	}

	var id uuid.UUID
	err := h.Pool.QueryRow(r.Context(), `
		INSERT INTO external_sales (node_domain, product_name, quantity, unit, unit_price_external, currency, total_external, bank_account_id, exchange_rate_used, total_local_tq, buyer, notes, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
		RETURNING id`,
		nodeDomain, req.ProductName, req.Quantity, req.Unit, req.UnitPriceExternal, req.Currency,
		totalExternal, bankUUID, fcFactor, totalTQ, req.Buyer, req.Notes).Scan(&id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, map[string]interface{}{
		"id":             id.String(),
		"total_external": totalExternal,
		"total_local_tq": totalTQ,
		"fc_used":        fcFactor,
		"status":         "pending",
		"message":        "Venta registrada. Pendiente de aprobacion.",
	})
}

func (h *ExternalCommerceHandler) approveSale(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)

	var bankAccountID *uuid.UUID
	var totalExternal float64
	var currency string
	h.Pool.QueryRow(r.Context(), `SELECT bank_account_id, total_external, currency FROM external_sales WHERE id = $1 AND node_domain = $2`, id, nodeDomain).Scan(&bankAccountID, &totalExternal, &currency)

	_, err = h.Pool.Exec(r.Context(), `UPDATE external_sales SET status = 'completed', approved_at = NOW() WHERE id = $1`, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Sumar al saldo bancario
	if bankAccountID != nil {
		h.Pool.Exec(r.Context(), `UPDATE external_bank_accounts SET balance = balance + $2, updated_at = NOW() WHERE id = $1 AND currency = $3`,
			bankAccountID, totalExternal, currency)
	}

	writeJSON(w, 200, map[string]string{"status": "completed", "message": "Venta aprobada. Saldo bancario actualizado."})
}

// ===== RECALCULO DE CANASTA =====

func (h *ExternalCommerceHandler) listBasketRecalculations(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, calculation_date, basket_cost_external_real, currency, basket_cost_local_tq, suggested_fc, previous_fc, is_approved, COALESCE(notes, ''), created_at
		FROM external_basket_recalculation WHERE node_domain = $1 ORDER BY calculation_date DESC LIMIT 20`, nodeDomain)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()
	type Recalc struct {
		ID                     uuid.UUID `json:"id"`
		CalculationDate        time.Time `json:"calculation_date"`
		BasketCostExternalReal float64   `json:"basket_cost_external_real"`
		Currency               string    `json:"currency"`
		BasketCostLocalTQ      int64     `json:"basket_cost_local_tq"`
		SuggestedFC            float64   `json:"suggested_fc"`
		PreviousFC             *float64  `json:"previous_fc"`
		IsApproved             bool      `json:"is_approved"`
		Notes                  string    `json:"notes"`
		CreatedAt              time.Time `json:"created_at"`
	}
	recalcs := []Recalc{}
	for rows.Next() {
		var rc Recalc
		rows.Scan(&rc.ID, &rc.CalculationDate, &rc.BasketCostExternalReal, &rc.Currency, &rc.BasketCostLocalTQ, &rc.SuggestedFC, &rc.PreviousFC, &rc.IsApproved, &rc.Notes, &rc.CreatedAt)
		recalcs = append(recalcs, rc)
	}
	writeJSON(w, 200, recalcs)
}

func (h *ExternalCommerceHandler) approveBasketRecalculation(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)

	// Obtener el FC sugerido
	var suggestedFC float64
	var currency string
	var basketExternal float64
	var basketLocal int64
	h.Pool.QueryRow(r.Context(), `SELECT suggested_fc, currency, basket_cost_external_real, basket_cost_local_tq FROM external_basket_recalculation WHERE id = $1 AND node_domain = $2`, id, nodeDomain).Scan(&suggestedFC, &currency, &basketExternal, &basketLocal)

	// Marcar como aprobado
	_, err = h.Pool.Exec(r.Context(), `UPDATE external_basket_recalculation SET is_approved = true WHERE id = $1`, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Guardar el nuevo FC
	if suggestedFC > 0 {
		h.Pool.Exec(r.Context(), `
			INSERT INTO conversion_factor (node_domain, factor, external_currency, basket_cost_external, basket_cost_local_tq, approved_by)
			VALUES ($1, $2, $3, $4, $5, ARRAY[]::uuid[])`,
			nodeDomain, suggestedFC, currency, basketExternal, basketLocal)
	}

	writeJSON(w, 200, map[string]interface{}{
		"status":   "approved",
		"new_fc":   suggestedFC,
		"currency": currency,
		"message":  "Recalculo de canasta aprobado. FC actualizado.",
	})
}

// ===== RESUMEN DEX =====

func (h *ExternalCommerceHandler) getSummary(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)

	// Saldo TQ de la organizacion DEX
	var dexBalance int64
	var dexOrgID *uuid.UUID
	h.Pool.QueryRow(r.Context(), `
		SELECT u.balance, u.id FROM users u
		JOIN external_commerce_config c ON u.id = c.organization_id
		WHERE c.node_domain = $1`, nodeDomain).Scan(&dexBalance, &dexOrgID)

	// Saldo total por moneda
	type CurrencyBalance struct {
		Currency string  `json:"currency"`
		Balance  float64 `json:"balance"`
		Accounts int     `json:"accounts"`
	}
	rows, _ := h.Pool.Query(r.Context(), `
		SELECT currency, SUM(balance), COUNT(*) FROM external_bank_accounts WHERE node_domain = $1 AND is_active = true GROUP BY currency`, nodeDomain)
	balances := []CurrencyBalance{}
	if rows != nil {
		for rows.Next() {
			var cb CurrencyBalance
			rows.Scan(&cb.Currency, &cb.Balance, &cb.Accounts)
			balances = append(balances, cb)
		}
		rows.Close()
	}

	// Conteo de compras y ventas
	var pendingPurchases, completedPurchases int
	h.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM external_purchases WHERE node_domain = $1 AND status = 'pending'`, nodeDomain).Scan(&pendingPurchases)
	h.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM external_purchases WHERE node_domain = $1 AND status = 'completed'`, nodeDomain).Scan(&completedPurchases)

	var pendingSales, completedSales int
	h.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM external_sales WHERE node_domain = $1 AND status = 'pending'`, nodeDomain).Scan(&pendingSales)
	h.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM external_sales WHERE node_domain = $1 AND status = 'completed'`, nodeDomain).Scan(&completedSales)

	// FC actual
	var fcFactor float64
	var fcCurrency string
	h.Pool.QueryRow(r.Context(), `SELECT COALESCE(factor, 5.0), COALESCE(external_currency, 'USD') FROM conversion_factor WHERE node_domain = $1 ORDER BY calculated_at DESC LIMIT 1`, nodeDomain).Scan(&fcFactor, &fcCurrency)

	writeJSON(w, 200, map[string]interface{}{
		"dex_org_id":          derefUUID(dexOrgID),
		"dex_balance_tq":      dexBalance,
		"bank_balances":       balances,
		"pending_purchases":   pendingPurchases,
		"completed_purchases": completedPurchases,
		"pending_sales":       pendingSales,
		"completed_sales":     completedSales,
		"current_fc":          fcFactor,
		"fc_currency":         fcCurrency,
	})
}
