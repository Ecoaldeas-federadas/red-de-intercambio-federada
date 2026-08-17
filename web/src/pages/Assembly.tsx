import { useState, useEffect } from 'react'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { useConfig } from '../hooks/useConfig'
import { EntitySelector } from '../components/EntitySelector'
import { Plus, Check, X, HelpCircle, Users, Calendar, Shield, Vote as VoteIcon, DollarSign, Crown, Trash2 } from 'lucide-react'

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
      key: 'cuenta_organizacion',
      label: 'Cuenta u organizacion',
      help: 'Selecciona la cuenta u organizacion que recibira los fondos. Ej: coop_norte.',
      placeholder: 'ej: coop_norte',
      type: 'entity',
      endpoint: '/organizations',
      valueKey: 'name',
      labelKey: 'name',
      subLabelKey: 'description',
      emptyMessage: 'No se encontraron organizaciones',
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
    { key: 'producto', label: 'Producto', help: 'Nombre o identificador del producto a modificar. Ej: pan_integral.', placeholder: 'ej: pan_integral', type: 'text' },
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

  const [tab, setTab] = useState<'members' | 'board' | 'sessions' | 'proposals' | 'tax'>('proposals')
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

  // Formularios
  const [showNewProposal, setShowNewProposal] = useState(false)
  const [showNewSession, setShowNewSession] = useState(false)
  const [showAddBoard, setShowAddBoard] = useState(false)
  const [proposalType, setProposalType] = useState<ProposalType>('limit_change')
  const [proposalFields, setProposalFields] = useState<Record<string, string>>({})
  const [proposalDesc, setProposalDesc] = useState('')
  const [entityModes, setEntityModes] = useState<Record<string, string>>({})

  const [newSession, setNewSession] = useState({ session_type: 'ordinaria', title: '', description: '' })
  const [newBoard, setNewBoard] = useState({ user_id: '', position: 'presidente' })

  const load = () => {
    api.get('/assembly/voting-members').then((d: any) => setVotingMembers(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/member-levels').then((d: any) => setMemberLevels(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/assembly/board').then((d: any) => setBoard(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/assembly/sessions').then((d: any) => setSessions(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/assembly/proposals').then((d: any) => setProposals(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/tax/config').then(setTaxConfig).catch(() => {})
    api.get('/tax/account').then(setTaxAccount).catch(() => {})
  }

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

  const createSession = async () => {
    setError('')
    if (!newSession.title) {
      setError('El titulo es obligatorio')
      return
    }
    try {
      await api.post('/assembly/sessions', newSession)
      setShowNewSession(false)
      setNewSession({ session_type: 'ordinaria', title: '', description: '' })
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
        <button onClick={() => setTab('members')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'members' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Miembros con voto</button>
        <button onClick={() => setTab('board')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'board' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Junta Directiva</button>
        <button onClick={() => setTab('sessions')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'sessions' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Sesiones</button>
        <button onClick={() => setTab('tax')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'tax' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Impuestos</button>
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

              <button onClick={createProposal} className="btn-primary">Crear Propuesta</button>
            </div>
          )}

          {proposals.length === 0 && !showNewProposal ? (
            <div className="card text-center text-gray-500 py-8">
              <p>No hay propuestas.</p>
              <p className="text-xs mt-2">Crea una propuesta para que los miembros voten.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map((p, i) => (
                <div key={i} className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{PROPOSAL_LABELS[p.proposal_type as ProposalType] || p.proposal_type}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                        p.status === 'executed' ? 'bg-green-100 text-green-700' :
                        p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        p.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{p.status}</span>
                    </div>
                    <span className="text-xs text-gray-400">{p.created_at?.slice(0, 10)}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{p.description}</p>

                  {/* Votos */}
                  <div className="flex items-center gap-4 mt-3 text-sm">
                    <span className="text-green-600">A favor: {p.votes_for || 0}</span>
                    <span className="text-red-600">En contra: {p.votes_against || 0}</span>
                    <span className="text-gray-500">Abstencion: {p.votes_abstain || 0}</span>
                  </div>

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

      {/* ===== MIEMBROS CON VOTO ===== */}
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
                <input className="input" placeholder="Nombre de usuario (username)" value={newBoard.user_id} onChange={(e) => setNewBoard({ ...newBoard, user_id: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Username de la persona a asignar.</p>
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

          {showNewSession && (
            <div className="card space-y-4">
              <h3 className="font-semibold">Nueva Sesion</h3>
              <div>
                <label className="label">Tipo de sesion</label>
                <select className="input" value={newSession.session_type} onChange={(e) => setNewSession({ ...newSession, session_type: e.target.value })}>
                  <option value="ordinaria">Ordinaria</option>
                  <option value="extraordinaria">Extraordinaria</option>
                  <option value="urgente">Urgente</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Ordinaria = planificada. Extraordinaria = fuera de plan. Urgente = decision rapida.</p>
              </div>
              <div>
                <label className="label">Titulo</label>
                <input className="input" placeholder="Ej: Asamblea mensual marzo" value={newSession.title} onChange={(e) => setNewSession({ ...newSession, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Descripcion (opcional)</label>
                <textarea className="input" rows={2} placeholder="Temas a tratar" value={newSession.description} onChange={(e) => setNewSession({ ...newSession, description: e.target.value })} />
              </div>
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
                    <span className="font-medium">{s.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      s.status === 'active' ? 'bg-green-100 text-green-700' :
                      s.status === 'scheduled' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{s.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{s.description}</p>
                  <p className="text-xs text-gray-400 mt-1">Tipo: {s.session_type}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== IMPUESTOS ===== */}
      {tab === 'tax' && (
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><DollarSign size={18} />Configuracion de Impuestos</h2>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
            <p><strong>Impuestos - Ayuda</strong></p>
            <p>La asamblea decide la tasa de impuesto sobre las transacciones. El dinero recaudado va a una cuenta de impuestos manejada por la comunidad.</p>
            <p>Para cambiar la tasa, crea una propuesta de tipo "Cambio de impuestos" en la pestana Propuestas. La asamblea debe aprobarla.</p>
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
              <h3 className="font-medium mb-3">Cuenta de Impuestos</h3>
              {taxAccount.tax_account ? (
                <div className="text-sm">
                  <p><span className="text-gray-500">Cuenta:</span> <b>{taxAccount.tax_account}</b></p>
                  <p className="mt-1"><span className="text-gray-500">Balance recaudado:</span> <b className="text-trueque-700">{taxAccount.balance} {currency}</b></p>
                </div>
              ) : (
                <p className="text-sm text-amber-600">No hay cuenta de impuestos configurada. La asamblea debe asignar una cuenta para recibir los impuestos recaudados.</p>
              )}
            </div>
          )}

          {canManageTax && (
            <div className="card border-amber-200">
              <h3 className="font-medium mb-2">Configurar impuesto (admin)</h3>
              <p className="text-xs text-gray-500 mb-3">Solo la asamblea puede cambiar los impuestos. Crea una propuesta de "Cambio de impuestos" para que se vote.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
