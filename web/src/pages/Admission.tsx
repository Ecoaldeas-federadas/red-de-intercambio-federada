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
  })
  const [countries, setCountries] = useState<any[]>([])
  const [docTypes, setDocTypes] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [newDoc, setNewDoc] = useState({ document_type: '', document_number: '', country_iso2: '' })

  const load = () =>
    api.get('/admission/requests').then((d: any) => {
      const list = Array.isArray(d) ? d : d?.requests ?? d?.users ?? []
      setPending(list)
    }).catch(() => {})
  useEffect(() => {
    load()
    api.get('/countries').then((d: any) => setCountries(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/document-types').then((d: any) => setDocTypes(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const approve = async (id: string) => {
    setError('')
    setSuccess('')
    try {
      await api.post(`/admission/requests/${id}/approve`, {})
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
      await api.post(`/admission/requests/${id}/reject`, { reason })
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
    if (documents.length === 0) {
      setError('Debes agregar al menos un documento de identidad')
      return
    }
    try {
      await api.post('/accounts/request', { ...form, documents })
      setSuccess('Solicitud de admision creada. Un administrador o la asamblea debe aprobarla.')
      setShowForm(false)
      setForm({ username: '', display_name: '', requested_credit_limit: 100, requested_debit_limit: 100, reason: '', invited_by: '' })
      setDocuments([])
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear solicitud')
    }
  }

  const addDocument = () => {
    if (!newDoc.document_type || !newDoc.document_number) {
      setError('Tipo y numero de documento son obligatorios')
      return
    }
    setDocuments([...documents, newDoc])
    setNewDoc({ document_type: '', document_number: '', country_iso2: '' })
    setError('')
  }

  const removeDocument = (i: number) => {
    setDocuments(documents.filter((_, idx) => idx !== i))
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
            <h3 className="font-medium text-sm mb-2">Documentos de Identidad (al menos uno obligatorio)</h3>
            <p className="text-xs text-gray-500 mb-3">Agrega todos los documentos que tengas: cedula, pasaporte, carnet de conducir, etc. La comparacion entre nodos se hace por tipo + numero. Al federar dos nodos, si hay duplicados, ambas asambleas deciden donde te quedas.</p>

            {/* Lista de documentos agregados */}
            {documents.length > 0 && (
              <div className="space-y-2 mb-3">
                {documents.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                    <div className="text-sm">
                      <span className="font-medium">{docTypes.find((t: any) => t.code === doc.document_type)?.name || doc.document_type}</span>
                      <span className="text-gray-500 ml-2">{doc.document_number}</span>
                      {doc.country_iso2 && <span className="text-gray-400 ml-2">({countries.find((c: any) => c.iso2 === doc.country_iso2)?.name || doc.country_iso2})</span>}
                    </div>
                    <button type="button" onClick={() => removeDocument(i)} className="text-red-500 hover:text-red-700 text-xs">Eliminar</button>
                  </div>
                ))}
              </div>
            )}

            {/* Formulario para agregar documento */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Tipo de documento</label>
                <select className="input" value={newDoc.document_type} onChange={(e) => setNewDoc({ ...newDoc, document_type: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {docTypes.map((t: any) => (
                    <option key={t.code} value={t.code}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Numero</label>
                <input className="input" placeholder="Ej: V-12345678" value={newDoc.document_number} onChange={(e) => setNewDoc({ ...newDoc, document_number: e.target.value })} />
              </div>
              <div>
                <label className="label">Pais emisor</label>
                <select className="input" value={newDoc.country_iso2} onChange={(e) => setNewDoc({ ...newDoc, country_iso2: e.target.value })}>
                  <option value="">Seleccionar pais...</option>
                  {countries.map((c: any) => (
                    <option key={c.iso2} value={c.iso2}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="button" onClick={addDocument} className="btn-secondary text-sm mt-2">Agregar documento</button>
          </div>

          <div className="flex gap-2">
            <button onClick={submitRequest} className="btn-primary">Enviar Solicitud</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      {pending.length === 0 && !showForm ? (
        <div className="card text-center text-gray-500 py-8">
          No hay solicitudes de admision.
          <br />
          <span className="text-sm">Crea una nueva solicitud con el boton de arriba.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map((u, i) => {
            const username = u.proposed_username || u.username || ''
            const displayName = u.display_name || ''
            const status = u.status || 'pending'
            const level = u.proposed_level || u.requested_level || ''
            const reason = u.reason || u.rejection_reason || ''
            const submittedAt = u.submitted_at ? String(u.submitted_at).slice(0, 10) : ''
            return (
              <div key={i} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{username}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        status === 'approved' ? 'bg-green-100 text-green-700' :
                        status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {status === 'approved' ? 'Aprobada' : status === 'rejected' ? 'Rechazada' : 'Pendiente'}
                      </span>
                      {level && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Nivel: {level}</span>}
                    </div>
                    <p className="text-sm text-gray-600">{displayName}</p>
                    {reason && <p className="text-xs text-gray-500 mt-1">{reason}</p>}
                    {submittedAt && <p className="text-xs text-gray-400 mt-1">Solicitada: {submittedAt}</p>}
                  </div>
                  <div className="flex gap-2">
                    {status === 'pending' && (
                      <>
                        <button onClick={() => approve(u.id)} className="btn-primary flex items-center gap-1"><Check size={16} />Aprobar</button>
                        <button onClick={() => reject(u.id)} className="btn-danger flex items-center gap-1"><X size={16} />Rechazar</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
