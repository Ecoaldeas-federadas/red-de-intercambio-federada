package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NodeDiscoveryHandler maneja el descubrimiento de nodos por gossip,
// solicitudes de federacion y el perfil publico del nodo.
type NodeDiscoveryHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func NewNodeDiscoveryHandler(pool *pgxpool.Pool, nodeDomain string) *NodeDiscoveryHandler {
	return &NodeDiscoveryHandler{Pool: pool, NodeDomain: nodeDomain}
}

func (h *NodeDiscoveryHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// === ENDPOINT PUBLICO (sin auth) - para que otros nodos descubran ===
	r.Get("/api/public/node-info", h.getPublicNodeInfo)
	r.Post("/api/public/federation-request", h.receiveFederationRequest)
	r.Post("/api/public/known-nodes-sync", h.receiveKnownNodesSync)

	// === ENDPOINTS PRIVADOS (requieren auth) ===
	r.Get("/api/nodes/discovered", h.listDiscoveredNodes)
	r.Get("/api/nodes/federated", h.listFederatedNodes)
	r.Get("/api/nodes/inactive", h.listInactiveNodes)

	if am != nil {
		r.With(am.RequirePermission("federation.change_config")).Get("/api/nodes/discovery-config", h.getDiscoveryConfig)
		r.With(am.RequirePermission("federation.change_config")).Put("/api/nodes/discovery-config", h.updateDiscoveryConfig)
		r.With(am.RequirePermission("federation.change_config")).Post("/api/nodes/federation-request", h.sendFederationRequest)
		r.With(am.RequirePermission("federation.change_config")).Get("/api/nodes/federation-requests", h.listFederationRequests)
		r.With(am.RequirePermission("federation.change_config")).Post("/api/nodes/federation-requests/{id}/respond", h.respondFederationRequest)
		r.With(am.RequirePermission("federation.change_config")).Post("/api/nodes/discovered/{domain}/check", h.checkNodeHealth)
		r.With(am.RequirePermission("federation.change_config")).Post("/api/nodes/discovered/sync-now", h.syncDiscoveryNow)
		r.With(am.RequirePermission("federation.change_config")).Delete("/api/nodes/discovered/{domain}", h.removeDiscoveredNode)
	} else {
		r.Get("/api/nodes/discovery-config", h.getDiscoveryConfig)
		r.Put("/api/nodes/discovery-config", h.updateDiscoveryConfig)
		r.Post("/api/nodes/federation-request", h.sendFederationRequest)
		r.Get("/api/nodes/federation-requests", h.listFederationRequests)
		r.Post("/api/nodes/federation-requests/{id}/respond", h.respondFederationRequest)
		r.Post("/api/nodes/discovered/{domain}/check", h.checkNodeHealth)
		r.Post("/api/nodes/discovered/sync-now", h.syncDiscoveryNow)
		r.Delete("/api/nodes/discovered/{domain}", h.removeDiscoveredNode)
	}
}

// ===== PERFIL PUBLICO DEL NODO =====

