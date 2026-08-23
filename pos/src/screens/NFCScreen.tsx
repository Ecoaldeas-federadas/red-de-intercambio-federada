import { useState, useEffect, useRef } from 'react'
import { API } from '../api'

interface Props {
  amount: number
  onBack: () => void
  onPaid: () => void
  api: API
  terminalID: string | null
}

export function NFCScreen({ amount, onBack, onPaid, api, terminalID }: Props) {
  const [status, setStatus] = useState<'waiting' | 'reading' | 'pin' | 'processing' | 'approved' | 'rejected'>('waiting')
  const [pin, setPin] = useState('')
  const [cardUID, setCardUID] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const pollRef = useRef<any>(null)

  // Try Web NFC API if available
  useEffect(() => {
    if (!('NDEFReader' in window)) {
      // No Web NFC - show manual card entry
      return
    }

    const reader = new (window as any).NDEFReader()
    reader.scan().then(() => {
      reader.onreading = (event: any) => {
        // Extract card UID from NDEF record
        const uid = event.serialNumber || ''
        if (uid) {
          handleCardRead(uid)
        }
      }
    }).catch(() => {
      // NFC not available or permission denied
    })

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleCardRead = (uid: string) => {
    setCardUID(uid)
    setStatus('pin')
  }

  const handleManualCard = () => {
    // Manual card entry for testing
    const uid = prompt('Ingresa el UID de la tarjeta:')
    if (uid) handleCardRead(uid)
  }

  const handlePinSubmit = async () => {
    if (pin.length !== 4) {
      setError('El PIN debe ser de 4 digitos')
      return
    }
    setError('')
    setStatus('processing')

    try {
      // Build the payment payload (same as physical NFC terminal)
      const payload = {
        card_uid: cardUID,
        crypto_token: '', // Web POS doesn't have crypto card token
        pin,
        amount,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(7),
      }

      const result = await api.processPayment(terminalID!, payload)
      setResult(result)

      if (result.status === 'approved') {
        setStatus('approved')
        setTimeout(onPaid, 2000)
      } else {
        setStatus('rejected')
        setError(result.message || 'Pago rechazado')
      }
    } catch (e: any) {
      setStatus('rejected')
      setError(e.message)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24, maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: 'var(--card)', borderRadius: 10, padding: 10, color: 'var(--text)', fontSize: 20 }}>
          ←
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Pago NFC</h2>
        <div style={{ width: 44 }} />
      </div>

      {/* Amount */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>Monto a cobrar</div>
        <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--accent-light)' }}>
          {amount.toLocaleString('es')} TQ
        </div>
      </div>

      {/* Waiting for NFC */}
      {status === 'waiting' && (
        <div className="fade-in" style={{ textAlign: 'center', marginTop: 40 }}>
          <div style={{ fontSize: 80, marginBottom: 24 }} className="pulse">📱</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Acerca la tarjeta</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24, maxWidth: 280 }}>
            Pide al cliente que acerque su tarjeta NFC al telefono
          </p>

          {!('NDEFReader' in window) && (
            <div style={{ background: 'rgba(202,138,4,0.15)', padding: 12, borderRadius: 12, marginBottom: 16 }}>
              <p style={{ color: 'var(--warning)', fontSize: 12 }}>
                ⚠️ Tu navegador no soporta NFC nativo. Puedes ingresar el UID manualmente.
              </p>
            </div>
          )}

          <button className="btn btn-secondary" style={{ width: '100%', maxWidth: 300 }} onClick={handleManualCard}>
            Ingresar UID manualmente
          </button>
        </div>
      )}

      {/* PIN entry */}
      {status === 'pin' && (
        <div className="fade-in" style={{ width: '100%', maxWidth: 320 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🔐</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Ingresa el PIN</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>Tarjeta: {cardUID.slice(0, 16)}...</p>
          </div>

          {/* PIN display */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'var(--card)', border: '2px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 700,
                borderColor: pin.length > i ? 'var(--accent)' : 'var(--border)',
              }}>
                {pin.length > i ? '•' : ''}
              </div>
            ))}
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: 14, textAlign: 'center', marginBottom: 12 }}>{error}</p>}

          {/* PIN keypad */}
          <div className="keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
              <button key={n} className="key" onClick={() => pin.length < 4 && setPin(pin + n)}>{n}</button>
            ))}
            <button className="key" onClick={() => setPin('')} style={{ background: 'rgba(220,38,38,0.2)', color: 'var(--danger)' }}>C</button>
            <button className="key" onClick={() => pin.length < 4 && setPin(pin + '0')}>0</button>
            <button className="key" onClick={() => setPin(pin.slice(0, -1))} style={{ background: 'rgba(202,138,4,0.2)', color: 'var(--warning)' }}>⌫</button>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 16 }}
            onClick={handlePinSubmit}
            disabled={pin.length !== 4}
          >
            Confirmar Pago
          </button>
        </div>
      )}

      {/* Processing */}
      {status === 'processing' && (
        <div className="fade-in" style={{ textAlign: 'center', marginTop: 60 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }} className="pulse">⏳</div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Procesando pago...</h2>
        </div>
      )}

      {/* Approved */}
      {status === 'approved' && (
        <div className="fade-in" style={{ textAlign: 'center', marginTop: 60 }}>
          <div style={{ fontSize: 80, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)', marginBottom: 8 }}>Pago Aprobado</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 18, marginBottom: 4 }}>
            {amount.toLocaleString('es')} TQ
          </p>
          {result?.user_balance != null && (
            <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>
              Saldo del cliente: {result.user_balance} TQ
            </p>
          )}
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 16 }}>Redirigiendo...</p>
        </div>
      )}

      {/* Rejected */}
      {status === 'rejected' && (
        <div className="fade-in" style={{ textAlign: 'center', marginTop: 60 }}>
          <div style={{ fontSize: 80, marginBottom: 16 }}>❌</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--danger)', marginBottom: 8 }}>Pago Rechazado</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24 }}>{error}</p>
          <button className="btn btn-primary" style={{ width: '100%', maxWidth: 300 }} onClick={() => { setStatus('waiting'); setPin(''); setError('') }}>
            Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  )
}
