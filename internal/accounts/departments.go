package accounts

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Departments struct {
	Pool *pgxpool.Pool
}

func NewDepartments(pool *pgxpool.Pool) *Departments {
	return &Departments{Pool: pool}
}

type Department struct {
	ID                     uuid.UUID  `json:"id"`
	NodeDomain             string     `json:"node_domain"`
	Name                   string     `json:"name"`
	Description            string     `json:"description"`
	GroupType              string     `json:"group_type"`
	HeadUserID             *uuid.UUID `json:"head_user_id"`
	ParentOrganizationID   *uuid.UUID `json:"parent_organization_id"`
	ParentOrganizationName *string    `json:"parent_organization_name,omitempty"`
	IsActive               bool       `json:"is_active"`
	CreatedAt              time.Time  `json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
}

type DepartmentRole struct {
	ID           uuid.UUID `json:"id"`
	DepartmentID uuid.UUID `json:"department_id"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
}

type DepartmentMember struct {
	ID           uuid.UUID  `json:"id"`
	DepartmentID uuid.UUID  `json:"department_id"`
	UserID       uuid.UUID  `json:"user_id"`
	RoleID       uuid.UUID  `json:"role_id"`
	AssignedBy   *uuid.UUID `json:"assigned_by"`
	AssignedAt   time.Time  `json:"assigned_at"`
	Username     string     `json:"username,omitempty"`
	RoleName     string     `json:"role_name,omitempty"`
}

type Permission struct {
	ID                uuid.UUID `json:"id"`
	Name              string    `json:"name"`
	Description       string    `json:"description"`
	Category          string    `json:"category"`
	RequiresMultisig  bool      `json:"requires_multisig"`
	RequiredApprovals int       `json:"required_approvals"`
}

func (d *Departments) CreateDepartment(ctx context.Context, nodeDomain, name, description, groupType string, headUserID *uuid.UUID, parentOrgID *uuid.UUID) (*Department, error) {
	var dept Department
	err := d.Pool.QueryRow(ctx, `
		INSERT INTO departments (node_domain, name, description, group_type, head_user_id, parent_organization_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, node_domain, name, description, group_type, head_user_id, parent_organization_id, is_active, created_at, updated_at`,
		nodeDomain, name, description, groupType, headUserID, parentOrgID,
	).Scan(&dept.ID, &dept.NodeDomain, &dept.Name, &dept.Description, &dept.GroupType,
		&dept.HeadUserID, &dept.ParentOrganizationID, &dept.IsActive, &dept.CreatedAt, &dept.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("creating department: %w", err)
	}
	return &dept, nil
}

func (d *Departments) ListDepartments(ctx context.Context, nodeDomain string) ([]Department, error) {
	rows, err := d.Pool.Query(ctx, `
		SELECT d.id, d.node_domain, d.name, d.description, d.group_type, d.head_user_id,
		       d.parent_organization_id, COALESCE(u.display_name, u.username, ''),
		       d.is_active, d.created_at, d.updated_at
		FROM departments d
		LEFT JOIN users u ON u.id = d.parent_organization_id
		WHERE d.node_domain = $1 ORDER BY d.name`,
		nodeDomain,
	)
	if err != nil {
		return nil, fmt.Errorf("listing departments: %w", err)
	}
	defer rows.Close()

	var depts []Department
	for rows.Next() {
		var dept Department
		var parentName string
		if err := rows.Scan(&dept.ID, &dept.NodeDomain, &dept.Name, &dept.Description,
			&dept.GroupType, &dept.HeadUserID, &dept.ParentOrganizationID, &parentName,
			&dept.IsActive, &dept.CreatedAt, &dept.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning department: %w", err)
		}
		if parentName != "" {
			dept.ParentOrganizationName = &parentName
		}
		depts = append(depts, dept)
	}
	return depts, nil
}

func (d *Departments) GetDepartment(ctx context.Context, id uuid.UUID) (*Department, error) {
	var dept Department
	var parentName string
	err := d.Pool.QueryRow(ctx, `
		SELECT d.id, d.node_domain, d.name, d.description, d.group_type, d.head_user_id,
		       d.parent_organization_id, COALESCE(u.display_name, u.username, ''),
		       d.is_active, d.created_at, d.updated_at
		FROM departments d
		LEFT JOIN users u ON u.id = d.parent_organization_id
		WHERE d.id = $1`,
		id,
	).Scan(&dept.ID, &dept.NodeDomain, &dept.Name, &dept.Description,
		&dept.GroupType, &dept.HeadUserID, &dept.ParentOrganizationID, &parentName,
		&dept.IsActive, &dept.CreatedAt, &dept.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("department not found: %w", err)
	}
	if parentName != "" {
		dept.ParentOrganizationName = &parentName
	}
	return &dept, nil
}

