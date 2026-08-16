package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"federated-credit-node/internal/federation"
)

type FederationHandler struct {
	Pool       *pgxpool.Pool
	Protocol   *federation.Protocol
	Gossip     *federation.Gossip
	NodeDomain string
}

func NewFederationHandler(pool *pgxpool.Pool, nodeDomain string) *FederationHandler {
	proto := federation.New(pool, nodeDomain)
	gossip := federation.NewGossip(pool, nodeDomain, 0)
	return &FederationHandler{
		Pool:       pool,
		Protocol:   proto,
		Gossip:     gossip,
		NodeDomain: nodeDomain,
	}
}

func (fh *FederationHandler) RegisterRoutes(r chi.Router) {
	fh.RegisterRoutesWithAuth(r, nil)
}

func (fh *FederationHandler) RegisterRoutesWithAuth(r chi.Router, am *AuthMiddleware) {
	r.Get("/api/federation/config", fh.getFederationConfig)
	if am != nil {
		r.With(am.RequirePermission("federation.change_config")).Put("/api/federation/config", fh.updateFederationConfig)
	} else {
		r.Put("/api/federation/config", fh.updateFederationConfig)
	}

	r.Get("/api/federation/bilateral", fh.listBilateralLimits)
	r.Get("/api/federation/bilateral/{remoteNode}", fh.getBilateralLimit)
	if am != nil {
		r.With(am.RequirePermission("federation.set_limits")).Post("/api/federation/bilateral/propose", fh.proposeBilateral)
		r.With(am.RequirePermission("federation.set_limits")).Post("/api/federation/bilateral/{remoteNode}/confirm", fh.confirmBilateral)
	} else {
		r.Post("/api/federation/bilateral/propose", fh.proposeBilateral)
		r.Post("/api/federation/bilateral/{remoteNode}/confirm", fh.confirmBilateral)
	}
	r.Get("/api/federation/bilateral/{remoteNode}/history", fh.bilateralHistory)

	r.Get("/api/federation/parity/{remoteNode}", fh.getParityReport)
	r.Get("/api/federation/parity", fh.listParityReports)

	r.Get("/api/federation/warnings", fh.getActiveWarnings)

	r.Get("/api/federation/nodes", fh.listKnownNodes)
	r.Get("/api/federation/balance/{remoteNode}", fh.getNodeBalance)

	r.Get("/api/federation/volume", fh.getVolumeReport)

	// Registro de nodos pares (claves publicas para federacion)
	r.Get("/api/federation/peers", fh.listPeers)
	if am != nil {
		r.With(am.RequirePermission("federation.change_config")).Post("/api/federation/peers", fh.registerPeer)
		r.With(am.RequirePermission("federation.change_config")).Delete("/api/federation/peers/{peerDomain}", fh.removePeer)
	} else {
		r.Post("/api/federation/peers", fh.registerPeer)
		r.Delete("/api/federation/peers/{peerDomain}", fh.removePeer)
	}
}

func (fh *FederationHandler) getFederationConfig(w http.ResponseWriter, r *http.Request) {
	var cfg struct {
		NodeGlobalCreditLimit     int64 `json:"node_global_credit_limit"`
		NodeGlobalDebitLimit      int64 `json:"node_global_debit_limit"`
		NodeBilateralBaseLimit    int64 `json:"node_bilateral_base_limit"`
		WarningThreshold1         int   `json:"warning_threshold_1"`
		WarningThreshold2         int   `json:"warning_threshold_2"`
		WarningThreshold3         int   `json:"warning_threshold_3"`
		ParitySuggestionThreshold int   `json:"parity_suggestion_threshold"`
	}
	err := fh.Pool.QueryRow(r.Context(), `
		SELECT node_global_credit_limit, node_global_debit_limit, node_bilateral_base_limit,
			   warning_threshold_1, warning_threshold_2, warning_threshold_3, parity_suggestion_threshold
		FROM federation_global_config ORDER BY id DESC LIMIT 1`,
	).Scan(&cfg.NodeGlobalCreditLimit, &cfg.NodeGlobalDebitLimit, &cfg.NodeBilateralBaseLimit,
		&cfg.WarningThreshold1, &cfg.WarningThreshold2, &cfg.WarningThreshold3, &cfg.ParitySuggestionThreshold)
	if err != nil {
		writeError(w, 500, "error getting federation config")
		return
	}
	writeJSON(w, 200, cfg)
}

type UpdateFederationConfigRequest struct {
	NodeGlobalCreditLimit     *int64 `json:"node_global_credit_limit"`
	NodeGlobalDebitLimit      *int64 `json:"node_global_debit_limit"`
	NodeBilateralBaseLimit    *int64 `json:"node_bilateral_base_limit"`
	WarningThreshold1         *int   `json:"warning_threshold_1"`
	WarningThreshold2         *int   `json:"warning_threshold_2"`
	WarningThreshold3         *int   `json:"warning_threshold_3"`
	ParitySuggestionThreshold *int   `json:"parity_suggestion_threshold"`
}

