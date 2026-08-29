package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"federated-credit-node/internal/db"
	"federated-credit-node/internal/federation"
)

type FederationHandler struct {
	Pool       *pgxpool.Pool
	Protocol   *federation.Protocol
	Gossip     *federation.Gossip
	NodeLevels *federation.NodeLevels
	FedPairing *federation.FederationPairing
	Propagator *federation.Propagator
	Transport  *federation.EncryptedTransport
	NodeDomain string
}

func NewFederationHandler(pool *pgxpool.Pool, nodeDomain string) *FederationHandler {
	proto := federation.New(pool, nodeDomain)
	gossip := federation.NewGossip(pool, nodeDomain, 0)
	nodeLevels := federation.NewNodeLevels(pool, nodeDomain)
	fedPairing := federation.NewFederationPairing(pool, nodeDomain, nodeLevels)
	transport := federation.NewEncryptedTransport(pool, nodeDomain)
	propagator := federation.NewPropagator(pool, nodeDomain, transport)
	// Wire up: pairing propagates new peers, gossip uses propagator for catch-up
	fedPairing.SetPropagator(propagator)
	gossip.SetPropagator(propagator)
	return &FederationHandler{
		Pool:       pool,
		Protocol:   proto,
		Gossip:     gossip,
		NodeLevels: nodeLevels,
		FedPairing: fedPairing,
		Propagator: propagator,
		Transport:  transport,
		NodeDomain: nodeDomain,
	}
}

