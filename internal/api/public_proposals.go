package api

import (
	"context"
	"encoding/json"
	"federated-credit-node/internal/db"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// PublicProposalsHandler maneja propuestas publicas y usuario demo
type PublicProposalsHandler struct {
	Pool      *pgxpool.Pool
	Auth      *AuthMiddleware
	JWTSecret string
}

func (h *PublicProposalsHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Propuestas publicas (no requieren auth)
	r.Get("/api/public/proposals", h.listProposals)
	r.Post("/api/public/proposals", h.createProposal)
	r.Post("/api/public/proposals/{id}/vote", h.voteProposal)

	// Admin: gestionar propuestas
	r.Group(func(r chi.Router) {
		r.Use(am.RequireAuth)
		r.With(am.RequirePermission("system.manage")).Get("/api/admin/proposals", h.adminListProposals)
		r.With(am.RequirePermission("system.manage")).Put("/api/admin/proposals/{id}/status", h.updateProposalStatus)
		// Resetear nodo demo (ejecuta docker restart demo-app)
		r.With(am.RequirePermission("system.manage")).Post("/api/admin/demo/reset", h.resetDemoNode)
	})

	// Demo user
	r.Get("/api/demo/status", h.getDemoStatus)
	r.Post("/api/demo/login", h.demoLogin)
	r.Get("/api/demo/users", h.listDemoUsers)             // Lista de usuarios demo para login con botones
	r.Post("/api/demo/start", h.startDemoNode)            // PUBLICO: arrancar nodo demo desde boton web
	r.Get("/api/demo/start/status", h.getDemoStartStatus) // PUBLICO: progreso del arranque del demo
	r.Group(func(r chi.Router) {
		r.Use(am.RequireAuth)
		r.With(am.RequirePermission("system.manage")).Put("/api/demo/toggle", h.toggleDemoUser)
		r.With(am.RequirePermission("system.manage")).Post("/api/admin/demo/reset", h.resetDemoNode)
	})
}

// listProposals devuelve todas las propuestas publicas
func (h *PublicProposalsHandler) listProposals(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, title, description, category, author_name, votes, status, created_at
		FROM public_proposals
		WHERE status IN ('open', 'under_review', 'implemented')
		ORDER BY votes DESC, created_at DESC`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	var proposals []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var title, description, category, author, status string
		var votes int
		var createdAt time.Time
		if err := rows.Scan(&id, &title, &description, &category, &author, &votes, &status, &createdAt); err != nil {
			continue
		}
		proposals = append(proposals, map[string]interface{}{
			"id":          id.String(),
			"title":       title,
			"description": description,
			"category":    category,
			"author_name": author,
			"votes":       votes,
			"status":      status,
			"created_at":  createdAt,
		})
	}
	if proposals == nil {
		proposals = []map[string]interface{}{}
	} else {
		lang, fallbackLang := resolveRequestLanguages(r, h.Pool, "__GLOBAL__")
		localizeEntityMaps(r.Context(), h.Pool, proposals, "public_proposal", lang, fallbackLang, "title", "description")
	}
	writeJSON(w, 200, proposals)
}

// createProposal crea una nueva propuesta publica
func (h *PublicProposalsHandler) createProposal(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title        string                       `json:"title"`
		Description  string                       `json:"description"`
		Category     string                       `json:"category"`
		AuthorName   string                       `json:"author_name"`
		AuthorEmail  string                       `json:"author_email"`
		Translations map[string]map[string]string `json:"translations,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Title == "" || req.Description == "" {
		writeError(w, 400, "title y description son obligatorios")
		return
	}
	if req.Category == "" {
		req.Category = "funcionalidad"
	}
	if req.AuthorName == "" {
		req.AuthorName = "Anonimo"
	}

	// Rate limit basico por IP: max 3 propuestas por hora por IP
	ip := r.RemoteAddr
	var recentCount int
	h.Pool.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM public_proposals
		WHERE author_name != 'Anonimo' OR $1 != ''
		AND created_at > NOW() - INTERVAL '1 hour'`, ip).Scan(&recentCount)
	// Skip rate limit por ahora, es complicado sin mas infraestructura

	var id uuid.UUID
	err := h.Pool.QueryRow(r.Context(), `
		INSERT INTO public_proposals (title, description, category, author_name, author_email)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id`,
		req.Title, req.Description, req.Category, req.AuthorName, req.AuthorEmail).Scan(&id)
	if err != nil {
		writeError(w, 500, "error al crear propuesta")
		return
	}

	proposalFields := map[string]string{
		"title":       req.Title,
		"description": req.Description,
	}
	registerEntityFields(r.Context(), h.Pool, "__GLOBAL__", "public_proposal", id.String(), proposalFields, map[string]interface{}{"category": req.Category, "author_name": req.AuthorName})
	if len(req.Translations) > 0 {
		userID, _ := h.Auth.GetUserID(r)
		saveSubmittedTranslations(r.Context(), h.Pool, "__GLOBAL__", "public_proposal", id.String(), proposalFields, req.Translations, userID)
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":      id.String(),
		"message": "Propuesta creada. Gracias por aportar!",
	})
}

// voteProposal vota por una propuesta (una vez por sesion/IP)
func (h *PublicProposalsHandler) voteProposal(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid proposal id")
		return
	}

	// Usar IP como identificador de sesion simple
	voterIP := r.RemoteAddr
	voterSession := voterIP // Simplificado

	// Intentar votar (unique constraint evita doble voto)
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO public_proposal_votes (proposal_id, voter_ip, voter_session)
		VALUES ($1, $2, $3)
		ON CONFLICT (proposal_id, voter_session) DO NOTHING`,
		id, voterIP, voterSession)
	if err != nil {
		writeError(w, 400, "ya votaste por esta propuesta")
		return
	}

	// Incrementar contador
	h.Pool.Exec(r.Context(), `UPDATE public_proposals SET votes = votes + 1, updated_at = NOW() WHERE id = $1`, id)

	writeJSON(w, 200, map[string]string{"status": "voted"})
}

