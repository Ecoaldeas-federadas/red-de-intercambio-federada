package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DepartmentalAccountingHandler maneja la contabilidad departamental.
type DepartmentalAccountingHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func (h *DepartmentalAccountingHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Cuentas departamentales
	r.Get("/api/departments/{id}/accounts", h.listAccounts)
	r.With(am.RequirePermission("config.manage")).Post("/api/departments/{id}/accounts", h.createAccount)
	r.With(am.RequirePermission("config.manage")).Delete("/api/departments/accounts/{accountId}", h.deleteAccount)

	// Transacciones departamentales
	r.Get("/api/departments/{id}/transactions", h.listTransactions)
	r.With(am.RequirePermission("ledger.write")).Post("/api/departments/{id}/transactions", h.createTransaction)
	r.With(am.RequirePermission("ledger.approve")).Post("/api/departments/transactions/{txId}/approve", h.approveTransaction)

	// Presupuestos
	r.Get("/api/departments/{id}/budgets", h.listBudgets)
	r.With(am.RequirePermission("config.manage")).Post("/api/departments/{id}/budgets", h.createBudget)
}

func (h *DepartmentalAccountingHandler) listAccounts(w http.ResponseWriter, r *http.Request) {
	deptID := chi.URLParam(r, "id")
	if deptID == "" {
		writeError(w, 400, "department id is required")
		return
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, name, account_type, balance, credit_limit, debit_limit, is_active, created_at
		FROM department_accounts WHERE department_id = $1 ORDER BY name`, deptID)
	if err != nil {
		writeError(w, 500, "error listing accounts")
		return
	}
	defer rows.Close()

	var accounts []map[string]interface{}
	for rows.Next() {
		var id, name, accountType *string
		var balance, creditLimit, debitLimit int64
		var isActive bool
		var createdAt interface{}
		if err := rows.Scan(&id, &name, &accountType, &balance, &creditLimit, &debitLimit, &isActive, &createdAt); err != nil {
			continue
		}
		accounts = append(accounts, map[string]interface{}{
			"id":            id,
			"name":          name,
			"account_type":  accountType,
			"balance":       balance,
			"credit_limit":  creditLimit,
			"debit_limit":   debitLimit,
			"is_active":     isActive,
			"created_at":    createdAt,
		})
	}
	writeJSON(w, 200, map[string]interface{}{"accounts": accounts})
}

func (h *DepartmentalAccountingHandler) createAccount(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}
	deptID := chi.URLParam(r, "id")

	var req struct {
		Name        string `json:"name"`
		AccountType string `json:"account_type"`
		CreditLimit int64  `json:"credit_limit"`
		DebitLimit  int64  `json:"debit_limit"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, 400, "name is required")
		return
	}
	if req.AccountType == "" {
		req.AccountType = "asset"
	}

	var id string
	err := h.Pool.QueryRow(r.Context(), `
		INSERT INTO department_accounts (node_domain, department_id, name, account_type, balance, credit_limit, debit_limit, is_active)
		VALUES ($1, $2, $3, $4, 0, $5, $6, true)
		RETURNING id::text`,
		nodeDomain, deptID, req.Name, req.AccountType, req.CreditLimit, req.DebitLimit).Scan(&id)
	if err != nil {
		writeError(w, 500, "error creating account: "+err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"id": id, "success": true})
}