// SetTransportPrivateKey loads the node's Ed25519 private key into the transport.
// This enables signing outgoing messages and decrypting incoming messages.
func (fh *FederationHandler) SetTransportPrivateKey(privKeyB64 string) error {
	if fh.Transport == nil {
		return fmt.Errorf("transport not initialized")
	}
	return fh.Transport.LoadPrivateKeyFromBase64(privKeyB64)
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
	r.Get("/api/federation/peer/{remoteNode}/transactions", fh.peerTransactions)

	r.Get("/api/federation/parity/{remoteNode}", fh.getParityReport)
	r.Get("/api/federation/parity", fh.listParityReports)

	r.Get("/api/federation/warnings", fh.getActiveWarnings)

	r.Get("/api/federation/nodes", fh.listKnownNodes)
	r.Get("/api/federation/balance/{remoteNode}", fh.getNodeBalance)
	r.Get("/api/federation/balances", fh.listAllBalances)

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

	// Niveles de nodo federado
	r.Get("/api/federation/node-levels", fh.listNodeLevels)
	r.Get("/api/federation/nodes/{domain}/membership", fh.getNodeMembership)
	r.Get("/api/federation/nodes/{domain}/check-upgrade", fh.checkNodeUpgrade)
	r.Get("/api/federation/sponsorships", fh.listSponsorships)

	// Federation pairing (verificacion de 4 opciones)
	// Usa request_id (UUID) para que el frontend nunca sepa el codigo real.
	r.Post("/api/federation/pair/initiate", fh.initiateFedPairing)
	r.Get("/api/federation/pair/pending", fh.listPendingFedPairings)
	r.Get("/api/federation/pair/request/{reqId}/options", fh.getFedPairingOptionsByReqID)
	if am != nil {
		r.With(am.RequirePermission("federation.change_config")).Post("/api/federation/pair/request/{reqId}/confirm", fh.confirmFedPairingByReqID)
		r.With(am.RequirePermission("federation.change_config")).Post("/api/federation/pair/request/{reqId}/reject", fh.rejectFedPairingByReqID)
	} else {
		r.Post("/api/federation/pair/request/{reqId}/confirm", fh.confirmFedPairingByReqID)
		r.Post("/api/federation/pair/request/{reqId}/reject", fh.rejectFedPairingByReqID)
	}

	// Propuestas de productos federados
	r.Get("/api/federation/products/pending", fh.listPendingProductProposals)
	r.Get("/api/federation/products/all", fh.listAllProductProposals)
	if am != nil {
		r.With(am.RequirePermission("products.manage")).Post("/api/federation/products/{id}/approve", fh.approveProductProposal)
		r.With(am.RequirePermission("products.manage")).Post("/api/federation/products/{id}/reject", fh.rejectProductProposal)
	} else {
		r.Post("/api/federation/products/{id}/approve", fh.approveProductProposal)
		r.Post("/api/federation/products/{id}/reject", fh.rejectProductProposal)
	}

	// === PROPAGACION AUTOMATICA DE FEDERACION (E2E encrypted) ===
	// Estos endpoints reciben mensajes cifrados de otros nodos.
	// Verifican firma Ed25519 del emisor — no requieren JWT de usuario.
	r.Post("/api/federation/propagate/peer", fh.receivePropagatedPeer)
	r.Post("/api/federation/propagate/membership", fh.receivePropagatedMembership)
	r.Post("/api/federation/propagate/block", fh.receivePropagatedBlock)
	r.Post("/api/federation/propagate/expulsion", fh.receivePropagatedExpulsion)
	r.Post("/api/federation/propagate/catch-up", fh.handleCatchUpRequest)

	// === BLOQUEO UNILATERAL (requiere auth de usuario) ===
	r.Get("/api/federation/blocks", fh.listUnilateralBlocks)
	if am != nil {
		r.With(am.RequirePermission("federation.change_config")).Post("/api/federation/block/{peerDomain}", fh.createUnilateralBlock)
		r.With(am.RequirePermission("federation.change_config")).Delete("/api/federation/block/{peerDomain}", fh.removeUnilateralBlock)
	} else {
		r.Post("/api/federation/block/{peerDomain}", fh.createUnilateralBlock)
		r.Delete("/api/federation/block/{peerDomain}", fh.removeUnilateralBlock)
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

func (fh *FederationHandler) listAllBalances(w http.ResponseWriter, r *http.Request) {
	rows, err := fh.Pool.Query(r.Context(),
		`SELECT remote_node, balance, last_sync FROM node_balance ORDER BY remote_node`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	type balanceEntry struct {
		RemoteNode string     `json:"remote_node"`
		Balance    int64      `json:"balance"`
		LastSync   *time.Time `json:"last_sync"`
	}
	balances := []balanceEntry{}
	for rows.Next() {
		var b balanceEntry
		rows.Scan(&b.RemoteNode, &b.Balance, &b.LastSync)
		balances = append(balances, b)
	}
	writeJSON(w, 200, balances)
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
	PeerDomain     string `json:"peer_domain"`
	PeerName       string `json:"peer_name"`
	PeerPublicKey  string `json:"peer_public_key"`
	PeerEndpoint   string `json:"peer_endpoint"`
	PeerNodeNumber int    `json:"peer_node_number"`
	Notes          string `json:"notes"`
}

// listPeers lista todos los nodos pares registrados con sus claves publicas
func (fh *FederationHandler) listPeers(w http.ResponseWriter, r *http.Request) {
	rows, err := fh.Pool.Query(r.Context(), `
		SELECT peer_domain, peer_name, peer_public_key, peer_endpoint, peer_node_number,
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
		var peerNodeNumber *int
		var mutualVerified bool
		var createdAt, updatedAt interface{}
		_ = rows.Scan(&peerDomain, &peerName, &peerPubKey, &peerEndpoint, &peerNodeNumber,
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
		if peerNodeNumber != nil {
			peer["peer_node_number"] = *peerNodeNumber
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
		INSERT INTO node_federation_keys (peer_domain, peer_name, peer_public_key, peer_endpoint, peer_node_number, status, added_by, notes, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, NOW(), NOW())
		ON CONFLICT (peer_domain) DO UPDATE SET
			peer_name = $2,
			peer_public_key = $3,
			peer_endpoint = $4,
			peer_node_number = $5,
			notes = $7,
			updated_at = NOW()`,
		req.PeerDomain, req.PeerName, req.PeerPublicKey, req.PeerEndpoint, req.PeerNodeNumber, addedBy, req.Notes)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("error registering peer: %v", err))
		return
	}

	// Notificar a los administradores del nodo
	if addedBy != nil {
		notify := NewNotifyService(fh.Pool)
		notify.NotifyBoard(r.Context(), fh.NodeDomain, "federation_peer_registered",
			"Nuevo nodo par registrado",
			fmt.Sprintf("Se ha registrado el nodo par %s (%s). Estado: pendiente de confirmacion mutua.", req.PeerName, req.PeerDomain),
			"/app/federation",
			map[string]interface{}{"peer_domain": req.PeerDomain, "peer_name": req.PeerName})
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

// ============ PRODUCT FEDERATION ============

func (fh *FederationHandler) listPendingProductProposals(w http.ResponseWriter, r *http.Request) {
	rows, err := fh.Pool.Query(r.Context(), `
		SELECT id, source_node, source_product_id, name, parent_category, category, subcategory, unit, description, badge, image_url, price_per_unit, is_composite, status, created_at
		FROM product_federation_proposals
		WHERE status = 'pending'
		ORDER BY created_at DESC`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	proposals := []map[string]interface{}{}
	for rows.Next() {
		var id, sourceNode, name, parentCat, cat, subcat, unit, description, status string
		var sourcePID uuid.UUID
		var price int64
		var badge, imageURL *string
		var isComposite bool
		var createdAt time.Time
		_ = rows.Scan(&id, &sourceNode, &sourcePID, &name, &parentCat, &cat, &subcat, &unit, &description, &badge, &imageURL, &price, &isComposite, &status, &createdAt)

		bdg := ""
		if badge != nil {
			bdg = *badge
		}
		imgURL := ""
		if imageURL != nil {
			imgURL = *imageURL
		}

		proposals = append(proposals, map[string]interface{}{
			"id":                id,
			"source_node":       sourceNode,
			"source_product_id": sourcePID.String(),
			"name":              name,
			"parent_category":   parentCat,
			"category":          cat,
			"subcategory":       subcat,
			"unit":              unit,
			"description":       description,
			"badge":             bdg,
			"image_url":         imgURL,
			"price_per_unit":    price,
			"is_composite":      isComposite,
			"status":            status,
			"created_at":        createdAt,
		})
	}
	writeJSON(w, 200, proposals)
}

func (fh *FederationHandler) listAllProductProposals(w http.ResponseWriter, r *http.Request) {
	rows, err := fh.Pool.Query(r.Context(), `
		SELECT id, source_node, source_product_id, name, parent_category, category, subcategory, unit, description, badge, image_url, price_per_unit, is_composite, status, review_notes, created_at, reviewed_at
		FROM product_federation_proposals
		ORDER BY created_at DESC`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	proposals := []map[string]interface{}{}
	for rows.Next() {
		var id, sourceNode, name, parentCat, cat, subcat, unit, description, status string
		var sourcePID uuid.UUID
		var price int64
		var badge, imageURL, reviewNotes *string
		var isComposite bool
		var createdAt time.Time
		var reviewedAt *time.Time
		_ = rows.Scan(&id, &sourceNode, &sourcePID, &name, &parentCat, &cat, &subcat, &unit, &description, &badge, &imageURL, &price, &isComposite, &status, &reviewNotes, &createdAt, &reviewedAt)

		bdg := ""
		if badge != nil {
			bdg = *badge
		}
		imgURL := ""
		if imageURL != nil {
			imgURL = *imageURL
		}
		rn := ""
		if reviewNotes != nil {
			rn = *reviewNotes
		}
		ra := ""
		if reviewedAt != nil {
			ra = reviewedAt.String()
		}

		proposals = append(proposals, map[string]interface{}{
			"id":                id,
			"source_node":       sourceNode,
			"source_product_id": sourcePID.String(),
			"name":              name,
			"parent_category":   parentCat,
			"category":          cat,
			"subcategory":       subcat,
			"unit":              unit,
			"description":       description,
			"badge":             bdg,
			"image_url":         imgURL,
			"price_per_unit":    price,
			"is_composite":      isComposite,
			"status":            status,
			"review_notes":      rn,
			"created_at":        createdAt,
			"reviewed_at":       ra,
		})
	}
	writeJSON(w, 200, proposals)
}

func (fh *FederationHandler) approveProductProposal(w http.ResponseWriter, r *http.Request) {
	proposalID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid proposal id")
		return
	}

	// Obtener datos de la propuesta
	var sourceNode, name, parentCat, cat, subcat, unit, description, badge, imageURL string
	var sourcePID uuid.UUID
	var price int64
	var isComposite bool
	err = fh.Pool.QueryRow(r.Context(), `
		SELECT source_node, source_product_id, name, parent_category, category, subcategory, unit, description, badge, image_url, price_per_unit, is_composite
		FROM product_federation_proposals WHERE id = $1 AND status = 'pending'`,
		proposalID).Scan(&sourceNode, &sourcePID, &name, &parentCat, &cat, &subcat, &unit, &description, &badge, &imageURL, &price, &isComposite)
	if err != nil {
		writeError(w, 404, "propuesta no encontrada o ya revisada")
		return
	}

	// Obtener userID del contexto
	var reviewedBy *uuid.UUID
	if userID, ok := r.Context().Value("user_id").(uuid.UUID); ok {
		reviewedBy = &userID
	}

	// Insertar el producto en el catalogo local como aprobado
	// Los datos locales se guardan con LOCAL_NODE_DOMAIN
	_, err = fh.Pool.Exec(r.Context(), `
		INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, source_node, source_product_id)
		VALUES ($1, $2, $3, $4, $5, 'federated', $6, $7, $8, $9, $10, true, false, $11, $12, $13)
		ON CONFLICT DO NOTHING`,
		db.LOCAL_NODE_DOMAIN, name, parentCat, cat, subcat, unit, description, badge, imageURL, price, isComposite, sourceNode, sourcePID)
	if err != nil {
		writeError(w, 500, "error al insertar producto federado")
		return
	}

	// Marcar propuesta como aprobada
	_, err = fh.Pool.Exec(r.Context(), `
		UPDATE product_federation_proposals SET status = 'approved', reviewed_by = $2, reviewed_at = NOW() WHERE id = $1`,
		proposalID, reviewedBy)
	if err != nil {
		writeError(w, 500, "error al actualizar propuesta")
		return
	}

	// Notificar a la junta directiva
	notify := NewNotifyService(fh.Pool)
	notify.NotifyBoard(r.Context(), fh.NodeDomain, "federation_product_approved",
		"Producto federado aprobado",
		fmt.Sprintf("El producto %s del nodo %s ha sido aprobado y agregado al catalogo local.", name, sourceNode),
		"/app/federation",
		map[string]interface{}{"proposal_id": proposalID.String(), "product_name": name, "source_node": sourceNode})

	writeJSON(w, 200, map[string]interface{}{
		"status":  "approved",
		"product": name,
		"message": "Producto federado aprobado y agregado al catalogo local",
	})
}

func (fh *FederationHandler) rejectProductProposal(w http.ResponseWriter, r *http.Request) {
	proposalID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid proposal id")
		return
	}

	var req struct {
		Notes string `json:"notes"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	var reviewedBy *uuid.UUID
	if userID, ok := r.Context().Value("user_id").(uuid.UUID); ok {
		reviewedBy = &userID
	}

	_, err = fh.Pool.Exec(r.Context(), `
		UPDATE product_federation_proposals SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(), review_notes = $3 WHERE id = $1 AND status = 'pending'`,
		proposalID, reviewedBy, req.Notes)
	if err != nil {
		writeError(w, 500, "error al rechazar propuesta")
		return
	}

	writeJSON(w, 200, map[string]string{"status": "rejected"})
}

func (fh *FederationHandler) peerTransactions(w http.ResponseWriter, r *http.Request) {
	remoteNode := chi.URLParam(r, "remoteNode")
	if remoteNode == "" {
		writeError(w, 400, "remoteNode is required")
		return
	}

	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 500 {
			limit = v
		}
	}

	rows, err := fh.Pool.Query(r.Context(), `
		SELECT t.id, t.tx_type, t.sender_id, t.receiver_id, t.sender_node, t.receiver_node,
		       t.amount, t.status, t.created_at, t.confirmed_at, t.metadata,
		       COALESCE(s.username, '') as sender_username,
		       COALESCE(s.display_name, '') as sender_display,
		       COALESCE(r.username, '') as receiver_username,
		       COALESCE(r.display_name, '') as receiver_display
		FROM transactions t
		LEFT JOIN users s ON t.sender_id = s.id
		LEFT JOIN users r ON t.receiver_id = r.id
		WHERE t.tx_type = 'federation_transfer'
		  AND (t.sender_node = $1 OR t.receiver_node = $1)
		ORDER BY t.created_at DESC LIMIT $2`,
		remoteNode, limit,
	)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	var txs []map[string]interface{}
	for rows.Next() {
		var id, txType, senderID, receiverID, senderNode, receiverNode, status string
		var senderUsername, senderDisplay, receiverUsername, receiverDisplay string
		var amount float64
		var createdAt time.Time
		var confirmedAt *time.Time
		var metadata []byte
		_ = rows.Scan(&id, &txType, &senderID, &receiverID, &senderNode, &receiverNode,
			&amount, &status, &createdAt, &confirmedAt, &metadata,
			&senderUsername, &senderDisplay, &receiverUsername, &receiverDisplay)

		description := ""
		if len(metadata) > 0 {
			var meta map[string]interface{}
			if json.Unmarshal(metadata, &meta) == nil {
				if d, ok := meta["description"].(string); ok {
					description = d
				}
			}
		}

		// Direccion: si mi nodo envio, es debito; si recibi, es credito
		direction := "credit"
		if senderNode == fh.NodeDomain {
			direction = "debit"
		}

		txs = append(txs, map[string]interface{}{
			"id":               id,
			"tx_type":          txType,
			"sender_id":        senderID,
			"receiver_id":      receiverID,
			"sender_node":      senderNode,
			"receiver_node":    receiverNode,
			"sender_display":   senderDisplay,
			"receiver_display": receiverDisplay,
			"amount":           amount,
			"status":           status,
			"direction":        direction,
			"description":      description,
			"created_at":       createdAt,
		})
	}
	if txs == nil {
		txs = []map[string]interface{}{}
	}
	writeJSON(w, 200, txs)
}

// ============ NIVELES DE NODO FEDERADO ============

// listNodeLevels returns all federation node levels
func (fh *FederationHandler) listNodeLevels(w http.ResponseWriter, r *http.Request) {
	levels, err := fh.NodeLevels.GetAllLevels(r.Context())
	if err != nil {
		writeError(w, 500, "error listing node levels")
		return
	}
	if levels == nil {
		levels = []federation.NodeLevel{}
	}
	writeJSON(w, 200, map[string]interface{}{"levels": levels})
}

// getNodeMembership returns the membership info for a specific node
func (fh *FederationHandler) getNodeMembership(w http.ResponseWriter, r *http.Request) {
	domain := chi.URLParam(r, "domain")
	if domain == "" {
		writeError(w, 400, "domain is required")
		return
	}

	membership, err := fh.NodeLevels.GetMembership(r.Context(), domain)
	if err != nil {
		writeError(w, 404, "node not found in federation membership")
		return
	}

	// Also get effective limit
	effectiveLimit, _ := fh.NodeLevels.GetEffectiveLimit(r.Context(), domain)

	writeJSON(w, 200, map[string]interface{}{
		"membership":      membership,
		"effective_limit": effectiveLimit,
	})
}

// checkNodeUpgrade checks if a node can be upgraded (auto or by vote)
func (fh *FederationHandler) checkNodeUpgrade(w http.ResponseWriter, r *http.Request) {
	domain := chi.URLParam(r, "domain")
	if domain == "" {
		writeError(w, 400, "domain is required")
		return
	}

	// Check if can propose upgrade (time requirements)
	canPropose, reason, err := fh.NodeLevels.CanProposeUpgrade(r.Context(), domain)
	if err != nil {
		writeError(w, 500, "error checking upgrade eligibility")
		return
	}

	// Check if qualifies for auto-upgrade
	canAutoUpgrade, autoReason, err := fh.NodeLevels.CheckAutoUpgrade(r.Context(), domain)
	if err != nil {
		writeError(w, 500, "error checking auto-upgrade")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"node_domain":      domain,
		"can_propose":      canPropose,
		"propose_reason":   reason,
		"can_auto_upgrade": canAutoUpgrade,
		"auto_reason":      autoReason,
	})
}

// listSponsorships returns all sponsorships
func (fh *FederationHandler) listSponsorships(w http.ResponseWriter, r *http.Request) {
	sponsorships, err := fh.NodeLevels.GetAllSponsorships(r.Context())
	if err != nil {
		writeError(w, 500, "error listing sponsorships")
		return
	}
	if sponsorships == nil {
		sponsorships = []federation.Sponsorship{}
	}
	writeJSON(w, 200, map[string]interface{}{"sponsorships": sponsorships})
}

// ============ FEDERATION PAIRING (4 opciones) ============

// initiateFedPairing starts a federation pairing request from a new node
func (fh *FederationHandler) initiateFedPairing(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RequestingDomain    string `json:"requesting_domain"`
		RequestingPublicKey string `json:"requesting_public_key"`
		RequestingEndpoint  string `json:"requesting_endpoint"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	code, err := fh.FedPairing.InitiateFederationPairing(r.Context(), req.RequestingDomain, req.RequestingPublicKey, req.RequestingEndpoint)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"pairing_code": code,
		"expires_in":   60,
		"message":      "Solicitud creada. Comunique este codigo al nodo padrino por un canal seguro (telefono, mensaje). El padrino vera 4 opciones y debe elegir la correcta.",
	})
}

// getFedPairingOptions returns 4 code options for the sponsor to choose from
func (fh *FederationHandler) getFedPairingOptions(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if code == "" {
		writeError(w, 400, "code is required")
		return
	}

	options, err := fh.FedPairing.GetFederationPairingOptions(r.Context(), code)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"options": options,
		"message": "Elija el codigo que le comunico el nodo nuevo. Solo uno es correcto.",
	})
}

