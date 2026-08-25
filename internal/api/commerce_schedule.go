package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CommerceScheduleHandler maneja los horarios de comercio configurables.
// Cada nodo puede configurar cuando se bloquean las transacciones comerciales
// (ej: adventistas bloquean del viernes al sabado al ponerse el sol).
type CommerceScheduleHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

// CommerceSchedule representa una regla de horario de comercio.
type CommerceSchedule struct {
	ID              string  `json:"id"`
	NodeDomain      string  `json:"node_domain"`
	Name            string  `json:"name"`
	IsActive        bool    `json:"is_active"`
	DayOfWeek       *int    `json:"day_of_week"`
	StartTime       *string `json:"start_time"`
	EndTime         *string `json:"end_time"`
	CrossesMidnight bool    `json:"crosses_midnight"`
	EndDayOfWeek    *int    `json:"end_day_of_week"`
	BlockType       string  `json:"block_type"`
	BlockMessage    string  `json:"block_message"`
}

func (h *CommerceScheduleHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	r.With(am.RequireAuth).Get("/api/node/commerce-schedule", h.listSchedules)
	r.With(am.RequirePermission("config.manage")).Post("/api/node/commerce-schedule", h.createSchedule)
	r.With(am.RequirePermission("config.manage")).Put("/api/node/commerce-schedule/{id}", h.updateSchedule)
	r.With(am.RequirePermission("config.manage")).Delete("/api/node/commerce-schedule/{id}", h.deleteSchedule)
	r.With(am.RequirePermission("config.manage")).Put("/api/node/commerce-hours-toggle", h.toggleCommerceHours)
}

func (h *CommerceScheduleHandler) listSchedules(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id::text, node_domain, name, is_active, day_of_week, start_time, end_time,
		       crosses_midnight, end_day_of_week, block_type, block_message
		FROM commerce_schedule WHERE node_domain = $1 ORDER BY created_at`, nodeDomain)
	if err != nil {
		writeError(w, 500, "error querying schedules")
		return
	}
	defer rows.Close()

	var schedules []CommerceSchedule
	for rows.Next() {
		var s CommerceSchedule
		var dayOfWeek, endDayOfWeek *int
		var startTime, endTime *string
		if err := rows.Scan(&s.ID, &s.NodeDomain, &s.Name, &s.IsActive,
			&dayOfWeek, &startTime, &endTime, &s.CrossesMidnight, &endDayOfWeek,
			&s.BlockType, &s.BlockMessage); err != nil {
			continue
		}
		s.DayOfWeek = dayOfWeek
		s.StartTime = startTime
		s.EndTime = endTime
		s.EndDayOfWeek = endDayOfWeek
		schedules = append(schedules, s)
	}

	// Tambien obtener el estado global
	var enabled bool
	var message string
	h.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(commerce_hours_enabled, false), COALESCE(commerce_hours_message, '')
		FROM public_settings WHERE node_domain = $1`, nodeDomain).Scan(&enabled, &message)

	writeJSON(w, 200, map[string]interface{}{
		"schedules":              schedules,
		"commerce_hours_enabled": enabled,
		"commerce_hours_message": message,
	})
}

func (h *CommerceScheduleHandler) createSchedule(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var req CommerceSchedule
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, 400, "name is required")
		return
	}

	var id string
	err := h.Pool.QueryRow(r.Context(), `
		INSERT INTO commerce_schedule (node_domain, name, is_active, day_of_week, start_time, end_time,
			crosses_midnight, end_day_of_week, block_type, block_message)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id::text`,
		nodeDomain, req.Name, req.IsActive, req.DayOfWeek, req.StartTime, req.EndTime,
		req.CrossesMidnight, req.EndDayOfWeek, req.BlockType, req.BlockMessage).Scan(&id)
	if err != nil {
		writeError(w, 500, "error creating schedule: "+err.Error())
		return
	}

	writeJSON(w, 201, map[string]interface{}{"id": id, "success": true})
}

