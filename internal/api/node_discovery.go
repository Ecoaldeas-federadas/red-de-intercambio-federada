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
// solicitudes de contacto (NO federacion automatica) y verificacion
// de salud por consenso entre nodos.
//
// IMPORTANTE: La federacion NO se hace aceptando/rechazando en el sistema.
// La clave publica se comparte personalmente entre personas, no por el sistema.
// El sistema solo muestra info de contacto (pais, ubicacion, gobernanza, web)
// para que la gente se contacte fisicamente.
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
	r.Post("/api/public/contact-request", h.receiveContactRequest)
	r.Post("/api/public/known-nodes-sync", h.receiveKnownNodesSync)
	r.Post("/api/public/health-report", h.receiveHealthReport)
	r.Get("/api/public/health-reports/{target}", h.getHealthReports)

	// === ENDPOINTS PRIVADOS (requieren auth) ===
	r.Get("/api/nodes/discovered", h.listDiscoveredNodes)
	r.Get("/api/nodes/federated", h.listFederatedNodes)
	r.Get("/api/nodes/inactive", h.listInactiveNodes)

	if am != nil {
		r.With(am.RequirePermission("federation.change_config")).Get("/api/nodes/discovery-config", h.getDiscoveryConfig)
		r.With(am.RequirePermission("federation.change_config")).Put("/api/nodes/discovery-config", h.updateDiscoveryConfig)
		r.With(am.RequirePermission("federation.change_config")).Post("/api/nodes/contact-request", h.sendContactRequest)
		r.With(am.RequirePermission("federation.change_config")).Get("/api/nodes/contact-requests", h.listContactRequests)
		r.With(am.RequirePermission("federation.change_config")).Post("/api/nodes/contact-requests/{id}/respond", h.respondContactRequest)
		r.With(am.RequirePermission("federation.change_config")).Post("/api/nodes/discovered/{domain}/check", h.checkNodeHealth)
		r.With(am.RequirePermission("federation.change_config")).Post("/api/nodes/discovered/consensus-check", h.consensusCheckInactive)
		r.With(am.RequirePermission("federation.change_config")).Post("/api/nodes/discovered/sync-now", h.syncDiscoveryNow)
		r.With(am.RequirePermission("federation.change_config")).Delete("/api/nodes/discovered/{domain}", h.removeDiscoveredNode)
	} else {
		r.Get("/api/nodes/discovery-config", h.getDiscoveryConfig)
		r.Put("/api/nodes/discovery-config", h.updateDiscoveryConfig)
		r.Post("/api/nodes/contact-request", h.sendContactRequest)
		r.Get("/api/nodes/contact-requests", h.listContactRequests)
		r.Post("/api/nodes/contact-requests/{id}/respond", h.respondContactRequest)
		r.Post("/api/nodes/discovered/{domain}/check", h.checkNodeHealth)
		r.Post("/api/nodes/discovered/consensus-check", h.consensusCheckInactive)
		r.Post("/api/nodes/discovered/sync-now", h.syncDiscoveryNow)
		r.Delete("/api/nodes/discovered/{domain}", h.removeDiscoveredNode)
	}
}

// ===== PERFIL PUBLICO DEL NODO =====