func (d *Departments) UpdateDepartment(ctx context.Context, id uuid.UUID, name, description string, headUserID *uuid.UUID, isActive bool) (*Department, error) {
	var dept Department
	err := d.Pool.QueryRow(ctx, `
		UPDATE departments SET name = $2, description = $3, head_user_id = $4, is_active = $5, updated_at = NOW()
		WHERE id = $1
		RETURNING id, node_domain, name, description, group_type, head_user_id, is_active, created_at, updated_at`,
		id, name, description, headUserID, isActive,
	).Scan(&dept.ID, &dept.NodeDomain, &dept.Name, &dept.Description,
		&dept.GroupType, &dept.HeadUserID, &dept.IsActive, &dept.CreatedAt, &dept.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("updating department: %w", err)
	}
	return &dept, nil
}

func (d *Departments) CreateRole(ctx context.Context, departmentID uuid.UUID, name, description string) (*DepartmentRole, error) {
	var role DepartmentRole
	err := d.Pool.QueryRow(ctx, `
		INSERT INTO department_roles (department_id, name, description)
		VALUES ($1, $2, $3)
		RETURNING id, department_id, name, description, is_active, created_at`,
		departmentID, name, description,
	).Scan(&role.ID, &role.DepartmentID, &role.Name, &role.Description, &role.IsActive, &role.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("creating role: %w", err)
	}
	return &role, nil
}

func (d *Departments) ListRoles(ctx context.Context, departmentID uuid.UUID) ([]DepartmentRole, error) {
	rows, err := d.Pool.Query(ctx, `
		SELECT id, department_id, name, description, is_active, created_at
		FROM department_roles WHERE department_id = $1 ORDER BY name`,
		departmentID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing roles: %w", err)
	}
	defer rows.Close()

	var roles []DepartmentRole
	for rows.Next() {
		var role DepartmentRole
		if err := rows.Scan(&role.ID, &role.DepartmentID, &role.Name, &role.Description, &role.IsActive, &role.CreatedAt); err != nil {
			return nil, fmt.Errorf("scanning role: %w", err)
		}
		roles = append(roles, role)
	}
	return roles, nil
}

func (d *Departments) AssignMember(ctx context.Context, departmentID, userID, roleID uuid.UUID, assignedBy *uuid.UUID) (*DepartmentMember, error) {
	var member DepartmentMember
	err := d.Pool.QueryRow(ctx, `
		INSERT INTO department_members (department_id, user_id, role_id, assigned_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (department_id, user_id) DO UPDATE SET role_id = $3, assigned_by = $4, assigned_at = NOW()
		RETURNING id, department_id, user_id, role_id, assigned_by, assigned_at`,
		departmentID, userID, roleID, assignedBy,
	).Scan(&member.ID, &member.DepartmentID, &member.UserID, &member.RoleID,
		&member.AssignedBy, &member.AssignedAt)
	if err != nil {
		return nil, fmt.Errorf("assigning member: %w", err)
	}
	return &member, nil
}

func (d *Departments) RemoveMember(ctx context.Context, departmentID, userID uuid.UUID) error {
	_, err := d.Pool.Exec(ctx, `
		DELETE FROM department_members WHERE department_id = $1 AND user_id = $2`,
		departmentID, userID,
	)
	if err != nil {
		return fmt.Errorf("removing member: %w", err)
	}
	return nil
}

func (d *Departments) ListMembers(ctx context.Context, departmentID uuid.UUID) ([]DepartmentMember, error) {
	rows, err := d.Pool.Query(ctx, `
		SELECT dm.id, dm.department_id, dm.user_id, dm.role_id, dm.assigned_by, dm.assigned_at,
			u.username, dr.name
		FROM department_members dm
		JOIN users u ON u.id = dm.user_id
		JOIN department_roles dr ON dr.id = dm.role_id
		WHERE dm.department_id = $1
		ORDER BY dm.assigned_at DESC`,
		departmentID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing members: %w", err)
	}
	defer rows.Close()

	var members []DepartmentMember
	for rows.Next() {
		var m DepartmentMember
		if err := rows.Scan(&m.ID, &m.DepartmentID, &m.UserID, &m.RoleID,
			&m.AssignedBy, &m.AssignedAt, &m.Username, &m.RoleName); err != nil {
			return nil, fmt.Errorf("scanning member: %w", err)
		}
		members = append(members, m)
	}
	return members, nil
}

