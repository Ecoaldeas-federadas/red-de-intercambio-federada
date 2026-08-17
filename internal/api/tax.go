package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TaxHandler maneja la configuracion de impuestos
type TaxHandler struct {
	Pool *pgxpool.Pool
	Auth *AuthMiddleware
}

func (h *TaxHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	r.With(am.RequireAuth).Get("/api/tax/config", h.getTaxConfig)
	r.With(am.RequirePermission("tax.manage")).Post("/api/tax/config", h.setTaxConfig)
	r.With(am.RequireAuth).Get("/api/tax/account", h.getTaxAccount)
}

func (h *TaxHandler) getTaxConfig(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	var taxRate float64
	var isActive bool
	var appliesTo string
	var minAmount int64
	var maxAmount *int64
	var updatedAt time.Time
	var taxAccountID *string

	err := h.Pool.QueryRow(r.Context(), `
		SELECT tax_rate, is_active, applies_to, min_amount, max_amount, updated_at, tax_account_id::text
		FROM tax_config WHERE node_domain = $1`, nodeDomain).Scan(
		&taxRate, &isActive, &appliesTo, &minAmount, &maxAmount, &updatedAt, &taxAccountID)
	if err != nil {
		// No hay configuracion, devolver defaults
		writeJSON(w, 200, map[string]interface{}{
			"tax_rate":    0,
			"is_active":   false,
			"applies_to":  "all",
			"min_amount":  0,
			"max_amount":  nil,
			"tax_account": nil,
			"updated_at":  "",
			"message":     "No hay configuracion de impuestos. La asamblea debe aprobar una propuesta de cambio de impuestos.",
		})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"tax_rate":    taxRate,
		"is_active":   isActive,
		"applies_to":  appliesTo,
		"min_amount":  minAmount,
		"max_amount":  maxAmount,
		"tax_account": derefStr(taxAccountID),
		"updated_at":  updatedAt,
	})
}

type SetTaxConfigRequest struct {
	TaxRate      float64 `json:"tax_rate"`
	AppliesTo    string  `json:"applies_to"`
	MinAmount    int64   `json:"min_amount"`
	MaxAmount    *int64  `json:"max_amount"`
	TaxAccountID string  `json:"tax_account_id"`
}

func (h *TaxHandler) setTaxConfig(w http.ResponseWriter, r *http.Request) {
	var req SetTaxConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}
	if req.AppliesTo == "" {
		req.AppliesTo = "all"
	}

	var taxAccountUUID *string
	if req.TaxAccountID != "" {
		taxAccountUUID = &req.TaxAccountID
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO tax_config (node_domain, tax_rate, applies_to, min_amount, max_amount, tax_account_id, is_active, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6::uuid, true, NOW())
		ON CONFLICT (node_domain) DO UPDATE SET
			tax_rate = $2, applies_to = $3, min_amount = $4, max_amount = $5,
			tax_account_id = $6::uuid, is_active = true, updated_at = NOW()`,
		nodeDomain, req.TaxRate, req.AppliesTo, req.MinAmount, req.MaxAmount, derefStr(taxAccountUUID))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"tax_rate":   req.TaxRate,
		"is_active":  true,
		"applies_to": req.AppliesTo,
		"message":    "Configuracion de impuestos actualizada",
	})
}

func (h *TaxHandler) getTaxAccount(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	var taxAccountID *string
	err := h.Pool.QueryRow(r.Context(), `
		SELECT tax_account_id::text FROM tax_config WHERE node_domain = $1`, nodeDomain).Scan(&taxAccountID)
	if err != nil || taxAccountID == nil {
		writeJSON(w, 200, map[string]interface{}{
			"tax_account": nil,
			"balance":     0,
			"message":     "No hay cuenta de impuestos configurada. La asamblea debe asignar una cuenta.",
		})
		return
	}

	// Obtener balance de la cuenta de impuestos
	var balance int64
	h.Pool.QueryRow(r.Context(), `SELECT balance FROM users WHERE id = $1::uuid`, *taxAccountID).Scan(&balance)

	writeJSON(w, 200, map[string]interface{}{
		"tax_account": *taxAccountID,
		"balance":     balance,
	})
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
