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

	// Obtener todas las configuraciones de impuestos
	rows, err := h.Pool.Query(r.Context(), `
		SELECT tax_rate, is_active, applies_to, min_amount, max_amount, updated_at, tax_account_id::text
		FROM tax_config WHERE node_domain = $1 ORDER BY applies_to`, nodeDomain)
	if err != nil || rows == nil {
		writeJSON(w, 200, map[string]interface{}{
			"tax_rate":    0,
			"is_active":   false,
			"applies_to":  "all",
			"min_amount":  0,
			"max_amount":  nil,
			"tax_account": nil,
			"updated_at":  "",
			"configs":     []interface{}{},
			"message":     "No hay configuracion de impuestos. La asamblea debe aprobar una propuesta de cambio de impuestos.",
		})
		return
	}
	defer rows.Close()

	type taxConfigEntry struct {
		TaxRate    float64   `json:"tax_rate"`
		IsActive   bool      `json:"is_active"`
		AppliesTo  string    `json:"applies_to"`
		MinAmount  int64     `json:"min_amount"`
		MaxAmount  *int64    `json:"max_amount"`
		TaxAccount *string   `json:"tax_account"`
		UpdatedAt  time.Time `json:"updated_at"`
	}
	configs := []taxConfigEntry{}
	for rows.Next() {
		var c taxConfigEntry
		var taxAccountID *string
		rows.Scan(&c.TaxRate, &c.IsActive, &c.AppliesTo, &c.MinAmount, &c.MaxAmount, &c.UpdatedAt, &taxAccountID)
		c.TaxAccount = taxAccountID
		configs = append(configs, c)
	}

	if len(configs) == 0 {
		writeJSON(w, 200, map[string]interface{}{
			"tax_rate":    0,
			"is_active":   false,
			"applies_to":  "all",
			"min_amount":  0,
			"max_amount":  nil,
			"tax_account": nil,
			"updated_at":  "",
			"configs":     []interface{}{},
			"message":     "No hay configuracion de impuestos. La asamblea debe aprobar una propuesta de cambio de impuestos.",
		})
		return
	}

	// Devolver la primera config como principal + lista completa
	first := configs[0]
	writeJSON(w, 200, map[string]interface{}{
		"tax_rate":    first.TaxRate,
		"is_active":   first.IsActive,
		"applies_to":  first.AppliesTo,
		"min_amount":  first.MinAmount,
		"max_amount":  first.MaxAmount,
		"tax_account": derefStr(first.TaxAccount),
		"updated_at":  first.UpdatedAt,
		"configs":     configs,
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

	// La cuenta de impuestos ES la cuenta de la Asamblea General
	// (Asamblea = Fondo Comunitario = Impuestos, es la misma cuenta)
	var taxAccountID *string
	err := h.Pool.QueryRow(r.Context(), `
		SELECT id::text FROM users WHERE node_domain = $1 AND username = 'asamblea' LIMIT 1`, nodeDomain).Scan(&taxAccountID)
	if err != nil || taxAccountID == nil {
		// Fallback: usar tax_config si existe
		h.Pool.QueryRow(r.Context(), `
			SELECT tax_account_id::text FROM tax_config WHERE node_domain = $1`, nodeDomain).Scan(&taxAccountID)
	}
	if taxAccountID == nil {
		writeJSON(w, 200, map[string]interface{}{
			"tax_account":      nil,
			"tax_account_name": nil,
			"balance":          0,
			"message":          "No hay cuenta de Asamblea configurada. La cuenta de la Asamblea es la misma que recibe impuestos y el Fondo Comunitario.",
		})
		return
	}

	// Obtener balance y nombre de la cuenta de la Asamblea
	var balance int64
	var username, displayName string
	h.Pool.QueryRow(r.Context(), `
		SELECT balance, COALESCE(username, ''), COALESCE(display_name, '')
		FROM users WHERE id = $1::uuid`, *taxAccountID).Scan(&balance, &username, &displayName)

	writeJSON(w, 200, map[string]interface{}{
		"tax_account":         *taxAccountID,
		"tax_account_name":    username,
		"tax_account_display": displayName,
		"balance":             balance,
		"aliases":             []string{"asamblea", "impuestos", "fondo_comunitario"},
		"message":             "La cuenta de impuestos es la Asamblea General. Se le puede transferir usando: asamblea, impuestos o fondo_comunitario.",
	})
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
