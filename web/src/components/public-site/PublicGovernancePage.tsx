import { useState, useEffect } from 'react'
import { api } from '../../api'
import { Scale, AlertTriangle, AlertOctagon, Ban, Info, CheckCircle, XCircle, Users, Home, Leaf, Coins, Calendar, UserPlus, UserX, Percent, PiggyBank, Map, Key, FileText, Globe, Network, Building2 } from 'lucide-react'

const CATEGORIES = [
  { value: 'estructura', label: 'Estructura de Gobernanza', icon: Users, color: 'text-blue-700 bg-blue-50' },
  { value: 'deberes', label: 'Deberes', icon: CheckCircle, color: 'text-emerald-700 bg-emerald-50' },
  { value: 'permitido', label: 'Permitido', icon: CheckCircle, color: 'text-green-700 bg-green-50' },
  { value: 'prohibido', label: 'Prohibido', icon: XCircle, color: 'text-red-700 bg-red-50' },
  { value: 'faltas_leves', label: 'Faltas Leves', icon: AlertTriangle, color: 'text-yellow-700 bg-yellow-50' },
  { value: 'faltas_graves', label: 'Faltas Graves', icon: AlertOctagon, color: 'text-orange-700 bg-orange-50' },
  { value: 'faltas_muy_graves', label: 'Faltas Muy Graves (Expulsion)', icon: Ban, color: 'text-red-800 bg-red-100' },
  { value: 'admision', label: 'Proceso de Admision', icon: UserPlus, color: 'text-blue-700 bg-blue-50' },
  { value: 'salida', label: 'Proceso de Salida', icon: UserX, color: 'text-gray-700 bg-gray-50' },
  { value: 'impuestos', label: 'Impuestos', icon: Percent, color: 'text-purple-700 bg-purple-50' },
  { value: 'tierra', label: 'Tenencia de la Tierra', icon: Map, color: 'text-amber-700 bg-amber-50' },
  { value: 'unidades_productivas', label: 'Unidades Productivas', icon: FileText, color: 'text-teal-700 bg-teal-50' },
  { value: 'bienestar', label: 'Bienestar Comunitario', icon: Info, color: 'text-pink-700 bg-pink-50' },
  { value: 'aprendizaje', label: 'Aprendizaje y Conocimiento', icon: FileText, color: 'text-indigo-700 bg-indigo-50' },
  { value: 'convivencia', label: 'Convivencia y Cultura', icon: Users, color: 'text-rose-700 bg-rose-50' },
]

const SEVERITY_STYLES: Record<string, { label: string; class: string }> = {
  info: { label: 'Informativo', class: 'bg-blue-100 text-blue-700' },
  leve: { label: 'Leve', class: 'bg-yellow-100 text-yellow-700' },
  grave: { label: 'Grave', class: 'bg-orange-100 text-orange-700' },
  muy_grave: { label: 'Muy Grave', class: 'bg-red-100 text-red-700' },
}

