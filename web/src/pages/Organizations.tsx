import { useState, useEffect } from 'react'
import { api } from '../api'
import { Users, Plus, HelpCircle, X } from 'lucide-react'
import { EntitySelector } from '../components/EntitySelector'
import { useConfig } from '../hooks/useConfig'

const ORG_TYPE_OPTIONS = [
  {
    value: 'Grupo de produccion',
    label: 'Grupo de produccion',
    description: 'Fabrica o produce bienes',
  },
  {
    value: 'Grupo de consumo',
    label: 'Grupo de consumo',
    description: 'Compra bienes para distribuir',
  },
  {
    value: 'Comision',
    label: 'Comision',
    description: 'Grupo temporal para una tarea especifica',
  },
  {
    value: 'Proyecto',
    label: 'Proyecto',
    description: 'Iniciativa con objetivo y plazo',
  },
  {
    value: 'Institucion publica',
    label: 'Institucion publica',
    description: 'Sin fines de lucro, exenta de impuestos',
  },
  {
    value: 'Cooperativa',
    label: 'Cooperativa',
    description: 'Propiedad compartida',
  },
]

const DEFAULT_ORG_TYPES = ORG_TYPE_OPTIONS.map((o) => o.value)

const HELP_SECTIONS = [
  {
    title: 'Que son las organizaciones',
    body: 'Las organizaciones son grupos internos de la comunidad. No son tipos legales externos. Cada comunidad define sus propios tipos segun sus necesidades. Permiten agrupar personas para producir, consumir, gestionar o ejecutar tareas conjuntas.',
  },
  {
    title: 'Que tipos existen',
    body: 'Grupo de produccion (fabrica o produce bienes), Grupo de consumo (compra bienes para distribuir), Comision (grupo temporal para una tarea especifica), Proyecto (iniciativa con objetivo y plazo), Institucion publica (sin fines de lucro, exenta de impuestos) y Cooperativa (propiedad compartida).',
  },
  {
    title: 'Que es la junta directiva de una organizacion',
    body: 'La junta directiva es el grupo de personas elegidas para dirigir y representar a la organizacion. Se encarga de coordinar las actividades, administrar los recursos y tomar decisiones en nombre de los miembros.',
  },
  {
    title: 'Como se toman decisiones en una organizacion',
    body: 'Las decisiones pueden tomarse por consenso, votacion o delegacion segun los estatutos de cada organizacion. Generalmente la asamblea de miembros define las reglas y la junta directiva ejecuta lo acordado.',
  },
]

export default function Organizations() {
  const { currency } = useConfig()
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
        <div className="card space-y-3 relative">
          <button
            onClick={() => setShowHelp(false)}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            title="Cerrar"
          >
            <X size={18} />
          </button>
          <div className="flex items-start gap-2">
            <HelpCircle size={18} className="text-trueque-600 mt-0.5 shrink-0" />
            <div className="space-y-3">
              {HELP_SECTIONS.map((section, i) => (
                <div key={i}>
                  <h4 className="text-sm font-semibold text-gray-800">{section.title}</h4>
                  <p className="text-sm text-gray-700 mt-0.5">{section.body}</p>
                </div>
              ))}
            </div>
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
            <EntitySelector
              label="Usuario"
              helpText="Selecciona el usuario existente que representara a esta organizacion. Busca por nombre de usuario o nombre para mostrar."
              placeholder="Ej: juan_perez, maria_gomez..."
              value={form.username}
              onChange={(value) => setForm({ ...form, username: value })}
              endpoint="/accounts"
              valueKey="id"
              labelKey="username"
              subLabelKey="display_name"
              emptyMessage="No se encontraron usuarios"
            />
            <div>
              <label className="label">Nombre</label>
              <input
                className="input"
                placeholder="Ej: Cooperativa Norte, Panaderia Unida"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-1">
                Nombre de la organizacion. Ej: Cooperativa Norte, Panaderia Unida
              </p>
            </div>
            <div>
              <label className="label">Tipo de organizacion</label>
              <select
                className="input"
                value={form.organization_subtype}
                onChange={(e) => setForm({ ...form, organization_subtype: e.target.value })}
              >
                {ORG_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} - {opt.description}
                  </option>
                ))}
                {orgTypes
                  .filter((t) => !DEFAULT_ORG_TYPES.includes(t))
                  .map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Selecciona el tipo de organizacion segun su funcion dentro de la comunidad.
              </p>
            </div>
            <div>
              <label className="label">Tasa impositiva %</label>
              <input
                type="number"
                className="input"
                placeholder="Ej: 0, 5, 10"
                value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-gray-400 mt-1">
                Porcentaje de impuesto que aplica a las transacciones de esta organizacion.
              </p>
            </div>
            <div>
              <label className="label">Limite credito ({currency})</label>
              <input
                type="number"
                className="input"
                placeholder={`Ej: -20000 (${currency})`}
                value={form.credit_limit}
                onChange={(e) => setForm({ ...form, credit_limit: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-gray-400 mt-1">
                Monto maximo en {currency} que la organizacion puede tener como credito (saldo
                negativo permitido).
              </p>
            </div>
            <div>
              <label className="label">Limite debito ({currency})</label>
              <input
                type="number"
                className="input"
                placeholder={`Ej: 20000 (${currency})`}
                value={form.debit_limit}
                onChange={(e) => setForm({ ...form, debit_limit: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-gray-400 mt-1">
                Monto maximo en {currency} que la organizacion puede tener como debito (saldo
                positivo permitido).
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-3 space-y-2">
            <label className="label">Crear nuevo tipo de organizacion</label>
            <p className="text-xs text-gray-400 -mt-1">
              Agrega un tipo personalizado si los predefinidos no cubren las necesidades de tu
              comunidad.
            </p>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Ej: Mutual, Sindicato, Asociacion..."
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
