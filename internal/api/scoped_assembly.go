package api

import (
	"context"
	"encoding/json"
	"federated-credit-node/internal/db"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ScopedAssemblyHandler maneja asambleas de organizaciones y departamentos
type ScopedAssemblyHandler struct {
	Pool       *pgxpool.Pool
	Auth       *AuthMiddleware
	nodeDomain string
}

func NewScopedAssemblyHandler(pool *pgxpool.Pool, auth *AuthMiddleware) *ScopedAssemblyHandler {
	return &ScopedAssemblyHandler{Pool: pool, Auth: auth}
}

func (h *ScopedAssemblyHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Asambleas de organizacion (meeting_type=assembly por defecto)
	r.With(am.RequireAuth).Get("/api/organization/{orgId}/assembly/sessions", h.listSessions)
	r.With(am.RequireAuth).Post("/api/organization/{orgId}/assembly/sessions", h.createSession)
	r.With(am.RequireAuth).Put("/api/organization/{orgId}/assembly/sessions/{id}/minutes", h.updateMinutes)
	r.With(am.RequireAuth).Get("/api/organization/{orgId}/assembly/sessions/{id}/attendance", h.listAttendance)
	r.With(am.RequireAuth).Post("/api/organization/{orgId}/assembly/sessions/{id}/attendance", h.registerAttendance)
	r.With(am.RequireAuth).Get("/api/organization/{orgId}/assembly/proposals", h.listProposals)
	r.With(am.RequireAuth).Post("/api/organization/{orgId}/assembly/proposals", h.createProposal)
	r.With(am.RequireAuth).Post("/api/organization/{orgId}/assembly/proposals/{id}/open-voting", h.openVoting)
	r.With(am.RequireAuth).Post("/api/organization/{orgId}/assembly/proposals/{id}/vote", h.voteProposal)
	r.With(am.RequireAuth).Post("/api/organization/{orgId}/assembly/proposals/{id}/execute", h.executeProposal)
	r.With(am.RequireAuth).Get("/api/organization/{orgId}/assembly/reports", h.listReports)
	r.With(am.RequireAuth).Get("/api/organization/{orgId}/assembly/config", h.getConfig)
	r.With(am.RequireAuth).Put("/api/organization/{orgId}/assembly/config", h.updateConfig)
	r.With(am.RequireAuth).Post("/api/organization/{orgId}/assembly/sessions/{id}/close", h.closeSession)
	r.With(am.RequireAuth).Get("/api/organization/{orgId}/assembly/proposal-types", h.getProposalTypes)

	// Juntas directivas de organizacion (meeting_type=board)
	r.With(am.RequireAuth).Get("/api/organization/{orgId}/board/sessions", h.listBoardSessions)
	r.With(am.RequireAuth).Post("/api/organization/{orgId}/board/sessions", h.createBoardSession)
	r.With(am.RequireAuth).Put("/api/organization/{orgId}/board/sessions/{id}/minutes", h.updateBoardMinutes)
	r.With(am.RequireAuth).Get("/api/organization/{orgId}/board/sessions/{id}/attendance", h.listBoardAttendance)
	r.With(am.RequireAuth).Post("/api/organization/{orgId}/board/sessions/{id}/attendance", h.registerBoardAttendance)
	r.With(am.RequireAuth).Get("/api/organization/{orgId}/board/proposals", h.listBoardProposals)
	r.With(am.RequireAuth).Post("/api/organization/{orgId}/board/proposals", h.createBoardProposal)
	r.With(am.RequireAuth).Post("/api/organization/{orgId}/board/proposals/{id}/open-voting", h.openBoardVoting)
	r.With(am.RequireAuth).Post("/api/organization/{orgId}/board/proposals/{id}/vote", h.voteBoardProposal)
	r.With(am.RequireAuth).Post("/api/organization/{orgId}/board/proposals/{id}/execute", h.executeBoardProposal)
	r.With(am.RequireAuth).Get("/api/organization/{orgId}/board/reports", h.listBoardReports)
	r.With(am.RequireAuth).Get("/api/organization/{orgId}/board/config", h.getBoardConfig)
	r.With(am.RequireAuth).Put("/api/organization/{orgId}/board/config", h.updateBoardConfig)
	r.With(am.RequireAuth).Post("/api/organization/{orgId}/board/sessions/{id}/close", h.closeBoardSession)
	r.With(am.RequireAuth).Get("/api/organization/{orgId}/board/proposal-types", h.getBoardProposalTypes)

	// Asambleas de departamento
	r.With(am.RequireAuth).Get("/api/department/{deptId}/assembly/sessions", h.listSessions)
	r.With(am.RequireAuth).Post("/api/department/{deptId}/assembly/sessions", h.createSession)
	r.With(am.RequireAuth).Put("/api/department/{deptId}/assembly/sessions/{id}/minutes", h.updateMinutes)
	r.With(am.RequireAuth).Get("/api/department/{deptId}/assembly/sessions/{id}/attendance", h.listAttendance)
	r.With(am.RequireAuth).Post("/api/department/{deptId}/assembly/sessions/{id}/attendance", h.registerAttendance)
	r.With(am.RequireAuth).Get("/api/department/{deptId}/assembly/proposals", h.listProposals)
	r.With(am.RequireAuth).Post("/api/department/{deptId}/assembly/proposals", h.createProposal)
	r.With(am.RequireAuth).Post("/api/department/{deptId}/assembly/proposals/{id}/open-voting", h.openVoting)
	r.With(am.RequireAuth).Post("/api/department/{deptId}/assembly/proposals/{id}/vote", h.voteProposal)
	r.With(am.RequireAuth).Post("/api/department/{deptId}/assembly/proposals/{id}/execute", h.executeProposal)
	r.With(am.RequireAuth).Get("/api/department/{deptId}/assembly/reports", h.listReports)
	r.With(am.RequireAuth).Get("/api/department/{deptId}/assembly/config", h.getConfig)
	r.With(am.RequireAuth).Put("/api/department/{deptId}/assembly/config", h.updateConfig)
	r.With(am.RequireAuth).Post("/api/department/{deptId}/assembly/sessions/{id}/close", h.closeSession)
	r.With(am.RequireAuth).Get("/api/department/{deptId}/assembly/proposal-types", h.getProposalTypes)
}

// getScope extrae el scope y scope_id de la URL
func (h *ScopedAssemblyHandler) getScope(r *http.Request) (string, *uuid.UUID, error) {
	orgID := chi.URLParam(r, "orgId")
	deptID := chi.URLParam(r, "deptId")
	if orgID != "" {
		id, err := uuid.Parse(orgID)
		if err != nil {
			return "", nil, fmt.Errorf("invalid org id")
		}
		return "organization", &id, nil
	}
	if deptID != "" {
		id, err := uuid.Parse(deptID)
		if err != nil {
			return "", nil, fmt.Errorf("invalid dept id")
		}
		return "department", &id, nil
	}
	return "", nil, fmt.Errorf("no scope found")
}

// getMeetingType extrae meeting_type del query param (default: "assembly")
func (h *ScopedAssemblyHandler) getMeetingType(r *http.Request) string {
	mt := r.URL.Query().Get("meeting_type")
	if mt == "" {
		mt = "assembly"
	}
	if mt != "assembly" && mt != "board" {
		mt = "assembly"
	}
	return mt
}

// getEligibleVoters obtiene los miembros con derecho a voto segun el scope y meeting_type
func (h *ScopedAssemblyHandler) getEligibleVoters(ctx context.Context, scope string, scopeID uuid.UUID, meetingType string) ([]uuid.UUID, error) {
	if scope == "organization" {
		// Junta directiva: solo miembros de la junta, sin importar el tipo de organizacion
		if meetingType == "board" {
			rows, err := h.Pool.Query(ctx, `
				SELECT user_id FROM organization_board_members
				WHERE organization_id = $1 AND is_active = true`, scopeID)
			if err != nil {
				return nil, err
			}
			defer rows.Close()
			var voters []uuid.UUID
			for rows.Next() {
				var id uuid.UUID
				rows.Scan(&id)
				voters = append(voters, id)
			}
			return voters, nil
		}

		// Asamblea: verificar si es organizacion de la Asamblea
		var isAssemblyOwned bool
		var nodeDomain string
		_ = h.Pool.QueryRow(ctx, `SELECT COALESCE(is_assembly_owned, false), node_domain FROM users WHERE id = $1`, scopeID).Scan(&isAssemblyOwned, &nodeDomain)

		if isAssemblyOwned {
			// Las organizaciones de la Asamblea usan la Asamblea General:
			// todos los miembros activos del nodo son votantes
			rows, err := h.Pool.Query(ctx, `
				SELECT id FROM users
				WHERE node_domain = $1 AND account_type = 'individual' AND membership_status = 'active'`,
				nodeDomain)
			if err != nil {
				return nil, err
			}
			defer rows.Close()
			var voters []uuid.UUID
			for rows.Next() {
				var id uuid.UUID
				rows.Scan(&id)
				voters = append(voters, id)
			}
			return voters, nil
		}

		// Organizacion regular: todos los miembros de la organizacion
		// (junta directiva + miembros suscritos a servicios de la org)
		rows, err := h.Pool.Query(ctx, `
			SELECT DISTINCT user_id FROM (
				SELECT user_id FROM organization_board_members
				WHERE organization_id = $1 AND is_active = true
				UNION
				SELECT sub.user_id FROM organization_subscriptions sub
				JOIN organization_services svc ON svc.id = sub.service_id
				WHERE svc.organization_id = $1 AND sub.status IN ('active', 'auto')
			) AS members`, scopeID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var voters []uuid.UUID
		for rows.Next() {
			var id uuid.UUID
			rows.Scan(&id)
			voters = append(voters, id)
		}
		return voters, nil
	}
	// department
	rows, err := h.Pool.Query(ctx, `
		SELECT user_id FROM department_members
		WHERE department_id = $1`, scopeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var voters []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		rows.Scan(&id)
		voters = append(voters, id)
	}
	return voters, nil
}

func (h *ScopedAssemblyHandler) listSessions(w http.ResponseWriter, r *http.Request) {
	scope, scopeID, err := h.getScope(r)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
	meetingType := h.getMeetingType(r)

	filter := r.URL.Query().Get("filter")
	query := `SELECT id, session_type, title, description, start_time, end_time, status, created_at,
		       is_presential, minutes, recall_number, quorum_verified
		FROM assembly_sessions_scoped
		WHERE node_domain = $1 AND scope = $2 AND scope_id = $3 AND meeting_type = $4`
	args := []interface{}{nodeDomain, scope, scopeID, meetingType}
	switch filter {
	case "upcoming":
		query += ` AND status IN ('scheduled', 'waiting_quorum', 'active') ORDER BY start_time ASC LIMIT 50`
	case "past":
		query += ` AND status IN ('completed', 'cancelled', 'expired') ORDER BY start_time DESC LIMIT 50`
	default:
		query += ` ORDER BY created_at DESC LIMIT 50`
	}
	rows, err := h.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	var sessions []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var sessionType, title, status string
		var description *string
		var startTime time.Time
		var endTime *time.Time
		var createdAt time.Time
		var isPresential bool
		var minutes *string
		var recallNumber int
		var quorumVerified bool
		rows.Scan(&id, &sessionType, &title, &description, &startTime, &endTime, &status, &createdAt,
			&isPresential, &minutes, &recallNumber, &quorumVerified)
		sessions = append(sessions, map[string]interface{}{
			"id":              id.String(),
			"session_type":    sessionType,
			"title":           title,
			"description":     deref(description),
			"start_time":      startTime,
			"end_time":        derefTime(endTime),
			"status":          status,
			"created_at":      createdAt,
			"is_presential":   isPresential,
			"minutes":         deref(minutes),
			"recall_number":   recallNumber,
			"quorum_verified": quorumVerified,
		})
	}
	if sessions == nil {
		sessions = []map[string]interface{}{}
	}
	writeJSON(w, 200, sessions)
}

func (h *ScopedAssemblyHandler) createSession(w http.ResponseWriter, r *http.Request) {
	scope, scopeID, err := h.getScope(r)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	var req struct {
		SessionType  string `json:"session_type"`
		Title        string `json:"title"`
		Description  string `json:"description"`
		StartTimeStr string `json:"start_time"`
		IsPresential bool   `json:"is_presential"`
	}
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
	if req.StartTimeStr == "" {
		writeError(w, 400, "debes especificar la fecha y hora de la asamblea")
		return
	}

	startTime, err := time.Parse(time.RFC3339, req.StartTimeStr)
	if err != nil {
		writeError(w, 400, "formato de fecha invalido")
		return
	}

	// Validar tiempo minimo de anticipacion
	var minAdvanceHours int
	switch req.SessionType {
	case "ordinaria":
		minAdvanceHours = 168
	case "extraordinaria":
		minAdvanceHours = 24
	case "urgente":
		minAdvanceHours = 1
	default:
		minAdvanceHours = 24
	}
	minStartTime := time.Now().Add(time.Duration(minAdvanceHours) * time.Hour)
	if startTime.Before(minStartTime) {
		writeError(w, 400, fmt.Sprintf(
			"Una asamblea %s debe crearse con al menos %d horas de anticipacion.",
			req.SessionType, minAdvanceHours))
		return
	}

	id := uuid.New()
	meetingType := h.getMeetingType(r)
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO assembly_sessions_scoped (id, node_domain, scope, scope_id, session_type, title, description, start_time, status, is_presential, meeting_type)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9, $10)`,
		id, nodeDomain, scope, scopeID, req.SessionType, req.Title, req.Description, startTime, req.IsPresential, meetingType)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":            id.String(),
		"title":         req.Title,
		"status":        "scheduled",
		"is_presential": req.IsPresential,
		"message":       "Sesion creada",
	})
}

func (h *ScopedAssemblyHandler) updateMinutes(w http.ResponseWriter, r *http.Request) {
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
		UPDATE assembly_sessions_scoped SET minutes = $1, minutes_updated_by = $2, minutes_updated_at = NOW()
		WHERE id = $3`, req.Minutes, userID, sessionID)

	writeJSON(w, 200, map[string]interface{}{"message": "Minuta guardada"})
}

