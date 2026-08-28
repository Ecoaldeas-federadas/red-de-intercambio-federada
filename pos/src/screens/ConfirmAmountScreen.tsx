import { API } from '../api'

interface Props {
  amount: number
  onBack: () => void
  onShowQR: (token: string) => void
  onShowNFC: () => void
  api: API
  sessionToken: string | null
}

export function ConfirmAmountScreen({ amount, onBack, onShowQR, onShowNFC, api, sessionToken }: Props) {
  // Formatear como decimal: el amount esta en centimos
  const formatAmount = (cents: number) => {
    const units = Math.floor(cents / 100)
    const dec = (cents % 100).toString().padStart(2, '0')
    return `${units.toLocaleString('es')}.${dec}`
  }

  const handleQR = async () => {
    if (sessionToken) {
      try {
        await api.setSessionAmount(sessionToken, amount)
      } catch {}
    }
    try {
      const charge = await api.createCharge(amount)
      onShowQR(charge.charge_id || charge.token)
    } catch (e: any) {
      alert('Error al crear cargo: ' + e.message)
    }
  }

  const handleNFC = async () => {
    if (sessionToken) {
      try {
        await api.setSessionAmount(sessionToken, amount)
      } catch {}
    }
    onShowNFC()
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24, maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: 'var(--card)', borderRadius: 10, padding: 10, color: 'var(--text)', fontSize: 20 }}>
          ←
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Confirmar Monto</h2>
        <div style={{ width: 44 }} />
      </div>

      {/* Monto grande */}
      <div className="card" style={{ width: '100%', textAlign: 'center', marginBottom: 32, padding: 32 }}>
        <div style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 8 }}>MONTO A COBRAR</div>
        <div style={{ fontSize: 56, fontWeight: 800, color: 'var(--accent-light)' }}>
          {formatAmount(amount)}
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: 20, marginTop: 4 }}>TQ</div>
      </div>

      <p style={{ color: 'var(--text-dim)', fontSize: 14, textAlign: 'center', marginBottom: 32 }}>
        Seleccione el metodo de pago
      </p>

      {/* Botones de metodo de pago */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, marginTop: 'auto' }}>
        <button
          className="btn btn-primary"
          style={{ fontSize: 20, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}
          onClick={handleNFC}
        >
          📱 Pagar con NFC
        </button>
        <button
          className="btn btn-secondary"
          style={{ fontSize: 20, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}
          onClick={handleQR}
        >
          📲 Pagar con QR
        </button>
      </div>
    </div>
  )
}
