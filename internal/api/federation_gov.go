package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// FederationGovHandler maneja la gobernanza federada: propuestas y votacion
// de cambios que afectan a TODA la federacion (como el valor de la canasta
// basica interna).
type FederationGovHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func NewFederationGovHandler(pool *pgxpool.Pool, nodeDomain string) *FederationGovHandler {
	return &FederationGovHandler{Pool: pool, NodeDomain: nodeDomain}
}

func (fh *FederationGovHandler) RegisterRoutesWithAuth(r chi.Router, am *AuthMiddleware) {
	// Constantes federadas (lectura para todos)
	r.Get("/api/federation-gov/constants", fh.listConstants)
	r.Get("/api/federation-gov/constants/{key}", fh.getConstant)

	// Propuestas
	r.Get("/api/federation-gov/proposals", fh.listProposals)
	r.Get("/api/federation-gov/proposals/{id}", fh.getProposal)

	if am != nil {
		r.With(am.RequirePermission("federation.change_config")).Post("/api/federation-gov/proposals", fh.createProposal)
		r.With(am.RequirePermission("federation.change_config")).Post("/api/federation-gov/proposals/{id}/vote", fh.voteProposal)
	} else {
		r.Post("/api/federation-gov/proposals", fh.createProposal)
		r.Post("/api/federation-gov/proposals/{id}/vote", fh.voteProposal)
	}

	// Endpoint para recibir votos de otros nodos (federacion)
	r.Post("/api/federation-gov/proposals/{id}/remote-vote", fh.remoteVote)
	// Endpoint para recibir propuestas de otros nodos
	r.Post("/api/federation-gov/proposals/remote", fh.remoteProposal)

	// Expulsion de nodos
	r.Get("/api/federation-gov/expelled", fh.listExpelledNodes)

	// Nodos conocidos en la red federada (no solo peers directos)
	r.Get("/api/federation-gov/known-nodes", fh.listKnownNodes)

	// Sincronizar constantes federadas (para nodos nuevos que heredan reglas)
	r.Get("/api/federation-gov/sync-constants", fh.syncConstants)
}