// getPublicNodeInfo devuelve informacion publica del nodo para que otros
// nodos puedan descubrirlo, ver sus reglas y solicitar federacion.
// Este endpoint es publico (sin auth) para que cualquier nodo pueda consultarlo.
func (h *NodeDiscoveryHandler) getPublicNodeInfo(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var nodeName, currencyName, appName string
	var nodeNumber *int
	_ = h.Pool.QueryRow(ctx, `
		SELECT node_name, currency_name, app_name, node_number
		FROM node_config LIMIT 1`,
	).Scan(&nodeName, &currencyName, &appName, &nodeNumber)

	// Contar miembros activos
	var memberCount int
	_ = h.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE is_active = true`).Scan(&memberCount)

	// Contar peers directos
	var peerCount int
	_ = h.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM node_federation_keys WHERE status != 'removed'`).Scan(&peerCount)

	// Contar nodos conocidos
	var knownCount int
	_ = h.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM federation_known_nodes WHERE is_inactive = false`).Scan(&knownCount)

	// Informacion de contacto para federacion
	// (por ahora usamos el dominio; en el futuro se puede configurar un email/contacto especifico)
	contactInfo := ""
	var federationContact *string
	_ = h.Pool.QueryRow(ctx, `SELECT federation_contact FROM node_config LIMIT 1`).Scan(&federationContact)
	if federationContact != nil {
		contactInfo = *federationContact
	}

	// Descripcion del nodo
	description := ""
	var desc *string
	_ = h.Pool.QueryRow(ctx, `SELECT description FROM node_config LIMIT 1`).Scan(&desc)
	if desc != nil {
		description = *desc
	}

	info := map[string]interface{}{
		"node_domain":    h.NodeDomain,
		"node_name":      nodeName,
		"app_name":       appName,
		"currency_name":  currencyName,
		"description":    description,
		"public_url":     "https://" + h.NodeDomain,
		"contact_info":   contactInfo,
		"member_count":   memberCount,
		"peer_count":     peerCount,
		"known_count":    knownCount,
		"protocol":       "fmc/1.0",
		"server_time":    time.Now().UTC().Format(time.RFC3339),
		"governance_url": "https://" + h.NodeDomain + "/p/gobernanza",
		"admission_url":  "https://" + h.NodeDomain + "/p/comunidad",
	}
	if nodeNumber != nil {
		info["node_number"] = *nodeNumber
	}

	writeJSON(w, 200, info)
}

// ===== SOLICITUDES DE FEDERACION =====

// sendFederationRequest envia una solicitud de federacion a otro nodo
// descubierto. La solicitud se envia via HTTP al endpoint publico del otro nodo.
func (h *NodeDiscoveryHandler) sendFederationRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		ToNodeDomain string `json:"to_node_domain"`
		Message      string `json:"message"`
		ContactInfo  string `json:"contact_info"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.ToNodeDomain == "" {
		writeError(w, 400, "to_node_domain is required")
		return
	}
	if req.ToNodeDomain == h.NodeDomain {
		writeError(w, 400, "no puedes enviar una solicitud a tu propio nodo")
		return
	}

	// Obtener info del nodo local
	var nodeName string
	_ = h.Pool.QueryRow(ctx, `SELECT node_name FROM node_config LIMIT 1`).Scan(&nodeName)

	// Guardar la solicitud como outgoing
	_, err := h.Pool.Exec(ctx, `
		INSERT INTO federation_requests (direction, from_node_domain, from_node_name, to_node_domain, message, contact_info, status)
		VALUES ('outgoing', $1, $2, $3, $4, $5, 'pending')
		ON CONFLICT (from_node_domain, to_node_domain, direction) DO UPDATE SET
			message = EXCLUDED.message,
			contact_info = EXCLUDED.contact_info,
			status = 'pending',
			created_at = NOW()`,
		h.NodeDomain, nodeName, req.ToNodeDomain, req.Message, req.ContactInfo)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("guardando solicitud: %v", err))
		return
	}

	// Enviar la solicitud via HTTP al endpoint publico del otro nodo
	go func() {
		url := fmt.Sprintf("https://%s/api/public/federation-request", req.ToNodeDomain)
		// Tambien intentar por http si https falla (para intranet)
		httpURL := fmt.Sprintf("http://%s/api/public/federation-request", req.ToNodeDomain)

		payload := map[string]interface{}{
			"from_node_domain": h.NodeDomain,
			"from_node_name":   nodeName,
			"to_node_domain":   req.ToNodeDomain,
			"message":          req.Message,
			"contact_info":     req.ContactInfo,
		}
		body, _ := json.Marshal(payload)

		// Intentar HTTPS primero, luego HTTP
		client := &http.Client{Timeout: 15 * time.Second}
		resp, err := client.Post(url, "application/json", strings.NewReader(string(body)))
		if err != nil {
			resp, err = client.Post(httpURL, "application/json", strings.NewReader(string(body)))
		}
		if err == nil {
			resp.Body.Close()
		}
	}()

	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Solicitud de federacion enviada a %s. El otro nodo vera tu solicitud y podra responder.", req.ToNodeDomain),
	})
}

