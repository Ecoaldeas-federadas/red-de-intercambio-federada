package api

import (
	"context"
	"encoding/json"
	"federated-credit-node/internal/db"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AssemblyHandler maneja sesiones, propuestas, votos y junta directiva
type AssemblyHandler struct {
	Pool       *pgxpool.Pool
	Auth       *AuthMiddleware
	nodeDomain string
}

// RegisterRoutes registra las rutas de asamblea
func (h *AssemblyHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Sesiones
	r.With(am.RequireAuth).Get("/api/assembly/sessions", h.listSessions)
	r.With(am.RequireAuth).Post("/api/assembly/sessions", h.createSession)
	r.With(am.RequireAuth).Put("/api/assembly/sessions/{id}", h.updateSession)
	r.With(am.RequireAuth).Put("/api/assembly/sessions/{id}/minutes", h.updateMinutes)
	r.With(am.RequireAuth).Post("/api/assembly/sessions/{id}/reschedule", h.rescheduleSession)
	r.With(am.RequirePermission("assembly.verify_quorum")).Post("/api/assembly/sessions/{id}/verify-quorum", h.verifyQuorum)

	// Asistencia
	r.With(am.RequireAuth).Get("/api/assembly/sessions/{id}/attendance", h.listAttendance)
	r.With(am.RequirePermission("assembly.take_attendance")).Post("/api/assembly/sessions/{id}/attendance", h.registerAttendance)
	r.With(am.RequirePermission("assembly.take_attendance")).Delete("/api/assembly/sessions/{id}/attendance/{userId}", h.removeAttendance)
	r.With(am.RequireAuth).Get("/api/assembly/attendance/history", h.getAttendanceHistory)

	// Auto-confirmacion de asistencia (el miembro confirma su presencia)
	r.With(am.RequireAuth).Post("/api/assembly/attendance/confirm/{token}", h.confirmAttendance)
	r.With(am.RequireAuth).Post("/api/assembly/sessions/{id}/self-checkin", h.selfCheckIn)

	// Configuracion de quorum
	r.With(am.RequireAuth).Get("/api/assembly/quorum-config", h.getQuorumConfig)
	r.With(am.RequireAuth).Put("/api/assembly/quorum-config/{sessionType}", h.updateQuorumConfig)

	// Convocatoria y frecuencia
	r.With(am.RequireAuth).Get("/api/assembly/frequency-config", h.getFrequencyConfig)
	r.With(am.RequireAuth).Put("/api/assembly/frequency-config", h.updateFrequencyConfig)
	r.With(am.RequireAuth).Post("/api/assembly/sessions/{id}/close", h.closeSession)
	r.With(am.RequireAuth).Get("/api/assembly/notifications", h.getNotifications)
	r.With(am.RequireAuth).Put("/api/assembly/notifications/{id}/read", h.markNotificationRead)

	// Tipos de propuestas por scope
	r.With(am.RequireAuth).Get("/api/assembly/proposal-types", h.getProposalTypes)

	// Propuestas / decisiones
	r.With(am.RequireAuth).Get("/api/assembly/proposals", h.listProposals)
	r.With(am.RequireAuth).Post("/api/assembly/proposals", h.createProposal)
	r.With(am.RequireAuth).Delete("/api/assembly/proposals/{id}", h.deleteProposal)
	r.With(am.RequirePermission("assembly.open_voting")).Post("/api/assembly/proposals/{id}/open-voting", h.openVoting)
	r.With(am.RequireAuth).Post("/api/assembly/proposals/{id}/vote", h.voteProposal)
	r.With(am.RequireAuth).Post("/api/assembly/proposals/{id}/execute", h.executeProposal)

	// Informes de votacion
	r.With(am.RequireAuth).Get("/api/assembly/proposals/{id}/report", h.getProposalReport)
	r.With(am.RequireAuth).Get("/api/assembly/reports", h.listVotingReports)

	// Junta directiva
	r.With(am.RequireAuth).Get("/api/assembly/board", h.listBoard)
	r.With(am.RequirePermission("assembly.manage_board")).Post("/api/assembly/board", h.assignBoardMember)
	r.With(am.RequirePermission("assembly.manage_board")).Delete("/api/assembly/board/{id}", h.removeBoardMember)

	// Miembros con derecho a voto (viene de member_levels, no se registran aparte)
	r.With(am.RequireAuth).Get("/api/assembly/voting-members", h.listVotingMembers)

	// Configuracion de umbrales por tipo de propuesta
	r.With(am.RequireAuth).Get("/api/assembly/config", h.listAssemblyConfig)
	r.With(am.RequireAuth).Put("/api/assembly/config/{proposalType}", h.updateAssemblyConfig)
	// Verifica si el usuario actual puede hacer un cambio directo o necesita propuesta
	r.With(am.RequireAuth).Get("/api/assembly/check-permission/{proposalType}", h.checkDirectPermission)
}

// ===== Sesiones =====

func (h *AssemblyHandler) listSessions(w http.ResponseWriter, r *http.Request) {
	filter := r.URL.Query().Get("filter")
	meetingType := r.URL.Query().Get("meeting_type")
	if meetingType == "" {
		meetingType = "assembly"
	}

	query := `SELECT id, node_domain, session_type, title, description, start_time, end_time, status, created_at,
		       is_presential, minutes, recall_number, original_scheduled_time, quorum_verified, quorum_checked_at, meeting_type
		FROM assembly_sessions WHERE meeting_type = $1`

	switch filter {
	case "upcoming":
		query += ` AND status IN ('scheduled', 'waiting_quorum', 'active') ORDER BY start_time ASC LIMIT 50`
	case "past":
		query += ` AND status IN ('completed', 'cancelled', 'expired') ORDER BY start_time DESC LIMIT 50`
	default:
		query += ` ORDER BY created_at DESC LIMIT 50`
	}
	rows, err := h.Pool.Query(r.Context(), query, meetingType)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	var sessions []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var nodeDomain, sessionType, title, status, meetingType string
		var description *string
		var startTime time.Time
		var endTime *time.Time
		var createdAt time.Time
		var isPresential bool
		var minutes *string
		var recallNumber int
		var originalScheduledTime *time.Time
		var quorumVerified bool
		var quorumCheckedAt *time.Time
		if err := rows.Scan(&id, &nodeDomain, &sessionType, &title, &description, &startTime, &endTime, &status, &createdAt, &isPresential, &minutes, &recallNumber, &originalScheduledTime, &quorumVerified, &quorumCheckedAt, &meetingType); err != nil {
			continue
		}
		sessions = append(sessions, map[string]interface{}{
			"id":                      id.String(),
			"session_type":            sessionType,
			"meeting_type":            meetingType,
			"title":                   title,
			"description":             deref(description),
			"start_time":              startTime,
			"end_time":                derefTime(endTime),
			"status":                  status,
			"created_at":              createdAt,
			"is_presential":           isPresential,
			"minutes":                 deref(minutes),
			"recall_number":           recallNumber,
			"original_scheduled_time": derefTime(originalScheduledTime),
			"quorum_verified":         quorumVerified,
			"quorum_checked_at":       derefTime(quorumCheckedAt),
		})
	}
	if sessions == nil {
		sessions = []map[string]interface{}{}
	}
	writeJSON(w, 200, sessions)
}

type CreateAssemblySessionRequest struct {
	SessionType  string `json:"session_type"`
	MeetingType  string `json:"meeting_type"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	StartTimeStr string `json:"start_time"`
	IsPresential bool   `json:"is_presential"`
}

func (h *AssemblyHandler) createSession(w http.ResponseWriter, r *http.Request) {
	var req CreateAssemblySessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Title == "" {
		writeError(w, 400, "title is required")
		return
	}
	if req.SessionType == "" {
		req.SessionType = "ordinaria"
	}
	if req.MeetingType == "" {
		req.MeetingType = "assembly"
	}
	if req.MeetingType != "assembly" && req.MeetingType != "board" {
		req.MeetingType = "assembly"
	}

	// La fecha es obligatoria - no se puede crear una asamblea para "ahora mismo"
	if req.StartTimeStr == "" {
		writeError(w, 400, "debes especificar la fecha y hora de la asamblea. No se puede crear una asamblea para 'ahora mismo'.")
		return
	}

	startTime, err := time.Parse(time.RFC3339, req.StartTimeStr)
	if err != nil {
		writeError(w, 400, "formato de fecha invalido. Usa ISO 8601 (ej: 2024-03-15T15:00:00Z)")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	// Validar tiempo minimo de anticipacion segun tipo
	var minAdvanceHours int
	switch req.SessionType {
	case "ordinaria":
		minAdvanceHours = 168 // 7 dias
	case "extraordinaria":
		minAdvanceHours = 24
	case "urgente":
		minAdvanceHours = 1
	default:
		minAdvanceHours = 24
	}

	// Leer config personalizada si existe
	var customMinHours int
	h.Pool.QueryRow(r.Context(), `
		SELECT CASE WHEN $1 = 'ordinaria' THEN min_advance_ordinary_hours
		            WHEN $1 = 'extraordinaria' THEN min_advance_extraordinary_hours
		            WHEN $1 = 'urgente' THEN min_advance_urgent_hours
		            ELSE 24 END
		FROM assembly_frequency_config
		WHERE node_domain = $2 AND scope = 'node' AND scope_id IS NULL`,
		req.SessionType, nodeDomain).Scan(&customMinHours)
	if customMinHours > 0 {
		minAdvanceHours = customMinHours
	}

	now := time.Now()
	minStartTime := now.Add(time.Duration(minAdvanceHours) * time.Hour)
	if startTime.Before(minStartTime) {
		writeError(w, 400, fmt.Sprintf(
			"Una asamblea %s debe crearse con al menos %d horas de anticipacion. La fecha mas cercana posible es %s.",
			req.SessionType, minAdvanceHours, minStartTime.Format("02/01/2006 a las 15:04")))
		return
	}

	id := uuid.New()
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO assembly_sessions (id, node_domain, session_type, meeting_type, title, description, start_time, status, is_presential)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8)`,
		id, nodeDomain, req.SessionType, req.MeetingType, req.Title, req.Description, startTime, req.IsPresential)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Notificar a los miembros de la convocatoria
	label := "Asamblea"
	if req.MeetingType == "board" {
		label = "Junta Directiva"
	}
	notifyMembers(h.Pool, nodeDomain, "node", nil, &id,
		fmt.Sprintf("Convocatoria a %s %s", label, req.SessionType),
		fmt.Sprintf("Se ha convocado una %s %s para el %s. Tema: %s", label, req.SessionType, startTime.Format("02/01/2006 a las 15:04"), req.Title),
		"convocation")

	// Tambien notificar via el sistema unificado de notificaciones
	notify := NewNotifyService(h.Pool)
	if req.MeetingType == "board" {
		// Junta directiva: notificar solo a miembros de la junta
		notify.NotifyBoard(r.Context(), nodeDomain, "board_scheduled",
			fmt.Sprintf("Junta Directiva %s programada", req.SessionType),
			fmt.Sprintf("Se ha convocado una junta directiva %s para el %s. Tema: %s", req.SessionType, startTime.Format("02/01/2006 a las 15:04"), req.Title),
			"/app/assembly?tab=sessions&meeting_type=board",
			map[string]interface{}{"session_id": id.String(), "session_type": req.SessionType, "meeting_type": req.MeetingType, "start_time": startTime.Format(time.RFC3339)})
	} else {
		notify.NotifyVotingMembers(r.Context(), nodeDomain, "assembly_scheduled",
			fmt.Sprintf("Asamblea %s programada", req.SessionType),
			fmt.Sprintf("Se ha convocado una asamblea %s para el %s. Tema: %s", req.SessionType, startTime.Format("02/01/2006 a las 15:04"), req.Title),
			"/app/assembly",
			map[string]interface{}{"session_id": id.String(), "session_type": req.SessionType, "meeting_type": req.MeetingType, "start_time": startTime.Format(time.RFC3339)})
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":           id.String(),
		"session_type": req.SessionType,
		"meeting_type": req.MeetingType,
		"title":        req.Title,
		"description":  req.Description,
		"start_time":   startTime,
		"status":       "scheduled",
		"message":      "Asamblea creada. Los miembros han sido notificados.",
	})
}

// ===== Propuestas / Decisiones =====