// getPublicNodeInfo devuelve informacion publica del nodo para que otros
// nodos puedan descubrirlo, ver de que trata, donde esta, sus reglas
// y como contactar. NO incluye claves publicas.
func (h *NodeDiscoveryHandler) getPublicNodeInfo(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var nodeName, currencyName, appName, description, country, location, contactInfo string
	var nodeNumber *int
	_ = h.Pool.QueryRow(ctx, `
		SELECT node_name, currency_name, app_name,
		       COALESCE(description,''), COALESCE(country,''), COALESCE(location,''),
		       COALESCE(federation_contact,''), node_number
		FROM node_config LIMIT 1`,
	).Scan(&nodeName, &currencyName, &appName, &description, &country, &location, &contactInfo, &nodeNumber)

	// Contar miembros activos
	var memberCount int
	_ = h.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE is_active = true`).Scan(&memberCount)

	// Contar peers directos
	var peerCount int
	_ = h.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM node_federation_keys WHERE status != 'removed'`).Scan(&peerCount)

	// Contar nodos conocidos
	var knownCount int
	_ = h.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM federation_known_nodes WHERE is_inactive = false`).Scan(&knownCount)

	info := map[string]interface{}{
		"node_domain":    h.NodeDomain,
		"node_name":      nodeName,
		"app_name":       appName,
		"currency_name":  currencyName,
		"description":    description,
		"country":        country,
		"location":       location,
		"public_url":     "https://" + h.NodeDomain,
		"contact_info":   contactInfo,
		"member_count":   memberCount,
		"peer_count":     peerCount,
		"known_count":    knownCount,
		"protocol":       "fmc/1.0",
		"server_time":    time.Now().UTC().Format(time.RFC3339),
		"governance_url": "https://" + h.NodeDomain + "/p/gobernanza",
		"admission_url":  "https://" + h.NodeDomain + "/p/comunidad",
		// NOTA: No se incluye la clave publica aqui.
		// La clave publica se comparte personalmente entre personas,
		// no automaticamente por el sistema.
	}
	if nodeNumber != nil {
		info["node_number"] = *nodeNumber
	}

	writeJSON(w, 200, info)
}

// ===== SOLICITUDES DE CONTACTO (NO federacion automatica) =====

// sendContactRequest envia una solicitud de contacto a otro nodo descubierto.
// Esto NO feder automaticamente. Solo expresa interes y comparte info
// de contacto para que la gente se comunique personalmente.
func (h *NodeDiscoveryHandler) sendContactRequest(w http.ResponseWriter, r *http.Request) {
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
	var nodeName, country, location string
	_ = h.Pool.QueryRow(ctx, `SELECT node_name, COALESCE(country,''), COALESCE(location,'') FROM node_config LIMIT 1`).Scan(&nodeName, &country, &location)

	// Guardar la solicitud como outgoing
	_, err := h.Pool.Exec(ctx, `
		INSERT INTO federation_requests (direction, from_node_domain, from_node_name, to_node_domain, message, contact_info, status, from_country, from_location, from_governance_url)
		VALUES ('outgoing', $1, $2, $3, $4, $5, 'pending', $6, $7, $8)
		ON CONFLICT (from_node_domain, to_node_domain, direction) DO UPDATE SET
			message = EXCLUDED.message,
			contact_info = EXCLUDED.contact_info,
			from_country = EXCLUDED.from_country,
			from_location = EXCLUDED.from_location,
			from_governance_url = EXCLUDED.from_governance_url,
			status = 'pending',
			created_at = NOW()`,
		h.NodeDomain, nodeName, req.ToNodeDomain, req.Message, req.ContactInfo,
		country, location, "https://"+h.NodeDomain+"/p/gobernanza")
	if err != nil {
		writeError(w, 500, fmt.Sprintf("guardando solicitud: %v", err))
		return
	}

	// Enviar la solicitud via HTTP al endpoint publico del otro nodo
	go func() {
		payload := map[string]interface{}{
			"from_node_domain":    h.NodeDomain,
			"from_node_name":      nodeName,
			"from_country":        country,
			"from_location":       location,
			"from_governance_url": "https://" + h.NodeDomain + "/p/gobernanza",
			"to_node_domain":      req.ToNodeDomain,
			"message":             req.Message,
			"contact_info":        req.ContactInfo,
		}
		body, _ := json.Marshal(payload)

		client := &http.Client{Timeout: 15 * time.Second}
		for _, scheme := range []string{"https", "http"} {
			url := fmt.Sprintf("%s://%s/api/public/contact-request", scheme, req.ToNodeDomain)
			resp, err := client.Post(url, "application/json", strings.NewReader(string(body)))
			if err == nil {
				resp.Body.Close()
				break
			}
		}
	}()

	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Solicitud de contacto enviada a %s. Esto NO federa automaticamente. El otro nodo vera tu informacion de contacto y podra comunicarse personalmente para federar.", req.ToNodeDomain),
	})
}

// receiveContactRequest recibe una solicitud de contacto de otro nodo.
// Endpoint publico (sin auth). NO federa automaticamente.
func (h *NodeDiscoveryHandler) receiveContactRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		FromNodeDomain    string `json:"from_node_domain"`
		FromNodeName      string `json:"from_node_name"`
		FromCountry       string `json:"from_country"`
		FromLocation      string `json:"from_location"`
		FromGovernanceURL string `json:"from_governance_url"`
		ToNodeDomain      string `json:"to_node_domain"`
		Message           string `json:"message"`
		ContactInfo       string `json:"contact_info"`
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
		INSERT INTO federation_requests (direction, from_node_domain, from_node_name, to_node_domain, message, contact_info, status, from_country, from_location, from_governance_url)
		VALUES ('incoming', $1, $2, $3, $4, $5, 'pending', $6, $7, $8)
		ON CONFLICT (from_node_domain, to_node_domain, direction) DO UPDATE SET
			message = EXCLUDED.message,
			contact_info = EXCLUDED.contact_info,
			from_country = EXCLUDED.from_country,
			from_location = EXCLUDED.from_location,
			from_governance_url = EXCLUDED.from_governance_url,
			status = 'pending',
			created_at = NOW()`,
		req.FromNodeDomain, req.FromNodeName, h.NodeDomain, req.Message, req.ContactInfo,
		req.FromCountry, req.FromLocation, req.FromGovernanceURL)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("guardando solicitud recibida: %v", err))
		return
	}

	// Tambien agregar el nodo a known_nodes si no existe
	_, _ = h.Pool.Exec(ctx, `
		INSERT INTO federation_known_nodes (node_domain, node_name, is_direct_peer, is_expelled, is_inactive, discovered_via, discovered_at, last_seen, country, location, governance_url)
		VALUES ($1, $2, false, false, false, 'contact_request', NOW(), NOW(), $3, $4, $5)
		ON CONFLICT (node_domain) DO UPDATE SET last_seen = NOW(),
			country = COALESCE(EXCLUDED.country, federation_known_nodes.country),
			location = COALESCE(EXCLUDED.location, federation_known_nodes.location),
			governance_url = COALESCE(EXCLUDED.governance_url, federation_known_nodes.governance_url)`,
		req.FromNodeDomain, req.FromNodeName, req.FromCountry, req.FromLocation, req.FromGovernanceURL)

	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"message": "Solicitud de contacto recibida. La federacion se hace personalmente compartiendo las claves publicas, no automaticamente.",
	})
}