// receiveFederationRequest recibe una solicitud de federacion de otro nodo.
// Endpoint publico (sin auth) para que cualquier nodo pueda enviar solicitudes.
func (h *NodeDiscoveryHandler) receiveFederationRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		FromNodeDomain string `json:"from_node_domain"`
		FromNodeName   string `json:"from_node_name"`
		ToNodeDomain   string `json:"to_node_domain"`
		Message        string `json:"message"`
		ContactInfo    string `json:"contact_info"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.FromNodeDomain == "" {
		writeError(w, 400, "from_node_domain is required")
		return
	}

	// Guardar como incoming
	_, err := h.Pool.Exec(ctx, `
		INSERT INTO federation_requests (direction, from_node_domain, from_node_name, to_node_domain, message, contact_info, status)
		VALUES ('incoming', $1, $2, $3, $4, $5, 'pending')
		ON CONFLICT (from_node_domain, to_node_domain, direction) DO UPDATE SET
			message = EXCLUDED.message,
			contact_info = EXCLUDED.contact_info,
			status = 'pending',
			created_at = NOW()`,
		req.FromNodeDomain, req.FromNodeName, h.NodeDomain, req.Message, req.ContactInfo)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("guardando solicitud recibida: %v", err))
		return
	}

	// Tambien agregar el nodo a known_nodes si no existe
	_, _ = h.Pool.Exec(ctx, `
		INSERT INTO federation_known_nodes (node_domain, node_name, is_direct_peer, is_expelled, is_inactive, discovered_via, discovered_at, last_seen)
		VALUES ($1, $2, false, false, false, 'federation_request', NOW(), NOW())
		ON CONFLICT (node_domain) DO UPDATE SET last_seen = NOW()`,
		req.FromNodeDomain, req.FromNodeName)

	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"message": "Solicitud recibida. El administrador del nodo la revisara.",
	})
}

// listFederationRequests lista las solicitudes de federacion (incoming y outgoing)
func (h *NodeDiscoveryHandler) listFederationRequests(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	direction := r.URL.Query().Get("direction")
	if direction == "" {
		direction = "all"
	}

	query := `SELECT id, direction, from_node_domain, COALESCE(from_node_name,''), to_node_domain,
	          COALESCE(message,''), COALESCE(contact_info,''), status,
	          COALESCE(response_message,''), COALESCE(response_contact,''), COALESCE(response_public_key,''),
	          created_at, COALESCE(responded_at::TEXT,'')
	          FROM federation_requests`
	if direction != "all" {
		query += ` WHERE direction = $1 ORDER BY created_at DESC`
		rows, err := h.Pool.Query(ctx, query, direction)
		if err != nil {
			writeJSON(w, 200, []interface{}{})
			return
		}
		defer rows.Close()
		requests := []map[string]interface{}{}
		for rows.Next() {
			requests = append(requests, scanFederationRequest(rows))
		}
		writeJSON(w, 200, map[string]interface{}{"requests": requests})
		return
	}

	query += ` ORDER BY created_at DESC`
	rows, err := h.Pool.Query(ctx, query)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()
	requests := []map[string]interface{}{}
	for rows.Next() {
		requests = append(requests, scanFederationRequest(rows))
	}
	writeJSON(w, 200, map[string]interface{}{"requests": requests})
}

// respondFederationRequest responde a una solicitud de federacion recibida
func (h *NodeDiscoveryHandler) respondFederationRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	requestID := chi.URLParam(r, "id")

	var req struct {
		Status           string `json:"status"` // accepted o rejected
		ResponseMessage  string `json:"response_message"`
		ResponseContact  string `json:"response_contact"`
		ResponsePublicKey string `json:"response_public_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Status != "accepted" && req.Status != "rejected" {
		writeError(w, 400, "status must be 'accepted' or 'rejected'")
		return
	}

	// Actualizar la solicitud
	_, err := h.Pool.Exec(ctx, `
		UPDATE federation_requests SET
			status = $1, response_message = $2, response_contact = $3,
			response_public_key = $4, responded_at = NOW()
		WHERE id = $5 AND direction = 'incoming'`,
		req.Status, req.ResponseMessage, req.ResponseContact, req.ResponsePublicKey, requestID)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("actualizando solicitud: %v", err))
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Solicitud %s", req.Status),
	})
}