func (h *AssemblyHandler) listProposals(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	// Total de miembros con derecho a voto para calcular no-votantes
	var totalVotingMembers int
	h.Pool.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM users u
		JOIN member_levels ml ON ml.id = u.member_level_id
		WHERE u.node_domain = $1 AND u.membership_status = 'active'
		AND ml.has_vote = true AND ml.counts_in_quorum = true`, nodeDomain).Scan(&totalVotingMembers)

	rows, err := h.Pool.Query(r.Context(), `
		SELECT d.id, d.assembly_id, d.decision_type, d.description, d.target_account,
		       d.old_value, d.new_value, d.required_signatures, d.status, d.executed_at, d.created_at,
		       d.voting_deadline, d.voting_duration_minutes,
		       COALESCE(sv.votes_for, 0) as votes_for,
		       COALESCE(sv.votes_against, 0) as votes_against,
		       COALESCE(sv.votes_abstain, 0) as votes_abstain
		FROM assembly_decisions d
		LEFT JOIN (
			SELECT decision_id,
				COUNT(*) FILTER (WHERE vote = 'for') as votes_for,
				COUNT(*) FILTER (WHERE vote = 'against') as votes_against,
				COUNT(*) FILTER (WHERE vote = 'abstain') as votes_abstain
			FROM assembly_votes GROUP BY decision_id
		) sv ON sv.decision_id = d.id
		ORDER BY d.created_at DESC LIMIT 100`)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	var proposals []map[string]interface{}
	for rows.Next() {
		var id, assemblyID uuid.UUID
		var decisionType, description, status string
		var targetAccount *uuid.UUID
		var oldValue, newValue *[]byte
		var requiredSignatures int
		var executedAt *time.Time
		var createdAt time.Time
		var votingDeadline *time.Time
		var votingDurationMinutes *int
		var votesFor, votesAgainst, votesAbstain int

		if err := rows.Scan(&id, &assemblyID, &decisionType, &description, &targetAccount,
			&oldValue, &newValue, &requiredSignatures, &status, &executedAt, &createdAt,
			&votingDeadline, &votingDurationMinutes,
			&votesFor, &votesAgainst, &votesAbstain); err != nil {
			continue
		}

		var oldVal, newVal interface{}
		if oldValue != nil {
			json.Unmarshal(*oldValue, &oldVal)
		}
		if newValue != nil {
			json.Unmarshal(*newValue, &newVal)
		}

		totalVotes := votesFor + votesAgainst + votesAbstain
		notVoted := totalVotingMembers - totalVotes
		if notVoted < 0 {
			notVoted = 0
		}

		proposals = append(proposals, map[string]interface{}{
			"id":                      id.String(),
			"proposal_type":           decisionType,
			"description":             description,
			"target":                  derefUUID(targetAccount),
			"old_value":               oldVal,
			"new_value":               newVal,
			"required_signatures":     requiredSignatures,
			"status":                  status,
			"executed_at":             derefTime(executedAt),
			"created_at":              createdAt,
			"voting_deadline":         derefTime(votingDeadline),
			"voting_duration_minutes": derefInt(votingDurationMinutes),
			"votes_for":               votesFor,
			"votes_against":           votesAgainst,
			"votes_abstain":           votesAbstain,
			"votes_not_cast":          notVoted,
			"total_voting_members":    totalVotingMembers,
		})
	}
	if proposals == nil {
		proposals = []map[string]interface{}{}
	}
	writeJSON(w, 200, proposals)
}

type CreateProposalRequest struct {
	ProposalType          string                 `json:"proposal_type"`
	Title                 string                 `json:"title"`
	Description           string                 `json:"description"`
	Parameters            map[string]interface{} `json:"parameters"`
	TargetAccountID       string                 `json:"target_account_id"`
	RequiredSignatures    int                    `json:"required_signatures"`
	VotingDurationMinutes int                    `json:"voting_duration_minutes"`
}

func (h *AssemblyHandler) createProposal(w http.ResponseWriter, r *http.Request) {
	var req CreateProposalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.ProposalType == "" {
		writeError(w, 400, "proposal_type is required")
		return
	}

	// Prevenir propuestas duplicadas: si el usuario ya tiene una propuesta
	// pendiente del mismo tipo, reemplazarla en lugar de crear otra.
	userID, _ := h.Auth.GetUserID(r)
	var existingID *uuid.UUID
	h.Pool.QueryRow(r.Context(), `
		SELECT id FROM assembly_decisions
		WHERE decision_type = $1 AND status = 'proposed'
		AND id IN (SELECT target_id FROM audit_log WHERE actor_id = $2 AND action = 'assembly_decision')
		ORDER BY created_at DESC LIMIT 1`,
		req.ProposalType, userID).Scan(&existingID)

	if req.RequiredSignatures == 0 {
		req.RequiredSignatures = 1
	}
	// Duracion de votacion por defecto: 24 horas
	if req.VotingDurationMinutes == 0 {
		req.VotingDurationMinutes = 1440
	}

	// Crear sesion si no existe una activa
	var sessionID uuid.UUID
	err := h.Pool.QueryRow(r.Context(), `
		SELECT id FROM assembly_sessions WHERE status IN ('scheduled', 'active') ORDER BY created_at DESC LIMIT 1`).Scan(&sessionID)
	if err != nil {
		// Crear sesion automaticamente
		sessionID = uuid.New()
		nodeDomain := r.Header.Get("X-Node-Domain")
		nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
		_, _ = h.Pool.Exec(r.Context(), `
			INSERT INTO assembly_sessions (id, node_domain, session_type, title, start_time, status)
			VALUES ($1, $2, 'ordinaria', 'Sesion automatica', NOW(), 'active')`,
			sessionID, nodeDomain)
	}

	// Serializar parametros como new_value
	var newValue []byte
	if req.Parameters != nil {
		newValue, _ = json.Marshal(req.Parameters)
	} else {
		newValue, _ = json.Marshal(map[string]interface{}{"title": req.Title})
	}

	// Target account
	var targetAccount *uuid.UUID
	if req.TargetAccountID != "" {
		if id, err := uuid.Parse(req.TargetAccountID); err == nil {
			targetAccount = &id
		}
	}

	id := uuid.New()
	if existingID != nil {
		// Reemplazar la propuesta existente del mismo usuario y tipo
		_, err = h.Pool.Exec(r.Context(), `
			UPDATE assembly_decisions
			SET description = $1, new_value = $2, required_signatures = $3,
			    voting_duration_minutes = $4, status = 'proposed', created_at = NOW()
			WHERE id = $5`,
			req.Description, newValue, req.RequiredSignatures, req.VotingDurationMinutes, *existingID)
		id = *existingID
	} else {
		_, err = h.Pool.Exec(r.Context(), `
			INSERT INTO assembly_decisions (id, assembly_id, decision_type, target_account, description, new_value, required_signatures, status, voting_duration_minutes)
			VALUES ($1, $2, $3, $4::uuid, $5, $6, $7, 'proposed', $8)`,
			id, sessionID, req.ProposalType, targetAccount, req.Description, newValue, req.RequiredSignatures, req.VotingDurationMinutes)
	}
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Audit log
	auditDetails, _ := json.Marshal(map[string]interface{}{"proposal_type": req.ProposalType, "description": req.Description})
	h.Pool.Exec(r.Context(), `INSERT INTO audit_log (actor_id, action, target_id, details) VALUES ($1, 'assembly_decision', $2, $3)`,
		userID, id, auditDetails)

	// Auto-agregar a la minuta solo si es nueva (no reemplazo)
	if existingID == nil {
		appendToMinutes(h.Pool, sessionID, fmt.Sprintf("- [Propuesta] %s: %s", req.ProposalType, req.Description))
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":                      id.String(),
		"proposal_type":           req.ProposalType,
		"description":             req.Description,
		"required_signatures":     req.RequiredSignatures,
		"status":                  "proposed",
		"voting_duration_minutes": req.VotingDurationMinutes,
		"message":                 "Propuesta creada. La asamblea debe aprobarla para abrir la votacion.",
	})
}

// deleteProposal permite al propietario eliminar su propuesta si aun esta pendiente (proposed)
func (h *AssemblyHandler) deleteProposal(w http.ResponseWriter, r *http.Request) {
	decisionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	// Verificar que la propuesta existe y esta pendiente
	var status string
	var actorID *uuid.UUID
	h.Pool.QueryRow(r.Context(), `
		SELECT d.status, a.actor_id
		FROM assembly_decisions d
		LEFT JOIN audit_log a ON a.target_id = d.id AND a.action = 'assembly_decision'
		WHERE d.id = $1
		ORDER BY a.created_at DESC LIMIT 1`,
		decisionID).Scan(&status, &actorID)

	if status == "" {
		writeError(w, 404, "propuesta no encontrada")
		return
	}
	if status != "proposed" {
		writeError(w, 400, "no se puede eliminar una propuesta que ya fue aprobada o esta en votacion")
		return
	}

	// El propietario puede eliminar, o alguien con permiso de gestion
	isOwner := actorID != nil && *actorID == userID
	canManage := false
	if !isOwner {
		var hasPerm bool
		h.Pool.QueryRow(r.Context(), `
			SELECT EXISTS(
				SELECT 1 FROM user_permissions up
				JOIN permissions p ON p.id = up.permission_id
				WHERE up.user_id = $1 AND p.name IN ('assembly.manage', 'assembly.manage_board', 'config.manage')
			)`, userID).Scan(&hasPerm)
		canManage = hasPerm
	}
	if !isOwner && !canManage {
		writeError(w, 403, "solo el autor o un administrador puede eliminar esta propuesta")
		return
	}

	_, err = h.Pool.Exec(r.Context(), `DELETE FROM assembly_decisions WHERE id = $1 AND status = 'proposed'`, decisionID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	// Tambien borrar el audit log relacionado
	h.Pool.Exec(r.Context(), `DELETE FROM audit_log WHERE target_id = $1 AND action = 'assembly_decision'`, decisionID)

	writeJSON(w, 200, map[string]interface{}{"message": "Propuesta eliminada"})
}

// appendToMinutes agrega una linea a la minuta de la sesion automaticamente
func appendToMinutes(pool *pgxpool.Pool, sessionID uuid.UUID, entry string) {
	timestamp := time.Now().Format("15:04")
	line := fmt.Sprintf("[%s] %s\n", timestamp, entry)
	pool.Exec(context.Background(), `
		UPDATE assembly_sessions
		SET minutes = COALESCE(minutes, '') || $1,
		    minutes_updated_at = NOW()
		WHERE id = $2`, line, sessionID)
}

// openVoting: la asamblea aprueba una propuesta para que se abra la votacion
// La duracion del voto se decide AQUI (en la asamblea), no al crear la propuesta.
func (h *AssemblyHandler) openVoting(w http.ResponseWriter, r *http.Request) {
	decisionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	// La asamblea decide la duracion del voto al abrirlo
	var req struct {
		VotingDurationMinutes int    `json:"voting_duration_minutes"`
		VotingMode            string `json:"voting_mode"` // "presencial" o "remoto"
	}
	if r.Body != nil {
		json.NewDecoder(r.Body).Decode(&req)
	}

	// Obtener estado actual y datos
	var status, decisionType, description string
	var assemblyID uuid.UUID
	h.Pool.QueryRow(r.Context(), `
		SELECT status, decision_type, description, assembly_id
		FROM assembly_decisions WHERE id = $1`, decisionID).
		Scan(&status, &decisionType, &description, &assemblyID)
	if status == "" {
		writeError(w, 404, "propuesta no encontrada")
		return
	}

	if status != "proposed" {
		writeError(w, 400, "esta propuesta no esta pendiente de revision (estado: "+status+")")
		return
	}

	// Duracion: la decide la asamblea al abrir la votacion
	votingDurationMinutes := req.VotingDurationMinutes
	if votingDurationMinutes == 0 {
		// Default segun modo
		if req.VotingMode == "presencial" {
			votingDurationMinutes = 10 // 10 min para asamblea presencial
		} else {
			votingDurationMinutes = 1440 // 24h para votacion remota
		}
	}

	userID, _ := h.Auth.GetUserID(r)

	// Abrir votacion: status = pending, calcular deadline con la duracion decidida
	_, err = h.Pool.Exec(r.Context(), `
		UPDATE assembly_decisions
		SET status = 'pending',
		    voting_duration_minutes = $1,
		    voting_deadline = NOW() + make_interval(mins => $1),
		    approved_for_voting_by = $2,
		    approved_for_voting_at = NOW()
		WHERE id = $3`,
		votingDurationMinutes, userID, decisionID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Auto-agregar a la minuta
	appendToMinutes(h.Pool, assemblyID, fmt.Sprintf("- [Votacion abierta] %s: %s (duracion: %d min)", decisionType, description, votingDurationMinutes))

	// Notificar a los miembros con voto
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
	notify := NewNotifyService(h.Pool)
	notify.NotifyVotingMembers(r.Context(), nodeDomain, "voting_opened",
		"Votacion abierta",
		fmt.Sprintf("Se ha abierto la votacion para: %s", description),
		"/app/assembly",
		map[string]interface{}{"decision_id": decisionID.String(), "decision_type": decisionType})

	writeJSON(w, 200, map[string]interface{}{
		"id":                      decisionID.String(),
		"status":                  "pending",
		"message":                 "Votacion abierta. Los miembros pueden votar ahora.",
		"voting_duration_minutes": votingDurationMinutes,
	})
}

type VoteRequest struct {
	Vote   string `json:"vote"`
	Reason string `json:"reason"`
}

func (h *AssemblyHandler) voteProposal(w http.ResponseWriter, r *http.Request) {
	decisionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	var req VoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Vote != "for" && req.Vote != "against" && req.Vote != "abstain" {
		writeError(w, 400, "vote must be 'for', 'against' or 'abstain'")
		return
	}

	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	// Verificar que la propuesta este activa y no vencida
	var status string
	var votingDeadline *time.Time
	var assemblyID uuid.UUID
	h.Pool.QueryRow(r.Context(), `SELECT status, voting_deadline, assembly_id FROM assembly_decisions WHERE id = $1`, decisionID).Scan(&status, &votingDeadline, &assemblyID)
	if status != "pending" {
		writeError(w, 400, "esta propuesta ya no acepta votos (estado: "+status+")")
		return
	}
	if votingDeadline != nil && votingDeadline.Before(time.Now()) {
		// Marcar como expirada
		h.Pool.Exec(r.Context(), `UPDATE assembly_decisions SET status = 'expired' WHERE id = $1`, decisionID)
		writeError(w, 400, "el tiempo de votacion ha expirado")
		return
	}

	// Verificar si la sesion es presencial
	var isPresential bool
	var sessionMeetingType string
	h.Pool.QueryRow(r.Context(), `SELECT is_presential, COALESCE(meeting_type, 'assembly') FROM assembly_sessions WHERE id = $1`, assemblyID).Scan(&isPresential, &sessionMeetingType)
	if isPresential {
		// En asamblea presencial, solo pueden votar los que estan en la lista de asistencia
		var isPresent int
		h.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM assembly_attendance WHERE session_id = $1 AND user_id = $2`, assemblyID, userID).Scan(&isPresent)
		if isPresent == 0 {
			writeError(w, 403, "esta votacion es presencial. Solo pueden votar los miembros presentes. No estas en la lista de asistencia.")
			return
		}
	}

	// Si es sesion de junta directiva, solo pueden votar miembros de la junta
	if sessionMeetingType == "board" {
		var isBoardMember int
		h.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM assembly_board_members WHERE user_id = $1 AND is_active = true`, userID).Scan(&isBoardMember)
		if isBoardMember == 0 {
			writeError(w, 403, "esta votacion es de junta directiva. Solo pueden votar los miembros de la junta.")
			return
		}
	}

	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO assembly_votes (decision_id, voter_id, vote, reason)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (decision_id, voter_id) DO UPDATE SET vote = $3, reason = $4`,
		decisionID, userID, req.Vote, req.Reason)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Contar votos
	var votesFor, votesAgainst, votesAbstain int
	h.Pool.QueryRow(r.Context(), `
		SELECT
			COUNT(*) FILTER (WHERE vote = 'for'),
			COUNT(*) FILTER (WHERE vote = 'against'),
			COUNT(*) FILTER (WHERE vote = 'abstain')
		FROM assembly_votes WHERE decision_id = $1`, decisionID).Scan(&votesFor, &votesAgainst, &votesAbstain)

	// Total de miembros con derecho a voto
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
	var totalVotingMembers int
	if sessionMeetingType == "board" {
		// Junta directiva: solo contar miembros activos de la junta
		h.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM assembly_board_members WHERE is_active = true`).Scan(&totalVotingMembers)
	} else {
		// Asamblea: todos los miembros con derecho a voto
		h.Pool.QueryRow(r.Context(), `
			SELECT COUNT(*) FROM users u
			JOIN member_levels ml ON ml.id = u.member_level_id
			WHERE u.node_domain = $1 AND u.membership_status = 'active'
			AND ml.has_vote = true AND ml.counts_in_quorum = true`, nodeDomain).Scan(&totalVotingMembers)
	}

	totalVotes := votesFor + votesAgainst + votesAbstain
	notVoted := totalVotingMembers - totalVotes
	if notVoted < 0 {
		notVoted = 0
	}

	writeJSON(w, 200, map[string]interface{}{
		"votes_for":            votesFor,
		"votes_against":        votesAgainst,
		"votes_abstain":        votesAbstain,
		"votes_not_cast":       notVoted,
		"total_voting_members": totalVotingMembers,
	})
}

func (h *AssemblyHandler) executeProposal(w http.ResponseWriter, r *http.Request) {
	decisionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	// Verificar que este aprobada
	var status string
	var decisionType string
	var description string
	var newValue *[]byte
	var targetAccount *uuid.UUID
	var collectedSignatures []byte
	var votingDeadline *time.Time
	var assemblyID uuid.UUID
	err = h.Pool.QueryRow(r.Context(), `
		SELECT status, decision_type, description, new_value, target_account, collected_signatures, voting_deadline, assembly_id FROM assembly_decisions WHERE id = $1`,
		decisionID).Scan(&status, &decisionType, &description, &newValue, &targetAccount, &collectedSignatures, &votingDeadline, &assemblyID)
	if err != nil {
		writeError(w, 404, "decision not found")
		return
	}
	// Auto-expirar si el deadline ya paso
	if status == "pending" && votingDeadline != nil && votingDeadline.Before(time.Now()) {
		h.Pool.Exec(r.Context(), `UPDATE assembly_decisions SET status = 'expired' WHERE id = $1`, decisionID)
		writeError(w, 400, "el tiempo de votacion ha expirado. Para revotar, crea una nueva propuesta.")
		return
	}
	if status != "approved" && status != "pending" {
		writeError(w, 400, "decision is not pending or approved")
		return
	}

	// Contar votos (incluyendo abstenciones)
	var votesFor, votesAgainst, votesAbstain int
	h.Pool.QueryRow(r.Context(), `
		SELECT COUNT(*) FILTER (WHERE vote = 'for'),
		       COUNT(*) FILTER (WHERE vote = 'against'),
		       COUNT(*) FILTER (WHERE vote = 'abstain')
		FROM assembly_votes WHERE decision_id = $1`, decisionID).Scan(&votesFor, &votesAgainst, &votesAbstain)

	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	// Determinar criterio de aprobacion segun assembly_config
	var approvalMethod string
	var requiredPercentage float64
	var requiredQuorum int
	var requiredSignatures int
	var totalVotingMembers int
	cfgErr := h.Pool.QueryRow(r.Context(), `
		SELECT approval_method, required_percentage, required_quorum, required_signatures
		FROM assembly_config WHERE node_domain = $1 AND proposal_type = $2 AND is_active = true`,
		nodeDomain, decisionType).Scan(&approvalMethod, &requiredPercentage, &requiredQuorum, &requiredSignatures)

	approved := false
	if cfgErr == nil {
		// Hay configuracion para este tipo de propuesta
		switch approvalMethod {
		case "assembly":
			// Total de miembros con derecho a voto que cuentan en el quorum
			h.Pool.QueryRow(r.Context(), `
				SELECT COUNT(*) FROM users u
				JOIN member_levels ml ON ml.id = u.member_level_id
				WHERE u.node_domain = $1 AND u.membership_status = 'active'
				AND ml.has_vote = true AND ml.counts_in_quorum = true`, nodeDomain).Scan(&totalVotingMembers)

			totalVotes := votesFor + votesAgainst
			// Verificar quorum si esta configurado
			quorumMet := true
			if requiredQuorum > 0 {
				quorumMet = totalVotes >= requiredQuorum
			}

			// Calcular porcentaje de aprobacion
			percentage := 0.0
			if totalVotes > 0 {
				percentage = (float64(votesFor) / float64(totalVotes)) * 100
			}

			approved = quorumMet && percentage >= requiredPercentage
		case "board":
			// Junta directiva: solo miembros activos de la junta
			h.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM assembly_board_members WHERE is_active = true`).Scan(&totalVotingMembers)

			totalVotes := votesFor + votesAgainst
			quorumMet := true
			if requiredQuorum > 0 {
				quorumMet = totalVotes >= requiredQuorum
			}

			percentage := 0.0
			if totalVotes > 0 {
				percentage = (float64(votesFor) / float64(totalVotes)) * 100
			}

			approved = quorumMet && percentage >= requiredPercentage
		case "multisig":
			// Contar firmas en collected_signatures
			// Solo cuentan las firmas de personas/organizaciones autorizadas
			var signatures []interface{}
			if len(collectedSignatures) > 0 {
				json.Unmarshal(collectedSignatures, &signatures)
			}
			// TODO: validar que cada firma sea de un signer autorizado
			// Por ahora contar todas las firmas (compatibilidad)
			sigCount := len(signatures)
			approved = sigCount >= requiredSignatures
		case "authorized_any":
			// Cualquiera de las personas autorizadas puede aprobar con un solo voto
			// Se aprueba con un solo voto a favor de una persona autorizada
			approved = votesFor >= 1
		case "person":
			// Una persona especifica aprueba
			// Se aprueba con un solo voto a favor de la persona autorizada
			// El voto se verifica en el handler de votos
			approved = votesFor >= 1
		case "organization":
			// La organizacion decide internamente
			// Por ahora: mismo criterio que board (mayoria de votos)
			totalVotes := votesFor + votesAgainst
			quorumMet := true
			if requiredQuorum > 0 {
				quorumMet = totalVotes >= requiredQuorum
			}
			percentage := 0.0
			if totalVotes > 0 {
				percentage = (float64(votesFor) / float64(totalVotes)) * 100
			}
			approved = quorumMet && percentage >= requiredPercentage
		default:
			// council u otros: criterio por defecto
			approved = votesFor > votesAgainst
		}
	} else {
		// No hay config para este tipo: criterio viejo
		approved = votesFor > votesAgainst
	}

	// Asegurar que totalVotingMembers este calculado para metodos no-assembly
	if totalVotingMembers == 0 {
		h.Pool.QueryRow(r.Context(), `
			SELECT COUNT(*) FROM users u
			JOIN member_levels ml ON ml.id = u.member_level_id
			WHERE u.node_domain = $1 AND u.membership_status = 'active'
			AND ml.has_vote = true AND ml.counts_in_quorum = true`, nodeDomain).Scan(&totalVotingMembers)
	}

	if approved {
		_, err = h.Pool.Exec(r.Context(), `
			UPDATE assembly_decisions SET status = 'executed', executed_at = NOW() WHERE id = $1`,
			decisionID)
		if err != nil {
			writeError(w, 500, err.Error())
			return
		}

		// Auto-agregar a la minuta
		appendToMinutes(h.Pool, assemblyID, fmt.Sprintf("- [APROBADA] %s: %s (a favor: %d, en contra: %d, abstencion: %d)", decisionType, description, votesFor, votesAgainst, votesAbstain))

		// Ejecutar segun el tipo de decision
		var params map[string]interface{}
		if newValue != nil {
			json.Unmarshal(*newValue, &params)
		}
		_ = h.executeDecision(r, decisionType, targetAccount, params)

		// Calcular no-votantes
		totalVotes := votesFor + votesAgainst + votesAbstain
		notVoted := totalVotingMembers - totalVotes
		if notVoted < 0 {
			notVoted = 0
		}

		// Audit log (voto secreto: solo cantidades, no quien voto)
		userID, _ := h.Auth.GetUserID(r)
		execDetails, _ := json.Marshal(map[string]interface{}{
			"decision_type":        decisionType,
			"votes_for":            votesFor,
			"votes_against":        votesAgainst,
			"votes_abstain":        votesAbstain,
			"votes_not_cast":       notVoted,
			"total_voting_members": totalVotingMembers,
		})
		h.Pool.Exec(r.Context(), `INSERT INTO audit_log (actor_id, action, target_id, details) VALUES ($1, 'assembly_execute', $2, $3)`,
			userID, decisionID, execDetails)

		// Notificar a los miembros con voto del resultado
		notify := NewNotifyService(h.Pool)
		notify.NotifyVotingMembers(r.Context(), nodeDomain, "proposal_result",
			"Propuesta aprobada",
			fmt.Sprintf("La propuesta \"%s\" ha sido APROBADA (a favor: %d, en contra: %d, abstencion: %d).", description, votesFor, votesAgainst, votesAbstain),
			"/app/assembly",
			map[string]interface{}{"decision_id": decisionID.String(), "result": "approved", "votes_for": votesFor, "votes_against": votesAgainst})

		writeJSON(w, 200, map[string]interface{}{
			"status":               "executed",
			"votes_for":            votesFor,
			"votes_against":        votesAgainst,
			"votes_abstain":        votesAbstain,
			"votes_not_cast":       notVoted,
			"total_voting_members": totalVotingMembers,
		})
	} else {
		_, _ = h.Pool.Exec(r.Context(), `UPDATE assembly_decisions SET status = 'rejected' WHERE id = $1`, decisionID)

		// Auto-agregar a la minuta
		appendToMinutes(h.Pool, assemblyID, fmt.Sprintf("- [RECHAZADA] %s: %s (a favor: %d, en contra: %d, abstencion: %d)", decisionType, description, votesFor, votesAgainst, votesAbstain))

		totalVotes := votesFor + votesAgainst + votesAbstain
		notVoted := totalVotingMembers - totalVotes
		if notVoted < 0 {
			notVoted = 0
		}

		// Notificar a los miembros con voto del resultado
		notify := NewNotifyService(h.Pool)
		notify.NotifyVotingMembers(r.Context(), nodeDomain, "proposal_result",
			"Propuesta rechazada",
			fmt.Sprintf("La propuesta \"%s\" ha sido RECHAZADA (a favor: %d, en contra: %d, abstencion: %d).", description, votesFor, votesAgainst, votesAbstain),
			"/app/assembly",
			map[string]interface{}{"decision_id": decisionID.String(), "result": "rejected", "votes_for": votesFor, "votes_against": votesAgainst})

		writeJSON(w, 200, map[string]interface{}{
			"status":               "rejected",
			"votes_for":            votesFor,
			"votes_against":        votesAgainst,
			"votes_abstain":        votesAbstain,
			"votes_not_cast":       notVoted,
			"total_voting_members": totalVotingMembers,
		})
	}
}

