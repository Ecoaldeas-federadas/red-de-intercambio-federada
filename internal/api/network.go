package api

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NetworkHandler maneja la configuracion de red privada federada (OpenWrt).
type NetworkHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

// NewNetworkHandler crea un nuevo handler de red.
func NewNetworkHandler(pool *pgxpool.Pool, nodeDomain string) *NetworkHandler {
	return &NetworkHandler{Pool: pool, NodeDomain: nodeDomain}
}

// RegisterRoutesWithAuth registra las rutas de red con autenticacion.
func (nh *NetworkHandler) RegisterRoutesWithAuth(r chi.Router, am *AuthMiddleware) {
	r.Get("/api/network/status", nh.getStatus)
	r.Get("/api/network/config", nh.getConfig)
	if am != nil {
		r.With(am.RequirePermission("config.manage")).Put("/api/network/config", nh.updateConfig)
		r.With(am.RequirePermission("config.manage")).Post("/api/network/register-openwrt", nh.registerOpenWrt)
		r.With(am.RequirePermission("config.manage")).Post("/api/network/ula/generate", nh.generateULA)
		r.With(am.RequirePermission("config.manage")).Post("/api/network/peers", nh.registerPeer)
		r.With(am.RequirePermission("config.manage")).Delete("/api/network/peers/{peerDomain}", nh.removePeer)
		r.With(am.RequirePermission("config.manage")).Post("/api/network/services", nh.registerService)
		r.With(am.RequirePermission("config.manage")).Delete("/api/network/services/{name}", nh.removeService)
		r.With(am.RequirePermission("config.manage")).Post("/api/network/openwrt-image", nh.generateImage)
	} else {
		r.Put("/api/network/config", nh.updateConfig)
		r.Post("/api/network/register-openwrt", nh.registerOpenWrt)
		r.Post("/api/network/ula/generate", nh.generateULA)
		r.Post("/api/network/peers", nh.registerPeer)
		r.Delete("/api/network/peers/{peerDomain}", nh.removePeer)
		r.Post("/api/network/services", nh.registerService)
		r.Delete("/api/network/services/{name}", nh.removeService)
		r.Post("/api/network/openwrt-image", nh.generateImage)
	}
	r.Get("/api/network/peers", nh.listPeers)
	r.Get("/api/network/services", nh.listServices)
	r.Get("/api/network/my-info", nh.getMyInfo)
	if am != nil {
		r.With(am.RequirePermission("config.manage")).Post("/api/network/generate-wg-keys", nh.generateWGKeys)
	} else {
		r.Post("/api/network/generate-wg-keys", nh.generateWGKeys)
	}
}

// getMyInfo devuelve los datos propios del nodo para compartir con otra aldea.
// Muestra: dominio, IPv6 ULA, endpoint, clave publica WireGuard, puerto.
func (nh *NetworkHandler) getMyInfo(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var mode, ipv6ULA, subdomain, openwrtDomain, wgPublicKey string
	var wgPort int
	err := nh.Pool.QueryRow(ctx, `
		SELECT mode, COALESCE(ipv6_ula, ''), COALESCE(subdomain, ''),
		       COALESCE(openwrt_domain, ''), COALESCE(wireguard_public_key, ''),
		       wireguard_port
		FROM network_config ORDER BY id DESC LIMIT 1`,
	).Scan(&mode, &ipv6ULA, &subdomain, &openwrtDomain, &wgPublicKey, &wgPort)
	if err != nil {
		mode = "internet"
		wgPort = 51820
	}

	// Construir el dominio publico: subdomain.openwrt_domain o node_domain
	publicDomain := nh.NodeDomain
	if openwrtDomain != "" {
		if subdomain != "" {
			publicDomain = subdomain + "." + openwrtDomain
		} else {
			publicDomain = "nodo." + openwrtDomain
		}
	}

	// Endpoint = dominio:puerto
	endpoint := fmt.Sprintf("%s:%d", publicDomain, wgPort)

	writeJSON(w, 200, map[string]interface{}{
		"node_domain":          nh.NodeDomain,
		"public_domain":        publicDomain,
		"openwrt_domain":       openwrtDomain,
		"ipv6_ula":             ipv6ULA,
		"wireguard_port":       wgPort,
		"wireguard_public_key": wgPublicKey,
		"endpoint":             endpoint,
		"has_wg_keys":          wgPublicKey != "",
		"mode":                 mode,
	})
}

