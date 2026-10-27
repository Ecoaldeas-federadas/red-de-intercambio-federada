import { API } from '../api'
import { fmtTQ } from '../utils/format'
import { POSCartLine } from './KeypadScreen'

interface Props {
  amount: number
  cartItems?: POSCartLine[]
  onBack: () => void
  onShowQR: (token: string) => void
  onShowNFC: () => void
  api: API
  sessionToken: string | null
}

export function ConfirmAmountScreen({ amount, cartItems = [], onBack, onShowQR, onShowNFC, api, sessionToken }: Props) {
  const summary = cartItems.map(it => `${it.item_name} x${it.quantity} ${it.unit}`).join(', ')

  const handleQR = async () => {
    if (sessionToken) {
      try {
        await api.setSessionAmount(sessionToken, amount)
      } catch {}
    }
    try {
      const charge = await api.createCharge(amount, summary, cartItems)
      onShowQR(charge.charge_token || charge.charge_id || charge.token)
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
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'var(--card)', borderRadius: 10, padding: 10, color: 'var(--text)', fontSize: 20 }}>
          ←
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Confirmar Canasta</h2>
        <div style={{ width: 44 }} />
      </div>

      {/* Resumen de canasta */}
      <div className="card" style={{ width: '100%', marginBottom: 16, padding: 16 }}>
        <div style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 8, fontWeight: 700 }}>DETALLE DE PRODUCTOS / SERVICIOS</div>
        <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cartItems.map((it, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{it.item_name} × {it.quantity} {it.unit}</span>
              <strong>{fmtTQ(it.subtotal_cents)} TQ</strong>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid #334155', marginTop: 12, paddingTop: 12, textAlign: 'center' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>TOTAL A COBRAR</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: 'var(--accent-light)' }}>
            {fmtTQ(amount)} <span style={{ fontSize: 20 }}>TQ</span>
          </div>
        </div>
      </div>

      <p style={{ color: 'var(--text-dim)', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
        Seleccione el metodo de pago del comprador
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
