package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NodeProfileHandler maneja perfiles de nodo dinamicos + prohibiciones de productos
// compartidas via federation.
type NodeProfileHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func (h *NodeProfileHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Perfiles dinamicos
	r.With(am.RequireAuth).Get("/api/node/faith-profiles", h.listFaithProfiles)
	r.With(am.RequirePermission("config.manage")).Post("/api/node/faith-profiles", h.createFaithProfile)

	// Perfil actual del nodo (reemplaza endpoints legacy en system.go)
	r.With(am.RequireAuth).Get("/api/node/profile", h.getNodeProfile)
	r.With(am.RequirePermission("config.manage")).Put("/api/node/profile", h.updateNodeProfile)
	r.With(am.RequirePermission("config.manage")).Put("/api/node/profile-settings", h.updateProfileSettings)

	// Prohibiciones de productos
	r.With(am.RequireAuth).Get("/api/node/profile/prohibitions", h.listProhibitions)
	r.With(am.RequirePermission("config.manage")).Post("/api/node/profile/prohibitions", h.addProhibition)
	r.With(am.RequirePermission("config.manage")).Delete("/api/node/profile/prohibitions/{id}", h.removeProhibition)

	// Cola de aprobacion
	r.With(am.RequireAuth).Get("/api/node/profile/prohibitions/pending", h.listPendingProhibitions)
	r.With(am.RequirePermission("config.manage")).Post("/api/node/profile/prohibitions/{id}/approve", h.approvePendingProhibition)
	r.With(am.RequirePermission("config.manage")).Post("/api/node/profile/prohibitions/{id}/reject", h.rejectPendingProhibition)
}

// ===== Perfiles dinamicos =====

func (h *NodeProfileHandler) listFaithProfiles(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, name, description, category, icon, default_rules, created_by, is_official, is_shared
		FROM node_faith_profiles
		WHERE is_shared = true OR created_by = $1
		ORDER BY is_official DESC, name`, h.currentNodeDomain(r))
	if err != nil {
		writeError(w, 500, "error listing profiles")
		return
	}
	defer rows.Close()

	var profiles []map[string]interface{}
	for rows.Next() {
		var id, name, desc, category, icon, rules, createdBy string
		var isOfficial, isShared bool
		if err := rows.Scan(&id, &name, &desc, &category, &icon, &rules, &createdBy, &isOfficial, &isShared); err != nil {
			continue
		}
		profiles = append(profiles, map[string]interface{}{
			"id":            id,
			"name":          name,
			"description":   desc,
			"category":      category,
			"icon":          icon,
			"default_rules": rules,
			"created_by":    createdBy,
			"is_official":   isOfficial,
			"is_shared":     isShared,
		})
	}
	if profiles == nil {
		profiles = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"profiles": profiles})
}

func (h *NodeProfileHandler) createFaithProfile(w http.ResponseWriter, r *http.Request) {
	nodeDomain := h.currentNodeDomain(r)

	var req struct {
		ID           string `json:"id"`
		Name         string `json:"name"`
		Description  string `json:"description"`
		Category     string `json:"category"`
		Icon         string `json:"icon"`
		DefaultRules string `json:"default_rules"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.ID == "" || req.Name == "" {
		writeError(w, 400, "id and name are required")
		return
	}
	if req.Category == "" {
		req.Category = "custom"
	}
	if req.Icon == "" {
		req.Icon = "globe"
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO node_faith_profiles (id, name, description, category, icon, default_rules, created_by, is_official, is_shared)
		VALUES ($1, $2, $3, $4, $5, $6, $7, false, true)
		ON CONFLICT (id) DO UPDATE SET name = $2, description = $3, default_rules = $6, updated_at = NOW()`,
		req.ID, req.Name, req.Description, req.Category, req.Icon, req.DefaultRules, nodeDomain)
	if err != nil {
		writeError(w, 500, "error creating profile: "+err.Error())
		return
	}

	writeJSON(w, 201, map[string]interface{}{"id": req.ID, "success": true})
}

// ===== Perfil actual del nodo =====

func (h *NodeProfileHandler) getNodeProfile(w http.ResponseWriter, r *http.Request) {
	nodeDomain := h.currentNodeDomain(r)

	var profile, description string
	var autoApprove, receivePeer bool
	err := h.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(faith_profile, ''), COALESCE('', ''),
		       COALESCE(auto_approve_prohibitions, false), COALESCE(receive_peer_prohibitions, true)
		FROM node_profile_settings WHERE node_domain = $1`, nodeDomain).
		Scan(&profile, &description, &autoApprove, &receivePeer)
	if err != nil {
		// Fallback a public_settings legacy
		h.Pool.QueryRow(r.Context(), `
			SELECT COALESCE(faith_profile, ''), COALESCE(faith_description, '')
			FROM public_settings WHERE node_domain = $1`, nodeDomain).Scan(&profile, &description)
		autoApprove = false
		receivePeer = true
	}

	// Obtener info del perfil
	var name, rules string
	if profile != "" {
		h.Pool.QueryRow(r.Context(), `
			SELECT name, default_rules FROM node_faith_profiles WHERE id = $1`, profile).Scan(&name, &rules)
	}

	writeJSON(w, 200, map[string]interface{}{
		"faith_profile":             profile,
		"profile_name":              name,
		"description":               rules,
		"auto_approve_prohibitions": autoApprove,
		"receive_peer_prohibitions": receivePeer,
	})
}

