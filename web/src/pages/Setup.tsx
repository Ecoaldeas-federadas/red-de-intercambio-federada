import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api'
import { useTranslation } from 'react-i18next'
import {
  Settings,
  User,
  Lock,
  Server,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Shield,
  Key,
  Sparkles,
  Search,
  ScrollText,
  Globe,
} from 'lucide-react'

interface SetupStatus {
  initialized: boolean
  node_domain: string
  node_name: string
  admin_exists: boolean
  jwt_configured: boolean
}

// Idiomas disponibles para el setup (embebidos, no necesitan API)
const SETUP_LANGUAGES = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
]

export default function Setup() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('common')

  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [nodePublicKey, setNodePublicKey] = useState('')
  const [setupLang, setSetupLang] = useState<string>('')

  const [form, setForm] = useState({
    node_name: '',
    node_domain: '',
    admin_username: '',
    admin_display_name: '',
    admin_password: '',
    admin_password_confirm: '',
  })

  // Preconfiguraciones (presets)
  const [presets, setPresets] = useState<any[]>([])
  const [selectedPreset, setSelectedPreset] = useState('vacio')
  const [presetSearch, setPresetSearch] = useState('')
  const [presetsLoading, setPresetsLoading] = useState(false)

  // Inicializar idioma del setup desde localStorage o navegador
  useEffect(() => {
    const stored = localStorage.getItem('user_language')
    if (stored) {
      setSetupLang(stored)
      i18n.changeLanguage(stored)
    } else {
      const browserLang = navigator.language?.split('-')[0]
      const lang = browserLang === 'en' ? 'en' : 'es'
      setSetupLang(lang)
      i18n.changeLanguage(lang)
    }
  }, [])

  useEffect(() => {
    checkStatus()
    loadPresets()
  }, [])

  const handleSelectLang = (lang: string) => {
    setSetupLang(lang)
    i18n.changeLanguage(lang)
    localStorage.setItem('user_language', lang)
    localStorage.setItem('node_default_language', lang)
  }

  const loadPresets = async () => {
    setPresetsLoading(true)
    try {
      const res = await fetch('/api/presets')
      if (res.ok) {
        const data = await res.json()
        setPresets(data.presets || [])
      }
    } catch (e) {
      // silencioso - el preset es opcional
    } finally {
      setPresetsLoading(false)
    }
  }

  const checkStatus = async () => {
    try {
      const s = await api.get<SetupStatus>('/setup/status')
      setStatus(s)
      if (s.initialized) {
        setStep(6)
      } else {
        setForm((prev) => ({
          ...prev,
          node_name: s.node_name || '',
          node_domain: s.node_domain || '',
        }))
      }
    } catch {
      setError(t('setup.server_error'))
    } finally {
      setLoadingStatus(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleNext = () => {
    setError('')
    if (step === 0) {
      // Paso 0: Idioma — siempre pasa (ya hay un idioma seleccionado por defecto)
      setStep(1)
    } else if (step === 1) {
      if (!form.node_name.trim()) {
        setError(t('setup.node_name_required'))
        return
      }
      if (!form.node_domain.trim()) {
        setError(t('setup.node_domain_required'))
        return
      }
      setStep(2)
    } else if (step === 2) {
      // Paso de preconfiguracion - siempre pasa (preset "vacio" es valido)
      setStep(3)
    } else if (step === 3) {
      if (!form.admin_username.trim()) {
        setError(t('setup.admin_username_required'))
        return
      }
      if (form.admin_username.length < 3) {
        setError(t('setup.admin_username_min'))
        return
      }
      setStep(4)
    } else if (step === 4) {
      if (!form.admin_password || form.admin_password.length < 8) {
        setError(t('setup.password_required'))
        return
      }
      if (form.admin_password !== form.admin_password_confirm) {
        setError(t('setup.password_mismatch'))
        return
      }
      setStep(5)
    }
  }

  const handleBack = () => {
    setError('')
    setStep((prev) => Math.max(0, prev - 1))
  }

  const handleInit = async () => {
    setError('')
    setSubmitting(true)
    try {
      // 1. Aplicar preset ANTES de crear el admin.
      if (selectedPreset && selectedPreset !== 'vacio') {
        try {
          await api.post('/setup/apply-preset', {
            preset_id: selectedPreset,
            node_domain: form.node_domain,
          })
        } catch (e) {
          console.warn('Preset application failed:', e)
        }
      }

      // 2. Inicializar el nodo (crea el admin) — incluir default_language
      const result = await api.post<{
        token: string
        username: string
        node: string
        message: string
        node_public_key: string
      }>('/setup/init', {
        node_name: form.node_name,
        node_domain: form.node_domain,
        admin_username: form.admin_username,
        admin_display_name: form.admin_display_name || form.admin_username,
        admin_password: form.admin_password,
        default_language: setupLang,
      })

      login(result.token, result.username)
      setSuccess(t('setup.init_success'))
      setNodePublicKey(result.node_public_key || '')
      setStep(6)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('setup.init_error'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-trueque-50">
        <Loader2 className="animate-spin text-trueque-600" size={48} />
      </div>
    )
  }

  if (status?.initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-trueque-50">
        <div className="card max-w-md w-full text-center">
          <CheckCircle className="mx-auto text-green-600 mb-4" size={48} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('setup.already_initialized')}</h1>
          <p className="text-gray-600 mb-6">
            {t('setup.already_initialized_desc')}
          </p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {t('setup.go_to_login')}
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    )
  }

  // Steps: 0=Idioma, 1=Nodo, 2=Perfil, 3=Admin, 4=Seguridad, 5=Revisar
  const steps = [
    { label: t('setup.step_language'), icon: Globe },
    { label: t('setup.step_node'), icon: Server },
    { label: t('setup.step_profile'), icon: Sparkles },
    { label: t('setup.step_admin'), icon: User },
    { label: t('setup.step_security'), icon: Lock },
    { label: t('setup.step_review'), icon: CheckCircle },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center bg-trueque-50 py-8 px-4">
      <div className="card max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-trueque-600 rounded-full mb-4">
            <Settings className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('setup.title')}</h1>
          <p className="text-gray-600 mt-1">
            {t('setup.welcome')}
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center justify-between mb-8 px-4">
          {steps.map((s, i) => {
            const Icon = s.icon
            const isActive = i === step
            const isDone = i < step
            return (
              <div key={i} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    isDone
                      ? 'bg-green-600 border-green-600 text-white'
                      : isActive
                      ? 'bg-trueque-600 border-trueque-600 text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}
                >
                  <Icon size={20} />
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mx-1 ${isDone ? 'bg-green-600' : 'bg-gray-300'}`}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-4 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
            <CheckCircle size={18} />
            {success}
          </div>
        )}

        {/* Step 0: Language selection */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="text-center">
              <Globe className="mx-auto text-trueque-600 mb-3" size={40} />
              <h2 className="text-xl font-semibold text-gray-900">{t('setup.select_language')}</h2>
              <p className="text-sm text-gray-500 mt-1">{t('setup.select_language_desc')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SETUP_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleSelectLang(lang.code)}
                  className={`p-4 rounded-lg border-2 transition-colors text-center ${
                    setupLang === lang.code
                      ? 'border-trueque-600 bg-trueque-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-3xl mb-2">{lang.flag}</div>
                  <div className="font-medium text-sm">{lang.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Node config */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="label flex items-center gap-2">
                <Server size={16} /> {t('setup.node_name_label')}
              </label>
              <input
                type="text"
                className="input"
                value={form.node_name}
                onChange={(e) => handleChange('node_name', e.target.value)}
                placeholder={t('setup.node_name_placeholder')}
              />
              <p className="text-xs text-gray-500 mt-1">{t('setup.node_name_desc', 'Nombre visible de tu organizacion')}</p>
            </div>
            <div>
              <label className="label flex items-center gap-2">
                <Server size={16} /> {t('setup.node_domain_label')}
              </label>
              <input
                type="text"
                className="input"
                value={form.node_domain}
                onChange={(e) => handleChange('node_domain', e.target.value)}
                placeholder={t('setup.node_domain_placeholder')}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('setup.node_domain_desc', 'Dominio unico para federacion (no se puede cambiar despues)')}
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Preconfiguracion (preset) */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="label flex items-center gap-2">
                <Sparkles size={16} /> {t('setup.preset_title')}
              </label>
              <p className="text-xs text-gray-500 mt-1 mb-2">
                {t('setup.preset_desc')}
              </p>
              {/* Nota importante: normas universales siempre se cargan */}
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 mb-3">
                <p className="text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>
                    {t('setup.preset_universal_note')}
                  </span>
                </p>
              </div>
            </div>

            {/* Buscador */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="input pl-9"
                placeholder={t('common:search_placeholder')}
                value={presetSearch}
                onChange={(e) => setPresetSearch(e.target.value)}
              />
            </div>

            {presetsLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 size={16} className="animate-spin" /> {t('common:loading')}
              </div>
            )}

            {/* Lista de presets agrupados por categoria */}
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {presets
                .filter((p: any) => {
                  if (!presetSearch) return true
                  const q = presetSearch.toLowerCase()
                  return p.name?.toLowerCase().includes(q) ||
                    p.description?.toLowerCase().includes(q) ||
                    p.category?.toLowerCase().includes(q)
                })
                .reduce((acc: any[], p: any) => {
                  const cat = p.category || 'general'
                  const group = acc.find((g) => g.category === cat)
                  if (group) {
                    group.items.push(p)
                  } else {
                    acc.push({ category: cat, items: [p] })
                  }
                  return acc
                }, [])
                .map((group: any) => (
                  <div key={group.category}>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      {group.category}
                    </p>
                    <div className="space-y-2">
                      {group.items.map((p: any) => (
                        <label
                          key={p.id}
                          className={`block p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                            selectedPreset === p.id
                              ? 'border-trueque-600 bg-trueque-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="radio"
                              name="preset"
                              value={p.id}
                              checked={selectedPreset === p.id}
                              onChange={(e) => setSelectedPreset(e.target.value)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <span className="font-medium text-sm">{p.name}</span>
                              <p className="text-xs text-gray-600 mt-1">{p.description}</p>
                              {p.has_demo_data && (
                                <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 mt-1 inline-block">
                                  {t('setup.preset_includes_demo')}
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
            </div>

            {/* Nota cuando se selecciona "vacio" */}
            {selectedPreset === 'vacio' && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-700">
                  {t('setup.preset_empty_note')}
                </p>
              </div>
            )}

            {presets.length === 0 && !presetsLoading && (
              <p className="text-xs text-gray-500">
                {t('setup.preset_load_error')}
              </p>
            )}
          </div>
        )}

        {/* Step 3: Admin user */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="label flex items-center gap-2">
                <User size={16} /> {t('setup.admin_username_label')}
              </label>
              <input
                type="text"
                className="input"
                value={form.admin_username}
                onChange={(e) => handleChange('admin_username', e.target.value)}
                placeholder={t('setup.admin_username_placeholder')}
              />
              <p className="text-xs text-gray-500 mt-1">{t('setup.admin_username_desc', 'Usuario para iniciar sesion')}</p>
            </div>
            <div>
              <label className="label flex items-center gap-2">
                <User size={16} /> {t('setup.admin_display_name_label')}
              </label>
              <input
                type="text"
                className="input"
                value={form.admin_display_name}
                onChange={(e) => handleChange('admin_display_name', e.target.value)}
                placeholder={t('setup.admin_display_name_placeholder')}
              />
              <p className="text-xs text-gray-500 mt-1">{t('setup.admin_display_name_desc', 'Opcional. Nombre visible en el sistema')}</p>
            </div>
          </div>
        )}

        {/* Step 4: Password */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className="label flex items-center gap-2">
                <Lock size={16} /> {t('setup.password_label')}
              </label>
              <input
                type="password"
                className="input"
                value={form.admin_password}
                onChange={(e) => handleChange('admin_password', e.target.value)}
                placeholder={t('setup.password_placeholder', 'Minimo 8 caracteres')}
              />
            </div>
            <div>
              <label className="label flex items-center gap-2">
                <Lock size={16} /> {t('setup.password_confirm_label')}
              </label>
              <input
                type="password"
                className="input"
                value={form.admin_password_confirm}
                onChange={(e) => handleChange('admin_password_confirm', e.target.value)}
                placeholder={t('setup.password_confirm_placeholder', 'Repite la contrasena')}
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <Shield size={16} className="inline mr-1" />
              {t('setup.password_security_note', 'Esta contrasena se usa para iniciar sesion. Tambien se generaran automaticamente las claves criptograficas Ed25519 del usuario.')}
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">{t('setup.review_title')}</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('setup.step_node')}:</span>
                <span className="font-medium">{form.node_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('setup.node_domain_label')}:</span>
                <span className="font-medium">{form.node_domain}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('setup.step_language')}:</span>
                <span className="font-medium">{setupLang === 'en' ? 'English' : 'Español'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('setup.preset_title')}:</span>
                <span className="font-medium">
                  {selectedPreset === 'vacio' ? t('setup.preset_empty') : presets.find((p) => p.id === selectedPreset)?.name || selectedPreset}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('setup.admin_username_label')}:</span>
                <span className="font-medium">{form.admin_username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('setup.admin_display_name_label')}:</span>
                <span className="font-medium">
                  {form.admin_display_name || form.admin_username}
                </span>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2 text-sm text-green-800">
              <div className="flex items-center gap-2 font-medium">
                <Key size={16} /> {t('setup.auto_generated', 'Se generaran automaticamente:')}
              </div>
              <ul className="ml-6 list-disc space-y-1">
                <li>{t('setup.auto_gen_keys', 'Claves Ed25519 del usuario administrador')}</li>
                <li>{t('setup.auto_gen_dept', 'Departamento "Administracion" con rol "Administrador"')}</li>
                <li>{t('setup.auto_gen_perms', 'Todos los permisos asignados al rol administrador')}</li>
                <li>{t('setup.auto_gen_credentials', 'Credenciales de acceso (bcrypt) para login por contrasena')}</li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <AlertCircle size={16} className="inline mr-1" />
              {t('setup.password_warning', 'Asegurate de recordar tu contrasena. No hay forma de recuperarla sin el proceso de recuperacion de cuenta.')}
            </div>
          </div>
        )}

        {/* Step 6: Already initialized / Success */}
        {step === 6 && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle className="mx-auto text-green-600 mb-4" size={48} />
              <p className="text-gray-600">{t('setup.init_success')}</p>
            </div>

            {nodePublicKey && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 font-medium text-blue-800">
                  <Key size={16} /> {t('setup.node_public_key', 'Clave publica de tu nodo')}
                </div>
                <p className="text-xs text-blue-700">
                  {t('setup.node_public_key_desc', 'Guarda esta clave. La necesitas para federarte con otros nodos: cada nodo debe registrar la clave publica del otro.')}
                </p>
                <code className="block text-xs bg-white p-2 rounded border border-blue-200 break-all font-mono">
                  {nodePublicKey}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(nodePublicKey); setSuccess(t('setup.key_copied', 'Clave copiada!')); setTimeout(() => setSuccess(''), 2000) }}
                  className="btn-primary text-sm py-1 px-3"
                >
                  {t('common:copy')} {t('setup.node_public_key', 'clave')}
                </button>
              </div>
            )}

            <button
              onClick={() => { window.location.href = '/' }}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {t('setup.go_to_dashboard', 'Ir al dashboard')}
              <ArrowRight size={20} />
            </button>
          </div>
        )}

        {/* Navigation */}
        {step < 6 && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={handleBack}
              disabled={step === 0}
              className="px-4 py-2 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:text-gray-900"
            >
              {t('common:back')}
            </button>

            {step < 5 ? (
              <button
                onClick={handleNext}
                className="btn-primary flex items-center gap-2"
              >
                {t('common:next')}
                <ArrowRight size={20} />
              </button>
            ) : (
              <button
                onClick={handleInit}
                disabled={submitting}
                className="btn-primary flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    {t('setup.initializing', 'Inicializando...')}
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    {t('setup.init_button')}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Enlace a licencia */}
      <div className="mt-4 text-center">
        <Link to="/licencia" className="text-xs text-gray-400 hover:text-emerald-600 transition flex items-center justify-center gap-1">
          <ScrollText size={12} />
          {t('nav.license')}
        </Link>
      </div>
    </div>
  )
}
