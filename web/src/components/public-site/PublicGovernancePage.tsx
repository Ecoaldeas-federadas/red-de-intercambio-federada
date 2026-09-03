import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { Scale, AlertTriangle, AlertOctagon, Ban, Info, CheckCircle, XCircle, Users, Home, Leaf, Coins, Calendar, UserPlus, UserX, Percent, PiggyBank, Map, Key, FileText, Globe, Network, Building2, Shield, Award, Handshake, Layers, Vote, Lock, MessageSquare, X, Send, Edit3 } from 'lucide-react'

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

export function PublicGovernancePage({
  editMode = false,
  pageTitle,
  pageSubtitle,
  onFieldChange,
}: {
  editMode?: boolean
  pageTitle?: string
  pageSubtitle?: string
  onFieldChange?: (field: string, value: any) => void
} = {}) {
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [proposalModal, setProposalModal] = useState<{ rule: any } | null>(null)
  const [proposalText, setProposalText] = useState('')
  const [proposalSubmitting, setProposalSubmitting] = useState(false)
  const [proposalMsg, setProposalMsg] = useState('')

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
        {editMode ? (
          <>
            <input
              className="text-3xl font-bold text-gray-900 text-center bg-yellow-50 border-2 border-amber-300 rounded-lg px-3 py-1 outline-none focus:ring-2 focus:ring-amber-400 w-full max-w-md"
              value={pageTitle || 'Ley de la Aldea'}
              onChange={(e) => onFieldChange?.('title', e.target.value)}
              placeholder="Título de la página"
            />
            <textarea
              className="text-gray-600 text-sm max-w-2xl mx-auto bg-yellow-50 border-2 border-amber-300 rounded-lg px-3 py-1 outline-none focus:ring-2 focus:ring-amber-400 w-full"
              rows={2}
              value={pageSubtitle || 'Reglas de convivencia aprobadas en Asamblea General...'}
              onChange={(e) => onFieldChange?.('subtitle', e.target.value)}
              placeholder="Subtítulo de la página"
            />
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-gray-900">{pageTitle || 'Ley de la Aldea'}</h1>
            <p className="text-gray-600 text-sm max-w-2xl mx-auto">
              {pageSubtitle || 'Reglas de convivencia aprobadas en Asamblea General. Estas normas rigen la vida comunitaria: estructura de gobierno, deberes, permisos, prohibiciones, faltas y procesos de admision y salida.'}
            </p>
          </>
        )}
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

      {/* Tres niveles de nodo federado */}
      <div className="bg-gradient-to-b from-blue-50 to-white rounded-2xl p-6 border border-blue-200">
        <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">Tres Niveles de Nodo Federado</h2>
        <p className="text-xs text-gray-500 text-center mb-4 max-w-2xl mx-auto">
          Cada nodo de la federacion pasa por tres niveles de confianza. El nivel determina el limite de credito,
          el derecho a voto y la capacidad de patrocinar nuevos nodos.
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="text-gray-500" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">Nivel 1: Nodo Nuevo</h3>
            </div>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>Limite de 1.000 TQ</li>
              <li>Sin derecho a voto en la federacion</li>
              <li>No puede patrocinar (ser padrino) de nuevos nodos</li>
              <li>Acceso a la piscina global multilateral</li>
              <li>Periodo minimo de 90 dias antes de poder ser promovido</li>
            </ul>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
            <div className="flex items-center gap-2 mb-2">
              <Vote className="text-emerald-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">Nivel 2: Nodo Aceptado</h3>
            </div>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>Limite de 5.000 TQ</li>
              <li>Derecho a voto en decisiones de la federacion</li>
              <li>Puede patrocinar (ser padrino) de nuevos nodos</li>
              <li>Acceso completo a la piscina global multilateral</li>
              <li>Se alcanza tras votacion de toda la federacion (minimo 90 dias en nivel 1)</li>
            </ul>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <Award className="text-purple-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">Nivel 3: Nodo Pleno</h3>
            </div>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>Limite de 20.000 TQ</li>
              <li>Derecho a voto y capacidad de patrocinio</li>
              <li>Acceso completo a la piscina global multilateral</li>
              <li>Promocion automatica al cumplir reciprocidad y limite promedio requerido</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 bg-blue-50 rounded-lg p-3 border border-blue-100">
          <p className="text-xs text-blue-700">
            <strong>Promocion a Nivel 2:</strong> Requiere una votacion de toda la federacion despues de un minimo
            de 90 dias como Nodo Nuevo. La promocion a Nivel 3 es automatica cuando el nodo cumple los requisitos
            de reciprocidad y el limite promedio de la federacion.
          </p>
        </div>
      </div>

      {/* Sistema de padrino (patrocinador) */}
      <div className="bg-gradient-to-b from-amber-50 to-white rounded-2xl p-6 border border-amber-200">
        <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">Sistema de Padrino (Patrocinador)</h2>
        <p className="text-xs text-gray-500 text-center mb-4 max-w-2xl mx-auto">
          Los nodos de nivel 2 o superior pueden patrocinar nuevos nodos que ingresan a la federacion,
          asumiendo responsabilidad solidaria sobre su deuda en caso de incumplimiento.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 border border-amber-100">
            <div className="flex items-center gap-2 mb-2">
              <Handshake className="text-amber-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">Como funciona el patrocinio</h3>
            </div>
            <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
              <li>Solo los nodos de <strong>Nivel 2 (Aceptado)</strong> o <strong>Nivel 3 (Pleno)</strong> pueden ser padrinos</li>
              <li>Al patrocinar un nodo nuevo, el limite del padrino se reduce en el monto del limite del nodo patrocinado (1.000 TQ)</li>
              <li>El nodo patrocinado ingresa como <strong>Nivel 1 (Nodo Nuevo)</strong> con su limite de 1.000 TQ</li>
              <li>Si el nodo patrocinado incumple (default), la deuda se transfiere al padrino</li>
              <li>Cuando el nodo patrocinado alcanza el <strong>Nivel 2</strong>, el limite retenido del padrino se libera automaticamente</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl p-4 border border-amber-100">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="text-amber-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">Responsabilidad del padrino</h3>
            </div>
            <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
              <li>El padrino responde solidariamente por la deuda del nodo patrocinado</li>
              <li>El limite efectivo del padrino = limite nominal - suma de limites de nodos patrocinados</li>
              <li>Un nodo puede patrocinar multiples nodos nuevos, mientras tenga limite disponible</li>
              <li>El patrocinio fomenta la confianza: el padrino solo patrocina nodos que conoce y en los que confia</li>
              <li>La liberacion del limite al alcanzar el ahijado el Nivel 2 incentiva al padrino a apoyar el crecimiento del nodo nuevo</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Piscina global vs bilateral */}
      <div className="bg-gradient-to-b from-teal-50 to-white rounded-2xl p-6 border border-teal-200">
        <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">Piscina Global Multilateral vs. Piscinas Bilaterales</h2>
        <p className="text-xs text-gray-500 text-center mb-4 max-w-2xl mx-auto">
          La federacion maneja dos tipos de piscinas de saldo: una global compartida y piscinas bilaterales entre pares de nodos.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 border border-teal-100">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="text-teal-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">Piscina Global Multilateral Real</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Una piscina compartida por todos los nodos federados. El saldo que ganas en el nodo B
              es gastable en el nodo C. Es decir, si un usuario del nodo A compra productos de un
              productor del nodo B, el saldo positivo que genera el productor del nodo B puede
              usarse para comprar productos del nodo C. Esto permite un trueque multilateral real
              entre todas las comunidades federadas, no solo de par en par.
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-teal-100">
            <div className="flex items-center gap-2 mb-2">
              <Network className="text-teal-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">Piscinas Bilaterales</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Cada par de nodos mantiene ademas un saldo bilateral independiente. Este saldo refleja
              el intercambio directo entre dos nodos especificos. Las piscinas bilaterales son
              separadas de la piscina global: el saldo bilateral con el nodo B no se mezcla con el
              saldo bilateral con el nodo C. Anteriormente, el sistema solo verificaba limites
              bilaterales; ahora existe una piscina global real que permite el multilateralismo
              completo.
            </p>
          </div>
        </div>
      </div>

      {/* Verificacion de 4 opciones */}
      <div className="bg-gradient-to-b from-indigo-50 to-white rounded-2xl p-6 border border-indigo-200">
        <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">Verificacion de 4 Opciones</h2>
        <p className="text-xs text-gray-500 text-center mb-4 max-w-2xl mx-auto">
          Para mayor seguridad, el emparejamiento de terminales POS y la incorporacion de nuevos nodos
          a la federacion utilizan un sistema de verificacion de 4 opciones.
        </p>
        <div className="bg-white rounded-xl p-4 border border-indigo-100">
          <div className="flex items-center gap-2 mb-2">
            <Key className="text-indigo-600" size={18} />
            <h3 className="font-semibold text-sm text-gray-800">Como funciona</h3>
          </div>
          <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
            <li>El dispositivo o nodo que solicita emparejamiento genera un codigo de 6 digitos</li>
            <li>El confirmador (administrador del nodo receptor) ve <strong>4 opciones de codigo</strong> en pantalla</li>
            <li>Solo una de las 4 opciones es el codigo correcto que muestra el dispositivo solicitante</li>
            <li>El confirmador debe <strong>seleccionar el codigo correcto</strong> entre las 4 opciones</li>
            <li>Si selecciona el codigo equivocado, el emparejamiento se rechaza automaticamente</li>
          </ol>
          <p className="text-xs text-indigo-600 mt-3 bg-indigo-50 p-2 rounded">
            Este sistema previene ataques de intermediario: incluso si un atacante intercepta la comunicacion,
            no puede forzar la aprobacion sin conocer visualmente cual de las 4 opciones es la correcta.
          </p>
        </div>
      </div>

      {/* Integridad distribuida */}
      <div className="bg-gradient-to-b from-rose-50 to-white rounded-2xl p-6 border border-rose-200">
        <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">Integridad Distribuida</h2>
        <p className="text-xs text-gray-500 text-center mb-4 max-w-2xl mx-auto">
          Las transacciones entre nodos federados estan protegidas por un sistema de doble firma
          y hashes encadenados que garantiza su integridad.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 border border-rose-100">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="text-rose-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">Doble firma</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Cada transaccion entre nodos federados requiere la firma criptografica de ambos nodos
              (emisor y receptor). Esto significa que ningun nodo puede falsificar una transaccion
              en nombre del otro. Ambas partes deben confirmar criptograficamente la transaccion
              para que sea valida.
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-rose-100">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="text-rose-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">Hashes encadenados</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Las transacciones entre nodos se encadenan mediante hashes: cada transaccion incluye
              el hash de la transaccion anterior. Esto crea una cadena inmutable donde cualquier
              modificacion de una transaccion pasada invalida todas las posteriores. Permite
              verificar la integridad completa del historial de intercambios entre dos nodos.
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
                      className={`bg-white rounded-xl border p-4 shadow-sm transition relative ${
                        editMode
                          ? 'border-amber-300 hover:ring-2 hover:ring-amber-400 cursor-pointer'
                          : 'border-gray-200 hover:shadow-md'
                      }`}
                      onClick={() => {
                        if (editMode) {
                          setProposalModal({ rule })
                          setProposalText('')
                          setProposalMsg('')
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-sm text-gray-900">{rule.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${sev.class}`}>
                          {sev.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{rule.description}</p>
                      {editMode && (
                        <div className="absolute inset-0 bg-amber-50/80 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100 transition">
                          <div className="text-center space-y-2">
                            <div className="inline-flex items-center gap-1.5 text-amber-800 text-xs font-bold bg-amber-100 px-3 py-1.5 rounded-lg">
                              <MessageSquare size={14} />
                              Requiere aprobación de Asamblea
                            </div>
                            <div className="text-[11px] text-amber-700">
                              Clic para proponer una modificación
                            </div>
                          </div>
                        </div>
                      )}
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

      {/* Modal: Proponer modificación de norma */}
      {proposalModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setProposalModal(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare size={20} className="text-amber-600" />
                <h3 className="text-base font-bold text-gray-900">Proponer Modificación</h3>
              </div>
              <button
                onClick={() => setProposalModal(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Edit3 size={14} /> Norma: {proposalModal.rule.title}
                </div>
                <p className="text-amber-700">{proposalModal.rule.description}</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                <strong>Esta norma fue aprobada por la Asamblea General.</strong> No se puede editar directamente.
                Tu propuesta será enviada como una propuesta de modificación de gobernanza para que la asamblea la debata y vote.
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Describe el cambio que propones
                </label>
                <textarea
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none"
                  placeholder="Ej: Modificar el límite de crédito inicial de 500 TQ a 800 TQ porque el costo de vida ha aumentado..."
                  value={proposalText}
                  onChange={(e) => setProposalText(e.target.value)}
                />
              </div>

              {proposalMsg && (
                <div className={`text-xs p-2 rounded-lg ${
                  proposalMsg.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {proposalMsg}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2">
                <Link
                  to="/app/assembly"
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-medium"
                >
                  Ver todas las propuestas →
                </Link>
                <button
                  onClick={async () => {
                    if (!proposalText.trim()) {
                      setProposalMsg('Error: describe el cambio que propones')
                      return
                    }
                    setProposalSubmitting(true)
                    setProposalMsg('')
                    try {
                      await api.post('/assembly/proposals', {
                        title: `Modificar norma: ${proposalModal.rule.title}`,
                        description: `Norma actual: ${proposalModal.rule.description}\n\nCambio propuesto: ${proposalText}`,
                        type: 'policy',
                        category: proposalModal.rule.category,
                        target_rule_id: proposalModal.rule.id,
                      })
                      setProposalMsg('Propuesta enviada a la Asamblea. Será debatida en la próxima sesión.')
                      setProposalText('')
                    } catch (e: any) {
                      setProposalMsg('Error: ' + (e?.message || 'no se pudo enviar la propuesta'))
                    } finally {
                      setProposalSubmitting(false)
                    }
                  }}
                  disabled={proposalSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-500 transition disabled:opacity-60"
                >
                  {proposalSubmitting ? 'Enviando...' : 'Enviar Propuesta'}
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
