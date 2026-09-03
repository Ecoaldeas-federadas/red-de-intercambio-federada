package api

import (
	"encoding/json"
	"net/http"

	"federated-credit-node/internal/db"

	"github.com/go-chi/chi/v5"
)

// ===== Traducciones de paginas publicas =====

// getPageTranslations lista todas las traducciones de una pagina.
// GET /api/site/pages/{id}/translations
func (h *SystemHandler) getPageTranslations(w http.ResponseWriter, r *http.Request) {
	pageID := chi.URLParam(r, "id")
	if pageID == "" {
		writeJSON(w, 400, map[string]string{"error": "page id required"})
		return
	}

	rows, err := h.Pool.Query(r.Context(),
		`SELECT language, title, subtitle, content, updated_at
		 FROM public_page_translations
		 WHERE page_id = $1::uuid
		 ORDER BY language`, pageID)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error querying translations"})
		return
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var lang, title, subtitle, content, updatedAt string
		if err := rows.Scan(&lang, &title, &subtitle, &content, &updatedAt); err != nil {
			continue
		}
		result = append(result, map[string]interface{}{
			"language":   lang,
			"title":      title,
			"subtitle":   subtitle,
			"content":    content,
			"updated_at": updatedAt,
		})
	}
	if result == nil {
		result = []map[string]interface{}{}
	}
	writeJSON(w, 200, result)
}

// getPageTranslation obtiene la traducción de una pagina en un idioma especifico.
// GET /api/site/pages/{id}/translations/{lang}
func (h *SystemHandler) getPageTranslation(w http.ResponseWriter, r *http.Request) {
	pageID := chi.URLParam(r, "id")
	lang := chi.URLParam(r, "lang")
	if pageID == "" || lang == "" {
		writeJSON(w, 400, map[string]string{"error": "page id and language required"})
		return
	}

	var title, subtitle, content string
	err := h.Pool.QueryRow(r.Context(),
		`SELECT COALESCE(title, ''), COALESCE(subtitle, ''), COALESCE(content, '')
		 FROM public_page_translations
		 WHERE page_id = $1::uuid AND language = $2`, pageID, lang).Scan(&title, &subtitle, &content)
	if err != nil {
		// No existe traducción: devolver contenido por defecto de public_pages
		var defTitle, defSubtitle, defContent string
		err2 := h.Pool.QueryRow(r.Context(),
			`SELECT title, COALESCE(subtitle, ''), content FROM public_pages WHERE id = $1::uuid`, pageID).
			Scan(&defTitle, &defSubtitle, &defContent)
		if err2 != nil {
			writeJSON(w, 404, map[string]string{"error": "page not found"})
			return
		}
		writeJSON(w, 200, map[string]interface{}{
			"language":   lang,
			"title":      defTitle,
			"subtitle":   defSubtitle,
			"content":    defContent,
			"is_default": true,
		})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"language":   lang,
		"title":      title,
		"subtitle":   subtitle,
		"content":    content,
		"is_default": false,
	})
}

// updatePageTranslation guarda la traducción de una pagina en un idioma.
// PUT /api/site/pages/{id}/translations/{lang}
func (h *SystemHandler) updatePageTranslation(w http.ResponseWriter, r *http.Request) {
	pageID := chi.URLParam(r, "id")
	lang := chi.URLParam(r, "lang")
	if pageID == "" || lang == "" {
		writeJSON(w, 400, map[string]string{"error": "page id and language required"})
		return
	}

	var req struct {
		Title    string `json:"title"`
		Subtitle string `json:"subtitle"`
		Content  string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	_, err := h.Pool.Exec(r.Context(),
		`INSERT INTO public_page_translations (page_id, language, title, subtitle, content, updated_at)
		 VALUES ($1::uuid, $2, $3, $4, $5, NOW())
		 ON CONFLICT (page_id, language) DO UPDATE SET
		   title = EXCLUDED.title,
		   subtitle = EXCLUDED.subtitle,
		   content = EXCLUDED.content,
		   updated_at = NOW()`,
		pageID, lang, req.Title, req.Subtitle, req.Content)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error saving translation"})
		return
	}

	writeJSON(w, 200, map[string]string{"status": "ok"})
	GenerateStaticHTMLFiles(h.Pool)
}

// ===== Traducciones de configuracion del sitio =====

// getSiteSettingsTranslation obtiene la configuracion del sitio en un idioma.
// GET /api/site/settings/{lang}
func (h *SystemHandler) getSiteSettingsTranslation(w http.ResponseWriter, r *http.Request) {
	lang := chi.URLParam(r, "lang")
	if lang == "" {
		writeJSON(w, 400, map[string]string{"error": "language required"})
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	var title, subtitle string
	err := h.Pool.QueryRow(r.Context(),
		`SELECT COALESCE(site_title, ''), COALESCE(site_subtitle, '')
		 FROM public_settings_translations
		 WHERE node_domain = $1 AND language = $2`, nodeDomain, lang).Scan(&title, &subtitle)
	if err != nil {
		// Fallback a public_settings
		var defTitle, defSubtitle string
		err2 := h.Pool.QueryRow(r.Context(),
			`SELECT site_title, COALESCE(site_subtitle, '') FROM public_settings WHERE node_domain = $1`,
			nodeDomain).Scan(&defTitle, &defSubtitle)
		if err2 != nil {
			writeJSON(w, 404, map[string]string{"error": "settings not found"})
			return
		}
		writeJSON(w, 200, map[string]interface{}{
			"language":      lang,
			"site_title":    defTitle,
			"site_subtitle": defSubtitle,
			"is_default":    true,
		})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"language":      lang,
		"site_title":    title,
		"site_subtitle": subtitle,
		"is_default":    false,
	})
}

