import { useState, useEffect } from 'react'
import { api } from '../api'
import { Plus, HelpCircle, Network } from 'lucide-react'

export default function FederationLimits() {
  const [config, setConfig] = useState<any>(null)
  const [bilaterals, setBilaterals] = useState<any[]>([])
  const [nodes, setNodes] = useState<any[]>([])
  const [showPropose, setShowPropose] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [form, setForm] = useState({ remote_node: '', credit_limit: 0, debit_limit: 0 })

  const load = () => {
    api.get('/federation/config').then(setConfig).catch(() => {})
    api.get('/federation/bilateral').then((d: any) => setBilaterals(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/federation/nodes').then((d: any) => {
      const arr = Array.isArray(d) ? d : []
      setNodes(arr)
      // Pre-seleccionar el primer nodo si hay
      if (arr.length > 0 && !form.remote_node) {
        setForm((f) => ({ ...f, remote_node: arr[0].remote_node }))
      }
    }).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const propose = async () => {
    if (!form.remote_node) return
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
        <h1 className="text-2xl font-bold flex items-center gap-2"><Network size={24} />Limites de Federacion</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
          <button onClick={() => setShowPropose(!showPropose)} className="btn-primary flex items-center gap-2"><Plus size={18} />Proponer Bilateral</button>
        </div>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
          <p><strong>Limites de Federacion - Ayuda</strong></p>
          <p><strong>Limite Global:</strong> Deuda/saldo maximo total del nodo con toda la red. Aplica a todos los nodos al nivel base.</p>
          <p><strong>Limite Bilateral:</strong> Limite personalizado entre dos nodos. Si dos nodos acuerdan un limite mayor, NO consume el limite global.</p>
          <p><strong>Como funciona:</strong> El limite efectivo entre dos nodos = min(limite_A_hacia_B, limite_B_hacia_A). Ambos deben subirlo para que aplique.</p>
          <p><strong>Base bilateral:</strong> Limite inicial igual para todos los pares (ej: 50% del global).</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {config && (
        <div className="card">
          <h2 className="font-semibold mb-3">Configuracion Global</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <label className="label">Credito Global</label>
              <b>{config.node_global_credit_limit} TQ</b>
            </div>
            <div>
              <label className="label">Debito Global</label>
              <b>{config.node_global_debit_limit} TQ</b>
            </div>
            <div>
              <label className="label">Base Bilateral</label>
              <b>{config.node_bilateral_base_limit} TQ</b>
            </div>
            <div>
              <label className="label">Umbrales de aviso</label>
              <b>{config.warning_threshold_1}/{config.warning_threshold_2}/{config.warning_threshold_3}%</b>
            </div>
          </div>
        </div>
      )}

      {showPropose && (
        <div className="card space-y-4">
          <h2 className="font-semibold">Proponer Limite Bilateral</h2>
          <p className="text-xs text-gray-500">Selecciona un nodo federado y propone nuevos limites. El otro nodo debe confirmar.</p>

          <div>
            <label className="label">Nodo remoto</label>
            {nodes.length > 0 ? (
              <select className="input" value={form.remote_node} onChange={(e) => setForm({ ...form, remote_node: e.target.value })}>
                <option value="">Seleccionar nodo...</option>
                {nodes.map((n, i) => (
                  <option key={i} value={n.remote_node}>{n.remote_node}</option>
                ))}
              </select>
            ) : (
              <input className="input" placeholder="No hay nodos federados. Registra un nodo primero." value={form.remote_node} onChange={(e) => setForm({ ...form, remote_node: e.target.value })} />
            )}
            <p className="text-xs text-gray-400 mt-1">Selecciona de la lista de nodos federados registrados.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Limite de credito (TQ)</label>
              <input type="number" className="input" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: parseInt(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Maximo saldo positivo con este nodo.</p>
            </div>
            <div>
              <label className="label">Limite de debito (TQ)</label>
              <input type="number" className="input" value={form.debit_limit} onChange={(e) => setForm({ ...form, debit_limit: parseInt(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Maximo saldo negativo (deuda) con este nodo.</p>
            </div>
          </div>

          <button onClick={propose} className="btn-primary" disabled={!form.remote_node}>Enviar Propuesta</button>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold mb-3">Limites Bilaterales</h2>
        {bilaterals.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay limites bilaterales personalizados. Todos los nodos usan el limite base.</p>
        ) : (
          <div className="space-y-2">
            {bilaterals.map((b, i) => (
              <div key={i} className="flex items-center justify-between border-b border-gray-100 py-2">
                <div>
                  <span className="font-medium">{b.remote_node}</span>
                  {b.is_customized && <span className="ml-2 text-xs bg-trueque-100 text-trueque-700 px-2 py-0.5 rounded">Personalizado</span>}
                </div>
                <div className="text-sm text-gray-600">
                  Credito: {b.credit_limit} TQ | Debito: {b.debit_limit} TQ
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
