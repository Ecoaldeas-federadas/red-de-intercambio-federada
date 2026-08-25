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
	r.With(am.RequirePermission("config.manage")).Post("/api/node/cancel-update", h.cancelUpdate)
	r.With(am.RequirePermission("config.manage")).Post("/api/services/{serviceID}/update", h.updateService)
	r.With(am.RequirePermission("config.manage")).Post("/api/services/update-all", h.updateAllServices)
}

// writeUpdateState escribe el estado de actualizacion al volumen compartido.
// Esto asegura que el estado sobreviva reinicios de node-app y recargas de pagina.
func (h *UpdateHandler) writeUpdateState(status, message, commit string) {
	stateDir := "/update-state"
	stateFile := stateDir + "/update.json"
	os.MkdirAll(stateDir, 0755)
	now := time.Now().Format(time.RFC3339)
	state := fmt.Sprintf(`{"status":"%s","message":"%s","commit":"%s","started_at":"%s","completed_at":""}`,
		status, message, commit, now)
	os.WriteFile(stateFile, []byte(state), 0644)
}

// appendUpdateLog agrega una linea al log de actualizacion.
func (h *UpdateHandler) appendUpdateLog(line string) {
	logFile := "/update-state/update.log"
	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintln(f, line)
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

	// Obtener URL del remote (para debug, con token enmascarado)
	remoteCmd := exec.Command("git", "-C", projectDir, "remote", "get-url", "origin")
	remoteOut, _ := remoteCmd.Output()
	remoteURL := strings.TrimSpace(string(remoteOut))
	// Enmascarar token si esta en la URL
	if strings.Contains(remoteURL, "@") {
		parts := strings.SplitN(remoteURL, "://", 2)
		if len(parts) == 2 {
			authParts := strings.SplitN(parts[1], "@", 2)
			if len(authParts) == 2 {
				remoteURL = parts[0] + "://***@" + authParts[1]
			}
		}
	}

	// Configurar el remote con token si esta disponible
	h.configureGitAuth(projectDir)

	// git fetch origin (fetch completo, no solo main, para actualizar todos los refs)
	// Usar --prune para limpiar refs que ya no existen
	fetchCmd := exec.Command("git", "-C", projectDir, "fetch", "origin", "--prune")
	fetchOut, fetchErr := fetchCmd.CombinedOutput()
	fetchOutput := strings.TrimSpace(string(fetchOut))

	if fetchErr != nil {
		writeJSON(w, 200, map[string]interface{}{
			"updates_available": false,
			"current_commit":    currentCommit,
			"remote_url":        remoteURL,
			"message":           "Error al conectar con el repositorio. Verifica GIT_TOKEN en .env",
			"fetch_error":       fetchOutput,
			"fetch_exit_code":   fetchErr.Error(),
			"error":             "fetch_failed",
		})
		return
	}

	// Obtener commits disponibles.
	// Usar origin/main (que deberia estar actualizado despues del fetch completo).
	// Como fallback, tambien probar con FETCH_HEAD por si origin/main no se actualizo.
	logCmd := exec.Command("git", "-C", projectDir, "log", "--oneline", "HEAD..origin/main")
	logOut, _ := logCmd.Output()
	newCommits := strings.TrimSpace(string(logOut))

	// Si origin/main no encontro nada, probar con FETCH_HEAD
	// (git fetch origin main actualiza FETCH_HEAD pero a veces no origin/main)
	if newCommits == "" {
		logCmd2 := exec.Command("git", "-C", projectDir, "log", "--oneline", "HEAD..FETCH_HEAD")
		logOut2, _ := logCmd2.Output()
		newCommits = strings.TrimSpace(string(logOut2))
	}

	// Tambien obtener el commit remoto para comparar
	remoteCommitCmd := exec.Command("git", "-C", projectDir, "rev-parse", "--short", "origin/main")
	remoteCommitOut, _ := remoteCommitCmd.Output()
	remoteCommit := strings.TrimSpace(string(remoteCommitOut))

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
		"remote_commit":       remoteCommit,
		"new_commits":         newCommits,
		"services_can_update": servicesUpdate,
		"remote_url":          remoteURL,
		"fetch_output":        fetchOutput,
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

	// Verificar si ya hay una actualizacion en curso
	data, _ := os.ReadFile("/update-state/update.json")
	if len(data) > 0 {
		var existing map[string]interface{}
		if json.Unmarshal(data, &existing) == nil {
			if status, ok := existing["status"].(string); ok && status == "running" {
				writeError(w, 409, "Ya hay una actualizacion en curso. Espera a que termine o cancelala.")
				return
			}
		}
	}

	// Escribir estado inicial ANTES de delegar al updater-controller.
	// Esto asegura que el frontend sepa que la actualizacion comenzo,
	// incluso si el updater-controller no responde.
	h.writeUpdateState("running", "Iniciando actualizacion...", "")
	h.appendUpdateLog("=== SOLICITUD DE ACTUALIZACION RECIBIDA ===")

	// 1. Intentar delegar al updater-controller
	resp, err := http.Post(updaterControllerURL+"/update", "application/json", nil)
	if err == nil {
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		var result map[string]interface{}
		json.Unmarshal(body, &result)
		if resp.StatusCode != 200 {
			// El updater-controller respondio pero con error (ej: ya hay update en curso)
			writeJSON(w, resp.StatusCode, result)
			return
		}
		h.appendUpdateLog("Updater-controller acepto la solicitud")
		writeJSON(w, 200, result)
		return
	}
	h.appendUpdateLog(fmt.Sprintf("WARN: updater-controller no responde: %v", err))

	// 2. Updater-controller no responde. Intentar construirlo e iniciarlo.
	projectDir := "/project"
	composeFile := filepath.Join(projectDir, "docker-compose.yml")
	projectName := detectComposeProjectName()

	// Verificar que el Dockerfile existe
	dockerfile := filepath.Join(projectDir, "docker", "Dockerfile.updater-controller")
	if _, err := os.Stat(dockerfile); err == nil {
		h.appendUpdateLog("Intentando construir e iniciar updater-controller...")
		// Construir el updater-controller
		buildOut, _ := exec.Command("docker", "compose", "-f", composeFile, "--project-name", projectName,
			"build", "updater-controller").CombinedOutput()
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
			h.appendUpdateLog("Updater-controller reconstruido y acepto la solicitud")
			writeJSON(w, 200, result)
			return
		}
		h.appendUpdateLog(fmt.Sprintf("WARN: updater-controller sigue sin responder despues de rebuild: %v", err))
		h.appendUpdateLog(fmt.Sprintf("Build output: %s", string(buildOut)))
	}

	// 3. Updater-controller no disponible. Lanzar contenedor desechable.
	h.appendUpdateLog("Fallback: lanzando contenedor desechable...")
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

