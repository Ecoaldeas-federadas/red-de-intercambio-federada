package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"federated-credit-node/internal/config"
)

func osReadFile(path string) ([]byte, error) {
	return os.ReadFile(path)
}

func splitLines(s string) []string {
	return strings.Split(s, "\n")
}

// ClusterHandler monitorea el estado del cluster YugabyteDB.
// Verifica cuantas tabletas se estan usando, cuantos nodos hay,
// y alerta cuando se necesita agregar un nuevo nodo.
type ClusterHandler struct {
	Pool   *pgxpool.Pool
	Config *config.Config
}

func NewClusterHandler(pool *pgxpool.Pool, cfg *config.Config) *ClusterHandler {
	return &ClusterHandler{Pool: pool, Config: cfg}
}

func (ch *ClusterHandler) RegisterRoutesWithAuth(r chi.Router, am *AuthMiddleware) {
	r.Get("/api/cluster/status", ch.getClusterStatus)
	r.Get("/api/cluster/config", ch.getClusterConfig)
	r.Get("/api/cluster/hardware", ch.getHardwareInfo)
	if am != nil {
		r.With(am.RequirePermission("config.manage")).Post("/api/cluster/check", ch.checkCluster)
		r.With(am.RequirePermission("config.manage")).Put("/api/cluster/config", ch.updateClusterConfig)
	} else {
		r.Post("/api/cluster/check", ch.checkCluster)
		r.Put("/api/cluster/config", ch.updateClusterConfig)
	}
}

// ClusterStatus representa el estado del cluster YugabyteDB
type ClusterStatus struct {
	MinNodes           int          `json:"min_nodes"`
	CurrentNodes       int          `json:"current_nodes"`
	ConfiguredNodes    int          `json:"configured_nodes"`
	NodesNeeded        int          `json:"nodes_needed"`
	TabletsUsed        int          `json:"tablets_used"`
	TabletLimitTotal   int          `json:"tablet_limit_total"`
	TabletLimitPerNode int          `json:"tablet_limit_per_node"`
	TabletUsagePct     float64      `json:"tablet_usage_pct"`
	AlertThreshold     int          `json:"alert_threshold"`
	NeedsMoreNodes     bool         `json:"needs_more_nodes"`
	AlertLevel         string       `json:"alert_level"` // "ok", "warning", "critical"
	AlertMessage       string       `json:"alert_message"`
	NodeDetails        []NodeDetail `json:"node_details"`
	LastChecked        time.Time    `json:"last_checked"`
}

type NodeDetail struct {
	Host       string `json:"host"`
	Configured bool   `json:"configured"`
	Reachable  bool   `json:"reachable"`
	IsLocal    bool   `json:"is_local"`
}

// getClusterStatus devuelve el estado del cluster YugabyteDB
func (ch *ClusterHandler) getClusterStatus(w http.ResponseWriter, r *http.Request) {
	status := ch.calculateStatus(r.Context())
	writeJSON(w, 200, status)
}

// checkCluster fuerza una verificacion del cluster y envia notificaciones
func (ch *ClusterHandler) checkCluster(w http.ResponseWriter, r *http.Request) {
	status := ch.calculateStatus(r.Context())

	// Enviar notificacion si se necesita un nuevo nodo
	if status.NeedsMoreNodes {
		notify := NewNotifyService(ch.Pool)
		notify.NotifyBoard(r.Context(), ch.Config.Node.Domain, "cluster_needs_nodes",
			"Cluster necesita mas nodos",
			fmt.Sprintf("El cluster YugabyteDB necesita %d nodo(s) mas. Tabletas usadas: %d/%d (%.1f%%). %s",
				status.NodesNeeded, status.TabletsUsed, status.TabletLimitTotal, status.TabletUsagePct, status.AlertMessage),
			"/app/settings",
			map[string]interface{}{
				"nodes_needed": status.NodesNeeded,
				"tablets_used": status.TabletsUsed,
				"tablet_limit": status.TabletLimitTotal,
				"tablet_usage": status.TabletUsagePct,
				"alert_level":  status.AlertLevel,
			})
	}

	writeJSON(w, 200, status)
}

