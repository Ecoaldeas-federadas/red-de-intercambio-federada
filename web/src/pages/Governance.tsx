import { useState, useEffect } from 'react'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { useTranslation } from 'react-i18next'
import { Scale, Plus, Edit2, Trash2, HelpCircle, X, CheckCircle, XCircle, AlertTriangle, Info, FileText, Shield } from 'lucide-react'

interface GovernanceRule {
  id: string
  category: string
  title: string
  description: string
  severity: string
  icon: string
  sort_order: number
  is_active: boolean
  rule_type: string
}

const CATEGORIES = [
  { value: 'estructura', labelKey: 'governance.cat_estructura', label: 'Estructura de Gobernanza' },
  { value: 'deberes', labelKey: 'governance.cat_deberes', label: 'Deberes' },
  { value: 'permitido', labelKey: 'governance.cat_permitido', label: 'Permitido' },
  { value: 'prohibido', labelKey: 'governance.cat_prohibido', label: 'Prohibido' },
  { value: 'faltas_leves', labelKey: 'governance.cat_faltas_leves', label: 'Faltas Leves' },
  { value: 'faltas_graves', labelKey: 'governance.cat_faltas_graves', label: 'Faltas Graves' },
  { value: 'faltas_muy_graves', labelKey: 'governance.cat_faltas_muy_graves', label: 'Faltas Muy Graves (Expulsion)' },
  { value: 'admision', labelKey: 'governance.cat_admision', label: 'Proceso de Admision' },
  { value: 'salida', labelKey: 'governance.cat_salida', label: 'Proceso de Salida' },
  { value: 'impuestos', labelKey: 'governance.cat_impuestos', label: 'Impuestos' },
  { value: 'tierra', labelKey: 'governance.cat_tierra', label: 'Tenencia de la Tierra' },
  { value: 'unidades_productivas', labelKey: 'governance.cat_unidades_productivas', label: 'Unidades Productivas' },
  { value: 'bienestar', labelKey: 'governance.cat_bienestar', label: 'Bienestar Comunitario' },
  { value: 'aprendizaje', labelKey: 'governance.cat_aprendizaje', label: 'Aprendizaje y Conocimiento' },
  { value: 'convivencia', labelKey: 'governance.cat_convivencia', label: 'Convivencia y Cultura' },
]

const RULE_TYPES = [
  { value: 'permiso', labelKey: 'governance.type_permiso', label: 'Permiso', descKey: 'governance.type_permiso_desc', desc: 'Cosas que SE PUEDEN hacer', color: 'text-green-700 bg-green-100', icon: CheckCircle },
  { value: 'prohibicion', labelKey: 'governance.type_prohibicion', label: 'Prohibicion', descKey: 'governance.type_prohibicion_desc', desc: 'Cosas que NO SE PUEDEN hacer', color: 'text-red-700 bg-red-100', icon: XCircle },
  { value: 'deber', labelKey: 'governance.type_deber', label: 'Deber', descKey: 'governance.type_deber_desc', desc: 'Obligaciones de los miembros', color: 'text-blue-700 bg-blue-100', icon: Shield },
  { value: 'informativo', labelKey: 'governance.type_informativo', label: 'Informativo', descKey: 'governance.type_informativo_desc', desc: 'Informacion general o estructura', color: 'text-gray-700 bg-gray-100', icon: Info },
  { value: 'falta', labelKey: 'governance.type_falta', label: 'Falta / Sancion', descKey: 'governance.type_falta_desc', desc: 'Infracciones y sus consecuencias', color: 'text-orange-700 bg-orange-100', icon: AlertTriangle },
  { value: 'proceso', labelKey: 'governance.type_proceso', label: 'Proceso', descKey: 'governance.type_proceso_desc', desc: 'Procedimientos (admision, salida, votacion)', color: 'text-purple-700 bg-purple-100', icon: FileText },
]

const SEVERITIES = [
  { value: 'info', labelKey: 'governance.sev_info', label: 'Informativo', color: 'text-blue-600 bg-blue-50' },
  { value: 'leve', labelKey: 'governance.sev_leve', label: 'Leve', color: 'text-yellow-600 bg-yellow-50' },
  { value: 'grave', labelKey: 'governance.sev_grave', label: 'Grave', color: 'text-orange-600 bg-orange-50' },
  { value: 'muy_grave', labelKey: 'governance.sev_muy_grave', label: 'Muy Grave', color: 'text-red-600 bg-red-50' },
]

