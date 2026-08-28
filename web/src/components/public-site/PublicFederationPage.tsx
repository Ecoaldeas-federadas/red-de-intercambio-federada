import { useState, useEffect } from 'react'
import { api } from '../../api'
import { fmtDate } from '../../lib/format'
import {
  Globe, Users, Network, Leaf, Heart, Scale, ArrowRight, Check,
  Sparkles, MessageSquare, ThumbsUp, Send, Menu, X, Home, Copy, Share2,
  Power, Loader2, ExternalLink, AlertCircle, CheckCircle, Code,
  ChevronUp, ChevronDown
} from 'lucide-react'

const SHARE_MESSAGE = `¿El mayor reto de crear una ecoaldea? No es comprar el terreno... es ponerse de acuerdo. 🏡🤝

Muchos proyectos ecoamigables e intencionales fracasan porque les faltan bases sólidas de gobernanza y economía. Por eso, he desarrollado un sistema digital universal, modular y deslocalizado diseñado específicamente para resolver esto y dar orden real a cualquier ecoaldea en el mundo.

¿De qué se trata el proyecto?

🌐 Autonomía + Federación: Cada ecoaldea funciona como un nodo independiente con sus propias leyes, cultura y asambleas. Pero al federarse con otros nodos, pueden comerciar entre sí de forma justa y segura utilizando tecnologías como códigos QR y tarjetas NFC.

🗳️ Gobernanza y Asamblea Digital: Olvídate de la parálisis comunitaria o de acuerdos informales que se rompen. La plataforma cuenta con un sistema de Asamblea Digital y Votaciones transparentes para debatir, proponer cambios y registrar decisiones de forma inmutable.

🔋 Trueque TQ (Moneda Inmune a la Inflación): Usamos un sistema contable de crédito mutuo donde la unidad de medida no está atada al dólar ni al oro, sino a las leyes de la física: 1 TQ = 1 kWh de trabajo, cosecha o insumos.

🚜 Acumulación de Riqueza Real vs. Números Falsos: A diferencia del capitalismo que te engaña acumulando números virtuales en una pantalla que el banco te puede congelar o la inflación devaluar, nuestro sistema te motiva a acumular riqueza real y tangible (tu vivienda bioclimática, conucos, herramientas, semillas o un tractor).

📈 Límites Dinámicos: Los límites de crédito no son fijos ni limitativos; son escalones de confianza. Un miembro nuevo inicia con un límite protector equivalente a su canasta básica familiar y este sube en asamblea a medida que se integra y aporta a la comunidad.

¿Tienes una ecoaldea, tienes tierras o quieres fundar una? Mi plataforma está en pleno desarrollo y quiero que sea una herramienta que se adapte perfectamente a las necesidades de cada comunidad. Me interesa muchísimo conversar con personas que tengan experiencias (tanto positivas como negativas) para aprender, mejorar el software y mostrarles una demostración de cómo funciona.

📩 Escríbeme por privado para mostrarte el sistema, conocer tu experiencia y ver cómo podemos integrarnos a esta Red de Ecoaldeas Federadas. ¡Hagamos que las comunidades sustentables sean una realidad organizada! 🌾✨`

