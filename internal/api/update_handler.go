package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UpdateHandler maneja la actualizacion del nodo y los servicios.
type UpdateHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string

	// Estado de la actualizacion (en memoria, no persiste entre reinicios)
	mu            sync.Mutex
	updateStatus  string // "idle", "running", "completed", "error"
	updateMessage string
	updateLog     string
	updatedAt     time.Time
}

func NewUpdateHandler(pool *pgxpool.Pool, nodeDomain string) *UpdateHandler {
	return &UpdateHandler{
		Pool:         pool,
		NodeDomain:   nodeDomain,
		updateStatus: "idle",
	}
}

func (h *UpdateHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	r.With(am.RequirePermission("config.manage")).Post("/api/node/update", h.updateNode)
	r.With(am.RequireAuth).Get("/api/node/update-status", h.getUpdateStatus)
	r.With(am.RequireAuth).Get("/api/node/check-updates", h.checkUpdates)
	r.With(am.RequirePermission("config.manage")).Post("/api/services/{serviceID}/update", h.updateService)
	r.With(am.RequirePermission("config.manage")).Post("/api/services/update-all", h.updateAllServices)
}

// checkUpdates verifica si hay actualizaciones disponibles en el repo git.
func (h *UpdateHandler) checkUpdates(w http.ResponseWriter, r *http.Request) {
	projectDir := "/project"
	if _, err := os.Stat(filepath.Join(projectDir, ".git")); err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"updates_available": false,
			"message":           "no se encontro repo git en /project",
			"current_commit":    "",
		})
		return
	}

	// git fetch origin
	fetchCmd := exec.Command("git", "-C", projectDir, "fetch", "origin")
	fetchCmd.Run()

	// Obtener commit actual
	currentCmd := exec.Command("git", "-C", projectDir, "rev-parse", "HEAD")
	currentOut, _ := currentCmd.Output()
	currentCommit := strings.TrimSpace(string(currentOut))

	// Obtener commits disponibles (HEAD..origin/main)
	logCmd := exec.Command("git", "-C", projectDir, "log", "--oneline", "HEAD..origin/main")
	logOut, _ := logCmd.Output()
	newCommits := strings.TrimSpace(string(logOut))

	updatesAvailable := newCommits != ""

	// Tambien verificar servicios instalados que pueden actualizarse
	servicesUpdate := []map[string]interface{}{}
	rows, err := h.Pool.Query(r.Context(), `SELECT service_id, service_name FROM installed_services WHERE status IN ('running', 'stopped', 'error')`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var svcID, name string
			rows.Scan(&svcID, &name)
			// Para servicios con imagen pre-construida, siempre puede haber update
			// Para servicios construidos (como pos-web), depende del git pull
			servicesUpdate = append(servicesUpdate, map[string]interface{}{
				"service_id": svcID,
				"name":       name,
				"can_update": true,
			})
		}
	}

	writeJSON(w, 200, map[string]interface{}{
		"updates_available":   updatesAvailable,
		"current_commit":      currentCommit[:min(7, len(currentCommit))],
		"new_commits":         newCommits,
		"services_can_update": servicesUpdate,
		"message": map[bool]string{
			true:  "Hay actualizaciones disponibles del nodo",
			false: "El nodo esta actualizado",
		}[updatesAvailable],
	})
}

// updateNode hace git pull + rebuild + restart del nodo (async).
func (h *UpdateHandler) updateNode(w http.ResponseWriter, r *http.Request) {
	h.mu.Lock()
	if h.updateStatus == "running" {
		h.mu.Unlock()
		writeError(w, 409, "ya hay una actualizacion en curso")
		return
	}
	h.updateStatus = "running"
	h.updateMessage = "Iniciando actualizacion..."
	h.updateLog = ""
	h.mu.Unlock()

	go h.runUpdateNode()

	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"message": "Actualizacion iniciada. El nodo se reiniciara automaticamente.",
	})
}

func (h *UpdateHandler) runUpdateNode() {
	h.setUpdateStatus("running", "Haciendo git pull...", "")

	projectDir := "/project"

	// 1. git pull
	pullCmd := exec.Command("git", "-C", projectDir, "pull", "origin", "main")
	pullOut, err := pullCmd.CombinedOutput()
	h.appendLog(string(pullOut))
	if err != nil {
		h.setUpdateStatus("error", fmt.Sprintf("Error en git pull: %v", err), string(pullOut))
		return
	}
	h.setUpdateStatus("running", "Git pull OK. Reconstruyendo imagen Docker...", string(pullOut))

	// 2. docker compose build node-app
	buildCmd := exec.Command("docker", "compose", "-f", filepath.Join(projectDir, "docker-compose.yml"), "build", "node-app")
	buildOut, err := buildCmd.CombinedOutput()
	h.appendLog(string(buildOut))
	if err != nil {
		h.setUpdateStatus("error", fmt.Sprintf("Error al construir: %v", err), string(buildOut))
		return
	}
	h.setUpdateStatus("running", "Imagen construida. Reiniciando nodo...", string(buildOut))

	// 3. Actualizar servicios instalados (pos-web, etc.)
	h.updateInstalledServices(projectDir)

	// 4. docker compose up -d node-app (esto reinicia el nodo)
	upCmd := exec.Command("docker", "compose", "-f", filepath.Join(projectDir, "docker-compose.yml"), "up", "-d", "node-app")
	upOut, err := upCmd.CombinedOutput()
	h.appendLog(string(upOut))
	if err != nil {
		h.setUpdateStatus("error", fmt.Sprintf("Error al reiniciar: %v", err), string(upOut))
		return
	}

	h.setUpdateStatus("completed", "Nodo actualizado y reiniciado correctamente", "")
}