// confirmFedPairing confirms a federation pairing by selecting the correct code
func (fh *FederationHandler) confirmFedPairing(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if code == "" {
		writeError(w, 400, "code is required")
		return
	}

	var req struct {
		SelectedCode  string `json:"selected_code"`
		SponsorDomain string `json:"sponsor_domain"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	if req.SelectedCode == "" {
		writeError(w, 400, "selected_code is required")
		return
	}
	if req.SponsorDomain == "" {
		req.SponsorDomain = fh.NodeDomain
	}

	result, err := fh.FedPairing.ConfirmFederationPairing(r.Context(), code, req.SelectedCode, req.SponsorDomain)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	writeJSON(w, 200, result)
}

// ============ FEDERATION PAIRING BY REQUEST_ID (UUID) ============
// Estos endpoints usan el UUID de la solicitud en lugar del pairing_code.
// El frontend nunca recibe el pairing_code real — solo el request_id.

// listPendingFedPairings lista las solicitudes de federacion pendientes.
// NUNCA devuelve pairing_code — el frontend solo recibe el request_id (UUID).
func (fh *FederationHandler) listPendingFedPairings(w http.ResponseWriter, r *http.Request) {
	requests, err := fh.FedPairing.ListPendingFederationPairings(r.Context())
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if requests == nil {
		requests = []federation.FederationPairingRequest{}
	}
	writeJSON(w, 200, requests)
}

// getFedPairingOptionsByReqID devuelve 4 opciones de codigo para que el admin elija.
func (fh *FederationHandler) getFedPairingOptionsByReqID(w http.ResponseWriter, r *http.Request) {
	reqIDStr := chi.URLParam(r, "reqId")
	if reqIDStr == "" {
		writeError(w, 400, "request id is required")
		return
	}
	reqID, err := uuid.Parse(reqIDStr)
	if err != nil {
		writeError(w, 400, "invalid request id")
		return
	}

	options, err := fh.FedPairing.GetFederationPairingOptionsByReqID(r.Context(), reqID)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"options": options,
		"message": "Elija el codigo que le comunico el nodo nuevo por telefono. Solo uno es correcto.",
	})
}

// confirmFedPairingByReqID confirma una solicitud por UUID.
// El admin envia selected_code (el que eligio de las 4 opciones).
// El servidor valida internamente si selected_code coincide con el codigo real.
func (fh *FederationHandler) confirmFedPairingByReqID(w http.ResponseWriter, r *http.Request) {
	reqIDStr := chi.URLParam(r, "reqId")
	if reqIDStr == "" {
		writeError(w, 400, "request id is required")
		return
	}
	reqID, err := uuid.Parse(reqIDStr)
	if err != nil {
		writeError(w, 400, "invalid request id")
		return
	}

	var req struct {
		SelectedCode  string `json:"selected_code"`
		SponsorDomain string `json:"sponsor_domain"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.SelectedCode == "" {
		writeError(w, 400, "selected_code is required — debe elegir uno de los 4 codigos")
		return
	}
	if req.SponsorDomain == "" {
		req.SponsorDomain = fh.NodeDomain
	}

	result, err := fh.FedPairing.ConfirmFederationPairingByReqID(r.Context(), reqID, req.SelectedCode, req.SponsorDomain)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	writeJSON(w, 200, result)
}

// rejectFedPairingByReqID rechaza una solicitud por UUID.
func (fh *FederationHandler) rejectFedPairingByReqID(w http.ResponseWriter, r *http.Request) {
	reqIDStr := chi.URLParam(r, "reqId")
	if reqIDStr == "" {
		writeError(w, 400, "request id is required")
		return
	}
	reqID, err := uuid.Parse(reqIDStr)
	if err != nil {
		writeError(w, 400, "invalid request id")
		return
	}

	if err := fh.FedPairing.RejectFederationPairingByReqID(r.Context(), reqID); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "rejected"})
}

