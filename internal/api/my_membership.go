package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// MyMembershipHandler devuelve las organizaciones y departamentos
// donde el usuario autenticado es miembro, junto con su rol y permisos.
type MyMembershipHandler struct {
	Pool *pgxpool.Pool
	Auth *AuthMiddleware
}

func NewMyMembershipHandler(pool *pgxpool.Pool, am *AuthMiddleware) *MyMembershipHandler {
	return &MyMembershipHandler{Pool: pool, Auth: am}
}

func (h *MyMembershipHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	r.Group(func(r chi.Router) {
		r.Use(am.RequireAuth)
		r.Get("/api/my/organizations", h.myOrganizations)
		r.Get("/api/my/departments", h.myDepartments)
		r.Get("/api/my/assembly", h.myAssembly)
	})
}

// myOrganizations devuelve las organizaciones donde el usuario tiene algun rol
// (junta directiva o membresia), con su posicion/rol y que puede hacer.
func (h *MyMembershipHandler) myOrganizations(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "no autenticado")
		return
	}

	// Organizaciones donde el usuario es parte de la junta directiva
	rows, err := h.Pool.Query(r.Context(), `
		SELECT
			o.id, o.username, o.display_name, o.organization_subtype,
			o.balance, o.credit_limit, o.debit_limit,
			obm.position, obm.term_start,
			CASE WHEN obm.user_id IS NOT NULL THEN true ELSE false END as is_board_member
		FROM users o
		LEFT JOIN organization_board_members obm ON obm.organization_id = o.id AND obm.user_id = $1
		WHERE o.account_type = 'organization'
		  AND o.membership_status = 'active'
		  AND o.node_domain = (SELECT node_domain FROM users WHERE id = $1)
		ORDER BY
			CASE WHEN obm.user_id IS NOT NULL THEN 0 ELSE 1 END,
			o.display_name`,
		userID)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	var orgs []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var username, displayName string
		var subtype *string
		var balance, creditLimit, debitLimit int
		var position *string
		var termStart *interface{}
		var isBoardMember bool

		if err := rows.Scan(&id, &username, &displayName, &subtype, &balance, &creditLimit, &debitLimit, &position, &termStart, &isBoardMember); err != nil {
			continue
		}

		role := "observador"
		canManage := false
		canTransfer := false
		canViewWallet := true
		canViewHistory := true
		canConfig := false

		if isBoardMember && position != nil {
			role = *position
			// Presidentes, coordinadores y tesoreros pueden gestionar
			posLower := *position
			switch posLower {
			case "presidente", "coordinador", "coordinadora", "tesorero", "tesorera", "director", "directora":
				canManage = true
				canTransfer = true
				canConfig = true
			case "secretario", "secretaria":
				canManage = true
				canConfig = false
			}
		}

		st := ""
		if subtype != nil {
			st = *subtype
		}

		orgs = append(orgs, map[string]interface{}{
			"id":              id.String(),
			"username":        username,
			"display_name":    displayName,
			"subtype":         st,
			"balance":         balance,
			"role":            role,
			"is_board_member": isBoardMember,
			"can_manage":      canManage,
			"can_transfer":    canTransfer,
			"can_view_wallet": canViewWallet,
			"can_view_history": canViewHistory,
			"can_config":      canConfig,
		})
	}
	if orgs == nil {
		orgs = []map[string]interface{}{}
	}
	writeJSON(w, 200, orgs)
}

