import { useState, useEffect } from 'react'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { Building2, Plus, Users, Shield, Trash2, ChevronDown, ChevronRight, HelpCircle } from 'lucide-react'

interface Department {
  id: string
  name: string
  description: string
  group_type: string
  head_user_id: string | null
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
  const { hasPermission } = usePermissions()
  const [departments, setDepartments] = useState<Department[]>([])
  const [allPermissions, setAllPermissions] = useState<Permission[]>([])
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

  const [newDept, setNewDept] = useState({ name: '', description: '', group_type: 'department' })
  const createDept = async () => {
    setError('')
    try {
      await api.post('/departments', newDept)
      setShowCreateDept(false)
      setNewDept({ name: '', description: '', group_type: 'department' })
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
        <h1 className="text-2xl font-bold">Departamentos</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
          {canManage && (
            <button onClick={() => setShowCreateDept(true)} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Nuevo Departamento
            </button>
          )}
        </div>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Departamentos - Ayuda</strong></p>
          <p><strong>Para que sirve:</strong> Los departamentos son grupos internos de trabajo de la comunidad. Permiten organizar a los miembros por areas (ej: produccion, distribucion, administracion) y asignar roles y permisos especificos a cada grupo.</p>
          <p><strong>Diferencia con Organizaciones:</strong> Las organizaciones son grupos que tienen cuenta propia y pueden transar. Los departamentos son areas funcionales internas para gestionar permisos y responsabilidades.</p>
          <p><strong>Roles:</strong> Cada departamento tiene roles (ej: coordinador, miembro). Cada rol tiene permisos especificos que determinan que puede hacer.</p>
          <p><strong>Permisos:</strong> Controlan que acciones puede realizar cada rol. Algunos permisos requieren multi-firma (varias aprobaciones).</p>
          <p><strong>Miembros:</strong> Usuarios asignados a un departamento con un rol especifico.</p>
          <p><strong>Tipos:</strong> Departamento (area de trabajo), Consejo (grupo decision), Comision (grupo temporal para una tarea).</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {departments.length === 0 && (
        <div className="card text-center text-gray-500 py-8">
          <p>No hay departamentos creados.</p>
          <p className="text-xs mt-2">Los departamentos son areas de trabajo de la comunidad. Crea el primero con el boton de arriba.</p>
          {!canManage && (
            <p className="text-xs mt-2 text-amber-600">No tienes permiso para crear departamentos. Pide al administrador que lo haga.</p>
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
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${dept.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {dept.is_active ? 'Activo' : 'Inactivo'}
            </span>
          </div>

          {expandedDept === dept.id && (
            <div className="mt-4 space-y-4 border-t pt-4">
              {/* Roles */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium flex items-center gap-2"><Shield size={16} /> Roles</h3>
                  {canManage && (
                    <button onClick={() => setShowCreateRole(dept.id)} className="text-sm text-trueque-600 flex items-center gap-1">
                      <Plus size={14} /> Nuevo Rol
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {roles.length === 0 && <p className="text-sm text-gray-400">Sin roles</p>}
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
                        Permisos
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Role permissions panel */}
              {showRolePerms && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <h4 className="text-sm font-medium">Permisos del rol</h4>
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
                  <h3 className="font-medium flex items-center gap-2"><Users size={16} /> Miembros</h3>
                  {canAssign && (
                    <button onClick={() => setShowAssignMember(dept.id)} className="text-sm text-trueque-600 flex items-center gap-1">
                      <Plus size={14} /> Asignar Miembro
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {members.length === 0 && <p className="text-sm text-gray-400">Sin miembros</p>}
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
            <h2 className="font-bold text-lg">Nuevo Departamento</h2>
            <div>
              <label className="label">Nombre del departamento</label>
              <input className="input" placeholder="Ej: Produccion" value={newDept.name} onChange={(e) => setNewDept({ ...newDept, name: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Nombre del area de trabajo.</p>
            </div>
            <div>
              <label className="label">Descripcion</label>
              <input className="input" placeholder="Ej: Encargados de producir alimentos" value={newDept.description} onChange={(e) => setNewDept({ ...newDept, description: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Para que sirve este departamento.</p>
            </div>
            <div>
              <label className="label">Tipo de grupo</label>
              <select className="input" value={newDept.group_type} onChange={(e) => setNewDept({ ...newDept, group_type: e.target.value })}>
                <option value="department">Departamento (area de trabajo)</option>
                <option value="council">Consejo (grupo de decision)</option>
                <option value="committee">Comision (grupo temporal)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Departamento = area permanente. Consejo = grupo de decision. Comision = grupo temporal para una tarea.</p>
            </div>
            <button onClick={createDept} className="btn-primary w-full">Crear</button>
          </div>
        </div>
      )}

      {/* Modal: Create Role */}
      {showCreateRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateRole(null)}>
          <div className="bg-white rounded-xl p-6 w-96 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">Nuevo Rol</h2>
            <div>
              <label className="label">Nombre del rol</label>
              <input className="input" placeholder="Ej: Coordinador" value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Nombre del rol dentro del departamento.</p>
            </div>
            <div>
              <label className="label">Descripcion</label>
              <input className="input" placeholder="Ej: Coordina las actividades del departamento" value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} />
            </div>
            <button onClick={() => createRole(showCreateRole)} className="btn-primary w-full">Crear</button>
          </div>
        </div>
      )}

      {/* Modal: Assign Member */}
      {showAssignMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAssignMember(null)}>
          <div className="bg-white rounded-xl p-6 w-96 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">Asignar Miembro</h2>
            <div>
              <label className="label">Usuario</label>
              <input className="input" placeholder="Nombre de usuario" value={newMember.user_id} onChange={(e) => setNewMember({ ...newMember, user_id: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Nombre de usuario (username) de la persona a asignar.</p>
            </div>
            <div>
              <label className="label">Rol</label>
              <select className="input" value={newMember.role_id} onChange={(e) => setNewMember({ ...newMember, role_id: e.target.value })}>
                <option value="">Seleccionar rol...</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Que rol tendra esta persona en el departamento.</p>
            </div>
            <button onClick={() => assignMember(showAssignMember)} className="btn-primary w-full">Asignar</button>
          </div>
        </div>
      )}
    </div>
  )
}