func (fh *FederationHandler) updateFederationConfig(w http.ResponseWriter, r *http.Request) {
	var req UpdateFederationConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	reviewerIDStr := r.Header.Get("X-User-ID")
	reviewerID, err := uuid.Parse(reviewerIDStr)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	_, err = fh.Pool.Exec(r.Context(), `
		INSERT INTO federation_global_config 
		(node_global_credit_limit, node_global_debit_limit, node_bilateral_base_limit,
		 warning_threshold_1, warning_threshold_2, warning_threshold_3, parity_suggestion_threshold, updated_by_assembly)
		SELECT 
			COALESCE($1, node_global_credit_limit),
			COALESCE($2, node_global_debit_limit),
			COALESCE($3, node_bilateral_base_limit),
			COALESCE($4, warning_threshold_1),
			COALESCE($5, warning_threshold_2),
			COALESCE($6, warning_threshold_3),
			COALESCE($7, parity_suggestion_threshold),
			$8
		FROM federation_global_config ORDER BY id DESC LIMIT 1`,
		req.NodeGlobalCreditLimit, req.NodeGlobalDebitLimit, req.NodeBilateralBaseLimit,
		req.WarningThreshold1, req.WarningThreshold2, req.WarningThreshold3,
		req.ParitySuggestionThreshold, reviewerID,
	)
	if err != nil {
		writeError(w, 500, "error updating federation config")
		return
	}

	writeJSON(w, 200, map[string]string{"status": "updated"})
}

func (fh *FederationHandler) listBilateralLimits(w http.ResponseWriter, r *http.Request) {
	rows, err := fh.Pool.Query(r.Context(), `
		SELECT id, local_node, remote_node, credit_limit, debit_limit, is_customized,
			   local_approved, remote_confirmed, is_active, created_at, updated_at
		FROM bilateral_limits WHERE local_node = $1 ORDER BY updated_at DESC`,
		fh.NodeDomain,
	)
	if err != nil {
		writeError(w, 500, "error listing bilateral limits")
		return
	}
	defer rows.Close()

	var limits []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var localNode, remoteNode string
		var creditLimit, debitLimit int64
		var isCustomized, localApproved, remoteConfirmed, isActive bool
		var createdAt, updatedAt interface{}
		_ = rows.Scan(&id, &localNode, &remoteNode, &creditLimit, &debitLimit, &isCustomized,
			&localApproved, &remoteConfirmed, &isActive, &createdAt, &updatedAt)
		limits = append(limits, map[string]interface{}{
			"id":               id,
			"local_node":       localNode,
			"remote_node":      remoteNode,
			"credit_limit":     creditLimit,
			"debit_limit":      debitLimit,
			"is_customized":    isCustomized,
			"local_approved":   localApproved,
			"remote_confirmed": remoteConfirmed,
			"is_active":        isActive,
			"created_at":       createdAt,
			"updated_at":       updatedAt,
		})
	}
	writeJSON(w, 200, limits)
}

func (fh *FederationHandler) getBilateralLimit(w http.ResponseWriter, r *http.Request) {
	remoteNode := chi.URLParam(r, "remoteNode")
	if remoteNode == "" {
		writeError(w, 400, "remoteNode is required")
		return
	}

	credit, debit, err := fh.Protocol.GetEffectiveBilateralLimit(r.Context(), remoteNode)
	if err != nil {
		writeError(w, 404, "bilateral limit not found")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"remote_node":  remoteNode,
		"credit_limit": credit,
		"debit_limit":  debit,
	})
}

type ProposeBilateralRequest struct {
	RemoteNode  string `json:"remote_node"`
	CreditLimit int64  `json:"credit_limit"`
	DebitLimit  int64  `json:"debit_limit"`
}

func (fh *FederationHandler) proposeBilateral(w http.ResponseWriter, r *http.Request) {
	var req ProposeBilateralRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	err := fh.Protocol.ProposeBilateralLimit(r.Context(), req.RemoteNode, req.CreditLimit, req.DebitLimit)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]string{"status": "proposed"})
}

func (fh *FederationHandler) confirmBilateral(w http.ResponseWriter, r *http.Request) {
	remoteNode := chi.URLParam(r, "remoteNode")
	if remoteNode == "" {
		writeError(w, 400, "remoteNode is required")
		return
	}

	err := fh.Protocol.ConfirmBilateralLimit(r.Context(), remoteNode)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]string{"status": "confirmed"})
}

