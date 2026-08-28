import { useState } from 'react'
import { API } from '../api'
import { storage } from '../crypto'
import { getFormatSettings, FormatSettings } from '../hooks/usePreferences'

interface Props {
  onBack: () => void
  onLogout: () => void
  api: API
  terminalID: string | null
  merchantUser: any
  onShowShift: () => void
}

export function SettingsScreen({ onBack, onLogout, api, terminalID, merchantUser, onShowShift }: Props) {
  const [showKeys, setShowKeys] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [blockStep, setBlockStep] = useState<'idle' | 'enter_code' | 'blocked'>('idle')
  const [blockCode, setBlockCode] = useState('')
  const [error, setError] = useState('')
  const [shiftPin, setShiftPin] = useState('')
  const [showShiftAccess, setShowShiftAccess] = useState(false)

  const publicKey = storage.get('publicKey')
  const serverPublicKey = storage.get('serverPublicKey')
  const apiURL = api.getBaseURL()
  const formatSettings: FormatSettings = getFormatSettings()

  const handleReset = () => {
    storage.clear()
    onLogout()
  }

  const handleBlock = async () => {
    if (blockCode.length < 4) {
      setError('El codigo debe tener al menos 4 digitos')
      return
    }
    setError('')
    try {
      // Llamar al backend para bloquear el terminal con el codigo
      // El backend verifica el codigo y bloquea el terminal
      await api.blockTerminal(terminalID!, blockCode)
      setBlockStep('blocked')
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleUnblock = async () => {
    if (blockCode.length < 4) {
      setError('El codigo debe tener al menos 4 digitos')
      return
    }
    setError('')
    try {
      await api.unblockTerminal(terminalID!, blockCode)
      setBlockStep('idle')
      setBlockCode('')
    } catch (e: any) {
      setError(e.message)
    }
  }

  // Verificar PIN para acceder al estado del turno
  // El PIN se guarda localmente (no en backend) - es proteccion casual
  const handleShiftPinSubmit = () => {
    const savedPin = storage.get('shiftPin') || ''
    if (!savedPin) {
      // Si no hay PIN configurado, pedir crear uno
      if (shiftPin.length === 4) {
        storage.set('shiftPin', shiftPin)
        setShowShiftAccess(false)
        setShiftPin('')
        onShowShift()
      } else {
        setError('El PIN debe ser de 4 digitos')
      }
      return
    }
    if (shiftPin === savedPin) {
      setShowShiftAccess(false)
      setShiftPin('')
      setError('')
      onShowShift()
    } else {
      setError('PIN incorrecto')
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: 16, maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'var(--card)', borderRadius: 10, padding: 10, color: 'var(--text)', fontSize: 20 }}>
          ←
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Configuracion</h2>
        <div style={{ width: 44 }} />
      </div>

      {/* Terminal Info */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 8 }}>TERMINAL</h3>
        <div style={{ fontSize: 14, fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {terminalID}
        </div>
      </div>

      {/* Merchant Info */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 8 }}>COMERCIANTE</h3>
        <div style={{ fontSize: 14 }}>
          <p><strong>Usuario:</strong> {merchantUser?.username || 'N/A'}</p>
          <p><strong>Nombre:</strong> {merchantUser?.display_name || 'N/A'}</p>
        </div>
      </div>

      {/* Connection Info */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 8 }}>CONEXION</h3>
        <div style={{ fontSize: 14, fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {apiURL}
        </div>
      </div>

      {/* Display Format Settings (received from server, display-only) */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 8 }}>FORMATO DE PANTALLA</h3>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
          Configuracion regional recibida del servidor. Define como se muestran
          moneda, fechas y horas en este terminal.
        </p>
        <div style={{ fontSize: 14 }}>
          <p style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ color: 'var(--text-dim)' }}>Idioma (locale)</span>
            <span style={{ fontWeight: 600 }}>{formatSettings.locale}</span>
          </p>
          <p style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ color: 'var(--text-dim)' }}>Locale numerico</span>
            <span style={{ fontWeight: 600 }}>{formatSettings.number_locale}</span>
          </p>
          <p style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ color: 'var(--text-dim)' }}>Formato de fecha</span>
            <span style={{ fontWeight: 600 }}>{formatSettings.date_format}</span>
          </p>
          <p style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ color: 'var(--text-dim)' }}>Formato de hora</span>
            <span style={{ fontWeight: 600 }}>{formatSettings.time_format}</span>
          </p>
          <p style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ color: 'var(--text-dim)' }}>Primer dia de semana</span>
            <span style={{ fontWeight: 600 }}>
              {['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'][formatSettings.first_day_of_week] || formatSettings.first_day_of_week}
            </span>
          </p>
          <p style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ color: 'var(--text-dim)' }}>Zona horaria</span>
            <span style={{ fontWeight: 600 }}>{formatSettings.timezone}</span>
          </p>
        </div>
      </div>

      {/* Apertura/Cierre de Turno - protegido con PIN */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 8 }}>TURNO</h3>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
          Ver estado del turno, abrir o cerrar. Protegido con PIN.
        </p>
        {!showShiftAccess ? (
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => { setShowShiftAccess(true); setShiftPin(''); setError('') }}>
            📊 Ver Estado del Turno
          </button>
        ) : (
          <div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
              {storage.get('shiftPin') ? 'Ingresa tu PIN de turno:' : 'Crea un PIN de 4 digitos para el turno:'}
            </p>
            <input
              type="password"
              placeholder="PIN (4 digitos)"
              value={shiftPin}
              onChange={(e) => setShiftPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              style={{
                width: '100%', padding: 14, borderRadius: 12, marginBottom: 12,
                background: 'var(--card-light)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 16, textAlign: 'center', fontFamily: 'monospace'
              }}
            />
            {error && <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 8 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleShiftPinSubmit} disabled={shiftPin.length !== 4}>
                Acceder
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowShiftAccess(false); setShiftPin(''); setError('') }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bloquear / Desbloquear */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 8 }}>BLOQUEO LOCAL</h3>

        {blockStep === 'idle' && (
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => setBlockStep('enter_code')}>
            🔒 Bloquear Terminal
          </button>
        )}

        {blockStep === 'enter_code' && (
          <div>
            <input
              type="password"
              placeholder="Codigo de bloqueo (min 4 digitos)"
              value={blockCode}
              onChange={(e) => setBlockCode(e.target.value)}
              style={{
                width: '100%', padding: 14, borderRadius: 12, marginBottom: 12,
                background: 'var(--card-light)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 16, textAlign: 'center', fontFamily: 'monospace'
              }}
            />
            {error && <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 8 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleBlock}>
                Bloquear
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setBlockStep('idle'); setBlockCode(''); setError('') }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {blockStep === 'blocked' && (
          <div>
            <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>
              🔒 Terminal bloqueado. Ingresa tu codigo para desbloquear.
            </p>
            <input
              type="password"
              placeholder="Codigo de desbloqueo"
              value={blockCode}
              onChange={(e) => setBlockCode(e.target.value)}
              style={{
                width: '100%', padding: 14, borderRadius: 12, marginBottom: 12,
                background: 'var(--card-light)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 16, textAlign: 'center', fontFamily: 'monospace'
              }}
            />
            {error && <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 8 }}>{error}</p>}
            <button className="btn btn-success" style={{ width: '100%' }} onClick={handleUnblock}>
              🔓 Desbloquear
            </button>
          </div>
        )}
      </div>

      {/* Crypto Keys */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, color: 'var(--text-dim)' }}>CLAVES CRIPTOGRAFICAS</h3>
          <button
            onClick={() => setShowKeys(!showKeys)}
            style={{ background: 'var(--card-light)', borderRadius: 8, padding: '4px 12px', color: 'var(--text)', fontSize: 12 }}
          >
            {showKeys ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        {showKeys && (
          <div style={{ fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', color: 'var(--text-dim)' }}>
            <p style={{ marginBottom: 8 }}><strong>Publica:</strong><br />{publicKey}</p>
            <p style={{ marginBottom: 8 }}><strong>Servidor:</strong><br />{serverPublicKey}</p>
          </div>
        )}
        {!showKeys && (
          <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>••••••••••••••••</p>
        )}
      </div>

      {/* Install as PWA */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 8 }}>INSTALAR APP</h3>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
          Puedes instalar este POS como una aplicacion en tu telefono o PC.
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          📱 Android: Menu del navegador → "Instalar app"<br />
          🖥 PC: Icono de instalar en la barra de direcciones
        </p>
      </div>

      {/* Danger zone */}
      <div className="card" style={{ marginBottom: 12, border: '1px solid var(--danger)' }}>
        <h3 style={{ fontSize: 14, color: 'var(--danger)', marginBottom: 8 }}>ZONA PELIGROSA</h3>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
          Resetear elimina todas las claves y configuracion de este dispositivo.
          Tendras que registrar el terminal de nuevo con el administrador.
        </p>
        {!confirmReset ? (
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => setConfirmReset(true)}>
            Resetear Terminal
          </button>
        ) : (
          <div>
            <p style={{ fontSize: 14, color: 'var(--danger)', marginBottom: 8 }}>
              ¿Seguro? Se eliminaran todas las claves.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleReset}>
                Si, resetear
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmReset(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Logout */}
      <button className="btn btn-secondary" style={{ marginTop: 'auto' }} onClick={onLogout}>
        Cerrar Sesion
      </button>
    </div>
  )
}
