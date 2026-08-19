package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DocumentsHandler maneja documentos de usuario y paises
type DocumentsHandler struct {
	Pool      *pgxpool.Pool
	Auth      *AuthMiddleware
	JWTSecret string
}

func (h *DocumentsHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Paises y tipos de documento (publico)
	r.Get("/api/countries", h.listCountries)
	r.Get("/api/document-types", h.listDocumentTypes)

	// Documentos del usuario autenticado
	r.Group(func(r chi.Router) {
		r.Use(am.RequireAuth)
		r.Get("/api/auth/me/documents", h.listMyDocuments)
		r.Post("/api/auth/me/documents", h.addMyDocument)
		r.Delete("/api/auth/me/documents/{id}", h.deleteMyDocument)
	})

	// Admin: añadir pais nuevo
	r.Group(func(r chi.Router) {
		r.Use(am.RequireAuth)
		r.With(am.RequirePermission("system.manage")).Post("/api/countries", h.addCountry)
	})
}

// listCountries devuelve todos los paises
func (h *DocumentsHandler) listCountries(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Pool.Query(r.Context(), `
		SELECT iso2, iso3, spanish_name, name, phone_code
		FROM countries WHERE is_active = true
		ORDER BY spanish_name`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	var countries []map[string]interface{}
	for rows.Next() {
		var iso2, iso3, esName, enName, phone string
		if err := rows.Scan(&iso2, &iso3, &esName, &enName, &phone); err != nil {
			continue
		}
		countries = append(countries, map[string]interface{}{
			"iso2":         iso2,
			"iso3":         iso3,
			"name":         esName,
			"english_name": enName,
			"phone_code":   phone,
		})
	}
	if countries == nil {
		countries = []map[string]interface{}{}
	}
	writeJSON(w, 200, countries)
}

// listDocumentTypes devuelve todos los tipos de documento
func (h *DocumentsHandler) listDocumentTypes(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Pool.Query(r.Context(), `
		SELECT code, spanish_name, name, is_international, sort_order
		FROM document_types ORDER BY sort_order`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	var types []map[string]interface{}
	for rows.Next() {
		var code, esName, enName string
		var isIntl bool
		var sort int
		if err := rows.Scan(&code, &esName, &enName, &isIntl, &sort); err != nil {
			continue
		}
		types = append(types, map[string]interface{}{
			"code":             code,
			"name":             esName,
			"english_name":     enName,
			"is_international": isIntl,
			"sort_order":       sort,
		})
	}
	if types == nil {
		types = []map[string]interface{}{}
	}
	writeJSON(w, 200, types)
}

// listMyDocuments devuelve los documentos del usuario autenticado
func (h *DocumentsHandler) listMyDocuments(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(h.JWTSecret)
	userID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT d.id, d.document_type_code, t.spanish_name, d.document_number,
		       d.country_iso2, d.country_name, d.is_verified, d.created_at
		FROM user_documents d
		LEFT JOIN document_types t ON t.code = d.document_type_code
		WHERE d.user_id = $1
		ORDER BY t.sort_order, d.created_at`, userID)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	var docs []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var typeCode, typeName, number string
		var countryISO2, countryName *string
		var verified bool
		var createdAt time.Time
		if err := rows.Scan(&id, &typeCode, &typeName, &number, &countryISO2, &countryName, &verified, &createdAt); err != nil {
			continue
		}
		doc := map[string]interface{}{
			"id":                 id.String(),
			"document_type":      typeCode,
			"document_type_name": typeName,
			"document_number":    number,
			"is_verified":        verified,
			"created_at":         createdAt,
		}
		if countryISO2 != nil {
			doc["country_iso2"] = *countryISO2
		}
		if countryName != nil {
			doc["country_name"] = *countryName
		}
		docs = append(docs, doc)
	}
	if docs == nil {
		docs = []map[string]interface{}{}
	}
	writeJSON(w, 200, docs)
}

// addMyDocument agrega un documento al usuario autenticado
func (h *DocumentsHandler) addMyDocument(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(h.JWTSecret)
	userID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	var req struct {
		DocumentType   string `json:"document_type"`
		DocumentNumber string `json:"document_number"`
		CountryISO2    string `json:"country_iso2"`
		CountryName    string `json:"country_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.DocumentType == "" || req.DocumentNumber == "" {
		writeError(w, 400, "document_type and document_number are required")
		return
	}

	// Si se proporciona iso2, obtener el nombre del pais
	if req.CountryISO2 != "" && req.CountryName == "" {
		h.Pool.QueryRow(r.Context(), `SELECT spanish_name FROM countries WHERE iso2 = $1`, req.CountryISO2).Scan(&req.CountryName)
	}

	var id uuid.UUID
	err = h.Pool.QueryRow(r.Context(), `
		INSERT INTO user_documents (user_id, document_type_code, document_number, country_iso2, country_name)
		VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''))
		ON CONFLICT (user_id, document_type_code, document_number) DO NOTHING
		RETURNING id`,
		userID, req.DocumentType, req.DocumentNumber, req.CountryISO2, req.CountryName).Scan(&id)
	if err != nil {
		writeError(w, 400, "documento ya existe o tipo invalido")
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":              id.String(),
		"document_type":   req.DocumentType,
		"document_number": req.DocumentNumber,
		"country_iso2":    req.CountryISO2,
		"country_name":    req.CountryName,
		"message":         "Documento agregado",
	})
}

// deleteMyDocument elimina un documento del usuario
func (h *DocumentsHandler) deleteMyDocument(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(h.JWTSecret)
	userID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	docID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid document id")
		return
	}

	result, err := h.Pool.Exec(r.Context(), `
		DELETE FROM user_documents WHERE id = $1 AND user_id = $2`,
		docID, userID)
	if err != nil || result.RowsAffected() == 0 {
		writeError(w, 404, "documento no encontrado")
		return
	}

	writeJSON(w, 200, map[string]string{"status": "deleted"})
}

// addCountry permite al admin añadir un pais nuevo
func (h *DocumentsHandler) addCountry(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Iso2        string `json:"iso2"`
		Iso3        string `json:"iso3"`
		Name        string `json:"name"`
		SpanishName string `json:"spanish_name"`
		PhoneCode   string `json:"phone_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Iso2 == "" || req.Iso3 == "" || req.SpanishName == "" {
		writeError(w, 400, "iso2, iso3 y spanish_name son obligatorios")
		return
	}

	var id int
	err := h.Pool.QueryRow(r.Context(), `
		INSERT INTO countries (iso2, iso3, name, spanish_name, phone_code)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (iso2) DO UPDATE SET is_active = true, spanish_name = EXCLUDED.spanish_name
		RETURNING id`,
		req.Iso2, req.Iso3, req.Name, req.SpanishName, req.PhoneCode).Scan(&id)
	if err != nil {
		writeError(w, 400, "error al crear pais")
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":           id,
		"iso2":         req.Iso2,
		"spanish_name": req.SpanishName,
		"message":      "Pais agregado",
	})
}
