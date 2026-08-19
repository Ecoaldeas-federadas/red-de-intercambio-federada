package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// MergeConflictHandler maneja los conflictos de fusion entre nodos
// cuando dos nodos se federan y tienen usuarios con mismo national_id
type MergeConflictHandler struct {
	Pool       *pgxpool.Pool
	Auth       *AuthMiddleware
	nodeDomain string
}

// MergeConflict representa un conflicto de fusion pendiente
type MergeConflict struct {
	ID                 uuid.UUID  `json:"id"`
	NodeADomain        string     `json:"node_a_domain"`
	NodeBDomain        string     `json:"node_b_domain"`
	NationalID         string     `json:"national_id"`
	PassportNumber     string     `json:"passport_number"`
	MatchType          string     `json:"match_type"`
	UserAID            *uuid.UUID `json:"user_a_id"`
	UserBID            *uuid.UUID `json:"user_b_id"`
	UserAName          string     `json:"user_a_name"`
	UserBName          string     `json:"user_b_name"`
	Status             string     `json:"status"`
	ProposedResolution string     `json:"proposed_resolution"`
	BalanceA           int64      `json:"balance_a"`
	BalanceB           int64      `json:"balance_b"`
	BalanceAction      string     `json:"balance_action"`
	VoteAStatus        string     `json:"vote_a_status"`
	VoteBStatus        string     `json:"vote_b_status"`
	ResolvedAt         *time.Time `json:"resolved_at"`
	ResolutionNotes    string     `json:"resolution_notes"`
	CreatedAt          time.Time  `json:"created_at"`
}

func (h *MergeConflictHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	r.With(am.RequireAuth).Get("/api/federation/merge-conflicts", h.listConflicts)
	r.With(am.RequireAuth).Get("/api/federation/merge-conflicts/{id}", h.getConflict)
	r.With(am.RequirePermission("federation.manage")).Post("/api/federation/merge-conflicts/{id}/propose", h.proposeResolution)
	r.With(am.RequirePermission("federation.manage")).Post("/api/federation/merge-conflicts/{id}/vote", h.voteOnConflict)
	r.With(am.RequirePermission("federation.manage")).Post("/api/federation/merge-conflicts/{id}/execute", h.executeResolution)
	r.With(am.RequirePermission("federation.manage")).Post("/api/federation/scan-conflicts", h.scanConflicts)
}

