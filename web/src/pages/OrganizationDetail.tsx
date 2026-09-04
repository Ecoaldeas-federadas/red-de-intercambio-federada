import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { usePermissions } from '../hooks/usePermissions'
import { ArrowLeft, Users, Wallet as WalletIcon, Vote as VoteIcon, Settings, Crown, Plus, Trash2, ArrowUpCircle, ArrowDownCircle, FileText, Building2, Plug, Landmark, ExternalLink, ShoppingBag, UserCheck, Power, Eye, Clock } from 'lucide-react'
import ScopedAssembly from '../components/ScopedAssembly'
import { fmtTQ, toCents, fmtDateTime } from '../lib/format'

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation(['organizations', 'common'])
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
      setError(t('detail_error_select_user'))
      return
    }
    try {
      await api.post(`/organizations/${id}/board`, boardForm)
      setSuccess(t('detail_success_board_assigned'))
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
      setSuccess(t('detail_success_multisig_saved'))
      setTimeout(() => setSuccess(''), 3000)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const createDept = async () => {
    setError('')
    if (!deptForm.name.trim()) {
      setError(t('detail_error_dept_name'))
      return
    }
    try {
      await api.post('/departments', {
        name: deptForm.name,
        description: deptForm.description,
        group_type: 'department',
        parent_organization_id: id,
      })
      setSuccess(t('detail_success_dept_created'))
      setDeptForm({ name: '', description: '' })
      setShowDeptForm(false)
      load()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const fmtAmount = (n: number) => fmtTQ(n)

  if (!org) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/app/organizations')} className="text-trueque-600 flex items-center gap-1">
          <ArrowLeft size={16} /> {t('detail_back')}
        </button>
        <p className="text-gray-500">{t('detail_loading')}</p>
      </div>
    )
  }

  const POSITIONS = [
    { value: 'presidente', label: t('detail_position_presidente') },
    { value: 'vicepresidente', label: t('detail_position_vicepresidente') },
    { value: 'secretario', label: t('detail_position_secretario') },
    { value: 'tesorero', label: t('detail_position_tesorero') },
    { value: 'vocal', label: t('detail_position_vocal') },
  ]

  const tabs = [
    { key: 'info', label: t('detail_tab_info'), icon: <Settings size={16} /> },
    { key: 'board', label: t('detail_tab_board'), icon: <Crown size={16} /> },
    { key: 'members', label: t('detail_tab_members'), icon: <Users size={16} /> },
    { key: 'departments', label: t('detail_tab_departments'), icon: <Building2 size={16} /> },
    { key: 'services', label: t('detail_tab_services'), icon: <Plug size={16} /> },
    { key: 'terminals', label: t('detail_tab_terminals'), icon: <ShoppingBag size={16} /> },
    { key: 'wallet', label: t('detail_tab_wallet'), icon: <WalletIcon size={16} /> },
    ...(isAssemblyOwned ? [] : [{ key: 'assembly', label: t('detail_tab_assembly'), icon: <VoteIcon size={16} /> }]),
    { key: 'boardmeetings', label: t('detail_tab_boardmeetings'), icon: <VoteIcon size={16} /> },
  ]

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/app/organizations')} className="text-trueque-600 flex items-center gap-1 text-sm">
        <ArrowLeft size={16} /> {t('detail_back_to_orgs')}
      </button>

      <div className={`card ${isAssemblyOwned ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300' : ''}`}>
        <div className="flex items-center gap-3">
          <div className={`rounded-full p-3 ${isAssemblyOwned ? 'bg-amber-100' : 'bg-trueque-100'}`}>
            {isAssemblyOwned ? <Landmark size={24} className="text-amber-700" /> : <Users size={24} className="text-trueque-700" />}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{org.display_name || org.username}</h1>
            <p className="text-sm text-gray-500">
              @{org.username} | {org.organization_subtype || t('title')}
              {isAssemblyOwned && <span className="ml-2 text-amber-700 font-semibold">{t('created_by_assembly')}</span>}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${org.is_approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {org.is_approved ? t('detail_approved') : t('detail_pending')}
          </span>
        </div>
        {isAssemblyOwned && (
          <div className="mt-3 pt-3 border-t border-amber-200">
            <button
              onClick={() => navigate('/app/assembly')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition"
            >
              <VoteIcon size={16} />
              {t('detail_go_to_assembly')}
              <ExternalLink size={14} />
            </button>
            <p className="text-xs text-amber-700 mt-2">
              {t('detail_assembly_owned_desc')}
            </p>
          </div>
        )}
        {myRole && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-gray-500">{t('detail_your_role_here')}</span>
            <span className="font-medium text-purple-700">{myRole.role}</span>
            {myRole.is_board_member && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{t('board_directive')}</span>}
            {myRole.can_transfer && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t('can_transfer')}</span>}
            {myRole.can_config && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t('detail_can_config')}</span>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {tabs.map(tb => (
          <button
            key={tb.key}
            onClick={() => changeTab(tb.key as any)}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-1 whitespace-nowrap ${
              tab === tb.key ? 'text-trueque-700 border-b-2 border-trueque-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
      {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg">{success}</div>}

      {/* Tab: Informacion */}
      {tab === 'info' && (
        <div className="card space-y-3">
          <h2 className="font-semibold">{t('detail_info_title')}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">{t('detail_name_label')}</p>
              <p className="font-medium">{org.display_name || org.username}</p>
            </div>
            <div>
              <p className="text-gray-500">{t('detail_username_label')}</p>
              <p className="font-medium">@{org.username}</p>
            </div>
            <div>
              <p className="text-gray-500">{t('detail_type_label')}</p>
              <p className="font-medium">{org.organization_subtype || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500">{t('detail_balance_label')}</p>
              <p className="font-medium">{fmtAmount(balance)} {currency}</p>
            </div>
            <div>
              <p className="text-gray-500">{t('detail_credit_limit_label')}</p>
              <p className="font-medium">{fmtTQ(org.credit_limit || 0)} {currency}</p>
            </div>
            <div>
              <p className="text-gray-500">{t('detail_debit_limit_label')}</p>
              <p className="font-medium">{fmtTQ(org.debit_limit || 0)} {currency}</p>
            </div>
          </div>
          {isAssemblyOwned && (
            <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
              {t('detail_assembly_owned_info')} <button onClick={() => navigate('/app/assembly')} className="underline font-semibold">{t('detail_assembly_page_link')}</button>.
            </p>
          )}
          <p className="text-xs text-gray-400">
            {t('detail_transfer_hint', { username: org.username })}
          </p>
        </div>
      )}

      {/* Tab: Junta Directiva */}
      {tab === 'board' && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Crown size={18} /> {t('detail_board_title')}</h2>
            <p className="text-xs text-gray-500">{t('detail_board_desc')}</p>

            {boardMembers.length === 0 ? (
              <p className="text-gray-500 text-sm">{t('detail_board_empty')}</p>
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
                <h3 className="text-sm font-medium">{t('detail_board_assign_new')}</h3>
                <div className="grid grid-cols-2 gap-2">
                  <select className="input" value={boardForm.user_id} onChange={(e) => setBoardForm({ ...boardForm, user_id: e.target.value })}>
                    <option value="">{t('detail_board_select')}</option>
                    {allUsers.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.display_name || u.username} ({u.username})</option>
                    ))}
                  </select>
                  <select className="input" value={boardForm.position} onChange={(e) => setBoardForm({ ...boardForm, position: e.target.value })}>
                    {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <button onClick={assignBoard} className="btn-primary text-sm">{t('detail_board_assign_button')}</button>
              </div>
            )}
          </div>

          {/* Multi-firma */}
          <div className="card space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Settings size={18} /> {t('detail_multisig_title')}</h2>
            <p className="text-xs text-gray-500">{t('detail_multisig_desc')}</p>

            <div>
              <label className="label">{t('detail_multisig_required')}</label>
              <input
                type="number"
                min={1}
                className="input"
                value={multisigForm.required_signatures}
                onChange={(e) => setMultisigForm({ ...multisigForm, required_signatures: parseInt(e.target.value) || 1 })}
              />
            </div>

            <div>
              <label className="label">{t('detail_multisig_authorized')}</label>
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
              <button onClick={saveMultisig} className="btn-primary text-sm">{t('detail_multisig_save')}</button>
            )}
          </div>
        </div>
      )}

      {/* Tab: Miembros */}
      {tab === 'members' && (
        <div className="card space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Users size={18} /> {t('detail_members_title')}</h2>
          <p className="text-xs text-gray-500">{t('detail_members_desc')}</p>
          {orgMembers.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('detail_members_empty')}</p>
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
                <h2 className="font-semibold flex items-center gap-2"><Building2 size={18} /> {t('detail_depts_of')} {org.display_name || org.username}</h2>
                <p className="text-xs text-gray-500 mt-1">{t('detail_depts_desc')}</p>
              </div>
              {canManage && (
                <button onClick={() => setShowDeptForm(!showDeptForm)} className="btn-primary text-sm flex items-center gap-1">
                  <Plus size={16} /> {t('detail_depts_new')}
                </button>
              )}
            </div>

            {showDeptForm && (
              <div className="border-t pt-3 space-y-2">
                <div>
                  <label className="label">{t('detail_depts_name_label')}</label>
                  <input
                    className="input"
                    placeholder={t('detail_depts_name_placeholder')}
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">{t('detail_depts_desc_label')}</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder={t('detail_depts_desc_placeholder')}
                    value={deptForm.description}
                    onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  />
                </div>
                <button onClick={createDept} className="btn-primary text-sm">{t('detail_depts_create_button')}</button>
              </div>
            )}

            {deptList.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Building2 size={32} className="mx-auto mb-2 text-gray-300" />
                <p>{t('detail_depts_empty')}</p>
                {canManage && <p className="text-xs mt-1">{t('detail_depts_empty_hint')}</p>}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {deptList.map((dp, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3 hover:border-trueque-300 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 size={16} className="text-trueque-600" />
                      <h3 className="font-medium text-sm">{dp.name}</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{dp.description || t('detail_depts_no_description')}</p>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-0.5 rounded ${dp.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {dp.is_active ? t('detail_depts_active') : t('detail_depts_inactive')}
                      </span>
                      <button
                        onClick={() => navigate(`/app/departments/${dp.id}`)}
                        className="text-xs text-trueque-600 hover:underline flex items-center gap-1 font-medium"
                      >
                        {t('detail_depts_open')} <ArrowUpCircle size={12} />
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
                <h2 className="font-semibold text-lg flex items-center gap-2"><Plug size={18} />{t('detail_services_title')}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {t('detail_services_desc')}
                </p>
              </div>
              {canConfig && (
                <button
                  onClick={() => setShowServiceForm(!showServiceForm)}
                  className="px-3 py-1.5 bg-trueque-600 text-white rounded-lg text-sm font-medium hover:bg-trueque-700"
                >
                  <Plus size={14} className="inline mr-1" />{t('detail_services_new')}
                </button>
              )}
            </div>

            {showServiceForm && canConfig && (
              <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                <h3 className="font-medium mb-3">{t('detail_services_create_title')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">{t('detail_services_name_label')}</label>
                    <input
                      className="input mt-1"
                      value={serviceForm.name}
                      onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                      placeholder={t('detail_services_name_placeholder')}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">{t('detail_services_type_label')}</label>
                    <select
                      className="input mt-1"
                      value={serviceForm.service_type}
                      onChange={(e) => setServiceForm({ ...serviceForm, service_type: e.target.value })}
                    >
                      <option value="subscription">{t('detail_services_type_subscription')}</option>
                      <option value="benefit">{t('detail_services_type_benefit')}</option>
                      <option value="one_time">{t('detail_services_type_one_time')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">{t('detail_services_amount_label')}</label>
                    <input
                      type="number"
                      className="input mt-1"
                      value={serviceForm.amount}
                      onChange={(e) => setServiceForm({ ...serviceForm, amount: toCents(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">{t('detail_services_frequency_label')}</label>
                    <select
                      className="input mt-1"
                      value={serviceForm.frequency}
                      onChange={(e) => setServiceForm({ ...serviceForm, frequency: e.target.value })}
                    >
                      <option value="monthly">{t('detail_services_frequency_monthly')}</option>
                      <option value="quarterly">{t('detail_services_frequency_quarterly')}</option>
                      <option value="annual">{t('detail_services_frequency_annual')}</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500">{t('detail_services_desc_label')}</label>
                    <input
                      className="input mt-1"
                      value={serviceForm.description}
                      onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                      placeholder={t('detail_services_desc_placeholder')}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">{t('detail_services_obligations_label')}</label>
                    <textarea
                      className="input mt-1"
                      rows={2}
                      value={serviceForm.obligations}
                      onChange={(e) => setServiceForm({ ...serviceForm, obligations: e.target.value })}
                      placeholder={t('detail_services_obligations_placeholder')}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">{t('detail_services_rights_label')}</label>
                    <textarea
                      className="input mt-1"
                      rows={2}
                      value={serviceForm.rights}
                      onChange={(e) => setServiceForm({ ...serviceForm, rights: e.target.value })}
                      placeholder={t('detail_services_rights_placeholder')}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500">{t('detail_services_duties_label')}</label>
                    <textarea
                      className="input mt-1"
                      rows={2}
                      value={serviceForm.duties}
                      onChange={(e) => setServiceForm({ ...serviceForm, duties: e.target.value })}
                      placeholder={t('detail_services_duties_placeholder')}
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
                        <strong>{t('detail_services_mandatory_label')}</strong> — {t('detail_services_mandatory_desc')}
                        {org?.is_assembly_owned ? t('detail_services_mandatory_assembly') : t('detail_services_mandatory_org')}
                      </span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => {
                      if (!serviceForm.name) { alert(t('detail_error_service_name')); return }
                      api.post(`/organizations/${id}/services`, serviceForm).then(() => {
                        setSuccess(t('detail_success_service_created'))
                        setShowServiceForm(false)
                        setServiceForm({ name: '', description: '', service_type: 'subscription', amount: 0, frequency: 'monthly', is_mandatory: false, obligations: '', rights: '', duties: '' })
                        load()
                        setTimeout(() => setSuccess(''), 3000)
                      }).catch((err: any) => {
                        alert(err instanceof Error ? err.message : t('detail_error_service_create'))
                      })
                    }}
                    className="px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm font-medium hover:bg-trueque-700"
                  >
                    {t('detail_services_create_button')}
                  </button>
                  <button
                    onClick={() => setShowServiceForm(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    {t('detail_services_cancel')}
                  </button>
                </div>
              </div>
            )}

            {services.length === 0 ? (
              <p className="text-gray-400 py-8 text-center">{t('detail_services_empty')}</p>
            ) : (
              <div className="space-y-3">
                {services.map((svc: any) => (
                  <div key={svc.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium">{svc.name}</h3>
                          {svc.is_mandatory && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{t('detail_services_mandatory_badge')}</span>
                          )}
                          {svc.service_type === 'benefit' && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{t('detail_services_pays_member_badge')}</span>
                          )}
                          {svc.service_type === 'one_time' && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t('detail_services_one_time_badge')}</span>
                          )}
                          {svc.amount === 0 && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t('detail_services_free_badge')}</span>
                          )}
                          {!svc.is_active && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{t('detail_services_inactive_badge')}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{svc.description}</p>
                        <p className="text-sm font-medium mt-2">
                          {svc.service_type === 'benefit' ? '+' : svc.amount === 0 ? '' : '-'}
                          {svc.amount > 0 ? `${fmtAmount(svc.amount)} ${currency}` : t('detail_services_free')}
                          {svc.amount > 0 && svc.frequency === 'monthly' ? t('detail_services_per_month') : svc.frequency === 'quarterly' ? t('detail_services_per_quarter') : svc.frequency === 'annual' ? t('detail_services_per_year') : ''}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {svc.subscribers_count || 0} {t('detail_services_subscribers')}
                        </p>
                      </div>
                      {canConfig && svc.is_active && (
                        <button
                          onClick={() => {
                            if (!confirm(t('detail_services_deactivate_confirm'))) return
                            api.delete(`/organizations/services/${svc.id}`).then(() => {
                              load()
                            }).catch(() => {})
                          }}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          {t('detail_services_deactivate')}
                        </button>
                      )}
                    </div>
                    {(svc.obligations || svc.rights || svc.duties) && (
                      <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        {svc.obligations && (
                          <div><strong className="text-gray-700">{t('detail_services_obligations')}</strong> <span className="text-gray-500">{svc.obligations}</span></div>
                        )}
                        {svc.rights && (
                          <div><strong className="text-gray-700">{t('detail_services_rights')}</strong> <span className="text-gray-500">{svc.rights}</span></div>
                        )}
                        {svc.duties && (
                          <div><strong className="text-gray-700">{t('detail_services_duties')}</strong> <span className="text-gray-500">{svc.duties}</span></div>
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
                    {`${t('detail_wallet_balance_of')} ${org.display_name || org.username}`}
                  </p>
                  <p className="text-4xl font-bold mt-1">
                    {balance >= 0 ? '+' : ''}{fmtAmount(balance)} {currency}
                  </p>
                  <p className="text-amber-200 text-xs mt-2">
                    {`Cuenta: @${org.username}`}
                  </p>
                </div>
                <WalletIcon size={48} className="text-amber-200" />
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-lg mb-3">{t('detail_wallet_movements')}</h2>
            {txs.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">{t('detail_wallet_no_transactions')}</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {txs.map((tx, i) => {
                  const isDebit = tx.direction === 'debit'
                  const fromName = tx.sender_display || tx.from_user || tx.sender_name || '???'
                  const toName = tx.receiver_display || tx.to_user || tx.receiver_name || '???'
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
                            {isDebit ? t('detail_wallet_sent_to') + ' ' : t('detail_wallet_received_from') + ' '}
                            <span className="font-semibold">{isDebit ? toName : fromName}</span>
                          </p>
                          <p className="text-xs text-gray-500">
                            {String(tx.created_at || '').slice(0, 16).replace('T', ' ')}
                            {tx.description ? ` - ${tx.description}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className={`font-bold text-sm ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                        {isDebit ? '-' : '+'}{fmtAmount(tx.amount || 0)} {currency}
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
  const { t } = useTranslation(['organizations', 'common'])
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
    const userID = prompt(t('detail_terminals_assign_user_prompt', { options }))
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
    const deptID = prompt(t('detail_terminals_assign_dept_prompt', { options }))
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
    if (!ts) return t('detail_terminals_never')
    return fmtDateTime(ts)
  }

  // Vista de turnos
  if (subView === 'shifts' && selectedTerminal) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{t('detail_terminals_shifts_title')} {selectedTerminal.label}</h2>
          <button onClick={() => { setSubView('list'); setSelectedTerminal(null) }} className="px-4 py-2 bg-gray-100 rounded-lg">← {t('detail_terminals_back')}</button>
        </div>
        {shifts.length === 0 ? (
          <div className="card text-center py-8 text-gray-500">
            <Clock className="mx-auto mb-2" size={32} /> {t('detail_terminals_shifts_empty')}
          </div>
        ) : (
          <div className="card divide-y">
            {shifts.map((s: any) => (
              <div key={s.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{s.user_name}</div>
                  <div className="text-xs text-gray-500">
                    Abierto: {formatTime(s.opened_at)}
                    {s.closed_at && ` · ${t('detail_terminals_shifts_closed')} ${formatTime(s.closed_at)}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600">{fmtTQ(s.total_sales || 0)} TQ</div>
                  <div className="text-xs text-gray-500">{s.transactions_count} {t('detail_terminals_shifts_tx_count')} · {s.status}</div>
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
    const total = transactions.filter((tx: any) => tx.status === 'approved').reduce((s: number, tx: any) => s + tx.amount, 0)
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{t('detail_terminals_transactions_title')} {selectedTerminal.label}</h2>
          <button onClick={() => { setSubView('list'); setSelectedTerminal(null) }} className="px-4 py-2 bg-gray-100 rounded-lg">← {t('detail_terminals_back')}</button>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="card"><div className="text-xs text-gray-500">{t('detail_terminals_total')}</div><div className="text-2xl font-bold text-green-600">{fmtTQ(total)} TQ</div></div>
          <div className="card"><div className="text-xs text-gray-500">{t('detail_terminals_transactions_count')}</div><div className="text-2xl font-bold">{transactions.length}</div></div>
        </div>
        <div className="card divide-y">
          {transactions.map((tx: any) => (
            <div key={tx.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{tx.card_uid === 'qr_payment' ? '📱 QR' : `💳 ${tx.card_uid?.slice(0, 12)}...`}</div>
                <div className="text-xs text-gray-500">{formatTime(tx.created_at)}{tx.error_message && ` · ${tx.error_message}`}</div>
              </div>
              <div className={`font-bold ${tx.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                {tx.status === 'approved' ? '+' : ''}{fmtTQ(tx.amount || 0)} TQ
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
      <h2 className="text-xl font-bold mb-4">{t('detail_terminals_title')}</h2>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
      {loading ? (
        <div className="text-center py-8 text-gray-500">{t('detail_terminals_loading')}</div>
      ) : terminals.length === 0 ? (
        <div className="card text-center py-8">
          <ShoppingBag className="mx-auto mb-3 text-gray-300" size={48} />
          <p className="text-gray-500">{t('detail_terminals_empty')}</p>
          <p className="text-gray-400 text-sm mt-2">{t('detail_terminals_empty_hint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {terminals.map((term: any) => (
            <div key={term.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{term.label || t('detail_terminals_no_name')}</h3>
                  <p className="text-xs text-gray-500 font-mono">{term.terminal_id?.slice(0, 24)}...</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  term.is_blocked ? 'bg-red-100 text-red-700' :
                  term.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {term.is_blocked ? `🔒 ${t('detail_terminals_blocked')}` : term.is_active ? `● ${t('detail_terminals_active')}` : `○ ${t('detail_terminals_inactive')}`}
                </span>
              </div>
              <div className="text-sm text-gray-500 mb-3">
                <p>📍 {term.location || t('detail_terminals_no_location')}</p>
                <p>👤 {term.merchant_name || t('detail_terminals_no_user')}</p>
                {term.dept_name && <p>🏢 {term.dept_name}</p>}
                <p>🕐 {formatTime(term.last_seen)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleViewTransactions(term)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium flex items-center gap-1">
                  <Eye size={14} /> {t('detail_terminals_transactions')}
                </button>
                <button onClick={() => handleViewShifts(term)} className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium flex items-center gap-1">
                  <Clock size={14} /> {t('detail_terminals_shifts')}
                </button>
                <button onClick={() => handleAssignUser(term.terminal_id)} className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium flex items-center gap-1">
                  <UserCheck size={14} /> {t('detail_terminals_assign_user')}
                </button>
                <button onClick={() => handleAssignDept(term.terminal_id)} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium flex items-center gap-1">
                  <Building2 size={14} /> {t('detail_terminals_assign_dept')}
                </button>
                <button onClick={() => handleToggle(term.terminal_id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 ${
                  term.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                }`}>
                  <Power size={14} /> {term.is_active ? t('detail_terminals_deactivate') : t('detail_terminals_activate')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
