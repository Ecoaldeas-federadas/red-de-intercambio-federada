import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Globe, Plus, Check, X, RefreshCw, Users, Vote, Lock, Info, Ban, Network, AlertTriangle, HelpCircle } from 'lucide-react'
import { fmtDate } from '../lib/format'

interface FederationProposal {
  id: string
  proposal_type: string
  key: string
  proposed_value: any
  current_value: any
  description: string
  proposed_by_node: string
  status: string
  approval_threshold: number
  total_nodes: number
  approvals: number
  rejections: number
  approval_pct: number
  created_at: string
  expires_at?: string
  applied_at?: string
  votes?: { voter_node: string, vote: string, voted_at: string, notes: string }[]
}

interface FederationConstant {
  key: string
  value: any
  description: string
  updated_at: string
}

export default function FederationGov() {
  const { t } = useTranslation(['federation', 'common'])
  const { currency } = useConfig()
  const [constants, setConstants] = useState<FederationConstant[]>([])
  const [showHelp, setShowHelp] = useState(false)
  const [proposals, setProposals] = useState<FederationProposal[]>([])
  const [selectedProposal, setSelectedProposal] = useState<FederationProposal | null>(null)
  const [knownNodes, setKnownNodes] = useState<any[]>([])
  const [expelledNodes, setExpelledNodes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [subTab, setSubTab] = useState<'constants' | 'proposals' | 'new' | 'nodes' | 'expel'>('proposals')

  const [newProposal, setNewProposal] = useState({
    key: 'basket_cost_internal_tq',
    proposed_value: '',
    description: '',
  })

  const [expelForm, setExpelForm] = useState({
    node_domain: '',
    reason: '',
  })

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      await Promise.all([loadConstants(), loadProposals(), loadKnownNodes(), loadExpelledNodes()])
    } finally {
      setLoading(false)
    }
  }

  const loadKnownNodes = async () => {
    try {
      const res = await api.get('/federation-gov/known-nodes')
      setKnownNodes((res as any).known_nodes || [])
    } catch (e) { console.error(e) }
  }

  const loadExpelledNodes = async () => {
    try {
      const res = await api.get('/federation-gov/expelled')
      setExpelledNodes((res as any).expelled_nodes || [])
    } catch (e) { console.error(e) }
  }

  const loadConstants = async () => {
    try {
      const res = await api.get('/federation-gov/constants')
      setConstants((res as any).constants || [])
    } catch (e) { console.error(e) }
  }

  const loadProposals = async () => {
    try {
      const res = await api.get('/federation-gov/proposals')
      setProposals((res as any).proposals || [])
    } catch (e) { console.error(e) }
  }

  const loadProposalDetail = async (id: string) => {
    try {
      const res = await api.get(`/federation-gov/proposals/${id}`)
      setSelectedProposal(res as any)
    } catch (e) { console.error(e) }
  }

  const createProposal = async () => {
    if (!newProposal.proposed_value) {
      setMsg({ type: 'error', text: t('gov_must_enter_value', 'Debes ingresar un valor propuesto') })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      // Convertir a numero si es numerico
      let value: any = newProposal.proposed_value
      if (!isNaN(Number(value))) value = Number(value)

      const res = await api.post('/federation-gov/proposals', {
        proposal_type: 'change_constant',
        key: newProposal.key,
        proposed_value: value,
        description: newProposal.description,
      })
      setMsg({ type: 'success', text: (res as any).message || t('gov_proposal_created', 'Propuesta creada') })
      setNewProposal({ key: 'basket_cost_internal_tq', proposed_value: '', description: '' })
      setSubTab('proposals')
      await loadProposals()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || t('gov_error_creating', 'Error al crear propuesta') })
    } finally {
      setSaving(false)
    }
  }

  const vote = async (id: string, vote: 'approve' | 'reject') => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await api.post(`/federation-gov/proposals/${id}/vote`, { vote })
      setMsg({
        type: (res as any).applied ? 'success' : 'info',
        text: (res as any).applied
          ? t('gov_vote_consensus', 'Voto registrado. Consenso alcanzado - cambio aplicado automaticamente.')
          : t('gov_vote_registered', 'Voto registrado.'),
      })
      await loadProposals()
      if (selectedProposal?.id === id) await loadProposalDetail(id)
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || t('gov_error_voting', 'Error al votar') })
    } finally {
      setSaving(false)
    }
  }

  const createExpelProposal = async () => {
    if (!expelForm.node_domain) {
      setMsg({ type: 'error', text: t('gov_must_enter_domain', 'Debes ingresar el dominio del nodo a expulsar') })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const res = await api.post('/federation-gov/proposals', {
        proposal_type: 'expel_node',
        key: expelForm.node_domain,
        proposed_value: true,
        description: expelForm.reason || `Expulsion del nodo ${expelForm.node_domain}`,
      })
      setMsg({ type: 'success', text: (res as any).message || t('gov_expel_created', 'Propuesta de expulsion creada') })
      setExpelForm({ node_domain: '', reason: '' })
      setSubTab('proposals')
      await loadProposals()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || t('gov_error_creating_expel', 'Error al crear propuesta de expulsion') })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><RefreshCw className="animate-spin text-trueque-600" size={24} /></div>
  }

  const getKeyLabel = (key: string) => {
    const labels: Record<string, string> = {
      'basket_cost_internal_tq': t('gov_key_basket_cost', `Canasta basica interna (${currency})`),
      'fc_approval_threshold': t('gov_key_approval_threshold', 'Umbral de aprobacion (%)'),
      'proposal_expiry_days': t('gov_key_proposal_expiry', 'Dias de expiracion de propuestas'),
    }
    return labels[key] || key
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Globe size={24} /> {t('gov_title', 'Federacion')}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700"><HelpCircle size={20} /></button>
          <button onClick={loadAll} className="text-gray-500 hover:text-gray-700"><RefreshCw size={18} /></button>
        </div>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
          <p><strong>{t('gov_help_title')}</strong></p>
          <p><strong>{t('gov_help_what_label')}</strong> {t('gov_help_what')}</p>
          <p><strong>{t('gov_help_proposals_label')}</strong> {t('gov_help_proposals')}</p>
          <p><strong>{t('gov_help_constants_label')}</strong> {t('gov_help_constants')}</p>
          <p><strong>{t('gov_help_expel_label')}</strong> {t('gov_help_expel')}</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('close', { ns: 'common' })}</button>
        </div>
      )}

      <div className="card bg-blue-50 p-3 text-sm text-blue-700 flex items-start gap-2">
        <Info size={16} className="flex-shrink-0 mt-0.5" />
        <div>
          <strong>{t('gov_federated_gov', 'Gobernanza Federada.')}</strong> {t('gov_federated_gov_desc', 'Algunos valores afectan a TODA la federacion (como la canasta basica interna). No se pueden cambiar por nodo individual. Para cambiarlos, se crea una propuesta y todos los nodos federados deben aprobarla.')}
          <br /><br />
          <strong>{t('gov_default_threshold', 'Por defecto se requiere el 75% de los nodos')}</strong> {t('gov_default_threshold_desc', '(mayoria debe aprobar). Este umbral se puede cambiar, pero para cambiarlo se necesita la aprobacion bajo el umbral actual. Es decir: si el umbral actual es 75%, cambiarlo a 100% o 50%+1 requiere que se apruebe bajo el 75%. Una vez cambiado, las futuras propuestas se aprueban con el nuevo umbral.')}
          <br /><br />
          {t('gov_single_node_auto', 'Cuando hay un solo nodo, sus propuestas se auto-aprueban (es el 100% de 1 nodo). Los nodos nuevos que se unen a la federacion aceptan las politicas existentes.')}
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700' : msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setSubTab('proposals')} className={`px-3 py-1.5 rounded-lg text-sm ${subTab === 'proposals' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('gov_subtab_proposals', 'Propuestas')}</button>
        <button onClick={() => setSubTab('nodes')} className={`px-3 py-1.5 rounded-lg text-sm ${subTab === 'nodes' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><Network size={14} className="inline mr-1" />{t('gov_subtab_nodes', 'Nodos de la Red')}</button>
        <button onClick={() => setSubTab('new')} className={`px-3 py-1.5 rounded-lg text-sm ${subTab === 'new' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><Plus size={14} className="inline mr-1" />{t('gov_subtab_new', 'Nueva Propuesta')}</button>
        <button onClick={() => setSubTab('expel')} className={`px-3 py-1.5 rounded-lg text-sm ${subTab === 'expel' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}><Ban size={14} className="inline mr-1" />{t('gov_subtab_expel', 'Expulsar Nodo')}</button>
        <button onClick={() => setSubTab('constants')} className={`px-3 py-1.5 rounded-lg text-sm ${subTab === 'constants' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('gov_subtab_constants', 'Constantes Federadas')}</button>
      </div>

      {/* Propuestas */}
      {subTab === 'proposals' && (
        <div className="space-y-3">
          {proposals.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">
              <Vote size={32} className="mx-auto mb-2 text-gray-300" />
              {t('gov_no_proposals', 'No hay propuestas federadas.')}
              <br />
              <span className="text-sm">{t('gov_no_proposals_hint', 'Crea una propuesta para cambiar un valor que afecta a toda la federacion.')}</span>
            </div>
          ) : proposals.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{getKeyLabel(p.key)}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      p.status === 'approved' ? 'bg-green-100 text-green-700' :
                      p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      p.status === 'expired' ? 'bg-gray-100 text-gray-600' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {p.status === 'approved' ? t('gov_proposal_approved', 'Aprobada') :
                       p.status === 'rejected' ? t('gov_proposal_rejected', 'Rechazada') :
                       p.status === 'expired' ? t('gov_proposal_expired', 'Expirada') :
                       t('gov_proposal_pending', 'Pendiente')}
                    </span>
                  </div>
                  {p.description && <p className="text-sm text-gray-600 mt-1">{p.description}</p>}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs">{t('gov_current_value', 'Valor actual:')}</span>
                      <div className="font-medium">{String(p.current_value)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">{t('gov_proposed_value', 'Valor propuesto:')}</span>
                      <div className="font-medium text-blue-700">{String(p.proposed_value)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">{t('gov_approvals', 'Aprobaciones:')}</span>
                      <div className="font-medium text-green-600">{p.approvals}/{p.total_nodes} ({p.approval_pct}%)</div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">{t('gov_threshold', 'Umbral:')}</span>
                      <div className="font-medium">{p.approval_threshold}%</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {t('gov_proposed_by', 'Propuesta por:')} {p.proposed_by_node} | {fmtDate(p.created_at)}
                    {p.applied_at && ` | ${t('gov_applied', 'Aplicada:')} ${fmtDate(p.applied_at)}`}
                  </p>

                  {/* Barra de progreso */}
                  <div className="mt-2 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${p.approval_pct >= p.approval_threshold ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(p.approval_pct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {p.status === 'pending' && (
                <div className="flex gap-2 mt-3 pt-3 border-t">
                  <button
                    onClick={() => vote(p.id, 'approve')}
                    disabled={saving}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    <Check size={14} /> {t('gov_approve', 'Aprobar')}
                  </button>
                  <button
                    onClick={() => vote(p.id, 'reject')}
                    disabled={saving}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    <X size={14} /> {t('gov_reject', 'Rechazar')}
                  </button>
                  <button
                    onClick={() => loadProposalDetail(p.id)}
                    className="px-3 py-1.5 bg-gray-200 rounded-lg text-sm"
                  >
                    {t('gov_view_details', 'Ver detalles')}
                  </button>
                </div>
              )}

              {p.status === 'approved' && (
                <div className="mt-3 pt-3 border-t text-sm text-green-600 flex items-center gap-1">
                  <Check size={14} /> {t('gov_auto_applied', 'Cambio aplicado automaticamente en todos los nodos.')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Constantes */}
      {subTab === 'constants' && (
        <div className="space-y-3">
          <div className="card bg-amber-50 p-3 text-sm text-amber-700 flex items-start gap-2">
            <Lock size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              {t('gov_constants_federated', 'Estas constantes son federadas: son las mismas en todos los nodos. No se pueden editar directamente. Para cambiarlas, crea una propuesta en la pestana "Nueva Propuesta".')}
            </div>
          </div>
          {constants.map((c) => (
            <div key={c.key} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium flex items-center gap-2">
                    <Lock size={14} className="text-amber-500" />
                    {getKeyLabel(c.key)}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{c.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-trueque-700">{String(c.value)}</div>
                  <div className="text-xs text-gray-400">{t('gov_updated', 'Actualizado:')} {fmtDate(c.updated_at)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nueva Propuesta */}
      {subTab === 'new' && (
        <div className="card p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><Plus size={18} /> {t('gov_new_proposal_title', 'Nueva Propuesta Federada')}</h3>
          <p className="text-sm text-gray-500">
            {t('gov_new_proposal_desc', 'Propon un cambio que afectara a todos los nodos de la federacion. Todos los nodos federados tendran que aprobar el cambio. Cuando se alcance el consenso, el cambio se aplica automaticamente.')}
          </p>

          <div className="space-y-3">
            <div>
              <label className="label">{t('gov_which_constant', 'Que constante quieres cambiar?')}</label>
              <select
                className="input"
                value={newProposal.key}
                onChange={(e) => setNewProposal({ ...newProposal, key: e.target.value })}
              >
                <option value="basket_cost_internal_tq">{t('gov_key_basket_cost', `Canasta basica interna (en ${currency})`)}</option>
                <option value="fc_approval_threshold">{t('gov_key_approval_threshold', 'Umbral de aprobacion (%)')}</option>
                <option value="proposal_expiry_days">{t('gov_key_proposal_expiry', 'Dias de expiracion de propuestas')}</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {constants.find(c => c.key === newProposal.key)?.description}
              </p>
            </div>

            <div>
              <label className="label">{t('gov_proposed_value_label', 'Valor propuesto')}</label>
              <input
                type="number"
                className="input"
                placeholder={newProposal.key === 'basket_cost_internal_tq' ? 'Ej: 600' : ''}
                value={newProposal.proposed_value}
                onChange={(e) => setNewProposal({ ...newProposal, proposed_value: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-1">
                {t('gov_current_value', 'Valor actual:')} <b>{String(constants.find(c => c.key === newProposal.key)?.value ?? '?')}</b>
                {newProposal.key === 'basket_cost_internal_tq' && ` ${currency}`}
              </p>
            </div>

            <div>
              <label className="label">{t('gov_change_desc', 'Descripcion del cambio (por que se propone)')}</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Ej: Aumentar la canasta basica de 500 a 600 TQ debido al aumento del costo de los alimentos basicos."
                value={newProposal.description}
                onChange={(e) => setNewProposal({ ...newProposal, description: e.target.value })}
              />
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700">
            <strong>{t('gov_process_label', 'Proceso:')}</strong>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>{t('gov_process_1', 'Creas la propuesta (tu nodo auto-aprueba)')}</li>
              <li>{t('gov_process_2', 'La propuesta se comparte con todos los nodos federados')}</li>
              <li>{t('gov_process_3', 'Cada nodo aprueba o rechaza')}</li>
              <li>{t('gov_process_4', 'Cuando se alcanza el umbral actual (por defecto 75% = mayoria), el cambio se aplica en todos')}</li>
              <li>{t('gov_process_5', 'Si no se alcanza el consenso, se sigue usando el valor actual')}</li>
            </ol>
            <p className="mt-2"><strong>{t('gov_threshold_change_label', 'Cambio del umbral:')}</strong> {t('gov_threshold_change_desc', 'Para cambiar el umbral de aprobacion (por ejemplo de 75% a 100% o 50%+1), se crea una propuesta como cualquier otra. Esa propuesta se aprueba bajo el umbral actual. Si el umbral actual es 75%, la mayoria de los nodos debe aprobar el cambio. Una vez aprobado, las futuras propuestas usan el nuevo umbral.')}</p>
          </div>

          <button
            onClick={createProposal}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? t('gov_creating', 'Creando...') : <><Plus size={16} /> {t('gov_create_proposal', 'Crear Propuesta')}</>}
          </button>
        </div>
      )}

      {/* Nodos de la Red */}
      {subTab === 'nodes' && (
        <div className="space-y-4">
          <div className="card bg-blue-50 p-3 text-sm text-blue-700 flex items-start gap-2">
            <Network size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <strong>{t('gov_nodes_title', 'Nodos de la Red Federada.')}</strong> {t('gov_nodes_desc', 'Aqui aparecen todos los nodos que pertenecen a la federacion, aunque no estes federado directamente con todos. Las decisiones globales (votaciones) aplican a todos los nodos de la red, porque forman una cadena: si A esta federado con B, y B con C, las decisiones de A afectan a C aunque no esten directamente federados.')}
            </div>
          </div>

          {knownNodes.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">
              <Network size={32} className="mx-auto mb-2 text-gray-300" />
              {t('gov_no_known_nodes', 'No hay nodos conocidos. Este es el unico nodo.')}
            </div>
          ) : (
            <div className="space-y-2">
              {knownNodes.map((n, i) => (
                <div key={i} className={`card p-3 ${n.is_expelled ? 'border-red-300 bg-red-50' : n.is_this_node ? 'border-green-300 bg-green-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {n.is_this_node ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t('gov_this_node', 'Este nodo')}</span>
                      ) : n.is_direct_peer ? (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t('gov_direct_peer', 'Peer directo')}</span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{t('gov_indirect', 'Indirecto')}</span>
                      )}
                      {n.is_expelled && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded flex items-center gap-1">
                          <Ban size={10} /> {t('gov_expelled_badge', 'Expulsado')}
                        </span>
                      )}
                      <span className="font-medium text-sm">{n.node_domain}</span>
                    </div>
                    {n.node_number > 0 && (
                      <span className="text-xs text-gray-400">{t('gov_node_number', 'Nodo')} #{n.node_number}</span>
                    )}
                  </div>
                  {n.discovered_via && !n.is_direct_peer && !n.is_this_node && (
                    <p className="text-xs text-gray-400 mt-1">{t('gov_discovered_via', 'Descubierto via:')} {n.discovered_via}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Nodos expulsados */}
          {expelledNodes.length > 0 && (
            <div className="card p-4 border-red-200 bg-red-50">
              <h3 className="font-semibold flex items-center gap-2 mb-3 text-red-700">
                <Ban size={18} /> {t('gov_expelled_nodes', 'Nodos Expulsados')}
              </h3>
              <p className="text-xs text-red-600 mb-3">
                {t('gov_expelled_desc', 'Estos nodos fueron expulsados por votacion de la federacion. Para volver a entrar, deben solicitar ingreso nuevamente y aceptaran automaticamente todas las reglas existentes.')}
              </p>
              <div className="space-y-2">
                {expelledNodes.map((n, i) => (
                  <div key={i} className="bg-white p-3 rounded-lg border border-red-200">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{n.node_domain}</span>
                      <span className="text-xs text-gray-400">{fmtDate(n.expelled_at)}</span>
                    </div>
                    {n.reason && <p className="text-xs text-gray-600 mt-1">{n.reason}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expulsar Nodo */}
      {subTab === 'expel' && (
        <div className="space-y-4">
          <div className="card bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <strong>{t('gov_expel_warning_title', 'Expulsion de un nodo.')}</strong> {t('gov_expel_warning_desc', 'Esta es una accion grave. Se crea una propuesta de expulsion que los nodos deben aprobar (bajo el umbral actual, por defecto 75%). Si se aprueba, el nodo expulsado no podra participar en la federacion. Para volver a entrar, debera solicitar ingreso nuevamente y aceptara automaticamente todas las reglas existentes.')}
            </div>
          </div>

          <div className="card p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><Ban size={18} className="text-red-600" /> {t('gov_expel_title', 'Proponer Expulsion')}</h3>

            <div>
              <label className="label">{t('gov_expel_domain', 'Dominio del nodo a expulsar')}</label>
              <input
                type="text"
                className="input"
                placeholder="Ej: aldea-problematica.com"
                value={expelForm.node_domain}
                onChange={(e) => setExpelForm({ ...expelForm, node_domain: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-1">
                Ingresa el dominio exacto del nodo que quieres expulsar.
              </p>
            </div>

            <div>
              <label className="label">{t('gov_expel_reason', 'Razon de la expulsion')}</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Ej: El nodo se niega sistemanticamente a votar propuestas, bloqueando cambios que benefician a toda la federacion."
                value={expelForm.reason}
                onChange={(e) => setExpelForm({ ...expelForm, reason: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-1">
                {t('gov_expel_reason_hint', 'Explica por que se debe expulsar este nodo. Todos los nodos veran esta razon al votar.')}
              </p>
            </div>

            <div className="bg-amber-50 p-3 rounded-lg text-xs text-amber-700">
              <strong>{t('gov_expel_important_label', 'Importante:')}</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>{t('gov_expel_important_1', 'La propuesta se crea con el umbral actual (por defecto 75%)')}</li>
                <li>{t('gov_expel_important_2', 'Todos los nodos deben aprobar para que se aplique')}</li>
                <li>{t('gov_expel_important_3', 'Si se aprueba, el nodo no podra federarse ni comerciar')}</li>
                <li>{t('gov_expel_important_4', 'El nodo expulsado puede solicitar reingreso despues')}</li>
                <li>{t('gov_expel_important_5', 'Al reingresar, hereda automaticamente todas las reglas existentes')}</li>
              </ul>
            </div>

            <button
              onClick={createExpelProposal}
              disabled={saving || !expelForm.node_domain}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? t('gov_creating', 'Creando...') : <><Ban size={16} /> {t('gov_create_expel', 'Crear Propuesta de Expulsion')}</>}
            </button>
          </div>
        </div>
      )}

      {/* Detalle de propuesta (modal inline) */}
      {selectedProposal && (
        <div className="card p-4 border-2 border-blue-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">{t('gov_proposal_detail', 'Detalle de Propuesta')}</h3>
            <button onClick={() => setSelectedProposal(null)} className="text-gray-400"><X size={18} /></button>
          </div>
          <div className="space-y-2 text-sm">
            <div><span className="text-gray-500">{t('gov_constant', 'Constante:')}</span> {getKeyLabel(selectedProposal.key)}</div>
            <div><span className="text-gray-500">{t('gov_current_value', 'Valor actual:')}</span> <b>{String(selectedProposal.current_value)}</b></div>
            <div><span className="text-gray-500">{t('gov_proposed_value', 'Valor propuesto:')}</span> <b className="text-blue-700">{String(selectedProposal.proposed_value)}</b></div>
            <div><span className="text-gray-500">{t('gov_proposed_by', 'Propuesta por:')}</span> {selectedProposal.proposed_by_node}</div>
            <div><span className="text-gray-500">{t('status', 'Estado:')}</span> {selectedProposal.status}</div>
            {selectedProposal.description && <div><span className="text-gray-500">{t('gov_description', 'Descripcion:')}</span> {selectedProposal.description}</div>}
          </div>

          {selectedProposal.votes && selectedProposal.votes.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1"><Users size={14} /> {t('gov_node_votes', 'Votos de los nodos')}</h4>
              <div className="space-y-1">
                {selectedProposal.votes.map((v, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                    <div>
                      <span className="font-medium">{v.voter_node}</span>
                      {v.notes && <span className="text-gray-400 ml-2 text-xs">- {v.notes}</span>}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${v.vote === 'approve' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {v.vote === 'approve' ? t('gov_approved', 'Aprobo') : t('gov_rejected', 'Rechazo')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
