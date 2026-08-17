import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Wallet, AlertTriangle, Network, HelpCircle } from 'lucide-react'

export default function Dashboard() {
  const { currency } = useConfig()
  const [balance, setBalance] = useState<number | null>(null)
  const [creditLimit, setCreditLimit] = useState<number | null>(null)
  const [debitLimit, setDebitLimit] = useState<number | null>(null)
  const [warnings, setWarnings] = useState<any[]>([])
  const [nodes, setNodes] = useState<any[]>([])
  const [error, setError] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get<any>('/accounts/me').catch(() => null),
      api.get<any>('/federation/warnings').catch(() => ({ warnings: [] })),
      api.get<any[]>('/federation/nodes').catch(() => []),
    ]).then(([user, warn, n]) => {
      if (user) {
        setBalance(user.balance ?? 0)
        setCreditLimit(user.credit_limit ?? null)
        setDebitLimit(user.debit_limit ?? null)
      }
      setWarnings(warn?.warnings ?? [])
      setNodes(Array.isArray(n) ? n : [])
    }).catch(() => setError('Error al cargar datos'))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Panel Principal</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Panel Principal - Ayuda</strong></p>
          <p>Esta es la pantalla principal de tu nodo. Aqui ves un resumen de tu cuenta y del estado de la federacion.</p>
          <p><strong>Mi Balance:</strong> Tu saldo actual en Trueques ({currency}). Puede ser positivo (tienes credito) o negativo (debes). Un saldo de 0 significa que no has hecho transacciones todavia. El saldo negativo es normal: significa que compraste y despues pagaras vendiendo o trabajando.</p>
          <p><strong>Nodos Federados:</strong> Cuantos nodos de otras comunidades estan conectados al tuyo. La federacion permite intercambiar entre comunidades distintas. Si dice 0, significa que tu nodo esta solo (no esta federado con nadie todavia).</p>
          <p><strong>Avisos Activos:</strong> Alertas sobre limites de federacion. Aparecen cuando te acercas al limite de deuda o credito con otros nodos. Si dice 0, no hay problemas.</p>
          <p><strong>Nodos Conectados:</strong> Lista de las comunidades federadas y el saldo con cada una. Saldo negativo = debes a esa comunidad. Saldo positivo = te deben.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="text-trueque-600" size={24} />
            <h2 className="text-lg font-semibold">Mi Balance</h2>
          </div>
          <p className="text-3xl font-bold text-trueque-700">
            {balance !== null ? `${balance.toLocaleString()} ${currency}` : '...'}
          </p>
          {creditLimit !== null && debitLimit !== null && (
            <p className="text-xs text-gray-500 mt-2">
              Limite credito: +{creditLimit.toLocaleString()} {currency} | Limite debito: -{debitLimit.toLocaleString()} {currency}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Saldo positivo = tienes credito. Saldo negativo = debes (normal).
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <Network className="text-blue-600" size={24} />
            <h2 className="text-lg font-semibold">Nodos Federados</h2>
          </div>
          <p className="text-3xl font-bold text-blue-700">{nodes.length}</p>
          <p className="text-xs text-gray-400 mt-2">
            Comunidades conectadas a la tuya para intercambiar.
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="text-orange-600" size={24} />
            <h2 className="text-lg font-semibold">Avisos Activos</h2>
          </div>
          <p className="text-3xl font-bold text-orange-600">{warnings.length}</p>
          <p className="text-xs text-gray-400 mt-2">
            Alertas de limites de federacion cercanos al tope.
          </p>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-3">Avisos de Limites</h2>
          <p className="text-xs text-gray-500 mb-3">Estas alertas indican que te estas acercando al limite de deuda o credito con otros nodos.</p>
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
        <h2 className="text-lg font-semibold mb-1">Nodos Conectados</h2>
        <p className="text-xs text-gray-500 mb-3">Lista de comunidades federadas y el saldo con cada una. Saldo negativo = debes a esa comunidad. Saldo positivo = te deben.</p>
        {nodes.length === 0 ? (
          <div className="text-center text-gray-500 py-6">
            <p>No hay nodos federados conectados.</p>
            <p className="text-xs mt-2">Para federar con otra comunidad, ve a Limites de Federacion y registra un nodo remoto.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {nodes.map((n, i) => (
              <div key={i} className="flex items-center justify-between border-b border-gray-100 py-2">
                <span className="font-medium">{n.remote_node}</span>
                <span className={`text-sm ${n.balance < 0 ? 'text-red-600' : 'text-trueque-600'}`}>
                  {n.balance?.toLocaleString()} {currency}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