export function PublicFederationPage() {
  const [proposals, setProposals] = useState<any[]>([])
  const [showProposalForm, setShowProposalForm] = useState(false)
  const [newProposal, setNewProposal] = useState({ title: '', description: '', category: 'funcionalidad' })
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [copiedMsg, setCopiedMsg] = useState(false)
  const [demoState, setDemoState] = useState<'unknown' | 'stopped' | 'starting' | 'running'>('unknown')
  const [demoStarting, setDemoStarting] = useState(false)
  const [demoStartLog, setDemoStartLog] = useState('')
  const [demoStartMsg, setDemoStartMsg] = useState('')
  const [demoPresets, setDemoPresets] = useState<any[]>([])
  const [demoPresetSel, setDemoPresetSel] = useState('gen_ecoaldea')
  const [demoPresetsLoaded, setDemoPresetsLoaded] = useState(false)
  const [demoError, setDemoError] = useState(false)

  useEffect(() => {
    api.get('/public/proposals').then((d: any) => {
      setProposals(Array.isArray(d) ? d : [])
    }).catch(() => {})

    // Verificar estado del nodo demo
    checkDemoStatus()
  }, [])

  // Cargar presets del demo (solo si el demo no esta corriendo)
  const loadDemoPresets = () => {
    api.get('/presets').then((d: any) => {
      if (d?.presets && Array.isArray(d.presets)) {
        setDemoPresets(d.presets)
        setDemoPresetsLoaded(true)
      }
    }).catch(() => {})
  }

  const checkDemoStatus = () => {
    api.get('/demo/status').then((d: any) => {
      if (d?.running) {
        setDemoState('running')
      } else {
        setDemoState('stopped')
      }
    }).catch(() => setDemoState('unknown'))
  }

  const startDemo = async () => {
    setDemoStarting(true)
    setDemoError(false)
    setDemoState('starting')
    setDemoStartLog('Iniciando proceso de arranque...\n')
    if (demoPresetSel) {
      setDemoStartLog(prev => prev + `Preconfiguracion seleccionada: ${demoPresetSel}\n`)
    }
    setDemoStartMsg('Enviando solicitud...')
    try {
      await api.post('/demo/start', { preset_id: demoPresetSel || 'gen_ecoaldea' })
      // Consultar el progreso periodicamente
      let attempts = 0
      const maxAttempts = 120 // 120 * 2s = 4 min max
      const pollStatus = () => {
        attempts++
        api.get('/demo/start/status').then((d: any) => {
          if (d?.log) setDemoStartLog(d.log)
          if (d?.message) setDemoStartMsg(d.message)
          if (d?.status === 'running') {
            setDemoState('running')
            setDemoStarting(false)
            // No abrir automaticamente - dejar que el usuario haga clic
            // cuando haya revisado el log de arranque
          } else if (d?.status === 'error') {
            setDemoState('stopped')
            setDemoStarting(false)
            setDemoError(true)
          } else if (attempts >= maxAttempts) {
            // Timeout: verificar si el demo esta corriendo
            checkDemoStatus()
            setDemoStarting(false)
            setDemoError(true)
            setDemoStartMsg('Timeout: el demo no respondio en 4 minutos')
          } else {
            // Continuar consultando
            setTimeout(pollStatus, 2000)
          }
        }).catch(() => {
          if (attempts >= maxAttempts) {
            checkDemoStatus()
            setDemoStarting(false)
            setDemoError(true)
            setDemoStartMsg('No se pudo conectar con el nodo para verificar el estado')
          } else {
            setTimeout(pollStatus, 2000)
          }
        })
      }
      // Primer consulta despues de 1s
      setTimeout(pollStatus, 1000)
    } catch (e: any) {
      setDemoState('stopped')
      setDemoStarting(false)
      setDemoError(true)
      setDemoStartMsg('Error: ' + (e?.message || 'no se pudo iniciar'))
    }
  }

  const submitProposal = async () => {
    if (!newProposal.title || !newProposal.description) {
      setMsg('Titulo y descripcion son obligatorios')
      return
    }
    setSubmitting(true)
    setMsg('')
    try {
      await api.post('/public/proposals', newProposal)
      setMsg('Propuesta enviada. Gracias por aportar!')
      setNewProposal({ title: '', description: '', category: 'funcionalidad' })
      setShowProposalForm(false)
      // Recargar
      api.get('/public/proposals').then((d: any) => setProposals(Array.isArray(d) ? d : []))
    } catch (e: any) {
      setMsg(e?.message || 'Error al enviar propuesta')
    } finally {
      setSubmitting(false)
    }
  }

  const voteProposal = async (id: string) => {
    if (votedIds.has(id)) return
    try {
      await api.post(`/public/proposals/${id}/vote`, {})
      setVotedIds(new Set([...votedIds, id]))
      // Recargar
      api.get('/public/proposals').then((d: any) => setProposals(Array.isArray(d) ? d : []))
    } catch (e: any) {
      setMsg(e?.message || 'Error al votar')
    }
  }

  const categoryLabels: Record<string, string> = {
    funcionalidad: 'Funcionalidad',
    gobernanza: 'Gobernanza',
    interfaz: 'Interfaz',
    economia: 'Economia / Intercambio',
    seguridad: 'Seguridad / Privacidad',
    otro: 'Otro',
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-800 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-300 rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm mb-6">
            <Sparkles size={16} /> Plataforma Libre para Ecoaldeas y Comunidades
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Red de Intercambio Federada
          </h1>
          <p className="text-xl text-emerald-100 mb-8 max-w-2xl mx-auto">
            Un sistema gratuito y configurable que permite a cada ecoaldea gestionar su economia,
            gobernanza e intercambios, y federarse con otras comunidades en una red de comercio justo,
            sin inflacion y sin intermediarios.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="#beneficios" className="bg-white text-emerald-700 font-semibold px-6 py-3 rounded-xl hover:bg-emerald-50 transition flex items-center gap-2">
              Conocer mas <ArrowRight size={18} />
            </a>
            <a href="#proponer" className="bg-emerald-600/50 backdrop-blur-sm border border-white/30 text-white font-semibold px-6 py-3 rounded-xl hover:bg-emerald-600/70 transition flex items-center gap-2">
              <MessageSquare size={18} /> Proponer mejoras
            </a>
          </div>
        </div>
      </div>

      {/* Que es */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Que es la Federacion de Ecoaldeas?</h2>
        <p className="text-lg text-gray-600 leading-relaxed mb-4">
          Imagina lo que Visa y Mastercard hacen por los comercios de los paises: agruparlos en una red
          que permite intercambiar sin fronteras. Ahora imagina eso, pero para ecoaldeas, comunidades
          autogestionadas y redes de trueque. Cada comunidad mantiene su autonomia, sus normas y su
          gobernanza, pero puede intercambiar con otras comunidades federadas de manera justa.
        </p>
        <p className="text-lg text-gray-600 leading-relaxed mb-4">
          La plataforma <strong>Red de Intercambio Federada</strong> permite que cada ecoaldea tenga:
        </p>
        <div className="grid md:grid-cols-2 gap-4 mt-8">
          {[
            { icon: Scale, title: 'Gobernanza configurable', desc: 'Cada comunidad define sus propias normas, asambleas, quorum, niveles de miembro y procesos de admision.' },
            { icon: Leaf, title: 'Economia propia', desc: 'Moneda comunitaria (TQ) basada en energia (kWh/Joule), no en dinero bancario. Sin inflacion, sin interes.' },
            { icon: Network, title: 'Federacion entre nodos', desc: 'Intercambia con otras ecoaldeas federadas. Cada nodo respeta las normas internas de los demas.' },
            { icon: Users, title: 'Comunidad autogestionada', desc: 'Organizaciones, departamentos, asambleas, votaciones, admision de miembros y recuperacion de cuentas.' },
            { icon: Globe, title: 'Sitio web publico', desc: 'Cada nodo tiene su propio sitio web configurable para mostrar productos, filosofia y contacto.' },
            { icon: Heart, title: 'Gratis y abierto', desc: 'La plataforma es gratuita. Asesoria incluida. Abierta a aportes y mejoras desde la experiencia real.' },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <item.icon className="text-emerald-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Beneficios */}
      <section id="beneficios" className="bg-emerald-50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Beneficios de Federarse</h2>
          <div className="space-y-4">
            {[
              { title: 'Mas comercios disponibles', desc: 'Mientras mas ecoaldeas se federen, mas versatil e independiente es la red. Cada cualdea tiene su propio sistema de comercio, pero puede intercambiar con todas las demas.' },
              { title: 'Sin inflacion', desc: 'La moneda comunitaria TQ se basa en consumo energetico real (kWh/Joule), no en emision arbitraria. No hay inflacion porque no hay creacion de dinero sin respaldo.' },
              { title: 'Autonomia total', desc: 'Cada comunidad mantiene sus normas, su gobernanza y su autonomia. La federacion no se entromete en las decisiones internas de cada nodo.' },
              { title: 'Comercio justo', desc: 'Intercambio sin intermediarios. Los precios se calculan en base a energia, no a especulacion. Cada producto tiene un valor objetivo.' },
              { title: 'Identidad federada', desc: 'Cada miembro se identifica con sus documentos (cedula, pasaporte, etc.). Al federar dos nodos, se detectan duplicados y ambas asambleas deciden como resolver.' },
              { title: 'Gratis y con asesoria', desc: 'La plataforma es gratuita. Incluye asesoria para implementar el sistema en tu ecoaldea. No hay costos ocultos.' },
            ].map((b, i) => (
              <div key={i} className="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div className="flex-shrink-0 w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">{b.title}</h3>
                  <p className="text-sm text-gray-600">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Por que trabajar unificado */}
      <section className="bg-gradient-to-b from-white to-blue-50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Por que trabajar en un codigo unificado</h2>
          <p className="text-lg text-gray-600 leading-relaxed mb-8 text-center max-w-3xl mx-auto">
            Nunca hemos avanzado por trabajar aislados. Cada quien creando su propio sistema
            logra quizas unificar pequenos grupos dentro de su pais, pero si queremos una
            unificacion mundial, tiene que haber cosas que sean comunes.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <Code className="text-emerald-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Un codigo base, abierto y auditable</h3>
              <p className="text-sm text-gray-600">
                Todo el software es 100% de codigo abierto. Cualquiera puede auditarlo, modificarlo
                y adaptarlo a su realidad. Pero la base —la comunicacion entre nodos y la moneda
                trueque— debe ser la misma para todos. Las mejoras que se implementan en el codigo
                central quedan disponibles para todos. Si Uruguay agrega una funcion, Venezuela la
                puede usar. Si Venezuela mejora algo, Uruguay se beneficia.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Globe className="text-blue-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Tu tarjeta funciona en cualquier nodo</h3>
              <p className="text-sm text-gray-600">
                Como Visa o Mastercard: no importa en que pais o nodo estes, tu tarjeta NFC
                debe ser aceptada de inmediato, aplicando los limites del protocolo unificado
                de forma instantanea. Si cada pais inventa su propio protocolo, las tarjetas
                de un pais no funcionaran en otro, destruyendo la federacion.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Scale className="text-purple-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">La moneda trueque es unica</h3>
              <p className="text-sm text-gray-600">
                1 TQ = 1 kWh de energia fisica real. La energia no tiene nacionalidad. Si cada
                pais inventa su propia metrica, caemos en el mercado de divisas tradicional con
                especulacion cambiaria. La metrica debe ser universal y auditada colectivamente
                por el software para que el comercio inter-nodos sea justo.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                <Users className="text-amber-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Cooperacion, no aislamiento</h3>
              <p className="text-sm text-gray-600">
                Los que saben programar escriben codigo. Los que no saben programar lo auditan,
                lo entienden, y aceptan o rechazan los cambios en lenguaje humano. Las nuevas
                implementaciones se explican para que todos las entiendan. Asi nos apoyamos entre
                todos: lo que uno inventa, lo pone a disposicion de los demas.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-800 mb-3 text-center">Se puede desarrollar en otro lenguaje, pero...</h3>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              No es que no se puedan usar software separados. Cualquiera puede desarrollar la misma
              funcionalidad en el lenguaje que quiera. Pero tiene que garantizar que ese codigo pueda
              conversar correctamente con todas las implementaciones del codigo base. Tiene que ser
              100% compatible. La idea es que todos trabajemos en un codigo base donde todos sepamos
              que existe, lo auditemos, y despues cada quien puede cambiar el skin, los colores, el
              lenguaje con que se escribio —pero el motor interno y la comunicacion son exactamente
              lo mismo.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              <strong>Lo que se puede modificar localmente sin aprobacion:</strong> catalogo de
              productos, reglas de gobernanza interna, colores del sitio web, moneda de referencia
              local, servicios instalados, adaptaciones culturales, horarios de comercio.<br /><br />
              <strong>Lo que requiere aprobacion de todos los nodos:</strong> protocolo de
              comunicacion entre nodos, metrica de valor de la moneda trueque, protocolo criptografico
              de tarjetas NFC, estructura del ledger contable, reglas de expulsion de nodos.
            </p>
          </div>
        </div>
      </section>

      {/* Gobernanza Federada */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Tres Niveles de Gobernanza</h2>
        <p className="text-lg text-gray-600 leading-relaxed mb-4 text-center max-w-3xl mx-auto">
          El sistema tiene tres niveles de gobernanza, cada uno independiente internamente
          pero sujeto al nivel superior. Las reglas mas grandes engloban las cosas mas comunes
          entre todos. Las reglas de cada organizacion solo afectan dentro de su terreno.
          Las reglas universales afectan al mundo entero.
        </p>

        {/* Nivel 1: Federacion */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-4 border border-blue-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold">
              1
            </div>
            <h3 className="text-xl font-bold text-gray-800">Federacion (mundial)</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Decisiones que afectan a <strong>TODOS los nodos del mundo</strong>. Se deciden por
            votacion igualitaria de todos los nodos federados.
          </p>
          <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
            <div className="flex items-start gap-2"><Check size={16} className="text-blue-600 mt-0.5 flex-shrink-0" /> Canasta basica TQ (misma en todos)</div>
            <div className="flex items-start gap-2"><Check size={16} className="text-blue-600 mt-0.5 flex-shrink-0" /> Limite de credito global</div>
            <div className="flex items-start gap-2"><Check size={16} className="text-blue-600 mt-0.5 flex-shrink-0" /> Expulsion de nodos</div>
            <div className="flex items-start gap-2"><Check size={16} className="text-blue-600 mt-0.5 flex-shrink-0" /> Protocolo de comunicacion</div>
            <div className="flex items-start gap-2"><Check size={16} className="text-blue-600 mt-0.5 flex-shrink-0" /> Metrica de la moneda trueque</div>
            <div className="flex items-start gap-2"><Check size={16} className="text-blue-600 mt-0.5 flex-shrink-0" /> Protocolo criptografico NFC</div>
          </div>
          <div className="mt-3 bg-blue-100/50 rounded-lg p-3 text-xs text-gray-700">
            <strong>Por que la canasta es federada:</strong> La moneda trueque no tiene inflacion,
            asi que la canasta tiene que ser exactamente la misma en todas partes. Si un pais tiene
            una canasta mas alta y otro mas baja, se crea riqueza en un lado y pobreza en el otro.
            <br /><br />
            <strong>Esto no tiene nada que ver con el comercio exterior:</strong> Cada nodo hace su
            comercio exterior directamente en su moneda local (UYU, VES, ARS). El Factor de Conversion
            calcula el equivalente con TQ, pero eso es interno de cada nodo.
          </div>
        </div>

        {/* Nivel 2: Aldea */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 mb-4 border border-emerald-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold">
              2
            </div>
            <h3 className="text-xl font-bold text-gray-800">Aldea / Nodo (local)</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Decisiones que afectan a <strong>toda la comunidad local</strong>. Se deciden por
            asamblea del nodo. Cada nodo es soberano.
          </p>
          <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
            <div className="flex items-start gap-2"><Check size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" /> Horas de trabajo y sueldos</div>
            <div className="flex items-start gap-2"><Check size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" /> Catalogo de productos locales</div>
            <div className="flex items-start gap-2"><Check size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" /> Reglas de gobernanza interna</div>
            <div className="flex items-start gap-2"><Check size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" /> Admision de miembros</div>
            <div className="flex items-start gap-2"><Check size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" /> Comercio exterior (moneda local)</div>
            <div className="flex items-start gap-2"><Check size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" /> Horarios, tasas, comisiones</div>
            <div className="flex items-start gap-2"><Check size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" /> Sitio web publico</div>
            <div className="flex items-start gap-2"><Check size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" /> Adaptaciones culturales</div>
          </div>
          <div className="mt-3 bg-emerald-100/50 rounded-lg p-3 text-xs text-gray-700">
            <strong>Lo que decide la aldea no puede afectar la canasta basica federada.</strong> Las
            horas de trabajo, los sueldos y el comercio exterior son internos del nodo.
          </div>
        </div>

        {/* Nivel 3: Organizaciones */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 mb-4 border border-purple-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center font-bold">
              3
            </div>
            <h3 className="text-xl font-bold text-gray-800">Organizaciones (dentro de la aldea)</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Decisiones que afectan <strong> solo dentro de la organizacion</strong>. Se deciden por
            la asamblea de la organizacion. Un nodo puede tener varias organizaciones.
          </p>
          <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
            <div className="flex items-start gap-2"><Check size={16} className="text-purple-600 mt-0.5 flex-shrink-0" /> Reglas internas de la organizacion</div>
            <div className="flex items-start gap-2"><Check size={16} className="text-purple-600 mt-0.5 flex-shrink-0" /> Departamentos internos</div>
            <div className="flex items-start gap-2"><Check size={16} className="text-purple-600 mt-0.5 flex-shrink-0" /> Asambleas de organizacion</div>
            <div className="flex items-start gap-2"><Check size={16} className="text-purple-600 mt-0.5 flex-shrink-0" /> Roles y permisos internos</div>
          </div>
          <div className="mt-3 bg-purple-100/50 rounded-lg p-3 text-xs text-gray-700">
            Cada organizacion es <strong>independiente dentro de su propio terreno</strong>, pero
            esta sujeta a las reglas generales de la aldea.
          </div>
        </div>

        {/* Como funciona el consenso federado */}
        <div className="mt-6 bg-emerald-50 rounded-xl p-6">
          <h3 className="font-semibold text-gray-800 mb-2 text-center">Como funciona el consenso federado</h3>
          <p className="text-sm text-gray-700 text-center">
            Un nodo propone un cambio. Todos los nodos federados lo revisan y aprueban o rechazan.
            Por defecto se necesita el 100% (todos). Cuando se alcanza el consenso, el cambio se
            aplica automaticamente en todos. Si no se alcanza, se sigue usando el valor actual.
            El umbral se puede cambiar, pero para cambiarlo se necesita la aprobacion bajo el umbral
            actual. Asi nadie impone reglas unilateralmente.
          </p>
        </div>
      </section>

      {/* Piscina Global Multilateral vs Bilateral */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Piscina Global vs Piscinas Bilaterales</h2>
          <p className="text-lg text-gray-600 leading-relaxed mb-8 text-center max-w-3xl mx-auto">
            La federacion tiene dos formas de manejar el saldo entre nodos. Esto es algo nuevo
            que no existia antes: antes solo habia limites bilaterales entre dos nodos.
            Ahora existe una piscina global real compartida por todos.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Globe className="text-blue-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Piscina Global (Multilateral)</h3>
              <p className="text-sm text-gray-600 mb-3">
                Un saldo compartido entre <strong>todos los nodos federados</strong>. Si comercias
                con el nodo B y ganas un saldo, puedes gastarlo con el nodo C. No esta atado a un
                solo nodo. El limite depende del nivel del nodo (ver mas abajo).
              </p>
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-gray-700">
                <strong>Ejemplo:</strong> Compras semillas al nodo B (saldo negativo global).
                Luego vendes frutas al nodo C (saldo positivo global). El saldo se compensa
                automaticamente en la piscina compartida.
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-purple-100">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Network className="text-purple-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Piscinas Bilaterales</h3>
              <p className="text-sm text-gray-600 mb-3">
                Acuerdos especificos entre <strong>dos nodos</strong>. El saldo bilateral solo
                aplica entre esos dos nodos. <strong>No afecta la piscina global</strong>. Util
                cuando dos nodos quieren un limite mayor del normal para su comercio.
              </p>
              <div className="bg-purple-50 rounded-lg p-3 text-xs text-gray-700">
                <strong>Ejemplo:</strong> El nodo A y el nodo B acuerdan un limite bilateral de
                10000 TQ. Sus transacciones van a la piscina bilateral, no a la global.
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-800 mb-2 text-center">Como se decide cual piscina usar</h3>
            <p className="text-sm text-gray-700 text-center">
              Si hay un acuerdo bilateral activo entre los dos nodos, la transaccion va a la
              piscina bilateral. Si no hay acuerdo bilateral, va a la piscina global.
              Las transacciones bilaterales <strong>nunca</strong> afectan la piscina global
              y viceversa.
            </p>
          </div>
        </div>
      </section>

      {/* Niveles de Nodo Federado */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Niveles de Nodo Federado</h2>
        <p className="text-lg text-gray-600 leading-relaxed mb-8 text-center max-w-3xl mx-auto">
          Los nodos de la federacion tienen niveles que determinan sus permisos, limites y derechos.
          Esto es diferente a los niveles de miembro dentro de un nodo: estos niveles aplican
          a los nodos mismos dentro de la federacion mundial.
        </p>

        <div className="space-y-4">
          {/* Nivel 1 */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gray-500 text-white rounded-xl flex items-center justify-center font-bold">1</div>
              <h3 className="text-xl font-bold text-gray-800">Nodo Nuevo</h3>
              <span className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">Limite: 1000 TQ</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Nodo recien ingresado a la federacion. Tiene voz (puede opinar) pero
              <strong> no tiene voto</strong> en propuestas federadas y <strong>no puede patrocinar</strong>
              nuevos nodos. Debe permanecer al menos <strong>90 dias</strong> antes de poder solicitar
              subida de nivel.
            </p>
            <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
              <div className="flex items-start gap-2"><Check size={16} className="text-gray-500 mt-0.5 flex-shrink-0" /> Puede comerciar con la piscina global</div>
              <div className="flex items-start gap-2"><Check size={16} className="text-gray-500 mt-0.5 flex-shrink-0" /> Tiene voz en la federacion</div>
              <div className="flex items-start gap-2"><span className="text-red-500 mt-0.5 flex-shrink-0">✕</span> No puede votar propuestas federadas</div>
              <div className="flex items-start gap-2"><span className="text-red-500 mt-0.5 flex-shrink-0">✕</span> No puede patrocinar nodos nuevos</div>
            </div>
          </div>

          {/* Nivel 2 */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold">2</div>
              <h3 className="text-xl font-bold text-gray-800">Nodo Aceptado</h3>
              <span className="text-sm bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">Limite: 5000 TQ</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Nodo aprobado por asamblea federada. <strong>Con derecho a voto</strong> en propuestas
              federadas y <strong>puede patrocinar</strong> nuevos nodos (actuar como padrino).
              Debe permanecer al menos <strong>180 dias</strong> antes de poder subir a nivel 3.
            </p>
            <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
              <div className="flex items-start gap-2"><Check size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" /> Puede votar propuestas federadas</div>
              <div className="flex items-start gap-2"><Check size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" /> Puede patrocinar nodos nuevos</div>
              <div className="flex items-start gap-2"><Check size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" /> Limite mayor en la piscina global</div>
              <div className="flex items-start gap-2"><Check size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" /> Participa en decisiones federadas</div>
            </div>
          </div>

          {/* Nivel 3 */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-600 text-white rounded-xl flex items-center justify-center font-bold">3</div>
              <h3 className="text-xl font-bold text-gray-800">Nodo Pleno</h3>
              <span className="text-sm bg-amber-100 text-amber-700 px-3 py-1 rounded-full">Limite: 20000 TQ</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Nodo de plena confianza. Subida <strong>automatica</strong> desde nivel 2 si cumple:
              minimo 180 dias en nivel 2, reciprocidad (tanto aporta como recibe), y limite promedio
              superior a la mitad del limite actual. Un nodo inactivo no califica.
            </p>
            <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
              <div className="flex items-start gap-2"><Check size={16} className="text-amber-600 mt-0.5 flex-shrink-0" /> Limite mas alto de la piscina global</div>
              <div className="flex items-start gap-2"><Check size={16} className="text-amber-600 mt-0.5 flex-shrink-0" /> Subida automatica con reciprocidad</div>
              <div className="flex items-start gap-2"><Check size={16} className="text-amber-600 mt-0.5 flex-shrink-0" /> Puede patrocinar y votar</div>
              <div className="flex items-start gap-2"><Check size={16} className="text-amber-600 mt-0.5 flex-shrink-0" /> Requiere actividad reciproca real</div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 rounded-xl p-6">
          <h3 className="font-semibold text-gray-800 mb-2 text-center">Subida de nivel</h3>
          <p className="text-sm text-gray-700 text-center">
            <strong>Nivel 1 a nivel 2:</strong> Requiere votacion federada (todos los nodos con voto
            deciden). No se puede proponer antes de que pasen los dias minimos configurados.
            Al subir a nivel 2, se libera el limite retenido del padrino.
            <br /><br />
            <strong>Nivel 2 a nivel 3:</strong> Automatico si cumple reciprocidad + limite promedio.
            No requiere votacion. Un nodo que solo envia o solo recibe no califica: debe demostrar
            actividad reciproca real.
          </p>
        </div>
      </section>

      {/* Sistema de Padrino */}
      <section className="bg-gradient-to-b from-emerald-50 to-white py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Sistema de Padrino (Patrocinador)</h2>
          <p className="text-lg text-gray-600 leading-relaxed mb-8 text-center max-w-3xl mx-auto">
            Cuando un nodo nuevo quiere entrar a la federacion, no entra solo. Necesita un
            <strong> padrino</strong>: un nodo nivel 2+ que lo respalda y es responsable por el.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <Users className="text-emerald-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Como funciona</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>1. Un nodo nivel 2+ acepta ser el padrino del nodo nuevo</li>
                <li>2. El nodo nuevo entra a nivel 1 con su limite (ej: 1000 TQ)</li>
                <li>3. El limite del padrino se <strong>reduce</strong> en el mismo monto</li>
                <li>4. El padrino es <strong>responsable</strong> del nodo nuevo</li>
                <li>5. Si el nodo nuevo entra en default, la <strong>deuda pasa al padrino</strong></li>
                <li>6. Cuando el nodo sube a nivel 2, el limite del padrino se <strong>libera</strong></li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                <Scale className="text-amber-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Ejemplo practico</h3>
              <p className="text-sm text-gray-600 mb-3">
                El nodo A (nivel 2, limite 5000 TQ) patrocina al nodo B (nuevo, 1000 TQ).
              </p>
              <div className="bg-amber-50 rounded-lg p-3 text-xs text-gray-700 space-y-1">
                <div>• Limite normal de A: 5000 TQ</div>
                <div>• Patrocinio de B: -1000 TQ</div>
                <div>• <strong>Limite efectivo de A: 4000 TQ</strong></div>
                <div className="pt-2">• A puede patrocinar hasta 4 nodos (5000 / 1000 = 4)</div>
                <div>• Si B sube a nivel 2, A recupera sus 1000 TQ</div>
                <div>• Si B entra en default, A asume la deuda de B</div>
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-800 mb-2 text-center">Por que el sistema de padrino</h3>
            <p className="text-sm text-gray-700 text-center">
              Evita que cualquier nodo entre a la federacion sin responsabilidad. El padrino
              arriesga su propio limite y responde por el nodo nuevo. Asi se previene la admision
              descontrolada de nodos que podrian no cumplir sus compromisos.
            </p>
          </div>
        </div>
      </section>

      {/* Verificacion de 4 Opciones */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Verificacion de 4 Opciones</h2>
        <p className="text-lg text-gray-600 leading-relaxed mb-8 text-center max-w-3xl mx-auto">
          Para unirse a la federacion o emparejar un terminal POS, usamos un sistema de verificacion
          que obliga a comunicarse fuera de banda (por telefono, mensaje, en persona).
        </p>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 max-w-2xl mx-auto">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
              <div>
                <h3 className="font-semibold text-gray-800">El nodo nuevo genera un codigo</h3>
                <p className="text-sm text-gray-600">El nodo nuevo inicia la solicitud y obtiene un codigo de 6 digitos.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
              <div>
                <h3 className="font-semibold text-gray-800">El padrino ve 4 codigos diferentes</h3>
                <p className="text-sm text-gray-600">En la pantalla del padrino aparecen 4 codigos. Solo uno es el correcto.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
              <div>
                <h3 className="font-semibold text-gray-800">Comunicacion fuera de banda</h3>
                <p className="text-sm text-gray-600">El nodo nuevo le dice el codigo correcto al padrino por telefono, mensaje o en persona.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">4</div>
              <div>
                <h3 className="font-semibold text-gray-800">El padrino elige el correcto</h3>
                <p className="text-sm text-gray-600">Si elige bien, el nodo entra a la federacion. Si elige mal, se rechaza. El codigo expira en 60 segundos.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 rounded-xl p-6">
          <h3 className="font-semibold text-gray-800 mb-2 text-center">Por que 4 opciones y no solo mostrar el codigo</h3>
          <p className="text-sm text-gray-700 text-center">
            Si ambos lados ven el mismo codigo en pantalla, un atacante en el medio podria interceptar
            la conexion y mostrar el mismo codigo falso a ambos. Con 4 opciones, el atacante no sabe
            cual es el correcto: tiene que adivinar (25% de probabilidad). Obligar a comunicar el
            codigo por otro canal (telefono) hace que el atacante no pueda enganar a ningun lado.
          </p>
        </div>
      </section>

      {/* Integridad Distribuida */}
      <section className="bg-gradient-to-b from-white to-blue-50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Integridad Distribuida</h2>
          <p className="text-lg text-gray-600 leading-relaxed mb-8 text-center max-w-3xl mx-auto">
            Cada nodo tiene su propia base de datos y puede funcionar sin internet. Como garantizamos
            que las transacciones entre nodos sean validas y que nadie haga trampa? Con firma dual
            y hash encadenado.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Scale className="text-blue-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Firma Dual</h3>
              <p className="text-sm text-gray-600">
                Cada transaccion entre nodos debe ser firmada por <strong>AMBOS nodos</strong> con
                sus claves criptograficas. El nodo A crea y firma la transaccion. El nodo B verifica
                la firma de A, firma tambien, y devuelve la transaccion dual-firmada. Una transaccion
                sin ambas firmas <strong>no es valida</strong>. Ningun nodo puede crear una
                obligacion unilateral.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-purple-100">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Network className="text-purple-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Hash Encadenado</h3>
              <p className="text-sm text-gray-600">
                Cada transaccion incluye el hash de la transaccion anterior (como una blockchain
                simplificada). Si alguien intenta insertar, modificar o eliminar una transaccion,
                la cadena se rompe y se detecta inmediatamente. Al reconectar dos nodos, comparan
                sus hashes y sincronizan cualquier divergencia.
              </p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-800 mb-2 text-center">Reconciliacion al reconectar</h3>
            <p className="text-sm text-gray-700 text-center">
              Cuando un nodo que estaba offline se reconecta, compara los hashes de su cadena con
              los del otro nodo. Si coinciden, estan sincronizados. Si no, intercambian las
              transacciones divergentes, verifican las firmas y los hashes, e incorporan las
              validas. Las invalidas se auditan. Asi se garantiza que ambos nodos tengan la misma
              vision de las transacciones, sin necesidad de una base de datos central.
            </p>
          </div>
        </div>
      </section>

      {/* Que incluye el sistema */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Que incluye el sistema actualmente?</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            'Gestion de miembros y niveles',
            'Solicitudes de admision con documentos',
            'Asambleas y votaciones',
            'Organizaciones y departamentos',
            'Intercambios y credito mutuo (TQ)',
            'Catalogo de productos con precios energeticos',
            'App Android POS (cobro QR + NFC)',
            'POS web para iPhone/computadoras',
            'Terminales ESP32 (keypad, touch, comunitario)',
            'Lector NFC Bluetooth (accesorio del POS)',
            'Emparejamiento por codigo corto',
            'Notificaciones (WebPush, XMPP, SMS, Telegram)',
            'Contabilidad y auditoria',
            'Recuperacion de cuentas (multisig)',
            'Federacion entre nodos',
            'Piscina global multilateral (saldo compartido)',
            'Piscinas bilaterales (acuerdos entre dos nodos)',
            'Niveles de nodo federado (Nuevo, Aceptado, Pleno)',
            'Sistema de padrino (patrocinador responsable)',
            'Verificacion de 4 opciones (anti-MITM)',
            'Firma dual + hash encadenado (integridad)',
            'Reconciliacion automatica al reconectar',
            'Sitio web publico configurable',
            'Gobernanza configurable por nodo',
            'Gobernanza federada entre nodos',
            'Comercio exterior con 20 monedas locales',
            'Calculadora de precios por energia',
            'Canasta basica federada (mismo valor en todos)',
            'Internet paralelo cifrado (WireGuard)',
            'Intranet local off-grid (OpenWrt)',
            'Servicios federados un solo clic (Matrix, Nextcloud, VoIP, +20)',
            'Instalador automatico con asistente',
            'Nodo demo que se reinicia cada 24h',
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-2 bg-white rounded-lg p-3 border border-gray-100">
              <Check className="text-emerald-600 flex-shrink-0" size={18} />
              <span className="text-sm text-gray-700">{feature}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Aporta ideas - Propuestas */}
      <section id="proponer" className="bg-gradient-to-b from-white to-emerald-50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-4 text-center">Aporta tus ideas</h2>
          <p className="text-lg text-gray-600 text-center mb-8 max-w-2xl mx-auto">
            El sistema esta en desarrollo continuo. Si tienes una ecoaldea o comunidad, cuentanos que
            necesitas. Si ves algo que falta, proponlo. Si tienes experiencia, compartela.
            Las propuestas mas votadas seran priorizadas.
          </p>

          {msg && <div className="text-center text-sm bg-blue-50 text-blue-700 p-3 rounded-lg mb-4 max-w-md mx-auto">{msg}</div>}

          <div className="text-center mb-8">
            <button
              onClick={() => setShowProposalForm(!showProposalForm)}
              className="bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-emerald-700 transition inline-flex items-center gap-2"
            >
              <MessageSquare size={18} /> {showProposalForm ? 'Cancelar' : 'Enviar propuesta'}
            </button>
          </div>

          {showProposalForm && (
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 max-w-2xl mx-auto mb-8 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titulo de la propuesta</label>
                <input
                  type="text"
                  value={newProposal.title}
                  onChange={(e) => setNewProposal({ ...newProposal, title: e.target.value })}
                  placeholder="Ej: Sistema de trueque multi-nodo"
                  className="w-full border rounded-lg p-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  value={newProposal.category}
                  onChange={(e) => setNewProposal({ ...newProposal, category: e.target.value })}
                  className="w-full border rounded-lg p-3 text-sm"
                >
                  {Object.entries(categoryLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <textarea
                  value={newProposal.description}
                  onChange={(e) => setNewProposal({ ...newProposal, description: e.target.value })}
                  placeholder="Describe tu propuesta en detalle. Que problema resuelve? Como te imaginarias que funcionaria?"
                  rows={4}
                  className="w-full border rounded-lg p-3 text-sm"
                />
              </div>
              <button
                onClick={submitProposal}
                disabled={submitting}
                className="bg-emerald-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-emerald-700 transition inline-flex items-center gap-2"
              >
                {submitting ? 'Enviando...' : 'Enviar'} <Send size={16} />
              </button>
            </div>
          )}

          {/* Lista de propuestas */}
          {proposals.length > 0 && (
            <div className="space-y-3 max-w-2xl mx-auto">
              <h3 className="font-semibold text-gray-700 mb-3">Propuestas de la comunidad ({proposals.length})</h3>
              {proposals.map((p: any, i: number) => (
                <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800">{p.title}</h4>
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                        {categoryLabels[p.category] || p.category}
                      </span>
                    </div>
                    <button
                      onClick={() => voteProposal(p.id)}
                      disabled={votedIds.has(p.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        votedIds.has(p.id)
                          ? 'bg-emerald-100 text-emerald-600 cursor-default'
                          : 'bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-600'
                      }`}
                    >
                      <ThumbsUp size={14} /> {p.votes || 0}
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">{p.description}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {p.author_name || 'Anonimo'} - {fmtDate(p.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Mensaje para compartir */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-4 text-center">Comparte este proyecto</h2>
          <p className="text-lg text-gray-600 text-center mb-8 max-w-2xl mx-auto">
            Si conoces a alguien que quiere crear una ecoaldea o ya tiene una, comparte este mensaje en redes sociales.
          </p>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 max-w-2xl mx-auto relative">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(SHARE_MESSAGE)
                setCopiedMsg(true)
                setTimeout(() => setCopiedMsg(false), 3000)
              }}
              className="absolute top-4 right-4 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 hover:bg-emerald-700 transition"
            >
              {copiedMsg ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
            </button>

            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap pr-20 text-sm leading-relaxed">
{SHARE_MESSAGE}
            </div>
          </div>

          <div className="text-center mt-6">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(SHARE_MESSAGE)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-green-700 transition"
            >
              <Share2 size={18} /> Compartir por WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Demo - solo se muestra en el nodo principal, no en el demo */}
      {(window as any).__BASE_PATH__ !== '/demo' && (
      <section className="bg-emerald-700 text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Quieres ver el sistema por dentro?</h2>
          <p className="text-lg text-emerald-100 mb-6 max-w-2xl mx-auto">
            Tenemos un <strong>nodo demo</strong> completo y funcional: un sistema con datos de muestra
            (usuarios, organizaciones, productos, transacciones) para que puedas explorar todo libremente.
            No afecta al nodo real. Se reinicia cada 24 horas.
          </p>

          {/* Estado del nodo demo */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 max-w-md mx-auto border border-white/20 mb-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              {demoState === 'running' && (
                <span className="flex items-center gap-2 text-green-300">
                  <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                  Nodo demo activo
                </span>
              )}
              {demoState === 'stopped' && (
                <span className="flex items-center gap-2 text-yellow-200">
                  <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                  Nodo demo detenido
                </span>
              )}
              {demoState === 'starting' && (
                <span className="flex items-center gap-2 text-blue-200">
                  <Loader2 size={16} className="animate-spin" />
                  Iniciando nodo demo...
                </span>
              )}
              {demoState === 'unknown' && (
                <span className="flex items-center gap-2 text-gray-300">
                  <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                  Verificando estado...
                </span>
              )}
            </div>

            {/* Boton principal */}
            {demoState === 'running' ? (
              <a
                href="/demo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white text-emerald-700 font-semibold px-8 py-4 rounded-xl hover:bg-emerald-50 transition text-lg"
              >
                <ExternalLink size={20} /> Entrar al Nodo Demo
              </a>
            ) : (
              <div className="space-y-4">
                {/* Selector de preconfiguracion */}
                <div className="text-left">
                  <label className="text-sm text-emerald-100 font-medium flex items-center gap-1 mb-2">
                    <Sparkles size={14} /> Preconfiguracion del demo
                  </label>
                  <p className="text-xs text-emerald-200 mb-2">
                    Elige los datos con los que se iniciara el demo. Cada perfil carga
                    usuarios, organizaciones y reglas distintas.
                  </p>
                  {!demoPresetsLoaded && (
                    <button
                      onClick={loadDemoPresets}
                      className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition"
                    >
                      Ver preconfiguraciones disponibles
                    </button>
                  )}
                  {demoPresetsLoaded && demoPresets.length > 0 && (
                    <select
                      value={demoPresetSel}
                      onChange={(e) => setDemoPresetSel(e.target.value)}
                      className="w-full bg-white text-gray-800 rounded-lg p-2.5 text-sm border border-white/30"
                    >
                      {demoPresets.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.category})
                        </option>
                      ))}
                    </select>
                  )}
                  {demoPresetsLoaded && demoPresets.length > 0 && demoPresets.find((p) => p.id === demoPresetSel) && (
                    <p className="text-xs text-emerald-200 italic mt-2 bg-white/10 rounded-lg p-2">
                      {demoPresets.find((p) => p.id === demoPresetSel)?.description}
                    </p>
                  )}
                </div>

                <button
                  onClick={startDemo}
                  disabled={demoStarting || demoState === 'starting'}
                  className="inline-flex items-center gap-2 bg-white text-emerald-700 font-semibold px-8 py-4 rounded-xl hover:bg-emerald-50 transition text-lg disabled:opacity-60"
                >
                  {demoStarting ? (
                    <><Loader2 size={20} className="animate-spin" /> Iniciando...</>
                  ) : (
                    <><Power size={20} /> Iniciar Nodo Demo</>
                  )}
                </button>
              </div>
            )}

            <p className="text-xs text-emerald-200 mt-4">
              {demoState === 'running'
                ? 'El nodo demo esta activo. Entra y explora libremente.'
                : 'El nodo demo no esta corriendo para ahorrar recursos. Pulsa el boton para iniciarlo. Toma unos segundos en arrancar.'}
            </p>
            <p className="text-xs text-emerald-200 mt-2">
              Se detiene automaticamente cada 24 horas. Cada vez que reinicia, parte de cero con datos frescos.
            </p>

            {/* Consola de progreso en tiempo real */}
            {(demoStarting || demoError) && (
              <div className="mt-4 text-left">
                <div className={`rounded-lg p-3 ${demoError ? 'bg-red-950/80 border border-red-700/50' : 'bg-emerald-950/80 border border-emerald-700/50'}`}>
                  <div className={`flex items-center gap-2 text-xs font-semibold mb-2 ${demoError ? 'text-red-300' : 'text-emerald-300'}`}>
                    {demoStarting ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : demoError ? (
                      <AlertCircle size={12} />
                    ) : (
                      <CheckCircle size={12} />
                    )}
                    {demoStartMsg || 'Procesando...'}
                  </div>
                  <pre className={`text-[10px] font-mono whitespace-pre-wrap max-h-60 overflow-y-auto ${demoError ? 'text-red-200/80' : 'text-emerald-200/80'}`}>
                    {demoStartLog}
                  </pre>
                  {demoError && (
                    <button
                      onClick={() => { setDemoError(false); setDemoStartLog(''); setDemoStartMsg('') }}
                      className="mt-2 text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded transition"
                    >
                      Cerrar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="text-sm text-emerald-200 max-w-2xl mx-auto">
            <p>El nodo demo tiene su propio sistema completo:</p>
            <div className="grid grid-cols-2 gap-2 mt-3 text-left max-w-lg mx-auto">
              <div className="flex items-center gap-2"><Check size={14} /> Junta Directiva</div>
              <div className="flex items-center gap-2"><Check size={14} /> Organizaciones</div>
              <div className="flex items-center gap-2"><Check size={14} /> Departamentos</div>
              <div className="flex items-center gap-2"><Check size={14} /> Productos y tiendas</div>
              <div className="flex items-center gap-2"><Check size={14} /> Transacciones</div>
              <div className="flex items-center gap-2"><Check size={14} /> Asambleas</div>
              <div className="flex items-center gap-2"><Check size={14} /> Auditoria</div>
              <div className="flex items-center gap-2"><Check size={14} /> Login por roles</div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Compartir modelos entre aldeas */}
      <section className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Compartir modelos entre aldeas</h2>
          <p className="text-lg text-gray-600 leading-relaxed mb-8 text-center max-w-3xl mx-auto">
            La idea es ser 100% transparentes. Compartir, no acapararse las ventajas.
            Si alguien inventa algo que funciona, lo pone a disposicion de los demas.
            Para eso usamos una red de aldeas federada: compartimos experiencias,
            gobernanza que nos ha dado exito, y los codigos.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-emerald-50 rounded-2xl p-6">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <Network className="text-emerald-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Copiar modelos que funcionan</h3>
              <p className="text-sm text-gray-600">
                Viene alguien nuevo, analiza las aldeas existentes: cual es su gobernanza interna,
                como funciona, y puede copiar el modelo para implementar en su propia aldea sin
                arrancar desde cero dandose golpes.
              </p>
            </div>
            <div className="bg-blue-50 rounded-2xl p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Globe className="text-blue-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Implementaciones federadas</h3>
              <p className="text-sm text-gray-600">
                Cada nodo puede agregar nuevas implementaciones y modulos. Los demas nodos pueden
                verlas, descargarlas y usarlas tambien. Lo que tu inventas, otros lo pueden copiar
                a su propio nodo.
              </p>
            </div>
            <div className="bg-purple-50 rounded-2xl p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Code className="text-purple-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Codigos universales y limpios</h3>
              <p className="text-sm text-gray-600">
                Los codigos se crean completamente limpios para que cualquiera lo pueda adaptar a
                su realidad. Todos los codigos deberian tener en los ajustes la opcion de cambiar
                el nodo por defecto, para que la gente de cualquier nodo lo pueda usar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ - Preguntas frecuentes sobre la federacion */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-4 text-center">
            Preguntas Frecuentes sobre la Federacion
          </h2>
          <p className="text-gray-600 text-center mb-10 max-w-2xl mx-auto">
            Resolvemos las dudas mas comunes sobre como funciona la red de comunidades federadas,
            el trueque, y como sumarte.
          </p>
          <FederationFaq />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        <p>Red de Intercambio Federada - Plataforma libre para ecoaldeas y comunidades</p>
        <p className="mt-1">Gratis, configurable, federada. Abierta a aportes.</p>
      </footer>
    </div>
  )
}

// ============================================
// FAQ - Preguntas frecuentes sobre la federacion
// ============================================
const FEDERATION_FAQS = [
  {
    q: '¿Para que sirve federarse? ¿No es mejor que cada comunidad funcione sola?',
    a: 'Cada comunidad es autónoma y toma sus propias decisiones internas. Pero federarse tiene ventajas: puedes intercambiar con miembros de otras comunidades, el espectro de lo que puedes aportar y recibir se amplía, y las comunidades se apoyan mutuamente. Una comunidad sola es frágil; una red de comunidades es robusta. Si una comunidad tiene problemas, las demás pueden ayudar.',
  },
  {
    q: '¿Tengo que aportar algo para entrar a una comunidad federada?',
    a: 'Sí. Esta es la regla más importante: para entrar tienes que tener algo que aportar. Puede ser productos, trabajo, talentos, servicios, o conocimientos. Si solo quieres recibir pero no tienes nada que aportar, el trueque no te va a funcionar. Muchas monedas comunitarias fracasan porque entra mucha gente que solo quiere recibir y poca gente que aporta. Por eso, antes de entrar, pregúntate: ¿Qué tengo yo que la comunidad pueda necesitar? ¿Qué tiene la comunidad que yo pueda necesecer? Si ambas respuestas son positivas, vale la pena que te integres.',
  },
  {
    q: '¿Por que el saldo perfecto es cero?',
    a: 'El objetivo de todo miembro es que su saldo sea cero. Si tu saldo está en cero, significa que has aportado a la comunidad exactamente lo mismo que has recibido de ella. Eso es equilibrio. Si tu saldo está muy negativo, estás recibiendo mucho pero aportando poco: tienes que aportar más. Si está muy positivo, estás aportando mucho pero no aprovechando lo que la comunidad ofrece. El saldo cero es la meta de todos.',
  },
  {
    q: '¿Que pasa si solo quiero recibir de la comunidad pero no tengo nada que aportar?',
    a: 'El trueque no funciona así. El trueque requiere que ambos lados ganen: tú aportas algo y recibes algo a cambio. Si entras sin nada que aportar, solo estarías recibiendo de los demás sin devolver nada. Eso desequilibra el sistema y no es justo. Si quieres consumir productos de la feria sin ser miembro, puedes venir como visitante y comprar en moneda local. Para ser miembro del trueque, necesitas aportar.',
  },
  {
    q: '¿Puedo usar mi saldo TQ en otra comunidad de la federacion?',
    a: 'Sí. Esa es una de las ventajas de la federación. Si vas a otra comunidad federada, puedes usar tu tarjeta NFC o tu cuenta para intercambiar. Pero recuerda: el saldo sigue siendo el mismo. Si gastas en otra comunidad, tu saldo baja. La federación no crea dinero nuevo, solo amplía el espectro de lo que puedes recibir.',
  },
  {
    q: '¿Mi comunidad tiene que usar el mismo software que las demas?',
    a: 'Sí, todas las comunidades federadas usan el mismo software base porque es la única forma de garantizar que los intercambios funcionen correctamente entre comunidades. Pero cada comunidad puede personalizar los colores, textos, idioma, y reglas internas de su plataforma. La base técnica es compartida, pero la identidad de cada comunidad es propia. El software es de código abierto, así que cualquiera puede auditarlo y adaptarlo.',
  },
  {
    q: '¿Que pasa mientras hay pocas comunidades federadas?',
    a: 'Al principio, con pocas comunidades, el espectro de lo que puedes aportar y recibir es más limitado. Por eso es crucial que cada comunidad que se federé garantice que sus miembros tienen algo real que aportar. A medida que más comunidades se federen, el espectro se amplía: más productos, más servicios, más lugares donde aportar trabajo, más cosas que recibir. La federación se hace más sólida cuantas más comunidades participen.',
  },
  {
    q: '¿Quien gobierna la federacion?',
    a: 'La federación se gobierna por votación de todos los nodos federados. Cada comunidad (nodo) tiene un voto. Las decisiones que afectan a toda la federación (como la canasta básica TQ, el límite de crédito global, o la expulsión de un nodo problemático) se toman colectivamente. Ninguna comunidad puede imponer reglas sobre las demás.',
  },
  {
    q: '¿La moneda TQ tiene inflacion?',
    a: 'No. La moneda TQ no tiene inflación porque no está atada al dinero de ningún país ni al oro. Está atada a la energía: 1 TQ = 1 kWh. La energía no se devalúa. Una hora de trabajo hoy vale lo mismo que una hora de trabajo dentro de 10 años. Esto significa que lo que ahorras en TQ mantiene su valor real con el tiempo, a diferencia del dinero en el banco que pierde valor cada mes por la inflación.',
  },
  {
    q: '¿Puedo acumular TQ para hacerme rico?',
    a: 'El sistema no está diseñado para que nadie se haga rico acumulando números. El objetivo es el equilibrio: aportar y recibir en proporción similar. Acumular mucho TQ significa que estás aportando mucho pero no aprovechando lo que la comunidad ofrece. En lugar de acumular TQ, te invitamos a acumular riqueza real y tangible: tu vivienda, tu conuco, tus herramientas, tus semillas, tus relaciones comunitarias. Eso sí es riqueza de verdad.',
  },
  {
    q: '¿Se mezclan las ventas al publico con el trueque?',
    a: '¡No! Las ventas al público general son externas y se pagan en moneda local del país (pesos, bolívares, etc.). El trueque TQ es solo entre miembros registrados. Los compradores externos no tienen cuentas TQ ni participan del trueque. Esto es muy importante: no podemos mezclar las ventas al público con el trueque, porque son cosas distintas con reglas distintas.',
  },
  {
    q: '¿Como se si vale la pena integrarme a una comunidad federada?',
    a: 'Hazte estas tres preguntas: 1) ¿Tengo algo que aportar que la comunidad pueda necesitar? (productos, trabajo, talentos, servicios). 2) ¿Tiene la comunidad algo que yo necesite o me interese? (alimentos, trabajo, servicios, conexión con personas). 3) ¿Estoy dispuesto a participar activamente, no solo a recibir? Si las tres respuestas son sí, vale la pena que te integres. Si solo quieres recibir pero no tienes nada que aportar, el trueque no te va a funcionar.',
  },
  {
    q: '¿Que cosas puedo aportar ademas de productos?',
    a: 'Puedes aportar productos (frutas, verduras, huevos, panes, artesanías, conservas, medicina natural), servicios (reparaciones, transporte, clases, cuidado de niños, peluquería), trabajo (ayuda en conucos, construcción, limpieza, organización de eventos), o conocimientos (talleres, asesorías, mentorías). Todo lo que la comunidad valore puede ser un aporte. No tiene que ser solo cosas materiales: el tiempo y el talento también cuentan.',
  },
  {
    q: '¿Necesito tener tierra o un conuco para entrar?',
    a: 'No necesariamente. Hay miembros que son productores con tierra, pero también hay artesanos, panaderos, herbolarios, personas que ofrecen servicios, y personas que aportan su trabajo en los conucos de otros. Lo importante no es qué tienes, sino qué puedes aportar con lo que tienes.',
  },
  {
    q: '¿Que pasa si mi saldo se va muy negativo?',
    a: 'Si tu saldo baja demasiado, el sistema te avisa. Tienes que aportar más (vender productos, ofrecer trabajo, dar talleres) para subir tu saldo. Si no logras subirlo, la asamblea puede revisar tu caso. La idea no es castigar, sino ayudarte a encontrar equilibrio. Pero si una persona solo recibe y nunca aporta, la asamblea puede decidir que ya no puede seguir en el sistema.',
  },
  {
    q: '¿Puedo salir de la comunidad cuando quiera?',
    a: 'Sí. Lo ideal es que antes de salir, tu saldo esté en cero o cercano a cero. Si tu saldo está muy negativo (recibiste más de lo que aportaste), la asamblea puede pedirte que aportes algo antes de irte para equilibrar tu cuenta. Si tu saldo está positivo, simplemente pierdes ese saldo al salir, ya que el TQ no tiene valor fuera de la comunidad.',
  },
  {
    q: '¿La federacion funciona sin internet?',
    a: 'La federación puede funcionar de dos formas: por Internet público (cuando las comunidades están lejos) o por intranet comunitaria usando túneles WireGuard (cuando están cerca y no dependen de Internet público). Esto significa que incluso comunidades sin acceso a Internet pueden federarse si instalan OpenWrt y configuran los túneles.',
  },
  {
    q: '¿Mi comunidad tiene que pagar para usar el software?',
    a: 'No. El software es 100% gratuito y de código abierto. Cualquier comunidad puede instalarlo, usarlo, y adaptarlo sin pagar licencias. Lo único que necesitas es un servidor (puede ser una computadora modesta) y alguien con conocimientos básicos de informática para la instalación. La comunidad de desarrolladores ayuda con la configuración inicial.',
  },
]

function FederationFaq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {FEDERATION_FAQS.map((faq, idx) => {
        const isOpen = openIdx === idx
        return (
          <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <button
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition"
            >
              <span className="font-semibold text-gray-800 text-sm sm:text-base">{faq.q}</span>
              <span className="p-1.5 rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </span>
            </button>
            {isOpen && (
              <div className="px-4 sm:px-5 pb-5 pt-1 text-sm text-gray-600 leading-relaxed border-t border-gray-100">
                {faq.a}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
