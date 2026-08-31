package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"federated-credit-node/internal/accounts"
	"federated-credit-node/internal/db"
)

type DepartmentsHandler struct {
	Departments *accounts.Departments
	NodeDomain  string
	Auth        *AuthMiddleware
	Pool        *pgxpool.Pool
}

func NewDepartmentsHandler(depts *accounts.Departments, nodeDomain string, am *AuthMiddleware, pool *pgxpool.Pool) *DepartmentsHandler {
	return &DepartmentsHandler{Departments: depts, NodeDomain: nodeDomain, Auth: am, Pool: pool}
}

func (dh *DepartmentsHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	r.Group(func(r chi.Router) {
		r.Use(am.RequireAuth)
		r.Get("/api/departments", dh.listDepartments)
		r.Post("/api/departments", dh.createDepartment)
		r.Put("/api/departments/{id}", dh.updateDepartment)
		r.Get("/api/departments/{id}", dh.getDepartment)
		r.Get("/api/departments/{id}/members", dh.listMembers)
		r.Post("/api/departments/{id}/members", dh.assignMember)
		r.Delete("/api/departments/{id}/members/{userId}", dh.removeMember)
		r.Get("/api/departments/{id}/roles", dh.listRoles)
		r.Post("/api/departments/{id}/roles", dh.createRole)
		r.Put("/api/roles/{id}/permissions", dh.setRolePermissions)
		r.Get("/api/roles/{id}/permissions", dh.listRolePermissions)
		r.Get("/api/permissions", dh.listAllPermissions)
		r.Get("/api/users/me/permissions", dh.listMyPermissions)

		// Gestion de permisos de usuarios individuales (para la Asamblea)
		r.Get("/api/users/all", dh.listAllUsersWithPermissions)
		r.Get("/api/users/{id}/permissions", dh.listUserPermissions)
		r.With(am.RequirePermission("config.manage")).Post("/api/users/{id}/permissions/grant", dh.grantUserPermission)
		r.With(am.RequirePermission("config.manage")).Delete("/api/users/{id}/permissions/{permName}", dh.revokeUserPermission)

		// Listar todos los departamentos con info de organizacion padre
		r.Get("/api/departments/all", dh.listAllDepartments)

		// Listar todas las organizaciones del nodo con sus permisos (para gestion desde Asamblea)
		r.Get("/api/organizations/all", dh.listAllOrganizationsWithPermissions)
	})
}

func (dh *DepartmentsHandler) listDepartments(w http.ResponseWriter, r *http.Request) {
	depts, err := dh.Departments.ListDepartments(r.Context(), db.LOCAL_NODE_DOMAIN)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, depts)
}

type CreateDepartmentRequest struct {
	Name                 string     `json:"name"`
	Description          string     `json:"description"`
	GroupType            string     `json:"group_type"`
	HeadUserID           *uuid.UUID `json:"head_user_id"`
	ParentOrganizationID *uuid.UUID `json:"parent_organization_id"`
}

func (dh *DepartmentsHandler) createDepartment(w http.ResponseWriter, r *http.Request) {
	var req CreateDepartmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, 400, "name is required")
		return
	}
	if req.GroupType == "" {
		req.GroupType = "department"
	}

	// Validar parent_organization_id si se especifica
	if req.ParentOrganizationID != nil {
		var accountType string
		err := dh.Pool.QueryRow(r.Context(), `SELECT account_type FROM users WHERE id = $1`, req.ParentOrganizationID).Scan(&accountType)
		if err != nil {
			writeError(w, 400, "la organizacion padre no existe")
			return
		}
		if accountType != "organization" && accountType != "public_institution" {
			writeError(w, 400, "el departamento solo puede pertenecer a una organizacion o al nodo/asamblea. No puede pertenecer a una persona.")
			return
		}
	}
	// Si parent_organization_id es NULL, el departamento pertenece al nodo/asamblea directamente

	dept, err := dh.Departments.CreateDepartment(r.Context(), db.LOCAL_NODE_DOMAIN, req.Name, req.Description, req.GroupType, req.HeadUserID, req.ParentOrganizationID)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, dept)
}