// executeDecision ejecuta la decision segun su tipo
func (h *AssemblyHandler) executeDecision(r *http.Request, decisionType string, targetAccount *uuid.UUID, params map[string]interface{}) error {
	switch decisionType {
	case "limit_change":
		// Cambiar limites del usuario
		if targetAccount != nil {
			if creditLimit, ok := params["nuevo_limite_credito"].(float64); ok {
				h.Pool.Exec(r.Context(), `UPDATE users SET credit_limit = $1 WHERE id = $2`, int64(creditLimit), targetAccount)
			}
			if debitLimit, ok := params["nuevo_limite_debito"].(float64); ok {
				h.Pool.Exec(r.Context(), `UPDATE users SET debit_limit = $1 WHERE id = $2`, int64(debitLimit), targetAccount)
			}
		}
	case "tax_change":
		// Cambiar tasa de impuesto
		if rate, ok := params["tasa"].(float64); ok {
			nodeDomain := r.Header.Get("X-Node-Domain")
			nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
			h.Pool.Exec(r.Context(), `
				INSERT INTO tax_config (node_domain, tax_rate, is_active)
				VALUES ($1, $2, true)
				ON CONFLICT (node_domain) DO UPDATE SET tax_rate = $2, updated_at = NOW()`,
				nodeDomain, rate/100)
		}
	case "member_level":
		// Crear o modificar un nivel de miembro (aprobado por asamblea)
		levelID, _ := params["level_id"].(string)
		name, _ := params["name"].(string)
		description, _ := params["description"].(string)
		levelNum, _ := params["level"].(float64)
		hasVoice, _ := params["has_voice"].(bool)
		hasVote, _ := params["has_vote"].(bool)
		quorum, _ := params["counts_in_quorum"].(bool)
		creditLimit, _ := params["credit_limit"].(float64)
		debitLimit, _ := params["debit_limit"].(float64)
		taxRate, _ := params["tax_rate"].(float64)
		canCreateOrg, _ := params["can_create_organization"].(bool)
		canCrossNode, _ := params["can_cross_node_trade"].(bool)
		canNFC, _ := params["can_receive_nfc_card"].(bool)
		canAudit, _ := params["can_view_audit"].(bool)
		canBridge, _ := params["can_use_external_bridge"].(bool)
		maxOrgs, _ := params["max_organizations"].(float64)
		canReqLimit, _ := params["can_request_limit_increase"].(bool)

		nodeDomain := r.Header.Get("X-Node-Domain")
		nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

		if levelID != "" {
			// Actualizar nivel existente
			h.Pool.Exec(r.Context(), `
				UPDATE member_levels SET
					name = $1, description = $2, level = $3, has_voice = $4, has_vote = $5, counts_in_quorum = $6,
					credit_limit = $7, debit_limit = $8, tax_rate = $9,
					can_create_organization = $10, can_cross_node_trade = $11, can_receive_nfc_card = $12,
					can_view_audit = $13, can_use_external_bridge = $14, max_organizations = $15, can_request_limit_increase = $16
				WHERE id = $17`,
				name, description, int(levelNum), hasVoice, hasVote, quorum,
				int64(creditLimit), int64(debitLimit), taxRate,
				canCreateOrg, canCrossNode, canNFC, canAudit, canBridge, int(maxOrgs), canReqLimit, levelID)
		} else if name != "" {
			// Crear nuevo nivel
			h.Pool.Exec(r.Context(), `
				INSERT INTO member_levels (id, node_domain, name, description, level, has_voice, has_vote, counts_in_quorum,
					credit_limit, debit_limit, tax_rate, can_create_organization, can_cross_node_trade, can_receive_nfc_card,
					can_view_audit, can_use_external_bridge, max_organizations, can_request_limit_increase)
				VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
				nodeDomain, name, description, int(levelNum), hasVoice, hasVote, quorum,
				int64(creditLimit), int64(debitLimit), taxRate,
				canCreateOrg, canCrossNode, canNFC, canAudit, canBridge, int(maxOrgs), canReqLimit)
		}
	case "org_level":
		// Crear o modificar un nivel de organizacion (aprobado por asamblea)
		levelID, _ := params["level_id"].(string)
		name, _ := params["name"].(string)
		description, _ := params["description"].(string)
		levelNum, _ := params["level"].(float64)
		creditLimit, _ := params["credit_limit"].(float64)
		debitLimit, _ := params["debit_limit"].(float64)
		taxRate, _ := params["tax_rate"].(float64)
		canCrossNode, _ := params["can_cross_node_trade"].(bool)
		canBridge, _ := params["can_use_external_bridge"].(bool)
		canAudit, _ := params["can_view_audit"].(bool)
		maxMembers, _ := params["max_members"].(float64)

		nodeDomain := r.Header.Get("X-Node-Domain")
		nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

		if levelID != "" {
			h.Pool.Exec(r.Context(), `
				UPDATE organization_levels SET
					name = $1, description = $2, level = $3, credit_limit = $4, debit_limit = $5, tax_rate = $6,
					can_cross_node_trade = $7, can_use_external_bridge = $8, can_view_audit = $9, max_members = $10
				WHERE id = $11::uuid`,
				name, description, int(levelNum), int64(creditLimit), int64(debitLimit), taxRate,
				canCrossNode, canBridge, canAudit, int(maxMembers), levelID)
		} else if name != "" {
			h.Pool.Exec(r.Context(), `
				INSERT INTO organization_levels (node_domain, name, description, level, credit_limit, debit_limit, tax_rate,
					can_cross_node_trade, can_use_external_bridge, can_view_audit, max_members)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
				nodeDomain, name, description, int(levelNum), int64(creditLimit), int64(debitLimit), taxRate,
				canCrossNode, canBridge, canAudit, int(maxMembers))
		}
	case "governance_rule":
		// Crear, modificar o eliminar regla de gobernanza (aprobado por asamblea)
		action, _ := params["action"].(string)
		nodeDomain := r.Header.Get("X-Node-Domain")
		nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

		switch action {
		case "create":
			category, _ := params["category"].(string)
			title, _ := params["title"].(string)
			description, _ := params["description"].(string)
			severity, _ := params["severity"].(string)
			icon, _ := params["icon"].(string)
			sortOrder, _ := params["sort_order"].(float64)
			ruleType, _ := params["rule_type"].(string)
			if ruleType == "" {
				ruleType = "informativo"
			}

			h.Pool.Exec(r.Context(), `
				INSERT INTO governance_rules (node_domain, category, title, description, severity, icon, sort_order, rule_type)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				nodeDomain, category, title, description, severity, icon, int(sortOrder), ruleType)

		case "update":
			ruleID, _ := params["rule_id"].(string)
			category, _ := params["category"].(string)
			title, _ := params["title"].(string)
			description, _ := params["description"].(string)
			severity, _ := params["severity"].(string)
			icon, _ := params["icon"].(string)
			sortOrder, _ := params["sort_order"].(float64)
			ruleType, _ := params["rule_type"].(string)
			isActive, _ := params["is_active"].(bool)
			if ruleType == "" {
				ruleType = "informativo"
			}

			h.Pool.Exec(r.Context(), `
				UPDATE governance_rules SET
					category = $1, title = $2, description = $3, severity = $4,
					icon = $5, sort_order = $6, rule_type = $7, is_active = $8, updated_at = NOW()
				WHERE id = $9`,
				category, title, description, severity, icon, int(sortOrder), ruleType, isActive, ruleID)

		case "delete":
			ruleID, _ := params["rule_id"].(string)
			h.Pool.Exec(r.Context(), `DELETE FROM governance_rules WHERE id = $1`, ruleID)
		}
	case "fund_distribution":
		// Distribuir fondos desde la cuenta de la asamblea a otra cuenta
		// La asamblea del nodo SOLO puede transferir a organizaciones o departamentos
		// NUNCA a personas directamente
		toAccountStr, _ := params["cuenta_destino"].(string)
		amount, _ := params["monto"].(float64)
		reason, _ := params["razon"].(string)

		if toAccountStr == "" || amount <= 0 {
			return fmt.Errorf("cuenta destino y monto son obligatorios")
		}

		toAccountID, err := uuid.Parse(toAccountStr)
		if err != nil {
			return fmt.Errorf("cuenta destino invalida")
		}

		// Validar que la cuenta destino NO sea una persona
		var accountType string
		h.Pool.QueryRow(r.Context(), `SELECT account_type FROM users WHERE id = $1`, toAccountID).Scan(&accountType)
		if accountType == "individual" {
			return fmt.Errorf("la asamblea del nodo no puede transferir dinero directamente a personas. Transfiere a un departamento u organizacion, y ellos deciden como distribuirlo")
		}

		// Obtener la cuenta de la Asamblea General (que es el Fondo Comunitario)
		nodeDomain := r.Header.Get("X-Node-Domain")
		nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
		var fromAccountID uuid.UUID
		h.Pool.QueryRow(r.Context(), `SELECT id FROM users WHERE node_domain = $1 AND username = 'asamblea' LIMIT 1`, nodeDomain).Scan(&fromAccountID)
		if fromAccountID == uuid.Nil {
			return fmt.Errorf("no hay cuenta de Asamblea General configurada")
		}

		// Realizar la transferencia
		_, err = h.Pool.Exec(r.Context(), `
			UPDATE users SET balance = balance - $1 WHERE id = $2`,
			int64(amount), fromAccountID)
		if err != nil {
			return fmt.Errorf("error al debitar: %w", err)
		}
		_, err = h.Pool.Exec(r.Context(), `
			UPDATE users SET balance = balance + $1 WHERE id = $2`,
			int64(amount), toAccountID)
		if err != nil {
			return fmt.Errorf("error al acreditar: %w", err)
		}

		// Registrar la transferencia
		h.Pool.Exec(r.Context(), `
			INSERT INTO transactions (from_account, to_account, amount, description, transaction_type)
			VALUES ($1, $2, $3, $4, 'assembly_distribution')`,
			fromAccountID, toAccountID, int64(amount), reason)

	case "create_account":
		// Crear cuenta contable (para la asamblea o para propositos especificos)
		accountName, _ := params["nombre_cuenta"].(string)
		accountType, _ := params["tipo_cuenta"].(string)
		if accountName == "" {
			accountName = "Nueva cuenta"
		}
		if accountType == "" {
			accountType = "assembly_account"
		}
		nodeDomain := r.Header.Get("X-Node-Domain")
		nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
		h.Pool.Exec(r.Context(), `
			INSERT INTO users (node_domain, username, display_name, account_type, membership_status, is_approved, credit_limit, debit_limit)
			VALUES ($1, $2, $3, $4, 'active', true, 0, 0)`,
			nodeDomain, accountName, accountName, accountType)

	case "product_approval":
		// Aprobar un producto en el catalogo (aprobado por Asamblea/Junta/Consejo)
		productID, _ := params["product_id"].(string)
		if productID != "" {
			h.Pool.Exec(r.Context(), `UPDATE products SET is_approved = true WHERE id = $1::uuid`, productID)
		}

	case "product_disapproval":
		// Desaprobar un producto (no lo elimina, solo cambia is_approved = false)
		productID, _ := params["product_id"].(string)
		if productID != "" {
			h.Pool.Exec(r.Context(), `UPDATE products SET is_approved = false WHERE id = $1::uuid`, productID)
		}

	case "product_remove":
		// Eliminar un producto del catalogo (diferente de desaprobar: lo borra)
		productID, _ := params["product_id"].(string)
		if productID != "" {
			h.Pool.Exec(r.Context(), `DELETE FROM products WHERE id = $1::uuid`, productID)
		}

	case "product_import":
		// Importar un producto de otro nodo federado
		// Crea una copia local del producto con source_node y source_product_id
		productName, _ := params["product_name"].(string)
		sourceNode, _ := params["source_node"].(string)
		sourceProductID, _ := params["source_product_id"].(string)
		category, _ := params["category"].(string)
		subcategory, _ := params["subcategory"].(string)
		price, _ := params["price"].(float64)
		imageURL, _ := params["image_url"].(string)
		if productName != "" && sourceNode != "" {
			nodeDomain := r.Header.Get("X-Node-Domain")
			nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
			h.Pool.Exec(r.Context(), `
				INSERT INTO products (node_domain, name, parent_category, category, origin, price_per_unit, image_url, is_approved, is_system, source_node, source_product_id)
				VALUES ($1, $2, $3, $4, 'federated', $5, $6, true, true, $7, $8::uuid)`,
				nodeDomain, productName, category, subcategory, price, imageURL, sourceNode, sourceProductID)
		}

	case "node_config":
		// Cambiar configuracion del nodo (nombre, moneda, dominio)
		nodeName, _ := params["node_name"].(string)
		currencyName, _ := params["currency_name"].(string)
		currencyFullName, _ := params["currency_full_name"].(string)
		appName, _ := params["app_name"].(string)
		nodeDomain := r.Header.Get("X-Node-Domain")
		nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
		if nodeName != "" {
			h.Pool.Exec(r.Context(), `UPDATE node_config SET node_name = $1 WHERE node_domain = $2`, nodeName, nodeDomain)
		}
		if currencyName != "" {
			h.Pool.Exec(r.Context(), `UPDATE node_config SET currency_name = $1 WHERE node_domain = $2`, currencyName, nodeDomain)
		}
		if currencyFullName != "" {
			h.Pool.Exec(r.Context(), `UPDATE node_config SET currency_full_name = $1 WHERE node_domain = $2`, currencyFullName, nodeDomain)
		}
		if appName != "" {
			h.Pool.Exec(r.Context(), `UPDATE node_config SET app_name = $1 WHERE node_domain = $2`, appName, nodeDomain)
		}

	case "backup_config":
		// Cambiar configuracion de backups automaticos
		intervalHours, _ := params["interval_hours"].(float64)
		retentionDays, _ := params["retention_days"].(float64)
		enabled, _ := params["enabled"].(bool)
		nodeDomain := r.Header.Get("X-Node-Domain")
		nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
		h.Pool.Exec(r.Context(), `
			UPDATE backup_config SET interval_hours = $1, retention_days = $2, enabled = $3, updated_at = NOW()
			WHERE node_domain = $4`,
			int(intervalHours), int(retentionDays), enabled, nodeDomain)

	case "cluster_config":
		// Cambiar configuracion del cluster de base de datos
		// Por seguridad, solo se guarda la configuracion - el reinicio requiere accion manual
		mode, _ := params["mode"].(string)
		tabletLimit, _ := params["tablet_limit"].(float64)
		minNodes, _ := params["min_nodes"].(float64)
		alertThreshold, _ := params["alert_threshold"].(float64)
		nodeDomain := r.Header.Get("X-Node-Domain")
		nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
		h.Pool.Exec(r.Context(), `
			UPDATE cluster_config SET mode = $1, tablet_limit = $2, min_nodes = $3, alert_threshold = $4, updated_at = NOW()
			WHERE node_domain = $5`,
			mode, int(tabletLimit), int(minNodes), int(alertThreshold), nodeDomain)

	case "permission_assignment":
		// Asignar o revocar permisos a una persona
		// Esto cambia el member_level del usuario o sus permisos especificos
		userIDStr, _ := params["user_id"].(string)
		levelID, _ := params["level_id"].(string)
		action, _ := params["action"].(string) // "assign" o "revoke"
		if userIDStr != "" && levelID != "" && action == "assign" {
			h.Pool.Exec(r.Context(), `UPDATE users SET member_level_id = $1::uuid WHERE id = $2::uuid`,
				levelID, userIDStr)
		}

	case "federation_treaty":
		// Firmar o revocar un tratado de federacion con otro nodo
		// Esto se maneja en el sistema de federacion
		otherNodeDomain, _ := params["other_node_domain"].(string)
		action, _ := params["action"].(string) // "sign" o "revoke"
		nodeDomain := r.Header.Get("X-Node-Domain")
		nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
		if otherNodeDomain != "" && action == "sign" {
			h.Pool.Exec(r.Context(), `
				INSERT INTO federation_peers (node_domain, peer_domain, status, created_at)
				VALUES ($1, $2, 'active', NOW())
				ON CONFLICT (node_domain, peer_domain) DO UPDATE SET status = 'active', updated_at = NOW()`,
				nodeDomain, otherNodeDomain)
		} else if otherNodeDomain != "" && action == "revoke" {
			h.Pool.Exec(r.Context(), `
				UPDATE federation_peers SET status = 'revoked', updated_at = NOW()
				WHERE node_domain = $1 AND peer_domain = $2`,
				nodeDomain, otherNodeDomain)
		}
	}
	return nil
}

func (h *AssemblyHandler) listBoard(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	rows, err := h.Pool.Query(r.Context(), `
		SELECT b.id, b.user_id, u.username, u.display_name, b.position, b.term_start, b.term_end, b.is_active
		FROM board_members b
		JOIN users u ON u.id = b.user_id
		WHERE b.node_domain = $1 AND b.is_active = true
		ORDER BY b.position`, nodeDomain)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	var board []map[string]interface{}
	for rows.Next() {
		var id, userID uuid.UUID
		var username, position string
		var displayName *string
		var termStart time.Time
		var termEnd *time.Time
		var isActive bool
		if err := rows.Scan(&id, &userID, &username, &displayName, &position, &termStart, &termEnd, &isActive); err != nil {
			continue
		}
		board = append(board, map[string]interface{}{
			"id":           id.String(),
			"user_id":      userID.String(),
			"username":     username,
			"display_name": deref(displayName),
			"position":     position,
			"term_start":   termStart,
			"term_end":     derefTime(termEnd),
			"is_active":    isActive,
		})
	}
	if board == nil {
		board = []map[string]interface{}{}
	}
	writeJSON(w, 200, board)
}

type AssignBoardRequest struct {
	UserID   string `json:"user_id"`
	Position string `json:"position"`
}

func (h *AssemblyHandler) assignBoardMember(w http.ResponseWriter, r *http.Request) {
	var req AssignBoardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.UserID == "" || req.Position == "" {
		writeError(w, 400, "user_id and position are required")
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		// Buscar por username
		err = h.Pool.QueryRow(r.Context(), `SELECT id FROM users WHERE username = $1`, req.UserID).Scan(&userID)
		if err != nil {
			writeError(w, 404, "user not found")
			return
		}
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	id := uuid.New()
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO board_members (id, node_domain, user_id, position)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (node_domain, user_id, position) DO UPDATE SET is_active = true, term_start = NOW()`,
		id, nodeDomain, userID, req.Position)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":       id.String(),
		"user_id":  userID.String(),
		"position": req.Position,
	})
}

