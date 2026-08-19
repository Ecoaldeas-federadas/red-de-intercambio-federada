import { useState, useEffect } from 'react'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { useConfig } from '../hooks/useConfig'
import { EntitySelector } from '../components/EntitySelector'
import { Plus, Check, X, HelpCircle, Users, Calendar, Shield, Vote as VoteIcon, DollarSign, Crown, Trash2, FileText, Clock } from 'lucide-react'

type ProposalType =
  | 'limit_change' | 'admission' | 'expulsion' | 'budget_increase'
  | 'federation_config' | 'recovery_config' | 'tax_change' | 'member_level' | 'policy'
  | 'create_account' | 'fund_distribution' | 'energy_rate_change' | 'product_modification' | 'free_proposal'

const PROPOSAL_LABELS: Record<ProposalType, string> = {
  limit_change: 'Cambio de limites',
  admission: 'Admision de miembro',
  expulsion: 'Expulsion de miembro',
  budget_increase: 'Aumento de presupuesto',
  federation_config: 'Configuracion de federacion',
  recovery_config: 'Configuracion de recuperacion',
  tax_change: 'Cambio de impuestos',
  member_level: 'Nivel de miembro',
  policy: 'Politica general',
  create_account: 'Crear cuenta',
  fund_distribution: 'Distribucion de fondo',
  energy_rate_change: 'Cambio de tarifa energetica',
  product_modification: 'Modificacion de producto',
  free_proposal: 'Propuesta libre',
}

const PROPOSAL_HELP: Record<ProposalType, string> = {
  limit_change: 'Cambia los limites de credito/debito de un usuario o nodo. Ej: aumentar el limite de credito de un miembro de 100 a 300.',
  admission: 'Admite un nuevo miembro asignandole un nivel. Ej: admitir a "juan" con nivel "pleno".',
  expulsion: 'Expulsa a un miembro por mala conducta. Requiere alto quorum. Ej: expulsar a "pedro" por fraude.',
  budget_increase: 'Aumenta el presupuesto de una organizacion. Ej: aumentar 500 al presupuesto de "coop_norte".',
  federation_config: 'Cambia limites o configuracion de federacion con otro nodo. Ej: establecer limite de credito con "nodo-b.org" en 1000.',
  recovery_config: 'Cambia parametros de recuperacion de cuentas. Ej: cambiar el modo de aprobacion a multi_sig con 3 aprobaciones.',
  tax_change: 'Cambia la tasa de impuesto sobre transacciones. El dinero va a la cuenta de impuestos. Se puede aplicar a un nivel de miembro o de organizacion. Ej: 2% para nivel "pleno".',
  member_level: 'Crea o modifica un nivel de miembro con sus permisos y limites. Ej: crear nivel "pleno" con limite 500.',
  policy: 'Cualquier decision de politica general de la comunidad. Ej: aprobar el reglamento interno.',
  create_account: 'Crea una nueva cuenta contable en la red. Ej: cuenta "fondo_social" de tipo "expense" con responsables.',
  fund_distribution: 'Distribuye fondos de una cuenta/organizacion a otra. Ej: transferir 200 de "coop_norte" para pago de servicios.',
  energy_rate_change: 'Cambia un parametro de la tarifa energetica. Ej: cambiar el precio por kWh a 0.15.',
  product_modification: 'Modifica el precio o datos de un producto existente. Ej: cambiar el precio del "pan_integral" a 5.',
  free_proposal: 'Propuesta libre sobre cualquier tema no cubierto por los otros tipos. Ej: crear un comite de bienvenida.',
}

type FieldType = 'text' | 'number' | 'textarea' | 'select' | 'entity' | 'entity_toggle'

interface EntityMode {
  key: string
  label: string
  endpoint: string
  valueKey: string
  labelKey: string
  subLabelKey?: string
  filterFn?: (item: any) => boolean
  emptyMessage?: string
}

interface ProposalField {
  key: string
  label: string
  help: string
  placeholder?: string
  type: FieldType
  options?: { value: string; label: string }[]
  endpoint?: string
  valueKey?: string
  labelKey?: string
  subLabelKey?: string
  filterFn?: (item: any) => boolean
  emptyMessage?: string
  entityModes?: EntityMode[]
}

const APPROVAL_MODE_OPTIONS = [
  { value: 'assembly', label: 'Asamblea - Decision por votacion de todos los miembros con voto' },
  { value: 'council', label: 'Consejo - Decision por la junta directiva' },
  { value: 'multi_sig', label: 'Multi-firma - Requiere N firmas de miembros autorizados' },
]

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'asset', label: 'Activo - Recursos/bienes disponibles' },
  { value: 'liability', label: 'Pasivo - Obligaciones/deudas' },
  { value: 'equity', label: 'Patrimonio - Fondos propios de la comunidad' },
  { value: 'income', label: 'Ingreso - Entradas de dinero' },
  { value: 'expense', label: 'Egreso - Salidas de dinero' },
]

const ENERGY_PARAM_OPTIONS = [
  { value: 'kwh_price', label: 'Precio por kWh - Tarifa por unidad de energia consumida' },
  { value: 'base_fee', label: 'Cargo fijo - Costo fijo mensual de conexion' },
  { value: 'connection_fee', label: 'Costo de conexion - Tarifa por nueva conexion' },
  { value: 'minimum_charge', label: 'Consumo minimo - Cargo minimo mensual' },
]

const FREE_CATEGORY_OPTIONS = [
  { value: 'social', label: 'Social - Temas comunitarios y bienestar' },
  { value: 'economic', label: 'Economico - Temas financieros y comerciales' },
  { value: 'governance', label: 'Gobernanza - Reglas y organizacion interna' },
  { value: 'technical', label: 'Tecnico - Infraestructura y sistemas' },
  { value: 'other', label: 'Otro - Cualquier otro tema' },
]

const TAX_APPLIES_OPTIONS = [
  { value: 'all', label: 'Todos los niveles - Aplica a todas las transacciones' },
  { value: 'member_level', label: 'Nivel de miembro - Aplica a un nivel de miembro especifico' },
  { value: 'org_level', label: 'Nivel de organizacion - Aplica a un nivel de organizacion especifico' },
]

