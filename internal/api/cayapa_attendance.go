package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CayapaAttendanceHandler maneja la asistencia masiva a cayapas
// via NFC o codigo QR. El coordinador abre el check-in, los participantes
// se registran acercando su tarjeta NFC o mostrando su codigo QR.
type CayapaAttendanceHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func (h *CayapaAttendanceHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Abrir/cerrar check-in y check-out
	r.With(am.RequirePermission("config.manage")).Post("/api/community-work/sessions/{id}/check-in/open", h.openCheckIn)
	r.With(am.RequirePermission("config.manage")).Post("/api/community-work/sessions/{id}/check-in/close", h.closeCheckIn)
	r.With(am.RequirePermission("config.manage")).Post("/api/community-work/sessions/{id}/check-out/open", h.openCheckOut)
	r.With(am.RequirePermission("config.manage")).Post("/api/community-work/sessions/{id}/check-out/close", h.closeCheckOut)
	// Registrar asistencia (NFC o QR)
	r.Post("/api/community-work/sessions/{id}/attend", h.registerAttendance)
	r.Post("/api/community-work/sessions/{id}/attend/qr", h.registerAttendanceQR)
	r.Post("/api/community-work/sessions/{id}/checkout", h.checkOut)
	// Cerrar cayapa y acreditar TQ
	r.With(am.RequirePermission("config.manage")).Post("/api/community-work/sessions/{id}/close-cayapa", h.closeCayapa)
	// Listar asistencia
	r.Get("/api/community-work/sessions/{id}/attendance", h.listAttendance)
	// Configuracion de asistencia
	r.Get("/api/attendance/config", h.getAttendanceConfig)
	r.With(am.RequirePermission("config.manage")).Post("/api/attendance/config", h.updateAttendanceConfig)
	// Generar codigo QR de un usuario para asistencia
	r.Get("/api/attendance/my-qr", h.getMyAttendanceQR)
}

func generateCheckInCode() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func (h *CayapaAttendanceHandler) openCheckIn(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	if sessionID == "" {
		writeError(w, 400, "id requerido")
		return
	}

	code := generateCheckInCode()
	_, err := h.Pool.Exec(r.Context(), `
		UPDATE community_work_sessions
		SET check_in_open = true, check_in_code = $2
		WHERE id = $1`, sessionID, code)
	if err != nil {
		writeError(w, 500, "error opening check-in")
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"success":       true,
		"check_in_code": code,
		"message":       "Check-in abierto. Los participantes pueden registrarse ahora.",
	})
}

func (h *CayapaAttendanceHandler) closeCheckIn(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	_, err := h.Pool.Exec(r.Context(), `
		UPDATE community_work_sessions SET check_in_open = false WHERE id = $1`, sessionID)
	if err != nil {
		writeError(w, 500, "error closing check-in")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true, "message": "Check-in cerrado."})
}

func (h *CayapaAttendanceHandler) openCheckOut(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	_, err := h.Pool.Exec(r.Context(), `
		UPDATE community_work_sessions SET check_out_open = true WHERE id = $1`, sessionID)
	if err != nil {
		writeError(w, 500, "error opening check-out")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true, "message": "Check-out abierto."})
}

func (h *CayapaAttendanceHandler) closeCheckOut(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	_, err := h.Pool.Exec(r.Context(), `
		UPDATE community_work_sessions SET check_out_open = false WHERE id = $1`, sessionID)
	if err != nil {
		writeError(w, 500, "error closing check-out")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true, "message": "Check-out cerrado."})
}

// registerAttendance: el participante acerca su tarjeta NFC o el encargado
// escanea el QR del participante para registrar el check-in.
func (h *CayapaAttendanceHandler) registerAttendance(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	if sessionID == "" {
		writeError(w, 400, "id requerido")
		return
	}

	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "no autenticado")
		return
	}

	// Verificar que el check-in este abierto
	var checkInOpen bool
	h.Pool.QueryRow(r.Context(), `SELECT check_in_open FROM community_work_sessions WHERE id = $1`, sessionID).Scan(&checkInOpen)
	if !checkInOpen {
		writeError(w, 403, "El check-in no esta abierto")
		return
	}

	// Registrar asistencia
	registeredBy, _ := getUserID(r)
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO cayapa_attendance (session_id, user_id, method, check_in_at, registered_by)
		VALUES ($1, $2, $3, NOW(), $4)
		ON CONFLICT (session_id, user_id) DO UPDATE
		SET check_in_at = NOW(), method = $3`,
		sessionID, userID, "nfc", registeredBy)
	if err != nil {
		writeError(w, 500, "error registering attendance")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"message": "Check-in registrado",
		"time":    time.Now().Format("15:04:05"),
	})
}

// registerAttendanceQR: el encargado escanea el QR del participante.
// El QR contiene el user_id del participante.
func (h *CayapaAttendanceHandler) registerAttendanceQR(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	if sessionID == "" {
		writeError(w, 400, "id requerido")
		return
	}

	encargadoID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "no autenticado")
		return
	}

	var body struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.UserID == "" {
		writeError(w, 400, "user_id requerido en el QR")
		return
	}

	// Verificar que el check-in este abierto
	var checkInOpen bool
	h.Pool.QueryRow(r.Context(), `SELECT check_in_open FROM community_work_sessions WHERE id = $1`, sessionID).Scan(&checkInOpen)
	if !checkInOpen {
		writeError(w, 403, "El check-in no esta abierto")
		return
	}

	// Registrar asistencia del participante (escaneado por el encargado)
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO cayapa_attendance (session_id, user_id, method, check_in_at, registered_by)
		VALUES ($1, $2, 'qr', NOW(), $3)
		ON CONFLICT (session_id, user_id) DO UPDATE
		SET check_in_at = NOW(), method = 'qr', registered_by = $3`,
		sessionID, body.UserID, encargadoID)
	if err != nil {
		writeError(w, 500, "error registering QR attendance")
		return
	}

	// Obtener nombre del participante
	var displayName string
	h.Pool.QueryRow(r.Context(), `SELECT display_name FROM users WHERE id = $1`, body.UserID).Scan(&displayName)

	writeJSON(w, 200, map[string]interface{}{
		"success":      true,
		"user_id":      body.UserID,
		"display_name": displayName,
		"message":      "Check-in registrado via QR para " + displayName,
		"time":         time.Now().Format("15:04:05"),
	})
}

