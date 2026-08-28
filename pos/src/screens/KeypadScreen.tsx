import { useState, useEffect } from 'react'
import { API } from '../api'
import { fmtTQ } from '../utils/format'

interface Props {
  amount: number
  onAmountChange: (amount: number) => void
  onShowQR: (token: string) => void
  onShowNFC: () => void
  onShowSales: () => void
  onShowSettings: () => void
  onShowConfirm: () => void
  terminalID: string | null
  sessionToken: string | null
  api: API
  merchantUser: any
}

export function KeypadScreen({
  amount, onAmountChange, onShowSales, onShowSettings, onShowConfirm,
  terminalID, sessionToken, api, merchantUser
}: Props) {
  // Digitos ingresados como string. Los ultimos 2 digitos son centimos.
  // Ej: "100" = 1.00, "12345" = 123.45
  const [digits, setDigits] = useState('0')
  const [sessionActive, setSessionActive] = useState(false)
  const [error, setError] = useState('')

  // Check terminal status on mount
  useEffect(() => {
    checkTerminalStatus()
  }, [])

  const checkTerminalStatus = async () => {
    if (!terminalID) return
    try {
      const status = await api.getTerminalStatus(terminalID)
      setSessionActive(status.is_active !== false)
    } catch {}
  }

  const handleKey = (key: string) => {
    setError('')
    if (key === 'clear') {
      setDigits('0')
      onAmountChange(0)
      return
    }
    if (key === 'back') {
      if (digits.length > 1) {
        const newDigits = digits.slice(0, -1)
        setDigits(newDigits)
        onAmountChange(parseInt(newDigits) || 0)
      } else {
        setDigits('0')
        onAmountChange(0)
      }
      return
    }
    // Limit to 9 digits (max 999,999.99)
    if (digits.length >= 9) return
    // Si solo hay "0", reemplazarlo con el primer digito
    const newDigits = digits === '0' ? key : digits + key
    setDigits(newDigits)
    onAmountChange(parseInt(newDigits) || 0)
  }

  const handleCharge = () => {
    if (amount <= 0) return
    setError('')
    onShowConfirm()
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: 16, maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{merchantUser?.display_name || merchantUser?.username || 'POS'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{terminalID?.slice(0, 16)}...</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onShowSales} style={{ background: 'var(--card)', borderRadius: 10, padding: 10, color: 'var(--text)' }}>
            📊
          </button>
          <button onClick={onShowSettings} style={{ background: 'var(--card)', borderRadius: 10, padding: 10, color: 'var(--text)' }}>
            ⚙️
          </button>
        </div>
      </div>

      {/* Status */}
      <div style={{ marginBottom: 16 }}>
        <span className={`status-badge ${sessionActive ? 'status-open' : 'status-closed'}`}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: sessionActive ? 'var(--success)' : 'var(--danger)' }} />
          {sessionActive ? 'Terminal Activo' : 'Terminal Inactivo'}
        </span>
      </div>

      {/* Amount Display */}
      <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
        <div style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 4 }}>MONTO A COBRAR</div>
        <div className="amount-display" style={{ color: 'var(--accent-light)' }}>
          {fmtTQ(parseInt(digits) || 0)}
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>TQ</div>
      </div>

      {error && (
        <div style={{ background: 'rgba(220,38,38,0.15)', color: 'var(--danger)', padding: 12, borderRadius: 12, marginBottom: 12, fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Keypad */}
      <div className="keypad" style={{ marginBottom: 16 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
          <button key={n} className="key" onClick={() => handleKey(n)}>{n}</button>
        ))}
        <button className="key" onClick={() => handleKey('clear')} style={{ background: 'rgba(220,38,38,0.2)', color: 'var(--danger)' }}>C</button>
        <button className="key" onClick={() => handleKey('0')}>0</button>
        <button className="key" onClick={() => handleKey('back')} style={{ background: 'rgba(202,138,4,0.2)', color: 'var(--warning)' }}>⌫</button>
      </div>

      {/* Action button - un solo boton Cobrar */}
      <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1, fontSize: 18, padding: 20 }}
          onClick={handleCharge}
          disabled={amount <= 0 || !sessionActive}
        >
          💳 Cobrar
        </button>
      </div>
    </div>
  )
}
