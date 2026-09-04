import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../api'
import { Scale, AlertTriangle, AlertOctagon, Ban, Info, CheckCircle, XCircle, Users, Home, Leaf, Coins, Calendar, UserPlus, UserX, Percent, PiggyBank, Map, Key, FileText, Globe, Network, Building2, Shield, Award, Handshake, Layers, Vote, Lock, MessageSquare, X, Send, Edit3 } from 'lucide-react'

const CATEGORIES = [
  { value: 'estructura', labelKey: 'gov_cat_estructura', icon: Users, color: 'text-blue-700 bg-blue-50' },
  { value: 'deberes', labelKey: 'gov_cat_deberes', icon: CheckCircle, color: 'text-emerald-700 bg-emerald-50' },
  { value: 'permitido', labelKey: 'gov_cat_permitido', icon: CheckCircle, color: 'text-green-700 bg-green-50' },
  { value: 'prohibido', labelKey: 'gov_cat_prohibido', icon: XCircle, color: 'text-red-700 bg-red-50' },
  { value: 'faltas_leves', labelKey: 'gov_cat_faltas_leves', icon: AlertTriangle, color: 'text-yellow-700 bg-yellow-50' },
  { value: 'faltas_graves', labelKey: 'gov_cat_faltas_graves', icon: AlertOctagon, color: 'text-orange-700 bg-orange-50' },
  { value: 'faltas_muy_graves', labelKey: 'gov_cat_faltas_muy_graves', icon: Ban, color: 'text-red-800 bg-red-100' },
  { value: 'admision', labelKey: 'gov_cat_admision', icon: UserPlus, color: 'text-blue-700 bg-blue-50' },
  { value: 'salida', labelKey: 'gov_cat_salida', icon: UserX, color: 'text-gray-700 bg-gray-50' },
  { value: 'impuestos', labelKey: 'gov_cat_impuestos', icon: Percent, color: 'text-purple-700 bg-purple-50' },
  { value: 'tierra', labelKey: 'gov_cat_tierra', icon: Map, color: 'text-amber-700 bg-amber-50' },
  { value: 'unidades_productivas', labelKey: 'gov_cat_unidades_productivas', icon: FileText, color: 'text-teal-700 bg-teal-50' },
  { value: 'bienestar', labelKey: 'gov_cat_bienestar', icon: Info, color: 'text-pink-700 bg-pink-50' },
  { value: 'aprendizaje', labelKey: 'gov_cat_aprendizaje', icon: FileText, color: 'text-indigo-700 bg-indigo-50' },
  { value: 'convivencia', labelKey: 'gov_cat_convivencia', icon: Users, color: 'text-rose-700 bg-rose-50' },
]

const SEVERITY_KEYS: Record<string, string> = {
  info: 'gov_sev_info',
  leve: 'gov_sev_leve',
  grave: 'gov_sev_grave',
  muy_grave: 'gov_sev_muy_grave',
}

