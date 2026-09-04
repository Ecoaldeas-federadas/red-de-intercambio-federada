import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { Plus, Vote as VoteIcon, Calendar, FileText, Clock, Check, X, Settings, Bell } from 'lucide-react'
import { fmtNumber } from '../lib/format'

interface ScopedAssemblyProps {
  scope: 'organization' | 'department'
  scopeId: string
  scopeName: string
  isAssemblyOwned?: boolean
  meetingType?: 'assembly' | 'board'
}

export default function ScopedAssembly({ scope, scopeId, scopeName, isAssemblyOwned, meetingType = 'assembly' }: ScopedAssemblyProps) {
  const { t: tr } = useTranslation(['assembly', 'common'])
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

  const basePath = `/api/${scope}/${scopeId}/${meetingType === 'board' ? 'board' : 'assembly'}`

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
      setError(tr('scoped.error_title_required'))
      return
    }
    if (!sessionDate) {
      setError(tr('scoped.error_date_required'))
      return
    }
    if (!sessionTime) {
      setError(tr('scoped.error_time_required'))
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
      setError(err instanceof Error ? err.message : tr('scoped.error_create_session'))
    }
  }

  const createProposal = async () => {
    setError('')
    if (!newProposal.description && !newProposal.descripcion_detallada) {
      setError(tr('scoped.error_desc_required'))
      return
    }
    if (newProposal.proposal_type === 'fund_distribution' && (!newProposal.cuenta_destino || !newProposal.monto)) {
      setError(tr('scoped.error_fund_fields'))
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
      setError(err instanceof Error ? err.message : tr('scoped.error_create_proposal'))
    }
  }

  const openVoting = async (id: string) => {
    try {
      await api.post(`${basePath}/proposals/${id}/open-voting`, {})
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('scoped.error_open_voting'))
    }
  }

  const vote = async (id: string, vote: string) => {
    try {
      await api.post(`${basePath}/proposals/${id}/vote`, { vote })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('scoped.error_vote'))
    }
  }

  const execute = async (id: string) => {
    try {
      await api.post(`${basePath}/proposals/${id}/execute`, {})
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('scoped.error_execute'))
    }
  }

  const saveMinutes = async (sessionId: string) => {
    try {
      await api.put(`${basePath}/sessions/${sessionId}/minutes`, { minutes: minutesText })
      setSelectedSessionForMinutes(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('scoped.error_save_minutes'))
    }
  }

  const closeSession = async (sessionId: string) => {
    if (!confirm(tr('scoped.confirm_close_session'))) return
    try {
      await api.post(`${basePath}/sessions/${sessionId}/close`, {})
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('scoped.error_close_session'))
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
      setError(err instanceof Error ? err.message : tr('scoped.error_save_config'))
      setConfigSaving(false)
    }
  }

  const proposalLabel = (ptype: string) => {
    const t = proposalTypes.find((t: any) => t.proposal_type === ptype)
    return t ? t.label : ptype
  }

  const label = scope === 'organization' ? tr('scoped.label_org') : tr('scoped.label_dept')
  const meetingLabel = meetingType === 'board' ? tr('scoped.meeting_board') : tr('scoped.meeting_assembly')

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
      <h2 className="font-semibold flex items-center gap-2"><VoteIcon size={18} />{meetingLabel} de {label}: {scopeName}</h2>

      <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
        {meetingType === 'board' ? (
          <>
            <p dangerouslySetInnerHTML={{ __html: tr('scoped.board_desc', { name: scopeName }) }} />
            <p className="mt-1 text-xs">{tr('scoped.board_desc_hint')}</p>
          </>
        ) : isAssemblyOwned && scope === 'organization' ? (
          <>
            <p dangerouslySetInnerHTML={{ __html: tr('scoped.assembly_owned_desc') }} />
            <p className="mt-1 text-xs">{tr('scoped.assembly_owned_hint')}</p>
          </>
        ) : (
          <>
            <p>{tr('scoped.internal_assembly_desc', { name: scopeName, label: label.toLowerCase() })}</p>
            <p className="mt-1 text-xs">{tr('scoped.internal_assembly_hint')}</p>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('proposals')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'proposals' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{tr('scoped.tab_proposals')}</button>
        <button onClick={() => setTab('sessions')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'sessions' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{tr('scoped.tab_sessions')}</button>
        <button onClick={() => { setTab('reports'); loadReports() }} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'reports' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{tr('scoped.tab_reports')}</button>
        <button onClick={() => setTab('config')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'config' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><Settings size={14} className="inline mr-1" />{tr('scoped.tab_config')}</button>
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {/* ===== PROPUESTAS ===== */}
      {tab === 'proposals' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">{tr('scoped.proposals_title')}</h3>
            <button onClick={() => setShowNewProposal(!showNewProposal)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />{tr('scoped.new_proposal')}</button>
          </div>

          {showNewProposal && (
            <div className="card space-y-4">
              <h4 className="font-medium">{tr('scoped.new_proposal')}</h4>
              <div>
                <label className="label">{tr('scoped.proposal_type_label')}</label>
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
                    <label className="label">{tr('scoped.target_account_label')}</label>
                    <select className="input" value={newProposal.cuenta_destino} onChange={e => setNewProposal({ ...newProposal, cuenta_destino: e.target.value })}>
                      <option value="">{tr('scoped.select_option')}</option>
                      {accounts.map((a: any) => (
                        <option key={a.id} value={a.id}>
                          {a.display_name || a.username || a.name}
                          {a.account_type === 'individual' ? ` ${tr('scoped.account_type_individual')}` : a.account_type === 'organization' ? ` ${tr('scoped.account_type_organization')}` : a.account_type === 'department' ? ` ${tr('scoped.account_type_department')}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      {scope === 'organization' || scope === 'department'
                        ? tr('scoped.transfer_hint_org')
                        : tr('scoped.transfer_hint_node')}
                    </p>
                  </div>
                  <div>
                    <label className="label">{tr('scoped.amount_label')}</label>
                    <input type="number" className="input" placeholder="200" value={newProposal.monto || ''} onChange={e => setNewProposal({ ...newProposal, monto: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="label">{tr('scoped.reason_label')}</label>
                    <textarea className="input" rows={2} placeholder={tr('scoped.reason_placeholder')} value={newProposal.razon} onChange={e => setNewProposal({ ...newProposal, razon: e.target.value })} />
                  </div>
                </>
              )}

              {/* Campos especificos para admission */}
              {newProposal.proposal_type === 'admission' && (
                <>
                  <div>
                    <label className="label">{tr('scoped.member_label')}</label>
                    <select className="input" value={newProposal.user_id} onChange={e => setNewProposal({ ...newProposal, user_id: e.target.value })}>
                      <option value="">{tr('scoped.select_member')}</option>
                      {accounts.map((a: any) => (
                        <option key={a.id} value={a.id}>
                          {a.display_name || a.username} ({a.username})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">{scope === 'organization' ? tr('scoped.admission_hint_org') : tr('scoped.admission_hint_dept')}</p>
                  </div>
                  {scope === 'organization' && (
                    <div>
                      <label className="label">{tr('scoped.role_label')}</label>
                      <select className="input" value={newProposal.cargo} onChange={e => setNewProposal({ ...newProposal, cargo: e.target.value })}>
                        <option value="miembro">{tr('scoped.role_member')}</option>
                        <option value="presidente">{tr('scoped.role_president')}</option>
                        <option value="vicepresidente">{tr('scoped.role_vicepresident')}</option>
                        <option value="secretario">{tr('scoped.role_secretary')}</option>
                        <option value="tesorero">{tr('scoped.role_treasurer')}</option>
                        <option value="coordinador">{tr('scoped.role_coordinator')}</option>
                      </select>
                    </div>
                  )}
                </>
              )}
              <div>
                <label className="label">{tr('scoped.title_label')}</label>
                <input className="input" placeholder={tr('scoped.title_placeholder')} value={newProposal.titulo} onChange={e => setNewProposal({ ...newProposal, titulo: e.target.value })} />
              </div>
              <div>
                <label className="label">{tr('scoped.detailed_desc_label')}</label>
                <textarea className="input" rows={4} placeholder={tr('scoped.detailed_desc_placeholder')} value={newProposal.descripcion_detallada} onChange={e => setNewProposal({ ...newProposal, descripcion_detallada: e.target.value })} />
              </div>
              <div>
                <label className="label">{tr('scoped.voting_time_label')}</label>
                <select className="input" value={newProposal.voting_duration_minutes} onChange={e => setNewProposal({ ...newProposal, voting_duration_minutes: parseInt(e.target.value) })}>
                  <option value={5}>{tr('scoped.voting_5min')}</option>
                  <option value={10}>{tr('scoped.voting_10min')}</option>
                  <option value={30}>{tr('scoped.voting_30min')}</option>
                  <option value={1440}>{tr('scoped.voting_24h')}</option>
                  <option value={10080}>{tr('scoped.voting_7days')}</option>
                </select>
              </div>
              <button onClick={createProposal} className="btn-primary">{tr('scoped.create_proposal')}</button>
            </div>
          )}

          {/* Pendientes de revision */}
          {proposals.filter((p: any) => p.status === 'proposed').length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-purple-700 flex items-center gap-2"><Clock size={16} />{tr('scoped.pending_review')} ({proposals.filter((p: any) => p.status === 'proposed').length})</h4>
              {proposals.filter((p: any) => p.status === 'proposed').map((p: any, i: number) => (
                <div key={i} className="card border-purple-200">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{proposalLabel(p.proposal_type)}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">{tr('scoped.pending_badge')}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{p.description}</p>
                  <button onClick={() => openVoting(p.id)} className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 mt-2">{tr('scoped.open_voting')}</button>
                </div>
              ))}
            </div>
          )}

          {/* En votacion y resultados */}
          {proposals.filter((p: any) => p.status !== 'proposed').length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700">{tr('scoped.voting_and_results')}</h4>
              {proposals.filter((p: any) => p.status !== 'proposed').map((p: any, i: number) => (
                <div key={i} className="card">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{proposalLabel(p.proposal_type)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      p.status === 'executed' ? 'bg-green-100 text-green-700' :
                      p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      p.status === 'expired' ? 'bg-orange-100 text-orange-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{p.status === 'expired' ? tr('scoped.status_expired') : p.status === 'pending' ? tr('scoped.status_pending') : p.status}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{p.description}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-green-600">{tr('scoped.votes_for')}: {p.votes_for || 0}</span>
                    <span className="text-red-600">{tr('scoped.votes_against')}: {p.votes_against || 0}</span>
                    <span className="text-gray-500">{tr('scoped.votes_abstain')}: {p.votes_abstain || 0}</span>
                    <span className="text-gray-400">{tr('scoped.votes_not_cast')}: {p.votes_not_cast || 0}</span>
                  </div>
                  {p.status === 'pending' && p.voting_deadline && (
                    <div className="mt-1 text-xs text-orange-600">
                      {(() => {
                        const remaining = new Date(p.voting_deadline).getTime() - Date.now()
                        if (remaining <= 0) return tr('scoped.time_up')
                        const mins = Math.floor(remaining / 60000)
                        const hrs = Math.floor(mins / 60)
                        if (hrs > 0) return tr('scoped.time_remaining_h', { h: hrs, m: mins % 60 })
                        return tr('scoped.time_remaining_m', { m: mins })
                      })()}
                    </div>
                  )}
                  {p.status === 'pending' && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => vote(p.id, 'for')} className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"><Check size={14} />{tr('scoped.vote_for')}</button>
                      <button onClick={() => vote(p.id, 'against')} className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"><X size={14} />{tr('scoped.vote_against')}</button>
                      <button onClick={() => vote(p.id, 'abstain')} className="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700">{tr('scoped.abstain')}</button>
                      <button onClick={() => execute(p.id)} className="text-xs px-3 py-1 bg-trueque-600 text-white rounded hover:bg-trueque-700 ml-auto">{tr('scoped.execute')}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {proposals.length === 0 && !showNewProposal && (
            <div className="card text-center text-gray-500 py-8">
              <p>{tr('scoped.no_proposals')}</p>
              <p className="text-xs mt-2">{tr('scoped.no_proposals_hint')}</p>
            </div>
          )}
        </div>
      )}

      {/* ===== SESIONES Y MINUTAS ===== */}
      {tab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">{tr('scoped.sessions_title')}</h3>
            <button onClick={() => setShowNewSession(!showNewSession)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />{tr('scoped.new_session')}</button>
          </div>

          {showNewSession && (
            <div className="card space-y-4">
              <div>
                <label className="label">{tr('scoped.session_type_label')}</label>
                <select className="input" value={newSession.session_type} onChange={e => setNewSession({ ...newSession, session_type: e.target.value, start_time: '' })}>
                  <option value="ordinaria">{tr('scoped.session_ordinaria')}</option>
                  <option value="extraordinaria">{tr('scoped.session_extraordinaria')}</option>
                  <option value="urgente">{tr('scoped.session_urgente')}</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {newSession.session_type === 'ordinaria' && tr('scoped.session_ordinaria_hint')}
                  {newSession.session_type === 'extraordinaria' && tr('scoped.session_extraordinaria_hint')}
                  {newSession.session_type === 'urgente' && tr('scoped.session_urgente_hint')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{tr('scoped.date_label')}</label>
                  <input
                    type="date"
                    className="input"
                    value={sessionDate}
                    onChange={e => setSessionDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">{tr('scoped.time_label')}</label>
                  <input
                    type="time"
                    className="input"
                    value={sessionTime}
                    onChange={e => setSessionTime(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="label">{tr('scoped.title_label')}</label>
                <input className="input" placeholder={tr('scoped.session_title_placeholder')} value={newSession.title} onChange={e => setNewSession({ ...newSession, title: e.target.value })} />
              </div>
              <div>
                <label className="label">{tr('scoped.session_desc_label')}</label>
                <textarea className="input" rows={2} value={newSession.description} onChange={e => setNewSession({ ...newSession, description: e.target.value })} />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={newSession.is_presential} onChange={e => setNewSession({ ...newSession, is_presential: e.target.checked })} className="accent-trueque-600" />
                <span className="text-sm">{tr('scoped.presential_label')}</span>
              </label>
              <button onClick={createSession} className="btn-primary">{tr('scoped.create_session')}</button>
            </div>
          )}

          {sessions.length === 0 && !showNewSession ? (
            <div className="card text-center text-gray-500 py-8">
              <p>{tr('scoped.no_sessions')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s: any, i: number) => (
                <div key={i} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{s.title}</span>
                      {s.is_presential && <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">{tr('scoped.presential_badge')}</span>}
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
                      <strong>{tr('scoped.minutes_label')}</strong>
                      <p className="whitespace-pre-wrap mt-1 max-h-32 overflow-y-auto">{s.minutes}</p>
                    </div>
                  )}
                  {canStartAttendance(s) ? (
                    <>
                      <button
                        onClick={() => { setSelectedSessionForMinutes(s.id); setMinutesText(s.minutes || '') }}
                        className="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 mt-2"
                      >
                        {s.minutes ? tr('scoped.edit_minutes') : tr('scoped.write_minutes')}
                      </button>
                      {(s.status === 'active' || s.status === 'waiting_quorum') && (
                        <button
                          onClick={() => closeSession(s.id)}
                          className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 mt-2 ml-2"
                        >
                          {tr('scoped.close_assembly')}
                        </button>
                      )}
                    </>
                  ) : s.status === 'completed' ? (
                    <button
                      onClick={() => { setSelectedSessionForMinutes(s.id); setMinutesText(s.minutes || ''); setMinutesEditMode(false) }}
                      className="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 mt-2"
                    >
                      {tr('scoped.view_minutes')}
                    </button>
                  ) : (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                      <strong>{tr('scoped.scheduled_label')}</strong> — {tr('scoped.scheduled_hint', { hours: attendanceWindowHours, hour_word: attendanceWindowHours === 1 ? tr('scoped.hour_singular') : tr('scoped.hour_plural') })}
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
                  <h3 className="font-bold">{tr('scoped.minutes_modal_title')}</h3>
                  <button onClick={() => setSelectedSessionForMinutes(null)} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-sm text-gray-600">
                    {minutesEditMode ? tr('scoped.minutes_edit_desc') : tr('scoped.minutes_readonly_desc')}
                  </p>
                  {minutesEditMode ? (
                    <textarea
                      className="input min-h-[300px]"
                      placeholder={tr('scoped.minutes_placeholder')}
                      value={minutesText}
                      onChange={e => setMinutesText(e.target.value)}
                    />
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 min-h-[300px] whitespace-pre-wrap text-sm text-gray-800">
                      {minutesText || tr('scoped.minutes_empty')}
                    </div>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setSelectedSessionForMinutes(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">{tr('scoped.close_button')}</button>
                    {minutesEditMode ? (
                      <>
                        <button onClick={() => { setMinutesEditMode(false) }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">{tr('scoped.cancel_edit')}</button>
                        <button onClick={() => saveMinutes(selectedSessionForMinutes)} className="px-4 py-2 bg-trueque-600 text-white rounded-lg hover:bg-trueque-700">{tr('scoped.save_button')}</button>
                      </>
                    ) : (
                      <button onClick={() => setMinutesEditMode(true)} className="px-4 py-2 bg-trueque-600 text-white rounded-lg hover:bg-trueque-700">
                        {minutesText ? tr('scoped.edit_button') : tr('scoped.write_button')}
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
          <h3 className="font-medium flex items-center gap-2"><FileText size={18} />{tr('scoped.reports_title')}</h3>
          {reports.length === 0 ? (
            <button onClick={loadReports} className="btn-primary">{tr('scoped.load_reports')}</button>
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
                    <span className="text-green-600">{tr('scoped.votes_for')}: {rp.votes_for}</span>
                    <span className="text-red-600">{tr('scoped.votes_against')}: {rp.votes_against}</span>
                    <span className="text-gray-500">{tr('scoped.votes_abstain')}: {rp.votes_abstain}</span>
                    <span className="text-gray-400">{tr('scoped.votes_not_cast')}: {rp.votes_not_cast}</span>
                    <span>{tr('scoped.participation')}: {fmtNumber(rp.participation_pct, 1)}%</span>
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
          <h3 className="font-medium flex items-center gap-2"><Settings size={18} />{tr('scoped.config_title')}</h3>
          <p className="text-xs text-blue-600 bg-blue-50 rounded p-2">{tr('scoped.config_hint')}</p>

          <div className="card space-y-4">
            {/* Modo lectura */}
            {!configEditing ? (
              <div className="space-y-3">
                <div className="text-sm">
                  <label className="label">{tr('scoped.has_assembly_label')}</label>
                  <b>{config.has_assembly ? tr('scoped.yes') : tr('scoped.no')}</b>
                </div>
                {config.has_assembly && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="label">{tr('scoped.frequency_label')}</label>
                      <b>
                        {config.ordinary_frequency_months === 0 && tr('scoped.freq_no_auto')}
                        {config.ordinary_frequency_months === 1 && tr('scoped.freq_monthly')}
                        {config.ordinary_frequency_months === 2 && tr('scoped.freq_2months')}
                        {config.ordinary_frequency_months === 3 && tr('scoped.freq_quarterly')}
                        {config.ordinary_frequency_months === 6 && tr('scoped.freq_semiannual')}
                        {config.ordinary_frequency_months === 12 && tr('scoped.freq_annual')}
                      </b>
                    </div>
                    {config.ordinary_frequency_months > 0 && (
                      <>
                        <div>
                          <label className="label">{tr('scoped.preferred_day_label')}</label>
                          <b>{config.preferred_day_of_month === 0 ? tr('scoped.any_day') : tr('scoped.day_n', { n: config.preferred_day_of_month })}</b>
                        </div>
                        <div>
                          <label className="label">{tr('scoped.preferred_hour_label')}</label>
                          <b>{config.preferred_hour.toString().padStart(2, '0')}:00</b>
                        </div>
                        <div>
                          <label className="label">{tr('scoped.notify_before_label')}</label>
                          <b>{tr('scoped.notify_n_days', { n: config.notification_days_before })}</b>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <button onClick={() => setConfigEditing(true)} className="btn-primary">{tr('scoped.edit_button_action')}</button>
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
                    <span className="text-sm font-medium">{tr('scoped.has_assembly_check', { label })}</span>
                  </label>
                  <p className="text-xs text-gray-400 mt-1">{tr('scoped.has_assembly_hint', { label_lower: label.toLowerCase() })}</p>
                </div>

                {config.has_assembly && (
                  <>
                    <div>
                      <label className="label">{tr('scoped.frequency_edit_label')}</label>
                      <select className="input" value={config.ordinary_frequency_months} onChange={e => setConfig({ ...config, ordinary_frequency_months: parseInt(e.target.value) })}>
                        <option value={0}>{tr('scoped.freq_no_auto')}</option>
                        <option value={1}>{tr('scoped.freq_monthly')}</option>
                        <option value={2}>{tr('scoped.freq_2months')}</option>
                        <option value={3}>{tr('scoped.freq_quarterly')}</option>
                        <option value={6}>{tr('scoped.freq_semiannual')}</option>
                        <option value={12}>{tr('scoped.freq_annual')}</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1">{tr('scoped.frequency_edit_hint')}</p>
                    </div>

                    {config.ordinary_frequency_months > 0 && (
                      <>
                        <div>
                          <label className="label">{tr('scoped.preferred_day_edit_label')}</label>
                          <select className="input" value={config.preferred_day_of_month} onChange={e => setConfig({ ...config, preferred_day_of_month: parseInt(e.target.value) })}>
                            <option value={0}>{tr('scoped.any_day')}</option>
                            {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                              <option key={d} value={d}>{tr('scoped.day_n', { n: d })}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">{tr('scoped.preferred_hour_edit_label')}</label>
                          <select className="input" value={config.preferred_hour} onChange={e => setConfig({ ...config, preferred_hour: parseInt(e.target.value) })}>
                            {Array.from({ length: 24 }, (_, i) => i).map(h => (
                              <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">{tr('scoped.notify_edit_label')}</label>
                          <select className="input" value={config.notification_days_before} onChange={e => setConfig({ ...config, notification_days_before: parseInt(e.target.value) })}>
                            <option value={1}>{tr('scoped.notify_1day')}</option>
                            <option value={3}>{tr('scoped.notify_3days')}</option>
                            <option value={7}>{tr('scoped.notify_7days')}</option>
                            <option value={14}>{tr('scoped.notify_14days')}</option>
                            <option value={30}>{tr('scoped.notify_30days')}</option>
                          </select>
                          <p className="text-xs text-gray-400 mt-1">{tr('scoped.notify_edit_hint')}</p>
                        </div>
                      </>
                    )}
                  </>
                )}

                <div className="flex gap-2">
                  <button onClick={saveConfig} disabled={configSaving} className="btn-primary">
                    {configSaving ? tr('scoped.saving') : tr('scoped.save_config')}
                  </button>
                  <button onClick={() => { setConfigEditing(false); loadConfig() }} className="btn-secondary">{tr('scoped.cancel_config')}</button>
                </div>
              </div>
            )}
          </div>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
            <p><strong>{tr('scoped.auto_convocation_title')}</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
              <li>{tr('scoped.auto_convocation_1')}</li>
              <li>{tr('scoped.auto_convocation_2')}</li>
              <li>{tr('scoped.auto_convocation_3')}</li>
              <li>{tr('scoped.auto_convocation_4')}</li>
              <li>{tr('scoped.auto_convocation_5')}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
