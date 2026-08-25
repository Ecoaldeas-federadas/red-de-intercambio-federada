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

// updateNode maneja la actualizacion del nodo desde la web.
//
// Estrategia (en orden de preferencia):
//  1. Delegar al updater-controller si esta corriendo (mejor opcion,
//     sobrevive el reinicio de node-app)
//  2. Si no esta corriendo, intentar construirlo e iniciarlo con
//     docker compose, luego reintentar
//  3. Si no se puede iniciar, lanzar un contenedor desechable que
//     ejecuta do_update.sh (este contenedor sobrevive el reinicio
//     de node-app porque es independiente)
//  4. Si nada funciona, devolver error claro
func (h *UpdateHandler) updateNode(w http.ResponseWriter, r *http.Request) {
	// Bloquear actualizacion en nodo demo
	if os.Getenv("DEMO_MODE") == "true" {
		writeError(w, 403, "No se puede actualizar el nodo demo directamente.")
		return
	}

	// 1. Intentar delegar al updater-controller
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

	// 2. Updater-controller no responde. Intentar construirlo e iniciarlo.
	projectDir := "/project"
	composeFile := filepath.Join(projectDir, "docker-compose.yml")
	projectName := detectComposeProjectName()

	// Verificar que el Dockerfile existe
	dockerfile := filepath.Join(projectDir, "docker", "Dockerfile.updater-controller")
	if _, err := os.Stat(dockerfile); err == nil {
		// Construir el updater-controller
		exec.Command("docker", "compose", "-f", composeFile, "--project-name", projectName,
			"build", "updater-controller").Run()
		// Iniciarlo
		exec.Command("docker", "compose", "-f", composeFile, "--project-name", projectName,
			"up", "-d", "--no-deps", "updater-controller").Run()
		// Esperar a que arranque
		time.Sleep(5 * time.Second)
		// Reintentar conexion
		resp, err = http.Post(updaterControllerURL+"/update", "application/json", nil)
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
	}

	// 3. Updater-controller no disponible. Lanzar contenedor desechable.
	h.updateWithDetachedContainer(w, r, projectName)
}

// updateWithDetachedContainer inicia un contenedor Docker desechable que
// ejecuta do_update.sh. Este contenedor es independiente de node-app,
// por lo que sobrevive cuando node-app se reinicia durante la actualizacion.
// El contenedor escribe el estado a /update-state/update.json (volumen compartido).
func (h *UpdateHandler) updateWithDetachedContainer(w http.ResponseWriter, r *http.Request, projectName string) {
	// Nombre unico para el contenedor
	containerName := fmt.Sprintf("fmc-updater-%d", time.Now().Unix())

	// Lanzar contenedor desechable con alpine + git + docker-cli
	// Monta: docker socket, repo, volumen de estado
	cmd := exec.Command("docker", "run", "-d", "--rm",
		"--name", containerName,
		"-v", "/var/run/docker.sock:/var/run/docker.sock",
		"-v", "/project:/project:rw",
		"-v", "update_state:/update-state",
		"-e", "GIT_TOKEN="+os.Getenv("GIT_TOKEN"),
		"-e", "COMPOSE_PROJECT_NAME="+projectName,
		"--entrypoint", "sh",
		"alpine:3.20",
		"-c",
		// sed: strip CRLF de los scripts shell por si git autocrlf los convirtio
		"apk add --no-cache git docker-cli docker-cli-compose ca-certificates > /dev/null 2>&1 && "+
			"sed -i 's/\\r$//' /project/docker/do_update.sh /project/docker/updater-controller.sh 2>/dev/null; "+
			"sh /project/docker/do_update.sh",
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		// Ultimo recurso: no se puede iniciar ningun contenedor
		writeError(w, 500, fmt.Sprintf(
			"No se pudo iniciar la actualizacion. Ni el updater-controller ni un contenedor desechable pudieron iniciarse. "+
				"Error: %v. Output: %s. "+
				"Actualiza manualmente con: powershell -ExecutionPolicy Bypass -File update.ps1",
			err, string(output)))
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success":          true,
		"message":          "Actualizacion iniciada. El nodo se reiniciara automaticamente cuando termine.",
		"container":        containerName,
		"updater_fallback": true,
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
