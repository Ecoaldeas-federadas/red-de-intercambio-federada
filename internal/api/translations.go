package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TranslationHandler maneja los endpoints de traducciones.
type TranslationHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
	// LocaleDir es el directorio donde estan los JSON defaults (web/src/locales)
	// En produccion (Docker) es /app/web/src/locales
	// En desarrollo es ./web/src/locales
	LocaleDir string
}

func NewTranslationHandler(pool *pgxpool.Pool, nodeDomain string) *TranslationHandler {
	localeDir := "/app/web/src/locales"
	if _, err := os.Stat(localeDir); err != nil {
		localeDir = "./web/src/locales"
	}
	return &TranslationHandler{
		Pool:       pool,
		NodeDomain: nodeDomain,
		LocaleDir:  localeDir,
	}
}

func (th *TranslationHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Rutas publicas (sin auth) para cargar traducciones
	r.Get("/api/translations/{lang}/{namespace}", th.getTranslations)
	r.Get("/api/translations/{lang}", th.getAllTranslations)
	r.Get("/api/languages", th.listLanguages)

	// Rutas autenticadas
	r.Group(func(r chi.Router) {
		r.Use(am.RequireAuth)

		// Editor de traducciones
		r.Get("/api/translations/missing/{lang}", th.getMissingTranslations)
		r.Get("/api/translations/{lang}/status", th.getTranslationStatus)

		// Editar traducciones (requiere translations.edit)
		r.Group(func(r chi.Router) {
			r.Use(am.RequirePermission("translations.edit"))
			r.Put("/api/translations/{lang}/{namespace}", th.updateTranslations)
		})

		// Gestionar idiomas y subir/descargar (requiere translations.manage)
		r.Group(func(r chi.Router) {
			r.Use(am.RequirePermission("translations.manage"))
			r.Post("/api/languages", th.createLanguage)
			r.Put("/api/languages/{code}", th.updateLanguage)
			r.Delete("/api/languages/{code}", th.deleteLanguage)
			r.Post("/api/translations/upload", th.uploadTranslations)
			r.Get("/api/translations/{lang}/download", th.downloadTranslations)
		})
	})
}

// getTranslations devuelve el merge de JSON defaults + DB overrides para un namespace.
// GET /api/translations/{lang}/{namespace}
func (th *TranslationHandler) getTranslations(w http.ResponseWriter, r *http.Request) {
	lang := chi.URLParam(r, "lang")
	ns := chi.URLParam(r, "namespace")
	if lang == "" || ns == "" {
		writeJSON(w, 400, map[string]string{"error": "lang and namespace required"})
		return
	}

	// 1. Cargar JSON default
	result := th.loadJSONDefaults(lang, ns)

	// 2. Aplicar overrides de la BD
	overrides := th.loadDBOverrides(r, lang, ns)
	for k, v := range overrides {
		result[k] = v
	}

	writeJSON(w, 200, result)
}

// getAllTranslations devuelve todos los namespaces mergeados.
// GET /api/translations/{lang}
func (th *TranslationHandler) getAllTranslations(w http.ResponseWriter, r *http.Request) {
	lang := chi.URLParam(r, "lang")
	if lang == "" {
		writeJSON(w, 400, map[string]string{"error": "lang required"})
		return
	}

	namespaces := []string{
		"common", "dashboard", "transfer", "nfc", "federation", "assembly",
		"organizations", "products", "settings", "profile", "notifications",
		"external", "services", "website", "public", "errors", "audit",
		"satellite", "translations",
	}

	result := map[string]map[string]string{}
	for _, ns := range namespaces {
		merged := th.loadJSONDefaults(lang, ns)
		overrides := th.loadDBOverrides(r, lang, ns)
		for k, v := range overrides {
			merged[k] = v
		}
		result[ns] = merged
	}

	writeJSON(w, 200, result)
}

