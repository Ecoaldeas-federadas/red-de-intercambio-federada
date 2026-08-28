import { useState, useEffect } from 'react'
import { api, apiFetch } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { Smartphone, Lock, Unlock, Eye, Activity, Power, ShoppingBag, Edit2 } from 'lucide-react'

interface MyTerminal {
  id: string
  terminal_id: string
  label: string
  terminal_type: string
  location: string
  is_active: boolean
  is_registered: boolean
  is_blocked: boolean
  last_seen: string | null
  created_at: string
}

interface Transaction {
  id: string
  card_uid: string
  amount: number
  status: string
  pin_verified: boolean
  transaction_type: string
  error_message: string
  created_at: string
}

export default function MyTerminals() {
  const { hasPermission } = usePermissions()
  const [terminals, setTerminals] = useState<MyTerminal[]>([])
  const [selectedTerminal, setSelectedTerminal] = useState<MyTerminal | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [renaming, setRenaming] = useState<MyTerminal | null>(null)
  const [renameLabel, setRenameLabel] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)

  useEffect(() => {
    loadTerminals()
    // Auto-refresh cada 15 segundos cuando la pagina esta visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadTerminals()
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const loadTerminals = async () => {
    setLoading(true)
    try {
      const res = await api.get<MyTerminal[]>('/nfc/my-terminals')
      setTerminals(res || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (terminal: MyTerminal) => {
    try {
      await apiFetch(`/nfc/my-terminals/${terminal.terminal_id}/toggle`, { method: 'POST' })
      loadTerminals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const handleViewTransactions = async (terminal: MyTerminal) => {
    setSelectedTerminal(terminal)
    try {
      const res = await api.get<Transaction[]>(`/nfc/my-terminals/${terminal.terminal_id}/transactions`)
      setTransactions(res || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const handleRename = async () => {
    if (!renaming || !renameLabel.trim()) return
    setRenameSaving(true)
    try {
      await apiFetch(`/nfc/my-terminals/${renaming.terminal_id}/label`, {
        method: 'PUT',
        body: JSON.stringify({ label: renameLabel.trim() }),
      })
      setRenaming(null)
      setRenameLabel('')
      await loadTerminals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al renombrar')
    } finally {
      setRenameSaving(false)
    }
  }

  const formatTime = (ts: string | null) => {
    if (!ts) return 'Nunca'
    return new Date(ts).toLocaleString('es', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    })
  }

  const totalSales = transactions
    .filter(t => t.status === 'approved')
    .reduce((sum, t) => sum + t.amount, 0)

  // Vista de transacciones de un terminal
  if (selectedTerminal) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Transacciones del Terminal</h1>
            <p className="text-gray-500 text-sm mt-1">{selectedTerminal.label}</p>
          </div>
          <button
            onClick={() => { setSelectedTerminal(null); setTransactions([]) }}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            ← Volver
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border">
            <div className="text-gray-500 text-xs mb-1">TOTAL VENTAS</div>
            <div className="text-2xl font-bold text-green-600">{totalSales.toLocaleString('es')} TQ</div>
          </div>
          <div className="bg-white rounded-xl p-4 border">
            <div className="text-gray-500 text-xs mb-1">TRANSACCIONES</div>
            <div className="text-2xl font-bold">{transactions.length}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border">
            <div className="text-gray-500 text-xs mb-1">APROBADAS</div>
            <div className="text-2xl font-bold text-green-600">
              {transactions.filter(t => t.status === 'approved').length}
            </div>
          </div>
        </div>

        {/* Transactions list */}
        <div className="bg-white rounded-xl border overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Activity className="mx-auto mb-2" size={32} />
              No hay transacciones
            </div>
          ) : (
            <div className="divide-y">
              {transactions.map(tx => (
                <div key={tx.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {tx.card_uid === 'qr_payment' ? '📱 Pago QR' : `💳 ${tx.card_uid.slice(0, 12)}...`}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTime(tx.created_at)}
                      {tx.error_message && ` · ${tx.error_message}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${tx.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.status === 'approved' ? '+' : ''}{tx.amount.toLocaleString('es')} TQ
                    </div>
                    <div className="text-xs text-gray-500">{tx.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Vista principal: lista de terminales
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingBag size={28} />
          Mis Puntos de Venta
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Terminales asignados a tu cuenta. Puedes activarlos, desactivarlos y ver transacciones.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">Cargando...</div>
      ) : terminals.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <Smartphone className="mx-auto mb-3 text-gray-300" size={48} />
          <h2 className="text-lg font-semibold mb-2">No tienes terminales asignados</h2>
          <p className="text-gray-500 text-sm">
            Si tienes un punto de venta, pide al administrador que te asigne un terminal.
            <br />
            El administrador debe registrar el terminal y asignarlo a tu cuenta.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {terminals.map(term => (
            <div key={term.id} className="bg-white rounded-xl border p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{term.label || 'Sin nombre'}</h3>
                  <p className="text-xs text-gray-500 font-mono mt-1">{term.terminal_id.slice(0, 24)}...</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {term.is_blocked ? (
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                      🔒 Bloqueado
                    </span>
                  ) : term.is_active ? (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                      ● Activo
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                      ○ Inactivo
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{term.terminal_type}</span>
                </div>
              </div>

              <div className="text-sm text-gray-500 mb-4">
                <p>📍 {term.location || 'Sin ubicacion'}</p>
                <p>🕐 Ultima actividad: {formatTime(term.last_seen)}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleViewTransactions(term)}
                  className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 flex items-center justify-center gap-1"
                >
                  <Eye size={16} />
                  Transacciones
                </button>
                <button
                  onClick={() => { setRenaming(term); setRenameLabel(term.label || '') }}
                  className="px-3 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 flex items-center justify-center gap-1"
                >
                  <Edit2 size={16} />
                  Renombrar
                </button>
                {!term.is_blocked && (
                  <button
                    onClick={() => handleToggle(term)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 ${
                      term.is_active
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {term.is_active ? <><Power size={16} /> Desactivar</> : <><Power size={16} /> Activar</>}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">💡 Como usar tu terminal</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-600">
          <li>Abre el POS en tu dispositivo (celular o PC)</li>
          <li>Ingresa la URL del nodo e inicia sesion</li>
          <li>Si es la primera vez, registra el terminal con el administrador</li>
          <li>Usa el teclado para ingresar el monto a cobrar</li>
          <li>Cobra con QR o NFC</li>
          <li>Aqui puedes ver todas tus transacciones y gestionar tus terminales</li>
        </ol>
      </div>

      {/* Modal de renombrar */}
      {renaming && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h2 className="font-bold text-lg mb-2">Renombrar Terminal</h2>
            <p className="text-sm text-gray-500 mb-4">
                ID: <span className="font-mono">{renaming.terminal_id.slice(0, 24)}...</span>
            </p>
            <input
              type="text"
              value={renameLabel}
              onChange={(e) => setRenameLabel(e.target.value)}
              placeholder="Nombre personalizado (ej: Caja 1, Tienda Central)"
              className="input w-full mb-4"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename() }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleRename}
                disabled={!renameLabel.trim() || renameSaving}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {renameSaving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={() => { setRenaming(null); setRenameLabel('') }}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
