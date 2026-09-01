import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Check, X, HelpCircle, UserPlus, Heart, Shield } from 'lucide-react'
import { toCents, fmtTQ } from '../lib/format'

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
    sponsor_amount_held: 100,
  })
  const [countries, setCountries] = useState<any[]>([])
  const [docTypes, setDocTypes] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [newDoc, setNewDoc] = useState({ document_type: '', document_number: '', country_iso2: '' })
  const [sponsoringId, setSponsoringId] = useState<string | null>(null)
  const [sponsorAmount, setSponsorAmount] = useState(100)

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
    if (form.sponsor_amount_held <= 0) {
      setError('El monto de apadrinamiento debe ser mayor que 0')
      return
    }
    try {
      await api.post('/admission/apply', {
        username: form.username,
        display_name: form.display_name,
        documents: documents.map(d => ({ document_type: d.document_type, document_number: d.document_number, country_iso2: d.country_iso2 })),
        sponsor_amount_held: toCents(String(form.sponsor_amount_held)),
        requested_credit_limit: toCents(String(form.requested_credit_limit)),
        requested_debit_limit: toCents(String(form.requested_debit_limit)),
      })
      setSuccess('Solicitud de apadrinamiento creada. Tu ahijado sera evaluado por la asamblea.')
      setShowForm(false)
      setForm({ username: '', display_name: '', requested_credit_limit: 100, requested_debit_limit: 100, reason: '', invited_by: '', sponsor_amount_held: 100 })
      setDocuments([])
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear solicitud')
    }
  }

  const sponsorExisting = async (id: string) => {
    setError('')
    setSuccess('')
    if (sponsorAmount <= 0) {
      setError('El monto debe ser mayor que 0')
      return
    }
    try {
      await api.post(`/admission/requests/${id}/sponsor`, { amount_held: toCents(String(sponsorAmount)) })
      setSuccess('Te has agregado como padrino de esta solicitud.')
      setSponsoringId(null)
      setSponsorAmount(100)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al apadrinar')
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
            <Heart size={18} /> Apadrinar nuevo miembro
          </button>
        </div>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
          <p><strong>Admision con Apadrinamiento - Ayuda</strong></p>
          <p><strong>Como funciona:</strong> Como miembro de la comunidad, puedes apadrinar a una persona nueva. Tu eres su padrino: le asignas parte de tu limite de credito/debito para que pueda empezar a intercambiar.</p>
          <p><strong>Apadrinamiento:</strong> El monto que asignas se descuenta de tu limite. Si tienes 5000 y asignas 1000, te quedan 4000. El monto es simetrico: el ahijado tiene +1000 y -1000.</p>
          <p><strong>Responsabilidad:</strong> Si tu ahijado no cumple, la asamblea puede pedirte que cubras su deuda. Por eso, solo apadrina a personas en las que confias.</p>
          <p><strong>Solicitudes publicas:</strong> Las solicitudes que llegan desde la pagina web publica aparecen aqui sin padrino. Cualquier miembro puede apadrinarlas haciendo clic en "Apadrinar".</p>
          <p><strong>Aprobacion:</strong> La asamblea revisa y aprueba/rechaza. No se puede aprobar una solicitud sin padrino.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {success && <div className="text-trueque-700 text-sm bg-trueque-50 p-3 rounded-lg">{success}</div>}
      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {showForm && (
        <div className="card space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Heart size={18} /> Apadrinar a un Nuevo Miembro</h2>
          <p className="text-xs text-gray-500">Completa los datos de la persona que vas a apadrinar. Tu seras su padrino y le asignaras parte de tu limite.</p>

          <div>
            <label className="label">Nombre de usuario del ahijado</label>
            <input className="input" placeholder="Ej: maria" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Nombre con el que el ahijado iniciara sesion. Sin espacios ni @.</p>
          </div>

          <div>
            <label className="label">Nombre para mostrar</label>
            <input className="input" placeholder="Ej: Maria Gonzalez" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Nombre real del ahijado como lo veran los demas miembros.</p>
          </div>

          <div className="border-t pt-3">
            <h3 className="font-medium text-sm flex items-center gap-2"><Shield size={16} /> Apadrinamiento</h3>
            <p className="text-xs text-gray-500 mt-1 mb-3">El monto que asignas se descuenta de tu limite (simetrico: +monto y -monto). El ahijado recibe ese mismo monto como su limite.</p>
            <div>
              <label className="label">Monto a apadrinar ({currency})</label>
              <input type="number" className="input" placeholder="Ej: 1000" value={form.sponsor_amount_held} onChange={(e) => setForm({ ...form, sponsor_amount_held: parseFloat(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Cuanto de tu limite le asignas al ahijado. Si tienes 5000 y asignas 1000, te quedan 4000.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Limite de credito solicitado ({currency})</label>
              <input type="number" className="input" value={form.requested_credit_limit} onChange={(e) => setForm({ ...form, requested_credit_limit: parseFloat(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Maximo saldo positivo. La asamblea puede modificarlo.</p>
            </div>
            <div>
              <label className="label">Limite de debito solicitado ({currency})</label>
              <input type="number" className="input" value={form.requested_debit_limit} onChange={(e) => setForm({ ...form, requested_debit_limit: parseFloat(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Maximo saldo negativo. La asamblea puede modificarlo.</p>
            </div>
          </div>

          <div>
            <label className="label">Razon de la solicitud (opcional)</label>
            <textarea className="input" rows={3} placeholder="Ej: Maria es productora de hortalizas y quiere unirse a la feria" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>

          <div className="border-t pt-3">
            <h3 className="font-medium text-sm mb-2">Documentos de Identidad del ahijado (al menos uno obligatorio)</h3>
            <p className="text-xs text-gray-500 mb-3">Agrega los documentos del ahijado: cedula, pasaporte, etc.</p>

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
            <button onClick={submitRequest} className="btn-primary flex items-center gap-2"><Heart size={16} /> Apadrinar</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      {pending.length === 0 && !showForm ? (
        <div className="card text-center text-gray-500 py-8">
          No hay solicitudes de admision.
          <br />
          <span className="text-sm">Apadrina a un nuevo miembro con el boton de arriba.</span>
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
            const hasSponsor = !!u.sponsored_by
            const sponsorAmount = u.sponsor_amount_held || 0
            return (
              <div key={i} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{username}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        status === 'approved' ? 'bg-green-100 text-green-700' :
                        status === 'rejected' || status === 'expired' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {status === 'approved' ? 'Aprobada' : status === 'rejected' ? 'Rechazada' : status === 'expired' ? 'Expirada' : status === 'elevated_to_assembly' ? 'En asamblea' : status === 'defense_pending' ? 'Esperando defensa' : 'Pendiente'}
                      </span>
                      {level && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Nivel: {level}</span>}
                      {hasSponsor ? (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded flex items-center gap-1">
                          <Shield size={12} /> Apadrinado ({fmtTQ(sponsorAmount)} {currency})
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Sin padrino</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{displayName}</p>
                    {reason && <p className="text-xs text-gray-500 mt-1">{reason}</p>}
                    {submittedAt && <p className="text-xs text-gray-400 mt-1">Solicitada: {submittedAt}</p>}
                  </div>
                  <div className="flex gap-2 flex-col">
                    {(status === 'pending' || status === 'pending_review' || status === 'elevated_to_assembly' || status === 'defense_pending') && (
                      <>
                        {!hasSponsor && sponsoringId !== u.id && (
                          <button onClick={() => { setSponsoringId(u.id); setSponsorAmount(100) }} className="btn-secondary flex items-center gap-1 text-sm">
                            <Heart size={16} /> Apadrinar
                          </button>
                        )}
                        {sponsoringId === u.id && (
                          <div className="flex flex-col gap-1 bg-amber-50 p-2 rounded-lg">
                            <label className="text-xs text-gray-600">Monto a apadrinar ({currency}):</label>
                            <input type="number" className="input text-sm" value={sponsorAmount} onChange={(e) => setSponsorAmount(parseFloat(e.target.value) || 0)} />
                            <div className="flex gap-1">
                              <button onClick={() => sponsorExisting(u.id)} className="btn-primary text-xs flex-1">Confirmar</button>
                              <button onClick={() => setSponsoringId(null)} className="btn-secondary text-xs">x</button>
                            </div>
                          </div>
                        )}
                        {hasSponsor && (
                          <button onClick={() => approve(u.id)} className="btn-primary flex items-center gap-1 text-sm"><Check size={16} />Aprobar</button>
                        )}
                        <button onClick={() => reject(u.id)} className="btn-danger flex items-center gap-1 text-sm"><X size={16} />Rechazar</button>
                      </>
                    )}
                  </div>
                </div>
                {!hasSponsor && (status === 'pending' || status === 'pending_review') && (
                  <div className="text-xs text-amber-600 mt-2 border-t pt-2">
                    Esta solicitud no tiene padrino. No se puede aprobar sin padrino. Apadrinala asignando un monto de tu limite.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