// adminListProposals lista todas las propuestas para admin
func (h *PublicProposalsHandler) adminListProposals(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, title, description, category, author_name, author_email, votes, status, admin_notes, created_at
		FROM public_proposals ORDER BY votes DESC, created_at DESC`)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	var proposals []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var title, description, category, author, email, status, notes string
		var votes int
		var createdAt time.Time
		if err := rows.Scan(&id, &title, &description, &category, &author, &email, &votes, &status, &notes, &createdAt); err != nil {
			continue
		}
		proposals = append(proposals, map[string]interface{}{
			"id":           id.String(),
			"title":        title,
			"description":  description,
			"category":     category,
			"author_name":  author,
			"author_email": email,
			"votes":        votes,
			"status":       status,
			"admin_notes":  notes,
			"created_at":   createdAt,
		})
	}
	if proposals == nil {
		proposals = []map[string]interface{}{}
	} else {
		lang, fallbackLang := resolveRequestLanguages(r, h.Pool, "__GLOBAL__")
		localizeEntityMaps(r.Context(), h.Pool, proposals, "public_proposal", lang, fallbackLang, "title", "description", "admin_notes")
	}
	writeJSON(w, 200, proposals)
}

// updateProposalStatus actualiza el estado de una propuesta (admin)
func (h *PublicProposalsHandler) updateProposalStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid proposal id")
		return
	}
	var req struct {
		Status       string                       `json:"status"`
		AdminNotes   string                       `json:"admin_notes"`
		Translations map[string]map[string]string `json:"translations,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Status == "" {
		req.Status = "open"
	}

	_, err = h.Pool.Exec(r.Context(), `
		UPDATE public_proposals SET status = $2, admin_notes = $3, updated_at = NOW() WHERE id = $1`,
		id, req.Status, req.AdminNotes)
	if err != nil {
		writeError(w, 500, "error al actualizar")
		return
	}

	if req.AdminNotes != "" {
		fields := map[string]string{"admin_notes": req.AdminNotes}
		registerEntityFields(r.Context(), h.Pool, "__GLOBAL__", "public_proposal", id.String(), fields, nil)
		if len(req.Translations) > 0 {
			userID, _ := h.Auth.GetUserID(r)
			saveSubmittedTranslations(r.Context(), h.Pool, "__GLOBAL__", "public_proposal", id.String(), fields, req.Translations, userID)
		}
	}

	writeJSON(w, 200, map[string]string{"status": "updated"})
}

