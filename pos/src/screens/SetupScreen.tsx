import { useState } from 'react'
import { API } from '../api'
import { storage, generateDeviceFingerprint } from '../crypto'

interface Props {
  onComplete: (terminalID: string) => void
  api: API
  generateKeyPair: () => Promise<{ publicKey: string; privateKey: string }>
  generateTerminalID: () => string
}

export function SetupScreen({ onComplete, api, generateKeyPair, generateTerminalID }: Props) {
  const [step, setStep] = useState<string>('intro')
  const [label, setLabel] = useState('')
  const [location, setLocation] = useState('')
  const [terminalID, setTerminalID] = useState('')
  const [registrationToken, setRegistrationToken] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [serverPublicKey, setServerPublicKey] = useState('')
  const [fingerprint, setFingerprint] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleStart = async () => {
    setError('')
    setLoading(true)
    try {
      // Generar fingerprint del dispositivo
      const fp = await generateDeviceFingerprint()
      setFingerprint(fp)
      storage.set('deviceFingerprint', fp)

      const termID = generateTerminalID()
      setTerminalID(termID)
      setStep('register')
    } catch (e: any) {
      setError('Error generando huella del dispositivo: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    setError('')
    setLoading(true)
    try {
      // Registrar con fingerprint + credenciales
      const data = await api.registerTerminal(terminalID, label || 'POS Web', location || 'Web', fingerprint)
      if (data.registration_token) {
        setRegistrationToken(data.registration_token)
        setStep('keys')
      } else {
        setError('No se recibio token de registro')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateKeys = async () => {
    setError('')
    setLoading(true)
    try {
      const kp = await generateKeyPair()
      setPublicKey(kp.publicKey)
      setPrivateKey(kp.privateKey)

      // Complete registration with public key + fingerprint
      const data = await api.completeRegistration(terminalID, registrationToken, kp.publicKey, fingerprint)
      if (data.server_public_key) {
        setServerPublicKey(data.server_public_key)
        storage.set('privateKey', kp.privateKey)
        storage.set('publicKey', kp.publicKey)
        storage.set('serverPublicKey', data.server_public_key)
        storage.set('terminalID', terminalID)
        setStep('auth')
      } else {
        setError('No se recibio clave publica del servidor')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAuth = async () => {
    setError('')
    setLoading(true)
    try {
      // Autenticar con clave + fingerprint (doble verificacion)
      const data = await api.terminalAuth(terminalID, privateKey, fingerprint)
      if (data.session_token) {
        storage.set('sessionToken', data.session_token)
        setStep('done')
      } else {
        setError('No se recibio token de sesion')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Registrar Terminal</h1>
      </div>

      {step === 'intro' && (
        <div className="card fade-in">
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 16 }}>
            Este dispositivo se registrara como un terminal de punto de venta.
            Se generaran:
          </p>
          <ul style={{ color: 'var(--text-dim)', fontSize: 14, paddingLeft: 20, marginBottom: 16 }}>
            <li><strong>Huella del dispositivo</strong> (canvas, GPU, pantalla, hardware)</li>
            <li><strong>Claves criptograficas Ed25519</strong> unicas para este dispositivo</li>
            <li><strong>Claves rotativas</strong> que cambian cada 30 segundos</li>
          </ul>
          <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 16 }}>
            El servidor verificara la huella Y las claves en cada peticion.
            Si alguien copia la caché en otro dispositivo, la huella no coincidira.
          </p>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleStart} disabled={loading}>
            {loading ? 'Generando huella...' : 'Registrar este dispositivo'}
          </button>
        </div>
      )}

      {step === 'register' && (
        <div className="card fade-in">
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Datos del Terminal</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 8 }}>ID: {terminalID}</p>
          <input
            type="text"
            placeholder="Nombre (ej: POS Tienda Central)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{
              width: '100%', padding: 14, borderRadius: 12, marginBottom: 12,
              background: 'var(--card-light)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 16
            }}
          />
          <input
            type="text"
            placeholder="Ubicacion (ej: Local Principal)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={{
              width: '100%', padding: 14, borderRadius: 12,
              background: 'var(--card-light)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 16
            }}
          />
          {error && <p style={{ color: 'var(--danger)', fontSize: 14, marginTop: 8 }}>{error}</p>}
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 16 }}
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      )}

      {step === 'keys' && (
        <div className="card fade-in">
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Generar Claves</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 16 }}>
            Generando par de claves Ed25519 para autenticacion segura...
          </p>
          {error && <p style={{ color: 'var(--danger)', fontSize: 14, marginTop: 8 }}>{error}</p>}
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={handleGenerateKeys}
            disabled={loading}
          >
            {loading ? 'Generando claves...' : 'Generar y completar registro'}
          </button>
        </div>
      )}

      {step === 'auth' && (
        <div className="card fade-in">
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Autenticar Terminal</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 16 }}>
            Claves generadas. Ahora autenticando el terminal con el nodo...
          </p>
          {error && <p style={{ color: 'var(--danger)', fontSize: 14, marginTop: 8 }}>{error}</p>}
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={handleAuth}
            disabled={loading}
          >
            {loading ? 'Autenticando...' : 'Autenticar'}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="card fade-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Terminal Registrado</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 16 }}>
            El terminal esta listo para usar.
          </p>
          <button className="btn btn-success" style={{ width: '100%' }} onClick={() => onComplete(terminalID)}>
            Ir al Punto de Venta
          </button>
        </div>
      )}
    </div>
  )
}
