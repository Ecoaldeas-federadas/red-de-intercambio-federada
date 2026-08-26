import { useState, useEffect } from 'react'
import { api } from '../../api'
import {
  Globe, Users, Network, Leaf, Heart, Scale, ArrowRight, Check,
  Sparkles, MessageSquare, ThumbsUp, Send, Menu, X, Home, Copy, Share2,
  Power, Loader2, ExternalLink, AlertCircle, CheckCircle
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

      {/* Gobernanza Federada */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Gobernanza Federada</h2>
        <p className="text-lg text-gray-600 leading-relaxed mb-4 text-center max-w-2xl mx-auto">
          Algunos valores afectan a TODA la federacion, no a un solo nodo.
          La canasta basica interna, por ejemplo, es el mismo valor en todos los nodos.
          Para cambiarla, todos los nodos deben aprobar.
        </p>
        <div className="grid md:grid-cols-3 gap-4 mt-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <Scale className="text-blue-600" size={24} />
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">Canasta Federada</h3>
            <p className="text-sm text-gray-600">
              El costo de la canasta basica interna (500 TQ) es el mismo en todos los nodos.
              Esto garantiza que el TQ tenga el mismo poder adquisitivo en todas las aldeas.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
              <Users className="text-emerald-600" size={24} />
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">Consenso entre Nodos</h3>
            <p className="text-sm text-gray-600">
              Por defecto, todos los nodos deben aprobar un cambio (100%).
              Un solo nodo que rechace bloquea el cambio. Asi se protege la estabilidad del sistema.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <Network className="text-purple-600" size={24} />
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">Umbral Configurable</h3>
            <p className="text-sm text-gray-600">
              El umbral de aprobacion se puede cambiar (por ejemplo a 50%+1), pero para cambiarlo
              se necesita la aprobacion bajo el umbral actual. Asi nadie impone reglas unilateralmente.
            </p>
          </div>
        </div>
        <div className="mt-6 bg-emerald-50 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-700">
            <strong>Como funciona:</strong> Un nodo propone un cambio. Todos los nodos federados
            lo revisan y aprueban o rechazan. Cuando se alcanza el consenso, el cambio se aplica
            automaticamente en todos. Si no se alcanza, se sigue usando el valor actual.
          </p>
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
            'Terminales NFC para pagos',
            'Notificaciones (WebPush, XMPP, SMS, Telegram)',
            'Contabilidad y auditoria',
            'Recuperacion de cuentas (multisig)',
            'Federacion entre nodos',
            'Sitio web publico configurable',
            'Gobernanza configurable por nodo',
            'Gobernanza federada entre nodos',
            'Comercio exterior con puente externo',
            'Calculadora de precios por energia',
            'Canasta basica federada (mismo valor en todos los nodos)',
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
                    {p.author_name || 'Anonimo'} - {new Date(p.created_at).toLocaleDateString()}
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

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        <p>Red de Intercambio Federada - Plataforma libre para ecoaldeas y comunidades</p>
        <p className="mt-1">Gratis, configurable, federada. Abierta a aportes.</p>
      </footer>
    </div>
  )
}
