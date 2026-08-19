import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Check, X, Plus, HelpCircle, UserPlus, Clock } from 'lucide-react'

export default function Admission() {
  const { currency } = useConfig()
  const [pending, setPending] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    username: '',
    display_name: '',
    requested_credit_limit: 100,
    requested_debit_limit: 100,
    reason: '',
    invited_by: '',
    national_id: '',
    national_id_type: '',
    national_id_country: '',
  })

  const load = () =>
    api.get('/accounts/pending').then((d: any) => setPending(Array.isArray(d) ? d : d?.users ?? [])).catch(() => {})
  useEffect(() => { load() }, [])

  const approve = async (id: string) => {
    setError('')
    setSuccess('')
    try {
      await api.post(`/accounts/${id}/approve`, {})
      setSuccess('Solicitud aprobada. El usuario ya puede iniciar sesion.')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al aprobar')
    }
  }

  const reject = async (id: string) => {
    setError('')
    setSuccess('')
    const reason = prompt('Razon del rechazo:')
    if (!reason) return
    try {
      await api.post(`/accounts/${id}/reject`, { reason })
      setSuccess('Solicitud rechazada')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al rechazar')
    }
  }

  const submitRequest = async () => {
    setError('')
    setSuccess('')
    if (!form.username || !form.display_name) {
      setError('Usuario y nombre son obligatorios')
      return
    }
    try {
      await api.post('/accounts/request', form)
      setSuccess('Solicitud de admision creada. Un administrador o la asamblea debe aprobarla.')
      setShowForm(false)
      setForm({ username: '', display_name: '', requested_credit_limit: 100, requested_debit_limit: 100, reason: '', invited_by: '', national_id: '', national_id_type: '', national_id_country: '' })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear solicitud')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><UserPlus size={24} />Solicitudes de Admision</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Nueva Solicitud
          </button>
        </div>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
          <p><strong>Admision - Ayuda</strong></p>
          <p><strong>Como funciona:</strong> Una persona que quiere unirse a la comunidad crea una solicitud de admision. El administrador o la asamblea revisa y aprueba/rechaza.</p>
          <p><strong>Limites:</strong> El solicitante indica cuanto credito y debito solicita. La asamblea puede modificar estos limites al aprobar.</p>
          <p><strong>Invitacion:</strong> Si alguien invito al solicitante, se indica quien. Esto ayuda a verificar la identidad.</p>
          <p><strong>Despues de aprobar:</strong> El usuario puede iniciar sesion y participar en el sistema.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
      {success && <div className="text-trueque-700 text-sm bg-trueque-50 p-3 rounded-lg">{success}</div>}

      {showForm && (
        <div className="card space-y-4">
          <h2 className="font-semibold">Solicitar Admision a la Comunidad</h2>
          <p className="text-xs text-gray-500">Completa tus datos. Un administrador o la asamblea revisara tu solicitud.</p>

          <div>
            <label className="label">Nombre de usuario</label>
            <input className="input" placeholder="Ej: maria" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Nombre con el que iniciaras sesion. Sin espacios ni @.</p>
          </div>

          <div>
            <label className="label">Nombre para mostrar</label>
            <input className="input" placeholder="Ej: Maria Gonzalez" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Tu nombre real como lo veran los demas miembros.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Limite de credito solicitado ({currency})</label>
              <input type="number" className="input" value={form.requested_credit_limit} onChange={(e) => setForm({ ...form, requested_credit_limit: parseInt(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Maximo saldo positivo que puedes acumular.</p>
            </div>
            <div>
              <label className="label">Limite de debito solicitado ({currency})</label>
              <input type="number" className="input" value={form.requested_debit_limit} onChange={(e) => setForm({ ...form, requested_debit_limit: parseInt(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Maximo saldo negativo (deuda) permitido.</p>
            </div>
          </div>

          <div>
            <label className="label">Razon de la solicitud (opcional)</label>
            <textarea className="input" rows={3} placeholder="Ej: Quiero unirme para intercambiar productos agricolas" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>

          <div>
            <label className="label">Invitado por (opcional)</label>
            <input className="input" placeholder="Ej: @juan@localhost" value={form.invited_by} onChange={(e) => setForm({ ...form, invited_by: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Si un miembro te invito, indica su usuario. Ayuda a verificar tu identidad.</p>
          </div>

          <div className="border-t pt-3 mt-3">
            <h3 className="font-medium text-sm mb-2">Identificacion Nacional (obligatorio para federacion)</h3>
            <p className="text-xs text-gray-500 mb-3">Tu documento de identidad evita que te registres en multiples nodos. Al federar dos nodos, si hay duplicados, ambas asambleas deciden donde te quedas.</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Tipo</label>
                <select className="input" value={form.national_id_type} onChange={(e) => setForm({ ...form, national_id_type: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  <option value="cedula">Cedula</option>
                  <option value="pasaporte">Pasaporte</option>
                  <option value="dni">DNI</option>
                  <option value="rut">RUT</option>
                  <option value="curp">CURP</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="label">Numero</label>
                <input className="input" placeholder="V-12345678" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
              </div>
              <div>
                <label className="label">Pais</label>
                <input className="input" placeholder="Venezuela" value={form.national_id_country} onChange={(e) => setForm({ ...form, national_id_country: e.target.value })} />
              </div>
            </div>
          </div>

          <button onClick={submitRequest} className="btn-primary">Enviar Solicitud</button>
        </div>
      )}

      {pending.length === 0 && !showForm ? (
        <div className="card text-center text-gray-500 py-8">
          No hay solicitudes pendientes.
          <br />
          <span className="text-sm">Crea una nueva solicitud con el boton de arriba.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map((u, i) => (
            <div key={i} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{u.username}</span>
                  <p className="text-sm text-gray-600">{u.display_name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>Credito solicitado: {u.requested_credit_limit} {currency}</span>
                    <span>Debito solicitado: {u.requested_debit_limit} {currency}</span>
                    {u.reason && <span className="flex items-center gap-1"><Clock size={12} />{u.reason}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approve(u.id)} className="btn-primary flex items-center gap-1"><Check size={16} />Aprobar</button>
                  <button onClick={() => reject(u.id)} className="btn-danger flex items-center gap-1"><X size={16} />Rechazar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