// calculateStatus calcula el estado del cluster consultando YugabyteDB
func (ch *ClusterHandler) calculateStatus(ctx context.Context) ClusterStatus {
	cfg := ch.Config.Cluster
	status := ClusterStatus{
		MinNodes:           cfg.MinNodes,
		ConfiguredNodes:    len(cfg.Nodes),
		TabletLimitPerNode: cfg.TabletLimitPerNode,
		AlertThreshold:     cfg.AlertThreshold,
		LastChecked:        time.Now().UTC(),
	}

	// Contar tabletas reales en YugabyteDB
	// yb_tablet_meta es una tabla interna de YugabyteDB
	var tabletsUsed int
	err := ch.Pool.QueryRow(ctx, `SELECT count(*) FROM yb_tablet_meta`).Scan(&tabletsUsed)
	if err != nil {
		// Si no se puede consultar, usar estimacion basada en migraciones
		tabletsUsed = ch.estimateTabletCount(ctx)
	}
	status.TabletsUsed = tabletsUsed

	// Contar nodos activos del cluster
	// En YugabyteDB, se puede consultar yb_cluster_info
	currentNodes := ch.countActiveNodes(ctx)
	status.CurrentNodes = currentNodes

	// Calcular limite total
	status.TabletLimitTotal = currentNodes * cfg.TabletLimitPerNode

	// Calcular porcentaje de uso
	if status.TabletLimitTotal > 0 {
		status.TabletUsagePct = float64(tabletsUsed) * 100.0 / float64(status.TabletLimitTotal)
	}

	// Determinar si se necesitan mas nodos
	status.NodesNeeded = 0
	status.NeedsMoreNodes = false
	status.AlertLevel = "ok"
	status.AlertMessage = ""

	// Verificar minimo de nodos
	if currentNodes < cfg.MinNodes {
		status.NodesNeeded = cfg.MinNodes - currentNodes
		status.NeedsMoreNodes = true
		status.AlertLevel = "critical"
		status.AlertMessage = fmt.Sprintf("El cluster tiene %d nodo(s) pero necesita minimo %d. Agrega %d nodo(s) mas.", currentNodes, cfg.MinNodes, status.NodesNeeded)
	}

	// Verificar umbral de tabletas
	if status.TabletUsagePct >= float64(cfg.AlertThreshold) {
		nodesNeeded := int(status.TabletUsagePct) / 100
		if nodesNeeded < 1 {
			nodesNeeded = 1
		}
		extraNeeded := nodesNeeded - (currentNodes - cfg.MinNodes)
		if extraNeeded > 0 {
			status.NodesNeeded = extraNeeded
			status.NeedsMoreNodes = true
			if status.TabletUsagePct >= 90 {
				status.AlertLevel = "critical"
				status.AlertMessage = fmt.Sprintf("Uso de tabletas al %.1f%%. Necesitas agregar %d nodo(s) inmediatamente.", status.TabletUsagePct, extraNeeded)
			} else {
				status.AlertLevel = "warning"
				status.AlertMessage = fmt.Sprintf("Uso de tabletas al %.1f%%. Considera agregar %d nodo(s) pronto.", status.TabletUsagePct, extraNeeded)
			}
		}
	}

	// Detalles de nodos configurados
	status.NodeDetails = []NodeDetail{}
	for _, node := range cfg.Nodes {
		detail := NodeDetail{
			Host:       node,
			Configured: true,
			IsLocal:    node == ch.Config.Database.Host,
		}
		status.NodeDetails = append(status.NodeDetails, detail)
	}

	return status
}