func (d *Departments) GrantRolePermission(ctx context.Context, roleID, permissionID uuid.UUID, grantedBy *uuid.UUID) error {
	_, err := d.Pool.Exec(ctx, `
		INSERT INTO role_permissions (role_id, permission_id, granted_by)
		VALUES ($1, $2, $3)
		ON CONFLICT (role_id, permission_id) DO NOTHING`,
		roleID, permissionID, grantedBy,
	)
	if err != nil {
		return fmt.Errorf("granting role permission: %w", err)
	}
	return nil
}

func (d *Departments) RevokeRolePermission(ctx context.Context, roleID, permissionID uuid.UUID) error {
	_, err := d.Pool.Exec(ctx, `
		DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
		roleID, permissionID,
	)
	if err != nil {
		return fmt.Errorf("revoking role permission: %w", err)
	}
	return nil
}

func (d *Departments) ListRolePermissions(ctx context.Context, roleID uuid.UUID) ([]Permission, error) {
	rows, err := d.Pool.Query(ctx, `
		SELECT p.id, p.name, p.description, p.category, p.requires_multisig, p.required_approvals
		FROM role_permissions rp
		JOIN permissions p ON p.id = rp.permission_id
		WHERE rp.role_id = $1
		ORDER BY p.category, p.name`,
		roleID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing role permissions: %w", err)
	}
	defer rows.Close()

	var perms []Permission
	for rows.Next() {
		var p Permission
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Category, &p.RequiresMultisig, &p.RequiredApprovals); err != nil {
			return nil, fmt.Errorf("scanning permission: %w", err)
		}
		perms = append(perms, p)
	}
	return perms, nil
}

func (d *Departments) ListAllPermissions(ctx context.Context) ([]Permission, error) {
	rows, err := d.Pool.Query(ctx, `
		SELECT id, name, description, category, requires_multisig, required_approvals
		FROM permissions ORDER BY category, name`)
	if err != nil {
		return nil, fmt.Errorf("listing permissions: %w", err)
	}
	defer rows.Close()

	var perms []Permission
	for rows.Next() {
		var p Permission
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Category, &p.RequiresMultisig, &p.RequiredApprovals); err != nil {
			return nil, fmt.Errorf("scanning permission: %w", err)
		}
		perms = append(perms, p)
	}
	return perms, nil
}

func (d *Departments) ListUserPermissions(ctx context.Context, userID uuid.UUID) ([]string, error) {
	perms := make(map[string]bool)

	rows, err := d.Pool.Query(ctx, `
		SELECT p.name
		FROM user_permissions up
		JOIN permissions p ON p.id = up.permission_id
		WHERE up.user_id = $1 AND (up.expires_at IS NULL OR up.expires_at > NOW())`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing user direct permissions: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		perms[name] = true
	}

	rows2, err := d.Pool.Query(ctx, `
		SELECT p.name
		FROM department_members dm
		JOIN role_permissions rp ON rp.role_id = dm.role_id
		JOIN permissions p ON p.id = rp.permission_id
		WHERE dm.user_id = $1`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing user role permissions: %w", err)
	}
	defer rows2.Close()
	for rows2.Next() {
		var name string
		if err := rows2.Scan(&name); err != nil {
			return nil, err
		}
		perms[name] = true
	}

	result := make([]string, 0, len(perms))
	for name := range perms {
		result = append(result, name)
	}
	return result, nil
}

func (d *Departments) HasPermission(ctx context.Context, userID uuid.UUID, permissionName string) (bool, error) {
	var has bool

	err := d.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM user_permissions up
			JOIN permissions p ON p.id = up.permission_id
			WHERE up.user_id = $1 AND p.name = $2
			AND (up.expires_at IS NULL OR up.expires_at > NOW())
		)`,
		userID, permissionName,
	).Scan(&has)
	if err != nil {
		return false, fmt.Errorf("checking direct permission: %w", err)
	}
	if has {
		return true, nil
	}

	err = d.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM department_members dm
			JOIN role_permissions rp ON rp.role_id = dm.role_id
			JOIN permissions p ON p.id = rp.permission_id
			WHERE dm.user_id = $1 AND p.name = $2
		)`,
		userID, permissionName,
	).Scan(&has)
	if err != nil {
		return false, fmt.Errorf("checking role permission: %w", err)
	}
	return has, nil
}

func (d *Departments) GrantUserPermission(ctx context.Context, userID, permissionID uuid.UUID, grantedBy *uuid.UUID, expiresAt *time.Time) error {
	_, err := d.Pool.Exec(ctx, `
		INSERT INTO user_permissions (user_id, permission_id, granted_by, expires_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, permission_id) DO UPDATE SET granted_by = $3, expires_at = $4, granted_at = NOW()`,
		userID, permissionID, grantedBy, expiresAt,
	)
	if err != nil {
		return fmt.Errorf("granting user permission: %w", err)
	}
	return nil
}