const PROPOSAL_FIELDS = (currency: string): Record<ProposalType, ProposalField[]> => ({
  limit_change: [
    {
      key: 'usuario_organizacion',
      label: 'Usuario u organizacion',
      help: 'Selecciona el usuario o la organizacion a la que se le cambiaran los limites. Ej: maria o coop_norte.',
      placeholder: 'ej: maria',
      type: 'entity_toggle',
      entityModes: [
        { key: 'user', label: 'Buscar Usuario', endpoint: '/accounts/search', valueKey: 'username', labelKey: 'username', subLabelKey: 'display_name', emptyMessage: 'No se encontraron usuarios' },
        { key: 'org', label: 'Buscar Organizacion', endpoint: '/organizations', valueKey: 'name', labelKey: 'name', subLabelKey: 'description', emptyMessage: 'No se encontraron organizaciones' },
      ],
    },
    { key: 'nuevo_limite_credito', label: `Nuevo limite de credito (${currency})`, help: `Monto maximo que la entidad puede deber a favor (credito). Ej: 200 ${currency}.`, placeholder: '200', type: 'number' },
    { key: 'nuevo_limite_debito', label: `Nuevo limite de debito (${currency})`, help: `Monto maximo que la entidad puede deber en contra (debito). Ej: 200 ${currency}.`, placeholder: '200', type: 'number' },
  ],
  admission: [
    {
      key: 'usuario',
      label: 'Usuario a admitir',
      help: 'Selecciona el usuario que sera admitido como nuevo miembro. Ej: nuevo_miembro.',
      placeholder: 'ej: nuevo_miembro',
      type: 'entity',
      endpoint: '/accounts/search',
      valueKey: 'username',
      labelKey: 'username',
      subLabelKey: 'display_name',
      emptyMessage: 'No se encontraron usuarios',
    },
    {
      key: 'nivel',
      label: 'Nivel',
      help: 'Selecciona el nivel de miembro que se le asignara. Ej: basic, pleno, etc.',
      placeholder: 'ej: pleno',
      type: 'entity',
      endpoint: '/member-levels',
      valueKey: 'name',
      labelKey: 'name',
      subLabelKey: 'description',
      emptyMessage: 'No hay niveles definidos',
    },
  ],
  expulsion: [
    {
      key: 'usuario',
      label: 'Usuario a expulsar',
      help: 'Selecciona el miembro que sera expulsado. Requiere alto quorum.',
      placeholder: 'ej: usuario',
      type: 'entity',
      endpoint: '/accounts/search',
      valueKey: 'username',
      labelKey: 'username',
      subLabelKey: 'display_name',
      emptyMessage: 'No se encontraron usuarios',
    },
    { key: 'razon', label: 'Razon de expulsion', help: 'Explica el motivo de la expulsion. Ej: fraude comprobado en transacciones.', placeholder: 'Motivo de expulsion', type: 'textarea' },
  ],
  budget_increase: [
    {
      key: 'organizacion',
      label: 'Organizacion',
      help: 'Selecciona la organizacion cuyo presupuesto se aumentara. Ej: coop_norte.',
      placeholder: 'ej: coop_norte',
      type: 'entity',
      endpoint: '/organizations',
      valueKey: 'name',
      labelKey: 'name',
      subLabelKey: 'description',
      emptyMessage: 'No se encontraron organizaciones',
    },
    { key: 'monto', label: `Monto (${currency})`, help: `Monto adicional a agregar al presupuesto. Ej: 500 ${currency}.`, placeholder: '500', type: 'number' },
  ],
  federation_config: [
    {
      key: 'nodo',
      label: 'Nodo federado',
      help: 'Selecciona el nodo federado con el que se cambiara la configuracion. Ej: nodo-b.org.',
      placeholder: 'ej: nodo-b.org',
      type: 'entity',
      endpoint: '/federation/peers',
      valueKey: 'domain',
      labelKey: 'domain',
      subLabelKey: 'node_name',
      emptyMessage: 'No hay nodos federados',
    },
    { key: 'limite', label: `Nuevo limite (${currency})`, help: `Nuevo limite de credito/debito con el nodo federado. Ej: 1000 ${currency}.`, placeholder: '1000', type: 'number' },
  ],
  recovery_config: [
    {
      key: 'modo',
      label: 'Modo de aprobacion',
      help: 'Define como se aprueban las recuperaciones de cuenta. Asamblea = votacion de todos. Consejo = junta directiva. Multi-firma = N firmas autorizadas.',
      type: 'select',
      options: APPROVAL_MODE_OPTIONS,
    },
    { key: 'aprobaciones', label: 'Numero de aprobaciones', help: 'Cantidad de firmas/aprobaciones necesarias (solo para multi_sig). Ej: 3.', placeholder: '3', type: 'number' },
  ],
  tax_change: [
    {
      key: 'aplica_a',
      label: 'Aplica a',
      help: 'Selecciona a quien se le aplica el impuesto: todos, un nivel de miembro o un nivel de organizacion.',
      type: 'select',
      options: TAX_APPLIES_OPTIONS,
    },
    {
      key: 'nivel',
      label: 'Nivel de miembro/organizacion',
      help: 'Selecciona el nivel especifico al que se aplica el impuesto (solo si elegiste un nivel arriba). Ej: pleno.',
      placeholder: 'ej: pleno',
      type: 'entity',
      endpoint: '/member-levels',
      valueKey: 'name',
      labelKey: 'name',
      subLabelKey: 'description',
      emptyMessage: 'No hay niveles definidos',
    },
    { key: 'tasa', label: 'Tasa de impuesto (%)', help: 'Porcentaje que se cobrara sobre las transacciones. Ej: 2 (para 2%).', placeholder: '2', type: 'number' },
  ],
  member_level: [
    {
      key: 'nombre_nivel',
      label: 'Nombre del nivel',
      help: 'Selecciona el nivel a crear o modificar. Ej: pleno, basic, observador.',
      placeholder: 'ej: pleno',
      type: 'entity',
      endpoint: '/member-levels',
      valueKey: 'name',
      labelKey: 'name',
      subLabelKey: 'description',
      emptyMessage: 'No hay niveles definidos (escribe uno nuevo)',
    },
    { key: 'descripcion_nivel', label: 'Descripcion', help: 'Describe los permisos y alcances del nivel. Ej: "Miembro pleno con voz, voto y quorum".', placeholder: 'Permisos y alcances', type: 'textarea' },
    { key: 'limite_credito', label: `Limite de credito (${currency})`, help: `Monto maximo de credito permitido. Ej: 500 ${currency}.`, placeholder: '500', type: 'number' },
    { key: 'limite_debito', label: `Limite de debito (${currency})`, help: `Monto maximo de debito permitido. Ej: 500 ${currency}.`, placeholder: '500', type: 'number' },
  ],
  policy: [
    { key: 'detalle', label: 'Detalle de la politica', help: 'Describe la decision de politica general. Ej: "Aprobar el reglamento interno version 2".', placeholder: 'Descripcion de la decision', type: 'textarea' },
  ],
  create_account: [
    { key: 'nombre', label: 'Nombre de la cuenta', help: 'Nombre identificatorio de la cuenta. Ej: fondo_social.', placeholder: 'ej: fondo_social', type: 'text' },
    {
      key: 'tipo',
      label: 'Tipo de cuenta',
      help: 'Tipo contable de la cuenta. Activo = recursos, Pasivo = deudas, Patrimonio = fondos propios, Ingreso = entradas, Egreso = salidas.',
      type: 'select',
      options: ACCOUNT_TYPE_OPTIONS,
    },
    { key: 'descripcion', label: 'Descripcion', help: 'Describe el proposito de la cuenta. Ej: "Fondo para actividades sociales de la comunidad".', placeholder: 'Descripcion de la cuenta', type: 'textarea' },
    {
      key: 'responsables',
      label: 'Responsables',
      help: 'Selecciona el usuario o organizacion responsable de la cuenta. Ej: maria o coop_admin.',
      placeholder: 'ej: maria',
      type: 'entity_toggle',
      entityModes: [
        { key: 'user', label: 'Buscar Usuario', endpoint: '/accounts/search', valueKey: 'username', labelKey: 'username', subLabelKey: 'display_name', emptyMessage: 'No se encontraron usuarios' },
        { key: 'org', label: 'Buscar Organizacion', endpoint: '/organizations', valueKey: 'name', labelKey: 'name', subLabelKey: 'description', emptyMessage: 'No se encontraron organizaciones' },
      ],
    },
  ],
  fund_distribution: [
    {
      key: 'cuenta_destino',
      label: 'Cuenta destino (organizacion o departamento)',
      help: 'La asamblea del nodo SOLO puede transferir a organizaciones o departamentos, NUNCA a personas directamente. Ej: coop_norte o depto_pagos.',
      placeholder: 'ej: coop_norte',
      type: 'entity_toggle',
      entityModes: [
        { key: 'org', label: 'Buscar Organizacion', endpoint: '/organizations', valueKey: 'id', labelKey: 'display_name', subLabelKey: 'username', emptyMessage: 'No se encontraron organizaciones' },
        { key: 'dept', label: 'Buscar Departamento', endpoint: '/departments', valueKey: 'id', labelKey: 'name', subLabelKey: 'description', emptyMessage: 'No se encontraron departamentos' },
      ],
    },
    { key: 'monto', label: `Monto (${currency})`, help: `Monto a distribuir. Ej: 200 ${currency}.`, placeholder: '200', type: 'number' },
    { key: 'razon', label: 'Razon', help: 'Justifica el motivo de la distribucion. Ej: "Pago de servicios comunitarios del mes".', placeholder: 'Motivo de la distribucion', type: 'textarea' },
  ],
  energy_rate_change: [
    {
      key: 'parametro',
      label: 'Parametro a cambiar',
      help: 'Selecciona el parametro de la tarifa energetica que se modificara. Ej: precio por kWh.',
      type: 'select',
      options: ENERGY_PARAM_OPTIONS,
    },
    { key: 'nuevo_valor', label: 'Nuevo valor', help: 'Nuevo valor del parametro seleccionado. Ej: 0.15 para el precio por kWh.', placeholder: '0.15', type: 'number' },
  ],
  product_modification: [
    {
      key: 'producto',
      label: 'Producto',
      help: 'Selecciona el producto a modificar del catalogo existente.',
      placeholder: 'buscar producto...',
      type: 'entity',
      endpoint: '/products',
      valueKey: 'id',
      labelKey: 'name',
      subLabelKey: 'category',
      emptyMessage: 'No se encontraron productos',
    },
    { key: 'nuevo_precio', label: `Nuevo precio (${currency})`, help: `Nuevo precio del producto. Ej: 5 ${currency}.`, placeholder: '5', type: 'number' },
    { key: 'razon', label: 'Razon', help: 'Justifica el cambio de precio. Ej: "Aumento del costo de la harina".', placeholder: 'Motivo del cambio', type: 'textarea' },
  ],
  free_proposal: [
    { key: 'titulo', label: 'Titulo', help: 'Titulo breve de la propuesta. Ej: "Crear comite de bienvenida".', placeholder: 'ej: Crear comite de bienvenida', type: 'text' },
    { key: 'descripcion', label: 'Descripcion detallada', help: 'Explica la propuesta en detalle para que los miembros puedan votar informados.', placeholder: 'Descripcion completa de la propuesta', type: 'textarea' },
    {
      key: 'categoria',
      label: 'Categoria',
      help: 'Clasifica la propuesta en una categoria. Ej: Social, Economico, Gobernanza.',
      type: 'select',
      options: FREE_CATEGORY_OPTIONS,
    },
    { key: 'subcategoria', label: 'Subcategoria', help: 'Subcategoria opcional para mayor detalle. Ej: "bienestar_comunitario".', placeholder: 'ej: bienestar_comunitario', type: 'text' },
  ],
})

const BOARD_POSITIONS = [
  { value: 'presidente', label: 'Presidente' },
  { value: 'vicepresidente', label: 'Vicepresidente' },
  { value: 'secretario', label: 'Secretario' },
  { value: 'tesorero', label: 'Tesorero' },
  { value: 'vocal', label: 'Vocal' },
  { value: 'fiscal', label: 'Fiscal' },
]

