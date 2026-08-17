import { useState, useEffect } from 'react'
import { api } from '../api'
import { Plus, Check, X, HelpCircle, Users, Calendar, Shield, Vote as VoteIcon } from 'lucide-react'

// ----- Tipos -----
type ProposalType =
  | 'limit_change'
  | 'admission'
  | 'expulsion'
  | 'budget_increase'
  | 'federation_config'
  | 'recovery_config'
  | 'tax_change'
  | 'member_level'
  | 'policy'

type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'executed'

interface Proposal {
  id: string
  title: string
  description: string
  proposal_type: ProposalType
  parameters?: Record<string, any>
  target?: string
  status: ProposalStatus
  votes_for?: number
  votes_against?: number
  votes_abstain?: number
  quorum?: number
  required_signatures?: number
  current_signatures?: number
}

interface Member {
  id: string
  username: string
  level?: string
  display_name?: string
}

interface BoardMember {
  id: string
  username: string
  role: string
}

interface Session {
  id: string
  title: string
  type: 'ordinaria' | 'extraordinaria' | 'urgente'
  status?: string
  date?: string
}

// ----- Ayuda contextual por tipo de propuesta -----
const PROPOSAL_HELP: Record<ProposalType, { label: string; help: string; fields: { key: string; label: string; placeholder?: string }[] }> = {
  limit_change: {
    label: 'Cambio de limite',
    help: 'Modifica los limites de credito y debito de un usuario u organizacion. Requiere indicar a quien afecta y los nuevos limites.',
    fields: [
      { key: 'usuario_organizacion', label: 'Usuario u organizacion', placeholder: 'ej: usuario123' },
      { key: 'nuevo_limite_credito', label: 'Nuevo limite de credito', placeholder: '0' },
      { key: 'nuevo_limite_debito', label: 'Nuevo limite de debito', placeholder: '0' },
    ],
  },
  admission: {
    label: 'Admision de miembro',
    help: 'Admite un nuevo miembro a la red asignandole un nivel. El objetivo debe ser el usuario a admitir.',
    fields: [
      { key: 'usuario', label: 'Usuario', placeholder: 'ej: nuevo_miembro' },
      { key: 'nivel', label: 'Nivel', placeholder: 'ej: basic, full, admin' },
    ],
  },
  expulsion: {
    label: 'Expulsion de miembro',
    help: 'Expulsa a un miembro de la red indicando la razon. Es una decision grave que suele requerir alto quorum.',
    fields: [
      { key: 'usuario', label: 'Usuario', placeholder: 'ej: usuario_a_expulsar' },
      { key: 'razon', label: 'Razon', placeholder: 'Motivo de la expulsion' },
    ],
  },
  budget_increase: {
    label: 'Aumento de presupuesto',
    help: 'Incrementa el presupuesto disponible de una organizacion por un monto determinado.',
    fields: [
      { key: 'organizacion', label: 'Organizacion', placeholder: 'ej: coop_norte' },
      { key: 'monto', label: 'Monto', placeholder: '0' },
    ],
  },
  federation_config: {
    label: 'Configuracion de federacion',
    help: 'Ajusta la configuracion de un nodo federado, por ejemplo su limite de operacion.',
    fields: [
      { key: 'nodo', label: 'Nodo', placeholder: 'ej: nodo_central' },
      { key: 'limite', label: 'Limite', placeholder: '0' },
    ],
  },
  recovery_config: {
    label: 'Configuracion de recuperacion',
    help: 'Define parametros del sistema de recuperacion de fondos o cuentas en caso de fallos.',
    fields: [],
  },
  tax_change: {
    label: 'Cambio de impuestos',
    help: 'Modifica la tasa de impuestos aplicada a las transacciones de la red.',
    fields: [
      { key: 'tasa', label: 'Tasa (%)', placeholder: '0' },
    ],
  },
  member_level: {
    label: 'Nivel de miembro',
    help: 'Crea o modifica un nivel de miembro con sus permisos y limites asociados.',
    fields: [
      { key: 'nombre_nivel', label: 'Nombre del nivel', placeholder: 'ej: full' },
      { key: 'descripcion_nivel', label: 'Descripcion del nivel', placeholder: 'Permisos y alcances' },
    ],
  },
  policy: {
    label: 'Politica general',
    help: 'Propuesta de politica general que no encaja en los tipos especificos. Describe claramente el cambio normativo.',
    fields: [],
  },
}

const STATUS_LABEL: Record<ProposalStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  executed: 'Ejecutada',
}

const STATUS_COLOR: Record<ProposalStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  executed: 'bg-blue-100 text-blue-800',
}

