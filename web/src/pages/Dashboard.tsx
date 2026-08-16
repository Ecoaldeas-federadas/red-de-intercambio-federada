import { useState, useEffect } from 'react'
import { api } from '../api'
import { Wallet, TrendingUp, AlertTriangle, Network } from 'lucide-react'

export default function Dashboard() {
  const [balance, setBalance] = useState<number | null>(null)
  const [warnings, setWarnings] = useState<any[]>([])
  const [nodes, setNodes] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get<any>('/accounts/me').catch(() => null),
      api.get<any>('/federation/warnings').catch(() => ({ warnings: [] })),
      api.get<any[]>('/federation/nodes').catch(() => []),
    ]).then(([user, warn, n]) => {
      if (user) setBalance(user.balance ?? 0)
      setWarnings(warn?.warnings ?? [])
      setNodes(Array.isArray(n) ? n : [])
    }).catch(() => setError('Error al cargar datos'))
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Panel Principal</h1>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="text-trueque-600" size={24} />
            <h2 className="text-lg font-semibold">Mi Balance</h2>
          </div>
          <p className="text-3xl font-bold text-trueque-700">
            {balance !== null ? `${balance.toLocaleString()} TQ` : '...'}
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <Network className="text-blue-600" size={24} />
            <h2 className="text-lg font-semibold">Nodos Federados</h2>
          </div>
          <p className="text-3xl font-bold text-blue-700">{nodes.length}</p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="text-orange-600" size={24} />
            <h2 className="text-lg font-semibold">Avisos Activos</h2>
          </div>
          <p className="text-3xl font-bold text-orange-600">{warnings.length}</p>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-3">Avisos de Limites</h2>
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-orange-50 border border-orange-200 rounded-lg p-3">
                <AlertTriangle size={16} className="text-orange-600" />
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Nodos Conectados</h2>
        {nodes.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay nodos federados conectados</p>
        ) : (
          <div className="space-y-2">
            {nodes.map((n, i) => (
              <div key={i} className="flex items-center justify-between border-b border-gray-100 py-2">
                <span className="font-medium">{n.remote_node}</span>
                <span className={`text-sm ${n.balance < 0 ? 'text-red-600' : 'text-trueque-600'}`}>
                  {n.balance?.toLocaleString()} TQ
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