// listConstants devuelve todas las constantes federadas
func (fh *FederationGovHandler) listConstants(w http.ResponseWriter, r *http.Request) {
	lang, fallbackLang := resolveRequestLanguages(r, fh.Pool, fh.NodeDomain)
	rows, err := fh.Pool.Query(r.Context(), `
		SELECT key, value, description, updated_at
		FROM federation_constants ORDER BY key`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	constants := []map[string]interface{}{}
	for rows.Next() {
		var key, description string
		var value []byte
		var updatedAt time.Time
		if err := rows.Scan(&key, &value, &description, &updatedAt); err != nil {
			continue
		}
		constants = append(constants, map[string]interface{}{
			"id":          key,
			"key":         key,
			"value":       json.RawMessage(value),
			"description": description,
			"updated_at":  updatedAt,
		})
	}
	localizeEntityMaps(r.Context(), fh.Pool, constants, "federation_constant", lang, fallbackLang, "description")
	writeJSON(w, 200, map[string]interface{}{"constants": constants})
}

// getConstant devuelve una constante federada especifica
func (fh *FederationGovHandler) getConstant(w http.ResponseWriter, r *http.Request) {
	key := chi.URLParam(r, "key")
	var value []byte
	var description string
	var updatedAt time.Time
	err := fh.Pool.QueryRow(r.Context(), `
		SELECT value, description, updated_at FROM federation_constants WHERE key = $1`, key,
	).Scan(&value, &description, &updatedAt)
	if err != nil {
		writeError(w, 404, "constante no encontrada")
		return
	}
	lang, _ := resolveRequestLanguages(r, fh.Pool, fh.NodeDomain)
	description, _ = localizedContentValue(r.Context(), fh.Pool, "__GLOBAL__", "federation_constant", key, "description", description, lang)
	writeJSON(w, 200, map[string]interface{}{
		"key":         key,
		"value":       json.RawMessage(value),
		"description": description,
		"updated_at":  updatedAt,
	})
}

// getFederationConstant helper para leer una constante como int64
func (fh *FederationGovHandler) getConstantInt64(ctx context.Context, key string) (int64, error) {
	var value []byte
	err := fh.Pool.QueryRow(ctx, `SELECT value FROM federation_constants WHERE key = $1`, key).Scan(&value)
	if err != nil {
		return 0, err
	}
	var n int64
	if err := json.Unmarshal(value, &n); err != nil {
		// intentar como string numerico
		var s string
		if err2 := json.Unmarshal(value, &s); err2 == nil {
			fmt.Sscanf(s, "%d", &n)
			return n, nil
		}
		return 0, err
	}
	return n, nil
}

// listProposals lista todas las propuestas federadas
func (fh *FederationGovHandler) listProposals(w http.ResponseWriter, r *http.Request) {
	statusFilter := r.URL.Query().Get("status")
	query := `
		SELECT id, proposal_type, key, proposed_value, current_value, description,
		       proposed_by_node, status, approval_threshold, total_nodes,
		       approvals, rejections, created_at, expires_at, applied_at
		FROM federation_proposals`
	args := []interface{}{}
	if statusFilter != "" {
		query += ` WHERE status = $1`
		args = append(args, statusFilter)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := fh.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	proposals := []map[string]interface{}{}
	for rows.Next() {
		p := fh.scanProposal(rows)
		if p != nil {
			proposals = append(proposals, p)
		}
	}
	writeJSON(w, 200, map[string]interface{}{"proposals": proposals})
}

// getProposal devuelve una propuesta especifica con sus votos
func (fh *FederationGovHandler) getProposal(w http.ResponseWriter, r *http.Request) {
	proposalID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid proposal id")
		return
	}

	var p map[string]interface{}
	row := fh.Pool.QueryRow(r.Context(), `
		SELECT id, proposal_type, key, proposed_value, current_value, description,
		       proposed_by_node, status, approval_threshold, total_nodes,
		       approvals, rejections, created_at, expires_at, applied_at
		FROM federation_proposals WHERE id = $1`, proposalID)
	p = fh.scanProposalRow(row)
	if p == nil {
		writeError(w, 404, "propuesta no encontrada")
		return
	}

	// Obtener votos
	voteRows, _ := fh.Pool.Query(r.Context(), `
		SELECT voter_node, vote, voted_at, COALESCE(notes, '')
		FROM federation_votes WHERE proposal_id = $1 ORDER BY voted_at`, proposalID)
	if voteRows != nil {
		defer voteRows.Close()
		votes := []map[string]interface{}{}
		for voteRows.Next() {
			var voterNode, vote string
			var votedAt time.Time
			var notes string
			if err := voteRows.Scan(&voterNode, &vote, &votedAt, &notes); err != nil {
				continue
			}
			votes = append(votes, map[string]interface{}{
				"voter_node": voterNode,
				"vote":       vote,
				"voted_at":   votedAt,
				"notes":      notes,
			})
		}
		p["votes"] = votes
	}

	writeJSON(w, 200, p)
}

type FedCreateProposalRequest struct {
	ProposalType  string      `json:"proposal_type"`
	Key           string      `json:"key"`
	ProposedValue interface{} `json:"proposed_value"`
	Description   string      `json:"description"`
}

// createProposal crea una nueva propuesta federada
func (fh *FederationGovHandler) createProposal(w http.ResponseWriter, r *http.Request) {
	var req FedCreateProposalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Key == "" {
		writeError(w, 400, "key es requerido")
		return
	}
	if req.ProposalType == "" {
		req.ProposalType = "change_constant"
	}

	// Si es propuesta de upgrade de nivel, verificar min_days_at_level
	if req.ProposalType == "upgrade_node_level" {
		// req.Key contiene el dominio del nodo a promover
		var minDaysAtLevel, daysAtLevel int
		var lastLevelApprovedAt *time.Time
		_ = fh.Pool.QueryRow(r.Context(), `
			SELECT l.min_days_at_level, EXTRACT(DAY FROM NOW() - m.level_updated_at)::INT,
			      m.last_level_approved_at
			FROM federation_node_membership m
			JOIN federation_node_levels l ON m.level_id = l.id
			WHERE m.peer_domain = $1`, req.Key).Scan(&minDaysAtLevel, &daysAtLevel, &lastLevelApprovedAt)
		if minDaysAtLevel > 0 && daysAtLevel < minDaysAtLevel {
			writeError(w, 400, fmt.Sprintf("el nodo no cumple min_days_at_level: %d dias de %d requeridos", daysAtLevel, minDaysAtLevel))
			return
		}
		// Verificar min_days_after_last_level si esta configurado
		var minDaysAfterLast int
		_ = fh.Pool.QueryRow(r.Context(), `
			SELECT l.min_days_after_last_level
			FROM federation_node_membership m
			JOIN federation_node_levels l ON m.level_id = l.id
			WHERE m.peer_domain = $1`, req.Key).Scan(&minDaysAfterLast)
		if minDaysAfterLast > 0 && lastLevelApprovedAt != nil {
			daysSinceLast := int(time.Since(*lastLevelApprovedAt).Hours() / 24)
			if daysSinceLast < minDaysAfterLast {
				writeError(w, 400, fmt.Sprintf("el nodo no cumple min_days_after_last_level: %d dias de %d requeridos", daysSinceLast, minDaysAfterLast))
				return
			}
		}
	}

	// Obtener valor actual
	var currentValue []byte
	_ = fh.Pool.QueryRow(r.Context(), `SELECT value FROM federation_constants WHERE key = $1`, req.Key).Scan(&currentValue)

	// Obtener umbral de aprobacion (default 75% = mayoria, configurable a 100% o cualquier valor)
	threshold, _ := fh.getConstantInt64(r.Context(), "fc_approval_threshold")
	if threshold == 0 {
		threshold = 75
	}

	// Contar nodos federados
	totalNodes := 1 // este nodo
	_ = fh.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM node_federation_keys`).Scan(&totalNodes)
	totalNodes++ // incluir este nodo

	// Dias de expiracion
	expiryDays, _ := fh.getConstantInt64(r.Context(), "proposal_expiry_days")
	if expiryDays == 0 {
		expiryDays = 30
	}

	// Serializar proposed_value
	propValueJSON, err := json.Marshal(req.ProposedValue)
	if err != nil {
		writeError(w, 400, "invalid proposed_value")
		return
	}

	proposalID := uuid.New()
	_, err = fh.Pool.Exec(r.Context(), `
		INSERT INTO federation_proposals
		(id, proposal_type, key, proposed_value, current_value, description,
		 proposed_by_node, status, approval_threshold, total_nodes,
		 approvals, rejections, created_at, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, 0, 0, NOW(), NOW() + ($10 || ' days')::INTERVAL)`,
		proposalID, req.ProposalType, req.Key, propValueJSON, currentValue, req.Description,
		fh.NodeDomain, threshold, totalNodes, fmt.Sprintf("%d", expiryDays),
	)
	if err != nil {
		writeError(w, 500, "error al crear propuesta: "+err.Error())
		return
	}

	// Auto-voto del nodo que propone
	_, _ = fh.Pool.Exec(r.Context(), `
		INSERT INTO federation_votes (proposal_id, voter_node, vote, voted_at, notes)
		VALUES ($1, $2, 'approve', NOW(), 'Nodo proponente')`,
		proposalID, fh.NodeDomain)

	// Actualizar contador de aprobaciones
	_, _ = fh.Pool.Exec(r.Context(), `
		UPDATE federation_proposals SET approvals = approvals + 1 WHERE id = $1`, proposalID)

	// Verificar si ya se alcanzo el consenso (caso de 1 solo nodo)
	fh.checkConsensus(r.Context(), proposalID)

	writeJSON(w, 201, map[string]interface{}{
		"id":          proposalID,
		"status":      "pending",
		"message":     "Propuesta creada. Se compartira con los nodos federados para votacion.",
		"threshold":   threshold,
		"total_nodes": totalNodes,
	})
}

type FedVoteRequest struct {
	Vote  string `json:"vote"` // 'approve' o 'reject'
	Notes string `json:"notes"`
}

// voteProposal registra el voto de este nodo en una propuesta
func (fh *FederationGovHandler) voteProposal(w http.ResponseWriter, r *http.Request) {
	proposalID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid proposal id")
		return
	}

	var req FedVoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Vote != "approve" && req.Vote != "reject" {
		writeError(w, 400, "vote debe ser 'approve' o 'reject'")
		return
	}

	// Verificar que la propuesta esta pendiente
	var status, proposalType string
	_ = fh.Pool.QueryRow(r.Context(), `SELECT status, proposal_type FROM federation_proposals WHERE id = $1`, proposalID).Scan(&status, &proposalType)
	if status != "pending" {
		writeError(w, 400, "la propuesta ya no esta pendiente (estado: "+status+")")
		return
	}

	// Verificar que este nodo tiene derecho a voto (nivel 2+)
	var hasVote bool
	_ = fh.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(l.has_vote, false)
		FROM federation_node_membership m
		JOIN federation_node_levels l ON m.level_id = l.id
		WHERE m.peer_domain = $1`, fh.NodeDomain).Scan(&hasVote)
	if !hasVote {
		writeError(w, 403, "este nodo no tiene derecho a voto (requiere nivel 2+)")
		return
	}

	// Insertar o actualizar voto (ON CONFLICT para evitar duplicados)
	_, err = fh.Pool.Exec(r.Context(), `
		INSERT INTO federation_votes (proposal_id, voter_node, vote, voted_at, notes)
		VALUES ($1, $2, $3, NOW(), $4)
		ON CONFLICT (proposal_id, voter_node) DO UPDATE SET vote = $3, voted_at = NOW(), notes = $4`,
		proposalID, fh.NodeDomain, req.Vote, req.Notes)
	if err != nil {
		writeError(w, 500, "error al registrar voto")
		return
	}

	// Recalcular contadores
	fh.recountVotes(r.Context(), proposalID)

	// Verificar consenso
	applied := fh.checkConsensus(r.Context(), proposalID)

	writeJSON(w, 200, map[string]interface{}{
		"message": "Voto registrado",
		"applied": applied,
	})
}