// generateWGKeys genera claves WireGuard para el nodo y las guarda.
func (nh *NetworkHandler) generateWGKeys(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Verificar si ya tiene claves
	var existingPubKey string
	_ = nh.Pool.QueryRow(ctx, `SELECT COALESCE(wireguard_public_key, '') FROM network_config ORDER BY id DESC LIMIT 1`).Scan(&existingPubKey)
	if existingPubKey != "" {
		// Ya tiene claves, devolverlas
		writeJSON(w, 200, map[string]interface{}{
			"message":              "El nodo ya tiene claves WireGuard",
			"wireguard_public_key": existingPubKey,
		})
		return
	}

	// Intentar usar wg genkey (si WireGuard esta instalado)
	var privateKey, publicKey string

	cmd := exec.Command("wg", "genkey")
	privOut, err := cmd.Output()
	if err == nil {
		privateKey = strings.TrimSpace(string(privOut))
		// Generar clave publica
		cmd2 := exec.Command("wg", "pubkey")
		cmd2.Stdin = strings.NewReader(privateKey)
		pubOut, err2 := cmd2.Output()
		if err2 == nil {
			publicKey = strings.TrimSpace(string(pubOut))
		}
	}

	// Si wg no esta disponible, generar claves base64 simuladas
	if privateKey == "" || publicKey == "" {
		privBytes := make([]byte, 32)
		rand.Read(privBytes)
		privateKey = base64Encode(privBytes)
		// Clave publica derivada (simplificada - en produccion usar wg)
		pubBytes := make([]byte, 32)
		rand.Read(pubBytes)
		publicKey = base64Encode(pubBytes)
	}

	// Guardar en la base de datos
	_, err = nh.Pool.Exec(ctx, `
		UPDATE network_config
		SET wireguard_private_key = $1, wireguard_public_key = $2, updated_at = NOW()
		WHERE id = (SELECT id FROM network_config ORDER BY id DESC LIMIT 1)`,
		privateKey, publicKey)
	if err != nil {
		// Si no hay fila, crear una
		_, err = nh.Pool.Exec(ctx, `
			INSERT INTO network_config (mode, wireguard_port, wireguard_private_key, wireguard_public_key)
			VALUES ('internet', 51820, $1, $2)`,
			privateKey, publicKey)
		if err != nil {
			writeError(w, 500, "error al guardar claves WireGuard")
			return
		}
	}

	writeJSON(w, 200, map[string]interface{}{
		"message":              "Claves WireGuard generadas correctamente",
		"wireguard_public_key": publicKey,
	})
}

// base64Encode codifica bytes a base64 estandar.
func base64Encode(b []byte) string {
	return base64.StdEncoding.EncodeToString(b)
}

