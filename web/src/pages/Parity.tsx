import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Scale, HelpCircle, ArrowDownCircle, ArrowUpCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { fmtNumber } from '../lib/format'

export default function Parity() {
  const { t } = useTranslation(['federation', 'common'])
  const { currency } = useConfig()
  const [reports, setReports] = useState<any[]>([])
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    api.get('/federation/parity').then((d: any) => setReports(Array.isArray(d) ? d : d?.reports ?? [])).catch(() => {})
  }, [])

  const fmtNum = (n: number) => {
    if (!n || n === 0) return '0'
    return fmtNumber(n)
  }

  const parityLabel = (ratio: number) => {
    if (!ratio || ratio === 0) return { text: t('parity_no_data'), color: 'text-gray-500', icon: <Minus size={16} /> }
    if (ratio === -1) return { text: t('parity_only_imports'), color: 'text-red-600', icon: <TrendingDown size={16} /> }
    if (ratio === -2) return { text: t('parity_only_exports'), color: 'text-blue-600', icon: <TrendingUp size={16} /> }
    if (ratio >= 0.9 && ratio <= 1.1) return { text: t('parity_balanced'), color: 'text-green-600', icon: <TrendingUp size={16} /> }
    if (ratio > 1.1) return { text: t('parity_imports_more'), color: 'text-amber-600', icon: <TrendingDown size={16} /> }
    return { text: t('parity_exports_more'), color: 'text-blue-600', icon: <TrendingUp size={16} /> }
  }

  // Mostrar el numero de paridad de forma clara
  const parityDisplay = (ratio: number) => {
    if (ratio === -1) return t('parity_only_imports')
    if (ratio === -2) return t('parity_only_exports')
    if (ratio === 0) return '—'
    return fmtNumber(ratio)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Scale size={24} />{t('parity_reports')}</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>{t('parity_help_title', 'Reportes de Paridad - Ayuda completa')}</strong></p>

          <p><strong>{t('parity_help_what_label', 'Que es la paridad?')}</strong>
          {t('parity_help_what', 'La paridad mide si el intercambio entre tu nodo y otro nodo federado esta equilibrado o desequilibrado. Es como una balanza: de un lado estan las cosas que recibes del otro nodo (importaciones) y del otro lado las que envias (exportaciones).')}</p>

          <p><strong>{t('parity_help_values_label', 'Que significa cada valor?')}</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>{t('parity_help_ratio_label', 'Paridad (ratio):')}</strong> {t('parity_help_ratio', 'Es el resultado de dividir importaciones entre exportaciones.')}
              <ul className="list-disc list-inside ml-4 mt-1">
                <li><strong>1.0</strong> = {t('parity_help_balanced', 'Equilibrado: importas y exportas lo mismo.')}</li>
                <li><strong>{'>'} 1.0</strong> = {t('parity_help_import_more', 'Importas mas de lo que exportas (ej: 1.5 = importas 50% mas).')}</li>
                <li><strong>{'<'} 1.0</strong> = {t('parity_help_export_more', 'Exportas mas de lo que importas (ej: 0.5 = exportas el doble).')}</li>
                <li><strong>{t('parity_help_only_import', '"Solo importas"')}</strong> = {t('parity_help_only_import_desc', 'Has recibido productos pero nunca has enviado nada.')}</li>
                <li><strong>{t('parity_help_only_export', '"Solo exportas"')}</strong> = {t('parity_help_only_export_desc', 'Has enviado productos pero nunca has recibido nada.')}</li>
              </ul>
            </li>
            <li><strong>{t('parity_help_imports_label', 'Importaciones:')}</strong> {t('parity_help_imports', 'Total de TQ que has recibido del otro nodo (compras).', { currency })}</li>
            <li><strong>{t('parity_help_exports_label', 'Exportaciones:')}</strong> {t('parity_help_exports', 'Total de TQ que has enviado al otro nodo (ventas).', { currency })}</li>
            <li><strong>{t('parity_help_balance_label', 'Balance:')}</strong> {t('parity_help_balance', 'Exportaciones menos importaciones. Positivo = te deben. Negativo = debes.')}</li>
          </ul>

          <p><strong>{t('parity_help_fc_label', 'Sobre el Factor de Conversion (FC) - IMPORTANTE')}</strong></p>
          <p>{t('parity_help_fc_no_affect', 'El FC NO afecta el precio de los productos. Si vas a otro nodo con tu tarjeta y compras un producto que cuesta 50, te cobran 50. El precio es el mismo que esta publicado en la tienda. No hay conversion ni cambio de precio entre nodos.')}</p>

          <p>{t('parity_help_fc_exterior', 'El FC se usa exclusivamente en el comercio exterior: cuando Comercio Exterior compra productos internamente para vender afuera o cuando compra productos de afuera para traerlos al nodo. Es una herramienta de conversion entre moneda local y energia para el comercio exterior, no para transacciones entre nodos.')}</p>

          <p>{t('parity_help_fc_reference', 'El FC tambien sirve como referencia informativa para que los miembros sepan cuanto vale un producto en moneda local si deciden pagar directamente entre ellos (fuera de la plataforma). Pero esos pagos en moneda local no se registran en la plataforma.')}</p>

          <p><strong>{t('parity_help_fc_local_label', 'FC local:')}</strong> {t('parity_help_fc_local', 'Tu Factor de Conversion. Es cuanto vale 1 unidad de moneda en energia (kWh). Ej: FC=5.0 significa que 1 = 5 kWh de energia.')}</p>

          <p><strong>{t('parity_help_fc_remote_label', 'FC remoto:')}</strong> {t('parity_help_fc_remote', 'El Factor de Conversion del otro nodo. Solo aparece si el otro nodo lo ha compartido. Si dice No disponible, el otro nodo no ha compartido su FC. El FC remoto no cambia el precio de los productos que compras.')}</p>

          <p><strong>{t('parity_help_purpose_label', 'Para que sirve el reporte de paridad?')}</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>{t('parity_help_purpose_1', 'Detectar relaciones comerciales desequilibradas entre nodos.')}</li>
            <li>{t('parity_help_purpose_2', 'Decidir si ajustar los limites bilaterales con un nodo.')}</li>
            <li>{t('parity_help_purpose_3', 'Promover exportaciones donde hay deficit.')}</li>
            <li>{t('parity_help_purpose_4', 'Fomentar intercambios en areas donde hay superavit.')}</li>
          </ul>

          <p><strong>{t('parity_help_imbalance_label', 'Que hacer si hay desequilibrio?')}</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>{t('parity_help_imbalance_1', 'Si importas mucho: buscar productos locales que puedas exportar al otro nodo.')}</li>
            <li>{t('parity_help_imbalance_2', 'Si exportas mucho: considerar importar productos que necesites del otro nodo.')}</li>
            <li>{t('parity_help_imbalance_3', 'Si esta equilibrado: mantener la relacion comercial actual.')}</li>
          </ul>

          <p><strong>{t('parity_help_suggestions_label', 'Sugerencias automaticas:')}</strong> {t('parity_help_suggestions', 'El sistema muestra sugerencias cuando detecta desequilibrios. Si la paridad es alta (mucho intercambio en ambos sentidos), sugiere aumentar el limite bilateral. Si hay disparidad (mucho import, poco export), sugiere no aumentar el limite.')}</p>

          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('parity_close')}</button>
        </div>
      )}

      <div className="card">
        {reports.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No hay reportes de paridad.
            <br />
            <span className="text-sm">{t('parity_no_reports_hint')}</span>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((r, i) => {
              const p = parityLabel(r.parity_ratio)
              return (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Scale size={18} className="text-blue-600" />
                      <span className="font-semibold text-lg">{r.remote_node}</span>
                    </div>
                    <span className="text-sm text-gray-500">{r.created_at}</span>
                  </div>

                  {/* Paridad principal */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">{t('parity_ratio_label')}</p>
                        <p className={`text-2xl font-bold ${p.color}`}>{parityDisplay(r.parity_ratio)}</p>
                      </div>
                      <div className={`flex items-center gap-1 ${p.color}`}>
                        {p.icon}
                        <span className="text-sm font-medium">{p.text}</span>
                      </div>
                    </div>
                    {/* Explicacion dinamica del numero */}
                    {r.dynamic_explanation && (
                      <p className={`text-sm mt-2 ${p.color}`}>{r.dynamic_explanation}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">1.0 = equilibrado | {'>'}1.0 = importas mas | {'<'}1.0 = exportas mas</p>
                  </div>

                  {/* Import / Export / Balance */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <ArrowDownCircle size={18} className="text-green-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">{t('parity_imports')}</p>
                      <p className="font-bold text-green-700">{fmtNum(r.imports)} {currency}</p>
                      <p className="text-[10px] text-gray-400">{t('parity_received_from')}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <ArrowUpCircle size={18} className="text-blue-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">{t('parity_exports')}</p>
                      <p className="font-bold text-blue-700">{fmtNum(r.exports)} {currency}</p>
                      <p className="text-[10px] text-gray-400">{t('parity_sent_to')}</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${r.balance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <Scale size={18} className={`mx-auto mb-1 ${r.balance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                      <p className="text-xs text-gray-500">{t('parity_balance')}</p>
                      <p className={`font-bold ${r.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {r.balance >= 0 ? '+' : ''}{fmtNum(r.balance)} {currency}
                      </p>
                      <p className="text-[10px] text-gray-400">{r.balance >= 0 ? t('parity_you_owed') : t('parity_you_owe')}</p>
                    </div>
                  </div>

                  {/* FC local y remoto */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="border border-gray-200 rounded-lg p-3">
                      <p className="text-xs text-gray-500">{t('parity_fc_local')}</p>
                      <p className="font-bold text-lg">{fmtNum(r.local_fc)}</p>
                      <p className="text-[10px] text-gray-400">1 {currency} = {fmtNum(r.local_fc)} kWh de energia</p>
                      <p className="text-[10px] text-blue-500 mt-1">{t('parity_external_only')}</p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-3">
                      <p className="text-xs text-gray-500">{t('parity_fc_remote', { node: r.remote_node })}</p>
                      {r.remote_fc_real ? (
                        <>
                          <p className="font-bold text-lg">{fmtNum(r.remote_fc)}</p>
                          <p className="text-[10px] text-gray-400">1 {currency} = {fmtNum(r.remote_fc)} kWh de energia</p>
                        </>
                      ) : (
                        <>
                          <p className="font-bold text-lg text-gray-400">{t('parity_fc_not_available')}</p>
                          <p className="text-[10px] text-gray-400">{t('parity_fc_remote_hint')}</p>
                        </>
                      )}
                      <p className="text-[10px] text-blue-500 mt-1">{t('parity_external_only')}</p>
                    </div>
                  </div>

                  {/* Uso del limite */}
                  {(r.import_pct_of_limit > 0 || r.export_pct_of_limit > 0) && (
                    <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">{t('parity_limit_import')}</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${Math.min(r.import_pct_of_limit, 100)}%` }} />
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{fmtNum(r.import_pct_of_limit)}% de {fmtNum(r.credit_limit)} {currency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{t('parity_limit_export')}</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(r.export_pct_of_limit, 100)}%` }} />
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{fmtNum(r.export_pct_of_limit)}% de {fmtNum(r.credit_limit)} {currency}</p>
                      </div>
                    </div>
                  )}

                  {/* Sugerencia */}
                  {r.suggestion && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                      <p className="text-sm text-amber-800">
                        <strong>{t('parity_suggestion')}</strong> {r.suggestion}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