// remoteVote recibe el voto de otro nodo federado
func (fh *FederationGovHandler) remoteVote(w http.ResponseWriter, r *http.Request) {
	proposalID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid proposal id")
		return
	}

	var req struct {
		VoterNode string `json:"voter_node"`
		Vote      string `json:"vote"`
		Notes     string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.VoterNode == "" || req.Vote == "" {
		writeError(w, 400, "voter_node y vote son requeridos")
		return
	}

	// Verificar que el nodo votante tiene derecho a voto (nivel 2+)
	var hasVote bool
	_ = fh.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(l.has_vote, false)
		FROM federation_node_membership m
		JOIN federation_node_levels l ON m.level_id = l.id
		WHERE m.peer_domain = $1`, req.VoterNode).Scan(&hasVote)
	if !hasVote {
		writeError(w, 403, "el nodo votante no tiene derecho a voto (requiere nivel 2+)")
		return
	}

	_, err = fh.Pool.Exec(r.Context(), `
		INSERT INTO federation_votes (proposal_id, voter_node, vote, voted_at, notes)
		VALUES ($1, $2, $3, NOW(), $4)
		ON CONFLICT (proposal_id, voter_node) DO UPDATE SET vote = $3, voted_at = NOW(), notes = $4`,
		proposalID, req.VoterNode, req.Vote, req.Notes)
	if err != nil {
		writeError(w, 500, "error al registrar voto remoto")
		return
	}

	fh.recountVotes(r.Context(), proposalID)
	applied := fh.checkConsensus(r.Context(), proposalID)

	writeJSON(w, 200, map[string]interface{}{"message": "Voto remoto registrado", "applied": applied})
}

// remoteProposal recibe una propuesta de otro nodo federado
func (fh *FederationGovHandler) remoteProposal(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProposalID        string      `json:"proposal_id"`
		ProposalType      string      `json:"proposal_type"`
		Key               string      `json:"key"`
		ProposedValue     interface{} `json:"proposed_value"`
		CurrentValue      interface{} `json:"current_value"`
		Description       string      `json:"description"`
		ProposedByNode    string      `json:"proposed_by_node"`
		ApprovalThreshold int         `json:"approval_threshold"`
		TotalNodes        int         `json:"total_nodes"`
		ExpiresAt         *time.Time  `json:"expires_at"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	proposalID, err := uuid.Parse(req.ProposalID)
	if err != nil {
		writeError(w, 400, "invalid proposal_id")
		return
	}

	propValueJSON, _ := json.Marshal(req.ProposedValue)
	currentValueJSON, _ := json.Marshal(req.CurrentValue)

	// Insertar si no existe (no sobrescribir si ya esta)
	_, err = fh.Pool.Exec(r.Context(), `
		INSERT INTO federation_proposals
		(id, proposal_type, key, proposed_value, current_value, description,
		 proposed_by_node, status, approval_threshold, total_nodes,
		 approvals, rejections, created_at, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, 0, 0, NOW(), $10)
		ON CONFLICT (id) DO NOTHING`,
		proposalID, req.ProposalType, req.Key, propValueJSON, currentValueJSON, req.Description,
		req.ProposedByNode, req.ApprovalThreshold, req.TotalNodes, req.ExpiresAt)
	if err != nil {
		writeError(w, 500, "error al recibir propuesta remota")
		return
	}

	writeJSON(w, 200, map[string]interface{}{"message": "Propuesta recibida"})
}