func (dh *DepartmentsHandler) getDepartment(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, 400, "invalid department id")
		return
	}

	dept, err := dh.Departments.GetDepartment(r.Context(), id)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	writeJSON(w, 200, dept)
}

type UpdateDepartmentRequest struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	HeadUserID  *uuid.UUID `json:"head_user_id"`
	IsActive    *bool      `json:"is_active"`
}

func (dh *DepartmentsHandler) updateDepartment(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, 400, "invalid department id")
		return
	}

	var req UpdateDepartmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	dept, err := dh.Departments.UpdateDepartment(r.Context(), id, req.Name, req.Description, req.HeadUserID, isActive)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, dept)
}

func (dh *DepartmentsHandler) listMembers(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, 400, "invalid department id")
		return
	}

	members, err := dh.Departments.ListMembers(r.Context(), id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, members)
}

type AssignMemberRequest struct {
	UserID uuid.UUID `json:"user_id"`
	RoleID uuid.UUID `json:"role_id"`
}

func (dh *DepartmentsHandler) assignMember(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	deptID, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, 400, "invalid department id")
		return
	}

	var req AssignMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	am := dh.Auth
	userID, _ := am.GetUserID(r)
	var assignedBy *uuid.UUID
	if userID != uuid.Nil {
		assignedBy = &userID
	}

	member, err := dh.Departments.AssignMember(r.Context(), deptID, req.UserID, req.RoleID, assignedBy)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	// Notificar al miembro asignado
	notify := NewNotifyService(dh.Pool)
	var deptName string
	dh.Pool.QueryRow(r.Context(), `SELECT name FROM departments WHERE id = $1`, deptID).Scan(&deptName)
	notify.Notify(r.Context(), dh.NodeDomain, req.UserID, "department_assigned",
		"Asignado a departamento",
		fmt.Sprintf("Has sido asignado/a al departamento %s.", deptName),
		"/app/departments",
		map[string]interface{}{"department_id": deptID.String(), "department_name": deptName})

	writeJSON(w, 201, member)
}

func (dh *DepartmentsHandler) removeMember(w http.ResponseWriter, r *http.Request) {
	deptIDStr := chi.URLParam(r, "id")
	userIDStr := chi.URLParam(r, "userId")

	deptID, err := uuid.Parse(deptIDStr)
	if err != nil {
		writeError(w, 400, "invalid department id")
		return
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		writeError(w, 400, "invalid user id")
		return
	}

	if err := dh.Departments.RemoveMember(r.Context(), deptID, userID); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "removed"})
}

func (dh *DepartmentsHandler) listRoles(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, 400, "invalid department id")
		return
	}

	roles, err := dh.Departments.ListRoles(r.Context(), id)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, roles)
}

type CreateRoleRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (dh *DepartmentsHandler) createRole(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	deptID, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, 400, "invalid department id")
		return
	}

	var req CreateRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, 400, "name is required")
		return
	}

	role, err := dh.Departments.CreateRole(r.Context(), deptID, req.Name, req.Description)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, role)
}

type SetRolePermissionsRequest struct {
	PermissionIDs []uuid.UUID `json:"permission_ids"`
}

func (dh *DepartmentsHandler) setRolePermissions(w http.ResponseWriter, r *http.Request) {
	roleIDStr := chi.URLParam(r, "id")
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		writeError(w, 400, "invalid role id")
		return
	}

	var req SetRolePermissionsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	am := dh.Auth
	userID, _ := am.GetUserID(r)
	var grantedBy *uuid.UUID
	if userID != uuid.Nil {
		grantedBy = &userID
	}

	for _, permID := range req.PermissionIDs {
		if err := dh.Departments.GrantRolePermission(r.Context(), roleID, permID, grantedBy); err != nil {
			writeError(w, 400, err.Error())
			return
		}
	}
	writeJSON(w, 200, map[string]string{"status": "updated"})
}