func (h *CommerceScheduleHandler) updateSchedule(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req CommerceSchedule
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE commerce_schedule SET
			name = $2, is_active = $3, day_of_week = $4, start_time = $5, end_time = $6,
			crosses_midnight = $7, end_day_of_week = $8, block_type = $9, block_message = $10,
			updated_at = NOW()
		WHERE id = $1`,
		id, req.Name, req.IsActive, req.DayOfWeek, req.StartTime, req.EndTime,
		req.CrossesMidnight, req.EndDayOfWeek, req.BlockType, req.BlockMessage)
	if err != nil {
		writeError(w, 500, "error updating schedule")
		return
	}

	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *CommerceScheduleHandler) deleteSchedule(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	_, err := h.Pool.Exec(r.Context(), `DELETE FROM commerce_schedule WHERE id = $1`, id)
	if err != nil {
		writeError(w, 500, "error deleting schedule")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *CommerceScheduleHandler) toggleCommerceHours(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var req struct {
		Enabled bool   `json:"enabled"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE public_settings SET commerce_hours_enabled = $2, commerce_hours_message = $3
		WHERE node_domain = $1`,
		nodeDomain, req.Enabled, req.Message)
	if err != nil {
		writeError(w, 500, "error updating commerce hours")
		return
	}

	writeJSON(w, 200, map[string]interface{}{"success": true})
}

// IsCommerceBlocked verifica si las transacciones comerciales estan bloqueadas
// en este momento para el nodo dado. Retorna (blocked, message).
func IsCommerceBlocked(pool *pgxpool.Pool, nodeDomain string) (bool, string) {
	// Verificar si esta activado
	var enabled bool
	err := pool.QueryRow(nil, `
		SELECT COALESCE(commerce_hours_enabled, false) FROM public_settings WHERE node_domain = $1`,
		nodeDomain).Scan(&enabled)
	if err != nil || !enabled {
		return false, ""
	}

	now := time.Now()
	dayOfWeek := int(now.Weekday()) // 0=Domingo, 6=Sabado
	hourMin := now.Format("15:04")

	// Buscar reglas activas que apliquen a este momento
	rows, err := pool.Query(nil, `
		SELECT block_type, block_message, day_of_week, start_time, end_time,
		       crosses_midnight, end_day_of_week
		FROM commerce_schedule
		WHERE node_domain = $1 AND is_active = true`, nodeDomain)
	if err != nil {
		return false, ""
	}
	defer rows.Close()

	for rows.Next() {
		var blockType, blockMessage string
		var dayOfWeekVal, endDayOfWeekVal *int
		var startTime, endTime *string
		var crossesMidnight bool

		if err := rows.Scan(&blockType, &blockMessage, &dayOfWeekVal, &startTime, &endTime,
			&crossesMidnight, &endDayOfWeekVal); err != nil {
			continue
		}

		// Verificar si el dia actual coincide
		if dayOfWeekVal != nil && *dayOfWeekVal != dayOfWeek {
			// Si crosses_midnight, verificar tambien end_day_of_week
			if !crossesMidnight || endDayOfWeekVal == nil || *endDayOfWeekVal != dayOfWeek {
				continue
			}
		}

		// Verificar hora
		if startTime != nil && endTime != nil {
			if crossesMidnight {
				// El bloqueo cruza medianoche
				// Si estamos en day_of_week, debemos estar despues de start_time
				// Si estamos en end_day_of_week, debemos estar antes de end_time
				if dayOfWeekVal != nil && *dayOfWeekVal == dayOfWeek {
					if hourMin >= *startTime {
						return true, blockMessage
					}
				}
				if endDayOfWeekVal != nil && *endDayOfWeekVal == dayOfWeek {
					if hourMin <= *endTime {
						return true, blockMessage
					}
				}
				// Si estamos entre los dos dias, tambien bloqueado
				if dayOfWeekVal != nil && endDayOfWeekVal != nil {
					if *dayOfWeekVal < *endDayOfWeekVal {
						if dayOfWeek > *dayOfWeekVal && dayOfWeek < *endDayOfWeekVal {
							return true, blockMessage
						}
					} else if *dayOfWeekVal > *endDayOfWeekVal {
						// Cruza de semana (ej: sabado -> domingo)
						if dayOfWeek > *dayOfWeekVal || dayOfWeek < *endDayOfWeekVal {
							return true, blockMessage
						}
					}
				}
			} else {
				// Bloqueo normal dentro del mismo dia
				if hourMin >= *startTime && hourMin <= *endTime {
					return true, blockMessage
				}
			}
		} else if startTime == nil && endTime == nil {
			// Bloqueo de dia completo
			return true, blockMessage
		}
	}

	return false, ""
}
