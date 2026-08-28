import { useState, useEffect } from 'react'
import { API } from '../api'
import { fmtTQ } from '../utils/format'

interface Props {
  onBack: () => void
  api: API
  terminalID: string | null
}

export function ShiftScreen({ onBack, api, terminalID }: Props) {
  const [shift, setShift] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<'view' | 'opening' | 'closing' | 'closed'>('view')
  const [openingAmount, setOpeningAmount] = useState('0')
  const [closeResult, setCloseResult] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadShift()
  }, [])

  const loadShift = async () => {
    setLoading(true)
    try {
      const data = await api.getActiveShift(terminalID || '')
      setShift(data)
    } catch {
      setShift(null)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (ts: string) => {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
  }

  // Teclado decimal para monto de apertura
  const handleAmountKey = (key: string) => {
    setError('')
    if (key === 'clear') {
      setOpeningAmount('0')
      return
    }
    if (key === 'back') {
      setOpeningAmount(prev => prev.length > 1 ? prev.slice(0, -1) : '0')
      return
    }
    if (openingAmount.length >= 9) return
    setOpeningAmount(prev => prev === '0' ? key : prev + key)
  }

  const handleOpenShift = async () => {
    setError('')
    const amount = parseInt(openingAmount) || 0
    try {
      await api.openShift(terminalID || '', amount)
      setAction('view')
      loadShift()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleCloseShift = async () => {
    setError('')
    try {
      const result = await api.closeShift(terminalID || '')
      setCloseResult(result)
      setAction('closed')
    } catch (e: any) {
      setError(e.message)
    }
  }

  const isActive = shift?.active === true

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: 16, maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'var(--card)', borderRadius: 10, padding: 10, color: 'var(--text)', fontSize: 20 }}>
          ←
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Estado del Turno</h2>
        <div style={{ width: 44 }} />
      </div>

      {error && (
        <div style={{ background: 'rgba(220,38,38,0.15)', color: 'var(--danger)', padding: 12, borderRadius: 12, marginBottom: 12, fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>Cargando...</div>
      )}

      {/* Estado actual del turno */}
      {!loading && action === 'view' && (
        <div className="fade-in">
          {isActive ? (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span className="status-badge status-open">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
                  Turno Abierto
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>Apertura</span>
                <span style={{ fontWeight: 600 }}>{fmtTQ(shift.opening_amount || 0)} TQ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>Total vendido</span>
                <span style={{ fontWeight: 600, color: 'var(--success)' }}>{fmtTQ(shift.total_sales || 0)} TQ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>Transacciones</span>
                <span style={{ fontWeight: 600 }}>{shift.transactions_count || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>Cierre esperado</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-light)' }}>{fmtTQ(shift.expected_close || 0)} TQ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 12, color: 'var(--text-dim)' }}>
                <span>Abierto desde</span>
                <span>{formatTime(shift.opened_at)}</span>
              </div>

              <button
                className="btn btn-danger"
                style={{ width: '100%', marginTop: 16 }}
                onClick={handleCloseShift}
              >
                🔒 Cerrar Turno
              </button>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🔒</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No hay turno abierto</h3>
              <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 16 }}>
                Abre un turno para llevar la contabilidad de ventas
              </p>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => { setOpeningAmount('0'); setAction('opening') }}
              >
                🔓 Abrir Turno
              </button>
            </div>
          )}

          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={loadShift}>
            🔄 Actualizar
          </button>
        </div>
      )}

      {/* Pantalla de apertura - ingresar monto inicial */}
      {!loading && action === 'opening' && (
        <div className="fade-in">
          <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
            <div style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 4 }}>MONTO INICIAL (EFECTIVO/CAJA)</div>
            <div className="amount-display" style={{ color: 'var(--accent-light)' }}>
              {fmtTQ(parseInt(openingAmount) || 0)}
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>TQ</div>
          </div>

          <div className="keypad" style={{ marginBottom: 16 }}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
              <button key={n} className="key" onClick={() => handleAmountKey(n)}>{n}</button>
            ))}
            <button className="key" onClick={() => handleAmountKey('clear')} style={{ background: 'rgba(220,38,38,0.2)', color: 'var(--danger)' }}>C</button>
            <button className="key" onClick={() => handleAmountKey('0')}>0</button>
            <button className="key" onClick={() => handleAmountKey('back')} style={{ background: 'rgba(202,138,4,0.2)', color: 'var(--warning)' }}>⌫</button>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleOpenShift}>
              Confirmar Apertura
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAction('view')}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Pantalla de cierre - resumen del turno */}
      {!loading && action === 'closed' && closeResult && (
        <div className="fade-in">
          <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--success)' }}>Turno Cerrado</h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>Monto apertura</span>
              <span style={{ fontWeight: 600 }}>{fmtTQ(closeResult.opening_amount || 0)} TQ</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>Total vendido</span>
              <span style={{ fontWeight: 600, color: 'var(--success)' }}>{fmtTQ(closeResult.total_sales || 0)} TQ</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>Transacciones</span>
              <span style={{ fontWeight: 600 }}>{closeResult.transactions_count || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>Cierre total</span>
              <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent-light)' }}>{fmtTQ(closeResult.expected_close || 0)} TQ</span>
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => { setAction('view'); loadShift() }}
          >
            Aceptar
          </button>
        </div>
      )}
    </div>
  )
}