func (fh *FederationHandler) bilateralHistory(w http.ResponseWriter, r *http.Request) {
	remoteNode := chi.URLParam(r, "remoteNode")
	if remoteNode == "" {
		writeError(w, 400, "remoteNode is required")
		return
	}

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			limit = v
		}
	}

	rows, err := fh.Pool.Query(r.Context(), `
		SELECT id, local_node, remote_node, old_credit_limit, new_credit_limit,
			   old_debit_limit, new_debit_limit, change_reason, created_at
		FROM bilateral_limit_history
		WHERE local_node = $1 AND remote_node = $2
		ORDER BY created_at DESC LIMIT $3`,
		fh.NodeDomain, remoteNode, limit,
	)
	if err != nil {
		writeError(w, 500, "error getting history")
		return
	}
	defer rows.Close()

	var history []map[string]interface{}
	for rows.Next() {
		var id int64
		var localNode, remoteNode string
		var oldCredit, newCredit, oldDebit, newDebit *int64
		var changeReason *string
		var createdAt interface{}
		_ = rows.Scan(&id, &localNode, &remoteNode, &oldCredit, &newCredit, &oldDebit, &newDebit, &changeReason, &createdAt)
		history = append(history, map[string]interface{}{
			"id":               id,
			"local_node":       localNode,
			"remote_node":      remoteNode,
			"old_credit_limit": oldCredit,
			"new_credit_limit": newCredit,
			"old_debit_limit":  oldDebit,
			"new_debit_limit":  newDebit,
			"change_reason":    changeReason,
			"created_at":       createdAt,
		})
	}
	writeJSON(w, 200, history)
}

func (fh *FederationHandler) getParityReport(w http.ResponseWriter, r *http.Request) {
	remoteNode := chi.URLParam(r, "remoteNode")
	if remoteNode == "" {
		writeError(w, 400, "remoteNode is required")
		return
	}

	report, err := fh.Gossip.GetParityReport(r.Context(), remoteNode)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, report)
}

func (fh *FederationHandler) listParityReports(w http.ResponseWriter, r *http.Request) {
	rows, err := fh.Pool.Query(r.Context(),
		`SELECT remote_node FROM node_balance`,
	)
	if err != nil {
		writeError(w, 500, "error listing nodes")
		return
	}
	defer rows.Close()

	var reports []interface{}
	for rows.Next() {
		var remoteNode string
		_ = rows.Scan(&remoteNode)
		report, err := fh.Gossip.GetParityReport(r.Context(), remoteNode)
		if err == nil {
			reports = append(reports, report)
		}
	}
	writeJSON(w, 200, reports)
}

func (fh *FederationHandler) getActiveWarnings(w http.ResponseWriter, r *http.Request) {
	warnings, err := fh.Gossip.GetActiveWarnings(r.Context())
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"warnings": warnings,
	})
}

func (fh *FederationHandler) listKnownNodes(w http.ResponseWriter, r *http.Request) {
	rows, err := fh.Pool.Query(r.Context(),
		`SELECT remote_node, balance, last_sync, last_hash FROM node_balance`,
	)
	if err != nil {
		writeError(w, 500, "error listing nodes")
		return
	}
	defer rows.Close()

	var nodes []map[string]interface{}
	for rows.Next() {
		var remoteNode string
		var balance int64
		var lastSync, lastHash *interface{}
		_ = rows.Scan(&remoteNode, &balance, &lastSync, &lastHash)
		nodes = append(nodes, map[string]interface{}{
			"remote_node": remoteNode,
			"balance":     balance,
			"last_sync":   lastSync,
			"last_hash":   lastHash,
		})
	}
	writeJSON(w, 200, nodes)
}

func (fh *FederationHandler) getNodeBalance(w http.ResponseWriter, r *http.Request) {
	remoteNode := chi.URLParam(r, "remoteNode")
	if remoteNode == "" {
		writeError(w, 400, "remoteNode is required")
		return
	}

	var balance int64
	var lastSync, lastHash *interface{}
	err := fh.Pool.QueryRow(r.Context(),
		`SELECT balance, last_sync, last_hash FROM node_balance WHERE remote_node = $1`,
		remoteNode,
	).Scan(&balance, &lastSync, &lastHash)
	if err != nil {
		writeError(w, 404, "node not found")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"remote_node": remoteNode,
		"balance":     balance,
		"last_sync":   lastSync,
		"last_hash":   lastHash,
	})
}

func (fh *FederationHandler) getVolumeReport(w http.ResponseWriter, r *http.Request) {
	rows, err := fh.Pool.Query(r.Context(), `
		SELECT counterpart_node,
			   SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END) as imports,
			   SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END) as exports
		FROM ledger_entries
		WHERE account_category = 'node_bridge' AND counterpart_node != ''
		GROUP BY counterpart_node
		ORDER BY counterpart_node`,
	)
	if err != nil {
		writeError(w, 500, "error getting volume report")
		return
	}
	defer rows.Close()

	var report []map[string]interface{}
	for rows.Next() {
		var node string
		var imports, exports int64
		_ = rows.Scan(&node, &imports, &exports)
		report = append(report, map[string]interface{}{
			"remote_node": node,
			"imports":     imports,
			"exports":     exports,
			"balance":     exports - imports,
		})
	}
	writeJSON(w, 200, report)
}

