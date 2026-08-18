import { useState, useEffect } from 'react'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { HelpCircle, Settings, DollarSign, Layers, Zap, Save, Plus, Edit, Building2, Users as UsersIcon, Vote as VoteIcon, Database, Download, Upload, AlertTriangle } from 'lucide-react'

// Opciones del 1 al 10 para el numero de nivel (seleccionable, no texto libre)
const LEVEL_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)
const LEVEL_LABELS: Record<number, string> = {
  1: '1 - Basico (recien admitido, sin derechos)',
  2: '2 - Iniciado (voz, sin voto)',
  3: '3 - Intermedio (voz, sin voto)',
  4: '4 - Avanzado (voz, sin voto)',
  5: '5 - Activo (voz y voto, forma parte de asamblea)',
  6: '6 - Destacado (voz y voto)',
  7: '7 - Referente (voz y voto)',
  8: '8 - Coordinador (voz y voto)',
  9: '9 - Directivo (voz y voto)',
  10: '10 - Administrador (todos los derechos)',
}

export default function NodeSettings() {
  const { hasPermission } = usePermissions()
  const canManage = hasPermission('config.manage')

  const [tab, setTab] = useState<'general' | 'levels' | 'org_levels' | 'tariff' | 'backup'>('general')
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Backup
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoreResult, setRestoreResult] = useState<any>(null)

  // Config general
  const [config, setConfig] = useState({ node_name: '', currency_name: 'TQ', currency_full_name: 'Trueque', app_name: 'Red de Intercambio' })

  // Niveles de miembro (usuarios individuales)
  const [levels, setLevels] = useState<any[]>([])
  const [showLevelForm, setShowLevelForm] = useState(false)
  const [editingLevel, setEditingLevel] = useState<any>(null)
  const [levelForm, setLevelForm] = useState({
    name: '', description: '', level: 1, has_voice: true, has_vote: true, counts_in_quorum: true,
    credit_limit: -20000, debit_limit: 20000, can_create_organization: false,
    can_cross_node_trade: true, can_receive_nfc_card: true, can_view_audit: true,
    can_use_external_bridge: false, max_organizations: 0, can_request_limit_increase: false,
    tax_rate: 0,
  })

  // Niveles de organizacion (empresas/cooperativas/instituciones)
  const [orgLevels, setOrgLevels] = useState<any[]>([])
  const [showOrgLevelForm, setShowOrgLevelForm] = useState(false)
  const [editingOrgLevel, setEditingOrgLevel] = useState<any>(null)
  const [orgLevelForm, setOrgLevelForm] = useState({
    name: '', description: '', level: 1, credit_limit: -100000, debit_limit: 100000,
    tax_rate: 0, can_cross_node_trade: true, can_use_external_bridge: false,
    can_view_audit: true, max_members: 0,
  })

  // Tarifa
  const [tariff, setTariff] = useState({
    vital_food: 800, vital_water: 150, vital_domestic: 350, vital_services: 200,
    effort_admin: 1.0, effort_technical: 1.15, effort_agricultural: 1.3,
    work_hours_per_day: 6, work_days_per_month: 24,
  })

  const load = () => {
    api.get('/config').then(setConfig).catch(() => {})
    api.get('/member-levels').then((d: any) => setLevels(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/organization-levels').then((d: any) => setOrgLevels(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/calculator/tariff').then(setTariff).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const saveConfig = async () => {
    setError(''); setSuccess('')
    try {
      await api.put('/config', config)
      setSuccess('Configuracion guardada')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const saveTariff = async () => {
    setError(''); setSuccess('')
    try {
      await api.put('/calculator/tariff', tariff)
      setSuccess('Tarifa energetica guardada')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const saveLevel = async () => {
    setError(''); setSuccess('')
    try {
      // Los cambios de nivel NO se guardan directamente.
      // Se envian como propuesta a la Asamblea para aprobacion.
      // Mientras no se apruebe, siguen funcionando los parametros anteriores.
      const proposalDesc = editingLevel
        ? `Cambiar nivel de miembro "${editingLevel.name}" a "${levelForm.name}" (nivel ${levelForm.level})`
        : `Crear nuevo nivel de miembro "${levelForm.name}" (nivel ${levelForm.level})`
      await api.post('/assembly/proposals', {
        proposal_type: 'member_level',
        title: proposalDesc,
        description: proposalDesc,
        parameters: {
          level_id: editingLevel?.id || '',
          name: levelForm.name,
          description: levelForm.description,
          level: levelForm.level,
          has_voice: levelForm.has_voice,
          has_vote: levelForm.has_vote,
          counts_in_quorum: levelForm.counts_in_quorum,
          credit_limit: levelForm.credit_limit,
          debit_limit: levelForm.debit_limit,
          tax_rate: levelForm.tax_rate,
          can_create_organization: levelForm.can_create_organization,
          can_cross_node_trade: levelForm.can_cross_node_trade,
          can_receive_nfc_card: levelForm.can_receive_nfc_card,
          can_view_audit: levelForm.can_view_audit,
          can_use_external_bridge: levelForm.can_use_external_bridge,
          max_organizations: levelForm.max_organizations,
          can_request_limit_increase: levelForm.can_request_limit_increase,
        },
        required_signatures: 1,
      })
      setSuccess(editingLevel
        ? 'Solicitud de cambio enviada a la Asamblea. Los parametros actuales siguen vigentes hasta que la Asamblea apruebe el cambio.'
        : 'Solicitud de creacion enviada a la Asamblea. El nivel se creara cuando la Asamblea lo apruebe.')
      setShowLevelForm(false)
      setEditingLevel(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const editLevel = (l: any) => {
    setEditingLevel(l)
    setLevelForm({
      name: l.name, description: l.description || '', level: l.level,
      has_voice: l.has_voice, has_vote: l.has_vote, counts_in_quorum: l.counts_in_quorum,
      credit_limit: l.credit_limit, debit_limit: l.debit_limit,
      can_create_organization: l.can_create_organization,
      can_cross_node_trade: l.can_cross_node_trade,
      can_receive_nfc_card: l.can_receive_nfc_card,
      can_view_audit: l.can_view_audit,
      can_use_external_bridge: l.can_use_external_bridge,
      max_organizations: l.max_organizations,
      can_request_limit_increase: l.can_request_limit_increase,
      tax_rate: l.tax_rate || 0,
    })
    setShowLevelForm(true)
  }

  const saveOrgLevel = async () => {
    setError(''); setSuccess('')
    try {
      // Los cambios de nivel de organizacion NO se guardan directamente.
      // Se envian como propuesta a la Asamblea para aprobacion.
      const proposalDesc = editingOrgLevel
        ? `Cambiar nivel de organizacion "${editingOrgLevel.name}" a "${orgLevelForm.name}" (nivel ${orgLevelForm.level})`
        : `Crear nuevo nivel de organizacion "${orgLevelForm.name}" (nivel ${orgLevelForm.level})`
      await api.post('/assembly/proposals', {
        proposal_type: 'org_level',
        title: proposalDesc,
        description: proposalDesc,
        parameters: {
          level_id: editingOrgLevel?.id || '',
          name: orgLevelForm.name,
          description: orgLevelForm.description,
          level: orgLevelForm.level,
          credit_limit: orgLevelForm.credit_limit,
          debit_limit: orgLevelForm.debit_limit,
          tax_rate: orgLevelForm.tax_rate,
          can_cross_node_trade: orgLevelForm.can_cross_node_trade,
          can_use_external_bridge: orgLevelForm.can_use_external_bridge,
          can_view_audit: orgLevelForm.can_view_audit,
          max_members: orgLevelForm.max_members,
        },
        required_signatures: 1,
      })
      setSuccess(editingOrgLevel
        ? 'Solicitud de cambio enviada a la Asamblea. Los parametros actuales siguen vigentes hasta que la Asamblea apruebe el cambio.'
        : 'Solicitud de creacion enviada a la Asamblea. El nivel se creara cuando la Asamblea lo apruebe.')
      setShowOrgLevelForm(false)
      setEditingOrgLevel(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const editOrgLevel = (l: any) => {
    setEditingOrgLevel(l)
    setOrgLevelForm({
      name: l.name, description: l.description || '', level: l.level,
      credit_limit: l.credit_limit, debit_limit: l.debit_limit,
      tax_rate: l.tax_rate || 0,
      can_cross_node_trade: l.can_cross_node_trade,
      can_use_external_bridge: l.can_use_external_bridge,
      can_view_audit: l.can_view_audit,
      max_members: l.max_members || 0,
    })
    setShowOrgLevelForm(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings size={24} />Configuracion del Nodo</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Configuracion - Ayuda</strong></p>
          <p><strong>General:</strong> Nombre del nodo, nombre de la moneda (ej: TQ, Trueques, Horas, Puntos) y nombre de la aplicacion.</p>
          <p><strong>Niveles de miembro:</strong> Define los tipos de <strong>usuario individual</strong> de la comunidad. Cada nivel tiene limites, derechos (voz, voto, quorum) y permisos. Los miembros con voto forman parte de la asamblea. Ej: nuevo, activo, honorario.</p>
          <p><strong>Niveles de organizacion:</strong> Define los tipos de <strong>organizacion o empresa</strong> dentro de la comunidad. Cada nivel tiene sus propios limites, impuestos y permisos. Las organizaciones son entidades comerciales/colectivas, no personas. Ej: produccion, consumo, publica, cooperativa.</p>
          <p><strong>Tarifa energetica:</strong> Define la canasta vital diaria (alimentacion, agua, servicios) y los factores de esfuerzo. Esto se usa para calcular precios justos de productos y trabajo.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('general')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'general' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>General</button>
        <button onClick={() => setTab('levels')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'levels' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><UsersIcon size={14} className="inline mr-1" />Niveles de Miembro</button>
        <button onClick={() => setTab('org_levels')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'org_levels' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><Building2 size={14} className="inline mr-1" />Niveles de Organizacion</button>
        <button onClick={() => setTab('tariff')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'tariff' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Tarifa Energetica</button>
        {canManage && (
          <button onClick={() => setTab('backup')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'backup' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><Database size={14} className="inline mr-1" />Copia de Seguridad</button>
        )}
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
      {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg">{success}</div>}

      {/* ===== GENERAL ===== */}
      {tab === 'general' && (
        <div className="card space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><DollarSign size={18} />General</h2>

          <div>
            <label className="label">Nombre del nodo</label>
            <input className="input" value={config.node_name} onChange={(e) => setConfig({ ...config, node_name: e.target.value })} disabled={!canManage} />
            <p className="text-xs text-gray-400 mt-1">Nombre de esta comunidad.</p>
          </div>

          <div>
            <label className="label">Nombre completo de la moneda</label>
            <input className="input" value={config.currency_full_name} onChange={(e) => setConfig({ ...config, currency_full_name: e.target.value })} disabled={!canManage} placeholder="Ej: Trueque, Hora, Punto, Sol" />
            <p className="text-xs text-gray-400 mt-1">Nombre completo de la moneda interna. Ej: Trueque, Hora, Punto. Aparece en textos explicativos y en el sitio publico.</p>
          </div>

          <div>
            <label className="label">Abreviatura de la moneda</label>
            <input className="input" value={config.currency_name} onChange={(e) => setConfig({ ...config, currency_name: e.target.value })} disabled={!canManage} placeholder="Ej: TQ, HR, PT, SOL" />
            <p className="text-xs text-gray-400 mt-1">Abreviatura corta de la moneda. Aparece en balances, transferencias y precios. Ej: TQ para Trueque, HR para Hora.</p>
          </div>

          <div>
            <label className="label">Nombre de la aplicacion</label>
            <input className="input" value={config.app_name} onChange={(e) => setConfig({ ...config, app_name: e.target.value })} disabled={!canManage} />
            <p className="text-xs text-gray-400 mt-1">Nombre que ven los usuarios en la interfaz.</p>
          </div>

          {canManage && (
            <button onClick={saveConfig} className="btn-primary flex items-center gap-2"><Save size={18} />Guardar</button>
          )}
          {!canManage && (
            <p className="text-xs text-amber-600">No tienes permiso para cambiar la configuracion.</p>
          )}
        </div>
      )}

      {/* ===== NIVELES DE MIEMBRO ===== */}
      {tab === 'levels' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><UsersIcon size={18} />Niveles de Miembro</h2>
            {canManage && (
              <button onClick={() => { setShowLevelForm(!showLevelForm); setEditingLevel(null) }} className="btn-primary flex items-center gap-2"><Plus size={18} />Solicitar Nuevo Nivel</button>
            )}
          </div>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
            <p><strong>Niveles de Miembro = Usuarios individuales (personas).</strong></p>
            <p>Los niveles de miembro definen los tipos de <strong>persona</strong> en la comunidad. Cada nivel tiene limites de credito/debito, derechos (voz, voto, quorum) y permisos. Los miembros con voto forman parte de la asamblea.</p>
            <p className="text-xs text-gray-500">Ejemplos: nuevo (recien admitido, sin voto), activo (con voz y voto), honorario (con voz pero sin voto).</p>
            <p className="text-xs text-amber-600"><strong>Importante:</strong> Estos niveles son para personas. Para empresas/organizaciones usa la pestana "Niveles de Organizacion".</p>
          </div>

          {showLevelForm && canManage && (
            <div className="card space-y-4">
              <h3 className="font-semibold">{editingLevel ? 'Solicitar cambio de Nivel de Miembro' : 'Solicitar nuevo Nivel de Miembro'}</h3>

              <div>
                <label className="label">Nombre del nivel</label>
                <input className="input" placeholder="Ej: pleno, honorario, nuevo" value={levelForm.name} onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Nombre del nivel de miembro. Ej: pleno, honorario, nuevo.</p>
              </div>
              <div>
                <label className="label">Descripcion</label>
                <input className="input" placeholder="Ej: Miembro pleno con todos los derechos" value={levelForm.description} onChange={(e) => setLevelForm({ ...levelForm, description: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Explica que significa este nivel. Ej: Miembro pleno con todos los derechos.</p>
              </div>
              <div>
                <label className="label">Numero de nivel (jerarquia 1-10)</label>
                <select className="input" value={levelForm.level} onChange={(e) => setLevelForm({ ...levelForm, level: parseInt(e.target.value) || 1 })}>
                  {LEVEL_OPTIONS.map((n) => (
                    <option key={n} value={n}>{LEVEL_LABELS[n]}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Selecciona la jerarquia del nivel. 1 = miembro nuevo (sin derechos), 5 = miembro activo (voz y voto), 10 = administrador. No es el numero de permisos, es la jerarquia. Dos niveles pueden tener el mismo numero.</p>
              </div>

              <div>
                <label className="label">Impuesto por transaccion (%)</label>
                <input type="number" step="0.1" min="0" max="100" className="input" value={levelForm.tax_rate} onChange={(e) => setLevelForm({ ...levelForm, tax_rate: parseFloat(e.target.value) || 0 })} />
                <p className="text-xs text-gray-400 mt-1">Porcentaje que se descuenta de cada transaccion y va al fondo comunitario. 0 = sin impuesto. 2 = 2% de cada transaccion.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="flex items-center gap-2" title="Puede hablar y dar su opinion en asambleas">
                  <input type="checkbox" checked={levelForm.has_voice} onChange={(e) => setLevelForm({ ...levelForm, has_voice: e.target.checked })} />
                  <span className="text-sm">Tiene voz</span>
                </label>
                <label className="flex items-center gap-2" title="Puede votar en asambleas. Los miembros con voto forman parte de la asamblea.">
                  <input type="checkbox" checked={levelForm.has_vote} onChange={(e) => setLevelForm({ ...levelForm, has_vote: e.target.checked })} />
                  <span className="text-sm">Tiene voto</span>
                </label>
                <label className="flex items-center gap-2" title="Cuenta para el minimo de miembros necesarios para validar una votacion">
                  <input type="checkbox" checked={levelForm.counts_in_quorum} onChange={(e) => setLevelForm({ ...levelForm, counts_in_quorum: e.target.checked })} />
                  <span className="text-sm">Cuenta para quorum</span>
                </label>
              </div>
              <p className="text-xs text-gray-400 -mt-2">Voz = puede opinar en asamblea. Voto = puede votar (forma parte de la asamblea). Quorum = cuenta para el minimo de presentes necesario para validar votaciones.</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Limite de credito (negativo)</label>
                  <input type="number" className="input" value={levelForm.credit_limit} onChange={(e) => setLevelForm({ ...levelForm, credit_limit: parseInt(e.target.value) || 0 })} />
                  <p className="text-xs text-gray-400 mt-1">Cuanto puede deber (negativo).</p>
                </div>
                <div>
                  <label className="label">Limite de debito (positivo)</label>
                  <input type="number" className="input" value={levelForm.debit_limit} onChange={(e) => setLevelForm({ ...levelForm, debit_limit: parseInt(e.target.value) || 0 })} />
                  <p className="text-xs text-gray-400 mt-1">Cuanto puede acumular (positivo).</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={levelForm.can_create_organization} onChange={(e) => setLevelForm({ ...levelForm, can_create_organization: e.target.checked })} />
                  <span className="text-sm">Puede crear organizaciones</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={levelForm.can_cross_node_trade} onChange={(e) => setLevelForm({ ...levelForm, can_cross_node_trade: e.target.checked })} />
                  <span className="text-sm">Comercio entre nodos</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={levelForm.can_receive_nfc_card} onChange={(e) => setLevelForm({ ...levelForm, can_receive_nfc_card: e.target.checked })} />
                  <span className="text-sm">Puede tener tarjeta NFC</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={levelForm.can_view_audit} onChange={(e) => setLevelForm({ ...levelForm, can_view_audit: e.target.checked })} />
                  <span className="text-sm">Puede ver auditoria</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={levelForm.can_use_external_bridge} onChange={(e) => setLevelForm({ ...levelForm, can_use_external_bridge: e.target.checked })} />
                  <span className="text-sm">Puente externo</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={levelForm.can_request_limit_increase} onChange={(e) => setLevelForm({ ...levelForm, can_request_limit_increase: e.target.checked })} />
                  <span className="text-sm">Pedir aumento de limite</span>
                </label>
              </div>

              <div>
                <label className="label">Maximo de organizaciones</label>
                <input type="number" className="input" value={levelForm.max_organizations} onChange={(e) => setLevelForm({ ...levelForm, max_organizations: parseInt(e.target.value) || 0 })} />
                <p className="text-xs text-gray-400 mt-1">Cuantas organizaciones puede crear o pertenecer este miembro. 0 = sin limite.</p>
              </div>

              <div className="card bg-amber-50 border-amber-200 text-sm text-amber-800">
                <p className="flex items-center gap-2"><VoteIcon size={16} /> <strong>Cambio pendiente de aprobacion:</strong> Este cambio no se guarda directamente. Se enviara como propuesta a la Asamblea. Los parametros actuales seguiran vigentes hasta que la Asamblea apruebe el cambio.</p>
              </div>

              <button onClick={saveLevel} className="btn-primary flex items-center gap-2"><VoteIcon size={18} />{editingLevel ? 'Solicitar aprobacion de la Asamblea' : 'Solicitar creacion a la Asamblea'}</button>
            </div>
          )}

          {levels.length === 0 && !showLevelForm ? (
            <div className="card text-center text-gray-500 py-8">
              <p>No hay niveles de miembro configurados.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {levels.map((l, i) => (
                <div key={i} className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{l.name}</span>
                      <span className="text-xs text-gray-500 ml-2">Nivel {l.level}</span>
                    </div>
                    {canManage && (
                      <button onClick={() => editLevel(l)} className="text-blue-500"><Edit size={16} /></button>
                    )}
                  </div>
                  {l.description && <p className="text-xs text-gray-500 mt-1">{l.description}</p>}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {l.has_voice && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Voz</span>}
                    {l.has_vote && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Voto</span>}
                    {l.counts_in_quorum && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Quorum</span>}
                    {l.can_create_organization && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Crea org</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Credito: {l.credit_limit} | Debito: {l.debit_limit}
                    {l.max_organizations > 0 && ` | Max org: ${l.max_organizations}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== NIVELES DE ORGANIZACION ===== */}
      {tab === 'org_levels' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><Building2 size={18} />Niveles de Organizacion</h2>
            {canManage && (
              <button onClick={() => { setShowOrgLevelForm(!showOrgLevelForm); setEditingOrgLevel(null) }} className="btn-primary flex items-center gap-2"><Plus size={18} />Solicitar Nuevo Nivel</button>
            )}
          </div>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
            <p><strong>Niveles de Organizacion = Empresas, cooperativas, instituciones (no personas).</strong></p>
            <p>Los niveles de organizacion definen los tipos de <strong>entidad colectiva</strong> dentro de la comunidad. Una organizacion es como una empresa: tiene miembros, sus propios impuestos, limites y reglas. Cada nivel tiene su propia tasa de impuesto y limites de credito/debito.</p>
            <p className="text-xs text-gray-500">Ejemplos: org_produccion (fabrica bienes), org_consumo (distribuye bienes), org_publica (sin fines de lucro, exenta), org_cooperativa (propiedad compartida).</p>
            <p className="text-xs text-amber-600"><strong>Importante:</strong> Estos niveles son para organizaciones/empresas. Para personas usa la pestana "Niveles de Miembro".</p>
          </div>

          {showOrgLevelForm && canManage && (
            <div className="card space-y-4">
              <h3 className="font-semibold">{editingOrgLevel ? 'Solicitar cambio de Nivel de Organizacion' : 'Solicitar nuevo Nivel de Organizacion'}</h3>

              <div>
                <label className="label">Nombre del nivel</label>
                <input className="input" placeholder="Ej: org_produccion, org_consumo, org_publica" value={orgLevelForm.name} onChange={(e) => setOrgLevelForm({ ...orgLevelForm, name: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Nombre del nivel de organizacion. Ej: org_produccion, org_consumo, org_publica, org_cooperativa.</p>
              </div>
              <div>
                <label className="label">Descripcion</label>
                <input className="input" placeholder="Ej: Organizacion de produccion. Fabrica o produce bienes." value={orgLevelForm.description} onChange={(e) => setOrgLevelForm({ ...orgLevelForm, description: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Explica que tipo de organizaciones pertenecen a este nivel. Ej: Fabrica o produce bienes.</p>
              </div>
              <div>
                <label className="label">Numero de nivel (jerarquia 1-10)</label>
                <select className="input" value={orgLevelForm.level} onChange={(e) => setOrgLevelForm({ ...orgLevelForm, level: parseInt(e.target.value) || 1 })}>
                  {LEVEL_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} - {n <= 3 ? 'Basico' : n <= 7 ? 'Intermedio' : 'Avanzado'}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Selecciona la jerarquia del nivel dentro de las organizaciones. 1 = nivel basico, 10 = nivel maximo. No es cantidad de permisos, es jerarquia.</p>
              </div>

              <div>
                <label className="label">Impuesto por transaccion (%)</label>
                <input type="number" step="0.1" min="0" max="100" className="input" value={orgLevelForm.tax_rate} onChange={(e) => setOrgLevelForm({ ...orgLevelForm, tax_rate: parseFloat(e.target.value) || 0 })} />
                <p className="text-xs text-gray-400 mt-1">Porcentaje de impuesto que aplica a las transacciones de esta organizacion. 0 = exenta (tipico de instituciones publicas). 2 = 2% de cada transaccion va al fondo comunitario.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Limite de credito (negativo)</label>
                  <input type="number" className="input" value={orgLevelForm.credit_limit} onChange={(e) => setOrgLevelForm({ ...orgLevelForm, credit_limit: parseInt(e.target.value) || 0 })} />
                  <p className="text-xs text-gray-400 mt-1">Cuanto puede deber la organizacion (negativo). Ej: -100000.</p>
                </div>
                <div>
                  <label className="label">Limite de debito (positivo)</label>
                  <input type="number" className="input" value={orgLevelForm.debit_limit} onChange={(e) => setOrgLevelForm({ ...orgLevelForm, debit_limit: parseInt(e.target.value) || 0 })} />
                  <p className="text-xs text-gray-400 mt-1">Cuanto puede acumular la organizacion (positivo). Ej: 100000.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={orgLevelForm.can_cross_node_trade} onChange={(e) => setOrgLevelForm({ ...orgLevelForm, can_cross_node_trade: e.target.checked })} />
                  <span className="text-sm">Comercio entre nodos</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={orgLevelForm.can_use_external_bridge} onChange={(e) => setOrgLevelForm({ ...orgLevelForm, can_use_external_bridge: e.target.checked })} />
                  <span className="text-sm">Puente externo</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={orgLevelForm.can_view_audit} onChange={(e) => setOrgLevelForm({ ...orgLevelForm, can_view_audit: e.target.checked })} />
                  <span className="text-sm">Puede ver auditoria</span>
                </label>
              </div>

              <div>
                <label className="label">Maximo de miembros</label>
                <input type="number" className="input" value={orgLevelForm.max_members} onChange={(e) => setOrgLevelForm({ ...orgLevelForm, max_members: parseInt(e.target.value) || 0 })} />
                <p className="text-xs text-gray-400 mt-1">Cuantas personas pueden pertenecer a una organizacion de este nivel. 0 = sin limite.</p>
              </div>

              <div className="card bg-amber-50 border-amber-200 text-sm text-amber-800">
                <p className="flex items-center gap-2"><VoteIcon size={16} /> <strong>Cambio pendiente de aprobacion:</strong> Este cambio no se guarda directamente. Se enviara como propuesta a la Asamblea. Los parametros actuales seguiran vigentes hasta que la Asamblea apruebe el cambio.</p>
              </div>

              <button onClick={saveOrgLevel} className="btn-primary flex items-center gap-2"><VoteIcon size={18} />{editingOrgLevel ? 'Solicitar aprobacion de la Asamblea' : 'Solicitar creacion a la Asamblea'}</button>
            </div>
          )}

          {orgLevels.length === 0 && !showOrgLevelForm ? (
            <div className="card text-center text-gray-500 py-8">
              <p>No hay niveles de organizacion configurados.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {orgLevels.map((l, i) => (
                <div key={i} className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{l.name}</span>
                      <span className="text-xs text-gray-500 ml-2">Nivel {l.level}</span>
                    </div>
                    {canManage && (
                      <button onClick={() => editOrgLevel(l)} className="text-blue-500"><Edit size={16} /></button>
                    )}
                  </div>
                  {l.description && <p className="text-xs text-gray-500 mt-1">{l.description}</p>}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {l.can_cross_node_trade && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Comercio nodos</span>}
                    {l.can_use_external_bridge && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Puente externo</span>}
                    {l.can_view_audit && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Auditoria</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Credito: {l.credit_limit} | Debito: {l.debit_limit} | Impuesto: {l.tax_rate}%
                    {l.max_members > 0 && ` | Max miembros: ${l.max_members}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== TARIFA ===== */}
      {tab === 'tariff' && (
        <div className="card space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Zap size={18} />Tarifa Energetica</h2>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
            <p><strong>Que es la tarifa energetica:</strong> Es la base para calcular precios justos. La idea es que 1 {config.currency_name} = 1 kWh de energia. Con esto, todo producto o servicio tiene un precio objetivo: la energia total que costo producirlo.</p>
            <p><strong>Como funciona:</strong> Primero se calcula cuanto cuesta mantener vivo a una persona por dia (canasta vital). Luego se divide entre las horas de trabajo de un dia para obtener la tarifa por hora. Los factores de esfuerzo ajustan el precio segun la dificultad del trabajo.</p>
            <p><strong>Ejemplo:</strong> Si la canasta vital diaria es 1500 {config.currency_name} y se trabajan 6 horas por dia, la tarifa base por hora es 250 {config.currency_name}. Un trabajo agricola (factor 1.3) pagaria 325 {config.currency_name} por hora.</p>
            <p><strong>Quien la configura:</strong> La asamblea. Cambiar estos valores afecta todos los calculos de precios.</p>
          </div>

          <h3 className="font-medium text-sm">Canasta vital diaria (en {config.currency_name})</h3>
          <p className="text-xs text-gray-500 -mt-2">Cuanto cuesta lo minimo para que una persona viva un dia. La suma de estos valores es la base de todos los calculos.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Alimentacion</label>
              <input type="number" className="input" value={tariff.vital_food} onChange={(e) => setTariff({ ...tariff, vital_food: parseFloat(e.target.value) || 0 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Costo diario de comida basica (granos, verduras, frutas). Ej: 800</p>
            </div>
            <div>
              <label className="label">Agua</label>
              <input type="number" className="input" value={tariff.vital_water} onChange={(e) => setTariff({ ...tariff, vital_water: parseFloat(e.target.value) || 0 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Costo diario de agua potable para consumo e higiene. Ej: 150</p>
            </div>
            <div>
              <label className="label">Vivienda/domestico</label>
              <input type="number" className="input" value={tariff.vital_domestic} onChange={(e) => setTariff({ ...tariff, vital_domestic: parseFloat(e.target.value) || 0 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Costo diario de vivienda (alquiler, mantenimiento, energia domestica). Ej: 350</p>
            </div>
            <div>
              <label className="label">Servicios</label>
              <input type="number" className="input" value={tariff.vital_services} onChange={(e) => setTariff({ ...tariff, vital_services: parseFloat(e.target.value) || 0 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Costo diario de servicios basicos (salud, transporte, comunicaciones). Ej: 200</p>
            </div>
          </div>

          <div className="card bg-gray-50 text-sm">
            <p><strong>Suma total diaria:</strong> {(tariff.vital_food + tariff.vital_water + tariff.vital_domestic + tariff.vital_services).toFixed(0)} {config.currency_name}</p>
            <p className="text-xs text-gray-500 mt-1">Tarifa base por hora = {((tariff.vital_food + tariff.vital_water + tariff.vital_domestic + tariff.vital_services) / (tariff.work_hours_per_day || 1)).toFixed(1)} {config.currency_name} (suma total / horas por dia)</p>
          </div>

          <h3 className="font-medium text-sm">Factores de esfuerzo</h3>
          <p className="text-xs text-gray-500 -mt-2">Multiplican el costo del trabajo segun su dificultad fisica o mental. 1.0 = esfuerzo base. Mas alto = mas dificil = mas pago.</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Administrativo</label>
              <input type="number" step="0.05" className="input" value={tariff.effort_admin} onChange={(e) => setTariff({ ...tariff, effort_admin: parseFloat(e.target.value) || 1 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">1.0 = base. Trabajo de oficina, gestion, administracion. Esfuerzo fisico minimo.</p>
            </div>
            <div>
              <label className="label">Tecnico</label>
              <input type="number" step="0.05" className="input" value={tariff.effort_technical} onChange={(e) => setTariff({ ...tariff, effort_technical: parseFloat(e.target.value) || 1 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">1.15 = 15% mas. Trabajo tecnico especializado: electricidad, plomeria, mecanica. Requiere conocimiento y esfuerzo moderado.</p>
            </div>
            <div>
              <label className="label">Agricola</label>
              <input type="number" step="0.05" className="input" value={tariff.effort_agricultural} onChange={(e) => setTariff({ ...tariff, effort_agricultural: parseFloat(e.target.value) || 1 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">1.3 = 30% mas. Trabajo agricola, construccion, carga. Esfuerzo fisico intenso.</p>
            </div>
          </div>

          <h3 className="font-medium text-sm">Parametros laborales</h3>
          <p className="text-xs text-gray-500 -mt-2">Definen el tiempo de trabajo estandar. Se usan para calcular la tarifa por hora.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Horas por dia</label>
              <input type="number" className="input" value={tariff.work_hours_per_day} onChange={(e) => setTariff({ ...tariff, work_hours_per_day: parseInt(e.target.value) || 6 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Horas de trabajo estandar por dia. Tipico: 6-8. Menos horas = tarifa por hora mas alta.</p>
            </div>
            <div>
              <label className="label">Dias por mes</label>
              <input type="number" className="input" value={tariff.work_days_per_month} onChange={(e) => setTariff({ ...tariff, work_days_per_month: parseInt(e.target.value) || 24 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Dias de trabajo por mes. Tipico: 20-24. Se usa para calcular ingresos mensuales base.</p>
            </div>
          </div>

          {canManage && (
            <button onClick={saveTariff} className="btn-primary flex items-center gap-2"><Save size={18} />Guardar Tarifa</button>
          )}
        </div>
      )}

      {/* ===== COPIA DE SEGURIDAD ===== */}
      {tab === 'backup' && canManage && (
        <div className="card space-y-6">
          <h2 className="font-semibold flex items-center gap-2"><Database size={18} />Copia de Seguridad</h2>

          {/* Descargar backup */}
          <div className="card bg-green-50 border-green-200 space-y-3">
            <h3 className="font-medium text-sm flex items-center gap-2"><Download size={16} />Descargar Copia de Seguridad</h3>
            <p className="text-xs text-gray-600">
              Descarga un archivo JSON con todas las tablas y datos de la base de datos del nodo.
              Esto incluye: usuarios, productos, intercambios, paginas publicas, configuracion, etc.
              Guarda este archivo en un lugar seguro.
            </p>
            <button
              onClick={async () => {
                setBackupLoading(true)
                setError(''); setSuccess('')
                try {
                  const token = localStorage.getItem('token')
                  const res = await fetch('/api/backup', {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                  })
                  if (!res.ok) throw new Error('Error al descargar backup')
                  const blob = await res.blob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  URL.revokeObjectURL(url)
                  setSuccess('Copia de seguridad descargada')
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Error al descargar')
                } finally {
                  setBackupLoading(false)
                }
              }}
              disabled={backupLoading}
              className="btn-primary flex items-center gap-2"
            >
              <Download size={18} />
              {backupLoading ? 'Descargando...' : 'Descargar Backup'}
            </button>
          </div>

          {/* Restaurar backup */}
          <div className="card bg-amber-50 border-amber-200 space-y-3">
            <h3 className="font-medium text-sm flex items-center gap-2"><Upload size={16} />Restaurar Copia de Seguridad</h3>
            <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-100 p-3 rounded-lg">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <strong>Atencion:</strong> Restaurar agregara los registros del backup que no existan ya en la base de datos.
                No se sobreescriben registros existentes (ON CONFLICT DO NOTHING).
                Esto es seguro pero no reemplaza datos actuales. Para una restauracion completa,
                contacta al administrador del sistema.
              </div>
            </div>
            <div>
              <label className="label">Seleccionar archivo de backup (.json)</label>
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  setRestoreFile(e.target.files?.[0] || null)
                  setRestoreResult(null)
                }}
                className="input"
              />
            </div>
            <button
              onClick={async () => {
                if (!restoreFile) return
                setRestoreLoading(true)
                setError(''); setSuccess(''); setRestoreResult(null)
                try {
                  const text = await restoreFile.text()
                  const backup = JSON.parse(text)
                  const token = localStorage.getItem('token')
                  const res = await fetch('/api/backup/restore', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ backup }),
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.error || 'Error al restaurar')
                  setRestoreResult(data)
                  setSuccess('Copia de seguridad restaurada')
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Error al restaurar')
                } finally {
                  setRestoreLoading(false)
                }
              }}
              disabled={!restoreFile || restoreLoading}
              className="btn-primary flex items-center gap-2"
            >
              <Upload size={18} />
              {restoreLoading ? 'Restaurando...' : 'Restaurar Backup'}
            </button>

            {restoreResult && (
              <div className="card bg-white space-y-2">
                <h4 className="font-medium text-sm">Resultado de la restauracion:</h4>
                <div className="text-xs space-y-1 max-h-60 overflow-y-auto">
                  {restoreResult.restored && Object.entries(restoreResult.restored).map(([table, count]: [string, any]) => (
                    <div key={table} className="flex justify-between">
                      <span className="font-mono">{table}</span>
                      <span className="font-mono text-green-600">{count} registros</span>
                    </div>
                  ))}
                  {restoreResult.errors && Object.entries(restoreResult.errors).map(([table, err]: [string, any]) => (
                    <div key={table} className="flex justify-between">
                      <span className="font-mono">{table}</span>
                      <span className="font-mono text-red-600">{String(err)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Info adicional */}
          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
            <h3 className="font-medium flex items-center gap-2"><HelpCircle size={16} />Como funciona</h3>
            <p><strong>Descargar:</strong> Genera un archivo JSON con todas las tablas de la base de datos. Guardalo en un lugar seguro (USB, nube, etc).</p>
            <p><strong>Restaurar:</strong> Sube un archivo JSON de backup. Los registros que ya existan no se duplican. Los que no existan se agregaran.</p>
            <p><strong>Frecuencia recomendada:</strong> Descarga una copia al menos una vez por semana, o antes de hacer cambios importantes.</p>
          </div>
        </div>
      )}
    </div>
  )
}
