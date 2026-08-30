import { useState, useEffect } from 'react'
import { API } from '../api'
import { fmtTQ, fmtDateTime } from '../utils/format'

interface Props {
  onBack: () => void
  api: API
  terminalID: string | null
}

export function ShiftScreen({ onBack, api, terminalID }: Props) {
  const [shift, setShift] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<'view' | 'opening' | 'closing' | 'closed' | 'history'>('view')
  const [openingAmount, setOpeningAmount] = useState('0')
  const [shiftPin, setShiftPin] = useState('')
  const [closeResult, setCloseResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null)

  // History state
  const [shifts, setShifts] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedShift, setSelectedShift] = useState<any>(null)

  useEffect(() => {
    loadShift()
    checkPinConfigured()
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

  const checkPinConfigured = async () => {
    try {
      const result = await api.getShiftPinConfigured(terminalID || '')
      setPinConfigured(result.configured === true)
    } catch {
      setPinConfigured(null)
    }
  }

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
    if (shiftPin.length < 4) {
      setError('Ingrese el PIN del turno (configurado por el dueño)')
      return
    }
    const amount = parseInt(openingAmount) || 0
    try {
      await api.openShift(terminalID || '', amount, shiftPin)
      setAction('view')
      setShiftPin('')
      loadShift()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleCloseShift = async () => {
    setError('')
    if (shiftPin.length < 4) {
      setError('Ingrese el PIN del turno para cerrar')
      return
    }
    try {
      const result = await api.closeShift(terminalID || '', shiftPin)
      setCloseResult(result)
      setAction('closed')
      setShiftPin('')
    } catch (e: any) {
      setError(e.message)
    }
  }

  // History functions
  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const data = await api.listShifts(terminalID || '', fromDate || undefined, toDate || undefined)
      setShifts(Array.isArray(data) ? data : [])
    } catch {
      setShifts([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleExportShifts = async () => {
    try {
      const csv = await api.exportShiftsCSV(terminalID || '', fromDate || undefined, toDate || undefined)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `turnos_${terminalID}_${fromDate || 'inicio'}_${toDate || 'fin'}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError('Error al exportar: ' + e.message)
    }
  }

  const handleExportTransactions = async () => {
    try {
      const csv = await api.exportTransactionsCSV(terminalID || '', fromDate || undefined, toDate || undefined)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transacciones_${terminalID}_${fromDate || 'inicio'}_${toDate || 'fin'}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError('Error al exportar: ' + e.message)
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

      {/* PIN no configurado warning */}
      {pinConfigured === false && action === 'view' && (
        <div style={{ background: 'rgba(202,138,4,0.15)', color: 'var(--warning)', padding: 12, borderRadius: 12, marginBottom: 12, fontSize: 13 }}>
          ⚠️ El dueño del terminal no ha configurado el PIN del turno. Contacte al dueño para configurarlo desde el panel web.
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
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>Cierre esperado</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-light)' }}>{fmtTQ(shift.expected_close || 0)} TQ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 12, color: 'var(--text-dim)' }}>
                <span>Abierto desde</span>
                <span>{fmtDateTime(shift.opened_at)}</span>
              </div>

              <button
                className="btn btn-danger"
                style={{ width: '100%', marginTop: 16 }}
                onClick={() => { setShiftPin(''); setAction('closing') }}
              >
                🔒 Cerrar Turno
              </button>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>�</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No hay turno abierto</h3>
              <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 16 }}>
                Abre un turno para llevar la contabilidad de ventas
              </p>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => { setOpeningAmount('0'); setShiftPin(''); setAction('opening') }}
                disabled={pinConfigured === false}
              >
                🔓 Abrir Turno
              </button>
            </div>
          )}

          <button className="btn btn-secondary" style={{ width: '100%', marginBottom: 8 }} onClick={loadShift}>
            🔄 Actualizar
          </button>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => { setAction('history'); loadHistory() }}>
            📋 Historial de Turnos
          </button>
        </div>
      )}

      {/* Pantalla de apertura - monto + PIN */}
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

          {/* PIN del turno */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-dim)', marginBottom: 6, textAlign: 'center' }}>
              PIN del Turno (del dueño)
            </label>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'var(--card)', border: '2px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 700,
                  borderColor: shiftPin.length > i ? 'var(--accent)' : 'var(--border)',
                }}>
                  {shiftPin.length > i ? '•' : ''}
                </div>
              ))}
            </div>
            <div className="keypad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
                <button key={n} className="key" onClick={() => shiftPin.length < 4 && setShiftPin(shiftPin + n)}>{n}</button>
              ))}
              <button className="key" onClick={() => setShiftPin('')} style={{ background: 'rgba(220,38,38,0.2)', color: 'var(--danger)' }}>C</button>
              <button className="key" onClick={() => shiftPin.length < 4 && setShiftPin(shiftPin + '0')}>0</button>
              <button className="key" onClick={() => setShiftPin(shiftPin.slice(0, -1))} style={{ background: 'rgba(202,138,4,0.2)', color: 'var(--warning)' }}>⌫</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleOpenShift} disabled={shiftPin.length !== 4}>
              Confirmar Apertura
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAction('view')}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Pantalla de cierre - PIN + resumen */}
      {!loading && action === 'closing' && (
        <div className="fade-in">
          <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Confirmar Cierre de Turno</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}>
              <span style={{ color: 'var(--text-dim)' }}>Apertura</span>
              <span style={{ fontWeight: 600 }}>{fmtTQ(shift?.opening_amount || 0)} TQ</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}>
              <span style={{ color: 'var(--text-dim)' }}>Total vendido</span>
              <span style={{ fontWeight: 600, color: 'var(--success)' }}>{fmtTQ(shift?.total_sales || 0)} TQ</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}>
              <span style={{ color: 'var(--text-dim)' }}>Transacciones</span>
              <span style={{ fontWeight: 600 }}>{shift?.transactions_count || 0}</span>
            </div>
          </div>

          {/* PIN del turno */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-dim)', marginBottom: 6, textAlign: 'center' }}>
              PIN del Turno (del dueño)
            </label>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'var(--card)', border: '2px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 700,
                  borderColor: shiftPin.length > i ? 'var(--accent)' : 'var(--border)',
                }}>
                  {shiftPin.length > i ? '•' : ''}
                </div>
              ))}
            </div>
            <div className="keypad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
                <button key={n} className="key" onClick={() => shiftPin.length < 4 && setShiftPin(shiftPin + n)}>{n}</button>
              ))}
              <button className="key" onClick={() => setShiftPin('')} style={{ background: 'rgba(220,38,38,0.2)', color: 'var(--danger)' }}>C</button>
              <button className="key" onClick={() => shiftPin.length < 4 && setShiftPin(shiftPin + '0')}>0</button>
              <button className="key" onClick={() => setShiftPin(shiftPin.slice(0, -1))} style={{ background: 'rgba(202,138,4,0.2)', color: 'var(--warning)' }}>⌫</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleCloseShift} disabled={shiftPin.length !== 4}>
              Confirmar Cierre
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAction('view')}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Pantalla de cierre exitoso */}
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

      {/* Historial de turnos */}
      {!loading && action === 'history' && (
        <div className="fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Historial de Turnos</h3>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setAction('view')}>
              Volver
            </button>
          </div>

          {/* Filtro de fechas */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ flex: 1, padding: 8, borderRadius: 8, background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 13 }}
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ flex: 1, padding: 8, borderRadius: 8, background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 13 }}
            />
            <button className="btn btn-primary" style={{ padding: '8px 12px', fontSize: 13 }} onClick={loadHistory}>
              Buscar
            </button>
          </div>

          {/* Export buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className="btn btn-secondary" style={{ flex: 1, fontSize: 12 }} onClick={handleExportShifts}>
              📥 Exportar Turnos CSV
            </button>
            <button className="btn btn-secondary" style={{ flex: 1, fontSize: 12 }} onClick={handleExportTransactions}>
              📥 Exportar Transacciones CSV
            </button>
          </div>

          {/* Lista de turnos */}
          {historyLoading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 20 }}>Cargando...</div>
          ) : selectedShift ? (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700 }}>Detalle del Turno</h4>
                <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setSelectedShift(null)}>
                  ← Volver
                </button>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Usuario:</span>
                  <span>{selectedShift.user_name || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Estado:</span>
                  <span style={{ color: selectedShift.status === 'closed' ? 'var(--success)' : 'var(--warning)' }}>
                    {selectedShift.status === 'closed' ? 'Cerrado' : 'Abierto'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Apertura:</span>
                  <span>{fmtDateTime(selectedShift.opened_at)}</span>
                </div>
                {selectedShift.closed_at && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Cierre:</span>
                    <span>{fmtDateTime(selectedShift.closed_at)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Monto apertura:</span>
                  <span>{fmtTQ(selectedShift.opening_amount || 0)} TQ</span>
                </div>
                {selectedShift.closing_amount != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Monto cierre:</span>
                    <span>{fmtTQ(selectedShift.closing_amount || 0)} TQ</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Ventas totales:</span>
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>{fmtTQ(selectedShift.total_sales || 0)} TQ</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Transacciones:</span>
                  <span>{selectedShift.transactions_count || 0}</span>
                </div>
                {selectedShift.notes && (
                  <div style={{ marginTop: 8, padding: 8, background: 'var(--bg)', borderRadius: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                    Notas: {selectedShift.notes}
                  </div>
                )}
              </div>
            </div>
          ) : shifts.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 20, fontSize: 14 }}>
              No hay turnos en el rango seleccionado
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shifts.map((s, i) => (
                <div
                  key={s.id || i}
                  className="card"
                  style={{ padding: 12, cursor: 'pointer' }}
                  onClick={() => setSelectedShift(s)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{s.user_name || '—'}</span>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 6,
                      background: s.status === 'closed' ? 'rgba(34,197,94,0.15)' : 'rgba(202,138,4,0.15)',
                      color: s.status === 'closed' ? 'var(--success)' : 'var(--warning)',
                    }}>
                      {s.status === 'closed' ? 'Cerrado' : 'Abierto'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    {fmtDateTime(s.opened_at)}
                    {s.closed_at && ` → ${fmtDateTime(s.closed_at)}`}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-dim)' }}>Ventas: <strong style={{ color: 'var(--success)' }}>{fmtTQ(s.total_sales || 0)} TQ</strong></span>
                    <span style={{ color: 'var(--text-dim)' }}>{s.transactions_count || 0} trans.</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