// === Registro de nodos pares (claves publicas para federacion) ===

type RegisterPeerRequest struct {
	PeerDomain    string `json:"peer_domain"`
	PeerName      string `json:"peer_name"`
	PeerPublicKey string `json:"peer_public_key"`
	PeerEndpoint  string `json:"peer_endpoint"`
	Notes         string `json:"notes"`
}

// listPeers lista todos los nodos pares registrados con sus claves publicas
func (fh *FederationHandler) listPeers(w http.ResponseWriter, r *http.Request) {
	rows, err := fh.Pool.Query(r.Context(), `
		SELECT peer_domain, peer_name, peer_public_key, peer_endpoint,
			   status, mutual_verified, notes, created_at, updated_at
		FROM node_federation_keys
		ORDER BY created_at DESC`)
	if err != nil {
		writeError(w, 500, "error listing peers")
		return
	}
	defer rows.Close()

	var peers []map[string]interface{}
	for rows.Next() {
		var peerDomain, peerPubKey, status string
		var peerName, peerEndpoint, notes *string
		var mutualVerified bool
		var createdAt, updatedAt interface{}
		_ = rows.Scan(&peerDomain, &peerName, &peerPubKey, &peerEndpoint,
			&status, &mutualVerified, &notes, &createdAt, &updatedAt)

		peer := map[string]interface{}{
			"peer_domain":     peerDomain,
			"peer_public_key": peerPubKey,
			"status":          status,
			"mutual_verified": mutualVerified,
			"created_at":      createdAt,
			"updated_at":      updatedAt,
		}
		if peerName != nil {
			peer["peer_name"] = *peerName
		}
		if peerEndpoint != nil {
			peer["peer_endpoint"] = *peerEndpoint
		}
		if notes != nil {
			peer["notes"] = *notes
		}
		peers = append(peers, peer)
	}
	if peers == nil {
		peers = []map[string]interface{}{}
	}
	writeJSON(w, 200, peers)
}

// registerPeer registra la clave publica de otro nodo para federarse.
// Para que la federacion funcione, AMBOS nodos deben registrarse mutuamente.
func (fh *FederationHandler) registerPeer(w http.ResponseWriter, r *http.Request) {
	var req RegisterPeerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	if req.PeerDomain == "" {
		writeError(w, 400, "peer_domain is required")
		return
	}
	if req.PeerPublicKey == "" {
		writeError(w, 400, "peer_public_key is required")
		return
	}
	if len(req.PeerPublicKey) != 64 {
		writeError(w, 400, "peer_public_key must be 32 bytes (64 hex chars)")
		return
	}

	// No permitir registrar el propio dominio
	if req.PeerDomain == fh.NodeDomain {
		writeError(w, 400, "cannot register self as peer")
		return
	}

	// Obtener el userID del contexto (quien registra el peer)
	var addedBy *uuid.UUID
	if userID, ok := r.Context().Value("user_id").(uuid.UUID); ok {
		addedBy = &userID
	}

	_, err := fh.Pool.Exec(r.Context(), `
		INSERT INTO node_federation_keys (peer_domain, peer_name, peer_public_key, peer_endpoint, status, added_by, notes, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'pending', $5, $6, NOW(), NOW())
		ON CONFLICT (peer_domain) DO UPDATE SET
			peer_name = $2,
			peer_public_key = $3,
			peer_endpoint = $4,
			notes = $6,
			updated_at = NOW()`,
		req.PeerDomain, req.PeerName, req.PeerPublicKey, req.PeerEndpoint, addedBy, req.Notes)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("error registering peer: %v", err))
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"status":      "registered",
		"peer_domain": req.PeerDomain,
		"message":     "Peer registrado. Para federacion activa, el otro nodo tambien debe registrar tu clave publica.",
		"your_node":   fh.NodeDomain,
	})
}

// removePeer elimina un nodo par registrado
func (fh *FederationHandler) removePeer(w http.ResponseWriter, r *http.Request) {
	peerDomain := chi.URLParam(r, "peerDomain")
	if peerDomain == "" {
		writeError(w, 400, "peerDomain is required")
		return
	}

	_, err := fh.Pool.Exec(r.Context(),
		`DELETE FROM node_federation_keys WHERE peer_domain = $1`, peerDomain)
	if err != nil {
		writeError(w, 500, "error removing peer")
		return
	}

	writeJSON(w, 200, map[string]string{"status": "removed"})
}
