import { useState, useEffect } from 'react'
import { api } from '../api'
import { Plus, Vote as VoteIcon, Calendar, FileText, Clock, Check, X, Settings, Bell } from 'lucide-react'

interface ScopedAssemblyProps {
  scope: 'organization' | 'department'
  scopeId: string
  scopeName: string
  isAssemblyOwned?: boolean
}

export default function ScopedAssembly({ scope, scopeId, scopeName, isAssemblyOwned }: ScopedAssemblyProps) {
  const [tab, setTab] = useState<'config' | 'proposals' | 'sessions' | 'reports'>('proposals')
  const [error, setError] = useState('')
  const [sessions, setSessions] = useState<any[]>([])
  const [proposals, setProposals] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [proposalTypes, setProposalTypes] = useState<any[]>([])
  const [config, setConfig] = useState<any>({ has_assembly: false, ordinary_frequency_months: 3, preferred_day_of_month: 15, preferred_hour: 15, notification_days_before: 7, assemblies_enabled: true })
  const [configEditing, setConfigEditing] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [showNewSession, setShowNewSession] = useState(false)
  const [showNewProposal, setShowNewProposal] = useState(false)
  const [newSession, setNewSession] = useState({ session_type: 'ordinaria', title: '', description: '', is_presential: false, start_time: '' })
  const [sessionDate, setSessionDate] = useState('')
  const [sessionTime, setSessionTime] = useState('15:00')
  const [newProposal, setNewProposal] = useState<any>({ proposal_type: 'free_proposal', description: '', voting_duration_minutes: 1440, titulo: '', descripcion_detallada: '', cuenta_destino: '', monto: 0, razon: '', user_id: '', cargo: '' })
  const [accounts, setAccounts] = useState<any[]>([])
  const [selectedSessionForMinutes, setSelectedSessionForMinutes] = useState<string | null>(null)
  const [minutesText, setMinutesText] = useState('')
  const [minutesEditMode, setMinutesEditMode] = useState(false)

  const basePath = `/api/${scope}/${scopeId}/assembly`

  const load = () => {
    api.get(`${basePath}/sessions`).then((d: any) => setSessions(Array.isArray(d) ? d : [])).catch(() => {})
    api.get(`${basePath}/proposals`).then((d: any) => setProposals(Array.isArray(d) ? d : [])).catch(() => {})
  }

  const loadConfig = () => {
    api.get(`${basePath}/config`).then((d: any) => setConfig(d)).catch(() => {})
  }

  const loadProposalTypes = () => {
    api.get(`${basePath}/proposal-types`).then((d: any) => setProposalTypes(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(() => {
    loadConfig()
    loadProposalTypes()
    load()
  }, [])

  const loadReports = () => {
    api.get(`${basePath}/reports`).then((d: any) => {
      setReports(d.reports || [])
    }).catch(() => {})
  }

  const createSession = async () => {
    setError('')
    if (!newSession.title) {
      setError('El titulo es obligatorio')
      return
    }
    if (!sessionDate) {
      setError('Debes seleccionar la fecha')
      return
    }
    if (!sessionTime) {
      setError('Debes seleccionar la hora')
      return
    }
    const start_time = new Date(`${sessionDate}T${sessionTime}:00`).toISOString()
    try {
      await api.post(`${basePath}/sessions`, { ...newSession, start_time })
      setShowNewSession(false)
      setNewSession({ session_type: 'ordinaria', title: '', description: '', is_presential: false, start_time: '' })
      setSessionDate('')
      setSessionTime('15:00')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear sesion')
    }
  }

  const createProposal = async () => {
    setError('')
    if (!newProposal.description && !newProposal.descripcion_detallada) {
      setError('La descripcion es obligatoria')
      return
    }
    if (newProposal.proposal_type === 'fund_distribution' && (!newProposal.cuenta_destino || !newProposal.monto)) {
      setError('Cuenta destino y monto son obligatorios para distribucion de fondos')
      return
    }
    try {
      const description = newProposal.descripcion_detallada || newProposal.description
      const params: any = {}
      if (newProposal.titulo) params.titulo = newProposal.titulo
      if (newProposal.proposal_type === 'fund_distribution') {
        params.cuenta_destino = newProposal.cuenta_destino
        params.monto = newProposal.monto
        params.razon = newProposal.razon
      }
      if (newProposal.proposal_type === 'admission') {
        params.user_id = newProposal.user_id
        if (newProposal.cargo) params.cargo = newProposal.cargo
      }
      await api.post(`${basePath}/proposals`, {
        proposal_type: newProposal.proposal_type,
        description: newProposal.titulo ? `${newProposal.titulo}: ${description}` : description,
        parameters: params,
        voting_duration_minutes: newProposal.voting_duration_minutes,
      })
      setShowNewProposal(false)
      setNewProposal({ proposal_type: 'free_proposal', description: '', voting_duration_minutes: 1440, titulo: '', descripcion_detallada: '', cuenta_destino: '', monto: 0, razon: '', user_id: '', cargo: '' })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear propuesta')
    }
  }

  const openVoting = async (id: string) => {
    try {
      await api.post(`${basePath}/proposals/${id}/open-voting`, {})
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al abrir votacion')
    }
  }

  const vote = async (id: string, vote: string) => {
    try {
      await api.post(`${basePath}/proposals/${id}/vote`, { vote })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al votar')
    }
  }

  const execute = async (id: string) => {
    try {
      await api.post(`${basePath}/proposals/${id}/execute`, {})
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al ejecutar')
    }
  }

  const saveMinutes = async (sessionId: string) => {
    try {
      await api.put(`${basePath}/sessions/${sessionId}/minutes`, { minutes: minutesText })
      setSelectedSessionForMinutes(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar minuta')
    }
  }

  const closeSession = async (sessionId: string) => {
    if (!confirm('Cerrar esta asamblea? Se convocara automaticamente la siguiente asamblea ordinaria si esta configurado.')) return
    try {
      await api.post(`${basePath}/sessions/${sessionId}/close`, {})
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cerrar sesion')
    }
  }

  const saveConfig = async () => {
    setConfigSaving(true)
    setError('')
    try {
      await api.put(`${basePath}/config`, config)
      // Recargar
      const d: any = await api.get(`${basePath}/config`)
      if (d) setConfig(d)
      setConfigEditing(false)
      setConfigSaving(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar configuracion')
      setConfigSaving(false)
    }
  }

  const proposalLabel = (ptype: string) => {
    const t = proposalTypes.find((t: any) => t.proposal_type === ptype)
    return t ? t.label : ptype
  }

  const label = scope === 'organization' ? 'Organizacion' : 'Departamento'

  // Helper: ¿ya se puede registrar asistencia? (1 hora antes por defecto)
  const attendanceWindowHours = config.attendance_window_hours || 1
  const canStartAttendance = (s: any) => {
    if (s.status === 'completed') return false
    if (!s.start_time) return false
    const start = new Date(s.start_time).getTime()
    const windowStart = start - attendanceWindowHours * 60 * 60 * 1000
    return Date.now() >= windowStart
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold flex items-center gap-2"><VoteIcon size={18} />Asamblea de {label}: {scopeName}</h2>

      <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
        {isAssemblyOwned && scope === 'organization' ? (
          <>
            <p>Esta organizacion pertenece a la Asamblea. Sus decisiones se discuten y votan en la <strong>Asamblea General</strong> del nodo, donde participan todos los miembros.</p>
            <p className="mt-1 text-xs">La junta directiva puede tomar decisiones operativas que no requieren aprobacion de la Asamblea.</p>
          </>
        ) : (
          <>
            <p>Esta es la asamblea interna de {scopeName}. Aqui se toman decisiones propias de {label === 'Organizacion' ? 'la organizacion' : 'el departamento'}: propuestas libres, votaciones, minutas y reuniones.</p>
            <p className="mt-1 text-xs">Las decisiones de esta asamblea son independientes de la asamblea general del nodo.</p>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('proposals')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'proposals' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Propuestas</button>
        <button onClick={() => setTab('sessions')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'sessions' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Sesiones y Minutas</button>
        <button onClick={() => { setTab('reports'); loadReports() }} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'reports' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Informes</button>
        <button onClick={() => setTab('config')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'config' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><Settings size={14} className="inline mr-1" />Configuracion</button>
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {/* ===== PROPUESTAS ===== */}
      {tab === 'proposals' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Propuestas</h3>
            <button onClick={() => setShowNewProposal(!showNewProposal)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />Nueva Propuesta</button>
          </div>

          {showNewProposal && (
            <div className="card space-y-4">
              <h4 className="font-medium">Nueva Propuesta</h4>
              <div>
                <label className="label">Tipo de propuesta</label>
                <select className="input" value={newProposal.proposal_type} onChange={e => {
                  setNewProposal({ ...newProposal, proposal_type: e.target.value })
                  if (e.target.value === 'fund_distribution' || e.target.value === 'admission') {
                    // Cargar lista de cuentas
                    api.get('/accounts/list').then((d: any) => {
                      const all = Array.isArray(d) ? d : []
                      setAccounts(all.filter((a: any) => a.id !== scopeId))
                    }).catch(() => setAccounts([]))
                  }
                }}>
                  {proposalTypes.map((t: any) => (
                    <option key={t.proposal_type} value={t.proposal_type}>{t.label}</option>
                  ))}
                </select>
                {proposalTypes.find((t: any) => t.proposal_type === newProposal.proposal_type)?.description && (
                  <p className="text-xs text-gray-400 mt-1">{proposalTypes.find((t: any) => t.proposal_type === newProposal.proposal_type)?.description}</p>
                )}
              </div>

              {/* Campos especificos para fund_distribution */}
              {newProposal.proposal_type === 'fund_distribution' && (
                <>
                  <div>
                    <label className="label">Cuenta destino</label>
                    <select className="input" value={newProposal.cuenta_destino} onChange={e => setNewProposal({ ...newProposal, cuenta_destino: e.target.value })}>
                      <option value="">Seleccionar...</option>
                      {accounts.map((a: any) => (
                        <option key={a.id} value={a.id}>
                          {a.display_name || a.username || a.name}
                          {a.account_type === 'individual' ? ' (persona)' : a.account_type === 'organization' ? ' (organizacion)' : a.account_type === 'department' ? ' (departamento)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      {scope === 'organization' || scope === 'department'
                        ? 'Puedes transferir a organizaciones, departamentos y personas.'
                        : 'La asamblea del nodo solo puede transferir a organizaciones y departamentos.'}
                    </p>
                  </div>
                  <div>
                    <label className="label">Monto</label>
                    <input type="number" className="input" placeholder="200" value={newProposal.monto || ''} onChange={e => setNewProposal({ ...newProposal, monto: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="label">Razon</label>
                    <textarea className="input" rows={2} placeholder="Motivo de la distribucion" value={newProposal.razon} onChange={e => setNewProposal({ ...newProposal, razon: e.target.value })} />
                  </div>
                </>
              )}

              {/* Campos especificos para admission */}
              {newProposal.proposal_type === 'admission' && (
                <>
                  <div>
                    <label className="label">Miembro a admitir</label>
                    <select className="input" value={newProposal.user_id} onChange={e => setNewProposal({ ...newProposal, user_id: e.target.value })}>
                      <option value="">Seleccionar miembro...</option>
                      {accounts.map((a: any) => (
                        <option key={a.id} value={a.id}>
                          {a.display_name || a.username} ({a.username})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Admision a {scope === 'organization' ? 'esta organizacion' : 'este departamento'}, no al nodo.</p>
                  </div>
                  {scope === 'organization' && (
                    <div>
                      <label className="label">Cargo</label>
                      <select className="input" value={newProposal.cargo} onChange={e => setNewProposal({ ...newProposal, cargo: e.target.value })}>
                        <option value="miembro">Miembro</option>
                        <option value="presidente">Presidente</option>
                        <option value="vicepresidente">Vicepresidente</option>
                        <option value="secretario">Secretario</option>
                        <option value="tesorero">Tesorero</option>
                        <option value="coordinador">Coordinador</option>
                      </select>
                    </div>
                  )}
                </>
              )}
              <div>
                <label className="label">Titulo</label>
                <input className="input" placeholder="Ej: Aprobar presupuesto para materiales" value={newProposal.titulo} onChange={e => setNewProposal({ ...newProposal, titulo: e.target.value })} />
              </div>
              <div>
                <label className="label">Descripcion detallada</label>
                <textarea className="input" rows={4} placeholder="Explica la propuesta para que los miembros puedan votar informados" value={newProposal.descripcion_detallada} onChange={e => setNewProposal({ ...newProposal, descripcion_detallada: e.target.value })} />
              </div>
              <div>
                <label className="label">Tiempo limite para votar</label>
                <select className="input" value={newProposal.voting_duration_minutes} onChange={e => setNewProposal({ ...newProposal, voting_duration_minutes: parseInt(e.target.value) })}>
                  <option value={5}>5 minutos (reunion presencial)</option>
                  <option value={10}>10 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={1440}>24 horas (votacion remota)</option>
                  <option value={10080}>7 dias</option>
                </select>
              </div>
              <button onClick={createProposal} className="btn-primary">Crear Propuesta</button>
            </div>
          )}

          {/* Pendientes de revision */}
          {proposals.filter((p: any) => p.status === 'proposed').length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-purple-700 flex items-center gap-2"><Clock size={16} />Pendientes de revision ({proposals.filter((p: any) => p.status === 'proposed').length})</h4>
              {proposals.filter((p: any) => p.status === 'proposed').map((p: any, i: number) => (
                <div key={i} className="card border-purple-200">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{proposalLabel(p.proposal_type)}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">pendiente</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{p.description}</p>
                  <button onClick={() => openVoting(p.id)} className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 mt-2">Abrir votacion</button>
                </div>
              ))}
            </div>
          )}

          {/* En votacion y resultados */}
          {proposals.filter((p: any) => p.status !== 'proposed').length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700">En votacion y resultados</h4>
              {proposals.filter((p: any) => p.status !== 'proposed').map((p: any, i: number) => (
                <div key={i} className="card">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{proposalLabel(p.proposal_type)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      p.status === 'executed' ? 'bg-green-100 text-green-700' :
                      p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      p.status === 'expired' ? 'bg-orange-100 text-orange-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{p.status === 'expired' ? 'vencida' : p.status === 'pending' ? 'en votacion' : p.status}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{p.description}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-green-600">A favor: {p.votes_for || 0}</span>
                    <span className="text-red-600">En contra: {p.votes_against || 0}</span>
                    <span className="text-gray-500">Abstencion: {p.votes_abstain || 0}</span>
                    <span className="text-gray-400">No emitidos: {p.votes_not_cast || 0}</span>
                  </div>
                  {p.status === 'pending' && p.voting_deadline && (
                    <div className="mt-1 text-xs text-orange-600">
                      {(() => {
                        const remaining = new Date(p.voting_deadline).getTime() - Date.now()
                        if (remaining <= 0) return 'Tiempo agotado'
                        const mins = Math.floor(remaining / 60000)
                        const hrs = Math.floor(mins / 60)
                        if (hrs > 0) return `Quedan ${hrs}h ${mins % 60}m`
                        return `Quedan ${mins} minutos`
                      })()}
                    </div>
                  )}
                  {p.status === 'pending' && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => vote(p.id, 'for')} className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"><Check size={14} />A favor</button>
                      <button onClick={() => vote(p.id, 'against')} className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"><X size={14} />En contra</button>
                      <button onClick={() => vote(p.id, 'abstain')} className="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700">Abstener</button>
                      <button onClick={() => execute(p.id)} className="text-xs px-3 py-1 bg-trueque-600 text-white rounded hover:bg-trueque-700 ml-auto">Ejecutar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {proposals.length === 0 && !showNewProposal && (
            <div className="card text-center text-gray-500 py-8">
              <p>No hay propuestas.</p>
              <p className="text-xs mt-2">Crea una propuesta para que los miembros voten.</p>
            </div>
          )}
        </div>
      )}

      {/* ===== SESIONES Y MINUTAS ===== */}
      {tab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Sesiones</h3>
            <button onClick={() => setShowNewSession(!showNewSession)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />Nueva Sesion</button>
          </div>

          {showNewSession && (
            <div className="card space-y-4">
              <div>
                <label className="label">Tipo de sesion</label>
                <select className="input" value={newSession.session_type} onChange={e => setNewSession({ ...newSession, session_type: e.target.value, start_time: '' })}>
                  <option value="ordinaria">Ordinaria</option>
                  <option value="extraordinaria">Extraordinaria</option>
                  <option value="urgente">Urgente</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {newSession.session_type === 'ordinaria' && 'Minimo 7 dias de anticipacion.'}
                  {newSession.session_type === 'extraordinaria' && 'Minimo 24 horas de anticipacion.'}
                  {newSession.session_type === 'urgente' && 'Minimo 1 hora de anticipacion.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha</label>
                  <input
                    type="date"
                    className="input"
                    value={sessionDate}
                    onChange={e => setSessionDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Hora</label>
                  <input
                    type="time"
                    className="input"
                    value={sessionTime}
                    onChange={e => setSessionTime(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="label">Titulo</label>
                <input className="input" placeholder="Ej: Reunion mensual" value={newSession.title} onChange={e => setNewSession({ ...newSession, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Descripcion (opcional)</label>
                <textarea className="input" rows={2} value={newSession.description} onChange={e => setNewSession({ ...newSession, description: e.target.value })} />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={newSession.is_presential} onChange={e => setNewSession({ ...newSession, is_presential: e.target.checked })} className="accent-trueque-600" />
                <span className="text-sm">Asamblea presencial (solo votan los presentes)</span>
              </label>
              <button onClick={createSession} className="btn-primary">Crear Sesion</button>
            </div>
          )}

          {sessions.length === 0 && !showNewSession ? (
            <div className="card text-center text-gray-500 py-8">
              <p>No hay sesiones.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s: any, i: number) => (
                <div key={i} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{s.title}</span>
                      {s.is_presential && <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">Presencial</span>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      s.status === 'active' ? 'bg-green-100 text-green-700' :
                      s.status === 'scheduled' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{s.status}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{s.start_time?.slice(0, 16).replace('T', ' ')}</p>
                  {s.minutes && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                      <strong>Minuta:</strong>
                      <p className="whitespace-pre-wrap mt-1 max-h-32 overflow-y-auto">{s.minutes}</p>
                    </div>
                  )}
                  {canStartAttendance(s) ? (
                    <>
                      <button
                        onClick={() => { setSelectedSessionForMinutes(s.id); setMinutesText(s.minutes || '') }}
                        className="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 mt-2"
                      >
                        {s.minutes ? 'Editar minuta' : 'Escribir minuta'}
                      </button>
                      {(s.status === 'active' || s.status === 'waiting_quorum') && (
                        <button
                          onClick={() => closeSession(s.id)}
                          className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 mt-2 ml-2"
                        >
                          Cerrar asamblea
                        </button>
                      )}
                    </>
                  ) : s.status === 'completed' ? (
                    <button
                      onClick={() => { setSelectedSessionForMinutes(s.id); setMinutesText(s.minutes || ''); setMinutesEditMode(false) }}
                      className="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 mt-2"
                    >
                      Ver acta
                    </button>
                  ) : (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                      <strong>Programada</strong> — El registro de asistencia se abrira {attendanceWindowHours} {attendanceWindowHours === 1 ? 'hora' : 'horas'} antes de la hora programada.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Modal de minuta/acta */}
          {selectedSessionForMinutes && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedSessionForMinutes(null)}>
              <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-bold">Acta de la Asamblea</h3>
                  <button onClick={() => setSelectedSessionForMinutes(null)} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-sm text-gray-600">
                    {minutesEditMode ? 'Edita el acta. Las decisiones tomadas ya estan registradas.' : 'Solo lectura. Si tienes permiso puedes editar con el boton abajo.'}
                  </p>
                  {minutesEditMode ? (
                    <textarea
                      className="input min-h-[300px]"
                      placeholder="Ej:&#10;&#10;Reunion del 15 de marzo&#10;&#10;1. Se aprobo comprar materiales por 500 TQ&#10;2. Se rechazo la propuesta de cambiar el horario&#10;3. Pendiente: organizar la actividad del mes"
                      value={minutesText}
                      onChange={e => setMinutesText(e.target.value)}
                    />
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 min-h-[300px] whitespace-pre-wrap text-sm text-gray-800">
                      {minutesText || 'No hay contenido en el acta.'}
                    </div>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setSelectedSessionForMinutes(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cerrar</button>
                    {minutesEditMode ? (
                      <>
                        <button onClick={() => { setMinutesEditMode(false) }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar edicion</button>
                        <button onClick={() => saveMinutes(selectedSessionForMinutes)} className="px-4 py-2 bg-trueque-600 text-white rounded-lg hover:bg-trueque-700">Guardar</button>
                      </>
                    ) : (
                      <button onClick={() => setMinutesEditMode(true)} className="px-4 py-2 bg-trueque-600 text-white rounded-lg hover:bg-trueque-700">
                        {minutesText ? 'Editar' : 'Escribir'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== INFORMES ===== */}
      {tab === 'reports' && (
        <div className="space-y-4">
          <h3 className="font-medium flex items-center gap-2"><FileText size={18} />Informes de Votacion</h3>
          {reports.length === 0 ? (
            <button onClick={loadReports} className="btn-primary">Cargar informes</button>
          ) : (
            <div className="space-y-2">
              {reports.map((rp: any, i: number) => (
                <div key={i} className="card">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{proposalLabel(rp.proposal_type)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      rp.status === 'executed' ? 'bg-green-100 text-green-700' :
                      rp.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      rp.status === 'expired' ? 'bg-orange-100 text-orange-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{rp.status}</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{rp.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className="text-green-600">A favor: {rp.votes_for}</span>
                    <span className="text-red-600">En contra: {rp.votes_against}</span>
                    <span className="text-gray-500">Abstencion: {rp.votes_abstain}</span>
                    <span className="text-gray-400">No emitidos: {rp.votes_not_cast}</span>
                    <span>Participacion: {rp.participation_pct.toFixed(1)}%</span>
                    <span className="text-gray-400">{rp.created_at?.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== CONFIGURACION ===== */}
      {tab === 'config' && (
        <div className="space-y-4">
          <h3 className="font-medium flex items-center gap-2"><Settings size={18} />Configuracion de Asamblea</h3>
          <p className="text-xs text-blue-600 bg-blue-50 rounded p-2">Estos son ajustes basicos. No requieren aprobacion de asamblea. Puede editarlos el administrador, director o secretario.</p>

          <div className="card space-y-4">
            {/* Modo lectura */}
            {!configEditing ? (
              <div className="space-y-3">
                <div className="text-sm">
                  <label className="label">Tiene asambleas</label>
                  <b>{config.has_assembly ? 'Si' : 'No'}</b>
                </div>
                {config.has_assembly && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="label">Frecuencia</label>
                      <b>
                        {config.ordinary_frequency_months === 0 && 'No auto-convocar'}
                        {config.ordinary_frequency_months === 1 && 'Cada mes'}
                        {config.ordinary_frequency_months === 2 && 'Cada 2 meses'}
                        {config.ordinary_frequency_months === 3 && 'Cada 3 meses (trimestral)'}
                        {config.ordinary_frequency_months === 6 && 'Cada 6 meses (semestral)'}
                        {config.ordinary_frequency_months === 12 && 'Cada 12 meses (anual)'}
                      </b>
                    </div>
                    {config.ordinary_frequency_months > 0 && (
                      <>
                        <div>
                          <label className="label">Dia preferido</label>
                          <b>{config.preferred_day_of_month === 0 ? 'Cualquier dia' : `Dia ${config.preferred_day_of_month}`}</b>
                        </div>
                        <div>
                          <label className="label">Hora preferida</label>
                          <b>{config.preferred_hour.toString().padStart(2, '0')}:00</b>
                        </div>
                        <div>
                          <label className="label">Notificar con anticipacion</label>
                          <b>{config.notification_days_before} dias antes</b>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <button onClick={() => setConfigEditing(true)} className="btn-primary">Editar</button>
              </div>
            ) : (
              /* Modo edicion */
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.has_assembly}
                      onChange={e => setConfig({ ...config, has_assembly: e.target.checked })}
                      className="accent-trueque-600"
                    />
                    <span className="text-sm font-medium">Esta {label} tiene asambleas</span>
                  </label>
                  <p className="text-xs text-gray-400 mt-1">Si la {label.toLowerCase()} es de una sola persona, no necesita asambleas. Desmarca esta opcion para deshabilitar.</p>
                </div>

                {config.has_assembly && (
                  <>
                    <div>
                      <label className="label">Frecuencia de asambleas ordinarias (meses)</label>
                      <select className="input" value={config.ordinary_frequency_months} onChange={e => setConfig({ ...config, ordinary_frequency_months: parseInt(e.target.value) })}>
                        <option value={0}>No auto-convocar</option>
                        <option value={1}>Cada mes</option>
                        <option value={2}>Cada 2 meses</option>
                        <option value={3}>Cada 3 meses (trimestral)</option>
                        <option value={6}>Cada 6 meses (semestral)</option>
                        <option value={12}>Cada 12 meses (anual)</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1">Al cerrar una asamblea ordinaria, se convoca automaticamente la siguiente.</p>
                    </div>

                    {config.ordinary_frequency_months > 0 && (
                      <>
                        <div>
                          <label className="label">Dia preferido del mes</label>
                          <select className="input" value={config.preferred_day_of_month} onChange={e => setConfig({ ...config, preferred_day_of_month: parseInt(e.target.value) })}>
                            <option value={0}>Cualquier dia</option>
                            {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                              <option key={d} value={d}>Dia {d}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Hora preferida</label>
                          <select className="input" value={config.preferred_hour} onChange={e => setConfig({ ...config, preferred_hour: parseInt(e.target.value) })}>
                            {Array.from({ length: 24 }, (_, i) => i).map(h => (
                              <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Notificar con anticipacion (dias)</label>
                          <select className="input" value={config.notification_days_before} onChange={e => setConfig({ ...config, notification_days_before: parseInt(e.target.value) })}>
                            <option value={1}>1 dia antes</option>
                            <option value={3}>3 dias antes</option>
                            <option value={7}>7 dias antes</option>
                            <option value={14}>14 dias antes</option>
                            <option value={30}>30 dias antes</option>
                          </select>
                          <p className="text-xs text-gray-400 mt-1">Los miembros recibiran una notificacion con esta anticipacion.</p>
                        </div>
                      </>
                    )}
                  </>
                )}

                <div className="flex gap-2">
                  <button onClick={saveConfig} disabled={configSaving} className="btn-primary">
                    {configSaving ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button onClick={() => { setConfigEditing(false); loadConfig() }} className="btn-secondary">Cancelar</button>
                </div>
              </div>
            )}
          </div>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
            <p><strong>Como funciona la convocatoria automatica:</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
              <li>Al cerrar una asamblea ordinaria, se agenda la siguiente automaticamente</li>
              <li>Si se modifica la fecha de una asamblea ordinaria, sigue siendo ordinaria</li>
              <li>Si se crea una asamblea nueva ademas de la ordinaria, esa es extraordinaria</li>
              <li>Los miembros reciben notificacion con la anticipacion configurada</li>
              <li>Las asambleas extraordinarias no se auto-convocan</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
