import { useState, useEffect } from 'react'
import { api } from '../api'
import { HelpCircle, FileSearch } from 'lucide-react'

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
    federation: 'Federacion',
    assembly: 'Asamblea',
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
          <p><strong>Para que sirve:</strong> Registro de todas las acciones importantes que ocurren en el nodo. Cada transferencia, admision, cambio de limite, decision de asamblea, etc. queda registrado aqui.</p>
          <p><strong>Para que es util:</strong> Permite verificar que paso, quien lo hizo y cuando. Es la base de la transparencia del sistema. Cualquier miembro puede revisar el historial.</p>
          <p><strong>Filtros:</strong> Puedes filtrar por tipo de accion para ver solo lo que te interesa.</p>
          <p><strong>Columnas:</strong></p>
          <ul className="list-disc list-inside ml-4">
            <li><strong>Fecha:</strong> Cuando ocurrio la accion</li>
            <li><strong>Actor:</strong> Quien realizo la accion (usuario o sistema)</li>
            <li><strong>Accion:</strong> Que tipo de accion fue</li>
            <li><strong>Detalles:</strong> Informacion adicional de la accion</li>
          </ul>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      <div>
        <label className="label">Filtrar por tipo</label>
        <div className="flex gap-2 flex-wrap">
          {['', 'transfer', 'admission', 'federation', 'assembly'].map((a) => (
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
                  <td className="py-2">{e.created_at?.slice(0, 19)}</td>
                  <td>{e.actor}</td>
                  <td><span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{e.action}</span></td>
                  <td className="text-gray-600 max-w-xs truncate">{e.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
