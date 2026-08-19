package api

import (
	"encoding/json"
	"fmt"
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
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

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
		INSERT INTO assembly_decisions (id, assembly_id, decision_type, target_account, description, new_value, required_signatures, status, voting_deadline, voting_duration_minutes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW() + ($8 || ' minutes')::INTERVAL, $8)`,
		id, sessionID, req.ProposalType, targetAccount, req.Description, newValue, req.RequiredSignatures, req.VotingDurationMinutes)
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
		"id":                      id.String(),
		"proposal_type":           req.ProposalType,
		"description":             req.Description,
		"required_signatures":     req.RequiredSignatures,
		"status":                  "pending",
		"voting_duration_minutes": req.VotingDurationMinutes,
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
	h.Pool.QueryRow(r.Context(), `SELECT status, voting_deadline FROM assembly_decisions WHERE id = $1`, decisionID).Scan(&status, &votingDeadline)
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
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}
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
	var newValue *[]byte
	var targetAccount *uuid.UUID
	var collectedSignatures []byte
	var votingDeadline *time.Time
	err = h.Pool.QueryRow(r.Context(), `
		SELECT status, decision_type, new_value, target_account, collected_signatures, voting_deadline FROM assembly_decisions WHERE id = $1`,
		decisionID).Scan(&status, &decisionType, &newValue, &targetAccount, &collectedSignatures, &votingDeadline)
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
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

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
		case "multisig":
			// Contar firmas en collected_signatures
			var signatures []interface{}
			if len(collectedSignatures) > 0 {
				json.Unmarshal(collectedSignatures, &signatures)
			}
			sigCount := len(signatures)
			approved = sigCount >= requiredSignatures
		default:
			// board, council u otros: criterio por defecto
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
		totalVotes := votesFor + votesAgainst + votesAbstain
		notVoted := totalVotingMembers - totalVotes
		if notVoted < 0 {
			notVoted = 0
		}
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
			if nodeDomain == "" {
				nodeDomain = "localhost"
			}
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
		if nodeDomain == "" {
			nodeDomain = "localhost"
		}

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
		if nodeDomain == "" {
			nodeDomain = "localhost"
		}

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
		if nodeDomain == "" {
			nodeDomain = "localhost"
		}

		switch action {
		case "create":
			category, _ := params["category"].(string)
			title, _ := params["title"].(string)
			description, _ := params["description"].(string)
			severity, _ := params["severity"].(string)
			icon, _ := params["icon"].(string)
			sortOrder, _ := params["sort_order"].(float64)

			h.Pool.Exec(r.Context(), `
				INSERT INTO governance_rules (node_domain, category, title, description, severity, icon, sort_order)
				VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				nodeDomain, category, title, description, severity, icon, int(sortOrder))

		case "update":
			ruleID, _ := params["rule_id"].(string)
			category, _ := params["category"].(string)
			title, _ := params["title"].(string)
			description, _ := params["description"].(string)
			severity, _ := params["severity"].(string)
			icon, _ := params["icon"].(string)
			sortOrder, _ := params["sort_order"].(float64)
			isActive, _ := params["is_active"].(bool)

			h.Pool.Exec(r.Context(), `
				UPDATE governance_rules SET
					category = $1, title = $2, description = $3, severity = $4,
					icon = $5, sort_order = $6, is_active = $7, updated_at = NOW()
				WHERE id = $8`,
				category, title, description, severity, icon, int(sortOrder), isActive, ruleID)

		case "delete":
			ruleID, _ := params["rule_id"].(string)
			h.Pool.Exec(r.Context(), `DELETE FROM governance_rules WHERE id = $1`, ruleID)
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

// ===== Configuracion de umbrales =====

func (h *AssemblyHandler) listAssemblyConfig(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, node_domain, proposal_type, approval_method, required_percentage,
		       required_quorum, required_signatures, council_id, description, is_active, created_at, updated_at
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
		var councilID *uuid.UUID
		var description *string
		var isActive bool
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &ndomain, &proposalType, &approvalMethod, &requiredPercentage,
			&requiredQuorum, &requiredSignatures, &councilID, &description, &isActive, &createdAt, &updatedAt); err != nil {
			continue
		}
		configs = append(configs, map[string]interface{}{
			"id":                  id.String(),
			"node_domain":         ndomain,
			"proposal_type":       proposalType,
			"approval_method":     approvalMethod,
			"required_percentage": requiredPercentage,
			"required_quorum":     requiredQuorum,
			"required_signatures": requiredSignatures,
			"council_id":          derefUUID(councilID),
			"description":         deref(description),
			"is_active":           isActive,
			"created_at":          createdAt,
			"updated_at":          updatedAt,
		})
	}
	if configs == nil {
		configs = []map[string]interface{}{}
	}
	writeJSON(w, 200, configs)
}

type UpdateAssemblyConfigRequest struct {
	ApprovalMethod     string  `json:"approval_method"`
	RequiredPercentage float64 `json:"required_percentage"`
	RequiredQuorum     int     `json:"required_quorum"`
	RequiredSignatures int     `json:"required_signatures"`
	CouncilID          string  `json:"council_id"`
	Description        string  `json:"description"`
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
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	var councilID *uuid.UUID
	if req.CouncilID != "" {
		if id, err := uuid.Parse(req.CouncilID); err == nil {
			councilID = &id
		}
	}

	var description *string
	if req.Description != "" {
		description = &req.Description
	}

	var id uuid.UUID
	err := h.Pool.QueryRow(r.Context(), `
		INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage,
			required_quorum, required_signatures, council_id, description, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
		ON CONFLICT (node_domain, proposal_type) DO UPDATE SET
			approval_method = $3, required_percentage = $4, required_quorum = $5,
			required_signatures = $6, council_id = $7, description = $8, updated_at = NOW()
		RETURNING id`,
		nodeDomain, proposalType, req.ApprovalMethod, req.RequiredPercentage,
		req.RequiredQuorum, req.RequiredSignatures, councilID, description).Scan(&id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"id":                  id.String(),
		"node_domain":         nodeDomain,
		"proposal_type":       proposalType,
		"approval_method":     req.ApprovalMethod,
		"required_percentage": req.RequiredPercentage,
		"required_quorum":     req.RequiredQuorum,
		"required_signatures": req.RequiredSignatures,
		"council_id":          derefUUID(councilID),
		"description":         req.Description,
		"is_active":           true,
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
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

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
	if status == "executed" {
		result = "aprobada"
	} else if status == "rejected" {
		result = "rechazada"
	} else if status == "expired" {
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
			if voteStr == "for" {
				label = "a favor"
			} else if voteStr == "against" {
				label = "en contra"
			} else if voteStr == "abstain" {
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
func (h *AssemblyHandler) listVotingReports(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	// Total de miembros con derecho a voto
	var totalVotingMembers int
	h.Pool.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM users u
		JOIN member_levels ml ON ml.id = u.member_level_id
		WHERE u.node_domain = $1 AND u.membership_status = 'active'
		AND ml.has_vote = true AND ml.counts_in_quorum = true`, nodeDomain).Scan(&totalVotingMembers)

	rows, err := h.Pool.Query(r.Context(), `
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
		ORDER BY d.created_at DESC LIMIT 200`)
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
		if status == "executed" {
			result = "aprobada"
		} else if status == "rejected" {
			result = "rechazada"
		} else if status == "expired" {
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
