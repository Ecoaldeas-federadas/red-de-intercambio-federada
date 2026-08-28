package api

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// FormatSettings agrupa las preferencias de formato (numero, fecha, hora, etc.)
// que el frontend usa para mostrar montos, fechas y horas al usuario.
type FormatSettings struct {
	Locale          string `json:"locale"`
	NumberLocale    string `json:"number_locale"`
	DateFormat      string `json:"date_format"`
	TimeFormat      string `json:"time_format"`
	FirstDayOfWeek  int    `json:"first_day_of_week"`
	Timezone        string `json:"timezone"`
}

// defaultFormatSettings devuelve los defaults del sistema (locale espanol,
// formato 24h, DD/MM/YYYY, etc.). Son el ultimo nivel de fallback.
func defaultFormatSettings() FormatSettings {
	return FormatSettings{
		Locale:         "es",
		NumberLocale:   "es-VE",
		DateFormat:     "DD/MM/YYYY",
		TimeFormat:     "24h",
		FirstDayOfWeek: 1,
		Timezone:       "America/Caracas",
	}
}

// nodeFormatSettings lee settings->'format_settings' de node_config para el
// dominio dado. Si no existe o esta vacio, devuelve los defaults del sistema.
func nodeFormatSettings(ctx context.Context, pool *pgxpool.Pool, nodeDomain string) FormatSettings {
	def := defaultFormatSettings()
	if pool == nil || nodeDomain == "" {
		return def
	}
	var raw json.RawMessage
	err := pool.QueryRow(ctx, `
		SELECT settings->'format_settings'
		FROM node_config WHERE node_domain = $1`, nodeDomain).Scan(&raw)
	if err != nil || len(raw) == 0 || string(raw) == "null" {
		return def
	}
	var fs FormatSettings
	if err := json.Unmarshal(raw, &fs); err != nil {
		return def
	}
	// Rellenar campos vacios con defaults
	if fs.Locale == "" {
		fs.Locale = def.Locale
	}
	if fs.NumberLocale == "" {
		fs.NumberLocale = def.NumberLocale
	}
	if fs.DateFormat == "" {
		fs.DateFormat = def.DateFormat
	}
	if fs.TimeFormat == "" {
		fs.TimeFormat = def.TimeFormat
	}
	if fs.FirstDayOfWeek != 0 && fs.FirstDayOfWeek != 1 {
		// solo 0 o 1 son validos; si viene otro valor, usar default
		if fs.FirstDayOfWeek < 0 || fs.FirstDayOfWeek > 1 {
			fs.FirstDayOfWeek = def.FirstDayOfWeek
		}
	}
	if fs.Timezone == "" {
		fs.Timezone = def.Timezone
	}
	return fs
}

// userFormatSettings lee las preferencias del usuario desde user_preferences.
// Si el usuario no tiene fila, devuelve ok=false para que el llamador pueda
// caer al fallback de nodo.
func userFormatSettings(ctx context.Context, pool *pgxpool.Pool, userID string) (FormatSettings, bool) {
	def := defaultFormatSettings()
	if pool == nil || userID == "" {
		return def, false
	}
	var fs FormatSettings
	err := pool.QueryRow(ctx, `
		SELECT locale, number_locale, date_format, time_format, first_day_of_week, timezone
		FROM user_preferences WHERE user_id = $1`, userID).Scan(
		&fs.Locale, &fs.NumberLocale, &fs.DateFormat, &fs.TimeFormat, &fs.FirstDayOfWeek, &fs.Timezone)
	if err != nil {
		return def, false
	}
	return fs, true
}

// resolveFormatSettings aplica la logica de merge:
//  1. Preferencias del usuario (si existen)
//  2. Defaults del nodo (node_config.settings->format_settings)
//  3. Defaults del sistema
//
// Si userID es vacio, se omite el nivel 1.
func resolveFormatSettings(ctx context.Context, pool *pgxpool.Pool, userID string, nodeDomain string) FormatSettings {
	if userID != "" {
		if fs, ok := userFormatSettings(ctx, pool, userID); ok {
			return fs
		}
	}
	return nodeFormatSettings(ctx, pool, nodeDomain)
}

