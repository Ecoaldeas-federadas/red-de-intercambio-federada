package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

// resolveLang extracts the requested language from query param "lang"
// or falls back to the Accept-Language header, defaulting to "es".
func resolveLang(r *http.Request) string {
	lang := r.URL.Query().Get("lang")
	if lang == "" {
		lang = r.Header.Get("Accept-Language")
		if lang != "" {
			// Accept-Language may be "en-US,en;q=0.9" - take first part
			if idx := strings.Index(lang, ","); idx > 0 {
				lang = lang[:idx]
			}
			if idx := strings.Index(lang, "-"); idx > 0 {
				lang = lang[:idx]
			}
		}
	}
	if lang == "" {
		lang = "es"
	}
	return lang
}

// ===== Traducciones de reglas de gobernanza =====

// getGovernanceRuleTranslations lista todas las traducciones de una regla.
// GET /api/governance/rules/{id}/translations
func (h *SystemHandler) getGovernanceRuleTranslations(w http.ResponseWriter, r *http.Request) {
	ruleID := chi.URLParam(r, "id")
	if ruleID == "" {
		writeJSON(w, 400, map[string]string{"error": "rule id required"})
		return
	}

	rows, err := h.Pool.Query(r.Context(),
		`SELECT language, COALESCE(title, ''), COALESCE(description, ''), updated_at
		 FROM governance_rule_translations
		 WHERE rule_id = $1::uuid
		 ORDER BY language`, ruleID)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error querying translations"})
		return
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var lang, title, description, updatedAt string
		if err := rows.Scan(&lang, &title, &description, &updatedAt); err != nil {
			continue
		}
		result = append(result, map[string]interface{}{
			"language":    lang,
			"title":       title,
			"description": description,
			"updated_at":  updatedAt,
		})
	}
	if result == nil {
		result = []map[string]interface{}{}
	}
	writeJSON(w, 200, result)
}

// updateGovernanceRuleTranslation guarda la traducción de una regla en un idioma.
// PUT /api/governance/rules/{id}/translations/{lang}
func (h *SystemHandler) updateGovernanceRuleTranslation(w http.ResponseWriter, r *http.Request) {
	ruleID := chi.URLParam(r, "id")
	lang := chi.URLParam(r, "lang")
	if ruleID == "" || lang == "" {
		writeJSON(w, 400, map[string]string{"error": "rule id and language required"})
		return
	}

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	_, err := h.Pool.Exec(r.Context(),
		`INSERT INTO governance_rule_translations (rule_id, language, title, description, updated_at)
		 VALUES ($1::uuid, $2, $3, $4, NOW())
		 ON CONFLICT (rule_id, language) DO UPDATE SET
		   title = EXCLUDED.title,
		   description = EXCLUDED.description,
		   updated_at = NOW()`,
		ruleID, lang, req.Title, req.Description)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error saving translation"})
		return
	}

	writeJSON(w, 200, map[string]string{"status": "ok"})
}

// ===== Traducciones de parametros de calculadora =====

// getCalculatorParameterTranslations lista todas las traducciones de un parametro.
// GET /api/calculator/parameters/{id}/translations
func (h *SystemHandler) getCalculatorParameterTranslations(w http.ResponseWriter, r *http.Request) {
	paramID := chi.URLParam(r, "id")
	if paramID == "" {
		writeJSON(w, 400, map[string]string{"error": "parameter id required"})
		return
	}

	rows, err := h.Pool.Query(r.Context(),
		`SELECT language, COALESCE(name, ''), COALESCE(description, ''), updated_at
		 FROM calculator_parameter_translations
		 WHERE parameter_id = $1::uuid
		 ORDER BY language`, paramID)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error querying translations"})
		return
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var lang, name, description, updatedAt string
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

// updateCalculatorParameterTranslation guarda la traducción de un parametro en un idioma.
// PUT /api/calculator/parameters/{id}/translations/{lang}
func (h *SystemHandler) updateCalculatorParameterTranslation(w http.ResponseWriter, r *http.Request) {
	paramID := chi.URLParam(r, "id")
	lang := chi.URLParam(r, "lang")
	if paramID == "" || lang == "" {
		writeJSON(w, 400, map[string]string{"error": "parameter id and language required"})
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
		`INSERT INTO calculator_parameter_translations (parameter_id, language, name, description, updated_at)
		 VALUES ($1::uuid, $2, $3, $4, NOW())
		 ON CONFLICT (parameter_id, language) DO UPDATE SET
		   name = EXCLUDED.name,
		   description = EXCLUDED.description,
		   updated_at = NOW()`,
		paramID, lang, req.Name, req.Description)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error saving translation"})
		return
	}

	writeJSON(w, 200, map[string]string{"status": "ok"})
}