// countActiveNodes cuenta los nodos activos del cluster
func (ch *ClusterHandler) countActiveNodes(ctx context.Context) int {
	// Intentar consultar yb_cluster_info (tabla interna de YugabyteDB)
	var count int
	err := ch.Pool.QueryRow(ctx, `SELECT count(*) FROM yb_cluster_info`).Scan(&count)
	if err == nil && count > 0 {
		return count
	}

	// Si no se puede consultar, asumir los nodos configurados
	return len(ch.Config.Cluster.Nodes)
}

// estimateTabletCount estima el numero de tabletas contando tablas e indices
func (ch *ClusterHandler) estimateTabletCount(ctx context.Context) int {
	// Cada tabla crea al menos 1 tableta
	// Cada indice crea al menos 1 tableta
	var tableCount int
	_ = ch.Pool.QueryRow(ctx, `
		SELECT count(*) FROM pg_tables WHERE schemaname = 'public'`).Scan(&tableCount)

	var indexCount int
	_ = ch.Pool.QueryRow(ctx, `
		SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'`).Scan(&indexCount)

	return tableCount + indexCount
}

// HardwareInfo info del hardware del servidor
type HardwareInfo struct {
	RAMGB             int    `json:"ram_gb"`
	CPUCores          int    `json:"cpu_cores"`
	RecommendedLimit  int    `json:"recommended_limit"`
	RecommendedMode   string `json:"recommended_mode"`    // "single" o "multi"
	RecommendedMemPct int    `json:"recommended_mem_pct"` // global_memstore_size_percentage
	Recommendation    string `json:"recommendation"`
	NeedsMoreServers  bool   `json:"needs_more_servers"`
	ServersNeeded     int    `json:"servers_needed"`
}

// getHardwareInfo devuelve info del hardware y recomendaciones
func (ch *ClusterHandler) getHardwareInfo(w http.ResponseWriter, r *http.Request) {
	info := HardwareInfo{
		CPUCores: runtime.NumCPU(),
	}

	info.RAMGB = detectSystemRAM()

	// Recomendaciones basadas en hardware
	// Regla: ~100 tabletas por GB de RAM
	// global_memstore_size_percentage: % de RAM para DocDB (escritura)
	//   - 16GB: 10% = 1.6GB para DocDB, ~14GB para backend/OS
	//   - 32GB: 30% = 9.6GB para DocDB
	//   - 8GB:  5%  = 0.4GB para DocDB (muy ajustado)
	//   - 4GB:  no recomendado para produccion
	if info.RAMGB >= 32 {
		info.RecommendedLimit = 2000
		info.RecommendedMode = "single"
		info.RecommendedMemPct = 30
		info.Recommendation = "Tu servidor tiene suficiente RAM para un solo nodo con limite alto (2000 tabletas) y 30% de memoria para DocDB (9.6GB)."
		info.NeedsMoreServers = false
	} else if info.RAMGB >= 16 {
		info.RecommendedLimit = 1000
		info.RecommendedMode = "single"
		info.RecommendedMemPct = 10
		info.Recommendation = "Tu servidor tiene 16GB RAM. Un solo nodo con limite 1000 y 10% de memoria para DocDB (1.6GB). Esto deja ~14GB para el backend, frontend y el OS. Si la base de datos crece mucho, agrega un segundo servidor."
		info.NeedsMoreServers = false
	} else if info.RAMGB >= 8 {
		info.RecommendedLimit = 600
		info.RecommendedMode = "single"
		info.RecommendedMemPct = 5
		info.Recommendation = "Tu servidor tiene 8GB RAM. Un solo nodo con limite 600 y solo 5% de memoria para DocDB (0.4GB). Es ajustado pero funciona. Para crecer, necesitas un servidor con mas RAM."
		info.NeedsMoreServers = false
	} else if info.RAMGB >= 4 {
		info.RecommendedLimit = 400
		info.RecommendedMode = "multi"
		info.RecommendedMemPct = 5
		info.Recommendation = "Tu servidor tiene poca RAM (4GB). No es suficiente para produccion. Usa limite 400 con 5% de memoria para DocDB. Para escalar, NECESITAS un segundo servidor con mas RAM (minimo 8GB, idealmente 16GB)."
		info.NeedsMoreServers = true
		info.ServersNeeded = 1
	} else {
		info.RecommendedLimit = 300
		info.RecommendedMode = "multi"
		info.RecommendedMemPct = 5
		info.Recommendation = "Tu servidor tiene muy poca RAM (menos de 4GB). No es suficiente para YugabyteDB. Necesitas al menos un servidor con 8GB RAM, idealmente 16GB."
		info.NeedsMoreServers = true
		info.ServersNeeded = 1
	}

	writeJSON(w, 200, info)
}

