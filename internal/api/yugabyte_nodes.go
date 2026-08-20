package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// YugabyteNodesHandler maneja los endpoints de nodos YugabyteDB
type YugabyteNodesHandler struct {
	Pool *pgxpool.Pool
}

func NewYugabyteNodesHandler(pool *pgxpool.Pool) *YugabyteNodesHandler {
	return &YugabyteNodesHandler{Pool: pool}
}

func (h *YugabyteNodesHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	r.Group(func(r chi.Router) {
		r.Use(am.RequireAuth)
		r.With(am.RequirePermission("system.manage")).Get("/api/admin/yb-nodes", h.listNodes)
		r.With(am.RequirePermission("system.manage")).Post("/api/admin/yb-nodes", h.createNode)
		r.With(am.RequirePermission("system.manage")).Delete("/api/admin/yb-nodes/{id}", h.deleteNode)
		r.With(am.RequirePermission("system.manage")).Get("/api/admin/yb-nodes/{id}/script", h.downloadScript)
	})
}

type yugabyteNode struct {
	ID        string    `json:"id"`
	NodeName  string    `json:"node_name"`
	HostIP    string    `json:"host_ip"`
	Port      int       `json:"port"`
	Region    string    `json:"region"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

// listNodes lista todos los nodos YugabyteDB
func (h *YugabyteNodesHandler) listNodes(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Pool.Query(r.Context(),
		"SELECT id::text, node_name, host_ip, port, COALESCE(region,''), status, created_at FROM yugabyte_nodes ORDER BY created_at DESC")
	if err != nil {
		writeError(w, 500, "error al listar nodos")
		return
	}
	defer rows.Close()

	var nodes []yugabyteNode
	for rows.Next() {
		var n yugabyteNode
		if err := rows.Scan(&n.ID, &n.NodeName, &n.HostIP, &n.Port, &n.Region, &n.Status, &n.CreatedAt); err != nil {
			continue
		}
		nodes = append(nodes, n)
	}
	if nodes == nil {
		nodes = []yugabyteNode{}
	}
	writeJSON(w, 200, nodes)
}

// createNode crea un nuevo nodo YugabyteDB
func (h *YugabyteNodesHandler) createNode(w http.ResponseWriter, r *http.Request) {
	var req struct {
		NodeName string `json:"node_name"`
		HostIP   string `json:"host_ip"`
		Port     int    `json:"port"`
		Region   string `json:"region"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "JSON invalido")
		return
	}
	if req.NodeName == "" || req.HostIP == "" {
		writeError(w, 400, "nombre y IP son obligatorios")
		return
	}
	if req.Port == 0 {
		req.Port = 7100
	}

	// Obtener la IP del servidor principal (el primer nodo)
	var primaryIP string
	h.Pool.QueryRow(r.Context(), "SELECT host_ip FROM yugabyte_nodes WHERE status = 'active' ORDER BY created_at LIMIT 1").Scan(&primaryIP)
	if primaryIP == "" {
		// Si no hay nodos registrados, usar la IP del servidor actual
		primaryIP = "IP_DEL_SERVIDOR_PRINCIPAL"
	}

	id := uuid.New()
	_, err := h.Pool.Exec(r.Context(),
		"INSERT INTO yugabyte_nodes (id, node_name, host_ip, port, region, status) VALUES ($1, $2, $3, $4, $5, 'pending')",
		id, req.NodeName, req.HostIP, req.Port, req.Region)
	if err != nil {
		writeError(w, 500, "error al crear nodo")
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":         id.String(),
		"node_name":  req.NodeName,
		"host_ip":    req.HostIP,
		"port":       req.Port,
		"region":     req.Region,
		"status":     "pending",
		"primary_ip": primaryIP,
		"message":    "Nodo creado. Descarga el script de instalacion y ejecutalo en el servidor remoto.",
	})
}

// deleteNode elimina un nodo de la lista
func (h *YugabyteNodesHandler) deleteNode(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	_, err := h.Pool.Exec(r.Context(), "DELETE FROM yugabyte_nodes WHERE id = $1", id)
	if err != nil {
		writeError(w, 500, "error al eliminar nodo")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"message": "nodo eliminado"})
}