// ===== Traducciones de categorias de calculadora =====

// getCalculatorCategoryTranslations lista todas las traducciones de una categoria.
// GET /api/calculator/categories/{id}/translations
func (h *SystemHandler) getCalculatorCategoryTranslations(w http.ResponseWriter, r *http.Request) {
	catID := chi.URLParam(r, "id")
	if catID == "" {
		writeJSON(w, 400, map[string]string{"error": "category id required"})
		return
	}

	rows, err := h.Pool.Query(r.Context(),
		`SELECT language, COALESCE(name, ''), COALESCE(description, ''), updated_at
		 FROM calculator_category_translations
		 WHERE category_id = $1::uuid
		 ORDER BY language`, catID)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error querying translations"})
		return
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var lang, name, description, updatedAt string
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

// updateCalculatorCategoryTranslation guarda la traducción de una categoria en un idioma.
// PUT /api/calculator/categories/{id}/translations/{lang}
func (h *SystemHandler) updateCalculatorCategoryTranslation(w http.ResponseWriter, r *http.Request) {
	catID := chi.URLParam(r, "id")
	lang := chi.URLParam(r, "lang")
	if catID == "" || lang == "" {
		writeJSON(w, 400, map[string]string{"error": "category id and language required"})
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
		`INSERT INTO calculator_category_translations (category_id, language, name, description, updated_at)
		 VALUES ($1::uuid, $2, $3, $4, NOW())
		 ON CONFLICT (category_id, language) DO UPDATE SET
		   name = EXCLUDED.name,
		   description = EXCLUDED.description,
		   updated_at = NOW()`,
		catID, lang, req.Name, req.Description)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error saving translation"})
		return
	}

	writeJSON(w, 200, map[string]string{"status": "ok"})
}

// ===== Traducciones de productos =====

// getProductTranslations lista todas las traducciones de un producto.
// GET /api/products/{id}/translations
func (h *SystemHandler) getProductTranslations(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "id")
	if productID == "" {
		writeJSON(w, 400, map[string]string{"error": "product id required"})
		return
	}

	rows, err := h.Pool.Query(r.Context(),
		`SELECT language, COALESCE(name, ''), COALESCE(description, ''), updated_at
		 FROM product_translations
		 WHERE product_id = $1::uuid
		 ORDER BY language`, productID)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error querying translations"})
		return
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var lang, name, description, updatedAt string
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

// updateProductTranslation guarda la traducción de un producto en un idioma.
// PUT /api/products/{id}/translations/{lang}
func (h *SystemHandler) updateProductTranslation(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "id")
	lang := chi.URLParam(r, "lang")
	if productID == "" || lang == "" {
		writeJSON(w, 400, map[string]string{"error": "product id and language required"})
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
		`INSERT INTO product_translations (product_id, language, name, description, updated_at)
		 VALUES ($1::uuid, $2, $3, $4, NOW())
		 ON CONFLICT (product_id, language) DO UPDATE SET
		   name = EXCLUDED.name,
		   description = EXCLUDED.description,
		   updated_at = NOW()`,
		productID, lang, req.Name, req.Description)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error saving translation"})
		return
	}

	writeJSON(w, 200, map[string]string{"status": "ok"})
}

// ===== Traducciones de configuracion de asamblea =====