// detectSystemRAM intenta detectar la RAM del sistema en GB
func detectSystemRAM() int {
	// En Linux/Docker, leer /proc/meminfo
	data, err := osReadFile("/proc/meminfo")
	if err == nil {
		lines := string(data)
		// Buscar MemTotal:  16384000 kB
		for _, line := range splitLines(lines) {
			if len(line) > 9 && line[:9] == "MemTotal:" {
				// Parsear el numero
				var kb int
				fmt.Sscanf(line[9:], "%d", &kb)
				if kb > 0 {
					return kb / 1024 / 1024 // kB -> GB
				}
			}
		}
	}
	// Fallback: asumir 16GB
	return 16
}

// ClusterConfigResponse configuracion del cluster guardada en BD
type ClusterConfigResponse struct {
	Mode           string          `json:"mode"` // "single" o "multi"
	TabletLimit    int             `json:"tablet_limit"`
	MinNodes       int             `json:"min_nodes"`
	AlertThreshold int             `json:"alert_threshold"`
	ServerRAMGB    int             `json:"server_ram_gb"`
	MemstorePct    int             `json:"memstore_percentage"`
	Nodes          json.RawMessage `json:"nodes"`
}

// getClusterConfig devuelve la configuracion guardada del cluster
func (ch *ClusterHandler) getClusterConfig(w http.ResponseWriter, r *http.Request) {
	var mode string
	var tabletLimit, minNodes, alertThreshold, serverRAMGB, memstorePct int
	var nodes []byte

	err := ch.Pool.QueryRow(r.Context(), `
		SELECT mode, tablet_limit, min_nodes, alert_threshold, server_ram_gb, memstore_percentage, nodes
		FROM cluster_config WHERE id = 1`).Scan(
		&mode, &tabletLimit, &minNodes, &alertThreshold, &serverRAMGB, &memstorePct, &nodes)
	if err != nil {
		// Si no existe la tabla, devolver defaults
		writeJSON(w, 200, ClusterConfigResponse{
			Mode:           "single",
			TabletLimit:    1000,
			MinNodes:       1,
			AlertThreshold: 80,
			ServerRAMGB:    detectSystemRAM(),
			MemstorePct:    10,
			Nodes:          json.RawMessage(`[{"host":"yugabytedb","port":5433,"is_local":true}]`),
		})
		return
	}

	writeJSON(w, 200, ClusterConfigResponse{
		Mode:           mode,
		TabletLimit:    tabletLimit,
		MinNodes:       minNodes,
		AlertThreshold: alertThreshold,
		ServerRAMGB:    serverRAMGB,
		MemstorePct:    memstorePct,
		Nodes:          json.RawMessage(nodes),
	})
}