func (h *AssemblyHandler) removeBoardMember(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	_, err = h.Pool.Exec(r.Context(), `UPDATE board_members SET is_active = false WHERE id = $1`, id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"status": "removed"})
}

// ===== Miembros con derecho a voto =====

func (h *AssemblyHandler) listVotingMembers(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	rows, err := h.Pool.Query(r.Context(), `
		SELECT u.id, u.username, u.display_name, ml.name as level_name, ml.level, ml.has_voice, ml.has_vote, ml.counts_in_quorum
		FROM users u
		JOIN member_levels ml ON ml.id = u.member_level_id
		WHERE u.node_domain = $1 AND u.membership_status = 'active' AND ml.has_vote = true
		ORDER BY ml.level DESC, u.username`, nodeDomain)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	var members []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var username string
		var displayName *string
		var levelName string
		var level int
		var hasVoice, hasVote, countsInQuorum bool
		if err := rows.Scan(&id, &username, &displayName, &levelName, &level, &hasVoice, &hasVote, &countsInQuorum); err != nil {
			continue
		}
		members = append(members, map[string]interface{}{
			"id":               id.String(),
			"username":         username,
			"display_name":     deref(displayName),
			"level_name":       levelName,
			"level":            level,
			"has_voice":        hasVoice,
			"has_vote":         hasVote,
			"counts_in_quorum": countsInQuorum,
		})
	}
	if members == nil {
		members = []map[string]interface{}{}
	}
	writeJSON(w, 200, members)
}

// ===== Configuracion de umbrales =====