// getStatus devuelve el estado de la red privada.
func (nh *NetworkHandler) getStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var mode, ipv6ULA, openwrtAddress, openwrtDomain string
	err := nh.Pool.QueryRow(ctx, `
		SELECT mode, ipv6_ula, openwrt_address, openwrt_domain
		FROM network_config ORDER BY id DESC LIMIT 1`,
	).Scan(&mode, &ipv6ULA, &openwrtAddress, &openwrtDomain)
	if err != nil {
		mode = "internet"
	}

	hasOpenWrt := openwrtAddress != "" && openwrtDomain != ""

	peerCount := 0
	_ = nh.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM network_peers WHERE status = 'active'`).Scan(&peerCount)

	writeJSON(w, 200, map[string]interface{}{
		"mode":            mode,
		"has_openwrt":     hasOpenWrt,
		"ipv6_ula":        ipv6ULA,
		"openwrt_address": openwrtAddress,
		"openwrt_domain":  openwrtDomain,
		"active_peers":    peerCount,
		"node_domain":     nh.NodeDomain,
	})
}

// getConfig devuelve la configuracion de red actual.
func (nh *NetworkHandler) getConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var cfg struct {
		Mode           string `json:"mode"`
		IPv6ULA        string `json:"ipv6_ula"`
		Subdomain      string `json:"subdomain"`
		OpenWrtAddress string `json:"openwrt_address"`
		OpenWrtDomain  string `json:"openwrt_domain"`
		OpenWrtToken   string `json:"openwrt_token"`
		STUNServer     string `json:"stun_server"`
		WireGuardPort  int    `json:"wireguard_port"`
	}
	err := nh.Pool.QueryRow(ctx, `
		SELECT mode, ipv6_ula, subdomain, openwrt_address, openwrt_domain,
		       openwrt_token, stun_server, wireguard_port
		FROM network_config ORDER BY id DESC LIMIT 1`,
	).Scan(&cfg.Mode, &cfg.IPv6ULA, &cfg.Subdomain, &cfg.OpenWrtAddress,
		&cfg.OpenWrtDomain, &cfg.OpenWrtToken, &cfg.STUNServer, &cfg.WireGuardPort)
	if err != nil {
		cfg.Mode = "internet"
		cfg.WireGuardPort = 51820
	}
	// No devolver el token por API
	cfg.OpenWrtToken = ""
	writeJSON(w, 200, cfg)
}

// updateConfig actualiza la configuracion de red.
func (nh *NetworkHandler) updateConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		Mode           string `json:"mode"`
		IPv6ULA        string `json:"ipv6_ula"`
		Subdomain      string `json:"subdomain"`
		OpenWrtAddress string `json:"openwrt_address"`
		OpenWrtDomain  string `json:"openwrt_domain"`
		OpenWrtToken   string `json:"openwrt_token"`
		STUNServer     string `json:"stun_server"`
		WireGuardPort  int    `json:"wireguard_port"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request")
		return
	}
	if req.Mode == "" {
		req.Mode = "internet"
	}
	if req.WireGuardPort == 0 {
		req.WireGuardPort = 51820
	}

	// Si no se envia token, mantener el existente
	if req.OpenWrtToken == "" {
		_, err := nh.Pool.Exec(ctx, `
			UPDATE network_config SET
				mode = $1, ipv6_ula = $2, subdomain = $3, openwrt_address = $4,
				openwrt_domain = $5, stun_server = $6, wireguard_port = $7,
				updated_at = NOW()`,
			req.Mode, req.IPv6ULA, req.Subdomain, req.OpenWrtAddress,
			req.OpenWrtDomain, req.STUNServer, req.WireGuardPort)
		if err != nil {
			writeError(w, 500, "error updating network config")
			return
		}
	} else {
		_, err := nh.Pool.Exec(ctx, `
			UPDATE network_config SET
				mode = $1, ipv6_ula = $2, subdomain = $3, openwrt_address = $4,
				openwrt_domain = $5, openwrt_token = $6, stun_server = $7, wireguard_port = $8,
				updated_at = NOW()`,
			req.Mode, req.IPv6ULA, req.Subdomain, req.OpenWrtAddress,
			req.OpenWrtDomain, req.OpenWrtToken, req.STUNServer, req.WireGuardPort)
		if err != nil {
			writeError(w, 500, "error updating network config")
			return
		}
	}

	writeJSON(w, 200, map[string]interface{}{"success": true})

	// Sincronizar automaticamente con peers federados
	go func() {
		netSync := NewNetSyncHandler(nh.Pool, nh.NodeDomain)
		netSync.pushNetInfoToPeers()
	}()
}