// recountVotes recalcula los contadores de una propuesta
func (fh *FederationGovHandler) recountVotes(ctx context.Context, proposalID uuid.UUID) {
	_, _ = fh.Pool.Exec(ctx, `
		UPDATE federation_proposals SET
			approvals = (SELECT COUNT(*) FROM federation_votes WHERE proposal_id = $1 AND vote = 'approve'),
			rejections = (SELECT COUNT(*) FROM federation_votes WHERE proposal_id = $1 AND vote = 'reject')
		WHERE id = $1`, proposalID)
}

// checkConsensus verifica si una propuesta alcanzo el consenso y la aplica
func (fh *FederationGovHandler) checkConsensus(ctx context.Context, proposalID uuid.UUID) bool {
	var status, proposalType, key string
	var approvals, rejections, totalNodes, threshold int
	_ = fh.Pool.QueryRow(ctx, `
		SELECT status, proposal_type, key, approvals, rejections, total_nodes, approval_threshold
		FROM federation_proposals WHERE id = $1`, proposalID,
	).Scan(&status, &proposalType, &key, &approvals, &rejections, &totalNodes, &threshold)

	if status != "pending" {
		return false
	}

	// Calcular porcentaje de aprobacion
	if totalNodes == 0 {
		return false
	}
	approvalPct := (approvals * 100) / totalNodes

	// Para upgrade_node_level: verificar si el nivel destino es de excepcion
	// Si es excepcion, usar exception_vote_threshold (ej: 75%) en lugar del umbral normal
	effectiveThreshold := threshold
	if proposalType == "upgrade_node_level" {
		// key contiene el dominio del nodo a promover
		// Obtener el nivel actual y el nivel destino (upgrade_to)
		var currentLevelID string
		_ = fh.Pool.QueryRow(ctx, `
			SELECT level_id FROM federation_node_membership WHERE peer_domain = $1`, key).Scan(&currentLevelID)
		if currentLevelID != "" {
			var isException bool
			var exceptionThreshold float64
			_ = fh.Pool.QueryRow(ctx, `
				SELECT is_exception, exception_vote_threshold
				FROM federation_node_levels WHERE id = $1`, currentLevelID).Scan(&isException, &exceptionThreshold)
			if isException && exceptionThreshold > 0 {
				effectiveThreshold = int(exceptionThreshold * 100)
			}
		}
	}

	// Verificar si hay suficientes rechazos para bloquear
	rejectionPct := (rejections * 100) / totalNodes
	if rejectionPct > (100 - effectiveThreshold) {
		// Mas rechazos de los que se puede tolerar -> rechazada
		_, _ = fh.Pool.Exec(ctx, `UPDATE federation_proposals SET status = 'rejected' WHERE id = $1`, proposalID)
		return false
	}

	if approvalPct >= effectiveThreshold {
		// Consenso alcanzado - aplicar el cambio
		return fh.applyProposal(ctx, proposalID)
	}

	return false
}