func (h *DepartmentalAccountingHandler) deleteAccount(w http.ResponseWriter, r *http.Request) {
	accountID := chi.URLParam(r, "accountId")
	_, err := h.Pool.Exec(r.Context(), `DELETE FROM department_accounts WHERE id = $1`, accountID)
	if err != nil {
		writeError(w, 500, "error deleting account")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *DepartmentalAccountingHandler) listTransactions(w http.ResponseWriter, r *http.Request) {
	deptID := chi.URLParam(r, "id")
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 200 {
			limit = l
		}
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, account_id, tx_type, amount, description, product_ref,
			registered_by, approved_by, approved_at, requires_approval, is_approved, created_at
		FROM department_transactions
		WHERE department_id = $1
		ORDER BY created_at DESC LIMIT $2`, deptID, limit)
	if err != nil {
		writeError(w, 500, "error listing transactions")
		return
	}
	defer rows.Close()

	var txs []map[string]interface{}
	for rows.Next() {
		var id, accountID, txType, description, productRef *string
		var amount int64
		var registeredBy, approvedBy *string
		var approvedAt interface{}
		var requiresApproval, isApproved bool
		var createdAt interface{}
		if err := rows.Scan(&id, &accountID, &txType, &amount, &description, &productRef,
			&registeredBy, &approvedBy, &approvedAt, &requiresApproval, &isApproved, &createdAt); err != nil {
			continue
		}
		txs = append(txs, map[string]interface{}{
			"id":               id,
			"account_id":       accountID,
			"tx_type":          txType,
			"amount":           amount,
			"description":      description,
			"product_ref":      productRef,
			"registered_by":    registeredBy,
			"approved_by":      approvedBy,
			"approved_at":      approvedAt,
			"requires_approval": requiresApproval,
			"is_approved":      isApproved,
			"created_at":       createdAt,
		})
	}
	writeJSON(w, 200, map[string]interface{}{"transactions": txs})
}

func (h *DepartmentalAccountingHandler) createTransaction(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}
	deptID := chi.URLParam(r, "id")

	var req struct {
		AccountID        string  `json:"account_id"`
		TxType           string  `json:"tx_type"`
		Amount           int64   `json:"amount"`
		Description      string  `json:"description"`
		ProductRef       *string `json:"product_ref"`
		RequiresApproval bool    `json:"requires_approval"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.AccountID == "" {
		writeError(w, 400, "account_id is required")
		return
	}
	if req.TxType == "" {
		req.TxType = "input"
	}

	userID, _ := r.Context().Value("user_id").(string)

	var id string
	err := h.Pool.QueryRow(r.Context(), `
		INSERT INTO department_transactions (node_domain, department_id, account_id, tx_type, amount, description, product_ref, registered_by, requires_approval, is_approved)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id::text`,
		nodeDomain, deptID, req.AccountID, req.TxType, req.Amount, req.Description, req.ProductRef,
		userID, req.RequiresApproval, !req.RequiresApproval).Scan(&id)
	if err != nil {
		writeError(w, 500, "error creating transaction: "+err.Error())
		return
	}

	// Actualizar balance de la cuenta
	_, err = h.Pool.Exec(r.Context(), `
		UPDATE department_accounts SET balance = balance + $2, updated_at = NOW()
		WHERE id = $1`, req.AccountID, req.Amount)
	if err != nil {
		// No fallar si no se actualiza el balance
	}

	writeJSON(w, 200, map[string]interface{}{"id": id, "success": true})
}

func (h *DepartmentalAccountingHandler) approveTransaction(w http.ResponseWriter, r *http.Request) {
	txID := chi.URLParam(r, "txId")
	userID, _ := r.Context().Value("user_id").(string)

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE department_transactions SET is_approved = true, approved_by = $2, approved_at = NOW()
		WHERE id = $1 AND requires_approval = true AND is_approved = false`, txID, userID)
	if err != nil {
		writeError(w, 500, "error approving transaction")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *DepartmentalAccountingHandler) listBudgets(w http.ResponseWriter, r *http.Request) {
	deptID := chi.URLParam(r, "id")

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, period, period_start, period_end, income_budget, expense_budget, labor_hours_budget, status, created_at
		FROM department_budgets WHERE department_id = $1 ORDER BY period_start DESC`, deptID)
	if err != nil {
		writeError(w, 500, "error listing budgets")
		return
	}
	defer rows.Close()

	var budgets []map[string]interface{}
	for rows.Next() {
		var id, period, status *string
		var periodStart, periodEnd interface{}
		var incomeBudget, expenseBudget, laborHoursBudget int64
		var createdAt interface{}
		if err := rows.Scan(&id, &period, &periodStart, &periodEnd, &incomeBudget, &expenseBudget, &laborHoursBudget, &status, &createdAt); err != nil {
			continue
		}
		budgets = append(budgets, map[string]interface{}{
			"id":                  id,
			"period":              period,
			"period_start":        periodStart,
			"period_end":          periodEnd,
			"income_budget":       incomeBudget,
			"expense_budget":      expenseBudget,
			"labor_hours_budget":  laborHoursBudget,
			"status":              status,
			"created_at":          createdAt,
		})
	}
	writeJSON(w, 200, map[string]interface{}{"budgets": budgets})
}

func (h *DepartmentalAccountingHandler) createBudget(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}
	deptID := chi.URLParam(r, "id")

	var req struct {
		Period           string `json:"period"`
		PeriodStart      string `json:"period_start"`
		PeriodEnd        string `json:"period_end"`
		IncomeBudget     int64  `json:"income_budget"`
		ExpenseBudget    int64  `json:"expense_budget"`
		LaborHoursBudget int64  `json:"labor_hours_budget"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Period == "" {
		req.Period = "monthly"
	}
	if req.PeriodStart == "" || req.PeriodEnd == "" {
		writeError(w, 400, "period_start and period_end are required")
		return
	}

	var id string
	err := h.Pool.QueryRow(r.Context(), `
		INSERT INTO department_budgets (node_domain, department_id, period, period_start, period_end, income_budget, expense_budget, labor_hours_budget, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
		RETURNING id::text`,
		nodeDomain, deptID, req.Period, req.PeriodStart, req.PeriodEnd,
		req.IncomeBudget, req.ExpenseBudget, req.LaborHoursBudget).Scan(&id)
	if err != nil {
		writeError(w, 500, "error creating budget: "+err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"id": id, "success": true})
}
