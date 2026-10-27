import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { useTranslation } from 'react-i18next'
import { Send, AlertCircle, HelpCircle, Landmark, Store } from 'lucide-react'

export default function Transfer() {
  const { currency } = useConfig()
  const { t } = useTranslation('transfer')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const handleTransfer = async () => {
    setError('')
    setSuccess('')
    if (!amount || !reference.trim()) {
      setError(t('error_assembly_amount_reason', 'Debes indicar el monto y el motivo del aporte o prestamo a la Asamblea General'))
      return
    }
    setLoading(true)
    try {
      const cents = Math.round(parseFloat(amount) * 100)
      if (!cents || cents <= 0) {
        setError(t('error_invalid_amount', 'Monto invalido'))
        setLoading(false)
        return
      }
      await api.post('/ledger/transfer', {
        to_user: 'asamblea',
        amount: cents,
        reference: reference.trim(),
      })
      setSuccess(t('assembly_transfer_success', 'Aporte / prestamo enviado correctamente a la Asamblea General.'))
      setAmount('')
      setReference('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_generic', 'Error al procesar'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Landmark size={24} className="text-trueque-700" />
          {t('assembly_contribution_title', 'Aporte / Prestamo a la Asamblea General')}
        </h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {/* Aviso de doctrina: cero transferencias libres entre personas/comercios */}
      <div className="card bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
        <p className="font-semibold">
          {t('no_free_transfers_notice_title', 'Todo intercambio entre miembros se realiza por productos o servicios reales')}
        </p>
        <p>
          {t('no_free_transfers_notice_desc', 'En el Sistema TQ no existen transferencias de monto libre entre personas ni entre organizaciones privadas: cada movimiento comercial debe seleccionarse desde la canasta de productos o servicios aprobados en la Tienda o el Punto de Venta. Solo se permite transferir directamente a la Asamblea General (prestamos o aportes al Fondo Comunitario con motivo registrado).')}
        </p>
        <div className="pt-1">
          <Link to="/app/store" className="inline-flex items-center gap-1.5 text-trueque-700 font-bold underline">
            <Store size={14} /> {t('go_to_store_link', 'Ir a Mi Tienda para vender o comprar productos y servicios')}
          </Link>
        </div>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>{t('help_title')}</strong></p>
          <p>{t('assembly_transfer_help', 'Desde aqui cualquier miembro u organizacion puede enviar un aporte voluntario o un prestamo a la Asamblea General (Fondo Comunitario). Las organizaciones y departamentos distribuyen fondos a sus propios departamentos o miembros unicamente mediante acuerdo aprobado en su asamblea interna con motivo justificado.')}</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('common:close')}</button>
        </div>
      )}

      {error && <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm"><AlertCircle size={18} />{error}</div>}
      {success && <div className="text-trueque-700 bg-trueque-50 border border-trueque-200 rounded-lg p-3 text-sm">{success}</div>}

      <div className="card space-y-4">
        <div>
          <label className="label">{t('recipient_label', 'Destinatario')}</label>
          <input className="input bg-gray-100 text-gray-700 font-semibold" value={t('assembly_recipient_fixed', 'Asamblea General (@asamblea — Fondo Comunitario)')} disabled />
        </div>
        <div>
          <label className="label">{t('amount_label', 'Monto')} ({currency})</label>
          <input className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10.00" />
        </div>
        <div>
          <label className="label">{t('reference_label', 'Motivo del aporte o prestamo (obligatorio)')}</label>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('assembly_reason_placeholder', 'Ej: Prestamo para compra de semillas comunitarias / Aporte voluntario')} />
        </div>
        <button onClick={handleTransfer} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          <Send size={18} />{loading ? t('sending', 'Enviando...') : t('send_to_assembly_button', 'Enviar a la Asamblea General')}
        </button>
      </div>
    </div>
  )
}