// ===== NODOS DESCUBIERTOS =====

// listDiscoveredNodes lista todos los nodos descubiertos (no solo peers directos)
func (h *NodeDiscoveryHandler) listDiscoveredNodes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Asegurar que este nodo y sus peers estan en la lista
	h.ensureSelfAndPeers(ctx)

	rows, err := h.Pool.Query(ctx, `
		SELECT n.node_domain, COALESCE(n.node_name,''), n.is_direct_peer, n.is_expelled, n.is_inactive,
		       COALESCE(n.node_number,0), COALESCE(n.discovered_via,''),
		       COALESCE(n.last_seen::TEXT,''), n.discovered_at,
		       COALESCE(n.description,''), COALESCE(n.public_url,''),
		       COALESCE(n.contact_info,''), COALESCE(n.node_type,''),
		       COALESCE(n.last_checked::TEXT,''), n.failed_checks,
		       CASE WHEN e.node_domain IS NOT NULL THEN true ELSE false END as is_expelled_now
		FROM federation_known_nodes n
		LEFT JOIN federation_expelled_nodes e ON e.node_domain = n.node_domain
		WHERE n.is_inactive = false
		ORDER BY n.is_direct_peer DESC, n.node_domain`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	nodes := []map[string]interface{}{}
	for rows.Next() {
		var domain, name, discoveredVia, lastSeen, discoveredAt, description, publicURL, contactInfo, nodeType, lastChecked string
		var isDirectPeer, isExpelled, isInactive, isExpelledNow bool
		var nodeNumber, failedChecks int
		if err := rows.Scan(&domain, &name, &isDirectPeer, &isExpelled, &isInactive,
			&nodeNumber, &discoveredVia, &lastSeen, &discoveredAt,
			&description, &publicURL, &contactInfo, &nodeType,
			&lastChecked, &failedChecks, &isExpelledNow); err != nil {
			continue
		}
		node := map[string]interface{}{
			"node_domain":    domain,
			"node_name":      name,
			"is_direct_peer": isDirectPeer,
			"is_expelled":    isExpelledNow,
			"is_inactive":    isInactive,
			"is_this_node":   domain == h.NodeDomain,
			"node_number":    nodeNumber,
			"discovered_via": discoveredVia,
			"discovered_at":  discoveredAt,
			"description":    description,
			"public_url":     publicURL,
			"contact_info":   contactInfo,
			"node_type":      nodeType,
			"failed_checks":  failedChecks,
		}
		if lastSeen != "" {
			node["last_seen"] = lastSeen
		}
		if lastChecked != "" {
			node["last_checked"] = lastChecked
		}
		nodes = append(nodes, node)
	}
	writeJSON(w, 200, map[string]interface{}{"discovered_nodes": nodes})
}

// listFederatedNodes lista solo los peers directos (federados)
func (h *NodeDiscoveryHandler) listFederatedNodes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := h.Pool.Query(ctx, `
		SELECT peer_domain, status, created_at FROM node_federation_keys
		WHERE status != 'removed' ORDER BY created_at DESC`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()
	nodes := []map[string]interface{}{}
	for rows.Next() {
		var domain, status, createdAt string
		_ = rows.Scan(&domain, &status, &createdAt)
		nodes = append(nodes, map[string]interface{}{
			"node_domain": domain,
			"status":      status,
			"created_at":  createdAt,
		})
	}
	writeJSON(w, 200, map[string]interface{}{"federated_nodes": nodes})
}

