package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// BiodynamicHandler maneja el calendario biodinamico y la configuracion
// de paginas publicas por nodo.
type BiodynamicHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func (h *BiodynamicHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Calendario biodinamico
	r.Get("/api/biodynamic/calendar", h.getCalendar)
	r.With(am.RequirePermission("config.manage")).Post("/api/biodynamic/calendar", h.upsertCalendarEntry)
	r.With(am.RequirePermission("config.manage")).Delete("/api/biodynamic/calendar/{date}", h.deleteCalendarEntry)
	r.Get("/api/biodynamic/config", h.getConfig)
	r.With(am.RequirePermission("config.manage")).Post("/api/biodynamic/config", h.updateConfig)

	// Toggle de paginas publicas
	r.Get("/api/public-pages/settings", h.getPublicPageSettings)
	r.With(am.RequirePermission("config.manage")).Post("/api/public-pages/settings", h.updatePublicPageSettings)
}

// === CALENDARIO BIODINAMICO ===

func (h *BiodynamicHandler) getCalendar(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	// Obtener mes actual y siguiente
	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	endOfMonth := startOfMonth.AddDate(0, 2, -1)

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, calendar_date, day_type, constellation, is_node_day, notes
		FROM biodynamic_calendar
		WHERE node_domain = $1 AND calendar_date >= $2 AND calendar_date <= $3
		ORDER BY calendar_date`, nodeDomain, startOfMonth, endOfMonth)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"entries": []map[string]interface{}{}})
		return
	}
	defer rows.Close()

	var entries []map[string]interface{}
	for rows.Next() {
		var id, dayType, constellation, notes *string
		var isNodeDay bool
		var calDate interface{}
		if err := rows.Scan(&id, &calDate, &dayType, &constellation, &isNodeDay, &notes); err != nil {
			continue
		}
		e := map[string]interface{}{
			"id":           id,
			"date":         calDate,
			"day_type":     dayType,
			"constellation": constellation,
			"is_node_day":  isNodeDay,
			"notes":        notes,
		}
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"entries": entries})
}

func (h *BiodynamicHandler) upsertCalendarEntry(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var body struct {
		Date         string `json:"calendar_date"`
		DayType      string `json:"day_type"`
		Constellation string `json:"constellation"`
		IsNodeDay    bool   `json:"is_node_day"`
		Notes        string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if body.Date == "" || body.DayType == "" {
		writeError(w, 400, "calendar_date y day_type son requeridos")
		return
	}

	calDate, err := time.Parse("2006-01-02", body.Date)
	if err != nil {
		writeError(w, 400, "formato de fecha invalido (usar YYYY-MM-DD)")
		return
	}

	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO biodynamic_calendar (node_domain, calendar_date, day_type, constellation, is_node_day, notes)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (node_domain, calendar_date) DO UPDATE
		SET day_type = $3, constellation = $4, is_node_day = $5, notes = $6`,
		nodeDomain, calDate, body.DayType, body.Constellation, body.IsNodeDay, body.Notes)
	if err != nil {
		writeError(w, 500, "error saving biodynamic calendar entry")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *BiodynamicHandler) deleteCalendarEntry(w http.ResponseWriter, r *http.Request) {
	dateStr := chi.URLParam(r, "date")
	if dateStr == "" {
		writeError(w, 400, "date requerido")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	calDate, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		writeError(w, 400, "formato de fecha invalido")
		return
	}

	_, err = h.Pool.Exec(r.Context(), `DELETE FROM biodynamic_calendar WHERE node_domain = $1 AND calendar_date = $2`, nodeDomain, calDate)
	if err != nil {
		writeError(w, 500, "error deleting calendar entry")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *BiodynamicHandler) getConfig(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var isActive, showInPublic *bool
	var practiceNotes *string
	err := h.Pool.QueryRow(r.Context(), `
		SELECT is_active, show_in_public_page, practice_notes FROM biodynamic_config WHERE node_domain = $1`, nodeDomain).Scan(&isActive, &showInPublic, &practiceNotes)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"is_active":           false,
			"show_in_public_page": false,
			"practice_notes":      "",
		})
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"is_active":           isActive,
		"show_in_public_page": showInPublic,
		"practice_notes":      practiceNotes,
	})
}

func (h *BiodynamicHandler) updateConfig(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var body struct {
		IsActive         bool   `json:"is_active"`
		ShowInPublicPage bool   `json:"show_in_public_page"`
		PracticeNotes    string `json:"practice_notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO biodynamic_config (node_domain, is_active, show_in_public_page, practice_notes)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (node_domain) DO UPDATE
		SET is_active = $2, show_in_public_page = $3, practice_notes = $4, updated_at = NOW()`,
		nodeDomain, body.IsActive, body.ShowInPublicPage, body.PracticeNotes)
	if err != nil {
		writeError(w, 500, "error saving biodynamic config")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

// === TOGGLE DE PAGINAS PUBLICAS ===

func (h *BiodynamicHandler) getPublicPageSettings(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var adaptationsActive *bool
	err := h.Pool.QueryRow(r.Context(), `
		SELECT adaptations_page_active FROM public_page_settings WHERE node_domain = $1`, nodeDomain).Scan(&adaptationsActive)
	if err != nil {
		// Por defecto la pagina esta activa
		writeJSON(w, 200, map[string]interface{}{"adaptations_page_active": true})
		return
	}
	writeJSON(w, 200, map[string]interface{}{"adaptations_page_active": adaptationsActive})
}

func (h *BiodynamicHandler) updatePublicPageSettings(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var body struct {
		AdaptationsPageActive bool `json:"adaptations_page_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO public_page_settings (node_domain, adaptations_page_active)
		VALUES ($1, $2)
		ON CONFLICT (node_domain) DO UPDATE
		SET adaptations_page_active = $2, updated_at = NOW()`,
		nodeDomain, body.AdaptationsPageActive)
	if err != nil {
		writeError(w, 500, "error saving public page settings")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}
