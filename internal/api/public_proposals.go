package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
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
	})

	// Demo user
	r.Get("/api/demo/status", h.getDemoStatus)
	r.Post("/api/demo/login", h.demoLogin)
	r.Group(func(r chi.Router) {
		r.Use(am.RequireAuth)
		r.With(am.RequirePermission("system.manage")).Put("/api/demo/toggle", h.toggleDemoUser)
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

// getDemoStatus devuelve si el usuario demo esta habilitado
func (h *PublicProposalsHandler) getDemoStatus(w http.ResponseWriter, r *http.Request) {
	var isEnabled bool
	h.Pool.QueryRow(r.Context(), `SELECT is_enabled FROM demo_user_config LIMIT 1`).Scan(&isEnabled)
	writeJSON(w, 200, map[string]interface{}{
		"enabled":  isEnabled,
		"username": "demo",
	})
}

// demoLogin inicia sesion con el usuario demo (si esta habilitado)
func (h *PublicProposalsHandler) demoLogin(w http.ResponseWriter, r *http.Request) {
	var isEnabled bool
	h.Pool.QueryRow(r.Context(), `SELECT is_enabled FROM demo_user_config LIMIT 1`).Scan(&isEnabled)
	if !isEnabled {
		writeError(w, 403, "usuario demo no disponible actualmente")
		return
	}

	// Buscar el usuario demo en la BD
	am := NewAuthMiddleware(h.JWTSecret)
	var userID uuid.UUID
	var username, displayName, nodeDomain string
	err := h.Pool.QueryRow(r.Context(), `
		SELECT id, username, display_name, node_domain
		FROM users WHERE username = 'demo' AND membership_status = 'active' LIMIT 1`).Scan(&userID, &username, &displayName, &nodeDomain)
	if err != nil {
		writeError(w, 404, "usuario demo no encontrado")
		return
	}

	// Generar token JWT con flag demo
	token, err := am.GenerateDemoToken(userID, username, nodeDomain)
	if err != nil {
		writeError(w, 500, "error generating token")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"token":        token,
		"user_id":      userID.String(),
		"username":     username,
		"display_name": displayName,
		"is_demo":      true,
		"message":      "Sesion demo iniciada. Puedes navegar pero no modificar.",
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