export default function Assembly() {
  const { hasPermission } = usePermissions()
  const { currency } = useConfig()
  const canManageBoard = hasPermission('assembly.manage_board')
  const canManageTax = hasPermission('tax.manage')

  const [tab, setTab] = useState<'members' | 'board' | 'sessions' | 'proposals' | 'reports' | 'tax' | 'config'>('proposals')
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')

  // Datos
  const [votingMembers, setVotingMembers] = useState<any[]>([])
  const [memberLevels, setMemberLevels] = useState<any[]>([])
  const [board, setBoard] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [proposals, setProposals] = useState<any[]>([])
  const [taxConfig, setTaxConfig] = useState<any>(null)
  const [taxAccount, setTaxAccount] = useState<any>(null)
  const [assemblyConfigs, setAssemblyConfigs] = useState<any[]>([])
  const [editingConfig, setEditingConfig] = useState<any>(null)

  // Formularios
  const [showNewProposal, setShowNewProposal] = useState(false)
  const [showNewSession, setShowNewSession] = useState(false)
  const [showAddBoard, setShowAddBoard] = useState(false)
  const [proposalType, setProposalType] = useState<ProposalType>('limit_change')
  const [proposalFields, setProposalFields] = useState<Record<string, string>>({})
  const [proposalDesc, setProposalDesc] = useState('')
  const [votingDuration, setVotingDuration] = useState(1440) // 24h por defecto
  const [entityModes, setEntityModes] = useState<Record<string, string>>({})
  const [reports, setReports] = useState<any[]>([])
  const [reportsStats, setReportsStats] = useState<any>(null)
  const [selectedReport, setSelectedReport] = useState<any>(null)
  const [filterType, setFilterType] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedSessionForAttendance, setSelectedSessionForAttendance] = useState<string | null>(null)
  const [selectedSessionForMinutes, setSelectedSessionForMinutes] = useState<string | null>(null)
  const [attendanceList, setAttendanceList] = useState<any[]>([])
  const [minutesText, setMinutesText] = useState('')
  const [quorumConfigs, setQuorumConfigs] = useState<any[]>([])
  const [quorumResult, setQuorumResult] = useState<any>(null)
  const [rescheduleSession, setRescheduleSession] = useState<any>(null)
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [freqConfig, setFreqConfig] = useState<any>({ ordinary_frequency_months: 3, preferred_day_of_month: 15, preferred_hour: 15, notification_days_before: 7, assemblies_enabled: true })
  const [sessionFilter, setSessionFilter] = useState<'upcoming' | 'past'>('upcoming')

  const [newSession, setNewSession] = useState({ session_type: 'ordinaria', title: '', description: '', is_presential: false, start_time: '' })
  const [newBoard, setNewBoard] = useState({ user_id: '', position: 'presidente' })

  const load = () => {
    api.get('/assembly/voting-members').then((d: any) => setVotingMembers(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/member-levels').then((d: any) => setMemberLevels(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/assembly/board').then((d: any) => setBoard(Array.isArray(d) ? d : [])).catch(() => {})
    api.get(`/assembly/sessions?filter=${sessionFilter}`).then((d: any) => setSessions(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/assembly/proposals').then((d: any) => setProposals(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/tax/config').then(setTaxConfig).catch(() => {})
    api.get('/tax/account').then(setTaxAccount).catch(() => {})
    api.get('/assembly/config').then((d: any) => setAssemblyConfigs(Array.isArray(d) ? d : [])).catch(() => {})
  }

  const loadSessions = () => {
    api.get(`/assembly/sessions?filter=${sessionFilter}`).then((d: any) => setSessions(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(() => {
    if (tab === 'sessions') loadSessions()
  }, [sessionFilter, tab])

  useEffect(() => { load() }, [])

  const createProposal = async () => {
    setError('')
    if (!proposalDesc) {
      setError('La descripcion es obligatoria')
      return
    }
    try {
      await api.post('/assembly/proposals', {
        proposal_type: proposalType,
        description: proposalDesc,
        parameters: proposalFields,
        voting_duration_minutes: votingDuration,
      })
      setShowNewProposal(false)
      setProposalDesc('')
      setProposalFields({})
      setEntityModes({})
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear propuesta')
    }
  }

  const vote = async (id: string, vote: string) => {
    try {
      await api.post(`/assembly/proposals/${id}/vote`, { vote })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al votar')
    }
  }

  const execute = async (id: string) => {
    try {
      await api.post(`/assembly/proposals/${id}/execute`, {})
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al ejecutar')
    }
  }

  const openVoting = async (id: string) => {
    try {
      await api.post(`/assembly/proposals/${id}/open-voting`, {})
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al abrir votacion')
    }
  }

  const loadReports = async () => {
    try {
      const params = new URLSearchParams()
      if (filterType) params.set('type', filterType)
      if (filterFrom) params.set('from', filterFrom)
      if (filterTo) params.set('to', filterTo)
      if (filterStatus) params.set('status', filterStatus)
      const query = params.toString() ? `?${params.toString()}` : ''
      const data: any = await api.get(`/assembly/reports${query}`)
      setReports(data.reports || [])
      setReportsStats({
        total_proposals: data.total_proposals,
        approved: data.approved,
        rejected: data.rejected,
        expired: data.expired,
        pending: data.pending,
        avg_participation: data.avg_participation,
        total_voting_members: data.total_voting_members,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar informes')
    }
  }

  const loadReportDetail = async (id: string) => {
    try {
      const data: any = await api.get(`/assembly/proposals/${id}/report`)
      setSelectedReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar informe')
    }
  }

  const loadAttendance = async (sessionId: string) => {
    try {
      const data: any = await api.get(`/assembly/sessions/${sessionId}/attendance`)
      setAttendanceList(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar asistencia')
    }
  }

  const toggleAttendance = async (userId: string) => {
    if (!selectedSessionForAttendance) return
    const isPresent = attendanceList.some((a: any) => a.user_id === userId)
    try {
      if (isPresent) {
        await api.delete(`/assembly/sessions/${selectedSessionForAttendance}/attendance/${userId}`)
      } else {
        await api.post(`/assembly/sessions/${selectedSessionForAttendance}/attendance`, { user_ids: [userId] })
      }
      loadAttendance(selectedSessionForAttendance)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar asistencia')
    }
  }

  const saveMinutes = async (sessionId: string) => {
    try {
      await api.put(`/assembly/sessions/${sessionId}/minutes`, { minutes: minutesText })
      setSelectedSessionForMinutes(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar minuta')
    }
  }

  const loadQuorumConfigs = async () => {
    try {
      const data: any = await api.get('/assembly/quorum-config')
      setQuorumConfigs(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar config de quorum')
    }
  }

  const loadFreqConfig = async () => {
    try {
      const data: any = await api.get('/assembly/frequency-config')
      setFreqConfig(data)
    } catch (err) { /* ignore */ }
  }

  const saveFreqConfig = async () => {
    try {
      await api.put('/assembly/frequency-config', freqConfig)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar frecuencia')
    }
  }

  const closeAssemblySession = async (sessionId: string) => {
    if (!confirm('Cerrar esta asamblea? Se convocara automaticamente la siguiente asamblea ordinaria si esta configurado.')) return
    try {
      await api.post(`/assembly/sessions/${sessionId}/close`, {})
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cerrar asamblea')
    }
  }

  const updateQuorumConfig = async (sessionType: string, data: any) => {
    try {
      await api.put(`/assembly/quorum-config/${sessionType}`, data)
      loadQuorumConfigs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar quorum')
    }
  }

  const verifyQuorum = async (sessionId: string) => {
    try {
      const data: any = await api.post(`/assembly/sessions/${sessionId}/verify-quorum`, {})
      setQuorumResult(data)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al verificar quorum')
    }
  }

  const doReschedule = async (sessionId: string) => {
    try {
      await api.post(`/assembly/sessions/${sessionId}/reschedule`, { new_start_time: rescheduleTime })
      setRescheduleSession(null)
      setRescheduleTime('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reprogramar')
    }
  }

  const selfCheckIn = async (sessionId: string) => {
    try {
      await api.post(`/assembly/sessions/${sessionId}/self-checkin`, {})
      setError('')
      alert('Presencia confirmada. Gracias por validar tu asistencia.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al confirmar presencia')
    }
  }

  const createSession = async () => {
    setError('')
    if (!newSession.title) {
      setError('El titulo es obligatorio')
      return
    }
    if (!newSession.start_time) {
      setError('Debes especificar la fecha y hora de la asamblea')
      return
    }
    try {
      await api.post('/assembly/sessions', newSession)
      setShowNewSession(false)
      setNewSession({ session_type: 'ordinaria', title: '', description: '', is_presential: false, start_time: '' })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear sesion')
    }
  }

  const addBoard = async () => {
    setError('')
    if (!newBoard.user_id || !newBoard.position) {
      setError('Usuario y cargo son obligatorios')
      return
    }
    try {
      await api.post('/assembly/board', newBoard)
      setShowAddBoard(false)
      setNewBoard({ user_id: '', position: 'presidente' })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar')
    }
  }

  const removeBoard = async (id: string) => {
    try {
      await api.delete(`/assembly/board/${id}`)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const renderProposalField = (field: ProposalField) => {
    const value = proposalFields[field.key] || ''

    if (field.type === 'select') {
      return (
        <div key={field.key}>
          <label className="label">{field.label}</label>
          <select
            className="input"
            value={value}
            onChange={(e) => setProposalFields({ ...proposalFields, [field.key]: e.target.value })}
          >
            <option value="">-- Selecciona una opcion --</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">{field.help}</p>
        </div>
      )
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.key}>
          <label className="label">{field.label}</label>
          <textarea
            className="input"
            rows={3}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => setProposalFields({ ...proposalFields, [field.key]: e.target.value })}
          />
          <p className="text-xs text-gray-400 mt-1">{field.help}</p>
        </div>
      )
    }

    if (field.type === 'entity' && field.endpoint) {
      return (
        <div key={field.key}>
          <EntitySelector
            label={field.label}
            helpText={field.help}
            placeholder={field.placeholder}
            value={value}
            onChange={(v) => setProposalFields({ ...proposalFields, [field.key]: v })}
            endpoint={field.endpoint}
            valueKey={field.valueKey || 'id'}
            labelKey={field.labelKey || 'name'}
            subLabelKey={field.subLabelKey}
            filterFn={field.filterFn}
            emptyMessage={field.emptyMessage}
          />
        </div>
      )
    }

    if (field.type === 'entity_toggle' && field.entityModes) {
      const activeModeKey = entityModes[field.key] || field.entityModes[0].key
      const activeMode = field.entityModes.find((m) => m.key === activeModeKey) || field.entityModes[0]
      return (
        <div key={field.key} className="space-y-2">
          <label className="label">{field.label}</label>
          <div className="flex gap-2">
            {field.entityModes.map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => {
                  setEntityModes({ ...entityModes, [field.key]: mode.key })
                  setProposalFields({ ...proposalFields, [field.key]: '' })
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeModeKey === mode.key ? 'bg-trueque-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <EntitySelector
            label=""
            helpText={field.help}
            placeholder={field.placeholder}
            value={value}
            onChange={(v) => setProposalFields({ ...proposalFields, [field.key]: v })}
            endpoint={activeMode.endpoint}
            valueKey={activeMode.valueKey}
            labelKey={activeMode.labelKey}
            subLabelKey={activeMode.subLabelKey}
            filterFn={activeMode.filterFn}
            emptyMessage={activeMode.emptyMessage}
          />
        </div>
      )
    }

    // text / number
    return (
      <div key={field.key}>
        <label className="label">{field.label}</label>
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          className="input"
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => setProposalFields({ ...proposalFields, [field.key]: e.target.value })}
        />
        <p className="text-xs text-gray-400 mt-1">{field.help}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><VoteIcon size={24} />Asamblea</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Asamblea - Ayuda</strong></p>
          <p><strong>Para que sirve:</strong> La asamblea es el organo de gobierno de la comunidad. Aqui se toman las decisiones importantes: cambios de limites, impuestos, admisiones, expulsion, politicas, etc.</p>
          <p><strong>Miembros con voto:</strong> Los miembros de la asamblea son los mismos miembros de la comunidad que tienen derecho a voto (segun su nivel). No se registran aparte. Los niveles de miembro definen quien tiene voz, quien tiene voto, y quien cuenta para el quorum.</p>
          <p><strong>Junta Directiva:</strong> Grupo de personas elegidas para decisiones que no requieren asamblea completa. Puede firmar decisiones con multi-firma.</p>
          <p><strong>Sesiones:</strong> Reuniones de asamblea (ordinarias, extraordinarias, urgentes). Las propuestas se discuten en sesiones.</p>
          <p><strong>Propuestas:</strong> Decisiones que se someten a votacion. Cada miembro con voto puede votar a favor, en contra o abstenerse. Cuando todos han votado, se ejecuta si hay mas votos a favor.</p>
          <p><strong>Impuestos:</strong> La asamblea decide la tasa de impuesto sobre transacciones. El dinero recaudado va a una cuenta de impuestos. La asamblea decide que hacer con ese dinero.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('proposals')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'proposals' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Propuestas</button>
        <button onClick={() => setTab('reports')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'reports' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Informes de Votacion</button>
        <button onClick={() => setTab('members')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'members' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Miembros con voto</button>
        <button onClick={() => setTab('board')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'board' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Junta Directiva</button>
        <button onClick={() => setTab('sessions')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'sessions' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Sesiones</button>
        <button onClick={() => setTab('tax')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'tax' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Impuestos</button>
        <button onClick={() => setTab('config')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'config' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Configuracion</button>
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {/* ===== PROPUESTAS ===== */}
      {tab === 'proposals' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><VoteIcon size={18} />Propuestas de Asamblea</h2>
            <button onClick={() => setShowNewProposal(!showNewProposal)} className="btn-primary flex items-center gap-2"><Plus size={18} />Nueva Propuesta</button>
          </div>

          {showNewProposal && (
            <div className="card space-y-4">
              <h3 className="font-semibold">Nueva Propuesta</h3>

              <div>
                <label className="label">Tipo de propuesta</label>
                <select className="input" value={proposalType} onChange={(e) => { setProposalType(e.target.value as ProposalType); setProposalFields({}); setEntityModes({}) }}>
                  {Object.entries(PROPOSAL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">{PROPOSAL_HELP[proposalType]}</p>
              </div>

              {PROPOSAL_FIELDS(currency)[proposalType]?.map((field) => renderProposalField(field))}

              <div>
                <label className="label">Descripcion de la propuesta</label>
                <textarea className="input" rows={3} placeholder="Explica la propuesta para que los miembros puedan votar informados" value={proposalDesc} onChange={(e) => setProposalDesc(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">Explica claramente la decision que se somete a votacion. Los miembros usaran este texto para decidir su voto.</p>
              </div>

              <div>
                <label className="label">Tiempo limite para votar</label>
                <select className="input" value={votingDuration} onChange={(e) => setVotingDuration(parseInt(e.target.value))}>
                  <option value={5}>5 minutos (votacion en asamblea presencial)</option>
                  <option value={10}>10 minutos (asamblea presencial, discusion breve)</option>
                  <option value={30}>30 minutos (asamblea presencial, discusion extendida)</option>
                  <option value={60}>1 hora (discusion prolongada)</option>
                  <option value={1440}>24 horas (votacion remota, gente vota desde casa)</option>
                  <option value={10080}>7 dias (consulta prolongada)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Cuando se venza el tiempo, la propuesta se rechaza automaticamente. Para revotar hay que crear una propuesta nueva.</p>
              </div>

              <button onClick={createProposal} className="btn-primary">Crear Propuesta</button>
            </div>
          )}

          {proposals.length === 0 && !showNewProposal ? (
            <div className="card text-center text-gray-500 py-8">
              <p>No hay propuestas.</p>
              <p className="text-xs mt-2">Crea una propuesta para que la asamblea la revise.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Propuestas pendientes de revision (proposed) */}
              {proposals.filter((p: any) => p.status === 'proposed').length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm text-purple-700 flex items-center gap-2">
                    <Clock size={16} />Pendientes de revision por la asamblea ({proposals.filter((p: any) => p.status === 'proposed').length})
                  </h3>
                  <p className="text-xs text-gray-500">Estas propuestas fueron creadas pero la asamblea todavia no las ha aprobado para votacion.</p>
                  {proposals.filter((p: any) => p.status === 'proposed').map((p: any, i: number) => (
                    <div key={i} className="card border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{PROPOSAL_LABELS[p.proposal_type as ProposalType] || p.proposal_type}</span>
                          <span className="ml-2 text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">pendiente de revision</span>
                        </div>
                        <span className="text-xs text-gray-400">{p.created_at?.slice(0, 10)}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{p.description}</p>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => openVoting(p.id)}
                          className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Abrir votacion
                        </button>
                        <span className="text-xs text-gray-400 self-center">Duracion: {p.voting_duration_minutes || 1440} min</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Propuestas en votacion y resultados */}
              {proposals.filter((p: any) => p.status !== 'proposed').length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm text-gray-700 flex items-center gap-2">
                    <VoteIcon size={16} />En votacion y resultados ({proposals.filter((p: any) => p.status !== 'proposed').length})
                  </h3>
                  {proposals.filter((p: any) => p.status !== 'proposed').map((p: any, i: number) => (
                    <div key={i} className="card">
                    <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{PROPOSAL_LABELS[p.proposal_type as ProposalType] || p.proposal_type}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                        p.status === 'executed' ? 'bg-green-100 text-green-700' :
                        p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        p.status === 'expired' ? 'bg-orange-100 text-orange-700' :
                        p.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{p.status === 'expired' ? 'vencida' : p.status === 'pending' ? 'en votacion' : p.status}</span>
                    </div>
                    <span className="text-xs text-gray-400">{p.created_at?.slice(0, 10)}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{p.description}</p>

                  {/* Votos (secreto: solo cantidades, no quien voto) */}
                  <div className="flex items-center gap-4 mt-3 text-sm flex-wrap">
                    <span className="text-green-600 font-medium">A favor: {p.votes_for || 0}</span>
                    <span className="text-red-600 font-medium">En contra: {p.votes_against || 0}</span>
                    <span className="text-gray-500 font-medium">Abstencion: {p.votes_abstain || 0}</span>
                    <span className="text-gray-400 font-medium">No emitidos: {p.votes_not_cast ?? 0}</span>
                    {p.total_voting_members > 0 && (
                      <span className="text-gray-400 text-xs">de {p.total_voting_members} con derecho a voto</span>
                    )}
                  </div>

                  {/* Tiempo limite / countdown */}
                  {p.status === 'pending' && p.voting_deadline && (
                    <div className="mt-2 text-xs text-orange-600 font-medium">
                      {(() => {
                        const deadline = new Date(p.voting_deadline).getTime()
                        const now = Date.now()
                        const remaining = deadline - now
                        if (remaining <= 0) return 'Tiempo agotado'
                        const mins = Math.floor(remaining / 60000)
                        const hrs = Math.floor(mins / 60)
                        const days = Math.floor(hrs / 24)
                        if (days > 0) return `Quedan ${days}d ${hrs % 24}h para votar`
                        if (hrs > 0) return `Quedan ${hrs}h ${mins % 60}m para votar`
                        return `Quedan ${mins} minutos para votar`
                      })()}
                    </div>
                  )}
                  {p.status === 'expired' && (
                    <div className="mt-2 text-xs text-orange-600">
                      El tiempo de votacion expiro. Crea una propuesta nueva para revotar.
                    </div>
                  )}

                  {/* Botones de voto */}
                  {p.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => vote(p.id, 'for')} className="btn-secondary text-green-600 flex items-center gap-1"><Check size={16} />A favor</button>
                      <button onClick={() => vote(p.id, 'against')} className="btn-secondary text-red-600 flex items-center gap-1"><X size={16} />En contra</button>
                      <button onClick={() => vote(p.id, 'abstain')} className="btn-secondary flex items-center gap-1">Abstener</button>
                      <button onClick={() => execute(p.id)} className="btn-primary ml-auto">Ejecutar decision</button>
                    </div>
                  )}
                </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== INFORMES DE VOTACION ===== */}
      {tab === 'reports' && (
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><FileText size={18} />Informes de Votacion</h2>

          {/* Estadisticas generales */}
          {reportsStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="card text-center">
                <div className="text-2xl font-bold text-trueque-600">{reportsStats.total_proposals}</div>
                <div className="text-xs text-gray-500">Total propuestas</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-green-600">{reportsStats.approved}</div>
                <div className="text-xs text-gray-500">Aprobadas</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-red-600">{reportsStats.rejected}</div>
                <div className="text-xs text-gray-500">Rechazadas</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-orange-600">{reportsStats.expired}</div>
                <div className="text-xs text-gray-500">Vencidas</div>
              </div>
            </div>
          )}

          {reportsStats && (
            <div className="card text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Participacion promedio:</span><span className="font-medium">{reportsStats.avg_participation}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Miembros con derecho a voto:</span><span className="font-medium">{reportsStats.total_voting_members}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Propuestas pendientes:</span><span className="font-medium">{reportsStats.pending}</span></div>
            </div>
          )}

          {/* Boton cargar */}
          {reports.length === 0 && !filterType && !filterFrom && !filterTo && !filterStatus && (
            <button onClick={loadReports} className="btn-primary">Cargar informes</button>
          )}

          {/* Filtros de busqueda */}
          {(reports.length > 0 || filterType || filterFrom || filterTo || filterStatus) && (
            <div className="card space-y-3">
              <h3 className="font-medium text-sm">Buscar votaciones por fecha, tipo o resultado</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tipo de votacion</label>
                  <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="input text-sm"
                  >
                    <option value="">Todos los tipos</option>
                    <option value="limit_change">Cambio de limites</option>
                    <option value="tax_change">Cambio de impuesto</option>
                    <option value="member_level">Nivel de miembro</option>
                    <option value="org_level">Nivel de organizacion</option>
                    <option value="admission">Admision</option>
                    <option value="expulsion">Expulsion</option>
                    <option value="budget_increase">Aumento de presupuesto</option>
                    <option value="fund_distribution">Distribucion de fondos</option>
                    <option value="energy_rate_change">Cambio tarifa energetica</option>
                    <option value="federation_config">Configuracion federacion</option>
                    <option value="recovery_config">Configuracion recuperacion</option>
                    <option value="policy">Politica general</option>
                    <option value="create_account">Creacion de cuenta</option>
                    <option value="product_modification">Modificacion de producto</option>
                    <option value="governance_rule">Regla de gobernanza</option>
                    <option value="free_proposal">Propuesta libre</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Desde</label>
                  <input
                    type="date"
                    value={filterFrom}
                    onChange={e => setFilterFrom(e.target.value)}
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Hasta</label>
                  <input
                    type="date"
                    value={filterTo}
                    onChange={e => setFilterTo(e.target.value)}
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Resultado</label>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="input text-sm"
                  >
                    <option value="">Todos</option>
                    <option value="pending">Pendientes</option>
                    <option value="executed">Aprobadas</option>
                    <option value="rejected">Rechazadas</option>
                    <option value="expired">Vencidas</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={loadReports} className="btn-primary text-sm">Buscar</button>
                <button
                  onClick={() => { setFilterType(''); setFilterFrom(''); setFilterTo(''); setFilterStatus(''); loadReports() }}
                  className="btn-secondary text-sm"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          )}

          {/* Lista de informes */}
          {reports.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">{reports.length} votaciones registradas</span>
                <button onClick={loadReports} className="text-xs text-blue-600 underline">Actualizar</button>
              </div>
              {reports.map((rp: any, i: number) => (
                <div key={i} className="card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{PROPOSAL_LABELS[rp.proposal_type as ProposalType] || rp.proposal_type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          rp.status === 'executed' ? 'bg-green-100 text-green-700' :
                          rp.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          rp.status === 'expired' ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{rp.result}</span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{rp.description}</p>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <span className="text-green-600">A favor: {rp.votes_for}</span>
                        <span className="text-red-600">En contra: {rp.votes_against}</span>
                        <span className="text-gray-500">Abstencion: {rp.votes_abstain}</span>
                        <span className="text-gray-400">No emitidos: {rp.votes_not_cast}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-1">
                        <span>Participacion: {rp.participation_pct.toFixed(1)}%</span>
                        <span>Aprobacion: {rp.approval_pct.toFixed(1)}%</span>
                        <span>{rp.created_at?.slice(0, 16).replace('T', ' ')}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => loadReportDetail(rp.id)}
                      className="text-xs text-blue-600 underline ml-2"
                    >
                      Ver detalle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal de detalle del informe */}
          {selectedReport && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedReport(null)}>
              <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-bold">Informe de Votacion</h3>
                  <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
                </div>
                <div className="p-4 space-y-4 text-sm">
                  {/* Datos generales */}
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">Tipo de propuesta:</span><span className="font-medium">{PROPOSAL_LABELS[selectedReport.proposal_type as ProposalType] || selectedReport.proposal_type}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Estado:</span><span className="font-medium">{selectedReport.result}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Fecha de creacion:</span><span className="font-medium">{selectedReport.created_at?.replace('T', ' ').slice(0, 19)}</span></div>
                    {selectedReport.executed_at && <div className="flex justify-between"><span className="text-gray-500">Fecha de ejecucion:</span><span className="font-medium">{selectedReport.executed_at?.replace('T', ' ').slice(0, 19)}</span></div>}
                    <div className="flex justify-between"><span className="text-gray-500">Tiempo configurado:</span><span className="font-medium">{selectedReport.configured_duration}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Duracion real de votacion:</span><span className="font-medium">{selectedReport.actual_voting_duration || 'sin votos'}</span></div>
                    {selectedReport.first_vote_at && <div className="flex justify-between"><span className="text-gray-500">Primer voto:</span><span className="font-medium">{selectedReport.first_vote_at?.replace('T', ' ').slice(0, 19)}</span></div>}
                    {selectedReport.last_vote_at && <div className="flex justify-between"><span className="text-gray-500">Ultimo voto:</span><span className="font-medium">{selectedReport.last_vote_at?.replace('T', ' ').slice(0, 19)}</span></div>}
                  </div>

                  {/* Descripcion */}
                  <div className="card bg-gray-50">
                    <div className="text-xs text-gray-500 mb-1">Descripcion</div>
                    <p className="text-sm">{selectedReport.description}</p>
                  </div>

                  {/* Conteo de votos */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="card text-center bg-green-50">
                      <div className="text-2xl font-bold text-green-600">{selectedReport.votes_for}</div>
                      <div className="text-xs text-gray-500">A favor</div>
                    </div>
                    <div className="card text-center bg-red-50">
                      <div className="text-2xl font-bold text-red-600">{selectedReport.votes_against}</div>
                      <div className="text-xs text-gray-500">En contra</div>
                    </div>
                    <div className="card text-center bg-gray-50">
                      <div className="text-2xl font-bold text-gray-600">{selectedReport.votes_abstain}</div>
                      <div className="text-xs text-gray-500">Abstencion</div>
                    </div>
                    <div className="card text-center bg-gray-50">
                      <div className="text-2xl font-bold text-gray-400">{selectedReport.votes_not_cast}</div>
                      <div className="text-xs text-gray-500">No emitidos</div>
                    </div>
                  </div>

                  {/* Porcentajes */}
                  <div className="card space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">Total votos emitidos:</span><span className="font-medium">{selectedReport.total_votes_cast} de {selectedReport.total_voting_members}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Participacion:</span><span className="font-medium">{selectedReport.participation_pct}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Aprobacion (sobre emitidos):</span><span className="font-medium">{selectedReport.approval_pct}</span></div>
                  </div>

                  {/* Timeline de votos (secreto: sin nombres) */}
                  {selectedReport.vote_timeline && selectedReport.vote_timeline.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Timeline de votos (orden de emision, voto secreto)</h4>
                      <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                        {selectedReport.vote_timeline.map((v: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className={
                              v.vote === 'a favor' ? 'text-green-600' :
                              v.vote === 'en contra' ? 'text-red-600' :
                              'text-gray-500'
                            }>{v.vote}</span>
                            <span className="text-gray-400">{v.timestamp?.replace('T', ' ').slice(0, 19)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-400 text-center pt-2">
                    El voto es secreto. Este informe muestra cantidades y tiempos, no quien voto.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {tab === 'members' && (
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Users size={18} />Miembros con Derecho a Voto</h2>
          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
            <p>Los miembros de la asamblea son los miembros de la comunidad con derecho a voto. No se registran aparte. El nivel de miembro define si tienen voz, voto, y si cuentan para el quorum.</p>
          </div>

          {/* Niveles de miembro */}
          {memberLevels.length > 0 && (
            <div className="card">
              <h3 className="font-medium mb-3">Niveles de Miembro</h3>
              <div className="space-y-2">
                {memberLevels.map((ml, i) => (
                  <div key={i} className="border-b border-gray-100 py-2 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{ml.name} (Nivel {ml.level})</span>
                      <div className="flex gap-2 text-xs">
                        {ml.has_voice && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Voz</span>}
                        {ml.has_vote && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">Voto</span>}
                        {ml.counts_in_quorum && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Quorum</span>}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{ml.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Limite credito: {ml.credit_limit} {currency} | Limite debito: {ml.debit_limit} {currency}
                      {ml.tax_rate && ` | Impuesto: ${(ml.tax_rate * 100).toFixed(2)}%`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de miembros con voto */}
          {votingMembers.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">
              <p>No hay miembros con derecho a voto.</p>
              <p className="text-xs mt-2">Los miembros aparecen aqui cuando se les asigna un nivel con derecho a voto.</p>
            </div>
          ) : (
            <div className="card">
              <h3 className="font-medium mb-3">Miembros ({votingMembers.length})</h3>
              <div className="space-y-2">
                {votingMembers.map((m, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
                    <div>
                      <span className="font-medium">{m.display_name || m.username}</span>
                      <span className="text-xs text-gray-500 ml-2">@{m.username}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{m.level_name}</span>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Voto</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== JUNTA DIRECTIVA ===== */}
      {tab === 'board' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><Crown size={18} />Junta Directiva</h2>
            {canManageBoard && (
              <button onClick={() => setShowAddBoard(!showAddBoard)} className="btn-primary flex items-center gap-2"><Plus size={18} />Asignar Miembro</button>
            )}
          </div>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
            <p>La junta directiva puede tomar decisiones con multi-firma sin necesidad de asamblea completa. Cada cargo tiene responsabilidades especificas.</p>
          </div>

          {showAddBoard && canManageBoard && (
            <div className="card space-y-4">
              <h3 className="font-semibold">Asignar Miembro de Junta</h3>
              <div>
                <label className="label">Usuario</label>
                <select className="input" value={newBoard.user_id} onChange={(e) => setNewBoard({ ...newBoard, user_id: e.target.value })}>
                  <option value="">Seleccionar miembro...</option>
                  {votingMembers.map((m: any) => (
                    <option key={m.user_id || m.id} value={m.user_id || m.id}>
                      {m.display_name || m.username} {m.level_name ? `(${m.level_name})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Solo puedes asignar miembros existentes del nodo.</p>
              </div>
              <div>
                <label className="label">Cargo</label>
                <select className="input" value={newBoard.position} onChange={(e) => setNewBoard({ ...newBoard, position: e.target.value })}>
                  {BOARD_POSITIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <button onClick={addBoard} className="btn-primary">Asignar</button>
            </div>
          )}

          {board.length === 0 && !showAddBoard ? (
            <div className="card text-center text-gray-500 py-8">
              <p>No hay junta directiva configurada.</p>
              <p className="text-xs mt-2">Asigna miembros a los cargos de la junta directiva.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {board.map((b, i) => (
                <div key={i} className="card flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Crown size={20} className="text-amber-500" />
                    <div>
                      <span className="font-medium">{b.display_name || b.username}</span>
                      <p className="text-xs text-gray-500">{BOARD_POSITIONS.find((p) => p.value === b.position)?.label || b.position}</p>
                    </div>
                  </div>
                  {canManageBoard && (
                    <button onClick={() => removeBoard(b.id)} className="text-red-500"><Trash2 size={16} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== SESIONES ===== */}
      {tab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><Calendar size={18} />Sesiones de Asamblea</h2>
            <button onClick={() => setShowNewSession(!showNewSession)} className="btn-primary flex items-center gap-2"><Plus size={18} />Nueva Sesion</button>
          </div>

          {/* Filtro: pendientes vs pasadas */}
          <div className="flex gap-2">
            <button
              onClick={() => setSessionFilter('upcoming')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${sessionFilter === 'upcoming' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}
            >
              Proximas asambleas
            </button>
            <button
              onClick={() => setSessionFilter('past')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${sessionFilter === 'past' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}
            >
              Asambleas pasadas
            </button>
          </div>

          {showNewSession && (
            <div className="card space-y-4">
              <h3 className="font-semibold">Nueva Sesion</h3>
              <div>
                <label className="label">Tipo de sesion</label>
                <select className="input" value={newSession.session_type} onChange={(e) => setNewSession({ ...newSession, session_type: e.target.value, start_time: '' })}>
                  <option value="ordinaria">Ordinaria</option>
                  <option value="extraordinaria">Extraordinaria</option>
                  <option value="urgente">Urgente</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {newSession.session_type === 'ordinaria' && 'Ordinaria = planificada. Minimo 7 dias de anticipacion.'}
                  {newSession.session_type === 'extraordinaria' && 'Extraordinaria = fuera de plan. Minimo 24 horas de anticipacion.'}
                  {newSession.session_type === 'urgente' && 'Urgente = decision rapida. Minimo 1 hora de anticipacion.'}
                </p>
              </div>
              <div>
                <label className="label">Fecha y hora</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={newSession.start_time}
                  onChange={(e) => {
                    // Convertir a ISO 8601
                    const val = e.target.value
                    if (val) {
                      const iso = new Date(val).toISOString()
                      setNewSession({ ...newSession, start_time: iso })
                    } else {
                      setNewSession({ ...newSession, start_time: '' })
                    }
                  }}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {newSession.session_type === 'ordinaria' && 'La fecha debe ser al menos 7 dias desde ahora.'}
                  {newSession.session_type === 'extraordinaria' && 'La fecha debe ser al menos 24 horas desde ahora.'}
                  {newSession.session_type === 'urgente' && 'La fecha debe ser al menos 1 hora desde ahora.'}
                </p>
              </div>
              <div>
                <label className="label">Titulo</label>
                <input className="input" placeholder="Ej: Asamblea mensual marzo" value={newSession.title} onChange={(e) => setNewSession({ ...newSession, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Descripcion (opcional)</label>
                <textarea className="input" rows={2} placeholder="Temas a tratar" value={newSession.description} onChange={(e) => setNewSession({ ...newSession, description: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_presential"
                  checked={newSession.is_presential}
                  onChange={(e) => setNewSession({ ...newSession, is_presential: e.target.checked })}
                  className="accent-trueque-600"
                />
                <label htmlFor="is_presential" className="text-sm">
                  <strong>Asamblea presencial</strong> - Solo pueden votar los miembros presentes en la lista de asistencia
                </label>
              </div>
              <p className="text-xs text-gray-400">
                Si es presencial, despues de crear la sesion debes pasar la lista de asistencia.
                Los miembros que no esten en la lista no podran votar en esta asamblea.
              </p>
              <button onClick={createSession} className="btn-primary">Crear Sesion</button>
            </div>
          )}

          {sessions.length === 0 && !showNewSession ? (
            <div className="card text-center text-gray-500 py-8">
              <p>No hay sesiones programadas.</p>
              <p className="text-xs mt-2">Crea una sesion para discutir propuestas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s, i) => (
                <div key={i} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.title}</span>
                      {s.is_presential && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">Presencial</span>
                      )}
                      {!s.is_presential && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">Remota</span>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      s.status === 'active' ? 'bg-green-100 text-green-700' :
                      s.status === 'scheduled' ? 'bg-yellow-100 text-yellow-700' :
                      s.status === 'waiting_quorum' ? 'bg-orange-100 text-orange-700' :
                      s.status === 'rescheduled' ? 'bg-blue-100 text-blue-700' :
                      s.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{
                      s.status === 'waiting_quorum' ? 'esperando quorum' :
                      s.status === 'rescheduled' ? 'reprogramada' :
                      s.status === 'cancelled' ? 'cancelada' :
                      s.status
                    }</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{s.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Tipo: {s.session_type} | {s.start_time?.slice(0, 16).replace('T', ' ')}
                    {s.recall_number > 0 && <span className="text-orange-600"> | Llamado #{s.recall_number + 1}</span>}
                    {s.quorum_verified && <span className="text-green-600"> | Quorum verificado</span>}
                  </p>

                  {/* Minuta */}
                  {s.minutes && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                      <strong>Minuta:</strong>
                      <p className="whitespace-pre-wrap mt-1 max-h-32 overflow-y-auto">{s.minutes}</p>
                    </div>
                  )}

                  {/* Botones de gestion */}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {s.is_presential && (
                      <button
                        onClick={() => { setSelectedSessionForAttendance(s.id); loadAttendance(s.id) }}
                        className="text-xs px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        Pasar lista de asistencia
                      </button>
                    )}
                    {s.is_presential && (s.status === 'scheduled' || s.status === 'waiting_quorum') && (
                      <button
                        onClick={() => verifyQuorum(s.id)}
                        className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Verificar quorum
                      </button>
                    )}
                    {s.is_presential && s.status === 'waiting_quorum' && (
                      <button
                        onClick={() => selfCheckIn(s.id)}
                        className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Confirmar mi presencia
                      </button>
                    )}
                    {s.is_presential && (s.status === 'rescheduled' || s.status === 'waiting_quorum') && (
                      <button
                        onClick={() => { setRescheduleSession(s); setRescheduleTime('') }}
                        className="text-xs px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700"
                      >
                        Reprogramar (segundo llamado)
                      </button>
                    )}
                    <button
                      onClick={() => { setSelectedSessionForMinutes(s.id); setMinutesText(s.minutes || '') }}
                      className="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                      {s.minutes ? 'Editar minuta' : 'Escribir minuta'}
                    </button>
                    {(s.status === 'active' || s.status === 'waiting_quorum') && (
                      <button
                        onClick={() => closeAssemblySession(s.id)}
                        className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 ml-2"
                      >
                        Cerrar asamblea
                      </button>
                    )}
                  </div>

                  {/* Resultado de verificacion de quorum */}
                  {quorumResult && quorumResult.session_id === s.id && (
                    <div className={`mt-2 p-3 rounded text-sm ${
                      quorumResult.has_quorum ? 'bg-green-50 text-green-700' :
                      quorumResult.status === 'cancelled' ? 'bg-red-50 text-red-700' :
                      'bg-orange-50 text-orange-700'
                    }`}>
                      <p className="font-medium">{quorumResult.message}</p>
                      <div className="flex gap-4 mt-1 text-xs">
                        <span>Presentes: {quorumResult.present_count} de {quorumResult.total_voting_members}</span>
                        <span>Asistencia: {quorumResult.attendance_pct}</span>
                        <span>Quorum requerido: {quorumResult.applied_quorum_pct}%</span>
                        {quorumResult.pending_confirmation > 0 && (
                          <span className="text-blue-600">Pendientes por confirmar: {quorumResult.pending_confirmation}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Modal de asistencia */}
          {selectedSessionForAttendance && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedSessionForAttendance(null)}>
              <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-bold">Lista de Asistencia</h3>
                  <button onClick={() => setSelectedSessionForAttendance(null)} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
                </div>
                <div className="p-4 space-y-4">
                  <p className="text-sm text-gray-600">
                    Marca los miembros presentes en la asamblea. Solo los miembros marcados podran votar en esta sesion presencial.
                  </p>

                  {/* Lista de miembros con checkbox */}
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {votingMembers.map((m: any) => {
                      const isPresent = attendanceList.some((a: any) => a.user_id === m.id)
                      return (
                        <label key={m.id} className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${isPresent ? 'bg-green-50 border-green-300' : 'border-gray-200'}`}>
                          <input
                            type="checkbox"
                            checked={isPresent}
                            onChange={() => toggleAttendance(m.id)}
                            className="accent-trueque-600"
                          />
                          <span className="text-sm">{m.display_name || m.username}</span>
                          {isPresent && <span className="text-xs text-green-600">Presente</span>}
                        </label>
                      )
                    })}
                  </div>

                  {attendanceList.length > 0 && (
                    <div className="text-sm text-gray-600">
                      {attendanceList.length} miembros presentes
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setSelectedSessionForAttendance(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cerrar</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal de minuta */}
          {selectedSessionForMinutes && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedSessionForMinutes(null)}>
              <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-bold">Minuta de la Asamblea</h3>
                  <button onClick={() => setSelectedSessionForMinutes(null)} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-sm text-gray-600">
                    Escribe aqui todas las decisiones tomadas en la asamblea. Esta minuta queda registrada permanentemente como documento oficial.
                  </p>
                  <textarea
                    className="input min-h-[300px]"
                    placeholder="Ej:&#10;&#10;Asamblea del 15 de marzo de 2024&#10;&#10;1. Se aprobo por mayoria cambiar el limite de credito a 1000 TQ&#10;2. Se rechazo la propuesta de aumentar el impuesto al 3%&#10;3. Se admitio a Maria Rodriguez como miembro nuevo&#10;4. Pendiente: revisar el presupuesto del fondo comunitario"
                    value={minutesText}
                    onChange={e => setMinutesText(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setSelectedSessionForMinutes(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                    <button onClick={() => saveMinutes(selectedSessionForMinutes)} className="px-4 py-2 bg-trueque-600 text-white rounded-lg hover:bg-trueque-700">Guardar minuta</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal de reprogramacion */}
          {rescheduleSession && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setRescheduleSession(null)}>
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-bold">Reprogramar Asamblea</h3>
                  <button onClick={() => setRescheduleSession(null)} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-sm text-gray-600">
                    La asamblea no alcanzo el quorum en el llamado #{(rescheduleSession.recall_number || 0) + 1}.
                    Al reprogramar, se crea el llamado #{(rescheduleSession.recall_number || 0) + 2} con un quorum mas bajo.
                    La lista de asistencia se reinicia: los miembros deben volver a confirmar su presencia.
                  </p>
                  <div>
                    <label className="label">Nueva fecha y hora</label>
                    <input
                      type="datetime-local"
                      className="input"
                      value={rescheduleTime}
                      onChange={e => setRescheduleTime(new Date(e.target.value).toISOString())}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setRescheduleSession(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                    <button
                      onClick={() => doReschedule(rescheduleSession.id)}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                      disabled={!rescheduleTime}
                    >
                      Reprogramar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== IMPUESTOS ===== */}
      {tab === 'tax' && (
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><DollarSign size={18} />Configuracion de Impuestos</h2>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
            <p><strong>Impuestos - Como funciona</strong></p>
            <p>Los impuestos sobre las transacciones llegan automaticamente a la <strong>cuenta de la asamblea</strong>. Esta cuenta ya existe, no hay que configurarla.</p>
            <p>Lo que se decide en asamblea es <strong>a donde distribuir</strong> ese dinero: transferir a una organizacion, departamento, responsable o proyecto.</p>
            <p>Para cambiar la tasa de impuesto, crea una propuesta de tipo "Cambio de impuestos" en la pestana Propuestas.</p>
          </div>

          {taxConfig && (
            <div className="card">
              <h3 className="font-medium mb-3">Configuracion Actual</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="label">Tasa de impuesto</label>
                  <b>{taxConfig.tax_rate ? `${(taxConfig.tax_rate * 100).toFixed(2)}%` : '0%'}</b>
                </div>
                <div>
                  <label className="label">Estado</label>
                  <b>{taxConfig.is_active ? 'Activo' : 'Inactivo'}</b>
                </div>
                <div>
                  <label className="label">Aplica a</label>
                  <b>{taxConfig.applies_to || 'Todas las transacciones'}</b>
                </div>
                <div>
                  <label className="label">Monto minimo</label>
                  <b>{taxConfig.min_amount || 0} {currency}</b>
                </div>
              </div>
            </div>
          )}

          {taxAccount && (
            <div className="card">
              <h3 className="font-medium mb-3">Cuenta de la Asamblea (Impuestos)</h3>
              {taxAccount.tax_account ? (
                <div className="text-sm">
                  <p><span className="text-gray-500">Cuenta:</span> <b>{taxAccount.tax_account}</b></p>
                  <p className="mt-1"><span className="text-gray-500">Balance recaudado:</span> <b className="text-trueque-700">{taxAccount.balance} {currency}</b></p>
                  <p className="mt-2 text-xs text-gray-500">Los impuestos llegan automaticamente a esta cuenta. Para gastar este dinero, crea una propuesta de "Distribucion de fondos" en asamblea.</p>
                </div>
              ) : (
                <p className="text-sm text-amber-600">La cuenta de la asamblea se crea automaticamente al instalar el nodo. Si no aparece, contacta al administrador.</p>
              )}
            </div>
          )}

          {canManageTax && (
            <div className="card border-amber-200">
              <h3 className="font-medium mb-2">Administracion de Impuestos</h3>
              <p className="text-xs text-gray-500 mb-3">El administrador puede cambiar la tasa de impuesto directamente durante la configuracion inicial del sistema. Una vez que la asamblea este funcionando, los cambios se hacen por votacion.</p>
              <p className="text-xs text-gray-500">Para distribuir los fondos recaudados, crea una propuesta de "Distribucion de fondos" indicando la cuenta destino y el monto.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'config' && (
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Shield size={18} />Configuracion de Asamblea</h2>

          {/* ===== Configuracion de quorum ===== */}
          <div className="card bg-purple-50 border-purple-200 text-sm text-gray-700 space-y-2">
            <p><strong>Quorum de Asamblea - Ayuda</strong></p>
            <p>El quorum es el porcentaje minimo de miembros con derecho a voto que deben estar presentes para que la asamblea sea valida.</p>
            <ul className="list-disc list-inside space-y-1">
              <li><b>Primer llamado</b>: porcentaje requerido en la fecha original.</li>
              <li><b>Segundo llamado</b>: porcentaje reducido si se reprograma (ej: 50% primer llamado, 30% segundo llamado).</li>
              <li><b>Periodo de gracia</b>: horas que se esperan despues de la hora de inicio antes de declarar la asamblea invalida.</li>
              <li><b>Maximo rellamados</b>: cuantas veces se puede reprogramar la misma asamblea.</li>
            </ul>
            <p>Si no se alcanza el quorum despues del periodo de gracia, la asamblea se puede reprogramar (si esta permitido) o se cancela.</p>
          </div>

          {quorumConfigs.length === 0 ? (
            <button onClick={loadQuorumConfigs} className="btn-primary">Cargar configuracion de quorum</button>
          ) : (
            <div className="space-y-3">
              {quorumConfigs.map((qc: any) => (
                <QuorumConfigCard key={qc.id} config={qc} onSave={updateQuorumConfig} />
              ))}
            </div>
          )}

          {/* ===== Convocatoria automatica ===== */}
          <h3 className="font-semibold flex items-center gap-2 mt-6"><Calendar size={18} />Convocatoria Automatica</h3>
          <div className="card space-y-4">
            <p className="text-sm text-gray-600">Configura cada cuanto se convoca la asamblea ordinaria. Al cerrar una asamblea, se agenda la siguiente automaticamente.</p>
            <button onClick={loadFreqConfig} className="text-sm text-blue-600 underline">Cargar configuracion</button>
            <div>
              <label className="label">Frecuencia de asambleas ordinarias</label>
              <select className="input" value={freqConfig.ordinary_frequency_months} onChange={e => setFreqConfig({ ...freqConfig, ordinary_frequency_months: parseInt(e.target.value) })}>
                <option value={0}>No auto-convocar</option>
                <option value={1}>Cada mes</option>
                <option value={2}>Cada 2 meses</option>
                <option value={3}>Cada 3 meses (trimestral)</option>
                <option value={6}>Cada 6 meses (semestral)</option>
                <option value={12}>Cada 12 meses (anual)</option>
              </select>
            </div>
            {freqConfig.ordinary_frequency_months > 0 && (
              <>
                <div>
                  <label className="label">Dia preferido del mes</label>
                  <select className="input" value={freqConfig.preferred_day_of_month} onChange={e => setFreqConfig({ ...freqConfig, preferred_day_of_month: parseInt(e.target.value) })}>
                    <option value={0}>Cualquier dia</option>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>Dia {d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Hora preferida</label>
                  <select className="input" value={freqConfig.preferred_hour} onChange={e => setFreqConfig({ ...freqConfig, preferred_hour: parseInt(e.target.value) })}>
                    {Array.from({ length: 24 }, (_, i) => i).map(h => (
                      <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Notificar con anticipacion</label>
                  <select className="input" value={freqConfig.notification_days_before} onChange={e => setFreqConfig({ ...freqConfig, notification_days_before: parseInt(e.target.value) })}>
                    <option value={1}>1 dia antes</option>
                    <option value={3}>3 dias antes</option>
                    <option value={7}>7 dias antes</option>
                    <option value={14}>14 dias antes</option>
                    <option value={30}>30 dias antes</option>
                  </select>
                </div>
              </>
            )}
            <button onClick={saveFreqConfig} className="btn-primary">Guardar frecuencia</button>
          </div>
          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
            <p><strong>Reglas de convocatoria:</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
              <li>Al cerrar una asamblea ordinaria, se agenda la siguiente automaticamente</li>
              <li>Si se modifica la fecha de una asamblea ordinaria, sigue siendo ordinaria</li>
              <li>Si se crea una asamblea nueva ademas de la ordinaria, esa es extraordinaria</li>
              <li>Los miembros reciben notificacion con la anticipacion configurada</li>
              <li>Las asambleas extraordinarias no se auto-convocan</li>
            </ul>
          </div>

          {/* ===== Configuracion de aprobaciones ===== */}
          <h3 className="font-semibold flex items-center gap-2 mt-6"><Shield size={18} />Configuracion de Aprobaciones</h3>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
            <p><strong>Configuracion de Aprobaciones - Ayuda</strong></p>
            <p>Aqui se define como se aprueba cada tipo de decision de la comunidad. Cada tipo de propuesta puede tener un metodo de aprobacion diferente:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><b>Asamblea</b>: Los miembros votan. Se aprueba si el porcentaje de votos a favor supera el umbral configurado (ej: 50% = mayoria simple, 66.67% = 2/3).</li>
              <li><b>Junta Directiva</b>: La junta directiva del nodo decide.</li>
              <li><b>Consejo</b>: Un consejo especifico decide (selecciona cual).</li>
              <li><b>Multi-firma</b>: Personas especificas deben firmar. Se aprueba cuando se alcanza el numero de firmas requeridas.</li>
            </ul>
            <p>El <b>quorum</b> es el numero minimo de miembros que deben votar para que la decision sea valida. Si es 0, no hay minimo.</p>
          </div>

          {assemblyConfigs.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">
              <p>No hay configuracion cargada.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assemblyConfigs.map((cfg: any) => (
                <div key={cfg.id} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <b className="text-sm">{PROPOSAL_LABELS[cfg.proposal_type as ProposalType] || cfg.proposal_type}</b>
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{cfg.approval_method}</span>
                      </div>
                      {cfg.description && <p className="text-xs text-gray-500 mt-1">{cfg.description}</p>}
                      <div className="flex gap-4 mt-2 text-xs text-gray-600">
                        <span>Porcentaje: <b>{cfg.required_percentage}%</b></span>
                        <span>Quorum: <b>{cfg.required_quorum}</b></span>
                        {cfg.approval_method === 'multisig' && <span>Firmas: <b>{cfg.required_signatures}</b></span>}
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingConfig(editingConfig?.id === cfg.id ? null : cfg)}
                      className="text-blue-500 hover:bg-blue-50 p-2 rounded text-sm"
                    >
                      Editar
                    </button>
                  </div>
                  {editingConfig?.id === cfg.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                      <div>
                        <label className="label">Metodo de aprobacion</label>
                        <select
                          className="input"
                          value={editingConfig.approval_method}
                          onChange={(e) => setEditingConfig({ ...editingConfig, approval_method: e.target.value })}
                        >
                          <option value="assembly">Asamblea (votacion)</option>
                          <option value="board">Junta Directiva</option>
                          <option value="council">Consejo</option>
                          <option value="multisig">Multi-firma</option>
                        </select>
                      </div>
                      {editingConfig.approval_method === 'assembly' && (
                        <>
                          <div>
                            <label className="label">Porcentaje requerido (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="input"
                              value={editingConfig.required_percentage}
                              onChange={(e) => setEditingConfig({ ...editingConfig, required_percentage: parseFloat(e.target.value) || 0 })}
                            />
                            <p className="text-xs text-gray-400 mt-1">50 = mayoria simple. 66.67 = 2/3. 75 = 3/4. 100 = unanimidad.</p>
                          </div>
                          <div>
                            <label className="label">Quorum minimo (numero de votantes)</label>
                            <input
                              type="number"
                              className="input"
                              value={editingConfig.required_quorum}
                              onChange={(e) => setEditingConfig({ ...editingConfig, required_quorum: parseInt(e.target.value) || 0 })}
                            />
                            <p className="text-xs text-gray-400 mt-1">Minimo de miembros que deben votar. 0 = sin minimo.</p>
                          </div>
                        </>
                      )}
                      {editingConfig.approval_method === 'multisig' && (
                        <div>
                          <label className="label">Firmas requeridas</label>
                          <input
                            type="number"
                            className="input"
                            value={editingConfig.required_signatures}
                            onChange={(e) => setEditingConfig({ ...editingConfig, required_signatures: parseInt(e.target.value) || 1 })}
                          />
                          <p className="text-xs text-gray-400 mt-1">Numero de personas que deben firmar para aprobar.</p>
                        </div>
                      )}
                      <div>
                        <label className="label">Descripcion</label>
                        <input
                          className="input"
                          value={editingConfig.description || ''}
                          onChange={(e) => setEditingConfig({ ...editingConfig, description: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              await api.put(`/assembly/config/${cfg.proposal_type}`, {
                                approval_method: editingConfig.approval_method,
                                required_percentage: editingConfig.required_percentage,
                                required_quorum: editingConfig.required_quorum,
                                required_signatures: editingConfig.required_signatures,
                                description: editingConfig.description,
                              })
                              setEditingConfig(null)
                              load()
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'Error')
                            }
                          }}
                          className="btn-primary text-sm"
                        >
                          Guardar
                        </button>
                        <button onClick={() => setEditingConfig(null)} className="btn-secondary text-sm">Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Componente para editar configuracion de quorum por tipo de asamblea
function QuorumConfigCard({ config, onSave }: { config: any; onSave: (sessionType: string, data: any) => void }) {
  const [editing, setEditing] = useState(false)
  const [firstCall, setFirstCall] = useState(config.quorum_first_call)
  const [secondCall, setSecondCall] = useState(config.quorum_second_call)
  const [graceHours, setGraceHours] = useState(config.grace_period_hours)
  const [maxRecall, setMaxRecall] = useState(config.max_recall_count)
  const [allowReschedule, setAllowReschedule] = useState(config.allow_reschedule)

  const sessionTypeLabel: Record<string, string> = {
    ordinaria: 'Asamblea Ordinaria',
    extraordinaria: 'Asamblea Extraordinaria',
    urgente: 'Asamblea Urgente',
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <b className="text-sm">{sessionTypeLabel[config.session_type] || config.session_type}</b>
          <div className="flex gap-4 mt-1 text-xs text-gray-600">
            <span>1er llamado: <b>{config.quorum_first_call}%</b></span>
            <span>2do llamado: <b>{config.quorum_second_call}%</b></span>
            <span>Gracia: <b>{config.grace_period_hours}h</b></span>
            <span>Max. reprogramaciones: <b>{config.max_recall_count}</b></span>
          </div>
        </div>
        <button onClick={() => setEditing(!editing)} className="text-blue-500 hover:bg-blue-50 p-2 rounded text-sm">
          {editing ? 'Cerrar' : 'Editar'}
        </button>
      </div>
      {editing && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quorum 1er llamado (%)</label>
              <input type="number" step="0.01" min="0" max="100" className="input" value={firstCall} onChange={e => setFirstCall(parseFloat(e.target.value))} />
              <p className="text-xs text-gray-400">Porcentaje para la fecha original</p>
            </div>
            <div>
              <label className="label">Quorum 2do llamado (%)</label>
              <input type="number" step="0.01" min="0" max="100" className="input" value={secondCall} onChange={e => setSecondCall(parseFloat(e.target.value))} />
              <p className="text-xs text-gray-400">Porcentaje reducido si se reprograma</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Periodo de gracia (horas)</label>
              <input type="number" min="0" max="24" className="input" value={graceHours} onChange={e => setGraceHours(parseInt(e.target.value))} />
              <p className="text-xs text-gray-400">Horas que se espera antes de cancelar</p>
            </div>
            <div>
              <label className="label">Max. reprogramaciones</label>
              <input type="number" min="0" max="5" className="input" value={maxRecall} onChange={e => setMaxRecall(parseInt(e.target.value))} />
              <p className="text-xs text-gray-400">Cuantas veces se puede reprogramar</p>
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={allowReschedule} onChange={e => setAllowReschedule(e.target.checked)} className="accent-trueque-600" />
            <span className="text-sm">Permitir reprogramar si no hay quorum</span>
          </label>
          <button
            onClick={() => {
              onSave(config.session_type, {
                quorum_first_call: firstCall,
                quorum_second_call: secondCall,
                grace_period_hours: graceHours,
                max_recall_count: maxRecall,
                allow_reschedule: allowReschedule,
              })
              setEditing(false)
            }}
            className="btn-primary text-sm"
          >
            Guardar
          </button>
        </div>
      )}
    </div>
  )
}
