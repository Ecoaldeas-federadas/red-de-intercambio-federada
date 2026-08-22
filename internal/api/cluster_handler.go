package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"federated-credit-node/internal/config"
)

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
	if am != nil {
		r.With(am.RequirePermission("config.manage")).Post("/api/cluster/check", ch.checkCluster)
	} else {
		r.Post("/api/cluster/check", ch.checkCluster)
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

// Context import
var _ = json.Marshal