// downloadScript genera y descarga el script de instalacion del nodo
func (h *YugabyteNodesHandler) downloadScript(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var n yugabyteNode
	err := h.Pool.QueryRow(r.Context(),
		"SELECT id::text, node_name, host_ip, port, COALESCE(region,''), status, created_at FROM yugabyte_nodes WHERE id = $1", id).
		Scan(&n.ID, &n.NodeName, &n.HostIP, &n.Port, &n.Region, &n.Status, &n.CreatedAt)
	if err != nil {
		writeError(w, 404, "nodo no encontrado")
		return
	}

	// Obtener IP del servidor principal
	var primaryIP string
	h.Pool.QueryRow(r.Context(),
		"SELECT host_ip FROM yugabyte_nodes WHERE status = 'active' AND id != $1 ORDER BY created_at LIMIT 1", id).Scan(&primaryIP)
	if primaryIP == "" {
		primaryIP = "IP_DEL_SERVIDOR_PRINCIPAL"
	}

	script := generateYugabyteNodeScript(n, primaryIP)

	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=install_yugabyte_%s.sh", n.NodeName))
	w.Header().Set("Content-Type", "application/x-sh")
	w.Write([]byte(script))
}

// generateYugabyteNodeScript genera el script de instalacion
func generateYugabyteNodeScript(n yugabyteNode, primaryIP string) string {
	region := n.Region
	if region == "" {
		region = "datacenter1"
	}

	return fmt.Sprintf(`#!/bin/bash
# ============================================================
# Script de instalacion de nodo YugabyteDB
# Nodo: %s
# IP: %s
# Puerto: %d
# Region: %s
# Servidor principal: %s
# ============================================================
#
# INSTRUCCIONES:
# 1. Copia este archivo al servidor remoto (scp, USB, etc)
# 2. Ejecuta: chmod +x install_yugabyte_%s.sh
# 3. Ejecuta: sudo ./install_yugabyte_%s.sh
# 4. Espera a que termine. El nodo se unira al cluster automaticamente.
# 5. Los datos se replicaran desde el servidor principal.
#
# REQUISITOS:
# - Sistema operativo Linux (Ubuntu/Debian/CentOS)
# - Acceso a internet
# - Puerto 7100, 9100, 5433, 7000, 9000 abiertos
# - El servidor principal (%s) debe ser accesible desde este servidor
# ============================================================

set -e

echo "========================================"
echo "  Instalacion de nodo YugabyteDB: %s"
echo "========================================"

# 1. Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
fi

echo "Docker encontrado."

# 2. Descargar imagen de YugabyteDB
echo "Descargando imagen YugabyteDB..."
docker pull yugabytedb/yugabyte:latest

# 3. Crear red si no existe
docker network create yb-cluster 2>/dev/null || true

# 4. Arrancar nodo YugabyteDB
echo "Arrancando nodo YugabyteDB..."
echo "  - Hostname: yb-node-%s"
echo "  - IP: %s"
echo "  - Join: %s:%d"
echo "  - Region: %s"

docker run -d \
  --name yb-node-%s \
  --hostname yb-node-%s \
  --net yb-cluster \
  -p 5433:5433 \
  -p 7000:7000 \
  -p 7100:7100 \
  -p 9100:9100 \
  -v yb_node_%s_data:/mnt/master \
  -v yb_node_%s_tserver:/mnt/tserver \
  yugabytedb/yugabyte:latest \
  bin/yugabyted start \
  --base_dir=/mnt/master \
  --daemon=false \
  --advertise_address=%s \
  --join=%s:%d

echo ""
echo "========================================"
echo "  NODO INSTALADO"
echo "========================================"
echo ""
echo "El nodo se esta uniendo al cluster."
echo "Para verificar el estado:"
echo "  docker logs yb-node-%s --tail 20"
echo ""
echo "Para conectar a la base de datos desde este servidor:"
echo "  docker exec yb-node-%s /home/yugabyte/bin/ysqlsh -h 127.0.0.1 -p 5433 -U yugabyte"
echo ""
echo "IMPORTANTE:"
echo "  - El servidor principal (%s) debe tener el puerto 7100 abierto"
echo "  - Este servidor debe tener los puertos 7100, 9100, 5433 abiertos"
echo "  - Si hay firewall, configura las reglas antes de continuar"
echo ""
echo "Para detener el nodo:"
echo "  docker stop yb-node-%s"
echo ""
echo "Para reiniciar el nodo:"
echo "  docker restart yb-node-%s"
echo ""
`,
		n.NodeName, n.HostIP, n.Port, region, primaryIP,
		n.NodeName, n.NodeName, primaryIP,
		n.NodeName,
		n.NodeName, n.HostIP, primaryIP, n.Port, region,
		n.NodeName, n.NodeName,
		n.NodeName, n.NodeName,
		n.HostIP, primaryIP, n.Port,
		n.NodeName,
		n.NodeName,
		primaryIP,
		n.NodeName,
		n.NodeName,
	)
}
