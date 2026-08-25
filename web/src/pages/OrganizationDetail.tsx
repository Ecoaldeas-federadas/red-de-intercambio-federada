import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { usePermissions } from '../hooks/usePermissions'
import { ArrowLeft, Users, Wallet as WalletIcon, Vote as VoteIcon, Settings, Crown, Plus, Trash2, ArrowUpCircle, ArrowDownCircle, FileText, Building2, Plug, Landmark, ExternalLink, ShoppingBag, UserCheck, Power, Eye, Clock } from 'lucide-react'
import ScopedAssembly from '../components/ScopedAssembly'

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currency } = useConfig()
  const { hasPermission } = usePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as 'info' | 'board' | 'members' | 'departments' | 'services' | 'wallet' | 'assembly' | 'boardmeetings' | 'terminals') || 'info'
  const [tab, setTab] = useState<'info' | 'board' | 'members' | 'departments' | 'services' | 'wallet' | 'assembly' | 'boardmeetings' | 'terminals'>(initialTab)
  const changeTab = (t: 'info' | 'board' | 'members' | 'departments' | 'services' | 'wallet' | 'assembly' | 'boardmeetings' | 'terminals') => {
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
  // Es una organizacion creada por la Asamblea (no es la Asamblea misma)
  // Estas organizaciones tienen tratamiento especial: marco amber, link a Asamblea,
  // sin pestaña de Asamblea propia (la Asamblea es del nodo, no de cada org)
  const isAssemblyOwned = org?.is_assembly_owned && org?.username !== 'asamblea'

  const canManage = hasPermission('org.manage') || myRole?.can_manage
  const canTransfer = hasPermission('org.manage') || myRole?.can_transfer
  const canConfig = hasPermission('org.manage') || myRole?.can_config

  const load = () => {
    if (!id) return
    // Buscar la organizacion en ambas listas:
    // /organizations (excluye asamblea y sus orgs)
    // /my/organizations (incluye todas, con is_assembly_owned)
    Promise.all([
      api.get('/organizations').catch(() => []),
      api.get('/my/organizations').catch(() => []),
    ]).then(([allOrgs, myOrgs]: any) => {
      const allList = Array.isArray(allOrgs) ? allOrgs : []
      const myList = Array.isArray(myOrgs) ? myOrgs : []
      const found = allList.find((o: any) => o.id === id) || myList.find((o: any) => o.id === id)
      setOrg(found || null)
      const myFound = myList.find((o: any) => o.id === id)
      setMyRole(myFound || null)
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

  // Las organizaciones creadas por la Asamblea muestran su propio balance
  // (no el del Fondo Comunitario - el Fondo Comunitario se ve en la pagina de Asamblea)
  useEffect(() => {
    if (org?.id) {
      api.get(`/ledger/transactions?account_id=${org.id}&limit=100`).then((d: any) => {
        setTxs(Array.isArray(d) ? d : [])
      }).catch(() => setTxs([]))
      api.get(`/accounts/${org.id}`).then((d: any) => {
        setBalance(d?.balance ?? 0)
      }).catch(() => {})
    }
  }, [org?.id])

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
    { key: 'terminals', label: 'Puntos de Venta', icon: <ShoppingBag size={16} /> },
    { key: 'wallet', label: 'Billetera', icon: <WalletIcon size={16} /> },
    // La pestana Asamblea solo aparece para orgs que NO son la Asamblea General
    ...(isAssemblyOwned ? [] : [{ key: 'assembly', label: 'Asamblea', icon: <VoteIcon size={16} /> }]),
    { key: 'boardmeetings', label: 'Reuniones Junta', icon: <VoteIcon size={16} /> },
  ]

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/app/organizations')} className="text-trueque-600 flex items-center gap-1 text-sm">
        <ArrowLeft size={16} /> Volver a organizaciones
      </button>

      <div className={`card ${isAssemblyOwned ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300' : ''}`}>
        <div className="flex items-center gap-3">
          <div className={`rounded-full p-3 ${isAssemblyOwned ? 'bg-amber-100' : 'bg-trueque-100'}`}>
            {isAssemblyOwned ? <Landmark size={24} className="text-amber-700" /> : <Users size={24} className="text-trueque-700" />}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{org.display_name || org.username}</h1>
            <p className="text-sm text-gray-500">
              @{org.username} | {org.organization_subtype || 'Organizacion'}
              {isAssemblyOwned && <span className="ml-2 text-amber-700 font-semibold">Creada por la Asamblea</span>}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${org.is_approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {org.is_approved ? 'Aprobada' : 'Pendiente'}
          </span>
        </div>
        {isAssemblyOwned && (
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
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
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
              <p className="text-gray-500">Balance:</p>
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
          {isAssemblyOwned && (
            <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
              Esta organizacion fue creada por la Asamblea. Las decisiones sobre el Fondo Comunitario se toman en la <button onClick={() => navigate('/app/assembly')} className="underline font-semibold">pagina de la Asamblea</button>.
            </p>
          )}
          <p className="text-xs text-gray-400">
            Para transferir a esta organizacion, usa su usuario @{org.username} como destinatario.
          </p>
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
            <div className={`text-white rounded-xl p-6 ${isAssemblyOwned ? 'bg-gradient-to-r from-amber-600 to-yellow-700' : 'bg-gradient-to-r from-trueque-600 to-trueque-700'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm">
                    {`Saldo de ${org.display_name || org.username}`}
                  </p>
                  <p className="text-4xl font-bold mt-1">
                    {balance >= 0 ? '+' : ''}{fmtAmount(balance)} {currency}
                  </p>
                  <p className="text-amber-200 text-xs mt-2">
                    {`Cuenta: @{org.username}`}
                  </p>
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
      {tab === 'assembly' && !isAssemblyOwned && (
        <ScopedAssembly scope="organization" scopeId={id!} scopeName={org.display_name || org.username} isAssemblyOwned={org?.is_assembly_owned} />
      )}

      {/* Tab: Reuniones de Junta Directiva */}
      {tab === 'boardmeetings' && (
        <ScopedAssembly scope="organization" scopeId={id!} scopeName={org.display_name || org.username} meetingType="board" />
      )}

      {/* Tab: Puntos de Venta (Terminales POS) */}
      {tab === 'terminals' && <OrgTerminals orgID={id!} />}
    </div>
  )
}

// ===== Componente: Terminales POS de la organizacion =====

function OrgTerminals({ orgID }: { orgID: string }) {
  const [terminals, setTerminals] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [selectedTerminal, setSelectedTerminal] = useState<any | null>(null)
  const [shifts, setShifts] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subView, setSubView] = useState<'list' | 'shifts' | 'transactions'>('list')

  useEffect(() => {
    loadTerminals()
    loadMembers()
    loadDepartments()
  }, [orgID])

  const loadTerminals = async () => {
    setLoading(true)
    try {
      const res = await api.get<any[]>(`/nfc/org-terminals/${orgID}`)
      setTerminals(res || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const loadMembers = async () => {
    try {
      const res = await api.get<any[]>(`/organizations/${orgID}/members`)
      setMembers(res || [])
    } catch {}
  }

  const loadDepartments = async () => {
    try {
      const res = await api.get<any[]>(`/organizations/${orgID}/departments`)
      setDepartments(res || [])
    } catch {}
  }

  const handleAssignUser = async (terminalID: string) => {
    const options = members.map(m => `${m.display_name || m.username} (${m.id})`).join('\n')
    const userID = prompt(`Asignar a miembro de la organizacion:\n\n${options}\n\nIngresa el ID del usuario:`)
    if (!userID) return
    try {
      await api.post(`/nfc/org-terminals/${orgID}/${terminalID}/assign-user`, { user_id: userID })
      loadTerminals()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleAssignDept = async (terminalID: string) => {
    const options = departments.map(d => `${d.name} (${d.id})`).join('\n')
    const deptID = prompt(`Asignar a departamento:\n\n${options}\n\nIngresa el ID del departamento:`)
    if (!deptID) return
    try {
      await api.post(`/nfc/org-terminals/${orgID}/${terminalID}/assign-dept`, { department_id: deptID })
      loadTerminals()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleToggle = async (terminalID: string) => {
    try {
      await api.post(`/nfc/org-terminals/${orgID}/${terminalID}/toggle`, {})
      loadTerminals()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleViewShifts = async (terminal: any) => {
    setSelectedTerminal(terminal)
    setSubView('shifts')
    try {
      const res = await api.get<any[]>(`/nfc/org-terminals/${orgID}/${terminal.terminal_id}/shifts`)
      setShifts(res || [])
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleViewTransactions = async (terminal: any) => {
    setSelectedTerminal(terminal)
    setSubView('transactions')
    try {
      const res = await api.get<any[]>(`/nfc/org-terminals/${orgID}/${terminal.terminal_id}/transactions`)
      setTransactions(res || [])
    } catch (e: any) {
      setError(e.message)
    }
  }

  const formatTime = (ts: string | null) => {
    if (!ts) return 'Nunca'
    return new Date(ts).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  // Vista de turnos
  if (subView === 'shifts' && selectedTerminal) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Turnos: {selectedTerminal.label}</h2>
          <button onClick={() => { setSubView('list'); setSelectedTerminal(null) }} className="px-4 py-2 bg-gray-100 rounded-lg">← Volver</button>
        </div>
        {shifts.length === 0 ? (
          <div className="card text-center py-8 text-gray-500">
            <Clock className="mx-auto mb-2" size={32} /> No hay turnos registrados
          </div>
        ) : (
          <div className="card divide-y">
            {shifts.map((s: any) => (
              <div key={s.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{s.user_name}</div>
                  <div className="text-xs text-gray-500">
                    Abierto: {formatTime(s.opened_at)}
                    {s.closed_at && ` · Cerrado: ${formatTime(s.closed_at)}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600">{s.total_sales?.toLocaleString('es')} TQ</div>
                  <div className="text-xs text-gray-500">{s.transactions_count} tx · {s.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Vista de transacciones
  if (subView === 'transactions' && selectedTerminal) {
    const total = transactions.filter((t: any) => t.status === 'approved').reduce((s: number, t: any) => s + t.amount, 0)
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Transacciones: {selectedTerminal.label}</h2>
          <button onClick={() => { setSubView('list'); setSelectedTerminal(null) }} className="px-4 py-2 bg-gray-100 rounded-lg">← Volver</button>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="card"><div className="text-xs text-gray-500">TOTAL</div><div className="text-2xl font-bold text-green-600">{total.toLocaleString('es')} TQ</div></div>
          <div className="card"><div className="text-xs text-gray-500">TRANSACCIONES</div><div className="text-2xl font-bold">{transactions.length}</div></div>
        </div>
        <div className="card divide-y">
          {transactions.map((t: any) => (
            <div key={t.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{t.card_uid === 'qr_payment' ? '📱 QR' : `💳 ${t.card_uid?.slice(0, 12)}...`}</div>
                <div className="text-xs text-gray-500">{formatTime(t.created_at)}{t.error_message && ` · ${t.error_message}`}</div>
              </div>
              <div className={`font-bold ${t.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                {t.status === 'approved' ? '+' : ''}{t.amount.toLocaleString('es')} TQ
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Vista principal: lista de terminales
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Puntos de Venta de la Organizacion</h2>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Cargando...</div>
      ) : terminals.length === 0 ? (
        <div className="card text-center py-8">
          <ShoppingBag className="mx-auto mb-3 text-gray-300" size={48} />
          <p className="text-gray-500">Esta organizacion no tiene terminales asignados.</p>
          <p className="text-gray-400 text-sm mt-2">El administrador (Asamblea) debe asignar terminales a esta organizacion.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {terminals.map((t: any) => (
            <div key={t.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{t.label || 'Sin nombre'}</h3>
                  <p className="text-xs text-gray-500 font-mono">{t.terminal_id?.slice(0, 24)}...</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  t.is_blocked ? 'bg-red-100 text-red-700' :
                  t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {t.is_blocked ? '🔒 Bloqueado' : t.is_active ? '● Activo' : '○ Inactivo'}
                </span>
              </div>
              <div className="text-sm text-gray-500 mb-3">
                <p>📍 {t.location || 'Sin ubicacion'}</p>
                <p>👤 {t.merchant_name || 'Sin usuario asignado'}</p>
                {t.dept_name && <p>🏢 {t.dept_name}</p>}
                <p>🕐 {formatTime(t.last_seen)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleViewTransactions(t)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium flex items-center gap-1">
                  <Eye size={14} /> Transacciones
                </button>
                <button onClick={() => handleViewShifts(t)} className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium flex items-center gap-1">
                  <Clock size={14} /> Turnos
                </button>
                <button onClick={() => handleAssignUser(t.terminal_id)} className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium flex items-center gap-1">
                  <UserCheck size={14} /> Asignar usuario
                </button>
                <button onClick={() => handleAssignDept(t.terminal_id)} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium flex items-center gap-1">
                  <Building2 size={14} /> Asignar dept.
                </button>
                <button onClick={() => handleToggle(t.terminal_id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 ${
                  t.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                }`}>
                  <Power size={14} /> {t.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
