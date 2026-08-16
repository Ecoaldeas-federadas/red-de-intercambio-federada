import { useState } from 'react'
import { api } from '../api'
import { Send, AlertCircle } from 'lucide-react'

export default function Transfer() {
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleTransfer = async () => {
    setError('')
    setSuccess('')
    if (!recipient || !amount) {
      setError('Destinatario y monto son obligatorios')
      return
    }
    setLoading(true)
    try {
      await api.post('/ledger/transfer', {
        to_user: recipient,
        amount: parseInt(amount),
        reference,
      })
      setSuccess('Transferencia enviada correctamente')
      setRecipient('')
      setAmount('')
      setReference('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al transferir')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Transferir Trueque</h1>
      {error && <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm"><AlertCircle size={18} />{error}</div>}
      {success && <div className="text-trueque-700 bg-trueque-50 border border-trueque-200 rounded-lg p-3 text-sm">{success}</div>}
      <div className="card space-y-4">
        <div>
          <label className="label">Destinatario</label>
          <input className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="@usuario@nodo.org" />
        </div>
        <div>
          <label className="label">Monto (TQ)</label>
          <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" />
        </div>
        <div>
          <label className="label">Referencia (opcional)</label>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Pago por servicios" />
        </div>
        <button onClick={handleTransfer} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          <Send size={18} />{loading ? 'Enviando...' : 'Transferir'}
        </button>
      </div>
    </div>
  )
}
