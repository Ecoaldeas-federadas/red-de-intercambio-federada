import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { usePermissions } from '../hooks/usePermissions'
import { ArrowLeft, Users, Wallet as WalletIcon, Vote as VoteIcon, Shield, Plus, Trash2, ArrowUpCircle, ArrowDownCircle, Building2 } from 'lucide-react'
import ScopedAssembly from '../components/ScopedAssembly'
import { fmtTQ } from '../lib/format'

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

export default function DepartmentDetail() {
  const { t } = useTranslation(['organizations', 'common'])
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currency } = useConfig()
  const { hasPermission } = usePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as 'info' | 'roles' | 'members' | 'wallet' | 'assembly') || 'info'
  const [tab, setTab] = useState<'info' | 'roles' | 'members' | 'wallet' | 'assembly'>(initialTab)
  const changeTab = (t: 'info' | 'roles' | 'members' | 'wallet' | 'assembly') => {
    setTab(t)
    setSearchParams({ tab: t })
  }
  const [dept, setDept] = useState<any>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [txs, setTxs] = useState<any[]>([])
  const [balance, setBalance] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showCreateRole, setShowCreateRole] = useState(false)
  const [showAssignMember, setShowAssignMember] = useState(false)
  const [newRole, setNewRole] = useState({ name: '', description: '' })
  const [newMember, setNewMember] = useState({ user_id: '', role_id: '' })
  const [myRole, setMyRole] = useState<any>(null)

  const canManage = hasPermission('dept.manage') || myRole?.can_manage
  const canAssign = hasPermission('dept.assign_members') || myRole?.can_manage
  const canTransfer = hasPermission('dept.manage') || myRole?.can_transfer

  const load = () => {
    if (!id) return
    api.get(`/departments/${id}`).then((d: any) => setDept(d)).catch(() => {})
    api.get(`/departments/${id}/roles`).then((d: any) => setRoles(Array.isArray(d) ? d : [])).catch(() => {})
    api.get(`/departments/${id}/members`).then((d: any) => setMembers(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/accounts/list').then((d: any) => setAllUsers(Array.isArray(d) ? d : [])).catch(() => {})

    // Cargar mi rol en este departamento
    api.get(`/my/departments`).then((d: any) => {
      const list = Array.isArray(d) ? d : []
      const found = list.find((dp: any) => dp.id === id)
      setMyRole(found || null)
    }).catch(() => {})

    // Cargar billetera del departamento
    api.get(`/ledger/transactions?account_id=${id}&limit=100`).then((d: any) => {
      setTxs(Array.isArray(d) ? d : [])
    }).catch(() => {})
    api.get(`/accounts/${id}`).then((d: any) => {
      setBalance(d?.balance ?? 0)
    }).catch(() => {})
  }

  useEffect(() => {
    load()
  }, [id])

  const createRole = async () => {
    setError('')
    if (!newRole.name) {
      setError(t('error_role_name_required', 'El nombre del rol es obligatorio'))
      return
    }
    try {
      await api.post(`/departments/${id}/roles`, newRole)
      setSuccess(t('success_role_created', 'Rol creado'))
      setShowCreateRole(false)
      setNewRole({ name: '', description: '' })
      load()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const assignMember = async () => {
    setError('')
    if (!newMember.user_id || !newMember.role_id) {
      setError(t('error_select_user_role', 'Selecciona usuario y rol'))
      return
    }
    try {
      await api.post(`/departments/${id}/members`, newMember)
      setSuccess(t('success_member_assigned', 'Miembro asignado'))
      setShowAssignMember(false)
      setNewMember({ user_id: '', role_id: '' })
      load()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const removeMember = async (userId: string) => {
    try {
      await api.delete(`/departments/${id}/members/${userId}`)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const fmtAmount = (n: number) => fmtTQ(n)

  if (!dept) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/app/departments')} className="text-trueque-600 flex items-center gap-1">
          <ArrowLeft size={16} /> {t('dept_detail_back', 'Volver')}
        </button>
        <p className="text-gray-500">{t('dept_detail_loading', 'Cargando departamento...')}</p>
      </div>
    )
  }

  const tabs = [
    { key: 'info', label: t('dept_detail_tab_info', 'Informacion'), icon: <Building2 size={16} /> },
    { key: 'roles', label: t('dept_detail_tab_roles', 'Roles'), icon: <Shield size={16} /> },
    { key: 'members', label: t('dept_detail_tab_members', 'Miembros'), icon: <Users size={16} /> },
    { key: 'wallet', label: t('dept_detail_tab_wallet', 'Billetera'), icon: <WalletIcon size={16} /> },
    { key: 'assembly', label: t('dept_detail_tab_assembly', 'Asamblea'), icon: <VoteIcon size={16} /> },
  ]

  // Buscar la cuenta del departamento (usuario con account_type='department' asociado)
  const deptAccount = allUsers.find((u: any) => u.account_type === 'department' && u.display_name?.includes(dept.name))

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/app/departments')} className="text-trueque-600 flex items-center gap-1 text-sm">
        <ArrowLeft size={16} /> {t('dept_detail_back_to_depts', 'Volver a departamentos')}
      </button>

      <div className="card">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 rounded-full p-3">
            <Building2 size={24} className="text-blue-700" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{dept.name}</h1>
            <p className="text-sm text-gray-500">{dept.description}</p>
            <p className="text-xs text-gray-400 mt-1">
              {t('dept_detail_type', 'Tipo:')} {dept.group_type} | {t('dept_detail_belongs_to', 'Pertenece a:')} {dept.parent_organization_name || t('departments_assembly_node', 'La Asamblea (nodo)')}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${dept.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {dept.is_active ? t('dept_detail_active', 'Activo') : t('dept_detail_inactive', 'Inactivo')}
          </span>
        </div>
        {myRole && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-gray-500">{t('dept_detail_your_role', 'Tu rol aqui:')}</span>
            <span className="font-medium text-teal-700">{myRole.role}</span>
            {myRole.can_manage && <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded">{t('dept_detail_can_manage', 'Puede gestionar')}</span>}
            {myRole.can_transfer && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t('dept_detail_can_transfer', 'Puede transferir')}</span>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => changeTab(t.key as 'info' | 'roles' | 'members' | 'wallet' | 'assembly')}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-1 whitespace-nowrap ${
              tab === t.key ? 'text-trueque-700 border-b-2 border-trueque-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
      {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg">{success}</div>}

      {/* Tab: Informacion */}
      {tab === 'info' && (
        <div className="card space-y-3">
          <h2 className="font-semibold">{t('dept_detail_info_title', 'Informacion del Departamento')}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">{t('dept_detail_name', 'Nombre:')}</p>
              <p className="font-medium">{dept.name}</p>
            </div>
            <div>
              <p className="text-gray-500">{t('dept_detail_type_label', 'Tipo:')}</p>
              <p className="font-medium">{dept.group_type}</p>
            </div>
            <div>
              <p className="text-gray-500">{t('dept_detail_description', 'Descripcion:')}</p>
              <p className="font-medium">{dept.description}</p>
            </div>
            <div>
              <p className="text-gray-500">{t('dept_detail_belongs_to_label', 'Pertenece a:')}</p>
              <p className="font-medium">{dept.parent_organization_name || t('departments_assembly_node', 'La Asamblea (nodo)')}</p>
            </div>
            {dept.head_username && (
              <div>
                <p className="text-gray-500">{t('dept_detail_head', 'Jefe del departamento:')}</p>
                <p className="font-medium">{dept.head_username}</p>
              </div>
            )}
          </div>
          {deptAccount && (
            <p className="text-xs text-gray-400">
              {t('dept_detail_account', 'Cuenta del departamento:')} @{deptAccount.username} | {t('dept_detail_balance', 'Balance:')} {fmtAmount(deptAccount.balance || 0)} {currency}
            </p>
          )}
        </div>
      )}

      {/* Tab: Roles */}
      {tab === 'roles' && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Shield size={18} /> {t('dept_detail_roles_title', 'Roles')}</h2>
            {canManage && (
              <button onClick={() => setShowCreateRole(!showCreateRole)} className="btn-primary text-sm flex items-center gap-1">
                <Plus size={14} /> {t('dept_detail_new_role', 'Nuevo Rol')}
              </button>
            )}
          </div>

          {showCreateRole && (
            <div className="border rounded-lg p-3 space-y-2">
              <input className="input" placeholder={t('dept_detail_role_name_placeholder', 'Nombre del rol (ej: Coordinador)')} value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} />
              <input className="input" placeholder={t('dept_detail_role_desc_placeholder', 'Descripcion (opcional)')} value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} />
              <button onClick={createRole} className="btn-primary text-sm">{t('dept_detail_create', 'Crear')}</button>
            </div>
          )}

          {roles.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('dept_detail_no_roles', 'Sin roles. Crea el primero con el boton de arriba.')}</p>
          ) : (
            <div className="space-y-2">
              {roles.map((role) => (
                <div key={role.id} className="bg-gray-50 rounded-lg p-3">
                  <span className="font-medium">{role.name}</span>
                  {role.description && <p className="text-xs text-gray-500">{role.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Miembros */}
      {tab === 'members' && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Users size={18} /> {t('dept_detail_members_title', 'Miembros')}</h2>
            {canAssign && (
              <button onClick={() => setShowAssignMember(!showAssignMember)} className="btn-primary text-sm flex items-center gap-1">
                <Plus size={14} /> {t('dept_detail_assign_member', 'Asignar Miembro')}
              </button>
            )}
          </div>

          {showAssignMember && (
            <div className="border rounded-lg p-3 space-y-2">
              <select className="input" value={newMember.user_id} onChange={(e) => setNewMember({ ...newMember, user_id: e.target.value })}>
                <option value="">{t('dept_detail_select_user', 'Seleccionar usuario...')}</option>
                {allUsers.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.display_name || u.username} ({u.username})</option>
                ))}
              </select>
              <select className="input" value={newMember.role_id} onChange={(e) => setNewMember({ ...newMember, role_id: e.target.value })}>
                <option value="">{t('dept_detail_select_role', 'Seleccionar rol...')}</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <button onClick={assignMember} className="btn-primary text-sm">{t('dept_detail_assign', 'Asignar')}</button>
            </div>
          )}

          {members.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('dept_detail_no_members', 'Sin miembros. Asigna el primero con el boton de arriba.')}</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <div>
                    <span className="font-medium">{m.username}</span>
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{m.role_name}</span>
                  </div>
                  {canAssign && (
                    <button onClick={() => removeMember(m.user_id)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Billetera */}
      {tab === 'wallet' && (
        <div className="space-y-4">
          <div className="card">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">{t('dept_detail_wallet_balance', 'Saldo de')} {dept.name}</p>
                  <p className="text-4xl font-bold mt-1">
                    {balance >= 0 ? '+' : ''}{fmtAmount(balance)} {currency}
                  </p>
                  {deptAccount && (
                    <p className="text-blue-200 text-xs mt-2">{t('dept_detail_account_label', 'Cuenta:')} @{deptAccount.username}</p>
                  )}
                </div>
                <WalletIcon size={48} className="text-blue-200" />
              </div>
            </div>
            {deptAccount && (
              <p className="text-xs text-gray-400 mt-3 p-2">
                {t('dept_detail_transfer_hint', 'Para transferir a este departamento, usa @{{username}} como destinatario.', { username: deptAccount.username })}
              </p>
            )}
          </div>

          <div className="card">
            <h2 className="font-semibold text-lg mb-3">{t('dept_detail_movements', 'Movimientos')}</h2>
            {txs.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">{t('dept_detail_no_transactions', 'No hay transacciones en esta cuenta.')}</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {txs.map((t, i) => {
                  const isDebit = t.direction === 'debit'
                  const fromName = t.sender_display || t.from_user || t.sender_name || '???'
                  const toName = t.receiver_display || t.to_user || t.receiver_name || '???'
                  return (
                    <div key={i} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        {isDebit ? (
                          <ArrowUpCircle size={20} className="text-red-500" />
                        ) : (
                          <ArrowDownCircle size={20} className="text-green-500" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {isDebit ? t('dept_detail_sent_to', 'Enviado a') + ' ' : t('dept_detail_received_from', 'Recibido de') + ' '}
                            <span className="font-semibold">{isDebit ? toName : fromName}</span>
                          </p>
                          <p className="text-xs text-gray-500">
                            {String(t.created_at || '').slice(0, 16).replace('T', ' ')}
                            {t.description ? ` - ${t.description}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className={`font-bold text-sm ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                        {isDebit ? '-' : '+'}{fmtAmount(t.amount || 0)} {currency}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Asamblea */}
      {tab === 'assembly' && (
        <ScopedAssembly scope="department" scopeId={id!} scopeName={dept.name} />
      )}
    </div>
  )
}