// listInactiveNodes lista los nodos marcados como inactivos
func (h *NodeDiscoveryHandler) listInactiveNodes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := h.Pool.Query(ctx, `
		SELECT node_domain, COALESCE(node_name,''), COALESCE(last_seen::TEXT,''),
		       COALESCE(last_checked::TEXT,''), failed_checks, discovered_at
		FROM federation_known_nodes WHERE is_inactive = true
		ORDER BY last_checked DESC`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()
	nodes := []map[string]interface{}{}
	for rows.Next() {
		var domain, name, lastSeen, lastChecked, discoveredAt string
		var failedChecks int
		_ = rows.Scan(&domain, &name, &lastSeen, &lastChecked, &failedChecks, &discoveredAt)
		node := map[string]interface{}{
			"node_domain":   domain,
			"node_name":     name,
			"failed_checks": failedChecks,
			"discovered_at": discoveredAt,
		}
		if lastSeen != "" {
			node["last_seen"] = lastSeen
		}
		if lastChecked != "" {
			node["last_checked"] = lastChecked
		}
		nodes = append(nodes, node)
	}
	writeJSON(w, 200, map[string]interface{}{"inactive_nodes": nodes})
}

// ===== CONFIG DE DESCUBRIMIENTO =====

func (h *NodeDiscoveryHandler) getDiscoveryConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	cfg := map[string]interface{}{
		"node_domain":                     h.NodeDomain,
		"discovery_interval_hours":        24,
		"health_check_interval_hours":     168,
		"inactive_cleanup_interval_days":  365,
		"max_failed_checks":               3,
		"last_discovery_sync":             nil,
		"last_health_check":               nil,
		"last_inactive_cleanup":           nil,
	}

	var discoveryInt, healthInt, cleanupInt, maxFailed int
	var lastSync, lastCheck, lastCleanup *time.Time
	err := h.Pool.QueryRow(ctx, `
		SELECT discovery_interval_hours, health_check_interval_hours,
		       inactive_cleanup_interval_days, max_failed_checks,
		       last_discovery_sync, last_health_check, last_inactive_cleanup
		FROM node_discovery_config WHERE node_domain = $1`, h.NodeDomain,
	).Scan(&discoveryInt, &healthInt, &cleanupInt, &maxFailed, &lastSync, &lastCheck, &lastCleanup)
	if err == nil {
		cfg["discovery_interval_hours"] = discoveryInt
		cfg["health_check_interval_hours"] = healthInt
		cfg["inactive_cleanup_interval_days"] = cleanupInt
		cfg["max_failed_checks"] = maxFailed
		if lastSync != nil {
			cfg["last_discovery_sync"] = lastSync.Format(time.RFC3339)
		}
		if lastCheck != nil {
			cfg["last_health_check"] = lastCheck.Format(time.RFC3339)
		}
		if lastCleanup != nil {
			cfg["last_inactive_cleanup"] = lastCleanup.Format(time.RFC3339)
		}
	}

	writeJSON(w, 200, cfg)
}

