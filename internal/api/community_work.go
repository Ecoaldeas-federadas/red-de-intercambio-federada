package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CommunityWorkHandler maneja el registro de trabajo comunitario (cayapa/minga).
type CommunityWorkHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func (h *CommunityWorkHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Sesiones de trabajo
	r.Get("/api/community-work/sessions", h.listSessions)
	r.Get("/api/community-work/sessions/{id}", h.getSession)
	r.With(am.RequirePermission("ledger.write")).Post("/api/community-work/sessions", h.createSession)
	r.With(am.RequirePermission("ledger.write")).Put("/api/community-work/sessions/{id}", h.updateSession)
	r.With(am.RequirePermission("ledger.approve")).Post("/api/community-work/sessions/{id}/approve", h.approveSession)

	// Tareas
	r.Get("/api/community-work/sessions/{id}/tasks", h.listTasks)
	r.With(am.RequirePermission("ledger.write")).Post("/api/community-work/sessions/{id}/tasks", h.createTask)

	// Participantes
	r.Get("/api/community-work/sessions/{id}/participants", h.listParticipants)
	r.With(am.RequirePermission("ledger.write")).Post("/api/community-work/sessions/{id}/participants", h.addParticipant)
	r.With(am.RequirePermission("ledger.write")).Delete("/api/community-work/sessions/{id}/participants/{userId}", h.removeParticipant)
	r.With(am.RequirePermission("ledger.approve")).Post("/api/community-work/sessions/{id}/participants/{userId}/credit", h.creditParticipant)

	// Habilidades de usuarios
	r.Get("/api/community-work/skills", h.listSkills)
	r.With(am.RequireAuth).Post("/api/community-work/skills", h.addSkill)
}

func (h *CommunityWorkHandler) listSessions(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}
	statusFilter := r.URL.Query().Get("status")
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 200 {
			limit = l
		}
	}

	query := `SELECT id, name, description, work_type, session_date, end_date, duration_hours,
		location, valuation_type, tq_per_hour, status, organized_by, approved_by, approved_at,
		requires_approval, outputs, created_at
		FROM community_work_sessions WHERE node_domain = $1`
	args := []interface{}{nodeDomain}
	if statusFilter != "" {
		query += ` AND status = $2`
		args = append(args, statusFilter)
	}
	query += ` ORDER BY session_date DESC LIMIT ` + strconv.Itoa(limit)

	rows, err := h.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeError(w, 500, "error listing sessions")
		return
	}
	defer rows.Close()

	var sessions []map[string]interface{}
	for rows.Next() {
		var id, name, description, workType, location, valuationType, status, outputs *string
		var sessionDate, endDate interface{}
		var durationHours, tqPerHour float64
		var organizedBy, approvedBy *string
		var approvedAt interface{}
		var requiresApproval bool
		var createdAt interface{}
		if err := rows.Scan(&id, &name, &description, &workType, &sessionDate, &endDate, &durationHours,
			&location, &valuationType, &tqPerHour, &status, &organizedBy, &approvedBy, &approvedAt,
			&requiresApproval, &outputs, &createdAt); err != nil {
			continue
		}
		sessions = append(sessions, map[string]interface{}{
			"id":                id,
			"name":              name,
			"description":       description,
			"work_type":         workType,
			"session_date":      sessionDate,
			"end_date":          endDate,
			"duration_hours":    durationHours,
			"location":          location,
			"valuation_type":    valuationType,
			"tq_per_hour":       tqPerHour,
			"status":            status,
			"organized_by":      organizedBy,
			"approved_by":       approvedBy,
			"approved_at":       approvedAt,
			"requires_approval": requiresApproval,
			"outputs":           outputs,
			"created_at":        createdAt,
		})
	}
	writeJSON(w, 200, map[string]interface{}{"sessions": sessions})
}

func (h *CommunityWorkHandler) getSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var name, description, workType, location, valuationType, status, outputs *string
	var sessionDate, endDate interface{}
	var durationHours, tqPerHour float64
	var organizedBy, approvedBy *string
	var approvedAt interface{}
	var requiresApproval bool
	var createdAt interface{}

	err := h.Pool.QueryRow(r.Context(), `
		SELECT name, description, work_type, session_date, end_date, duration_hours,
			location, valuation_type, tq_per_hour, status, organized_by, approved_by, approved_at,
			requires_approval, outputs, created_at
		FROM community_work_sessions WHERE id = $1`, id).
		Scan(&name, &description, &workType, &sessionDate, &endDate, &durationHours,
			&location, &valuationType, &tqPerHour, &status, &organizedBy, &approvedBy, &approvedAt,
			&requiresApproval, &outputs, &createdAt)
	if err != nil {
		writeError(w, 404, "session not found")
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"id":                id,
		"name":              name,
		"description":       description,
		"work_type":         workType,
		"session_date":      sessionDate,
		"end_date":          endDate,
		"duration_hours":    durationHours,
		"location":          location,
		"valuation_type":    valuationType,
		"tq_per_hour":       tqPerHour,
		"status":            status,
		"organized_by":      organizedBy,
		"approved_by":       approvedBy,
		"approved_at":       approvedAt,
		"requires_approval": requiresApproval,
		"outputs":           outputs,
		"created_at":        createdAt,
	})
}