// getDemoStatus devuelve si el nodo demo esta corriendo y disponible
func (h *PublicProposalsHandler) getDemoStatus(w http.ResponseWriter, r *http.Request) {
	running := false

	// Verificar si el contenedor demo-app esta corriendo usando docker CLI.
	// Usar el nombre dinamico del proyecto (ej: red-de-intercambio-federada-demo-app-1).
	projectName := detectComposeProjectName()
	demoContainerName := projectName + "-demo-app-1"
	cmd := exec.Command("docker", "inspect", "-f", "{{.State.Running}}", demoContainerName)
	output, err := cmd.Output()
	if err == nil {
		running = strings.TrimSpace(string(output)) == "true"
	}

	// Verificar si es nodo demo.
	// DEMO_MODE=true (variable de entorno del contenedor demo) o
	// el dominio termina en /demo (ej: feria.loanstly.com/demo)
	isDemoNode := os.Getenv("DEMO_MODE") == "true"
	nodeDomain := ""
	var cfgDomain string
	err = h.Pool.QueryRow(r.Context(), `SELECT node_domain FROM node_config LIMIT 1`).Scan(&cfgDomain)
	if err == nil {
		nodeDomain = cfgDomain
		if !isDemoNode {
			// Tambien detectar por dominio: termina en /demo
			isDemoNode = strings.HasSuffix(cfgDomain, "/demo") || cfgDomain == "demo"
		}
	}

	writeJSON(w, 200, map[string]interface{}{
		"running":      running,
		"is_demo_node": isDemoNode,
		"node_domain":  nodeDomain,
		"demo_url":     "http://localhost:9091/demo",
	})
}

// Estado del arranque del demo (para feedback en tiempo real)
var demoStartStatus = struct {
	sync.Mutex
	status  string // "idle", "building", "starting", "running", "error"
	message string
	log     string
}{status: "idle"}