func (h *AssemblyHandler) listAssemblyConfig(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, node_domain, proposal_type, approval_method, required_percentage,
		       required_quorum, required_signatures, council_id,
		       authorized_person_id, organization_id,
		       description, is_active, created_at, updated_at
		FROM assembly_config WHERE node_domain = $1 ORDER BY proposal_type`, nodeDomain)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	var configs []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var ndomain, proposalType, approvalMethod string
		var requiredPercentage float64
		var requiredQuorum, requiredSignatures int
		var councilID, authorizedPersonID, organizationID *uuid.UUID
		var description *string
		var isActive bool
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &ndomain, &proposalType, &approvalMethod, &requiredPercentage,
			&requiredQuorum, &requiredSignatures, &councilID,
			&authorizedPersonID, &organizationID,
			&description, &isActive, &createdAt, &updatedAt); err != nil {
			continue
		}
		// Cargar nombres para mostrar
		councilName := ""
		if councilID != nil {
			h.Pool.QueryRow(r.Context(), `SELECT name FROM departments WHERE id = $1`, councilID).Scan(&councilName)
		}
		personName := ""
		if authorizedPersonID != nil {
			h.Pool.QueryRow(r.Context(), `SELECT COALESCE(display_name, username) FROM users WHERE id = $1`, authorizedPersonID).Scan(&personName)
		}
		orgName := ""
		if organizationID != nil {
			h.Pool.QueryRow(r.Context(), `SELECT display_name FROM users WHERE id = $1 AND account_type = 'organization'`, organizationID).Scan(&orgName)
		}
		signers := h.loadConfigSigners(r.Context(), id)
		configs = append(configs, map[string]interface{}{
			"id":                     id.String(),
			"node_domain":            ndomain,
			"proposal_type":          proposalType,
			"approval_method":        approvalMethod,
			"required_percentage":    requiredPercentage,
			"required_quorum":        requiredQuorum,
			"required_signatures":    requiredSignatures,
			"council_id":             derefUUID(councilID),
			"council_name":           councilName,
			"authorized_person_id":   derefUUID(authorizedPersonID),
			"authorized_person_name": personName,
			"organization_id":        derefUUID(organizationID),
			"organization_name":      orgName,
			"description":            deref(description),
			"is_active":              isActive,
			"created_at":             createdAt,
			"updated_at":             updatedAt,
			"signers":                signers,
		})
	}
	if configs == nil {
		configs = []map[string]interface{}{}
	}
	writeJSON(w, 200, configs)
}

type UpdateAssemblyConfigRequest struct {
	ApprovalMethod     string          `json:"approval_method"`
	RequiredPercentage float64         `json:"required_percentage"`
	RequiredQuorum     int             `json:"required_quorum"`
	RequiredSignatures int             `json:"required_signatures"`
	CouncilID          string          `json:"council_id"`
	AuthorizedPersonID string          `json:"authorized_person_id"`
	OrganizationID     string          `json:"organization_id"`
	Description        string          `json:"description"`
	Signers            []SignerRequest `json:"signers"`
}

type SignerRequest struct {
	SignerType     string `json:"signer_type"` // "person" o "organization"
	UserID         string `json:"user_id"`
	OrganizationID string `json:"organization_id"`
}

func (h *AssemblyHandler) updateAssemblyConfig(w http.ResponseWriter, r *http.Request) {
	proposalType := chi.URLParam(r, "proposalType")
	if proposalType == "" {
		writeError(w, 400, "proposal_type is required")
		return
	}

	var req UpdateAssemblyConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.ApprovalMethod == "" {
		req.ApprovalMethod = "assembly"
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	var councilID *uuid.UUID
	if req.CouncilID != "" {
		if id, err := uuid.Parse(req.CouncilID); err == nil {
			councilID = &id
		}
	}

	var authorizedPersonID *uuid.UUID
	if req.AuthorizedPersonID != "" {
		if id, err := uuid.Parse(req.AuthorizedPersonID); err == nil {
			authorizedPersonID = &id
		}
	}

	var organizationID *uuid.UUID
	if req.OrganizationID != "" {
		if id, err := uuid.Parse(req.OrganizationID); err == nil {
			organizationID = &id
		}
	}

	var description *string
	if req.Description != "" {
		description = &req.Description
	}

	var id uuid.UUID
	err := h.Pool.QueryRow(r.Context(), `
		INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage,
			required_quorum, required_signatures, council_id, authorized_person_id, organization_id, description, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
		ON CONFLICT (node_domain, proposal_type) DO UPDATE SET
			approval_method = $3, required_percentage = $4, required_quorum = $5,
			required_signatures = $6, council_id = $7, authorized_person_id = $8,
			organization_id = $9, description = $10, updated_at = NOW()
		RETURNING id`,
		nodeDomain, proposalType, req.ApprovalMethod, req.RequiredPercentage,
		req.RequiredQuorum, req.RequiredSignatures, councilID, authorizedPersonID,
		organizationID, description).Scan(&id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Guardar signers autorizados para multisig
	// Primero borrar los existentes
	h.Pool.Exec(r.Context(), `DELETE FROM assembly_config_signers WHERE config_id = $1`, id)
	// Luego insertar los nuevos
	for _, signer := range req.Signers {
		var userID, orgID *uuid.UUID
		if signer.SignerType == "person" && signer.UserID != "" {
			if uid, err := uuid.Parse(signer.UserID); err == nil {
				userID = &uid
			}
		}
		if signer.SignerType == "organization" && signer.OrganizationID != "" {
			if oid, err := uuid.Parse(signer.OrganizationID); err == nil {
				orgID = &oid
			}
		}
		if userID != nil || orgID != nil {
			h.Pool.Exec(r.Context(), `
				INSERT INTO assembly_config_signers (config_id, user_id, organization_id, signer_type)
				VALUES ($1, $2, $3, $4)`,
				id, userID, orgID, signer.SignerType)
		}
	}

	// Cargar signers para la respuesta
	signers := h.loadConfigSigners(r.Context(), id)

	writeJSON(w, 200, map[string]interface{}{
		"id":                   id.String(),
		"node_domain":          nodeDomain,
		"proposal_type":        proposalType,
		"approval_method":      req.ApprovalMethod,
		"required_percentage":  req.RequiredPercentage,
		"required_quorum":      req.RequiredQuorum,
		"required_signatures":  req.RequiredSignatures,
		"council_id":           derefUUID(councilID),
		"authorized_person_id": derefUUID(authorizedPersonID),
		"organization_id":      derefUUID(organizationID),
		"description":          req.Description,
		"is_active":            true,
		"signers":              signers,
	})
}

// loadConfigSigners carga los signers autorizados para una configuracion de multisig
func (h *AssemblyHandler) loadConfigSigners(ctx context.Context, configID uuid.UUID) []map[string]interface{} {
	rows, err := h.Pool.Query(ctx, `
		SELECT s.id, s.signer_type, s.user_id, s.organization_id,
		       COALESCE(u.display_name, u.username, '') as user_name,
		       COALESCE(o.display_name, o.username, '') as org_name
		FROM assembly_config_signers s
		LEFT JOIN users u ON u.id = s.user_id
		LEFT JOIN users o ON o.id = s.organization_id AND o.account_type = 'organization'
		WHERE s.config_id = $1
		ORDER BY s.created_at`, configID)
	if err != nil {
		return []map[string]interface{}{}
	}
	defer rows.Close()

	var signers []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var signerType, userName, orgName string
		var userID, orgID *uuid.UUID
		if err := rows.Scan(&id, &signerType, &userID, &orgID, &userName, &orgName); err != nil {
			continue
		}
		signers = append(signers, map[string]interface{}{
			"id":              id.String(),
			"signer_type":     signerType,
			"user_id":         derefUUID(userID),
			"organization_id": derefUUID(orgID),
			"user_name":       userName,
			"org_name":        orgName,
		})
	}
	if signers == nil {
		signers = []map[string]interface{}{}
	}
	return signers
}

// checkDirectPermission verifica si el usuario actual puede hacer un cambio
// directo o si necesita crear una propuesta en la Asamblea.
// Retorna: { can_direct: bool, method: string, reason: string }
func (h *AssemblyHandler) checkDirectPermission(w http.ResponseWriter, r *http.Request) {
	proposalType := chi.URLParam(r, "proposalType")
	if proposalType == "" {
		writeError(w, 400, "proposal_type is required")
		return
	}

	userID, _ := h.Auth.GetUserID(r)
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	var approvalMethod string
	var authorizedPersonID *uuid.UUID
	err := h.Pool.QueryRow(r.Context(), `
		SELECT approval_method, authorized_person_id
		FROM assembly_config WHERE node_domain = $1 AND proposal_type = $2 AND is_active = true`,
		nodeDomain, proposalType).Scan(&approvalMethod, &authorizedPersonID)

	if err != nil {
		// No hay config para este tipo - permitir si tiene config.manage (compatibilidad)
		writeJSON(w, 200, map[string]interface{}{
			"can_direct": true,
			"method":     "legacy",
			"reason":     "No hay configuracion de Asamblea para este tipo de cambio. Se permite cambio directo.",
		})
		return
	}

	canDirect := false
	reason := ""

	switch approvalMethod {
	case "person":
		if authorizedPersonID != nil && *authorizedPersonID == userID {
			canDirect = true
			reason = "Eres la persona autorizada para este cambio."
		} else {
			reason = "Este cambio requiere la persona autorizada. Crea una propuesta."
		}
	case "authorized_any":
		// Cualquiera de las personas autorizadas en signers puede hacer el cambio
		var signerUserID *uuid.UUID
		err := h.Pool.QueryRow(r.Context(), `
			SELECT user_id FROM assembly_config_signers
			WHERE config_id = (SELECT id FROM assembly_config WHERE node_domain = $1 AND proposal_type = $2)
			AND user_id = $3 AND signer_type = 'person' LIMIT 1`,
			nodeDomain, proposalType, userID).Scan(&signerUserID)
		if err == nil {
			canDirect = true
			reason = "Eres una de las personas autorizadas para este cambio."
		} else {
			reason = "Este cambio requiere una de las personas autorizadas. Crea una propuesta."
		}
	case "assembly", "board", "council", "multisig", "organization":
		reason = "Este cambio requiere aprobacion por " + approvalMethod + ". Crea una propuesta."
	default:
		reason = "Metodo de aprobacion desconocido."
	}

	writeJSON(w, 200, map[string]interface{}{
		"can_direct": canDirect,
		"method":     approvalMethod,
		"reason":     reason,
	})
}

// ===== Helpers =====

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func derefTime(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format(time.RFC3339)
}

func derefUUID(u *uuid.UUID) string {
	if u == nil {
		return ""
	}
	return u.String()
}

func derefInt(i *int) int {
	if i == nil {
		return 0
	}
	return *i
}

// ===== Informes de votacion =====

// getProposalReport devuelve un informe detallado de una propuesta
// incluye: fechas, duracion, conteo de votos, resultado, participacion
func (h *AssemblyHandler) getProposalReport(w http.ResponseWriter, r *http.Request) {
	decisionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	// Datos de la propuesta
	var assemblyID uuid.UUID
	var decisionType, description, status string
	var createdAt time.Time
	var executedAt *time.Time
	var votingDeadline *time.Time
	var votingDurationMinutes *int
	err = h.Pool.QueryRow(r.Context(), `
		SELECT assembly_id, decision_type, description, status, created_at, executed_at, voting_deadline, voting_duration_minutes
		FROM assembly_decisions WHERE id = $1`, decisionID).
		Scan(&assemblyID, &decisionType, &description, &status, &createdAt, &executedAt, &votingDeadline, &votingDurationMinutes)
	if err != nil {
		writeError(w, 404, "propuesta no encontrada")
		return
	}

	// Conteo de votos
	var votesFor, votesAgainst, votesAbstain int
	h.Pool.QueryRow(r.Context(), `
		SELECT
			COUNT(*) FILTER (WHERE vote = 'for'),
			COUNT(*) FILTER (WHERE vote = 'against'),
			COUNT(*) FILTER (WHERE vote = 'abstain')
		FROM assembly_votes WHERE decision_id = $1`, decisionID).Scan(&votesFor, &votesAgainst, &votesAbstain)

	// Total de miembros con derecho a voto
	var totalVotingMembers int
	h.Pool.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM users u
		JOIN member_levels ml ON ml.id = u.member_level_id
		WHERE u.node_domain = $1 AND u.membership_status = 'active'
		AND ml.has_vote = true AND ml.counts_in_quorum = true`, nodeDomain).Scan(&totalVotingMembers)

	totalVotes := votesFor + votesAgainst + votesAbstain
	notVoted := totalVotingMembers - totalVotes
	if notVoted < 0 {
		notVoted = 0
	}

	// Tiempo de primer y ultimo voto
	var firstVoteAt, lastVoteAt *time.Time
	h.Pool.QueryRow(r.Context(), `
		SELECT MIN(created_at), MAX(created_at) FROM assembly_votes WHERE decision_id = $1`, decisionID).Scan(&firstVoteAt, &lastVoteAt)

	// Duracion real de la votacion
	var votingDurationStr string
	if firstVoteAt != nil && lastVoteAt != nil {
		dur := lastVoteAt.Sub(*firstVoteAt)
		if dur.Hours() >= 1 {
			votingDurationStr = fmt.Sprintf("%dh %dm", int(dur.Hours()), int(dur.Minutes())%60)
		} else {
			votingDurationStr = fmt.Sprintf("%dm %ds", int(dur.Minutes()), int(dur.Seconds())%60)
		}
	}

	// Tiempo configurado
	configuredDurationStr := ""
	if votingDurationMinutes != nil {
		mins := *votingDurationMinutes
		if mins >= 1440 {
			configuredDurationStr = fmt.Sprintf("%d dias", mins/1440)
		} else if mins >= 60 {
			configuredDurationStr = fmt.Sprintf("%d horas", mins/60)
		} else {
			configuredDurationStr = fmt.Sprintf("%d minutos", mins)
		}
	}

	// Porcentaje de participacion
	participationPct := 0.0
	if totalVotingMembers > 0 {
		participationPct = (float64(totalVotes) / float64(totalVotingMembers)) * 100
	}

	// Porcentaje de aprobacion
	approvalPct := 0.0
	if totalVotes > 0 {
		approvalPct = (float64(votesFor) / float64(totalVotes)) * 100
	}

	// Resultado
	result := "pendiente"
	switch status {
	case "executed":
		result = "aprobada"
	case "rejected":
		result = "rechazada"
	case "expired":
		result = "vencida (sin decision)"
	}

	// Timeline de votos (cuando se emitieron, sin revelar quien)
	type VoteEntry struct {
		Vote      string `json:"vote"`
		Timestamp string `json:"timestamp"`
	}
	rows, _ := h.Pool.Query(r.Context(), `
		SELECT vote, created_at FROM assembly_votes WHERE decision_id = $1 ORDER BY created_at`, decisionID)
	var voteTimeline []VoteEntry
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var voteStr string
			var ts time.Time
			rows.Scan(&voteStr, &ts)
			label := voteStr
			switch voteStr {
			case "for":
				label = "a favor"
			case "against":
				label = "en contra"
			case "abstain":
				label = "abstencion"
			}
			voteTimeline = append(voteTimeline, VoteEntry{
				Vote:      label,
				Timestamp: ts.Format(time.RFC3339),
			})
		}
	}
	if voteTimeline == nil {
		voteTimeline = []VoteEntry{}
	}

	writeJSON(w, 200, map[string]interface{}{
		"proposal_id":            decisionID.String(),
		"proposal_type":          decisionType,
		"description":            description,
		"status":                 status,
		"result":                 result,
		"created_at":             createdAt.Format(time.RFC3339),
		"executed_at":            derefTime(executedAt),
		"voting_deadline":        derefTime(votingDeadline),
		"configured_duration":    configuredDurationStr,
		"actual_voting_duration": votingDurationStr,
		"first_vote_at":          derefTime(firstVoteAt),
		"last_vote_at":           derefTime(lastVoteAt),
		"votes_for":              votesFor,
		"votes_against":          votesAgainst,
		"votes_abstain":          votesAbstain,
		"votes_not_cast":         notVoted,
		"total_voting_members":   totalVotingMembers,
		"total_votes_cast":       totalVotes,
		"participation_pct":      fmt.Sprintf("%.1f%%", participationPct),
		"approval_pct":           fmt.Sprintf("%.1f%%", approvalPct),
		"vote_timeline":          voteTimeline,
	})
}