// listLanguages devuelve los idiomas habilitados.
// GET /api/languages
func (th *TranslationHandler) listLanguages(w http.ResponseWriter, r *http.Request) {
	rows, err := th.Pool.Query(r.Context(),
		`SELECT code, name, native_name, enabled, is_default FROM languages ORDER BY is_default DESC, code`)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error querying languages"})
		return
	}
	defer rows.Close()

	type Lang struct {
		Code       string `json:"code"`
		Name       string `json:"name"`
		NativeName string `json:"native_name"`
		Enabled    bool   `json:"enabled"`
		IsDefault  bool   `json:"is_default"`
	}

	var langs []Lang
	for rows.Next() {
		var l Lang
		if err := rows.Scan(&l.Code, &l.Name, &l.NativeName, &l.Enabled, &l.IsDefault); err != nil {
			writeJSON(w, 500, map[string]string{"error": "error scanning language"})
			return
		}
		langs = append(langs, l)
	}
	if langs == nil {
		langs = []Lang{}
	}
	writeJSON(w, 200, langs)
}

// createLanguage crea un nuevo idioma.
// POST /api/languages (requiere translations.manage)
func (th *TranslationHandler) createLanguage(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code       string `json:"code"`
		Name       string `json:"name"`
		NativeName string `json:"native_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if req.Code == "" || len(req.Code) > 10 {
		writeJSON(w, 400, map[string]string{"error": "code is required and max 10 chars"})
		return
	}
	if req.Name == "" {
		writeJSON(w, 400, map[string]string{"error": "name is required"})
		return
	}
	if req.NativeName == "" {
		req.NativeName = req.Name
	}

	_, err := th.Pool.Exec(r.Context(),
		`INSERT INTO languages (code, name, native_name, enabled, is_default) VALUES ($1, $2, $3, true, false)
		 ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, native_name = EXCLUDED.native_name, enabled = true`,
		req.Code, req.Name, req.NativeName)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error creating language"})
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"code":        req.Code,
		"name":        req.Name,
		"native_name": req.NativeName,
		"enabled":     true,
		"is_default":  false,
	})
}

// updateLanguage habilita/deshabilita un idioma.
// PUT /api/languages/{code} (requiere translations.manage)
func (th *TranslationHandler) updateLanguage(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if code == "" {
		writeJSON(w, 400, map[string]string{"error": "code required"})
		return
	}

	var req struct {
		Enabled   *bool `json:"enabled"`
		IsDefault *bool `json:"is_default"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	if req.Enabled != nil {
		_, err := th.Pool.Exec(r.Context(), `UPDATE languages SET enabled = $1 WHERE code = $2`, *req.Enabled, code)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": "error updating language"})
			return
		}
	}

	if req.IsDefault != nil && *req.IsDefault {
		// Quitar is_default de todos los demas
		_, _ = th.Pool.Exec(r.Context(), `UPDATE languages SET is_default = false`)
		_, err := th.Pool.Exec(r.Context(), `UPDATE languages SET is_default = true, enabled = true WHERE code = $1`, code)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": "error setting default language"})
			return
		}
		// Actualizar node_config
		_, _ = th.Pool.Exec(r.Context(), `UPDATE node_config SET default_language = $1`, code)
	}

	writeJSON(w, 200, map[string]string{"status": "ok"})
}

// deleteLanguage deshabilita un idioma (no borra fisicamente).
// DELETE /api/languages/{code} (requiere translations.manage)
func (th *TranslationHandler) deleteLanguage(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if code == "" {
		writeJSON(w, 400, map[string]string{"error": "code required"})
		return
	}

	// No permitir deshabilitar el idioma default
	var isDefault bool
	_ = th.Pool.QueryRow(r.Context(), `SELECT is_default FROM languages WHERE code = $1`, code).Scan(&isDefault)
	if isDefault {
		writeJSON(w, 400, map[string]string{"error": "cannot delete default language"})
		return
	}

	_, err := th.Pool.Exec(r.Context(), `UPDATE languages SET enabled = false WHERE code = $1`, code)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error disabling language"})
		return
	}

	writeJSON(w, 200, map[string]string{"status": "disabled"})
}

