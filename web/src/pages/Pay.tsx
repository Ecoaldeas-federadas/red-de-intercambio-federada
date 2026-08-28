import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../hooks/useAuth'
import Login from './Login'
// Login se usa cuando no hay sesion; despues del login el usuario vuelve a /pay

// Esta pagina la ve el cliente cuando escanea el QR del POS
// URL: /pay?t={token}
// El token es un charge_token registrado en el backend.
//
// Flujo de 4 pantallas (filosofia moneda cero / trueque):
//  1. Info del cargo (sin login): monto, comerciante, concepto. Boton "Continuar".
//  2. Login inline (si no autenticado): tras login, reload vuelve a /pay?t=...
//  3. Confirmacion (autenticado): quien soy, mi saldo (con signo moneda cero),
//     a quien pago, monto, saldo despues de pagar. Boton "Confirmar y Pagar".
//  4. Resultado: exito (con nuevo saldo) o error.
//
// Filosofia moneda cero (LETS / Credito Mutuo):
//  - Saldo negativo = deuda con la comunidad (debes aportar).
//  - Saldo positivo = la comunidad te debe (puedes recibir).
//  - Tope negativo (credit_limit): al tocarlo, debes aportar para recibir nuevamente.
//  - No existe "saldo insuficiente"; existe "llegaste al tope de tu credito comunitario".

type ChargeInfo = {
  amount: number
  status: string
  description?: string
  merchant_name?: string
  expires_at?: string
}

type MeInfo = {
  username: string
  display_name?: string
  balance: number
  credit_limit: number
  debit_limit: number
}

type PayStatus = 'loading' | 'ready' | 'needLogin' | 'confirming' | 'paying' | 'paid' | 'error'

