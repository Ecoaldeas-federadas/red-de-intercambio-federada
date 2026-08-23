import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../hooks/useAuth'
import Login from './Login'
// Login se usa cuando no hay sesion; despues del login el usuario vuelve a /pay

// Esta pagina la ve el cliente cuando escanea el QR del POS
// URL: /pay?t={token}
// El token es un charge_token registrado en el backend.
// El cliente ve el monto primero (sin login), luego inicia sesion y acepta pagar.
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

    // Consultar el cargo al backend (no requiere login - el cliente ve el monto primero)
    api.get(`/api/pos/charge/${token}/info`)
      .then((data: any) => {
        if (data.status === 'expired') {
          setError('Este codigo QR ha expirado')
          setStatus('error')
          return
        }
        if (data.status === 'paid') {
          setError('Este pago ya fue realizado')
          setStatus('error')
          return
        }
        if (data.status === 'cancelled') {
          setError('Este pago fue cancelado')
          setStatus('error')
          return
        }
        setCharge(data)
        setStatus('ready')
      })
      .catch((e: any) => {
        setError(e.message || 'No se pudo leer el codigo QR')
        setStatus('error')
      })
  }, [token])

  const handlePay = async () => {
    if (!charge) return
    setStatus('paying')
    setError('')

    try {
      // Confirmar el pago en el backend
      // El backend debita del pagador y acredita al merchant atomicamente
      const result = await api.post(`/api/pos/charge/${token}/pay`, {
        payment_method: 'qr',
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
          <p style={{ fontSize: 20, marginBottom: 4 }}>{charge?.amount?.toLocaleString('es')} TQ</p>
          <p style={{ color: '#a0a0a0', marginBottom: 24 }}>Pago realizado con exito</p>
          <button onClick={() => navigate('/app/wallet')} style={{ padding: '14px 24px', borderRadius: 12, background: '#0f766e', color: 'white', border: 'none', fontSize: 16, fontWeight: 600 }}>
            Ver mi billetera
          </button>
        </div>
      </div>
    )
  }

  // Ready to pay - mostrar monto y boton de aceptar
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
              {charge?.amount?.toLocaleString('es')} TQ
            </p>
          </div>

          <div style={{ borderTop: '1px solid #333', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#a0a0a0', fontSize: 14 }}>Comerciante</span>
              <span style={{ fontSize: 14 }}>{charge?.merchant_name || 'POS'}</span>
            </div>
            {charge?.description && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#a0a0a0', fontSize: 14 }}>Concepto</span>
                <span style={{ fontSize: 14 }}>{charge.description}</span>
              </div>
            )}
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
