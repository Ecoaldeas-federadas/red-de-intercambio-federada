import { useState, useEffect } from 'react'
import { api } from '../api'
import { Users, Plus } from 'lucide-react'

export default function Organizations() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', display_name: '', organization_subtype: 'cooperative', credit_limit: 0, debit_limit: 0, tax_rate: 0, public_key: '' })

  const load = () => api.get('/organizations').then((d: any) => setOrgs(Array.isArray(d) ? d : [])).catch(() => {})
  useEffect(() => { load() }, [])

  const create = async () => {
    await api.post('/organizations', form)
    setShowForm(false)
    setForm({ username: '', display_name: '', organization_subtype: 'cooperative', credit_limit: 0, debit_limit: 0, tax_rate: 0, public_key: '' })
    load()
  }

  const approve = async (id: string) => { await api.post(`/organizations/${id}/approve`, {}); load() }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organizaciones</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={18} />Nueva</button>
      </div>
      {showForm && (
        <div className="card space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Usuario" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <input className="input" placeholder="Nombre" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            <select className="input" value={form.organization_subtype} onChange={(e) => setForm({ ...form, organization_subtype: e.target.value })}>
              <option value="cooperative">Cooperativa</option>
              <option value="association">Asociacion</option>
              <option value="collective">Colectivo</option>
              <option value="public_institution">Institucion Publica</option>
            </select>
            <input type="number" className="input" placeholder="Tasa impositiva %" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })} />
            <input type="number" className="input" placeholder="Limite credito" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: parseInt(e.target.value) || 0 })} />
            <input type="number" className="input" placeholder="Limite debito" value={form.debit_limit} onChange={(e) => setForm({ ...form, debit_limit: parseInt(e.target.value) || 0 })} />
          </div>
          <button onClick={create} className="btn-primary">Crear Organizacion</button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {orgs.map((org, i) => (
          <div key={i} className="card">
            <div className="flex items-center gap-2 mb-2">
              <Users size={20} className="text-trueque-600" />
              <h3 className="font-semibold">{org.display_name}</h3>
            </div>
            <p className="text-sm text-gray-600">@{org.username}</p>
            <p className="text-xs text-gray-400 mt-1">Tipo: {org.organization_subtype}</p>
            <div className="flex items-center justify-between mt-3">
              <span className={`text-xs px-2 py-1 rounded ${org.membership_status === 'active' ? 'bg-trueque-100 text-trueque-700' : 'bg-yellow-100 text-yellow-700'}`}>{org.membership_status}</span>
              {org.membership_status === 'pending' && <button onClick={() => approve(org.id)} className="btn-secondary text-sm">Aprobar</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