func (dh *DepartmentsHandler) listRolePermissions(w http.ResponseWriter, r *http.Request) {
	roleIDStr := chi.URLParam(r, "id")
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		writeError(w, 400, "invalid role id")
		return
	}

	perms, err := dh.Departments.ListRolePermissions(r.Context(), roleID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, perms)
}

func (dh *DepartmentsHandler) listAllPermissions(w http.ResponseWriter, r *http.Request) {
	perms, err := dh.Departments.ListAllPermissions(r.Context())
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, perms)
}

func (dh *DepartmentsHandler) listMyPermissions(w http.ResponseWriter, r *http.Request) {
	userID, err := dh.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	perms, err := dh.Departments.ListUserPermissions(r.Context(), userID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Verificar si es super admin
	var isSuperAdmin, superAdminEnabled bool
	_ = dh.Pool.QueryRow(r.Context(), `SELECT is_super_admin, super_admin_enabled FROM users WHERE id = $1`, userID).Scan(&isSuperAdmin, &superAdminEnabled)

	writeJSON(w, 200, map[string]interface{}{
		"user_id":             userID.String(),
		"permissions":         perms,
		"is_super_admin":      isSuperAdmin,
		"super_admin_enabled": superAdminEnabled,
	})
}

// ===== GESTION DE PERMISOS DE USUARIOS INDIVIDUALES =====

// listAllUsersWithPermissions lista todos los miembros PERSONAS del nodo con sus permisos.
// Solo devuelve account_type = 'individual' (excluye organization, fund, system).
// Para que la Asamblea pueda buscar personas y ver/asignar/quitar permisos.
func (dh *DepartmentsHandler) listAllUsersWithPermissions(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), dh.Pool, nodeDomain, db.LOCAL_NODE_DOMAIN)

	q := r.URL.Query().Get("q")
	var rows pgx.Rows
	var err error
	if q != "" {
		rows, err = dh.Pool.Query(r.Context(), `
			SELECT u.id, u.username, COALESCE(u.display_name, u.username),
			       u.membership_status, u.is_super_admin, u.super_admin_enabled,
			       COALESCE(ml.name, '') AS level_name, COALESCE(ml.level, 0) AS level,
			       COALESCE(u.has_voice, true), COALESCE(u.has_vote, true)
			FROM users u
			LEFT JOIN member_levels ml ON ml.id = u.member_level_id AND ml.node_domain = u.node_domain
			WHERE u.node_domain = $1 AND u.membership_status = 'active'
			  AND u.account_type = 'individual'
			  AND (LOWER(u.username) LIKE '%' || LOWER($2) || '%' OR LOWER(COALESCE(u.display_name, '')) LIKE '%' || LOWER($2) || '%')
			ORDER BY ml.level DESC, u.username
			LIMIT 100`,
			nodeDomain, q)
	} else {
		rows, err = dh.Pool.Query(r.Context(), `
			SELECT u.id, u.username, COALESCE(u.display_name, u.username),
			       u.membership_status, u.is_super_admin, u.super_admin_enabled,
			       COALESCE(ml.name, '') AS level_name, COALESCE(ml.level, 0) AS level,
			       COALESCE(u.has_voice, true), COALESCE(u.has_vote, true)
			FROM users u
			LEFT JOIN member_levels ml ON ml.id = u.member_level_id AND ml.node_domain = u.node_domain
			WHERE u.node_domain = $1 AND u.membership_status = 'active'
			  AND u.account_type = 'individual'
			ORDER BY ml.level DESC, u.username
			LIMIT 100`,
			nodeDomain)
	}
	if err != nil {
		writeError(w, 500, "error listing users")
		return
	}
	defer rows.Close()

	type UserWithPerms struct {
		ID                string   `json:"id"`
		Username          string   `json:"username"`
		DisplayName       string   `json:"display_name"`
		MembershipStatus  string   `json:"membership_status"`
		IsSuperAdmin      bool     `json:"is_super_admin"`
		SuperAdminEnabled bool     `json:"super_admin_enabled"`
		LevelName         string   `json:"level_name"`
		Level             int      `json:"level"`
		HasVoice          bool     `json:"has_voice"`
		HasVote           bool     `json:"has_vote"`
		Permissions       []string `json:"permissions"`
	}

	var users []UserWithPerms
	for rows.Next() {
		var u UserWithPerms
		if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName,
			&u.MembershipStatus, &u.IsSuperAdmin, &u.SuperAdminEnabled,
			&u.LevelName, &u.Level, &u.HasVoice, &u.HasVote); err != nil {
			continue
		}
		uid, _ := uuid.Parse(u.ID)
		perms, _ := dh.Departments.ListUserPermissions(r.Context(), uid)
		if perms == nil {
			perms = []string{}
		}
		u.Permissions = perms
		users = append(users, u)
	}
	if users == nil {
		users = []UserWithPerms{}
	}
	writeJSON(w, 200, users)
}

