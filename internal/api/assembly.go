package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AssemblyHandler maneja sesiones, propuestas, votos y junta directiva
type AssemblyHandler struct {
	Pool *pgxpool.Pool
	Auth *AuthMiddleware
}

// RegisterRoutes registra las rutas de asamblea
func (h *AssemblyHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Sesiones
	r.With(am.RequireAuth).Get("/api/assembly/sessions", h.listSessions)
	r.With(am.RequireAuth).Post("/api/assembly/sessions", h.createSession)

	// Propuestas / decisiones
	r.With(am.RequireAuth).Get("/api/assembly/proposals", h.listProposals)
	r.With(am.RequireAuth).Post("/api/assembly/proposals", h.createProposal)
	r.With(am.RequireAuth).Post("/api/assembly/proposals/{id}/vote", h.voteProposal)
	r.With(am.RequireAuth).Post("/api/assembly/proposals/{id}/execute", h.executeProposal)

	// Junta directiva
	r.With(am.RequireAuth).Get("/api/assembly/board", h.listBoard)
	r.With(am.RequirePermission("assembly.manage_board")).Post("/api/assembly/board", h.assignBoardMember)
	r.With(am.RequirePermission("assembly.manage_board")).Delete("/api/assembly/board/{id}", h.removeBoardMember)

	// Miembros con derecho a voto (viene de member_levels, no se registran aparte)
	r.With(am.RequireAuth).Get("/api/assembly/voting-members", h.listVotingMembers)
}

// ===== Sesiones =====

func (h *AssemblyHandler) listSessions(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, node_domain, session_type, title, description, start_time, end_time, status, created_at
		FROM assembly_sessions ORDER BY created_at DESC LIMIT 50`)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	var sessions []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var nodeDomain, sessionType, title, status string
		var description *string
		var startTime time.Time
		var endTime *time.Time
		var createdAt time.Time
		if err := rows.Scan(&id, &nodeDomain, &sessionType, &title, &description, &startTime, &endTime, &status, &createdAt); err != nil {
			continue
		}
		sessions = append(sessions, map[string]interface{}{
			"id":           id.String(),
			"session_type": sessionType,
			"title":        title,
			"description":  deref(description),
			"start_time":   startTime,
			"end_time":     derefTime(endTime),
			"status":       status,
			"created_at":   createdAt,
		})
	}
	if sessions == nil {
		sessions = []map[string]interface{}{}
	}
	writeJSON(w, 200, sessions)
}

type CreateAssemblySessionRequest struct {
	SessionType  string `json:"session_type"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	StartTimeStr string `json:"start_time"`
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

	startTime := time.Now()
	if req.StartTimeStr != "" {
		if t, err := time.Parse(time.RFC3339, req.StartTimeStr); err == nil {
			startTime = t
		}
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	id := uuid.New()
	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO assembly_sessions (id, node_domain, session_type, title, description, start_time, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')`,
		id, nodeDomain, req.SessionType, req.Title, req.Description, startTime)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":           id.String(),
		"session_type": req.SessionType,
		"title":        req.Title,
		"description":  req.Description,
		"start_time":   startTime,
		"status":       "scheduled",
	})
}

// ===== Propuestas / Decisiones =====