func (h *ScopedAssemblyHandler) listAttendance(w http.ResponseWriter, r *http.Request) {
	sessionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT a.user_id, u.username, u.display_name, a.registered_at, a.secretary_confirmed, a.member_confirmed
		FROM assembly_attendance_scoped a
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
		var secConfirmed, memConfirmed bool
		rows.Scan(&userID, &username, &displayName, &registeredAt, &secConfirmed, &memConfirmed)
		attendance = append(attendance, map[string]interface{}{
			"user_id":             userID.String(),
			"username":            username,
			"display_name":        displayName,
			"registered_at":       registeredAt.Format(time.RFC3339),
			"secretary_confirmed": secConfirmed,
			"member_confirmed":    memConfirmed,
		})
	}
	if attendance == nil {
		attendance = []map[string]interface{}{}
	}
	writeJSON(w, 200, attendance)
}

func (h *ScopedAssemblyHandler) registerAttendance(w http.ResponseWriter, r *http.Request) {
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
			INSERT INTO assembly_attendance_scoped (session_id, user_id, registered_by)
			VALUES ($1, $2, $3)
			ON CONFLICT (session_id, user_id) DO NOTHING`,
			sessionID, uid, userID)
		if err == nil {
			count++
		}
	}

	writeJSON(w, 200, map[string]interface{}{
		"message":    "Asistencia registrada",
		"registered": count,
	})
}

func (h *ScopedAssemblyHandler) listProposals(w http.ResponseWriter, r *http.Request) {
	scope, scopeID, err := h.getScope(r)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	// Obtener sesiones del scope
	meetingType := h.getMeetingType(r)
	rows, err := h.Pool.Query(r.Context(), `
		SELECT d.id, d.session_id, d.decision_type, d.description, d.status, d.created_at,
		       d.voting_deadline, d.voting_duration_minutes, d.executed_at,
		       COALESCE(sv.votes_for, 0), COALESCE(sv.votes_against, 0), COALESCE(sv.votes_abstain, 0),
		       COALESCE(sv.total_votes, 0)
		FROM assembly_decisions_scoped d
		JOIN assembly_sessions_scoped s ON s.id = d.session_id
		LEFT JOIN (
			SELECT decision_id,
				COUNT(*) FILTER (WHERE vote = 'for') as votes_for,
				COUNT(*) FILTER (WHERE vote = 'against') as votes_against,
				COUNT(*) FILTER (WHERE vote = 'abstain') as votes_abstain,
				COUNT(*) as total_votes
			FROM assembly_votes_scoped GROUP BY decision_id
		) sv ON sv.decision_id = d.id
		WHERE s.node_domain = $1 AND s.scope = $2 AND s.scope_id = $3 AND s.meeting_type = $4
		ORDER BY d.created_at DESC`, nodeDomain, scope, scopeID, meetingType)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	// Obtener total de votantes
	voters, _ := h.getEligibleVoters(r.Context(), scope, *scopeID, h.getMeetingType(r))
	totalVotingMembers := len(voters)

	var proposals []map[string]interface{}
	for rows.Next() {
		var id, sessionID uuid.UUID
		var decisionType, description, status string
		var createdAt time.Time
		var votingDeadline *time.Time
		var votingDurationMinutes *int
		var executedAt *time.Time
		var votesFor, votesAgainst, votesAbstain, totalVotes int
		rows.Scan(&id, &sessionID, &decisionType, &description, &status, &createdAt,
			&votingDeadline, &votingDurationMinutes, &executedAt,
			&votesFor, &votesAgainst, &votesAbstain, &totalVotes)

		notVoted := totalVotingMembers - totalVotes
		if notVoted < 0 {
			notVoted = 0
		}

		proposals = append(proposals, map[string]interface{}{
			"id":                      id.String(),
			"session_id":              sessionID.String(),
			"proposal_type":           decisionType,
			"description":             description,
			"status":                  status,
			"created_at":              createdAt,
			"voting_deadline":         derefTime(votingDeadline),
			"voting_duration_minutes": derefInt(votingDurationMinutes),
			"executed_at":             derefTime(executedAt),
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

func (h *ScopedAssemblyHandler) createProposal(w http.ResponseWriter, r *http.Request) {
	scope, scopeID, err := h.getScope(r)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	var req struct {
		SessionID             string                 `json:"session_id"`
		ProposalType          string                 `json:"proposal_type"`
		Description           string                 `json:"description"`
		Parameters            map[string]interface{} `json:"parameters"`
		VotingDurationMinutes int                    `json:"voting_duration_minutes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Description == "" {
		writeError(w, 400, "description is required")
		return
	}
	if req.ProposalType == "" {
		req.ProposalType = "free_proposal"
	}
	if req.VotingDurationMinutes == 0 {
		req.VotingDurationMinutes = 1440
	}

	// Validar que el tipo de propuesta este permitido para este scope
	var allowed int
	h.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM assembly_proposal_types WHERE scope = $1 AND proposal_type = $2 AND is_active = true`, scope, req.ProposalType).Scan(&allowed)
	if allowed == 0 {
		writeError(w, 400, fmt.Sprintf("el tipo de propuesta '%s' no esta permitido para %s. Los departamentos y organizaciones no pueden tomar decisiones de la asamblea del nodo.", req.ProposalType, scope))
		return
	}

	// Buscar o crear sesion activa
	var sessionID uuid.UUID
	if req.SessionID != "" {
		sessionID, err = uuid.Parse(req.SessionID)
		if err != nil {
			writeError(w, 400, "invalid session_id")
			return
		}
	} else {
		// Buscar sesion activa o scheduled
		err = h.Pool.QueryRow(r.Context(), `
			SELECT id FROM assembly_sessions_scoped
			WHERE node_domain = $1 AND scope = $2 AND scope_id = $3
			AND status IN ('scheduled', 'active', 'waiting_quorum')
			ORDER BY created_at DESC LIMIT 1`, nodeDomain, scope, scopeID).Scan(&sessionID)
		if err != nil {
			// Crear sesion automatica
			sessionID = uuid.New()
			h.Pool.Exec(r.Context(), `
				INSERT INTO assembly_sessions_scoped (id, node_domain, scope, scope_id, session_type, title, start_time, status)
				VALUES ($1, $2, $3, $4, 'ordinaria', 'Sesion automatica', NOW(), 'active')`,
				sessionID, nodeDomain, scope, scopeID)
		}
	}

	newValue, _ := json.Marshal(req.Parameters)

	id := uuid.New()
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO assembly_decisions_scoped (id, session_id, decision_type, description, new_value, required_signatures, status, voting_duration_minutes)
		VALUES ($1, $2, $3, $4, $5, 1, 'proposed', $6)`,
		id, sessionID, req.ProposalType, req.Description, newValue, req.VotingDurationMinutes)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Auto-agregar a la minuta
	appendScopedMinutes(h.Pool, sessionID, fmt.Sprintf("- [Propuesta] %s: %s", req.ProposalType, req.Description))

	writeJSON(w, 201, map[string]interface{}{
		"id":                      id.String(),
		"status":                  "proposed",
		"voting_duration_minutes": req.VotingDurationMinutes,
		"message":                 "Propuesta creada. La asamblea debe revisarla y abrir la votacion.",
	})
}

