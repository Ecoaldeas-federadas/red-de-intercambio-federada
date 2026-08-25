package api

import (
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

// UpdateHandler maneja la actualizacion del nodo y los servicios.
// La actualizacion del nodo se delega al updater-controller (contenedor separado
// que no se reinicia) para que el estado sobreviva el reinicio del node-app.
type UpdateHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func NewUpdateHandler(pool *pgxpool.Pool, nodeDomain string) *UpdateHandler {
	return &UpdateHandler{
		Pool:       pool,
		NodeDomain: nodeDomain,
	}
}

func (h *UpdateHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	r.With(am.RequirePermission("config.manage")).Post("/api/node/update", h.updateNode)
	r.With(am.RequireAuth).Get("/api/node/update-status", h.getUpdateStatus)
	r.With(am.RequireAuth).Get("/api/node/check-updates", h.checkUpdates)
	r.With(am.RequirePermission("config.manage")).Post("/api/services/{serviceID}/update", h.updateService)
	r.With(am.RequirePermission("config.manage")).Post("/api/services/update-all", h.updateAllServices)
}

// updaterControllerURL es la URL del updater-controller en la red docker.
const updaterControllerURL = "http://updater-controller:9110"

// checkUpdates verifica si hay actualizaciones disponibles en el repo git.
// Esto se ejecuta localmente en node-app (no reinicia nada, es seguro).
func (h *UpdateHandler) checkUpdates(w http.ResponseWriter, r *http.Request) {
	projectDir := "/project"
	if _, err := os.Stat(filepath.Join(projectDir, ".git")); err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"updates_available": false,
			"message":           "no se encontro repo git en /project",
			"current_commit":    "",
			"error":             "no_git",
		})
		return
	}

	// Obtener commit actual SIEMPRE (incluso si fetch falla)
	currentCmd := exec.Command("git", "-C", projectDir, "rev-parse", "--short", "HEAD")
	currentOut, _ := currentCmd.Output()
	currentCommit := strings.TrimSpace(string(currentOut))

	// Configurar el remote con token si esta disponible
	h.configureGitAuth(projectDir)

	// git fetch origin main
	fetchCmd := exec.Command("git", "-C", projectDir, "fetch", "origin", "main")
	fetchOut, fetchErr := fetchCmd.CombinedOutput()
	if fetchErr != nil {
		writeJSON(w, 200, map[string]interface{}{
			"updates_available": false,
			"current_commit":    currentCommit,
			"message":           "Error al conectar con el repositorio. Verifica GIT_TOKEN en .env",
			"fetch_error":       string(fetchOut),
			"error":             "fetch_failed",
		})
		return
	}

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
			servicesUpdate = append(servicesUpdate, map[string]interface{}{
				"service_id": svcID,
				"name":       name,
				"can_update": true,
			})
		}
	}

	writeJSON(w, 200, map[string]interface{}{
		"updates_available":   updatesAvailable,
		"current_commit":      currentCommit,
		"new_commits":         newCommits,
		"services_can_update": servicesUpdate,
		"message": map[bool]string{
			true:  "Hay actualizaciones disponibles del nodo",
			false: "El nodo esta actualizado",
		}[updatesAvailable],
	})
}

// updateNode delega la actualizacion al updater-controller.
// El updater-controller es un contenedor separado que no se reinicia,
// por lo que puede reportar el estado incluso despues de que node-app se reinicie.
// Si el updater-controller no esta disponible (ej: nodo recien actualizado pero
// el contenedor updater-controller aun no se ha creado), hace fallback al
// metodo local anterior.
func (h *UpdateHandler) updateNode(w http.ResponseWriter, r *http.Request) {
	// Bloquear actualizacion en nodo demo - se actualiza desde el padre
	if os.Getenv("DEMO_MODE") == "true" {
		writeError(w, 403, "No se puede actualizar el nodo demo directamente. Se actualiza automaticamente cuando se actualiza el nodo padre.")
		return
	}

	// Intentar delegar al updater-controller
	resp, err := http.Post(updaterControllerURL+"/update", "application/json", nil)
	if err == nil {
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		var result map[string]interface{}
		json.Unmarshal(body, &result)
		if resp.StatusCode != 200 {
			writeJSON(w, resp.StatusCode, result)
			return
		}
		writeJSON(w, 200, result)
		return
	}

	// FALLBACK: updater-controller no disponible, hacer actualizacion local
	// Esto pasa cuando el nodo se actualizo por primera vez con update.ps1
	// pero el contenedor updater-controller aun no se ha construido/iniciado.
	// La actualizacion local funciona pero el estado se pierde al reiniciar.
	h.updateNodeLocal(w, r)
}

