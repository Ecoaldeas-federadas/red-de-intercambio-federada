import { useState, useEffect } from 'react'
import { api } from '../api'

export default function Audit() {
  const [entries, setEntries] = useState<any[]>([])
  const [filter, setFilter] = useState('')

  const load = () => {
    const path = filter ? `/audit?action=${filter}` : '/audit'
    api.get(path).then((d: any) => setEntries(Array.isArray(d) ? d : d?.entries ?? [])).catch(() => {})
  }

  useEffect(() => { load() }, [filter])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Auditoria</h1>
      <div className="flex gap-2">
        {['', 'transfer', 'admission', 'federation', 'assembly'].map((a) => (
          <button key={a} onClick={() => setFilter(a)} className={`px-3 py-1 rounded-lg text-sm ${filter === a ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>
            {a || 'Todos'}
          </button>
        ))}
      </div>
      <div className="card overflow-x-auto">
        {entries.length === 0 ? <p className="text-gray-500 text-sm">No hay registros</p> : (
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
