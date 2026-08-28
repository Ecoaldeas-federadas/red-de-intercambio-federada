import { useState, useEffect } from 'react'
import { api } from '../api'
import { Shield, KeyRound, Check, X, Clock, Plus, HelpCircle } from 'lucide-react'
import { fmtDateTime } from '../lib/format'

export default function Recovery() {
  const [config, setConfig] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [selectedReq, setSelectedReq] = useState<any>(null)
  const [approvals, setApprovals] = useState<any[]>([])
  const [showConfig, setShowConfig] = useState(false)
  const [showNewReq, setShowNewReq] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [allUsers, setAllUsers] = useState<any[]>([])

  const load = () => {
    api.get<any>('/recovery/config').then(setConfig).catch(() => {})
    api.get<any>('/recovery/requests').then((d: any) => {
      const reqs = Array.isArray(d) ? d : (d?.requests && Array.isArray(d.requests) ? d.requests : [])
      setRequests(reqs)
    }).catch(() => setRequests([]))
    api.get<any>('/accounts/list').then((d: any) => {
      setAllUsers(Array.isArray(d) ? d : [])
    }).catch(() => setAllUsers([]))
  }

  useEffect(() => { load() }, [])

  const viewApprovals = async (id: string) => {
    setSelectedReq(requests.find((r) => r.id === id) ?? null)
    const d = await api.get<{ approvals: any[] }>(`/recovery/requests/${id}/approvals`).catch(() => ({ approvals: [] }))
    setApprovals(d.approvals ?? [])
  }

  const approve = async (id: string) => {
    setError('')
    try {
      await api.post(`/recovery/requests/${id}/approve`, { approval_type: 'member' })
      load()
      viewApprovals(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const reject = async (id: string) => {
    setError('')
    const reason = prompt('Razon del rechazo:')
    if (!reason) return
    try {
      await api.post(`/recovery/requests/${id}/reject`, { reason })
      load()
      setSelectedReq(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const [newReq, setNewReq] = useState({ target_username: '', reason: '' })
  const createReq = async () => {
    setError('')
    try {
      await api.post('/recovery/request', newReq)
      setShowNewReq(false)
      setNewReq({ target_username: '', reason: '' })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const [cfgForm, setCfgForm] = useState({ approval_mode: 'multi_sig', required_approvals: 3, auto_expire_hours: 72, requires_identity_verification: true })
  const saveConfig = async () => {
    setError('')
    try {
      await api.put('/recovery/config', cfgForm)
      setShowConfig(false)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const modeLabels: Record<string, string> = {
    assembly: 'Asamblea',
    council: 'Consejo',
    multi_sig: 'Multi-firma',
    department: 'Departamento',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield size={24} />Recuperacion de Cuenta</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
          <button onClick={() => setShowConfig(!showConfig)} className="btn-secondary text-sm">Configuracion</button>
          <button onClick={() => setShowNewReq(!showNewReq)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />Nueva Solicitud</button>
        </div>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Recuperacion de Cuenta - Ayuda</strong></p>
          <p><strong>Que es:</strong> La recuperacion de cuenta es el proceso mediante el cual un usuario que perdio el acceso a su cuenta (olvido la contrasena, perdio el dispositivo con la passkey, etc.) puede recuperar el ingreso al sistema de forma segura.</p>
          <p><strong>Como funciona:</strong> Nadie puede restaurar el acceso por su cuenta. Se crea una solicitud de recuperacion y varias personas deben aprobarla antes de que se complete. Esto evita que alguien malintencionado se haga pasar por otro usuario. Mientras mas aprobaciones se requieran, mas seguro (pero mas lento) sera el proceso.</p>
          <p><strong>Que son los codigos de invitacion:</strong> Los codigos de invitacion son claves unicas que permiten a un usuario nuevo unirse al nodo. En el contexto de recuperacion, sirven como mecanismo de verificacion: solo alguien con un codigo valido puede demostrar que fue invitado legtimamente y por tanto tiene derecho a recuperar su cuenta.</p>
          <p><strong>Que es la recuperacion multi-firma:</strong> Es el modo de aprobacion donde se requiere que N miembros distintos firmen (aprueben) la solicitud. Por ejemplo, si se configuran 3 aprobaciones, al menos 3 miembros diferentes deben pulsar "Aprobar" antes de que la cuenta se restaure. Ninguna persona sola tiene poder para restaurar cuentas.</p>
          <p><strong>Modos de aprobacion disponibles:</strong></p>
          <ul className="list-disc list-inside ml-4">
            <li><strong>Multi-firma:</strong> N firmas de cualquier miembro (configurable, minimo 2)</li>
            <li><strong>Consejo:</strong> Aprobacion por un grupo designado de personas de confianza</li>
            <li><strong>Asamblea:</strong> Votacion en asamblea por mayoria</li>
            <li><strong>Departamento:</strong> Aprobacion por los jefes de departamento</li>
          </ul>
          <p><strong>Como usar esta pagina:</strong> Pulsa "Nueva Solicitud" para crear una recuperacion indicando el usuario y la razon. Las solicitudes pendientes aparecen en la lista: puedes aprobarlas, rechazarlas o ver el detalle de las firmas. Desde "Configuracion" puedes ajustar el modo de aprobacion y los parametros.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {config && (
        <div className="card bg-blue-50">
          <h2 className="font-semibold">Configuracion Actual</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 text-sm">
            <div><span className="text-gray-500">Modo:</span> <b>{modeLabels[config.approval_mode] ?? config.approval_mode}</b></div>
            <div><span className="text-gray-500">Aprobaciones:</span> <b>{config.required_approvals}</b></div>
            <div><span className="text-gray-500">Expira (h):</span> <b>{config.auto_expire_hours}</b></div>
            <div><span className="text-gray-500">Verif. identidad:</span> <b>{config.requires_identity_verification ? 'Si' : 'No'}</b></div>
          </div>
        </div>
      )}

      {showConfig && (
        <div className="card space-y-3">
          <h2 className="font-semibold">Configurar Aprobacion de Recuperacion</h2>
          <p className="text-sm text-gray-600">Ninguna persona sola puede restaurar el acceso. Minimo 2 aprobaciones requeridas.</p>
          <select className="input" value={cfgForm.approval_mode} onChange={(e) => setCfgForm({ ...cfgForm, approval_mode: e.target.value })}>
            <option value="multi_sig">Multi-firma (N firmas de cualquier miembro)</option>
            <option value="council">Consejo (grupo designado)</option>
            <option value="assembly">Asamblea (votacion de asamblea)</option>
            <option value="department">Departamento (jefes de departamento)</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={2} className="input" placeholder="Aprobaciones requeridas" value={cfgForm.required_approvals} onChange={(e) => setCfgForm({ ...cfgForm, required_approvals: parseInt(e.target.value) || 2 })} />
            <input type="number" className="input" placeholder="Horas para expirar" value={cfgForm.auto_expire_hours} onChange={(e) => setCfgForm({ ...cfgForm, auto_expire_hours: parseInt(e.target.value) || 72 })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cfgForm.requires_identity_verification} onChange={(e) => setCfgForm({ ...cfgForm, requires_identity_verification: e.target.checked })} />
            Requiere verificacion de identidad
          </label>
          <button onClick={saveConfig} className="btn-primary">Guardar Configuracion</button>
          <button onClick={() => setShowConfig(false)} className="btn-secondary ml-2">Cancelar</button>
        </div>
      )}

      {showNewReq && (
        <div className="card space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><KeyRound size={18} />Solicitar Recuperacion</h2>
          <div>
            <label className="label">Usuario que perdio acceso</label>
            <select className="input" value={newReq.target_username} onChange={(e) => setNewReq({ ...newReq, target_username: e.target.value })}>
              <option value="">Seleccionar usuario...</option>
              {allUsers.map((u: any) => (
                <option key={u.id} value={u.username}>{u.display_name || u.username} ({u.username})</option>
              ))}
            </select>
          </div>
          <textarea className="input" rows={3} placeholder="Razon de la solicitud" value={newReq.reason} onChange={(e) => setNewReq({ ...newReq, reason: e.target.value })} />
          <div className="flex gap-2">
            <button onClick={createReq} className="btn-primary">Crear Solicitud</button>
            <button onClick={() => setShowNewReq(false)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {requests.length === 0 ? (
          <div className="card"><p className="text-gray-500 text-sm">No hay solicitudes de recuperacion</p></div>
        ) : requests.map((req) => (
          <div key={req.id} className="card">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{req.target_username}</span>
                <p className="text-sm text-gray-600">{req.reason}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Clock size={12} />Expira: {fmtDateTime(req.expires_at)}</span>
                  <span>Aprobaciones: {req.approved_by?.length ?? 0}/{req.required_approvals}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${req.status === 'approved' ? 'bg-trueque-100 text-trueque-700' : req.status === 'rejected' ? 'bg-red-100 text-red-700' : req.status === 'completed' ? 'bg-blue-100 text-blue-700' : req.status === 'expired' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-700'}`}>{req.status}</span>
                {req.status === 'pending' && (
                  <>
                    <button onClick={() => approve(req.id)} className="btn-secondary flex items-center gap-1 text-sm"><Check size={14} />Aprobar</button>
                    <button onClick={() => reject(req.id)} className="btn-danger flex items-center gap-1 text-sm"><X size={14} />Rechazar</button>
                  </>
                )}
                <button onClick={() => viewApprovals(req.id)} className="btn-secondary text-sm">Ver</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedReq && (
        <div className="card">
          <h2 className="font-semibold mb-3">Detalle: {selectedReq.target_username}</h2>
          <div className="text-sm space-y-1 mb-4">
            <p><b>Razon:</b> {selectedReq.reason}</p>
            <p><b>Modo:</b> {modeLabels[selectedReq.approval_mode] ?? selectedReq.approval_mode}</p>
            <p><b>Requeridas:</b> {selectedReq.required_approvals}</p>
            <p><b>Aprobadas por:</b> {selectedReq.approved_by?.length ?? 0}</p>
          </div>
          <h3 className="font-medium text-sm mb-2">Firmas de Aprobacion</h3>
          {approvals.length === 0 ? <p className="text-gray-500 text-sm">Sin aprobaciones aun</p> : (
            <div className="space-y-1">
              {approvals.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-sm border-b border-gray-100 py-1">
                  <Check size={14} className="text-trueque-600" />
                  <span>Usuario: {a.approver_id?.slice(0, 8)}...</span>
                  <span className="text-gray-500">{a.approval_type}</span>
                  {a.notes && <span className="text-gray-400">| {a.notes}</span>}
                  <span className="text-gray-400 ml-auto">{fmtDateTime(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setSelectedReq(null)} className="btn-secondary mt-3 text-sm">Cerrar</button>
        </div>
      )}
    </div>
  )
}
