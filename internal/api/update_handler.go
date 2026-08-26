package api

import (
	"context"
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
	r.With(am.RequireAuth).Get("/api/node/status", h.getNodeStatus)
	r.With(am.RequireAuth).Get("/api/node/logs", h.getNodeLogs)
	r.With(am.RequirePermission("config.manage")).Post("/api/node/start", h.startNode)
	r.With(am.RequirePermission("config.manage")).Post("/api/node/stop", h.stopNode)
	r.With(am.RequirePermission("config.manage")).Post("/api/node/restart", h.restartNode)
	r.With(am.RequirePermission("config.manage")).Post("/api/services/{serviceID}/update", h.updateService)
	r.With(am.RequirePermission("config.manage")).Post("/api/services/update-all", h.updateAllServices)
	r.With(am.RequireAuth).Get("/api/services/{serviceID}/check-update", h.checkServiceUpdate)
	r.With(am.RequireAuth).Get("/api/services/{serviceID}/update-status", h.getServiceUpdateStatus)
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
func (h *UpdateHandler) updateWithDetachedContainer(w http.ResponseWriter, _ *http.Request, projectName string) {
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

	// Intentar cancelar en el updater-controller via endpoint /cancel
	http.Post(updaterControllerURL+"/cancel", "application/json", nil)

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

// startNode arranca el contenedor node-app via docker compose.
func (h *UpdateHandler) startNode(w http.ResponseWriter, _ *http.Request) {
	projectName := detectComposeProjectName()
	composeFile := "/project/docker-compose.yml"
	out, err := exec.Command("docker", "compose", "-f", composeFile, "--project-name", projectName,
		"up", "-d", "--no-deps", "node-app").CombinedOutput()
	if err != nil {
		writeError(w, 500, "error al arrancar nodo: "+string(out))
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true, "message": "Nodo arrancado"})
}

// stopNode detiene el contenedor node-app via docker compose.
func (h *UpdateHandler) stopNode(w http.ResponseWriter, _ *http.Request) {
	projectName := detectComposeProjectName()
	composeFile := "/project/docker-compose.yml"
	out, err := exec.Command("docker", "compose", "-f", composeFile, "--project-name", projectName,
		"stop", "node-app").CombinedOutput()
	if err != nil {
		writeError(w, 500, "error al detener nodo: "+string(out))
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true, "message": "Nodo detenido"})
}

// restartNode reinicia el contenedor node-app via docker compose.
func (h *UpdateHandler) restartNode(w http.ResponseWriter, _ *http.Request) {
	projectName := detectComposeProjectName()
	composeFile := "/project/docker-compose.yml"
	out, err := exec.Command("docker", "compose", "-f", composeFile, "--project-name", projectName,
		"restart", "node-app").CombinedOutput()
	if err != nil {
		writeError(w, 500, "error al reiniciar nodo: "+string(out))
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true, "message": "Nodo reiniciado"})
}

// getNodeStatus devuelve el estado real del contenedor node-app.
func (h *UpdateHandler) getNodeStatus(w http.ResponseWriter, _ *http.Request) {
	projectName := detectComposeProjectName()
	containerName := projectName + "-node-app-1"
	running := false
	status := "not-found"
	cmd := exec.Command("docker", "inspect", "-f", "{{.State.Running}}|{{.State.Status}}", containerName)
	output, err := cmd.Output()
	if err == nil {
		parts := strings.Split(strings.TrimSpace(string(output)), "|")
		if len(parts) >= 2 {
			running = parts[0] == "true"
			status = parts[1]
		}
	}
	writeJSON(w, 200, map[string]interface{}{
		"running":        running,
		"status":         status,
		"container_name": containerName,
	})
}

// getNodeLogs devuelve los logs recientes del contenedor node-app.
func (h *UpdateHandler) getNodeLogs(w http.ResponseWriter, r *http.Request) {
	projectName := detectComposeProjectName()
	containerName := projectName + "-node-app-1"
	tail := r.URL.Query().Get("tail")
	if tail == "" {
		tail = "200"
	}
	cmd := exec.Command("docker", "logs", "--tail", tail, containerName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"logs":  "No se pudieron obtener logs del nodo: " + err.Error(),
			"error": true,
		})
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"logs":  string(output),
		"error": false,
	})
}