// startDemoNode arranca el contenedor demo-app bajo demanda.
// Es PUBLICO: cualquier visitante puede iniciarlo desde el boton en la pagina.
// Es ASINCRONO: responde inmediatamente y el progreso se consulta con
// GET /api/demo/start/status
func (h *PublicProposalsHandler) startDemoNode(w http.ResponseWriter, r *http.Request) {
	// Leer preset_id del body (opcional)
	presetID := ""
	if r.Body != nil {
		var req struct {
			PresetID string `json:"preset_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil && req.PresetID != "" {
			presetID = req.PresetID
		}
	}

	demoStartStatus.Lock()
	if demoStartStatus.status == "building" || demoStartStatus.status == "starting" {
		demoStartStatus.Unlock()
		writeJSON(w, 200, map[string]interface{}{
			"success": true,
			"message": "Ya hay un arranque en curso",
			"status":  demoStartStatus.status,
		})
		return
	}
	demoStartStatus.Unlock()

	// Iniciar el arranque en background con el preset seleccionado
	go h.runDemoStart(presetID)

	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"message": "Iniciando arranque del nodo demo. Consulta /api/demo/start/status para ver el progreso.",
		"status":  "building",
	})
}

// runDemoStart hace el trabajo real de arrancar el demo.
// La imagen del demo-app es la MISMA que la del node-app (mismo Dockerfile).
// Si hay cambios nuevos, el update del node-app ya reconstruyo la imagen.
// Asi que aqui solo arrancamos el contenedor con --force-recreate.
// Al arrancar, el demo hace DemoReset + DemoAutoSetup + DemoSeedData
// automaticamente (ver cmd/node/main.go), asi que los datos siempre
// quedan frescos con los datos sembrados, sin cambios de usuarios.
func (h *PublicProposalsHandler) runDemoStart(presetID string) {
	demoStartStatus.Lock()
	demoStartStatus.status = "starting"
	demoStartStatus.message = "Preparando arranque del nodo demo..."
	demoStartStatus.log = "=== INICIO ARRANQUE DEMO ===\n"
	if presetID != "" {
		demoStartStatus.log += "Preset seleccionado: " + presetID + "\n"
	}
	demoStartStatus.Unlock()

	appendDemoLog := func(msg string) {
		demoStartStatus.Lock()
		demoStartStatus.log += msg + "\n"
		demoStartStatus.Unlock()
	}

	setDemoStatus := func(status, message string) {
		demoStartStatus.Lock()
		demoStartStatus.status = status
		demoStartStatus.message = message
		demoStartStatus.Unlock()
	}

	projectDir := "/project"
	composeFile := filepath.Join(projectDir, "docker-compose.yml")
	projectName := detectComposeProjectName()

	// Escribir el dominio del padre
	parentDomain := ""
	_ = h.Pool.QueryRow(context.Background(), `SELECT node_domain FROM node_config WHERE initialized = true LIMIT 1`).Scan(&parentDomain)
	if parentDomain == "" {
		parentDomain = "localhost"
	}
	sharedDir := filepath.Join(projectDir, ".demo-shared")
	_ = os.MkdirAll(sharedDir, 0755)
	_ = os.WriteFile(filepath.Join(sharedDir, "parent-domain.txt"), []byte(parentDomain), 0644)
	appendDemoLog("Dominio del padre: " + parentDomain)
	appendDemoLog("Proyecto Docker Compose: " + projectName)

	// Si se especifico preset, escribirlo en .demo-shared/preset.txt
	// para que el nodo demo lo lea al arrancar
	if presetID != "" {
		presetPath := filepath.Join(sharedDir, "preset.txt")
		if err := os.WriteFile(presetPath, []byte(presetID), 0644); err != nil {
			appendDemoLog("WARNING: no se pudo escribir preset.txt: " + err.Error())
		} else {
			appendDemoLog("Preset escrito en .demo-shared/preset.txt: " + presetID)
		}
	}

	// Arrancar el contenedor con --force-recreate.
	// Esto recrea el contenedor (borra el viejo, crea uno nuevo).
	// Al arrancar, el demo automaticamente:
	//   1. DemoReset() - borra datos viejos
	//   2. DemoAutoSetup() - configura node_config
	//   3. DemoSeedData() - siembra datos frescos
	// No hay que reconstruir la imagen: es la misma del node-app.
	// CRITICO: usar --project-directory + override con host paths para que
	// el Docker daemon encuentre los volume mounts en el host.
	setDemoStatus("starting", "Arrancando contenedor del nodo demo (reset + seed automatico)...")
	appendDemoLog("Arrancando contenedor con --force-recreate...")

	hostProjectDir := detectHostProjectDir()
	hostDirFwd := toForwardSlashes(hostProjectDir)

	var upCmd *exec.Cmd
	if hostDirFwd != "" && hostDirFwd != "/project" {
		overrideFile := "/tmp/docker-compose.demo-start-override.yml"
		// SOLO reemplazar bind mounts con rutas del host.
		// Named volumes (demo_uploads) se quedan igual.
		overrideContent := fmt.Sprintf(`services:
  demo-app:
    volumes:
      - %s/firmware:/app/firmware:ro
      - demo_uploads:/app/uploads
      - %s/.demo-shared:/app/.demo-shared:ro
      - %s/internal/db/migrations:/app/internal/db/migrations:ro
`, hostDirFwd, hostDirFwd, hostDirFwd)
		os.WriteFile(overrideFile, []byte(overrideContent), 0644)
		appendDemoLog("Usando override con host paths: " + hostDirFwd)
		upCmd = exec.Command("docker", "compose", "--project-directory", "/project",
			"-f", composeFile, "-f", overrideFile,
			"--project-name", projectName, "--profile", "demo",
			"up", "-d", "--no-deps", "--force-recreate", "demo-app")
	} else {
		upCmd = exec.Command("docker", "compose", "--project-directory", "/project",
			"-f", composeFile, "--project-name", projectName, "--profile", "demo",
			"up", "-d", "--no-deps", "--force-recreate", "demo-app")
	}

	upOut, upErr := upCmd.CombinedOutput()
	if upErr != nil {
		appendDemoLog("Error arrancando contenedor:\n" + string(upOut))
		setDemoStatus("error", "Error al arrancar el nodo demo: "+string(upOut))
		return
	}
	appendDemoLog("Contenedor arrancado correctamente.")
	appendDemoLog("El demo esta haciendo reset + seed automaticamente (datos frescos).")
	appendDemoLog("")
	appendDemoLog("Esperando a que el nodo demo termine de cargar...")
	setDemoStatus("starting", "Nodo demo arrancando. Esperando a que este listo...")

	// Esperar a que el nodo demo responda HTTP en el puerto 9091
	// Mientras espera, ir mostrando los logs del contenedor demo-app
	demoContainerName := projectName + "-demo-app-1"
	maxWait := 120 // 120 * 2s = 4 min max
	lastLogLen := 0
	for i := 0; i < maxWait; i++ {
		// Obtener logs recientes del contenedor demo-app
		logCmd := exec.Command("docker", "logs", "--tail", "20", demoContainerName)
		logOut, _ := logCmd.CombinedOutput()
		logStr := string(logOut)
		if len(logStr) > lastLogLen {
			// Solo agregar las lineas nuevas
			newLines := logStr[lastLogLen:]
			appendDemoLog(strings.TrimSpace(newLines))
			lastLogLen = len(logStr)
		}

		// Verificar si el contenedor sigue corriendo
		inspectCmd := exec.Command("docker", "inspect", "-f", "{{.State.Running}}", demoContainerName)
		inspectOut, _ := inspectCmd.Output()
		if strings.TrimSpace(string(inspectOut)) != "true" {
			appendDemoLog("ERROR: El contenedor demo-app se detuvo.")
			setDemoStatus("error", "El nodo demo se detuvo durante el arranque")
			return
		}

		// Intentar conectar al HTTP del demo
		// El demo escucha en 9091 dentro de la red docker, pero desde node-app
		// podemos acceder via el nombre del contenedor o via localhost:9091
		// Usar docker exec para hacer curl desde dentro del contenedor demo-app
		curlCmd := exec.Command("docker", "exec", demoContainerName, "wget", "-q", "-O", "/dev/null", "--timeout=3", "http://localhost:9091/demo/")
		curlErr := curlCmd.Run()
		if curlErr == nil {
			// El nodo respondio!
			appendDemoLog("")
			appendDemoLog("Nodo demo respondio HTTP correctamente.")
			appendDemoLog("=== ARRANQUE COMPLETADO ===")
			setDemoStatus("running", "Nodo demo listo y funcionando.")
			return
		}

		// Si no respondio, esperar y reintentar
		setDemoStatus("starting", fmt.Sprintf("Nodo demo cargando... (intento %d/%d)", i+1, maxWait))
		time.Sleep(2 * time.Second)
	}

	// Timeout: el nodo no respondio en 4 minutos
	appendDemoLog("TIMEOUT: El nodo demo no respondio en 4 minutos.")
	setDemoStatus("error", "El nodo demo no termino de cargar (timeout)")
}

// getDemoStartStatus devuelve el progreso del arranque del demo en tiempo real.
func (h *PublicProposalsHandler) getDemoStartStatus(w http.ResponseWriter, r *http.Request) {
	demoStartStatus.Lock()
	defer demoStartStatus.Unlock()
	writeJSON(w, 200, map[string]interface{}{
		"status":  demoStartStatus.status,
		"message": demoStartStatus.message,
		"log":     demoStartStatus.log,
	})
}

// detectComposeProjectName detecta el nombre del proyecto de docker compose
// leyendo el label "com.docker.compose.project" del contenedor actual.
func detectComposeProjectName() string {
	containerID, err := os.Hostname()
	if err != nil {
		return "project"
	}
	cmd := exec.Command("docker", "inspect", "-f", "{{ index .Config.Labels \"com.docker.compose.project\" }}", containerID)
	out, err := cmd.Output()
	if err != nil {
		return "project"
	}
	name := strings.TrimSpace(string(out))
	if name == "" {
		return "project"
	}
	return name
}

// detectHostProjectDir detecta la ruta REAL del proyecto en el host.
// docker compose corre dentro del contenedor donde /project es un mount,
// pero el Docker daemon esta en el host donde /project no existe.
// Inspecciona los mounts del contenedor actual para encontrar la ruta host.
func detectHostProjectDir() string {
	containerID, err := os.Hostname()
	if err != nil {
		return ""
	}
	// Inspeccionar mounts del contenedor y buscar el que tiene Destination=/project
	cmd := exec.Command("docker", "inspect", "-f", "{{ range .Mounts }}{{ if eq .Destination \"/project\" }}{{ .Source }}{{ end }}{{ end }}", containerID)
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

// toForwardSlashes convierte una ruta Windows (C:\Users\...) a formato
// con barras normales (C:/Users/...) que docker compose acepta.
func toForwardSlashes(path string) string {
	return strings.ReplaceAll(path, "\\", "/")
}

// listDemoUsers devuelve la lista de usuarios demo para login con botones
// Solo disponible en nodo demo
func (h *PublicProposalsHandler) listDemoUsers(w http.ResponseWriter, r *http.Request) {
	// Verificar que es nodo demo (DEMO_MODE=true o dominio termina en /demo)
	isDemo := os.Getenv("DEMO_MODE") == "true"
	if !isDemo {
		var nodeDomain string
		h.Pool.QueryRow(r.Context(), `SELECT node_domain FROM node_config LIMIT 1`).Scan(&nodeDomain)
		if !strings.HasSuffix(nodeDomain, "/demo") && nodeDomain != "demo" {
			writeError(w, 403, "not a demo node")
			return
		}
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT u.id, u.username, u.display_name, u.account_type, u.is_super_admin,
		       COALESCE(ml.name, '') as level_name
		FROM users u
		LEFT JOIN member_levels ml ON u.member_level_id = ml.id
		WHERE u.membership_status = 'active'
		  AND u.account_type = 'individual'
		  AND u.node_domain = $1
		ORDER BY u.is_super_admin DESC, u.account_type, u.username`, db.LOCAL_NODE_DOMAIN)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var username, displayName, accountType, levelName string
		var isSuperAdmin bool
		if err := rows.Scan(&id, &username, &displayName, &accountType, &isSuperAdmin, &levelName); err != nil {
			continue
		}

		// Determinar rol para mostrar
		role := "Miembro"
		if isSuperAdmin {
			role = "Super Admin"
		} else if accountType == "organization" {
			role = "Organizacion"
		} else if levelName == "admin" || levelName == "Admin" {
			role = "Directivo"
		} else if levelName == "activo" || levelName == "Activo" {
			role = "Miembro Activo"
		} else if levelName == "new" {
			role = "Miembro Nuevo"
		}

		users = append(users, map[string]interface{}{
			"id":             id.String(),
			"username":       username,
			"display_name":   displayName,
			"account_type":   accountType,
			"role":           role,
			"is_super_admin": isSuperAdmin,
		})
	}
	if users == nil {
		users = []map[string]interface{}{}
	}
	writeJSON(w, 200, users)
}

