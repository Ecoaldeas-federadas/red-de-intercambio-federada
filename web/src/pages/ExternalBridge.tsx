import { useState, useEffect } from 'react'
import { api } from '../api'
import { Plus, Check, X } from 'lucide-react'

export default function ExternalBridge() {
  const [fc, setFc] = useState<any>(null)
  const [ops, setOps] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ operation_type: 'import', product_name: '', quantity: 0, external_price_usd: 0, local_price_trueque: 0, logistics_pct: 0, external_tax_rate: 0 })

  const load = () => {
    api.get('/external/fc').then(setFc).catch(() => {})
    api.get('/external/operations').then((d: any) => setOps(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    await api.post('/external/operations', form)
    setShowForm(false)
    setForm({ operation_type: 'import', product_name: '', quantity: 0, external_price_usd: 0, local_price_trueque: 0, logistics_pct: 0, external_tax_rate: 0 })
    load()
  }

  const approve = async (id: string) => { await api.post(`/external/operations/${id}/approve`, {}); load() }
  const reject = async (id: string) => { await api.post(`/external/operations/${id}/reject`, {}); load() }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Comercio Externo (DEX)</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={18} />Nueva Operacion</button>
      </div>

      {fc && (
        <div className="card bg-blue-50">
          <h2 className="font-semibold">Factor de Conversion Actual</h2>
          <p className="text-2xl font-bold text-blue-700 mt-1">1 USD = {fc.factor} TQ</p>
          <p className="text-sm text-gray-600">CPI: {fc.external_cpi} | Energia local: {fc.local_energy_cost}</p>
        </div>
      )}

      {showForm && (
        <div className="card space-y-3">
          <div className="flex gap-2">
            <select className="input" value={form.operation_type} onChange={(e) => setForm({ ...form, operation_type: e.target.value })}>
              <option value="import">Importacion</option>
              <option value="export">Exportacion</option>
            </select>
            <input className="input" placeholder="Producto" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" className="input" placeholder="Cantidad" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} />
            <input type="number" className="input" placeholder="Precio USD" value={form.external_price_usd} onChange={(e) => setForm({ ...form, external_price_usd: parseFloat(e.target.value) || 0 })} />
            <input type="number" className="input" placeholder="Precio TQ" value={form.local_price_trueque} onChange={(e) => setForm({ ...form, local_price_trueque: parseInt(e.target.value) || 0 })} />
            <input type="number" className="input" placeholder="Logistica %" value={form.logistics_pct} onChange={(e) => setForm({ ...form, logistics_pct: parseFloat(e.target.value) || 0 })} />
            <input type="number" className="input" placeholder="Impuesto externo %" value={form.external_tax_rate} onChange={(e) => setForm({ ...form, external_tax_rate: parseFloat(e.target.value) || 0 })} />
          </div>
          <button onClick={create} className="btn-primary">Crear Operacion</button>
        </div>
      )}

      <div className="space-y-2">
        {ops.map((op, i) => (
          <div key={i} className="card flex items-center justify-between">
            <div>
              <span className="font-medium">{op.operation_type === 'import' ? 'Importacion' : 'Exportacion'}: {op.product_name}</span>
              <p className="text-sm text-gray-600">Cant: {op.quantity} | Total: {op.total_trueque} TQ | FC: {op.fc_used}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded ${op.status === 'approved' ? 'bg-trueque-100 text-trueque-700' : op.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{op.status}</span>
              {op.status === 'pending' && (
                <>
                  <button onClick={() => approve(op.id)} className="btn-secondary flex items-center gap-1"><Check size={16} /></button>
                  <button onClick={() => reject(op.id)} className="btn-secondary flex items-center gap-1"><X size={16} /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
