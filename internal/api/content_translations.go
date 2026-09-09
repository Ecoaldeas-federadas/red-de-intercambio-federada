package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

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
		var lang, title, subtitle, content string
		var updatedAt time.Time
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
	lang := normalizeLanguageCode(chi.URLParam(r, "lang"))
	if pageID == "" || lang == "" {
		writeJSON(w, 400, map[string]string{"error": "page id and language required"})
		return
	}

	var nodeDomain, title, subtitle, content string
	err := h.Pool.QueryRow(r.Context(),
		`SELECT node_domain, title, COALESCE(subtitle, ''), content FROM public_pages WHERE id = $1::uuid`, pageID).
		Scan(&nodeDomain, &title, &subtitle, &content)
	if err != nil {
		writeJSON(w, 404, map[string]string{"error": "page not found"})
		return
	}
	fallbackLang := defaultLanguage(r.Context(), h.Pool, nodeDomain)
	isFallback := !strings.EqualFold(lang, fallbackLang)
	if isFallback {
		keys := []string{"public_page:" + pageID + ":title", "public_page:" + pageID + ":subtitle", "public_page:" + pageID + ":content"}
		values := localizedContentValues(r.Context(), h.Pool, keys, lang)
		translatedFields := 0
		if values[keys[0]] != "" {
			title = values[keys[0]]
			translatedFields++
		}
		if values[keys[1]] != "" {
			subtitle = values[keys[1]]
			translatedFields++
		}
		if values[keys[2]] != "" {
			content = values[keys[2]]
			translatedFields++
		}
		isFallback = translatedFields < 3
	}
	writeJSON(w, 200, map[string]interface{}{
		"language": lang, "source_language": fallbackLang, "title": title,
		"subtitle": subtitle, "content": content, "is_default": isFallback,
		"is_fallback": isFallback,
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

	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	var pageNodeDomain, sourceTitle, sourceSubtitle, sourceContent string
	err := h.Pool.QueryRow(r.Context(), `
		SELECT node_domain, title, COALESCE(subtitle, ''), content
		FROM public_pages WHERE id = $1::uuid`, pageID).
		Scan(&pageNodeDomain, &sourceTitle, &sourceSubtitle, &sourceContent)
	if err != nil || pageNodeDomain != nodeDomain {
		writeJSON(w, 404, map[string]string{"error": "page not found"})
		return
	}
	lang = normalizeLanguageCode(lang)
	if strings.EqualFold(lang, defaultLanguage(r.Context(), h.Pool, nodeDomain)) {
		writeJSON(w, 400, map[string]string{"error": "edit the source language through the page editor"})
		return
	}
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeJSON(w, 401, map[string]string{"error": "authentication required"})
		return
	}
	fields := []struct {
		name, source, value string
	}{
		{"title", sourceTitle, req.Title},
		{"subtitle", sourceSubtitle, req.Subtitle},
		{"content", sourceContent, req.Content},
	}
	for _, field := range fields {
		key, sourceErr := upsertContentSource(r.Context(), h.Pool, nodeDomain, "public_page", pageID, field.name, field.source, map[string]interface{}{"editor": "page"})
		if sourceErr != nil || saveContentTranslation(r.Context(), h.Pool, key, lang, field.value, userID) != nil {
			writeJSON(w, 500, map[string]string{"error": "error saving translation"})
			return
		}
	}
	_, _ = h.Pool.Exec(r.Context(), `
		INSERT INTO public_page_translations (page_id, language, title, subtitle, content, updated_at)
		VALUES ($1::uuid, $2, $3, $4, $5, NOW())
		ON CONFLICT (page_id, language) DO UPDATE SET
		  title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
		  content = EXCLUDED.content, updated_at = NOW()`,
		pageID, lang, req.Title, req.Subtitle, req.Content)
	writeJSON(w, 200, map[string]string{"status": "ok"})
	GenerateStaticHTMLFiles(h.Pool)
}

// ===== Traducciones de configuracion del sitio =====