export default function Pay() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('t') || ''
  const navigate = useNavigate()
  const { username, isAuthenticated } = useAuth()

  const [charge, setCharge] = useState<ChargeInfo | null>(null)
  const [me, setMe] = useState<MeInfo | null>(null)
  const [status, setStatus] = useState<PayStatus>('loading')
  const [error, setError] = useState('')
  const [newBalance, setNewBalance] = useState<number | null>(null)

  // --- Pantalla 1: cargar info del cargo (publico, sin login) ---
  useEffect(() => {
    if (!token) {
      setError('Codigo QR invalido')
      setStatus('error')
      return
    }

    api.get<ChargeInfo>(`/pos/charge/${token}/info`)
      .then((data) => {
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
        // Si ya esta autenticado, ir directo a confirmacion.
        // Si no, mostrar la info del cargo primero (pantalla 1).
        setStatus(isAuthenticated ? 'confirming' : 'ready')
      })
      .catch((e) => {
        setError(e.message || 'No se pudo leer el codigo QR')
        setStatus('error')
      })
  }, [token, isAuthenticated])

  // --- Pantalla 3: cargar datos del pagador (/auth/me) ---
  useEffect(() => {
    if (status !== 'confirming' || !isAuthenticated) return
    if (me) return // ya cargado
    api.get<MeInfo>('/auth/me')
      .then((data) => setMe(data))
      .catch((e) => {
        setError(e.message || 'No se pudo obtener tu cuenta')
        setStatus('error')
      })
  }, [status, isAuthenticated, me])

  const handleContinue = () => {
    if (!isAuthenticated) {
      setStatus('needLogin')
    } else {
      setStatus('confirming')
    }
  }

  const handlePay = async () => {
    if (!charge) return
    setStatus('paying')
    setError('')

    try {
      const result = await api.post<{ status: string; new_balance: number; amount: number }>(
        `/pos/charge/${token}/pay`,
        { payment_method: 'qr' }
      )
      setNewBalance(result.new_balance)
      setStatus('paid')
    } catch (e: any) {
      setError(e.message || 'Error al procesar el pago')
      setStatus('error')
    }
  }

  // --- Render helpers ---

  const fmt = (n: number) => n.toLocaleString('es')

  // Formatear saldo con filosofia moneda cero
  const renderBalance = (balance: number, label: string) => {
    const isDebt = balance < 0
    const color = isDebt ? '#ef4444' : '#14b8a6'
    const tag = isDebt ? 'en deuda con la comunidad' : 'a favor de la comunidad'
    return (
      <div>
        <p style={{ color: '#a0a0a0', fontSize: 13, marginBottom: 4 }}>{label}</p>
        <p style={{ fontSize: 28, fontWeight: 800, color }}>
          {balance < 0 ? '-' : ''}{fmt(Math.abs(balance))} TQ
        </p>
        <p style={{ fontSize: 12, color, marginTop: 2 }}>{tag}</p>
      </div>
    )
  }

  // --- Pantalla 2: login inline ---
  if (status === 'needLogin') {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
        <Login />
      </div>
    )
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
          {newBalance !== null && (
            <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 24 }}>
              <p style={{ color: '#a0a0a0', fontSize: 13, marginBottom: 4 }}>Tu saldo actual</p>
              <p style={{ fontSize: 24, fontWeight: 800, color: newBalance < 0 ? '#ef4444' : '#14b8a6' }}>
                {newBalance < 0 ? '-' : ''}{fmt(Math.abs(newBalance))} TQ
              </p>
              <p style={{ fontSize: 12, color: newBalance < 0 ? '#ef4444' : '#14b8a6', marginTop: 2 }}>
                {newBalance < 0 ? 'en deuda con la comunidad' : 'a favor de la comunidad'}
              </p>
            </div>
          )}
          <button onClick={() => navigate('/app/wallet')} style={{ padding: '14px 24px', borderRadius: 12, background: '#0f766e', color: 'white', border: 'none', fontSize: 16, fontWeight: 600 }}>
            Ver mi billetera
          </button>
        </div>
      </div>
    )
  }

  // --- Pantalla 1: info del cargo (sin login) ---
  if (status === 'ready') {
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
            </div>
          </div>

          <button
            onClick={handleContinue}
            style={{
              width: '100%', padding: 20, borderRadius: 12,
              background: '#0f766e', color: 'white', border: 'none',
              fontSize: 18, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Continuar
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

  // --- Pantalla 3: confirmacion (autenticado) ---
  const balanceAfter = me ? me.balance - (charge?.amount || 0) : 0
  const wouldExceedLimit = me ? balanceAfter < me.credit_limit : false

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: 'white', padding: 24 }}>
      <div style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Confirmar Pago</h1>
        </div>

        {/* Monto a pagar */}
        <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 20, marginBottom: 16, textAlign: 'center' }}>
          <p style={{ color: '#a0a0a0', fontSize: 13, marginBottom: 4 }}>MONTO A PAGAR</p>
          <p style={{ fontSize: 40, fontWeight: 800, color: '#14b8a6' }}>
            {charge?.amount?.toLocaleString('es')} TQ
          </p>
        </div>

        {/* Quien paga y a quien */}
        <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#a0a0a0', fontSize: 14 }}>Pagas a</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{charge?.merchant_name || 'POS'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#a0a0a0', fontSize: 14 }}>Tu cuenta</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>@{me?.username || username}</span>
          </div>
          {charge?.description && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#a0a0a0', fontSize: 14 }}>Concepto</span>
              <span style={{ fontSize: 14 }}>{charge.description}</span>
            </div>
          )}
        </div>

        {/* Saldos con filosofia moneda cero */}
        {me && (
          <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              {renderBalance(me.balance, 'TU SALDO ACTUAL')}
            </div>
            <div style={{ borderTop: '1px solid #333', paddingTop: 16 }}>
              {renderBalance(balanceAfter, 'SALDO DESPUES DE PAGAR')}
            </div>
          </div>
        )}

        {/* Advertencia si se acerca al tope */}
        {wouldExceedLimit && (
          <div style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: 14, borderRadius: 12, marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
            ⚠️ Este pago excede tu tope de crédito comunitario ({me?.credit_limit} TQ). Debes aportar a la comunidad para poder recibir nuevamente.
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626', padding: 12, borderRadius: 12, marginBottom: 16, fontSize: 14 }}>
            {error}
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={status === 'paying' || wouldExceedLimit}
          style={{
            width: '100%', padding: 20, borderRadius: 12,
            background: wouldExceedLimit ? '#333' : '#0f766e', color: 'white', border: 'none',
            fontSize: 18, fontWeight: 700, cursor: wouldExceedLimit ? 'not-allowed' : 'pointer',
            opacity: status === 'paying' ? 0.5 : 1,
          }}
        >
          {status === 'paying' ? 'Procesando...' : '✓ Confirmar y Pagar'}
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