func (h *ScopedAssemblyHandler) openVoting(w http.ResponseWriter, r *http.Request) {
	decisionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	var status, decisionType, description string
	var votingDurationMinutes int
	var sessionID uuid.UUID
	h.Pool.QueryRow(r.Context(), `
		SELECT status, decision_type, description, voting_duration_minutes, session_id
		FROM assembly_decisions_scoped WHERE id = $1`, decisionID).
		Scan(&status, &decisionType, &description, &votingDurationMinutes, &sessionID)
	if status == "" {
		writeError(w, 404, "propuesta no encontrada")
		return
	}
	if status != "proposed" {
		writeError(w, 400, "esta propuesta no esta pendiente de revision")
		return
	}
	if votingDurationMinutes == 0 {
		votingDurationMinutes = 1440
	}

	userID, _ := h.Auth.GetUserID(r)
	_, err = h.Pool.Exec(r.Context(), `
		UPDATE assembly_decisions_scoped
		SET status = 'pending',
		    voting_deadline = NOW() + ($1 || ' minutes')::INTERVAL,
		    approved_for_voting_by = $2,
		    approved_for_voting_at = NOW()
		WHERE id = $3`,
		votingDurationMinutes, userID, decisionID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	appendScopedMinutes(h.Pool, sessionID, fmt.Sprintf("- [Votacion abierta] %s: %s (duracion: %d min)", decisionType, description, votingDurationMinutes))

	writeJSON(w, 200, map[string]interface{}{
		"id":      decisionID.String(),
		"status":  "pending",
		"message": "Votacion abierta",
	})
}

func (h *ScopedAssemblyHandler) voteProposal(w http.ResponseWriter, r *http.Request) {
	decisionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	var req struct {
		Vote   string `json:"vote"`
		Reason string `json:"reason"`
	}
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

	// Verificar estado y deadline
	var status string
	var votingDeadline *time.Time
	var sessionID uuid.UUID
	h.Pool.QueryRow(r.Context(), `SELECT status, voting_deadline, session_id FROM assembly_decisions_scoped WHERE id = $1`, decisionID).Scan(&status, &votingDeadline, &sessionID)
	if status != "pending" {
		writeError(w, 400, "esta propuesta ya no acepta votos (estado: "+status+")")
		return
	}
	if votingDeadline != nil && votingDeadline.Before(time.Now()) {
		h.Pool.Exec(r.Context(), `UPDATE assembly_decisions_scoped SET status = 'expired' WHERE id = $1`, decisionID)
		writeError(w, 400, "el tiempo de votacion ha expirado")
		return
	}

	// Verificar que el votante es miembro elegible
	scope, scopeID, err := h.getScope(r)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	voters, _ := h.getEligibleVoters(r.Context(), scope, *scopeID, h.getMeetingType(r))
	isEligible := false
	for _, v := range voters {
		if v == userID {
			isEligible = true
			break
		}
	}

	// En asamblea presencial, verificar asistencia
	var isPresential bool
	h.Pool.QueryRow(r.Context(), `SELECT is_presential FROM assembly_sessions_scoped WHERE id = $1`, sessionID).Scan(&isPresential)
	if isPresential {
		var isPresent int
		h.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM assembly_attendance_scoped WHERE session_id = $1 AND user_id = $2 AND secretary_confirmed = true AND member_confirmed = true`, sessionID, userID).Scan(&isPresent)
		if isPresent == 0 {
			writeError(w, 403, "esta votacion es presencial. Solo pueden votar los miembros presentes con doble confirmacion.")
			return
		}
	} else if !isEligible {
		writeError(w, 403, "no eres miembro de esta organizacion/departamento con derecho a voto")
		return
	}

	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO assembly_votes_scoped (decision_id, voter_id, vote, reason)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (decision_id, voter_id) DO UPDATE SET vote = $3, reason = $4`,
		decisionID, userID, req.Vote, req.Reason)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"message": "Voto registrado"})
}

