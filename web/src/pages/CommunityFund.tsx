import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { usePermissions } from '../hooks/usePermissions'
import { HelpCircle, Wallet, Users, Vote as VoteIcon, Plus, Check, X } from 'lucide-react'

export default function CommunityFund() {
  const { currency } = useConfig()
  const { hasPermission } = usePermissions()
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [fund, setFund] = useState<any>(null)
  const [proposals, setProposals] = useState<any[]>([])
  const [showNewProposal, setShowNewProposal] = useState(false)
  const [newProposal, setNewProposal] = useState({ amount: 0, recipient: '', reason: '' })

  const load = () => {
    api.get('/fund/balance').then(setFund).catch(() => {})
    // Las propuestas multi-sig del fondo son propuestas de asamblea de tipo budget_increase
    api.get('/assembly/proposals').then((d: any) => {
      const all = Array.isArray(d) ? d : []
      setProposals(all.filter((p: any) => p.proposal_type === 'budget_increase' || p.proposal_type === 'fund_distribution'))
    }).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const createProposal = async () => {
    setError('')
    if (newProposal.amount <= 0 || !newProposal.recipient) {
      setError('Monto y destinatario son obligatorios')
      return
    }
    try {
      await api.post('/assembly/proposals', {
        proposal_type: 'budget_increase',
        description: `Distribucion del fondo: ${newProposal.reason}`,
        parameters: {
          organizacion: newProposal.recipient,
          monto: newProposal.amount,
        },
      })
      setShowNewProposal(false)
      setNewProposal({ amount: 0, recipient: '', reason: '' })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const vote = async (id: string, vote: string) => {
    try {
      await api.post(`/assembly/proposals/${id}/vote`, { vote })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const execute = async (id: string) => {
    try {
      await api.post(`/assembly/proposals/${id}/execute`, {})
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet size={24} />Fondo Comunitario</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Fondo Comunitario - Ayuda</strong></p>
          <p><strong>Para que sirve:</strong> El fondo comunitario acumula los impuestos de las transacciones. Ese dinero se usa para infraestructura, servicios publicos, ayuda mutual y proyectos aprobados por la asamblea.</p>
          <p><strong>Como se llena:</strong> Cada vez que alguien hace una transferencia, se aplica un porcentaje de impuesto que va automaticamente al fondo.</p>
          <p><strong>Como se gasta:</strong> Cualquier gasto del fondo debe ser aprobado por votacion de la asamblea. Crea una propuesta indicando cuanto y para quien.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {/* Balance del fondo */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><Wallet size={18} />Balance del Fondo</h2>
        {fund ? (
          fund.fund_account ? (
            <div className="space-y-2">
              <div className="text-3xl font-bold text-trueque-700">{fund.balance} {currency}</div>
              <p className="text-sm text-gray-500">Cuenta: {fund.username || fund.fund_account}</p>
            </div>
          ) : (
            <div>
              <p className="text-amber-600 text-sm">{fund.message}</p>
              <p className="text-xs text-gray-400 mt-2">Para que los impuestos se acumulen, necesita una cuenta tipo 'fund'. Contacta al administrador.</p>
            </div>
          )
        ) : (
          <p className="text-gray-500 text-sm">Cargando...</p>
        )}
      </div>

      {/* Propuestas de distribucion */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold flex items-center gap-2"><VoteIcon size={18} />Propuestas de Distribucion</h2>
          <button onClick={() => setShowNewProposal(!showNewProposal)} className="btn-primary flex items-center gap-2"><Plus size={18} />Nueva Propuesta</button>
        </div>

        {showNewProposal && (
          <div className="card space-y-4">
            <h3 className="font-semibold">Proponer Distribucion del Fondo</h3>
            <div>
              <label className="label">Destinatario (organizacion o usuario)</label>
              <input className="input" placeholder="Ej: coop_norte" value={newProposal.recipient} onChange={(e) => setNewProposal({ ...newProposal, recipient: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Quien recibira el dinero del fondo.</p>
            </div>
            <div>
              <label className="label">Monto ({currency})</label>
              <input type="number" className="input" value={newProposal.amount} onChange={(e) => setNewProposal({ ...newProposal, amount: parseInt(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Cuanto dinero del fondo se distribuira.</p>
            </div>
            <div>
              <label className="label">Razon</label>
              <textarea className="input" rows={2} placeholder="Para que se usara el dinero" value={newProposal.reason} onChange={(e) => setNewProposal({ ...newProposal, reason: e.target.value })} />
            </div>
            <button onClick={createProposal} className="btn-primary">Crear Propuesta</button>
          </div>
        )}

        {proposals.length === 0 && !showNewProposal ? (
          <div className="card text-center text-gray-500 py-8">
            <p>No hay propuestas de distribucion.</p>
            <p className="text-xs mt-2">Crea una propuesta para distribuir dinero del fondo comunitario.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((p, i) => (
              <div key={i} className="card">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.description}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    p.status === 'executed' ? 'bg-green-100 text-green-700' :
                    p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{p.status}</span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="text-green-600">A favor: {p.votes_for || 0}</span>
                  <span className="text-red-600">En contra: {p.votes_against || 0}</span>
                </div>
                {p.status === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => vote(p.id, 'for')} className="btn-secondary text-green-600 flex items-center gap-1"><Check size={16} />A favor</button>
                    <button onClick={() => vote(p.id, 'against')} className="btn-secondary text-red-600 flex items-center gap-1"><X size={16} />En contra</button>
                    <button onClick={() => execute(p.id)} className="btn-primary ml-auto">Ejecutar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