// scanConflicts busca usuarios duplicados por national_id entre este nodo y otro nodo federado
func (h *MergeConflictHandler) scanConflicts(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OtherNodeDomain string `json:"other_node_domain"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.OtherNodeDomain == "" {
		writeError(w, 400, "other_node_domain is required")
		return
	}

	// Buscar usuarios duplicados por documentos (mismo tipo + mismo numero) en ambos nodos
	// Compara cedula con cedula, pasaporte con pasaporte, etc.
	rows, err := h.Pool.Query(r.Context(), `
		SELECT
			d1.document_type_code,
			d1.document_number,
			d1.country_iso2,
			u1.id, u1.node_domain, COALESCE(u1.display_name, u1.username),
			u2.id, u2.node_domain, COALESCE(u2.display_name, u2.username),
			COALESCE(u1.credit_limit, 0) - COALESCE(u1.debit_limit, 0),
			COALESCE(u2.credit_limit, 0) - COALESCE(u2.debit_limit, 0)
		FROM user_documents d1
		INNER JOIN users u1 ON u1.id = d1.user_id
		INNER JOIN user_documents d2 ON d2.document_type_code = d1.document_type_code
		                            AND d2.document_number = d1.document_number
		INNER JOIN users u2 ON u2.id = d2.user_id
		WHERE u1.node_domain = $1 AND u2.node_domain = $2
		  AND u1.id < u2.id
		  AND d1.document_number <> ''
		  AND NOT EXISTS (
		    SELECT 1 FROM node_merge_conflicts c
		    WHERE ((c.node_a_domain = $1 AND c.node_b_domain = $2)
		           OR (c.node_a_domain = $2 AND c.node_b_domain = $1))
		      AND c.status NOT IN ('resolved', 'blocked', 'executed')
		      AND c.national_id = d1.document_number
		      AND c.match_type = d1.document_type_code
		  )`,
		h.nodeDomain, req.OtherNodeDomain)
	if err != nil {
		writeError(w, 500, "error scanning conflicts")
		return
	}
	defer rows.Close()

	var conflicts []MergeConflict
	for rows.Next() {
		var docType, docNumber, countryISO2 string
		var userAID, userBID uuid.UUID
		var nodeA, nodeB, nameA, nameB string
		var balA, balB int64
		if err := rows.Scan(&docType, &docNumber, &countryISO2, &userAID, &nodeA, &nameA, &userBID, &nodeB, &nameB, &balA, &balB); err != nil {
			continue
		}
		// Crear el conflicto en la BD
		var conflictID uuid.UUID
		err := h.Pool.QueryRow(r.Context(), `
			INSERT INTO node_merge_conflicts (node_a_domain, node_b_domain, national_id, passport_number, match_type, user_a_id, user_b_id, user_a_name, user_b_name, balance_a, balance_b, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
			ON CONFLICT DO NOTHING
			RETURNING id`,
			nodeA, nodeB, docNumber, countryISO2, docType, userAID, userBID, nameA, nameB, balA, balB).Scan(&conflictID)
		if err != nil {
			continue
		}
		conflicts = append(conflicts, MergeConflict{
			ID:             conflictID,
			NodeADomain:    nodeA,
			NodeBDomain:    nodeB,
			NationalID:     docNumber,
			PassportNumber: countryISO2,
			MatchType:      docType,
			UserAID:        &userAID,
			UserBID:        &userBID,
			UserAName:      nameA,
			UserBName:      nameB,
			BalanceA:       balA,
			BalanceB:       balB,
			Status:         "pending",
		})
	}

	if conflicts == nil {
		conflicts = []MergeConflict{}
	}
	writeJSON(w, 200, map[string]interface{}{
		"conflicts": conflicts,
		"count":     len(conflicts),
		"message":   fmt.Sprintf("Se encontraron %d conflictos pendientes", len(conflicts)),
	})
}

// listConflicts lista los conflictos de fusion pendientes
func (h *MergeConflictHandler) listConflicts(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	query := `SELECT id, node_a_domain, node_b_domain, national_id, passport_number, match_type,
	          user_a_id, user_b_id, user_a_name, user_b_name, status, proposed_resolution,
	          balance_a, balance_b, balance_action, vote_a_status, vote_b_status,
	          resolved_at, resolution_notes, created_at
	          FROM node_merge_conflicts WHERE $1 IN (node_a_domain, node_b_domain)`
	args := []interface{}{h.nodeDomain}
	if status != "" {
		query += ` AND status = $2`
		args = append(args, status)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := h.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeError(w, 500, "error listing conflicts")
		return
	}
	defer rows.Close()

	var conflicts []MergeConflict
	for rows.Next() {
		var c MergeConflict
		if err := rows.Scan(&c.ID, &c.NodeADomain, &c.NodeBDomain, &c.NationalID, &c.PassportNumber, &c.MatchType,
			&c.UserAID, &c.UserBID, &c.UserAName, &c.UserBName,
			&c.Status, &c.ProposedResolution, &c.BalanceA, &c.BalanceB,
			&c.BalanceAction, &c.VoteAStatus, &c.VoteBStatus,
			&c.ResolvedAt, &c.ResolutionNotes, &c.CreatedAt); err != nil {
			continue
		}
		conflicts = append(conflicts, c)
	}
	if conflicts == nil {
		conflicts = []MergeConflict{}
	}
	writeJSON(w, 200, conflicts)
}

// getConflict obtiene un conflicto especifico
func (h *MergeConflictHandler) getConflict(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid conflict id")
		return
	}
	var c MergeConflict
	err = h.Pool.QueryRow(r.Context(), `
		SELECT id, node_a_domain, node_b_domain, national_id, passport_number, match_type,
		       user_a_id, user_b_id, user_a_name, user_b_name, status, proposed_resolution,
		       balance_a, balance_b, balance_action, vote_a_status, vote_b_status,
		       resolved_at, resolution_notes, created_at
		FROM node_merge_conflicts WHERE id = $1 AND $2 IN (node_a_domain, node_b_domain)`,
		id, h.nodeDomain).Scan(&c.ID, &c.NodeADomain, &c.NodeBDomain, &c.NationalID, &c.PassportNumber, &c.MatchType,
		&c.UserAID, &c.UserBID, &c.UserAName, &c.UserBName,
		&c.Status, &c.ProposedResolution, &c.BalanceA, &c.BalanceB,
		&c.BalanceAction, &c.VoteAStatus, &c.VoteBStatus,
		&c.ResolvedAt, &c.ResolutionNotes, &c.CreatedAt)
	if err != nil {
		writeError(w, 404, "conflict not found")
		return
	}
	writeJSON(w, 200, c)
}

// proposeResolution propone como resolver un conflicto (que nodo se queda, que hacer con el saldo)
func (h *MergeConflictHandler) proposeResolution(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid conflict id")
		return
	}
	var req struct {
		ProposedResolution string `json:"proposed_resolution"` // 'a' o 'b' (no 'both')
		BalanceAction      string `json:"balance_action"`      // combine (suma algebraica), forgive_debt, remove_balance
		Notes              string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.ProposedResolution != "a" && req.ProposedResolution != "b" {
		writeError(w, 400, "proposed_resolution must be 'a' or 'b' (no membresia dual)")
		return
	}
	if req.BalanceAction != "combine" && req.BalanceAction != "forgive_debt" && req.BalanceAction != "remove_balance" {
		writeError(w, 400, "balance_action must be combine, forgive_debt, or remove_balance")
		return
	}

	// Determinar que voto actualizar (a o b) segun el nodo actual
	var voteColumn string
	var otherNode string
	var c MergeConflict
	err = h.Pool.QueryRow(r.Context(), `
		SELECT node_a_domain, node_b_domain, vote_a_status, vote_b_status
		FROM node_merge_conflicts WHERE id = $1`, id).Scan(&c.NodeADomain, &c.NodeBDomain, &c.VoteAStatus, &c.VoteBStatus)
	if err != nil {
		writeError(w, 404, "conflict not found")
		return
	}
	if h.nodeDomain == c.NodeADomain {
		voteColumn = "vote_a_status"
		otherNode = c.NodeBDomain
	} else if h.nodeDomain == c.NodeBDomain {
		voteColumn = "vote_b_status"
		otherNode = c.NodeADomain
	} else {
		writeError(w, 403, "this node is not part of this conflict")
		return
	}

	// Actualizar la propuesta y marcar el voto de este nodo como 'open' (pendiente de asamblea)
	_, err = h.Pool.Exec(r.Context(), fmt.Sprintf(`
		UPDATE node_merge_conflicts SET
			proposed_resolution = $2,
			balance_action = $3,
			resolution_notes = $4,
			status = 'voting',
			%s = 'open',
			updated_at = NOW()
		WHERE id = $1`, voteColumn),
		id, req.ProposedResolution, req.BalanceAction, req.Notes)
	if err != nil {
		writeError(w, 500, "error proposing resolution")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"status":      "proposed",
		"message":     fmt.Sprintf("Propuesta enviada. Pendiente votacion de la asamblea de %s", otherNode),
		"other_node":  otherNode,
		"vote_column": voteColumn,
	})
}

// voteOnConflict registra el voto de una asamblea (aprobar o rechazar la propuesta)
func (h *MergeConflictHandler) voteOnConflict(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid conflict id")
		return
	}
	var req struct {
		Vote string `json:"vote"` // approved, rejected
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Vote != "approved" && req.Vote != "rejected" {
		writeError(w, 400, "vote must be approved or rejected")
		return
	}

	var c MergeConflict
	err = h.Pool.QueryRow(r.Context(), `
		SELECT node_a_domain, node_b_domain, vote_a_status, vote_b_status, proposed_resolution
		FROM node_merge_conflicts WHERE id = $1`, id).Scan(&c.NodeADomain, &c.NodeBDomain, &c.VoteAStatus, &c.VoteBStatus, &c.ProposedResolution)
	if err != nil {
		writeError(w, 404, "conflict not found")
		return
	}

	var voteColumn string
	if h.nodeDomain == c.NodeADomain {
		voteColumn = "vote_a_status"
	} else if h.nodeDomain == c.NodeBDomain {
		voteColumn = "vote_b_status"
	} else {
		writeError(w, 403, "this node is not part of this conflict")
		return
	}

	// Registrar el voto
	_, err = h.Pool.Exec(r.Context(), fmt.Sprintf(`
		UPDATE node_merge_conflicts SET %s = $2, updated_at = NOW() WHERE id = $1`, voteColumn),
		id, req.Vote)
	if err != nil {
		writeError(w, 500, "error recording vote")
		return
	}

	// Verificar si ambas asambleas aprobaron
	var voteA, voteB string
	h.Pool.QueryRow(r.Context(), `SELECT vote_a_status, vote_b_status FROM node_merge_conflicts WHERE id = $1`, id).Scan(&voteA, &voteB)

	if voteA == "approved" && voteB == "approved" {
		// Ambas aprobaron - marcar como resuelto
		h.Pool.Exec(r.Context(), `UPDATE node_merge_conflicts SET status = 'resolved', resolved_at = NOW(), updated_at = NOW() WHERE id = $1`, id)
		writeJSON(w, 200, map[string]interface{}{
			"status":  "resolved",
			"message": "Ambas asambleas aprobaron. La resolucion puede ejecutarse.",
		})
		return
	}

	if voteA == "rejected" || voteB == "rejected" {
		// Alguna rechazo - marcar como bloqueado
		h.Pool.Exec(r.Context(), `UPDATE node_merge_conflicts SET status = 'blocked', updated_at = NOW() WHERE id = $1`, id)
		writeJSON(w, 200, map[string]interface{}{
			"status":  "blocked",
			"message": "Una asamblea rechazo la propuesta. La federacion queda bloqueada hasta resolver.",
		})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"status":  "voting",
		"message": "Voto registrado. Pendiente voto de la otra asamblea.",
	})
}

// executeResolution ejecuta la resolucion una vez ambas asambleas aprobaron
func (h *MergeConflictHandler) executeResolution(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid conflict id")
		return
	}

	var c MergeConflict
	err = h.Pool.QueryRow(r.Context(), `
		SELECT id, node_a_domain, node_b_domain, national_id, user_a_id, user_b_id,
		       status, proposed_resolution, balance_a, balance_b, balance_action,
		       vote_a_status, vote_b_status
		FROM node_merge_conflicts WHERE id = $1`, id).Scan(
		&c.ID, &c.NodeADomain, &c.NodeBDomain, &c.NationalID, &c.UserAID, &c.UserBID,
		&c.Status, &c.ProposedResolution, &c.BalanceA, &c.BalanceB, &c.BalanceAction,
		&c.VoteAStatus, &c.VoteBStatus)
	if err != nil {
		writeError(w, 404, "conflict not found")
		return
	}

	if c.Status != "resolved" {
		writeError(w, 400, "conflict is not resolved. Both assemblies must approve first.")
		return
	}
	if c.VoteAStatus != "approved" || c.VoteBStatus != "approved" {
		writeError(w, 400, "both assemblies must approve before executing")
		return
	}

	// Ejecutar segun la resolucion propuesta
	tx, err := h.Pool.Begin(r.Context())
	if err != nil {
		writeError(w, 500, "error starting transaction")
		return
	}
	defer tx.Rollback(r.Context())

	var keepUserID, removeUserID *uuid.UUID
	var keepNode, removeNode string
	var keepBalance, removeBalance int64

	if c.ProposedResolution == "a" {
		keepUserID = c.UserAID
		removeUserID = c.UserBID
		keepNode = c.NodeADomain
		removeNode = c.NodeBDomain
		keepBalance = c.BalanceA
		removeBalance = c.BalanceB
	} else {
		// 'b'
		keepUserID = c.UserBID
		removeUserID = c.UserAID
		keepNode = c.NodeBDomain
		removeNode = c.NodeADomain
		keepBalance = c.BalanceB
		removeBalance = c.BalanceA
	}

	if keepUserID == nil || removeUserID == nil {
		writeError(w, 400, "missing user IDs for resolution")
		return
	}

	// Combinar saldos: suma algebraica de ambos balances
	// Ej: +10 y -20 = -10 (el usuario queda con deuda neta)
	// Ej: +10 y +5 = +15 (el usuario queda con mas saldo)
	// Ej: -10 y -20 = -30 (mas deuda)
	combinedBalance := keepBalance + removeBalance

	if c.BalanceAction == "combine" {
		// Sumar algebraicamente: ajustar credit_limit y debit_limit
		if combinedBalance >= 0 {
			// Saldo positivo neto: aumentar credit_limit
			tx.Exec(r.Context(), `
				UPDATE users SET credit_limit = credit_limit + $2 WHERE id = $1`,
				keepUserID, combinedBalance)
		} else {
			// Deuda neta: aumentar debit_limit
			tx.Exec(r.Context(), `
				UPDATE users SET debit_limit = debit_limit + abs($2) WHERE id = $1`,
				keepUserID, combinedBalance)
		}
	}
	// 'forgive_debt': si el nodo removido tenia deuda, se condona (no se transfiere)
	//   Si tenia saldo positivo, se pierde (no se transfiere)
	// 'remove_balance': se descarta el saldo del nodo removido (positivo o negativo)

	// Marcar al usuario del nodo removido como 'migrated'
	tx.Exec(r.Context(), `
		UPDATE users SET membership_status = 'migrated', node_domain = $2 WHERE id = $1`,
		removeUserID, keepNode)

	// Marcar el conflicto como ejecutado
	tx.Exec(r.Context(), `UPDATE node_merge_conflicts SET status = 'executed', resolved_at = NOW() WHERE id = $1`, id)

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, 500, "error executing resolution")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"status":           "executed",
		"message":          fmt.Sprintf("Usuario migrado al nodo %s. Saldo combinado: %d TQ (%s). Nodo removido: %s", keepNode, combinedBalance, c.BalanceAction, removeNode),
		"keep_node":        keepNode,
		"remove_node":      removeNode,
		"combined_balance": combinedBalance,
		"balance_a":        c.BalanceA,
		"balance_b":        c.BalanceB,
		"balance_action":   c.BalanceAction,
	})
}

// HasPendingConflicts verifica si un nodo tiene conflictos pendientes con otro nodo
// Se usa para bloquear la federacion hasta que se resuelvan
func (h *MergeConflictHandler) HasPendingConflicts(ctx context.Context, otherNodeDomain string) (bool, int, error) {
	var count int
	err := h.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM node_merge_conflicts
		WHERE $1 IN (node_a_domain, node_b_domain)
		  AND $2 IN (node_a_domain, node_b_domain)
		  AND status NOT IN ('executed')`,
		h.nodeDomain, otherNodeDomain).Scan(&count)
	if err != nil {
		return false, 0, err
	}
	return count > 0, count, nil
}