func (h *ScopedAssemblyHandler) executeProposal(w http.ResponseWriter, r *http.Request) {
	decisionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}

	var status, decisionType, description string
	var votingDeadline *time.Time
	var sessionID uuid.UUID
	h.Pool.QueryRow(r.Context(), `SELECT status, decision_type, description, voting_deadline, session_id FROM assembly_decisions_scoped WHERE id = $1`, decisionID).
		Scan(&status, &decisionType, &description, &votingDeadline, &sessionID)
	if status == "" {
		writeError(w, 404, "propuesta no encontrada")
		return
	}
	if status == "pending" && votingDeadline != nil && votingDeadline.Before(time.Now()) {
		h.Pool.Exec(r.Context(), `UPDATE assembly_decisions_scoped SET status = 'expired' WHERE id = $1`, decisionID)
		writeError(w, 400, "el tiempo de votacion ha expirado")
		return
	}
	if status != "pending" && status != "approved" {
		writeError(w, 400, "la propuesta no esta en votacion")
		return
	}

	// Contar votos
	var votesFor, votesAgainst, votesAbstain int
	h.Pool.QueryRow(r.Context(), `
		SELECT
			COUNT(*) FILTER (WHERE vote = 'for'),
			COUNT(*) FILTER (WHERE vote = 'against'),
			COUNT(*) FILTER (WHERE vote = 'abstain')
		FROM assembly_votes_scoped WHERE decision_id = $1`, decisionID).Scan(&votesFor, &votesAgainst, &votesAbstain)

	// Miembros elegibles
	scope, scopeID, err := h.getScope(r)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	voters, _ := h.getEligibleVoters(r.Context(), scope, *scopeID, h.getMeetingType(r))
	totalVotingMembers := len(voters)
	totalVotes := votesFor + votesAgainst + votesAbstain
	notVoted := totalVotingMembers - totalVotes
	if notVoted < 0 {
		notVoted = 0
	}

	// Aprobacion: mayoria simple (mas a favor que en contra)
	approved := votesFor > votesAgainst

	if approved {
		h.Pool.Exec(r.Context(), `UPDATE assembly_decisions_scoped SET status = 'executed', executed_at = NOW() WHERE id = $1`, decisionID)
		appendScopedMinutes(h.Pool, sessionID, fmt.Sprintf("- [APROBADA] %s: %s (a favor: %d, en contra: %d, abstencion: %d)", decisionType, description, votesFor, votesAgainst, votesAbstain))

		// Ejecutar la decision segun el tipo
		var newValue *[]byte
		h.Pool.QueryRow(r.Context(), `SELECT new_value FROM assembly_decisions_scoped WHERE id = $1`, decisionID).Scan(&newValue)
		var params map[string]interface{}
		if newValue != nil {
			json.Unmarshal(*newValue, &params)
		}
		h.executeScopedDecision(r, scope, *scopeID, decisionType, params)
	} else {
		h.Pool.Exec(r.Context(), `UPDATE assembly_decisions_scoped SET status = 'rejected' WHERE id = $1`, decisionID)
		appendScopedMinutes(h.Pool, sessionID, fmt.Sprintf("- [RECHAZADA] %s: %s (a favor: %d, en contra: %d, abstencion: %d)", decisionType, description, votesFor, votesAgainst, votesAbstain))
	}

	writeJSON(w, 200, map[string]interface{}{
		"id":                   decisionID.String(),
		"status":               map[bool]string{true: "executed", false: "rejected"}[approved],
		"votes_for":            votesFor,
		"votes_against":        votesAgainst,
		"votes_abstain":        votesAbstain,
		"votes_not_cast":       notVoted,
		"total_voting_members": totalVotingMembers,
	})
}