func (h *NodeProfileHandler) updateNodeProfile(w http.ResponseWriter, r *http.Request) {
	nodeDomain := h.currentNodeDomain(r)

	var req struct {
		FaithProfile string `json:"faith_profile"`
		Description  string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Actualizar node_profile_settings
	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO node_profile_settings (node_domain, faith_profile)
		VALUES ($1, $2)
		ON CONFLICT (node_domain) DO UPDATE SET faith_profile = $2, updated_at = NOW()`,
		nodeDomain, req.FaithProfile)
	if err != nil {
		writeError(w, 500, "error updating profile: "+err.Error())
		return
	}

	// Tambien actualizar public_settings legacy para compatibilidad
	h.Pool.Exec(r.Context(), `
		UPDATE public_settings SET faith_profile = $2, faith_description = $3, updated_at = NOW()
		WHERE node_domain = $1`, nodeDomain, req.FaithProfile, req.Description)

	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *NodeProfileHandler) updateProfileSettings(w http.ResponseWriter, r *http.Request) {
	nodeDomain := h.currentNodeDomain(r)

	var req struct {
		AutoApproveProhibitions bool `json:"auto_approve_prohibitions"`
		ReceivePeerProhibitions bool `json:"receive_peer_prohibitions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE node_profile_settings
		SET auto_approve_prohibitions = $2, receive_peer_prohibitions = $3, updated_at = NOW()
		WHERE node_domain = $1`,
		nodeDomain, req.AutoApproveProhibitions, req.ReceivePeerProhibitions)
	if err != nil {
		writeError(w, 500, "error updating settings")
		return
	}

	writeJSON(w, 200, map[string]interface{}{"success": true})
}

// ===== Prohibiciones de productos =====

func (h *NodeProfileHandler) listProhibitions(w http.ResponseWriter, r *http.Request) {
	nodeDomain := h.currentNodeDomain(r)

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id::text, profile_id, product_name, product_category, reason,
		       reported_by, approval_status, auto_approved, created_at
		FROM profile_product_prohibitions
		WHERE node_domain = $1 AND approval_status = 'approved'
		ORDER BY created_at DESC`, nodeDomain)
	if err != nil {
		writeError(w, 500, "error listing prohibitions")
		return
	}
	defer rows.Close()

	var prohibitions []map[string]interface{}
	for rows.Next() {
		var id, profileID, productName, reportedBy, status string
		var category, reason *string
		var autoApproved bool
		var createdAt interface{}
		if err := rows.Scan(&id, &profileID, &productName, &category, &reason,
			&reportedBy, &status, &autoApproved, &createdAt); err != nil {
			continue
		}
		prohibitions = append(prohibitions, map[string]interface{}{
			"id":               id,
			"profile_id":       profileID,
			"product_name":     productName,
			"product_category": category,
			"reason":           reason,
			"reported_by":      reportedBy,
			"approval_status":  status,
			"auto_approved":    autoApproved,
			"created_at":       createdAt,
		})
	}
	if prohibitions == nil {
		prohibitions = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"prohibitions": prohibitions})
}

func (h *NodeProfileHandler) addProhibition(w http.ResponseWriter, r *http.Request) {
	nodeDomain := h.currentNodeDomain(r)
	userID, _ := r.Context().Value("user_id").(string)

	var req struct {
		ProfileID       string  `json:"profile_id"`
		ProductName     string  `json:"product_name"`
		ProductCategory *string `json:"product_category"`
		Reason          *string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.ProfileID == "" || req.ProductName == "" {
		writeError(w, 400, "profile_id and product_name are required")
		return
	}

	var id string
	err := h.Pool.QueryRow(r.Context(), `
		INSERT INTO profile_product_prohibitions
			(node_domain, profile_id, product_name, product_category, reason, reported_by, approval_status, auto_approved)
		VALUES ($1, $2, $3, $4, $5, $6, 'approved', false)
		ON CONFLICT (node_domain, profile_id, product_name)
		DO UPDATE SET approval_status = 'approved', reason = $5, updated_at = NOW()
		RETURNING id::text`,
		nodeDomain, req.ProfileID, req.ProductName, req.ProductCategory, req.Reason, nodeDomain).Scan(&id)
	if err != nil {
		writeError(w, 500, "error adding prohibition: "+err.Error())
		return
	}

	// Tambien marcar productos locales coincidentes como prohibidos
	h.markLocalProductsProhibited(r, nodeDomain, req.ProductName)

	_ = userID

	writeJSON(w, 201, map[string]interface{}{"id": id, "success": true})
}

func (h *NodeProfileHandler) removeProhibition(w http.ResponseWriter, r *http.Request) {
	nodeDomain := h.currentNodeDomain(r)
	id := chi.URLParam(r, "id")

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE profile_product_prohibitions SET approval_status = 'rejected', updated_at = NOW()
		WHERE id = $1 AND node_domain = $2`, id, nodeDomain)
	if err != nil {
		writeError(w, 500, "error removing prohibition")
		return
	}

	writeJSON(w, 200, map[string]interface{}{"success": true})
}

// ===== Cola de aprobacion =====

func (h *NodeProfileHandler) listPendingProhibitions(w http.ResponseWriter, r *http.Request) {
	nodeDomain := h.currentNodeDomain(r)

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id::text, profile_id, product_name, product_category, reason,
		       reported_by, status, received_at
		FROM profile_product_prohibition_queue
		WHERE node_domain = $1 AND status = 'pending'
		ORDER BY received_at DESC`, nodeDomain)
	if err != nil {
		writeError(w, 500, "error listing pending")
		return
	}
	defer rows.Close()

	var pending []map[string]interface{}
	for rows.Next() {
		var id, profileID, productName, reportedBy, status string
		var category, reason *string
		var receivedAt interface{}
		if err := rows.Scan(&id, &profileID, &productName, &category, &reason,
			&reportedBy, &status, &receivedAt); err != nil {
			continue
		}
		pending = append(pending, map[string]interface{}{
			"id":               id,
			"profile_id":       profileID,
			"product_name":     productName,
			"product_category": category,
			"reason":           reason,
			"reported_by":      reportedBy,
			"status":           status,
			"received_at":      receivedAt,
		})
	}
	if pending == nil {
		pending = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"pending": pending})
}