func (h *CommunityWorkHandler) createSession(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var req struct {
		Name             string  `json:"name"`
		Description      string  `json:"description"`
		WorkType         string  `json:"work_type"`
		SessionDate      string  `json:"session_date"`
		EndDate          *string `json:"end_date"`
		DurationHours    float64 `json:"duration_hours"`
		Location         *string `json:"location"`
		ValuationType    string  `json:"valuation_type"`
		TqPerHour        float64 `json:"tq_per_hour"`
		RequiresApproval bool    `json:"requires_approval"`
		DepartmentID     *string `json:"department_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, 400, "name is required")
		return
	}
	if req.WorkType == "" {
		req.WorkType = "cayapa"
	}
	if req.ValuationType == "" {
		req.ValuationType = "hours_only"
	}

	userID, _ := r.Context().Value("user_id").(string)

	var id string
	err := h.Pool.QueryRow(r.Context(), `
		INSERT INTO community_work_sessions (node_domain, department_id, name, description, work_type,
			session_date, end_date, duration_hours, location, valuation_type, tq_per_hour,
			status, organized_by, requires_approval)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'planned', $12, $13)
		RETURNING id::text`,
		nodeDomain, req.DepartmentID, req.Name, req.Description, req.WorkType,
		req.SessionDate, req.EndDate, req.DurationHours, req.Location, req.ValuationType,
		req.TqPerHour, userID, req.RequiresApproval).Scan(&id)
	if err != nil {
		writeError(w, 500, "error creating session: "+err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"id": id, "success": true})
}

func (h *CommunityWorkHandler) updateSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Name          string  `json:"name"`
		Description   string  `json:"description"`
		Status        string  `json:"status"`
		DurationHours float64 `json:"duration_hours"`
		Outputs       *string `json:"outputs"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE community_work_sessions SET
			name = COALESCE(NULLIF($2, ''), name),
			description = COALESCE($3, description),
			status = COALESCE(NULLIF($4, ''), status),
			duration_hours = CASE WHEN $5 > 0 THEN $5 ELSE duration_hours END,
			outputs = $6,
			updated_at = NOW()
		WHERE id = $1`, id, req.Name, req.Description, req.Status, req.DurationHours, req.Outputs)
	if err != nil {
		writeError(w, 500, "error updating session")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *CommunityWorkHandler) approveSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID, _ := r.Context().Value("user_id").(string)

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE community_work_sessions SET status = 'approved', approved_by = $2, approved_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND requires_approval = true AND status NOT IN ('approved', 'cancelled')`, id, userID)
	if err != nil {
		writeError(w, 500, "error approving session")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *CommunityWorkHandler) listTasks(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, name, description, required_skill, people_needed, estimated_hours, status, created_at
		FROM community_work_tasks WHERE session_id = $1 ORDER BY created_at`, sessionID)
	if err != nil {
		writeError(w, 500, "error listing tasks")
		return
	}
	defer rows.Close()

	var tasks []map[string]interface{}
	for rows.Next() {
		var id, name, description, requiredSkill, status *string
		var peopleNeeded int
		var estimatedHours float64
		var createdAt interface{}
		if err := rows.Scan(&id, &name, &description, &requiredSkill, &peopleNeeded, &estimatedHours, &status, &createdAt); err != nil {
			continue
		}
		tasks = append(tasks, map[string]interface{}{
			"id":             id,
			"name":           name,
			"description":    description,
			"required_skill": requiredSkill,
			"people_needed":  peopleNeeded,
			"estimated_hours": estimatedHours,
			"status":         status,
			"created_at":     createdAt,
		})
	}
	writeJSON(w, 200, map[string]interface{}{"tasks": tasks})
}

func (h *CommunityWorkHandler) createTask(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	var req struct {
		Name           string  `json:"name"`
		Description    string  `json:"description"`
		RequiredSkill  *string `json:"required_skill"`
		PeopleNeeded   int     `json:"people_needed"`
		EstimatedHours float64 `json:"estimated_hours"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, 400, "name is required")
		return
	}
	if req.PeopleNeeded < 1 {
		req.PeopleNeeded = 1
	}

	var id string
	err := h.Pool.QueryRow(r.Context(), `
		INSERT INTO community_work_tasks (session_id, name, description, required_skill, people_needed, estimated_hours, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'pending')
		RETURNING id::text`,
		sessionID, req.Name, req.Description, req.RequiredSkill, req.PeopleNeeded, req.EstimatedHours).Scan(&id)
	if err != nil {
		writeError(w, 500, "error creating task: "+err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"id": id, "success": true})
}

