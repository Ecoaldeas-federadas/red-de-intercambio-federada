import { useState, useEffect } from 'react'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { Nfc, Plus, Trash2, CreditCard, KeyRound, Activity, Cpu } from 'lucide-react'

interface Terminal {
  id: string
  terminal_id: string
  label: string
  terminal_type: string
  location: string
  is_active: boolean
  is_registered: boolean
  last_seen: string | null
  firmware_version: string
  created_at: string
}

interface Transaction {
  id: string
  terminal_id: string
  card_uid: string
  amount: number
  status: string
  pin_verified: boolean
  transaction_type: string
  error_message: string
  created_at: string
}

export default function NFCTerminals() {
  const { hasPermission } = usePermissions()
  const [tab, setTab] = useState<'terminals' | 'cards' | 'transactions'>('terminals')
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [terminalTypes, setTerminalTypes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [showIssueCard, setShowIssueCard] = useState(false)
  const [showResetPIN, setShowResetPIN] = useState<string | null>(null)

  const canRegisterTerminal = hasPermission('nfc.register_terminal')
  const canDeactivateTerminal = hasPermission('nfc.deactivate_terminal')
  const canIssueCard = hasPermission('nfc.issue_card')
  const canResetPIN = hasPermission('nfc.reset_pin')

  useEffect(() => {
    loadTerminals()
    loadTerminalTypes()
    loadTransactions()
  }, [])

  const loadTerminals = async () => {
    try {
      const res = await api.get<Terminal[]>('/nfc/terminals')
      setTerminals(res || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const loadTerminalTypes = async () => {
    try {
      const res = await api.get<string[]>('/nfc/terminals/types')
      setTerminalTypes(res || [])
    } catch {
      setTerminalTypes(['keypad', 'web', 'touch', 'community'])
    }
  }

  const loadTransactions = async () => {
    try {
      const res = await api.get<Transaction[]>('/nfc/transactions?limit=50')
      setTransactions(res || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const [newTerminal, setNewTerminal] = useState({
    terminal_id: '',
    label: '',
    terminal_type: 'keypad',
    location: '',
    wifi_ssid: '',
  })
  const [regToken, setRegToken] = useState('')

  const registerTerminal = async () => {
    setError('')
    try {
      const res = await api.post<{ terminal: Terminal; registration_token: string }>('/nfc/terminal/register', newTerminal)
      setRegToken(res.registration_token)
      setShowRegister(false)
      loadTerminals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const deactivateTerminal = async (terminalId: string) => {
    try {
      await api.delete(`/nfc/terminal/${terminalId}`)
      loadTerminals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const [newCard, setNewCard] = useState({ user_id: '', card_uid: '', card_type: 'uid_only', initial_pin: '' })
  const issueCard = async () => {
    setError('')
    try {
      await api.post('/nfc/cards/issue', newCard)
      setShowIssueCard(false)
      setNewCard({ user_id: '', card_uid: '', card_type: 'uid_only', initial_pin: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const [pinChange, setPinChange] = useState({ card_uid: '', old_pin: '', new_pin: '' })
  const changePIN = async () => {
    setError('')
    try {
      await api.put('/nfc/cards/pin', pinChange)
      setPinChange({ card_uid: '', old_pin: '', new_pin: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const [resetPINValue, setResetPINValue] = useState('')
  const resetPIN = async (cardUID: string) => {
    setError('')
    try {
      await api.put(`/nfc/cards/${cardUID}/pin/reset`, { new_pin: resetPINValue })
      setShowResetPIN(null)
      setResetPINValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const formatAmount = (cents: number) => `${(cents / 100).toFixed(2)}`
  const formatTime = (ts: string | null) => {
    if (!ts) return 'Nunca'
    return new Date(ts).toLocaleString()
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Nfc size={24} /> Terminales NFC</h1>

      <div className="flex gap-2">
        {([['terminals', 'Terminales'], ['cards', 'Tarjetas'], ['transactions', 'Transacciones']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === key ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{label}</button>
        ))}
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {/* Terminals tab */}
      {tab === 'terminals' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><Cpu size={18} /> Terminales registrados</h2>
            {canRegisterTerminal && (
              <button onClick={() => setShowRegister(true)} className="btn-primary flex items-center gap-2">
                <Plus size={18} /> Registrar Terminal
              </button>
            )}
          </div>

          {terminals.length === 0 && (
            <div className="card text-center text-gray-500 py-8">No hay terminales registrados</div>
          )}

          {terminals.map((t) => (
            <div key={t.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Cpu size={20} className={t.is_active ? 'text-green-600' : 'text-gray-400'} />
                <div>
                  <p className="font-medium">{t.label || t.terminal_id}</p>
                  <p className="text-xs text-gray-500">
                    {t.terminal_type} · {t.location || 'sin ubicacion'} · {formatTime(t.last_seen)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${t.is_registered ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {t.is_registered ? 'Registrado' : 'Pendiente'}
                </span>
                {canDeactivateTerminal && t.is_active && (
                  <button onClick={() => deactivateTerminal(t.terminal_id)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {regToken && (
            <div className="card bg-trueque-50 border-trueque-200">
              <p className="font-medium text-sm">Token de registro generado:</p>
              <code className="text-sm break-all">{regToken}</code>
              <p className="text-xs text-gray-500 mt-1">Copiar este token en config.h del terminal ESP32</p>
            </div>
          )}
        </div>
      )}

      {/* Cards tab */}
      {tab === 'cards' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><CreditCard size={18} /> Tarjetas NFC</h2>
            {canIssueCard && (
              <button onClick={() => setShowIssueCard(true)} className="btn-primary flex items-center gap-2">
                <Plus size={18} /> Emitir Tarjeta
              </button>
            )}
          </div>

          {/* Change PIN */}
          <div className="card space-y-3">
            <h3 className="font-medium flex items-center gap-2"><KeyRound size={16} /> Cambiar PIN</h3>
            <input className="input" placeholder="Card UID" value={pinChange.card_uid} onChange={(e) => setPinChange({ ...pinChange, card_uid: e.target.value })} />
            <input className="input" type="password" placeholder="PIN actual" value={pinChange.old_pin} onChange={(e) => setPinChange({ ...pinChange, old_pin: e.target.value })} />
            <input className="input" type="password" placeholder="PIN nuevo (4 digitos)" maxLength={4} value={pinChange.new_pin} onChange={(e) => setPinChange({ ...pinChange, new_pin: e.target.value })} />
            <button onClick={changePIN} className="btn-primary">Cambiar PIN</button>
          </div>
        </div>
      )}

      {/* Transactions tab */}
      {tab === 'transactions' && (
        <div className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Activity size={18} /> Transacciones recientes</h2>
          {transactions.length === 0 && (
            <div className="card text-center text-gray-500 py-8">No hay transacciones</div>
          )}
          {transactions.map((tx) => (
            <div key={tx.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">
                  {tx.transaction_type === 'community' ? 'Comunitaria' : 'Individual'} · {formatAmount(tx.amount)}
                </p>
                <p className="text-xs text-gray-500">
                  Tarjeta: {tx.card_uid.substring(0, 12)}... · {new Date(tx.created_at).toLocaleString()}
                </p>
                {tx.error_message && <p className="text-xs text-red-500">{tx.error_message}</p>}
              </div>
              <div className="flex items-center gap-2">
                {tx.pin_verified && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">PIN OK</span>}
                <span className={`text-xs px-2 py-1 rounded ${tx.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {tx.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Register Terminal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRegister(false)}>
          <div className="bg-white rounded-xl p-6 w-96 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">Registrar Terminal</h2>
            <input className="input" placeholder="Terminal ID (ej: TERM-001)" value={newTerminal.terminal_id} onChange={(e) => setNewTerminal({ ...newTerminal, terminal_id: e.target.value })} />
            <input className="input" placeholder="Etiqueta (ej: Ferreteria)" value={newTerminal.label} onChange={(e) => setNewTerminal({ ...newTerminal, label: e.target.value })} />
            <select className="input" value={newTerminal.terminal_type} onChange={(e) => setNewTerminal({ ...newTerminal, terminal_type: e.target.value })}>
              {terminalTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="input" placeholder="Ubicacion" value={newTerminal.location} onChange={(e) => setNewTerminal({ ...newTerminal, location: e.target.value })} />
            <input className="input" placeholder="WiFi SSID" value={newTerminal.wifi_ssid} onChange={(e) => setNewTerminal({ ...newTerminal, wifi_ssid: e.target.value })} />
            <button onClick={registerTerminal} className="btn-primary w-full">Registrar</button>
          </div>
        </div>
      )}

      {/* Modal: Issue Card */}
      {showIssueCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowIssueCard(false)}>
          <div className="bg-white rounded-xl p-6 w-96 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">Emitir Tarjeta NFC</h2>
            <input className="input" placeholder="User ID (UUID)" value={newCard.user_id} onChange={(e) => setNewCard({ ...newCard, user_id: e.target.value })} />
            <input className="input" placeholder="Card UID (hex)" value={newCard.card_uid} onChange={(e) => setNewCard({ ...newCard, card_uid: e.target.value })} />
            <select className="input" value={newCard.card_type} onChange={(e) => setNewCard({ ...newCard, card_type: e.target.value })}>
              <option value="uid_only">UID Only</option>
              <option value="ntag424">NTAG424 DNA</option>
              <option value="desfire">MIFARE DESFire EV3</option>
            </select>
            <input className="input" type="password" placeholder="PIN inicial (4 digitos)" maxLength={4} value={newCard.initial_pin} onChange={(e) => setNewCard({ ...newCard, initial_pin: e.target.value })} />
            <button onClick={issueCard} className="btn-primary w-full">Emitir</button>
          </div>
        </div>
      )}

      {/* Modal: Reset PIN */}
      {showResetPIN && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowResetPIN(null)}>
          <div className="bg-white rounded-xl p-6 w-80 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">Resetear PIN</h2>
            <p className="text-sm text-gray-500">Tarjeta: {showResetPIN}</p>
            <input className="input" type="password" placeholder="Nuevo PIN (4 digitos)" maxLength={4} value={resetPINValue} onChange={(e) => setResetPINValue(e.target.value)} />
            <button onClick={() => resetPIN(showResetPIN)} className="btn-primary w-full">Resetear</button>
          </div>
        </div>
      )}
    </div>
  )
}
