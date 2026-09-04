import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api'
import { fmtDate } from '../../lib/format'
import {
  Globe, Users, Network, Leaf, Heart, Scale, ArrowRight, Check,
  Sparkles, MessageSquare, ThumbsUp, Send, Menu, X, Home, Copy, Share2,
  Power, Loader2, ExternalLink, AlertCircle, CheckCircle, Code,
  ChevronUp, ChevronDown
} from 'lucide-react'

const SHARE_MESSAGE_KEY = 'fed_share_message'

export function PublicFederationPage() {
  const { t } = useTranslation('public')
  const SHARE_MESSAGE = t(SHARE_MESSAGE_KEY)
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
    setDemoStartLog(t('fed_demo_start_log_init') + '\n')
    if (demoPresetSel) {
      setDemoStartLog(prev => prev + t('fed_demo_start_log_preset', { preset: demoPresetSel }) + '\n')
    }
    setDemoStartMsg(t('fed_demo_start_msg_sending'))
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
            setDemoStartMsg(t('fed_demo_start_msg_timeout'))
          } else {
            // Continuar consultando
            setTimeout(pollStatus, 2000)
          }
        }).catch(() => {
          if (attempts >= maxAttempts) {
            checkDemoStatus()
            setDemoStarting(false)
            setDemoError(true)
            setDemoStartMsg(t('fed_demo_start_msg_connect'))
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
      setDemoStartMsg(t('fed_demo_start_msg_error') + ': ' + (e?.message || ''))
    }
  }

  const submitProposal = async () => {
    if (!newProposal.title || !newProposal.description) {
      setMsg(t('fed_propose_error_fields'))
      return
    }
    setSubmitting(true)
    setMsg('')
    try {
      await api.post('/public/proposals', newProposal)
      setMsg(t('fed_propose_success'))
      setNewProposal({ title: '', description: '', category: 'funcionalidad' })
      setShowProposalForm(false)
      // Recargar
      api.get('/public/proposals').then((d: any) => setProposals(Array.isArray(d) ? d : []))
    } catch (e: any) {
      setMsg(e?.message || t('fed_propose_error_send'))
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
      setMsg(e?.message || t('fed_propose_error_vote'))
    }
  }

  const categoryLabels: Record<string, string> = {
    funcionalidad: t('fed_cat_funcionalidad'),
    gobernanza: t('fed_cat_gobernanza'),
    interfaz: t('fed_cat_interfaz'),
    economia: t('fed_cat_economia'),
    seguridad: t('fed_cat_seguridad'),
    otro: t('fed_cat_otro'),
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
            <Sparkles size={16} /> {t('fed_hero_badge')}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            {t('fed_hero_title')}
          </h1>
          <p className="text-xl text-emerald-100 mb-8 max-w-2xl mx-auto">
            {t('fed_hero_subtitle')}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="#beneficios" className="bg-white text-emerald-700 font-semibold px-6 py-3 rounded-xl hover:bg-emerald-50 transition flex items-center gap-2">
              {t('fed_hero_cta_more')} <ArrowRight size={18} />
            </a>
            <a href="#proponer" className="bg-emerald-600/50 backdrop-blur-sm border border-white/30 text-white font-semibold px-6 py-3 rounded-xl hover:bg-emerald-600/70 transition flex items-center gap-2">
              <MessageSquare size={18} /> {t('fed_hero_cta_propose')}
            </a>
          </div>
        </div>
      </div>

      {/* Que es */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">{t('fed_what_title')}</h2>
        <p className="text-lg text-gray-600 leading-relaxed mb-4">
          {t('fed_what_desc1')}
        </p>
        <p className="text-lg text-gray-600 leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: t('fed_what_desc2') }} />
        <div className="grid md:grid-cols-2 gap-4 mt-8">
          {t('fed_what_features').split('|').reduce((acc: string[][], item, i) => {
            if (i % 2 === 0) acc.push([item])
            else acc[acc.length - 1].push(item)
            return acc
          }, []).map((pair, i) => {
            const icons = [Scale, Leaf, Network, Users, Globe, Heart]
            const Icon = icons[i] || Scale
            return (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <Icon className="text-emerald-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{pair[0]}</h3>
              <p className="text-sm text-gray-600">{pair[1]}</p>
            </div>
          )})
          }
        </div>
      </section>

      {/* Beneficios */}
      <section id="beneficios" className="bg-emerald-50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">{t('fed_benefits_title')}</h2>
          <div className="space-y-4">
            {t('fed_benefits_items').split('|').reduce((acc: string[][], item, i) => {
              if (i % 2 === 0) acc.push([item])
              else acc[acc.length - 1].push(item)
              return acc
            }, []).map((pair, i) => (
              <div key={i} className="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div className="flex-shrink-0 w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">{pair[0]}</h3>
                  <p className="text-sm text-gray-600">{pair[1]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Por que trabajar unificado */}
      <section className="bg-gradient-to-b from-white to-blue-50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">{t('fed_unified_title')}</h2>
          <p className="text-lg text-gray-600 leading-relaxed mb-8 text-center max-w-3xl mx-auto">
            {t('fed_unified_desc')}
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <Code className="text-emerald-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{t('fed_unified_card1_title')}</h3>
              <p className="text-sm text-gray-600">
                {t('fed_unified_card1_desc')}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Globe className="text-blue-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{t('fed_unified_card2_title')}</h3>
              <p className="text-sm text-gray-600">
                {t('fed_unified_card2_desc')}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Scale className="text-purple-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{t('fed_unified_card3_title')}</h3>
              <p className="text-sm text-gray-600">
                {t('fed_unified_card3_desc')}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                <Users className="text-amber-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{t('fed_unified_card4_title')}</h3>
              <p className="text-sm text-gray-600">
                {t('fed_unified_card4_desc')}
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-800 mb-3 text-center">{t('fed_unified_amber_title')}</h3>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              {t('fed_unified_amber_p1')}
            </p>
            <p className="text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('fed_unified_amber_p2') }} />
          </div>
        </div>
      </section>

      {/* Gobernanza Federada */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">{t('fed_gov_title')}</h2>
        <p className="text-lg text-gray-600 leading-relaxed mb-4 text-center max-w-3xl mx-auto">
          {t('fed_gov_desc')}
        </p>

        {/* Nivel 1: Federacion */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-4 border border-blue-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold">
              1
            </div>
            <h3 className="text-xl font-bold text-gray-800">{t('fed_gov_l1_title')}</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3" dangerouslySetInnerHTML={{ __html: t('fed_gov_l1_desc') }} />
          <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
            {t('fed_gov_l1_items').split('|').map((item, i) => (
              <div key={i} className="flex items-start gap-2"><Check size={16} className="text-blue-600 mt-0.5 flex-shrink-0" /> {item}</div>
            ))}
          </div>
          <div className="mt-3 bg-blue-100/50 rounded-lg p-3 text-xs text-gray-700" dangerouslySetInnerHTML={{ __html: t('fed_gov_l1_note') }} />
        </div>

        {/* Nivel 2: Aldea */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 mb-4 border border-emerald-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold">
              2
            </div>
            <h3 className="text-xl font-bold text-gray-800">{t('fed_gov_l2_title')}</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3" dangerouslySetInnerHTML={{ __html: t('fed_gov_l2_desc') }} />
          <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
            {t('fed_gov_l2_items').split('|').map((item, i) => (
              <div key={i} className="flex items-start gap-2"><Check size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" /> {item}</div>
            ))}
          </div>
          <div className="mt-3 bg-emerald-100/50 rounded-lg p-3 text-xs text-gray-700" dangerouslySetInnerHTML={{ __html: t('fed_gov_l2_note') }} />
        </div>

        {/* Nivel 3: Organizaciones */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 mb-4 border border-purple-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center font-bold">
              3
            </div>
            <h3 className="text-xl font-bold text-gray-800">{t('fed_gov_l3_title')}</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3" dangerouslySetInnerHTML={{ __html: t('fed_gov_l3_desc') }} />
          <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
            {t('fed_gov_l3_items').split('|').map((item, i) => (
              <div key={i} className="flex items-start gap-2"><Check size={16} className="text-purple-600 mt-0.5 flex-shrink-0" /> {item}</div>
            ))}
          </div>
          <div className="mt-3 bg-purple-100/50 rounded-lg p-3 text-xs text-gray-700" dangerouslySetInnerHTML={{ __html: t('fed_gov_l3_note') }} />
        </div>

        {/* Como funciona el consenso federado */}
        <div className="mt-6 bg-emerald-50 rounded-xl p-6">
          <h3 className="font-semibold text-gray-800 mb-2 text-center">{t('fed_gov_consensus_title')}</h3>
          <p className="text-sm text-gray-700 text-center">
            {t('fed_gov_consensus_desc')}
          </p>
        </div>
      </section>

      {/* Piscina Global Multilateral vs Bilateral */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">{t('fed_pool_title')}</h2>
          <p className="text-lg text-gray-600 leading-relaxed mb-8 text-center max-w-3xl mx-auto">
            {t('fed_pool_desc')}
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Globe className="text-blue-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{t('fed_pool_global_title')}</h3>
              <p className="text-sm text-gray-600 mb-3" dangerouslySetInnerHTML={{ __html: t('fed_pool_global_desc') }} />
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-gray-700" dangerouslySetInnerHTML={{ __html: t('fed_pool_global_example') }} />
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-purple-100">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Network className="text-purple-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{t('fed_pool_bilateral_title')}</h3>
              <p className="text-sm text-gray-600 mb-3" dangerouslySetInnerHTML={{ __html: t('fed_pool_bilateral_desc') }} />
              <div className="bg-purple-50 rounded-lg p-3 text-xs text-gray-700" dangerouslySetInnerHTML={{ __html: t('fed_pool_bilateral_example') }} />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-800 mb-2 text-center">{t('fed_pool_which_title')}</h3>
            <p className="text-sm text-gray-700 text-center" dangerouslySetInnerHTML={{ __html: t('fed_pool_which_desc') }} />
          </div>
        </div>
      </section>

      {/* Niveles de Nodo Federado */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">{t('fed_node_levels_title')}</h2>
        <p className="text-lg text-gray-600 leading-relaxed mb-8 text-center max-w-3xl mx-auto">
          {t('fed_node_levels_desc')}
        </p>

        <div className="space-y-4">
          {/* Nivel 1 */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gray-500 text-white rounded-xl flex items-center justify-center font-bold">1</div>
              <h3 className="text-xl font-bold text-gray-800">{t('fed_nl1_title')}</h3>
              <span className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">{t('fed_nl1_badge')}</span>
            </div>
            <p className="text-sm text-gray-600 mb-3" dangerouslySetInnerHTML={{ __html: t('fed_nl1_desc') }} />
            <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
              {t('fed_nl1_items').split('|').map((item, i) => (
                <div key={i} className="flex items-start gap-2"><Check size={16} className="text-gray-500 mt-0.5 flex-shrink-0" /> {item}</div>
              ))}
            </div>
          </div>

          {/* Nivel 2 */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold">2</div>
              <h3 className="text-xl font-bold text-gray-800">{t('fed_nl2_title')}</h3>
              <span className="text-sm bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">{t('fed_nl2_badge')}</span>
            </div>
            <p className="text-sm text-gray-600 mb-3" dangerouslySetInnerHTML={{ __html: t('fed_nl2_desc') }} />
            <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
              {t('fed_nl2_items').split('|').map((item, i) => (
                <div key={i} className="flex items-start gap-2"><Check size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" /> {item}</div>
              ))}
            </div>
          </div>

          {/* Nivel 3 */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-600 text-white rounded-xl flex items-center justify-center font-bold">3</div>
              <h3 className="text-xl font-bold text-gray-800">{t('fed_nl3_title')}</h3>
              <span className="text-sm bg-amber-100 text-amber-700 px-3 py-1 rounded-full">{t('fed_nl3_badge')}</span>
            </div>
            <p className="text-sm text-gray-600 mb-3" dangerouslySetInnerHTML={{ __html: t('fed_nl3_desc') }} />
            <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
              {t('fed_nl3_items').split('|').map((item, i) => (
                <div key={i} className="flex items-start gap-2"><Check size={16} className="text-amber-600 mt-0.5 flex-shrink-0" /> {item}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 rounded-xl p-6">
          <h3 className="font-semibold text-gray-800 mb-2 text-center">{t('fed_nl_promotion_title')}</h3>
          <p className="text-sm text-gray-700 text-center" dangerouslySetInnerHTML={{ __html: t('fed_nl_promotion_desc') }} />
        </div>
      </section>

      {/* Sistema de Padrino */}
      <section className="bg-gradient-to-b from-emerald-50 to-white py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">{t('fed_sponsor_title')}</h2>
          <p className="text-lg text-gray-600 leading-relaxed mb-8 text-center max-w-3xl mx-auto" dangerouslySetInnerHTML={{ __html: t('fed_sponsor_desc') }} />

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <Users className="text-emerald-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{t('fed_sponsor_how_title')}</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                {t('fed_sponsor_how_items').split('|').map((item, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                <Scale className="text-amber-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{t('fed_sponsor_example_title')}</h3>
              <p className="text-sm text-gray-600 mb-3">
                {t('fed_sponsor_example_desc')}
              </p>
              <div className="bg-amber-50 rounded-lg p-3 text-xs text-gray-700 space-y-1">
                {t('fed_sponsor_example_items').split('|').map((item, i) => (
                  <div key={i} className={i === 2 ? 'pt-2' : ''} dangerouslySetInnerHTML={{ __html: '• ' + item }} />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-800 mb-2 text-center">{t('fed_sponsor_why_title')}</h3>
            <p className="text-sm text-gray-700 text-center">
              {t('fed_sponsor_why_desc')}
            </p>
          </div>
        </div>
      </section>

      {/* Verificacion de 4 Opciones */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">{t('fed_verify_title')}</h2>
        <p className="text-lg text-gray-600 leading-relaxed mb-8 text-center max-w-3xl mx-auto">
          {t('fed_verify_desc')}
        </p>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 max-w-2xl mx-auto">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
              <div>
                <h3 className="font-semibold text-gray-800">{t('fed_verify_s1_title')}</h3>
                <p className="text-sm text-gray-600">{t('fed_verify_s1_desc')}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
              <div>
                <h3 className="font-semibold text-gray-800">{t('fed_verify_s2_title')}</h3>
                <p className="text-sm text-gray-600">{t('fed_verify_s2_desc')}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
              <div>
                <h3 className="font-semibold text-gray-800">{t('fed_verify_s3_title')}</h3>
                <p className="text-sm text-gray-600">{t('fed_verify_s3_desc')}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">4</div>
              <div>
                <h3 className="font-semibold text-gray-800">{t('fed_verify_s4_title')}</h3>
                <p className="text-sm text-gray-600">{t('fed_verify_s4_desc')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 rounded-xl p-6">
          <h3 className="font-semibold text-gray-800 mb-2 text-center">{t('fed_verify_why_title')}</h3>
          <p className="text-sm text-gray-700 text-center">
            {t('fed_verify_why_desc')}
          </p>
        </div>
      </section>

      {/* Integridad Distribuida */}
      <section className="bg-gradient-to-b from-white to-blue-50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">{t('fed_integrity_title')}</h2>
          <p className="text-lg text-gray-600 leading-relaxed mb-8 text-center max-w-3xl mx-auto">
            {t('fed_integrity_desc')}
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Scale className="text-blue-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{t('fed_integrity_dual_title')}</h3>
              <p className="text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: t('fed_integrity_dual_desc') }} />
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-purple-100">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Network className="text-purple-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{t('fed_integrity_hash_title')}</h3>
              <p className="text-sm text-gray-600">
                {t('fed_integrity_hash_desc')}
              </p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-800 mb-2 text-center">{t('fed_integrity_recon_title')}</h3>
            <p className="text-sm text-gray-700 text-center">
              {t('fed_integrity_recon_desc')}
            </p>
          </div>
        </div>
      </section>

      {/* Que incluye el sistema */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">{t('fed_features_title')}</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {t('fed_features_list').split('|').map((feature, i) => (
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
          <h2 className="text-3xl font-bold text-gray-800 mb-4 text-center">{t('fed_propose_title')}</h2>
          <p className="text-lg text-gray-600 text-center mb-8 max-w-2xl mx-auto">
            {t('fed_propose_desc')}
          </p>

          {msg && <div className="text-center text-sm bg-blue-50 text-blue-700 p-3 rounded-lg mb-4 max-w-md mx-auto">{msg}</div>}

          <div className="text-center mb-8">
            <button
              onClick={() => setShowProposalForm(!showProposalForm)}
              className="bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-emerald-700 transition inline-flex items-center gap-2"
            >
              <MessageSquare size={18} /> {showProposalForm ? t('fed_propose_cancel') : t('fed_propose_submit')}
            </button>
          </div>

          {showProposalForm && (
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 max-w-2xl mx-auto mb-8 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('fed_propose_form_title')}</label>
                <input
                  type="text"
                  value={newProposal.title}
                  onChange={(e) => setNewProposal({ ...newProposal, title: e.target.value })}
                  placeholder={t('fed_propose_form_title_ph')}
                  className="w-full border rounded-lg p-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('fed_propose_form_category')}</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('fed_propose_form_desc')}</label>
                <textarea
                  value={newProposal.description}
                  onChange={(e) => setNewProposal({ ...newProposal, description: e.target.value })}
                  placeholder={t('fed_propose_form_desc_ph')}
                  rows={4}
                  className="w-full border rounded-lg p-3 text-sm"
                />
              </div>
              <button
                onClick={submitProposal}
                disabled={submitting}
                className="bg-emerald-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-emerald-700 transition inline-flex items-center gap-2"
              >
                {submitting ? t('fed_propose_form_sending') : t('fed_propose_form_send')} <Send size={16} />
              </button>
            </div>
          )}

          {/* Lista de propuestas */}
          {proposals.length > 0 && (
            <div className="space-y-3 max-w-2xl mx-auto">
              <h3 className="font-semibold text-gray-700 mb-3">{t('fed_propose_list_title', { count: proposals.length })}</h3>
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
                    {p.author_name || t('fed_propose_anon')} - {fmtDate(p.created_at)}
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
          <h2 className="text-3xl font-bold text-gray-800 mb-4 text-center">{t('fed_share_title')}</h2>
          <p className="text-lg text-gray-600 text-center mb-8 max-w-2xl mx-auto">
            {t('fed_share_desc')}
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
              {copiedMsg ? <><Check size={14} /> {t('fed_share_copied')}</> : <><Copy size={14} /> {t('fed_share_copy')}</>}
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
              <Share2 size={18} /> {t('fed_share_whatsapp')}
            </a>
          </div>
        </div>
      </section>

      {/* Demo - solo se muestra en el nodo principal, no en el demo */}
      {(window as any).__BASE_PATH__ !== '/demo' && (
      <section className="bg-emerald-700 text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">{t('fed_demo_title')}</h2>
          <p className="text-lg text-emerald-100 mb-6 max-w-2xl mx-auto" dangerouslySetInnerHTML={{ __html: t('fed_demo_desc') }} />

          {/* Estado del nodo demo */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 max-w-md mx-auto border border-white/20 mb-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              {demoState === 'running' && (
                <span className="flex items-center gap-2 text-green-300">
                  <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                  {t('fed_demo_running')}
                </span>
              )}
              {demoState === 'stopped' && (
                <span className="flex items-center gap-2 text-yellow-200">
                  <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                  {t('fed_demo_stopped')}
                </span>
              )}
              {demoState === 'starting' && (
                <span className="flex items-center gap-2 text-blue-200">
                  <Loader2 size={16} className="animate-spin" />
                  {t('fed_demo_starting')}
                </span>
              )}
              {demoState === 'unknown' && (
                <span className="flex items-center gap-2 text-gray-300">
                  <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                  {t('fed_demo_unknown')}
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
                <ExternalLink size={20} /> {t('fed_demo_enter')}
              </a>
            ) : (
              <div className="space-y-4">
                {/* Selector de preconfiguracion */}
                <div className="text-left">
                  <label className="text-sm text-emerald-100 font-medium flex items-center gap-1 mb-2">
                    <Sparkles size={14} /> {t('fed_demo_preset_label')}
                  </label>
                  <p className="text-xs text-emerald-200 mb-2">
                    {t('fed_demo_preset_desc')}
                  </p>
                  {!demoPresetsLoaded && (
                    <button
                      onClick={loadDemoPresets}
                      className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition"
                    >
                      {t('fed_demo_preset_show')}
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
                    <><Loader2 size={20} className="animate-spin" /> {t('fed_demo_starting_btn')}</>
                  ) : (
                    <><Power size={20} /> {t('fed_demo_start')}</>
                  )}
                </button>
              </div>
            )}

            <p className="text-xs text-emerald-200 mt-4">
              {demoState === 'running'
                ? t('fed_demo_status_running')
                : t('fed_demo_status_stopped')}
            </p>
            <p className="text-xs text-emerald-200 mt-2">
              {t('fed_demo_restart_note')}
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
                    {demoStartMsg || t('fed_demo_processing')}
                  </div>
                  <pre className={`text-[10px] font-mono whitespace-pre-wrap max-h-60 overflow-y-auto ${demoError ? 'text-red-200/80' : 'text-emerald-200/80'}`}>
                    {demoStartLog}
                  </pre>
                  {demoError && (
                    <button
                      onClick={() => { setDemoError(false); setDemoStartLog(''); setDemoStartMsg('') }}
                      className="mt-2 text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded transition"
                    >
                      {t('fed_demo_close')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="text-sm text-emerald-200 max-w-2xl mx-auto">
            <p>{t('fed_demo_features_title')}</p>
            <div className="grid grid-cols-2 gap-2 mt-3 text-left max-w-lg mx-auto">
              {t('fed_demo_features_list').split('|').map((item, i) => (
                <div key={i} className="flex items-center gap-2"><Check size={14} /> {item}</div>
              ))}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Compartir modelos entre aldeas */}
      <section className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">{t('fed_models_title')}</h2>
          <p className="text-lg text-gray-600 leading-relaxed mb-8 text-center max-w-3xl mx-auto">
            {t('fed_models_desc')}
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-emerald-50 rounded-2xl p-6">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <Network className="text-emerald-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{t('fed_models_card1_title')}</h3>
              <p className="text-sm text-gray-600">
                {t('fed_models_card1_desc')}
              </p>
            </div>
            <div className="bg-blue-50 rounded-2xl p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Globe className="text-blue-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{t('fed_models_card2_title')}</h3>
              <p className="text-sm text-gray-600">
                {t('fed_models_card2_desc')}
              </p>
            </div>
            <div className="bg-purple-50 rounded-2xl p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Code className="text-purple-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{t('fed_models_card3_title')}</h3>
              <p className="text-sm text-gray-600">
                {t('fed_models_card3_desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ - Preguntas frecuentes sobre la federacion */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-4 text-center">
            {t('fed_faq_title')}
          </h2>
          <p className="text-gray-600 text-center mb-10 max-w-2xl mx-auto">
            {t('fed_faq_desc')}
          </p>
          <FederationFaq />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        <p>{t('fed_footer_l1')}</p>
        <p className="mt-1">{t('fed_footer_l2')}</p>
      </footer>
    </div>
  )
}

const FAQ_COUNT = 18

function FederationFaq() {
  const { t } = useTranslation('public')
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {Array.from({ length: FAQ_COUNT }, (_, idx) => {
        const isOpen = openIdx === idx
        return (
          <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <button
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition"
            >
              <span className="font-semibold text-gray-800 text-sm sm:text-base">{t(`fed_faq_q_${idx + 1}`)}</span>
              <span className="p-1.5 rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </span>
            </button>
            {isOpen && (
              <div className="px-4 sm:px-5 pb-5 pt-1 text-sm text-gray-600 leading-relaxed border-t border-gray-100">
                {t(`fed_faq_a_${idx + 1}`)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