// ===== GET /api/me/preferences =====

func (ah *AuthHandlers) getMyPreferences(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(ah.JWTSecret)
	userID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	// Resolver el dominio del nodo del usuario para el fallback de nodo
	var userNodeDomain string
	_ = ah.Pool.QueryRow(r.Context(), `SELECT node_domain FROM users WHERE id = $1`, userID).Scan(&userNodeDomain)
	if userNodeDomain == "" {
		userNodeDomain = ah.NodeDomain
	}

	fs := resolveFormatSettings(r.Context(), ah.Pool, userID.String(), userNodeDomain)
	writeJSON(w, 200, fs)
}

// ===== PUT /api/me/preferences =====

type UpdatePreferencesRequest struct {
	Locale         *string `json:"locale"`
	NumberLocale   *string `json:"number_locale"`
	DateFormat     *string `json:"date_format"`
	TimeFormat     *string `json:"time_format"`
	FirstDayOfWeek *int    `json:"first_day_of_week"`
	Timezone       *string `json:"timezone"`
}

func (ah *AuthHandlers) updateMyPreferences(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(ah.JWTSecret)
	userID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	var req UpdatePreferencesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Validaciones
	if req.Locale != nil && *req.Locale == "" {
		writeError(w, 400, "locale no puede ser vacio")
		return
	}
	if req.DateFormat != nil {
		switch *req.DateFormat {
		case "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD":
		default:
			writeError(w, 400, "date_format invalido: debe ser DD/MM/YYYY, MM/DD/YYYY o YYYY-MM-DD")
			return
		}
	}
	if req.TimeFormat != nil {
		switch *req.TimeFormat {
		case "24h", "12h":
		default:
			writeError(w, 400, "time_format invalido: debe ser 24h o 12h")
			return
		}
	}
	if req.FirstDayOfWeek != nil && *req.FirstDayOfWeek != 0 && *req.FirstDayOfWeek != 1 {
		writeError(w, 400, "first_day_of_week invalido: debe ser 0 o 1")
		return
	}

	// Resolver valores efectivos (usar los actuales o defaults para el UPSERT)
	current := resolveFormatSettings(r.Context(), ah.Pool, userID.String(), ah.NodeDomain)
	locale := current.Locale
	numberLocale := current.NumberLocale
	dateFormat := current.DateFormat
	timeFormat := current.TimeFormat
	firstDay := current.FirstDayOfWeek
	timezone := current.Timezone

	if req.Locale != nil {
		locale = *req.Locale
	}
	if req.NumberLocale != nil {
		numberLocale = *req.NumberLocale
	}
	if req.DateFormat != nil {
		dateFormat = *req.DateFormat
	}
	if req.TimeFormat != nil {
		timeFormat = *req.TimeFormat
	}
	if req.FirstDayOfWeek != nil {
		firstDay = *req.FirstDayOfWeek
	}
	if req.Timezone != nil {
		timezone = *req.Timezone
	}

	_, err = ah.Pool.Exec(r.Context(), `
		INSERT INTO user_preferences (user_id, locale, number_locale, date_format, time_format, first_day_of_week, timezone, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			locale = EXCLUDED.locale,
			number_locale = EXCLUDED.number_locale,
			date_format = EXCLUDED.date_format,
			time_format = EXCLUDED.time_format,
			first_day_of_week = EXCLUDED.first_day_of_week,
			timezone = EXCLUDED.timezone,
			updated_at = NOW()`,
		userID, locale, numberLocale, dateFormat, timeFormat, firstDay, timezone)
	if err != nil {
		writeError(w, 500, "error updating preferences")
		return
	}

	writeJSON(w, 200, FormatSettings{
		Locale:         locale,
		NumberLocale:   numberLocale,
		DateFormat:     dateFormat,
		TimeFormat:     timeFormat,
		FirstDayOfWeek: firstDay,
		Timezone:       timezone,
	})
}
