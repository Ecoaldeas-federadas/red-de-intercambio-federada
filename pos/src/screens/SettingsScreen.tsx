import { useState } from 'react'
import { API } from '../api'
import { storage } from '../crypto'

interface Props {
  onBack: () => void
  onLogout: () => void
  api: API
  terminalID: string | null
  merchantUser: any
}

export function SettingsScreen({ onBack, onLogout, api, terminalID, merchantUser }: Props) {
  const [showKeys, setShowKeys] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const publicKey = storage.get('publicKey')
  const serverPublicKey = storage.get('serverPublicKey')
  const apiURL = api.getBaseURL()

  const handleReset = () => {
    storage.clear()
    onLogout()
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
          Tendras que registrar el terminal de nuevo.
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