// listContactRequests lista las solicitudes de contacto (incoming y outgoing)
func (h *NodeDiscoveryHandler) listContactRequests(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	direction := r.URL.Query().Get("direction")
	if direction == "" {
		direction = "all"
	}

	query := `SELECT id, direction, from_node_domain, COALESCE(from_node_name,''), to_node_domain,
	          COALESCE(message,''), COALESCE(contact_info,''), status,
	          COALESCE(response_message,''), COALESCE(response_contact,''),
	          COALESCE(from_country,''), COALESCE(from_location,''), COALESCE(from_governance_url,''),
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
			requests = append(requests, scanContactRequest(rows))
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
		requests = append(requests, scanContactRequest(rows))
	}
	writeJSON(w, 200, map[string]interface{}{"requests": requests})
}

// respondContactRequest responde a una solicitud de contacto recibida.
// NO federa automaticamente. Solo envia un mensaje de respuesta
// con informacion de contacto para que la gente se comunique personalmente.
func (h *NodeDiscoveryHandler) respondContactRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	requestID := chi.URLParam(r, "id")

	var req struct {
		Status          string `json:"status"` // interested o not_interested
		ResponseMessage string `json:"response_message"`
		ResponseContact string `json:"response_contact"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Status != "interested" && req.Status != "not_interested" {
		writeError(w, 400, "status must be 'interested' or 'not_interested'")
		return
	}

	_, err := h.Pool.Exec(ctx, `
		UPDATE federation_requests SET
			status = $1, response_message = $2, response_contact = $3, responded_at = NOW()
		WHERE id = $4 AND direction = 'incoming'`,
		req.Status, req.ResponseMessage, req.ResponseContact, requestID)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("actualizando solicitud: %v", err))
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Respuesta enviada. Recuerda: la federacion se hace personalmente compartiendo las claves publicas, no automaticamente por el sistema."),
	})
}

