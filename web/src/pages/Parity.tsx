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
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Paridad - Ayuda</strong></p>
          <p><strong>Que es la paridad:</strong> La paridad mide el balance comercial entre tu nodo y cada nodo federado. Indica si hay un flujo equilibrado de intercambios o si hay desequilibrio. Es como una balanza: de un lado estan las cosas que recibes del otro nodo (importaciones) y del otro las que envias (exportaciones).</p>
          <p><strong>Como se calcula:</strong> La paridad bilateral se calcula dividiendo el valor total de tus importaciones desde un nodo entre el valor total de tus exportaciones hacia ese mismo nodo. El resultado es un numero: 1.0 significa equilibrio perfecto, mas de 1.0 significa que importas mas de lo que exportas, y menos de 1.0 significa que exportas mas de lo que importas.</p>
          <p><strong>Factor de Conversion (FC):</strong> Cada nodo tiene su propio Factor de Conversion basado en su costo energetico local. El FC es la relacion entre la moneda local del nodo y el kWh (energia). Por ejemplo, si en tu nodo 1 kWh cuesta 0.15 de tu moneda local, tu FC es 0.15. La paridad compara los FC de ambos nodos para convertir los valores a una unidad comun antes de compararlos.</p>
          <p><strong>Comparacion con monedas externas (USD):</strong> Ademas de comparar entre nodos federados, la paridad permite comparar el valor de tu moneda local con monedas externas como el dolar (USD). Esto se hace convirtiendo ambos FC a una referencia comun (por ejemplo, el precio del kWh en dolares) y calculando la relacion. Asi puedes saber si tu moneda local esta sobrevaluada o subvaluada respecto al dolar.</p>
          <p><strong>CPI externo (Indice de Precios al Consumidor):</strong> El CPI externo es un indicador que mide la inflacion o variacion de precios en una economia de referencia (por ejemplo, la economia del pais donde circula el USD). Se usa para ajustar la paridad a lo largo del tiempo: si el CPI externo sube, significa que la moneda externa pierde poder adquisitivo, lo que afecta la comparacion con tu moneda local.</p>
          <p><strong>Costo energetico local:</strong> Es el precio en moneda local de 1 kWh de energia en tu nodo. Este valor es la base de todo el sistema: define tu Factor de Conversion (FC) y, por tanto, el valor de tu moneda respecto a otros nodos y monedas externas. Un costo energetico bajo hace que tu moneda local valga mas en terminos de energia.</p>
          <p><strong>Paridad bilateral:</strong> Compara tus importaciones vs exportaciones con un nodo especifico. Si la paridad es 1.0, hay equilibrio. Si es mayor, importas mas de lo que exportas.</p>
          <p><strong>Para que sirve:</strong> Detectar relaciones comerciales desequilibradas y tomar decisiones (ajustar limites bilaterales, promover exportaciones, fomentar intercambios en areas donde hay deficit, etc).</p>
          <p><strong>Como se usa:</strong> Revisa los reportes a continuacion. Cada reporte muestra un nodo federado, la fecha del reporte, la paridad bilateral (ratio), tu FC local y el FC remoto del otro nodo. Si ves paridades muy alejadas de 1.0, considera ajustar tus estrategias de intercambio con ese nodo.</p>
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