// listVotingReports devuelve un resumen de todas las votaciones
// Filtros disponibles: ?type=limit_change&from=2024-01-01&to=2024-12-31&status=executed
func (h *AssemblyHandler) listVotingReports(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	// Filtros
	filterType := r.URL.Query().Get("type")
	filterFrom := r.URL.Query().Get("from")
	filterTo := r.URL.Query().Get("to")
	filterStatus := r.URL.Query().Get("status")

	// Construir query con filtros dinamicos
	query := `
		SELECT d.id, d.decision_type, d.description, d.status, d.created_at, d.executed_at,
		       d.voting_deadline, d.voting_duration_minutes,
		       COALESCE(sv.votes_for, 0), COALESCE(sv.votes_against, 0), COALESCE(sv.votes_abstain, 0),
		       COALESCE(sv.total_votes, 0)
		FROM assembly_decisions d
		LEFT JOIN (
			SELECT decision_id,
				COUNT(*) FILTER (WHERE vote = 'for') as votes_for,
				COUNT(*) FILTER (WHERE vote = 'against') as votes_against,
				COUNT(*) FILTER (WHERE vote = 'abstain') as votes_abstain,
				COUNT(*) as total_votes
			FROM assembly_votes GROUP BY decision_id
		) sv ON sv.decision_id = d.id
		WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if filterType != "" {
		query += fmt.Sprintf(" AND d.decision_type = $%d", argIdx)
		args = append(args, filterType)
		argIdx++
	}
	if filterFrom != "" {
		query += fmt.Sprintf(" AND d.created_at >= $%d", argIdx)
		args = append(args, filterFrom+" 00:00:00")
		argIdx++
	}
	if filterTo != "" {
		query += fmt.Sprintf(" AND d.created_at <= $%d", argIdx)
		args = append(args, filterTo+" 23:59:59")
		argIdx++
	}
	if filterStatus != "" {
		query += fmt.Sprintf(" AND d.status = $%d", argIdx)
		args = append(args, filterStatus)
		argIdx++
	}
	query += " ORDER BY d.created_at DESC LIMIT 500"

	// Total de miembros con derecho a voto
	var totalVotingMembers int
	h.Pool.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM users u
		JOIN member_levels ml ON ml.id = u.member_level_id
		WHERE u.node_domain = $1 AND u.membership_status = 'active'
		AND ml.has_vote = true AND ml.counts_in_quorum = true`, nodeDomain).Scan(&totalVotingMembers)

	rows, err := h.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	type Report struct {
		ID                 string  `json:"id"`
		ProposalType       string  `json:"proposal_type"`
		Description        string  `json:"description"`
		Status             string  `json:"status"`
		Result             string  `json:"result"`
		CreatedAt          string  `json:"created_at"`
		ExecutedAt         string  `json:"executed_at"`
		VotingDeadline     string  `json:"voting_deadline"`
		VotesFor           int     `json:"votes_for"`
		VotesAgainst       int     `json:"votes_against"`
		VotesAbstain       int     `json:"votes_abstain"`
		VotesNotCast       int     `json:"votes_not_cast"`
		TotalVotesCast     int     `json:"total_votes_cast"`
		TotalVotingMembers int     `json:"total_voting_members"`
		ParticipationPct   float64 `json:"participation_pct"`
		ApprovalPct        float64 `json:"approval_pct"`
	}

	var reports []Report
	for rows.Next() {
		var id uuid.UUID
		var decisionType, description, status string
		var createdAt time.Time
		var executedAt *time.Time
		var votingDeadline *time.Time
		var votingDurationMinutes *int
		var votesFor, votesAgainst, votesAbstain, totalVotes int

		rows.Scan(&id, &decisionType, &description, &status, &createdAt, &executedAt,
			&votingDeadline, &votingDurationMinutes,
			&votesFor, &votesAgainst, &votesAbstain, &totalVotes)

		notVoted := totalVotingMembers - totalVotes
		if notVoted < 0 {
			notVoted = 0
		}

		participationPct := 0.0
		if totalVotingMembers > 0 {
			participationPct = (float64(totalVotes) / float64(totalVotingMembers)) * 100
		}

		approvalPct := 0.0
		if totalVotes > 0 {
			approvalPct = (float64(votesFor) / float64(totalVotes)) * 100
		}

		result := "pendiente"
		switch status {
		case "executed":
			result = "aprobada"
		case "rejected":
			result = "rechazada"
		case "expired":
			result = "vencida"
		}

		reports = append(reports, Report{
			ID:                 id.String(),
			ProposalType:       decisionType,
			Description:        description,
			Status:             status,
			Result:             result,
			CreatedAt:          createdAt.Format(time.RFC3339),
			ExecutedAt:         derefTime(executedAt),
			VotingDeadline:     derefTime(votingDeadline),
			VotesFor:           votesFor,
			VotesAgainst:       votesAgainst,
			VotesAbstain:       votesAbstain,
			VotesNotCast:       notVoted,
			TotalVotesCast:     totalVotes,
			TotalVotingMembers: totalVotingMembers,
			ParticipationPct:   participationPct,
			ApprovalPct:        approvalPct,
		})
	}
	if reports == nil {
		reports = []Report{}
	}

	// Estadisticas generales
	totalProposals := len(reports)
	approvedCount := 0
	rejectedCount := 0
	expiredCount := 0
	pendingCount := 0
	totalParticipation := 0.0

	for _, rp := range reports {
		switch rp.Status {
		case "executed":
			approvedCount++
		case "rejected":
			rejectedCount++
		case "expired":
			expiredCount++
		case "pending":
			pendingCount++
		}
		totalParticipation += rp.ParticipationPct
	}

	avgParticipation := 0.0
	if totalProposals > 0 {
		avgParticipation = totalParticipation / float64(totalProposals)
	}

	writeJSON(w, 200, map[string]interface{}{
		"reports":              reports,
		"total_proposals":      totalProposals,
		"approved":             approvedCount,
		"rejected":             rejectedCount,
		"expired":              expiredCount,
		"pending":              pendingCount,
		"avg_participation":    fmt.Sprintf("%.1f%%", avgParticipation),
		"total_voting_members": totalVotingMembers,
	})
}

// ===== Minuta y actualizacion de sesion =====

func (h *AssemblyHandler) updateSession(w http.ResponseWriter, r *http.Request) {
	sessionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	var req struct {
		Title        string `json:"title"`
		Description  string `json:"description"`
		Status       string `json:"status"`
		IsPresential *bool  `json:"is_presential"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	if req.Title != "" {
		h.Pool.Exec(r.Context(), `UPDATE assembly_sessions SET title = $1 WHERE id = $2`, req.Title, sessionID)
	}
	if req.Description != "" {
		h.Pool.Exec(r.Context(), `UPDATE assembly_sessions SET description = $1 WHERE id = $2`, req.Description, sessionID)
	}
	if req.Status != "" {
		h.Pool.Exec(r.Context(), `UPDATE assembly_sessions SET status = $1 WHERE id = $2`, req.Status, sessionID)
	}
	if req.IsPresential != nil {
		h.Pool.Exec(r.Context(), `UPDATE assembly_sessions SET is_presential = $1 WHERE id = $2`, *req.IsPresential, sessionID)
	}

	writeJSON(w, 200, map[string]interface{}{"message": "Sesion actualizada"})
}

func (h *AssemblyHandler) updateMinutes(w http.ResponseWriter, r *http.Request) {
	sessionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	var req struct {
		Minutes string `json:"minutes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	userID, _ := h.Auth.GetUserID(r)
	h.Pool.Exec(r.Context(), `
		UPDATE assembly_sessions SET minutes = $1, minutes_updated_by = $2, minutes_updated_at = NOW()
		WHERE id = $3`, req.Minutes, userID, sessionID)

	writeJSON(w, 200, map[string]interface{}{"message": "Minuta guardada"})
}

// ===== Asistencia =====

func (h *AssemblyHandler) listAttendance(w http.ResponseWriter, r *http.Request) {
	sessionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT a.user_id, u.username, u.display_name, a.registered_at, a.registered_by
		FROM assembly_attendance a
		JOIN users u ON u.id = a.user_id
		WHERE a.session_id = $1
		ORDER BY a.registered_at`, sessionID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	var attendance []map[string]interface{}
	for rows.Next() {
		var userID uuid.UUID
		var username, displayName string
		var registeredAt time.Time
		var registeredBy *uuid.UUID
		rows.Scan(&userID, &username, &displayName, &registeredAt, &registeredBy)
		attendance = append(attendance, map[string]interface{}{
			"user_id":       userID.String(),
			"username":      username,
			"display_name":  displayName,
			"registered_at": registeredAt.Format(time.RFC3339),
			"registered_by": derefUUID(registeredBy),
		})
	}
	if attendance == nil {
		attendance = []map[string]interface{}{}
	}
	writeJSON(w, 200, attendance)
}

func (h *AssemblyHandler) registerAttendance(w http.ResponseWriter, r *http.Request) {
	sessionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	var req struct {
		UserIDs []string `json:"user_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	userID, _ := h.Auth.GetUserID(r)
	count := 0
	for _, uidStr := range req.UserIDs {
		uid, err := uuid.Parse(uidStr)
		if err != nil {
			continue
		}
		_, err = h.Pool.Exec(r.Context(), `
			INSERT INTO assembly_attendance (session_id, user_id, registered_by)
			VALUES ($1, $2, $3)
			ON CONFLICT (session_id, user_id) DO NOTHING`,
			sessionID, uid, userID)
		if err == nil {
			count++
		}
	}

	// Marcar quien tomo la asistencia
	h.Pool.Exec(r.Context(), `UPDATE assembly_sessions SET attendance_taken_by = $1 WHERE id = $2`, userID, sessionID)

	writeJSON(w, 200, map[string]interface{}{
		"message":    "Asistencia registrada",
		"registered": count,
		"session_id": sessionID.String(),
	})
}

func (h *AssemblyHandler) removeAttendance(w http.ResponseWriter, r *http.Request) {
	sessionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	userIDToRemove, err := uuid.Parse(chi.URLParam(r, "userId"))
	if err != nil {
		writeError(w, 400, "invalid user id")
		return
	}

	_, err = h.Pool.Exec(r.Context(), `DELETE FROM assembly_attendance WHERE session_id = $1 AND user_id = $2`, sessionID, userIDToRemove)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"message": "Asistente removido"})
}

// getAttendanceHistory devuelve el historial de asistencia
func (h *AssemblyHandler) getAttendanceHistory(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	userIDFilter := r.URL.Query().Get("user_id")

	if userIDFilter != "" {
		// Historial de un miembro especifico
		uid, err := uuid.Parse(userIDFilter)
		if err != nil {
			writeError(w, 400, "invalid user_id")
			return
		}

		var totalSessions, attended int
		h.Pool.QueryRow(r.Context(), `
			SELECT COUNT(*) FROM assembly_sessions WHERE node_domain = $1`, nodeDomain).Scan(&totalSessions)
		h.Pool.QueryRow(r.Context(), `
			SELECT COUNT(*) FROM assembly_attendance a
			JOIN assembly_sessions s ON s.id = a.session_id
			WHERE s.node_domain = $1 AND a.user_id = $2`, nodeDomain, uid).Scan(&attended)

		rows, err := h.Pool.Query(r.Context(), `
			SELECT s.id, s.title, s.start_time, s.is_presential,
			       CASE WHEN a.user_id IS NOT NULL THEN true ELSE false END as attended
			FROM assembly_sessions s
			LEFT JOIN assembly_attendance a ON a.session_id = s.id AND a.user_id = $1
			WHERE s.node_domain = $2
			ORDER BY s.start_time DESC`, uid, nodeDomain)
		if err != nil {
			writeError(w, 500, err.Error())
			return
		}
		defer rows.Close()

		type SessionAttendance struct {
			SessionID    string `json:"session_id"`
			Title        string `json:"title"`
			StartTime    string `json:"start_time"`
			IsPresential bool   `json:"is_presential"`
			Attended     bool   `json:"attended"`
		}
		var history []SessionAttendance
		for rows.Next() {
			var id uuid.UUID
			var title string
			var startTime time.Time
			var isPresential, attended bool
			rows.Scan(&id, &title, &startTime, &isPresential, &attended)
			history = append(history, SessionAttendance{
				SessionID:    id.String(),
				Title:        title,
				StartTime:    startTime.Format(time.RFC3339),
				IsPresential: isPresential,
				Attended:     attended,
			})
		}
		if history == nil {
			history = []SessionAttendance{}
		}

		missed := totalSessions - attended
		attendancePct := 0.0
		if totalSessions > 0 {
			attendancePct = (float64(attended) / float64(totalSessions)) * 100
		}

		writeJSON(w, 200, map[string]interface{}{
			"total_sessions": totalSessions,
			"attended":       attended,
			"missed":         missed,
			"attendance_pct": fmt.Sprintf("%.1f%%", attendancePct),
			"history":        history,
		})
		return
	}

	// Historial general: asistencia por miembro
	rows, err := h.Pool.Query(r.Context(), `
		SELECT u.id, u.username, u.display_name,
		       COUNT(DISTINCT s.id) as total_sessions,
		       COUNT(DISTINCT a.session_id) as attended,
		       COUNT(DISTINCT s.id) - COUNT(DISTINCT a.session_id) as missed
		FROM users u
		JOIN member_levels ml ON ml.id = u.member_level_id
		LEFT JOIN assembly_sessions s ON s.node_domain = u.node_domain
		LEFT JOIN assembly_attendance a ON a.session_id = s.id AND a.user_id = u.id
		WHERE u.node_domain = $1 AND u.membership_status = 'active'
		AND (ml.has_voice = true OR ml.has_vote = true)
		GROUP BY u.id, u.username, u.display_name
		ORDER BY attended DESC`, nodeDomain)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	type MemberAttendance struct {
		UserID        string `json:"user_id"`
		Username      string `json:"username"`
		DisplayName   string `json:"display_name"`
		TotalSessions int    `json:"total_sessions"`
		Attended      int    `json:"attended"`
		Missed        int    `json:"missed"`
	}
	var members []MemberAttendance
	for rows.Next() {
		var id uuid.UUID
		var username, displayName string
		var total, attended, missed int
		rows.Scan(&id, &username, &displayName, &total, &attended, &missed)
		members = append(members, MemberAttendance{
			UserID:        id.String(),
			Username:      username,
			DisplayName:   displayName,
			TotalSessions: total,
			Attended:      attended,
			Missed:        missed,
		})
	}
	if members == nil {
		members = []MemberAttendance{}
	}

	writeJSON(w, 200, map[string]interface{}{
		"members": members,
	})
}