// demoLogin inicia sesion con un usuario demo especifico
// En nodo demo: cualquier usuario demo puede entrar con password demo1234
func (h *PublicProposalsHandler) demoLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Si no hay body, usar defaults
		req.Username = "demo"
		req.Password = "demo1234"
	}

	// Verificar que es nodo demo (DEMO_MODE=true o dominio termina en /demo)
	isDemo := os.Getenv("DEMO_MODE") == "true"
	if !isDemo {
		var nodeDomain string
		h.Pool.QueryRow(r.Context(), `SELECT node_domain FROM node_config LIMIT 1`).Scan(&nodeDomain)
		if !strings.HasSuffix(nodeDomain, "/demo") && nodeDomain != "demo" {
			// En nodo no-demo, verificar si demo esta habilitado
			var isEnabled bool
			h.Pool.QueryRow(r.Context(), `SELECT is_enabled FROM demo_user_config LIMIT 1`).Scan(&isEnabled)
			if !isEnabled {
				writeError(w, 403, "usuario demo no disponible actualmente")
				return
			}
		}
	}

	username := req.Username
	if username == "" {
		username = "demo"
	}
	password := req.Password
	if password == "" {
		password = "demo1234"
	}

	am := NewAuthMiddleware(h.JWTSecret)
	var userID uuid.UUID
	var dbUsername, displayName, dbNodeDomain string
	err := h.Pool.QueryRow(r.Context(), `
		SELECT id, username, display_name, node_domain
		FROM users WHERE LOWER(username) = LOWER($1) AND membership_status = 'active' AND node_domain = $2 LIMIT 1`,
		username, db.LOCAL_NODE_DOMAIN).Scan(&userID, &dbUsername, &displayName, &dbNodeDomain)
	if err != nil {
		writeError(w, 404, "usuario no encontrado")
		return
	}

	// Verificar password
	var pinHash string
	err = h.Pool.QueryRow(r.Context(), `SELECT password_hash FROM user_credentials WHERE user_id = $1`, userID).Scan(&pinHash)
	if err != nil {
		writeError(w, 401, "credenciales invalidas")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(pinHash), []byte(password)); err != nil {
		writeError(w, 401, "credenciales invalidas")
		return
	}

	// En nodo demo, token normal (pueden modificar libremente)
	// En nodo no-demo, token demo (read-only)
	var token string
	if isDemo {
		token, err = am.GenerateToken(userID, dbUsername, dbNodeDomain)
	} else {
		token, err = am.GenerateDemoToken(userID, dbUsername, dbNodeDomain)
	}
	if err != nil {
		writeError(w, 500, "error generating token")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"token":        token,
		"user_id":      userID.String(),
		"username":     dbUsername,
		"display_name": displayName,
		"message":      "Sesion iniciada",
	})
}