// ===== NODOS DESCUBIERTOS =====

// listDiscoveredNodes lista todos los nodos descubiertos activos
// (no muestra inactivos - los inactivos se mantienen internamente)
func (h *NodeDiscoveryHandler) listDiscoveredNodes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	h.ensureSelfAndPeers(ctx)

	rows, err := h.Pool.Query(ctx, `
		SELECT n.node_domain, COALESCE(n.node_name,''), n.is_direct_peer, n.is_expelled, n.is_inactive,
		       COALESCE(n.node_number,0), COALESCE(n.discovered_via,''),
		       COALESCE(n.last_seen::TEXT,''), n.discovered_at,
		       COALESCE(n.description,''), COALESCE(n.public_url,''),
		       COALESCE(n.contact_info,''), COALESCE(n.node_type,''),
		       COALESCE(n.country,''), COALESCE(n.location,''),
		       COALESCE(n.governance_url,''), COALESCE(n.admission_url,''),
		       COALESCE(n.member_count,0), COALESCE(n.peer_count,0),
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
		var domain, name, discoveredVia, lastSeen, discoveredAt, description, publicURL, contactInfo, nodeType, country, location, governanceURL, admissionURL, lastChecked string
		var isDirectPeer, isExpelled, isInactive, isExpelledNow bool
		var nodeNumber, failedChecks, memberCount, peerCount int
		if err := rows.Scan(&domain, &name, &isDirectPeer, &isExpelled, &isInactive,
			&nodeNumber, &discoveredVia, &lastSeen, &discoveredAt,
			&description, &publicURL, &contactInfo, &nodeType,
			&country, &location, &governanceURL, &admissionURL,
			&memberCount, &peerCount,
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
			"country":        country,
			"location":       location,
			"governance_url": governanceURL,
			"admission_url":  admissionURL,
			"member_count":   memberCount,
			"peer_count":     peerCount,
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

// listFederatedNodes lista los peers directos (federados) con estado online/offline
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
		// Verificar si esta online ahora
		online := h.checkNodeActive(ctx, domain)
		nodes = append(nodes, map[string]interface{}{
			"node_domain": domain,
			"status":      status,
			"online":      online,
			"created_at":  createdAt,
		})
	}
	writeJSON(w, 200, map[string]interface{}{"federated_nodes": nodes})
}

// listInactiveNodes lista los nodos marcados como inactivos por consenso
// (solo visible para admins, no para el publico)
func (h *NodeDiscoveryHandler) listInactiveNodes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := h.Pool.Query(ctx, `
		SELECT node_domain, COALESCE(node_name,''), COALESCE(last_seen::TEXT,''),
		       COALESCE(last_checked::TEXT,''), failed_checks, discovered_at,
		       COALESCE(country,''), COALESCE(location,'')
		FROM federation_known_nodes WHERE is_inactive = true
		ORDER BY last_checked DESC`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()
	nodes := []map[string]interface{}{}
	for rows.Next() {
		var domain, name, lastSeen, lastChecked, discoveredAt, country, location string
		var failedChecks int
		_ = rows.Scan(&domain, &name, &lastSeen, &lastChecked, &failedChecks, &discoveredAt, &country, &location)
		node := map[string]interface{}{
			"node_domain":   domain,
			"node_name":     name,
			"failed_checks": failedChecks,
			"discovered_at": discoveredAt,
			"country":       country,
			"location":      location,
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
		"node_domain":                    h.NodeDomain,
		"discovery_interval_hours":       24,
		"health_check_interval_hours":    168,
		"inactive_cleanup_interval_days": 365,
		"max_failed_checks":              3,
		"last_discovery_sync":            nil,
		"last_health_check":              nil,
		"last_inactive_cleanup":          nil,
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
		DiscoveryIntervalHours      *int `json:"discovery_interval_hours"`
		HealthCheckIntervalHours    *int `json:"health_check_interval_hours"`
		InactiveCleanupIntervalDays *int `json:"inactive_cleanup_interval_days"`
		MaxFailedChecks             *int `json:"max_failed_checks"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

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
func (h *NodeDiscoveryHandler) receiveKnownNodesSync(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		FromNode string          `json:"from_node"`
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
			  discovered_via, last_seen, description, public_url, contact_info, node_type, country, location, governance_url)
			VALUES ($1, $2, false, $3, false, $4, NOW(), $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (node_domain) DO UPDATE SET
			  node_name = COALESCE(EXCLUDED.node_name, federation_known_nodes.node_name),
			  is_expelled = EXCLUDED.is_expelled,
			  description = COALESCE(EXCLUDED.description, federation_known_nodes.description),
			  public_url = COALESCE(EXCLUDED.public_url, federation_known_nodes.public_url),
			  contact_info = COALESCE(EXCLUDED.contact_info, federation_known_nodes.contact_info),
			  node_type = COALESCE(EXCLUDED.node_type, federation_known_nodes.node_type),
			  country = COALESCE(EXCLUDED.country, federation_known_nodes.country),
			  location = COALESCE(EXCLUDED.location, federation_known_nodes.location),
			  governance_url = COALESCE(EXCLUDED.governance_url, federation_known_nodes.governance_url),
			  last_seen = NOW()`,
			n.Domain, n.Name, n.IsExpelled, "gossip:"+req.FromNode,
			n.Description, n.PublicURL, n.ContactInfo, n.NodeType,
			n.Country, n.Location, n.GovernanceURL)
	}

	writeJSON(w, 200, map[string]interface{}{
		"success":   true,
		"received":  len(req.Nodes),
		"from_node": req.FromNode,
	})
}

// syncDiscoveryNow fuerza una sincronizacion inmediata de la lista de nodos
func (h *NodeDiscoveryHandler) syncDiscoveryNow(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ourNodes := h.getKnownNodesList(ctx)

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

	sent := 0
	for _, peer := range peers {
		if h.sendKnownNodesToPeer(ctx, peer, ourNodes) {
			sent++
		}
	}

	_, _ = h.Pool.Exec(ctx, `
		UPDATE node_discovery_config SET last_discovery_sync = NOW()
		WHERE node_domain = $1`, h.NodeDomain)

	writeJSON(w, 200, map[string]interface{}{
		"success":     true,
		"sent_to":     sent,
		"total_peers": len(peers),
		"message":     fmt.Sprintf("Lista de %d nodos enviada a %d peers", len(ourNodes), sent),
	})
}

// ===== VERIFICACION DE SALUD POR CONSENSO =====

// checkNodeHealth verifica si un nodo descubierto esta activo.
// Registra el resultado como un reporte de salud.
// NO marca como inactivo automaticamente - eso se hace por consenso.
func (h *NodeDiscoveryHandler) checkNodeHealth(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	domain := chi.URLParam(r, "domain")
	if domain == "" {
		writeError(w, 400, "domain is required")
		return
	}

	active := h.checkNodeActive(ctx, domain)

	// Registrar nuestro reporte
	_, _ = h.Pool.Exec(ctx, `
		INSERT INTO node_health_reports (reporter_node, target_node, reachable)
		VALUES ($1, $2, $3)
		ON CONFLICT (reporter_node, target_node, checked_at::DATE) DO UPDATE SET reachable = EXCLUDED.reachable, checked_at = NOW()`,
		h.NodeDomain, domain, active)

	// Actualizar last_checked y failed_checks del nodo
	if active {
		_, _ = h.Pool.Exec(ctx, `
			UPDATE federation_known_nodes SET
				last_checked = NOW(), last_seen = NOW(), failed_checks = 0
			WHERE node_domain = $1`, domain)
	} else {
		// Solo incrementar failed_checks, NO marcar como inactivo automaticamente
		// La marca como inactivo se hace por consenso (consensusCheckInactive)
		_, _ = h.Pool.Exec(ctx, `
			UPDATE federation_known_nodes SET
				last_checked = NOW(), failed_checks = failed_checks + 1
			WHERE node_domain = $1`, domain)
	}

	// Contar cuantos nodos reportan que no pueden conectar (ultimos 7 dias)
	var unreachableReports, totalReports int
	_ = h.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FILTER (WHERE reachable = false),
		       COUNT(*)
		FROM node_health_reports
		WHERE target_node = $1 AND checked_at > NOW() - interval '7 days'`,
		domain).Scan(&unreachableReports, &totalReports)

	// Contar cuantos nodos conocidos activos hay (excluyendo el target)
	var totalKnownNodes int
	_ = h.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM federation_known_nodes
		WHERE is_inactive = false AND node_domain != $1 AND node_domain != $2`,
		domain, h.NodeDomain).Scan(&totalKnownNodes)

	writeJSON(w, 200, map[string]interface{}{
		"success":             true,
		"active":              active,
		"unreachable_reports": unreachableReports,
		"total_reports":       totalReports,
		"total_known_nodes":   totalKnownNodes,
		"message":             fmt.Sprintf("Nodo %s: %s. Reportes de inalcanzabilidad: %d de %d. El consenso se evalua por separado.", domain, map[bool]string{true: "activo", false: "no responde"}[active], unreachableReports, totalKnownNodes),
	})
}

// consensusCheckInactive evalua el consenso de la red para marcar nodos
// como inactivos. Un nodo se marca inactivo SOLO cuando TODOS los nodos
// que reportaron no pueden conectar con el (no solo uno).
// Si tu no puedes conectar pero otros si pueden, el nodo sigue activo.
func (h *NodeDiscoveryHandler) consensusCheckInactive(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Obtener config
	var healthCheckHours int
	_ = h.Pool.QueryRow(ctx, `SELECT health_check_interval_hours FROM node_discovery_config WHERE node_domain = $1`, h.NodeDomain).Scan(&healthCheckHours)
	if healthCheckHours == 0 {
		healthCheckHours = 168 // 7 dias default
	}

	// Para cada nodo descubierto (no peer directo, no inactivo ya),
	// verificar si TODOS los reportes recientes dicen que no responde
	rows, err := h.Pool.Query(ctx, `
		SELECT node_domain FROM federation_known_nodes
		WHERE is_direct_peer = false AND is_inactive = false AND is_expelled = false`)
	if err != nil {
		writeError(w, 500, "error consultando nodos")
		return
	}
	defer rows.Close()

	type result struct {
		Domain         string `json:"domain"`
		MarkedInactive bool   `json:"marked_inactive"`
		Reason         string `json:"reason"`
	}
	results := []result{}
	markedCount := 0

	for rows.Next() {
		var domain string
		_ = rows.Scan(&domain)

		// Contar reportes recientes
		var reachable, unreachable, total int
		_ = h.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FILTER (WHERE reachable = true),
			       COUNT(*) FILTER (WHERE reachable = false),
			       COUNT(*)
			FROM node_health_reports
			WHERE target_node = $1 AND checked_at > NOW() - $2::interval`,
			domain, fmt.Sprintf("%d hours", healthCheckHours)).Scan(&reachable, &unreachable, &total)

		// Contar nodos conocidos activos (excluyendo este nodo y el target)
		var totalKnownNodes int
		_ = h.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM federation_known_nodes
			WHERE is_inactive = false AND node_domain != $1 AND node_domain != $2`,
			domain, h.NodeDomain).Scan(&totalKnownNodes)

		// Marcar como inactivo SOLO si:
		// 1. Hay reportes (total > 0)
		// 2. Ningun reporte dice que es alcanzable (reachable == 0)
		// 3. Todos los reportes dicen que no es alcanzable (unreachable == total)
		// 4. Idealmente todos los nodos conocidos reportaron (total >= totalKnownNodes)
		//    Pero si al menos la mayoria reporto y todos dicen inalcanzable, basta
		if total > 0 && reachable == 0 && unreachable == total {
			// Marcar como inactivo
			_, _ = h.Pool.Exec(ctx, `
				UPDATE federation_known_nodes SET is_inactive = true WHERE node_domain = $1`,
				domain)
			markedCount++
			results = append(results, result{
				Domain:         domain,
				MarkedInactive: true,
				Reason:         fmt.Sprintf("Consenso: %d nodos reportaron inalcanzable, 0 alcanzable", total),
			})
		} else if reachable > 0 {
			// Al menos un nodo puede conectar - reset failed_checks
			_, _ = h.Pool.Exec(ctx, `
				UPDATE federation_known_nodes SET failed_checks = 0 WHERE node_domain = $1`, domain)
			results = append(results, result{
				Domain:         domain,
				MarkedInactive: false,
				Reason:         fmt.Sprintf("%d nodos pueden conectar, %d no pueden", reachable, unreachable),
			})
		}
	}

	// Actualizar timestamp
	_, _ = h.Pool.Exec(ctx, `
		UPDATE node_discovery_config SET last_health_check = NOW()
		WHERE node_domain = $1`, h.NodeDomain)

	writeJSON(w, 200, map[string]interface{}{
		"success":         true,
		"marked_inactive": markedCount,
		"results":         results,
		"message":         fmt.Sprintf("Consenso evaluado. %d nodos marcados como inactivos.", markedCount),
	})
}

// receiveHealthReport recibe un reporte de salud de otro nodo.
// Endpoint publico para que otros nodos reporten si pueden o no conectar con un nodo.
func (h *NodeDiscoveryHandler) receiveHealthReport(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		ReporterNode string `json:"reporter_node"`
		TargetNode   string `json:"target_node"`
		Reachable    bool   `json:"reachable"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.ReporterNode == "" || req.TargetNode == "" {
		writeError(w, 400, "reporter_node and target_node are required")
		return
	}

	_, err := h.Pool.Exec(ctx, `
		INSERT INTO node_health_reports (reporter_node, target_node, reachable)
		VALUES ($1, $2, $3)
		ON CONFLICT (reporter_node, target_node, checked_at::DATE) DO UPDATE SET reachable = EXCLUDED.reachable, checked_at = NOW()`,
		req.ReporterNode, req.TargetNode, req.Reachable)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("guardando reporte: %v", err))
		return
	}

	writeJSON(w, 200, map[string]interface{}{"success": true})
}

