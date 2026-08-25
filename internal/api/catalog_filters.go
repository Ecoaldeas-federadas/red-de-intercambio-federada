package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CatalogFiltersHandler maneja las reglas eticas/dietarias/culturales del catalogo.
type CatalogFiltersHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func (h *CatalogFiltersHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	r.Get("/api/catalog/rules", h.listRules)
	r.With(am.RequirePermission("config.manage")).Post("/api/catalog/rules", h.upsertRule)
	r.With(am.RequirePermission("config.manage")).Delete("/api/catalog/rules/{category}", h.deleteRule)

	r.Get("/api/catalog/labels", h.listLabels)
	r.With(am.RequirePermission("config.manage")).Post("/api/catalog/labels", h.upsertLabel)
	r.With(am.RequirePermission("config.manage")).Delete("/api/catalog/labels/{id}", h.deleteLabel)

	r.With(am.RequirePermission("config.manage")).Post("/api/catalog/products/{id}/labels", h.assignProductLabel)
	r.With(am.RequirePermission("config.manage")).Delete("/api/catalog/products/{id}/labels/{labelId}", h.removeProductLabel)
}

func (h *CatalogFiltersHandler) listRules(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, category_name, is_prohibited, requires_label, reason, label, is_active, created_at
		FROM catalog_dietary_rules WHERE node_domain = $1 ORDER BY category_name`, nodeDomain)
	if err != nil {
		writeError(w, 500, "error listing catalog rules")
		return
	}
	defer rows.Close()

	var rules []map[string]interface{}
	for rows.Next() {
		var id, category, reason, label *string
		var isProhibited, requiresLabel, isActive bool
		var createdAt interface{}
		if err := rows.Scan(&id, &category, &isProhibited, &requiresLabel, &reason, &label, &isActive, &createdAt); err != nil {
			continue
		}
		r := map[string]interface{}{
			"id":              id,
			"category_name":   category,
			"is_prohibited":   isProhibited,
			"requires_label":  requiresLabel,
			"reason":          reason,
			"label":           label,
			"is_active":       isActive,
			"created_at":      createdAt,
		}
		rules = append(rules, r)
	}
	writeJSON(w, 200, map[string]interface{}{"rules": rules})
}

func (h *CatalogFiltersHandler) upsertRule(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var req struct {
		CategoryName  string  `json:"category_name"`
		IsProhibited  bool    `json:"is_prohibited"`
		RequiresLabel bool    `json:"requires_label"`
		Reason        *string `json:"reason"`
		Label         *string `json:"label"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.CategoryName == "" {
		writeError(w, 400, "category_name is required")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO catalog_dietary_rules (node_domain, category_name, is_prohibited, requires_label, reason, label, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, true)
		ON CONFLICT (node_domain, category_name) DO UPDATE SET
			is_prohibited = $3, requires_label = $4, reason = $5, label = $6, updated_at = NOW()`,
		nodeDomain, req.CategoryName, req.IsProhibited, req.RequiresLabel, req.Reason, req.Label)
	if err != nil {
		writeError(w, 500, "error saving rule: "+err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *CatalogFiltersHandler) deleteRule(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}
	category := chi.URLParam(r, "category")
	if category == "" {
		writeError(w, 400, "category is required")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		DELETE FROM catalog_dietary_rules WHERE node_domain = $1 AND category_name = $2`,
		nodeDomain, category)
	if err != nil {
		writeError(w, 500, "error deleting rule")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *CatalogFiltersHandler) listLabels(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, name, description, color, icon, is_active
		FROM catalog_labels WHERE node_domain = $1 ORDER BY name`, nodeDomain)
	if err != nil {
		writeError(w, 500, "error listing labels")
		return
	}
	defer rows.Close()

	var labels []map[string]interface{}
	for rows.Next() {
		var id, name, description, color, icon *string
		var isActive bool
		if err := rows.Scan(&id, &name, &description, &color, &icon, &isActive); err != nil {
			continue
		}
		labels = append(labels, map[string]interface{}{
			"id":          id,
			"name":        name,
			"description": description,
			"color":       color,
			"icon":        icon,
			"is_active":   isActive,
		})
	}
	writeJSON(w, 200, map[string]interface{}{"labels": labels})
}

func (h *CatalogFiltersHandler) upsertLabel(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var req struct {
		Name        string  `json:"name"`
		Description *string `json:"description"`
		Color       *string `json:"color"`
		Icon        *string `json:"icon"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, 400, "name is required")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO catalog_labels (node_domain, name, description, color, icon, is_active)
		VALUES ($1, $2, $3, $4, $5, true)
		ON CONFLICT (node_domain, name) DO UPDATE SET
			description = $3, color = $4, icon = $5`,
		nodeDomain, req.Name, req.Description, req.Color, req.Icon)
	if err != nil {
		writeError(w, 500, "error saving label")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *CatalogFiltersHandler) deleteLabel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, 400, "id is required")
		return
	}
	_, err := h.Pool.Exec(r.Context(), `DELETE FROM catalog_labels WHERE id = $1`, id)
	if err != nil {
		writeError(w, 500, "error deleting label")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *CatalogFiltersHandler) assignProductLabel(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}
	productID := chi.URLParam(r, "id")
	labelID := chi.URLParam(r, "labelId")
	if productID == "" || labelID == "" {
		writeError(w, 400, "product id and label id are required")
		return
	}

	// Get user ID from context
	userID, _ := r.Context().Value("user_id").(string)

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO product_labels (node_domain, product_id, label_id, assigned_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (product_id, label_id) DO NOTHING`,
		nodeDomain, productID, labelID, userID)
	if err != nil {
		writeError(w, 500, "error assigning label")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *CatalogFiltersHandler) removeProductLabel(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "id")
	labelID := chi.URLParam(r, "labelId")
	if productID == "" || labelID == "" {
		writeError(w, 400, "product id and label id are required")
		return
	}
	_, err := h.Pool.Exec(r.Context(), `DELETE FROM product_labels WHERE product_id = $1 AND label_id = $2`, productID, labelID)
	if err != nil {
		writeError(w, 500, "error removing label")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}
