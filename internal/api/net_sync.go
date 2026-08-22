package api

import (
	"bytes"
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

// NetSyncHandler sincroniza la info de red entre nodos federados.
// Cuando un nodo cambia su config de red (dominio, IP, IPv6 ULA, WireGuard,
// servicios), la comparte automaticamente con todos sus peers.
// Los peers guardan esta info para poder encontrar al nodo y ver sus servicios.
type NetSyncHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func NewNetSyncHandler(pool *pgxpool.Pool, nodeDomain string) *NetSyncHandler {
	return &NetSyncHandler{Pool: pool, NodeDomain: nodeDomain}
}

// RegisterRoutes registra los endpoints de sincronizacion.
// Estos endpoints son publicos (sin auth) para que otros nodos puedan
// consultarlos via federation. En produccion se usaria mTLS.
func (nh *NetSyncHandler) RegisterRoutes(r chi.Router) {
	r.Get("/api/federation/net-info", nh.getMyNetInfo)               // otros nodos consultan mi info
	r.Post("/api/federation/net-info/update", nh.receivePeerNetInfo) // recibo info de un peer
	r.Get("/api/federation/peers-info", nh.listPeersNetInfo)         // veo info de todos mis peers
}

// netInfoPayload es lo que un nodo comparte con sus peers
type netInfoPayload struct {
	NodeDomain         string `json:"node_domain"`
	NodeName           string `json:"node_name"`
	PublicDomain       string `json:"public_domain"`
	IPv6ULA            string `json:"ipv6_ula"`
	WireguardEndpoint  string `json:"wireguard_endpoint"`
	WireguardPublicKey string `json:"wireguard_public_key"`
	WireguardPort      int    `json:"wireguard_port"`
	NetworkMode        string `json:"network_mode"`
	Services           []struct {
		Name        string `json:"name"`
		URL         string `json:"url"`
		Description string `json:"description"`
	} `json:"services"`
}

// getMyNetInfo devuelve mi info de red para que otros nodos la lean
func (nh *NetSyncHandler) getMyNetInfo(w http.ResponseWriter, r *http.Request) {
	info, err := nh.buildMyNetInfo(r.Context())
	if err != nil {
		writeError(w, 500, "error building net info")
		return
	}
	writeJSON(w, 200, info)
}

// buildMyNetInfo construye la info de red de este nodo
func (nh *NetSyncHandler) buildMyNetInfo(ctx context.Context) (*netInfoPayload, error) {
	var mode, ipv6ULA, subdomain, openwrtDomain, wgPublicKey, nodeName string
	var wgPort int

	err := nh.Pool.QueryRow(ctx, `
		SELECT COALESCE(mode, 'internet'), COALESCE(ipv6_ula, ''), COALESCE(subdomain, ''),
		       COALESCE(openwrt_domain, ''), COALESCE(wireguard_public_key, ''),
		       COALESCE(wireguard_port, 51820)
		FROM network_config ORDER BY id DESC LIMIT 1`,
	).Scan(&mode, &ipv6ULA, &subdomain, &openwrtDomain, &wgPublicKey, &wgPort)
	if err != nil {
		mode = "internet"
		wgPort = 51820
	}

	// Construir dominio publico
	publicDomain := nh.NodeDomain
	if openwrtDomain != "" {
		if subdomain != "" {
			publicDomain = subdomain + "." + openwrtDomain
		} else {
			publicDomain = "nodo." + openwrtDomain
		}
	}

	// Endpoint WireGuard
	endpoint := fmt.Sprintf("%s:%d", publicDomain, wgPort)

	// Nombre del nodo
	_ = nh.Pool.QueryRow(ctx, `SELECT COALESCE(name, '') FROM node_config WHERE domain = $1`, nh.NodeDomain).Scan(&nodeName)
	if nodeName == "" {
		nodeName = nh.NodeDomain
	}

	// Servicios locales
	rows, err := nh.Pool.Query(ctx, `SELECT name, ipv6_address, COALESCE(description, '') FROM network_services`)
	if err != nil {
		rows = nil
	}
	defer func() {
		if rows != nil {
			rows.Close()
		}
	}()

	services := []struct {
		Name        string `json:"name"`
		URL         string `json:"url"`
		Description string `json:"description"`
	}{}
	if rows != nil {
		for rows.Next() {
			var name, ipv6Addr, desc string
			_ = rows.Scan(&name, &ipv6Addr, &desc)
			svcURL := fmt.Sprintf("%s.%s", name, publicDomain)
			services = append(services, struct {
				Name        string `json:"name"`
				URL         string `json:"url"`
				Description string `json:"description"`
			}{Name: name, URL: svcURL, Description: desc})
		}
	}

	return &netInfoPayload{
		NodeDomain:         nh.NodeDomain,
		NodeName:           nodeName,
		PublicDomain:       publicDomain,
		IPv6ULA:            ipv6ULA,
		WireguardEndpoint:  endpoint,
		WireguardPublicKey: wgPublicKey,
		WireguardPort:      wgPort,
		NetworkMode:        mode,
		Services:           services,
	}, nil
}

// receivePeerNetInfo recibe la info de red de un nodo peer y la guarda
func (nh *NetSyncHandler) receivePeerNetInfo(w http.ResponseWriter, r *http.Request) {
	var req netInfoPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request")
		return
	}
	if req.NodeDomain == "" {
		writeError(w, 400, "node_domain is required")
		return
	}

	servicesJSON, _ := json.Marshal(req.Services)

	_, err := nh.Pool.Exec(r.Context(), `
		INSERT INTO federation_node_info
			(node_domain, node_name, public_domain, ipv6_ula, wireguard_endpoint,
			 wireguard_public_key, wireguard_port, network_mode, services, last_updated, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), true)
		ON CONFLICT (node_domain) DO UPDATE SET
			node_name = $2, public_domain = $3, ipv6_ula = $4, wireguard_endpoint = $5,
			wireguard_public_key = $6, wireguard_port = $7, network_mode = $8,
			services = $9, last_updated = NOW(), is_active = true`,
		req.NodeDomain, req.NodeName, req.PublicDomain, req.IPv6ULA,
		req.WireguardEndpoint, req.WireguardPublicKey, req.WireguardPort,
		req.NetworkMode, servicesJSON)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("error saving peer net info: %v", err))
		return
	}

	writeJSON(w, 200, map[string]interface{}{"status": "ok", "node": req.NodeDomain})
}