// updateClusterConfig actualiza la configuracion del cluster
func (ch *ClusterHandler) updateClusterConfig(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Mode           string          `json:"mode"`
		TabletLimit    int             `json:"tablet_limit"`
		MinNodes       int             `json:"min_nodes"`
		AlertThreshold int             `json:"alert_threshold"`
		ServerRAMGB    int             `json:"server_ram_gb"`
		MemstorePct    int             `json:"memstore_percentage"`
		Nodes          json.RawMessage `json:"nodes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Validar modo
	if req.Mode != "single" && req.Mode != "multi" {
		writeError(w, 400, "mode debe ser 'single' o 'multi'")
		return
	}

	// Validar limite de tabletas segun RAM
	ramGB := req.ServerRAMGB
	if ramGB == 0 {
		ramGB = detectSystemRAM()
	}
	maxLimit := ramGB * 100 // regla: ~100 tabletas por GB de RAM
	if maxLimit < 400 {
		maxLimit = 400
	}
	if req.TabletLimit > maxLimit {
		writeError(w, 400, fmt.Sprintf("limite %d es muy alto para %dGB RAM. Maximo recomendado: %d", req.TabletLimit, ramGB, maxLimit))
		return
	}
	if req.TabletLimit < 100 {
		writeError(w, 400, "limite minimo es 100 tabletas")
		return
	}

	// Validar umbral
	if req.AlertThreshold < 50 || req.AlertThreshold > 95 {
		writeError(w, 400, "umbral debe estar entre 50 y 95")
		return
	}

	// Validar memstore_percentage
	if req.MemstorePct == 0 {
		req.MemstorePct = 10 // default
	}
	if req.MemstorePct < 5 || req.MemstorePct > 85 {
		writeError(w, 400, "memstore_percentage debe estar entre 5 y 85")
		return
	}

	// Si los nodes viene vacio, usar default
	if len(req.Nodes) == 0 || string(req.Nodes) == "null" {
		req.Nodes = json.RawMessage(`[{"host":"yugabytedb","port":5433,"is_local":true}]`)
	}

	_, err := ch.Pool.Exec(r.Context(), `
		INSERT INTO cluster_config (id, mode, tablet_limit, min_nodes, alert_threshold, server_ram_gb, memstore_percentage, nodes, updated_at)
		VALUES (1, $1, $2, $3, $4, $5, $6, $7, NOW())
		ON CONFLICT (id) DO UPDATE SET
			mode = $1, tablet_limit = $2, min_nodes = $3, alert_threshold = $4,
			server_ram_gb = $5, memstore_percentage = $6, nodes = $7, updated_at = NOW()`,
		req.Mode, req.TabletLimit, req.MinNodes, req.AlertThreshold, ramGB, req.MemstorePct, req.Nodes)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("error al guardar config: %v", err))
		return
	}

	// Notificar a administradores
	notify := NewNotifyService(ch.Pool)
	notify.NotifyBoard(r.Context(), ch.Config.Node.Domain, "cluster_config_updated",
		"Configuracion del cluster actualizada",
		fmt.Sprintf("Modo: %s, Limite: %d tabletas, MemDocDB: %d%%, Min nodos: %d, RAM: %dGB. Reinicia YugabyteDB para aplicar los cambios.", req.Mode, req.TabletLimit, req.MemstorePct, req.MinNodes, ramGB),
		"/app/settings?tab=database",
		map[string]interface{}{"mode": req.Mode, "tablet_limit": req.TabletLimit, "memstore_pct": req.MemstorePct})

	writeJSON(w, 200, map[string]interface{}{
		"message":         "Configuracion guardada. Reinicia YugabyteDB para aplicar los cambios.",
		"mode":            req.Mode,
		"tablet_limit":    req.TabletLimit,
		"memstore_pct":    req.MemstorePct,
		"min_nodes":       req.MinNodes,
		"server_ram_gb":   ramGB,
		"needs_restart":   true,
		"restart_command": fmt.Sprintf("docker compose restart yugabytedb (aplica --tserver_flags=max_num_tablets=%d,global_memstore_size_percentage=%d)", req.TabletLimit, req.MemstorePct),
	})
}

// Context import
var _ = json.Marshal
