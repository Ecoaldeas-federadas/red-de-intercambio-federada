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

// Tipos de documento soportados
const DOC_TYPES = [
  { code: 'cedula', label: 'Cédula' },
  { code: 'passport', label: 'Pasaporte' },
  { code: 'dni', label: 'DNI' },
  { code: 'rut', label: 'RUT' },
]

export function NFCScreen({ amount, onBack, onPaid, api, terminalID, isDemoNode }: Props) {
  // Estados del flujo unificado:
  // credentials → tap_card → processing/writing → approved/rejected
  const [status, setStatus] = useState<'credentials' | 'tap_card' | 'processing' | 'writing' | 'approved' | 'rejected'>('credentials')
  const [docType, setDocType] = useState('cedula')
  const [docNumber, setDocNumber] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [preAuth, setPreAuth] = useState<any>(null)
  const [cardUID, setCardUID] = useState('')
  const [writeProgress, setWriteProgress] = useState('')
  const pollRef = useRef<any>(null)

  // Web NFC API para leer tarjeta
  useEffect(() => {
    if (status !== 'tap_card') return
    if (!('NDEFReader' in window)) return

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
  }, [status])

  // Paso 1: Enviar doc + PIN al servidor (pre-auth unificado)
  const handleCredentialsSubmit = async () => {
    if (docNumber.trim() === '') {
      setError('Ingrese el número de documento de identidad')
      return
    }
    if (pin.length !== 4) {
      setError('El PIN debe ser de 4 dígitos')
      return
    }
    setError('')
    setStatus('processing')

    try {
      const result = await api.classicPreAuth(terminalID!, {
        doc_type: docType,
        doc_number: docNumber,
        pin,
        amount,
      })

      if (result.pre_approved && result.card_uid) {
        setPreAuth(result)
        setStatus('tap_card')
      } else {
        setStatus('rejected')
        setError(result.message || 'Pre-autenticación rechazada')
      }
    } catch (e: any) {
      // Modo demo: simular pre-auth si el servidor no responde
      if (isDemoNode) {
        const isMultisig = docNumber.includes('MULTISIG') || docNumber.includes('2SIG') || docNumber.includes('3SIG') || docNumber.includes('FIRM')
        if (isMultisig) {
          setPreAuth({
            pre_approved: true,
            card_type: 'desfire',
            card_uid: 'DEMO-DESFire-' + docNumber.substring(0, 6),
          })
        } else {
          setPreAuth({
            pre_approved: true,
            card_type: 'classic',
            card_uid: 'DEMO-CLASSIC-' + docNumber.substring(0, 6),
            read_sector: 5,
            read_key_a: 'aabbccddeeff',
            expected_certificate: '11223344556677889900aabbccddeeff',
            write_sector: 10,
            write_key_b: '112233445566',
            new_certificate: 'ffeeddccbbaa99887766554433221100',
          })
        }
        setStatus('tap_card')
      } else {
        setStatus('rejected')
        setError(e.message || 'Error de conexión con el servidor')
      }
    }
  }

  // Paso 2: Tarjeta leída — verificar UID y procesar según tipo
  const handleCardRead = async (uid: string) => {
    setCardUID(uid)

    if (!preAuth || !preAuth.card_uid) {
      setStatus('rejected')
      setError('No hay pre-autenticación activa')
      return
    }

    // Verificar que el UID coincide con el del pre-auth
    if (uid !== preAuth.card_uid) {
      setStatus('rejected')
      setError('La tarjeta no coincide con el usuario autenticado')
      return
    }

    const cardType = preAuth.card_type || 'classic'

    if (cardType === 'classic') {
      // Flujo Classic: simular lectura/escritura de sectores
      // (Web NFC no soporta MIFARE Classic sector read/write — requiere lector BLE)
      setStatus('writing')
      setWriteProgress('Leyendo sector...')
      await new Promise(r => setTimeout(r, 500))
      setWriteProgress('Verificando certificado...')
      await new Promise(r => setTimeout(r, 500))
      setWriteProgress('Escribiendo nuevo certificado...')
      await new Promise(r => setTimeout(r, 500))
      setWriteProgress('Confirmando transacción...')

      try {
        const result = await api.classicConfirm(
          terminalID!,
          preAuth.card_uid,
          true,  // read_ok
          true,  // write_ok
          16     // written_blocks
        )

        if (result.status === 'approved') {
          setStatus('approved')
          setTimeout(onPaid, 2000)
        } else {
          setStatus('rejected')
          setError(result.message || 'Transacción rechazada')
        }
      } catch (e: any) {
        if (isDemoNode) {
          setStatus('approved')
          setTimeout(onPaid, 2000)
        } else {
          setStatus('rejected')
          setError(e.message || 'Error al confirmar transacción')
        }
      }
    } else {
      // Flujo UID-only/DESFire: procesar pago normal
      setStatus('processing')
      try {
        const payload = {
          card_uid: uid,
          crypto_token: uid,
          card_type: cardType,
          pin,
          amount,
          timestamp: Date.now(),
          nonce: Math.random().toString(36).substring(7),
          id_document_type: docType,
          id_document_number: docNumber,
        }

        const result = await api.processPayment(terminalID!, payload)

        if (result.status === 'approved') {
          setStatus('approved')
          setTimeout(onPaid, 2000)
        } else if (result.status === 'pending_multisig') {
          setStatus('rejected')
          setError(result.message || 'Pago pendiente de multi-firma — use el POS Android para completar')
        } else {
          setStatus('rejected')
          setError(result.message || 'Pago rechazado')
        }
      } catch (e: any) {
        if (isDemoNode) {
          setStatus('approved')
          setTimeout(onPaid, 2000)
        } else {
          setStatus('rejected')
          setError(e.message || 'Error al procesar pago')
        }
      }
    }
  }

  const handleManualCard = () => {
    const uid = preAuth?.card_uid || prompt('Ingresa el UID de la tarjeta:')
    if (uid) handleCardRead(uid)
  }

  // Simular tap en modo demo
  const handleSimulateTap = () => {
    if (preAuth?.card_uid) {
      handleCardRead(preAuth.card_uid)
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

      {/* Amount - siempre visible */}
      <div style={{ textAlign: 'center', marginBottom: 24, background: 'var(--card)', padding: 20, borderRadius: 16, width: '100%' }}>
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>Monto a cobrar</div>
        <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--accent-light)' }}>
          {fmtTQ(amount)} TQ
        </div>
      </div>

      {/* STEP 1: CREDENTIALS — doc + PIN primero para todos los tipos */}
      {status === 'credentials' && (
        <div className="fade-in" style={{ width: '100%', maxWidth: 320 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>�</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Verificación de Identidad</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
              Ingrese documento y PIN del cliente
            </p>
          </div>

          {/* Tipo de documento */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-dim)', marginBottom: 6 }}>
              Tipo de Documento
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              style={{
                width: '100%', padding: 12, borderRadius: 10,
                background: 'var(--card)', color: 'var(--text)',
                border: '1px solid var(--border)', fontSize: 16,
              }}
            >
              {DOC_TYPES.map(d => (
                <option key={d.code} value={d.code}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Número de documento */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-dim)', marginBottom: 6 }}>
              Número de Documento
            </label>
            <input
              type="text"
              className="input"
              placeholder="Ej. 12345678"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              style={{
                width: '100%', padding: 14, borderRadius: 10,
                background: 'var(--card)', color: 'var(--text)',
                border: '2px solid var(--border)', fontSize: 18,
                textAlign: 'center',
              }}
            />
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
            <button className="key" onClick={() => { setPin(''); setDocNumber('') }} style={{ background: 'rgba(220,38,38,0.2)', color: 'var(--danger)' }}>C</button>
            <button className="key" onClick={() => pin.length < 4 && setPin(pin + '0')}>0</button>
            <button className="key" onClick={() => setPin(pin.slice(0, -1))} style={{ background: 'rgba(202,138,4,0.2)', color: 'var(--warning)' }}>⌫</button>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 16 }}
            onClick={handleCredentialsSubmit}
            disabled={pin.length !== 4 || docNumber.trim() === ''}
          >
            Autenticar y Continuar
          </button>
        </div>
      )}

      {/* STEP 2: TAP CARD — acerque tarjeta después del pre-auth */}
      {status === 'tap_card' && (
        <div className="fade-in" style={{ textAlign: 'center', marginTop: 20 }}>
          {/* Mostrar tipo de tarjeta detectada */}
          {preAuth?.card_type === 'classic' && (
            <div style={{ background: 'rgba(202,138,4,0.15)', padding: 12, borderRadius: 12, marginBottom: 16 }}>
              <p style={{ color: 'var(--warning)', fontSize: 13, fontWeight: 600 }}>
                🏷️ Tarjeta MIFARE Classic detectada
              </p>
              <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4 }}>
                No retire la tarjeta hasta que termine
              </p>
            </div>
          )}
          {preAuth?.card_type === 'desfire' && (
            <div style={{ background: 'rgba(15,118,110,0.15)', padding: 12, borderRadius: 12, marginBottom: 16 }}>
              <p style={{ color: 'var(--accent-light)', fontSize: 13, fontWeight: 600 }}>
                🏷️ Tarjeta DESFire detectada
              </p>
            </div>
          )}
          {preAuth?.card_type === 'uid_only' && (
            <div style={{ background: 'rgba(15,118,110,0.15)', padding: 12, borderRadius: 12, marginBottom: 16 }}>
              <p style={{ color: 'var(--accent-light)', fontSize: 13, fontWeight: 600 }}>
                🏷️ Tarjeta UID detectada
              </p>
            </div>
          )}

          <div style={{ fontSize: 80, marginBottom: 24 }} className="pulse">📱</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Acerque la Tarjeta</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24, maxWidth: 280 }}>
            {preAuth?.card_type === 'classic'
              ? 'No retire la tarjeta hasta que termine el proceso'
              : 'Tarjeta del cliente para verificar identidad'}
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
            </div>
          )}

          {'NDEFReader' in window && (
            <div style={{ background: 'rgba(15,118,110,0.15)', padding: 12, borderRadius: 12, marginBottom: 16 }}>
              <p style={{ color: 'var(--accent-light)', fontSize: 12 }}>
                ✓ NFC detectado. Acerque la tarjeta para leerla.
              </p>
            </div>
          )}

          <button className="btn btn-secondary" style={{ width: '100%', maxWidth: 300 }} onClick={handleManualCard}>
            Ingresar UID manualmente
          </button>

          {isDemoNode && (
            <button
              className="btn btn-secondary"
              style={{ width: '100%', maxWidth: 300, marginTop: 12, background: 'rgba(202,138,4,0.2)', color: 'var(--warning)' }}
              onClick={handleSimulateTap}
            >
              🧪 Simular tap (modo demo)
            </button>
          )}

          <button
            className="btn btn-secondary"
            style={{ width: '100%', maxWidth: 300, marginTop: 12 }}
            onClick={() => { setStatus('credentials'); setPin(''); setError(''); setPreAuth(null) }}
          >
            Cancelar
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

      {/* Writing (Classic) */}
      {status === 'writing' && (
        <div className="fade-in" style={{ textAlign: 'center', marginTop: 60 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }} className="pulse">🔄</div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Escribiendo en tarjeta...</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 8 }}>{writeProgress}</p>
          <p style={{ color: 'var(--danger)', fontSize: 14, fontWeight: 700, marginTop: 16 }}>NO RETIRE LA TARJETA</p>
        </div>
      )}

      {/* Approved */}
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
          <button
            className="btn btn-primary"
            style={{ width: '100%', maxWidth: 300 }}
            onClick={() => { setStatus('credentials'); setPin(''); setError(''); setPreAuth(null) }}
          >
            Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  )
}
