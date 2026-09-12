import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Users, Plus, HelpCircle, X, Crown, Trash2, Key, Vote as VoteIcon, ArrowRight, Landmark } from 'lucide-react'
import { EntitySelector } from '../components/EntitySelector'
import { useConfig } from '../hooks/useConfig'
import ScopedAssembly from '../components/ScopedAssembly'
import { toCents } from '../lib/format'

const ORG_TYPE_OPTIONS = [
  {
    value: 'Grupo de produccion',
    label: 'Grupo de produccion',
    description: 'Fabrica o produce bienes',
  },
  {
    value: 'Grupo de consumo',
    label: 'Grupo de consumo',
    description: 'Compra bienes para distribuir',
  },
  {
    value: 'Comision',
    label: 'Comision',
    description: 'Grupo temporal para una tarea especifica',
  },
  {
    value: 'Proyecto',
    label: 'Proyecto',
    description: 'Iniciativa con objetivo y plazo',
  },
  {
    value: 'Institucion publica',
    label: 'Institucion publica',
    description: 'Sin fines de lucro, exenta de impuestos',
  },
  {
    value: 'Cooperativa',
    label: 'Cooperativa',
    description: 'Propiedad compartida',
  },
]

const DEFAULT_ORG_TYPES = ORG_TYPE_OPTIONS.map((o) => o.value)

const HELP_SECTIONS = [
  {
    title: 'org_help_what_title',
    body: 'org_help_what_body',
  },
  {
    title: 'org_help_types_title',
    body: 'org_help_types_body',
  },
  {
    title: 'org_help_board_title',
    body: 'org_help_board_body',
  },
  {
    title: 'org_help_decisions_title',
    body: 'org_help_decisions_body',
  },
]

