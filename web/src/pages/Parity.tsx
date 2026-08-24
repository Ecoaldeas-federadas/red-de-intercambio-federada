import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Scale, HelpCircle, ArrowDownCircle, ArrowUpCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function Parity() {
  const { currency } = useConfig()
  const [reports, setReports] = useState<any[]>([])
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    api.get('/federation/parity').then((d: any) => setReports(Array.isArray(d) ? d : d?.reports ?? [])).catch(() => {})
  }, [])

  const fmtNum = (n: number) => {
    if (!n || n === 0) return '0'
    return n.toLocaleString('es', { maximumFractionDigits: 2 })
  }

  const parityLabel = (ratio: number) => {
    if (!ratio || ratio === 0) return { text: 'Sin datos', color: 'text-gray-500', icon: <Minus size={16} /> }
    if (ratio >= 0.9 && ratio <= 1.1) return { text: 'Equilibrado', color: 'text-green-600', icon: <TrendingUp size={16} /> }
    if (ratio > 1.1) return { text: 'Importas mas', color: 'text-amber-600', icon: <TrendingDown size={16} /> }
    return { text: 'Exportas mas', color: 'text-blue-600', icon: <TrendingUp size={16} /> }
  }

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
          <p><strong>Reportes de Paridad - Ayuda completa</strong></p>

          <p><strong>Que es la paridad?</strong>
          La paridad mide si el intercambio entre tu nodo y otro nodo federado esta equilibrado o desequilibrado.
          Es como una balanza: de un lado estan las cosas que recibes del otro nodo (importaciones) y del otro
          lado las que envias (exportaciones).</p>

          <p><strong>Que significa cada valor?</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Paridad (ratio):</strong> Es el resultado de dividir importaciones entre exportaciones.
              <ul className="list-disc list-inside ml-4 mt-1">
                <li><strong>1.0</strong> = Equilibrado: importas y exportas lo mismo.</li>
                <li><strong>{'>'} 1.0</strong> = Importas mas de lo que exportas (ej: 1.5 = importas 50% mas).</li>
                <li><strong>{'<'} 1.0</strong> = Exportas mas de lo que importas (ej: 0.5 = exportas el doble).</li>
              </ul>
            </li>
            <li><strong>Importaciones:</strong> Total de {currency} que has recibido del otro nodo (compras).</li>
            <li><strong>Exportaciones:</strong> Total de {currency} que has enviado al otro nodo (ventas).</li>
            <li><strong>Balance:</strong> Exportaciones menos importaciones. Positivo = te deben. Negativo = debes.</li>
            <li><strong>FC local:</strong> Tu Factor de Conversion. Es cuanto vale 1 {currency} en energia (kWh).
              Ej: FC=5.0 significa que 1 {currency} = 5 kWh de energia.</li>
            <li><strong>FC remoto:</strong> El Factor de Conversion del otro nodo. Si es menor al tuyo,
              sus productos son mas baratos en energia. Si es mayor, son mas caros.</li>
          </ul>

          <p><strong>Que es el Factor de Conversion (FC)?</strong>
          El FC es la base de todo el sistema. Cada nodo calcula su FC segun su costo energetico local.
          Si en tu nodo 1 kWh cuesta 0.15 de tu moneda local, tu FC seria 0.15.
          El FC permite comparar valores entre nodos con diferentes monedas locales.</p>

          <p><strong>Como se compara con monedas externas (USD)?</strong>
          Convirtiendo ambos FC a una referencia comun (el precio del kWh en dolares).
          Asi puedes saber si tu {currency} esta sobrevaluado o subvaluado respecto al dolar.</p>

          <p><strong>Para que sirve?</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Detectar relaciones comerciales desequilibradas.</li>
            <li>Decidir si ajustar los limites bilaterales con un nodo.</li>
            <li>Promover exportaciones donde hay deficit.</li>
            <li>Fomentar intercambios en areas donde hay superavit.</li>
          </ul>

          <p><strong>Que hacer si hay desequilibrio?</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Si importas mucho: buscar productos locales que puedas exportar al otro nodo.</li>
            <li>Si exportas mucho: considerar importar productos que necesites del otro nodo.</li>
            <li>Si esta equilibrado: mantener la relacion comercial actual.</li>
          </ul>

          <p><strong>Sugerencias automaticas:</strong> El sistema muestra sugerencias cuando detecta
          desequilibrios. Si la paridad es alta (mucho intercambio en ambos sentidos), sugiere aumentar
          el limite bilateral. Si hay disparidad (mucho import, poco export), sugiere no aumentar el limite.</p>

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
          <div className="space-y-4">
            {reports.map((r, i) => {
              const p = parityLabel(r.parity_ratio)
              return (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Scale size={18} className="text-blue-600" />
                      <span className="font-semibold text-lg">{r.remote_node}</span>
                    </div>
                    <span className="text-sm text-gray-500">{r.created_at}</span>
                  </div>

                  {/* Paridad principal */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Paridad (import/export)</p>
                        <p className={`text-2xl font-bold ${p.color}`}>{fmtNum(r.parity_ratio)}</p>
                      </div>
                      <div className={`flex items-center gap-1 ${p.color}`}>
                        {p.icon}
                        <span className="text-sm font-medium">{p.text}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">1.0 = equilibrado | {'>'}1.0 = importas mas | {'<'}1.0 = exportas mas</p>
                  </div>

                  {/* Import / Export / Balance */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <ArrowDownCircle size={18} className="text-green-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">Importaciones</p>
                      <p className="font-bold text-green-700">{fmtNum(r.imports)} {currency}</p>
                      <p className="text-[10px] text-gray-400">recibiste del nodo</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <ArrowUpCircle size={18} className="text-blue-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">Exportaciones</p>
                      <p className="font-bold text-blue-700">{fmtNum(r.exports)} {currency}</p>
                      <p className="text-[10px] text-gray-400">enviaste al nodo</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${r.balance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <Scale size={18} className={`mx-auto mb-1 ${r.balance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                      <p className="text-xs text-gray-500">Balance</p>
                      <p className={`font-bold ${r.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {r.balance >= 0 ? '+' : ''}{fmtNum(r.balance)} {currency}
                      </p>
                      <p className="text-[10px] text-gray-400">{r.balance >= 0 ? 'te deben' : 'debes'}</p>
                    </div>
                  </div>

                  {/* FC local y remoto */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="border border-gray-200 rounded-lg p-3">
                      <p className="text-xs text-gray-500">FC local (tu nodo)</p>
                      <p className="font-bold text-lg">{fmtNum(r.local_fc)}</p>
                      <p className="text-[10px] text-gray-400">1 {currency} = {fmtNum(r.local_fc)} kWh de energia</p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-3">
                      <p className="text-xs text-gray-500">FC remoto ({r.remote_node})</p>
                      <p className="font-bold text-lg">{fmtNum(r.remote_fc)}</p>
                      <p className="text-[10px] text-gray-400">1 {currency} = {fmtNum(r.remote_fc)} kWh de energia</p>
                    </div>
                  </div>

                  {/* Uso del limite */}
                  {(r.import_pct_of_limit > 0 || r.export_pct_of_limit > 0) && (
                    <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Uso del limite (import):</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${Math.min(r.import_pct_of_limit, 100)}%` }} />
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{fmtNum(r.import_pct_of_limit)}% de {fmtNum(r.credit_limit)} {currency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Uso del limite (export):</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(r.export_pct_of_limit, 100)}%` }} />
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{fmtNum(r.export_pct_of_limit)}% de {fmtNum(r.credit_limit)} {currency}</p>
                      </div>
                    </div>
                  )}

                  {/* Sugerencia */}
                  {r.suggestion && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                      <p className="text-sm text-amber-800">
                        <strong>Sugerencia:</strong> {r.suggestion}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
