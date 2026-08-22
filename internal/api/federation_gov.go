package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
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
}

// listConstants devuelve todas las constantes federadas
func (fh *FederationGovHandler) listConstants(w http.ResponseWriter, r *http.Request) {
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
			"key":         key,
			"value":       json.RawMessage(value),
			"description": description,
			"updated_at":  updatedAt,
		})
	}
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

	// Obtener valor actual
	var currentValue []byte
	_ = fh.Pool.QueryRow(r.Context(), `SELECT value FROM federation_constants WHERE key = $1`, req.Key).Scan(&currentValue)

	// Obtener umbral de aprobacion
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
	var status string
	_ = fh.Pool.QueryRow(r.Context(), `SELECT status FROM federation_proposals WHERE id = $1`, proposalID).Scan(&status)
	if status != "pending" {
		writeError(w, 400, "la propuesta ya no esta pendiente (estado: "+status+")")
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
	var status string
	var approvals, rejections, totalNodes, threshold int
	_ = fh.Pool.QueryRow(ctx, `
		SELECT status, approvals, rejections, total_nodes, approval_threshold
		FROM federation_proposals WHERE id = $1`, proposalID,
	).Scan(&status, &approvals, &rejections, &totalNodes, &threshold)

	if status != "pending" {
		return false
	}

	// Calcular porcentaje de aprobacion
	if totalNodes == 0 {
		return false
	}
	approvalPct := (approvals * 100) / totalNodes

	// Verificar si hay suficientes rechazos para bloquear
	rejectionPct := (rejections * 100) / totalNodes
	if rejectionPct > (100 - threshold) {
		// Mas rechazos de los que se puede tolerar -> rechazada
		_, _ = fh.Pool.Exec(ctx, `UPDATE federation_proposals SET status = 'rejected' WHERE id = $1`, proposalID)
		return false
	}

	if approvalPct >= threshold {
		// Consenso alcanzado - aplicar el cambio
		return fh.applyProposal(ctx, proposalID)
	}

	return false
}

// applyProposal aplica el cambio aprobado a la constante federada
func (fh *FederationGovHandler) applyProposal(ctx context.Context, proposalID uuid.UUID) bool {
	var key string
	var proposedValue []byte
	err := fh.Pool.QueryRow(ctx, `
		SELECT key, proposed_value FROM federation_proposals WHERE id = $1`, proposalID,
	).Scan(&key, &proposedValue)
	if err != nil {
		return false
	}

	// Actualizar la constante
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