func (h *CayapaAttendanceHandler) checkOut(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	if sessionID == "" {
		writeError(w, 400, "id requerido")
		return
	}

	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "no autenticado")
		return
	}

	// Verificar que el check-out este abierto
	var checkOutOpen bool
	h.Pool.QueryRow(r.Context(), `SELECT check_out_open FROM community_work_sessions WHERE id = $1`, sessionID).Scan(&checkOutOpen)
	if !checkOutOpen {
		writeError(w, 403, "El check-out no esta abierto")
		return
	}

	// Calcular horas trabajadas
	var checkInAt *time.Time
	h.Pool.QueryRow(r.Context(), `SELECT check_in_at FROM cayapa_attendance WHERE session_id = $1 AND user_id = $2`, sessionID, userID).Scan(&checkInAt)
	if checkInAt == nil {
		writeError(w, 400, "No tienes check-in registrado")
		return
	}

	hoursWorked := time.Since(*checkInAt).Hours()

	_, err = h.Pool.Exec(r.Context(), `
		UPDATE cayapa_attendance
		SET check_out_at = NOW(), hours_worked = $3
		WHERE session_id = $1 AND user_id = $2`,
		sessionID, userID, hoursWorked)
	if err != nil {
		writeError(w, 500, "error checking out")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success":      true,
		"hours_worked": hoursWorked,
		"message":      "Check-out registrado. Trabajaste " + fmt.Sprintf("%.1f", hoursWorked) + " horas.",
	})
}

