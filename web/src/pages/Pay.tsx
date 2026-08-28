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
//     a quien pago, monto, saldo despues de pagar, topes. Boton "Confirmar y Pagar".
//  4. Resultado: exito (con nuevo saldo) o error.
//
// Filosofia moneda cero (LETS / Credito Mutuo):
//  - Saldo negativo = deuda con la comunidad (debes aportar). NO es algo malo.
//  - Saldo positivo = la comunidad te debe (puedes recibir). Tampoco es malo.
//  - Ambos saldos son igualmente validos. No hay rojo/verde.
//  - Tope negativo (credit_limit): al tocarlo, debes aportar para recibir nuevamente.
//  - Tope positivo (debit_limit): al tocarlo, debes recibir para poder pagar nuevamente.
//  - La advertencia sale cuando te ACERCAS a cualquier tope, no por ser negativo.
//  - No existe "saldo insuficiente"; existe "llegaste al tope de tu credito comunitario".
//
// IMPORTANTE: El sistema almacena montos en CENTAVOS internamente.
// 1.00 TQ = 100 centavos. Para mostrar, dividir por 100.

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

// Convierte centavos (int64 interno) a string TQ con 2 decimales.
// Ej: 100 -> "1,00"  |  -50000 -> "-500,00"  |  1250 -> "12,50"
const fmtTQ = (centavos: number): string => {
  const tq = centavos / 100
  return tq.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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

  // Formatear saldo con filosofia moneda cero.
  // NO usar rojo/verde: ambos saldos (positivo y negativo) son igualmente validos.
  // Solo indicar el significado en texto neutro.
  const renderBalance = (balanceCentavos: number, label: string) => {
    const tag = balanceCentavos < 0
      ? 'deuda con la comunidad (debes aportar)'
      : balanceCentavos > 0
        ? 'a favor de la comunidad (puedes recibir)'
        : 'balance en cero'
    return (
      <div>
        <p style={{ color: '#a0a0a0', fontSize: 13, marginBottom: 4 }}>{label}</p>
        <p style={{ fontSize: 28, fontWeight: 800, color: '#e0e0e0' }}>
          {balanceCentavos < 0 ? '-' : ''}{fmtTQ(Math.abs(balanceCentavos))} TQ
        </p>
        <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{tag}</p>
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
          <p style={{ fontSize: 20, marginBottom: 4 }}>{fmtTQ(charge?.amount || 0)} TQ</p>
          <p style={{ color: '#a0a0a0', marginBottom: 24 }}>Pago realizado con exito</p>
          {newBalance !== null && (
            <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 24 }}>
              <p style={{ color: '#a0a0a0', fontSize: 13, marginBottom: 4 }}>Tu saldo actual</p>
              <p style={{ fontSize: 24, fontWeight: 800, color: '#e0e0e0' }}>
                {newBalance < 0 ? '-' : ''}{fmtTQ(Math.abs(newBalance))} TQ
              </p>
              <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                {newBalance < 0 ? 'deuda con la comunidad (debes aportar)' : newBalance > 0 ? 'a favor de la comunidad (puedes recibir)' : 'balance en cero'}
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
                {fmtTQ(charge?.amount || 0)} TQ
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
  const amountCentavos = charge?.amount || 0
  const balanceAfter = me ? me.balance - amountCentavos : 0

  // Filosofia moneda cero: la advertencia sale cuando te ACERCAS a cualquier tope.
  // No por ser negativo, sino por estar cerca del limite (positivo o negativo).
  // Umbral: 90% del camino hacia el tope.
  const creditLimit = me?.credit_limit ?? 0   // tope negativo (ej: -500000 = -5000.00 TQ)
  const debitLimit = me?.debit_limit ?? 0     // tope positivo (ej: 500000 = 5000.00 TQ)

  // Distancia al tope negativo: cuanto credito me queda antes de llegar al piso.
  // Si balance = -100 y credit_limit = -5000, me quedan 4900 antes del tope.
  const remainingCredit = creditLimit - me.balance  // negativo = me queda credito
  const remainingDebit = debitLimit - me.balance     // positivo = me queda para el tope positivo

  // Porcentaje del limite usado (0% = balance en cero, 100% = en el tope)
  const creditUsedPct = creditLimit < 0 ? Math.max(0, Math.min(100, (me.balance / creditLimit) * 100)) : 0
  const debitUsedPct = debitLimit > 0 ? Math.max(0, Math.min(100, (me.balance / debitLimit) * 100)) : 0

  // Proyectado despues del pago
  const creditUsedAfterPct = creditLimit < 0 ? Math.max(0, Math.min(100, (balanceAfter / creditLimit) * 100)) : 0
  const debitUsedAfterPct = debitLimit > 0 ? Math.max(0, Math.min(100, (balanceAfter / debitLimit) * 100)) : 0

  // Advertencia si despues del pago estaria al 90%+ de cualquier tope
  const nearCreditLimit = creditUsedAfterPct >= 90
  const nearDebitLimit = debitUsedAfterPct >= 90
  // Bloqueo si despues del pago pasaria el tope
  const exceedsCreditLimit = creditLimit < 0 && balanceAfter < creditLimit
  const exceedsDebitLimit = debitLimit > 0 && balanceAfter > debitLimit

  const blocked = exceedsCreditLimit || exceedsDebitLimit

  let warningMsg = ''
  if (exceedsCreditLimit) {
    warningMsg = `Este pago te llevaria a ${fmtTQ(balanceAfter)} TQ, por debajo de tu tope de credito comunitario (${fmtTQ(creditLimit)} TQ). Debes aportar a la comunidad (bienes o trabajo) para poder pagar nuevamente.`
  } else if (exceedsDebitLimit) {
    warningMsg = `Este pago te llevaria a ${fmtTQ(balanceAfter)} TQ, por encima de tu tope de debito (${fmtTQ(debitLimit)} TQ). Debes recibir de la comunidad para poder pagar nuevamente.`
  } else if (nearCreditLimit) {
    warningMsg = `Atencion: despues de este pago estarias al ${Math.round(creditUsedAfterPct)}% de tu tope de credito comunitario (${fmtTQ(creditLimit)} TQ).`
  } else if (nearDebitLimit) {
    warningMsg = `Atencion: despues de este pago estarias al ${Math.round(debitUsedAfterPct)}% de tu tope de debito (${fmtTQ(debitLimit)} TQ).`
  }

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
            {fmtTQ(amountCentavos)} TQ
          </p>
        </div>

        {/* Quien paga y a quien - AMBOS visibles */}
        <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#a0a0a0', fontSize: 14 }}>Pagas a (vendedor)</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{charge?.merchant_name || 'POS'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#a0a0a0', fontSize: 14 }}>Tu cuenta (comprador)</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>@{me?.username || username}</span>
          </div>
          {me?.display_name && me.display_name !== me.username && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: '#a0a0a0', fontSize: 14 }}>Nombre</span>
              <span style={{ fontSize: 14 }}>{me.display_name}</span>
            </div>
          )}
          {charge?.description && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#a0a0a0', fontSize: 14 }}>Concepto</span>
              <span style={{ fontSize: 14 }}>{charge.description}</span>
            </div>
          )}
        </div>

        {/* Saldos con filosofia moneda cero - sin rojo/verde */}
        {me && (
          <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              {renderBalance(me.balance, 'TU SALDO ACTUAL')}
            </div>
            <div style={{ borderTop: '1px solid #333', paddingTop: 16, marginBottom: 16 }}>
              {renderBalance(balanceAfter, 'SALDO DESPUES DE PAGAR')}
            </div>
            {/* Topes comunitarios */}
            <div style={{ borderTop: '1px solid #333', paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#a0a0a0', fontSize: 12 }}>Tu tope de credito (piso)</span>
                <span style={{ fontSize: 12, color: '#888' }}>{fmtTQ(creditLimit)} TQ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a0a0a0', fontSize: 12 }}>Tu tope de debito (techo)</span>
                <span style={{ fontSize: 12, color: '#888' }}>{fmtTQ(debitLimit)} TQ</span>
              </div>
            </div>
          </div>
        )}

        {/* Advertencia solo al acercarse a cualquier tope */}
        {warningMsg && (
          <div style={{
            background: blocked ? 'rgba(220,38,38,0.15)' : 'rgba(217,119,6,0.15)',
            color: blocked ? '#dc2626' : '#d97706',
            padding: 14, borderRadius: 12, marginBottom: 16, fontSize: 13, fontWeight: 600,
          }}>
            {blocked ? '⛔ ' : '⚠️ '}{warningMsg}
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626', padding: 12, borderRadius: 12, marginBottom: 16, fontSize: 14 }}>
            {error}
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={status === 'paying' || blocked}
          style={{
            width: '100%', padding: 20, borderRadius: 12,
            background: blocked ? '#333' : '#0f766e', color: 'white', border: 'none',
            fontSize: 18, fontWeight: 700, cursor: blocked ? 'not-allowed' : 'pointer',
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