func (h *ScopedAssemblyHandler) listReports(w http.ResponseWriter, r *http.Request) {
	scope, scopeID, err := h.getScope(r)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	voters, _ := h.getEligibleVoters(r.Context(), scope, *scopeID, h.getMeetingType(r))
	totalVotingMembers := len(voters)

	rows, err := h.Pool.Query(r.Context(), `
		SELECT d.id, d.decision_type, d.description, d.status, d.created_at, d.executed_at,
		       d.voting_deadline, d.voting_duration_minutes,
		       COALESCE(sv.votes_for, 0), COALESCE(sv.votes_against, 0), COALESCE(sv.votes_abstain, 0),
		       COALESCE(sv.total_votes, 0)
		FROM assembly_decisions_scoped d
		JOIN assembly_sessions_scoped s ON s.id = d.session_id
		LEFT JOIN (
			SELECT decision_id,
				COUNT(*) FILTER (WHERE vote = 'for') as votes_for,
				COUNT(*) FILTER (WHERE vote = 'against') as votes_against,
				COUNT(*) FILTER (WHERE vote = 'abstain') as votes_abstain,
				COUNT(*) as total_votes
			FROM assembly_votes_scoped GROUP BY decision_id
		) sv ON sv.decision_id = d.id
		WHERE s.node_domain = $1 AND s.scope = $2 AND s.scope_id = $3
		ORDER BY d.created_at DESC LIMIT 200`, nodeDomain, scope, scopeID)
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
		CreatedAt          string  `json:"created_at"`
		ExecutedAt         string  `json:"executed_at"`
		VotesFor           int     `json:"votes_for"`
		VotesAgainst       int     `json:"votes_against"`
		VotesAbstain       int     `json:"votes_abstain"`
		VotesNotCast       int     `json:"votes_not_cast"`
		TotalVotesCast     int     `json:"total_votes_cast"`
		TotalVotingMembers int     `json:"total_voting_members"`
		ParticipationPct   float64 `json:"participation_pct"`
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

		reports = append(reports, Report{
			ID:                 id.String(),
			ProposalType:       decisionType,
			Description:        description,
			Status:             status,
			CreatedAt:          createdAt.Format(time.RFC3339),
			ExecutedAt:         derefTime(executedAt),
			VotesFor:           votesFor,
			VotesAgainst:       votesAgainst,
			VotesAbstain:       votesAbstain,
			VotesNotCast:       notVoted,
			TotalVotesCast:     totalVotes,
			TotalVotingMembers: totalVotingMembers,
			ParticipationPct:   participationPct,
		})
	}
	if reports == nil {
		reports = []Report{}
	}

	writeJSON(w, 200, map[string]interface{}{
		"reports":              reports,
		"total_voting_members": totalVotingMembers,
	})
}

