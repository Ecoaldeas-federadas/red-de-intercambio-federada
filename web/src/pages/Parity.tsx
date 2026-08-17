import { useState, useEffect } from 'react'
import { api } from '../api'
import { Scale, HelpCircle } from 'lucide-react'

export default function Parity() {
  const [reports, setReports] = useState<any[]>([])
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    api.get('/federation/parity').then((d: any) => setReports(Array.isArray(d) ? d : d?.reports ?? [])).catch(() => {})
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Scale size={24} />Reportes de Paridad</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
          <p><strong>Paridad - Ayuda</strong></p>
          <p><strong>Que es:</strong> La paridad mide el balance comercial entre tu nodo y cada nodo federado. Indica si hay un flujo equilibrado de intercambios o si hay desequilibrio.</p>
          <p><strong>Paridad bilateral:</strong> Compara tus importaciones vs exportaciones con un nodo especifico. Si la paridad es 1.0, hay equilibrio. Si es mayor, importas mas de lo que exportas.</p>
          <p><strong>Factor de Conversion (FC):</strong> Cada nodo tiene su propio FC basado en su costo energetico local. La paridad compara los FC de ambos nodos.</p>
          <p><strong>Para que sirve:</strong> Detectar relaciones comerciales desequilibradas y tomar decisiones (ajustar limites bilaterales, promover exportaciones, etc).</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      <div className="card">
        {reports.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No hay reportes de paridad.
            <br />
            <span className="text-sm">Los reportes se generan cuando hay transacciones con nodos federados.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r, i) => (
              <div key={i} className="border-b border-gray-100 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Nodo: {r.remote_node}</span>
                  <span className="text-sm text-gray-500">{r.created_at?.slice(0, 10)}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-2 text-sm">
                  <div>
                    <label className="label">Paridad</label>
                    <b>{r.parity_ratio}</b>
                    <p className="text-xs text-gray-400">1.0 = equilibrado</p>
                  </div>
                  <div>
                    <label className="label">FC local</label>
                    <b>{r.local_fc}</b>
                    <p className="text-xs text-gray-400">Tu factor de conversion</p>
                  </div>
                  <div>
                    <label className="label">FC remoto</label>
                    <b>{r.remote_fc}</b>
                    <p className="text-xs text-gray-400">Factor del otro nodo</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
