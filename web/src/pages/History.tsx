import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { useTranslation } from 'react-i18next'
import { HelpCircle, History as HistoryIcon } from 'lucide-react'
import { fmtTQ } from '../lib/format'

export default function History() {
  const { currency } = useConfig()
  const { t } = useTranslation('common')
  const [txs, setTxs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    api.get('/ledger/transactions').then((data: any) => {
      setTxs(Array.isArray(data) ? data : data?.transactions ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><HistoryIcon size={24} />{t('history.title', 'Historial de Transacciones')}</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>{t('history.help_title', 'Historial - Ayuda')}</strong></p>
          <p><strong>{t('history.help_what_label', 'Que muestra:')}</strong> {t('history.help_what', `El historial es el registro completo de todas las transacciones en las que has participado, ya sea como remitente (quien envia) o como destinatario (quien recibe). Incluye transferencias entre usuarios, pagos y cualquier otro movimiento de Trueques (${currency}) de tu cuenta.`, { currency })}</p>
          <p><strong>{t('history.help_purpose_label', 'Para que sirve:')}</strong> {t('history.help_purpose', 'Para llevar el control de tus movimientos, verificar quien te ha enviado o a quien le has enviado Trueques, revisar los motivos de cada transaccion y auditar que todo cuadre con tus expectativas. Es tu libro de cuentas personal dentro de la red.')}</p>
          <p><strong>{t('history.help_usage_label', 'Como se usa:')}</strong> {t('history.help_usage', 'Al entrar a la pagina se carga automaticamente la lista de tus transacciones mas recientes. Cada fila es una transaccion. Si no aparece nada, significa que todavia no has realizado ni recibido transferencias.')}</p>
          <p><strong>{t('history.help_columns_title', 'Que significa cada columna:')}</strong></p>
          <ul className="list-disc list-inside ml-4">
            <li><strong>{t('history.col_date', 'Fecha')}:</strong> {t('history.help_col_date', 'Dia en que se realizo la transaccion (formato AAAA-MM-DD). Ej: 2024-06-15.')}</li>
            <li><strong>{t('history.col_from', 'De')}:</strong> {t('history.help_col_from', 'Identificador del usuario que envio los Trueques. Si eres tu, significa que enviaste dinero. Ej: @juan@localhost.')}</li>
            <li><strong>{t('history.col_to', 'A')}:</strong> {t('history.help_col_to', 'Identificador del usuario que recibio los Trueques. Si eres tu, significa que recibiste dinero. Ej: @maria@localhost.')}</li>
            <li><strong>{t('history.col_amount', 'Monto')}:</strong> {t('history.help_col_amount', `Cantidad de Trueques (${currency}) que se transfirieron en esa operacion. 1 ${currency} = 1 kWh de energia. Ej: 50 ${currency}.`, { currency })}</li>
            <li><strong>{t('history.col_ref', 'Ref')}:</strong> {t('history.help_col_ref', 'Referencia o nota que el remitente dejo para explicar el motivo del pago. Puede estar vacia si no se dejo nota. Ej: "Pago por panaderia".')}</li>
          </ul>
          <p><strong>{t('history.help_filter_label', 'Como filtrar:')}</strong> {t('history.help_filter', 'Actualmente el historial muestra todas tus transacciones ordenadas por fecha. Si necesitas buscar una en concreto, usa la funcion de busqueda del navegador (Ctrl+F) para encontrar por nombre de usuario, monto o referencia.')}</p>
          <p><strong>{t('history.help_hash_label', 'Que es el hash de integridad:')}</strong> {t('history.help_hash', 'Cada transaccion tiene un identificador criptografico (hash) que la hace unica e inalterable. Esto significa que una vez registrada, nadie puede modificar sus datos (monto, remitente, destinatario) sin que se detecte. El hash garantiza que el historial es confiable y que las transacciones no han sido manipuladas.')}</p>
          <p><strong>{t('history.help_note_label', 'Nota importante:')}</strong> {t('history.help_note', `El sistema suma cero. Si alguien envio 50 ${currency}, su saldo bajo 50 y el del destinatario subio 50 (menos el impuesto si aplica). El total de todos los saldos de la red siempre es cero: no se crea ni se destruye dinero.`, { currency })}</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('common:close')}</button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">{t('history.loading', t('common:loading'))}</p>
      ) : txs.length === 0 ? (
        <div className="card text-center text-gray-500 py-8">
          <p>{t('history.empty', 'No hay transacciones todavia.')}</p>
          <p className="text-xs mt-2">{t('history.empty_hint', 'Las transacciones aparecen cuando transfieres o recibes Trueques. Ve a Transferir o Pagos para hacer una transaccion.')}</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-gray-600">
              <th className="py-2">{t('history.col_date', 'Fecha')}</th><th>{t('history.col_from', 'De')}</th><th>{t('history.col_to', 'A')}</th><th>{t('history.col_amount', 'Monto')}</th><th>{t('history.col_ref', 'Ref')}</th>
            </tr></thead>
            <tbody>
              {txs.map((t, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2">{t.created_at?.slice(0, 10)}</td>
                  <td>{t.from_user}</td><td>{t.to_user}</td>
                  <td className="font-semibold text-trueque-700">{fmtTQ(t.amount)} {currency}</td>
                  <td>{t.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
