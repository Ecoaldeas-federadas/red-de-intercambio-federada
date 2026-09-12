package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

// ===== Traducciones de niveles de miembro =====

// getMemberLevelTranslations lista todas las traducciones de un nivel de miembro.
// GET /api/member-levels/{id}/translations
func (h *SystemHandler) getMemberLevelTranslations(w http.ResponseWriter, r *http.Request) {
	levelID := chi.URLParam(r, "id")
	if levelID == "" {
		writeJSON(w, 400, map[string]string{"error": "level id required"})
		return
	}

	rows, err := h.Pool.Query(r.Context(),
		`SELECT language, name, COALESCE(description, ''), updated_at
		 FROM member_level_translations
		 WHERE level_id = $1
		 ORDER BY language`, levelID)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error querying translations"})
		return
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var lang, name, description string
		var updatedAt time.Time
		if err := rows.Scan(&lang, &name, &description, &updatedAt); err != nil {
			continue
		}
		result = append(result, map[string]interface{}{
			"language":    lang,
			"name":        name,
			"description": description,
			"updated_at":  updatedAt,
		})
	}
	if result == nil {
		result = []map[string]interface{}{}
	}
	writeJSON(w, 200, result)
}

// getMemberLevelTranslation obtiene la traducción de un nivel en un idioma.
// GET /api/member-levels/{id}/translations/{lang}
func (h *SystemHandler) getMemberLevelTranslation(w http.ResponseWriter, r *http.Request) {
	levelID := chi.URLParam(r, "id")
	lang := chi.URLParam(r, "lang")
	if levelID == "" || lang == "" {
		writeJSON(w, 400, map[string]string{"error": "level id and language required"})
		return
	}

	var name, description string
	err := h.Pool.QueryRow(r.Context(),
		`SELECT COALESCE(name, ''), COALESCE(description, '')
		 FROM member_level_translations
		 WHERE level_id = $1 AND language = $2`, levelID, lang).Scan(&name, &description)
	if err != nil {
		var defName, defDesc string
		err2 := h.Pool.QueryRow(r.Context(),
			`SELECT name, COALESCE(description, '') FROM member_levels WHERE id = $1`, levelID).
			Scan(&defName, &defDesc)
		if err2 != nil {
			writeJSON(w, 404, map[string]string{"error": "level not found"})
			return
		}
		writeJSON(w, 200, map[string]interface{}{
			"language":    lang,
			"name":        defName,
			"description": defDesc,
			"is_default":  true,
		})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"language":    lang,
		"name":        name,
		"description": description,
		"is_default":  false,
	})
}

// updateMemberLevelTranslation guarda la traducción de un nivel en un idioma.
// PUT /api/member-levels/{id}/translations/{lang}
func (h *SystemHandler) updateMemberLevelTranslation(w http.ResponseWriter, r *http.Request) {
	levelID := chi.URLParam(r, "id")
	lang := chi.URLParam(r, "lang")
	if levelID == "" || lang == "" {
		writeJSON(w, 400, map[string]string{"error": "level id and language required"})
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	_, err := h.Pool.Exec(r.Context(),
		`INSERT INTO member_level_translations (level_id, language, name, description, updated_at)
		 VALUES ($1, $2, $3, $4, NOW())
		 ON CONFLICT (level_id, language) DO UPDATE SET
		   name = EXCLUDED.name,
		   description = EXCLUDED.description,
		   updated_at = NOW()`,
		levelID, lang, req.Name, req.Description)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error saving translation"})
		return
	}

	writeJSON(w, 200, map[string]string{"status": "ok"})
}

// ===== Traducciones de niveles de organizacion =====

// getOrgLevelTranslations lista todas las traducciones de un nivel de organizacion.
// GET /api/organization-levels/{id}/translations
func (h *SystemHandler) getOrgLevelTranslations(w http.ResponseWriter, r *http.Request) {
	levelID := chi.URLParam(r, "id")
	if levelID == "" {
		writeJSON(w, 400, map[string]string{"error": "level id required"})
		return
	}

	rows, err := h.Pool.Query(r.Context(),
		`SELECT language, name, COALESCE(description, ''), updated_at
		 FROM organization_level_translations
		 WHERE level_id = $1::uuid
		 ORDER BY language`, levelID)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error querying translations"})
		return
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var lang, name, description string
		var updatedAt time.Time
		if err := rows.Scan(&lang, &name, &description, &updatedAt); err != nil {
			continue
		}
		result = append(result, map[string]interface{}{
			"language":    lang,
			"name":        name,
			"description": description,
			"updated_at":  updatedAt,
		})
	}
	if result == nil {
		result = []map[string]interface{}{}
	}
	writeJSON(w, 200, result)
}

// getOrgLevelTranslation obtiene la traducción de un nivel de organizacion en un idioma.
// GET /api/organization-levels/{id}/translations/{lang}
func (h *SystemHandler) getOrgLevelTranslation(w http.ResponseWriter, r *http.Request) {
	levelID := chi.URLParam(r, "id")
	lang := chi.URLParam(r, "lang")
	if levelID == "" || lang == "" {
		writeJSON(w, 400, map[string]string{"error": "level id and language required"})
		return
	}

	var name, description string
	err := h.Pool.QueryRow(r.Context(),
		`SELECT COALESCE(name, ''), COALESCE(description, '')
		 FROM organization_level_translations
		 WHERE level_id = $1::uuid AND language = $2`, levelID, lang).Scan(&name, &description)
	if err != nil {
		var defName, defDesc string
		err2 := h.Pool.QueryRow(r.Context(),
			`SELECT name, COALESCE(description, '') FROM organization_levels WHERE id = $1::uuid`, levelID).
			Scan(&defName, &defDesc)
		if err2 != nil {
			writeJSON(w, 404, map[string]string{"error": "level not found"})
			return
		}
		writeJSON(w, 200, map[string]interface{}{
			"language":    lang,
			"name":        defName,
			"description": defDesc,
			"is_default":  true,
		})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"language":    lang,
		"name":        name,
		"description": description,
		"is_default":  false,
	})
}

// updateOrgLevelTranslation guarda la traducción de un nivel de organizacion en un idioma.
// PUT /api/organization-levels/{id}/translations/{lang}
func (h *SystemHandler) updateOrgLevelTranslation(w http.ResponseWriter, r *http.Request) {
	levelID := chi.URLParam(r, "id")
	lang := chi.URLParam(r, "lang")
	if levelID == "" || lang == "" {
		writeJSON(w, 400, map[string]string{"error": "level id and language required"})
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	_, err := h.Pool.Exec(r.Context(),
		`INSERT INTO organization_level_translations (level_id, language, name, description, updated_at)
		 VALUES ($1::uuid, $2, $3, $4, NOW())
		 ON CONFLICT (level_id, language) DO UPDATE SET
		   name = EXCLUDED.name,
		   description = EXCLUDED.description,
		   updated_at = NOW()`,
		levelID, lang, req.Name, req.Description)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error saving translation"})
		return
	}

	writeJSON(w, 200, map[string]string{"status": "ok"})
}