// updateService actualiza un servicio especifico.
// Corre en background (goroutine) y escribe progreso a serviceUpdateStates.
// El frontend hace polling a /services/{id}/update-status para ver el progreso.
func (h *UpdateHandler) updateService(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "serviceID")
	svc := findService(serviceID)
	if svc == nil {
		writeError(w, 404, "servicio no encontrado")
		return
	}

	// Verificar si ya hay una actualizacion en curso para este servicio
	if state, ok := serviceUpdateStates[serviceID]; ok && state.Status == "running" {
		writeError(w, 409, "Ya hay una actualizacion en curso para "+svc.Name)
		return
	}

	composePath := findComposeFile(serviceID)
	if composePath == "" {
		writeError(w, 400, "no se encontro docker-compose.yml para este servicio")
		return
	}

	// Inicializar estado
	writeServiceUpdateState(serviceID, "running", "Iniciando actualizacion de "+svc.Name+"...", "", 5)
	appendServiceUpdateLog(serviceID, "=== INICIO ACTUALIZACION DE "+svc.Name+" ===")
	appendServiceUpdateLog(serviceID, "docker-compose: "+composePath)

	// Lanzar actualizacion en background
	go h.runServiceUpdate(serviceID, svc.Name, composePath)

	writeJSON(w, 200, map[string]interface{}{
		"success":    true,
		"service_id": serviceID,
		"message":    "Actualizacion iniciada. Monitorea el progreso en la consola.",
	})
}