export function PublicGovernancePage() {
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('')

  useEffect(() => {
    api
      .get('/public/governance')
      .then((data: any) => {
        if (Array.isArray(data)) {
          setRules(data)
          if (data.length > 0) {
            setActiveCategory(data[0].category)
          }
        }
        setLoading(false)
      })
      .catch(() => {
        setError('No se pudieron cargar las reglas de gobernanza.')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="text-center py-24 space-y-3">
        <div className="w-10 h-10 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin mx-auto" />
        <p className="text-gray-500 font-medium text-xs">Cargando Ley de la Aldea...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-3">
        <Scale size={48} className="mx-auto text-gray-400" />
        <p className="text-gray-600 text-sm">{error}</p>
      </div>
    )
  }

  if (rules.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-3">
        <Scale size={48} className="mx-auto text-gray-400" />
        <h2 className="text-xl font-bold text-gray-800">Sin reglas publicadas</h2>
        <p className="text-gray-600 text-sm">
          Las reglas de gobernanza se publicaran cuando la asamblea las apruebe.
        </p>
      </div>
    )
  }

  // Agrupar reglas por categoria
  const groupedRules = CATEGORIES.map((cat) => ({
    ...cat,
    rules: rules.filter((r) => r.category === cat.value).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
  })).filter((g) => g.rules.length > 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-3 pb-6 border-b border-gray-200">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full">
          <Scale className="text-emerald-700" size={32} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Ley de la Aldea</h1>
        <p className="text-gray-600 text-sm max-w-2xl mx-auto">
          Reglas de convivencia aprobadas en Asamblea General. Estas normas rigen la vida comunitaria:
          estructura de gobierno, deberes, permisos, prohibiciones, faltas y procesos de admision y salida.
        </p>
        <p className="text-xs text-gray-400">
          {rules.length} reglas vigentes - Cualquier modificacion requiere aprobacion de la Asamblea General
        </p>
      </div>

      {/* Tres niveles de gobernanza */}
      <div className="bg-gradient-to-b from-gray-50 to-white rounded-2xl p-6 border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">Tres Niveles de Gobernanza</h2>
        <p className="text-xs text-gray-500 text-center mb-4 max-w-2xl mx-auto">
          El sistema tiene tres niveles. Cada uno es independiente internamente pero sujeto al
          nivel superior. Las reglas de abajo son del Nivel 2 (Aldea). El Nivel 1 (Federacion) y
          el Nivel 3 (Organizaciones) se gestionan por separado.
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="text-blue-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">1. Federacion (mundial)</h3>
            </div>
            <p className="text-xs text-gray-600">
              Decisiones que afectan a todos los nodos del mundo. Por votacion de todos los nodos.
              Ej: canasta basica TQ, expulsion de nodos, protocolo de comunicacion.
            </p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 ring-2 ring-emerald-300">
            <div className="flex items-center gap-2 mb-2">
              <Network className="text-emerald-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">2. Aldea / Nodo (local)</h3>
              <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">Aqui</span>
            </div>
            <p className="text-xs text-gray-600">
              Decisiones que afectan a toda la comunidad local. Por asamblea del nodo.
              Ej: sueldos, horarios, catalogo, admision, tasas, reglas de convivencia.
            </p>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="text-purple-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">3. Organizaciones</h3>
            </div>
            <p className="text-xs text-gray-600">
              Decisiones que afectan solo dentro de cada organizacion. Por su asamblea interna.
              Ej: reglas internas, departamentos, roles. Sujetas a las reglas de la aldea.
            </p>
          </div>
        </div>
      </div>

      {/* Navegacion por categorias */}
      <div className="flex flex-wrap gap-2 justify-center">
        {groupedRules.map((cat) => {
          const Icon = cat.icon
          const isActive = activeCategory === cat.value
          return (
            <button
              key={cat.value}
              onClick={() => {
                setActiveCategory(cat.value)
                document.getElementById(`cat-${cat.value}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                isActive ? 'bg-emerald-700 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Icon size={14} />
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* Reglas por categoria */}
      <div className="space-y-8">
        {groupedRules.map((cat) => {
          const Icon = cat.icon
          return (
            <div key={cat.value} id={`cat-${cat.value}`} className="scroll-mt-20">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cat.color}`}>
                  <Icon size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{cat.label}</h2>
                  <p className="text-xs text-gray-500">{cat.rules.length} reglas</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {cat.rules.map((rule: any, i: number) => {
                  const sev = SEVERITY_STYLES[rule.severity] || SEVERITY_STYLES.info
                  return (
                    <div
                      key={rule.id || i}
                      className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-sm text-gray-900">{rule.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${sev.class}`}>
                          {sev.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{rule.description}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="text-center pt-6 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Estas reglas son vinculantes para todos los miembros de la aldea.
          Para solicitar modificaciones, contacta a la Junta Directiva o presenta una propuesta en la proxima Asamblea General.
        </p>
      </div>
    </div>
  )
}