// updateSiteSettingsTranslation guarda la configuracion del sitio en un idioma.
// PUT /api/site/settings/{lang}
func (h *SystemHandler) updateSiteSettingsTranslation(w http.ResponseWriter, r *http.Request) {
	lang := chi.URLParam(r, "lang")
	if lang == "" {
		writeJSON(w, 400, map[string]string{"error": "language required"})
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	var req struct {
		SiteTitle    string `json:"site_title"`
		SiteSubtitle string `json:"site_subtitle"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	_, err := h.Pool.Exec(r.Context(),
		`INSERT INTO public_settings_translations (node_domain, language, site_title, site_subtitle, updated_at)
		 VALUES ($1, $2, $3, $4, NOW())
		 ON CONFLICT (node_domain, language) DO UPDATE SET
		   site_title = EXCLUDED.site_title,
		   site_subtitle = EXCLUDED.site_subtitle,
		   updated_at = NOW()`,
		nodeDomain, lang, req.SiteTitle, req.SiteSubtitle)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error saving translation"})
		return
	}

	writeJSON(w, 200, map[string]string{"status": "ok"})
}

// ===== Traducciones del formulario de admision =====

// getAdmissionFormTranslation obtiene el formulario de admision en un idioma.
// GET /api/site/admission-form/{lang}
func (h *SystemHandler) getAdmissionFormTranslation(w http.ResponseWriter, r *http.Request) {
	lang := chi.URLParam(r, "lang")
	if lang == "" {
		writeJSON(w, 400, map[string]string{"error": "language required"})
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	var title, subtitle string
	var schema []byte
	err := h.Pool.QueryRow(r.Context(),
		`SELECT COALESCE(title, ''), COALESCE(subtitle, ''), schema
		 FROM admission_form_translations
		 WHERE node_domain = $1 AND language = $2`, nodeDomain, lang).Scan(&title, &subtitle, &schema)
	if err != nil {
		// Fallback a public_settings
		var defTitle, defSubtitle string
		var defSchema []byte
		err2 := h.Pool.QueryRow(r.Context(),
			`SELECT COALESCE(admission_form_title, ''), COALESCE(admission_form_subtitle, ''), admission_form_schema
			 FROM public_settings WHERE node_domain = $1`, nodeDomain).Scan(&defTitle, &defSubtitle, &defSchema)
		if err2 != nil {
			writeJSON(w, 404, map[string]string{"error": "admission form not found"})
			return
		}
		writeJSON(w, 200, map[string]interface{}{
			"language":   lang,
			"title":      defTitle,
			"subtitle":   defSubtitle,
			"schema":     json.RawMessage(defSchema),
			"is_default": true,
		})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"language":   lang,
		"title":      title,
		"subtitle":   subtitle,
		"schema":     json.RawMessage(schema),
		"is_default": false,
	})
}

// updateAdmissionFormTranslation guarda el formulario de admision en un idioma.
// PUT /api/site/admission-form/{lang}
func (h *SystemHandler) updateAdmissionFormTranslation(w http.ResponseWriter, r *http.Request) {
	lang := chi.URLParam(r, "lang")
	if lang == "" {
		writeJSON(w, 400, map[string]string{"error": "language required"})
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	var req struct {
		Title    string          `json:"title"`
		Subtitle string          `json:"subtitle"`
		Schema   json.RawMessage `json:"schema"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	_, err := h.Pool.Exec(r.Context(),
		`INSERT INTO admission_form_translations (node_domain, language, title, subtitle, schema, updated_at)
		 VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
		 ON CONFLICT (node_domain, language) DO UPDATE SET
		   title = EXCLUDED.title,
		   subtitle = EXCLUDED.subtitle,
		   schema = EXCLUDED.schema,
		   updated_at = NOW()`,
		nodeDomain, lang, req.Title, req.Subtitle, string(req.Schema))
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error saving translation"})
		return
	}

	writeJSON(w, 200, map[string]string{"status": "ok"})
}

// ===== Modificar endpoints publicos para soportar idioma =====

// getPublicPageTranslated devuelve una pagina publica en el idioma solicitado.
// GET /api/public/pages/{slug}?lang=en
func (h *SystemHandler) getPublicPageTranslated(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	lang := r.URL.Query().Get("lang")
	if lang == "" {
		lang = "es"
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	// Intentar obtener la traduccion
	var title, subtitle, content string
	err := h.Pool.QueryRow(r.Context(),
		`SELECT p.title, COALESCE(p.subtitle, ''), p.content
		 FROM public_pages p
		 JOIN public_page_translations pt ON pt.page_id = p.id
		 WHERE p.node_domain = $1 AND p.slug = $2 AND pt.language = $3 AND p.is_published = true`,
		nodeDomain, slug, lang).Scan(&title, &subtitle, &content)
	if err != nil {
		// Fallback al contenido por defecto de public_pages
		err2 := h.Pool.QueryRow(r.Context(),
			`SELECT title, COALESCE(subtitle, ''), content FROM public_pages
			 WHERE node_domain = $1 AND slug = $2 AND is_published = true`,
			nodeDomain, slug).Scan(&title, &subtitle, &content)
		if err2 != nil {
			writeJSON(w, 404, map[string]string{"error": "page not found"})
			return
		}
	}

	writeJSON(w, 200, map[string]interface{}{
		"slug":     slug,
		"title":    title,
		"subtitle": subtitle,
		"content":  content,
		"language": lang,
	})
}
