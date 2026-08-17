import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Plus, Check, X, HelpCircle, Globe } from 'lucide-react'

export default function ExternalBridge() {
  const { currency } = useConfig()
  const [fc, setFc] = useState<any>(null)
  const [ops, setOps] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
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
        <h1 className="text-2xl font-bold flex items-center gap-2"><Globe size={24} />Comercio Externo (DEX)</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={18} />Nueva Operacion</button>
        </div>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
          <p><strong>Comercio Externo (DEX) - Ayuda</strong></p>
          <p><strong>Que es:</strong> El DEX (Decentralized Exchange) permite comprar y vender productos con el exterior de la red federada, usando monedas externas (USD, etc).</p>
          <p><strong>Factor de Conversion (FC):</strong> Relacion entre la moneda externa (USD) y el Trueque ({currency}). Se calcula comparando el costo de vida externo (CPI) con el costo energetico local.</p>
          <p><strong>Importacion:</strong> Traer productos de fuera. Paga en {currency}, el sistema convierte al precio externo usando el FC.</p>
          <p><strong>Exportacion:</strong> Vender productos al exterior. Recibes {currency}, el externo paga en su moneda.</p>
          <p><strong>Logistica e impuestos:</strong> Se agregan al costo total como porcentajes. La logistica cubre transporte, los impuestos son aranceles externos.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {fc && (
        <div className="card bg-blue-50">
          <h2 className="font-semibold">Factor de Conversion Actual (FC)</h2>
          <p className="text-2xl font-bold text-blue-700 mt-1">1 USD = {fc.factor} {currency}</p>
          <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
            <div><span className="text-gray-500">CPI externo:</span> <b>{fc.external_cpi}</b></div>
            <div><span className="text-gray-500">Costo energia local:</span> <b>{fc.local_energy_cost} kWh</b></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">El FC indica cuantos Trueques equivale 1 dolar externo, basado en el costo de vida y la energia local.</p>
        </div>
      )}

      {showForm && (
        <div className="card space-y-4">
          <h2 className="font-semibold">Nueva Operacion de Comercio Externo</h2>

          <div>
            <label className="label">Tipo de operacion</label>
            <select className="input" value={form.operation_type} onChange={(e) => setForm({ ...form, operation_type: e.target.value })}>
              <option value="import">Importacion (comprar de fuera)</option>
              <option value="export">Exportacion (vender afuera)</option>
            </select>
          </div>

          <div>
            <label className="label">Producto</label>
            <input className="input" placeholder="Ej: Harina de trigo" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cantidad</label>
              <input type="number" className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Unidades del producto.</p>
            </div>
            <div>
              <label className="label">Precio externo (USD)</label>
              <input type="number" className="input" value={form.external_price_usd} onChange={(e) => setForm({ ...form, external_price_usd: parseFloat(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Precio en dolares por unidad.</p>
            </div>
            <div>
              <label className="label">Precio local ({currency})</label>
              <input type="number" className="input" value={form.local_price_trueque} onChange={(e) => setForm({ ...form, local_price_trueque: parseInt(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Precio en Trueques por unidad.</p>
            </div>
            <div>
              <label className="label">Logistica (%)</label>
              <input type="number" className="input" value={form.logistics_pct} onChange={(e) => setForm({ ...form, logistics_pct: parseFloat(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Porcentaje por transporte y aduana.</p>
            </div>
            <div>
              <label className="label">Impuesto externo (%)</label>
              <input type="number" className="input" value={form.external_tax_rate} onChange={(e) => setForm({ ...form, external_tax_rate: parseFloat(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Arancel o impuesto del pais externo.</p>
            </div>
          </div>

          <button onClick={create} className="btn-primary">Crear Operacion</button>
        </div>
      )}

      <div className="space-y-2">
        {ops.length === 0 && !showForm ? (
          <div className="card text-center text-gray-500 py-8">
            No hay operaciones de comercio externo.
            <br />
            <span className="text-sm">Crea una nueva operacion con el boton de arriba.</span>
          </div>
        ) : ops.map((op, i) => (
          <div key={i} className="card flex items-center justify-between">
            <div>
              <span className="font-medium">{op.operation_type === 'import' ? 'Importacion' : 'Exportacion'}: {op.product_name}</span>
              <p className="text-sm text-gray-600">Cant: {op.quantity} | Total: {op.total_trueque} {currency} | FC usado: {op.fc_used}</p>
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