// updateInstalledServices actualiza los servicios instalados despues de un git pull.
func (h *UpdateHandler) updateInstalledServices(projectDir string) {
	rows, err := h.Pool.Query(context.Background(), `SELECT service_id FROM installed_services WHERE status IN ('running', 'stopped', 'error')`)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var svcID string
		rows.Scan(&svcID)
		composePath := filepath.Join(projectDir, "services", svcID, "docker-compose.yml")
		if _, err := os.Stat(composePath); err != nil {
			continue
		}
		// Rebuild + restart
		cmd := exec.Command("docker", "compose", "-f", composePath, "up", "-d", "--build", "--pull", "always")
		cmd.Run()
	}
}

// getUpdateStatus devuelve el estado de la actualizacion.
func (h *UpdateHandler) getUpdateStatus(w http.ResponseWriter, r *http.Request) {
	h.mu.Lock()
	defer h.mu.Unlock()
	writeJSON(w, 200, map[string]interface{}{
		"status":     h.updateStatus,
		"message":    h.updateMessage,
		"log":        h.updateLog,
		"updated_at": h.updatedAt,
	})
}

// updateService actualiza un servicio especifico.
func (h *UpdateHandler) updateService(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "serviceID")
	svc := findService(serviceID)
	if svc == nil {
		writeError(w, 404, "servicio no encontrado")
		return
	}

	ctx := r.Context()
	composePath := filepath.Join("services", serviceID, "docker-compose.yml")
	if _, err := os.Stat(composePath); err != nil {
		// Intentar desde /project
		composePath = filepath.Join("/project", "services", serviceID, "docker-compose.yml")
		if _, err := os.Stat(composePath); err != nil {
			writeError(w, 400, "no se encontro docker-compose.yml para este servicio")
			return
		}
	}

	// Para servicios construidos (como pos-web), hacer build
	// Para servicios con imagen pre-construida, hacer pull + up
	cmd := exec.Command("docker", "compose", "-f", composePath, "up", "-d", "--build", "--pull", "always")
	output, err := cmd.CombinedOutput()

	if err != nil {
		_, _ = h.Pool.Exec(ctx, `UPDATE installed_services SET status = 'error', updated_at = NOW() WHERE service_id = $1`, serviceID)
		writeJSON(w, 200, map[string]interface{}{
			"success":    false,
			"service_id": serviceID,
			"message":    fmt.Sprintf("Error al actualizar: %v", err),
			"logs":       string(output),
		})
		return
	}

	_, _ = h.Pool.Exec(ctx, `UPDATE installed_services SET status = 'running', updated_at = NOW() WHERE service_id = $1`, serviceID)

	writeJSON(w, 200, map[string]interface{}{
		"success":    true,
		"service_id": serviceID,
		"message":    fmt.Sprintf("%s actualizado correctamente", svc.Name),
		"logs":       string(output),
	})
}

// updateAllServices actualiza todos los servicios instalados.
func (h *UpdateHandler) updateAllServices(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := h.Pool.Query(ctx, `SELECT service_id, service_name FROM installed_services WHERE status IN ('running', 'stopped', 'error')`)
	if err != nil {
		writeError(w, 500, "error al listar servicios instalados")
		return
	}
	defer rows.Close()

	type updateResult struct {
		ServiceID string `json:"service_id"`
		Name      string `json:"name"`
		Success   bool   `json:"success"`
		Message   string `json:"message"`
	}

	var results []updateResult
	updated := 0
	failed := 0

	for rows.Next() {
		var svcID, name string
		if err := rows.Scan(&svcID, &name); err != nil {
			continue
		}

		composePath := filepath.Join("services", svcID, "docker-compose.yml")
		if _, err := os.Stat(composePath); err != nil {
			composePath = filepath.Join("/project", "services", svcID, "docker-compose.yml")
			if _, err := os.Stat(composePath); err != nil {
				results = append(results, updateResult{svcID, name, false, "docker-compose.yml no encontrado"})
				failed++
				continue
			}
		}

		cmd := exec.Command("docker", "compose", "-f", composePath, "up", "-d", "--build", "--pull", "always")
		output, err := cmd.CombinedOutput()

		if err != nil {
			_, _ = h.Pool.Exec(ctx, `UPDATE installed_services SET status = 'error', updated_at = NOW() WHERE service_id = $1`, svcID)
			results = append(results, updateResult{svcID, name, false, fmt.Sprintf("error: %v", err)})
			failed++
		} else {
			_, _ = h.Pool.Exec(ctx, `UPDATE installed_services SET status = 'running', updated_at = NOW() WHERE service_id = $1`, svcID)
			results = append(results, updateResult{svcID, name, true, "actualizado"})
			updated++
		}
		_ = output
	}

	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"updated": updated,
		"failed":  failed,
		"results": results,
		"message": fmt.Sprintf("%d servicios actualizados, %d errores", updated, failed),
	})
}

// Helpers

func (h *UpdateHandler) setUpdateStatus(status, message, log string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.updateStatus = status
	h.updateMessage = message
	h.updatedAt = time.Now()
	if log != "" {
		h.updateLog += log + "\n"
	}
}

func (h *UpdateHandler) appendLog(log string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.updateLog += log + "\n"
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// context import workaround
var _ = json.Marshal
