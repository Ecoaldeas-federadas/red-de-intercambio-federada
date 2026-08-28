import { useState, useEffect } from 'react'
import { api } from '../api'
import { HelpCircle, FileSearch } from 'lucide-react'
import { fmtDateTime } from '../lib/format'

export default function Audit() {
  const [entries, setEntries] = useState<any[]>([])
  const [filter, setFilter] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  const load = () => {
    const path = filter ? `/audit?action=${filter}` : '/audit'
    api.get(path).then((d: any) => setEntries(Array.isArray(d) ? d : d?.entries ?? [])).catch(() => {})
  }

  useEffect(() => { load() }, [filter])

  const filterLabels: Record<string, string> = {
    '': 'Todos',
    transfer: 'Transferencias',
    admission: 'Admisiones',
    admission_approved: 'Admisiones',
    admission_reject: 'Admisiones',
    federation: 'Federacion',
    assembly: 'Asamblea',
    assembly_decision: 'Asamblea',
    assembly_execute: 'Asamblea',
    level_upgrade: 'Niveles',
    super_admin_toggle: 'Admin',
    calc_param_approve: 'Calculadora',
    governance_proposal: 'Gobernanza',
  }

  const actionLabels: Record<string, string> = {
    transfer: 'Transferencia',
    admission_approved: 'Admision aprobada',
    admission_approve: 'Admision aprobada',
    admission_reject: 'Admision rechazada',
    federation: 'Federacion',
    assembly_decision: 'Decision de asamblea',
    assembly_execute: 'Ejecucion de asamblea',
    level_upgrade: 'Cambio de nivel',
    super_admin_toggle: 'Cambio de super admin',
    calc_param_approve: 'Aprobacion de calculo',
    governance_proposal: 'Propuesta de gobernanza',
  }

  const detailKeyLabels: Record<string, string> = {
    amount: 'Monto',
    description: 'Descripcion',
    peer: 'Nodo peer',
    tx_id: 'TX',
    from: 'Origen',
    to: 'Destino',
    username: 'Usuario',
    level: 'Nivel',
    receiver_id: 'Receptor',
    tax_amount: 'Impuesto',
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
    return 'Sistema'
  }

  const getActionLabel = (action: string): string => {
    return actionLabels[action] || action
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileSearch size={24} />Auditoria</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Auditoria - Ayuda</strong></p>
          <p><strong>Que es:</strong> El log de auditoria es un registro inmutable y cronologico de todas las acciones importantes que ocurren en el nodo. Es la fuente de verdad para saber que paso en el sistema.</p>
          <p><strong>Para que sirve:</strong> Permite verificar que paso, quien lo hizo y cuando. Es la base de la transparencia del sistema: cualquier miembro puede revisar el historial completo y auditar que no haya irregularidades.</p>
          <p><strong>Que acciones se auditan:</strong></p>
          <ul className="list-disc list-inside ml-4">
            <li><strong>Transferencias:</strong> Envio y recepcion de unidades entre cuentas. Muestra origen y destino.</li>
            <li><strong>Admisiones:</strong> Ingreso de nuevos miembros al nodo</li>
            <li><strong>Federacion:</strong> Transacciones con otros nodos (importaciones y exportaciones)</li>
            <li><strong>Asamblea:</strong> Decisiones colectivas, propuestas y votaciones</li>
          </ul>
          <p><strong>Que significa cada columna:</strong></p>
          <ul className="list-disc list-inside ml-4">
            <li><strong>Fecha:</strong> Momento exacto en que ocurrio la accion</li>
            <li><strong>Actor:</strong> Quien realizo la accion. Puede ser un usuario o "Sistema" para acciones automaticas.</li>
            <li><strong>Accion:</strong> Tipo de accion realizada</li>
            <li><strong>Detalles:</strong> Informacion adicional: monto, origen, destino, descripcion, etc.</li>
          </ul>
          <p><strong>Como se usa:</strong> Selecciona un filtro de tipo de accion para ver solo los registros que te interesan. Por ejemplo, pulsa "Transferencias" para ver solo envios y recepciones de unidades.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      <div>
        <label className="label">Filtrar por tipo de accion</label>
        <p className="text-xs text-gray-400 mt-1 mb-2">Selecciona el tipo de accion que quieres ver.</p>
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
            <p>No hay registros de auditoria.</p>
            <p className="text-xs mt-2">Los registros aparecen cuando se realizan transferencias, admisiones, cambios de configuracion, etc.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-gray-600">
              <th className="py-2">Fecha</th><th>Actor</th><th>Accion</th><th>Detalles</th>
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