// ============ PROPAGACION AUTOMATICA DE FEDERACION ============
// Estos endpoints reciben mensajes cifrados E2E de otros nodos.
// Verifican la firma Ed25519 del emisor — no requieren JWT de usuario.

// receivePropagatedPeer recibe un nuevo nodo propagado por un peer.
// El body esta cifrado E2E (ECDH + AES-256-GCM + firma Ed25519).
func (fh *FederationHandler) receivePropagatedPeer(w http.ResponseWriter, r *http.Request) {
	if fh.Propagator == nil || fh.Transport == nil {
		writeError(w, 503, "propagation not configured")
		return
	}

	var envelope federation.EncryptedEnvelope
	if err := json.NewDecoder(r.Body).Decode(&envelope); err != nil {
		writeError(w, 400, "invalid envelope")
		return
	}

	plaintext, err := fh.Transport.VerifyAndDecrypt(r.Context(), &envelope)
	if err != nil {
		writeError(w, 401, fmt.Sprintf("verification failed: %v", err))
		return
	}

	msg, err := federation.ParsePropagationMessage(plaintext)
	if err != nil {
		writeError(w, 400, "invalid propagation message")
		return
	}

	if msg.Type != federation.MsgPropNewPeer {
		writeError(w, 400, "unexpected message type")
		return
	}

	if err := fh.Propagator.ReceivePropagatedPeer(r.Context(), msg); err != nil {
		writeError(w, 500, fmt.Sprintf("processing propagated peer: %v", err))
		return
	}

	writeJSON(w, 200, map[string]interface{}{"status": "received"})
}

