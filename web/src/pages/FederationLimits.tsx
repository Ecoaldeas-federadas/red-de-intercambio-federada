import { useState, useEffect } from 'react'
import { api } from '../api'
import { Plus } from 'lucide-react'

export default function FederationLimits() {
  const [config, setConfig] = useState<any>(null)
  const [bilaterals, setBilaterals] = useState<any[]>([])
  const [showPropose, setShowPropose] = useState(false)
  const [form, setForm] = useState({ remote_node: '', credit_limit: 0, debit_limit: 0 })

  const load = () => {
    api.get('/federation/config').then(setConfig).catch(() => {})
    api.get('/federation/bilateral').then((d: any) => setBilaterals(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const propose = async () => {
    await api.post('/federation/bilateral/propose', form)
    setShowPropose(false)
    setForm({ remote_node: '', credit_limit: 0, debit_limit: 0 })
    load()
  }

  const confirm = async (node: string) => {
    await api.post(`/federation/bilateral/${node}/confirm`, {})
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Limites de Federacion</h1>
        <button onClick={() => setShowPropose(!showPropose)} className="btn-primary flex items-center gap-2"><Plus size={18} />Proponer Bilateral</button>
      </div>
      {config && (
        <div className="card">
          <h2 className="font-semibold mb-3">Configuracion Global</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500">Credito Global:</span> <b>{config.node_global_credit_limit}</b></div>
            <div><span className="text-gray-500">Debito Global:</span> <b>{config.node_global_debit_limit}</b></div>
            <div><span className="text-gray-500">Base Bilateral:</span> <b>{config.node_bilateral_base_limit}</b></div>
            <div><span className="text-gray-500">Umbrales:</span> <b>{config.warning_threshold_1}/{config.warning_threshold_2}/{config.warning_threshold_3}%</b></div>
          </div>
        </div>
      )}
      {showPropose && (
        <div className="card space-y-3">
          <input className="input" placeholder="Nodo remoto" value={form.remote_node} onChange={(e) => setForm({ ...form, remote_node: e.target.value })} />
          <div className="flex gap-2">
            <input type="number" className="input" placeholder="Limite credito" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: parseInt(e.target.value) || 0 })} />
            <input type="number" className="input" placeholder="Limite debito" value={form.debit_limit} onChange={(e) => setForm({ ...form, debit_limit: parseInt(e.target.value) || 0 })} />
          </div>
          <button onClick={propose} className="btn-primary">Enviar Propuesta</button>
        </div>
      )}
      <div className="card">
        <h2 className="font-semibold mb-3">Limites Bilaterales</h2>
        {bilaterals.length === 0 ? <p className="text-gray-500 text-sm">No hay limites bilaterales</p> : (
          <div className="space-y-2">
            {bilaterals.map((b, i) => (
              <div key={i} className="flex items-center justify-between border-b border-gray-100 py-2">
                <div>
                  <span className="font-medium">{b.remote_node}</span>
                  {b.is_customized && <span className="ml-2 text-xs bg-trueque-100 text-trueque-700 px-2 py-0.5 rounded">Personalizado</span>}
                </div>
                <div className="text-sm text-gray-600">
                  Credito: {b.credit_limit} | Debito: {b.debit_limit}
                  {!b.remote_confirmed && <button onClick={() => confirm(b.remote_node)} className="ml-2 text-blue-600 hover:underline">Confirmar</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
