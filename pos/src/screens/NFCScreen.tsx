import { useState, useEffect, useRef } from 'react'
import { API } from '../api'
import { fmtTQ } from '../utils/format'

interface Props {
  amount: number
  onBack: () => void
  onPaid: () => void
  api: API
  terminalID: string | null
  isDemoNode?: boolean
}

export function NFCScreen({ amount, onBack, onPaid, api, terminalID, isDemoNode }: Props) {
  const [status, setStatus] = useState<'waiting' | 'pin' | 'processing' | 'rotating' | 'approved' | 'rejected'>('waiting')
  const [pin, setPin] = useState('')
  const [cardUID, setCardUID] = useState('')
  const [cardType, setCardType] = useState<'uid_only' | 'desfire' | 'unknown'>('unknown')
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const [cardConfig, setCardConfig] = useState<any>(null)
  const pollRef = useRef<any>(null)

  // Cargar configuracion de tipo de tarjeta del nodo
  useEffect(() => {
    api.getCardTypeConfig().then((cfg: any) => {
      setCardConfig(cfg)
    }).catch(() => {})
  }, [])

  // Try Web NFC API if available
  useEffect(() => {
    if (!('NDEFReader' in window)) {
      return
    }

    const reader = new (window as any).NDEFReader()
    reader.scan().then(() => {
      reader.onreading = (event: any) => {
        const uid = event.serialNumber || ''
        if (uid) {
          handleCardRead(uid)
        }
      }
    }).catch(() => {})

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleCardRead = (uid: string) => {
    setCardUID(uid)
    // Web NFC no puede detectar DESFire vs normal (solo lee NDEF)
    // Asumimos uid_only para Web NFC. Para DESFire real se necesita lector USB/BLE.
    setCardType('uid_only')
    setStatus('pin')
  }

  const handleManualCard = () => {
    const uid = prompt('Ingresa el UID de la tarjeta:')
    if (uid) handleCardRead(uid)
  }

  // Simulacion de pago - solo disponible en nodo demo
  const handleSimulatePayment = () => {
    setCardUID('SIM-' + Math.random().toString(36).substring(2, 10))
    setCardType('uid_only')
    setStatus('pin')
  }

  const handlePinSubmit = async () => {
    if (pin.length !== 4) {
      setError('El PIN debe ser de 4 digitos')
      return
    }
    setError('')
    setStatus('processing')

    try {
      // Para tarjetas normales (uid_only): UID + PIN
      // Para DESFire real: se necesita lector USB/BLE (no soportado en Web NFC)
      const payload = {
        card_uid: cardUID,
        crypto_token: cardUID, // Web POS usa UID como token (modo legacy)
        card_type: cardType,
        pin,
        amount,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(7),
      }

      const result = await api.processPayment(terminalID!, payload)
      setResult(result)

      if (result.status === 'approved') {
        // Si la tarjeta es segura y auto_rotate esta activado, mostrar rotacion
        if (cardType === 'desfire' && cardConfig?.auto_rotate_key) {
          setStatus('rotating')
          try {
            await api.prepareRotation(cardUID, terminalID || undefined)
            // En Web POS no podemos escribir la clave en la tarjeta (no hay APDU)
            // Esto requiere el lector BLE o USB
            // Por ahora, la rotacion la hace el terminal fisico
          } catch (e) {
            // Rotacion falla en Web POS - no es critico
          }
        }
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

      {/* Amount - siempre visible para que el cliente lo vea antes de acercar la tarjeta */}
      <div style={{ textAlign: 'center', marginBottom: 24, background: 'var(--card)', padding: 20, borderRadius: 16, width: '100%' }}>
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>Monto a cobrar</div>
        <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--accent-light)' }}>
          {fmtTQ(amount)} TQ
        </div>
      </div>

      {/* Card type indicator */}
      {cardConfig && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, textAlign: 'center' }}>
          Modo: {cardConfig.card_type_mode === 'dual' ? 'Dual (tarjetas normales y seguras)' :
                 cardConfig.card_type_mode === 'desfire' ? 'Solo tarjetas seguras (DESFire)' :
                 'Solo tarjetas normales (UID+PIN)'}
          {cardConfig.auto_rotate_key && cardConfig.card_type_mode !== 'uid_only' && ' | Rotacion automatica ON'}
        </div>
      )}

      {/* Waiting for NFC */}
      {status === 'waiting' && (
        <div className="fade-in" style={{ textAlign: 'center', marginTop: 20 }}>
          <div style={{ fontSize: 80, marginBottom: 24 }} className="pulse">📱</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Acerca la tarjeta</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24, maxWidth: 280 }}>
            Pide al cliente que acerque su tarjeta NFC al telefono
          </p>

          {!('NDEFReader' in window) && (
            <div style={{ background: 'rgba(202,138,4,0.15)', padding: 16, borderRadius: 12, marginBottom: 16, textAlign: 'left' }}>
              <p style={{ color: 'var(--warning)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                ⚠️ Este dispositivo no tiene NFC integrado
              </p>
              <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 8 }}>
                Para pagos NFC necesitas:
              </p>
              <ul style={{ color: 'var(--text-dim)', fontSize: 12, paddingLeft: 20, marginBottom: 8 }}>
                <li>Un celular con NFC (Chrome/Edge en Android)</li>
                <li>O un lector NFC Bluetooth conectado</li>
              </ul>
              <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                Sin NFC, puedes ingresar el UID de la tarjeta manualmente o usar QR.
              </p>
              <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 8 }}>
                Lector NFC Bluetooth: <strong style={{ color: 'var(--danger)' }}>no conectado</strong>
              </p>
            </div>
          )}

          {'NDEFReader' in window && (
            <div style={{ background: 'rgba(15,118,110,0.15)', padding: 12, borderRadius: 12, marginBottom: 16 }}>
              <p style={{ color: 'var(--accent-light)', fontSize: 12 }}>
                ✓ NFC detectado en este dispositivo. Acerca la tarjeta para leerla.
              </p>
            </div>
          )}

          {cardConfig?.require_crypto && (
            <div style={{ background: 'rgba(220,38,38,0.15)', padding: 12, borderRadius: 12, marginBottom: 16 }}>
              <p style={{ color: 'var(--danger)', fontSize: 12 }}>
                ⚠️ Este nodo requiere tarjetas seguras (DESFire). Las tarjetas normales seran rechazadas.
              </p>
            </div>
          )}

          <button className="btn btn-secondary" style={{ width: '100%', maxWidth: 300 }} onClick={handleManualCard}>
            Ingresar UID manualmente
          </button>

          {/* Simulacion solo en nodo demo */}
          {isDemoNode && (
            <button
              className="btn btn-secondary"
              style={{ width: '100%', maxWidth: 300, marginTop: 12, background: 'rgba(202,138,4,0.2)', color: 'var(--warning)' }}
              onClick={handleSimulatePayment}
            >
              🧪 Simular pago (modo demo)
            </button>
          )}
        </div>
      )}

      {/* PIN entry */}
      {status === 'pin' && (
        <div className="fade-in" style={{ width: '100%', maxWidth: 320 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🔐</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Ingresa el PIN</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>Tarjeta: {cardUID.slice(0, 16)}...</p>
            {cardType === 'desfire' && (
              <p style={{ color: 'var(--success)', fontSize: 11, marginTop: 4 }}>✓ Tarjeta segura (DESFire)</p>
            )}
            {cardType === 'uid_only' && (
              <p style={{ color: 'var(--warning)', fontSize: 11, marginTop: 4 }}>Tarjeta normal (UID+PIN)</p>
            )}
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

      {/* Rotating key */}
      {status === 'rotating' && (
        <div className="fade-in" style={{ textAlign: 'center', marginTop: 60 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }} className="pulse">🔄</div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Rotando clave de seguridad...</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>Protegiendo contra clonacion</p>
        </div>
      )}

      {/* Approved - NO mostrar saldo de cuenta */}
      {status === 'approved' && (
        <div className="fade-in" style={{ textAlign: 'center', marginTop: 60 }}>
          <div style={{ fontSize: 80, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)', marginBottom: 8 }}>Pago Aprobado</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 18, marginBottom: 4 }}>
            {fmtTQ(amount)} TQ
          </p>
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
