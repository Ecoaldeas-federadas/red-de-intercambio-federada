import { useState } from 'react'
import { API } from '../api'
import { storage, generateDeviceFingerprint } from '../crypto'
import QRCode from 'qrcode'

interface Props {
  onComplete: (terminalID: string) => void
  api: API
  generateKeyPair: () => Promise<{ publicKey: string; privateKey: string }>
  generateTerminalID: () => string
}

// Flujo de registro correcto:
// 1. El usuario abre el POS en su dispositivo
// 2. El POS genera: terminal_id, claves Ed25519, huella del dispositivo
// 3. El POS MUESTRA todos estos datos (como texto + QR) para que el usuario
//    se los dé al administrador encargado
// 4. El administrador entra a la plataforma y registra el terminal
//    (POST /api/nfc/terminal/register - requiere permiso nfc.register_terminal)
// 5. El administrador le da al usuario el registration_token
// 6. El usuario ingresa el registration_token en el POS
// 7. El POS completa el registro (POST /api/nfc/terminal/complete-registration)
// 8. El POS puede autenticar y funcionar
export function SetupScreen({ onComplete, api, generateKeyPair, generateTerminalID }: Props) {
  const [step, setStep] = useState<string>('intro')
  const [label, setLabel] = useState('')
  const [location, setLocation] = useState('')
  const [terminalID, setTerminalID] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [fingerprint, setFingerprint] = useState('')
  const [registrationToken, setRegistrationToken] = useState('')
  const [serverPublicKey, setServerPublicKey] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Paso 1: Generar datos del terminal
  const handleGenerate = async () => {
    setError('')
    setLoading(true)
    try {
      // Generar huella del dispositivo
      const fp = await generateDeviceFingerprint()
      setFingerprint(fp)
      storage.set('deviceFingerprint', fp)

      // Generar terminal ID y claves
      const termID = generateTerminalID()
      const kp = await generateKeyPair()

      setTerminalID(termID)
      setPublicKey(kp.publicKey)
      setPrivateKey(kp.privateKey)

      // Guardar en storage
      storage.set('terminalID', termID)
      storage.set('publicKey', kp.publicKey)
      storage.set('privateKey', kp.privateKey)

      // Generar QR con todos los datos para que el admin los registre
      const registrationData = JSON.stringify({
        terminal_id: termID,
        public_key: kp.publicKey,
        device_fingerprint: fp,
        terminal_type: 'web_pos',
      })
      const qrUrl = `data:${registrationData}`
      QRCode.toDataURL(qrUrl, { width: 300, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
        .then(setQrDataUrl)
        .catch(() => {})

      setStep('show_data')
    } catch (e: any) {
      setError('Error generando datos: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  // Paso 2: El usuario ingreso el registration_token que le dio el admin
  const handleCompleteRegistration = async () => {
    setError('')
    setLoading(true)
    try {
      // Completar registro con la clave publica + fingerprint
      const data = await api.completeRegistration(terminalID, registrationToken, publicKey, fingerprint)
      if (data.server_public_key) {
        setServerPublicKey(data.server_public_key)
        storage.set('serverPublicKey', data.server_public_key)
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

  // Paso 3: Autenticar el terminal
  const handleAuth = async () => {
    setError('')
    setLoading(true)
    try {
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copiado al portapapeles`)
    })
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Registrar Terminal</h1>
      </div>

      {/* Paso 0: Introduccion */}
      {step === 'intro' && (
        <div className="card fade-in">
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 16 }}>
            Para registrar este terminal como punto de venta:
          </p>
          <ol style={{ color: 'var(--text-dim)', fontSize: 14, paddingLeft: 20, marginBottom: 16 }}>
            <li style={{ marginBottom: 8 }}>Este dispositivo generara sus datos unicos (ID, claves, huella)</li>
            <li style={{ marginBottom: 8 }}>Lleva estos datos al administrador encargado</li>
            <li style={{ marginBottom: 8 }}>El administrador registrara el terminal en la plataforma</li>
            <li style={{ marginBottom: 8 }}>El administrador te dara un codigo de registro</li>
            <li style={{ marginBottom: 8 }}>Ingresa ese codigo aqui para activar el terminal</li>
          </ol>
          <p style={{ color: 'var(--warning)', fontSize: 12, marginBottom: 16, background: 'rgba(202,138,4,0.1)', padding: 12, borderRadius: 8 }}>
            ⚠️ Los usuarios no pueden registrar terminales directamente.
            Solo un administrador con permisos puede hacerlo.
          </p>
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Nombre del punto (ej: POS Tienda Central)"
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
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleGenerate} disabled={loading || !label}>
            {loading ? 'Generando datos...' : 'Generar datos del terminal'}
          </button>
        </div>
      )}

      {/* Paso 1: Mostrar datos para el administrador */}
      {step === 'show_data' && (
        <div className="fade-in">
          <div className="card" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, marginBottom: 8, color: 'var(--accent-light)' }}>
              📋 Datos para el Administrador
            </h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>
              Muestra estos datos al administrador encargado. El los usara para
              registrar este terminal en la plataforma.
            </p>

            {/* QR con todos los datos */}
            {qrDataUrl && (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div className="qr-container" style={{ display: 'inline-block' }}>
                  <img src={qrDataUrl} alt="QR datos" style={{ width: 250 }} />
                </div>
                <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 8 }}>
                  El admin puede escanear este QR para registrar el terminal
                </p>
              </div>
            )}

            {/* Datos en texto para copiar */}
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>TERMINAL ID:</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>{terminalID}</code>
                <button onClick={() => copyToClipboard(terminalID, 'Terminal ID')} style={{ background: 'var(--card-light)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 11 }}>📋</button>
              </div>
            </div>

            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>CLAVE PUBLICA:</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ fontSize: 10, fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>{publicKey}</code>
                <button onClick={() => copyToClipboard(publicKey, 'Clave publica')} style={{ background: 'var(--card-light)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 11 }}>📋</button>
              </div>
            </div>

            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>HUELLA DEL DISPOSITIVO:</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ fontSize: 10, fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>{fingerprint}</code>
                <button onClick={() => copyToClipboard(fingerprint, 'Huella')} style={{ background: 'var(--card-light)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 11 }}>📋</button>
              </div>
            </div>

            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>TIPO:</div>
              <code style={{ fontSize: 12, fontFamily: 'monospace' }}>web_pos</code>
            </div>

            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>NOMBRE:</div>
              <code style={{ fontSize: 12 }}>{label}</code>
            </div>

            {location && (
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>UBICACION:</div>
                <code style={{ fontSize: 12 }}>{location}</code>
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 12, border: '1px solid var(--accent)' }}>
            <h2 style={{ fontSize: 16, marginBottom: 8, color: 'var(--accent-light)' }}>
              ✏️ Ingresa el Codigo de Registro
            </h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 12 }}>
              Cuando el administrador registre el terminal, te dara un codigo.
              Ingresa ese codigo aqui para activar el terminal.
            </p>
            <input
              type="text"
              placeholder="Codigo de registro (ej: abc123-def456...)"
              value={registrationToken}
              onChange={(e) => setRegistrationToken(e.target.value)}
              style={{
                width: '100%', padding: 14, borderRadius: 12, marginBottom: 12,
                background: 'var(--card-light)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 14, fontFamily: 'monospace'
              }}
            />
            {error && <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 8 }}>{error}</p>}
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={handleCompleteRegistration}
              disabled={loading || !registrationToken}
            >
              {loading ? 'Activando...' : 'Activar Terminal'}
            </button>
          </div>
        </div>
      )}

      {/* Paso 2: Autenticar */}
      {step === 'auth' && (
        <div className="card fade-in">
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Autenticar Terminal</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 16 }}>
            Terminal activado. Autenticando con el nodo...
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

      {/* Paso 3: Listo */}
      {step === 'done' && (
        <div className="card fade-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Terminal Listo</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 16 }}>
            El terminal esta registrado y autenticado.
          </p>
          <button className="btn btn-success" style={{ width: '100%' }} onClick={() => onComplete(terminalID)}>
            Ir al Punto de Venta
          </button>
        </div>
      )}
    </div>
  )
}
