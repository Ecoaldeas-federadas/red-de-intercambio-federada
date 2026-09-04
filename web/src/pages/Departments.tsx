import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { Building2, Plus, Users, Shield, Trash2, ChevronDown, ChevronRight, HelpCircle, ArrowRight } from 'lucide-react'

interface Department {
  id: string
  name: string
  description: string
  group_type: string
  head_user_id: string | null
  parent_organization_id: string | null
  parent_organization_name?: string | null
  is_active: boolean
}

interface Role {
  id: string
  department_id: string
  name: string
  description: string
  is_active: boolean
}

interface Member {
  id: string
  department_id: string
  user_id: string
  role_id: string
  username: string
  role_name: string
}

interface Permission {
  id: string
  name: string
  description: string
  category: string
  requires_multisig: boolean
  required_approvals: number
}

export default function Departments() {
  const { t } = useTranslation(['organizations', 'common'])
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const [departments, setDepartments] = useState<Department[]>([])
  const [allPermissions, setAllPermissions] = useState<Permission[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [selectedDept, setSelectedDept] = useState<Department | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [expandedDept, setExpandedDept] = useState<string | null>(null)
  const [showCreateDept, setShowCreateDept] = useState(false)
  const [showCreateRole, setShowCreateRole] = useState<string | null>(null)
  const [showAssignMember, setShowAssignMember] = useState<string | null>(null)
  const [showRolePerms, setShowRolePerms] = useState<string | null>(null)
  const [rolePerms, setRolePerms] = useState<Permission[]>([])
  const [error, setError] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  const canManage = hasPermission('dept.manage')
  const canAssign = hasPermission('dept.assign_members')

  useEffect(() => {
    loadDepartments()
    loadPermissions()
    loadOrganizations()
    loadUsers()
  }, [])

  const loadDepartments = async () => {
    try {
      const res = await api.get<Department[]>('/departments')
      setDepartments(res || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const loadPermissions = async () => {
    try {
      const res = await api.get<Permission[]>('/permissions')
      setAllPermissions(res || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const loadUsers = async () => {
    try {
      const res = await api.get<any[]>('/accounts/list')
      setAllUsers(res || [])
    } catch {
      setAllUsers([])
    }
  }

  const loadRoles = async (deptId: string) => {
    try {
      const res = await api.get<Role[]>(`/departments/${deptId}/roles`)
      setRoles(res || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const loadMembers = async (deptId: string) => {
    try {
      const res = await api.get<Member[]>(`/departments/${deptId}/members`)
      setMembers(res || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const loadRolePerms = async (roleId: string) => {
    try {
      const res = await api.get<Permission[]>(`/roles/${roleId}/permissions`)
      setRolePerms(res || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const toggleDept = (dept: Department) => {
    if (expandedDept === dept.id) {
      setExpandedDept(null)
      setSelectedDept(null)
    } else {
      setExpandedDept(dept.id)
      setSelectedDept(dept)
      loadRoles(dept.id)
      loadMembers(dept.id)
    }
  }

  const [newDept, setNewDept] = useState({ name: '', description: '', group_type: 'department', parent_organization_id: '' })
  const [organizations, setOrganizations] = useState<any[]>([])

  const loadOrganizations = async () => {
    try {
      const res = await api.get<any[]>('/organizations')
      setOrganizations(res || [])
    } catch { setOrganizations([]) }
  }

  const createDept = async () => {
    setError('')
    if (!newDept.name) {
      setError(t('error_name_required', 'El nombre es obligatorio'))
      return
    }
    try {
      await api.post('/departments', {
        ...newDept,
        parent_organization_id: newDept.parent_organization_id || null,
      })
      setShowCreateDept(false)
      setNewDept({ name: '', description: '', group_type: 'department', parent_organization_id: '' })
      loadDepartments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const [newRole, setNewRole] = useState({ name: '', description: '' })
  const createRole = async (deptId: string) => {
    setError('')
    try {
      await api.post(`/departments/${deptId}/roles`, newRole)
      setShowCreateRole(null)
      setNewRole({ name: '', description: '' })
      loadRoles(deptId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const [newMember, setNewMember] = useState({ user_id: '', role_id: '' })
  const assignMember = async (deptId: string) => {
    setError('')
    try {
      await api.post(`/departments/${deptId}/members`, newMember)
      setShowAssignMember(null)
      setNewMember({ user_id: '', role_id: '' })
      loadMembers(deptId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const removeMember = async (deptId: string, userId: string) => {
    try {
      await api.delete(`/departments/${deptId}/members/${userId}`)
      loadMembers(deptId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const toggleRolePerm = async (roleId: string, permId: string, has: boolean) => {
    try {
      if (has) {
        await api.put(`/roles/${roleId}/permissions`, { permission_ids: [] })
      } else {
        const current = rolePerms.map((p) => p.id)
        await api.put(`/roles/${roleId}/permissions`, { permission_ids: [...current, permId] })
      }
      loadRolePerms(roleId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const groupedPerms = allPermissions.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {} as Record<string, Permission[]>)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('departments_title', 'Departamentos')}</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
          {canManage && (
            <button onClick={() => setShowCreateDept(true)} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> {t('departments_new', 'Nuevo Departamento')}
            </button>
          )}
        </div>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Departamentos - Ayuda</strong></p>
          <p><strong>Que son:</strong> Los departamentos son grupos internos de trabajo de la comunidad. Permiten organizar a los miembros por areas (ej: produccion, distribucion, administracion) y asignar roles y permisos especificos a cada grupo.</p>
          <p><strong>Para que sirven:</strong> Sirven para estructurar la comunidad en areas funcionales, delegar responsabilidades y controlar quien puede hacer que dentro de cada area. Sin departamentos, todos los miembros tendrian los mismos permisos.</p>
          <p><strong>Como se usan:</strong> 1) Creas un departamento con nombre, descripcion y tipo. 2) Creas roles dentro del departamento (ej: coordinador, miembro). 3) Asignas permisos a cada rol. 4) Asignas miembros a los roles. Los miembros heredan los permisos del rol asignado.</p>
          <p><strong>Diferencia con Organizaciones:</strong> Las organizaciones son grupos que tienen cuenta propia y pueden transar. Los departamentos son areas funcionales internas para gestionar permisos y responsabilidades; no tienen cuenta propia.</p>
          <p><strong>Tipo de grupo:</strong> Define la naturaleza del grupo. <em>Departamento</em> = area permanente de trabajo (ej: Produccion). <em>Consejo</em> = grupo de decision (ej: Consejo de Administracion). <em>Comision</em> = grupo temporal para una tarea especifica (ej: Comision de Eventos).</p>
          <p><strong>Jefe del departamento:</strong> Es el usuario responsable de coordinar el departamento. Aparece como referente y puede tener permisos adicionales de gestion.</p>
          <p><strong>Roles:</strong> Cada departamento tiene roles (ej: coordinador, miembro, tesorero). Cada rol define un conjunto de permisos. Un usuario con rol "coordinador" puede tener mas permisos que uno con rol "miembro".</p>
          <p><strong>Permisos:</strong> Controlan que acciones puede realizar cada rol. Algunos permisos requieren multi-firma (varias aprobaciones de distintos miembros antes de ejecutarse), lo que se indica con una etiqueta amarilla "multisig".</p>
          <p><strong>Como se asignan permisos:</strong> Despliega un departamento, haz clic en "Permisos" junto a un rol, y marca o desmarca los permisos. Los cambios se guardan automaticamente.</p>
          <p><strong>Miembros:</strong> Usuarios asignados a un departamento con un rol especifico. Para asignar un miembro necesitas su nombre de usuario (username) y elegir un rol existente en el departamento.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('close', t('common:close'))}</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {departments.length === 0 && (
        <div className="card text-center text-gray-500 py-8">
          <p>{t('departments_no_depts', 'No hay departamentos creados.')}</p>
          <p className="text-xs mt-2">{t('departments_no_depts_hint', 'Los departamentos son areas de trabajo de la comunidad. Crea el primero con el boton de arriba.')}</p>
          {!canManage && (
            <p className="text-xs mt-2 text-amber-600">{t('departments_no_permission', 'No tienes permiso para crear departamentos. Pide al administrador que lo haga.')}</p>
          )}
        </div>
      )}

      {departments.map((dept) => (
        <div key={dept.id} className="card">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleDept(dept)}
          >
            <div className="flex items-center gap-3">
              {expandedDept === dept.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              <Building2 size={20} className="text-trueque-600" />
              <div>
                <h2 className="font-semibold">{dept.name}</h2>
                <p className="text-sm text-gray-500">{dept.description}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {t('departments_belongs_to', 'Pertenece a:')} <b>{dept.parent_organization_name || t('departments_assembly_node', 'La Asamblea (nodo)')}</b>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/app/departments/${dept.id}`) }}
                className="text-sm text-trueque-600 hover:underline flex items-center gap-1 font-medium"
              >
                {t('departments_open', 'Abrir')} <ArrowRight size={14} />
              </button>
              <span className={`text-xs px-2 py-1 rounded ${dept.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {dept.is_active ? t('departments_active', 'Activo') : t('departments_inactive', 'Inactivo')}
              </span>
            </div>
          </div>

          {expandedDept === dept.id && (
            <div className="mt-4 space-y-4 border-t pt-4">
              {/* Roles */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium flex items-center gap-2"><Shield size={16} /> {t('departments_roles', 'Roles')}</h3>
                  {canManage && (
                    <button onClick={() => setShowCreateRole(dept.id)} className="text-sm text-trueque-600 flex items-center gap-1">
                      <Plus size={14} /> {t('departments_new_role', 'Nuevo Rol')}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {roles.length === 0 && <p className="text-sm text-gray-400">{t('departments_no_roles', 'Sin roles')}</p>}
                  {roles.map((role) => (
                    <div key={role.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div>
                        <span className="font-medium text-sm">{role.name}</span>
                        <p className="text-xs text-gray-500">{role.description}</p>
                      </div>
                      <button
                        onClick={() => {
                          if (showRolePerms === role.id) {
                            setShowRolePerms(null)
                          } else {
                            setShowRolePerms(role.id)
                            loadRolePerms(role.id)
                          }
                        }}
                        className="text-sm text-trueque-600"
                      >
                        {t('departments_permissions', 'Permisos')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Role permissions panel */}
              {showRolePerms && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <h4 className="text-sm font-medium">{t('departments_permissions_of_role', 'Permisos del rol')}</h4>
                  {Object.entries(groupedPerms).map(([cat, perms]) => (
                    <div key={cat}>
                      <p className="text-xs text-gray-500 uppercase mb-1">{cat}</p>
                      <div className="space-y-1">
                        {perms.map((perm) => {
                          const has = rolePerms.some((p) => p.id === perm.id)
                          return (
                            <label key={perm.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={has}
                                disabled={!canManage}
                                onChange={() => toggleRolePerm(showRolePerms, perm.id, has)}
                              />
                              <span>{perm.name}</span>
                              {perm.requires_multisig && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-1 rounded">multisig ({perm.required_approvals})</span>
                              )}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Members */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium flex items-center gap-2"><Users size={16} /> {t('departments_members', 'Miembros')}</h3>
                  {canAssign && (
                    <button onClick={() => setShowAssignMember(dept.id)} className="text-sm text-trueque-600 flex items-center gap-1">
                      <Plus size={14} /> {t('departments_assign_member', 'Asignar Miembro')}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {members.length === 0 && <p className="text-sm text-gray-400">{t('departments_no_members', 'Sin miembros')}</p>}
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div>
                        <span className="font-medium text-sm">{m.username}</span>
                        <span className="text-xs text-gray-500 ml-2">({m.role_name})</span>
                      </div>
                      {canAssign && (
                        <button onClick={() => removeMember(dept.id, m.user_id)} className="text-red-500 hover:text-red-700">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Modal: Create Department */}
      {showCreateDept && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateDept(false)}>
          <div className="bg-white rounded-xl p-6 w-96 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">{t('departments_modal_new_dept', 'Nuevo Departamento')}</h2>
            <div>
              <label className="label">{t('departments_modal_name_label', 'Nombre del departamento')}</label>
              <input className="input" placeholder={t('departments_modal_name_placeholder', 'Ej: Produccion')} value={newDept.name} onChange={(e) => setNewDept({ ...newDept, name: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">{t('departments_modal_name_hint', 'Nombre del area de trabajo. Debe ser claro y descriptivo. Ejemplo: "Produccion", "Distribucion", "Administracion".')}</p>
            </div>
            <div>
              <label className="label">{t('departments_modal_desc_label', 'Descripcion')}</label>
              <input className="input" placeholder={t('departments_modal_desc_placeholder', 'Ej: Encargados de producir alimentos')} value={newDept.description} onChange={(e) => setNewDept({ ...newDept, description: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">{t('departments_modal_desc_hint', 'Explica brevemente para que sirve este departamento y que responsabilidades tiene. Ejemplo: "Encargados de producir alimentos para la comunidad".')}</p>
            </div>
            <div>
              <label className="label">{t('departments_modal_type_label', 'Tipo de grupo')}</label>
              <select className="input" value={newDept.group_type} onChange={(e) => setNewDept({ ...newDept, group_type: e.target.value })}>
                <option value="department">{t('departments_modal_type_department', 'Departamento (area de trabajo)')}</option>
                <option value="council">{t('departments_modal_type_council', 'Consejo (grupo de decision)')}</option>
                <option value="committee">{t('departments_modal_type_committee', 'Comision (grupo temporal)')}</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Define la naturaleza del grupo. <em>Departamento</em> = area permanente de trabajo (ej: Produccion). <em>Consejo</em> = grupo de decision (ej: Consejo de Administracion). <em>Comision</em> = grupo temporal para una tarea (ej: Comision de Eventos).</p>
            </div>
            <div>
              <label className="label">{t('departments_modal_belongs_to', 'Pertenece a')}</label>
              <select className="input" value={newDept.parent_organization_id} onChange={(e) => setNewDept({ ...newDept, parent_organization_id: e.target.value })}>
                <option value="">{t('departments_assembly_node', 'La Asamblea (nodo)')}</option>
                {organizations.map((org: any) => (
                  <option key={org.id} value={org.id}>{org.display_name || org.username || org.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {t('departments_modal_belongs_hint', 'Todo departamento debe pertenecer a una organizacion o a la Asamblea del nodo. No puede existir aislado ni pertenecer a una persona.')}
              </p>
            </div>
            <button onClick={createDept} className="btn-primary w-full">{t('departments_modal_create', 'Crear')}</button>
          </div>
        </div>
      )}

      {/* Modal: Create Role */}
      {showCreateRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateRole(null)}>
          <div className="bg-white rounded-xl p-6 w-96 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">{t('departments_modal_new_role_title', 'Nuevo Rol')}</h2>
            <div>
              <label className="label">{t('departments_modal_role_name_label', 'Nombre del rol')}</label>
              <input className="input" placeholder={t('departments_modal_role_name_placeholder', 'Ej: Coordinador')} value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">{t('departments_modal_role_name_hint', 'Nombre del rol dentro del departamento. Ejemplo: "Coordinador", "Miembro", "Tesorero".')}</p>
            </div>
            <div>
              <label className="label">{t('departments_modal_role_desc_label', 'Descripcion')}</label>
              <input className="input" placeholder={t('departments_modal_role_desc_placeholder', 'Ej: Coordina las actividades del departamento')} value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">{t('departments_modal_role_desc_hint', 'Describe que responsabilidades tiene este rol. Ejemplo: "Coordina las actividades del departamento y supervisa a los miembros".')}</p>
            </div>
            <button onClick={() => createRole(showCreateRole)} className="btn-primary w-full">{t('departments_modal_create', 'Crear')}</button>
          </div>
        </div>
      )}

      {/* Modal: Assign Member */}
      {showAssignMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAssignMember(null)}>
          <div className="bg-white rounded-xl p-6 w-96 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">{t('departments_modal_assign_title', 'Asignar Miembro')}</h2>
            <div>
              <label className="label">{t('departments_modal_user_label', 'Usuario')}</label>
              <select className="input" value={newMember.user_id} onChange={(e) => setNewMember({ ...newMember, user_id: e.target.value })}>
                <option value="">{t('departments_modal_user_placeholder', 'Seleccionar miembro...')}</option>
                {allUsers.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.display_name || u.username} ({u.username})</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">{t('departments_modal_user_hint', 'Solo puedes asignar miembros registrados del nodo.')}</p>
            </div>
            <div>
              <label className="label">{t('departments_modal_role_label', 'Rol')}</label>
              <select className="input" value={newMember.role_id} onChange={(e) => setNewMember({ ...newMember, role_id: e.target.value })}>
                <option value="">{t('departments_modal_role_placeholder', 'Seleccionar rol...')}</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">{t('departments_modal_role_hint', 'Que rol tendra esta persona en el departamento. El rol determina que permisos tendra. Ejemplo: "Coordinador", "Miembro".')}</p>
            </div>
            <button onClick={() => assignMember(showAssignMember)} className="btn-primary w-full">{t('departments_modal_assign', 'Asignar')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