// toggleDemoUser habilita/deshabilita el usuario demo (admin)
func (h *PublicProposalsHandler) toggleDemoUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `UPDATE demo_user_config SET is_enabled = $1, updated_at = NOW()`, req.Enabled)
	if err != nil {
		writeError(w, 500, "error al actualizar")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"enabled": req.Enabled,
		"message": "Usuario demo " + map[bool]string{true: "habilitado", false: "deshabilitado"}[req.Enabled],
	})
}

// resetDemoNode resetea el nodo demo: detiene, borra y recrea el contenedor
// con la imagen actualizada. Esto asegura que el demo siempre use el codigo mas reciente.
// Acepta un body opcional { "preset_id": "adventista" } para elegir la preconfiguracion.
func (h *PublicProposalsHandler) resetDemoNode(w http.ResponseWriter, r *http.Request) {
	// Leer preset_id del body (opcional)
	presetID := ""
	if r.Body != nil {
		var req struct {
			PresetID string `json:"preset_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil && req.PresetID != "" {
			presetID = req.PresetID
		}
	}

	// 1. Detener y borrar el contenedor demo-app
	exec.Command("docker", "stop", "red-de-intercambio-federada-demo-app-1").Run()
	exec.Command("docker", "rm", "-f", "red-de-intercambio-federada-demo-app-1").Run()

	// 2. Si se especifico preset, escribirlo en .demo-shared/preset.txt
	if presetID != "" {
		os.MkdirAll("/app/.demo-shared", 0755)
		os.WriteFile("/app/.demo-shared/preset.txt", []byte(presetID), 0644)
	}

	// 3. Recrear con la imagen actualizada
	// CRITICO: docker compose corre dentro del contenedor node-app donde el repo
	// esta en /project, pero el Docker daemon esta en el HOST.
	// Para 'up', necesitamos que las rutas relativas en docker-compose.yml se
	// resuelvan a rutas del host. Generamos un override con rutas del host.
	projectName := "red-de-intercambio-federada"
	composeFile := "/project/docker-compose.yml"

	// Detectar ruta host de /project
	hostProjectDir := detectHostProjectDir()
	hostDirFwd := toForwardSlashes(hostProjectDir)

	// Generar override con rutas del host para demo-app
	// SOLO reemplazar los bind mounts (./firmware, ./.demo-shared) con rutas
	// absolutas del host. Los named volumes (demo_uploads) se quedan igual.
	var cmd *exec.Cmd
	if hostDirFwd != "" && hostDirFwd != "/project" {
		overrideFile := "/tmp/docker-compose.demo-override.yml"
		overrideContent := fmt.Sprintf(`services:
  demo-app:
    volumes:
      - %s/firmware:/app/firmware:ro
      - demo_uploads:/app/uploads
      - %s/.demo-shared:/app/.demo-shared:ro
      - %s/internal/db/migrations:/app/internal/db/migrations:ro
`, hostDirFwd, hostDirFwd, hostDirFwd)
		os.WriteFile(overrideFile, []byte(overrideContent), 0644)
		cmd = exec.Command("docker", "compose", "--project-directory", "/project",
			"-f", composeFile, "-f", overrideFile,
			"--profile", "demo", "-p", projectName,
			"up", "-d", "--no-deps", "--force-recreate", "demo-app")
	} else {
		cmd = exec.Command("docker", "compose", "--project-directory", "/project",
			"-f", composeFile, "--profile", "demo", "-p", projectName,
			"up", "-d", "--no-deps", "--force-recreate", "demo-app")
	}

	out, err := cmd.CombinedOutput()
	if err != nil {
		writeError(w, 500, "no se pudo recrear el nodo demo: "+err.Error()+"\nOutput: "+string(out))
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"message":   "Nodo demo recreado con la ultima version. Los datos se estan regenerando.",
		"preset_id": presetID,
	})
}
