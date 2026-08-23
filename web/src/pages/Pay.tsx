import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../hooks/useAuth'
import Login from './Login'
// Login se usa cuando no hay sesion; despues del login el usuario vuelve a /pay

// Esta pagina la ve el cliente cuando escanea el QR del POS
// URL: /pay?t={token}
export default function Pay() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('t') || ''
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  const [charge, setCharge] = useState<any>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'paying' | 'paid' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setError('Codigo QR invalido')
      setStatus('error')
      return
    }

    // Decode the token (base64 JSON)
    try {
      const decoded = JSON.parse(atob(token))
      setCharge({
        terminal_id: decoded.t,
        amount: decoded.a,
        timestamp: decoded.ts,
      })
      setStatus('ready')
    } catch {
      setError('No se pudo leer el codigo QR')
      setStatus('error')
    }
  }, [token])

  const handlePay = async () => {
    if (!charge) return
    setStatus('paying')
    setError('')

    try {
      // Realizar transferencia al merchant del terminal
      // Primero necesitamos saber quien es el merchant
      const termStatus = await api.get(`/api/nfc/terminal/${charge.terminal_id}/status`)

      if (!termStatus || !termStatus.merchant_user_id) {
        throw new Error('No se pudo identificar el comerciante')
      }

      // Transferir al merchant
      await api.post('/api/transfer', {
        receiver_id: termStatus.merchant_user_id,
        amount: charge.amount,
        description: `Pago POS - Terminal ${charge.terminal_id}`,
      })

      setStatus('paid')
    } catch (e: any) {
      setError(e.message || 'Error al procesar el pago')
      setStatus('error')
    }
  }

  // Si no esta autenticado, mostrar login
  if (!isAuthenticated) {
    return <Login />
  }

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48 }} className="pulse">⏳</div>
          <p style={{ marginTop: 16 }}>Cargando pago...</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: 'white' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 24 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>❌</div>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Error</h1>
          <p style={{ color: '#a0a0a0', marginBottom: 24 }}>{error}</p>
          <button onClick={() => navigate('/app/dashboard')} style={{ padding: '14px 24px', borderRadius: 12, background: '#0f766e', color: 'white', border: 'none', fontSize: 16, fontWeight: 600 }}>
            Ir al inicio
          </button>
        </div>
      </div>
    )
  }

  if (status === 'paid') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: 'white' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 24 }}>
          <div style={{ fontSize: 80, marginBottom: 16 }}>✅</div>
          <h1 style={{ fontSize: 28, color: '#16a34a', marginBottom: 8 }}>Pago Completado</h1>
          <p style={{ fontSize: 20, marginBottom: 4 }}>{charge.amount.toLocaleString('es')} TQ</p>
          <p style={{ color: '#a0a0a0', marginBottom: 24 }}>Pago realizado con exito</p>
          <button onClick={() => navigate('/app/wallet')} style={{ padding: '14px 24px', borderRadius: 12, background: '#0f766e', color: 'white', border: 'none', fontSize: 16, fontWeight: 600 }}>
            Ver mi billetera
          </button>
        </div>
      </div>
    )
  }

  // Ready to pay
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: 'white', padding: 24 }}>
      <div style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🛒</div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Pago POS</h1>
        </div>

        <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <p style={{ color: '#a0a0a0', fontSize: 14, marginBottom: 4 }}>MONTO A PAGAR</p>
            <p style={{ fontSize: 48, fontWeight: 800, color: '#14b8a6' }}>
              {charge.amount.toLocaleString('es')} TQ
            </p>
          </div>

          <div style={{ borderTop: '1px solid #333', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#a0a0a0', fontSize: 14 }}>Terminal</span>
              <span style={{ fontSize: 14, fontFamily: 'monospace' }}>{charge.terminal_id?.slice(0, 16)}...</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#a0a0a0', fontSize: 14 }}>Tu cuenta</span>
              <span style={{ fontSize: 14 }}>@{user?.username}</span>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626', padding: 12, borderRadius: 12, marginBottom: 16, fontSize: 14 }}>
            {error}
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={status === 'paying'}
          style={{
            width: '100%', padding: 20, borderRadius: 12,
            background: '#0f766e', color: 'white', border: 'none',
            fontSize: 18, fontWeight: 700, cursor: 'pointer',
            opacity: status === 'paying' ? 0.5 : 1,
          }}
        >
          {status === 'paying' ? 'Procesando...' : '✓ Aceptar y Pagar'}
        </button>

        <button
          onClick={() => navigate('/app/dashboard')}
          style={{
            width: '100%', padding: 14, borderRadius: 12, marginTop: 12,
            background: 'transparent', color: '#a0a0a0', border: 'none',
            fontSize: 14, cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
