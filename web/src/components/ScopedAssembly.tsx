import { useState } from 'react'
import { api } from '../api'
import { Plus, Vote as VoteIcon, Calendar, FileText, Clock, Check, X } from 'lucide-react'

interface ScopedAssemblyProps {
  scope: 'organization' | 'department'
  scopeId: string
  scopeName: string
}

export default function ScopedAssembly({ scope, scopeId, scopeName }: ScopedAssemblyProps) {
  const [tab, setTab] = useState<'sessions' | 'proposals' | 'reports'>('proposals')
  const [error, setError] = useState('')
  const [sessions, setSessions] = useState<any[]>([])
  const [proposals, setProposals] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [showNewSession, setShowNewSession] = useState(false)
  const [showNewProposal, setShowNewProposal] = useState(false)
  const [newSession, setNewSession] = useState({ session_type: 'ordinaria', title: '', description: '', is_presential: false })
  const [newProposal, setNewProposal] = useState({ proposal_type: 'free_proposal', description: '', voting_duration_minutes: 1440, titulo: '', descripcion_detallada: '' })
  const [selectedSessionForMinutes, setSelectedSessionForMinutes] = useState<string | null>(null)
  const [minutesText, setMinutesText] = useState('')

  const basePath = `/api/${scope}/${scopeId}/assembly`

  const load = () => {
    api.get(`${basePath}/sessions`).then((d: any) => setSessions(Array.isArray(d) ? d : [])).catch(() => {})
    api.get(`${basePath}/proposals`).then((d: any) => setProposals(Array.isArray(d) ? d : [])).catch(() => {})
  }

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
    try {
      await api.post(`${basePath}/sessions`, newSession)
      setShowNewSession(false)
      setNewSession({ session_type: 'ordinaria', title: '', description: '', is_presential: false })
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
    try {
      const description = newProposal.descripcion_detallada || newProposal.description
      const params: any = {}
      if (newProposal.titulo) params.titulo = newProposal.titulo
      await api.post(`${basePath}/proposals`, {
        proposal_type: newProposal.proposal_type,
        description: newProposal.titulo ? `${newProposal.titulo}: ${description}` : description,
        parameters: params,
        voting_duration_minutes: newProposal.voting_duration_minutes,
      })
      setShowNewProposal(false)
      setNewProposal({ proposal_type: 'free_proposal', description: '', voting_duration_minutes: 1440, titulo: '', descripcion_detallada: '' })
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

  const label = scope === 'organization' ? 'Organizacion' : 'Departamento'

  return (
    <div className="space-y-4">
      <h2 className="font-semibold flex items-center gap-2"><VoteIcon size={18} />Asamblea de {label}: {scopeName}</h2>

      <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
        <p>Esta es la asamblea interna de {scopeName}. Aqui se toman decisiones propias de {label === 'Organizacion' ? 'la organizacion' : 'el departamento'}: propuestas libres, votaciones, minutas y reuniones.</p>
        <p className="mt-1 text-xs">Las decisiones de esta asamblea son independientes de la asamblea general del nodo.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('proposals')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'proposals' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Propuestas</button>
        <button onClick={() => setTab('sessions')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'sessions' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Sesiones y Minutas</button>
        <button onClick={() => { setTab('reports'); loadReports() }} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'reports' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Informes</button>
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
                <select className="input" value={newProposal.proposal_type} onChange={e => setNewProposal({ ...newProposal, proposal_type: e.target.value })}>
                  <option value="free_proposal">Propuesta libre</option>
                  <option value="budget_increase">Aumento de presupuesto</option>
                  <option value="fund_distribution">Distribucion de fondos</option>
                  <option value="policy">Politica interna</option>
                  <option value="create_account">Creacion de cuenta</option>
                </select>
              </div>
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
                    <span className="font-medium text-sm">{p.proposal_type === 'free_proposal' ? 'Propuesta libre' : p.proposal_type}</span>
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
                    <span className="font-medium text-sm">{p.proposal_type === 'free_proposal' ? 'Propuesta libre' : p.proposal_type}</span>
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
                <select className="input" value={newSession.session_type} onChange={e => setNewSession({ ...newSession, session_type: e.target.value })}>
                  <option value="ordinaria">Ordinaria</option>
                  <option value="extraordinaria">Extraordinaria</option>
                  <option value="urgente">Urgente</option>
                </select>
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
                  <button
                    onClick={() => { setSelectedSessionForMinutes(s.id); setMinutesText(s.minutes || '') }}
                    className="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 mt-2"
                  >
                    {s.minutes ? 'Editar minuta' : 'Escribir minuta'}
                  </button>
                </div>
              ))}
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
                  <p className="text-sm text-gray-600">Escribe aqui todas las decisiones tomadas. Las propuestas y votaciones se agregan automaticamente.</p>
                  <textarea
                    className="input min-h-[300px]"
                    placeholder="Ej:&#10;&#10;Reunion del 15 de marzo&#10;&#10;1. Se aprobo comprar materiales por 500 TQ&#10;2. Se rechazo la propuesta de cambiar el horario&#10;3. Pendiente: organizar la actividad del mes"
                    value={minutesText}
                    onChange={e => setMinutesText(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setSelectedSessionForMinutes(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                    <button onClick={() => saveMinutes(selectedSessionForMinutes)} className="px-4 py-2 bg-trueque-600 text-white rounded-lg hover:bg-trueque-700">Guardar</button>
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
                    <span className="font-medium text-sm">{rp.proposal_type === 'free_proposal' ? 'Propuesta libre' : rp.proposal_type}</span>
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
    </div>
  )
}