func (h *NodeDiscoveryHandler) updateDiscoveryConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		DiscoveryIntervalHours       *int `json:"discovery_interval_hours"`
		HealthCheckIntervalHours     *int `json:"health_check_interval_hours"`
		InactiveCleanupIntervalDays  *int `json:"inactive_cleanup_interval_days"`
		MaxFailedChecks              *int `json:"max_failed_checks"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Valores actales o defaults
	discoveryInt := 24
	healthInt := 168
	cleanupInt := 365
	maxFailed := 3
	if req.DiscoveryIntervalHours != nil {
		discoveryInt = *req.DiscoveryIntervalHours
	}
	if req.HealthCheckIntervalHours != nil {
		healthInt = *req.HealthCheckIntervalHours
	}
	if req.InactiveCleanupIntervalDays != nil {
		cleanupInt = *req.InactiveCleanupIntervalDays
	}
	if req.MaxFailedChecks != nil {
		maxFailed = *req.MaxFailedChecks
	}

	_, err := h.Pool.Exec(ctx, `
		INSERT INTO node_discovery_config (node_domain, discovery_interval_hours, health_check_interval_hours,
		  inactive_cleanup_interval_days, max_failed_checks, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (node_domain) DO UPDATE SET
		  discovery_interval_hours = EXCLUDED.discovery_interval_hours,
		  health_check_interval_hours = EXCLUDED.health_check_interval_hours,
		  inactive_cleanup_interval_days = EXCLUDED.inactive_cleanup_interval_days,
		  max_failed_checks = EXCLUDED.max_failed_checks,
		  updated_at = NOW()`,
		h.NodeDomain, discoveryInt, healthInt, cleanupInt, maxFailed)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("actualizando config: %v", err))
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"message": "Configuracion de descubrimiento actualizada",
	})
}

// ===== SINCRONIZACION GOSSIP =====

// receiveKnownNodesSync recibe la lista de nodos conocidos de otro nodo.
// Endpoint publico (sin auth) para que cualquier nodo pueda compartir su lista.
func (h *NodeDiscoveryHandler) receiveKnownNodesSync(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		FromNode string        `json:"from_node"`
		Nodes    []KnownNodeInfo `json:"nodes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.FromNode == "" {
		writeError(w, 400, "from_node is required")
		return
	}

	// Agregar el nodo que envia como conocido
	_, _ = h.Pool.Exec(ctx, `
		INSERT INTO federation_known_nodes (node_domain, is_direct_peer, is_expelled, is_inactive, discovered_via, last_seen)
		VALUES ($1, false, false, false, 'gossip', NOW())
		ON CONFLICT (node_domain) DO UPDATE SET last_seen = NOW()`,
		req.FromNode)

	// Agregar los nodos que el otro nodo conoce
	for _, n := range req.Nodes {
		if n.Domain == "" || n.Domain == h.NodeDomain {
			continue
		}
		_, _ = h.Pool.Exec(ctx, `
			INSERT INTO federation_known_nodes (node_domain, node_name, is_direct_peer, is_expelled, is_inactive,
			  discovered_via, last_seen, description, public_url, contact_info, node_type)
			VALUES ($1, $2, false, $3, false, $4, NOW(), $5, $6, $7, $8)
			ON CONFLICT (node_domain) DO UPDATE SET
			  node_name = COALESCE(EXCLUDED.node_name, federation_known_nodes.node_name),
			  is_expelled = EXCLUDED.is_expelled,
			  description = COALESCE(EXCLUDED.description, federation_known_nodes.description),
			  public_url = COALESCE(EXCLUDED.public_url, federation_known_nodes.public_url),
			  contact_info = COALESCE(EXCLUDED.contact_info, federation_known_nodes.contact_info),
			  node_type = COALESCE(EXCLUDED.node_type, federation_known_nodes.node_type),
			  last_seen = NOW()`,
			n.Domain, n.Name, n.IsExpelled, "gossip:"+req.FromNode,
			n.Description, n.PublicURL, n.ContactInfo, n.NodeType)
	}

	writeJSON(w, 200, map[string]interface{}{
		"success":     true,
		"received":    len(req.Nodes),
		"from_node":   req.FromNode,
	})
}

// syncDiscoveryNow fuerza una sincronizacion inmediata de la lista de nodos
// con todos los peers directos conocidos
func (h *NodeDiscoveryHandler) syncDiscoveryNow(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Obtener nuestra lista de nodos conocidos
	ourNodes := h.getKnownNodesList(ctx)

	// Obtener peers directos
	rows, err := h.Pool.Query(ctx, `
		SELECT peer_domain FROM node_federation_keys WHERE status != 'removed'`)
	if err != nil {
		writeError(w, 500, "error obteniendo peers")
		return
	}
	defer rows.Close()

	peers := []string{}
	for rows.Next() {
		var domain string
		_ = rows.Scan(&domain)
		peers = append(peers, domain)
	}

	// Enviar nuestra lista a cada peer
	sent := 0
	for _, peer := range peers {
		if h.sendKnownNodesToPeer(ctx, peer, ourNodes) {
			sent++
		}
	}

	// Actualizar timestamp
	_, _ = h.Pool.Exec(ctx, `
		UPDATE node_discovery_config SET last_discovery_sync = NOW()
		WHERE node_domain = $1`, h.NodeDomain)

	writeJSON(w, 200, map[string]interface{}{
		"success":  true,
		"sent_to":  sent,
		"total_peers": len(peers),
		"message": fmt.Sprintf("Lista de %d nodos enviada a %d peers", len(ourNodes), sent),
	})
}