// closeCayapa: cierra la cayapa y acredita TQ a todos los participantes
func (h *CayapaAttendanceHandler) closeCayapa(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	if sessionID == "" {
		writeError(w, 400, "id requerido")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	// Obtener configuracion de asistencia
	var effortFactor float64
	var autoCredit bool
	h.Pool.QueryRow(r.Context(), `
		SELECT effort_factor, auto_credit_on_close FROM attendance_config WHERE node_domain = $1`,
		nodeDomain).Scan(&effortFactor, &autoCredit)
	if effortFactor == 0 {
		effortFactor = 1.0
	}

	// Obtener valor TQ por hora (de la tarifa energetica)
	var tqPerHour float64 = 1.0 // 1 TQ = 1 kWh, 1 hora de trabajo = ~1 kWh

	// Listar todos los participantes con check-in
	rows, err := h.Pool.Query(r.Context(), `
		SELECT user_id, check_in_at, check_out_at, hours_worked
		FROM cayapa_attendance WHERE session_id = $1 AND check_in_at IS NOT NULL`, sessionID)
	if err != nil {
		writeError(w, 500, "error listing attendance")
		return
	}
	defer rows.Close()

	type participant struct {
		UserID      string
		HoursWorked float64
		TQCredited  float64
	}
	var participants []participant
	totalCredited := 0.0

	for rows.Next() {
		var userID string
		var checkInAt *time.Time
		var checkOutAt *time.Time
		var hoursWorked *float64
		rows.Scan(&userID, &checkInAt, &checkOutAt, &hoursWorked)

		hours := 0.0
		if hoursWorked != nil && *hoursWorked > 0 {
			hours = *hoursWorked
		} else if checkOutAt != nil && checkInAt != nil {
			hours = checkOutAt.Sub(*checkInAt).Hours()
		} else if checkInAt != nil {
			// Si no hizo check-out, contar hasta ahora
			hours = time.Since(*checkInAt).Hours()
		}

		// Aplicar factor de esfuerzo agricola
		tq := hours * tqPerHour * effortFactor
		participants = append(participants, participant{userID, hours, tq})
		totalCredited += tq
	}

	// Acreditar TQ a cada participante
	for _, p := range participants {
		h.Pool.Exec(r.Context(), `
			UPDATE cayapa_attendance
			SET tq_credited = $3, hours_worked = $4
			WHERE session_id = $1 AND user_id = $2`,
			sessionID, p.UserID, p.TQCredited, p.HoursWorked)

		// TODO: Acreditar TQ al balance del usuario via ledger
		// (requiere integracion con el sistema de pagos)
	}

	// Marcar la sesion como completada
	h.Pool.Exec(r.Context(), `
		UPDATE community_work_sessions SET status = 'completed' WHERE id = $1`, sessionID)

	writeJSON(w, 200, map[string]interface{}{
		"success":        true,
		"participants":   len(participants),
		"total_credited": totalCredited,
		"effort_factor":  effortFactor,
		"message":        "Cayapa cerrada. " + fmt.Sprintf("%d", len(participants)) + " participantes acreditados con " + fmt.Sprintf("%.2f", totalCredited) + " TQ total.",
	})
}

func (h *CayapaAttendanceHandler) listAttendance(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	if sessionID == "" {
		writeError(w, 400, "id requerido")
		return
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT ca.user_id, u.username, u.display_name,
		       ca.method, ca.check_in_at, ca.check_out_at,
		       ca.hours_worked, ca.tq_credited, ca.registered_by
		FROM cayapa_attendance ca
		JOIN users u ON u.id = ca.user_id
		WHERE ca.session_id = $1
		ORDER BY ca.check_in_at`, sessionID)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"attendance": []map[string]interface{}{}})
		return
	}
	defer rows.Close()

	var attendance []map[string]interface{}
	for rows.Next() {
		var userID, username, displayName, method *string
		var checkInAt, checkOutAt interface{}
		var hoursWorked, tqCredited *float64
		var registeredBy *string
		rows.Scan(&userID, &username, &displayName, &method, &checkInAt, &checkOutAt, &hoursWorked, &tqCredited, &registeredBy)
		a := map[string]interface{}{
			"user_id":       userID,
			"username":      username,
			"display_name":  displayName,
			"method":        method,
			"check_in_at":   checkInAt,
			"check_out_at":  checkOutAt,
			"hours_worked":  hoursWorked,
			"tq_credited":   tqCredited,
			"registered_by": registeredBy,
		}
		attendance = append(attendance, a)
	}
	if attendance == nil {
		attendance = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"attendance": attendance})
}

func (h *CayapaAttendanceHandler) getAttendanceConfig(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var qrEnabled, nfcEnabled, requireCheckOut, autoCredit *bool
	var effortFactor *float64
	var debitAccountID *string
	err := h.Pool.QueryRow(r.Context(), `
		SELECT qr_enabled, nfc_enabled, require_check_out, auto_credit_on_close, effort_factor, debit_account_id
		FROM attendance_config WHERE node_domain = $1`, nodeDomain).Scan(
		&qrEnabled, &nfcEnabled, &requireCheckOut, &autoCredit, &effortFactor, &debitAccountID)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"qr_enabled":           true,
			"nfc_enabled":          true,
			"require_check_out":    false,
			"auto_credit_on_close": true,
			"effort_factor":        1.0,
		})
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"qr_enabled":           qrEnabled,
		"nfc_enabled":          nfcEnabled,
		"require_check_out":    requireCheckOut,
		"auto_credit_on_close": autoCredit,
		"effort_factor":        effortFactor,
		"debit_account_id":     debitAccountID,
	})
}

func (h *CayapaAttendanceHandler) updateAttendanceConfig(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var body struct {
		QREnabled         bool    `json:"qr_enabled"`
		NFCEnabled        bool    `json:"nfc_enabled"`
		RequireCheckOut   bool    `json:"require_check_out"`
		AutoCreditOnClose bool    `json:"auto_credit_on_close"`
		EffortFactor      float64 `json:"effort_factor"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if body.EffortFactor <= 0 {
		body.EffortFactor = 1.0
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO attendance_config (node_domain, qr_enabled, nfc_enabled, require_check_out, auto_credit_on_close, effort_factor)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (node_domain) DO UPDATE
		SET qr_enabled = $2, nfc_enabled = $3, require_check_out = $4,
		    auto_credit_on_close = $5, effort_factor = $6, updated_at = NOW()`,
		nodeDomain, body.QREnabled, body.NFCEnabled, body.RequireCheckOut, body.AutoCreditOnClose, body.EffortFactor)
	if err != nil {
		writeError(w, 500, "error saving attendance config")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

// getMyAttendanceQR: genera un codigo QR para que el usuario lo muestre
// al encargado de la cayapa para registrar su asistencia.
func (h *CayapaAttendanceHandler) getMyAttendanceQR(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "no autenticado")
		return
	}

	// Obtener info del usuario
	var displayName, username string
	h.Pool.QueryRow(r.Context(), `SELECT display_name, username FROM users WHERE id = $1`, userID).Scan(&displayName, &username)

	// El QR contiene el user_id para que el encargado lo escanee
	writeJSON(w, 200, map[string]interface{}{
		"user_id":      userID,
		"display_name": displayName,
		"username":     username,
		"qr_data":      userID, // El encargado escanea esto y lo envia a /attend/qr
		"message":      "Muestra este codigo QR al encargado de la cayapa para registrar tu asistencia.",
	})
}