// ===== Configuracion de quorum =====

func (h *AssemblyHandler) getQuorumConfig(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, session_type, meeting_type, quorum_first_call, quorum_second_call,
		       grace_period_hours, allow_reschedule, max_recall_count, is_active
		FROM assembly_quorum_config
		WHERE node_domain = $1 AND is_active = true
		ORDER BY session_type, meeting_type`, nodeDomain)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	var configs []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var sessionType, meetingType string
		var quorumFirst, quorumSecond float64
		var gracePeriod, maxRecall int
		var allowReschedule, isActive bool
		rows.Scan(&id, &sessionType, &meetingType, &quorumFirst, &quorumSecond, &gracePeriod, &allowReschedule, &maxRecall, &isActive)
		configs = append(configs, map[string]interface{}{
			"id":                 id.String(),
			"session_type":       sessionType,
			"meeting_type":       meetingType,
			"quorum_first_call":  quorumFirst,
			"quorum_second_call": quorumSecond,
			"grace_period_hours": gracePeriod,
			"allow_reschedule":   allowReschedule,
			"max_recall_count":   maxRecall,
			"is_active":          isActive,
		})
	}
	if configs == nil {
		configs = []map[string]interface{}{}
	}
	writeJSON(w, 200, configs)
}

func (h *AssemblyHandler) updateQuorumConfig(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
	sessionType := chi.URLParam(r, "sessionType")
	if sessionType == "" {
		writeError(w, 400, "session type is required")
		return
	}
	meetingType := r.URL.Query().Get("meeting_type")
	if meetingType == "" {
		meetingType = "assembly"
	}

	var req struct {
		QuorumFirstCall  *float64 `json:"quorum_first_call"`
		QuorumSecondCall *float64 `json:"quorum_second_call"`
		GracePeriodHours *int     `json:"grace_period_hours"`
		AllowReschedule  *bool    `json:"allow_reschedule"`
		MaxRecallCount   *int     `json:"max_recall_count"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Validar porcentajes
	if req.QuorumFirstCall != nil && (*req.QuorumFirstCall < 0 || *req.QuorumFirstCall > 100) {
		writeError(w, 400, "quorum_first_call debe estar entre 0 y 100")
		return
	}
	if req.QuorumSecondCall != nil && (*req.QuorumSecondCall < 0 || *req.QuorumSecondCall > 100) {
		writeError(w, 400, "quorum_second_call debe estar entre 0 y 100")
		return
	}

	// Upsert
	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO assembly_quorum_config (node_domain, session_type, meeting_type, quorum_first_call, quorum_second_call, grace_period_hours, allow_reschedule, max_recall_count, updated_at)
		VALUES ($1, $2, $3,
			COALESCE($4, 50.00),
			COALESCE($5, 30.00),
			COALESCE($6, 1),
			COALESCE($7, true),
			COALESCE($8, 1),
			NOW())
		ON CONFLICT (node_domain, session_type, meeting_type) DO UPDATE SET
			quorum_first_call = COALESCE($4, assembly_quorum_config.quorum_first_call),
			quorum_second_call = COALESCE($5, assembly_quorum_config.quorum_second_call),
			grace_period_hours = COALESCE($6, assembly_quorum_config.grace_period_hours),
			allow_reschedule = COALESCE($7, assembly_quorum_config.allow_reschedule),
			max_recall_count = COALESCE($8, assembly_quorum_config.max_recall_count),
			updated_at = NOW()`,
		nodeDomain, sessionType, meetingType, req.QuorumFirstCall, req.QuorumSecondCall,
		req.GracePeriodHours, req.AllowReschedule, req.MaxRecallCount)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"message": "Configuracion de quorum actualizada"})
}

// ===== Verificacion de quorum =====

func (h *AssemblyHandler) verifyQuorum(w http.ResponseWriter, r *http.Request) {
	sessionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	// Obtener datos de la sesion
	var sessionType, status, meetingType string
	var recallNumber int
	var startTime time.Time
	h.Pool.QueryRow(r.Context(), `
		SELECT session_type, status, recall_number, start_time, COALESCE(meeting_type, 'assembly')
		FROM assembly_sessions WHERE id = $1`, sessionID).
		Scan(&sessionType, &status, &recallNumber, &startTime, &meetingType)
	if status == "" {
		writeError(w, 404, "sesion no encontrada")
		return
	}

	// Validar que la hora de la asamblea ya llego (con ventana de anticipacion)
	var attendanceWindow int
	h.Pool.QueryRow(r.Context(), `
		SELECT attendance_window_hours FROM assembly_frequency_config
		WHERE node_domain = $1 AND scope = 'node' AND scope_id IS NULL`, nodeDomain).Scan(&attendanceWindow)
	if attendanceWindow == 0 {
		attendanceWindow = 1
	}
	windowStart := startTime.Add(-time.Duration(attendanceWindow) * time.Hour)
	if time.Now().Before(windowStart) {
		writeError(w, 400, fmt.Sprintf("la asamblea aun no ha comenzado. Se puede registrar asistencia %d horas antes de la hora programada (%s)", attendanceWindow, startTime.Format("2006-01-02 15:04")))
		return
	}

	// Obtener config de quorum (incluye meeting_type)
	var quorumFirst, quorumSecond float64
	var gracePeriod int
	var allowReschedule bool
	var maxRecall int
	h.Pool.QueryRow(r.Context(), `
		SELECT quorum_first_call, quorum_second_call, grace_period_hours, allow_reschedule, max_recall_count
		FROM assembly_quorum_config WHERE node_domain = $1 AND session_type = $2 AND meeting_type = $3`,
		nodeDomain, sessionType, meetingType).Scan(&quorumFirst, &quorumSecond, &gracePeriod, &allowReschedule, &maxRecall)
	if quorumFirst == 0 {
		// Defaults
		if meetingType == "board" {
			quorumFirst = 50
			quorumSecond = 30
			gracePeriod = 0
			allowReschedule = true
			maxRecall = 1
		} else {
			quorumFirst = 50
			quorumSecond = 30
			gracePeriod = 1
			allowReschedule = true
			maxRecall = 1
		}
	}

	// Quorum aplicable segun el llamado
	appliedQuorum := quorumFirst
	if recallNumber > 0 {
		appliedQuorum = quorumSecond
	}

	// Total de miembros con derecho a voto
	var totalVotingMembers int
	if meetingType == "board" {
		// Junta directiva: solo miembros activos de la junta
		h.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM assembly_board_members WHERE is_active = true`).Scan(&totalVotingMembers)
	} else {
		// Asamblea: todos los miembros con derecho a voto
		h.Pool.QueryRow(r.Context(), `
			SELECT COUNT(*) FROM users u
			JOIN member_levels ml ON ml.id = u.member_level_id
			WHERE u.node_domain = $1 AND u.membership_status = 'active'
			AND ml.has_vote = true AND ml.counts_in_quorum = true`, nodeDomain).Scan(&totalVotingMembers)
	}

	// Asistentes con doble confirmacion
	var presentCount int
	h.Pool.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM assembly_attendance
		WHERE session_id = $1 AND secretary_confirmed = true AND member_confirmed = true`,
		sessionID).Scan(&presentCount)

	// Tambien contar los que solo tienen confirmacion del secretario
	// (para mostrar cuantos faltan por auto-confirmarse)
	var secretaryOnlyCount int
	h.Pool.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM assembly_attendance
		WHERE session_id = $1 AND secretary_confirmed = true AND member_confirmed = false`,
		sessionID).Scan(&secretaryOnlyCount)

	// Calcular porcentaje de asistencia
	attendancePct := 0.0
	if totalVotingMembers > 0 {
		attendancePct = (float64(presentCount) / float64(totalVotingMembers)) * 100
	}

	// Verificar periodo de gracia
	now := time.Now()
	graceDeadline := startTime.Add(time.Duration(gracePeriod) * time.Hour)
	canWaitMore := now.Before(graceDeadline)

	// Determinar si hay quorum
	hasQuorum := attendancePct >= appliedQuorum

	result := map[string]interface{}{
		"session_id":           sessionID.String(),
		"session_type":         sessionType,
		"meeting_type":         meetingType,
		"recall_number":        recallNumber,
		"applied_quorum_pct":   appliedQuorum,
		"total_voting_members": totalVotingMembers,
		"present_count":        presentCount,
		"pending_confirmation": secretaryOnlyCount,
		"attendance_pct":       fmt.Sprintf("%.1f%%", attendancePct),
		"has_quorum":           hasQuorum,
		"grace_period_hours":   gracePeriod,
		"grace_deadline":       graceDeadline.Format(time.RFC3339),
		"can_wait_more":        canWaitMore,
		"allow_reschedule":     allowReschedule,
		"max_recall_count":     maxRecall,
		"can_reschedule":       allowReschedule && !hasQuorum && recallNumber < maxRecall,
	}

	if hasQuorum {
		// Marcar quorum verificado y cambiar a active
		h.Pool.Exec(r.Context(), `
			UPDATE assembly_sessions SET quorum_verified = true, quorum_checked_at = NOW(), status = 'active'
			WHERE id = $1`, sessionID)
		result["message"] = "Quorum alcanzado. La asamblea puede comenzar."
		result["status"] = "active"

		// Notificar a la junta
		notify := NewNotifyService(h.Pool)
		notify.NotifyBoard(r.Context(), nodeDomain, "quorum_status",
			"Quorum alcanzado",
			fmt.Sprintf("La asamblea ha alcanzado quorum (%.1f%%). La sesion esta activa.", attendancePct),
			"/app/assembly",
			map[string]interface{}{"session_id": sessionID.String(), "attendance_pct": attendancePct})
	} else if canWaitMore {
		// Cambiar a waiting_quorum
		h.Pool.Exec(r.Context(), `UPDATE assembly_sessions SET status = 'waiting_quorum' WHERE id = $1`, sessionID)
		result["message"] = fmt.Sprintf("Quorum no alcanzado (%.1f%% de %.1f%% requerido). Periodo de gracia hasta %s. Faltan %d miembros por confirmar su presencia.",
			attendancePct, appliedQuorum, graceDeadline.Format("15:04"), secretaryOnlyCount)
		result["status"] = "waiting_quorum"
	} else {
		// Periodo de gracia expirado
		if allowReschedule && recallNumber < maxRecall {
			h.Pool.Exec(r.Context(), `UPDATE assembly_sessions SET status = 'rescheduled' WHERE id = $1`, sessionID)
			result["message"] = fmt.Sprintf("Quorum no alcanzado y periodo de gracia expirado. La asamblea puede reprogramarse (llamado #%d).", recallNumber+1)
			result["status"] = "rescheduled"
		} else {
			h.Pool.Exec(r.Context(), `UPDATE assembly_sessions SET status = 'cancelled' WHERE id = $1`, sessionID)
			result["message"] = "Quorum no alcanzado y no se permite mas reprogramaciones. Asamblea cancelada."
			result["status"] = "cancelled"
		}

		// Notificar a la junta sobre el quorum no alcanzado
		notify := NewNotifyService(h.Pool)
		notify.NotifyBoard(r.Context(), nodeDomain, "quorum_status",
			"Quorum no alcanzado",
			fmt.Sprintf("Quorum no alcanzado (%.1f%% de %.1f%%). %s", attendancePct, appliedQuorum, result["message"]),
			"/app/assembly",
			map[string]interface{}{"session_id": sessionID.String(), "attendance_pct": attendancePct, "status": result["status"]})
	}

	writeJSON(w, 200, result)
}

// ===== Reprogramar asamblea (segundo llamado) =====