const SEVERITY_CLASSES: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700',
  leve: 'bg-yellow-100 text-yellow-700',
  grave: 'bg-orange-100 text-orange-700',
  muy_grave: 'bg-red-100 text-red-700',
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
  const { t } = useTranslation('public')
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
        setError(t('gov_error_load'))
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="text-center py-24 space-y-3">
        <div className="w-10 h-10 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin mx-auto" />
        <p className="text-gray-500 font-medium text-xs">{t('gov_loading')}</p>
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
        <h2 className="text-xl font-bold text-gray-800">{t('gov_no_rules_title')}</h2>
        <p className="text-gray-600 text-sm">
          {t('gov_no_rules_desc')}
        </p>
      </div>
    )
  }

  // Agrupar reglas por categoria
  const groupedRules = CATEGORIES.map((cat) => ({
    ...cat,
    label: t(cat.labelKey),
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
              value={pageTitle || t('gov_default_title')}
              onChange={(e) => onFieldChange?.('title', e.target.value)}
              placeholder={t('gov_default_title')}
            />
            <textarea
              className="text-gray-600 text-sm max-w-2xl mx-auto bg-yellow-50 border-2 border-amber-300 rounded-lg px-3 py-1 outline-none focus:ring-2 focus:ring-amber-400 w-full"
              rows={2}
              value={pageSubtitle || t('gov_default_subtitle')}
              onChange={(e) => onFieldChange?.('subtitle', e.target.value)}
              placeholder={t('gov_default_subtitle')}
            />
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-gray-900">{pageTitle || t('gov_default_title')}</h1>
            <p className="text-gray-600 text-sm max-w-2xl mx-auto">
              {pageSubtitle || t('gov_default_subtitle')}
            </p>
          </>
        )}
        <p className="text-xs text-gray-400">
          {t('gov_rules_count', { count: rules.length })}
        </p>
      </div>

      {/* Tres niveles de gobernanza */}
      <div className="bg-gradient-to-b from-gray-50 to-white rounded-2xl p-6 border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">{t('gov_three_levels_title')}</h2>
        <p className="text-xs text-gray-500 text-center mb-4 max-w-2xl mx-auto">
          {t('gov_three_levels_desc')}
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="text-blue-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">{t('gov_level1_title')}</h3>
            </div>
            <p className="text-xs text-gray-600">
              {t('gov_level1_desc')}
            </p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 ring-2 ring-emerald-300">
            <div className="flex items-center gap-2 mb-2">
              <Network className="text-emerald-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">{t('gov_level2_title')}</h3>
              <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">{t('gov_here_badge')}</span>
            </div>
            <p className="text-xs text-gray-600">
              {t('gov_level2_desc')}
            </p>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="text-purple-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">{t('gov_level3_title')}</h3>
            </div>
            <p className="text-xs text-gray-600">
              {t('gov_level3_desc')}
            </p>
          </div>
        </div>
      </div>

      {/* Tres niveles de nodo federado */}
      <div className="bg-gradient-to-b from-blue-50 to-white rounded-2xl p-6 border border-blue-200">
        <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">{t('gov_fed_levels_title')}</h2>
        <p className="text-xs text-gray-500 text-center mb-4 max-w-2xl mx-auto">
          {t('gov_fed_levels_desc')}
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="text-gray-500" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">{t('gov_fed_l1_title')}</h3>
            </div>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              {t('gov_fed_l1_items').split('|').map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
            <div className="flex items-center gap-2 mb-2">
              <Vote className="text-emerald-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">{t('gov_fed_l2_title')}</h3>
            </div>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              {t('gov_fed_l2_items').split('|').map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <Award className="text-purple-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">{t('gov_fed_l3_title')}</h3>
            </div>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              {t('gov_fed_l3_items').split('|').map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>
        <div className="mt-4 bg-blue-50 rounded-lg p-3 border border-blue-100">
          <p className="text-xs text-blue-700">
            {t('gov_fed_promotion')}
          </p>
        </div>
      </div>

      {/* Sistema de padrino (patrocinador) */}
      <div className="bg-gradient-to-b from-amber-50 to-white rounded-2xl p-6 border border-amber-200">
        <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">{t('gov_sponsor_title')}</h2>
        <p className="text-xs text-gray-500 text-center mb-4 max-w-2xl mx-auto">
          {t('gov_sponsor_desc')}
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 border border-amber-100">
            <div className="flex items-center gap-2 mb-2">
              <Handshake className="text-amber-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">{t('gov_sponsor_how_title')}</h3>
            </div>
            <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
              {t('gov_sponsor_how_items').split('|').map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: item }} />)}
            </ul>
          </div>
          <div className="bg-white rounded-xl p-4 border border-amber-100">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="text-amber-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">{t('gov_sponsor_resp_title')}</h3>
            </div>
            <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
              {t('gov_sponsor_resp_items').split('|').map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* Piscina global vs bilateral */}
      <div className="bg-gradient-to-b from-teal-50 to-white rounded-2xl p-6 border border-teal-200">
        <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">{t('gov_pool_title')}</h2>
        <p className="text-xs text-gray-500 text-center mb-4 max-w-2xl mx-auto">
          {t('gov_pool_desc')}
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 border border-teal-100">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="text-teal-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">{t('gov_pool_global_title')}</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {t('gov_pool_global_desc')}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-teal-100">
            <div className="flex items-center gap-2 mb-2">
              <Network className="text-teal-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">{t('gov_pool_bilateral_title')}</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {t('gov_pool_bilateral_desc')}
            </p>
          </div>
        </div>
      </div>

      {/* Verificacion de 4 opciones */}
      <div className="bg-gradient-to-b from-indigo-50 to-white rounded-2xl p-6 border border-indigo-200">
        <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">{t('gov_verify_title')}</h2>
        <p className="text-xs text-gray-500 text-center mb-4 max-w-2xl mx-auto">
          {t('gov_verify_desc')}
        </p>
        <div className="bg-white rounded-xl p-4 border border-indigo-100">
          <div className="flex items-center gap-2 mb-2">
            <Key className="text-indigo-600" size={18} />
            <h3 className="font-semibold text-sm text-gray-800">{t('gov_verify_how_title')}</h3>
          </div>
          <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
            {t('gov_verify_steps').split('|').map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: item }} />)}
          </ol>
          <p className="text-xs text-indigo-600 mt-3 bg-indigo-50 p-2 rounded">
            {t('gov_verify_note')}
          </p>
        </div>
      </div>

      {/* Integridad distribuida */}
      <div className="bg-gradient-to-b from-rose-50 to-white rounded-2xl p-6 border border-rose-200">
        <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">{t('gov_integrity_title')}</h2>
        <p className="text-xs text-gray-500 text-center mb-4 max-w-2xl mx-auto">
          {t('gov_integrity_desc')}
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 border border-rose-100">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="text-rose-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">{t('gov_integrity_double_title')}</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {t('gov_integrity_double_desc')}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-rose-100">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="text-rose-600" size={18} />
              <h3 className="font-semibold text-sm text-gray-800">{t('gov_integrity_hash_title')}</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {t('gov_integrity_hash_desc')}
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
                  <p className="text-xs text-gray-500">{t('gov_rules_in_category', { count: cat.rules.length })}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {cat.rules.map((rule: any, i: number) => {
                  const sevKey = SEVERITY_KEYS[rule.severity] || SEVERITY_KEYS.info
                  const sevClass = SEVERITY_CLASSES[rule.severity] || SEVERITY_CLASSES.info
                  return (
                    <div
                      key={rule.id || i}
                      className={`bg-white rounded-xl border p-4 shadow-sm transition relative ${
                        editMode
                          ? 'border-amber-300 hover:ring-2 hover:ring-amber-400 cursor-pointer'
                          : 'border-gray-200 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-sm text-gray-900">{rule.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${sevClass}`}>
                          {t(sevKey)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{rule.description}</p>
                      {editMode && (
                        <div className="absolute inset-0 bg-amber-50/80 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100 transition">
                          <div className="text-center space-y-2">
                            <div className="inline-flex items-center gap-1.5 text-amber-800 text-xs font-bold bg-amber-100 px-3 py-1.5 rounded-lg">
                              <MessageSquare size={14} />
                              {t('gov_edit_requires_approval')}
                            </div>
                            <div className="text-[11px] text-amber-700">
                              {t('gov_edit_click_to_propose')}
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
          {t('gov_footer')}
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
                <h3 className="text-base font-bold text-gray-900">{t('gov_modal_title')}</h3>
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
                  <Edit3 size={14} /> {t('gov_modal_rule_label')} {proposalModal.rule.title}
                </div>
                <p className="text-amber-700">{proposalModal.rule.description}</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                {t('gov_modal_approved_notice')}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('gov_modal_desc_label')}
                </label>
                <textarea
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none"
                  placeholder={t('gov_modal_placeholder')}
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
                  {t('gov_modal_view_all')} →
                </Link>
                <button
                  onClick={async () => {
                    if (!proposalText.trim()) {
                      setProposalMsg(t('gov_modal_error_empty'))
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
                      setProposalMsg(t('gov_modal_success'))
                      setProposalText('')
                    } catch (e: any) {
                      setProposalMsg(t('gov_modal_error_send') + ': ' + (e?.message || ''))
                    } finally {
                      setProposalSubmitting(false)
                    }
                  }}
                  disabled={proposalSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-500 transition disabled:opacity-60"
                >
                  {proposalSubmitting ? t('gov_modal_submitting') : t('gov_modal_submit')}
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
