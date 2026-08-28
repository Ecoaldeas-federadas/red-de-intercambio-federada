import { useState } from 'react'
import { API } from '../api'
import { storage } from '../crypto'

interface Props {
  onLogin?: (user: any) => void
  onURLSet?: () => void
  onSessionExpired?: () => void // Cuando la sesion web expiro
  api: API
  skipURL?: boolean // Si true, solo mostrar login (URL ya configurada)
}

export function LoginScreen({ onLogin, onURLSet, onSessionExpired, api, skipURL }: Props) {
  const [step, setStep] = useState<string>(skipURL ? 'login' : 'url')
  const [apiURL, setApiURL] = useState(storage.get('apiURL') || '')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSetURL = () => {
    if (!apiURL.trim()) {
      setError('Ingresa la URL del nodo')
      return
    }
    api.setBaseURL(apiURL.trim())
    setError('')
    if (onURLSet) {
      onURLSet()
    } else {
      setStep('login')
    }
  }

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const data = await api.login(username, password)
      if (data.token) {
        if (onLogin) {
          onLogin(data.user || { username })
        }
      } else {
        setError('No se recibio token de autenticacion')
      }
    } catch (e: any) {
      const errMsg = e?.message || ''
      if (errMsg.includes('web_session_expired') && onSessionExpired) {
        storage.delete('sessionToken')
        storage.delete('merchantToken')
        storage.delete('merchantUser')
        onSessionExpired()
        return
      }
      setError(e.message || 'Error al iniciar sesion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32, position: 'relative' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🛒</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>POS Federada</h1>
        <p style={{ color: 'var(--text-dim)', marginTop: 4 }}>Punto de Venta Web</p>
        {step === 'login' && (
          <button
            onClick={() => setStep('url')}
            title="Cambiar URL del nodo"
            style={{
              position: 'absolute', top: 0, right: 0,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 22, opacity: 0.6, padding: 8,
            }}
          >
            ⚙️
          </button>
        )}
      </div>

      {step === 'url' && (
        <div className="card fade-in">
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Configuracion del Nodo</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 16 }}>
            Ingresa la direccion del nodo al que te vas a conectar.
          </p>
          <input
            type="url"
            placeholder="https://mi-nodo.com o http://192.168.1.100:8080"
            value={apiURL}
            onChange={(e) => setApiURL(e.target.value)}
            style={{
              width: '100%', padding: 14, borderRadius: 12,
              background: 'var(--card-light)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 16
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSetURL()}
          />
          {error && <p style={{ color: 'var(--danger)', fontSize: 14, marginTop: 8 }}>{error}</p>}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={handleSetURL}>
            Continuar
          </button>
          {storage.get('apiURL') && (
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={() => { api.setBaseURL(storage.get('apiURL')!); if (onURLSet) onURLSet() }}>
              Usar URL guardada: {storage.get('apiURL')}
            </button>
          )}
        </div>
      )}

      {step === 'login' && (
        <div className="card fade-in">
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Iniciar Sesion</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 16 }}>
            Conectado a: <strong>{api.getBaseURL()}</strong>
          </p>
          <div>
            <input
              type="text"
              placeholder="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              style={{
                width: '100%', padding: 14, borderRadius: 12, marginBottom: 12,
                background: 'var(--card-light)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 16
              }}
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              style={{
                width: '100%', padding: 14, borderRadius: 12,
                background: 'var(--card-light)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 16
              }}
            />
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: 14, marginTop: 8 }}>{error}</p>}
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 16 }}
            onClick={handleLogin}
            disabled={loading || !username || !password}
          >
            {loading ? 'Conectando...' : 'Entrar'}
          </button>
        </div>
      )}
    </div>
  )
}