// myDepartments devuelve los departamentos donde el usuario es miembro
func (h *MyMembershipHandler) myDepartments(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "no autenticado")
		return
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT
			d.id, d.name, d.description, d.group_type,
			dr.name as role_name, dr.description as role_desc,
			da.username as dept_account, da.id as dept_account_id, da.balance
		FROM department_members dm
		JOIN departments d ON dm.department_id = d.id
		LEFT JOIN department_roles dr ON dm.role_id = dr.id
		LEFT JOIN users da ON da.username = 'dept_' || replace(lower(d.name), ' ', '_')
			AND da.node_domain = d.node_domain AND da.account_type = 'department'
		WHERE dm.user_id = $1 AND d.is_active = true
		ORDER BY d.name`,
		userID)
	if err != nil {
		writeJSON(w, 200, []interface{}{})
		return
	}
	defer rows.Close()

	var depts []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var name, desc, groupType string
		var roleName, roleDesc *string
		var deptAccount *string
		var deptAccountID *uuid.UUID
		var balance *int

		if err := rows.Scan(&id, &name, &desc, &groupType, &roleName, &roleDesc, &deptAccount, &deptAccountID, &balance); err != nil {
			continue
		}

		role := "Miembro"
		if roleName != nil {
			role = *roleName
		}

		canManage := false
		canTransfer := false
		switch role {
		case "Coordinador", "Coordinadora", "Tesorero", "Tesorera":
			canManage = true
			canTransfer = true
		}

		dept := map[string]interface{}{
			"id":          id.String(),
			"name":        name,
			"description": desc,
			"group_type":  groupType,
			"role":        role,
			"can_manage":  canManage,
			"can_transfer": canTransfer,
		}
		if deptAccount != nil {
			dept["account_username"] = *deptAccount
		}
		if deptAccountID != nil {
			dept["account_id"] = deptAccountID.String()
		}
		if balance != nil {
			dept["balance"] = *balance
		}

		depts = append(depts, dept)
	}
	if depts == nil {
		depts = []map[string]interface{}{}
	}
	writeJSON(w, 200, depts)
}

// myAssembly devuelve informacion de la asamblea y el rol del usuario en ella
func (h *MyMembershipHandler) myAssembly(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "no autenticado")
		return
	}

	// Obtener info del usuario (nivel, si es super admin, etc)
	var username, displayName, accountType, levelName string
	var isSuperAdmin bool
	var memberLevelID *uuid.UUID
	h.Pool.QueryRow(r.Context(), `
		SELECT u.username, u.display_name, u.account_type,
		       COALESCE(ml.name, ''), u.is_super_admin, u.member_level_id
		FROM users u
		LEFT JOIN member_levels ml ON u.member_level_id = ml.id
		WHERE u.id = $1`, userID).Scan(&username, &displayName, &accountType, &levelName, &isSuperAdmin, &memberLevelID)

	// Determinar permisos en asamblea
	canVote := false
	canPropose := false
	canStartSession := false
	canConfig := false

	if isSuperAdmin {
		canVote = true
		canPropose = true
		canStartSession = true
		canConfig = true
	}
	if accountType == "individual" {
		// Miembros con voz y voto
		var hasVote, hasVoice bool
		if memberLevelID != nil {
			h.Pool.QueryRow(r.Context(), `SELECT has_vote, has_voice FROM member_levels WHERE id = $1`, *memberLevelID).Scan(&hasVote, &hasVoice)
		}
		canVote = canVote || hasVote
		canPropose = canPropose || hasVoice
	}

	// Proximas sesiones de asamblea
	rows, _ := h.Pool.Query(r.Context(), `
		SELECT id, title, status, scheduled_at, description
		FROM assembly_sessions
		WHERE node_domain = (SELECT node_domain FROM users WHERE id = $1)
		  AND status IN ('voting', 'scheduled', 'open')
		ORDER BY scheduled_at DESC LIMIT 5`, userID)
	defer func() {
		if rows != nil {
			rows.Close()
		}
	}()

	var sessions []map[string]interface{}
	if rows != nil {
		for rows.Next() {
			var id uuid.UUID
			var title, status, desc string
			var scheduledAt *interface{}
			rows.Scan(&id, &title, &status, &scheduledAt, &desc)
			sessions = append(sessions, map[string]interface{}{
				"id":           id.String(),
				"title":        title,
				"status":       status,
				"description":  desc,
			})
		}
	}
	if sessions == nil {
		sessions = []map[string]interface{}{}
	}

	writeJSON(w, 200, map[string]interface{}{
		"user": map[string]interface{}{
			"username":      username,
			"display_name":  displayName,
			"account_type":  accountType,
			"level_name":    levelName,
			"is_super_admin": isSuperAdmin,
		},
		"permissions": map[string]interface{}{
			"can_vote":         canVote,
			"can_propose":      canPropose,
			"can_start_session": canStartSession,
			"can_config":       canConfig,
		},
		"upcoming_sessions": sessions,
	})
}

// Helper para escribir JSON (si no existe ya)
func init() {
	// Evitar "imported and not used" si writeJSON/writeError ya existen
	_ = json.Marshal
	_ = http.StatusOK
}
