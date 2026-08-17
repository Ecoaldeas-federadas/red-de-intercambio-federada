package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"federated-credit-node/internal/accounts"
)

type DepartmentsHandler struct {
	Departments *accounts.Departments
	NodeDomain  string
	Auth        *AuthMiddleware
}

func NewDepartmentsHandler(depts *accounts.Departments, nodeDomain string, am *AuthMiddleware) *DepartmentsHandler {
	return &DepartmentsHandler{Departments: depts, NodeDomain: nodeDomain, Auth: am}
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
	})
}

func (dh *DepartmentsHandler) listDepartments(w http.ResponseWriter, r *http.Request) {
	depts, err := dh.Departments.ListDepartments(r.Context(), dh.NodeDomain)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, depts)
}

type CreateDepartmentRequest struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	GroupType   string     `json:"group_type"`
	HeadUserID  *uuid.UUID `json:"head_user_id"`
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

	dept, err := dh.Departments.CreateDepartment(r.Context(), dh.NodeDomain, req.Name, req.Description, req.GroupType, req.HeadUserID)
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
	writeJSON(w, 200, map[string]interface{}{
		"user_id":     userID.String(),
		"permissions": perms,
	})
}
