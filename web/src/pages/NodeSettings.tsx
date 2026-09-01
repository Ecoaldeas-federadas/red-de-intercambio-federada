import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, getStorageKeys } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { HelpCircle, Settings, DollarSign, Layers, Zap, Save, Plus, Edit, Building2, Users as UsersIcon, Vote as VoteIcon, Database, Download, Upload, AlertTriangle, RefreshCw, Globe, Lock, Unlock, Trash2, FileText, Server, HardDrive, CheckCircle, Info, X, Power, Play, Square, Sparkles, Clock, Shield, Scale, Flower, Sprout } from 'lucide-react'
import { fmtTQ, toCents, fmtDate, fmtDateTime, fmtNumber } from '../lib/format'

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
  const [tab, setTab] = useState<'general' | 'levels' | 'org_levels' | 'tariff' | 'commerce' | 'orgs' | 'work' | 'seeds' | 'cayapa' | 'cards' | 'frne' | 'biodynamic' | 'pages' | 'backup' | 'database' | 'demo'>(initialTab)
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
    if (newTab === 'cards') {
      api.get<any>('/nfc/card-type/config').then((cfg: any) => setCardTypeCfg(cfg)).catch(() => {})
    }
  }
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [demoResetting, setDemoResetting] = useState(false)
  const [demoPresets, setDemoPresets] = useState<any[]>([])
  const [demoPresetSel, setDemoPresetSel] = useState('gen_ecoaldea')
  const [demoPresetsLoading, setDemoPresetsLoading] = useState(false)

  // Community work
  const [workSessions, setWorkSessions] = useState<any[]>([])
  const [workSessionsLoading, setWorkSessionsLoading] = useState(false)
  const [newSession, setNewSession] = useState({ name: '', work_type: 'cayapa', session_date: '', valuation_type: 'hours_only', description: '' })
  const [workMsg, setWorkMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Organization profiles (reglas por organizacion)
  const [orgProfiles, setOrgProfiles] = useState<any[]>([])
  const [orgProfilesLoading, setOrgProfilesLoading] = useState(false)
  const [orgMsg, setOrgMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Perfil del nodo (religion/filosofia del nodo completo)
  const [nodeFaithProfile, setNodeFaithProfile] = useState('')
  const [nodeFaithDescription, setNodeFaithDescription] = useState('')
  const [faithProfiles] = useState([
    { id: 'adventista', name: 'Adventista', rules: 'Sin alcohol, tabaco, cerdo, cafe' },
    { id: 'iskcon', name: 'ISKCON', rules: 'Sin carne, huevo, ajo, cebolla, cafe, alcohol' },
    { id: 'plum_village', name: 'Plum Village', rules: 'Sin carne, pescado, alcohol' },
    { id: 'halal', name: 'Halal Islamico', rules: 'Sin alcohol, cerdo, carne no-halal' },
    { id: 'kosher', name: 'Kosher Judio', rules: 'Sin cerdo, mariscos, mezcla carne+leche' },
    { id: 'jain', name: 'Jain', rules: 'Sin carne, huevo, raices, ajo, cebolla' },
    { id: 'vegano', name: 'Vegano secular', rules: 'Sin carne, lacteos, huevos, miel' },
    { id: 'ital', name: 'Ital Rastafari', rules: 'Sin carne, sal, quimicos procesados' },
  ])

  // Horarios de comercio
  const [commerceSchedules, setCommerceSchedules] = useState<any[]>([])
  const [commerceSchedulesLoading, setCommerceSchedulesLoading] = useState(false)
  const [commerceHoursEnabled, setCommerceHoursEnabled] = useState(false)
  const [commerceHoursMessage, setCommerceHoursMessage] = useState('')
  const [newSchedule, setNewSchedule] = useState({ day_of_week: '', end_day_of_week: '', start_time: '', end_time: '', crosses_midnight: false, reason: '' })
  const [scheduleMsg, setScheduleMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // FRNE (Salida Justa)
  const [frneRequests, setFrneRequests] = useState<any[]>([])
  const [frneLoading, setFrneLoading] = useState(false)
  const [frneMsg, setFrneMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Biodinamica
  const [bioConfig, setBioConfig] = useState<any>(null)
  const [bioEntries, setBioEntries] = useState<any[]>([])
  const [bioLoading, setBioLoading] = useState(false)
  const [bioMsg, setBioMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Public pages toggle
  const [pageSettings, setPageSettings] = useState<any>(null)
  const [pageSettingsLoading, setPageSettingsLoading] = useState(false)
  const [pageMsg, setPageMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Banco de semillas
  const [seedLoans, setSeedLoans] = useState<any[]>([])
  const [seedLoansLoading, setSeedLoansLoading] = useState(false)
  const [seedMsg, setSeedMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [newSeedLoan, setNewSeedLoan] = useState({ seed_name: '', quantity_borrowed: 0, unit: 'sobres', return_percentage: 20, due_date: '', notes: '' })

  // Cayapa attendance config
  const [attConfig, setAttConfig] = useState<any>(null)
  const [attConfigLoading, setAttConfigLoading] = useState(false)
  const [attMsg, setAttMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Card crypto
  const [cardCryptoMsg, setCardCryptoMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [newCard, setNewCard] = useState({ card_uid: '', user_id: '', card_type: 'desfire' })
  const [provisionedKey, setProvisionedKey] = useState<any>(null)
  const [cryptoStatus, setCryptoStatus] = useState<any>(null)
  const [statusUid, setStatusUid] = useState('')

  // Card type config (dual mode)
  const [cardTypeCfg, setCardTypeCfg] = useState<any>(null)
  const [cardTypeCfgLoading, setCardTypeCfgLoading] = useState(false)
  const [rotations, setRotations] = useState<any[]>([])
  const [rotationsUid, setRotationsUid] = useState('')

  // Backup
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoreResult, setRestoreResult] = useState<any>(null)

  // Mensajes locales junto a botones
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [configMsg, setConfigMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [tariffMsg, setTariffMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)
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
  const [tariff, setTariff] = useState<any>(null)
  const [tariffLoading, setTariffLoading] = useState(true)

  const load = () => {
    api.get('/config').then((d: any) => setConfig(d)).catch(() => {})
    api.get('/member-levels').then((d: any) => setLevels(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/organization-levels').then((d: any) => setOrgLevels(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/calculator/tariff').then((d: any) => { setTariff(d); setTariffLoading(false) }).catch(() => setTariffLoading(false))
  }

  useEffect(() => { load() }, [])

  // Cargar presets disponibles para el demo
  const loadDemoPresets = async () => {
    setDemoPresetsLoading(true)
    try {
      const res = await fetch('/api/presets')
      if (res.ok) {
        const data = await res.json()
        setDemoPresets(data.presets || [])
      }
    } catch (e) {
      // silencioso
    } finally {
      setDemoPresetsLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'backup') { loadAutoBackups(); loadBackupConfig() }
    if (tab === 'database') { loadYbNodes(); loadClusterStatus(); loadClusterConfig() }
    if (tab === 'orgs') { loadOrgProfiles() }
    if (tab === 'work') { loadWorkSessions() }
    if (tab === 'frne') { loadFrneRequests() }
    if (tab === 'biodynamic') { loadBioConfig() }
    if (tab === 'pages') { loadPageSettings() }
    if (tab === 'seeds') { loadSeedLoans() }
    if (tab === 'commerce') { loadCommerceSchedules() }
  }, [tab])

  // Cargar sesiones de trabajo comunitario
  const loadWorkSessions = async () => {
    setWorkSessionsLoading(true)
    try {
      const data = await api.get<{ sessions: any[] }>('/community-work/sessions')
      setWorkSessions(data.sessions || [])
    } catch (e) {
      // silencioso
    } finally {
      setWorkSessionsLoading(false)
    }
  }

  // Cargar perfiles de organizaciones
  const loadOrgProfiles = async () => {
    setOrgProfilesLoading(true)
    try {
      const data = await api.get<{ profiles: any[] }>('/organizations/profiles')
      setOrgProfiles(data.profiles || [])
    } catch (e) {
      // silencioso
    } finally {
      setOrgProfilesLoading(false)
    }
    // Cargar perfil del nodo
    try {
      const fp = await api.get<{ faith_profile: string, description: string }>('/node/faith-profile')
      setNodeFaithProfile(fp.faith_profile || '')
      setNodeFaithDescription(fp.description || '')
    } catch (e) {
      // silencioso
    }
  }

  // Cargar horarios de comercio
  const loadCommerceSchedules = async () => {
    setCommerceSchedulesLoading(true)
    try {
      const data = await api.get<{ schedules: any[], commerce_hours_enabled: boolean, commerce_hours_message: string }>('/node/commerce-schedule')
      setCommerceSchedules(data.schedules || [])
      setCommerceHoursEnabled(data.commerce_hours_enabled || false)
      setCommerceHoursMessage(data.commerce_hours_message || '')
    } catch (e) {
      // silencioso
    } finally {
      setCommerceSchedulesLoading(false)
    }
  }

  // Cargar solicitudes FRNE
  const loadFrneRequests = async () => {
    setFrneLoading(true)
    try {
      const data = await api.get<{ requests: any[] }>('/frne/requests')
      setFrneRequests(data.requests || [])
    } catch (e) {
      // silencioso
    } finally {
      setFrneLoading(false)
    }
  }

  // Cargar config biodinamica
  const loadBioConfig = async () => {
    setBioLoading(true)
    try {
      const [cfg, cal] = await Promise.all([
        api.get<any>('/biodynamic/config'),
        api.get<{ entries: any[] }>('/biodynamic/calendar'),
      ])
      setBioConfig(cfg)
      setBioEntries(cal.entries || [])
    } catch (e) {
      // silencioso
    } finally {
      setBioLoading(false)
    }
  }

  // Cargar settings de paginas publicas
  const loadPageSettings = async () => {
    setPageSettingsLoading(true)
    try {
      const data = await api.get<any>('/public-pages/settings')
      setPageSettings(data)
    } catch (e) {
      // silencioso
    } finally {
      setPageSettingsLoading(false)
    }
  }

  // Cargar prestamos de semillas
  const loadSeedLoans = async () => {
    setSeedLoansLoading(true)
    try {
      const data = await api.get<{ loans: any[] }>('/seeds/loans')
      setSeedLoans(data.loans || [])
    } catch (e) {
      // silencioso
    } finally {
      setSeedLoansLoading(false)
    }
  }

  // Cargar config de asistencia
  const loadAttConfig = async () => {
    setAttConfigLoading(true)
    try {
      const data = await api.get<any>('/attendance/config')
      setAttConfig(data)
    } catch (e) {
      // silencioso
    } finally {
      setAttConfigLoading(false)
    }
  }

  // Cargar backups automaticos y nodos YugabyteDB cuando se abren esos tabs
  const loadAutoBackups = async () => {
    try {
      const token = localStorage.getItem(getStorageKeys().tokenKey)
      const res = await fetch('/api/admin/backups', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) setAutoBackups(await res.json())
    } catch {}
  }

  const loadBackupConfig = async () => {
    try {
      const token = localStorage.getItem(getStorageKeys().tokenKey)
      const res = await fetch('/api/admin/backup-config', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) setBackupConfig(await res.json())
    } catch {}
  }

  const loadYbNodes = async () => {
    try {
      const token = localStorage.getItem(getStorageKeys().tokenKey)
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
    if (tab === 'catalog') { loadCatalogRules() }
    if (tab === 'orgs') { loadOrgProfiles() }
    if (tab === 'work') { loadWorkSessions() }
    if (tab === 'frne') { loadFrneRequests() }
    if (tab === 'biodynamic') { loadBioConfig() }
    if (tab === 'pages') { loadPageSettings() }
    if (tab === 'seeds') { loadSeedLoans() }
    if (tab === 'cayapa') { loadAttConfig() }
  }, [tab])

  // Verificar permisos de Asamblea para cada tipo de cambio
  const [permChecks, setPermChecks] = useState<Record<string, { can_direct: boolean, method: string, reason: string }>>({})

  const checkPermission = async (proposalType: string) => {
    try {
      const res: any = await api.get(`/assembly/check-permission/${proposalType}`)
      setPermChecks(prev => ({ ...prev, [proposalType]: res }))
      return res
    } catch {
      // Si falla, permitir por compatibilidad
      return { can_direct: true, method: 'legacy', reason: '' }
    }
  }

  useEffect(() => {
    // Verificar permisos para todos los tipos de cambio al cargar
    checkPermission('node_config')
    checkPermission('backup_config')
    checkPermission('cluster_config')
    checkPermission('energy_rate_change')
    checkPermission('member_level')
    checkPermission('org_level')
    checkPermission('tax_change')
  }, [])

  const saveConfig = async () => {
    setConfigMsg(null)
    const perm = permChecks['node_config']
    if (perm && !perm.can_direct) {
      // Necesita propuesta de Asamblea
      try {
        await api.post('/assembly/proposals', {
          proposal_type: 'node_config',
          title: `Cambiar configuracion del nodo: ${config.node_name}`,
          description: `Proponer cambiar la configuracion del nodo. Nombre: ${config.node_name}, Moneda: ${config.currency_name}, App: ${config.app_name}`,
          parameters: {
            node_name: config.node_name,
            currency_name: config.currency_name,
            currency_full_name: config.currency_full_name,
            app_name: config.app_name,
          },
        })
        setConfigMsg({ type: 'success', text: 'Propuesta enviada a la Asamblea. Los cambios se aplicaran cuando se apruebe.' })
      } catch (err) {
        setConfigMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error al crear propuesta' })
      }
      return
    }
    try {
      await api.put('/config', config)
      setConfigMsg({ type: 'success', text: 'Configuracion guardada' })
    } catch (err) {
      setConfigMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error' })
    }
  }

  const saveTariff = async () => {
    setTariffMsg(null)
    const perm = permChecks['energy_rate_change']
    if (perm && !perm.can_direct) {
      try {
        await api.post('/assembly/proposals', {
          proposal_type: 'energy_rate_change',
          title: `Cambiar tarifas energeticas`,
          description: `Proponer cambiar las tarifas energeticas del nodo. Esto afecta como se calcula el valor del trabajo en TQ.`,
          parameters: tariff,
        })
        setTariffMsg({ type: 'success', text: 'Propuesta enviada a la Asamblea. Las tarifas se aplicaran cuando se apruebe.' })
      } catch (err) {
        setTariffMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error al crear propuesta' })
      }
      return
    }
    try {
      await api.put('/calculator/tariff', tariff)
      setTariffMsg({ type: 'success', text: 'Tarifa energetica guardada' })
    } catch (err) {
      setTariffMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error' })
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
        <button onClick={() => changeTab('commerce')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'commerce' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Horarios</button>
        <button onClick={() => changeTab('orgs')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'orgs' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><Building2 size={14} className="inline mr-1" />Perfil del Nodo</button>
        <button onClick={() => changeTab('work')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'work' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Trabajo Comunitario</button>
        <button onClick={() => changeTab('seeds')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'seeds' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Banco Semillas</button>
        <button onClick={() => changeTab('cayapa')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'cayapa' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Asistencia Cayapa</button>
        <button onClick={() => changeTab('cards')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'cards' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Tarjetas Crypto</button>
        <button onClick={() => changeTab('frne')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'frne' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>FRNE</button>
        <button onClick={() => changeTab('biodynamic')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'biodynamic' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Biodinamica</button>
        <button onClick={() => changeTab('pages')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'pages' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Paginas Publicas</button>
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

          {isDemoNode && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 flex items-start gap-2">
              <Info size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <strong>Nodo Demo:</strong> Puedes modificar el nombre, la moneda y otros ajustes internos.
                El dominio esta bloqueado porque se hereda del nodo padre. Los cambios se reinician cada 24h.
              </div>
            </div>
          )}

          {canManage && (
            <>
              {permChecks['node_config'] && !permChecks['node_config'].can_direct && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 flex items-start gap-2 mb-3">
                  <VoteIcon size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Requiere aprobacion de Asamblea.</strong> {permChecks['node_config'].reason}
                    Al guardar se creara una propuesta para que la Asamblea decida.
                  </div>
                </div>
              )}
              {permChecks['node_config'] && permChecks['node_config'].can_direct && permChecks['node_config'].method !== 'legacy' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-start gap-2 mb-3">
                  <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Cambio directo autorizado.</strong> {permChecks['node_config'].reason}
                  </div>
                </div>
              )}
              <button onClick={saveConfig} className="btn-primary flex items-center gap-2">
                <Save size={18} />
                {permChecks['node_config'] && !permChecks['node_config'].can_direct ? 'Proponer cambio' : 'Guardar'}
              </button>
              {configMsg && (
                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                  configMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {configMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                  {configMsg.text}
                </div>
              )}
            </>
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
                  <input type="number" className="input" value={levelForm.credit_limit} onChange={(e) => setLevelForm({ ...levelForm, credit_limit: toCents(e.target.value) })} />
                  <p className="text-xs text-gray-400 mt-1">Cuanto puede deber (negativo).</p>
                </div>
                <div>
                  <label className="label">Limite de debito (positivo)</label>
                  <input type="number" className="input" value={levelForm.debit_limit} onChange={(e) => setLevelForm({ ...levelForm, debit_limit: toCents(e.target.value) })} />
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
                    Credito: {fmtTQ(l.credit_limit || 0)} | Debito: {fmtTQ(l.debit_limit || 0)}
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
                  <input type="number" className="input" value={orgLevelForm.credit_limit} onChange={(e) => setOrgLevelForm({ ...orgLevelForm, credit_limit: toCents(e.target.value) })} />
                  <p className="text-xs text-gray-400 mt-1">Cuanto puede deber la organizacion (negativo). Ej: -100000.</p>
                </div>
                <div>
                  <label className="label">Limite de debito (positivo)</label>
                  <input type="number" className="input" value={orgLevelForm.debit_limit} onChange={(e) => setOrgLevelForm({ ...orgLevelForm, debit_limit: toCents(e.target.value) })} />
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
                    Credito: {fmtTQ(l.credit_limit || 0)} | Debito: {fmtTQ(l.debit_limit || 0)} | Impuesto: {l.tax_rate}%
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

          {tariffLoading ? (
            <div className="card text-center py-8 text-gray-500">Cargando tarifa energetica...</div>
          ) : !tariff ? (
            <div className="card text-center py-8 text-gray-500">No se pudo cargar la tarifa energetica.</div>
          ) : (
          <>
          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
            <p><strong>Que es la tarifa energetica:</strong> Es la base para calcular precios justos. 1 {config.currency_name} = 1 kWh de energia incorporada. Todo producto o servicio tiene un precio objetivo: la energia total que costo producirlo.</p>
            <p><strong>Como funciona:</strong> Se calcula la energia necesaria para mantener viva a una persona por dia (canasta vital en kWh). Luego se divide entre las horas de trabajo para obtener la tarifa por hora. Los factores de esfuerzo ajustan segun el tipo de trabajo.</p>
            <p><strong>Valores reales (basados en ICE Database, Agribalyse, Ecoinvent, Pimentel):</strong> Una persona en una comunidad agroecologica necesita ~8 kWh/dia (alimentacion 3 + agua 1 + vivienda 2 + servicios 2). Con 8 horas de trabajo, la tarifa base es 1.0 {config.currency_name}/hora.</p>
            <p><strong>Factores de esfuerzo reales:</strong> Administrativo = 1.0 (base metabolica). Tecnico = 3.0 (metabolico + herramientas electricas). Agricola = 0.61 (consumo metabolico real ~525 kcal/h).</p>
            <p><strong>Quien la configura:</strong> La asamblea. Cambiar estos valores afecta todos los calculos de precios.</p>
          </div>

          <h3 className="font-medium text-sm">Canasta vital diaria (en {config.currency_name})</h3>
          <p className="text-xs text-gray-500 -mt-2">Cuanto cuesta lo minimo para que una persona viva un dia. La suma de estos valores es la base de todos los calculos.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Alimentacion</label>
              <input type="number" className="input" value={tariff.vital_food} onChange={(e) => setTariff({ ...tariff, vital_food: parseFloat(e.target.value) || 0 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Energia para producir comida diaria (agroecologico). Ej: 3 kWh</p>
            </div>
            <div>
              <label className="label">Agua</label>
              <input type="number" className="input" value={tariff.vital_water} onChange={(e) => setTariff({ ...tariff, vital_water: parseFloat(e.target.value) || 0 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Energia para bombear y tratar agua diaria. Ej: 1 kWh</p>
            </div>
            <div>
              <label className="label">Vivienda/domestico</label>
              <input type="number" className="input" value={tariff.vital_domestic} onChange={(e) => setTariff({ ...tariff, vital_domestic: parseFloat(e.target.value) || 0 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Energia amortizada de vivienda y cocina. Ej: 2 kWh</p>
            </div>
            <div>
              <label className="label">Servicios</label>
              <input type="number" className="input" value={tariff.vital_services} onChange={(e) => setTariff({ ...tariff, vital_services: parseFloat(e.target.value) || 0 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Energia para servicios basicos (salud, transporte, comunicaciones). Ej: 2 kWh</p>
            </div>
          </div>

          <div className="card bg-gray-50 text-sm">
            <p><strong>Suma total diaria:</strong> {fmtNumber(tariff.vital_food + tariff.vital_water + tariff.vital_domestic + tariff.vital_services, 0)} {config.currency_name}</p>
            <p className="text-xs text-gray-500 mt-1">Tarifa base por hora = {fmtNumber((tariff.vital_food + tariff.vital_water + tariff.vital_domestic + tariff.vital_services) / (tariff.work_hours_per_day || 1), 1)} {config.currency_name} (suma total / horas por dia)</p>
          </div>

          <h3 className="font-medium text-sm">Factores de esfuerzo</h3>
          <p className="text-xs text-gray-500 -mt-2">Multiplican el costo del trabajo segun su dificultad fisica o mental. 1.0 = esfuerzo base. Mas alto = mas dificil = mas pago.</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Administrativo</label>
              <input type="number" step="0.05" className="input" value={tariff.effort_admin} onChange={(e) => setTariff({ ...tariff, effort_admin: parseFloat(e.target.value) || 1 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">1.0 = base (metabolismo basal + herramientas manuales). Trabajo de oficina, gestion, administracion.</p>
            </div>
            <div>
              <label className="label">Tecnico</label>
              <input type="number" step="0.05" className="input" value={tariff.effort_technical} onChange={(e) => setTariff({ ...tariff, effort_technical: parseFloat(e.target.value) || 1 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">3.0 = triple de energia. Trabajo tecnico especializado con herramientas electricas: electricidad, plomeria, mecanica. Metabolico + equipos.</p>
            </div>
            <div>
              <label className="label">Agricola</label>
              <input type="number" step="0.05" className="input" value={tariff.effort_agricultural} onChange={(e) => setTariff({ ...tariff, effort_agricultural: parseFloat(e.target.value) || 1 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">0.61 = consumo metabolico real (~525 kcal/h). Trabajo agricola manual, construccion, carga. Esfuerzo fisico sostenido.</p>
            </div>
          </div>

          <h3 className="font-medium text-sm">Parametros laborales</h3>
          <p className="text-xs text-gray-500 -mt-2">Definen el tiempo de trabajo estandar. Se usan para calcular la tarifa por hora.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Horas por dia</label>
              <input type="number" className="input" value={tariff.work_hours_per_day} onChange={(e) => setTariff({ ...tariff, work_hours_per_day: parseInt(e.target.value) || 6 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Horas de trabajo estandar por dia. Tipico: 6-8. Con 8h y canasta de 8 kWh, la tarifa base es 1.0 TQ/hora.</p>
            </div>
            <div>
              <label className="label">Dias por mes</label>
              <input type="number" className="input" value={tariff.work_days_per_month} onChange={(e) => setTariff({ ...tariff, work_days_per_month: parseInt(e.target.value) || 24 })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Dias de trabajo por mes. Tipico: 20-24. Con 22 dias x 8 TQ/dia = 176 TQ/mes de ingreso base.</p>
            </div>
          </div>

          {canManage && (
            <>
              {permChecks['energy_rate_change'] && !permChecks['energy_rate_change'].can_direct && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 flex items-start gap-2 mb-3">
                  <VoteIcon size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Requiere aprobacion de Asamblea.</strong> {permChecks['energy_rate_change'].reason}
                    Al guardar se creara una propuesta.
                  </div>
                </div>
              )}
              <button onClick={saveTariff} className="btn-primary flex items-center gap-2">
                <Save size={18} />
                {permChecks['energy_rate_change'] && !permChecks['energy_rate_change'].can_direct ? 'Proponer cambio' : 'Guardar Tarifa'}
              </button>
              {tariffMsg && (
                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                  tariffMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {tariffMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                  {tariffMsg.text}
                </div>
              )}
          </>
          )}
          </>
          )}
        </div>
      )}

      {/* ===== HORARIOS DE COMERCIO ===== */}
      {tab === 'commerce' && (
        <div className="card space-y-6">
          <h2 className="font-semibold flex items-center gap-2"><Clock size={18} />Horarios de Comercio</h2>
          <p className="text-sm text-gray-600">
            Configura los horarios en que se permiten transacciones en el nodo.
            Puedes bloquear dias completos (ej: Sabado), rangos horarios, o ventanas
            que cruzan medianoche (ej: viernes al ponerse el sol hasta sabado al ponerse el sol).
          </p>

          {/* Toggle on/off */}
          <div className="flex items-center justify-between border rounded-lg p-4 bg-gray-50">
            <div>
              <span className="font-medium text-sm">Sistema de horarios activo</span>
              <p className="text-xs text-gray-500 mt-1">Si esta activado, las transacciones se bloquean segun las reglas. Si esta desactivado, todo esta permitido.</p>
            </div>
            {canManage && (
              <button
                onClick={async () => {
                  try {
                    await api.put('/node/commerce-hours-toggle', { enabled: !commerceHoursEnabled, message: commerceHoursMessage })
                    setCommerceHoursEnabled(!commerceHoursEnabled)
                    setScheduleMsg({ type: 'success', text: commerceHoursEnabled ? 'Horarios desactivados' : 'Horarios activados' })
                  } catch (e: any) {
                    setScheduleMsg({ type: 'error', text: e?.message || 'Error' })
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${commerceHoursEnabled ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-700'}`}
              >
                {commerceHoursEnabled ? 'Activado' : 'Desactivado'}
              </button>
            )}
          </div>

          {/* Mensaje configurable */}
          {canManage && (
            <div>
              <label className="label">Mensaje cuando el comercio esta cerrado</label>
              <input
                type="text"
                className="input"
                placeholder="Ej: Las transacciones estan cerradas por descanso sabatico."
                value={commerceHoursMessage}
                onChange={(e) => setCommerceHoursMessage(e.target.value)}
                onBlur={async () => {
                  try {
                    await api.put('/node/commerce-hours-toggle', { enabled: commerceHoursEnabled, message: commerceHoursMessage })
                  } catch (e: any) {
                    setScheduleMsg({ type: 'error', text: e?.message || 'Error al guardar mensaje' })
                  }
                }}
              />
              <p className="text-xs text-gray-400 mt-1">Este mensaje se muestra cuando alguien intenta transar fuera del horario permitido.</p>
            </div>
          )}

          {/* Formulario para nueva regla */}
          {canManage && (
            <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
              <h3 className="font-medium text-sm">Nueva regla de horario</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">Dia de la semana</label>
                  <select
                    className="input"
                    value={newSchedule.day_of_week}
                    onChange={(e) => setNewSchedule({ ...newSchedule, day_of_week: e.target.value })}
                  >
                    <option value="">Seleccionar dia...</option>
                    <option value="0">Domingo</option>
                    <option value="1">Lunes</option>
                    <option value="2">Martes</option>
                    <option value="3">Miercoles</option>
                    <option value="4">Jueves</option>
                    <option value="5">Viernes</option>
                    <option value="6">Sabado</option>
                  </select>
                </div>
                <div>
                  <label className="label">Motivo (opcional)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ej: Descanso sabatico"
                    value={newSchedule.reason}
                    onChange={(e) => setNewSchedule({ ...newSchedule, reason: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Hora de inicio (dejar vacio = todo el dia)</label>
                  <input
                    type="time"
                    className="input"
                    value={newSchedule.start_time}
                    onChange={(e) => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Hora de fin</label>
                  <input
                    type="time"
                    className="input"
                    value={newSchedule.end_time}
                    onChange={(e) => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="crosses_midnight"
                  checked={newSchedule.crosses_midnight}
                  onChange={(e) => setNewSchedule({ ...newSchedule, crosses_midnight: e.target.checked, end_day_of_week: e.target.checked ? newSchedule.end_day_of_week : '' })}
                />
                <label htmlFor="crosses_midnight" className="text-sm text-gray-600">Cruza medianoche (ej: viernes 18:00 hasta domingo 06:00)</label>
              </div>
              {newSchedule.crosses_midnight && (
                <div>
                  <label className="label">Dia de fin</label>
                  <select
                    className="input"
                    value={newSchedule.end_day_of_week}
                    onChange={(e) => setNewSchedule({ ...newSchedule, end_day_of_week: e.target.value })}
                  >
                    <option value="">Seleccionar dia final...</option>
                    <option value="0">Domingo</option>
                    <option value="1">Lunes</option>
                    <option value="2">Martes</option>
                    <option value="3">Miercoles</option>
                    <option value="4">Jueves</option>
                    <option value="5">Viernes</option>
                    <option value="6">Sabado</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">El bloqueo va desde el dia de inicio a la hora de inicio hasta este dia a la hora de fin.</p>
                </div>
              )}
              <button
                onClick={async () => {
                  if (!newSchedule.day_of_week) {
                    setScheduleMsg({ type: 'error', text: 'Selecciona un dia' })
                    return
                  }
                  if (newSchedule.crosses_midnight && !newSchedule.end_day_of_week) {
                    setScheduleMsg({ type: 'error', text: 'Selecciona el dia de fin' })
                    return
                  }
                  try {
                    const payload: any = {
                      name: newSchedule.reason || 'Regla de horario',
                      is_active: true,
                      day_of_week: parseInt(newSchedule.day_of_week),
                      start_time: newSchedule.start_time || null,
                      end_time: newSchedule.end_time || null,
                      crosses_midnight: newSchedule.crosses_midnight,
                      end_day_of_week: newSchedule.crosses_midnight ? parseInt(newSchedule.end_day_of_week) : null,
                      block_type: 'block',
                      block_message: commerceHoursMessage || newSchedule.reason || 'Comercio cerrado',
                    }
                    await api.post('/node/commerce-schedule', payload)
                    setScheduleMsg({ type: 'success', text: 'Regla creada' })
                    setNewSchedule({ day_of_week: '', end_day_of_week: '', start_time: '', end_time: '', crosses_midnight: false, reason: '' })
                    loadCommerceSchedules()
                  } catch (e: any) {
                    setScheduleMsg({ type: 'error', text: e?.message || 'Error al crear regla' })
                  }
                }}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Plus size={16} /> Crear regla
              </button>
            </div>
          )}

          {/* Lista de reglas */}
          {commerceSchedulesLoading && <p className="text-sm text-gray-500">Cargando reglas...</p>}
          {!commerceSchedulesLoading && commerceSchedules.length === 0 && (
            <p className="text-sm text-gray-500">No hay reglas configuradas. Todas las transacciones estan permitidas.</p>
          )}
          {commerceSchedules.length > 0 && (
            <div className="space-y-2">
              {commerceSchedules.map((s: any) => {
                const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
                return (
                  <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <span className="font-medium text-sm">{days[s.day_of_week] || `Dia ${s.day_of_week}`}</span>
                      {s.crosses_midnight && s.end_day_of_week != null ? (
                        <span className="ml-2 text-xs text-gray-600">
                          {s.start_time || '00:00'} ({days[s.day_of_week]}) → {s.end_time || '23:59'} ({days[s.end_day_of_week]})
                        </span>
                      ) : s.start_time && s.end_time ? (
                        <span className="ml-2 text-xs text-gray-600">{s.start_time} - {s.end_time}{s.crosses_midnight ? ' (cruza medianoche)' : ''}</span>
                      ) : (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">Todo el dia bloqueado</span>
                      )}
                      {s.block_message && s.block_message !== commerceHoursMessage && <p className="text-xs text-gray-600 mt-1">{s.block_message}</p>}
                    </div>
                    {canManage && (
                      <button
                        onClick={async () => {
                          try {
                            await api.delete(`/node/commerce-schedule/${s.id}`)
                            loadCommerceSchedules()
                          } catch (e: any) {
                            setScheduleMsg({ type: 'error', text: e?.message || 'Error al eliminar' })
                          }
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {scheduleMsg && (
            <div className={`text-xs p-2 rounded-lg ${scheduleMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {scheduleMsg.text}
            </div>
          )}
        </div>
      )}

      {/* ===== PERFIL DEL NODO ===== */}
      {tab === 'orgs' && (
        <div className="card space-y-6">
          <h2 className="font-semibold flex items-center gap-2"><Building2 size={18} />Perfil del Nodo</h2>
          <p className="text-sm text-gray-600">
            El perfil religioso/filosofico del nodo determina que productos se permiten o prohiben
            para <strong>todo el nodo</strong>. Esta politica aplica hacia otros nodos federados
            y a todas las organizaciones dentro del nodo. Las organizaciones pueden ser mas
            restrictivas pero no menos.
          </p>

          {/* Perfil actual del nodo */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium text-sm mb-3">Perfil actual del nodo</h3>
            {nodeFaithProfile === '' ? (
              <p className="text-sm text-gray-500">No hay perfil configurado. Todos los productos estan permitidos.</p>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-medium">
                  {faithProfiles.find(p => p.id === nodeFaithProfile)?.name || nodeFaithProfile}
                </span>
                {nodeFaithDescription && <span className="text-xs text-gray-600">{nodeFaithDescription}</span>}
              </div>
            )}
          </div>

          {/* Selector de perfil */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm">Seleccionar perfil del nodo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {faithProfiles.map(p => (
                <button
                  key={p.id}
                  onClick={async () => {
                    try {
                      await api.put('/node/faith-profile', { faith_profile: p.id, description: p.rules })
                      setNodeFaithProfile(p.id)
                      setNodeFaithDescription(p.rules)
                      setOrgMsg({ type: 'success', text: `Perfil "${p.name}" aplicado al nodo` })
                    } catch (e: any) {
                      setOrgMsg({ type: 'error', text: e?.message || 'Error al aplicar perfil' })
                    }
                  }}
                  className={`text-left border rounded-lg p-3 transition ${nodeFaithProfile === p.id ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{p.rules}</div>
                </button>
              ))}
            </div>
            {/* Boton para quitar perfil */}
            {nodeFaithProfile !== '' && (
              <button
                onClick={async () => {
                  try {
                    await api.put('/node/faith-profile', { faith_profile: '', description: '' })
                    setNodeFaithProfile('')
                    setNodeFaithDescription('')
                    setOrgMsg({ type: 'success', text: 'Perfil removido del nodo' })
                  } catch (e: any) {
                    setOrgMsg({ type: 'error', text: e?.message || 'Error al remover perfil' })
                  }
                }}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Quitar perfil del nodo
              </button>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <Info size={16} className="inline mr-1" />
            Para permitir o prohibir productos individuales, usa la pagina de <strong>Productos</strong> en el menu principal.
            Ahi puedes marcar cada producto como permitido o no permitido en tu nodo.
          </div>

          {orgMsg && (
            <div className={`text-xs p-2 rounded-lg ${orgMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {orgMsg.text}
            </div>
          )}
        </div>
      )}

      {/* ===== TRABAJO COMUNITARIO ===== */}
      {tab === 'work' && (
        <div className="card space-y-6">
          <h2 className="font-semibold flex items-center gap-2"><UsersIcon size={18} />Trabajo Comunitario</h2>
          <p className="text-sm text-gray-600">
            Registra sesiones de trabajo comunitario (cayapas, mingas, voluntariados).
            Soporta valoracion en horas, TQ, o sin valoracion. Las sesiones pueden requerir
            aprobacion para evitar inflacion unilateral de creditos.
          </p>

          {/* Formulario para nueva sesion */}
          <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium text-sm">Nueva sesion de trabajo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                className="input"
                placeholder="Nombre (ej: Cayapa de cosecha)"
                value={newSession.name}
                onChange={(e) => setNewSession({ ...newSession, name: e.target.value })}
              />
              <select
                className="input"
                value={newSession.work_type}
                onChange={(e) => setNewSession({ ...newSession, work_type: e.target.value })}
              >
                <option value="cayapa">Cayapa</option>
                <option value="minga">Minga</option>
                <option value="volunteer">Voluntariado</option>
                <option value="work_party">Work Party</option>
                <option value="seva">Seva</option>
              </select>
              <input
                type="datetime-local"
                className="input"
                value={newSession.session_date}
                onChange={(e) => setNewSession({ ...newSession, session_date: e.target.value })}
              />
              <select
                className="input"
                value={newSession.valuation_type}
                onChange={(e) => setNewSession({ ...newSession, valuation_type: e.target.value })}
              >
                <option value="hours_only">Solo horas</option>
                <option value="tq">TQ (credito mutuo)</option>
                <option value="no_valuation">Sin valoracion</option>
                <option value="departmental">Contabilidad departamental</option>
              </select>
            </div>
            <textarea
              className="input"
              placeholder="Descripcion (opcional)"
              value={newSession.description}
              onChange={(e) => setNewSession({ ...newSession, description: e.target.value })}
              rows={2}
            />
            <button
              onClick={async () => {
                if (!newSession.name.trim() || !newSession.session_date) {
                  setWorkMsg({ type: 'error', text: 'Nombre y fecha son obligatorios' })
                  return
                }
                try {
                  await api.post('/community-work/sessions', newSession)
                  setWorkMsg({ type: 'success', text: 'Sesion creada' })
                  setNewSession({ name: '', work_type: 'cayapa', session_date: '', valuation_type: 'hours_only', description: '' })
                  loadWorkSessions()
                } catch (e: any) {
                  setWorkMsg({ type: 'error', text: e?.message || 'Error al crear sesion' })
                }
              }}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Plus size={16} /> Crear sesion
            </button>
            {workMsg && (
              <div className={`text-xs p-2 rounded-lg ${workMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {workMsg.text}
              </div>
            )}
          </div>

          {/* Lista de sesiones */}
          {workSessionsLoading && <p className="text-sm text-gray-500">Cargando sesiones...</p>}
          {!workSessionsLoading && workSessions.length === 0 && (
            <p className="text-sm text-gray-500">No hay sesiones de trabajo comunitario registradas.</p>
          )}
          {workSessions.length > 0 && (
            <div className="space-y-2">
              {workSessions.map((s: any) => (
                <div key={s.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{s.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      s.status === 'approved' ? 'bg-green-100 text-green-700' :
                      s.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      s.status === 'planned' ? 'bg-gray-100 text-gray-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{s.status}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {s.work_type} · {s.valuation_type} · {s.session_date ? fmtDate(s.session_date) : ''}
                  </div>
                  {s.description && <p className="text-xs text-gray-500 mt-1">{s.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== BANCO DE SEMILLAS ===== */}
      {tab === 'seeds' && (
        <div className="card space-y-6">
          <h2 className="font-semibold flex items-center gap-2"><Sprout size={18} />Banco de Semillas Criollas</h2>
          <p className="text-sm text-gray-600">
            El banco de semillas funciona con prestamo y devolucion: el agricultor retira semillas,
            las siembra, y al cosechar devuelve la misma cantidad mas un porcentaje adicional
            (ej: 20% mas) para que el banco crezca comunitariamente.
          </p>

          {/* Formulario nuevo prestamo */}
          <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium text-sm">Nuevo prestamo de semillas</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="text" className="input" placeholder="Nombre semilla (ej: Maiz cariaco)"
                value={newSeedLoan.seed_name} onChange={(e) => setNewSeedLoan({ ...newSeedLoan, seed_name: e.target.value })} />
              <input type="number" className="input" placeholder="Cantidad" step="0.01"
                value={newSeedLoan.quantity_borrowed || ''} onChange={(e) => setNewSeedLoan({ ...newSeedLoan, quantity_borrowed: parseFloat(e.target.value) || 0 })} />
              <select className="input" value={newSeedLoan.unit} onChange={(e) => setNewSeedLoan({ ...newSeedLoan, unit: e.target.value })}>
                <option value="sobres">Sobres</option>
                <option value="kg">Kg</option>
                <option value="gramos">Gramos</option>
                <option value="unidades">Unidades</option>
              </select>
              <input type="number" className="input" placeholder="% retorno (ej: 20)" step="0.1"
                value={newSeedLoan.return_percentage || ''} onChange={(e) => setNewSeedLoan({ ...newSeedLoan, return_percentage: parseFloat(e.target.value) || 20 })} />
              <input type="date" className="input" value={newSeedLoan.due_date} onChange={(e) => setNewSeedLoan({ ...newSeedLoan, due_date: e.target.value })} />
              <input type="text" className="input" placeholder="Notas (opcional)"
                value={newSeedLoan.notes} onChange={(e) => setNewSeedLoan({ ...newSeedLoan, notes: e.target.value })} />
            </div>
            <button onClick={async () => {
              if (!newSeedLoan.seed_name.trim() || newSeedLoan.quantity_borrowed <= 0) {
                setSeedMsg({ type: 'error', text: 'Nombre y cantidad son obligatorios' }); return
              }
              try {
                await api.post('/seeds/loan', newSeedLoan)
                setSeedMsg({ type: 'success', text: 'Prestamo registrado' })
                setNewSeedLoan({ seed_name: '', quantity_borrowed: 0, unit: 'sobres', return_percentage: 20, due_date: '', notes: '' })
                loadSeedLoans()
              } catch (e: any) { setSeedMsg({ type: 'error', text: e?.message || 'Error' }) }
            }} className="btn-primary text-sm flex items-center gap-2"><Plus size={16} /> Registrar prestamo</button>
            {seedMsg && <div className={`text-xs p-2 rounded-lg ${seedMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{seedMsg.text}</div>}
          </div>

          {/* Lista de prestamos */}
          {seedLoansLoading && <p className="text-sm text-gray-500">Cargando...</p>}
          {!seedLoansLoading && seedLoans.length === 0 && <p className="text-sm text-gray-500">No hay prestamos registrados.</p>}
          {seedLoans.length > 0 && (
            <div className="space-y-2">
              {seedLoans.map((loan: any) => (
                <div key={loan.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">{loan.seed_name}</span>
                      <span className="ml-2 text-xs text-gray-500">{loan.quantity_borrowed} {loan.unit}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                        loan.status === 'returned' ? 'bg-green-100 text-green-700' :
                        loan.status === 'overdue' ? 'bg-red-100 text-red-700' :
                        loan.status === 'defaulted' ? 'bg-gray-100 text-gray-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{loan.status}</span>
                    </div>
                    <span className="text-xs text-gray-500">{loan.display_name || loan.username}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-2 grid grid-cols-3 gap-2">
                    <div>Prestado: {loan.quantity_borrowed} {loan.unit}</div>
                    <div>Devuelto: {loan.returned_qty || 0} {loan.unit}</div>
                    <div className="font-medium text-green-700">Esperado: {loan.expected_return} {loan.unit} ({loan.return_percentage}% mas)</div>
                  </div>
                  {loan.status === 'active' && canManage && (
                    <div className="mt-2 flex gap-2">
                      <input type="number" placeholder="Cantidad a devolver" step="0.01" className="input text-xs flex-1" id={`return-${loan.id}`} />
                      <button onClick={async () => {
                        const qty = parseFloat((document.getElementById(`return-${loan.id}`) as HTMLInputElement)?.value || '0')
                        if (qty <= 0) return
                        try {
                          const res = await api.post(`/seeds/loans/${loan.id}/return`, { quantity_returned: qty })
                          setSeedMsg({ type: 'success', text: res.message || 'Devolucion registrada' })
                          loadSeedLoans()
                        } catch (e: any) { setSeedMsg({ type: 'error', text: e?.message || 'Error' }) }
                      }} className="px-3 py-1 bg-green-600 text-white rounded text-xs">Registrar devolucion</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== TARJETAS CRIPTOGRAFICAS ===== */}
      {tab === 'cards' && (
        <div className="card space-y-6">
          <h2 className="font-semibold flex items-center gap-2"><Lock size={18} />Tarjetas NFC</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <Info size={16} className="inline mr-1" />
            La gestión de tarjetas NFC se ha unificado en la página de <strong>Terminales NFC</strong>.
            Allí puedes registrar y provisionar tarjetas de los 3 tipos soportados:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>MIFARE Classic</strong> — económica, 15 sectores con certificados dinámicos</li>
              <li><strong>NTAG424 DNA</strong> — cifrado AES-128, anti-clonación</li>
              <li><strong>DESFire EV3</strong> — alta seguridad, challenge-response AES-128</li>
            </ul>
            <a href="/app/nfc-terminals" className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              Ir a Terminales NFC →
            </a>
          </div>

          {/* CONFIG DUAL DE TARJETAS — se mantiene aquí porque es configuración del nodo */}
          <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium text-sm">Configuracion de tipo de tarjeta</h3>
            <p className="text-xs text-gray-600">
              Configura que tipos de tarjeta acepta este nodo. En Venezuela las tarjetas normales
              (MIFARE Classic) son mas faciles de conseguir. Las tarjetas seguras (DESFire EV3)
              ofrecen proteccion contra clonacion.
            </p>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs font-medium">Modo de tarjeta</label>
                <select className="input mt-1" value={cardTypeCfg?.card_type_mode || 'dual'}
                  onChange={async (e) => {
                    const newCfg = { ...cardTypeCfg, card_type_mode: e.target.value }
                    setCardTypeCfg(newCfg)
                    setCardTypeCfgLoading(true)
                    try {
                      await api.post('/nfc/card-type/config', {
                        card_type_mode: e.target.value,
                        require_crypto: newCfg.require_crypto || false,
                        auto_rotate_key: newCfg.auto_rotate_key ?? true,
                        max_write_fails: newCfg.max_write_fails || 3,
                      })
                      setCardCryptoMsg({ type: 'success', text: 'Configuracion actualizada' })
                    } catch (e: any) { setCardCryptoMsg({ type: 'error', text: e?.message || 'Error' }) }
                    setCardTypeCfgLoading(false)
                  }}>
                  <option value="dual">Dual (Classic y seguras) - Recomendado</option>
                  <option value="classic">Solo MIFARE Classic (económicas)</option>
                  <option value="desfire">Solo tarjetas seguras (NTAG424/DESFire)</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="require_crypto" checked={cardTypeCfg?.require_crypto || false}
                  onChange={async (e) => {
                    const newCfg = { ...cardTypeCfg, require_crypto: e.target.checked }
                    setCardTypeCfg(newCfg)
                    await api.post('/nfc/card-type/config', {
                      card_type_mode: newCfg.card_type_mode || 'dual',
                      require_crypto: e.target.checked,
                      auto_rotate_key: newCfg.auto_rotate_key ?? true,
                      max_write_fails: newCfg.max_write_fails || 3,
                    })
                  }} />
                <label htmlFor="require_crypto" className="text-sm">Rechazar tarjetas sin crypto (solo seguras)</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="auto_rotate" checked={cardTypeCfg?.auto_rotate_key ?? true}
                  onChange={async (e) => {
                    const newCfg = { ...cardTypeCfg, auto_rotate_key: e.target.checked }
                    setCardTypeCfg(newCfg)
                    await api.post('/nfc/card-type/config', {
                      card_type_mode: newCfg.card_type_mode || 'dual',
                      require_crypto: newCfg.require_crypto || false,
                      auto_rotate_key: e.target.checked,
                      max_write_fails: newCfg.max_write_fails || 3,
                    })
                  }} />
                <label htmlFor="auto_rotate" className="text-sm">Rotar clave automaticamente en cada transaccion (solo DESFire/NTAG424)</label>
              </div>
            </div>
            {cardTypeCfgLoading && <p className="text-xs text-gray-500">Guardando...</p>}
          </div>

          {/* HISTORIAL DE ROTACIONES */}
          <div className="space-y-3 border rounded-lg p-4">
            <h3 className="font-medium text-sm">Historial de rotaciones de clave</h3>
            <div className="flex gap-2">
              <input type="text" className="input" placeholder="UID de la tarjeta"
                value={rotationsUid} onChange={(e) => setRotationsUid(e.target.value)} />
              <button onClick={async () => {
                if (!rotationsUid.trim()) return
                try {
                  const res = await api.get<any>(`/nfc/cards/${rotationsUid}/rotations`)
                  setRotations(res.rotations || [])
                } catch (e: any) { setCardCryptoMsg({ type: 'error', text: e?.message || 'Error' }) }
              }} className="btn-primary text-sm">Ver historial</button>
            </div>
            {rotations.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {rotations.map((r: any, i: number) => (
                  <div key={i} className="bg-gray-50 rounded p-2 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium">v{r.old_key_version} → v{r.new_key_version}</span>
                      <span className={`px-2 rounded ${
                        r.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        r.status === 'failed' ? 'bg-red-100 text-red-700' :
                        r.status === 'recovered' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{r.status}</span>
                    </div>
                    {r.duration_ms && <div className="text-gray-500">Duracion: {r.duration_ms}ms</div>}
                    {r.error_message && <div className="text-red-600">Error: {r.error_message}</div>}
                    <div className="text-gray-500">{r.started_at}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== ASISTENCIA CAYAPA (NFC/QR) ===== */}
      {tab === 'cayapa' && (
        <div className="card space-y-6">
          <h2 className="font-semibold flex items-center gap-2"><UsersIcon size={18} />Asistencia a Cayapas (NFC/QR)</h2>
          <p className="text-sm text-gray-600">
            Configura como se registra la asistencia a las cayapas (jornadas de trabajo comunitario).
            Puedes usar NFC (tarjetas criptograficas), codigo QR (alternativa sin NFC), o ambos.
            Cuando tengas NFC disponible, puedes desactivar el QR.
          </p>

          {attConfigLoading && <p className="text-sm text-gray-500">Cargando...</p>}
          {!attConfigLoading && attConfig && (
            <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
              <h3 className="font-medium text-sm">Configuracion de asistencia</h3>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={attConfig.nfc_enabled !== false}
                  onChange={async (e) => {
                    const newCfg = { ...attConfig, nfc_enabled: e.target.checked }
                    setAttConfig(newCfg)
                    try { await api.post('/attendance/config', newCfg); setAttMsg({ type: 'success', text: 'Guardado' }) }
                    catch (e: any) { setAttMsg({ type: 'error', text: e?.message || 'Error' }) }
                  }} />
                NFC habilitado (tarjetas criptograficas)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={attConfig.qr_enabled !== false}
                  onChange={async (e) => {
                    const newCfg = { ...attConfig, qr_enabled: e.target.checked }
                    setAttConfig(newCfg)
                    try { await api.post('/attendance/config', newCfg); setAttMsg({ type: 'success', text: 'Guardado' }) }
                    catch (e: any) { setAttMsg({ type: 'error', text: e?.message || 'Error' }) }
                  }} />
                Codigo QR habilitado (alternativa sin NFC)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={attConfig.require_check_out === true}
                  onChange={async (e) => {
                    const newCfg = { ...attConfig, require_check_out: e.target.checked }
                    setAttConfig(newCfg)
                    try { await api.post('/attendance/config', newCfg); setAttMsg({ type: 'success', text: 'Guardado' }) }
                    catch (e: any) { setAttMsg({ type: 'error', text: e?.message || 'Error' }) }
                  }} />
                Requiere check-out (no solo check-in)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={attConfig.auto_credit_on_close !== false}
                  onChange={async (e) => {
                    const newCfg = { ...attConfig, auto_credit_on_close: e.target.checked }
                    setAttConfig(newCfg)
                    try { await api.post('/attendance/config', newCfg); setAttMsg({ type: 'success', text: 'Guardado' }) }
                    catch (e: any) { setAttMsg({ type: 'error', text: e?.message || 'Error' }) }
                  }} />
                Acreditar TQ automaticamente al cerrar la cayapa
              </label>
              <div className="space-y-1">
                <label className="text-sm font-medium">Factor de esfuerzo agricola</label>
                <input type="number" className="input" step="0.1" placeholder="1.0 (normal), 1.3 (30% mas por trabajo fisico)"
                  value={attConfig.effort_factor || 1.0}
                  onChange={(e) => setAttConfig({ ...attConfig, effort_factor: parseFloat(e.target.value) || 1.0 })} />
                <p className="text-xs text-gray-500">Ej: 0.61 = consumo metabolico agricola (kWh/h)</p>
              </div>
              <button onClick={async () => {
                try { await api.post('/attendance/config', attConfig); setAttMsg({ type: 'success', text: 'Configuracion guardada' }) }
                catch (e: any) { setAttMsg({ type: 'error', text: e?.message || 'Error' }) }
              }} className="btn-primary text-sm">Guardar configuracion</button>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <Info size={16} className="inline mr-1" />
            Como funciona: El coordinador abre el check-in desde la app. Los participantes se registran
            acercando su tarjeta NFC o mostrando su codigo QR al encargado. Al cerrar la cayapa,
            el sistema calcula las horas y acredita TQ automaticamente con el factor de esfuerzo.
          </div>
          {attMsg && <div className={`text-xs p-2 rounded-lg ${attMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{attMsg.text}</div>}
        </div>
      )}

      {/* ===== FRNE - SALIDA JUSTA ===== */}
      {tab === 'frne' && (
        <div className="card space-y-6">
          <h2 className="font-semibold flex items-center gap-2"><Scale size={18} />FRNE - Salida Justa al Retirarse</h2>
          <p className="text-sm text-gray-600">
            Fair exit: resuelve como liquidar de forma no especulativa la vivienda de un socio
            que decide retirarse de la comunidad, sin descapitalizar el fondo comun.
            El socio recibe el valor de su aporte original + mejoras, pero NO el valor
            especulativo de la propiedad (que pertenece a la comunidad).
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <Info size={16} className="inline mr-1" />
            Total a pagar = Aporte original + Valor de mejoras (valorado por asamblea).
            El valor especulativo NO se paga. Metodos: pago unico, cuotas, o transferir a nuevo socio.
          </div>

          {frneLoading && <p className="text-sm text-gray-500">Cargando solicitudes...</p>}
          {!frneLoading && frneRequests.length === 0 && (
            <p className="text-sm text-gray-500">No hay solicitudes de salida registradas.</p>
          )}
          {frneRequests.length > 0 && (
            <div className="space-y-3">
              {frneRequests.map((req: any) => (
                <div key={req.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{req.display_name || req.username}</span>
                      {req.status && (
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                          req.status === 'approved' ? 'bg-green-100 text-green-700' :
                          req.status === 'paid' ? 'bg-blue-100 text-blue-700' :
                          req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          req.status === 'disputed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>{req.status}</span>
                      )}
                    </div>
                    {req.status === 'pending' && canManage && (
                      <button
                        onClick={async () => {
                          try {
                            await api.post(`/frne/requests/${req.id}/approve`, {})
                            setFrneMsg({ type: 'success', text: 'Solicitud aprobada' })
                            loadFrneRequests()
                          } catch (e: any) {
                            setFrneMsg({ type: 'error', text: e?.message || 'Error al aprobar' })
                          }
                        }}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs"
                      >Aprobar</button>
                    )}
                  </div>
                  {req.property_description && <p className="text-xs text-gray-600 mt-1">{req.property_description}</p>}
                  <div className="text-xs text-gray-500 mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>Aporte original: {req.original_contribution || 0} TQ</div>
                    <div>Mejoras: {req.improvements_value || 0} TQ</div>
                    <div>Especulativo (no se paga): {req.speculative_value || 0} TQ</div>
                    <div className="font-medium text-green-700">Total a pagar: {req.total_payout || 0} TQ</div>
                  </div>
                  {req.payout_method === 'installments' && <p className="text-xs text-gray-500 mt-1">Pago en {req.installments_count} cuotas</p>}
                  {req.assembly_notes && <p className="text-xs text-gray-400 mt-1 italic">Notas: {req.assembly_notes}</p>}
                </div>
              ))}
            </div>
          )}
          {frneMsg && (
            <div className={`text-xs p-2 rounded-lg ${frneMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {frneMsg.text}
            </div>
          )}
        </div>
      )}

      {/* ===== BIODINAMICA ===== */}
      {tab === 'biodynamic' && (
        <div className="card space-y-6">
          <h2 className="font-semibold flex items-center gap-2"><Flower size={18} />Calendario Biodinamico</h2>
          <p className="text-sm text-gray-600">
            Planificacion agricola basada en el calendario biodinamico de Rudolf Steiner.
            Dias de raiz, flor, hoja y fruto segun la posicion de la luna en constelaciones.
            Util para comunidades Camphill, Findhorn y otras que practican agricultura biodinamica.
          </p>

          {/* Configuracion */}
          <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
            <h3 className="font-medium text-sm">Configuracion</h3>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bioConfig?.is_active || false}
                onChange={async (e) => {
                  const newCfg = { ...bioConfig, is_active: e.target.checked }
                  setBioConfig(newCfg)
                  try {
                    await api.post('/biodynamic/config', newCfg)
                    setBioMsg({ type: 'success', text: 'Configuracion guardada' })
                  } catch (e: any) {
                    setBioMsg({ type: 'error', text: e?.message || 'Error' })
                  }
                }}
              />
              Calendario biodinamico activo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bioConfig?.show_in_public_page || false}
                onChange={async (e) => {
                  const newCfg = { ...bioConfig, show_in_public_page: e.target.checked }
                  setBioConfig(newCfg)
                  try {
                    await api.post('/biodynamic/config', newCfg)
                    setBioMsg({ type: 'success', text: 'Configuracion guardada' })
                  } catch (e: any) {
                    setBioMsg({ type: 'error', text: e?.message || 'Error' })
                  }
                }}
              />
              Mostrar calendario en pagina publica
            </label>
            <textarea
              className="input"
              placeholder="Notas sobre la practica biodinamica del nodo"
              value={bioConfig?.practice_notes || ''}
              onChange={(e) => setBioConfig({ ...bioConfig, practice_notes: e.target.value })}
              rows={2}
            />
          </div>

          {/* Calendario */}
          {bioLoading && <p className="text-sm text-gray-500">Cargando calendario...</p>}
          {!bioLoading && bioEntries.length === 0 && (
            <p className="text-sm text-gray-500">No hay entradas en el calendario. Anade dias manualmente o se generaran automaticamente.</p>
          )}
          {bioEntries.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm">Proximos dias biodinamicos</h3>
              {bioEntries.map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <span className="font-medium text-sm">{entry.date ? fmtDate(entry.date) : ''}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                      entry.day_type === 'root' ? 'bg-amber-100 text-amber-700' :
                      entry.day_type === 'flower' ? 'bg-pink-100 text-pink-700' :
                      entry.day_type === 'leaf' ? 'bg-green-100 text-green-700' :
                      entry.day_type === 'fruit' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{entry.day_type}</span>
                    {entry.is_node_day && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">Dia nodo</span>}
                    {entry.constellation && <span className="ml-2 text-xs text-gray-500">{entry.constellation}</span>}
                  </div>
                  {entry.notes && <span className="text-xs text-gray-400">{entry.notes}</span>}
                </div>
              ))}
            </div>
          )}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <Info size={16} className="inline mr-1" />
            Tipos de dia: <strong>raiz</strong> (zanahoria, papa, rabano), <strong>flor</strong> (manzanilla, calendula),
            <strong> hoja</strong> (lechuga, espinaca), <strong>fruto</strong> (tomate, pimenton).
            Los dias nodo no se trabaja la tierra.
          </div>
          {bioMsg && (
            <div className={`text-xs p-2 rounded-lg ${bioMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {bioMsg.text}
            </div>
          )}
        </div>
      )}

      {/* ===== PAGINAS PUBLICAS ===== */}
      {tab === 'pages' && (
        <div className="card space-y-6">
          <h2 className="font-semibold flex items-center gap-2"><Globe size={18} />Paginas Publicas</h2>
          <p className="text-sm text-gray-600">
            Activa o desactiva las paginas publicas de este nodo. Las paginas desactivadas
            no son accesibles ni aparecen en el menu publico.
          </p>

          {pageSettingsLoading && <p className="text-sm text-gray-500">Cargando...</p>}
          {!pageSettingsLoading && pageSettings && (
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-medium text-sm">Pagina de Adaptaciones</span>
                  <p className="text-xs text-gray-500">/p/adaptaciones - Catalogo de comunidades productoras y como el software se adapta a cada una</p>
                </div>
                <input
                  type="checkbox"
                  checked={pageSettings.adaptations_page_active !== false}
                  onChange={async (e) => {
                    const newSettings = { ...pageSettings, adaptations_page_active: e.target.checked }
                    setPageSettings(newSettings)
                    try {
                      await api.post('/public-pages/settings', { adaptations_page_active: e.target.checked })
                      setPageMsg({ type: 'success', text: e.target.checked ? 'Pagina activada' : 'Pagina desactivada' })
                    } catch (e: any) {
                      setPageMsg({ type: 'error', text: e?.message || 'Error' })
                    }
                  }}
                  className="w-5 h-5"
                />
              </label>
            </div>
          )}
          {pageMsg && (
            <div className={`text-xs p-2 rounded-lg ${pageMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {pageMsg.text}
            </div>
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
                  const token = localStorage.getItem(getStorageKeys().tokenKey)
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
                  const token = localStorage.getItem(getStorageKeys().tokenKey)
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
                    <HelpCircle size={12} className="text-gray-400" />
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
                    <HelpCircle size={12} className="text-gray-400" />
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
                    <HelpCircle size={12} className="text-gray-400" />
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
                  setBackupMsg(null)
                  try {
                    const token = localStorage.getItem(getStorageKeys().tokenKey)
                    const res = await fetch('/api/admin/backup-config', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                      body: JSON.stringify(backupConfig),
                    })
                    if (!res.ok) throw new Error('Error al guardar configuracion')
                    setBackupMsg({ type: 'success', text: 'Configuracion guardada correctamente.' })
                  } catch (err) {
                    setBackupMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error al guardar' })
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
              {backupMsg && (
                <div className={`text-xs p-2 rounded-lg flex items-center gap-2 ${
                  backupMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {backupMsg.type === 'success' ? <RefreshCw size={14} /> : <AlertTriangle size={14} />}
                  {backupMsg.text}
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
                    const token = localStorage.getItem(getStorageKeys().tokenKey)
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
                            {fmtDateTime(b.created_at)} - {fmtNumber(b.size_bytes / 1024, 1)} KB
                            {b.is_locked && <span className="ml-2 text-amber-600 font-medium">Bloqueado</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a
                          href={`/api/admin/backups/${encodeURIComponent(b.filename)}/download`}
                          onClick={(e) => {
                            e.preventDefault()
                            const token = localStorage.getItem(getStorageKeys().tokenKey)
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
                            const token = localStorage.getItem(getStorageKeys().tokenKey)
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
                                  const token = localStorage.getItem(getStorageKeys().tokenKey)
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
                  <div className="text-lg font-bold">{fmtNumber(clusterStatus.tablet_usage_pct ?? 0, 1)}%</div>
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
                    Recomendado: {hardwareInfo.recommended_mem_pct}% = {fmtNumber(clusterForm.server_ram_gb * clusterForm.memstore_percentage / 100, 1)}GB de {clusterForm.server_ram_gb}GB.
                    El resto ({fmtNumber(clusterForm.server_ram_gb * (100 - clusterForm.memstore_percentage) / 100, 1)}GB) queda para el backend, frontend y el OS.
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
                          const token = localStorage.getItem(getStorageKeys().tokenKey)
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
                              const token = localStorage.getItem(getStorageKeys().tokenKey)
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
                  <HelpCircle size={12} className="text-gray-400" />
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
                  <HelpCircle size={12} className="text-gray-400" />
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
                  <HelpCircle size={12} className="text-gray-400" />
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
                  <HelpCircle size={12} className="text-gray-400" />
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
                  const token = localStorage.getItem(getStorageKeys().tokenKey)
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

            {/* Selector de preconfiguracion para el demo */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                <Sparkles size={14} /> Preconfiguracion del demo
              </label>
              <p className="text-xs text-gray-500">
                Elige el perfil con el que se inicializara el demo. Cada perfil carga datos, horarios
                y reglas distintos segun la filosofia de la comunidad.
              </p>
              <button
                onClick={loadDemoPresets}
                disabled={demoPresetsLoading}
                className="text-xs text-blue-600 hover:underline"
              >
                {demoPresetsLoading ? 'Cargando...' : demoPresets.length > 0 ? 'Recargar preconfiguraciones' : 'Cargar preconfiguraciones disponibles'}
              </button>
              {demoPresets.length > 0 && (
                <select
                  value={demoPresetSel}
                  onChange={(e) => setDemoPresetSel(e.target.value)}
                  className="input text-sm"
                >
                  {demoPresets.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category})
                    </option>
                  ))}
                </select>
              )}
              {demoPresetSel && demoPresets.find((p) => p.id === demoPresetSel) && (
                <p className="text-xs text-gray-600 italic bg-white/60 p-2 rounded">
                  {demoPresets.find((p) => p.id === demoPresetSel)?.description}
                </p>
              )}
            </div>

            <button
              onClick={() => {
                setConfirmModal({
                  open: true,
                  text: `Seguro que quieres resetear el nodo demo${demoPresetSel && demoPresetSel !== 'gen_ecoaldea' ? ` con la preconfiguracion "${demoPresets.find((p) => p.id === demoPresetSel)?.name || demoPresetSel}"` : ''}? Se borraran todos los datos demo y se recrearan.`,
                  action: async () => {
                    setDemoResetting(true)
                    setDemoMsg(null)
                    try {
                      await api.post('/admin/demo/reset', { preset_id: demoPresetSel || 'gen_ecoaldea' })
                      setDemoMsg({ type: 'success', text: 'Nodo demo reiniciado. Los datos se estan recreando con la preconfiguracion seleccionada.' })
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
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [nodeRestarting, setNodeRestarting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [updateCompleted, setUpdateCompleted] = useState(false)
  const [nodePowerAction, setNodePowerAction] = useState('')
  const [nodeRunning, setNodeRunning] = useState<boolean | null>(null)
  const [nodeLogs, setNodeLogs] = useState<string | null>(null)
  const [showNodeLogs, setShowNodeLogs] = useState(false)

  // Llamar al updater-controller via Caddy (mismo origen, sin CORS)
  // Caddy rutea /updater/* -> updater-controller:9110
  // Esto funciona incluso cuando node-app esta caido.
  const updaterApi = async (endpoint: string, method: string = 'POST') => {
    const resp = await fetch(`/updater${endpoint}`, { method })
    return resp.json()
  }

  // Obtener estado real del nodo (corriendo o detenido)
  const checkNodeStatus = async () => {
    try {
      const res: any = await api.get('/node/status')
      setNodeRunning(res.running === true)
    } catch {
      // Si el nodo no responde, intentar via Caddy -> updater-controller
      try {
        const resp = await fetch('/updater/node-status')
        const result = await resp.json()
        setNodeRunning(result.running === true)
      } catch {
        setNodeRunning(null)
      }
    }
  }

  // Ver logs del nodo principal
  const viewNodeLogs = async () => {
    setShowNodeLogs(true)
    setNodeLogs('Cargando logs...')
    try {
      const res: any = await api.get('/node/logs')
      setNodeLogs(res.logs || 'Sin logs disponibles')
    } catch {
      // Si el nodo no responde, intentar via Caddy -> updater-controller
      try {
        const resp = await fetch('/updater/node-status')
        const result = await resp.json()
        setNodeLogs(`Nodo no responde (estado: ${result.status}). No se pueden obtener logs via API.`)
      } catch {
        setNodeLogs('No se pueden obtener logs. Ni el nodo ni el updater-controller responden.')
      }
    }
  }

  // Polling del estado del nodo cada 10 segundos
  useEffect(() => {
    checkNodeStatus()
    const interval = setInterval(checkNodeStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  const controlNode = async (action: 'start' | 'stop' | 'restart') => {
    const labels = { start: 'Arrancar', stop: 'Detener', restart: 'Reiniciar' }
    if (action === 'stop' && !confirm('Confirmas que quieres detener el nodo?')) return
    if (action === 'restart' && !confirm('Confirmas que quieres reiniciar el nodo?')) return
    setNodePowerAction(action)
    setMsg(null)
    try {
      // Intentar via API del nodo primero
      try {
        await api.post(`/node/${action === 'start' ? 'start' : action === 'stop' ? 'stop' : 'restart'}`, {})
        setMsg({ type: 'success', text: `${labels[action]}: solicitud enviada.` })
      } catch {
        // Si el nodo no responde, usar updater-controller directamente
        const result = await updaterApi(`/${action}`)
        if (result.success) {
          setMsg({ type: 'success', text: `${labels[action]}: ${result.message || 'OK'}` })
        } else {
          setMsg({ type: 'error', text: `${labels[action]} fallo: ${result.message || 'error'}` })
        }
      }
      // Esperar 3 segundos y refrescar el estado real del nodo
      setTimeout(() => checkNodeStatus(), 3000)
    } catch (err) {
      setMsg({ type: 'error', text: `No se pudo ${action} el nodo.` })
    } finally {
      setNodePowerAction('')
    }
  }

  // Al cargar, verificar si ya hay una actualizacion en curso.
  // Esto permite restaurar la consola despues de una recarga de pagina.
  // Tambien detecta estado stale (status=running pero proceso murio).
  // IMPORTANTE: Siempre consultamos el updater-controller directamente porque
  // es la fuente de verdad. El nodo puede tener estado stale o no saber
  // de una actualizacion iniciada desde otro navegador/usuario.
  useEffect(() => {
    // Consultar el updater-controller SIEMPRE (no solo como fallback)
    fetch(`/updater/status`).then(resp => resp.json()).then((res: any) => {
      if (res && res.status === 'running') {
        setUpdating(true)
        setUpdateStatus(res)
        setMsg({ type: 'info', text: 'Actualizacion en curso (detectada via updater-controller).' })
        startPolling(true)
      } else if (res && res.status === 'error') {
        setUpdateStatus(res)
        setMsg({ type: 'error', text: res.message || 'La ultima actualizacion fallo.' })
      } else if (res && res.status === 'cancelled') {
        setUpdateStatus(res)
        setMsg({ type: 'info', text: 'La ultima actualizacion fue cancelada. Presiona Reset para reintentar.' })
      }
    }).catch(() => {
      // Si el updater-controller no responde via Caddy, intentar via nodo
      api.get('/node/update-status').then((res: any) => {
        if (res && res.status === 'running') {
          setUpdating(true)
          setUpdateStatus(res)
          setMsg({ type: 'info', text: 'Actualizacion en curso (restaurada despues de recargar).' })
          startPolling(true)
        } else if (res && res.status === 'error') {
          setUpdateStatus(res)
          setMsg({ type: 'error', text: res.message || 'La ultima actualizacion fallo.' })
        }
      }).catch(() => {})
    })
  }, [])

  const startPolling = (initialSawRunning = false) => {
    let consecutiveFailures = 0
    let localSawRunning = initialSawRunning
    const interval = setInterval(async () => {
      // Siempre consultar el updater-controller PRIMERO (fuente de verdad)
      // El updater-controller nunca se apaga durante la actualizacion.
      // Esto permite que cualquier navegador vea el progreso incluso si
      // la actualizacion fue iniciada por otra persona en otro navegador.
      try {
        const resp = await fetch(`/updater/status`)
        const status = await resp.json()
        if (status && status.status) {
          setUpdateStatus(status)
          consecutiveFailures = 0
          setNodeRestarting(false)
          setReconnectAttempts(0)
          if (status.status === 'running') {
            localSawRunning = true
          }
          if (status.status === 'completed' && localSawRunning) {
            clearInterval(interval)
            setPollInterval(null)
            setUpdating(false)
            setNodeRestarting(false)
            setUpdateCompleted(true)
            setUpdateInfo(null)
            setMsg({ type: 'success', text: 'Nodo actualizado correctamente. Verificando nueva version...' })
            setTimeout(() => checkUpdates(1), 2000)
            setTimeout(() => checkUpdates(1), 5000)
            setTimeout(() => checkUpdates(1), 8000)
            return
          } else if (status.status === 'error' && localSawRunning) {
            clearInterval(interval)
            setPollInterval(null)
            setUpdating(false)
            setNodeRestarting(false)
            setMsg({ type: 'error', text: status.message || 'Error en la actualizacion' })
            return
          } else if (status.status === 'cancelled' && localSawRunning) {
            clearInterval(interval)
            setPollInterval(null)
            setUpdating(false)
            setNodeRestarting(false)
            setMsg({ type: 'info', text: 'Actualizacion cancelada.' })
            return
          }
          // Si status === 'running', seguir esperando
          return
        }
      } catch {
        // El updater-controller no responde via Caddy, intentar via nodo
      }
      // Fallback: intentar via nodo
      try {
        const res: any = await api.get('/node/update-status')
        setUpdateStatus(res)
        consecutiveFailures = 0
        setNodeRestarting(false)
        setReconnectAttempts(0)
        if (res.status === 'running') {
          localSawRunning = true
        }
        if (res.status === 'completed' && localSawRunning) {
          clearInterval(interval)
          setPollInterval(null)
          setUpdating(false)
          setUpdateCompleted(true)
          setUpdateInfo(null)
          setMsg({ type: 'success', text: 'Nodo actualizado correctamente. Verificando nueva version...' })
          setTimeout(() => checkUpdates(1), 2000)
          setTimeout(() => checkUpdates(1), 5000)
          setTimeout(() => checkUpdates(1), 8000)
        } else if (res.status === 'error' && localSawRunning) {
          clearInterval(interval)
          setPollInterval(null)
          setUpdating(false)
          setMsg({ type: 'error', text: res.message || 'Error en la actualizacion' })
        } else if (res.status === 'cancelled' && localSawRunning) {
          clearInterval(interval)
          setPollInterval(null)
          setUpdating(false)
          setMsg({ type: 'info', text: 'Actualizacion cancelada.' })
        }
      } catch {
        consecutiveFailures++
        setReconnectAttempts(consecutiveFailures)
        if (consecutiveFailures >= 2) {
          setNodeRestarting(true)
          setMsg({ type: 'info', text: `El nodo se esta reiniciando... obteniendo log del updater-controller (${consecutiveFailures})` })
        }
        // Despues de 60 fallos (120 seg), mostrar error mas grave
        if (consecutiveFailures >= 60) {
          clearInterval(interval)
          setPollInterval(null)
          setUpdating(false)
          setNodeRestarting(false)
          setMsg({ type: 'error', text: 'No se pudo reconectar despues de 120 segundos. Verifica el estado con: docker compose ps' })
        }
      }
    }, 2000)
    setPollInterval(interval)
  }

  const checkUpdates = async (retryCount = 0) => {
    if (retryCount === 0) {
      setChecking(true)
      // Limpiar info anterior inmediatamente para no mostrar datos stale
      setUpdateInfo(null)
      setMsg(null)
    }
    try {
      // Cache-busting: agregar timestamp para evitar cualquier cache HTTP/browser
      const res: any = await api.get(`/node/check-updates?_t=${Date.now()}`)
      if (res) {
        setUpdateInfo(res)
      }
    } catch (e: any) {
      // Si el nodo no responde, intentar via updater-controller directamente
      try {
        const host = window.location.hostname
        const resp = await fetch(`/updater/check?_t=${Date.now()}`)
        const result = await resp.json()
        if (result) {
          setUpdateInfo({
            updates_available: result.updates_available === true,
            current_commit: result.current_commit || '',
            new_commits: result.new_commits || '',
            remote_url: 'via updater-controller (nodo caido)',
          })
          setMsg({ type: 'info', text: 'Nodo no responde. Verificacion hecha via updater-controller.' })
        }
      } catch (err2) {
        // Limpiar info anterior - no mostrar datos stale
        setUpdateInfo(null)
        setMsg({ type: 'error', text: 'No se puede conectar con el nodo ni con el updater-controller. Verifica que los contenedores esten corriendo.' })
      }
    } finally {
      if (retryCount === 0) {
        setChecking(false)
      }
    }
  }

  const cancelUpdate = async () => {
    setCancelling(true)
    try {
      await api.post('/node/cancel-update', {})
      setMsg({ type: 'info', text: 'Solicitud de cancelacion enviada.' })
    } catch (err) {
      // Si el nodo esta caido, intentar cancelar directamente via updater-controller
      // El puerto 9110 esta expuesto en el host
      try {
        const host = window.location.hostname
        await fetch(`/updater/cancel`, { method: 'POST' })
        setMsg({ type: 'info', text: 'Cancelacion enviada directamente al updater-controller.' })
      } catch (err2) {
        setMsg({ type: 'error', text: 'No se pudo cancelar. El nodo y el updater-controller no responden.' })
      }
    } finally {
      if (pollInterval) {
        clearInterval(pollInterval)
        setPollInterval(null)
      }
      setUpdating(false)
      setCancelling(false)
    }
  }

  const resetUpdateState = async () => {
    setResetting(true)
    try {
      try {
        await api.post('/node/reset-update-state', {})
      } catch {
        // Si el nodo no responde, intentar directamente via updater-controller
        const host = window.location.hostname
        await fetch(`/updater/reset`, { method: 'POST' })
      }
      setUpdateStatus(null)
      setUpdateInfo(null)
      setMsg({ type: 'success', text: 'Estado reseteado. Ya puedes actualizar de nuevo.' })
      // Recargar estado del nodo
      checkNodeStatus()
      // Recargar para verificar actualizaciones
      checkUpdates()
    } catch (err) {
      setMsg({ type: 'error', text: 'No se pudo resetear el estado. Ni el nodo ni el updater-controller responden.' })
    } finally {
      setResetting(false)
    }
  }

  const updateNode = async () => {
    setShowConfirm(false)
    setUpdating(true)
    setMsg(null)
    setUpdateStatus(null)
    setUpdateCompleted(false)
    setReconnectAttempts(0)
    setNodeRestarting(false)
    try {
      await api.post('/node/update', {})
      setMsg({ type: 'info', text: 'Actualizacion iniciada. El nodo se reiniciara automaticamente.' })
      startPolling()
    } catch (e: any) {
      // Si el nodo no responde, intentar directamente via updater-controller
      try {
        const host = window.location.hostname
        const resp = await fetch(`/updater/update`, { method: 'POST' })
        const result = await resp.json()
        if (result.success) {
          setMsg({ type: 'info', text: 'Actualizacion iniciada via updater-controller. El nodo se reiniciara automaticamente.' })
          startPolling()
        } else {
          setUpdating(false)
          setMsg({ type: 'error', text: result.message || 'El updater-controller rechazo la solicitud' })
        }
      } catch (err2) {
        setUpdating(false)
        setMsg({ type: 'error', text: 'No se puede iniciar la actualizacion. Ni el nodo ni el updater-controller responden. Verifica que los contenedores esten corriendo.' })
      }
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
          {updateInfo.installed_commit && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Commit instalado:</span>
              <code className="font-mono text-xs">{updateInfo.installed_commit}</code>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Commit actual:</span>
            <code className="font-mono text-xs">{updateInfo.current_commit || 'desconocido'}</code>
          </div>
          {updateInfo.remote_commit && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-gray-600">Commit remoto:</span>
              <code className="font-mono text-xs">{updateInfo.remote_commit}</code>
            </div>
          )}
          {updateInfo.updates_available && (
            <div className="mt-2">
              <div className="text-green-700 font-medium mb-1">Actualizacion disponible!</div>
              <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-32 overflow-auto">{updateInfo.new_commits}</pre>
            </div>
          )}
          {!updateInfo.updates_available && !updateInfo.error && (
            <div className="mt-2 text-gray-500">El nodo esta actualizado (commit instalado: {updateInfo.installed_commit || updateInfo.current_commit}).</div>
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
          {/* Info de debug - siempre visible para diagnostico */}
          {updateInfo.remote_url && (
            <div className="mt-2 text-xs text-gray-400 border-t border-gray-100 pt-2">
              <span>Remote: {updateInfo.remote_url}</span>
              {updateInfo.fetch_output && <span> | Fetch: {updateInfo.fetch_output}</span>}
            </div>
          )}
        </div>
      )}

      {/* Consola de estado de actualizacion - siempre visible durante updating */}
      {(updating || updateCompleted) && (
        <div className="bg-gray-900 rounded-lg p-4 mb-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            {nodeRestarting ? (
              <>
                <RefreshCw size={16} className="animate-spin text-amber-400" />
                <span className="text-amber-400 text-sm font-medium">
                  Nodo reiniciandose... esperando reconexion (intento {reconnectAttempts})
                </span>
              </>
            ) : updateStatus?.status === 'running' ? (
              <>
                <RefreshCw size={16} className="animate-spin text-blue-400" />
                <span className="text-blue-400 text-sm font-medium">{updateStatus.message || 'Actualizando...'}</span>
              </>
            ) : updateStatus?.status === 'completed' ? (
              <>
                <CheckCircle size={16} className="text-green-400" />
                <span className="text-green-400 text-sm font-medium">{updateStatus.message}</span>
              </>
            ) : updateStatus?.status === 'error' ? (
              <>
                <AlertTriangle size={16} className="text-red-400" />
                <span className="text-red-400 text-sm font-medium">{updateStatus.message}</span>
              </>
            ) : (
              <>
                <RefreshCw size={16} className="animate-spin text-blue-400" />
                <span className="text-blue-400 text-sm font-medium">
                  {updateStatus?.status === 'idle' ? 'Esperando inicio de actualizacion...' : 'Iniciando...'}
                </span>
              </>
            )}
          </div>
          {/* Log en tiempo real - consola estilo terminal */}
          {updateStatus?.log && (
            <pre className="text-xs text-gray-300 bg-black p-3 rounded max-h-60 overflow-auto whitespace-pre-wrap font-mono border border-gray-800">
              {updateStatus.log}
            </pre>
          )}
          {!updateStatus?.log && !nodeRestarting && (
            <div className="text-xs text-gray-500 bg-black p-3 rounded font-mono border border-gray-800">
              {updateStatus?.status === 'idle'
                ? '$ Esperando que el updater-controller inicie la actualizacion...'
                : '$ Conectando con el updater-controller...'}
            </div>
          )}
          {nodeRestarting && (
            <div className="text-xs text-amber-500 bg-black p-3 rounded font-mono border border-gray-800">
              {'$ El nodo se esta reiniciando. Esto es normal durante la actualizacion.\n'}
              {'$ El updater-controller sigue trabajando en segundo plano.\n'}
              {'$ Reintentando conexion... (intento ' + reconnectAttempts + ')'}
            </div>
          )}
          {/* Barra de progreso visual - usa el progress real del backend */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  nodeRestarting ? 'bg-amber-500' :
                  updateStatus?.status === 'completed' ? 'bg-green-500' :
                  updateStatus?.status === 'error' ? 'bg-red-500' :
                  'bg-blue-500 animate-pulse'
                }`}
                style={{
                  width: updateStatus?.status === 'completed' ? '100%' :
                         typeof updateStatus?.progress === 'number' && updateStatus.progress > 0 ? `${updateStatus.progress}%` :
                         nodeRestarting ? '85%' :
                         updateStatus?.status === 'running' ? '10%' :
                         '5%'
                }}
              />
            </div>
            <span className="text-xs text-gray-400 font-mono">
              {updateStatus?.status === 'completed' ? '100%' :
               typeof updateStatus?.progress === 'number' && updateStatus.progress > 0 ? `${updateStatus.progress}%` :
               nodeRestarting ? '85%' :
               '...'}
            </span>
          </div>
          {/* Boton de cancelar actualizacion */}
          {updateStatus?.status !== 'completed' && updateStatus?.status !== 'error' && updateStatus?.status !== 'cancelled' && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={cancelUpdate}
                disabled={cancelling || nodeRestarting}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs flex items-center gap-2 disabled:opacity-50"
              >
                {cancelling ? <><RefreshCw size={14} className="animate-spin" /> Cancelando...</> : <><X size={14} /> Cancelar actualizacion</>}
              </button>
            </div>
          )}
          {/* Boton de reset cuando hay error o estado stale */}
          {(updateStatus?.status === 'error' || updateStatus?.status === 'cancelled') && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={resetUpdateState}
                disabled={resetting}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs flex items-center gap-2 disabled:opacity-50"
              >
                {resetting ? <><RefreshCw size={14} className="animate-spin" /> Reseteando...</> : <><RefreshCw size={14} /> Resetear estado</>}
              </button>
            </div>
          )}
          {/* Boton de recargar cuando la actualizacion completo */}
          {updateCompleted && (
            <div className="mt-3 flex justify-between items-center">
              <span className="text-xs text-green-400 font-medium">
                Actualizacion completada. El log completo esta arriba.
              </span>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center gap-2 font-medium"
              >
                <CheckCircle size={16} /> Recargar pagina
              </button>
            </div>
          )}
        </div>
      )}

      {/* Estado anterior (no durante updating) */}
      {!updating && !updateCompleted && updateStatus && (updateStatus.status === 'running' || updateStatus.status === 'error' || updateStatus.status === 'completed' || updateStatus.status === 'cancelled') && (
        <div className={`bg-white rounded-lg p-3 border mb-3 ${
          updateStatus.status === 'running' ? 'border-blue-100' :
          updateStatus.status === 'error' ? 'border-red-100' :
          updateStatus.status === 'cancelled' ? 'border-amber-100' :
          'border-green-100'
        }`}>
          <div className={`flex items-center gap-2 text-sm mb-2 ${
            updateStatus.status === 'running' ? 'text-blue-600' :
            updateStatus.status === 'error' ? 'text-red-600' :
            updateStatus.status === 'cancelled' ? 'text-amber-600' :
            'text-green-600'
          }`}>
            {updateStatus.status === 'running' && <RefreshCw size={14} className="animate-spin" />}
            {updateStatus.status === 'error' && <AlertTriangle size={14} />}
            {updateStatus.status === 'cancelled' && <AlertTriangle size={14} />}
            {updateStatus.status === 'completed' && <CheckCircle size={14} />}
            {updateStatus.message}
          </div>
          {updateStatus.log && (
            <pre className="text-xs text-gray-600 bg-gray-900 text-gray-100 p-3 rounded max-h-60 overflow-auto whitespace-pre-wrap font-mono">{updateStatus.log}</pre>
          )}
          {/* Boton de reset para estado error/cancelled/stale */}
          {(updateStatus.status === 'error' || updateStatus.status === 'cancelled') && canManage && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={resetUpdateState}
                disabled={resetting}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs flex items-center gap-2 disabled:opacity-50"
              >
                {resetting ? <><RefreshCw size={14} className="animate-spin" /> Reseteando...</> : <><RefreshCw size={14} /> Resetear estado</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Estado del nodo (corriendo/detenido) */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        {nodeRunning === null ? (
          <span className="text-gray-500 flex items-center gap-1"><RefreshCw size={14} className="animate-spin" /> Verificando estado del nodo...</span>
        ) : nodeRunning ? (
          <span className="text-green-600 flex items-center gap-1"><CheckCircle size={14} /> Nodo: ARRANCADO</span>
        ) : (
          <span className="text-red-600 flex items-center gap-1"><Square size={14} /> Nodo: DETENIDO</span>
        )}
      </div>

      {/* Consola del nodo principal */}
      {showNodeLogs && (
        <div className="bg-gray-900 rounded-lg p-4 mb-3 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-green-400 text-sm font-medium flex items-center gap-2">
              <RefreshCw size={14} /> Consola del Nodo
            </span>
            <div className="flex gap-2">
              <button
                onClick={viewNodeLogs}
                className="px-2 py-1 bg-gray-700 text-white rounded text-xs flex items-center gap-1 hover:bg-gray-600"
                title="Actualizar logs"
              >
                <RefreshCw size={10} /> Actualizar
              </button>
              <button
                onClick={() => setShowNodeLogs(false)}
                className="text-gray-400 hover:text-white text-xl px-2"
              >&times;</button>
            </div>
          </div>
          <pre className="text-xs text-green-400 bg-black p-3 rounded max-h-60 overflow-auto whitespace-pre-wrap font-mono border border-gray-800">
            {nodeLogs}
          </pre>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canManage && (
          <>
            <button
              onClick={() => controlNode('start')}
              disabled={nodePowerAction === 'start' || nodeRunning === true}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title={nodeRunning === true ? 'El nodo ya esta arrancado' : ''}
            >
              {nodePowerAction === 'start' ? <><RefreshCw size={16} className="animate-spin" /> Iniciando...</> : <><Play size={16} /> Arrancar</>}
            </button>
            <button
              onClick={() => controlNode('stop')}
              disabled={nodePowerAction === 'stop' || nodeRunning === false}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title={nodeRunning === false ? 'El nodo ya esta detenido' : ''}
            >
              {nodePowerAction === 'stop' ? <><RefreshCw size={16} className="animate-spin" /> Deteniendo...</> : <><Square size={16} /> Detener</>}
            </button>
            <button
              onClick={() => controlNode('restart')}
              disabled={nodePowerAction === 'restart' || nodeRunning === false}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title={nodeRunning === false ? 'El nodo esta detenido, usa Arrancar' : ''}
            >
              {nodePowerAction === 'restart' ? <><RefreshCw size={16} className="animate-spin" /> Reiniciando...</> : <><RefreshCw size={16} /> Reiniciar</>}
            </button>
            <button
              onClick={viewNodeLogs}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm flex items-center gap-2"
              title="Ver consola del nodo"
            >
              <RefreshCw size={16} /> Consola del nodo
            </button>
            <div className="w-px h-8 bg-gray-300 mx-1" />
            <button
              onClick={() => checkUpdates()}
              disabled={checking}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {checking ? <><RefreshCw size={16} className="animate-spin" /> Verificando...</> : <><RefreshCw size={16} /> Verificar actualizaciones</>}
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={updating || !canManage}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
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