// updateTranslations actualiza traducciones desde el editor web.
// PUT /api/translations/{lang}/{namespace} (requiere translations.edit)
func (th *TranslationHandler) updateTranslations(w http.ResponseWriter, r *http.Request) {
	lang := chi.URLParam(r, "lang")
	ns := chi.URLParam(r, "namespace")
	if lang == "" || ns == "" {
		writeJSON(w, 400, map[string]string{"error": "lang and namespace required"})
		return
	}

	var req map[string]string
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	userID, _ := getUserID(r)
	actualDomain := th.NodeDomain

	updated := 0
	for key, value := range req {
		_, err := th.Pool.Exec(r.Context(), `
			INSERT INTO translations (key, namespace, language, value, node_domain, updated_by)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (key, namespace, language, node_domain) DO UPDATE SET
				value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
			key, ns, lang, value, actualDomain, userID)
		if err != nil {
			continue
		}
		updated++
	}

	writeJSON(w, 200, map[string]interface{}{"updated": updated})
}

// uploadTranslations sube un archivo JSON de traducciones.
// POST /api/translations/upload (requiere translations.manage)
func (th *TranslationHandler) uploadTranslations(w http.ResponseWriter, r *http.Request) {
	// Limitar a 10MB
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeJSON(w, 400, map[string]string{"error": "error parsing form"})
		return
	}

	lang := r.FormValue("language")
	ns := r.FormValue("namespace")
	if lang == "" {
		writeJSON(w, 400, map[string]string{"error": "language is required"})
		return
	}
	if ns == "" {
		ns = "common"
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "file is required"})
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "error reading file"})
		return
	}

	var translations map[string]string
	if err := json.Unmarshal(data, &translations); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid JSON format"})
		return
	}

	userID, _ := getUserID(r)
	actualDomain := th.NodeDomain

	inserted := 0
	for key, value := range translations {
		_, err := th.Pool.Exec(r.Context(), `
			INSERT INTO translations (key, namespace, language, value, node_domain, updated_by)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (key, namespace, language, node_domain) DO UPDATE SET
				value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
			key, ns, lang, value, actualDomain, userID)
		if err != nil {
			continue
		}
		inserted++
	}

	writeJSON(w, 200, map[string]interface{}{
		"inserted":  inserted,
		"language":  lang,
		"namespace": ns,
	})
}