func (h *AssemblyHandler) listProposals(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Pool.Query(r.Context(), `
		SELECT d.id, d.assembly_id, d.decision_type, d.description, d.target_account,
		       d.old_value, d.new_value, d.required_signatures, d.status, d.executed_at, d.created_at,
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
		var votesFor, votesAgainst, votesAbstain int

		if err := rows.Scan(&id, &assemblyID, &decisionType, &description, &targetAccount,
			&oldValue, &newValue, &requiredSignatures, &status, &executedAt, &createdAt,
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

		proposals = append(proposals, map[string]interface{}{
			"id":                  id.String(),
			"proposal_type":       decisionType,
			"description":         description,
			"target":              derefUUID(targetAccount),
			"old_value":           oldVal,
			"new_value":           newVal,
			"required_signatures": requiredSignatures,
			"status":              status,
			"executed_at":         derefTime(executedAt),
			"created_at":          createdAt,
			"votes_for":           votesFor,
			"votes_against":       votesAgainst,
			"votes_abstain":       votesAbstain,
		})
	}
	if proposals == nil {
		proposals = []map[string]interface{}{}
	}
	writeJSON(w, 200, proposals)
}

type CreateProposalRequest struct {
	ProposalType       string                 `json:"proposal_type"`
	Title              string                 `json:"title"`
	Description        string                 `json:"description"`
	Parameters         map[string]interface{} `json:"parameters"`
	TargetAccountID    string                 `json:"target_account_id"`
	RequiredSignatures int                    `json:"required_signatures"`
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
	if req.RequiredSignatures == 0 {
		req.RequiredSignatures = 1
	}

	// Crear sesion si no existe una activa
	var sessionID uuid.UUID
	err := h.Pool.QueryRow(r.Context(), `
		SELECT id FROM assembly_sessions WHERE status IN ('scheduled', 'active') ORDER BY created_at DESC LIMIT 1`).Scan(&sessionID)
	if err != nil {
		// Crear sesion automaticamente
		sessionID = uuid.New()
		nodeDomain := r.Header.Get("X-Node-Domain")
		if nodeDomain == "" {
			nodeDomain = "localhost"
		}
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
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO assembly_decisions (id, assembly_id, decision_type, target_account, description, new_value, required_signatures, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
		id, sessionID, req.ProposalType, targetAccount, req.Description, newValue, req.RequiredSignatures)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Audit log
	userID, _ := h.Auth.GetUserID(r)
	auditDetails, _ := json.Marshal(map[string]interface{}{"proposal_type": req.ProposalType, "description": req.Description})
	h.Pool.Exec(r.Context(), `INSERT INTO audit_log (actor_id, action, target_id, details) VALUES ($1, 'assembly_decision', $2, $3)`,
		userID, id, auditDetails)

	writeJSON(w, 201, map[string]interface{}{
		"id":                  id.String(),
		"proposal_type":       req.ProposalType,
		"description":         req.Description,
		"required_signatures": req.RequiredSignatures,
		"status":              "pending",
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

	writeJSON(w, 200, map[string]interface{}{
		"votes_for":     votesFor,
		"votes_against": votesAgainst,
		"votes_abstain": votesAbstain,
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
	var newValue *[]byte
	var targetAccount *uuid.UUID
	err = h.Pool.QueryRow(r.Context(), `
		SELECT status, decision_type, new_value, target_account FROM assembly_decisions WHERE id = $1`,
		decisionID).Scan(&status, &decisionType, &newValue, &targetAccount)
	if err != nil {
		writeError(w, 404, "decision not found")
		return
	}
	if status != "approved" && status != "pending" {
		writeError(w, 400, "decision is not pending or approved")
		return
	}

	// Contar votos
	var votesFor, votesAgainst int
	h.Pool.QueryRow(r.Context(), `
		SELECT COUNT(*) FILTER (WHERE vote = 'for'), COUNT(*) FILTER (WHERE vote = 'against')
		FROM assembly_votes WHERE decision_id = $1`, decisionID).Scan(&votesFor, &votesAgainst)

	// Aprobar si hay mas votos a favor que en contra
	if votesFor > votesAgainst {
		_, err = h.Pool.Exec(r.Context(), `
			UPDATE assembly_decisions SET status = 'executed', executed_at = NOW() WHERE id = $1`,
			decisionID)
		if err != nil {
			writeError(w, 500, err.Error())
			return
		}

		// Ejecutar segun el tipo de decision
		var params map[string]interface{}
		if newValue != nil {
			json.Unmarshal(*newValue, &params)
		}
		_ = h.executeDecision(r, decisionType, targetAccount, params)

		// Audit log
		userID, _ := h.Auth.GetUserID(r)
		execDetails, _ := json.Marshal(map[string]interface{}{"decision_type": decisionType, "votes_for": votesFor, "votes_against": votesAgainst})
		h.Pool.Exec(r.Context(), `INSERT INTO audit_log (actor_id, action, target_id, details) VALUES ($1, 'assembly_execute', $2, $3)`,
			userID, decisionID, execDetails)

		writeJSON(w, 200, map[string]interface{}{"status": "executed", "votes_for": votesFor, "votes_against": votesAgainst})
	} else {
		_, _ = h.Pool.Exec(r.Context(), `UPDATE assembly_decisions SET status = 'rejected' WHERE id = $1`, decisionID)
		writeJSON(w, 200, map[string]interface{}{"status": "rejected", "votes_for": votesFor, "votes_against": votesAgainst})
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
			if nodeDomain == "" {
				nodeDomain = "localhost"
			}
			h.Pool.Exec(r.Context(), `
				INSERT INTO tax_config (node_domain, tax_rate, is_active)
				VALUES ($1, $2, true)
				ON CONFLICT (node_domain) DO UPDATE SET tax_rate = $2, updated_at = NOW()`,
				nodeDomain, rate/100)
		}
	}
	return nil
}

// ===== Junta Directiva =====

func (h *AssemblyHandler) listBoard(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

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
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

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
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

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
