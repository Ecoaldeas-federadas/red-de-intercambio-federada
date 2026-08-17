import { useState } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Send, AlertCircle, HelpCircle } from 'lucide-react'

export default function Transfer() {
  const { currency } = useConfig()
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transferir Trueque</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Transferir - Ayuda</strong></p>
          <p><strong>Para que sirve:</strong> Envia Trueques ({currency}) de tu cuenta a la de otro usuario. Es una transferencia directa entre dos personas.</p>
          <p><strong>Destinatario:</strong> El identificador de la persona que recibira el dinero. Formato: @usuario@nodo (ej: @maria@localhost). Si la persona esta en tu mismo nodo, solo escribe @usuario.</p>
          <p><strong>Monto:</strong> Cuantos Trueques vas a enviar. Puede ser positivo o negativo tu saldo despues: si tu saldo queda negativo, significa que debes (es normal en este sistema).</p>
          <p><strong>Referencia:</strong> Nota opcional para que el destinatario sepa por que le enviaste el dinero (ej: "Pago por panaderia").</p>
          <p><strong>Importante:</strong> El sistema suma cero. Si tu envias 50 {currency}, tu saldo baja 50 y el del destinatario sube 50. No se crea dinero de la nada.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {error && <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm"><AlertCircle size={18} />{error}</div>}
      {success && <div className="text-trueque-700 bg-trueque-50 border border-trueque-200 rounded-lg p-3 text-sm">{success}</div>}

      <div className="card space-y-4">
        <div>
          <label className="label">Destinatario</label>
          <input className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="@usuario@nodo.org" />
          <p className="text-xs text-gray-400 mt-1">Identificador de quien recibira el dinero. Formato: @usuario@nodo (ej: @maria@localhost)</p>
        </div>
        <div>
          <label className="label">Monto ({currency})</label>
          <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" />
          <p className="text-xs text-gray-400 mt-1">Cantidad de Trueques a enviar. 1 {currency} = 1 kWh de energia.</p>
        </div>
        <div>
          <label className="label">Referencia (opcional)</label>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Pago por servicios" />
          <p className="text-xs text-gray-400 mt-1">Nota para que el destinatario sepa el motivo del pago.</p>
        </div>
        <button onClick={handleTransfer} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          <Send size={18} />{loading ? 'Enviando...' : 'Transferir'}
        </button>
      </div>
    </div>
  )
}