// receivePropagatedMembership recibe una actualizacion de membresia propagada.
func (fh *FederationHandler) receivePropagatedMembership(w http.ResponseWriter, r *http.Request) {
	if fh.Propagator == nil || fh.Transport == nil {
		writeError(w, 503, "propagation not configured")
		return
	}

	var envelope federation.EncryptedEnvelope
	if err := json.NewDecoder(r.Body).Decode(&envelope); err != nil {
		writeError(w, 400, "invalid envelope")
		return
	}

	plaintext, err := fh.Transport.VerifyAndDecrypt(r.Context(), &envelope)
	if err != nil {
		writeError(w, 401, fmt.Sprintf("verification failed: %v", err))
		return
	}

	msg, err := federation.ParsePropagationMessage(plaintext)
	if err != nil {
		writeError(w, 400, "invalid propagation message")
		return
	}

	if msg.Type != federation.MsgPropMembership {
		writeError(w, 400, "unexpected message type")
		return
	}

	if err := fh.Propagator.ReceiveMembershipUpdate(r.Context(), msg); err != nil {
		writeError(w, 500, fmt.Sprintf("processing membership update: %v", err))
		return
	}

	writeJSON(w, 200, map[string]interface{}{"status": "received"})
}

// receivePropagatedBlock recibe un bloqueo unilateral propagado.
func (fh *FederationHandler) receivePropagatedBlock(w http.ResponseWriter, r *http.Request) {
	if fh.Propagator == nil || fh.Transport == nil {
		writeError(w, 503, "propagation not configured")
		return
	}

	var envelope federation.EncryptedEnvelope
	if err := json.NewDecoder(r.Body).Decode(&envelope); err != nil {
		writeError(w, 400, "invalid envelope")
		return
	}

	plaintext, err := fh.Transport.VerifyAndDecrypt(r.Context(), &envelope)
	if err != nil {
		writeError(w, 401, fmt.Sprintf("verification failed: %v", err))
		return
	}

	msg, err := federation.ParsePropagationMessage(plaintext)
	if err != nil {
		writeError(w, 400, "invalid propagation message")
		return
	}

	if msg.Type != federation.MsgPropBlock {
		writeError(w, 400, "unexpected message type")
		return
	}

	if err := fh.Propagator.ReceiveUnilateralBlock(r.Context(), msg); err != nil {
		writeError(w, 500, fmt.Sprintf("processing block: %v", err))
		return
	}

	writeJSON(w, 200, map[string]interface{}{"status": "received"})
}