// getHealthReports devuelve los reportes de salud de un nodo especifico.
// Endpoint publico para que otros nodos consulten si el consenso dice
// que un nodo esta inactivo.
func (h *NodeDiscoveryHandler) getHealthReports(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	target := chi.URLParam(r, "target")
	if target == "" {
		writeError(w, 400, "target is required")
		return
	}

	rows, err := h.Pool.Query(ctx, `
		SELECT reporter_node, reachable, checked_at
		FROM node_health_reports
		WHERE target_node = $1 AND checked_at > NOW() - interval '7 days'
		ORDER BY checked_at DESC`, target)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	reports := []map[string]interface{}{}
	for rows.Next() {
		var reporter string
		var reachable bool
		var checkedAt time.Time
		_ = rows.Scan(&reporter, &reachable, &checkedAt)
		reports = append(reports, map[string]interface{}{
			"reporter_node": reporter,
			"reachable":     reachable,
			"checked_at":    checkedAt.Format(time.RFC3339),
		})
	}

	// Resumen
	var reachable, unreachable int
	for _, rp := range reports {
		if rp["reachable"].(bool) {
			reachable++
		} else {
			unreachable++
		}
	}

	writeJSON(w, 200, map[string]interface{}{
		"target_node":     target,
		"reports":         reports,
		"reachable":       reachable,
		"unreachable":     unreachable,
		"consensus":       reachable > 0,
		"all_unreachable": reachable == 0 && unreachable > 0,
	})
}