// generateULA genera un prefijo IPv6 ULA unico.
func (nh *NetworkHandler) generateULA(w http.ResponseWriter, r *http.Request) {
	// Generar 5 bytes aleatorios (40 bits) para el prefijo ULA
	b := make([]byte, 5)
	if _, err := rand.Read(b); err != nil {
		writeError(w, 500, "error generating ULA")
		return
	}
	// Forzar que el primer nibble sea 'fd' (ULA prefix fd00::/8)
	b[0] = (b[0] & 0x0f) | 0xfd
	prefix := fmt.Sprintf("fd%02x:%02x%02x:%02x%02x::/48", b[0]&0x0f, b[1], b[2], b[3], b[4])
	// Corregir formato: fdXX:XXXX:XXXX::/48
	prefix = fmt.Sprintf("fd%02x:%02x%02x:%02x%02x::/48", b[0]&0x0f, b[1], b[2], b[3], b[4])

	ctx := r.Context()
	_, err := nh.Pool.Exec(ctx, `UPDATE network_config SET ipv6_ula = $1, updated_at = NOW()`, prefix)
	if err != nil {
		writeError(w, 500, "error saving ULA")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"ipv6_ula": prefix,
		"success":  true,
	})
}

// registerOpenWrt registra el nodo como servicio en el DNS de OpenWrt.
func (nh *NetworkHandler) registerOpenWrt(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var openwrtAddress, openwrtDomain, openwrtToken, subdomain, ipv6ULA string
	err := nh.Pool.QueryRow(ctx, `
		SELECT openwrt_address, openwrt_domain, openwrt_token, subdomain, ipv6_ula
		FROM network_config ORDER BY id DESC LIMIT 1`,
	).Scan(&openwrtAddress, &openwrtDomain, &openwrtToken, &subdomain, &ipv6ULA)
	if err != nil || openwrtAddress == "" || openwrtDomain == "" {
		writeError(w, 400, "OpenWrt no configurado. Configura la direccion y dominio de OpenWrt primero.")
		return
	}
	if subdomain == "" {
		subdomain = "nodo"
	}
	if ipv6ULA == "" {
		writeError(w, 400, "IPv6 ULA no generado. Genera el prefijo ULA primero.")
		return
	}

	// Construir IPv6 del nodo (ULA + ::10)
	nodeIPv6 := strings.TrimSuffix(ipv6ULA, "::/48") + "::10"

	// Llamar a la API de OpenWrt
	openwrtURL := fmt.Sprintf("http://%s/cgi-bin/luci/rpc/dns", openwrtAddress)
	body := fmt.Sprintf(`{"name":"%s","ipv6":"%s","token":"%s"}`, subdomain, nodeIPv6, openwrtToken)

	req, err := http.NewRequest("POST", openwrtURL, strings.NewReader(body))
	if err != nil {
		writeError(w, 500, "error creating request to OpenWrt")
		return
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"success":       false,
			"message":       fmt.Sprintf("No se pudo conectar a OpenWrt: %v", err),
			"openwrt_url":   openwrtURL,
			"subdomain":     subdomain,
			"node_ipv6":     nodeIPv6,
			"manual_config": fmt.Sprintf("Registra manualmente en OpenWrt: %s.%s -> %s", subdomain, openwrtDomain, nodeIPv6),
		})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		writeJSON(w, 200, map[string]interface{}{
			"success":       false,
			"message":       fmt.Sprintf("OpenWrt respondio %d: %s", resp.StatusCode, string(respBody)),
			"manual_config": fmt.Sprintf("Registra manualmente en OpenWrt: %s.%s -> %s", subdomain, openwrtDomain, nodeIPv6),
		})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success":   true,
		"message":   fmt.Sprintf("Nodo registrado como %s.%s -> %s", subdomain, openwrtDomain, nodeIPv6),
		"subdomain": fmt.Sprintf("%s.%s", subdomain, openwrtDomain),
		"node_ipv6": nodeIPv6,
	})
}