// applyProposal aplica el cambio aprobado a la constante federada
func (fh *FederationGovHandler) applyProposal(ctx context.Context, proposalID uuid.UUID) bool {
	var key, proposalType, description string
	var proposedValue []byte
	err := fh.Pool.QueryRow(ctx, `
		SELECT key, proposed_value, proposal_type, description
		FROM federation_proposals WHERE id = $1`, proposalID,
	).Scan(&key, &proposedValue, &proposalType, &description)
	if err != nil {
		return false
	}

	// Si es una propuesta de expulsion, marcar al nodo como expulsado
	if proposalType == "expel_node" {
		// key contiene el dominio del nodo a expulsar
		_, err = fh.Pool.Exec(ctx, `
			INSERT INTO federation_expelled_nodes (node_domain, expelled_by_proposal, reason, expelled_at)
			VALUES ($1, $2, $3, NOW())
			ON CONFLICT (node_domain) DO UPDATE SET
				expelled_by_proposal = $2, reason = $3, expelled_at = NOW()`,
			key, proposalID, description)
		if err != nil {
			return false
		}

		// Marcar al nodo como expulsado en known_nodes
		_, _ = fh.Pool.Exec(ctx, `
			UPDATE federation_known_nodes SET is_expelled = true WHERE node_domain = $1`, key)

		// Marcar la propuesta como aprobada
		_, _ = fh.Pool.Exec(ctx, `
			UPDATE federation_proposals SET status = 'approved', applied_at = NOW() WHERE id = $1`, proposalID)
		return true
	}

	// Si es upgrade de nivel de nodo, promover el nodo
	if proposalType == "upgrade_node_level" {
		// key contiene el dominio del nodo a promover
		// proposed_value contiene el nivel destino (ej: "accepted")
		var newLevelID string
		if err := json.Unmarshal(proposedValue, &newLevelID); err != nil {
			// intentar como string directo
			newLevelID = string(proposedValue)
			newLevelID = strings.Trim(newLevelID, `"`)
		}

		// Actualizar el nivel del nodo en federation_node_membership
		_, err = fh.Pool.Exec(ctx, `
			UPDATE federation_node_membership
			SET level_id = $1, level_updated_at = NOW(), last_level_approved_at = NOW(), upgraded_by_proposal = $2
			WHERE peer_domain = $3`,
			newLevelID, proposalID, key)
		if err != nil {
			return false
		}

		// Si el nodo sube a nivel 2 (accepted), liberar el patrocinio del padrino
		if newLevelID == "accepted" {
			_, _ = fh.Pool.Exec(ctx, `
				UPDATE federation_sponsorships SET status = 'released', released_at = NOW()
				WHERE sponsored_domain = $1 AND status = 'active'`, key)
		}

		_, _ = fh.Pool.Exec(ctx, `
			UPDATE federation_proposals SET status = 'approved', applied_at = NOW() WHERE id = $1`, proposalID)
		return true
	}

	// Si es creacion de nivel de nodo
	if proposalType == "create_node_level" {
		// proposed_value contiene el JSON del nivel a crear
		// key contiene el id del nivel
		_, err = fh.Pool.Exec(ctx, `
			INSERT INTO federation_node_levels (id, name, description, level,
				global_credit_limit, global_debit_limit, has_voice, has_vote, can_sponsor,
				min_days_at_level, min_days_after_last_level, auto_upgrade, upgrade_to,
				require_reciprocity, reciprocity_min_balance, reciprocity_max_balance,
				require_avg_limit, avg_limit_ratio, is_system, is_active, is_exception,
				exception_vote_threshold)
			SELECT $1, data->>'name', data->>'description', (data->>'level')::INT,
				(data->>'global_credit_limit')::BIGINT, (data->>'global_debit_limit')::BIGINT,
				(data->>'has_voice')::BOOLEAN, (data->>'has_vote')::BOOLEAN, (data->>'can_sponsor')::BOOLEAN,
				(data->>'min_days_at_level')::INT, COALESCE((data->>'min_days_after_last_level')::INT, 0),
				COALESCE((data->>'auto_upgrade')::BOOLEAN, false), data->>'upgrade_to',
				COALESCE((data->>'require_reciprocity')::BOOLEAN, true),
				COALESCE((data->>'reciprocity_min_balance')::INT, 0),
				COALESCE((data->>'reciprocity_max_balance')::INT, 0),
				COALESCE((data->>'require_avg_limit')::BOOLEAN, false),
				COALESCE((data->>'avg_limit_ratio')::FLOAT, 0.5),
				false, true, COALESCE((data->>'is_exception')::BOOLEAN, false),
				COALESCE((data->>'exception_vote_threshold')::FLOAT, 0.75)
			FROM (SELECT $2::jsonb AS data)`,
			key, proposedValue)
		if err != nil {
			return false
		}

		_, _ = fh.Pool.Exec(ctx, `
			UPDATE federation_proposals SET status = 'approved', applied_at = NOW() WHERE id = $1`, proposalID)
		return true
	}

	// Si es edicion de nivel de nodo
	if proposalType == "edit_node_level" {
		// key contiene el id del nivel a editar
		// proposed_value contiene los campos a actualizar en JSON
		_, err = fh.Pool.Exec(ctx, `
			UPDATE federation_node_levels SET
				name = COALESCE((data->>'name'), name),
				description = COALESCE((data->>'description'), description),
				global_credit_limit = COALESCE(NULLIF(data->>'global_credit_limit', '')::BIGINT, global_credit_limit),
				global_debit_limit = COALESCE(NULLIF(data->>'global_debit_limit', '')::BIGINT, global_debit_limit),
				min_days_at_level = COALESCE(NULLIF(data->>'min_days_at_level', '')::INT, min_days_at_level),
				avg_limit_ratio = COALESCE(NULLIF(data->>'avg_limit_ratio', '')::FLOAT, avg_limit_ratio),
				exception_vote_threshold = COALESCE(NULLIF(data->>'exception_vote_threshold', '')::FLOAT, exception_vote_threshold)
			FROM (SELECT $2::jsonb AS data)
			WHERE id = $1`,
			key, proposedValue)
		if err != nil {
			return false
		}

		_, _ = fh.Pool.Exec(ctx, `
			UPDATE federation_proposals SET status = 'approved', applied_at = NOW() WHERE id = $1`, proposalID)
		return true
	}

	// Para constantes normales: actualizar la constante
	_, err = fh.Pool.Exec(ctx, `
		UPDATE federation_constants SET value = $1, approved_proposal_id = $2, updated_at = NOW()
		WHERE key = $3`,
		proposedValue, proposalID, key)
	if err != nil {
		return false
	}

	// Marcar la propuesta como aprobada y aplicada
	_, _ = fh.Pool.Exec(ctx, `
		UPDATE federation_proposals SET status = 'approved', applied_at = NOW() WHERE id = $1`, proposalID)

	return true
}