// appendScopedMinutes agrega una linea a la minuta de una sesion scoped
func appendScopedMinutes(pool *pgxpool.Pool, sessionID uuid.UUID, entry string) {
	timestamp := time.Now().Format("15:04")
	line := fmt.Sprintf("[%s] %s\n", timestamp, entry)
	pool.Exec(context.Background(), `
		UPDATE assembly_sessions_scoped
		SET minutes = COALESCE(minutes, '') || $1,
		    minutes_updated_at = NOW()
		WHERE id = $2`, line, sessionID)
}

// ===== Config de asamblea de org/depto =====

func (h *ScopedAssemblyHandler) getConfig(w http.ResponseWriter, r *http.Request) {
	scope, scopeID, err := h.getScope(r)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	// Verificar si tiene asambleas habilitadas
	hasAssembly := false
	if scope == "organization" {
		h.Pool.QueryRow(r.Context(), `SELECT COALESCE(has_assembly, false) FROM users WHERE id = $1`, scopeID).Scan(&hasAssembly)
	} else {
		h.Pool.QueryRow(r.Context(), `SELECT COALESCE(has_assembly, false) FROM departments WHERE id = $1`, scopeID).Scan(&hasAssembly)
	}

	// Frecuencia
	var freqMonths, preferredDay, preferredHour, notifDays int
	var enabled bool
	err = h.Pool.QueryRow(r.Context(), `
		SELECT ordinary_frequency_months, preferred_day_of_month, preferred_hour, notification_days_before, assemblies_enabled
		FROM assembly_frequency_config
		WHERE node_domain = $1 AND scope = $2 AND scope_id = $3`,
		nodeDomain, scope, scopeID).Scan(&freqMonths, &preferredDay, &preferredHour, &notifDays, &enabled)
	if err != nil {
		freqMonths = 3
		preferredDay = 15
		preferredHour = 15
		notifDays = 7
		enabled = hasAssembly
	}

	writeJSON(w, 200, map[string]interface{}{
		"has_assembly":              hasAssembly,
		"ordinary_frequency_months": freqMonths,
		"preferred_day_of_month":    preferredDay,
		"preferred_hour":            preferredHour,
		"notification_days_before":  notifDays,
		"assemblies_enabled":        enabled,
	})
}

