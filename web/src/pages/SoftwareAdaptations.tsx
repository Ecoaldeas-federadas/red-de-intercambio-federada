import { useState } from 'react'
import { Sprout, Sun, Heart, BookOpen, Clock, Users, Globe, Zap, Leaf, Shield, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'

interface Adaptation {
  icon: typeof Sprout
  title: string
  description: string
  feature: string
  biblicalRef?: string
  sourceRef?: string
}

interface Group {
  id: string
  name: string
  icon: typeof Sprout
  color: string
  bgColor: string
  description: string
  adaptations: Adaptation[]
}

const groups: Group[] = [
  {
    id: 'adventistas',
    name: 'Adventistas del Séptimo Día',
    icon: BookOpen,
    color: 'text-blue-800',
    bgColor: 'bg-blue-50',
    description: 'Comunidades adventistas que siguen los consejos de Elena G. de White sobre la vida en el campo, el sostén propio y los puestos de avanzada.',
    adaptations: [
      {
        icon: Clock,
        title: 'Bloqueo Automático del Sábado (Sabbath Lock)',
        description: 'El sistema puede bloquear automáticamente todas las transacciones comerciales desde la puesta del sol del viernes hasta la puesta del sol del sábado. Cada nodo configura sus propios horarios de bloqueo, respetando el cuarto mandamiento (Éxodo 20:8-11) sin intervención manual.',
        feature: 'Horarios de Comercio Configurables',
        biblicalRef: 'Éxodo 20:8-11 - "Acuérdate del día de reposo para santificarlo"',
        sourceRef: 'Nehemías 13:15-22 - Nehemías cerró las puertas de Jerusalén el sábado para impedir el comercio',
      },
      {
        icon: Shield,
        title: 'Soberanía Económica Off-Grid',
        description: 'El sistema funciona sin internet mediante una intranet local en el campo. Las familias adventistas que han salido de las ciudades pueden seguir intercambiando alimentos, herramientas y servicios de salud sin depender del sistema financiero tradicional.',
        feature: 'Intranet Local + Tarjetas NFC',
        biblicalRef: 'Apocalipsis 13:17 - "y que nadie pueda comprar ni vender, sino el que tiene la marca"',
        sourceRef: 'Elena G. de White, Mensajes Selectos, Tomo 2, pág. 161 - "Una vez y otra el Señor ha instruido a los miembros de su pueblo a que saquen sus familias de las ciudades y las lleven al campo, donde puedan cultivar sus propias provisiones, porque en el futuro el problema de comprar y vender será muy serio."',
      },
      {
        icon: Sprout,
        title: 'Puestos de Avanzada Autónomos',
        description: 'Cada nodo de la red federada funciona como un "puesto de avanzada" independiente. La Fundación Las Delicias puede tener nodos en Nirgua, Barquisimeto y Colombia, todos federados pero autónomos, cada uno con su propia gobernanza, miembros y configuración.',
        feature: 'Federación de Nodos Autónomos',
        sourceRef: 'Elena G. de White, De la Ciudad al Campo - "Hay que trabajar en favor de las ciudades desde puestos de avanzada. El Señor nos ha indicado repetidamente que debemos trabajar en las ciudades desde puestos de avanzada ubicados fuera de ellas."',
      },
      {
        icon: Heart,
        title: 'Mayordomía sin Usura ni Inflación',
        description: 'El Trueque TQ no es dinero especulativo. Está anclado al trabajo real (1 TQ = 1 kWh de esfuerzo físico). No genera intereses (cero usura) y no sufre inflación. La contabilidad de saldo cero enseña reciprocidad: dar tanto como se recibe.',
        feature: 'Crédito Mutuo de Saldo Cero',
        biblicalRef: 'Génesis 3:19 - "Con el sudor de tu frente comerás el pan"',
        sourceRef: 'Elena G. de White - El consejo de la vida en el campo implica trabajo físico real, no especulación financiera.',
      },
      {
        icon: Users,
        title: 'Gobernanza por Asamblea y Consentimiento',
        description: 'El sistema incluye un módulo completo de asambleas con votaciones digitales. Cada nodo configura sus propios niveles de aprobación. Las decisiones se toman por consentimiento sociocrático, no por mayoría tiránica.',
        feature: 'Asambleas Digitales con Votaciones',
        sourceRef: 'Elena G. de White - La iglesia adventista se rige por asambleas y votos administrativos. El sistema digitaliza este proceso respetando la autonomía de cada comunidad.',
      },
      {
        icon: Leaf,
        title: 'Agroecología y Banco de Semillas',
        description: 'El sistema incluye un catálogo de productos agroecológicos, banco de semillas comunitario y registro de prácticas agroecológicas. Compatible con la filosofía adventista de salud natural y alimentación vegetariana.',
        feature: 'Catálogo de Productos + Banco de Semillas',
        sourceRef: 'Elena G. de White, La Conducción del Niño - Consejos sobre alimentación saludable, agricultura natural y vida en armonía con la creación.',
      },
      {
        icon: Zap,
        title: 'Servicios de Salud Natural',
        description: 'Las instituciones adventistas como la Fundación Las Delicias ofrecen programas de salud natural, cocina vegetariana y masoterapia. El sistema permite registrar estos servicios, cobrarlos en TQ y gestionar citas y pacientes.',
        feature: 'Catálogo de Servicios + Pagos NFC',
        sourceRef: 'Fundación Las Delicias - "Solo en 2024, se atendieron 250 pacientes, se realizaron 12 salidas misioneras y se celebraron 2 bautismos." (fundacionlasdelicias.org)',
      },
      {
        icon: Globe,
        title: 'Federación Internacional',
        description: 'La Fundación Las Delicias tiene presencia en Venezuela, Bolivia, República Dominicana y Colombia. El sistema permite federar todos estos nodos en una red única, intercambiando recursos entre países sin dinero fiat.',
        feature: 'Federación Multi-Nodo Internacional',
        sourceRef: 'Fundación Las Delicias - "FLD Internacional: Fundación las Delicias Venezuela, Fundación las Delicias Bolivia, Fundación las Delicias RD, Vida Plena (Guambia), Fundación el Encanto" (fundacionlasdelicias.org/areas-fld)',
      },
    ],
  },
  {
    id: 'holisticos',
    name: 'Holísticos / Frutarianos / Solarianos',
    icon: Sun,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    description: 'Comunidades que se alimentan de frutas, sol y energía pránica. Practican medicina holística, permacultura y vida en armonía con los ciclos naturales.',
    adaptations: [
      {
        icon: Sun,
        title: 'Ciclos Solares y Lunares',
        description: 'El sistema puede configurar horarios de comercio alineados con los ciclos solares. Por ejemplo, solo permitir transacciones durante las horas de luz solar, o bloquear en días de luna llena para ceremonias espirituales.',
        feature: 'Horarios de Comercio por Ciclos Naturales',
      },
      {
        icon: Leaf,
        title: 'Catálogo de Frutas y Alimentos Vivos',
        description: 'El catálogo de productos puede categorizar alimentos por su nivel de vibración: frutas frescas, semillas germinadas, alimentos deshidratados al sol, fermentados naturales. Cada producto puede incluir su valor nutricional y energético.',
        feature: 'Catálogo de Productos con Categorías Personalizables',
      },
      {
        icon: Heart,
        title: 'Medicina Holística y Terapias',
        description: 'El sistema permite registrar servicios de medicina holística: terapia de sonido, reiki, meditación guiada, yoga, ayuno supervisado, terapia con cristales. Cada servicio se cobra en TQ y se gestiona con citas.',
        feature: 'Catálogo de Servicios de Salud Holística',
      },
      {
        icon: Sprout,
        title: 'Permacultura y Huertos Medicinales',
        description: 'El sistema incluye un banco de semillas comunitario para plantas medicinales, árboles frutales y hortalizas biodiversas. Los miembros pueden intercambiar semillas, esquejes y conocimientos de permacultura.',
        feature: 'Banco de Semillas + Intercambio de Saberes',
      },
      {
        icon: Shield,
        title: 'Economía Regenerativa de Saldo Cero',
        description: 'El Trueque TQ promueve el equilibrio: la meta es volver siempre a cero, ni acumular ni endeudarse. Esto se alinea con la filosofía de no acumulación, desapego material y reciprocidad con la Madre Tierra.',
        feature: 'Crédito Mutuo de Saldo Cero',
      },
      {
        icon: Users,
        title: 'Círculos de Consciencia',
        description: 'Las asambleas del sistema pueden configurarse como "círculos de consciencia" donde las decisiones se toman por consentimiento y escucha activa. Cada miembro tiene voz y voto en igualdad.',
        feature: 'Asambleas con Consentimiento Sociocrático',
      },
      {
        icon: Globe,
        title: 'Federación de Ecoaldeas',
        description: 'Las ecoaldeas holísticas pueden federarse en una red que intercambia alimentos, medicinas naturales y conocimientos. Cada ecoaldea mantiene su autonomía pero se beneficia del comercio federado.',
        feature: 'Federación de Nodos Autónomos',
      },
      {
        icon: Zap,
        title: 'Energía Solar Off-Grid',
        description: 'El sistema funciona con energía solar mediante microrredes comunitarias. Las transacciones se realizan con tarjetas NFC que no requieren internet ni batería. Ideal para comunidades rurales off-grid.',
        feature: 'Intranet Local + NFC + Microrred Solar',
      },
    ],
  },
  {
    id: 'general',
    name: 'Cualquier Comunidad o Creencia',
    icon: Globe,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    description: 'El sistema es 100% configurable y se adapta a cualquier cultura, religión, filosofía o forma de organización. Cada nodo es independiente.',
    adaptations: [
      {
        icon: Clock,
        title: 'Horarios de Comercio Personalizables',
        description: 'Cualquier comunidad puede configurar sus propios horarios de comercio. Bloquear domingos, viernes, días festivos, horarios nocturnos, o cualquier combinación. Cada nodo decide independientemente.',
        feature: 'Horarios de Comercio Configurables por Nodo',
      },
      {
        icon: BookOpen,
        title: 'Ley de la Aldea Personalizable',
        description: 'El formulario de admisión y la ley de gobernanza son completamente personalizables. Cada comunidad escribe sus propias reglas, deberes, prohibiciones y faltas. No se impone ninguna filosofía.',
        feature: 'Formulario de Admisión Dinámico + Ley Personalizable',
      },
      {
        icon: Users,
        title: 'Gobernanza Autónoma',
        description: 'Cada nodo configura su propio sistema de gobernanza: asamblea, junta directiva, consejo de ancianos, círculo de convivencia, o cualquier estructura. Los niveles de aprobación son configurables por categoría.',
        feature: 'Gobernanza Configurable por Categoría',
      },
      {
        icon: Globe,
        title: 'Identidad Cultural Propia',
        description: 'Cada nodo tiene su propio nombre, logo, moneda local, dominio, colores y textos. No hay una identidad impuesta. La Feria Conuquera tiene su identidad, una comunidad adventista tendrá la suya, una ecoaldea holística la suya.',
        feature: 'Identidad Visual y Cultural por Nodo',
      },
    ],
  },
]

export default function SoftwareAdaptations() {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [expandedAdaptation, setExpandedAdaptation] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 mb-4">
            <Globe size={32} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">
            Adaptaciones del Software
          </h1>
          <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto">
            El sistema es 100% configurable y se adapta a cualquier cultura, religión, filosofía o forma de organización.
            Cada nodo es independiente y mantiene su propia identidad. Aquí explicamos cómo.
          </p>
        </div>

        {/* Selector de grupo */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {groups.map((group) => {
            const Icon = group.icon
            const isSelected = selectedGroup === group.id
            return (
              <button
                key={group.id}
                onClick={() => setSelectedGroup(isSelected ? null : group.id)}
                className={`p-5 rounded-2xl border-2 transition text-left ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-emerald-300'
                }`}
              >
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${group.bgColor} ${group.color} mb-3`}>
                  <Icon size={20} />
                </div>
                <h3 className={`font-bold text-sm ${group.color}`}>{group.name}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{group.description}</p>
              </button>
            )
          })}
        </div>

        {/* Detalles del grupo seleccionado */}
        {selectedGroup && (
          <div className="space-y-4">
            {groups.filter(g => g.id === selectedGroup).map((group) => (
              <div key={group.id}>
                <div className={`${group.bgColor} rounded-2xl p-6 mb-6`}>
                  <h2 className={`text-xl font-bold ${group.color} mb-2`}>{group.name}</h2>
                  <p className="text-sm text-gray-700">{group.description}</p>
                </div>

                {group.adaptations.map((adapt, idx) => {
                  const Icon = adapt.icon
                  const isExpanded = expandedAdaptation === idx
                  return (
                    <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-3">
                      <button
                        onClick={() => setExpandedAdaptation(isExpanded ? null : idx)}
                        className="w-full p-5 flex items-start gap-4 text-left hover:bg-gray-50 transition"
                      >
                        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${group.bgColor} ${group.color} flex-shrink-0`}>
                          <Icon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm text-gray-900">{adapt.title}</h3>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{adapt.description}</p>
                          <div className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <Zap size={12} />
                            {adapt.feature}
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp size={20} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={20} className="text-gray-400 flex-shrink-0" />}
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-5 pl-19 space-y-3">
                          <p className="text-sm text-gray-700 leading-relaxed pl-14">{adapt.description}</p>
                          {adapt.biblicalRef && (
                            <div className="ml-14 p-3 rounded-lg bg-blue-50 border border-blue-200">
                              <p className="text-xs font-bold text-blue-800 mb-1">📖 Referencia Bíblica</p>
                              <p className="text-xs text-blue-700 italic">{adapt.biblicalRef}</p>
                            </div>
                          )}
                          {adapt.sourceRef && (
                            <div className="ml-14 p-3 rounded-lg bg-amber-50 border border-amber-200">
                              <p className="text-xs font-bold text-amber-800 mb-1">📚 Fuente</p>
                              <p className="text-xs text-amber-700 italic">{adapt.sourceRef}</p>
                            </div>
                          )}
                          <div className="ml-14 flex items-center gap-2 text-xs text-emerald-600 font-medium pt-2">
                            <ArrowRight size={14} />
                            <span>Funcionalidad del software: <strong>{adapt.feature}</strong></span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* Nota importante */}
        <div className="mt-8 p-5 rounded-xl bg-gray-50 border border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Cada nodo es completamente independiente. La configuración de horarios, gobernanza, identidad y reglas
            se hace por nodo y no afecta a otros nodos de la federación. El software no impone ninguna religión,
            filosofía o cultura. Cada comunidad adapta el sistema a sus necesidades.
          </p>
        </div>
      </div>
    </div>
  )
}
