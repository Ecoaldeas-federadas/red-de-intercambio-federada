import { useState, useEffect } from 'react'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { Scale, Plus, Edit2, Trash2, HelpCircle, X } from 'lucide-react'

interface GovernanceRule {
  id: string
  category: string
  title: string
  description: string
  severity: string
  icon: string
  sort_order: number
  is_active: boolean
}

const CATEGORIES = [
  { value: 'estructura', label: 'Estructura de Gobernanza' },
  { value: 'deberes', label: 'Deberes' },
  { value: 'permitido', label: 'Permitido' },
  { value: 'prohibido', label: 'Prohibido' },
  { value: 'faltas_leves', label: 'Faltas Leves' },
  { value: 'faltas_graves', label: 'Faltas Graves' },
  { value: 'faltas_muy_graves', label: 'Faltas Muy Graves (Expulsion)' },
  { value: 'admision', label: 'Proceso de Admision' },
  { value: 'salida', label: 'Proceso de Salida' },
  { value: 'impuestos', label: 'Impuestos' },
  { value: 'tierra', label: 'Tenencia de la Tierra' },
]

const SEVERITIES = [
  { value: 'info', label: 'Informativo', color: 'text-blue-600 bg-blue-50' },
  { value: 'leve', label: 'Leve', color: 'text-yellow-600 bg-yellow-50' },
  { value: 'grave', label: 'Grave', color: 'text-orange-600 bg-orange-50' },
  { value: 'muy_grave', label: 'Muy Grave', color: 'text-red-600 bg-red-50' },
]