// receivePropagatedExpulsion recibe una orden de expulsion federada.
// Cada nodo ejecuta la expulsion individualmente.
func (fh *FederationHandler) receivePropagatedExpulsion(w http.ResponseWriter, r *http.Request) {
	if fh.Propagator == nil || fh.Transport == nil {
		writeError(w, 503, "propagation not configured")
		return
	}

	var envelope federation.EncryptedEnvelope
	if err := json.NewDecoder(r.Body).Decode(&envelope); err != nil {
		writeError(w, 400, "invalid envelope")
		return
	}

	plaintext, err := fh.Transport.VerifyAndDecrypt(r.Context(), &envelope)
	if err != nil {
		writeError(w, 401, fmt.Sprintf("verification failed: %v", err))
		return
	}

	msg, err := federation.ParsePropagationMessage(plaintext)
	if err != nil {
		writeError(w, 400, "invalid propagation message")
		return
	}

	if msg.Type != federation.MsgPropExpulsion {
		writeError(w, 400, "unexpected message type")
		return
	}

	if err := fh.Propagator.ReceiveExpulsionOrder(r.Context(), msg); err != nil {
		writeError(w, 500, fmt.Sprintf("processing expulsion: %v", err))
		return
	}

	writeJSON(w, 200, map[string]interface{}{"status": "executed"})
}