// getAssemblyConfigTranslations lista todas las traducciones de una config.
// GET /api/assembly/config/{id}/translations
func (h *SystemHandler) getAssemblyConfigTranslations(w http.ResponseWriter, r *http.Request) {
	configID := chi.URLParam(r, "id")
	if configID == "" {
		writeJSON(w, 400, map[string]string{"error": "config id required"})
		return
	}

	rows, err := h.Pool.Query(r.Context(),
		`SELECT language, COALESCE(description, ''), updated_at
		 FROM assembly_config_translations
		 WHERE config_id = $1::uuid
		 ORDER BY language`, configID)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error querying translations"})
		return
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var lang, description, updatedAt string
		if err := rows.Scan(&lang, &description, &updatedAt); err != nil {
			continue
		}
		result = append(result, map[string]interface{}{
			"language":    lang,
			"description": description,
			"updated_at":  updatedAt,
		})
	}
	if result == nil {
		result = []map[string]interface{}{}
	}
	writeJSON(w, 200, result)
}

// updateAssemblyConfigTranslation guarda la traducción de una config en un idioma.
// PUT /api/assembly/config/{id}/translations/{lang}
func (h *SystemHandler) updateAssemblyConfigTranslation(w http.ResponseWriter, r *http.Request) {
	configID := chi.URLParam(r, "id")
	lang := chi.URLParam(r, "lang")
	if configID == "" || lang == "" {
		writeJSON(w, 400, map[string]string{"error": "config id and language required"})
		return
	}

	var req struct {
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	_, err := h.Pool.Exec(r.Context(),
		`INSERT INTO assembly_config_translations (config_id, language, description, updated_at)
		 VALUES ($1::uuid, $2, $3, NOW())
		 ON CONFLICT (config_id, language) DO UPDATE SET
		   description = EXCLUDED.description,
		   updated_at = NOW()`,
		configID, lang, req.Description)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error saving translation"})
		return
	}

	writeJSON(w, 200, map[string]string{"status": "ok"})
}

// ===== Traducciones de constantes federadas =====

// getFederationConstantTranslations lista todas las traducciones de una constante.
// GET /api/federation/constants/{key}/translations
func (h *SystemHandler) getFederationConstantTranslations(w http.ResponseWriter, r *http.Request) {
	key := chi.URLParam(r, "key")
	if key == "" {
		writeJSON(w, 400, map[string]string{"error": "constant key required"})
		return
	}

	rows, err := h.Pool.Query(r.Context(),
		`SELECT language, COALESCE(description, ''), updated_at
		 FROM federation_constant_translations
		 WHERE constant_key = $1
		 ORDER BY language`, key)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error querying translations"})
		return
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var lang, description, updatedAt string
		if err := rows.Scan(&lang, &description, &updatedAt); err != nil {
			continue
		}
		result = append(result, map[string]interface{}{
			"language":    lang,
			"description": description,
			"updated_at":  updatedAt,
		})
	}
	if result == nil {
		result = []map[string]interface{}{}
	}
	writeJSON(w, 200, result)
}

// updateFederationConstantTranslation guarda la traducción de una constante en un idioma.
// PUT /api/federation/constants/{key}/translations/{lang}
func (h *SystemHandler) updateFederationConstantTranslation(w http.ResponseWriter, r *http.Request) {
	key := chi.URLParam(r, "key")
	lang := chi.URLParam(r, "lang")
	if key == "" || lang == "" {
		writeJSON(w, 400, map[string]string{"error": "constant key and language required"})
		return
	}

	var req struct {
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	_, err := h.Pool.Exec(r.Context(),
		`INSERT INTO federation_constant_translations (constant_key, language, description, updated_at)
		 VALUES ($1, $2, $3, NOW())
		 ON CONFLICT (constant_key, language) DO UPDATE SET
		   description = EXCLUDED.description,
		   updated_at = NOW()`,
		key, lang, req.Description)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "error saving translation"})
		return
	}

	writeJSON(w, 200, map[string]string{"status": "ok"})
}
