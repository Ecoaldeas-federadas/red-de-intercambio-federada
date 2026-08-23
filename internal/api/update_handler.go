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

	// Configurar el remote con token si esta disponible
	h.configureGitAuth(projectDir)

	// git fetch origin main
	fetchCmd := exec.Command("git", "-C", projectDir, "fetch", "origin", "main")
	fetchOut, fetchErr := fetchCmd.CombinedOutput()
	if fetchErr != nil {
		writeJSON(w, 200, map[string]interface{}{
			"updates_available": false,
			"current_commit":    "",
			"message":           "Error al conectar con el repositorio. Verifica el token en .env",
			"fetch_error":       string(fetchOut),
		})
		return
	}

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
	h.setUpdateStatus("running", "Configurando autenticacion con token...", "")
	h.appendLog("=== INICIO ACTUALIZACION ===")

	projectDir := "/project"

	// Configurar autenticacion con token
	h.configureGitAuth(projectDir)
	h.appendLog("Token configurado en remote origin")

	// Verificar que el remote tiene el token
	checkURLCmd := exec.Command("git", "-C", projectDir, "remote", "get-url", "origin")
	checkURLOut, _ := checkURLCmd.Output()
	h.appendLog("Remote URL: " + strings.TrimSpace(string(checkURLOut)))

	// 1. git fetch origin main
	h.setUpdateStatus("running", "Descargando cambios del repositorio (git fetch)...", "")
	fetchCmd := exec.Command("git", "-C", projectDir, "fetch", "origin", "main", "--verbose")
	fetchOut, err := fetchCmd.CombinedOutput()
	h.appendLog("--- git fetch ---\n" + string(fetchOut))
	if err != nil {
		h.setUpdateStatus("error", fmt.Sprintf("Error en git fetch: %v", err), string(fetchOut))
		return
	}
	h.appendLog("git fetch OK")

	// 2. Guardar cambios locales (stash)
	h.setUpdateStatus("running", "Guardando cambios locales (stash)...", "")
	stashCmd := exec.Command("git", "-C", projectDir, "stash", "--include-untracked", "-m", "auto-stash before update")
	stashOut, stashErr := stashCmd.CombinedOutput()
	h.appendLog("--- git stash ---\n" + string(stashOut))
	if stashErr != nil {
		h.appendLog("Stash: no habia cambios locales o error menor (no critico)")
	} else {
		h.appendLog("Stash OK")
	}

	// 3. Reset al origin/main
	h.setUpdateStatus("running", "Aplicando cambios del repositorio (git reset)...", "")
	resetCmd := exec.Command("git", "-C", projectDir, "reset", "--hard", "origin/main")
	resetOut, err := resetCmd.CombinedOutput()
	h.appendLog("--- git reset --hard origin/main ---\n" + string(resetOut))
	if err != nil {
		h.appendLog("Reset fallo, intentando merge...")
		mergeCmd := exec.Command("git", "-C", projectDir, "merge", "origin/main", "-X", "theirs", "--no-edit")
		mergeOut, mergeErr := mergeCmd.CombinedOutput()
		h.appendLog("--- git merge ---\n" + string(mergeOut))
		if mergeErr != nil {
			h.setUpdateStatus("error", fmt.Sprintf("Error al aplicar cambios: %v", mergeErr), string(mergeOut))
			return
		}
	}
	h.appendLog("Cambios del repositorio aplicados")

	// 4. Restaurar cambios locales del stash
	popCmd := exec.Command("git", "-C", projectDir, "stash", "pop", "--quiet")
	popOut, _ := popCmd.CombinedOutput()
	h.appendLog("--- git stash pop ---\n" + string(popOut))

	// Mostrar commit actual
	newCommitCmd := exec.Command("git", "-C", projectDir, "rev-parse", "--short", "HEAD")
	newCommitOut, _ := newCommitCmd.Output()
	h.appendLog("Nuevo commit: " + strings.TrimSpace(string(newCommitOut)))

	h.setUpdateStatus("running", "Reconstruyendo imagen Docker (esto tarda varios minutos)...", "")

	// 5. docker compose build node-app
	buildCmd := exec.Command("docker", "compose", "-f", filepath.Join(projectDir, "docker-compose.yml"), "build", "node-app")
	buildOut, err := buildCmd.CombinedOutput()
	h.appendLog("--- docker compose build ---\n" + string(buildOut))
	if err != nil {
		h.setUpdateStatus("error", fmt.Sprintf("Error al construir imagen: %v", err), string(buildOut))
		return
	}
	h.appendLog("Imagen Docker construida")

	h.setUpdateStatus("running", "Reiniciando nodo...", "")

	// 6. Actualizar servicios instalados (pos-web, etc.)
	h.updateInstalledServices()

	// 7. docker compose up -d node-app
	upCmd := exec.Command("docker", "compose", "-f", filepath.Join(projectDir, "docker-compose.yml"), "up", "-d", "node-app")
	upOut, err := upCmd.CombinedOutput()
	h.appendLog("--- docker compose up ---\n" + string(upOut))
	if err != nil {
		h.setUpdateStatus("error", fmt.Sprintf("Error al reiniciar: %v", err), string(upOut))
		return
	}

	h.appendLog("=== ACTUALIZACION COMPLETADA ===")
	h.setUpdateStatus("completed", "Nodo actualizado y reiniciado correctamente", "")
}

// updateInstalledServices actualiza los servicios instalados despues de un git pull.
func (h *UpdateHandler) updateInstalledServices() {
	rows, err := h.Pool.Query(context.Background(), `SELECT service_id FROM installed_services WHERE status IN ('running', 'stopped', 'error')`)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var svcID string
		rows.Scan(&svcID)
		composePath := findComposeFile(svcID)
		if composePath == "" {
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
	composePath := findComposeFile(serviceID)
	if composePath == "" {
		writeError(w, 400, "no se encontro docker-compose.yml para este servicio")
		return
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

		composePath := findComposeFile(svcID)
		if composePath == "" {
			results = append(results, updateResult{svcID, name, false, "docker-compose.yml no encontrado"})
			failed++
			continue
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

// configureGitAuth configura el remote origin con el token si esta disponible.
func (h *UpdateHandler) configureGitAuth(projectDir string) {
	token := os.Getenv("GIT_TOKEN")
	if token == "" {
		return
	}

	// Construir la URL con token
	// Siempre actualizar el remote con el token actual (puede haber cambiado)
	newURL := fmt.Sprintf("https://%s@github.com/discapacidad5/red-de-intercambio-federada.git", token)

	// Actualizar el remote
	setURLCmd := exec.Command("git", "-C", projectDir, "remote", "set-url", "origin", newURL)
	setURLCmd.Run()

	// Tambien configurar el helper de credenciales para git
	// Esto asegura que git use el token en todas las operaciones
	exec.Command("git", "-C", projectDir, "config", "credential.helper", "store").Run()
}

// context import workaround
var _ = json.Marshal
