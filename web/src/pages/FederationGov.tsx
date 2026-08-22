import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Globe, Plus, Check, X, RefreshCw, Users, Vote, Lock, Info } from 'lucide-react'

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
  const { currency } = useConfig()
  const [constants, setConstants] = useState<FederationConstant[]>([])
  const [proposals, setProposals] = useState<FederationProposal[]>([])
  const [selectedProposal, setSelectedProposal] = useState<FederationProposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [subTab, setSubTab] = useState<'constants' | 'proposals' | 'new'>('proposals')

  const [newProposal, setNewProposal] = useState({
    key: 'basket_cost_internal_tq',
    proposed_value: '',
    description: '',
  })

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      await Promise.all([loadConstants(), loadProposals()])
    } finally {
      setLoading(false)
    }
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
      setMsg({ type: 'error', text: 'Debes ingresar un valor propuesto' })
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
      setMsg({ type: 'success', text: (res as any).message || 'Propuesta creada' })
      setNewProposal({ key: 'basket_cost_internal_tq', proposed_value: '', description: '' })
      setSubTab('proposals')
      await loadProposals()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Error al crear propuesta' })
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
          ? 'Voto registrado. Consenso alcanzado - cambio aplicado automaticamente.'
          : 'Voto registrado.',
      })
      await loadProposals()
      if (selectedProposal?.id === id) await loadProposalDetail(id)
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Error al votar' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><RefreshCw className="animate-spin text-trueque-600" size={24} /></div>
  }

  const getKeyLabel = (key: string) => {
    const labels: Record<string, string> = {
      'basket_cost_internal_tq': `Canasta basica interna (${currency})`,
      'fc_approval_threshold': 'Umbral de aprobacion (%)',
      'proposal_expiry_days': 'Dias de expiracion de propuestas',
    }
    return labels[key] || key
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Globe size={24} /> Federacion</h1>
        <button onClick={loadAll} className="text-gray-500 hover:text-gray-700"><RefreshCw size={18} /></button>
      </div>

      <div className="card bg-blue-50 p-3 text-sm text-blue-700 flex items-start gap-2">
        <Info size={16} className="flex-shrink-0 mt-0.5" />
        <div>
          <strong>Gobernanza Federada.</strong> Algunos valores afectan a TODA la federacion
          (como la canasta basica interna). No se pueden cambiar por nodo individual.
          Para cambiarlos, se crea una propuesta y todos los nodos federados deben aprobarla.
          <br /><br />
          <strong>Por defecto se requiere el 100% de los nodos</strong> (todos deben aprobar).
          Este umbral se puede cambiar, pero para cambiarlo se necesita la aprobacion bajo el umbral actual.
          Es decir: si el umbral actual es 100%, cambiarlo a 50%+1 requiere que todos los nodos aprueben.
          Una vez cambiado, las futuras propuestas se aprueban con el nuevo umbral.
          <br /><br />
          Cuando hay un solo nodo, sus propuestas se auto-aprueban (es el 100%).
          Los nodos nuevos que se unen a la federacion aceptan las politicas existentes.
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700' : msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setSubTab('proposals')} className={`px-3 py-1.5 rounded-lg text-sm ${subTab === 'proposals' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Propuestas</button>
        <button onClick={() => setSubTab('constants')} className={`px-3 py-1.5 rounded-lg text-sm ${subTab === 'constants' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Constantes Federadas</button>
        <button onClick={() => setSubTab('new')} className={`px-3 py-1.5 rounded-lg text-sm ${subTab === 'new' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><Plus size={14} className="inline mr-1" />Nueva Propuesta</button>
      </div>

      {/* Propuestas */}
      {subTab === 'proposals' && (
        <div className="space-y-3">
          {proposals.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">
              <Vote size={32} className="mx-auto mb-2 text-gray-300" />
              No hay propuestas federadas.
              <br />
              <span className="text-sm">Crea una propuesta para cambiar un valor que afecta a toda la federacion.</span>
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
                      {p.status === 'approved' ? 'Aprobada' :
                       p.status === 'rejected' ? 'Rechazada' :
                       p.status === 'expired' ? 'Expirada' :
                       'Pendiente'}
                    </span>
                  </div>
                  {p.description && <p className="text-sm text-gray-600 mt-1">{p.description}</p>}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs">Valor actual:</span>
                      <div className="font-medium">{String(p.current_value)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Valor propuesto:</span>
                      <div className="font-medium text-blue-700">{String(p.proposed_value)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Aprobaciones:</span>
                      <div className="font-medium text-green-600">{p.approvals}/{p.total_nodes} ({p.approval_pct}%)</div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Umbral:</span>
                      <div className="font-medium">{p.approval_threshold}%</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Propuesta por: {p.proposed_by_node} | {new Date(p.created_at).toLocaleDateString('es')}
                    {p.applied_at && ` | Aplicada: ${new Date(p.applied_at).toLocaleDateString('es')}`}
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
                    <Check size={14} /> Aprobar
                  </button>
                  <button
                    onClick={() => vote(p.id, 'reject')}
                    disabled={saving}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    <X size={14} /> Rechazar
                  </button>
                  <button
                    onClick={() => loadProposalDetail(p.id)}
                    className="px-3 py-1.5 bg-gray-200 rounded-lg text-sm"
                  >
                    Ver detalles
                  </button>
                </div>
              )}

              {p.status === 'approved' && (
                <div className="mt-3 pt-3 border-t text-sm text-green-600 flex items-center gap-1">
                  <Check size={14} /> Cambio aplicado automaticamente en todos los nodos.
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
              Estas constantes son <strong>federadas</strong>: son las mismas en todos los nodos.
              No se pueden editar directamente. Para cambiarlas, crea una propuesta en la pestana "Nueva Propuesta".
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
                  <div className="text-xs text-gray-400">Actualizado: {new Date(c.updated_at).toLocaleDateString('es')}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nueva Propuesta */}
      {subTab === 'new' && (
        <div className="card p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><Plus size={18} /> Nueva Propuesta Federada</h3>
          <p className="text-sm text-gray-500">
            Propon un cambio que afectara a todos los nodos de la federacion.
            Todos los nodos federados tendran que aprobar el cambio.
            Cuando se alcance el consenso, el cambio se aplica automaticamente.
          </p>

          <div className="space-y-3">
            <div>
              <label className="label">Que constante quieres cambiar?</label>
              <select
                className="input"
                value={newProposal.key}
                onChange={(e) => setNewProposal({ ...newProposal, key: e.target.value })}
              >
                <option value="basket_cost_internal_tq">Canasta basica interna (en {currency})</option>
                <option value="fc_approval_threshold">Umbral de aprobacion (%)</option>
                <option value="proposal_expiry_days">Dias de expiracion de propuestas</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {constants.find(c => c.key === newProposal.key)?.description}
              </p>
            </div>

            <div>
              <label className="label">Valor propuesto</label>
              <input
                type="number"
                className="input"
                placeholder={newProposal.key === 'basket_cost_internal_tq' ? 'Ej: 600' : ''}
                value={newProposal.proposed_value}
                onChange={(e) => setNewProposal({ ...newProposal, proposed_value: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-1">
                Valor actual: <b>{String(constants.find(c => c.key === newProposal.key)?.value ?? '?')}</b>
                {newProposal.key === 'basket_cost_internal_tq' && ` ${currency}`}
              </p>
            </div>

            <div>
              <label className="label">Descripcion del cambio (por que se propone)</label>
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
            <strong>Proceso:</strong>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Creas la propuesta (tu nodo auto-aprueba)</li>
              <li>La propuesta se comparte con todos los nodos federados</li>
              <li>Cada nodo aprueba o rechaza</li>
              <li>Cuando se alcanza el umbral actual (por defecto 100% = todos), el cambio se aplica en todos</li>
              <li>Si no se alcanza el consenso, se sigue usando el valor actual</li>
            </ol>
            <p className="mt-2"><strong>Cambio del umbral:</strong> Para cambiar el umbral de aprobacion
            (por ejemplo de 100% a 50%+1), se crea una propuesta como cualquier otra.
            Esa propuesta se aprueba bajo el umbral <em>actual</em>. Si el umbral actual es 100%,
            todos los nodos deben aprobar el cambio. Una vez aprobado, las futuras propuestas
 usan el nuevo umbral.</p>
          </div>

          <button
            onClick={createProposal}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? 'Creando...' : <><Plus size={16} /> Crear Propuesta</>}
          </button>
        </div>
      )}

      {/* Detalle de propuesta (modal inline) */}
      {selectedProposal && (
        <div className="card p-4 border-2 border-blue-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Detalle de Propuesta</h3>
            <button onClick={() => setSelectedProposal(null)} className="text-gray-400"><X size={18} /></button>
          </div>
          <div className="space-y-2 text-sm">
            <div><span className="text-gray-500">Constante:</span> {getKeyLabel(selectedProposal.key)}</div>
            <div><span className="text-gray-500">Valor actual:</span> <b>{String(selectedProposal.current_value)}</b></div>
            <div><span className="text-gray-500">Valor propuesto:</span> <b className="text-blue-700">{String(selectedProposal.proposed_value)}</b></div>
            <div><span className="text-gray-500">Propuesta por:</span> {selectedProposal.proposed_by_node}</div>
            <div><span className="text-gray-500">Estado:</span> {selectedProposal.status}</div>
            {selectedProposal.description && <div><span className="text-gray-500">Descripcion:</span> {selectedProposal.description}</div>}
          </div>

          {selectedProposal.votes && selectedProposal.votes.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1"><Users size={14} /> Votos de los nodos</h4>
              <div className="space-y-1">
                {selectedProposal.votes.map((v, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                    <div>
                      <span className="font-medium">{v.voter_node}</span>
                      {v.notes && <span className="text-gray-400 ml-2 text-xs">- {v.notes}</span>}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${v.vote === 'approve' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {v.vote === 'approve' ? 'Aprobo' : 'Rechazo'}
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