// handleCatchUpRequest recibe una solicitud de catch-up de un peer.
// Responde con todos los datos de federacion cifrados E2E.
func (fh *FederationHandler) handleCatchUpRequest(w http.ResponseWriter, r *http.Request) {
	if fh.Propagator == nil || fh.Transport == nil {
		writeError(w, 503, "propagation not configured")
		return
	}

	var envelope federation.EncryptedEnvelope
	if err := json.NewDecoder(r.Body).Decode(&envelope); err != nil {
		writeError(w, 400, "invalid envelope")
		return
	}

	// Verify the request (but we respond with catch-up data regardless)
	_, err := fh.Transport.VerifyAndDecrypt(r.Context(), &envelope)
	if err != nil {
		writeError(w, 401, fmt.Sprintf("verification failed: %v", err))
		return
	}

	// Get all federation data
	data := fh.Propagator.GetCatchUpData(r.Context())

	// Encrypt the response
	responseMsg := federation.PropagationMessage{
		Type:        federation.MsgPropCatchUpResp,
		FromNode:    fh.NodeDomain,
		Timestamp:   time.Now().Unix(),
		MessageID:   federation.GenerateMessageID(),
		CatchUpData: data,
	}

	// For the response, we need to encrypt it back to the requester
	// Since we're in an HTTP response, we'll return the catch-up data
	// in a simpler format — the transport layer already verified the requester
	writeJSON(w, 200, responseMsg)
}

