import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { useAuth } from '../hooks/useAuth'
import { Wallet as WalletIcon, ArrowUpCircle, ArrowDownCircle, HelpCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Wallet() {
  const { currency } = useConfig()
  const { user } = useAuth()
  const [txs, setTxs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [creditLimit, setCreditLimit] = useState(0)
  const [debitLimit, setDebitLimit] = useState(0)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    // Cargar balance del usuario actual
    api.get('/auth/me').then((data: any) => {
      setBalance(data?.balance ?? 0)
      setCreditLimit(data?.credit_limit ?? 500)
      setDebitLimit(data?.debit_limit ?? 500)
    }).catch(() => {})

    // Cargar transacciones del usuario actual
    setLoading(true)
    api.get('/ledger/transactions?limit=200').then((data: any) => {
      setTxs(Array.isArray(data) ? data : data?.transactions ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const fmtAmount = (n: number) => {
    const v = Math.round(n * 100) / 100
    return v.toLocaleString('es')
  }

  // Determinar si una transaccion es debito (salida) o credito (entrada)
  // para el usuario actual
  const getDirection = (t: any): 'debit' | 'credit' => {
    const userId = String(user?.id || '')
    if (t.direction === 'debit') return 'debit'
    if (t.direction === 'credit') return 'credit'
    // Fallback: comparar IDs
    if (String(t.sender_id || '') === userId) return 'debit'
    if (String(t.receiver_id || '') === userId) return 'credit'
    return 'credit' // default
  }

  const totalIn = txs.filter(t => getDirection(t) === 'credit').reduce((s, t) => s + (t.amount || 0), 0)
  const totalOut = txs.filter(t => getDirection(t) === 'debit').reduce((s, t) => s + (t.amount || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><WalletIcon size={24} />Mi Billetera</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
          <p><strong>Mi Billetera - Ayuda</strong></p>
          <p>Esta es tu billetera personal. Aqui ves tu saldo y todas tus transacciones.</p>
          <p><strong>Salidas (debito):</strong> Transacciones donde enviaste {currency}. Aparecen en rojo con signo negativo.</p>
          <p><strong>Entradas (credito):</strong> Transacciones donde recibiste {currency}. Aparecen en verde con signo positivo.</p>
          <p><strong>Balance:</strong> Es la diferencia entre entradas y salidas. Si es positivo, te deben. Si es negativo, debes.</p>
          <p><strong>El sistema suma cero:</strong> Cada salida de una cuenta es una entrada en otra. El total de todos los saldos siempre es cero.</p>
          <p><strong>Cuentas de organizaciones:</strong> Para ver la billetera de una organizacion o departamento, entra a esa organizacion o departamento desde el menu. Cada entidad tiene su propia billetera interna.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {/* Saldo */}
      <div className="card">
        <div className="bg-gradient-to-r from-trueque-600 to-trueque-700 text-white rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-trueque-100 text-sm">Mi saldo actual</p>
              <p className="text-4xl font-bold mt-1">
                {balance >= 0 ? '+' : ''}{fmtAmount(balance)} {currency}
              </p>
              <p className="text-trueque-200 text-xs mt-2">
                Limite credito: +{fmtAmount(creditLimit)} {currency} | Limite debito: -{fmtAmount(debitLimit)} {currency}
              </p>
            </div>
            <WalletIcon size={48} className="text-trueque-200" />
          </div>
          <div className="mt-4 flex gap-2">
            <Link to="/app/transfer" className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition">
              Transferir
            </Link>
            <Link to="/app/payments" className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition">
              Pagar con QR
            </Link>
          </div>
        </div>
      </div>

      {/* Transacciones */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-3">Movimientos</h2>

        {loading ? (
          <p className="text-gray-500 py-4">Cargando...</p>
        ) : txs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No hay transacciones en tu cuenta.</p>
            <p className="text-xs mt-2">Las transacciones aparecen cuando transfieres o recibes {currency}.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {txs.map((t, i) => {
              const dir = getDirection(t)
              const isDebit = dir === 'debit'
              const fromName = t.sender_display || t.from_user || t.sender_name || '???'
              const toName = t.receiver_display || t.to_user || t.receiver_name || '???'
              const amount = t.amount || 0

              return (
                <div key={i} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    {isDebit ? (
                      <ArrowUpCircle size={20} className="text-red-500" />
                    ) : (
                      <ArrowDownCircle size={20} className="text-green-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {isDebit ? 'Enviado a ' : 'Recibido de '}
                        <span className="font-semibold">{isDebit ? toName : fromName}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {t.created_at?.slice(0, 16).replace('T', ' ')}
                        {t.description ? ` - ${t.description}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className={`font-bold text-sm ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                    {isDebit ? '-' : '+'}{fmtAmount(amount)} {currency}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Resumen contable */}
      {!loading && txs.length > 0 && (
        <div className="card bg-gray-50">
          <h3 className="font-semibold text-sm mb-2">Resumen</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Total entradas:</p>
              <p className="font-bold text-green-600">+{fmtAmount(totalIn)} {currency}</p>
            </div>
            <div>
              <p className="text-gray-600">Total salidas:</p>
              <p className="font-bold text-red-600">-{fmtAmount(totalOut)} {currency}</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-gray-600 text-sm">Balance calculado:</p>
            <p className={`font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {balance >= 0 ? '+' : ''}{fmtAmount(balance)} {currency}
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            El balance refleja la diferencia entre entradas y salidas. El sistema contable suma cero: lo que sale de una cuenta entra en otra.
          </p>
        </div>
      )}
    </div>
  )
}