// scanProposal escanea una fila de propuesta
func (fh *FederationGovHandler) scanProposal(rows pgx.Rows) map[string]interface{} {
	var id uuid.UUID
	var proposalType, key, description, proposedByNode, status string
	var proposedValue, currentValue []byte
	var approvalThreshold, totalNodes, approvals, rejections int
	var createdAt time.Time
	var expiresAt, appliedAt *time.Time

	if err := rows.Scan(&id, &proposalType, &key, &proposedValue, &currentValue, &description,
		&proposedByNode, &status, &approvalThreshold, &totalNodes,
		&approvals, &rejections, &createdAt, &expiresAt, &appliedAt); err != nil {
		return nil
	}

	p := map[string]interface{}{
		"id":                 id,
		"proposal_type":      proposalType,
		"key":                key,
		"proposed_value":     json.RawMessage(proposedValue),
		"current_value":      json.RawMessage(currentValue),
		"description":        description,
		"proposed_by_node":   proposedByNode,
		"status":             status,
		"approval_threshold": approvalThreshold,
		"total_nodes":        totalNodes,
		"approvals":          approvals,
		"rejections":         rejections,
		"created_at":         createdAt,
	}
	if expiresAt != nil {
		p["expires_at"] = *expiresAt
	}
	if appliedAt != nil {
		p["applied_at"] = *appliedAt
	}

	// Calcular porcentaje
	if totalNodes > 0 {
		p["approval_pct"] = (approvals * 100) / totalNodes
	} else {
		p["approval_pct"] = 0
	}

	return p
}