const SESSION_TYPE_LABEL: Record<string, string> = {
  ordinaria: 'Ordinaria',
  extraordinaria: 'Extraordinaria',
  urgente: 'Urgente',
}

export default function Assembly() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [board, setBoard] = useState<BoardMember[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    proposal_type: 'policy' as ProposalType,
    target: '',
    parameters: {} as Record<string, any>,
  })

  const [sessionForm, setSessionForm] = useState({ title: '', type: 'ordinaria' as Session['type'] })
  const [memberForm, setMemberForm] = useState({ username: '', level: '' })

  // ----- Carga de datos -----
  const loadProposals = () =>
    api
      .get('/assembly/proposals')
      .then((d: any) => setProposals(Array.isArray(d) ? d : d?.proposals ?? []))
      .catch(() => {})

  const loadMembers = () =>
    api
      .get('/assembly/members')
      .then((d: any) => setMembers(Array.isArray(d) ? d : d?.members ?? []))
      .catch(() => {})

  const loadBoard = () =>
    api
      .get('/assembly/board')
      .then((d: any) => setBoard(Array.isArray(d) ? d : d?.board ?? []))
      .catch(() => {})

  const loadSessions = () =>
    api
      .get('/assembly/sessions')
      .then((d: any) => setSessions(Array.isArray(d) ? d : d?.sessions ?? []))
      .catch(() => {})

  const loadAll = () => {
    setLoading(true)
    Promise.all([loadProposals(), loadMembers(), loadBoard(), loadSessions()]).finally(() =>
      setLoading(false),
    )
  }

  useEffect(() => {
    loadAll()
  }, [])

  // ----- Acciones -----
  const safeCall = async (fn: () => Promise<any>, errMsg: string) => {
    setError(null)
    try {
      await fn()
    } catch (e: any) {
      setError(`${errMsg}: ${e?.message ?? 'error desconocido'}`)
    }
  }

  const createProposal = async () => {
    if (!form.title.trim()) {
      setError('El titulo es obligatorio')
      return
    }
    await safeCall(async () => {
      await api.post('/assembly/proposals', {
        title: form.title,
        description: form.description,
        proposal_type: form.proposal_type,
        target: form.target,
        parameters: form.parameters,
      })
      setShowForm(false)
      setForm({ title: '', description: '', proposal_type: 'policy', target: '', parameters: {} })
      loadProposals()
    }, 'No se pudo crear la propuesta')
  }

  const vote = async (id: string, support: 'for' | 'against' | 'abstain') => {
    await safeCall(async () => {
      await api.post(`/assembly/proposals/${id}/vote`, { support })
      loadProposals()
    }, 'No se pudo registrar el voto')
  }

  const executeProposal = async (id: string) => {
    await safeCall(async () => {
      await api.post(`/assembly/proposals/${id}/execute`, {})
      loadProposals()
    }, 'No se pudo ejecutar la propuesta')
  }

  const createSession = async () => {
    if (!sessionForm.title.trim()) {
      setError('El titulo de la sesion es obligatorio')
      return
    }
    await safeCall(async () => {
      await api.post('/assembly/sessions', sessionForm)
      setShowSessionForm(false)
      setSessionForm({ title: '', type: 'ordinaria' })
      loadSessions()
    }, 'No se pudo crear la sesion')
  }

  const addMember = async () => {
    if (!memberForm.username.trim()) {
      setError('El nombre de usuario es obligatorio')
      return
    }
    await safeCall(async () => {
      await api.post('/assembly/members', memberForm)
      setShowMemberForm(false)
      setMemberForm({ username: '', level: '' })
      loadMembers()
    }, 'No se pudo registrar el miembro')
  }

  const updateParam = (key: string, value: string) => {
    setForm((f) => ({ ...f, parameters: { ...f.parameters, [key]: value } }))
  }

  const changeType = (type: ProposalType) => {
    setForm((f) => ({ ...f, proposal_type: type, parameters: {} }))
  }

  const currentHelp = PROPOSAL_HELP[form.proposal_type]
  const signaturesMissing = (p: Proposal) =>
    Math.max(0, (p.required_signatures ?? 0) - (p.current_signatures ?? 0))

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Asamblea</h1>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="btn-secondary flex items-center gap-1"
            title="Ayuda del sistema de asamblea"
          >
            <HelpCircle size={18} />?
          </button>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />Nueva Propuesta
        </button>
      </div>

      {/* Panel de ayuda general */}
      {showHelp && (
        <div className="card space-y-2">
          <h3 className="font-semibold flex items-center gap-2">
            <HelpCircle size={18} /> Sistema de Asamblea
          </h3>
          <p className="text-sm text-gray-700">
            La asamblea es el organo de gobierno de la red federada. Permite a sus miembros tomar
            decisiones colectivas mediante propuestas que se votan y, al aprobarse, se ejecutan.
          </p>
          <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
            <li>
              <strong>Miembros y directiva:</strong> se registran los miembros y se configura la
              junta/directiva que puede tener firmas requeridas (multi-firma).
            </li>
            <li>
              <strong>Sesiones:</strong> pueden ser ordinarias, extraordinarias o urgentes segun la
              urgencia de las decisiones.
            </li>
            <li>
              <strong>Propuestas:</strong> cada tipo tiene parametros especificos (limites,
              admision, expulsion, presupuesto, federacion, impuestos, niveles, politicas).
            </li>
            <li>
              <strong>Votacion:</strong> se registra a favor, en contra o abstencion. Se requiere
              quorum para aprobar.
            </li>
            <li>
              <strong>Estados:</strong> pendiente, aprobada, rechazada o ejecutada.
            </li>
            <li>
              <strong>Multi-firma:</strong> algunas propuestas requieren varias firmas de la
              directiva antes de ejecutarse.
            </li>
          </ul>
        </div>
      )}

      {/* Errores */}
      {error && (
        <div className="card border border-red-300 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Miembros y directiva */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Users size={18} /> Miembros de la asamblea
            </h3>
            <button
              onClick={() => setShowMemberForm(!showMemberForm)}
              className="btn-secondary flex items-center gap-1 text-sm"
            >
              <Plus size={14} />Agregar
            </button>
          </div>
          {showMemberForm && (
            <div className="space-y-2 pt-2 border-t">
              <div>
                <label className="label">Usuario</label>
                <input
                  className="input"
                  placeholder="nombre de usuario"
                  value={memberForm.username}
                  onChange={(e) => setMemberForm({ ...memberForm, username: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Nivel</label>
                <input
                  className="input"
                  placeholder="ej: basic, full, admin"
                  value={memberForm.level}
                  onChange={(e) => setMemberForm({ ...memberForm, level: e.target.value })}
                />
              </div>
              <button onClick={addMember} className="btn-primary text-sm">
                Registrar miembro
              </button>
            </div>
          )}
          {members.length === 0 ? (
            <p className="text-sm text-gray-500">No hay miembros registrados.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {members.map((m, i) => (
                <li key={i} className="flex justify-between">
                  <span>{m.username}</span>
                  <span className="text-gray-500">{m.level ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card space-y-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Shield size={18} /> Junta / Directiva
          </h3>
          {board.length === 0 ? (
            <p className="text-sm text-gray-500">No hay directiva configurada.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {board.map((b, i) => (
                <li key={i} className="flex justify-between">
                  <span>{b.username}</span>
                  <span className="text-gray-500">{b.role}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Sesiones */}
      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar size={18} /> Sesiones de asamblea
          </h3>
          <button
            onClick={() => setShowSessionForm(!showSessionForm)}
            className="btn-secondary flex items-center gap-1 text-sm"
          >
            <Plus size={14} />Nueva sesion
          </button>
        </div>
        {showSessionForm && (
          <div className="space-y-2 pt-2 border-t">
            <div>
              <label className="label">Titulo de la sesion</label>
              <input
                className="input"
                placeholder="ej: Asamblea mensual"
                value={sessionForm.title}
                onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Tipo de sesion</label>
              <select
                className="input"
                value={sessionForm.type}
                onChange={(e) =>
                  setSessionForm({ ...sessionForm, type: e.target.value as Session['type'] })
                }
              >
                <option value="ordinaria">Ordinaria</option>
                <option value="extraordinaria">Extraordinaria</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <button onClick={createSession} className="btn-primary text-sm">
              Crear sesion
            </button>
          </div>
        )}
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-500">No hay sesiones registradas.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {sessions.map((s, i) => (
              <li key={i} className="flex justify-between">
                <span>{s.title}</span>
                <span className="text-gray-500">
                  {SESSION_TYPE_LABEL[s.type] ?? s.type}
                  {s.date ? ` · ${s.date}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Formulario de nueva propuesta */}
      {showForm && (
        <div className="card space-y-3">
          <h3 className="font-semibold">Nueva propuesta</h3>

          <div>
            <label className="label">Titulo</label>
            <input
              className="input"
              placeholder="Titulo de la propuesta"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Descripcion</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Describe la propuesta"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Tipo de decision</label>
            <select
              className="input"
              value={form.proposal_type}
              onChange={(e) => changeType(e.target.value as ProposalType)}
            >
              {(Object.keys(PROPOSAL_HELP) as ProposalType[]).map((t) => (
                <option key={t} value={t}>
                  {PROPOSAL_HELP[t].label}
                </option>
              ))}
            </select>
          </div>

          {/* Ayuda contextual del tipo seleccionado */}
          <div className="text-sm text-gray-600 bg-gray-50 border rounded p-2">
            <HelpCircle size={14} className="inline mr-1" />
            {currentHelp.help}
          </div>

          {/* Campos dinamicos segun el tipo */}
          {currentHelp.fields.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Parametros especificos</p>
              {currentHelp.fields.map((field) => (
                <div key={field.key}>
                  <label className="label">{field.label}</label>
                  <input
                    className="input"
                    placeholder={field.placeholder}
                    value={form.parameters[field.key] ?? ''}
                    onChange={(e) => updateParam(field.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="label">Objetivo (a quien afecta)</label>
            <input
              className="input"
              placeholder="ej: usuario, organizacion o toda la red"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
            />
          </div>

          <button onClick={createProposal} className="btn-primary">
            Crear Propuesta
          </button>
        </div>
      )}

      {/* Quorum y reglas */}
      <div className="card">
        <h3 className="font-semibold flex items-center gap-2">
          <VoteIcon size={18} /> Quorum y reglas de votacion
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Las propuestas requieren alcanzar el quorum minimo de votos para ser aprobadas. Las
          decisiones criticas (expulsion, cambios de federacion) pueden requerir multi-firma de la
          directiva. Los votos pueden ser: a favor, en contra o abstencion.
        </p>
      </div>

      {/* Lista de propuestas */}
      <div className="space-y-3">
        {loading && <p className="text-sm text-gray-500">Cargando propuestas...</p>}
        {!loading && proposals.length === 0 && (
          <div className="card">
            <p className="text-sm text-gray-500">No hay propuestas registradas.</p>
          </div>
        )}
        {proposals.map((p, i) => (
          <div key={i} className="card">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-sm text-gray-600">{p.description}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-gray-100 px-2 py-1 rounded">
                    Tipo: {PROPOSAL_HELP[p.proposal_type]?.label ?? p.proposal_type}
                  </span>
                  {p.target && (
                    <span className="bg-gray-100 px-2 py-1 rounded">Objetivo: {p.target}</span>
                  )}
                  {p.quorum != null && (
                    <span className="bg-gray-100 px-2 py-1 rounded">Quorum: {p.quorum}</span>
                  )}
                </div>
                {/* Parametros */}
                {p.parameters && Object.keys(p.parameters).length > 0 && (
                  <div className="text-xs text-gray-600 mt-1">
                    <span className="font-medium">Parametros: </span>
                    {Object.entries(p.parameters).map(([k, v]) => (
                      <span key={k} className="mr-2">
                        {k}={String(v)}
                      </span>
                    ))}
                  </div>
                )}
                {/* Multi-firma */}
                {p.required_signatures != null && p.required_signatures > 0 && (
                  <div className="text-xs text-amber-700 mt-1">
                    Multi-firma: {p.current_signatures ?? 0}/{p.required_signatures} firmas ·
                    faltan {signaturesMissing(p)}
                  </div>
                )}
              </div>
              <span className={`text-xs px-2 py-1 rounded ${STATUS_COLOR[p.status] ?? 'bg-gray-100'}`}>
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
            </div>

            {/* Votos */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
              <span className="text-trueque-600">A favor: {p.votes_for ?? 0}</span>
              <span className="text-red-600">En contra: {p.votes_against ?? 0}</span>
              <span className="text-gray-600">Abstencion: {p.votes_abstain ?? 0}</span>

              {p.status === 'pending' && (
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => vote(p.id, 'for')}
                    className="btn-secondary flex items-center gap-1"
                  >
                    <Check size={16} />A favor
                  </button>
                  <button
                    onClick={() => vote(p.id, 'against')}
                    className="btn-secondary flex items-center gap-1"
                  >
                    <X size={16} />En contra
                  </button>
                  <button
                    onClick={() => vote(p.id, 'abstain')}
                    className="btn-secondary flex items-center gap-1"
                  >
                    Abstener
                  </button>
                </div>
              )}

              {p.status === 'approved' && (
                <button
                  onClick={() => executeProposal(p.id)}
                  className="btn-primary flex items-center gap-1 ml-auto"
                >
                  <Check size={16} />Ejecutar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
