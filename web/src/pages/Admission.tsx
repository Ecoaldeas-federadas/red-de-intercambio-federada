import { useState, useEffect } from 'react'
import { api } from '../api'
import { Check, X } from 'lucide-react'

export default function Admission() {
  const [pending, setPending] = useState<any[]>([])

  const load = () => api.get('/accounts/pending').then((d: any) => setPending(Array.isArray(d) ? d : d?.users ?? [])).catch(() => {})
  useEffect(() => { load() }, [])

  const approve = async (id: string) => { await api.post(`/accounts/${id}/approve`, {}); load() }
  const reject = async (id: string) => { await api.post(`/accounts/${id}/reject`, {}); load() }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Solicitudes de Admision</h1>
      {pending.length === 0 ? (
        <div className="card"><p className="text-gray-500 text-sm">No hay solicitudes pendientes</p></div>
      ) : (
        <div className="space-y-2">
          {pending.map((u, i) => (
            <div key={i} className="card flex items-center justify-between">
              <div>
                <span className="font-medium">{u.username}</span>
                <p className="text-sm text-gray-600">{u.display_name} | Limite solicitado: {u.requested_credit_limit}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => approve(u.id)} className="btn-primary flex items-center gap-1"><Check size={16} />Aprobar</button>
                <button onClick={() => reject(u.id)} className="btn-danger flex items-center gap-1"><X size={16} />Rechazar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