// getSiteSettingsTranslation obtiene la configuracion del sitio en un idioma.
// GET /api/site/settings/{lang}
func (h *SystemHandler) getSiteSettingsTranslation(w http.ResponseWriter, r *http.Request) {
	lang := normalizeLanguageCode(chi.URLParam(r, "lang"))
	if lang == "" {
		writeJSON(w, 400, map[string]string{"error": "language required"})
		return
	}
	query := r.URL.Query()
	query.Set("lang", lang)
	r.URL.RawQuery = query.Encode()
	h.getPublicSettings(w, r)
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
		SiteTitle           string `json:"site_title"`
		SiteSubtitle        string `json:"site_subtitle"`
		AnnouncementText    string `json:"announcement_text"`
		ContactAddress      string `json:"contact_address"`
		FooterAbout         string `json:"footer_about"`
		FooterSchedule      string `json:"footer_schedule"`
		FooterCol1Title     string `json:"footer_col1_title"`
		FooterCol2Title     string `json:"footer_col2_title"`
		FooterCol3Title     string `json:"footer_col3_title"`
		FooterCol4Title     string `json:"footer_col4_title"`
		FooterSlogan        string `json:"footer_slogan"`
		FooterAdmissionText string `json:"footer_admission_text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	lang = normalizeLanguageCode(lang)
	if strings.EqualFold(lang, defaultLanguage(r.Context(), h.Pool, nodeDomain)) {
		writeJSON(w, 400, map[string]string{"error": "edit the source language through site settings"})
		return
	}
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeJSON(w, 401, map[string]string{"error": "authentication required"})
		return
	}
	values := map[string]string{
		"site_title": req.SiteTitle, "site_subtitle": req.SiteSubtitle,
		"announcement_text": req.AnnouncementText, "contact_address": req.ContactAddress,
		"footer_about": req.FooterAbout, "footer_schedule": req.FooterSchedule,
		"footer_col1_title": req.FooterCol1Title, "footer_col2_title": req.FooterCol2Title,
		"footer_col3_title": req.FooterCol3Title, "footer_col4_title": req.FooterCol4Title,
		"footer_slogan": req.FooterSlogan, "footer_admission_text": req.FooterAdmissionText,
	}
	for field, value := range values {
		if value == "" && field != "site_title" && field != "site_subtitle" {
			continue
		}
		if err := saveContentTranslation(r.Context(), h.Pool, "public_settings:"+nodeDomain+":"+field, lang, value, userID); err != nil {
			writeJSON(w, 500, map[string]string{"error": "error saving translation"})
			return
		}
	}
	_, err = h.Pool.Exec(r.Context(),
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

	lang = normalizeLanguageCode(lang)
	if strings.EqualFold(lang, defaultLanguage(r.Context(), h.Pool, nodeDomain)) {
		writeJSON(w, 400, map[string]string{"error": "edit the source language through the admission form editor"})
		return
	}
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeJSON(w, 401, map[string]string{"error": "authentication required"})
		return
	}
	var sourceTitle, sourceSubtitle string
	var sourceSchema []byte
	if err := h.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(admission_form_title, ''), COALESCE(admission_form_subtitle, ''), COALESCE(admission_form_schema::text, '[]')
		FROM public_settings WHERE node_domain = $1`, nodeDomain).Scan(&sourceTitle, &sourceSubtitle, &sourceSchema); err != nil {
		writeJSON(w, 404, map[string]string{"error": "admission form not found"})
		return
	}
	fields := []struct{ name, source, value string }{
		{"title", sourceTitle, req.Title},
		{"subtitle", sourceSubtitle, req.Subtitle},
		{"schema", string(sourceSchema), string(req.Schema)},
	}
	for _, field := range fields {
		key, sourceErr := upsertContentSource(r.Context(), h.Pool, nodeDomain, "admission_form", nodeDomain, field.name, field.source, map[string]interface{}{"editor": "admission_form"})
		if sourceErr != nil || saveContentTranslation(r.Context(), h.Pool, key, lang, field.value, userID) != nil {
			writeJSON(w, 500, map[string]string{"error": "error saving translation"})
			return
		}
	}
	_, _ = h.Pool.Exec(r.Context(), `
		INSERT INTO admission_form_translations (node_domain, language, title, subtitle, schema, updated_at)
		VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
		ON CONFLICT (node_domain, language) DO UPDATE SET
		  title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
		  schema = EXCLUDED.schema, updated_at = NOW()`,
		nodeDomain, lang, req.Title, req.Subtitle, string(req.Schema))
	writeJSON(w, 200, map[string]string{"status": "ok"})
}

// ===== Modificar endpoints publicos para soportar idioma =====

// getPublicPageTranslated devuelve una pagina publica en el idioma solicitado.
// GET /api/public/pages/{slug}?lang=en
func (h *SystemHandler) getPublicPageTranslated(w http.ResponseWriter, r *http.Request) {
	h.getPublicPage(w, r)
}
