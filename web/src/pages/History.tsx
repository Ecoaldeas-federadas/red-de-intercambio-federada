import { useState, useEffect } from 'react'
import { api } from '../api'

export default function History() {
  const [txs, setTxs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/ledger/transactions').then((data: any) => {
      setTxs(Array.isArray(data) ? data : data?.transactions ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Historial de Transacciones</h1>
      {loading ? <p className="text-gray-500">Cargando...</p> : txs.length === 0 ? (
        <p className="text-gray-500">No hay transacciones</p>
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
                  <td className="font-semibold text-trueque-700">{t.amount} TQ</td>
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