export default function Governance() {
  const { hasPermission } = usePermissions()
  const [rules, setRules] = useState<GovernanceRule[]>([])
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingRule, setEditingRule] = useState<GovernanceRule | null>(null)
  const [error, setError] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [formData, setFormData] = useState({
    category: 'estructura',
    title: '',
    description: '',
    severity: 'info',
    icon: 'info',
    sort_order: 0,
    voting_duration_minutes: 1440,
  })

  const canManage = hasPermission('governance.manage') || hasPermission('config.manage')

  useEffect(() => {
    loadRules()
  }, [])

  const loadRules = async () => {
    try {
      const res = await api.get('/api/governance/rules')
      setRules(res.data || [])
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al cargar reglas')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingRule) {
        const res = await api.put(`/api/governance/rules/${editingRule.id}`, formData)
        setSuccessMsg(res.data?.message || 'Propuesta enviada a la asamblea')
      } else {
        const res = await api.post('/api/governance/rules', formData)
        setSuccessMsg(res.data?.message || 'Propuesta enviada a la asamblea')
      }
      setShowCreate(false)
      setEditingRule(null)
      setFormData({ category: 'estructura', title: '', description: '', severity: 'info', icon: 'info', sort_order: 0, voting_duration_minutes: 1440 })
      loadRules()
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al guardar')
    }
  }

  const handleEdit = (rule: GovernanceRule) => {
    setEditingRule(rule)
    setFormData({
      category: rule.category,
      title: rule.title,
      description: rule.description,
      severity: rule.severity,
      icon: rule.icon,
      sort_order: rule.sort_order,
      voting_duration_minutes: 1440,
    })
    setShowCreate(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta regla? Se creara una propuesta para que la asamblea lo apruebe.')) return
    try {
      const res = await api.delete(`/api/governance/rules/${id}`)
      setSuccessMsg(res.data?.message || 'Propuesta de eliminacion enviada a la asamblea')
      loadRules()
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al eliminar')
    }
  }

  const filteredRules = filterCategory ? rules.filter(r => r.category === filterCategory) : rules

  const groupedRules = CATEGORIES.map(cat => ({
    ...cat,
    rules: filteredRules.filter(r => r.category === cat.value)
  })).filter(g => g.rules.length > 0)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Scale className="text-trueque-600" size={28} />
          <div>
            <h1 className="text-2xl font-bold">Gobernanza - Ley de la Aldea</h1>
            <p className="text-sm text-gray-500">Reglas de convivencia, estructura de gobierno, deberes, prohibiciones y procesos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
          {canManage && (
            <button
              onClick={() => { setEditingRule(null); setFormData({ category: 'estructura', title: '', description: '', severity: 'info', icon: 'info', sort_order: 0, voting_duration_minutes: 1440 }); setShowCreate(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-trueque-600 text-white rounded-lg hover:bg-trueque-700"
            >
              <Plus size={18} /> Nueva Regla
            </button>
          )}
        </div>
      </div>

      {showHelp && (
        <div className="card mb-6 text-sm space-y-2">
          <h2 className="font-bold text-base">¿Que es esta pagina?</h2>
          <p>Aqui se definen las reglas de convivencia de la aldea: la "Ley de la Aldea".</p>
          <p><strong>¿Para que sirve?</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Definir como se gobierna la aldea (estructura, asamblea, circulos)</li>
            <li>Listar los deberes de los miembros (cayapa, agroecologia, TQ)</li>
            <li>Definir lo que esta permitido y prohibido</li>
            <li>Establecer faltas, sanciones y causales de expulsion</li>
            <li>Documentar el proceso de admision y salida</li>
            <li>Explicar impuestos y tenencia de la tierra</li>
          </ul>
          <p><strong>¿Quien la ve?</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>La pagina publica /p/gobernanza muestra estas reglas a todos</li>
            <li>El formulario de admision muestra las reglas antes de aceptar</li>
            <li>Los miembros pueden consultarlas en cualquier momento</li>
          </ul>
          <p><strong>¿Como se edita?</strong></p>
          <p>Puedes agregar, editar o eliminar reglas. Las reglas se agrupan por categoria y se ordenan por el numero de orden.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline block pt-2">Cerrar ayuda</button>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{error}</div>}
      {successMsg && (
        <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg mb-4 border border-emerald-200">
          <strong>{successMsg}</strong>
          <p className="text-xs mt-1">Ve a <a href="/app/assembly" className="underline">Asamblea</a> para ver la propuesta y votar.</p>
        </div>
      )}

      {/* Aviso: cambios requieren aprobacion de asamblea */}
      {canManage && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-lg mb-4 text-sm">
          <strong>Importante:</strong> Cualquier cambio a las reglas de gobernanza (crear, modificar o eliminar) requiere aprobacion de la Asamblea General.
          Al hacer un cambio, se crea una propuesta que debe ser votada y aprobada. La regla no se activara hasta que la asamblea la apruebe.
        </div>
      )}

      {/* Filtro por categoria */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterCategory('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${!filterCategory ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          Todas ({rules.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = rules.filter(r => r.category === cat.value).length
          if (count === 0) return null
          return (
            <button
              key={cat.value}
              onClick={() => setFilterCategory(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filterCategory === cat.value ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {cat.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Lista de reglas agrupadas por categoria */}
      <div className="space-y-6">
        {groupedRules.map(group => (
          <div key={group.value} className="card">
            <h2 className="text-lg font-semibold mb-3 text-trueque-700">{group.label}</h2>
            <div className="space-y-2">
              {group.rules.map(rule => {
                const severity = SEVERITIES.find(s => s.value === rule.severity) || SEVERITIES[0]
                return (
                  <div key={rule.id} className="flex items-start justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${severity.color}`}>{severity.label}</span>
                        <span className="font-medium">{rule.title}</span>
                        <span className="text-xs text-gray-400">#{rule.sort_order}</span>
                      </div>
                      <p className="text-sm text-gray-600">{rule.description}</p>
                    </div>
                    {canManage && (
                      <div className="flex gap-1 ml-2">
                        <button onClick={() => handleEdit(rule)} className="text-gray-400 hover:text-blue-600">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(rule.id)} className="text-gray-400 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Modal crear/editar */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">{editingRule ? 'Editar Regla' : 'Nueva Regla'}</h2>
              <button onClick={() => { setShowCreate(false); setEditingRule(null) }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Categoria</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Titulo</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descripcion</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg min-h-[100px]"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Severidad</label>
                  <select
                    value={formData.severity}
                    onChange={e => setFormData({ ...formData, severity: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {SEVERITIES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Icono</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={e => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="info"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Orden</label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tiempo limite para votacion en asamblea</label>
                <select
                  value={formData.voting_duration_minutes}
                  onChange={e => setFormData({ ...formData, voting_duration_minutes: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value={5}>5 minutos (asamblea presencial)</option>
                  <option value={10}>10 minutos (asamblea presencial)</option>
                  <option value={30}>30 minutos (discusion extendida)</option>
                  <option value={60}>1 hora</option>
                  <option value={1440}>24 horas (votacion remota)</option>
                  <option value={10080}>7 dias (consulta prolongada)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Cuando se venza el tiempo, la propuesta se rechaza. Para revotar hay que crear una nueva.</p>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setEditingRule(null) }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-trueque-600 text-white rounded-lg hover:bg-trueque-700">
                  {editingRule ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
