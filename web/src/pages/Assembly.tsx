import { useState, useEffect } from 'react'
import { api } from '../api'
import { Plus, Check, X } from 'lucide-react'

export default function Assembly() {
  const [proposals, setProposals] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', proposal_type: 'policy' })

  const load = () => api.get('/assembly/proposals').then((d: any) => setProposals(Array.isArray(d) ? d : d?.proposals ?? [])).catch(() => {})
  useEffect(() => { load() }, [])

  const create = async () => {
    await api.post('/assembly/proposals', form)
    setShowForm(false)
    setForm({ title: '', description: '', proposal_type: 'policy' })
    load()
  }

  const vote = async (id: string, support: boolean) => {
    await api.post(`/assembly/proposals/${id}/vote`, { support })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Asamblea</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={18} />Nueva Propuesta</button>
      </div>
      {showForm && (
        <div className="card space-y-3">
          <input className="input" placeholder="Titulo" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="input" rows={3} placeholder="Descripcion" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="input" value={form.proposal_type} onChange={(e) => setForm({ ...form, proposal_type: e.target.value })}>
            <option value="policy">Politica</option>
            <option value="limit_change">Cambio de limite</option>
            <option value="membership">Membresia</option>
            <option value="other">Otro</option>
          </select>
          <button onClick={create} className="btn-primary">Crear Propuesta</button>
        </div>
      )}
      <div className="space-y-3">
        {proposals.map((p, i) => (
          <div key={i} className="card">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{p.description}</p>
              </div>
              <span className="text-xs bg-gray-100 px-2 py-1 rounded">{p.status}</span>
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm">
              <span className="text-trueque-600">A favor: {p.votes_for ?? 0}</span>
              <span className="text-red-600">En contra: {p.votes_against ?? 0}</span>
              {p.status === 'open' && (
                <div className="ml-auto flex gap-2">
                  <button onClick={() => vote(p.id, true)} className="btn-secondary flex items-center gap-1"><Check size={16} />A favor</button>
                  <button onClick={() => vote(p.id, false)} className="btn-secondary flex items-center gap-1"><X size={16} />En contra</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
