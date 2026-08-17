import { useState, useEffect } from 'react'
import { api } from '../api'
import { Users, Plus, HelpCircle, X } from 'lucide-react'

const DEFAULT_ORG_TYPES = ['Grupo de produccion', 'Grupo de consumo', 'Comision', 'Proyecto']

const HELP_TEXT =
  'Las organizaciones son grupos internos de la comunidad. No son tipos legales externos. Cada comunidad define sus propios tipos segun sus necesidades.'

export default function Organizations() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [orgTypes, setOrgTypes] = useState<string[]>(DEFAULT_ORG_TYPES)
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [newType, setNewType] = useState('')
  const [form, setForm] = useState({
    username: '',
    display_name: '',
    organization_subtype: DEFAULT_ORG_TYPES[0],
    credit_limit: 0,
    debit_limit: 0,
    tax_rate: 0,
    public_key: '',
  })

  const loadOrgs = () =>
    api.get('/organizations').then((d: any) => setOrgs(Array.isArray(d) ? d : [])).catch(() => {})

  const loadTypes = async () => {
    try {
      const res = await fetch('/api/organizations/types', {
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.status === 404) {
        setOrgTypes(DEFAULT_ORG_TYPES)
        return
      }
      if (!res.ok) {
        setOrgTypes(DEFAULT_ORG_TYPES)
        return
      }
      const data = await res.json()
      const types = Array.isArray(data) ? data : data?.types
      if (Array.isArray(types) && types.length > 0) {
        setOrgTypes(types)
      } else {
        setOrgTypes(DEFAULT_ORG_TYPES)
      }
    } catch {
      setOrgTypes(DEFAULT_ORG_TYPES)
    }
  }

  useEffect(() => {
    loadOrgs()
    loadTypes()
  }, [])

  const create = async () => {
    await api.post('/organizations', form)
    setShowForm(false)
    setForm({
      username: '',
      display_name: '',
      organization_subtype: orgTypes[0] || DEFAULT_ORG_TYPES[0],
      credit_limit: 0,
      debit_limit: 0,
      tax_rate: 0,
      public_key: '',
    })
    loadOrgs()
  }

  const approve = async (id: string) => {
    await api.post(`/organizations/${id}/approve`, {})
    loadOrgs()
  }

  const addType = async () => {
    const trimmed = newType.trim()
    if (!trimmed || orgTypes.includes(trimmed)) {
      setNewType('')
      return
    }
    const updated = [...orgTypes, trimmed]
    setOrgTypes(updated)
    setNewType('')
    // Persist the new type (best-effort; ignore failures)
    try {
      await api.post('/organizations/types', { type: trimmed })
      loadTypes()
    } catch {
      // endpoint may not exist yet; keep the local type
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Organizaciones</h1>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="btn-secondary flex items-center gap-1 text-sm"
            title="Ayuda"
          >
            <HelpCircle size={16} /> ?
          </button>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nueva
        </button>
      </div>

      {showHelp && (
        <div className="card space-y-2 relative">
          <button
            onClick={() => setShowHelp(false)}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            title="Cerrar"
          >
            <X size={18} />
          </button>
          <div className="flex items-start gap-2">
            <HelpCircle size={18} className="text-trueque-600 mt-0.5 shrink-0" />
            <p className="text-sm text-gray-700">{HELP_TEXT}</p>
          </div>
        </div>
      )}

      <div className="card bg-trueque-50 border-trueque-200">
        <p className="text-sm text-trueque-800">
          Las organizaciones son grupos internos de la comunidad. No son tipos legales externos. Cada
          comunidad define sus propios tipos segun sus necesidades.
        </p>
      </div>

      {showForm && (
        <div className="card space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Usuario</label>
              <input
                className="input"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Nombre</label>
              <input
                className="input"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Tipo de organizacion</label>
              <select
                className="input"
                value={form.organization_subtype}
                onChange={(e) => setForm({ ...form, organization_subtype: e.target.value })}
              >
                {orgTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tasa impositiva %</label>
              <input
                type="number"
                className="input"
                value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="label">Limite credito</label>
              <input
                type="number"
                className="input"
                value={form.credit_limit}
                onChange={(e) => setForm({ ...form, credit_limit: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="label">Limite debito</label>
              <input
                type="number"
                className="input"
                value={form.debit_limit}
                onChange={(e) => setForm({ ...form, debit_limit: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-3 space-y-2">
            <label className="label">Crear nuevo tipo de organizacion</label>
            <div className="flex gap-2">
              <input
                className="input"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addType()
                  }
                }}
              />
              <button onClick={addType} className="btn-secondary flex items-center gap-1 whitespace-nowrap">
                <Plus size={16} /> Agregar tipo
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {orgTypes.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 border border-gray-200"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <button onClick={create} className="btn-primary">
            Crear Organizacion
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {orgs.map((org, i) => (
          <div key={i} className="card">
            <div className="flex items-center gap-2 mb-2">
              <Users size={20} className="text-trueque-600" />
              <h3 className="font-semibold">{org.display_name}</h3>
            </div>
            <p className="text-sm text-gray-600">@{org.username}</p>
            <p className="text-xs text-gray-400 mt-1">Tipo: {org.organization_subtype}</p>
            <div className="flex items-center justify-between mt-3">
              <span
                className={`text-xs px-2 py-1 rounded ${
                  org.membership_status === 'active'
                    ? 'bg-trueque-100 text-trueque-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {org.membership_status}
              </span>
              {org.membership_status === 'pending' && (
                <button onClick={() => approve(org.id)} className="btn-secondary text-sm">
                  Aprobar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