// scanProposalRow escanea una sola fila
func (fh *FederationGovHandler) scanProposalRow(row pgx.Row) map[string]interface{} {
	var id uuid.UUID
	var proposalType, key, description, proposedByNode, status string
	var proposedValue, currentValue []byte
	var approvalThreshold, totalNodes, approvals, rejections int
	var createdAt time.Time
	var expiresAt, appliedAt *time.Time

	if err := row.Scan(&id, &proposalType, &key, &proposedValue, &currentValue, &description,
		&proposedByNode, &status, &approvalThreshold, &totalNodes,
		&approvals, &rejections, &createdAt, &expiresAt, &appliedAt); err != nil {
		return nil
	}

	p := map[string]interface{}{
		"id":                 id,
		"proposal_type":      proposalType,
		"key":                key,
		"proposed_value":     json.RawMessage(proposedValue),
		"current_value":      json.RawMessage(currentValue),
		"description":        description,
		"proposed_by_node":   proposedByNode,
		"status":             status,
		"approval_threshold": approvalThreshold,
		"total_nodes":        totalNodes,
		"approvals":          approvals,
		"rejections":         rejections,
		"created_at":         createdAt,
	}
	if expiresAt != nil {
		p["expires_at"] = *expiresAt
	}
	if appliedAt != nil {
		p["applied_at"] = *appliedAt
	}
	if totalNodes > 0 {
		p["approval_pct"] = (approvals * 100) / totalNodes
	} else {
		p["approval_pct"] = 0
	}

	return p
}

