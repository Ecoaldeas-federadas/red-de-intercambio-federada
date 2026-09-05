package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
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
	// Log the locale directory for debugging
	log.Printf("[i18n] LocaleDir set to: %s (exists: %v)", localeDir, dirExists(localeDir))
	// List available languages
	if entries, err := os.ReadDir(localeDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				langDir := filepath.Join(localeDir, e.Name())
				if files, err := os.ReadDir(langDir); err == nil {
					log.Printf("[i18n] Language dir '%s': %d JSON files", e.Name(), len(files))
				}
			}
		}
	}
	return &TranslationHandler{
		Pool:       pool,
		NodeDomain: nodeDomain,
		LocaleDir:  localeDir,
	}
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

// AutoSeed carga las claves de los JSON a la BD al arrancar el servidor.
// No sobrescribe ediciones existentes. Se llama una vez al iniciar.
func (th *TranslationHandler) AutoSeed(ctx context.Context) {
	// Obtener idiomas habilitados
	rows, err := th.Pool.Query(ctx, `SELECT code FROM languages WHERE enabled = true`)
	if err != nil {
		log.Printf("[i18n] AutoSeed: error querying languages: %v", err)
		return
	}
	var langs []string
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err == nil {
			langs = append(langs, code)
		}
	}
	rows.Close()

	if len(langs) == 0 {
		log.Printf("[i18n] AutoSeed: no enabled languages found, skipping")
		return
	}

	namespaces := []string{
		"common", "dashboard", "transfer", "nfc", "federation", "assembly",
		"organizations", "products", "settings", "profile", "notifications",
		"external", "services", "website", "public", "errors", "audit",
		"satellite", "translations",
	}

	inserted := 0
	skipped := 0
	for _, lang := range langs {
		for _, ns := range namespaces {
			defaults := th.loadJSONDefaults(lang, ns)
			if len(defaults) == 0 {
				continue
			}
			for key, value := range defaults {
				var exists bool
				err := th.Pool.QueryRow(ctx,
					`SELECT EXISTS(SELECT 1 FROM translations WHERE key = $1 AND namespace = $2 AND language = $3 AND node_domain = $4)`,
					key, ns, lang, th.NodeDomain).Scan(&exists)
				if err != nil || exists {
					skipped++
					continue
				}
				_, err = th.Pool.Exec(ctx, `
					INSERT INTO translations (key, namespace, language, value, node_domain)
					VALUES ($1, $2, $3, $4, $5)
					ON CONFLICT (key, namespace, language, node_domain) DO NOTHING`,
					key, ns, lang, value, th.NodeDomain)
				if err == nil {
					inserted++
				}
			}
		}
	}
	log.Printf("[i18n] AutoSeed completed: %d inserted, %d skipped (domain=%s)", inserted, skipped, th.NodeDomain)
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
		r.Get("/api/translations/{lang}/all", th.getAllKeys)
		r.Get("/api/translations/diag", th.diagTranslations)

		// Ver traducciones federadas (cualquier usuario autenticado)
		r.Get("/api/translations/federated", th.getFederatedTranslations)

		// Editar traducciones (requiere translations.edit)
		r.Group(func(r chi.Router) {
			r.Use(am.RequirePermission("translations.edit"))
			r.Put("/api/translations/{lang}/{namespace}", th.updateTranslations)
			r.Put("/api/translations/{lang}/{namespace}/key", th.updateSingleKey)
			r.Post("/api/translations/{lang}/{namespace}/key", th.addSingleKey)
		})

		// Gestionar idiomas y subir/descargar (requiere translations.manage)
		r.Group(func(r chi.Router) {
			r.Use(am.RequirePermission("translations.manage"))
			r.Post("/api/languages", th.createLanguage)
			r.Put("/api/languages/{code}", th.updateLanguage)
			r.Delete("/api/languages/{code}", th.deleteLanguage)
			r.Post("/api/translations/upload", th.uploadTranslations)
			r.Get("/api/translations/{lang}/download", th.downloadTranslations)
			r.Post("/api/translations/federated/install", th.installFederatedTranslation)
			r.Post("/api/translations/seed", th.seedTranslations)
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

	// Determinar el idioma origen (default) para saber el conjunto total de claves
	defaultLang := "es"
	var dl string
	_ = th.Pool.QueryRow(r.Context(), `SELECT code FROM languages WHERE is_default = true LIMIT 1`).Scan(&dl)
	if dl != "" {
		defaultLang = dl
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
		// total = claves del idioma origen (default)
		sourceKeys := th.loadJSONDefaults(defaultLang, ns)
		total := len(sourceKeys)

		// Si no se pueden leer los JSON, usar el conteo de la BD como fallback
		if total == 0 {
			var dbCount int
			_ = th.Pool.QueryRow(r.Context(),
				`SELECT COUNT(DISTINCT key) FROM translations WHERE namespace = $1 AND language = $2 AND node_domain = $3`,
				ns, defaultLang, th.NodeDomain).Scan(&dbCount)
			total = dbCount
		}

		// Claves ya traducidas en el JSON del idioma objetivo
		targetKeys := th.loadJSONDefaults(lang, ns)

		// Claves con override en BD
		dbKeys := th.loadDBOverrideKeys(r, lang, ns)

		// Si el idioma es el mismo que el default, todas las claves de la BD cuentan como traducidas
		if lang == defaultLang && total > 0 && len(targetKeys) == 0 {
			// Usar conteo de BD para el idioma default
			var dbTranslated int
			_ = th.Pool.QueryRow(r.Context(),
				`SELECT COUNT(DISTINCT key) FROM translations WHERE namespace = $1 AND language = $2 AND node_domain = $3`,
				ns, lang, th.NodeDomain).Scan(&dbTranslated)
			translated := dbTranslated
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
			continue
		}

		// translated = claves del origen que existen en el JSON destino O en BD
		translated := 0
		for k := range sourceKeys {
			if _, ok := targetKeys[k]; ok {
				translated++
			} else if dbKeys[k] {
				translated++
			}
		}

		// También contar claves que están en la BD pero no en los JSON
		if total == 0 && len(dbKeys) > 0 {
			translated = len(dbKeys)
			total = len(dbKeys)
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

	// Determinar el idioma origen (default) para saber el conjunto total de claves
	defaultLang := "es"
	var dl string
	_ = th.Pool.QueryRow(r.Context(), `SELECT code FROM languages WHERE is_default = true LIMIT 1`).Scan(&dl)
	if dl != "" {
		defaultLang = dl
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
		// Claves del idioma origen (conjunto total a traducir)
		sourceKeys := th.loadJSONDefaults(defaultLang, ns)
		if len(sourceKeys) == 0 {
			continue
		}

		// Claves ya traducidas en el JSON del idioma objetivo
		targetKeys := th.loadJSONDefaults(lang, ns)

		// Claves con override en BD
		dbKeys := th.loadDBOverrideKeys(r, lang, ns)

		// Una clave es "missing" si esta en el origen pero NO en el JSON destino ni en BD
		for k, v := range sourceKeys {
			_, inTarget := targetKeys[k]
			inDB := dbKeys[k]
			if !inTarget && !inDB {
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
		log.Printf("[i18n] ERROR reading %s: %v", path, err)
		return map[string]string{}
	}

	var result map[string]string
	if err := json.Unmarshal(data, &result); err != nil {
		// Podria ser un JSON anidado (como common.json)
		// Intentar aplanarlo
		var raw map[string]interface{}
		if err := json.Unmarshal(data, &raw); err != nil {
			log.Printf("[i18n] ERROR parsing %s: %v", path, err)
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

// loadDBOverrideKeys devuelve solo el conjunto de claves que tienen override en BD.
func (th *TranslationHandler) loadDBOverrideKeys(r *http.Request, lang, ns string) map[string]bool {
	result := map[string]bool{}
	rows, err := th.Pool.Query(r.Context(),
		`SELECT key FROM translations WHERE language = $1 AND namespace = $2 AND node_domain = $3`,
		lang, ns, th.NodeDomain)
	if err != nil {
		return result
	}
	defer rows.Close()

	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			continue
		}
		result[k] = true
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

// getFederatedTranslations lista las traducciones recibidas de otros nodos.
// GET /api/translations/federated
func (th *TranslationHandler) getFederatedTranslations(w http.ResponseWriter, r *http.Request) {
	rows, err := th.Pool.Query(r.Context(),
		`SELECT id, source_node, language_code, display_name, version, file_hash,
		        signed_by, signature, num_keys, received_at, installed, installed_at
		 FROM federated_translations
		 ORDER BY received_at DESC`)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error querying federated translations"})
		return
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var id int
		var sourceNode, langCode, displayName, version, fileHash, signedBy, signature string
		var numKeys int
		var receivedAt string
		var installed bool
		var installedAt *string

		if err := rows.Scan(&id, &sourceNode, &langCode, &displayName, &version, &fileHash,
			&signedBy, &signature, &numKeys, &receivedAt, &installed, &installedAt); err != nil {
			continue
		}

		entry := map[string]interface{}{
			"id":            id,
			"source_node":   sourceNode,
			"language_code": langCode,
			"display_name":  displayName,
			"version":       version,
			"file_hash":     fileHash,
			"signed_by":     signedBy,
			"signature":     signature,
			"num_keys":      numKeys,
			"received_at":   receivedAt,
			"installed":     installed,
		}
		if installedAt != nil {
			entry["installed_at"] = *installedAt
		}
		result = append(result, entry)
	}
	if result == nil {
		result = []map[string]interface{}{}
	}
	writeJSON(w, 200, result)
}

// installFederatedTranslation descarga e instala una traduccion de otro nodo.
// POST /api/translations/federated/install
// Body: { "source_node": "...", "language_code": "..." }
func (th *TranslationHandler) installFederatedTranslation(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SourceNode   string `json:"source_node"`
		LanguageCode string `json:"language_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if req.SourceNode == "" || req.LanguageCode == "" {
		writeJSON(w, 400, map[string]string{"error": "source_node and language_code required"})
		return
	}

	// Marcar como instalado
	_, err := th.Pool.Exec(r.Context(),
		`UPDATE federated_translations
		 SET installed = true, installed_at = NOW()
		 WHERE source_node = $1 AND language_code = $2`,
		req.SourceNode, req.LanguageCode)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error installing translation"})
		return
	}

	writeJSON(w, 200, map[string]string{"status": "installed"})
}

// getAllKeys devuelve TODAS las claves de todos los namespaces para un idioma,
// combinando JSON defaults + BD overrides, con indicador de origen.
// GET /api/translations/{lang}/all
func (th *TranslationHandler) getAllKeys(w http.ResponseWriter, r *http.Request) {
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

	type KeyEntry struct {
		Key       string `json:"key"`
		Value     string `json:"value"`
		IsDefault bool   `json:"is_default"`
	}

	type NSResult struct {
		Namespace string     `json:"namespace"`
		Keys      []KeyEntry `json:"keys"`
	}

	var results []NSResult
	for _, ns := range namespaces {
		defaults := th.loadJSONDefaults(lang, ns)
		overrides := th.loadDBOverrides(r, lang, ns)

		// Merge: empezar con defaults, sobrescribir con BD
		allKeys := map[string]bool{}
		for k := range defaults {
			allKeys[k] = true
		}
		for k := range overrides {
			allKeys[k] = true
		}

		var entries []KeyEntry
		for k := range allKeys {
			val := defaults[k]
			isDefault := true
			if ov, ok := overrides[k]; ok {
				val = ov
				isDefault = false
			}
			entries = append(entries, KeyEntry{
				Key:       k,
				Value:     val,
				IsDefault: isDefault,
			})
		}
		// Ordenar claves alfabeticamente
		sort.Slice(entries, func(i, j int) bool {
			return entries[i].Key < entries[j].Key
		})
		results = append(results, NSResult{
			Namespace: ns,
			Keys:      entries,
		})
	}

	writeJSON(w, 200, results)
}

// updateSingleKey actualiza una clave individual en la BD.
// PUT /api/translations/{lang}/{namespace}/key
// Body: { "key": "save", "value": "Guardar" }
func (th *TranslationHandler) updateSingleKey(w http.ResponseWriter, r *http.Request) {
	lang := chi.URLParam(r, "lang")
	ns := chi.URLParam(r, "namespace")
	if lang == "" || ns == "" {
		writeJSON(w, 400, map[string]string{"error": "lang and namespace required"})
		return
	}

	var req struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if req.Key == "" {
		writeJSON(w, 400, map[string]string{"error": "key required"})
		return
	}

	userID, _ := getUserID(r)
	_, err := th.Pool.Exec(r.Context(), `
		INSERT INTO translations (key, namespace, language, value, node_domain, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (key, namespace, language, node_domain) DO UPDATE SET
			value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
		req.Key, ns, lang, req.Value, th.NodeDomain, userID)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error updating key"})
		return
	}

	writeJSON(w, 200, map[string]string{"status": "ok"})
}

// addSingleKey agrega una clave nueva a la BD.
// POST /api/translations/{lang}/{namespace}/key
// Body: { "key": "new_key", "value": "New Value" }
func (th *TranslationHandler) addSingleKey(w http.ResponseWriter, r *http.Request) {
	lang := chi.URLParam(r, "lang")
	ns := chi.URLParam(r, "namespace")
	if lang == "" || ns == "" {
		writeJSON(w, 400, map[string]string{"error": "lang and namespace required"})
		return
	}

	var req struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if req.Key == "" {
		writeJSON(w, 400, map[string]string{"error": "key required"})
		return
	}

	userID, _ := getUserID(r)
	_, err := th.Pool.Exec(r.Context(), `
		INSERT INTO translations (key, namespace, language, value, node_domain, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (key, namespace, language, node_domain) DO UPDATE SET
			value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
		req.Key, ns, lang, req.Value, th.NodeDomain, userID)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error adding key"})
		return
	}

	writeJSON(w, 200, map[string]string{"status": "ok"})
}

// seedTranslations lee todos los JSON del filesystem e inserta las claves en la BD.
// POST /api/translations/seed
// No sobrescribe ediciones existentes.
func (th *TranslationHandler) seedTranslations(w http.ResponseWriter, r *http.Request) {
	// Obtener idiomas habilitados
	rows, err := th.Pool.Query(r.Context(),
		`SELECT code FROM languages WHERE enabled = true`)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error querying languages"})
		return
	}
	var langs []string
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err != nil {
			continue
		}
		langs = append(langs, code)
	}
	rows.Close()

	namespaces := []string{
		"common", "dashboard", "transfer", "nfc", "federation", "assembly",
		"organizations", "products", "settings", "profile", "notifications",
		"external", "services", "website", "public", "errors", "audit",
		"satellite", "translations",
	}

	userID, _ := getUserID(r)
	inserted := 0
	skipped := 0

	for _, lang := range langs {
		for _, ns := range namespaces {
			defaults := th.loadJSONDefaults(lang, ns)
			for key, value := range defaults {
				// Solo insertar si no existe ya en la BD
				var exists bool
				err := th.Pool.QueryRow(r.Context(),
					`SELECT EXISTS(SELECT 1 FROM translations WHERE key = $1 AND namespace = $2 AND language = $3 AND node_domain = $4)`,
					key, ns, lang, th.NodeDomain).Scan(&exists)
				if err != nil {
					continue
				}
				if exists {
					skipped++
					continue
				}
				_, err = th.Pool.Exec(r.Context(), `
					INSERT INTO translations (key, namespace, language, value, node_domain, updated_by)
					VALUES ($1, $2, $3, $4, $5, $6)
					ON CONFLICT (key, namespace, language, node_domain) DO NOTHING`,
					key, ns, lang, value, th.NodeDomain, userID)
				if err == nil {
					inserted++
				}
			}
		}
	}

	log.Printf("[i18n] Seed completed: %d inserted, %d skipped", inserted, skipped)
	writeJSON(w, 200, map[string]interface{}{
		"status":   "ok",
		"inserted": inserted,
		"skipped":  skipped,
	})
}

// diagTranslations returns diagnostic info about the locale directory and file system.
// GET /api/translations/diag
func (th *TranslationHandler) diagTranslations(w http.ResponseWriter, r *http.Request) {
	info := map[string]interface{}{
		"locale_dir": th.LocaleDir,
		"exists":     dirExists(th.LocaleDir),
	}

	// List language directories
	langs := map[string]interface{}{}
	if entries, err := os.ReadDir(th.LocaleDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				langDir := filepath.Join(th.LocaleDir, e.Name())
				files := []string{}
				if fileEntries, err := os.ReadDir(langDir); err == nil {
					for _, f := range fileEntries {
						if !f.IsDir() && filepath.Ext(f.Name()) == ".json" {
							files = append(files, f.Name())
						}
					}
				}
				langs[e.Name()] = files
			}
		}
	}
	info["languages"] = langs

	// Count keys for es and en
	namespaces := []string{
		"common", "dashboard", "transfer", "nfc", "federation", "assembly",
		"organizations", "products", "settings", "profile", "notifications",
		"external", "services", "website", "public", "errors", "audit",
		"satellite", "translations",
	}
	keyCounts := map[string]map[string]int{}
	for _, lang := range []string{"es", "en"} {
		keyCounts[lang] = map[string]int{}
		for _, ns := range namespaces {
			keys := th.loadJSONDefaults(lang, ns)
			keyCounts[lang][ns] = len(keys)
		}
	}
	info["key_counts"] = keyCounts

	// Check DB languages
	rows, err := th.Pool.Query(r.Context(), `SELECT code, name, enabled, is_default FROM languages ORDER BY code`)
	if err == nil {
		defer rows.Close()
		dbLangs := []map[string]interface{}{}
		for rows.Next() {
			var code, name string
			var enabled, isDefault bool
			if err := rows.Scan(&code, &name, &enabled, &isDefault); err == nil {
				dbLangs = append(dbLangs, map[string]interface{}{
					"code":       code,
					"name":       name,
					"enabled":    enabled,
					"is_default": isDefault,
				})
			}
		}
		info["db_languages"] = dbLangs
	}

	// Check DB translations count
	var dbCount int
	_ = th.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM translations`).Scan(&dbCount)
	info["db_translations_count"] = dbCount

	writeJSON(w, 200, info)
}
