import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { HelpCircle, Settings, DollarSign, Layers, Zap, Save, Plus, Edit, Building2, Users as UsersIcon, Vote as VoteIcon, Database, Download, Upload, AlertTriangle, RefreshCw, Globe, Lock, Unlock, Trash2, FileText, Server, HardDrive, CheckCircle } from 'lucide-react'

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
  const isDemoNode = (window as any).__BASE_PATH__ === '/demo'

  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as any) || 'general'
  const [tab, setTab] = useState<'general' | 'levels' | 'org_levels' | 'tariff' | 'backup' | 'database' | 'demo'>(initialTab)
  const [clusterStatus, setClusterStatus] = useState<any>(null)
  const [clusterChecking, setClusterChecking] = useState(false)
  const [clusterConfig, setClusterConfig] = useState<any>(null)
  const [hardwareInfo, setHardwareInfo] = useState<any>(null)
  const [clusterSaving, setClusterSaving] = useState(false)
  const [clusterForm, setClusterForm] = useState({
    mode: 'single',
    tablet_limit: 1000,
    min_nodes: 1,
    alert_threshold: 80,
    server_ram_gb: 16,
    memstore_percentage: 10,
    nodes: [] as Array<{ host: string; port: number; is_local: boolean }>,
  })

  // Actualizar URL cuando cambia el tab
  const changeTab = (newTab: typeof tab) => {
    setTab(newTab)
    setSearchParams({ tab: newTab }, { replace: true })
  }
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [demoResetting, setDemoResetting] = useState(false)

  // Backup
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoreResult, setRestoreResult] = useState<any>(null)

  // Mensajes locales junto a botones
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [configMsg, setConfigMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [demoMsg, setDemoMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ open: boolean, action: () => void, text: string }>({ open: false, action: () => {}, text: '' })

  // Backups automaticos
  const [autoBackups, setAutoBackups] = useState<any[]>([])
  const [backupConfig, setBackupConfig] = useState({ interval_hours: 24, retention_days: 7, enabled: true })
  const [backupConfigLoading, setBackupConfigLoading] = useState(false)
  const [autoBackupLoading, setAutoBackupLoading] = useState(false)

  // Nodos YugabyteDB
  const [ybNodes, setYbNodes] = useState<any[]>([])
  const [ybNodeForm, setYbNodeForm] = useState({ node_name: '', host_ip: '', port: 7100, region: '' })
  const [ybLoading, setYbLoading] = useState(false)

  // Config general
  const [config, setConfig] = useState({ node_name: '', currency_name: 'TQ', currency_full_name: 'Trueque', app_name: 'Red de Intercambio', node_domain: '' })

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

  // Cargar backups automaticos y nodos YugabyteDB cuando se abren esos tabs
  const loadAutoBackups = async () => {
    try {
      const token = localStorage.getItem('fmc_token')
      const res = await fetch('/api/admin/backups', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) setAutoBackups(await res.json())
    } catch {}
  }

  const loadBackupConfig = async () => {
    try {
      const token = localStorage.getItem('fmc_token')
      const res = await fetch('/api/admin/backup-config', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) setBackupConfig(await res.json())
    } catch {}
  }

  const loadYbNodes = async () => {
    try {
      const token = localStorage.getItem('fmc_token')
      const res = await fetch('/api/admin/yb-nodes', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) setYbNodes(await res.json())
    } catch {}
  }

  const loadClusterStatus = async () => {
    try {
      const res = await api.get('/cluster/status')
      setClusterStatus(res)
    } catch (e) { console.error('Error loading cluster status:', e) }
  }

  const loadClusterConfig = async () => {
    try {
      const [cfgRes, hwRes] = await Promise.all([
        api.get('/cluster/config'),
        api.get('/cluster/hardware'),
      ])
      setClusterConfig(cfgRes)
      setHardwareInfo(hwRes)
      setClusterForm({
        mode: (cfgRes as any).mode || 'single',
        tablet_limit: (cfgRes as any).tablet_limit || 1000,
        min_nodes: (cfgRes as any).min_nodes || 1,
        alert_threshold: (cfgRes as any).alert_threshold || 80,
        server_ram_gb: (cfgRes as any).server_ram_gb || (hwRes as any).ram_gb || 16,
        memstore_percentage: (cfgRes as any).memstore_percentage || (hwRes as any).recommended_mem_pct || 10,
        nodes: (cfgRes as any).nodes || [{ host: 'yugabytedb', port: 5433, is_local: true }],
      })
    } catch (e) { console.error('Error loading cluster config:', e) }
  }

  const saveClusterConfig = async () => {
    setClusterSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.put('/cluster/config', clusterForm)
      setSuccess((res as any).message || 'Configuracion guardada')
      await loadClusterConfig()
    } catch (e: any) {
      setError(e.message || 'Error al guardar configuracion')
    } finally {
      setClusterSaving(false)
    }
  }

  const checkCluster = async () => {
    setClusterChecking(true)
    try {
      const res = await api.post('/cluster/check', {})
      setClusterStatus(res)
    } catch (e) { console.error(e) }
    finally { setClusterChecking(false) }
  }

  useEffect(() => {
    if (tab === 'backup') { loadAutoBackups(); loadBackupConfig() }
    if (tab === 'database') { loadYbNodes(); loadClusterStatus(); loadClusterConfig() }
  }, [tab])

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
        <button onClick={() => changeTab('general')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'general' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>General</button>
        <button onClick={() => changeTab('levels')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'levels' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><UsersIcon size={14} className="inline mr-1" />Niveles de Miembro</button>
        <button onClick={() => changeTab('org_levels')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'org_levels' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><Building2 size={14} className="inline mr-1" />Niveles de Organizacion</button>
        <button onClick={() => changeTab('tariff')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'tariff' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Tarifa Energetica</button>
        {canManage && (
          <button onClick={() => changeTab('backup')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'backup' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><Database size={14} className="inline mr-1" />Copia de Seguridad</button>
        )}
        {canManage && (
          <button onClick={() => changeTab('database')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'database' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><HardDrive size={14} className="inline mr-1" />Base de Datos</button>
        )}
        {canManage && (
          <button onClick={() => changeTab('demo')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'demo' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><Globe size={14} className="inline mr-1" />Nodo Demo</button>
        )}
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
      {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg">{success}</div>}

      {/* ===== GENERAL ===== */}
      {tab === 'general' && (
        <div className="card space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><DollarSign size={18} />General</h2>

          <div>
            <label className="label">Dominio del nodo</label>
            <input
              className="input"
              value={config.node_domain}
              onChange={(e) => setConfig({ ...config, node_domain: e.target.value })}
              disabled={!canManage || isDemoNode}
              readOnly={isDemoNode}
              placeholder="mi-aldea.org"
            />
            <p className="text-xs text-gray-400 mt-1">
              {isDemoNode ? (
                <>
                  <Lock size={12} className="inline" /> Este dominio se hereda automaticamente del nodo padre.
                  No se puede modificar. Si el padre cambia de dominio, este nodo demo se actualizara
                  automaticamente la proxima vez que se reinicie.
                </>
              ) : (
                <>
                  Escribir sin <code>https://</code>, sin <code>www.</code> y sin puerto.
                  Ej: <code>mi-aldea.org</code> &nbsp;|&nbsp; <code>comunidad.ejemplo.com</code> &nbsp;|&nbsp; <code>feria.loanstly.com</code>
                  <br />
                  Se usa para federacion, URLs publicas e identidad del nodo.
                  Si cambias el dominio, todos los datos locales se conservan (no se pierde nada).
                  Asegurate de que el nuevo dominio apunte a este servidor antes de guardar.
                </>
              )}
            </p>
          </div>

          <div>
            <label className="label">Nombre del nodo</label>
            <input className="input" value={config.node_name} onChange={(e) => setConfig({ ...config, node_name: e.target.value })} disabled={!canManage || isDemoNode} readOnly={isDemoNode} />
            <p className="text-xs text-gray-400 mt-1">Nombre de esta comunidad.</p>
          </div>

          <div>
            <label className="label">Nombre completo de la moneda</label>
            <input className="input" value={config.currency_full_name} onChange={(e) => setConfig({ ...config, currency_full_name: e.target.value })} disabled={!canManage || isDemoNode} readOnly={isDemoNode} placeholder="Ej: Trueque, Hora, Punto, Sol" />
            <p className="text-xs text-gray-400 mt-1">Nombre completo de la moneda interna. Ej: Trueque, Hora, Punto. Aparece en textos explicativos y en el sitio publico.</p>
          </div>

          <div>
            <label className="label">Abreviatura de la moneda</label>
            <input className="input" value={config.currency_name} onChange={(e) => setConfig({ ...config, currency_name: e.target.value })} disabled={!canManage || isDemoNode} readOnly={isDemoNode} placeholder="Ej: TQ, HR, PT, SOL" />
            <p className="text-xs text-gray-400 mt-1">Abreviatura corta de la moneda. Aparece en balances, transferencias y precios. Ej: TQ para Trueque, HR para Hora.</p>
          </div>

          <div>
            <label className="label">Nombre de la aplicacion</label>
            <input className="input" value={config.app_name} onChange={(e) => setConfig({ ...config, app_name: e.target.value })} disabled={!canManage || isDemoNode} readOnly={isDemoNode} />
            <p className="text-xs text-gray-400 mt-1">Nombre que ven los usuarios en la interfaz.</p>
          </div>

          {isDemoNode && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
              <Lock size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <strong>Nodo Demo:</strong> La configuracion general se hereda del nodo padre.
                No se puede modificar ni actualizar desde aqui. El nodo demo se actualiza
                automaticamente cuando se actualiza el nodo padre.
              </div>
            </div>
          )}

          {canManage && !isDemoNode && (
            <button onClick={saveConfig} className="btn-primary flex items-center gap-2"><Save size={18} />Guardar</button>
          )}
          {!canManage && (
            <p className="text-xs text-amber-600">No tienes permiso para cambiar la configuracion.</p>
          )}

          {/* Actualizar nodo - oculto en demo (se actualiza desde el padre) */}
          {!isDemoNode && <NodeUpdateSection canManage={canManage} />}
        </div>
      )}

      {/* ===== NIVELES DE MIEMBRO ===== */}
      {tab === 'levels' && (
        <div className="space-y-4">
          {isDemoNode && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
              <Lock size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <strong>Nodo Demo:</strong> Los niveles de miembro son solo lectura en el demo.
                Se configuran en el nodo padre.
              </div>
            </div>
          )}
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><UsersIcon size={18} />Niveles de Miembro</h2>
            {canManage && !isDemoNode && (
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
          {isDemoNode && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
              <Lock size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <strong>Nodo Demo:</strong> Los niveles de organizacion son solo lectura en el demo.
                Se configuran en el nodo padre.
              </div>
            </div>
          )}
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><Building2 size={18} />Niveles de Organizacion</h2>
            {canManage && !isDemoNode && (
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

          {isDemoNode && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
              <Lock size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <strong>Nodo Demo:</strong> La tarifa energetica es solo lectura en el demo.
                Se configura en el nodo padre.
              </div>
            </div>
          )}

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
              <input type="number" className="input" value={tariff.vital_food} onChange={(e) => setTariff({ ...tariff, vital_food: parseFloat(e.target.value) || 0 })} disabled={!canManage || isDemoNode} readOnly={isDemoNode} />
              <p className="text-xs text-gray-400 mt-1">Costo diario de comida basica (granos, verduras, frutas). Ej: 800</p>
            </div>
            <div>
              <label className="label">Agua</label>
              <input type="number" className="input" value={tariff.vital_water} onChange={(e) => setTariff({ ...tariff, vital_water: parseFloat(e.target.value) || 0 })} disabled={!canManage || isDemoNode} readOnly={isDemoNode} />
              <p className="text-xs text-gray-400 mt-1">Costo diario de agua potable para consumo e higiene. Ej: 150</p>
            </div>
            <div>
              <label className="label">Vivienda/domestico</label>
              <input type="number" className="input" value={tariff.vital_domestic} onChange={(e) => setTariff({ ...tariff, vital_domestic: parseFloat(e.target.value) || 0 })} disabled={!canManage || isDemoNode} readOnly={isDemoNode} />
              <p className="text-xs text-gray-400 mt-1">Costo diario de vivienda (alquiler, mantenimiento, energia domestica). Ej: 350</p>
            </div>
            <div>
              <label className="label">Servicios</label>
              <input type="number" className="input" value={tariff.vital_services} onChange={(e) => setTariff({ ...tariff, vital_services: parseFloat(e.target.value) || 0 })} disabled={!canManage || isDemoNode} readOnly={isDemoNode} />
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
              <input type="number" step="0.05" className="input" value={tariff.effort_admin} onChange={(e) => setTariff({ ...tariff, effort_admin: parseFloat(e.target.value) || 1 })} disabled={!canManage || isDemoNode} readOnly={isDemoNode} />
              <p className="text-xs text-gray-400 mt-1">1.0 = base. Trabajo de oficina, gestion, administracion. Esfuerzo fisico minimo.</p>
            </div>
            <div>
              <label className="label">Tecnico</label>
              <input type="number" step="0.05" className="input" value={tariff.effort_technical} onChange={(e) => setTariff({ ...tariff, effort_technical: parseFloat(e.target.value) || 1 })} disabled={!canManage || isDemoNode} readOnly={isDemoNode} />
              <p className="text-xs text-gray-400 mt-1">1.15 = 15% mas. Trabajo tecnico especializado: electricidad, plomeria, mecanica. Requiere conocimiento y esfuerzo moderado.</p>
            </div>
            <div>
              <label className="label">Agricola</label>
              <input type="number" step="0.05" className="input" value={tariff.effort_agricultural} onChange={(e) => setTariff({ ...tariff, effort_agricultural: parseFloat(e.target.value) || 1 })} disabled={!canManage || isDemoNode} readOnly={isDemoNode} />
              <p className="text-xs text-gray-400 mt-1">1.3 = 30% mas. Trabajo agricola, construccion, carga. Esfuerzo fisico intenso.</p>
            </div>
          </div>

          <h3 className="font-medium text-sm">Parametros laborales</h3>
          <p className="text-xs text-gray-500 -mt-2">Definen el tiempo de trabajo estandar. Se usan para calcular la tarifa por hora.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Horas por dia</label>
              <input type="number" className="input" value={tariff.work_hours_per_day} onChange={(e) => setTariff({ ...tariff, work_hours_per_day: parseInt(e.target.value) || 6 })} disabled={!canManage || isDemoNode} readOnly={isDemoNode} />
              <p className="text-xs text-gray-400 mt-1">Horas de trabajo estandar por dia. Tipico: 6-8. Menos horas = tarifa por hora mas alta.</p>
            </div>
            <div>
              <label className="label">Dias por mes</label>
              <input type="number" className="input" value={tariff.work_days_per_month} onChange={(e) => setTariff({ ...tariff, work_days_per_month: parseInt(e.target.value) || 24 })} disabled={!canManage || isDemoNode} readOnly={isDemoNode} />
              <p className="text-xs text-gray-400 mt-1">Dias de trabajo por mes. Tipico: 20-24. Se usa para calcular ingresos mensuales base.</p>
            </div>
          </div>

          {canManage && !isDemoNode && (
            <button onClick={saveTariff} className="btn-primary flex items-center gap-2"><Save size={18} />Guardar Tarifa</button>
          )}
        </div>
      )}

      {/* ===== COPIA DE SEGURIDAD ===== */}
      {tab === 'backup' && canManage && (
        <div className="card space-y-6">
          <h2 className="font-semibold flex items-center gap-2"><Database size={18} />Copia de Seguridad</h2>

          {isDemoNode && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-800">
              <strong>⚠️ Vista de Demostración:</strong> Esta pestaña es solo lectura en el nodo demo.
              No se pueden crear, descargar ni restaurar copias de seguridad en modo demostración.
            </div>
          )}

          {isDemoNode ? (
            <div className="text-center text-gray-400 py-8">
              <Database size={48} className="mx-auto mb-3 opacity-30" />
              <p>Las funciones de copia de seguridad están deshabilitadas en el nodo demo.</p>
            </div>
          ) : (
            <>
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
                  const token = localStorage.getItem('fmc_token')
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
                  const token = localStorage.getItem('fmc_token')
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

          {/* ===== BACKUPS AUTOMATICOS ===== */}
          <div className="border-t pt-4 space-y-4">
            <h3 className="font-medium text-sm flex items-center gap-2"><RefreshCw size={16} />Backups Automaticos</h3>
            <p className="text-xs text-gray-600">
              El sistema puede crear backups automaticos de la base de datos y guardarlos en el servidor.
              Configura cada cuanto tiempo hacerlos y cuanto tiempo mantenerlos antes de borrarlos.
              Los backups bloqueados nunca se borran automaticamente.
            </p>

            {/* Configuracion */}
            <div className="card bg-gray-50 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="label flex items-center gap-1">
                    Frecuencia (horas)
                    <HelpCircle size={12} className="text-gray-400" title="Cada cuantas horas se crea un backup automatico. Minimo 1." />
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={backupConfig.interval_hours}
                    onChange={(e) => setBackupConfig({ ...backupConfig, interval_hours: parseInt(e.target.value) || 1 })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label flex items-center gap-1">
                    Retencion (dias)
                    <HelpCircle size={12} className="text-gray-400" title="Cuantos dias se mantiene un backup antes de borrarlo automaticamente. Los bloqueados no se borran." />
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={backupConfig.retention_days}
                    onChange={(e) => setBackupConfig({ ...backupConfig, retention_days: parseInt(e.target.value) || 1 })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label flex items-center gap-1">
                    Estado
                    <HelpCircle size={12} className="text-gray-400" title="Activa o desactiva los backups automaticos." />
                  </label>
                  <button
                    onClick={() => setBackupConfig({ ...backupConfig, enabled: !backupConfig.enabled })}
                    className={`w-full px-4 py-2 rounded-lg text-sm font-medium ${backupConfig.enabled ? 'bg-green-600 text-white' : 'bg-gray-300'}`}
                  >
                    {backupConfig.enabled ? 'Activados' : 'Desactivados'}
                  </button>
                </div>
              </div>
              <button
                onClick={async () => {
                  setBackupConfigLoading(true)
                  setConfigMsg(null)
                  try {
                    const token = localStorage.getItem('fmc_token')
                    const res = await fetch('/api/admin/backup-config', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                      body: JSON.stringify(backupConfig),
                    })
                    if (!res.ok) throw new Error('Error al guardar configuracion')
                    setConfigMsg({ type: 'success', text: 'Configuracion guardada correctamente.' })
                  } catch (err) {
                    setConfigMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error al guardar' })
                  } finally {
                    setBackupConfigLoading(false)
                  }
                }}
                disabled={backupConfigLoading}
                className="btn-primary flex items-center gap-2"
              >
                <Save size={16} />
                {backupConfigLoading ? 'Guardando...' : 'Guardar Configuracion'}
              </button>
              {configMsg && (
                <div className={`text-xs p-2 rounded-lg flex items-center gap-2 ${
                  configMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {configMsg.type === 'success' ? <RefreshCw size={14} /> : <AlertTriangle size={14} />}
                  {configMsg.text}
                </div>
              )}
            </div>

            {/* Crear backup ahora */}
            <div className="space-y-2">
              <button
                onClick={async () => {
                  setAutoBackupLoading(true)
                  setBackupMsg({ type: 'info', text: 'Solicitando backup...' })
                  try {
                    const token = localStorage.getItem('fmc_token')
                    const res = await fetch('/api/admin/backups/now', {
                      method: 'POST',
                      headers: token ? { Authorization: `Bearer ${token}` } : {},
                    })
                    if (!res.ok) throw new Error('Error al solicitar backup')
                    setBackupMsg({ type: 'info', text: 'Backup solicitado. El servicio lo creara en los proximos 60 segundos...' })
                    // Polling del status cada 3 segundos
                    let attempts = 0
                    const initialCount = autoBackups.length
                    const checkInterval = setInterval(async () => {
                      attempts++
                      try {
                        const statusRes = await fetch('/api/admin/backups/status', {
                          headers: token ? { Authorization: `Bearer ${token}` } : {},
                        })
                        if (statusRes.ok) {
                          const statusData = await statusRes.json()
                          if (statusData.status?.startsWith('error')) {
                            clearInterval(checkInterval)
                            setBackupMsg({ type: 'error', text: 'Error: ' + statusData.status })
                            setAutoBackupLoading(false)
                            loadAutoBackups()
                            return
                          }
                          if (statusData.status?.startsWith('done')) {
                            clearInterval(checkInterval)
                            setBackupMsg({ type: 'success', text: 'Backup creado correctamente.' })
                            setAutoBackupLoading(false)
                            loadAutoBackups()
                            return
                          }
                          if (statusData.status === 'creating') {
                            setBackupMsg({ type: 'info', text: 'Creando backup... exportando tablas de la base de datos.' })
                          }
                        }
                      } catch {}
                      // Tambien recargar la lista por si aparece
                      await loadAutoBackups()
                      if (autoBackups.length > initialCount) {
                        clearInterval(checkInterval)
                        setBackupMsg({ type: 'success', text: 'Backup creado correctamente.' })
                        setAutoBackupLoading(false)
                      }
                      if (attempts > 20) {
                        clearInterval(checkInterval)
                        setBackupMsg({ type: 'info', text: 'El backup sigue en proceso. Recarga en unos minutos para verlo.' })
                        setAutoBackupLoading(false)
                      }
                    }, 3000)
                  } catch (err) {
                    setBackupMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error al crear backup' })
                    setAutoBackupLoading(false)
                  }
                }}
                disabled={autoBackupLoading}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={16} />
                {autoBackupLoading ? 'Procesando...' : 'Crear Backup Ahora'}
              </button>
              {backupMsg && (
                <div className={`text-xs p-2 rounded-lg flex items-center gap-2 ${
                  backupMsg.type === 'success' ? 'bg-green-50 text-green-700' :
                  backupMsg.type === 'error' ? 'bg-red-50 text-red-700' :
                  'bg-blue-50 text-blue-700'
                }`}>
                  {backupMsg.type === 'success' && <RefreshCw size={14} />}
                  {backupMsg.type === 'error' && <AlertTriangle size={14} />}
                  {backupMsg.type === 'info' && <RefreshCw size={14} className="animate-spin" />}
                  {backupMsg.text}
                </div>
              )}
            </div>

            {/* Lista de backups automaticos */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Backups guardados en el servidor:</h4>
              {autoBackups.length === 0 ? (
                <p className="text-xs text-gray-500">No hay backups automaticos todavia.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {autoBackups.map((b: any) => (
                    <div key={b.filename} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg text-sm">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText size={16} className="text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="font-mono text-xs truncate">{b.filename}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(b.created_at).toLocaleString()} - {(b.size_bytes / 1024).toFixed(1)} KB
                            {b.is_locked && <span className="ml-2 text-amber-600 font-medium">Bloqueado</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a
                          href={`/api/admin/backups/${encodeURIComponent(b.filename)}/download`}
                          onClick={(e) => {
                            e.preventDefault()
                            const token = localStorage.getItem('fmc_token')
                            fetch(`/api/admin/backups/${encodeURIComponent(b.filename)}/download`, {
                              headers: token ? { Authorization: `Bearer ${token}` } : {},
                            }).then(res => res.blob()).then(blob => {
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = b.filename
                              document.body.appendChild(a)
                              a.click()
                              document.body.removeChild(a)
                              URL.revokeObjectURL(url)
                            })
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                          title="Descargar"
                        >
                          <Download size={14} />
                        </a>
                        <button
                          onClick={async () => {
                            const token = localStorage.getItem('fmc_token')
                            await fetch(`/api/admin/backups/${encodeURIComponent(b.filename)}/lock`, {
                              method: 'PUT',
                              headers: token ? { Authorization: `Bearer ${token}` } : {},
                            })
                            loadAutoBackups()
                          }}
                          className="p-1.5 text-amber-600 hover:bg-amber-100 rounded"
                          title={b.is_locked ? 'Desbloquear' : 'Bloquear (no se borrara automaticamente)'}
                        >
                          {b.is_locked ? <Unlock size={14} /> : <Lock size={14} />}
                        </button>
                        {!b.is_locked && (
                          <button
                            onClick={() => {
                              setConfirmModal({
                                open: true,
                                text: 'Borrar este backup? Esta accion no se puede deshacer.',
                                action: async () => {
                                  const token = localStorage.getItem('fmc_token')
                                  await fetch(`/api/admin/backups/${encodeURIComponent(b.filename)}`, {
                                    method: 'DELETE',
                                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                                  })
                                  loadAutoBackups()
                                }
                              })
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-100 rounded"
                            title="Borrar"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
            </>
          )}
        </div>
      )}

      {/* ===== BASE DE DATOS / NODOS YUGABYTE ===== */}
      {tab === 'database' && canManage && (
        <div className="card space-y-6">
          <h2 className="font-semibold flex items-center gap-2"><HardDrive size={18} />Base de Datos</h2>

          {/* Monitoreo del cluster YugabyteDB */}
          {clusterStatus && (
            <div className={`p-4 rounded-lg border-2 ${
              clusterStatus.alert_level === 'ok' ? 'border-green-300 bg-green-50' :
              clusterStatus.alert_level === 'warning' ? 'border-amber-300 bg-amber-50' :
              'border-red-300 bg-red-50'
            }`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {clusterStatus.alert_level === 'ok' ? (
                    <CheckCircle size={20} className="text-green-600" />
                  ) : (
                    <AlertTriangle size={20} className={clusterStatus.alert_level === 'critical' ? 'text-red-600' : 'text-amber-600'} />
                  )}
                  <h3 className="font-semibold">
                    {clusterStatus.alert_level === 'ok' && 'Cluster en buen estado'}
                    {clusterStatus.alert_level === 'warning' && 'Cluster necesita atencion'}
                    {clusterStatus.alert_level === 'critical' && 'Cluster necesita nodos urgentemente'}
                  </h3>
                </div>
                <button
                  onClick={checkCluster}
                  disabled={clusterChecking}
                  className="px-3 py-1.5 bg-trueque-600 text-white rounded-lg text-xs flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw size={12} className={clusterChecking ? 'animate-spin' : ''} />
                  Verificar
                </button>
              </div>

              {clusterStatus.alert_message && (
                <p className="text-sm mb-3">{clusterStatus.alert_message}</p>
              )}

              {/* Metricas */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-white p-2 rounded-lg">
                  <div className="text-lg font-bold">{clusterStatus.current_nodes}</div>
                  <div className="text-xs text-gray-500">Nodos activos</div>
                  <div className="text-xs text-gray-400">Min: {clusterStatus.min_nodes}</div>
                </div>
                <div className="bg-white p-2 rounded-lg">
                  <div className="text-lg font-bold">{clusterStatus.tablets_used}</div>
                  <div className="text-xs text-gray-500">Tabletas</div>
                  <div className="text-xs text-gray-400">de {clusterStatus.tablet_limit_total}</div>
                </div>
                <div className="bg-white p-2 rounded-lg">
                  <div className="text-lg font-bold">{clusterStatus.tablet_usage_pct?.toFixed(1)}%</div>
                  <div className="text-xs text-gray-500">Uso</div>
                  <div className="text-xs text-gray-400">Alerta: {clusterStatus.alert_threshold}%</div>
                </div>
                <div className={`p-2 rounded-lg ${clusterStatus.nodes_needed > 0 ? 'bg-red-100' : 'bg-white'}`}>
                  <div className="text-lg font-bold">{clusterStatus.nodes_needed}</div>
                  <div className="text-xs text-gray-500">Nodos necesarios</div>
                  <div className="text-xs text-gray-400">{clusterStatus.nodes_needed > 0 ? 'Agregar' : 'OK'}</div>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      clusterStatus.tablet_usage_pct >= 90 ? 'bg-red-600' :
                      clusterStatus.tablet_usage_pct >= clusterStatus.alert_threshold ? 'bg-amber-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(clusterStatus.tablet_usage_pct || 0, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{clusterStatus.tablets_used} tabletas</span>
                  <span>{clusterStatus.tablet_limit_total} total ({clusterStatus.tablet_limit_per_node} por nodo)</span>
                </div>
              </div>

              {/* Como agregar un nodo */}
              {clusterStatus.needs_more_nodes && (
                <div className="mt-3 p-3 bg-white rounded-lg text-sm">
                  <strong className="text-blue-700">Como agregar un nodo:</strong>
                  <div className="mt-2 grid md:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-blue-50 rounded">
                      <strong>Mismo servidor (desarrollo):</strong>
                      <p className="mt-1">Agrega un servicio en docker-compose.yml copiando yugabytedb2 con hostname y puertos diferentes.</p>
                    </div>
                    <div className="p-2 bg-blue-50 rounded">
                      <strong>Servidor separado (produccion):</strong>
                      <p className="mt-1">Instala YugabyteDB en otro servidor y unelo con --join=IP_DEL_NODO1. Cada servidor agrega ~534 tabletas.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Configuracion del cluster YugabyteDB */}
          {hardwareInfo && (
            <div className="card p-4 space-y-4 border-2 border-blue-200">
              <h3 className="font-semibold flex items-center gap-2">
                <Database size={18} className="text-blue-600" />
                Configuracion del Cluster
              </h3>

              {/* Info del hardware */}
              <div className={`p-3 rounded-lg text-sm ${hardwareInfo.needs_more_servers ? 'bg-red-50 border border-red-300' : 'bg-blue-50'}`}>
                <div className="flex items-center gap-4 mb-2">
                  <div><strong>RAM:</strong> {hardwareInfo.ram_gb} GB</div>
                  <div><strong>CPU:</strong> {hardwareInfo.cpu_cores} cores</div>
                </div>
                <p className={`text-xs ${hardwareInfo.needs_more_servers ? 'text-red-700' : 'text-blue-700'}`}>{hardwareInfo.recommendation}</p>
                <div className="mt-2 text-xs">
                  <strong>Recomendacion:</strong> Modo <strong>{hardwareInfo.recommended_mode === 'single' ? '1 nodo' : 'multi-nodo'}</strong>
                  con limite <strong>{hardwareInfo.recommended_limit}</strong> tabletas
                  y <strong>{hardwareInfo.recommended_mem_pct}%</strong> de memoria para DocDB.
                </div>
                {hardwareInfo.needs_more_servers && (
                  <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-800">
                    <strong>Hardware insuficiente.</strong> Tu servidor tiene {hardwareInfo.ram_gb}GB RAM.
                    Necesitas {hardwareInfo.servers_needed} servidor(es) adicional(es) con minimo 8GB RAM
                    (idealmente 16GB) para instalar YugabyteDB en modo multi-nodo.
                  </div>
                )}
              </div>

              {/* Formulario de configuracion */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Modo del cluster</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setClusterForm({ ...clusterForm, mode: 'single' })}
                      className={`p-3 rounded-lg border-2 text-left ${clusterForm.mode === 'single' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                    >
                      <div className="font-medium text-sm">1 Nodo (limite alto)</div>
                      <div className="text-xs text-gray-500">Un solo servidor. Mas eficiente. Sube el limite de tabletas.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setClusterForm({ ...clusterForm, mode: 'multi' })}
                      className={`p-3 rounded-lg border-2 text-left ${clusterForm.mode === 'multi' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}
                    >
                      <div className="font-medium text-sm">Multi-nodo (servidores separados)</div>
                      <div className="text-xs text-gray-500">Varios servidores. Alta disponibilidad. Cada nodo en un servidor distinto.</div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Limite de tabletas</label>
                    <input
                      type="number"
                      className="input"
                      value={clusterForm.tablet_limit}
                      min={100}
                      max={hardwareInfo.ram_gb * 100}
                      onChange={(e) => setClusterForm({ ...clusterForm, tablet_limit: parseInt(e.target.value) || 100 })}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Maximo recomendado para {hardwareInfo.ram_gb}GB: {hardwareInfo.ram_gb * 100}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Minimo de nodos</label>
                    <input
                      type="number"
                      className="input"
                      value={clusterForm.min_nodes}
                      min={1}
                      max={10}
                      onChange={(e) => setClusterForm({ ...clusterForm, min_nodes: parseInt(e.target.value) || 1 })}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      {clusterForm.mode === 'single' ? 'En modo 1 nodo, el minimo es 1' : 'En modo multi-nodo, minimo 2 (o 3 para alta disponibilidad)'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Umbral de alerta (%)</label>
                    <input
                      type="number"
                      className="input"
                      value={clusterForm.alert_threshold}
                      min={50}
                      max={95}
                      onChange={(e) => setClusterForm({ ...clusterForm, alert_threshold: parseInt(e.target.value) || 80 })}
                    />
                    <p className="text-xs text-gray-400 mt-1">Alertar cuando el uso de tabletas llegue a este %</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">RAM del servidor (GB)</label>
                    <input
                      type="number"
                      className="input"
                      value={clusterForm.server_ram_gb}
                      min={1}
                      onChange={(e) => setClusterForm({ ...clusterForm, server_ram_gb: parseInt(e.target.value) || 16 })}
                    />
                    <p className="text-xs text-gray-400 mt-1">RAM detectada: {hardwareInfo.ram_gb}GB</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Memoria para DocDB (%)</label>
                  <input
                    type="number"
                    className="input"
                    value={clusterForm.memstore_percentage}
                    min={5}
                    max={85}
                    onChange={(e) => setClusterForm({ ...clusterForm, memstore_percentage: parseInt(e.target.value) || 10 })}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Porcentaje de RAM para escritura de YugabyteDB (global_memstore_size_percentage).
                    Recomendado: {hardwareInfo.recommended_mem_pct}% = {(clusterForm.server_ram_gb * clusterForm.memstore_percentage / 100).toFixed(1)}GB de {clusterForm.server_ram_gb}GB.
                    El resto ({(clusterForm.server_ram_gb * (100 - clusterForm.memstore_percentage) / 100).toFixed(1)}GB) queda para el backend, frontend y el OS.
                  </p>
                </div>

                {/* Nodos del cluster */}
                <div>
                  <label className="block text-sm font-medium mb-1">Nodos del cluster</label>
                  <div className="space-y-2">
                    {clusterForm.nodes.map((n, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                        <Server size={14} className="text-gray-400" />
                        <input
                          type="text"
                          className="input flex-1 text-sm"
                          placeholder="hostname o IP"
                          value={n.host}
                          onChange={(e) => {
                            const nodes = [...clusterForm.nodes]
                            nodes[i] = { ...nodes[i], host: e.target.value }
                            setClusterForm({ ...clusterForm, nodes })
                          }}
                        />
                        <input
                          type="number"
                          className="input w-20 text-sm"
                          placeholder="puerto"
                          value={n.port}
                          onChange={(e) => {
                            const nodes = [...clusterForm.nodes]
                            nodes[i] = { ...nodes[i], port: parseInt(e.target.value) || 5433 }
                            setClusterForm({ ...clusterForm, nodes })
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setClusterForm({ ...clusterForm, nodes: clusterForm.nodes.filter((_, idx) => idx !== i) })}
                          className="text-red-500 text-xs"
                          disabled={clusterForm.nodes.length <= 1}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setClusterForm({ ...clusterForm, nodes: [...clusterForm.nodes, { host: '', port: 5433, is_local: false }] })}
                      className="text-blue-600 text-xs flex items-center gap-1"
                    >
                      <Plus size={12} /> Agregar nodo
                    </button>
                  </div>
                </div>

                {/* Aviso de reinicio */}
                <div className="bg-amber-50 p-3 rounded-lg text-xs text-amber-700">
                  <strong>Importante:</strong> Después de guardar, debes reiniciar YugabyteDB
                  para que los cambios surtan efecto. El flag <code className="bg-white px-1 rounded">--tserver_flags=max_num_tablets=VALOR</code>
                  {' '}se aplica al reiniciar el contenedor.
                </div>

                <button
                  onClick={saveClusterConfig}
                  disabled={clusterSaving}
                  className="px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {clusterSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Guardar configuracion
                </button>
              </div>
            </div>
          )}

          {isDemoNode && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-800">
              <strong>⚠️ Vista de Demostración:</strong> Esta pestaña es solo lectura en el nodo demo.
              No se pueden modificar nodos de base de datos ni descargar scripts en modo demostración.
            </div>
          )}

          {isDemoNode ? (
            <div className="text-center text-gray-400 py-8">
              <HardDrive size={48} className="mx-auto mb-3 opacity-30" />
              <p>Las funciones de base de datos están deshabilitadas en el nodo demo.</p>
            </div>
          ) : (
        <div>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
            <h3 className="font-medium flex items-center gap-2"><HelpCircle size={16} />Que son los nodos YugabyteDB?</h3>
            <p>YugabyteDB puede correr en multiples servidores al mismo tiempo. Los datos se replican entre todos los nodos.</p>
            <p>Si un servidor se cae, los otros nodos siguen funcionando y tus datos estan seguros.</p>
            <p><strong>Como funciona:</strong> Agregas un nodo desde aqui, descargas el script de instalacion, lo copias al otro servidor y lo ejecutas. El nuevo nodo se une al cluster automaticamente.</p>
          </div>

          {/* Lista de nodos existentes */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm">Nodos YugabyteDB del cluster:</h3>
            {ybNodes.length === 0 ? (
              <p className="text-xs text-gray-500">No hay nodos adicionales configurados. Solo estas usando el nodo principal.</p>
            ) : (
              <div className="space-y-2">
                {ybNodes.map((n: any) => (
                  <div key={n.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      <Server size={16} className="text-gray-400" />
                      <div>
                        <div className="font-medium">{n.node_name}</div>
                        <div className="text-xs text-gray-500">
                          {n.host_ip}:{n.port} - {n.region || 'sin region'} - {n.status}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const token = localStorage.getItem('fmc_token')
                          fetch(`/api/admin/yb-nodes/${n.id}/script`, {
                            headers: token ? { Authorization: `Bearer ${token}` } : {},
                          }).then(res => res.blob()).then(blob => {
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `install_yugabyte_${n.node_name}.sh`
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            URL.revokeObjectURL(url)
                          })
                        }}
                        className="btn-primary text-xs flex items-center gap-1"
                      >
                        <Download size={12} /> Script
                      </button>
                      <button
                        onClick={() => {
                          setConfirmModal({
                            open: true,
                            text: 'Eliminar este nodo de la lista? Esto no detiene el nodo en el servidor remoto.',
                            action: async () => {
                              const token = localStorage.getItem('fmc_token')
                              await fetch(`/api/admin/yb-nodes/${n.id}`, {
                                method: 'DELETE',
                                headers: token ? { Authorization: `Bearer ${token}` } : {},
                              })
                              loadYbNodes()
                            }
                          })
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Formulario para agregar nodo */}
          <div className="card bg-gray-50 space-y-3">
            <h3 className="font-medium text-sm flex items-center gap-2"><Plus size={16} />Agregar nuevo nodo YugabyteDB</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label flex items-center gap-1">
                  Nombre del nodo
                  <HelpCircle size={12} className="text-gray-400" title="Nombre identificatorio. Ej: nodo-backup-1, nodo-caracas, etc." />
                </label>
                <input
                  type="text"
                  value={ybNodeForm.node_name}
                  onChange={(e) => setYbNodeForm({ ...ybNodeForm, node_name: e.target.value })}
                  className="input"
                  placeholder="nodo-caracas"
                />
              </div>
              <div>
                <label className="label flex items-center gap-1">
                  IP del servidor remoto
                  <HelpCircle size={12} className="text-gray-400" title="Direccion IP del servidor donde se instalara el nodo. Ej: 192.168.1.100" />
                </label>
                <input
                  type="text"
                  value={ybNodeForm.host_ip}
                  onChange={(e) => setYbNodeForm({ ...ybNodeForm, host_ip: e.target.value })}
                  className="input"
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <label className="label flex items-center gap-1">
                  Puerto
                  <HelpCircle size={12} className="text-gray-400" title="Puerto para comunicacion entre nodos. Por defecto 7100." />
                </label>
                <input
                  type="number"
                  value={ybNodeForm.port}
                  onChange={(e) => setYbNodeForm({ ...ybNodeForm, port: parseInt(e.target.value) || 7100 })}
                  className="input"
                />
              </div>
              <div>
                <label className="label flex items-center gap-1">
                  Region
                  <HelpCircle size={12} className="text-gray-400" title="Region geografica. Ej: caracas, maracay, valencia. Opcional." />
                </label>
                <input
                  type="text"
                  value={ybNodeForm.region}
                  onChange={(e) => setYbNodeForm({ ...ybNodeForm, region: e.target.value })}
                  className="input"
                  placeholder="caracas"
                />
              </div>
            </div>
            <button
              onClick={async () => {
                if (!ybNodeForm.node_name || !ybNodeForm.host_ip) {
                  setError('Nombre e IP son obligatorios')
                  return
                }
                setYbLoading(true)
                setError(''); setSuccess('')
                try {
                  const token = localStorage.getItem('fmc_token')
                  const res = await fetch('/api/admin/yb-nodes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                    body: JSON.stringify(ybNodeForm),
                  })
                  if (!res.ok) throw new Error('Error al crear nodo')
                  setSuccess('Nodo creado. Descarga el script y ejecutalo en el servidor remoto.')
                  setYbNodeForm({ node_name: '', host_ip: '', port: 7100, region: '' })
                  loadYbNodes()
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Error al crear nodo')
                } finally {
                  setYbLoading(false)
                }
              }}
              disabled={ybLoading}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} />
              {ybLoading ? 'Creando...' : 'Crear Nodo'}
            </button>
          </div>

          {/* Instrucciones */}
          <div className="card bg-amber-50 border-amber-200 text-sm space-y-2">
            <h3 className="font-medium flex items-center gap-2"><HelpCircle size={16} />Instrucciones de uso</h3>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Agrega un nuevo nodo con el formulario de arriba.</li>
              <li>Descarga el script de instalacion (boton "Script").</li>
              <li>Copia el archivo <code>.sh</code> al servidor remoto (USB, scp, etc).</li>
              <li>En el servidor remoto, ejecuta: <code>chmod +x install_yugabyte_*.sh</code></li>
              <li>Ejecuta: <code>sudo ./install_yugabyte_*.sh</code></li>
              <li>El nodo se unira al cluster automaticamente y los datos se replicaran.</li>
              <li>Asegurate de que los puertos 7100, 9100, 5433, 7000 esten abiertos en ambos servidores.</li>
            </ol>
          </div>
        </div>
          )}
        </div>
      )}

      {/* ===== NODO DEMO ===== */}
      {tab === 'demo' && canManage && (
        <div className="card space-y-6">
          <h2 className="font-semibold flex items-center gap-2"><Globe size={18} />Nodo Demo</h2>

          {isDemoNode && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-800">
              <strong>⚠️ Vista de Demostración:</strong> Esta pestaña es solo lectura en el nodo demo.
              No se puede reiniciar ni configurar el nodo demo desde aquí en modo demostración.
            </div>
          )}

          {isDemoNode ? (
            <div className="text-center text-gray-400 py-8">
              <Globe size={48} className="mx-auto mb-3 opacity-30" />
              <p>Las funciones del nodo demo están deshabilitadas cuando estás dentro del nodo demo.</p>
              <p className="text-xs mt-2">Para gestionar el nodo demo, usa el nodo principal en http://localhost:8080</p>
            </div>
          ) : (
        <div>
          <div className="card bg-emerald-50 border-emerald-200 space-y-3">
            <h3 className="font-medium text-sm flex items-center gap-2"><Globe size={16} />Que es el Nodo Demo?</h3>
            <p className="text-xs text-gray-600">
              El nodo demo es un nodo paralelo que se instala y actualiza automaticamente con el nodo principal.
              Tiene su propia base de datos separada y NO toca los datos del nodo principal.
              Esta disenado para que personas externas puedan probar el sistema sin afectar nada.
              Los datos se reinician cada 24 horas automaticamente.
            </p>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Puerto:</strong> 9091 (API) / 9044 (Federacion)</p>
              <p><strong>Base de datos:</strong> fmc_demo (separada de fmc_node)</p>
              <p><strong>URL:</strong> https://[dominio]/demo</p>
              <p><strong>Reset automatico:</strong> Cada 24 horas</p>
            </div>
          </div>

          <div className="card bg-amber-50 border-amber-200 space-y-3">
            <h3 className="font-medium text-sm flex items-center gap-2"><RefreshCw size={16} />Resetear Nodo Demo</h3>
            <p className="text-xs text-gray-600">
              Puedes resetear el nodo demo manualmente cuando quieras. Esto borrara todos los datos demo
              y los recreara desde cero. Util cuando hay actualizaciones del sistema y quieres que el
              nodo demo refleje los cambios inmediatamente.
            </p>
            <button
              onClick={() => {
                setConfirmModal({
                  open: true,
                  text: 'Seguro que quieres resetear el nodo demo? Se borraran todos los datos demo y se recrearan.',
                  action: async () => {
                    setDemoResetting(true)
                    setDemoMsg(null)
                    try {
                      await api.post('/admin/demo/reset', {})
                      setDemoMsg({ type: 'success', text: 'Nodo demo reiniciado. Los datos se estan recreando.' })
                    } catch (e: any) {
                      setDemoMsg({ type: 'error', text: e?.message || 'Error al resetear nodo demo' })
                    } finally {
                      setDemoResetting(false)
                    }
                  }
                })
              }}
              disabled={demoResetting}
              className="btn-primary flex items-center gap-2"
            >
              <RefreshCw size={16} className={demoResetting ? 'animate-spin' : ''} />
              {demoResetting ? 'Reiniciando...' : 'Resetear Nodo Demo'}
            </button>
            {demoMsg && (
              <div className={`text-xs p-2 rounded-lg flex items-center gap-2 ${
                demoMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {demoMsg.type === 'success' ? <RefreshCw size={14} /> : <AlertTriangle size={14} />}
                {demoMsg.text}
              </div>
            )}
          </div>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
            <h3 className="font-medium flex items-center gap-2"><HelpCircle size={16} />Como funciona el login demo</h3>
            <p>El nodo demo no usa usuario/contrasena normal. En su lugar, muestra botones con los roles disponibles:</p>
            <ul className="list-disc list-inside text-xs space-y-1 ml-2">
              <li>Super Admin - acceso total</li>
              <li>Junta Directiva - presidente, vicepresidente, tesorero, secretario, vocales</li>
              <li>Organizaciones - cooperativa, panaderia, taller, tienda, centro de salud</li>
              <li>Miembros - agricultores, productores, artesanos, miembro nuevo</li>
            </ul>
            <p className="text-xs">Cada boton entra directamente con ese rol. Password: demo1234 para todos.</p>
          </div>
        </div>
          )}
        </div>
      )}

      {/* Modal de confirmacion interno (no usa confirm() de Windows) */}
      {confirmModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setConfirmModal({ ...confirmModal, open: false })}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={24} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700">{confirmModal.text}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmModal({ ...confirmModal, open: false })}
                className="px-4 py-2 text-sm bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setConfirmModal({ ...confirmModal, open: false })
                  await confirmModal.action()
                }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ===== Componente: Actualizar nodo =====
function NodeUpdateSection({ canManage }: { canManage: boolean }) {
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [updateStatus, setUpdateStatus] = useState<any>(null)
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [pollInterval, setPollInterval] = useState<any>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const checkUpdates = async () => {
    setChecking(true)
    try {
      const res: any = await api.get('/node/check-updates')
      setUpdateInfo(res)
    } catch (e: any) {
      setMsg({ type: 'error', text: 'Error al verificar actualizaciones' })
    } finally {
      setChecking(false)
    }
  }

  const updateNode = async () => {
    setShowConfirm(false)
    setUpdating(true)
    setMsg(null)
    try {
      await api.post('/node/update', {})
      setMsg({ type: 'info', text: 'Actualizacion iniciada. El nodo se reiniciara automaticamente.' })
      const interval = setInterval(async () => {
        try {
          const res: any = await api.get('/node/update-status')
          setUpdateStatus(res)
          if (res.status === 'completed') {
            clearInterval(interval)
            setUpdating(false)
            setMsg({ type: 'success', text: 'Nodo actualizado correctamente. La pagina se recargara...' })
            setTimeout(() => window.location.reload(), 3000)
          } else if (res.status === 'error') {
            clearInterval(interval)
            setUpdating(false)
            setMsg({ type: 'error', text: res.message || 'Error en la actualizacion' })
          }
        } catch {
          // El nodo se esta reiniciando, es normal que falle
        }
      }, 3000)
      setPollInterval(interval)
    } catch (e: any) {
      setUpdating(false)
      setMsg({ type: 'error', text: 'Error al iniciar la actualizacion' })
    }
  }

  useEffect(() => {
    return () => { if (pollInterval) clearInterval(pollInterval) }
  }, [pollInterval])

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
      <h3 className="font-medium text-green-700 flex items-center gap-2 mb-2">
        <RefreshCw size={16} /> Actualizar Nodo
      </h3>
      <p className="text-sm text-green-600 mb-3">
        Verifica si hay una version nueva del nodo en el repositorio y actualiza con un clic.
        Se descarga el codigo, se reconstruye la imagen Docker y se reinicia el nodo.
      </p>

      {msg && (
        <div className={`p-3 rounded-lg text-sm mb-3 ${
          msg.type === 'success' ? 'bg-green-100 text-green-700' :
          msg.type === 'error' ? 'bg-red-100 text-red-700' :
          'bg-blue-100 text-blue-700'
        }`}>
          {msg.text}
        </div>
      )}

      {updateInfo && (
        <div className="bg-white rounded-lg p-3 border border-green-100 mb-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Commit actual:</span>
            <code className="font-mono text-xs">{updateInfo.current_commit || 'desconocido'}</code>
          </div>
          {updateInfo.updates_available && (
            <div className="mt-2">
              <div className="text-green-700 font-medium mb-1">Actualizacion disponible!</div>
              <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-32 overflow-auto">{updateInfo.new_commits}</pre>
            </div>
          )}
          {!updateInfo.updates_available && (
            <div className="mt-2 text-gray-500">El nodo esta actualizado.</div>
          )}
          {updateInfo.error && (
            <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-700 text-xs">
              <strong>Aviso:</strong> {updateInfo.message || 'No se pudo verificar el repositorio remoto.'}
              {updateInfo.error === 'no_git' && ' (no se encontro .git en /project)'}
              {updateInfo.error === 'fetch_failed' && ' (git fetch fallo - revisa GIT_TOKEN en .env)'}
              {updateInfo.fetch_error && (
                <pre className="mt-1 text-xs bg-gray-100 p-1 rounded max-h-20 overflow-auto whitespace-pre-wrap">{updateInfo.fetch_error}</pre>
              )}
            </div>
          )}
        </div>
      )}

      {updateStatus && (updateStatus.status === 'running' || updateStatus.status === 'error' || updateStatus.status === 'completed') && (
        <div className={`bg-white rounded-lg p-3 border mb-3 ${
          updateStatus.status === 'running' ? 'border-blue-100' :
          updateStatus.status === 'error' ? 'border-red-100' :
          'border-green-100'
        }`}>
          <div className={`flex items-center gap-2 text-sm mb-2 ${
            updateStatus.status === 'running' ? 'text-blue-600' :
            updateStatus.status === 'error' ? 'text-red-600' :
            'text-green-600'
          }`}>
            {updateStatus.status === 'running' && <RefreshCw size={14} className="animate-spin" />}
            {updateStatus.status === 'error' && <AlertTriangle size={14} />}
            {updateStatus.status === 'completed' && <CheckCircle size={14} />}
            {updateStatus.message}
          </div>
          {updateStatus.log && (
            <pre className="text-xs text-gray-600 bg-gray-900 text-gray-100 p-3 rounded max-h-60 overflow-auto whitespace-pre-wrap font-mono">{updateStatus.log}</pre>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {canManage && (
          <>
            <button
              onClick={checkUpdates}
              disabled={checking}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {checking ? <><RefreshCw size={16} className="animate-spin" /> Verificando...</> : <><RefreshCw size={16} /> Verificar actualizaciones</>}
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={updating || !canManage}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {updating ? <><RefreshCw size={16} className="animate-spin" /> Actualizando...</> : <><Download size={16} /> Actualizar nodo</>}
            </button>
          </>
        )}
        {!canManage && (
          <p className="text-xs text-amber-600">No tienes permiso para actualizar el nodo.</p>
        )}
      </div>

      {/* Modal de confirmacion */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle size={24} className="text-amber-600" />
              </div>
              <h3 className="text-lg font-bold">Actualizar Nodo</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Se descargara la ultima version del repositorio, se reconstruira la imagen Docker
              y se reiniciara el nodo. Esto puede tardar varios minutos.
              Durante la actualizacion el nodo no estara disponible.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={updateNode}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm flex items-center gap-2"
              >
                <Download size={16} /> Si, actualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