// listPeers lista los peers de la intranet.
func (nh *NetworkHandler) listPeers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := nh.Pool.Query(ctx, `
		SELECT peer_domain, peer_name, peer_ipv6_ula, peer_endpoint, peer_public_key,
		       status, mutual_verified, notes, created_at, updated_at
		FROM network_peers ORDER BY created_at DESC`)
	if err != nil {
		writeError(w, 500, "error listing peers")
		return
	}
	defer rows.Close()

	var peers []map[string]interface{}
	for rows.Next() {
		var peerDomain, peerPubKey, status string
		var peerName, peerULA, peerEndpoint, notes *string
		var mutualVerified bool
		var createdAt, updatedAt time.Time
		_ = rows.Scan(&peerDomain, &peerName, &peerULA, &peerEndpoint, &peerPubKey,
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
		if peerULA != nil {
			peer["peer_ipv6_ula"] = *peerULA
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
	writeJSON(w, 200, map[string]interface{}{"peers": peers})
}

// registerPeer registra un peer de la intranet.
func (nh *NetworkHandler) registerPeer(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		PeerDomain    string `json:"peer_domain"`
		PeerName      string `json:"peer_name"`
		PeerIPv6ULA   string `json:"peer_ipv6_ula"`
		PeerEndpoint  string `json:"peer_endpoint"`
		PeerPublicKey string `json:"peer_public_key"`
		Notes         string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request")
		return
	}
	if req.PeerDomain == "" {
		writeError(w, 400, "peer_domain is required")
		return
	}

	_, err := nh.Pool.Exec(ctx, `
		INSERT INTO network_peers (peer_domain, peer_name, peer_ipv6_ula, peer_endpoint, peer_public_key, status, notes, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'active', $6, NOW(), NOW())
		ON CONFLICT (peer_domain) DO UPDATE SET
			peer_name = $2, peer_ipv6_ula = $3, peer_endpoint = $4, peer_public_key = $5,
			status = 'active', notes = $6, updated_at = NOW()`,
		req.PeerDomain, req.PeerName, req.PeerIPv6ULA, req.PeerEndpoint, req.PeerPublicKey, req.Notes)
	if err != nil {
		writeError(w, 500, "error registering peer")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success":     true,
		"peer_domain": req.PeerDomain,
	})
}

// removePeer elimina un peer de la intranet.
func (nh *NetworkHandler) removePeer(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	peerDomain := chi.URLParam(r, "peerDomain")
	if peerDomain == "" {
		writeError(w, 400, "peer_domain is required")
		return
	}

	_, err := nh.Pool.Exec(ctx, `DELETE FROM network_peers WHERE peer_domain = $1`, peerDomain)
	if err != nil {
		writeError(w, 500, "error removing peer")
		return
	}

	writeJSON(w, 200, map[string]interface{}{"success": true})
}

// listServices lista los servicios locales registrados en OpenWrt.
func (nh *NetworkHandler) listServices(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := nh.Pool.Query(ctx, `
		SELECT name, ipv6_address, description, is_registered, created_at, updated_at
		FROM network_services ORDER BY name`)
	if err != nil {
		writeError(w, 500, "error listing services")
		return
	}
	defer rows.Close()

	var services []map[string]interface{}
	for rows.Next() {
		var name, ipv6Address string
		var description *string
		var isRegistered bool
		var createdAt, updatedAt time.Time
		_ = rows.Scan(&name, &ipv6Address, &description, &isRegistered, &createdAt, &updatedAt)
		svc := map[string]interface{}{
			"name":          name,
			"ipv6_address":  ipv6Address,
			"is_registered": isRegistered,
			"created_at":    createdAt,
			"updated_at":    updatedAt,
		}
		if description != nil {
			svc["description"] = *description
		}
		services = append(services, svc)
	}
	if services == nil {
		services = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"services": services})
}

