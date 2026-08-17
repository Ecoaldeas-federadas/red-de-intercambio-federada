import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { HelpCircle, History as HistoryIcon } from 'lucide-react'

export default function History() {
  const { currency } = useConfig()
  const [txs, setTxs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    api.get('/ledger/transactions').then((data: any) => {
      setTxs(Array.isArray(data) ? data : data?.transactions ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><HistoryIcon size={24} />Historial de Transacciones</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Historial - Ayuda</strong></p>
          <p><strong>Para que sirve:</strong> Muestra todas las transacciones (transferencias, pagos, compras) en las que has participado, ya sea como remitente o destinatario.</p>
          <p><strong>Columnas:</strong></p>
          <ul className="list-disc list-inside ml-4">
            <li><strong>Fecha:</strong> Cuando se hizo la transaccion</li>
            <li><strong>De:</strong> Quien envio el dinero</li>
            <li><strong>A:</strong> Quien recibio el dinero</li>
            <li><strong>Monto:</strong> Cuantos Trueques ({currency}) se transfirieron</li>
            <li><strong>Ref:</strong> Referencia o nota dejada por quien envio</li>
          </ul>
          <p><strong>Nota:</strong> El sistema suma cero. Si alguien envio 50 {currency}, su saldo bajo 50 y el del destinatario subio 50.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : txs.length === 0 ? (
        <div className="card text-center text-gray-500 py-8">
          <p>No hay transacciones todavia.</p>
          <p className="text-xs mt-2">Las transacciones aparecen cuando transfieres o recibes Trueques. Ve a Transferir o Pagos para hacer una transaccion.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-gray-600">
              <th className="py-2">Fecha</th><th>De</th><th>A</th><th>Monto</th><th>Ref</th>
            </tr></thead>
            <tbody>
              {txs.map((t, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2">{t.created_at?.slice(0, 10)}</td>
                  <td>{t.from_user}</td><td>{t.to_user}</td>
                  <td className="font-semibold text-trueque-700">{t.amount} {currency}</td>
                  <td>{t.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
