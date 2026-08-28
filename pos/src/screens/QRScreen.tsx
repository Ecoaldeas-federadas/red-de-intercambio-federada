import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { API } from '../api'

interface Props {
  amount: number
  qrToken: string | null
  apiURL: string
  onBack: () => void
  onPaid: () => void
  api: API
  terminalID: string | null
}

export function QRScreen({ amount, qrToken, apiURL, onBack, onPaid, api, terminalID }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [status, setStatus] = useState<'waiting' | 'paid' | 'expired'>('waiting')
  const [countdown, setCountdown] = useState(600) // 10 minutes
  const pollRef = useRef<any>(null)

  // Formatear como decimal: el amount esta en centimos
  const formatAmount = (cents: number) => {
    const units = Math.floor(cents / 100)
    const dec = (cents % 100).toString().padStart(2, '0')
    return `${units.toLocaleString('es')}.${dec}`
  }

  // Build the payment URL that the customer will scan
  // Format: {apiURL}/pay?t={token}
  // The /pay page is served by the main frontend and handles login + payment
  const payURL = qrToken ? `${apiURL}/pay?t=${qrToken}` : ''

  useEffect(() => {
    if (payURL) {
      QRCode.toDataURL(payURL, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
        .then(setQrDataUrl)
        .catch(() => {})
    }
  }, [payURL])

  // Poll for payment status - consulta al backend si el cargo fue pagado
  useEffect(() => {
    if (!qrToken) return

    const poll = async () => {
      try {
        // Consultar el estado del cargo en el backend
        const status = await api.getChargeStatus(qrToken)
        if (status.status === 'paid') {
          setStatus('paid')
          clearInterval(pollRef.current)
          setTimeout(onPaid, 2000)
        } else if (status.status === 'expired' || status.status === 'cancelled') {
          setStatus('expired')
          clearInterval(pollRef.current)
        }
      } catch {}
    }

    pollRef.current = setInterval(poll, 2000)
    return () => clearInterval(pollRef.current)
  }, [qrToken])

  // Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setStatus('expired')
          clearInterval(pollRef.current)
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24, maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: 'var(--card)', borderRadius: 10, padding: 10, color: 'var(--text)', fontSize: 20 }}>
          ←
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Codigo QR de Pago</h2>
        <div style={{ width: 44 }} />
      </div>

      {/* Amount */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>Monto a cobrar</div>
        <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--accent-light)' }}>
          {formatAmount(amount)} TQ
        </div>
      </div>

      {/* QR Code */}
      {status === 'waiting' && (
        <div className="fade-in" style={{ width: '100%', maxWidth: 360 }}>
          <div className="qr-container" style={{ marginBottom: 16 }}>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR de pago" style={{ width: '100%', maxWidth: 320 }} />
            ) : (
              <div style={{ width: 320, height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                Generando QR...
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 4 }}>
              El cliente escanea este codigo con la camara de su celular
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
              Lo lleva a la pagina de pago donde inicia sesion y acepta
            </p>
          </div>

          {/* Countdown */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <span className="status-badge status-pending pulse">
              ⏱ Expira en {mins}:{secs.toString().padStart(2, '0')}
            </span>
          </div>

          <button className="btn btn-danger" style={{ width: '100%' }} onClick={onBack}>
            Cancelar
          </button>
        </div>
      )}

      {/* Paid */}
      {status === 'paid' && (
        <div className="fade-in" style={{ textAlign: 'center', marginTop: 60 }}>
          <div style={{ fontSize: 80, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)', marginBottom: 8 }}>Pago Recibido</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 18, marginBottom: 4 }}>
            {formatAmount(amount)} TQ
          </p>
          <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>Redirigiendo...</p>
        </div>
      )}

      {/* Expired */}
      {status === 'expired' && (
        <div className="fade-in" style={{ textAlign: 'center', marginTop: 60 }}>
          <div style={{ fontSize: 80, marginBottom: 16 }}>⏰</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--danger)', marginBottom: 8 }}>QR Expirado</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24 }}>
            El codigo QR ha expirado. Genera uno nuevo.
          </p>
          <button className="btn btn-primary" style={{ width: '100%', maxWidth: 300 }} onClick={onBack}>
            Volver
          </button>
        </div>
      )}
    </div>
  )
}