// listUserPermissions lista los permisos de un usuario especifico.
func (dh *DepartmentsHandler) listUserPermissions(w http.ResponseWriter, r *http.Request) {
	userIDStr := chi.URLParam(r, "id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		writeError(w, 400, "invalid user id")
		return
	}

	perms, err := dh.Departments.ListUserPermissions(r.Context(), userID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if perms == nil {
		perms = []string{}
	}

	var isSuperAdmin, superAdminEnabled bool
	_ = dh.Pool.QueryRow(r.Context(), `SELECT is_super_admin, super_admin_enabled FROM users WHERE id = $1`, userID).Scan(&isSuperAdmin, &superAdminEnabled)

	writeJSON(w, 200, map[string]interface{}{
		"user_id":             userID.String(),
		"permissions":         perms,
		"is_super_admin":      isSuperAdmin,
		"super_admin_enabled": superAdminEnabled,
	})
}

// grantUserPermission asigna un permiso directo a un usuario.
func (dh *DepartmentsHandler) grantUserPermission(w http.ResponseWriter, r *http.Request) {
	userIDStr := chi.URLParam(r, "id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		writeError(w, 400, "invalid user id")
		return
	}

	var req struct {
		PermissionName string `json:"permission_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.PermissionName == "" {
		writeError(w, 400, "permission_name is required")
		return
	}

	// Buscar el permiso por nombre
	var permID uuid.UUID
	err = dh.Pool.QueryRow(r.Context(), `SELECT id FROM permissions WHERE name = $1`, req.PermissionName).Scan(&permID)
	if err != nil {
		writeError(w, 404, "permission not found: "+req.PermissionName)
		return
	}

	grantedBy, _ := dh.Auth.GetUserID(r)
	var grantedByPtr *uuid.UUID
	if grantedBy != uuid.Nil {
		grantedByPtr = &grantedBy
	}

	if err := dh.Departments.GrantUserPermission(r.Context(), userID, permID, grantedByPtr, nil); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

// revokeUserPermission quita un permiso directo de un usuario.
func (dh *DepartmentsHandler) revokeUserPermission(w http.ResponseWriter, r *http.Request) {
	userIDStr := chi.URLParam(r, "id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		writeError(w, 400, "invalid user id")
		return
	}

	permName := chi.URLParam(r, "permName")
	if permName == "" {
		writeError(w, 400, "permission name is required")
		return
	}

	_, err = dh.Pool.Exec(r.Context(), `
		DELETE FROM user_permissions
		WHERE user_id = $1 AND permission_id = (
			SELECT id FROM permissions WHERE name = $2
		)`,
		userID, permName)
	if err != nil {
		writeError(w, 500, "error revoking permission")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

// listAllDepartments lista todos los departamentos con info de organizacion padre.
func (dh *DepartmentsHandler) listAllDepartments(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), dh.Pool, nodeDomain, db.LOCAL_NODE_DOMAIN)

	rows, err := dh.Pool.Query(r.Context(), `
		SELECT d.id, d.name, d.description, d.group_type, d.is_active,
		       d.parent_organization_id,
		       COALESCE(o.display_name, o.username, '') AS org_name
		FROM departments d
		LEFT JOIN users o ON d.parent_organization_id = o.id
		WHERE d.node_domain = $1
		ORDER BY d.name`,
		nodeDomain)
	if err != nil {
		writeError(w, 500, "error listing departments")
		return
	}
	defer rows.Close()

	var depts []map[string]interface{}
	for rows.Next() {
		var id, name, groupType string
		var description, orgName string
		var isActive bool
		var parentOrgID *uuid.UUID
		if err := rows.Scan(&id, &name, &description, &groupType, &isActive, &parentOrgID, &orgName); err != nil {
			continue
		}
		depts = append(depts, map[string]interface{}{
			"id":                     id,
			"name":                   name,
			"description":            description,
			"group_type":             groupType,
			"is_active":              isActive,
			"parent_organization_id": parentOrgID,
			"org_name":               orgName,
		})
	}
	if depts == nil {
		depts = []map[string]interface{}{}
	}
	writeJSON(w, 200, depts)
}

// listAllOrganizationsWithPermissions lista todas las organizaciones del nodo con sus permisos.
// Para que la Asamblea pueda gestionar permisos de organizaciones separadamente de personas.
func (dh *DepartmentsHandler) listAllOrganizationsWithPermissions(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	nodeDomain = db.ResolveNodeDomain(r.Context(), dh.Pool, nodeDomain, db.LOCAL_NODE_DOMAIN)

	q := r.URL.Query().Get("q")
	var rows pgx.Rows
	var err error
	if q != "" {
		rows, err = dh.Pool.Query(r.Context(), `
			SELECT u.id, u.username, COALESCE(u.display_name, u.username),
			       u.organization_subtype, u.is_assembly_owned, u.is_approved
			FROM users u
			WHERE u.node_domain = $1 AND u.account_type IN ('organization', 'public_institution')
			  AND u.membership_status = 'active'
			  AND (LOWER(u.username) LIKE '%' || LOWER($2) || '%' OR LOWER(COALESCE(u.display_name, '')) LIKE '%' || LOWER($2) || '%')
			ORDER BY u.is_assembly_owned DESC, u.username
			LIMIT 100`,
			nodeDomain, q)
	} else {
		rows, err = dh.Pool.Query(r.Context(), `
			SELECT u.id, u.username, COALESCE(u.display_name, u.username),
			       u.organization_subtype, u.is_assembly_owned, u.is_approved
			FROM users u
			WHERE u.node_domain = $1 AND u.account_type IN ('organization', 'public_institution')
			  AND u.membership_status = 'active'
			ORDER BY u.is_assembly_owned DESC, u.username
			LIMIT 100`,
			nodeDomain)
	}
	if err != nil {
		writeError(w, 500, "error listing organizations")
		return
	}
	defer rows.Close()

	type OrgWithPerms struct {
		ID              string   `json:"id"`
		Username        string   `json:"username"`
		DisplayName     string   `json:"display_name"`
		Subtype         string   `json:"subtype"`
		IsAssemblyOwned bool     `json:"is_assembly_owned"`
		IsApproved      bool     `json:"is_approved"`
		Permissions     []string `json:"permissions"`
	}

	var orgs []OrgWithPerms
	for rows.Next() {
		var o OrgWithPerms
		if err := rows.Scan(&o.ID, &o.Username, &o.DisplayName, &o.Subtype, &o.IsAssemblyOwned, &o.IsApproved); err != nil {
			continue
		}
		uid, _ := uuid.Parse(o.ID)
		perms, _ := dh.Departments.ListUserPermissions(r.Context(), uid)
		if perms == nil {
			perms = []string{}
		}
		o.Permissions = perms
		orgs = append(orgs, o)
	}
	if orgs == nil {
		orgs = []OrgWithPerms{}
	}
	writeJSON(w, 200, orgs)
}