export default function Organizations() {
  const { t } = useTranslation(['organizations', 'common'])
  const navigate = useNavigate()
  const { currency } = useConfig()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as 'mine' | 'all') || 'mine'
  const [tab, setTab] = useState<'mine' | 'all'>(initialTab)
  const changeTab = (t: 'mine' | 'all') => {
    setTab(t)
    setSearchParams({ tab: t })
  }
  const [orgs, setOrgs] = useState<any[]>([])
  const [myOrgs, setMyOrgs] = useState<any[]>([])
  const [orgTypes, setOrgTypes] = useState<string[]>(DEFAULT_ORG_TYPES)
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [newType, setNewType] = useState('')
  const [boardOrgId, setBoardOrgId] = useState<string | null>(null)
  const [boardMembers, setBoardMembers] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [boardForm, setBoardForm] = useState({ user_id: '', position: 'presidente' })
  const [multisigOrgId, setMultisigOrgId] = useState<string | null>(null)
  const [assemblyOrgId] = useState<string | null>(null)
  const [multisigForm, setMultisigForm] = useState({ required_signatures: 1, authorized_signers: [] as string[] })
  const [form, setForm] = useState({
    username: '',
    display_name: '',
    organization_subtype: DEFAULT_ORG_TYPES[0],
    credit_limit: 0,
    debit_limit: 0,
    tax_rate: 0,
    public_key: '',
  })

  const loadOrgs = () => {
    api.get('/organizations').then((d: any) => setOrgs(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/my/organizations').then((d: any) => setMyOrgs(Array.isArray(d) ? d : [])).catch(() => {})
  }

  const loadTypes = async () => {
    try {
      const data: any = await api.get<any>('/organizations/types')
      const types = Array.isArray(data) ? data : (data as any)?.types
      if (Array.isArray(types) && types.length > 0) {
        setOrgTypes(types)
      } else {
        setOrgTypes(DEFAULT_ORG_TYPES)
      }
    } catch {
      setOrgTypes(DEFAULT_ORG_TYPES)
    }
  }

  useEffect(() => {
    loadOrgs()
    loadTypes()
  }, [])

  const create = async () => {
    await api.post('/organizations', form)
    setShowForm(false)
    setForm({
      username: '',
      display_name: '',
      organization_subtype: orgTypes[0] || DEFAULT_ORG_TYPES[0],
      credit_limit: 0,
      debit_limit: 0,
      tax_rate: 0,
      public_key: '',
    })
    loadOrgs()
  }

  const approve = async (id: string) => {
    await api.post(`/organizations/${id}/approve`, {})
    loadOrgs()
  }

  const addType = async () => {
    const trimmed = newType.trim()
    if (!trimmed || orgTypes.includes(trimmed)) {
      setNewType('')
      return
    }
    const updated = [...orgTypes, trimmed]
    setOrgTypes(updated)
    setNewType('')
    // Persist the new type (best-effort; ignore failures)
    try {
      await api.post('/organizations/types', { type: trimmed })
      loadTypes()
    } catch {
      // endpoint may not exist yet; keep the local type
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{t('title', 'Organizaciones')}</h1>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="btn-secondary flex items-center gap-1 text-sm"
            title={t('help_button', 'Ayuda')}
          >
            <HelpCircle size={16} /> ?
          </button>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> {t('new_button', 'Nueva')}
        </button>
      </div>

      {showHelp && (
        <div className="card space-y-3 relative">
          <button
            onClick={() => setShowHelp(false)}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            title={t('close', t('common:close'))}
          >
            <X size={18} />
          </button>
          <div className="flex items-start gap-2">
            <HelpCircle size={18} className="text-trueque-600 mt-0.5 shrink-0" />
            <div className="space-y-3">
              {HELP_SECTIONS.map((section, i) => (
                <div key={i}>
                  <h4 className="text-sm font-semibold text-gray-800">{t(section.title)}</h4>
                  <p className="text-sm text-gray-700 mt-0.5">{t(section.body)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card bg-trueque-50 border-trueque-200">
        <p className="text-sm text-trueque-800">
          {t('intro_text', 'Las organizaciones son grupos internos de la comunidad. No son tipos legales externos. Cada comunidad define sus propios tipos segun sus necesidades.')}
        </p>
      </div>

      {/* Pestañas Mis Organizaciones / Todas las Organizaciones */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => changeTab('mine')}
          className={`px-4 py-2 text-sm font-medium flex items-center gap-1 ${
            tab === 'mine' ? 'text-trueque-700 border-b-2 border-trueque-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users size={16} /> {t('tab_mine', 'Mis Organizaciones')}
          {myOrgs.length > 0 && <span className="text-xs bg-trueque-100 text-trueque-700 px-1.5 rounded">{myOrgs.length}</span>}
        </button>
        <button
          onClick={() => changeTab('all')}
          className={`px-4 py-2 text-sm font-medium flex items-center gap-1 ${
            tab === 'all' ? 'text-trueque-700 border-b-2 border-trueque-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users size={16} /> {t('tab_all', 'Todas las Organizaciones')}
          {orgs.length > 0 && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 rounded">{orgs.length}</span>}
        </button>
      </div>

      {tab === 'mine' && (
        <div className="card bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-800">
            {t('mine_intro', 'Estas son las organizaciones donde tienes un rol (junta directiva o membresia). Puedes trabajar en ellas: ver billetera, gestionar, transferir segun tus permisos.')}
          </p>
        </div>
      )}

      {tab === 'all' && (
        <div className="card bg-gray-50 border-gray-200">
          <p className="text-sm text-gray-700">
            {t('all_intro', 'Todas las organizaciones del nodo. Puedes verlas pero solo puedes actuar en las donde tienes un rol. Haz clic en una para ver su informacion publica.')}
          </p>
        </div>
      )}

      {showForm && (
        <div className="card space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <EntitySelector
              label={t('form_user_label', 'Usuario')}
              helpText={t('form_user_help', 'Selecciona el usuario existente que representara a esta organizacion. Busca por nombre de usuario o nombre para mostrar.')}
              placeholder={t('form_user_placeholder', 'Ej: juan_perez, maria_gomez...')}
              value={form.username}
              onChange={(value) => setForm({ ...form, username: value })}
              endpoint="/accounts"
              valueKey="id"
              labelKey="username"
              subLabelKey="display_name"
              emptyMessage={t('form_user_empty', 'No se encontraron usuarios')}
            />
            <div>
              <label className="label">{t('form_name_label', 'Nombre')}</label>
              <input
                className="input"
                placeholder={t('form_name_placeholder', 'Ej: Cooperativa Norte, Panaderia Unida')}
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-1">
                {t('form_name_hint', 'Nombre de la organizacion. Ej: Cooperativa Norte, Panaderia Unida')}
              </p>
            </div>
            <div>
              <label className="label">{t('form_type_label', 'Tipo de organizacion')}</label>
              <select
                className="input"
                value={form.organization_subtype}
                onChange={(e) => setForm({ ...form, organization_subtype: e.target.value })}
              >
                {ORG_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} - {opt.description}
                  </option>
                ))}
                {orgTypes
                  .filter((t) => !DEFAULT_ORG_TYPES.includes(t))
                  .map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {t('form_type_hint', 'Selecciona el tipo de organizacion segun su funcion dentro de la comunidad.')}
              </p>
            </div>
            <div>
              <label className="label">{t('form_tax_label', 'Tasa impositiva %')}</label>
              <input
                type="number"
                className="input"
                placeholder={t('form_tax_placeholder', 'Ej: 0, 5, 10')}
                value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-gray-400 mt-1">
                {t('form_tax_hint', 'Porcentaje de impuesto que aplica a las transacciones de esta organizacion.')}
              </p>
            </div>
            <div>
              <label className="label">{t('form_credit_limit_label', 'Limite credito')} ({currency})</label>
              <input
                type="number"
                className="input"
                placeholder={t('form_credit_limit_placeholder', 'Ej: -20000')}
                value={form.credit_limit}
                onChange={(e) => setForm({ ...form, credit_limit: toCents(e.target.value) })}
              />
              <p className="text-xs text-gray-400 mt-1">
                {t('form_credit_limit_hint', 'Monto maximo que la organizacion puede tener como credito (saldo negativo permitido).')}
              </p>
            </div>
            <div>
              <label className="label">{t('form_debit_limit_label', 'Limite debito')} ({currency})</label>
              <input
                type="number"
                className="input"
                placeholder={t('form_debit_limit_placeholder', 'Ej: 20000')}
                value={form.debit_limit}
                onChange={(e) => setForm({ ...form, debit_limit: toCents(e.target.value) })}
              />
              <p className="text-xs text-gray-400 mt-1">
                {t('form_debit_limit_hint', 'Monto maximo que la organizacion puede tener como debito (saldo positivo permitido).')}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-3 space-y-2">
            <label className="label">{t('form_new_type_label', 'Crear nuevo tipo de organizacion')}</label>
            <p className="text-xs text-gray-400 -mt-1">
              {t('form_new_type_hint', 'Agrega un tipo personalizado si los predefinidos no cubren las necesidades de tu comunidad.')}
            </p>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder={t('form_new_type_placeholder', 'Ej: Mutual, Sindicato, Asociacion...')}
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addType()
                  }
                }}
              />
              <button onClick={addType} className="btn-secondary flex items-center gap-1 whitespace-nowrap">
                <Plus size={16} /> {t('form_add_type', 'Agregar tipo')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {orgTypes.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 border border-gray-200"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <button onClick={create} className="btn-primary">
            {t('form_create_button', 'Crear Organizacion')}
          </button>
        </div>
      )}

      {tab === 'mine' ? (
        <div className="space-y-4">
          {myOrgs.length === 0 && (
            <div className="card text-center py-8 text-gray-500">
              <Users size={32} className="mx-auto mb-2 text-gray-300" />
              <p>{t('no_membership', 'No eres miembro de ninguna organizacion aun.')}</p>
              <p className="text-xs mt-1">{t('no_membership_hint', 'Cuando te asignen a la junta directiva de una organizacion, aparecera aqui.')}</p>
            </div>
          )}
          {/* Organizaciones creadas por la Asamblea van primero, con estilo destacado */}
          {(() => {
            const assemblyOwned = myOrgs.filter((o: any) => o.is_assembly_owned && o.username !== 'asamblea')
            if (assemblyOwned.length === 0) return null
            return (
              <div className="space-y-3">
                {assemblyOwned.map((org, i) => (
                  <div key={i} className="card bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300 border-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-100 rounded-full p-3">
                        <Landmark size={24} className="text-amber-700" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg">{org.display_name}</h3>
                        <p className="text-sm text-gray-600">@{org.username}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded font-semibold">
                            {t('created_by_assembly', 'Creada por la Asamblea')}
                          </span>
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                            {t('your_role', 'Tu rol:')} {org.role}
                          </span>
                          {org.is_board_member && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{t('board_directive', 'Junta Directiva')}</span>
                          )}
                          {org.can_transfer && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t('can_transfer', 'Puede transferir')}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <button
                          onClick={() => navigate('/app/assembly')}
                          className="text-sm bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 flex items-center gap-1 font-medium"
                        >
                          <VoteIcon size={14} /> {t('assembly_button', 'Asamblea')}
                        </button>
                        <button
                          onClick={() => navigate(`/app/organizations/${org.id}`)}
                          className="text-sm text-amber-700 hover:underline flex items-center gap-1 font-medium"
                        >
                          {t('open', 'Abrir')} <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
          {/* Resto de organizaciones (no creadas por la Asamblea) */}
          {myOrgs.filter((o: any) => !o.is_assembly_owned).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myOrgs.filter((o: any) => !o.is_assembly_owned).map((org, i) => (
                <div key={i} className="card">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={20} className="text-trueque-600" />
                    <h3 className="font-semibold">{org.display_name}</h3>
                  </div>
                  <p className="text-sm text-gray-600">@{org.username}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                      {t('your_role', 'Tu rol:')} {org.role}
                    </span>
                    {org.is_board_member && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{t('board_directive', 'Junta Directiva')}</span>
                    )}
                    {org.can_transfer && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t('can_transfer', 'Puede transferir')}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-end mt-3">
                    <button
                      onClick={() => navigate(`/app/organizations/${org.id}`)}
                      className="text-sm text-trueque-600 hover:underline flex items-center gap-1 font-medium"
                    >
                      {t('open', 'Abrir')} <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {orgs.length === 0 && (
            <div className="card text-center py-8 text-gray-500">
              <Users size={32} className="mx-auto mb-2 text-gray-300" />
              <p>{t('no_organizations', 'No hay organizaciones en este nodo.')}</p>
            </div>
          )}
          {/* Organizaciones creadas por la Asamblea van primero, con estilo destacado */}
          {(() => {
            const assemblyOwned = orgs.filter((o: any) => o.is_assembly_owned && o.username !== 'asamblea')
            if (assemblyOwned.length === 0) return null
            return (
              <div className="space-y-3">
                {assemblyOwned.map((org, i) => {
                  const myOrg = myOrgs.find((m: any) => m.id === org.id)
                  return (
                    <div key={i} className="card bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300 border-2">
                      <div className="flex items-center gap-3">
                        <div className="bg-amber-100 rounded-full p-3">
                          <Landmark size={24} className="text-amber-700" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg">{org.display_name}</h3>
                          <p className="text-sm text-gray-600">@{org.username}</p>
                          <p className="text-xs text-amber-700 mt-1 font-semibold">{t('created_by_assembly', 'Creada por la Asamblea')}</p>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <button
                            onClick={() => navigate('/app/assembly')}
                            className="text-sm bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 flex items-center gap-1 font-medium"
                          >
                            <VoteIcon size={14} /> {t('assembly_button', 'Asamblea')}
                          </button>
                          <button
                            onClick={() => navigate(`/app/organizations/${org.id}`)}
                            className="text-sm text-amber-700 hover:underline flex items-center gap-1 font-medium"
                          >
                            {myOrg ? t('open', 'Abrir') : t('view', 'Ver')} <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
          {/* Resto de organizaciones (no creadas por la Asamblea) */}
          {orgs.filter((o: any) => !o.is_assembly_owned).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orgs.filter((o: any) => !o.is_assembly_owned).map((org, i) => {
                const myOrg = myOrgs.find((m: any) => m.id === org.id)
                return (
                  <div key={i} className="card">
                    <div className="flex items-center gap-2 mb-2">
                      <Users size={20} className="text-trueque-600" />
                      <h3 className="font-semibold">{org.display_name}</h3>
                      {myOrg && (
                        <span className="text-xs bg-trueque-100 text-trueque-700 px-2 py-0.5 rounded">{t('your_org', 'Tu org')}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">@{org.username}</p>
                    <p className="text-xs text-gray-400 mt-1">{t('type_label', 'Tipo:')} {org.organization_subtype}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          org.membership_status === 'active'
                            ? 'bg-trueque-100 text-trueque-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {org.membership_status}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/app/organizations/${org.id}`)}
                          className="text-sm text-trueque-600 hover:underline flex items-center gap-1 font-medium"
                        >
                          {myOrg ? t('open', 'Abrir') : t('view', 'Ver')} <ArrowRight size={14} />
                        </button>
                        {myOrg && (
                          <button
                            onClick={() => {
                              if (boardOrgId === org.id) {
                                setBoardOrgId(null)
                              } else {
                                setBoardOrgId(org.id)
                                api.get(`/organizations/${org.id}/board`).then((d: any) => setBoardMembers(Array.isArray(d) ? d : [])).catch(() => setBoardMembers([]))
                                api.get('/accounts/list').then((d: any) => setAllUsers(Array.isArray(d) ? d.filter((u: any) => u.account_type === 'individual') : [])).catch(() => setAllUsers([]))
                              }
                            }}
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Crown size={14} />
                            {t('board_button', 'Junta')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