// downloadTranslations descarga un JSON con el merge de defaults + overrides.
// GET /api/translations/{lang}/download (requiere translations.manage)
func (th *TranslationHandler) downloadTranslations(w http.ResponseWriter, r *http.Request) {
	lang := chi.URLParam(r, "lang")
	if lang == "" {
		writeJSON(w, 400, map[string]string{"error": "lang required"})
		return
	}

	ns := r.URL.Query().Get("namespace")
	if ns == "" {
		ns = "common"
	}

	result := th.loadJSONDefaults(lang, ns)
	overrides := th.loadDBOverrides(r, lang, ns)
	for k, v := range overrides {
		result[k] = v
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s_%s.json", lang, ns))
	json.NewEncoder(w).Encode(result)
}

// getTranslationStatus devuelve el % de completitud por namespace.
// GET /api/translations/{lang}/status
func (th *TranslationHandler) getTranslationStatus(w http.ResponseWriter, r *http.Request) {
	lang := chi.URLParam(r, "lang")
	if lang == "" {
		writeJSON(w, 400, map[string]string{"error": "lang required"})
		return
	}

	namespaces := []string{
		"common", "dashboard", "transfer", "nfc", "federation", "assembly",
		"organizations", "products", "settings", "profile", "notifications",
		"external", "services", "website", "public", "errors", "audit",
		"satellite", "translations",
	}

	type NSStatus struct {
		Namespace  string `json:"namespace"`
		Total      int    `json:"total"`
		Translated int    `json:"translated"`
		Missing    int    `json:"missing"`
		Percent    int    `json:"percent"`
	}

	var statuses []NSStatus
	for _, ns := range namespaces {
		defaults := th.loadJSONDefaults(lang, ns)
		total := len(defaults)

		// Contar overrides en BD
		var dbCount int
		_ = th.Pool.QueryRow(r.Context(),
			`SELECT COUNT(*) FROM translations WHERE language = $1 AND namespace = $2 AND node_domain = $3`,
			lang, ns, th.NodeDomain).Scan(&dbCount)

		translated := dbCount
		if translated > total {
			translated = total
		}
		missing := total - translated
		if missing < 0 {
			missing = 0
		}
		percent := 0
		if total > 0 {
			percent = (translated * 100) / total
		}

		statuses = append(statuses, NSStatus{
			Namespace:  ns,
			Total:      total,
			Translated: translated,
			Missing:    missing,
			Percent:    percent,
		})
	}

	writeJSON(w, 200, statuses)
}

// getMissingTranslations devuelve las claves sin traducir.
// GET /api/translations/missing/{lang}
func (th *TranslationHandler) getMissingTranslations(w http.ResponseWriter, r *http.Request) {
	lang := chi.URLParam(r, "lang")
	if lang == "" {
		writeJSON(w, 400, map[string]string{"error": "lang required"})
		return
	}

	nsParam := r.URL.Query().Get("namespace")

	namespaces := []string{
		"common", "dashboard", "transfer", "nfc", "federation", "assembly",
		"organizations", "products", "settings", "profile", "notifications",
		"external", "services", "website", "public", "errors", "audit",
		"satellite", "translations",
	}
	if nsParam != "" {
		namespaces = []string{nsParam}
	}

	type MissingEntry struct {
		Namespace string `json:"namespace"`
		Key       string `json:"key"`
		Default   string `json:"default_value"`
	}

	var missing []MissingEntry
	for _, ns := range namespaces {
		defaults := th.loadJSONDefaults(lang, ns)

		// Obtener claves que ya tienen override
		rows, err := th.Pool.Query(r.Context(),
			`SELECT key FROM translations WHERE language = $1 AND namespace = $2 AND node_domain = $3`,
			lang, ns, th.NodeDomain)
		if err != nil {
			continue
		}

		existingKeys := map[string]bool{}
		for rows.Next() {
			var k string
			rows.Scan(&k)
			existingKeys[k] = true
		}
		rows.Close()

		// Las claves que no estan en la BD son "missing"
		// Pero solo si el JSON default tiene contenido (skip empty namespaces)
		for k, v := range defaults {
			if !existingKeys[k] {
				missing = append(missing, MissingEntry{
					Namespace: ns,
					Key:       k,
					Default:   v,
				})
			}
		}
	}

	// Ordenar por namespace, luego por key
	sort.Slice(missing, func(i, j int) bool {
		if missing[i].Namespace != missing[j].Namespace {
			return missing[i].Namespace < missing[j].Namespace
		}
		return missing[i].Key < missing[j].Key
	})

	if missing == nil {
		missing = []MissingEntry{}
	}
	writeJSON(w, 200, missing)
}

// === Helpers internos ===

// loadJSONDefaults carga el JSON default desde el filesystem.
func (th *TranslationHandler) loadJSONDefaults(lang, ns string) map[string]string {
	path := filepath.Join(th.LocaleDir, lang, ns+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return map[string]string{}
	}

	var result map[string]string
	if err := json.Unmarshal(data, &result); err != nil {
		// Podria ser un JSON anidado (como common.json)
		// Intentar aplanarlo
		var raw map[string]interface{}
		if err := json.Unmarshal(data, &raw); err != nil {
			return map[string]string{}
		}
		result = flattenJSON(raw, "")
	}
	return result
}

// loadDBOverrides carga los overrides desde la BD.
func (th *TranslationHandler) loadDBOverrides(r *http.Request, lang, ns string) map[string]string {
	result := map[string]string{}
	rows, err := th.Pool.Query(r.Context(),
		`SELECT key, value FROM translations WHERE language = $1 AND namespace = $2 AND node_domain = $3`,
		lang, ns, th.NodeDomain)
	if err != nil {
		return result
	}
	defer rows.Close()

	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			continue
		}
		result[k] = v
	}
	return result
}

// flattenJSON convierte un JSON anidado en un mapa plano con claves separadas por puntos.
// Ej: {"nav": {"dashboard": "Inicio"}} -> {"nav.dashboard": "Inicio"}
func flattenJSON(obj map[string]interface{}, prefix string) map[string]string {
	result := map[string]string{}
	for k, v := range obj {
		key := k
		if prefix != "" {
			key = prefix + "." + k
		}
		switch val := v.(type) {
		case string:
			result[key] = val
		case map[string]interface{}:
			for fk, fv := range flattenJSON(val, key) {
				result[fk] = fv
			}
		}
	}
	return result
}

// SetGlobalJWTSecret guarda el secreto JWT para uso en handlers que no tienen acceso directo.
var globalJWTSecret = ""

func SetGlobalJWTSecret(secret string) {
	globalJWTSecret = secret
}