func (h *ScopedAssemblyHandler) updateConfig(w http.ResponseWriter, r *http.Request) {
	scope, scopeID, err := h.getScope(r)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	var req struct {
		HasAssembly             bool `json:"has_assembly"`
		OrdinaryFrequencyMonths int  `json:"ordinary_frequency_months"`
		PreferredDayOfMonth     int  `json:"preferred_day_of_month"`
		PreferredHour           int  `json:"preferred_hour"`
		NotificationDaysBefore  int  `json:"notification_days_before"`
		AssembliesEnabled       bool `json:"assemblies_enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Actualizar has_assembly en la tabla correspondiente
	if scope == "organization" {
		h.Pool.Exec(r.Context(), `UPDATE users SET has_assembly = $1 WHERE id = $2`, req.HasAssembly, scopeID)
	} else {
		h.Pool.Exec(r.Context(), `UPDATE departments SET has_assembly = $1 WHERE id = $2`, req.HasAssembly, scopeID)
	}

	// Actualizar frecuencia
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO assembly_frequency_config (node_domain, scope, scope_id, ordinary_frequency_months, preferred_day_of_month, preferred_hour, notification_days_before, assemblies_enabled, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
		ON CONFLICT (node_domain, scope, scope_id) DO UPDATE SET
			ordinary_frequency_months = $4,
			preferred_day_of_month = $5,
			preferred_hour = $6,
			notification_days_before = $7,
			assemblies_enabled = $8,
			updated_at = NOW()`,
		nodeDomain, scope, scopeID, req.OrdinaryFrequencyMonths, req.PreferredDayOfMonth, req.PreferredHour, req.NotificationDaysBefore, req.AssembliesEnabled)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"message": "Configuracion guardada"})
}