// cancelUpdate cancela una actualizacion en curso.
// Escribe status "cancelled" al archivo de estado y intenta matar el contenedor desechable.
func (h *UpdateHandler) cancelUpdate(w http.ResponseWriter, r *http.Request) {
	// Leer estado actual
	data, err := os.ReadFile("/update-state/update.json")
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"success": true,
			"message": "No hay actualizacion en curso.",
		})
		return
	}

	var existing map[string]interface{}
	if json.Unmarshal(data, &existing) == nil {
		if status, ok := existing["status"].(string); ok && status != "running" {
			writeJSON(w, 200, map[string]interface{}{
				"success": true,
				"message": "La actualizacion no esta en curso (estado: " + status + ").",
			})
			return
		}
	}

	// Escribir estado cancelado
	h.writeUpdateState("cancelled", "Actualizacion cancelada por el usuario", "")
	h.appendUpdateLog("=== ACTUALIZACION CANCELADA POR EL USUARIO ===")

	// Intentar matar contenedores desechables (fmc-updater-*)
	exec.Command("sh", "-c", "docker ps --format '{{.Names}}' | grep 'fmc-updater-' | xargs -r docker kill").Run()

	// Intentar cancelar en el updater-controller (no tiene endpoint de cancel,
	// pero al menos el do_update.sh verificara el estado y se detendra)
	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"message": "Actualizacion cancelada. El proceso en segundo plano se detendra.",
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