func (h *NodeProfileHandler) approvePendingProhibition(w http.ResponseWriter, r *http.Request) {
	nodeDomain := h.currentNodeDomain(r)
	userID, _ := r.Context().Value("user_id").(string)
	id := chi.URLParam(r, "id")

	// Obtener datos de la cola
	var profileID, productName string
	var category, reason *string
	var reportedBy string
	err := h.Pool.QueryRow(r.Context(), `
		SELECT profile_id, product_name, product_category, reason, reported_by
		FROM profile_product_prohibition_queue
		WHERE id = $1 AND node_domain = $2 AND status = 'pending'`,
		id, nodeDomain).Scan(&profileID, &productName, &category, &reason, &reportedBy)
	if err != nil {
		writeError(w, 404, "pending prohibition not found")
		return
	}

	// Mover a prohibiciones aprobadas
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO profile_product_prohibitions
			(node_domain, profile_id, product_name, product_category, reason, reported_by, approval_status, auto_approved)
		VALUES ($1, $2, $3, $4, $5, $6, 'approved', false)
		ON CONFLICT (node_domain, profile_id, product_name)
		DO UPDATE SET approval_status = 'approved', updated_at = NOW()`,
		nodeDomain, profileID, productName, category, reason, reportedBy)
	if err != nil {
		writeError(w, 500, "error approving prohibition")
		return
	}

	// Marcar cola como aprobada
	h.Pool.Exec(r.Context(), `
		UPDATE profile_product_prohibition_queue SET status = 'approved', reviewed_at = NOW(), reviewed_by = $3
		WHERE id = $1 AND node_domain = $2`, id, nodeDomain, userID)

	// Marcar productos locales
	h.markLocalProductsProhibited(r, nodeDomain, productName)

	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *NodeProfileHandler) rejectPendingProhibition(w http.ResponseWriter, r *http.Request) {
	nodeDomain := h.currentNodeDomain(r)
	userID, _ := r.Context().Value("user_id").(string)
	id := chi.URLParam(r, "id")

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE profile_product_prohibition_queue SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $3
		WHERE id = $1 AND node_domain = $2`, id, nodeDomain, userID)
	if err != nil {
		writeError(w, 500, "error rejecting prohibition")
		return
	}

	writeJSON(w, 200, map[string]interface{}{"success": true})
}

// ===== Helpers =====

func (h *NodeProfileHandler) currentNodeDomain(r *http.Request) string {
	d := r.Header.Get("X-Node-Domain")
	if d == "" {
		d = h.NodeDomain
	}
	return d
}

// markLocalProductsProhibited marca productos locales cuyo nombre coincide con
// la prohibicion como prohibidos en catalog_dietary_rules.
func (h *NodeProfileHandler) markLocalProductsProhibited(r *http.Request, nodeDomain, productName string) {
	// Buscar productos locales que coincidan por nombre (contains, case-insensitive)
	rows, err := h.Pool.Query(r.Context(), `
		SELECT id::text, name FROM products
		WHERE node_domain = $1 AND LOWER(name) LIKE '%' || LOWER($2) || '%'`,
		nodeDomain, productName)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var productID, name string
		if err := rows.Scan(&productID, &name); err != nil {
			continue
		}
		// Marcar como prohibido en catalog_dietary_rules usando el nombre como categoria
		h.Pool.Exec(r.Context(), `
			INSERT INTO catalog_dietary_rules (node_domain, category_name, is_prohibited, reason, is_active)
			VALUES ($1, $2, true, $3, true)
			ON CONFLICT (node_domain, category_name) DO UPDATE SET is_prohibited = true, reason = $3`,
			nodeDomain, name, "Prohibido por perfil: "+productName)
	}
}