// listPeersNetInfo devuelve la info de red de todos los nodos federados conocidos
func (nh *NetSyncHandler) listPeersNetInfo(w http.ResponseWriter, r *http.Request) {
	rows, err := nh.Pool.Query(r.Context(), `
		SELECT node_domain, COALESCE(node_name, ''), COALESCE(public_domain, ''),
		       COALESCE(ipv6_ula, ''), COALESCE(wireguard_endpoint, ''),
		       COALESCE(wireguard_public_key, ''), COALESCE(wireguard_port, 0),
		       COALESCE(network_mode, 'internet'), services, last_updated, is_active
		FROM federation_node_info
		WHERE is_active = true
		ORDER BY last_updated DESC`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	peers := []map[string]interface{}{}
	for rows.Next() {
		var nodeDomain, nodeName, publicDomain, ipv6ULA, wgEndpoint, wgPubKey, netMode string
		var wgPort int
		var services []byte
		var lastUpdated time.Time
		var isActive bool

		_ = rows.Scan(&nodeDomain, &nodeName, &publicDomain, &ipv6ULA, &wgEndpoint,
			&wgPubKey, &wgPort, &netMode, &services, &lastUpdated, &isActive)

		peer := map[string]interface{}{
			"node_domain":          nodeDomain,
			"node_name":            nodeName,
			"public_domain":        publicDomain,
			"ipv6_ula":             ipv6ULA,
			"wireguard_endpoint":   wgEndpoint,
			"wireguard_public_key": wgPubKey,
			"wireguard_port":       wgPort,
			"network_mode":         netMode,
			"services":             json.RawMessage(services),
			"last_updated":         lastUpdated,
			"is_active":            isActive,
		}
		peers = append(peers, peer)
	}

	writeJSON(w, 200, peers)
}

// pushNetInfoToPeers envia mi info de red a todos los peers federados.
// Se llama automaticamente cuando cambio mi config de red o mis servicios.
func (nh *NetSyncHandler) pushNetInfoToPeers() {
	ctx := context.Background()

	info, err := nh.buildMyNetInfo(ctx)
	if err != nil {
		return
	}

	body, _ := json.Marshal(info)

	// Obtener todos los peers federados (de node_federation_keys)
	rows, err := nh.Pool.Query(ctx, `
		SELECT peer_domain, COALESCE(peer_endpoint, '') FROM node_federation_keys
		WHERE status = 'active' OR status = 'pending'`)
	if err != nil {
		return
	}
	defer rows.Close()

	client := &http.Client{Timeout: 10 * time.Second}
	for rows.Next() {
		var peerDomain, peerEndpoint string
		_ = rows.Scan(&peerDomain, &peerEndpoint)

		// Construir URL del peer
		// Si tenemos el endpoint, usarlo; sino usar el peer_domain
		targetURL := fmt.Sprintf("http://%s:8080/api/federation/net-info/update", peerDomain)
		if peerEndpoint != "" {
			// peerEndpoint puede ser "dominio:puerto" o solo "dominio"
			targetURL = fmt.Sprintf("http://%s/api/federation/net-info/update", peerEndpoint)
			// Si no tiene puerto, agregar :8080
			if !strings.Contains(peerEndpoint, ":") {
				targetURL = fmt.Sprintf("http://%s:8080/api/federation/net-info/update", peerEndpoint)
			}
		}

		// Enviar en goroutine para no bloquear
		go func(url string, body []byte) {
			resp, err := client.Post(url, "application/json", bytes.NewReader(body))
			if err != nil {
				return // peer no disponible, ignorar
			}
			defer resp.Body.Close()
			io.Copy(io.Discard, resp.Body)
		}(targetURL, body)
	}
}

// pullNetInfoFromPeers consulta la info de red de todos los peers.
// Se llama periodicamente para mantener la info actualizada.
func (nh *NetSyncHandler) pullNetInfoFromPeers() {
	ctx := context.Background()

	rows, err := nh.Pool.Query(ctx, `
		SELECT peer_domain, COALESCE(peer_endpoint, '') FROM node_federation_keys
		WHERE status = 'active' OR status = 'pending'`)
	if err != nil {
		return
	}
	defer rows.Close()

	client := &http.Client{Timeout: 10 * time.Second}
	for rows.Next() {
		var peerDomain, peerEndpoint string
		_ = rows.Scan(&peerDomain, &peerEndpoint)

		targetURL := fmt.Sprintf("http://%s:8080/api/federation/net-info", peerDomain)
		if peerEndpoint != "" {
			targetURL = fmt.Sprintf("http://%s/api/federation/net-info", peerEndpoint)
			if !strings.Contains(peerEndpoint, ":") {
				targetURL = fmt.Sprintf("http://%s:8080/api/federation/net-info", peerEndpoint)
			}
		}

		go func(url, domain string) {
			resp, err := client.Get(url)
			if err != nil {
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode != 200 {
				return
			}

			var info netInfoPayload
			if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
				return
			}

			// Guardar la info recibida
			servicesJSON, _ := json.Marshal(info.Services)
			_, _ = nh.Pool.Exec(ctx, `
				INSERT INTO federation_node_info
					(node_domain, node_name, public_domain, ipv6_ula, wireguard_endpoint,
					 wireguard_public_key, wireguard_port, network_mode, services, last_updated, is_active)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), true)
				ON CONFLICT (node_domain) DO UPDATE SET
					node_name = $2, public_domain = $3, ipv6_ula = $4, wireguard_endpoint = $5,
					wireguard_public_key = $6, wireguard_port = $7, network_mode = $8,
					services = $9, last_updated = NOW(), is_active = true`,
				info.NodeDomain, info.NodeName, info.PublicDomain, info.IPv6ULA,
				info.WireguardEndpoint, info.WireguardPublicKey, info.WireguardPort,
				info.NetworkMode, servicesJSON)
		}(targetURL, peerDomain)
	}
}