func (h *CommunityWorkHandler) listParticipants(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	rows, err := h.Pool.Query(r.Context(), `
		SELECT p.id, p.user_id, u.display_name, p.task_id, p.hours_worked, p.tq_credited, p.skills, p.status, p.registered_at, p.completed_at
		FROM community_work_participants p
		JOIN users u ON u.id = p.user_id
		WHERE p.session_id = $1 ORDER BY p.registered_at`, sessionID)
	if err != nil {
		writeError(w, 500, "error listing participants")
		return
	}
	defer rows.Close()

	var participants []map[string]interface{}
	for rows.Next() {
		var id, userID, displayName, taskID, skills, status *string
		var hoursWorked, tqCredited float64
		var registeredAt, completedAt interface{}
		if err := rows.Scan(&id, &userID, &displayName, &taskID, &hoursWorked, &tqCredited, &skills, &status, &registeredAt, &completedAt); err != nil {
			continue
		}
		participants = append(participants, map[string]interface{}{
			"id":            id,
			"user_id":       userID,
			"display_name":  displayName,
			"task_id":       taskID,
			"hours_worked":  hoursWorked,
			"tq_credited":   tqCredited,
			"skills":        skills,
			"status":        status,
			"registered_at": registeredAt,
			"completed_at":  completedAt,
		})
	}
	writeJSON(w, 200, map[string]interface{}{"participants": participants})
}

func (h *CommunityWorkHandler) addParticipant(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	var req struct {
		UserID string  `json:"user_id"`
		TaskID *string `json:"task_id"`
		Skills *string `json:"skills"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.UserID == "" {
		writeError(w, 400, "user_id is required")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO community_work_participants (session_id, user_id, task_id, skills, status)
		VALUES ($1, $2, $3, $4, 'registered')
		ON CONFLICT (session_id, user_id) DO UPDATE SET task_id = $3, skills = $4`,
		sessionID, req.UserID, req.TaskID, req.Skills)
	if err != nil {
		writeError(w, 500, "error adding participant: "+err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *CommunityWorkHandler) removeParticipant(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	userID := chi.URLParam(r, "userId")
	_, err := h.Pool.Exec(r.Context(), `DELETE FROM community_work_participants WHERE session_id = $1 AND user_id = $2`, sessionID, userID)
	if err != nil {
		writeError(w, 500, "error removing participant")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *CommunityWorkHandler) creditParticipant(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	userID := chi.URLParam(r, "userId")

	var req struct {
		HoursWorked float64 `json:"hours_worked"`
		TqCredited  float64 `json:"tq_credited"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE community_work_participants SET
			hours_worked = $3, tq_credited = $4, status = 'credited', completed_at = NOW()
		WHERE session_id = $1 AND user_id = $2`,
		sessionID, userID, req.HoursWorked, req.TqCredited)
	if err != nil {
		writeError(w, 500, "error crediting participant")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *CommunityWorkHandler) listSkills(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT DISTINCT skill_name FROM user_skills WHERE node_domain = $1 ORDER BY skill_name`, nodeDomain)
	if err != nil {
		writeError(w, 500, "error listing skills")
		return
	}
	defer rows.Close()

	var skills []string
	for rows.Next() {
		var s string
		rows.Scan(&s)
		skills = append(skills, s)
	}
	writeJSON(w, 200, map[string]interface{}{"skills": skills})
}

func (h *CommunityWorkHandler) addSkill(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}
	userID, _ := r.Context().Value("user_id").(string)

	var req struct {
		SkillName  string `json:"skill_name"`
		Proficiency string `json:"proficiency"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.SkillName == "" {
		writeError(w, 400, "skill_name is required")
		return
	}
	if req.Proficiency == "" {
		req.Proficiency = "intermediate"
	}

	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO user_skills (node_domain, user_id, skill_name, proficiency)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, skill_name) DO UPDATE SET proficiency = $4`,
		nodeDomain, userID, req.SkillName, req.Proficiency)
	if err != nil {
		writeError(w, 500, "error adding skill")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}