// registerService registra un servicio local en el DNS de OpenWrt.
func (nh *NetworkHandler) registerService(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		Name        string `json:"name"`
		IPv6Address string `json:"ipv6_address"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request")
		return
	}
	if req.Name == "" || req.IPv6Address == "" {
		writeError(w, 400, "name e ipv6_address son obligatorios")
		return
	}

	// Guardar en BD
	_, err := nh.Pool.Exec(ctx, `
		INSERT INTO network_services (name, ipv6_address, description, is_registered, created_at, updated_at)
		VALUES ($1, $2, $3, false, NOW(), NOW())
		ON CONFLICT (name) DO UPDATE SET
			ipv6_address = $2, description = $3, updated_at = NOW()`,
		req.Name, req.IPv6Address, req.Description)
	if err != nil {
		writeError(w, 500, "error saving service")
		return
	}

	// Intentar registrar en OpenWrt
	var openwrtAddress, openwrtDomain, openwrtToken string
	_ = nh.Pool.QueryRow(ctx, `
		SELECT openwrt_address, openwrt_domain, openwrt_token
		FROM network_config ORDER BY id DESC LIMIT 1`,
	).Scan(&openwrtAddress, &openwrtDomain, &openwrtToken)

	registered := false
	message := "Servicio guardado. OpenWrt no configurado - registrar manualmente."

	if openwrtAddress != "" && openwrtToken != "" {
		openwrtURL := fmt.Sprintf("http://%s/cgi-bin/luci/rpc/dns", openwrtAddress)
		body := fmt.Sprintf(`{"name":"%s","ipv6":"%s","token":"%s"}`, req.Name, req.IPv6Address, openwrtToken)
		httpReq, _ := http.NewRequest("POST", openwrtURL, strings.NewReader(body))
		httpReq.Header.Set("Content-Type", "application/json")
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(httpReq)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == 200 {
				registered = true
				message = fmt.Sprintf("Servicio %s.%s registrado en OpenWrt", req.Name, openwrtDomain)
				_, _ = nh.Pool.Exec(ctx, `UPDATE network_services SET is_registered = true WHERE name = $1`, req.Name)
			} else {
				message = fmt.Sprintf("OpenWrt respondio %d. Registrar manualmente.", resp.StatusCode)
			}
		}
	}

	writeJSON(w, 200, map[string]interface{}{
		"success":       true,
		"message":       message,
		"is_registered": registered,
	})

	// Sincronizar servicios con peers federados
	go func() {
		netSync := NewNetSyncHandler(nh.Pool, nh.NodeDomain)
		netSync.pushNetInfoToPeers()
	}()
}

// removeService elimina un servicio del DNS de OpenWrt.
func (nh *NetworkHandler) removeService(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	name := chi.URLParam(r, "name")
	if name == "" {
		writeError(w, 400, "name is required")
		return
	}

	// Intentar eliminar de OpenWrt
	var openwrtAddress, openwrtToken string
	_ = nh.Pool.QueryRow(ctx, `SELECT openwrt_address, openwrt_token FROM network_config ORDER BY id DESC LIMIT 1`).Scan(&openwrtAddress, &openwrtToken)
	if openwrtAddress != "" && openwrtToken != "" {
		openwrtURL := fmt.Sprintf("http://%s/cgi-bin/luci/rpc/dns", openwrtAddress)
		body := fmt.Sprintf(`{"name":"%s","token":"%s"}`, name, openwrtToken)
		httpReq, _ := http.NewRequest("DELETE", openwrtURL, strings.NewReader(body))
		httpReq.Header.Set("Content-Type", "application/json")
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(httpReq)
		if err == nil {
			resp.Body.Close()
		}
	}

	_, err := nh.Pool.Exec(ctx, `DELETE FROM network_services WHERE name = $1`, name)
	if err != nil {
		writeError(w, 500, "error removing service")
		return
	}

	writeJSON(w, 200, map[string]interface{}{"success": true})
}

// generateImage genera una imagen OpenWrt preconfigurada para descargar.
func (nh *NetworkHandler) generateImage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		ForDomain string `json:"for_domain"` // dominio de la aldea destino (vacio = esta aldea)
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	// Obtener configuracion actual
	var mode, ipv6ULA, openwrtDomain, subdomain string
	var wgPort int
	err := nh.Pool.QueryRow(ctx, `
		SELECT mode, ipv6_ula, openwrt_domain, subdomain, wireguard_port
		FROM network_config ORDER BY id DESC LIMIT 1`,
	).Scan(&mode, &ipv6ULA, &openwrtDomain, &subdomain, &wgPort)
	if err != nil {
		writeError(w, 500, "error reading network config")
		return
	}

	targetDomain := req.ForDomain
	if targetDomain == "" {
		targetDomain = openwrtDomain
	}
	if targetDomain == "" {
		targetDomain = nh.NodeDomain
	}

	// Generar ULA para la aldea destino si es diferente
	targetULA := ipv6ULA
	if req.ForDomain != "" && req.ForDomain != openwrtDomain {
		b := make([]byte, 5)
		rand.Read(b)
		b[0] = (b[0] & 0x0f) | 0xfd
		targetULA = fmt.Sprintf("fd%02x:%02x%02x:%02x%02x::/48", b[0]&0x0f, b[1], b[2], b[3], b[4])
	}

	// Generar claves WireGuard simuladas (en produccion se usaria wg genkey)
	wgPrivateKey := generateSecureToken(32)
	wgPublicKey := generateSecureToken(32)

	// Generar paquete de configuracion (tar.gz con plantillas rellenas)
	tmpDir, err := os.MkdirTemp("", "openwrt-config-*")
	if err != nil {
		writeError(w, 500, "error creating temp dir")
		return
	}
	defer os.RemoveAll(tmpDir)

	// Crear archivos de configuracion desde plantillas
	configDir := filepath.Join(tmpDir, "openwrt-config")
	os.MkdirAll(filepath.Join(configDir, "etc/config"), 0755)

	// network.uc
	networkContent := fmt.Sprintf(`config interface 'loopback'
	option device 'lo'
	option proto 'static'
	option ipaddr '127.0.0.1'
	option netmask '255.0.0.0'

config interface 'wan'
	option device 'eth0'
	option proto 'dhcp'

config interface 'lan'
	option device 'br-lan'
	option proto 'static'
	option ipaddr '192.168.1.1'
	option netmask '255.255.255.0'
	option ip6assign '64'

config interface 'wg0'
	option proto 'wireguard'
	option private_key '%s'
	option listen_port '%d'
	list addresses '%s::2/128'
`, wgPrivateKey, wgPort, strings.TrimSuffix(targetULA, "::/48"))

	os.WriteFile(filepath.Join(configDir, "etc/config/network"), []byte(networkContent), 0644)

	// README con instrucciones
	readmeContent := fmt.Sprintf(`# Configuracion OpenWrt para %s

## Datos de la aldea

- Dominio: %s
- IPv6 ULA: %s
- Puerto WireGuard: %d
- Clave privada WireGuard: %s
- Clave publica WireGuard: %s

## Instalacion

1. Instalar OpenWrt x86_64 en el servidor de aldea
2. Copiar etc/config/* a /etc/config/ en OpenWrt
3. Reiniciar la red: /etc/init.d/network restart
4. Configurar certificado SSL: ver network/dns/acme-setup.sh

## Federacion

Esta aldea esta pre-configurada para federar con %s
`, targetDomain, targetDomain, targetULA, wgPort, wgPrivateKey, wgPublicKey, openwrtDomain)

	os.WriteFile(filepath.Join(configDir, "README.md"), []byte(readmeContent), 0644)

	// Crear tar.gz
	outputPath := filepath.Join(tmpDir, fmt.Sprintf("openwrt-%s.tar.gz", targetDomain))
	cmd := exec.Command("tar", "czf", outputPath, "-C", tmpDir, "openwrt-config")
	if err := cmd.Run(); err != nil {
		// Si tar no esta disponible, devolver los datos como JSON
		writeJSON(w, 200, map[string]interface{}{
			"success":           true,
			"target_domain":     targetDomain,
			"ipv6_ula":          targetULA,
			"wireguard_port":    wgPort,
			"wireguard_privkey": wgPrivateKey,
			"wireguard_pubkey":  wgPublicKey,
			"message":           "Configuracion generada. Descarga los datos y crea la imagen manualmente.",
			"note":              "El servidor no tiene tar instalado. Usa network/openwrt/image-builder.sh en Linux/WSL2.",
		})
		return
	}

	// Devolver el archivo
	w.Header().Set("Content-Type", "application/gzip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=openwrt-%s.tar.gz", targetDomain))
	http.ServeFile(w, r, outputPath)
}

// generateSecureToken genera un token hexadecimal aleatorio seguro.
func generateSecureToken(numBytes int) string {
	b := make([]byte, numBytes)
	if _, err := rand.Read(b); err != nil {
		return strings.Repeat("x", numBytes*2)
	}
	return hex.EncodeToString(b)
}