// checkNodeHealth verifica si un nodo descubierto esta activo
// haciendo una peticion HTTP a su endpoint /api/public/node-info
func (h *NodeDiscoveryHandler) checkNodeHealth(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	domain := chi.URLParam(r, "domain")
	if domain == "" {
		writeError(w, 400, "domain is required")
		return
	}

	active := h.checkNodeActive(ctx, domain)

	if active {
		// Reset failed checks
		_, _ = h.Pool.Exec(ctx, `
			UPDATE federation_known_nodes SET
				is_inactive = false, failed_checks = 0, last_checked = NOW(), last_seen = NOW()
			WHERE node_domain = $1`, domain)
		writeJSON(w, 200, map[string]interface{}{
			"success": true,
			"active":  true,
			"message": fmt.Sprintf("Nodo %s esta activo", domain),
		})
	} else {
		// Increment failed checks
		var failedChecks, maxFailed int
		_ = h.Pool.QueryRow(ctx, `SELECT failed_checks FROM federation_known_nodes WHERE node_domain = $1`, domain).Scan(&failedChecks)
		maxFailed = 3
		_ = h.Pool.QueryRow(ctx, `SELECT max_failed_checks FROM node_discovery_config WHERE node_domain = $1`, h.NodeDomain).Scan(&maxFailed)
		if maxFailed == 0 {
			maxFailed = 3
		}

		failedChecks++
		isInactive := failedChecks >= maxFailed
		_, _ = h.Pool.Exec(ctx, `
			UPDATE federation_known_nodes SET
				failed_checks = $1, last_checked = NOW(), is_inactive = $2
			WHERE node_domain = $3`, failedChecks, isInactive, domain)

		writeJSON(w, 200, map[string]interface{}{
			"success":       true,
			"active":        false,
			"failed_checks": failedChecks,
			"is_inactive":   isInactive,
			"message":       fmt.Sprintf("Nodo %s no responde (intentos fallidos: %d)", domain, failedChecks),
		})
	}
}

// removeDiscoveredNode elimina un nodo de la lista de descubiertos
func (h *NodeDiscoveryHandler) removeDiscoveredNode(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	domain := chi.URLParam(r, "domain")
	if domain == "" {
		writeError(w, 400, "domain is required")
		return
	}
	if domain == h.NodeDomain {
		writeError(w, 400, "no puedes eliminar tu propio nodo")
		return
	}

	_, err := h.Pool.Exec(ctx, `DELETE FROM federation_known_nodes WHERE node_domain = $1 AND is_direct_peer = false`, domain)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("eliminando nodo: %v", err))
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Nodo %s eliminado de la lista de descubiertos", domain),
	})
}

// ===== HELPERS =====

type KnownNodeInfo struct {
	Domain       string `json:"domain"`
	Name         string `json:"name"`
	IsExpelled   bool   `json:"is_expelled"`
	Description  string `json:"description"`
	PublicURL    string `json:"public_url"`
	ContactInfo  string `json:"contact_info"`
	NodeType     string `json:"node_type"`
}