// removeDiscoveredNode elimina un nodo de la lista visible de descubiertos.
// Si es peer directo (federado), no se puede eliminar.
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

	// Verificar si es peer directo
	var isDirectPeer bool
	_ = h.Pool.QueryRow(ctx, `SELECT is_direct_peer FROM federation_known_nodes WHERE node_domain = $1`, domain).Scan(&isDirectPeer)
	if isDirectPeer {
		writeError(w, 400, "no puedes eliminar un nodo federado. Los nodos federados no se eliminan aunque esten offline.")
		return
	}

	_, err := h.Pool.Exec(ctx, `DELETE FROM federation_known_nodes WHERE node_domain = $1`, domain)
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
	Domain        string `json:"domain"`
	Name          string `json:"name"`
	IsExpelled    bool   `json:"is_expelled"`
	Description   string `json:"description"`
	PublicURL     string `json:"public_url"`
	ContactInfo   string `json:"contact_info"`
	NodeType      string `json:"node_type"`
	Country       string `json:"country"`
	Location      string `json:"location"`
	GovernanceURL string `json:"governance_url"`
}

func (h *NodeDiscoveryHandler) getKnownNodesList(ctx context.Context) []KnownNodeInfo {
	rows, err := h.Pool.Query(ctx, `
		SELECT node_domain, COALESCE(node_name,''), is_expelled, COALESCE(description,''),
		       COALESCE(public_url,''), COALESCE(contact_info,''), COALESCE(node_type,''),
		       COALESCE(country,''), COALESCE(location,''), COALESCE(governance_url,'')
		FROM federation_known_nodes WHERE is_inactive = false`)
	if err != nil {
		return []KnownNodeInfo{}
	}
	defer rows.Close()

	nodes := []KnownNodeInfo{}
	for rows.Next() {
		var n KnownNodeInfo
		_ = rows.Scan(&n.Domain, &n.Name, &n.IsExpelled, &n.Description, &n.PublicURL, &n.ContactInfo, &n.NodeType, &n.Country, &n.Location, &n.GovernanceURL)
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
	for _, scheme := range []string{"https", "http"} {
		url := fmt.Sprintf("%s://%s/api/public/known-nodes-sync", scheme, peerDomain)
		resp, err := client.Post(url, "application/json", strings.NewReader(string(body)))
		if err == nil {
			defer resp.Body.Close()
			io.Copy(io.Discard, resp.Body)
			return resp.StatusCode == 200
		}
	}
	return false
}

func (h *NodeDiscoveryHandler) checkNodeActive(ctx context.Context, domain string) bool {
	client := &http.Client{Timeout: 10 * time.Second}
	for _, scheme := range []string{"https", "http"} {
		url := fmt.Sprintf("%s://%s/api/public/node-info", scheme, domain)
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
	_, _ = h.Pool.Exec(ctx, `
		INSERT INTO federation_known_nodes (node_domain, is_direct_peer, is_expelled, is_inactive, discovered_at, last_seen)
		VALUES ($1, true, false, false, NOW(), NOW())
		ON CONFLICT (node_domain) DO UPDATE SET is_direct_peer = true, last_seen = NOW()`,
		h.NodeDomain)

	_, _ = h.Pool.Exec(ctx, `
		INSERT INTO federation_known_nodes (node_domain, is_direct_peer, is_expelled, is_inactive, discovered_at, last_seen)
		SELECT peer_domain, true, false, false, NOW(), NOW()
		FROM node_federation_keys WHERE status != 'removed'
		ON CONFLICT (node_domain) DO UPDATE SET is_direct_peer = true, last_seen = NOW()`)
}

func scanContactRequest(rows interface{ Scan(...interface{}) error }) map[string]interface{} {
	var id, direction, fromDomain, fromName, toDomain, message, contactInfo, status, responseMsg, responseContact, fromCountry, fromLocation, fromGovURL, createdAt, respondedAt string
	if err := rows.Scan(&id, &direction, &fromDomain, &fromName, &toDomain,
		&message, &contactInfo, &status, &responseMsg, &responseContact,
		&fromCountry, &fromLocation, &fromGovURL,
		&createdAt, &respondedAt); err != nil {
		return nil
	}
	req := map[string]interface{}{
		"id":                  id,
		"direction":           direction,
		"from_node_domain":    fromDomain,
		"from_node_name":      fromName,
		"to_node_domain":      toDomain,
		"message":             message,
		"contact_info":        contactInfo,
		"status":              status,
		"response_message":    responseMsg,
		"response_contact":    responseContact,
		"from_country":        fromCountry,
		"from_location":       fromLocation,
		"from_governance_url": fromGovURL,
		"created_at":          createdAt,
	}
	if respondedAt != "" {
		req["responded_at"] = respondedAt
	}
	return req
}
