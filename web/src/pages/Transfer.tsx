import { useState } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { useTranslation } from 'react-i18next'
import { Send, AlertCircle, HelpCircle } from 'lucide-react'

export default function Transfer() {
  const { currency } = useConfig()
  const { t } = useTranslation('transfer')
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
      setError(t('error_recipient_amount', 'Destinatario y monto son obligatorios'))
      return
    }
    setLoading(true)
    try {
      // El sistema almacena montos en CENTAVOS internamente.
      // Convertir el input del usuario (TQ con decimales) a centavos.
      const cents = Math.round(parseFloat(amount) * 100)
      if (!cents || cents <= 0) {
        setError(t('error_invalid_amount', 'Monto invalido. Debe ser un numero positivo (ej: 1.50)'))
        setLoading(false)
        return
      }
      await api.post('/ledger/transfer', {
        to_user: recipient,
        amount: cents,
        reference,
      })
      setSuccess(t('success', 'Transferencia enviada correctamente'))
      setRecipient('')
      setAmount('')
      setReference('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_generic', 'Error al transferir'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title', 'Transferir Trueque')}</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>{t('help_title', 'Transferir - Ayuda')}</strong></p>
          <p><strong>{t('help_what_label', 'Que es una transferencia:')}</strong> {t('help_what', `Es el envio directo de Trueques (${currency}) desde tu cuenta a la cuenta de otro usuario de la red federada. Es la operacion basica del sistema: una persona entrega valor a otra.`, { currency })}</p>
          <p><strong>{t('help_purpose_label', 'Para que sirve:')}</strong> {t('help_purpose', 'Para pagar a otra persona por un bien, servicio o favor, saldar una deuda, regalar Trueques, o realizar cualquier intercambio economico entre dos participantes de la red.')}</p>
          <p><strong>{t('help_recipient_label', 'Quien puede recibir:')}</strong> {t('help_recipient', 'Cualquier usuario registrado en la red federada. Se identifica con el formato @usuario@nodo (ej: @maria@localhost). Si la persona esta en tu mismo nodo, basta con @usuario. No puedes transferirte a ti mismo.')}</p>
          <p><strong>{t('help_amount_label', 'Que es el monto:')}</strong> {t('help_amount', `Es la cantidad de Trueques que vas a enviar. 1 ${currency} equivale a 1 kWh de energia. El monto siempre es un numero entero positivo (ej: 50, 100, 250).`, { currency })}</p>
          <p><strong>{t('help_note_label', 'Que es la nota/mensaje (Referencia):')}</strong> {t('help_note', 'Es un texto opcional que acompana la transferencia para que el destinatario sepa el motivo. Aparece en el historial de ambos. Ej: "Pago por panaderia" o "Devolucion del prestamo".')}</p>
          <p><strong>{t('help_tax_label', 'Como funciona el impuesto:')}</strong> {t('help_tax', 'El sistema puede aplicar un pequeno impuesto (comision) sobre cada transferencia. Este impuesto se descuenta del monto que recibe el destinatario y se envia a la cuenta del nodo o comunidad. El remitente no paga extra: envia el monto indicado y el destinatario recibe ese monto menos el impuesto. El porcentaje lo define la configuracion del nodo.')}</p>
          <p><strong>{t('help_limits_label', 'Que son los limites de credito y debito:')}</strong> {t('help_limits', `El sistema permite que tu saldo sea negativo (credito) o positivo (debito). Credito significa que debes Trueques a la comunidad (saldo negativo, ej: -200 ${currency}); es normal y permite que la economia funcione sin necesidad de tener saldo previo. Debito significa que la comunidad te debe a ti (saldo positivo, ej: +500 ${currency}). Hay un limite maximo de credito (cuanto puedes deber) definido por el nodo para evitar abusos.`, { currency })}</p>
          <p><strong>{t('help_zero_sum_label', 'Importante - El sistema suma cero:')}</strong> {t('help_zero_sum', `Por cada transferencia, lo que sale de una cuenta entra en otra. Si envias 50 ${currency}, tu saldo baja 50 y el del destinatario sube 50 (menos el impuesto, si aplica). No se crea dinero de la nada ni desaparece: el total de todos los saldos de la red siempre es cero.`, { currency })}</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('common:close')}</button>
        </div>
      )}

      {error && <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm"><AlertCircle size={18} />{error}</div>}
      {success && <div className="text-trueque-700 bg-trueque-50 border border-trueque-200 rounded-lg p-3 text-sm">{success}</div>}

      <div className="card space-y-4">
        <div>
          <label className="label">{t('recipient_label', 'Destinatario')}</label>
          <input className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="@maria@localhost" />
          <p className="text-xs text-gray-400 mt-1">{t('recipient_hint', 'Identificador de quien recibira el dinero. Formato @usuario@nodo. Ej: @maria@localhost o @carlos@nodo2.org. Si esta en tu mismo nodo, basta con @maria.')}</p>
        </div>
        <div>
          <label className="label">{t('amount_label', 'Monto')} ({currency})</label>
          <input className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1.50" />
          <p className="text-xs text-gray-400 mt-1">{t('amount_hint', 'Cantidad de Trueques a enviar. Acepta decimales (centavos). Ej: 1.50 para enviar un Trueque con cincuenta centavos.')}</p>
        </div>
        <div>
          <label className="label">{t('reference_label', 'Referencia (opcional)')}</label>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Pago por panaderia" />
          <p className="text-xs text-gray-400 mt-1">{t('reference_hint', 'Nota para que el destinatario sepa el motivo del pago. Aparece en el historial de ambos.')}</p>
        </div>
        <button onClick={handleTransfer} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          <Send size={18} />{loading ? t('sending', 'Enviando...') : t('transfer_button', 'Transferir')}
        </button>
      </div>
    </div>
  )
}