// listExpelledNodes lista los nodos expulsados de la federacion
func (fh *FederationGovHandler) listExpelledNodes(w http.ResponseWriter, r *http.Request) {
	rows, err := fh.Pool.Query(r.Context(), `
		SELECT node_domain, COALESCE(reason, ''), expelled_at,
		       COALESCE(reentry_allowed_at::TEXT, '')
		FROM federation_expelled_nodes ORDER BY expelled_at DESC`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	nodes := []map[string]interface{}{}
	for rows.Next() {
		var domain, reason, expelledAt string
		var reentryAllowed string
		if err := rows.Scan(&domain, &reason, &expelledAt, &reentryAllowed); err != nil {
			continue
		}
		node := map[string]interface{}{
			"node_domain": domain,
			"reason":      reason,
			"expelled_at": expelledAt,
		}
		if reentryAllowed != "" {
			node["reentry_allowed_at"] = reentryAllowed
		}
		nodes = append(nodes, node)
	}
	writeJSON(w, 200, map[string]interface{}{"expelled_nodes": nodes})
}

// listKnownNodes lista todos los nodos conocidos en la red federada
// (no solo peers directos, sino todos los descubiertos via propagacion)
func (fh *FederationGovHandler) listKnownNodes(w http.ResponseWriter, r *http.Request) {
	// Este nodo siempre es conocido
	_, _ = fh.Pool.Exec(r.Context(), `
		INSERT INTO federation_known_nodes (node_domain, is_direct_peer, is_expelled, discovered_at)
		VALUES ($1, true, false, NOW())
		ON CONFLICT (node_domain) DO UPDATE SET last_seen = NOW()`,
		fh.NodeDomain)

	// Peers directos tambien son conocidos
	_, _ = fh.Pool.Exec(r.Context(), `
		INSERT INTO federation_known_nodes (node_domain, is_direct_peer, is_expelled, discovered_at)
		SELECT peer_domain, true, false, NOW()
		FROM node_federation_keys
		WHERE status != 'removed'
		ON CONFLICT (node_domain) DO UPDATE SET is_direct_peer = true, last_seen = NOW()`)

	rows, err := fh.Pool.Query(r.Context(), `
		SELECT n.node_domain, COALESCE(n.node_name, ''), n.is_direct_peer, n.is_expelled,
		       COALESCE(n.node_number, 0), COALESCE(n.discovered_via, ''),
		       COALESCE(n.last_seen::TEXT, ''), n.discovered_at,
		       CASE WHEN e.node_domain IS NOT NULL THEN true ELSE false END as is_expelled_now
		FROM federation_known_nodes n
		LEFT JOIN federation_expelled_nodes e ON e.node_domain = n.node_domain
		ORDER BY n.is_direct_peer DESC, n.node_domain`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	nodes := []map[string]interface{}{}
	for rows.Next() {
		var domain, name, discoveredVia, lastSeen, discoveredAt string
		var isDirectPeer, isExpelled, isExpelledNow bool
		var nodeNumber int
		if err := rows.Scan(&domain, &name, &isDirectPeer, &isExpelled, &nodeNumber,
			&discoveredVia, &lastSeen, &discoveredAt, &isExpelledNow); err != nil {
			continue
		}
		node := map[string]interface{}{
			"node_domain":    domain,
			"node_name":      name,
			"is_direct_peer": isDirectPeer,
			"is_expelled":    isExpelledNow,
			"is_this_node":   domain == fh.NodeDomain,
			"node_number":    nodeNumber,
			"discovered_via": discoveredVia,
			"discovered_at":  discoveredAt,
		}
		if lastSeen != "" {
			node["last_seen"] = lastSeen
		}
		nodes = append(nodes, node)
	}
	writeJSON(w, 200, map[string]interface{}{"known_nodes": nodes})
}

// syncConstants devuelve todas las constantes federadas para que un nodo
// nuevo las herede al unirse a la federacion.
// Los nodos nuevos NO votan sobre reglas existentes: las heredan automaticamente.
func (fh *FederationGovHandler) syncConstants(w http.ResponseWriter, r *http.Request) {
	rows, err := fh.Pool.Query(r.Context(), `
		SELECT key, value, description, updated_at
		FROM federation_constants ORDER BY key`)
	if err != nil {
		writeError(w, 500, "error al sincronizar constantes")
		return
	}
	defer rows.Close()

	constants := []map[string]interface{}{}
	for rows.Next() {
		var key, description string
		var value []byte
		var updatedAt time.Time
		if err := rows.Scan(&key, &value, &description, &updatedAt); err != nil {
			continue
		}
		constants = append(constants, map[string]interface{}{
			"id":          key,
			"key":         key,
			"value":       json.RawMessage(value),
			"description": description,
			"updated_at":  updatedAt,
		})
	}

	// Tambien devolver nodos expulsados para que el nodo nuevo los conozca
	expelledRows, _ := fh.Pool.Query(r.Context(), `
		SELECT node_domain, COALESCE(reason, '') FROM federation_expelled_nodes`)
	expelled := []map[string]interface{}{}
	if expelledRows != nil {
		defer expelledRows.Close()
		for expelledRows.Next() {
			var domain, reason string
			if err := expelledRows.Scan(&domain, &reason); err != nil {
				continue
			}
			expelled = append(expelled, map[string]interface{}{
				"node_domain": domain,
				"reason":      reason,
			})
		}
	}

	writeJSON(w, 200, map[string]interface{}{
		"constants":      constants,
		"expelled_nodes": expelled,
		"message":        "Constantes federadas para heredar al unirse a la federacion",
		"note":           "Los nodos nuevos heredan automaticamente todas las reglas existentes. No votan sobre reglas previas.",
	})
}
