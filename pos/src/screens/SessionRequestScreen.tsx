import { useState, useEffect, useRef } from 'react'
import { API } from '../api'
import { storage, generateKeyPair, generateDeviceFingerprint } from '../crypto'

interface Props {
  onComplete: (terminalID: string) => void
  api: API
}

// Flujo de solicitud de sesion web:
// 1. El usuario ingresa el terminal_id (que el admin le dio)
// 2. El POS web genera claves Ed25519 efimeras en el navegador
// 3. El POS web envia POST /api/pos-web/request-session
// 4. El servidor responde con un codigo de 4 digitos
// 5. El POS web muestra el codigo en pantalla grande
// 6. El usuario le pide al DUEÑO del terminal que apruebe el codigo
//    desde su cuenta en el backend
// 7. El POS web hace polling hasta que la solicitud sea aprobada/rechazada/expirada
// 8. Si es aprobada, guarda todo en localStorage y va al login
export function SessionRequestScreen({ onComplete, api }: Props) {
  const [step, setStep] = useState<string>('terminal_id')
  const [terminalID, setTerminalID] = useState(storage.get('terminalID') || '')
  const [pairingCode, setPairingCode] = useState('')
  const [requestId, setRequestId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Limpiar intervals al desmontar
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  // Paso 1: Iniciar solicitud de sesion
  const handleRequestSession = async () => {
    setError('')
    setLoading(true)
    try {
      // Generar claves Ed25519 en el navegador
      const kp = await generateKeyPair()
      const fp = await generateDeviceFingerprint()

      // Guardar en storage
      storage.set('terminalID', terminalID)
      storage.set('publicKey', kp.publicKey)
      storage.set('privateKey', kp.privateKey)
      storage.set('deviceFingerprint', fp)

      // Solicitar sesion al backend
      const data = await api.requestWebSession(terminalID, kp.publicKey, fp)
      if (data.pairing_code && data.request_id) {
        setPairingCode(data.pairing_code)
        setRequestId(data.request_id)
        setStep('show_code')
        setCountdown(60)
        startPolling(data.request_id)
      } else {
        setError('No se recibio codigo de la solicitud')
      }
    } catch (e: any) {
      setError(e.message || 'Error al solicitar sesion')
    } finally {
      setLoading(false)
    }
  }

  // Polling del estado de la solicitud
  const startPolling = (reqId: string) => {
    setPolling(true)
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.getWebSessionStatus(reqId)
        if (data.status === 'approved') {
          stopPolling()
          if (data.server_public_key) {
            storage.set('serverPublicKey', data.server_public_key)
          }
          if (data.expires_at) {
            storage.set('webSessionExpiresAt', data.expires_at)
          }
          setStep('done')
        } else if (data.status === 'rejected') {
          stopPolling()
          setError('La solicitud fue rechazada por el dueno del terminal.')
          setStep('terminal_id')
        } else if (data.status === 'expired') {
          stopPolling()
          setError('El codigo expiro. Solicita uno nuevo.')
          setStep('terminal_id')
        }
      } catch (e) {
        // Error de red, seguir intentando
      }
    }, 2000)

    // Countdown de 60 segundos
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          stopPolling()
          setError('El codigo expiro. Solicita uno nuevo.')
          setStep('terminal_id')
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    setPolling(false)
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>POS Web - Solicitud de Sesion</h1>
      </div>

      {/* Paso 0: Ingresar terminal_id */}
      {step === 'terminal_id' && (
        <div className="card fade-in">
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 16 }}>
            Ingresa el ID del terminal que el administrador te asigno.
          </p>
          <input
            type="text"
            placeholder="Terminal ID (ej: WEB-POS-001)"
            value={terminalID}
            onChange={(e) => setTerminalID(e.target.value)}
            style={{
              width: '100%', padding: 14, borderRadius: 12, marginBottom: 12,
              background: 'var(--card-light)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 16, fontFamily: 'monospace'
            }}
          />
          {error && <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 8 }}>{error}</p>}
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={handleRequestSession}
            disabled={loading || !terminalID.trim()}
          >
            {loading ? 'Solicitando...' : 'Solicitar Sesion'}
          </button>
        </div>
      )}

      {/* Paso 1: Mostrar codigo de 4 digitos */}
      {step === 'show_code' && (
        <div className="card fade-in" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, marginBottom: 8, color: 'var(--accent-light)' }}>
            Codigo de Validacion
          </h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24 }}>
            Pide al dueno del terminal que ingrese a su cuenta y apruebe este codigo:
          </p>

          {/* Codigo grande de 4 digitos */}
          <div style={{
            fontSize: 64,
            fontWeight: 900,
            fontFamily: 'monospace',
            letterSpacing: 12,
            color: 'var(--accent)',
            background: 'var(--bg)',
            borderRadius: 16,
            padding: '24px 0',
            marginBottom: 24,
            border: '2px solid var(--accent)'
          }}>
            {pairingCode}
          </div>

          {/* Countdown */}
          <div style={{ marginBottom: 16 }}>
            <div style={{
              width: '100%', height: 4, background: 'var(--card-light)',
              borderRadius: 2, overflow: 'hidden', marginBottom: 8
            }}>
              <div style={{
                width: `${(countdown / 60) * 100}%`, height: '100%',
                background: countdown > 15 ? 'var(--accent)' : 'var(--danger)',
                transition: 'width 1s linear'
              }} />
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              {countdown > 0 ? `Expira en ${countdown}s` : 'Expirado'}
            </p>
          </div>

          {polling && (
            <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>
              Esperando aprobacion del dueno...
            </p>
          )}

          {error && <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 8 }}>{error}</p>}

          <button
            className="btn"
            style={{ width: '100%', background: 'var(--card-light)' }}
            onClick={() => {
              stopPolling()
              setError('')
              setStep('terminal_id')
            }}
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Paso 2: Aprobado */}
      {step === 'done' && (
        <div className="card fade-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Sesion Aprobada</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 16 }}>
            El terminal web esta activado. Ahora puedes iniciar sesion.
          </p>
          <button
            className="btn btn-success"
            style={{ width: '100%' }}
            onClick={() => onComplete(terminalID)}
          >
            Iniciar Sesion
          </button>
        </div>
      )}
    </div>
  )
}
