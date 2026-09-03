import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from 'react-i18next'
import { Wallet as WalletIcon, ArrowUpCircle, ArrowDownCircle, HelpCircle, Search, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'

type FilterPeriod = '24h' | '7d' | '30d' | '3m' | 'all' | 'custom'

export default function Wallet() {
  const { currency } = useConfig()
  const { user } = useAuth()
  const { t } = useTranslation('transfer')
  const [txs, setTxs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [creditLimit, setCreditLimit] = useState(0)
  const [debitLimit, setDebitLimit] = useState(0)
  const [userName, setUserName] = useState('')
  const [userDisplay, setUserDisplay] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [period, setPeriod] = useState<FilterPeriod>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    // Cargar datos del usuario actual
    api.get('/auth/me').then((data: any) => {
      setBalance(data?.balance ?? 0)
      setCreditLimit(data?.credit_limit ?? 500)
      setDebitLimit(data?.debit_limit ?? 500)
      setUserName(data?.username || '')
      setUserDisplay(data?.display_name || data?.username || '')
    }).catch(() => {})

    loadTransactions()
  }, [])

  const loadTransactions = () => {
    setLoading(true)
    api.get('/ledger/transactions?limit=500').then((data: any) => {
      setTxs(Array.isArray(data) ? data : data?.transactions ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  // El sistema almacena montos en CENTAVOS internamente.
  // Para mostrar, dividir por 100 y formatear con 2 decimales.
  const fmtAmount = (centavos: number) => {
    const tq = centavos / 100
    return tq.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Determinar si una transaccion es debito (salida) o credito (entrada)
  const getDirection = (t: any): 'debit' | 'credit' => {
    const userId = String(user?.id || '')
    if (t.direction === 'debit') return 'debit'
    if (t.direction === 'credit') return 'credit'
    // Fallback: comparar IDs
    if (String(t.sender_id || '') === userId) return 'debit'
    if (String(t.receiver_id || '') === userId) return 'credit'
    // Si no hay direction ni userId, usar el monto: negativo = debito
    if ((t.amount || 0) < 0) return 'debit'
    return 'credit'
  }

  // Filtrar transacciones por periodo
  const filterByPeriod = (t: any): boolean => {
    if (period === 'all') return true
    const tDate = new Date(t.created_at || '')
    const now = new Date()
    if (period === '24h') {
      return (now.getTime() - tDate.getTime()) <= 24 * 60 * 60 * 1000
    }
    if (period === '7d') {
      return (now.getTime() - tDate.getTime()) <= 7 * 24 * 60 * 60 * 1000
    }
    if (period === '30d') {
      return (now.getTime() - tDate.getTime()) <= 30 * 24 * 60 * 60 * 1000
    }
    if (period === '3m') {
      return (now.getTime() - tDate.getTime()) <= 90 * 24 * 60 * 60 * 1000
    }
    if (period === 'custom') {
      if (dateFrom && tDate < new Date(dateFrom + 'T00:00:00')) return false
      if (dateTo && tDate > new Date(dateTo + 'T23:59:59')) return false
      return true
    }
    return true
  }

  const filteredTxs = txs.filter(filterByPeriod)
  const totalIn = filteredTxs.filter(t => getDirection(t) === 'credit').reduce((s, t) => s + Math.abs(t.amount || 0), 0)
  const totalOut = filteredTxs.filter(t => getDirection(t) === 'debit').reduce((s, t) => s + Math.abs(t.amount || 0), 0)
  const calculatedBalance = totalIn - totalOut

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><WalletIcon size={24} />{t('wallet.title', 'Mi Billetera')}</h1>
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
          <p><strong>Filtro por fecha:</strong> Usa los botones para ver transacciones de las ultimas 24 horas, 7 dias, 30 dias, 3 meses o todas.</p>
          <p><strong>Cuentas de organizaciones:</strong> Para ver la billetera de una organizacion o departamento, entra a esa entidad desde el menu. Cada una tiene su propia billetera interna.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {/* Saldo */}
      <div className="card">
        <div className="bg-gradient-to-r from-trueque-600 to-trueque-700 text-white rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-trueque-100 text-sm">Cuenta: {userDisplay || userName || 'Mi cuenta personal'}</p>
              <p className="text-trueque-200 text-xs">@{userName}</p>
              <p className="text-4xl font-bold mt-2">
                {balance >= 0 ? '+' : ''}{fmtAmount(balance)} {currency}
              </p>
              <p className="text-trueque-200 text-xs mt-2">
                Tope credito (piso): {fmtAmount(creditLimit)} {currency} | Tope debito (techo): {fmtAmount(debitLimit)} {currency}
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

      {/* Filtros por fecha */}
      <div className="card">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500 flex items-center gap-1"><Calendar size={14} /> Periodo:</span>
          {(['24h', '7d', '30d', '3m', 'all', 'custom'] as FilterPeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-3 py-1 rounded-full ${
                period === p ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p === '24h' ? '24 horas' : p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : p === '3m' ? '3 meses' : p === 'all' ? 'Todo' : 'Personalizado'}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" className="text-xs border rounded px-2 py-1" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <span className="text-gray-400">-</span>
              <input type="date" className="text-xs border rounded px-2 py-1" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {/* Transacciones */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-3">Movimientos ({filteredTxs.length})</h2>

        {loading ? (
          <p className="text-gray-500 py-4">Cargando...</p>
        ) : filteredTxs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>{t('wallet.no_transactions', 'No hay transacciones en este periodo.')}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredTxs.map((t, i) => {
              const dir = getDirection(t)
              const isDebit = dir === 'debit'
              const fromName = t.sender_display || t.from_user || t.sender_name || '???'
              const toName = t.receiver_display || t.to_user || t.receiver_name || '???'
              const amount = Math.abs(t.amount || 0)

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
      {!loading && filteredTxs.length > 0 && (
        <div className="card bg-gray-50">
          <h3 className="font-semibold text-sm mb-3">Resumen del periodo</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-gray-600 text-xs">Total entradas</p>
              <p className="font-bold text-green-600 text-lg">+{fmtAmount(totalIn)} {currency}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-gray-600 text-xs">Total salidas</p>
              <p className="font-bold text-red-600 text-lg">-{fmtAmount(totalOut)} {currency}</p>
            </div>
            <div className={`rounded-lg p-3 ${calculatedBalance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-gray-600 text-xs">{t('wallet.period_balance', 'Balance del periodo')}</p>
              <p className={`font-bold text-lg ${calculatedBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {calculatedBalance >= 0 ? '+' : ''}{fmtAmount(calculatedBalance)} {currency}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Saldo real de la cuenta:</span>
              <span className={`font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {balance >= 0 ? '+' : ''}{fmtAmount(balance)} {currency}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            El balance del periodo muestra entradas menos salidas en el rango seleccionado.
            El saldo real es el acumulado total de la cuenta.
          </p>
        </div>
      )}
    </div>
  )
}