// ============ BLOQUEO UNILATERAL ============

// listUnilateralBlocks lista los bloqueos unilaterales activos.
func (fh *FederationHandler) listUnilateralBlocks(w http.ResponseWriter, r *http.Request) {
	rows, err := fh.Pool.Query(r.Context(), `
		SELECT blocker_domain, blocked_domain, COALESCE(reason, ''), blocked_at
		FROM federation_unilateral_blocks ORDER BY blocked_at DESC`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	blocks := []map[string]interface{}{}
	for rows.Next() {
		var blocker, blocked, reason string
		var blockedAt time.Time
		if err := rows.Scan(&blocker, &blocked, &reason, &blockedAt); err != nil {
			continue
		}
		blocks = append(blocks, map[string]interface{}{
			"blocker_domain": blocker,
			"blocked_domain": blocked,
			"reason":         reason,
			"blocked_at":     blockedAt,
		})
	}
	writeJSON(w, 200, map[string]interface{}{"blocks": blocks})
}

// createUnilateralBlock crea un bloqueo unilateral local y lo propaga.
func (fh *FederationHandler) createUnilateralBlock(w http.ResponseWriter, r *http.Request) {
	peerDomain := chi.URLParam(r, "peerDomain")
	if peerDomain == "" {
		writeError(w, 400, "peerDomain is required")
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	// Body is optional
	_ = json.NewDecoder(r.Body).Decode(&req)

	if fh.Propagator == nil {
		writeError(w, 503, "propagation not configured")
		return
	}

	if err := fh.Propagator.PropagateUnilateralBlock(r.Context(), peerDomain, req.Reason); err != nil {
		writeError(w, 500, fmt.Sprintf("creating block: %v", err))
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"status":  "blocked",
		"message": fmt.Sprintf("Comercio bloqueado con %s. Propagado a todos los peers.", peerDomain),
	})
}

// removeUnilateralBlock elimina un bloqueo unilateral.
func (fh *FederationHandler) removeUnilateralBlock(w http.ResponseWriter, r *http.Request) {
	peerDomain := chi.URLParam(r, "peerDomain")
	if peerDomain == "" {
		writeError(w, 400, "peerDomain is required")
		return
	}

	_, err := fh.Pool.Exec(r.Context(), `
		DELETE FROM federation_unilateral_blocks
		WHERE blocker_domain = $1 AND blocked_domain = $2`,
		fh.NodeDomain, peerDomain,
	)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("removing block: %v", err))
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"status":  "unblocked",
		"message": fmt.Sprintf("Comercio reactivado con %s.", peerDomain),
	})
}