// closeSession cierra una asamblea scoped y auto-convoca la siguiente
func (h *ScopedAssemblyHandler) closeSession(w http.ResponseWriter, r *http.Request) {
	sessionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	scope, scopeID, err := h.getScope(r)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)

	_, err = h.Pool.Exec(r.Context(), `UPDATE assembly_sessions_scoped SET status = 'completed', end_time = NOW() WHERE id = $1`, sessionID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Auto-convocar siguiente
	var freqMonths, preferredDay, preferredHour, notifDays int
	var enabled bool
	err = h.Pool.QueryRow(r.Context(), `
		SELECT ordinary_frequency_months, preferred_day_of_month, preferred_hour, notification_days_before, assemblies_enabled
		FROM assembly_frequency_config
		WHERE node_domain = $1 AND scope = $2 AND scope_id = $3 AND is_active = true`,
		nodeDomain, scope, scopeID).Scan(&freqMonths, &preferredDay, &preferredHour, &notifDays, &enabled)
	if err != nil || !enabled || freqMonths == 0 {
		writeJSON(w, 200, map[string]interface{}{
			"message":                "Asamblea cerrada",
			"next_session_scheduled": false,
		})
		return
	}

	now := time.Now()
	nextDate := now.AddDate(0, freqMonths, 0)
	if preferredDay > 0 {
		year, month, _ := nextDate.Date()
		nextDate = time.Date(year, month, preferredDay, preferredHour, 0, 0, 0, nextDate.Location())
	} else {
		year, month, day := nextDate.Date()
		nextDate = time.Date(year, month, day, preferredHour, 0, 0, 0, nextDate.Location())
	}

	nextID := uuid.New()
	label := "Organizacion"
	if scope == "department" {
		label = "Departamento"
	}
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO assembly_sessions_scoped (id, node_domain, scope, scope_id, session_type, title, start_time, status, is_auto_scheduled)
		VALUES ($1, $2, $3, $4, 'ordinaria', $5, $6, 'scheduled', true)`,
		nextID, nodeDomain, scope, scopeID, fmt.Sprintf("Asamblea Ordinaria %s %s", label, nextDate.Format("January 2006")), nextDate)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"message":                "Asamblea cerrada. Error al auto-convocar siguiente.",
			"next_session_scheduled": false,
		})
		return
	}

	h.Pool.Exec(r.Context(), `UPDATE assembly_sessions_scoped SET next_session_id = $1 WHERE id = $2`, nextID, sessionID)

	// Notificar a miembros
	notifyMembers(h.Pool, nodeDomain, scope, scopeID, &nextID,
		"Convocatoria a Asamblea Ordinaria",
		fmt.Sprintf("Se ha convocado la siguiente asamblea ordinaria para el %s.", nextDate.Format("02/01/2006 a las 15:04")),
		"convocation")

	writeJSON(w, 200, map[string]interface{}{
		"message":                "Asamblea cerrada. Siguiente asamblea ordinaria convocada automaticamente.",
		"next_session_scheduled": true,
		"next_session_id":        nextID.String(),
		"next_session_date":      nextDate.Format(time.RFC3339),
	})
}

// getProposalTypes devuelve los tipos de propuestas permitidos para el scope
func (h *ScopedAssemblyHandler) getProposalTypes(w http.ResponseWriter, r *http.Request) {
	scope, _, err := h.getScope(r)
	if err != nil {
		writeError(w, 400, err.Error())
		return
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

// executeScopedDecision ejecuta la decision segun su tipo para org/depto
// Reglas de transferencia:
// - Organizacion: puede transferir a organizaciones, departamentos y personas
// - Departamento: puede transferir a organizaciones, departamentos y personas
// - Asamblea del nodo: SOLO organizaciones y departamentos, NUNCA personas
func (h *ScopedAssemblyHandler) executeScopedDecision(r *http.Request, scope string, scopeID uuid.UUID, decisionType string, params map[string]interface{}) error {
	switch decisionType {
	case "fund_distribution":
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

		// Organizaciones y departamentos PUEDEN transferir a personas
		// (a diferencia de la asamblea del nodo que no puede)
		// No hay validacion de tipo de cuenta aqui

		// Realizar la transferencia desde la cuenta de la org/depto
		_, err = h.Pool.Exec(r.Context(), `
			UPDATE users SET balance = balance - $1 WHERE id = $2`,
			int64(amount), scopeID)
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
		scopeLabel := "organizacion"
		if scope == "department" {
			scopeLabel = "departamento"
		}
		h.Pool.Exec(r.Context(), `
			INSERT INTO transactions (from_account, to_account, amount, description, transaction_type)
			VALUES ($1, $2, $3, $4, $5)`,
			scopeID, toAccountID, int64(amount), reason, scopeLabel+"_distribution")

	case "admission":
		// Admitir miembro a la organizacion o departamento
		userIDStr, _ := params["user_id"].(string)
		if userIDStr == "" {
			return fmt.Errorf("user_id es obligatorio")
		}
		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			return fmt.Errorf("user_id invalido")
		}

		switch scope {
		case "organization":
			// Anadir a la junta directiva como miembro
			position, _ := params["cargo"].(string)
			if position == "" {
				position = "miembro"
			}
			h.Pool.Exec(r.Context(), `
				INSERT INTO organization_board_members (organization_id, user_id, position, is_active)
				VALUES ($1, $2, $3, true)
				ON CONFLICT (organization_id, user_id, position) DO NOTHING`,
				scopeID, userID, position)
		case "department":
			// Anadir al departamento como miembro
			// Buscar un rol por defecto
			var roleID uuid.UUID
			h.Pool.QueryRow(r.Context(), `SELECT id FROM department_roles WHERE department_id = $1 LIMIT 1`, scopeID).Scan(&roleID)
			if roleID != uuid.Nil {
				h.Pool.Exec(r.Context(), `
					INSERT INTO department_members (department_id, user_id, role_id)
					VALUES ($1, $2, $3)
					ON CONFLICT DO NOTHING`,
					scopeID, userID, roleID)
			}
		}

	case "expulsion":
		// Expulsar miembro de la organizacion
		userIDStr, _ := params["user_id"].(string)
		if userIDStr == "" {
			return fmt.Errorf("user_id es obligatorio")
		}
		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			return fmt.Errorf("user_id invalido")
		}

		if scope == "organization" {
			h.Pool.Exec(r.Context(), `UPDATE organization_board_members SET is_active = false WHERE organization_id = $1 AND user_id = $2`, scopeID, userID)
		}

	case "policy":
		// Politica interna - no requiere accion automatica, queda registrada en la minuta
		// La politica se documenta y se puede consultar en los informes

	case "create_account":
		// Crear cuenta contable para la org/depto
		accountName, _ := params["nombre_cuenta"].(string)
		if accountName == "" {
			accountName = "Nueva cuenta"
		}
		nodeDomain := r.Header.Get("X-Node-Domain")
		nodeDomain = db.ResolveNodeDomain(r.Context(), h.Pool, nodeDomain, h.nodeDomain)
		h.Pool.Exec(r.Context(), `
			INSERT INTO users (node_domain, username, display_name, account_type, membership_status, is_approved, credit_limit, debit_limit)
			VALUES ($1, $2, $3, 'assembly_account', 'active', true, 0, 0)`,
			nodeDomain, strings.ToLower(accountName), accountName)

	case "free_proposal":
		// Propuesta libre - no requiere accion automatica, queda registrada en la minuta
	}
	return nil
}

// ===== Handlers para Junta Directiva (meeting_type=board) =====
// Estos son wrappers que inyectan meeting_type=board en el query string
// y delegan a los handlers de asamblea existentes.

func (h *ScopedAssemblyHandler) withBoardMeetingType(r *http.Request) *http.Request {
	q := r.URL.Query()
	q.Set("meeting_type", "board")
	r.URL.RawQuery = q.Encode()
	return r
}

func (h *ScopedAssemblyHandler) listBoardSessions(w http.ResponseWriter, r *http.Request) {
	h.listSessions(w, h.withBoardMeetingType(r))
}
func (h *ScopedAssemblyHandler) createBoardSession(w http.ResponseWriter, r *http.Request) {
	h.createSession(w, h.withBoardMeetingType(r))
}
func (h *ScopedAssemblyHandler) updateBoardMinutes(w http.ResponseWriter, r *http.Request) {
	h.updateMinutes(w, h.withBoardMeetingType(r))
}
func (h *ScopedAssemblyHandler) listBoardAttendance(w http.ResponseWriter, r *http.Request) {
	h.listAttendance(w, h.withBoardMeetingType(r))
}
func (h *ScopedAssemblyHandler) registerBoardAttendance(w http.ResponseWriter, r *http.Request) {
	h.registerAttendance(w, h.withBoardMeetingType(r))
}
func (h *ScopedAssemblyHandler) listBoardProposals(w http.ResponseWriter, r *http.Request) {
	h.listProposals(w, h.withBoardMeetingType(r))
}
func (h *ScopedAssemblyHandler) createBoardProposal(w http.ResponseWriter, r *http.Request) {
	h.createProposal(w, h.withBoardMeetingType(r))
}
func (h *ScopedAssemblyHandler) openBoardVoting(w http.ResponseWriter, r *http.Request) {
	h.openVoting(w, h.withBoardMeetingType(r))
}
func (h *ScopedAssemblyHandler) voteBoardProposal(w http.ResponseWriter, r *http.Request) {
	h.voteProposal(w, h.withBoardMeetingType(r))
}
func (h *ScopedAssemblyHandler) executeBoardProposal(w http.ResponseWriter, r *http.Request) {
	h.executeProposal(w, h.withBoardMeetingType(r))
}
func (h *ScopedAssemblyHandler) listBoardReports(w http.ResponseWriter, r *http.Request) {
	h.listReports(w, h.withBoardMeetingType(r))
}
func (h *ScopedAssemblyHandler) getBoardConfig(w http.ResponseWriter, r *http.Request) {
	h.getConfig(w, h.withBoardMeetingType(r))
}
func (h *ScopedAssemblyHandler) updateBoardConfig(w http.ResponseWriter, r *http.Request) {
	h.updateConfig(w, h.withBoardMeetingType(r))
}
func (h *ScopedAssemblyHandler) closeBoardSession(w http.ResponseWriter, r *http.Request) {
	h.closeSession(w, h.withBoardMeetingType(r))
}
func (h *ScopedAssemblyHandler) getBoardProposalTypes(w http.ResponseWriter, r *http.Request) {
	h.getProposalTypes(w, h.withBoardMeetingType(r))
}