func (h *AssemblyHandler) rescheduleSession(w http.ResponseWriter, r *http.Request) {
	sessionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	var req struct {
		NewStartTimeStr string `json:"new_start_time"`
		Title           string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.NewStartTimeStr == "" {
		writeError(w, 400, "new_start_time is required")
		return
	}

	newStartTime, err := time.Parse(time.RFC3339, req.NewStartTimeStr)
	if err != nil {
		writeError(w, 400, "invalid start_time format, use RFC3339")
		return
	}

	// Obtener sesion actual
	var sessionType, status string
	var recallNumber int
	var startTime time.Time
	var originalScheduledTime *time.Time
	var meetingType string
	h.Pool.QueryRow(r.Context(), `
		SELECT session_type, status, recall_number, start_time, original_scheduled_time, COALESCE(meeting_type, 'assembly')
		FROM assembly_sessions WHERE id = $1`, sessionID).
		Scan(&sessionType, &status, &recallNumber, &startTime, &originalScheduledTime, &meetingType)
	if status == "" {
		writeError(w, 404, "sesion no encontrada")
		return
	}

	// Verificar que se pueda reprogramar
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
	var allowReschedule bool
	var maxRecall int
	h.Pool.QueryRow(r.Context(), `
		SELECT allow_reschedule, max_recall_count FROM assembly_quorum_config
		WHERE node_domain = $1 AND session_type = $2 AND meeting_type = $3`, nodeDomain, sessionType, meetingType).
		Scan(&allowReschedule, &maxRecall)
	if !allowReschedule {
		writeError(w, 400, "no se permite reprogramar este tipo de asamblea")
		return
	}
	if recallNumber >= maxRecall {
		writeError(w, 400, fmt.Sprintf("maximo de reprogramaciones alcanzado (%d). No se puede reprogramar mas.", maxRecall))
		return
	}

	// Guardar hora original si es el primer llamado
	if originalScheduledTime == nil {
		h.Pool.Exec(r.Context(), `UPDATE assembly_sessions SET original_scheduled_time = $1 WHERE id = $2`, startTime, sessionID)
	}

	// Actualizar sesion: incrementar recall, nueva hora, status scheduled
	newTitle := req.Title
	if newTitle == "" {
		newTitle = fmt.Sprintf("%s (llamado #%d)", sessionType, recallNumber+2)
	}

	_, err = h.Pool.Exec(r.Context(), `
		UPDATE assembly_sessions
		SET start_time = $1, recall_number = recall_number + 1, status = 'scheduled',
		    quorum_verified = false, quorum_checked_at = NULL, title = $2
		WHERE id = $3`,
		newStartTime, newTitle, sessionID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Limpiar asistencia anterior (los miembros deben volver a confirmar)
	h.Pool.Exec(r.Context(), `DELETE FROM assembly_attendance WHERE session_id = $1`, sessionID)

	writeJSON(w, 200, map[string]interface{}{
		"message":           fmt.Sprintf("Asamblea reprogramada para %s. Es el llamado #%d. El quorum requerido baja a %.1f%%.", newStartTime.Format("02/01/2006 15:04"), recallNumber+2, getQuorumSecondCall(h, nodeDomain, sessionType, meetingType)),
		"session_id":        sessionID.String(),
		"new_start_time":    newStartTime.Format(time.RFC3339),
		"new_recall_number": recallNumber + 1,
	})
}

func getQuorumSecondCall(h *AssemblyHandler, nodeDomain, sessionType, meetingType string) float64 {
	var q float64
	h.Pool.QueryRow(context.Background(), `
		SELECT quorum_second_call FROM assembly_quorum_config
		WHERE node_domain = $1 AND session_type = $2 AND meeting_type = $3`, nodeDomain, sessionType, meetingType).Scan(&q)
	if q == 0 {
		return 30.0
	}
	return q
}

// ===== Doble validacion: auto-confirmacion del miembro =====

// selfCheckIn: el miembro confirma su propia presencia en la asamblea
// Requiere que el secretario ya lo haya marcado como presente
func (h *AssemblyHandler) selfCheckIn(w http.ResponseWriter, r *http.Request) {
	sessionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	// Verificar que el secretario lo marco como presente
	var secretaryConfirmed bool
	h.Pool.QueryRow(r.Context(), `
		SELECT secretary_confirmed FROM assembly_attendance
		WHERE session_id = $1 AND user_id = $2`, sessionID, userID).Scan(&secretaryConfirmed)
	if !secretaryConfirmed {
		writeError(w, 403, "el secretario no te ha marcado como presente. Pidele que pase la lista primero.")
		return
	}

	// Confirmar presencia del miembro
	_, err = h.Pool.Exec(r.Context(), `
		UPDATE assembly_attendance
		SET member_confirmed = true, member_confirmed_at = NOW()
		WHERE session_id = $1 AND user_id = $2`,
		sessionID, userID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"message":    "Presencia confirmada. Gracias por validar tu asistencia.",
		"session_id": sessionID.String(),
		"confirmed":  true,
	})
}

// confirmAttendance: confirmar via token (para QR o tarjeta)
func (h *AssemblyHandler) confirmAttendance(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	if token == "" {
		writeError(w, 400, "token is required")
		return
	}

	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	// Buscar el registro de asistencia por token
	var sessionID uuid.UUID
	var storedUserID uuid.UUID
	var secretaryConfirmed bool
	var tokenExpiresAt *time.Time
	err = h.Pool.QueryRow(r.Context(), `
		SELECT session_id, user_id, secretary_confirmed, token_expires_at
		FROM assembly_attendance WHERE confirmation_token = $1`, token).
		Scan(&sessionID, &storedUserID, &secretaryConfirmed, &tokenExpiresAt)
	if err != nil {
		writeError(w, 404, "token invalido o expirado")
		return
	}

	// Verificar que el token no haya expirado
	if tokenExpiresAt != nil && tokenExpiresAt.Before(time.Now()) {
		writeError(w, 400, "token expirado")
		return
	}

	// Verificar que el usuario que confirma es el mismo que fue marcado
	if storedUserID != userID {
		writeError(w, 403, "este token no corresponde a tu usuario")
		return
	}

	if !secretaryConfirmed {
		writeError(w, 403, "el secretario no te ha marcado como presente")
		return
	}

	// Confirmar
	h.Pool.Exec(r.Context(), `
		UPDATE assembly_attendance
		SET member_confirmed = true, member_confirmed_at = NOW(), confirmation_token = NULL
		WHERE confirmation_token = $1`, token)

	writeJSON(w, 200, map[string]interface{}{
		"message":    "Asistencia confirmada via token.",
		"session_id": sessionID.String(),
		"confirmed":  true,
	})
}

// ===== Convocatoria automatica y frecuencia =====

func (h *AssemblyHandler) getFrequencyConfig(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	var freqMonths, preferredDay, preferredHour, notifDays, attendanceWindow int
	var enabled, isActive bool
	err := h.Pool.QueryRow(r.Context(), `
		SELECT ordinary_frequency_months, preferred_day_of_month, preferred_hour, notification_days_before, assemblies_enabled, is_active, attendance_window_hours
		FROM assembly_frequency_config
		WHERE node_domain = $1 AND scope = 'node' AND scope_id IS NULL`,
		nodeDomain).Scan(&freqMonths, &preferredDay, &preferredHour, &notifDays, &enabled, &isActive, &attendanceWindow)
	if err != nil {
		// Defaults
		writeJSON(w, 200, map[string]interface{}{
			"ordinary_frequency_months": 3,
			"preferred_day_of_month":    15,
			"preferred_hour":            15,
			"notification_days_before":  7,
			"assemblies_enabled":        true,
			"attendance_window_hours":   1,
		})
		return
	}
	if attendanceWindow == 0 {
		attendanceWindow = 1
	}
	writeJSON(w, 200, map[string]interface{}{
		"ordinary_frequency_months": freqMonths,
		"preferred_day_of_month":    preferredDay,
		"preferred_hour":            preferredHour,
		"notification_days_before":  notifDays,
		"assemblies_enabled":        enabled,
		"attendance_window_hours":   attendanceWindow,
	})
}

func (h *AssemblyHandler) updateFrequencyConfig(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	var req struct {
		OrdinaryFrequencyMonths int  `json:"ordinary_frequency_months"`
		PreferredDayOfMonth     int  `json:"preferred_day_of_month"`
		PreferredHour           int  `json:"preferred_hour"`
		NotificationDaysBefore  int  `json:"notification_days_before"`
		AssembliesEnabled       bool `json:"assemblies_enabled"`
		AttendanceWindowHours   int  `json:"attendance_window_hours"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.OrdinaryFrequencyMonths < 0 || req.OrdinaryFrequencyMonths > 12 {
		writeError(w, 400, "frecuencia debe estar entre 0 y 12 meses (0 = no auto-convocar)")
		return
	}
	if req.PreferredDayOfMonth < 0 || req.PreferredDayOfMonth > 28 {
		writeError(w, 400, "dia del mes debe estar entre 0 y 28 (0 = cualquier dia)")
		return
	}
	if req.PreferredHour < 0 || req.PreferredHour > 23 {
		writeError(w, 400, "hora debe estar entre 0 y 23")
		return
	}
	if req.NotificationDaysBefore < 0 || req.NotificationDaysBefore > 60 {
		writeError(w, 400, "dias de notificacion entre 0 y 60")
		return
	}
	if req.AttendanceWindowHours < 0 || req.AttendanceWindowHours > 24 {
		req.AttendanceWindowHours = 1
	}
	if req.AttendanceWindowHours == 0 {
		req.AttendanceWindowHours = 1
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO assembly_frequency_config (node_domain, scope, scope_id, ordinary_frequency_months, preferred_day_of_month, preferred_hour, notification_days_before, assemblies_enabled, is_active, attendance_window_hours)
		VALUES ($1, 'node', NULL, $2, $3, $4, $5, $6, true, $7)
		ON CONFLICT (node_domain, scope, scope_id) DO UPDATE SET
			ordinary_frequency_months = $2,
			preferred_day_of_month = $3,
			preferred_hour = $4,
			notification_days_before = $5,
			assemblies_enabled = $6,
			attendance_window_hours = $7,
			updated_at = NOW()`,
		nodeDomain, req.OrdinaryFrequencyMonths, req.PreferredDayOfMonth, req.PreferredHour, req.NotificationDaysBefore, req.AssembliesEnabled, req.AttendanceWindowHours)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"message": "Configuracion guardada"})
}

// closeSession cierra una asamblea y auto-convoca la siguiente si esta configurado
func (h *AssemblyHandler) closeSession(w http.ResponseWriter, r *http.Request) {
	sessionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	// Marcar como cerrada
	_, err = h.Pool.Exec(r.Context(), `UPDATE assembly_sessions SET status = 'completed', end_time = NOW() WHERE id = $1`, sessionID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	// Notificar a los miembros con voto que la asamblea ha cerrado y la minuta esta disponible
	var sessionTitle string
	h.Pool.QueryRow(r.Context(), `SELECT title FROM assembly_sessions WHERE id = $1`, sessionID).Scan(&sessionTitle)
	notify := NewNotifyService(h.Pool)
	notify.NotifyVotingMembers(r.Context(), nodeDomain, "minutes_published",
		"Asamblea cerrada - minuta disponible",
		fmt.Sprintf("La asamblea \"%s\" ha finalizado. La minuta esta disponible para consulta.", sessionTitle),
		"/app/assembly",
		map[string]interface{}{"session_id": sessionID.String(), "session_title": sessionTitle})

	// Auto-convocar siguiente asamblea ordinaria
	var freqMonths, preferredDay, preferredHour, notifDays int
	var enabled bool
	err = h.Pool.QueryRow(r.Context(), `
		SELECT ordinary_frequency_months, preferred_day_of_month, preferred_hour, notification_days_before, assemblies_enabled
		FROM assembly_frequency_config
		WHERE node_domain = $1 AND scope = 'node' AND scope_id IS NULL AND is_active = true`,
		nodeDomain).Scan(&freqMonths, &preferredDay, &preferredHour, &notifDays, &enabled)
	if err != nil || !enabled || freqMonths == 0 {
		writeJSON(w, 200, map[string]interface{}{
			"message":                "Asamblea cerrada",
			"next_session_scheduled": false,
		})
		return
	}

	// Calcular fecha de la siguiente asamblea
	now := time.Now()
	nextDate := now.AddDate(0, freqMonths, 0)
	if preferredDay > 0 {
		// Ajustar al dia preferido del mes
		year, month, _ := nextDate.Date()
		nextDate = time.Date(year, month, preferredDay, preferredHour, 0, 0, 0, nextDate.Location())
	} else {
		// Usar el mismo dia del mes
		year, month, day := nextDate.Date()
		nextDate = time.Date(year, month, day, preferredHour, 0, 0, 0, nextDate.Location())
	}

	// Crear siguiente sesion
	nextID := uuid.New()
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO assembly_sessions (id, node_domain, session_type, title, start_time, status, is_auto_scheduled)
		VALUES ($1, $2, 'ordinaria', $3, $4, 'scheduled', true)`,
		nextID, nodeDomain, fmt.Sprintf("Asamblea Ordinaria %s", nextDate.Format("January 2006")), nextDate)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"message":                "Asamblea cerrada. Error al auto-convocar siguiente.",
			"next_session_scheduled": false,
		})
		return
	}

	// Enlazar sesion actual con la siguiente
	h.Pool.Exec(r.Context(), `UPDATE assembly_sessions SET next_session_id = $1 WHERE id = $2`, nextID, sessionID)

	// Notificar a todos los miembros
	notifyMembers(h.Pool, nodeDomain, "node", nil, &nextID,
		"Convocatoria a Asamblea Ordinaria",
		fmt.Sprintf("Se ha convocado la siguiente asamblea ordinaria para el %s. Marca tu calendario.", nextDate.Format("02/01/2006 a las 15:04")),
		"convocation")

	writeJSON(w, 200, map[string]interface{}{
		"message":                "Asamblea cerrada. Siguiente asamblea ordinaria convocada automaticamente.",
		"next_session_scheduled": true,
		"next_session_id":        nextID.String(),
		"next_session_date":      nextDate.Format(time.RFC3339),
	})
}

func (h *AssemblyHandler) getNotifications(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, notification_type, title, message, is_read, created_at
		FROM assembly_notifications
		WHERE user_id = $1
		ORDER BY created_at DESC LIMIT 50`, userID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	var notifs []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var notifType, title string
		var message *string
		var isRead bool
		var createdAt time.Time
		rows.Scan(&id, &notifType, &title, &message, &isRead, &createdAt)
		notifs = append(notifs, map[string]interface{}{
			"id":                id.String(),
			"notification_type": notifType,
			"title":             title,
			"message":           deref(message),
			"is_read":           isRead,
			"created_at":        createdAt.Format(time.RFC3339),
		})
	}
	if notifs == nil {
		notifs = []map[string]interface{}{}
	}
	writeJSON(w, 200, notifs)
}

func (h *AssemblyHandler) markNotificationRead(w http.ResponseWriter, r *http.Request) {
	notifID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	h.Pool.Exec(r.Context(), `UPDATE assembly_notifications SET is_read = true, read_at = NOW() WHERE id = $1`, notifID)
	writeJSON(w, 200, map[string]interface{}{"message": "notificacion marcada como leida"})
}

func (h *AssemblyHandler) getProposalTypes(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	if scope == "" {
		scope = "node"
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT proposal_type, label, description, sort_order
		FROM assembly_proposal_types
		WHERE scope = $1 AND is_active = true
		ORDER BY sort_order`, scope)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	var types []map[string]interface{}
	for rows.Next() {
		var ptype, label string
		var desc *string
		var sortOrder int
		rows.Scan(&ptype, &label, &desc, &sortOrder)
		types = append(types, map[string]interface{}{
			"proposal_type": ptype,
			"label":         label,
			"description":   deref(desc),
			"sort_order":    sortOrder,
		})
	}
	if types == nil {
		types = []map[string]interface{}{}
	}
	writeJSON(w, 200, types)
}

// notifyMembers envia notificaciones a todos los miembros elegibles
func notifyMembers(pool *pgxpool.Pool, nodeDomain, scope string, scopeID *uuid.UUID, sessionID *uuid.UUID, title, message, notifType string) {
	var rows pgx.Rows
	var err error

	if scope == "node" {
		rows, err = pool.Query(context.Background(), `
			SELECT id FROM users WHERE node_domain = $1 AND account_type = 'individual' AND membership_status = 'active'`,
			nodeDomain)
	} else if scope == "organization" && scopeID != nil {
		rows, err = pool.Query(context.Background(), `
			SELECT user_id FROM organization_board_members WHERE organization_id = $1 AND is_active = true`,
			*scopeID)
	} else if scope == "department" && scopeID != nil {
		rows, err = pool.Query(context.Background(), `
			SELECT user_id FROM department_members WHERE department_id = $1`,
			*scopeID)
	} else {
		return
	}
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var userID uuid.UUID
		rows.Scan(&userID)
		var sessionIDVal interface{}
		if sessionID != nil {
			sessionIDVal = *sessionID
		}
		pool.Exec(context.Background(), `
			INSERT INTO assembly_notifications (node_domain, scope, scope_id, session_id, user_id, notification_type, title, message)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			nodeDomain, scope, scopeID, sessionIDVal, userID, notifType, title, message)
	}
}