// updateNodeLocal hace la actualizacion directamente desde node-app.
// Es el metodo anterior que funciona pero pierde el estado al reiniciar.
// Se usa como fallback cuando el updater-controller no esta disponible.
func (h *UpdateHandler) updateNodeLocal(w http.ResponseWriter, r *http.Request) {
	projectDir := "/project"
	composeFile := filepath.Join(projectDir, "docker-compose.yml")
	projectName := detectComposeProjectName()

	// Configurar git auth
	h.configureGitAuth(projectDir)

	// Ejecutar en background
	go func() {
		// 1. git fetch
		exec.Command("git", "-C", projectDir, "fetch", "origin", "main").Run()

		// 2. Abortar merge/rebase pendientes
		exec.Command("git", "-C", projectDir, "merge", "--abort").Run()
		exec.Command("git", "-C", projectDir, "rebase", "--abort").Run()

		// 3. git reset --hard origin/main
		exec.Command("git", "-C", projectDir, "reset", "--hard", "origin/main").Run()
		exec.Command("git", "-C", projectDir, "clean", "-fd").Run()

		// 4. docker compose build node-app
		exec.Command("docker", "compose", "-f", composeFile, "--project-name", projectName, "build", "node-app").Run()

		// 5. docker compose build demo-app (con profile)
		exec.Command("docker", "compose", "-f", composeFile, "--project-name", projectName, "--profile", "demo", "build", "demo-app").Run()

		// 6. docker compose up -d node-app
		exec.Command("docker", "compose", "-f", composeFile, "--project-name", projectName, "up", "-d", "--no-deps", "node-app").Run()

		// 7. Recrear demo-app si estaba corriendo
		demoContainer := projectName + "-demo-app-1"
		out, _ := exec.Command("docker", "inspect", "-f", "{{.State.Running}}", demoContainer).Output()
		if strings.TrimSpace(string(out)) == "true" {
			exec.Command("docker", "stop", demoContainer).Run()
			exec.Command("docker", "rm", "-f", demoContainer).Run()
			exec.Command("docker", "compose", "-f", composeFile, "--project-name", projectName, "--profile", "demo", "up", "-d", "--no-deps", "demo-app").Run()
			exec.Command("docker", "stop", demoContainer).Run()
		}

		// 8. Tambien construir e iniciar updater-controller si existe en compose
		exec.Command("docker", "compose", "-f", composeFile, "--project-name", projectName, "build", "updater-controller").Run()
		exec.Command("docker", "compose", "-f", composeFile, "--project-name", projectName, "up", "-d", "--no-deps", "updater-controller").Run()
	}()

	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"message": "Actualizacion iniciada (modo local). El nodo se reiniciara automaticamente. Nota: el updater-controller se iniciara despues de esta actualizacion.",
	})
}

// getUpdateStatus lee el estado de actualizacion desde el volumen compartido.
// El updater-controller escribe a /update-state/update.json.
// Como el archivo esta en un volumen compartido, sobrevive el reinicio de node-app.
func (h *UpdateHandler) getUpdateStatus(w http.ResponseWriter, r *http.Request) {
	// Leer archivo de estado del volumen compartido
	data, err := os.ReadFile("/update-state/update.json")
	if err != nil {
		// El archivo no existe = no hay actualizacion en curso ni reciente
		writeJSON(w, 200, map[string]interface{}{
			"status":     "idle",
			"message":    "",
			"log":        "",
			"commit":     "",
			"updated_at": time.Time{},
		})
		return
	}

	var status map[string]interface{}
	if err := json.Unmarshal(data, &status); err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"status":  "idle",
			"message": "Error leyendo estado de actualizacion",
			"log":     "",
		})
		return
	}

	// Tambien leer el archivo de log
	logData, _ := os.ReadFile("/update-state/update.log")
	status["log"] = string(logData)

	writeJSON(w, 200, status)
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
