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
      setError(t('error_recipient_amount'))
      return
    }
    setLoading(true)
    try {
      // El sistema almacena montos en CENTAVOS internamente.
      // Convertir el input del usuario (TQ con decimales) a centavos.
      const cents = Math.round(parseFloat(amount) * 100)
      if (!cents || cents <= 0) {
        setError(t('error_invalid_amount'))
        setLoading(false)
        return
      }
      await api.post('/ledger/transfer', {
        to_user: recipient,
        amount: cents,
        reference,
      })
      setSuccess(t('success'))
      setRecipient('')
      setAmount('')
      setReference('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>{t('help_title')}</strong></p>
          <p><strong>{t('help_what_label')}</strong> {t('help_what', { currency })}</p>
          <p><strong>{t('help_purpose_label')}</strong> {t('help_purpose')}</p>
          <p><strong>{t('help_recipient_label')}</strong> {t('help_recipient')}</p>
          <p><strong>{t('help_amount_label')}</strong> {t('help_amount', { currency })}</p>
          <p><strong>{t('help_note_label')}</strong> {t('help_note')}</p>
          <p><strong>{t('help_tax_label')}</strong> {t('help_tax')}</p>
          <p><strong>{t('help_limits_label')}</strong> {t('help_limits', { currency })}</p>
          <p><strong>{t('help_zero_sum_label')}</strong> {t('help_zero_sum', { currency })}</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('common:close')}</button>
        </div>
      )}

      {error && <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm"><AlertCircle size={18} />{error}</div>}
      {success && <div className="text-trueque-700 bg-trueque-50 border border-trueque-200 rounded-lg p-3 text-sm">{success}</div>}

      <div className="card space-y-4">
        <div>
          <label className="label">{t('recipient_label')}</label>
          <input className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="@maria@localhost" />
          <p className="text-xs text-gray-400 mt-1">{t('recipient_hint')}</p>
        </div>
        <div>
          <label className="label">{t('amount_label')} ({currency})</label>
          <input className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1.50" />
          <p className="text-xs text-gray-400 mt-1">{t('amount_hint')}</p>
        </div>
        <div>
          <label className="label">{t('reference_label')}</label>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('reference_placeholder')} />
          <p className="text-xs text-gray-400 mt-1">{t('reference_hint')}</p>
        </div>
        <button onClick={handleTransfer} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          <Send size={18} />{loading ? t('sending') : t('transfer_button')}
        </button>
      </div>
    </div>
  )
}
