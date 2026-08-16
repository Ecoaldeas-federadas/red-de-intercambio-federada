import { useState, useEffect } from 'react'
import { api } from '../api'

export default function Parity() {
  const [reports, setReports] = useState<any[]>([])

  useEffect(() => {
    api.get('/federation/parity').then((d: any) => setReports(Array.isArray(d) ? d : d?.reports ?? [])).catch(() => {})
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reportes de Paridad</h1>
      <div className="card">
        {reports.length === 0 ? <p className="text-gray-500 text-sm">No hay reportes de paridad</p> : (
          <div className="space-y-3">
            {reports.map((r, i) => (
              <div key={i} className="border-b border-gray-100 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.remote_node}</span>
                  <span className="text-sm text-gray-500">{r.created_at?.slice(0, 10)}</span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Paridad: {r.parity_ratio} | FC local: {r.local_fc} | FC remoto: {r.remote_fc}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
