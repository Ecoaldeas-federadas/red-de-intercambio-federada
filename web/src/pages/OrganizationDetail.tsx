import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { usePermissions } from '../hooks/usePermissions'
import { ArrowLeft, Users, Wallet as WalletIcon, Vote as VoteIcon, Settings, Crown, Plus, Trash2, ArrowUpCircle, ArrowDownCircle, FileText, Building2, Plug, Landmark, ExternalLink } from 'lucide-react'
import ScopedAssembly from '../components/ScopedAssembly'

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currency } = useConfig()
  const { hasPermission } = usePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as 'info' | 'board' | 'members' | 'departments' | 'services' | 'wallet' | 'assembly' | 'boardmeetings') || 'info'
  const [tab, setTab] = useState<'info' | 'board' | 'members' | 'departments' | 'services' | 'wallet' | 'assembly' | 'boardmeetings'>(initialTab)
  const changeTab = (t: 'info' | 'board' | 'members' | 'departments' | 'services' | 'wallet' | 'assembly' | 'boardmeetings') => {
    setTab(t)
    setSearchParams({ tab: t })
  }
  const [org, setOrg] = useState<any>(null)
  const [boardMembers, setBoardMembers] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [orgMembers, setOrgMembers] = useState<any[]>([])
  const [txs, setTxs] = useState<any[]>([])
  const [balance, setBalance] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [boardForm, setBoardForm] = useState({ user_id: '', position: 'presidente' })
  const [multisig, setMultisig] = useState<any>(null)
  const [multisigForm, setMultisigForm] = useState({ required_signatures: 1, authorized_signers: [] as string[] })
  const [myRole, setMyRole] = useState<any>(null)
  const [deptList, setDeptList] = useState<any[]>([])
  const [showDeptForm, setShowDeptForm] = useState(false)
  const [deptForm, setDeptForm] = useState({ name: '', description: '' })
  const [services, setServices] = useState<any[]>([])
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [serviceForm, setServiceForm] = useState({
    name: '', description: '', service_type: 'subscription', amount: 0,
    frequency: 'monthly', is_mandatory: false,
    obligations: '', rights: '', duties: '',
  })
  const [fundData, setFundData] = useState<any>(null)

  // Detectar si esta organizacion es la Asamblea General del nodo
  const isAssemblyOrg = org?.is_assembly_owned && org?.username === 'asamblea'

  const canManage = hasPermission('org.manage') || myRole?.can_manage
  const canTransfer = hasPermission('org.manage') || myRole?.can_transfer
  const canConfig = hasPermission('org.manage') || myRole?.can_config

  const load = () => {
    if (!id) return
    api.get(`/organizations`).then((d: any) => {
      const list = Array.isArray(d) ? d : []
      const found = list.find((o: any) => o.id === id)
      setOrg(found || null)
    }).catch(() => {})

    // Cargar mi rol en esta organizacion
    api.get(`/my/organizations`).then((d: any) => {
      const list = Array.isArray(d) ? d : []
      const found = list.find((o: any) => o.id === id)
      setMyRole(found || null)
    }).catch(() => {})

    api.get(`/organizations/${id}/board`).then((d: any) => {
      setBoardMembers(Array.isArray(d) ? d : [])
    }).catch(() => {})

    api.get('/accounts/list').then((d: any) => {
      setAllUsers(Array.isArray(d) ? d : [])
    }).catch(() => {})

    // Cargar miembros de la organizacion (usuarios con parent_organization_id = org)
    // Por ahora usamos allUsers filtrado si tiene campo organization_id

    // Cargar billetera
    if (org?.id) {
      api.get(`/ledger/transactions?account_id=${org.id}&limit=100`).then((d: any) => {
        setTxs(Array.isArray(d) ? d : [])
      }).catch(() => {})
      api.get(`/accounts/${org.id}`).then((d: any) => {
        setBalance(d?.balance ?? 0)
      }).catch(() => {})
    }

    // Cargar multisig
    api.get(`/organizations/${id}/multisig`).then((d: any) => {
      setMultisig(d)
      if (d?.required_signatures) {
        setMultisigForm({
          required_signatures: d.required_signatures,
          authorized_signers: (d.authorized_signers || []).map((s: any) => s.user_id || s.id),
        })
      }
    }).catch(() => {})

    // Cargar departamentos de esta organizacion
    api.get('/departments').then((d: any) => {
      const all = Array.isArray(d) ? d : []
      setDeptList(all.filter((dp: any) => dp.parent_organization_id === id))
    }).catch(() => setDeptList([]))

    // Cargar servicios de esta organizacion
    api.get(`/organizations/${id}/services`).then((d: any) => {
      setServices(Array.isArray(d) ? d : [])
    }).catch(() => setServices([]))
  }

  useEffect(() => {
    load()
  }, [id])

  // Cargar fondo comunitario si es la org Asamblea
  useEffect(() => {
    if (isAssemblyOrg) {
      api.get('/fund/balance').then(setFundData).catch(() => {})
    }
  }, [isAssemblyOrg])

  useEffect(() => {
    if (org?.id) {
      if (isAssemblyOrg) {
        // Para la Asamblea, usar el fondo comunitario como billetera
        api.get('/fund/balance').then((d: any) => {
          setBalance(d?.balance ?? 0)
          setFundData(d)
          if (d?.fund_account) {
            api.get(`/ledger/transactions?account_id=${d.fund_account}&limit=100`).then((td: any) => {
              setTxs(Array.isArray(td) ? td : [])
            }).catch(() => setTxs([]))
          }
        }).catch(() => {})
      } else {
        api.get(`/ledger/transactions?account_id=${org.id}&limit=100`).then((d: any) => {
          setTxs(Array.isArray(d) ? d : [])
        }).catch(() => {})
        api.get(`/accounts/${org.id}`).then((d: any) => {
          setBalance(d?.balance ?? 0)
        }).catch(() => {})
      }
    }
  }, [org?.id, isAssemblyOrg])

  const assignBoard = async () => {
    setError('')
    if (!boardForm.user_id) {
      setError('Selecciona un usuario')
      return
    }
    try {
      await api.post(`/organizations/${id}/board`, boardForm)
      setSuccess('Miembro asignado a la junta directiva')
      setBoardForm({ user_id: '', position: 'presidente' })
      load()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const removeBoard = async (memberId: string) => {
    try {
      await api.delete(`/organizations/${id}/board/${memberId}`)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const saveMultisig = async () => {
    try {
      await api.put(`/organizations/${id}/multisig`, multisigForm)
      setSuccess('Configuracion multi-firma guardada')
      setTimeout(() => setSuccess(''), 3000)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const createDept = async () => {
    setError('')
    if (!deptForm.name.trim()) {
      setError('El nombre del departamento es obligatorio')
      return
    }
    try {
      await api.post('/departments', {
        name: deptForm.name,
        description: deptForm.description,
        group_type: 'department',
        parent_organization_id: id,
      })
      setSuccess('Departamento creado')
      setDeptForm({ name: '', description: '' })
      setShowDeptForm(false)
      load()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const fmtAmount = (n: number) => Math.round(n * 100) / 100

  if (!org) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/app/organizations')} className="text-trueque-600 flex items-center gap-1">
          <ArrowLeft size={16} /> Volver
        </button>
        <p className="text-gray-500">Cargando organizacion...</p>
      </div>
    )
  }

  const POSITIONS = [
    { value: 'presidente', label: 'Presidente' },
    { value: 'vicepresidente', label: 'Vicepresidente' },
    { value: 'secretario', label: 'Secretario/a' },
    { value: 'tesorero', label: 'Tesorero/a' },
    { value: 'vocal', label: 'Vocal' },
  ]

  const tabs = [
    { key: 'info', label: 'Informacion', icon: <Settings size={16} /> },
    { key: 'board', label: 'Junta Directiva', icon: <Crown size={16} /> },
    { key: 'members', label: 'Miembros', icon: <Users size={16} /> },
    { key: 'departments', label: 'Departamentos', icon: <Building2 size={16} /> },
    { key: 'services', label: 'Servicios', icon: <Plug size={16} /> },
    { key: 'wallet', label: 'Billetera', icon: <WalletIcon size={16} /> },
    // La pestana Asamblea solo aparece para orgs que NO son la Asamblea General
    ...(isAssemblyOrg ? [] : [{ key: 'assembly', label: 'Asamblea', icon: <VoteIcon size={16} /> }]),
    { key: 'boardmeetings', label: 'Reuniones Junta', icon: <VoteIcon size={16} /> },
  ]

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/app/organizations')} className="text-trueque-600 flex items-center gap-1 text-sm">
        <ArrowLeft size={16} /> Volver a organizaciones
      </button>

      <div className={`card ${isAssemblyOrg ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300' : ''}`}>
        <div className="flex items-center gap-3">
          <div className={`rounded-full p-3 ${isAssemblyOrg ? 'bg-amber-100' : 'bg-trueque-100'}`}>
            {isAssemblyOrg ? <Landmark size={24} className="text-amber-700" /> : <Users size={24} className="text-trueque-700" />}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{org.display_name || org.username}</h1>
            <p className="text-sm text-gray-500">
              @{org.username} | {org.organization_subtype || 'Organizacion'}
              {isAssemblyOrg && <span className="ml-2 text-amber-700 font-semibold">Organizacion Base del Nodo</span>}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${org.is_approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {org.is_approved ? 'Aprobada' : 'Pendiente'}
          </span>
        </div>
        {isAssemblyOrg && (
          <div className="mt-3 pt-3 border-t border-amber-200">
            <button
              onClick={() => navigate('/app/assembly')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition"
            >
              <VoteIcon size={16} />
              Ir a la Asamblea General
              <ExternalLink size={14} />
            </button>
            <p className="text-xs text-amber-700 mt-2">
              Esta organizacion es la Asamblea General del nodo. Sus reuniones, propuestas y votaciones se gestionan en la pestaña Asamblea del menu principal. La billetera de esta organizacion es el Fondo Comunitario.
            </p>
          </div>
        )}
        {myRole && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-gray-500">Tu rol aqui:</span>
            <span className="font-medium text-purple-700">{myRole.role}</span>
            {myRole.is_board_member && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Junta Directiva</span>}
            {myRole.can_transfer && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Puede transferir</span>}
            {myRole.can_config && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Puede configurar</span>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => changeTab(t.key as any)}
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
          <h2 className="font-semibold">Informacion de la Organizacion</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Nombre:</p>
              <p className="font-medium">{org.display_name || org.username}</p>
            </div>
            <div>
              <p className="text-gray-500">Usuario:</p>
              <p className="font-medium">@{org.username}</p>
            </div>
            <div>
              <p className="text-gray-500">Tipo:</p>
              <p className="font-medium">{org.organization_subtype || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500">Balance{isAssemblyOrg ? ' (Fondo Comunitario)' : ''}:</p>
              <p className="font-medium">{fmtAmount(balance)} {currency}</p>
            </div>
            <div>
              <p className="text-gray-500">Limite credito:</p>
              <p className="font-medium">{org.credit_limit || 0} {currency}</p>
            </div>
            <div>
              <p className="text-gray-500">Limite debito:</p>
              <p className="font-medium">{org.debit_limit || 0} {currency}</p>
            </div>
          </div>
          {isAssemblyOrg ? (
            <div className="space-y-2">
              <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                Esta cuenta es la Asamblea General, el Fondo Comunitario y la cuenta de Impuestos. Es una sola cuenta con 3 nombres.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-mono">@asamblea</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-mono">@impuestos</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-mono">@fondo_comunitario</span>
              </div>
              <p className="text-xs text-gray-400">Los 3 nombres son aliases de la misma cuenta. Puedes usar cualquiera para transferir.</p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              Para transferir a esta organizacion, usa su usuario @{org.username} como destinatario.
            </p>
          )}
        </div>
      )}

      {/* Tab: Junta Directiva */}
      {tab === 'board' && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Crown size={18} /> Junta Directiva</h2>
            <p className="text-xs text-gray-500">Los cargos asignados definen quienes pueden tomar decisiones en nombre de la organizacion.</p>

            {boardMembers.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay miembros en la junta directiva.</p>
            ) : (
              <div className="space-y-2">
                {boardMembers.map((m, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div>
                      <span className="font-medium">{m.display_name || m.username}</span>
                      <span className="ml-2 text-xs bg-trueque-100 text-trueque-700 px-2 py-0.5 rounded">{m.position}</span>
                    </div>
                    {canManage && (
                      <button onClick={() => removeBoard(m.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canManage && (
              <div className="border-t pt-3 space-y-2">
                <h3 className="text-sm font-medium">Asignar nuevo miembro</h3>
                <div className="grid grid-cols-2 gap-2">
                  <select className="input" value={boardForm.user_id} onChange={(e) => setBoardForm({ ...boardForm, user_id: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {allUsers.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.display_name || u.username} ({u.username})</option>
                    ))}
                  </select>
                  <select className="input" value={boardForm.position} onChange={(e) => setBoardForm({ ...boardForm, position: e.target.value })}>
                    {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <button onClick={assignBoard} className="btn-primary text-sm">Asignar</button>
              </div>
            )}
          </div>

          {/* Multi-firma */}
          <div className="card space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Settings size={18} /> Multi-firma</h2>
            <p className="text-xs text-gray-500">Selecciona quienes deben firmar para aprobar transacciones de esta organizacion.</p>

            <div>
              <label className="label">Firmas requeridas</label>
              <input
                type="number"
                min={1}
                className="input"
                value={multisigForm.required_signatures}
                onChange={(e) => setMultisigForm({ ...multisigForm, required_signatures: parseInt(e.target.value) || 1 })}
              />
            </div>

            <div>
              <label className="label">Personas autorizadas a firmar</label>
              <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-2">
                {allUsers.map((u: any) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={multisigForm.authorized_signers.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setMultisigForm({ ...multisigForm, authorized_signers: [...multisigForm.authorized_signers, u.id] })
                        } else {
                          setMultisigForm({ ...multisigForm, authorized_signers: multisigForm.authorized_signers.filter((s) => s !== u.id) })
                        }
                      }}
                    />
                    {u.display_name || u.username} ({u.username})
                  </label>
                ))}
              </div>
            </div>

            {canManage && (
              <button onClick={saveMultisig} className="btn-primary text-sm">Guardar configuracion</button>
            )}
          </div>
        </div>
      )}

      {/* Tab: Miembros */}
      {tab === 'members' && (
        <div className="card space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Users size={18} /> Miembros de la Organizacion</h2>
          <p className="text-xs text-gray-500">Los miembros pueden ver las actividades de la organizacion y participar en sus decisiones.</p>
          {orgMembers.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay miembros asignados a esta organizacion.</p>
          ) : (
            <div className="space-y-2">
              {orgMembers.map((m, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <span className="font-medium">{m.display_name || m.username}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Departamentos */}
      {tab === 'departments' && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold flex items-center gap-2"><Building2 size={18} /> Departamentos de {org.display_name || org.username}</h2>
                <p className="text-xs text-gray-500 mt-1">Los departamentos son subgrupos internos de esta organizacion. Cada departamento tiene sus propios miembros, roles y billetera.</p>
              </div>
              {canManage && (
                <button onClick={() => setShowDeptForm(!showDeptForm)} className="btn-primary text-sm flex items-center gap-1">
                  <Plus size={16} /> Nuevo Departamento
                </button>
              )}
            </div>

            {showDeptForm && (
              <div className="border-t pt-3 space-y-2">
                <div>
                  <label className="label">Nombre del departamento</label>
                  <input
                    className="input"
                    placeholder="Ej: Comision de Economia, Consejo de Vision..."
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Descripcion</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Que hace este departamento?"
                    value={deptForm.description}
                    onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  />
                </div>
                <button onClick={createDept} className="btn-primary text-sm">Crear Departamento</button>
              </div>
            )}

            {deptList.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Building2 size={32} className="mx-auto mb-2 text-gray-300" />
                <p>Esta organizacion no tiene departamentos.</p>
                {canManage && <p className="text-xs mt-1">Crea uno con el boton "Nuevo Departamento".</p>}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {deptList.map((dp, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3 hover:border-trueque-300 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 size={16} className="text-trueque-600" />
                      <h3 className="font-medium text-sm">{dp.name}</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{dp.description || 'Sin descripcion'}</p>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-0.5 rounded ${dp.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {dp.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                      <button
                        onClick={() => navigate(`/app/departments/${dp.id}`)}
                        className="text-xs text-trueque-600 hover:underline flex items-center gap-1 font-medium"
                      >
                        Abrir <ArrowUpCircle size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Servicios */}
      {tab === 'services' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-lg flex items-center gap-2"><Plug size={18} />Servicios de la Organizacion</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Servicios que ofrece esta organizacion: mensualidades, cobros, pagos a miembros.
                </p>
              </div>
              {canConfig && (
                <button
                  onClick={() => setShowServiceForm(!showServiceForm)}
                  className="px-3 py-1.5 bg-trueque-600 text-white rounded-lg text-sm font-medium hover:bg-trueque-700"
                >
                  <Plus size={14} className="inline mr-1" />Nuevo Servicio
                </button>
              )}
            </div>

            {showServiceForm && canConfig && (
              <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                <h3 className="font-medium mb-3">Crear Nuevo Servicio</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Nombre del servicio *</label>
                    <input
                      className="input mt-1"
                      value={serviceForm.name}
                      onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                      placeholder="Ej: Mensualidad Electrica"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Tipo de servicio</label>
                    <select
                      className="input mt-1"
                      value={serviceForm.service_type}
                      onChange={(e) => setServiceForm({ ...serviceForm, service_type: e.target.value })}
                    >
                      <option value="subscription">Cobro: la organizacion cobra al miembro</option>
                      <option value="benefit">Pago: la organizacion PAGA al miembro</option>
                      <option value="one_time">Cobro unico: pago una sola vez</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Monto (0 = gratuito)</label>
                    <input
                      type="number"
                      className="input mt-1"
                      value={serviceForm.amount}
                      onChange={(e) => setServiceForm({ ...serviceForm, amount: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Frecuencia</label>
                    <select
                      className="input mt-1"
                      value={serviceForm.frequency}
                      onChange={(e) => setServiceForm({ ...serviceForm, frequency: e.target.value })}
                    >
                      <option value="monthly">Mensual</option>
                      <option value="quarterly">Trimestral</option>
                      <option value="annual">Anual</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500">Descripcion</label>
                    <input
                      className="input mt-1"
                      value={serviceForm.description}
                      onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                      placeholder="Que incluye el servicio"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Obligaciones del miembro</label>
                    <textarea
                      className="input mt-1"
                      rows={2}
                      value={serviceForm.obligations}
                      onChange={(e) => setServiceForm({ ...serviceForm, obligations: e.target.value })}
                      placeholder="Que debe hacer el miembro"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Derechos del miembro</label>
                    <textarea
                      className="input mt-1"
                      rows={2}
                      value={serviceForm.rights}
                      onChange={(e) => setServiceForm({ ...serviceForm, rights: e.target.value })}
                      placeholder="Que recibe el miembro"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500">Deberes del miembro</label>
                    <textarea
                      className="input mt-1"
                      rows={2}
                      value={serviceForm.duties}
                      onChange={(e) => setServiceForm({ ...serviceForm, duties: e.target.value })}
                      placeholder="Tareas o compromisos esperados"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={serviceForm.is_mandatory}
                        onChange={(e) => setServiceForm({ ...serviceForm, is_mandatory: e.target.checked })}
                      />
                      <span>
                        <strong>Servicio obligatorio</strong> — todos los miembros deben cumplir
                        {org?.is_assembly_owned ? ' (aplica a todos los miembros del nodo)' : ' (requiere aprobacion por votacion de los miembros de la organizacion)'}
                      </span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => {
                      if (!serviceForm.name) { alert('El nombre es requerido'); return }
                      api.post(`/organizations/${id}/services`, serviceForm).then(() => {
                        setSuccess('Servicio creado')
                        setShowServiceForm(false)
                        setServiceForm({ name: '', description: '', service_type: 'subscription', amount: 0, frequency: 'monthly', is_mandatory: false, obligations: '', rights: '', duties: '' })
                        load()
                        setTimeout(() => setSuccess(''), 3000)
                      }).catch((err: any) => {
                        alert(err instanceof Error ? err.message : 'Error al crear servicio')
                      })
                    }}
                    className="px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm font-medium hover:bg-trueque-700"
                  >
                    Crear Servicio
                  </button>
                  <button
                    onClick={() => setShowServiceForm(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {services.length === 0 ? (
              <p className="text-gray-400 py-8 text-center">Esta organizacion no tiene servicios activos.</p>
            ) : (
              <div className="space-y-3">
                {services.map((svc: any) => (
                  <div key={svc.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium">{svc.name}</h3>
                          {svc.is_mandatory && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Obligatorio</span>
                          )}
                          {svc.service_type === 'benefit' && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Paga al miembro</span>
                          )}
                          {svc.service_type === 'one_time' && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Pago unico</span>
                          )}
                          {svc.amount === 0 && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Gratuito</span>
                          )}
                          {!svc.is_active && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Inactivo</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{svc.description}</p>
                        <p className="text-sm font-medium mt-2">
                          {svc.service_type === 'benefit' ? '+' : svc.amount === 0 ? '' : '-'}
                          {svc.amount > 0 ? `${fmtAmount(svc.amount)} ${currency}` : 'Gratuito'}
                          {svc.amount > 0 && svc.frequency === 'monthly' ? ' / mes' : svc.frequency === 'quarterly' ? ' / trimestre' : svc.frequency === 'annual' ? ' / ano' : ''}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {svc.subscribers_count || 0} suscriptores
                        </p>
                      </div>
                      {canConfig && svc.is_active && (
                        <button
                          onClick={() => {
                            if (!confirm('Desactivar este servicio?')) return
                            api.delete(`/organizations/services/${svc.id}`).then(() => {
                              load()
                            }).catch(() => {})
                          }}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Desactivar
                        </button>
                      )}
                    </div>
                    {(svc.obligations || svc.rights || svc.duties) && (
                      <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        {svc.obligations && (
                          <div><strong className="text-gray-700">Obligaciones:</strong> <span className="text-gray-500">{svc.obligations}</span></div>
                        )}
                        {svc.rights && (
                          <div><strong className="text-gray-700">Derechos:</strong> <span className="text-gray-500">{svc.rights}</span></div>
                        )}
                        {svc.duties && (
                          <div><strong className="text-gray-700">Deberes:</strong> <span className="text-gray-500">{svc.duties}</span></div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Billetera */}
      {tab === 'wallet' && (
        <div className="space-y-4">
          <div className="card">
            <div className={`text-white rounded-xl p-6 ${isAssemblyOrg ? 'bg-gradient-to-r from-amber-600 to-yellow-700' : 'bg-gradient-to-r from-trueque-600 to-trueque-700'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm">
                    {isAssemblyOrg ? 'Fondo Comunitario (Asamblea General)' : `Saldo de ${org.display_name || org.username}`}
                  </p>
                  <p className="text-4xl font-bold mt-1">
                    {balance >= 0 ? '+' : ''}{fmtAmount(balance)} {currency}
                  </p>
                  <p className="text-amber-200 text-xs mt-2">
                    {isAssemblyOrg ? 'Cuenta: Fondo Comunitario' : `Cuenta: @{org.username}`}
                  </p>
                  {isAssemblyOrg && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs bg-amber-500/30 text-amber-100 px-2 py-0.5 rounded font-mono">@asamblea</span>
                      <span className="text-xs bg-amber-500/30 text-amber-100 px-2 py-0.5 rounded font-mono">@impuestos</span>
                      <span className="text-xs bg-amber-500/30 text-amber-100 px-2 py-0.5 rounded font-mono">@fondo_comunitario</span>
                    </div>
                  )}
                </div>
                <WalletIcon size={48} className="text-amber-200" />
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-lg mb-3">Movimientos</h2>
            {txs.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">No hay transacciones en esta cuenta.</p>
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
                            {isDebit ? 'Enviado a ' : 'Recibido de '}
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

      {/* Tab: Asamblea (solo para orgs que NO son la Asamblea General) */}
      {tab === 'assembly' && !isAssemblyOrg && (
        <ScopedAssembly scope="organization" scopeId={id!} scopeName={org.display_name || org.username} isAssemblyOwned={org?.is_assembly_owned} />
      )}

      {/* Tab: Reuniones de Junta Directiva */}
      {tab === 'boardmeetings' && (
        <ScopedAssembly scope="organization" scopeId={id!} scopeName={org.display_name || org.username} meetingType="board" />
      )}
    </div>
  )
}
