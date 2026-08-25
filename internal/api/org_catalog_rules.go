package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// OrganizationCatalogHandler maneja las reglas de catalogo por organizacion.
// Cada organizacion puede tener sus propias reglas sobre que productos puede
// ofrecer, segun su religion/filosofia. Esto es independiente de las reglas
// del nodo (que son el limite superior).
type OrganizationCatalogHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func (h *OrganizationCatalogHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Listar reglas de una organizacion
	r.Get("/api/organizations/{id}/catalog-rules", h.listOrgRules)
	// Anadir/actualizar regla para una organizacion
	r.With(am.RequirePermission("config.manage")).Post("/api/organizations/{id}/catalog-rules", h.upsertOrgRule)
	// Eliminar regla de una organizacion
	r.With(am.RequirePermission("config.manage")).Delete("/api/organizations/{id}/catalog-rules/{category}", h.deleteOrgRule)
	// Perfil de la organizacion (religion/filosofia)
	r.Get("/api/organizations/{id}/profile", h.getOrgProfile)
	r.With(am.RequirePermission("config.manage")).Post("/api/organizations/{id}/profile", h.upsertOrgProfile)
	// Listar todas las organizaciones con sus perfiles
	r.Get("/api/organizations/profiles", h.listOrgProfiles)
}

func (h *OrganizationCatalogHandler) listOrgRules(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "id")
	if orgID == "" {
		writeError(w, 400, "id de organizacion requerido")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, category_name, is_prohibited, requires_label, reason, is_active, created_at
		FROM organization_catalog_rules
		WHERE organization_id = $1 AND node_domain = $2 AND is_active = true
		ORDER BY category_name`, orgID, nodeDomain)
	if err != nil {
		writeError(w, 500, "error listing organization catalog rules")
		return
	}
	defer rows.Close()

	var rules []map[string]interface{}
	for rows.Next() {
		var id, category, reason *string
		var isProhibited, requiresLabel, isActive bool
		var createdAt interface{}
		if err := rows.Scan(&id, &category, &isProhibited, &requiresLabel, &reason, &isActive, &createdAt); err != nil {
			continue
		}
		r := map[string]interface{}{
			"id":             id,
			"category_name":  category,
			"is_prohibited":  isProhibited,
			"requires_label": requiresLabel,
			"reason":         reason,
			"is_active":      isActive,
		}
		rules = append(rules, r)
	}
	if rules == nil {
		rules = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"rules": rules})
}

func (h *OrganizationCatalogHandler) upsertOrgRule(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "id")
	if orgID == "" {
		writeError(w, 400, "id de organizacion requerido")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var body struct {
		CategoryName  string `json:"category_name"`
		IsProhibited  bool   `json:"is_prohibited"`
		RequiresLabel bool   `json:"requires_label"`
		Reason        string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if body.CategoryName == "" {
		writeError(w, 400, "category_name es requerido")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO organization_catalog_rules (node_domain, organization_id, category_name, is_prohibited, requires_label, reason)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (organization_id, category_name) DO UPDATE
		SET is_prohibited = $4, requires_label = $5, reason = $6, updated_at = NOW()`,
		nodeDomain, orgID, body.CategoryName, body.IsProhibited, body.RequiresLabel, body.Reason)
	if err != nil {
		writeError(w, 500, "error saving organization catalog rule")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *OrganizationCatalogHandler) deleteOrgRule(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "id")
	category := chi.URLParam(r, "category")
	if orgID == "" || category == "" {
		writeError(w, 400, "id y category son requeridos")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		DELETE FROM organization_catalog_rules WHERE organization_id = $1 AND category_name = $2`,
		orgID, category)
	if err != nil {
		writeError(w, 500, "error deleting organization catalog rule")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *OrganizationCatalogHandler) getOrgProfile(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "id")
	if orgID == "" {
		writeError(w, 400, "id de organizacion requerido")
		return
	}

	var faithProfile, description *string
	var isActive bool
	err := h.Pool.QueryRow(r.Context(), `
		SELECT faith_profile, description, is_active FROM organization_profiles WHERE organization_id = $1`, orgID).Scan(&faithProfile, &description, &isActive)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"faith_profile": "",
			"description":   "",
			"is_active":     false,
		})
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"faith_profile": faithProfile,
		"description":   description,
		"is_active":     isActive,
	})
}

func (h *OrganizationCatalogHandler) upsertOrgProfile(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "id")
	if orgID == "" {
		writeError(w, 400, "id de organizacion requerido")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var body struct {
		FaithProfile string `json:"faith_profile"`
		Description  string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO organization_profiles (node_domain, organization_id, faith_profile, description)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (organization_id) DO UPDATE
		SET faith_profile = $3, description = $4, updated_at = NOW()`,
		nodeDomain, orgID, body.FaithProfile, body.Description)
	if err != nil {
		writeError(w, 500, "error saving organization profile")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *OrganizationCatalogHandler) listOrgProfiles(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT op.organization_id, u.username, u.display_name, op.faith_profile, op.description, op.is_active
		FROM organization_profiles op
		JOIN users u ON u.id = op.organization_id
		WHERE op.node_domain = $1 AND op.is_active = true
		ORDER BY u.display_name`, nodeDomain)
	if err != nil {
		writeError(w, 500, "error listing organization profiles")
		return
	}
	defer rows.Close()

	var profiles []map[string]interface{}
	for rows.Next() {
		var orgID, username, displayName, faithProfile, description *string
		var isActive bool
		if err := rows.Scan(&orgID, &username, &displayName, &faithProfile, &description, &isActive); err != nil {
			continue
		}
		p := map[string]interface{}{
			"organization_id": orgID,
			"username":        username,
			"display_name":    displayName,
			"faith_profile":   faithProfile,
			"description":     description,
			"is_active":       isActive,
		}
		profiles = append(profiles, p)
	}
	if profiles == nil {
		profiles = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"profiles": profiles})
}
