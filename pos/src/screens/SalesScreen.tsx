import { useState, useEffect } from 'react'
import { API } from '../api'
import { fmtTQ } from '../utils/format'

interface Props {
  onBack: () => void
  api: API
  terminalID: string | null
}

export function SalesScreen({ onBack, api, terminalID }: Props) {
  const [sales, setSales] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSales()
  }, [])

  const loadSales = async () => {
    setLoading(true)
    try {
      const data = await api.listTransactions(terminalID || undefined)
      const txs = Array.isArray(data) ? data : (data.transactions || [])
      setSales(txs)
      const totalAmount = txs.reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
      setTotal(totalAmount)
      setCount(txs.length)
    } catch {
      setSales([])
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (ts: string) => {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: 16, maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'var(--card)', borderRadius: 10, padding: 10, color: 'var(--text)', fontSize: 20 }}>
          ←
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Ventas del Dia</h2>
        <div style={{ width: 44 }} />
      </div>

      {/* Summary */}
      <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
        <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>TOTAL VENDIDO HOY</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--success)' }}>
          {fmtTQ(total)} TQ
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>
          {count} {count === 1 ? 'transaccion' : 'transacciones'}
        </div>
      </div>

      {/* Sales list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>Cargando...</div>
        ) : sales.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📊</div>
            <p>No hay ventas hoy</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sales.map((tx: any, i: number) => (
              <div key={i} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {tx.card_uid ? `💳 ${tx.card_uid.slice(0, 12)}...` : '📱 NFC'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    {formatTime(tx.created_at || tx.timestamp)}
                    {tx.status === 'approved' ? ' ✅' : tx.status === 'rejected' ? ' ❌' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: tx.status === 'approved' ? 'var(--success)' : 'var(--danger)' }}>
                    {tx.status === 'approved' ? '+' : ''}{fmtTQ(tx.amount || 0)} TQ
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{tx.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={loadSales}>
        🔄 Actualizar
      </button>
    </div>
  )
}
