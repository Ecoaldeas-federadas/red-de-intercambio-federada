import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { HelpCircle, FileSearch } from 'lucide-react'
import { fmtDateTime } from '../lib/format'

export default function Audit() {
  const { t } = useTranslation(['audit', 'common'])
  const [entries, setEntries] = useState<any[]>([])
  const [filter, setFilter] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  const load = () => {
    const path = filter ? `/audit?action=${filter}` : '/audit'
    api.get(path).then((d: any) => setEntries(Array.isArray(d) ? d : d?.entries ?? [])).catch(() => {})
  }

  useEffect(() => { load() }, [filter])

  const filterLabels: Record<string, string> = {
    '': t('filter_all', 'Todos'),
    transfer: t('filter_transfer', 'Transferencias'),
    admission: t('filter_admission', 'Admisiones'),
    admission_approved: t('filter_admission', 'Admisiones'),
    admission_reject: t('filter_admission', 'Admisiones'),
    federation: t('filter_federation', 'Federacion'),
    assembly: t('filter_assembly', 'Asamblea'),
    assembly_decision: t('filter_assembly', 'Asamblea'),
    assembly_execute: t('filter_assembly', 'Asamblea'),
    level_upgrade: t('filter_level', 'Niveles'),
    super_admin_toggle: t('filter_admin', 'Admin'),
    calc_param_approve: t('filter_calculator', 'Calculadora'),
    governance_proposal: t('filter_governance', 'Gobernanza'),
  }

  const actionLabels: Record<string, string> = {
    transfer: t('action_transfer', 'Transferencia'),
    admission_approved: t('action_admission_approved', 'Admision aprobada'),
    admission_approve: t('action_admission_approved', 'Admision aprobada'),
    admission_reject: t('action_admission_reject', 'Admision rechazada'),
    federation: t('action_federation', 'Federacion'),
    assembly_decision: t('action_assembly_decision', 'Decision de asamblea'),
    assembly_execute: t('action_assembly_execute', 'Ejecucion de asamblea'),
    level_upgrade: t('action_level_upgrade', 'Cambio de nivel'),
    super_admin_toggle: t('action_super_admin', 'Cambio de super admin'),
    calc_param_approve: t('action_calc_approve', 'Aprobacion de calculo'),
    governance_proposal: t('action_governance', 'Propuesta de gobernanza'),
  }

  const detailKeyLabels: Record<string, string> = {
    amount: t('detail_amount', 'Monto'),
    description: t('detail_description', 'Descripcion'),
    peer: t('detail_peer', 'Nodo peer'),
    tx_id: t('detail_tx', 'TX'),
    from: t('detail_from', 'Origen'),
    to: t('detail_to', 'Destino'),
    username: t('detail_username', 'Usuario'),
    level: t('detail_level', 'Nivel'),
    receiver_id: t('detail_receiver', 'Receptor'),
    tax_amount: t('detail_tax', 'Impuesto'),
  }

  const formatDetails = (d: any): string => {
    if (!d) return ''
    if (typeof d === 'string') return d
    if (typeof d === 'object') {
      const parts: string[] = []
      for (const [k, v] of Object.entries(d)) {
        if (v !== null && v !== undefined && v !== '') {
          const label = detailKeyLabels[k] || k
          parts.push(`${label}: ${v}`)
        }
      }
      return parts.join(' | ')
    }
    return String(d)
  }

  const formatDate = (d: string): string => {
    if (!d) return ''
    return fmtDateTime(d)
  }

  const getActorName = (e: any): string => {
    if (e.actor_display_name) return e.actor_display_name
    if (e.actor_username) return e.actor_username
    return t('system', 'Sistema')
  }

  const getActionLabel = (action: string): string => {
    return actionLabels[action] || action
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileSearch size={24} />{t('title', 'Auditoria')}</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>{t('help_title', 'Auditoria - Ayuda')}</strong></p>
          <p><strong>{t('help_what', 'Que es:')}</strong> {t('help_what_desc', 'El log de auditoria es un registro inmutable y cronologico de todas las acciones importantes que ocurren en el nodo. Es la fuente de verdad para saber que paso en el sistema.')}</p>
          <p><strong>{t('help_purpose', 'Para que sirve:')}</strong> {t('help_purpose_desc', 'Permite verificar que paso, quien lo hizo y cuando. Es la base de la transparencia del sistema: cualquier miembro puede revisar el historial completo y auditar que no haya irregularidades.')}</p>
          <p><strong>{t('help_actions', 'Que acciones se auditan:')}</strong></p>
          <ul className="list-disc list-inside ml-4">
            <li><strong>{t('help_transfers', 'Transferencias:')}</strong> {t('help_transfers_desc', 'Envio y recepcion de unidades entre cuentas. Muestra origen y destino.')}</li>
            <li><strong>{t('help_admissions', 'Admisiones:')}</strong> {t('help_admissions_desc', 'Ingreso de nuevos miembros al nodo')}</li>
            <li><strong>{t('help_federation', 'Federacion:')}</strong> {t('help_federation_desc', 'Transacciones con otros nodos (importaciones y exportaciones)')}</li>
            <li><strong>{t('help_assembly', 'Asamblea:')}</strong> {t('help_assembly_desc', 'Decisiones colectivas, propuestas y votaciones')}</li>
          </ul>
          <p><strong>{t('help_columns', 'Que significa cada columna:')}</strong></p>
          <ul className="list-disc list-inside ml-4">
            <li><strong>{t('col_date', 'Fecha:')}</strong> {t('col_date_desc', 'Momento exacto en que ocurrio la accion')}</li>
            <li><strong>{t('col_actor', 'Actor:')}</strong> {t('col_actor_desc', 'Quien realizo la accion. Puede ser un usuario o "Sistema" para acciones automaticas.')}</li>
            <li><strong>{t('col_action', 'Accion:')}</strong> {t('col_action_desc', 'Tipo de accion realizada')}</li>
            <li><strong>{t('col_details', 'Detalles:')}</strong> {t('col_details_desc', 'Informacion adicional: monto, origen, destino, descripcion, etc.')}</li>
          </ul>
          <p><strong>{t('help_usage', 'Como se usa:')}</strong> {t('help_usage_desc', 'Selecciona un filtro de tipo de accion para ver solo los registros que te interesan. Por ejemplo, pulsa "Transferencias" para ver solo envios y recepciones de unidades.')}</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('close', t('common.close'))}</button>
        </div>
      )}

      <div>
        <label className="label">{t('filter_label', 'Filtrar por tipo de accion')}</label>
        <p className="text-xs text-gray-400 mt-1 mb-2">{t('filter_hint', 'Selecciona el tipo de accion que quieres ver.')}</p>
        <div className="flex gap-2 flex-wrap">
          {['', 'transfer', 'admission_approved', 'federation', 'assembly_decision', 'level_upgrade'].map((a) => (
            <button key={a} onClick={() => setFilter(a)} className={`px-3 py-1 rounded-lg text-sm ${filter === a ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>
              {filterLabels[a] || a}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        {entries.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>{t('no_entries', 'No hay registros de auditoria.')}</p>
            <p className="text-xs mt-2">{t('no_entries_hint', 'Los registros aparecen cuando se realizan transferencias, admisiones, cambios de configuracion, etc.')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-gray-600">
              <th className="py-2">{t('col_date', 'Fecha')}</th><th>{t('col_actor', 'Actor')}</th><th>{t('col_action', 'Accion')}</th><th>{t('col_details', 'Detalles')}</th>
            </tr></thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 text-gray-600">{formatDate(e.created_at)}</td>
                  <td className="font-medium">{getActorName(e)}</td>
                  <td><span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{getActionLabel(e.action)}</span></td>
                  <td className="text-gray-600 max-w-md truncate">{formatDetails(e.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