// runServiceUpdate ejecuta la actualizacion de un servicio en background.
func (h *UpdateHandler) runServiceUpdate(serviceID, serviceName, composePath string) {
	ctx := context.Background()

	// Para servicios construidos desde codigo fuente (como pos-web), hacer:
	// 1. down --rmi all (eliminar contenedor viejo + imagen vieja)
	// 2. git pull (actualizar codigo del repo)
	// 3. build --no-cache (reconstruir desde codigo actual)
	// 4. up -d (iniciar con nueva imagen)
	_, isSourceBuilt := serviceSourceDirs[serviceID]

	if isSourceBuilt {
		// Paso 1: git pull para obtener el codigo mas reciente
		writeServiceUpdateState(serviceID, "running", "Descargando cambios del repositorio...", serviceUpdateStates[serviceID].Log, 10)
		appendServiceUpdateLog(serviceID, "--- git fetch + reset ---")
		projectDir := "/project"
		h.configureGitAuth(projectDir)
		fetchCmd := exec.Command("git", "-C", projectDir, "fetch", "origin", "main")
		fetchOutput, fetchErr := fetchCmd.CombinedOutput()
		appendServiceUpdateLog(serviceID, string(fetchOutput))
		if fetchErr != nil {
			appendServiceUpdateLog(serviceID, "WARN: git fetch fallo: "+fetchErr.Error())
		}
		resetCmd := exec.Command("git", "-C", projectDir, "reset", "--hard", "origin/main")
		resetOutput, _ := resetCmd.CombinedOutput()
		appendServiceUpdateLog(serviceID, string(resetOutput))

		// Paso 2: Eliminar contenedor e imagen vieja
		writeServiceUpdateState(serviceID, "running", "Eliminando contenedor e imagen vieja...", serviceUpdateStates[serviceID].Log, 20)
		appendServiceUpdateLog(serviceID, "--- docker compose down --rmi all ---")
		downCmd := exec.Command("docker", "compose", "-f", composePath, "down", "--rmi", "all")
		downOutput, _ := downCmd.CombinedOutput()
		appendServiceUpdateLog(serviceID, string(downOutput))

		// Paso 3: Reconstruir sin cache
		writeServiceUpdateState(serviceID, "running", "Construyendo nueva imagen (esto tarda varios minutos)...", serviceUpdateStates[serviceID].Log, 30)
		appendServiceUpdateLog(serviceID, "--- docker compose build --no-cache ---")
		buildCmd := exec.Command("docker", "compose", "-f", composePath, "build", "--no-cache")
		buildOutput, buildErr := buildCmd.CombinedOutput()
		appendServiceUpdateLog(serviceID, string(buildOutput))
		if buildErr != nil {
			writeServiceUpdateState(serviceID, "error", "Error al construir: "+buildErr.Error(), serviceUpdateStates[serviceID].Log, 30)
			appendServiceUpdateLog(serviceID, "ERROR: build fallo: "+buildErr.Error())
			_, _ = h.Pool.Exec(ctx, `UPDATE installed_services SET status = 'error', updated_at = NOW() WHERE service_id = $1`, serviceID)
			return
		}

		// Paso 4: Iniciar con nueva imagen
		writeServiceUpdateState(serviceID, "running", "Iniciando servicio con nueva imagen...", serviceUpdateStates[serviceID].Log, 90)
		appendServiceUpdateLog(serviceID, "--- docker compose up -d ---")
		upCmd := exec.Command("docker", "compose", "-f", composePath, "up", "-d")
		upOutput, upErr := upCmd.CombinedOutput()
		appendServiceUpdateLog(serviceID, string(upOutput))
		if upErr != nil {
			writeServiceUpdateState(serviceID, "error", "Error al iniciar: "+upErr.Error(), serviceUpdateStates[serviceID].Log, 90)
			appendServiceUpdateLog(serviceID, "ERROR: up fallo: "+upErr.Error())
			_, _ = h.Pool.Exec(ctx, `UPDATE installed_services SET status = 'error', updated_at = NOW() WHERE service_id = $1`, serviceID)
			return
		}
	} else {
		// Servicio con imagen pre-construida: pull + up
		writeServiceUpdateState(serviceID, "running", "Descargando nueva imagen...", serviceUpdateStates[serviceID].Log, 30)
		appendServiceUpdateLog(serviceID, "--- docker compose up -d --build --pull always ---")
		cmd := exec.Command("docker", "compose", "-f", composePath, "up", "-d", "--build", "--pull", "always")
		output, err := cmd.CombinedOutput()
		appendServiceUpdateLog(serviceID, string(output))
		if err != nil {
			writeServiceUpdateState(serviceID, "error", "Error al actualizar: "+err.Error(), serviceUpdateStates[serviceID].Log, 30)
			appendServiceUpdateLog(serviceID, "ERROR: "+err.Error())
			_, _ = h.Pool.Exec(ctx, `UPDATE installed_services SET status = 'error', updated_at = NOW() WHERE service_id = $1`, serviceID)
			return
		}
	}

	// Actualizar BD
	_, _ = h.Pool.Exec(ctx, `UPDATE installed_services SET status = 'running', updated_at = NOW() WHERE service_id = $1`, serviceID)

	writeServiceUpdateState(serviceID, "completed", serviceName+" actualizado correctamente", serviceUpdateStates[serviceID].Log, 100)
	appendServiceUpdateLog(serviceID, "=== ACTUALIZACION COMPLETADA ===")
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

// serviceUpdateStates mantiene el estado de actualizacion por servicio en memoria.
// Como node-app no se reinicia durante la actualizacion de un servicio,
// podemos mantener el estado en memoria sin necesidad de volumenes compartidos.
var serviceUpdateStates = make(map[string]*serviceUpdateState)

type serviceUpdateState struct {
	Status   string `json:"status"` // idle, running, completed, error
	Message  string `json:"message"`
	Log      string `json:"log"`
	Progress int    `json:"progress"`
}

// serviceSourceDirs mapea serviceID -> directorios del repo que contienen su codigo.
// Se usa para verificar si hay cambios en git que afecten al servicio.
var serviceSourceDirs = map[string][]string{
	"pos-web": {"pos/", "docker/Dockerfile.pos", "services/pos-web/"},
}

// checkServiceUpdate verifica si hay actualizaciones disponibles para un servicio.
// Para servicios construidos desde codigo (como pos-web), hace git fetch y compara
// si hay commits nuevos que afecten los directorios del servicio.
func (h *UpdateHandler) checkServiceUpdate(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "serviceID")
	svc := findService(serviceID)
	if svc == nil {
		writeError(w, 404, "servicio no encontrado")
		return
	}

	projectDir := "/project"
	currentCommit := ""
	if cmd := exec.Command("git", "-C", projectDir, "rev-parse", "--short", "HEAD"); true {
		out, _ := cmd.Output()
		currentCommit = strings.TrimSpace(string(out))
	}

	// Configurar git auth
	h.configureGitAuth(projectDir)

	// git fetch
	fetchCmd := exec.Command("git", "-C", projectDir, "fetch", "origin", "main")
	fetchCmd.Run()

	// Obtener commit remoto
	remoteCommit := ""
	if cmd := exec.Command("git", "-C", projectDir, "rev-parse", "--short", "origin/main"); true {
		out, _ := cmd.Output()
		remoteCommit = strings.TrimSpace(string(out))
	}

	// Para servicios construidos desde codigo fuente, verificar si hay cambios
	// en los directorios relevantes
	sourceDirs, isSourceBuilt := serviceSourceDirs[serviceID]

	if isSourceBuilt {
		// Verificar si hay commits que afecten los directorios del servicio
		// Usar git diff para ver que archivos cambiaron entre HEAD y origin/main
		changedFiles := ""
		for _, dir := range sourceDirs {
			cmd := exec.Command("git", "-C", projectDir, "diff", "--name-only", "HEAD", "origin/main", "--", dir)
			out, _ := cmd.Output()
			if len(out) > 0 {
				changedFiles += strings.TrimSpace(string(out)) + "\n"
			}
		}

		updatesAvailable := strings.TrimSpace(changedFiles) != ""

		writeJSON(w, 200, map[string]interface{}{
			"service_id":        serviceID,
			"updates_available": updatesAvailable,
			"current_commit":    currentCommit,
			"remote_commit":     remoteCommit,
			"changed_files":     strings.TrimSpace(changedFiles),
			"source_built":      true,
			"message": map[bool]string{
				true:  "Hay cambios en el codigo del servicio",
				false: "El servicio esta actualizado",
			}[updatesAvailable],
		})
		return
	}

	// Para servicios con imagen pre-construida, no podemos verificar facilmente
	// sin hacer docker pull. Devolver que es un servicio con imagen externa.
	writeJSON(w, 200, map[string]interface{}{
		"service_id":        serviceID,
		"updates_available": false,
		"current_commit":    currentCommit,
		"remote_commit":     remoteCommit,
		"source_built":      false,
		"message":           "Servicio con imagen externa. Usa 'Actualizar' para forzar descarga de nueva imagen.",
	})
}

// getServiceUpdateStatus devuelve el estado de actualizacion de un servicio.
func (h *UpdateHandler) getServiceUpdateStatus(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "serviceID")
	state, ok := serviceUpdateStates[serviceID]
	if !ok {
		writeJSON(w, 200, map[string]interface{}{
			"status":   "idle",
			"message":  "",
			"log":      "",
			"progress": 0,
		})
		return
	}
	writeJSON(w, 200, state)
}

// writeServiceUpdateState escribe el estado de actualizacion de un servicio.
func writeServiceUpdateState(serviceID, status, message, log string, progress int) {
	serviceUpdateStates[serviceID] = &serviceUpdateState{
		Status:   status,
		Message:  message,
		Log:      log,
		Progress: progress,
	}
}

// appendServiceUpdateLog agrega una linea al log de actualizacion del servicio.
func appendServiceUpdateLog(serviceID, line string) {
	state, ok := serviceUpdateStates[serviceID]
	if !ok {
		state = &serviceUpdateState{}
		serviceUpdateStates[serviceID] = state
	}
	state.Log += line + "\n"
}
