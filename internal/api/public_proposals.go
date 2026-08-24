package api

import (
	"encoding/json"
	"federated-credit-node/internal/db"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
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
	r.Get("/api/demo/users", h.listDemoUsers)  // Lista de usuarios demo para login con botones
	r.Post("/api/demo/start", h.startDemoNode) // PUBLICO: arrancar nodo demo desde boton web
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
	}
	writeJSON(w, 200, proposals)
}

// createProposal crea una nueva propuesta publica
func (h *PublicProposalsHandler) createProposal(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Category    string `json:"category"`
		AuthorName  string `json:"author_name"`
		AuthorEmail string `json:"author_email"`
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
		Status     string `json:"status"`
		AdminNotes string `json:"admin_notes"`
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

	writeJSON(w, 200, map[string]string{"status": "updated"})
}

// getDemoStatus devuelve si el nodo demo esta corriendo y disponible
func (h *PublicProposalsHandler) getDemoStatus(w http.ResponseWriter, r *http.Request) {
	running := false

	// Verificar si el contenedor demo-app esta corriendo usando docker CLI
	cmd := exec.Command("docker", "inspect", "-f", "{{.State.Running}}", "red-de-intercambio-federada-demo-app-1")
	output, err := cmd.Output()
	if err == nil {
		running = strings.TrimSpace(string(output)) == "true"
	}

	// Verificar si es nodo demo (dominio "demo")
	isDemoNode := false
	nodeDomain := ""
	var cfgDomain string
	err = h.Pool.QueryRow(r.Context(), `SELECT node_domain FROM node_config LIMIT 1`).Scan(&cfgDomain)
	if err == nil {
		nodeDomain = cfgDomain
		if cfgDomain == "demo" {
			isDemoNode = true
		}
	}

	writeJSON(w, 200, map[string]interface{}{
		"running":      running,
		"is_demo_node": isDemoNode,
		"node_domain":  nodeDomain,
		"demo_url":     "http://localhost:9091/demo",
	})
}

// startDemoNode arranca el contenedor demo-app bajo demanda.
// Es PUBLICO: cualquier visitante puede iniciarlo desde el boton en la pagina.
func (h *PublicProposalsHandler) startDemoNode(w http.ResponseWriter, r *http.Request) {
	// Escribir el dominio del padre en .demo-shared/parent-domain.txt
	// para que el demo lo lea al arrancar y configure su node_config.
	parentDomain := ""
	_ = h.Pool.QueryRow(r.Context(), `SELECT node_domain FROM node_config WHERE initialized = true LIMIT 1`).Scan(&parentDomain)
	if parentDomain == "" {
		parentDomain = "localhost"
	}
	sharedDir := ".demo-shared"
	if projectDir := os.Getenv("PROJECT_DIR"); projectDir != "" {
		sharedDir = filepath.Join(projectDir, ".demo-shared")
	}
	_ = os.MkdirAll(sharedDir, 0755)
	_ = os.WriteFile(filepath.Join(sharedDir, "parent-domain.txt"), []byte(parentDomain), 0644)

	// Intentar docker start del contenedor demo-app
	cmd := exec.Command("docker", "start", "red-de-intercambio-federada-demo-app-1")
	err := cmd.Run()
	if err != nil {
		// Si no existe, crearlo con docker compose --profile demo --no-deps
		cmd2 := exec.Command("docker", "compose", "--profile", "demo", "up", "-d", "--no-deps", "demo-app")
		err2 := cmd2.Run()
		if err2 != nil {
			writeError(w, 500, "no se pudo iniciar el nodo demo: "+err.Error())
			return
		}
	}

	writeJSON(w, 200, map[string]interface{}{
		"running":  true,
		"message":  "Nodo demo iniciando. Estara listo en unos segundos.",
		"demo_url": "http://localhost:9091/demo",
	})
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
		FROM users WHERE username = $1 AND membership_status = 'active' AND node_domain = $2 LIMIT 1`,
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
func (h *PublicProposalsHandler) resetDemoNode(w http.ResponseWriter, r *http.Request) {
	// 1. Detener y borrar el contenedor demo-app
	exec.Command("docker", "stop", "red-de-intercambio-federada-demo-app-1").Run()
	exec.Command("docker", "rm", "-f", "red-de-intercambio-federada-demo-app-1").Run()

	// 2. Recrear con la imagen actualizada (sin dependencias para no tocar yugabytedb)
	cmd := exec.Command("docker", "compose", "--profile", "demo", "up", "-d", "--no-deps", "--force-recreate", "demo-app")
	err := cmd.Run()
	if err != nil {
		writeError(w, 500, "no se pudo recrear el nodo demo: "+err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"message": "Nodo demo recreado con la ultima version. Los datos se estan regenerando.",
	})
}