export default function Governance() {
  const { hasPermission } = usePermissions()
  const { t, i18n } = useTranslation('assembly')
  const [rules, setRules] = useState<GovernanceRule[]>([])
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingRule, setEditingRule] = useState<GovernanceRule | null>(null)
  const [error, setError] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [formData, setFormData] = useState({
    category: 'estructura',
    rule_type: 'informativo',
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
      const data = await api.get<any>(`/governance/rules?lang=${i18n.language}`)
      setRules(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setError(e instanceof Error ? e.message : t('governance.error_load', 'Error al cargar reglas'))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingRule) {
        const res: any = await api.put(`/governance/rules/${editingRule.id}`, formData)
        setSuccessMsg(res?.message || t('governance.success_default', 'Propuesta enviada a la asamblea'))
      } else {
        const res: any = await api.post('/governance/rules', formData)
        setSuccessMsg(res?.message || t('governance.success_default', 'Propuesta enviada a la asamblea'))
      }
      setShowCreate(false)
      setEditingRule(null)
      setFormData({ category: 'estructura', rule_type: 'informativo', title: '', description: '', severity: 'info', icon: 'info', sort_order: 0, voting_duration_minutes: 1440 })
      loadRules()
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch (e: any) {
      setError(e instanceof Error ? e.message : t('governance.error_save', 'Error al guardar'))
    }
  }

  const handleEdit = (rule: GovernanceRule) => {
    setEditingRule(rule)
    setFormData({
      category: rule.category,
      rule_type: rule.rule_type || 'informativo',
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
    if (!confirm(t('governance.confirm_delete', 'Eliminar esta regla? Se creara una propuesta para que la asamblea lo apruebe.'))) return
    try {
      const res: any = await api.delete(`/governance/rules/${id}`)
      setSuccessMsg(res?.message || t('governance.success_delete', 'Propuesta de eliminacion enviada a la asamblea'))
      loadRules()
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch (e: any) {
      setError(e instanceof Error ? e.message : t('governance.error_delete', 'Error al eliminar'))
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
            <h1 className="text-2xl font-bold">{t('governance.title', 'Gobernanza - Ley de la Aldea')}</h1>
            <p className="text-sm text-gray-500">{t('governance.subtitle', 'Reglas de convivencia, estructura de gobierno, deberes, prohibiciones y procesos')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
          {canManage && (
            <button
              onClick={() => { setEditingRule(null); setFormData({ category: 'estructura', rule_type: 'informativo', title: '', description: '', severity: 'info', icon: 'info', sort_order: 0, voting_duration_minutes: 1440 }); setShowCreate(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-trueque-600 text-white rounded-lg hover:bg-trueque-700"
            >
              <Plus size={18} /> {t('governance.new_rule', 'Nueva Regla')}
            </button>
          )}
        </div>
      </div>

      {showHelp && (
        <div className="card mb-6 text-sm space-y-2">
          <h2 className="font-bold text-base">{t('governance.help_what_title', '¿Que es esta pagina?')}</h2>
          <p>{t('governance.help_what', 'Aqui se definen las reglas de convivencia de la aldea: la "Ley de la Aldea".')}</p>
          <p><strong>{t('governance.help_purpose_title', '¿Para que sirve?')}</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>{t('governance.help_purpose_1', 'Definir como se gobierna la aldea (estructura, asamblea, circulos)')}</li>
            <li>{t('governance.help_purpose_2', 'Listar los deberes de los miembros (cayapa, agroecologia, TQ)')}</li>
            <li>{t('governance.help_purpose_3', 'Definir lo que esta permitido y prohibido')}</li>
            <li>{t('governance.help_purpose_4', 'Establecer faltas, sanciones y causales de expulsion')}</li>
            <li>{t('governance.help_purpose_5', 'Documentar el proceso de admision y salida')}</li>
            <li>{t('governance.help_purpose_6', 'Explicar impuestos y tenencia de la tierra')}</li>
          </ul>
          <p><strong>{t('governance.help_who_title', '¿Quien la ve?')}</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>{t('governance.help_who_1', 'La pagina publica /p/gobernanza muestra estas reglas a todos')}</li>
            <li>{t('governance.help_who_2', 'El formulario de admision muestra las reglas antes de aceptar')}</li>
            <li>{t('governance.help_who_3', 'Los miembros pueden consultarlas en cualquier momento')}</li>
          </ul>
          <p><strong>{t('governance.help_edit_title', '¿Como se edita?')}</strong></p>
          <p>{t('governance.help_edit', 'Puedes agregar, editar o eliminar reglas. Las reglas se agrupan por categoria y se ordenan por el numero de orden.')}</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline block pt-2">{t('governance.close_help', 'Cerrar ayuda')}</button>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{error}</div>}
      {successMsg && (
        <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg mb-4 border border-emerald-200">
          <strong>{successMsg}</strong>
          <p className="text-xs mt-1"><a href="/app/assembly" className="underline">{t('governance.success_proposal', 'Ve a Asamblea para ver la propuesta y votar.')}</a></p>
        </div>
      )}

      {/* Aviso: cambios requieren aprobacion de asamblea */}
      {canManage && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-lg mb-4 text-sm">
          <strong>{t('governance.important_label', 'Importante:')}</strong> {t('governance.important_notice', 'Cualquier cambio a las reglas de gobernanza (crear, modificar o eliminar) requiere aprobacion de la Asamblea General. Al hacer un cambio, se crea una propuesta que debe ser votada y aprobada. La regla no se activara hasta que la asamblea la apruebe.')}
        </div>
      )}

      {/* Filtro por categoria */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterCategory('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${!filterCategory ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          {t('governance.all_categories', 'Todas')} ({rules.length})
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
              {t(cat.labelKey, cat.label)} ({count})
            </button>
          )
        })}
      </div>

      {/* Lista de reglas agrupadas por categoria */}
      <div className="space-y-6">
        {groupedRules.map(group => (
          <div key={group.value} className="card">
            <h2 className="text-lg font-semibold mb-3 text-trueque-700">{t(group.labelKey, group.label)}</h2>
            <div className="space-y-2">
              {group.rules.map(rule => {
                const severity = SEVERITIES.find(s => s.value === rule.severity) || SEVERITIES[0]
                const ruleType = RULE_TYPES.find(rt => rt.value === rule.rule_type) || RULE_TYPES[3]
                const TypeIcon = ruleType.icon
                return (
                  <div key={rule.id} className="flex items-start justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${ruleType.color}`}>
                          <TypeIcon size={12} />
                          {t(ruleType.labelKey, ruleType.label)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${severity.color}`}>{t(severity.labelKey, severity.label)}</span>
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
              <h2 className="text-lg font-bold">{editingRule ? t('governance.edit_rule', 'Editar Regla') : t('governance.new_rule', 'Nueva Regla')}</h2>
              <button onClick={() => { setShowCreate(false); setEditingRule(null) }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Tipo de regla - campo principal */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('governance.rule_type_label')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {RULE_TYPES.map(rt => {
                    const Icon = rt.icon
                    const selected = formData.rule_type === rt.value
                    return (
                      <button
                        key={rt.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, rule_type: rt.value })}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs font-medium transition ${selected ? `${rt.color} border-current` : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                      >
                        <Icon size={16} />
                        <div className="text-left">
                          <div>{rt.label}</div>
                          <div className="text-[10px] opacity-70">{rt.desc}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('governance.category_label')}</label>
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
                <label className="block text-sm font-medium mb-1">{t('governance.title_label')}</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('governance.description_label')}</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg min-h-[100px]"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('governance.severity_label')}</label>
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
                  <label className="block text-sm font-medium mb-1">{t('governance.icon_label')}</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={e => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="info"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('governance.order_label')}</label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setEditingRule(null) }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  {t('governance.cancel')}
                </button>
                <button type="submit" className="px-4 py-2 bg-trueque-600 text-white rounded-lg hover:bg-trueque-700">
                  {editingRule ? t('common:save') : t('governance.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