func (h *NodeDiscoveryHandler) getKnownNodesList(ctx context.Context) []KnownNodeInfo {
	rows, err := h.Pool.Query(ctx, `
		SELECT node_domain, COALESCE(node_name,''), is_expelled, COALESCE(description,''),
		       COALESCE(public_url,''), COALESCE(contact_info,''), COALESCE(node_type,'')
		FROM federation_known_nodes WHERE is_inactive = false`)
	if err != nil {
		return []KnownNodeInfo{}
	}
	defer rows.Close()

	nodes := []KnownNodeInfo{}
	for rows.Next() {
		var n KnownNodeInfo
		_ = rows.Scan(&n.Domain, &n.Name, &n.IsExpelled, &n.Description, &n.PublicURL, &n.ContactInfo, &n.NodeType)
		nodes = append(nodes, n)
	}
	return nodes
}

func (h *NodeDiscoveryHandler) sendKnownNodesToPeer(ctx context.Context, peerDomain string, nodes []KnownNodeInfo) bool {
	payload := map[string]interface{}{
		"from_node": h.NodeDomain,
		"nodes":     nodes,
	}
	body, _ := json.Marshal(payload)

	client := &http.Client{Timeout: 15 * time.Second}
	url := fmt.Sprintf("https://%s/api/public/known-nodes-sync", peerDomain)
	resp, err := client.Post(url, "application/json", strings.NewReader(string(body)))
	if err != nil {
		// Intentar HTTP para intranet
		httpURL := fmt.Sprintf("http://%s/api/public/known-nodes-sync", peerDomain)
		resp, err = client.Post(httpURL, "application/json", strings.NewReader(string(body)))
		if err != nil {
			return false
		}
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)
	return resp.StatusCode == 200
}

func (h *NodeDiscoveryHandler) checkNodeActive(ctx context.Context, domain string) bool {
	client := &http.Client{Timeout: 10 * time.Second}
	urls := []string{
		fmt.Sprintf("https://%s/api/public/node-info", domain),
		fmt.Sprintf("http://%s/api/public/node-info", domain),
	}
	for _, url := range urls {
		resp, err := client.Get(url)
		if err == nil {
			defer resp.Body.Close()
			io.Copy(io.Discard, resp.Body)
			return resp.StatusCode == 200
		}
	}
	return false
}

func (h *NodeDiscoveryHandler) ensureSelfAndPeers(ctx context.Context) {
	// Este nodo siempre es conocido
	_, _ = h.Pool.Exec(ctx, `
		INSERT INTO federation_known_nodes (node_domain, is_direct_peer, is_expelled, is_inactive, discovered_at, last_seen)
		VALUES ($1, true, false, false, NOW(), NOW())
		ON CONFLICT (node_domain) DO UPDATE SET is_direct_peer = true, last_seen = NOW()`,
		h.NodeDomain)

	// Peers directos tambien son conocidos
	_, _ = h.Pool.Exec(ctx, `
		INSERT INTO federation_known_nodes (node_domain, is_direct_peer, is_expelled, is_inactive, discovered_at, last_seen)
		SELECT peer_domain, true, false, false, NOW(), NOW()
		FROM node_federation_keys WHERE status != 'removed'
		ON CONFLICT (node_domain) DO UPDATE SET is_direct_peer = true, last_seen = NOW()`)
}

// scanFederationRequest escanea una fila de federation_requests
func scanFederationRequest(rows interface{ Scan(...interface{}) error }) map[string]interface{} {
	var id, direction, fromDomain, fromName, toDomain, message, contactInfo, status, responseMsg, responseContact, responseKey, createdAt, respondedAt string
	if err := rows.Scan(&id, &direction, &fromDomain, &fromName, &toDomain,
		&message, &contactInfo, &status, &responseMsg, &responseContact, &responseKey,
		&createdAt, &respondedAt); err != nil {
		return nil
	}
	req := map[string]interface{}{
		"id":                 id,
		"direction":          direction,
		"from_node_domain":   fromDomain,
		"from_node_name":     fromName,
		"to_node_domain":     toDomain,
		"message":            message,
		"contact_info":       contactInfo,
		"status":             status,
		"response_message":   responseMsg,
		"response_contact":   responseContact,
		"response_public_key": responseKey,
		"created_at":         createdAt,
	}
	if respondedAt != "" {
		req["responded_at"] = respondedAt
	}
	return req
}
