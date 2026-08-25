package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"federated-credit-node/internal/db"
)

// PresetsHandler maneja los endpoints de preconfiguraciones de nodo.
type PresetsHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func (h *PresetsHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	r.Get("/api/presets", h.listPresets)
	r.Get("/api/presets/{id}", h.getPreset)
	// Aplicar preset durante setup o por admin
	r.With(am.RequirePermission("config.manage")).Post("/api/node/apply-preset", h.applyPreset)
	// Endpoint publico para setup (sin auth, pero solo funciona si el nodo no esta inicializado)
	r.Post("/api/setup/apply-preset", h.applyPresetSetup)
}

func (h *PresetsHandler) listPresets(w http.ResponseWriter, r *http.Request) {
	presets, err := db.ListPresets(r.Context(), h.Pool)
	if err != nil {
		writeError(w, 500, "error listing presets")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"presets": presets})
}

func (h *PresetsHandler) getPreset(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	preset, err := db.GetPreset(r.Context(), h.Pool, id)
	if err != nil {
		writeError(w, 404, "preset not found")
		return
	}
	writeJSON(w, 200, preset)
}

func (h *PresetsHandler) applyPreset(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var req struct {
		PresetID string `json:"preset_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.PresetID == "" {
		writeError(w, 400, "preset_id is required")
		return
	}

	if err := db.ApplyPreset(r.Context(), h.Pool, nodeDomain, req.PresetID); err != nil {
		writeError(w, 500, "error applying preset: "+err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *PresetsHandler) applyPresetSetup(w http.ResponseWriter, r *http.Request) {
	// Solo funciona si el nodo no esta inicializado (no hay admin)
	var hasAdmin bool
	err := h.Pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM users WHERE is_admin = true)`).Scan(&hasAdmin)
	if err != nil {
		writeError(w, 500, "error checking setup status")
		return
	}
	if hasAdmin {
		writeError(w, 403, "node already initialized - use admin endpoint")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var req struct {
		PresetID string `json:"preset_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.PresetID == "" || req.PresetID == "vacio" {
		writeJSON(w, 200, map[string]interface{}{"success": true, "skipped": true})
		return
	}

	if err := db.ApplyPreset(r.Context(), h.Pool, nodeDomain, req.PresetID); err != nil {
		writeError(w, 500, "error applying preset: "+err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"success": true})
}
