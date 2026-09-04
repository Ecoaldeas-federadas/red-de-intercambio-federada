import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../api'
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Mail,
  Phone,
  MapPin,
  Leaf,
  Check,
  AlertCircle,
  ScrollText,
} from 'lucide-react'
import { FormFieldSchema, FormFieldType } from '../../types/publicSite'

export const DEFAULT_ADMISSION_FIELDS: FormFieldSchema[] = [
  {
    id: 'full_name',
    label: 'Nombre Completo o Colectivo Productor *',
    type: 'text',
    placeholder: 'Ej: María Rodríguez / Colectivo Agroecológico El Conuco',
    help_text: 'Indica tu nombre completo o el nombre de tu colectivo/unidad productiva.',
    required: true,
  },
  {
    id: 'proposed_username',
    label: 'Nombre de Usuario *',
    type: 'text',
    placeholder: 'Ej: maria_rodriguez, colectivo_conuco, juanperez',
    help_text: 'Así quieres que te identifiquen en la red. Solo letras, números, guiones y guiones bajos. Sin espacios.',
    required: true,
  },
  {
    id: 'proposed_password',
    label: 'Contraseña *',
    type: 'password',
    placeholder: 'Mínimo 6 caracteres',
    help_text: 'Con esta contraseña podrás iniciar sesión para ver el estado de tu solicitud.',
    required: true,
  },
  {
    id: 'proposed_password_confirm',
    label: 'Confirmar Contraseña *',
    type: 'password',
    placeholder: 'Repite tu contraseña',
    help_text: 'Verifica que escribiste bien tu contraseña.',
    required: true,
  },
  {
    id: 'email',
    label: 'Correo Electrónico',
    type: 'email',
    placeholder: 'maria@ejemplo.com',
    help_text: 'Te enviaremos la confirmación y convocatorias de asambleas.',
    required: false,
  },
  {
    id: 'phone',
    label: 'Teléfono / WhatsApp de Contacto *',
    type: 'tel',
    placeholder: '+58 412 0000000',
    help_text: 'Canal principal para coordinar visitas formativas o contacto directo.',
    required: true,
  },
  {
    id: 'participation_type',
    label: 'Tipo de Participación / Perfil en la Red',
    type: 'select',
    help_text: 'Selecciona cómo deseas participar en la comunidad.',
    required: true,
    options: [
      'Productor Agrícola',
      'Artesano Gastronómico / Alimentos Procesados',
      'Medicina Botánica & Cosmética Natural',
      'Consumidor Consciente / Miembro de Trueque',
      'Tallerista / Educador Popular',
      'Colectivo Comunitario / Comuna',
    ],
  },
  {
    id: 'location',
    label: 'Ubicación / Sector donde resides o produces',
    type: 'text',
    placeholder: 'Ej: El Junquito Km 18 / La Pastora / Valles del Tuy / Baruta',
    help_text: 'Nos ayuda a geolocalizar las unidades productivas.',
    required: false,
  },
  {
    id: 'skills',
    label: '¿Qué rubros, productos o saberes deseas aportar a la comunidad?',
    type: 'textarea',
    placeholder: 'Ej: Hortalizas de hoja, semillas criollas de maíz, panadería sin gluten, tinturas de propóleo, talleres de lombricultura...',
    help_text: 'Detalla lo que produces o los conocimientos que puedes compartir en los talleres de la feria.',
    required: false,
  },
  {
    id: 'agro_practices',
    label: '¿Qué prácticas agroecológicas implementas en tu producción?',
    type: 'checkbox',
    help_text: 'Marca todas las que apliquen a tu trabajo.',
    required: false,
    options: [
      '100% libre de agrotóxicos, pesticidas y venenos químicos',
      'Compostaje, biol y abonos orgánicos propios',
      'Uso y custodia de semillas criollas y nativas libres de transgénicos',
      'Policultivo biodiverso y respeto a los ciclos de la tierra',
      'Cuidado de fuentes de agua y reciclaje de biomasa',
      'Empaques ecológicos y reducción de bolsas plásticas',
    ],
  },
  {
    id: 'reason',
    label: '¿Por qué deseas sumarte a la red de trueque y economía solidaria?',
    type: 'textarea',
    placeholder: 'Explícanos tu motivación para participar en la soberanía alimentaria y el intercambio solidario...',
    help_text: 'Esta respuesta será evaluada por la asamblea de productores.',
    required: false,
  },
  {
    id: 'how_heard',
    label: '¿Cómo te enteraste de nosotros?',
    type: 'select',
    help_text: 'Para conocer cómo se expande nuestra red popular.',
    required: false,
    options: [
      'Visité la comunidad',
      'Redes Sociales (Instagram / Facebook)',
      'Recomendación de un miembro de la comunidad',
      'Asamblea popular o taller comunitario',
      'Prensa comunitaria o radio',
    ],
  },
]

export function DynamicAdmissionForm() {
  const { t } = useTranslation(['public', 'common'])
  const [fields, setFields] = useState<FormFieldSchema[]>(DEFAULT_ADMISSION_FIELDS)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [governanceRules, setGovernanceRules] = useState<any[]>([])
  const [acceptedRules, setAcceptedRules] = useState(false)
  const [showRules, setShowRules] = useState(false)

  useEffect(() => {
    setTitle(t('admission_form_title'))
    setSubtitle(t('admission_form_subtitle'))
    api
      .get('/public/admission-form')
      .then((d: any) => {
        if (d) {
          if (d.title) setTitle(d.title)
          if (d.subtitle) setSubtitle(d.subtitle)
          if (d.schema && Array.isArray(d.schema) && d.schema.length > 0) {
            setFields(d.schema)
          }
        }
      })
      .catch(() => {})

    // Cargar reglas de gobernanza para aceptacion obligatoria
    api
      .get('/public/governance')
      .then((data: any) => {
        if (Array.isArray(data) && data.length > 0) {
          setGovernanceRules(data)
        }
      })
      .catch(() => {})
  }, [])

  const handleFieldChange = (fieldId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
  }

  const handleCheckboxToggle = (fieldId: string, option: string) => {
    const currentList: string[] = Array.isArray(answers[fieldId]) ? answers[fieldId] : []
    const updated = currentList.includes(option)
      ? currentList.filter((item) => item !== option)
      : [...currentList, option]
    setAnswers((prev) => ({ ...prev, [fieldId]: updated }))
  }

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate required fields
    for (const f of fields) {
      if (f.required) {
        const val = answers[f.id]
        if (!val || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && val.length === 0)) {
          setError(t('admission_error_required', { field: f.label.replace('*', '').trim() }))
          return
        }
      }
    }

    // Validar aceptacion de reglas de gobernanza
    if (governanceRules.length > 0 && !acceptedRules) {
      setError(t('admission_error_rules'))
      return
    }

    setLoading(true)
    try {
      // Validar que las contraseñas coincidan
      const pw = answers.proposed_password || ''
      const pwConfirm = answers.proposed_password_confirm || ''
      if (pw && pwConfirm && pw !== pwConfirm) {
        setError(t('admission_error_passwords'))
        setLoading(false)
        return
      }

      // Validar formato de username
      const username = (answers.proposed_username || '').trim().toLowerCase()
      if (username && !/^[a-z0-9_-]+$/.test(username)) {
        setError(t('admission_error_username'))
        setLoading(false)
        return
      }

      // Construir custom_fields excluyendo campos sensibles (passwords).
      // Las passwords se envian por separado (proposed_password) y nunca
      // deben guardarse en custom_fields donde el admin podria verlas.
      const sanitizedCustomFields: Record<string, any> = {}
      for (const [key, value] of Object.entries(answers)) {
        if (key.toLowerCase().includes('password') || key.toLowerCase().includes('contrasena') || key.toLowerCase().includes('clave')) {
          continue
        }
        sanitizedCustomFields[key] = value
      }

      const payload = {
        full_name: answers.full_name || answers[fields[0]?.id] || t('admission_anonymous'),
        email: answers.email || '',
        phone: answers.phone || '',
        location: answers.location || '',
        reason: answers.reason || '',
        skills: answers.skills || '',
        how_heard: answers.how_heard || '',
        custom_fields: sanitizedCustomFields,
        proposed_username: username,
        proposed_password: pw,
      }

      await api.post('/public/admission-request', payload)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admission_error_submit'))
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-12 text-center max-w-2xl mx-auto shadow-md border border-emerald-100 space-y-4 my-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto text-3xl shadow-inner">
          ✓
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-emerald-950">
          {t('admission_success_title')}
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-lg mx-auto" dangerouslySetInnerHTML={{ __html: t('admission_success_desc') }} />
        <p className="text-xs sm:text-sm text-emerald-800 font-medium">
          {t('admission_success_login_prefix')} <Link to="/login" className="underline font-bold">{t('admission_success_login_link')}</Link> {t('admission_success_login_suffix')}
        </p>
        <div className="pt-3">
          <Link
            to="/p/inicio"
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-bold text-white bg-emerald-800 hover:bg-emerald-700 transition text-xs shadow"
          >
            {t('admission_success_home')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto my-4 sm:my-6 space-y-5">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <span className="inline-block px-3 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
          {t('admission_badge')}
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-gray-600 max-w-lg mx-auto">{subtitle}</p>}
      </div>

      {/* Dynamic Form Card */}
      <form onSubmit={submitForm} className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-gray-200 space-y-4">
        {fields.map((field) => {
          const val = answers[field.id] || ''

          return (
            <div key={field.id} className="space-y-1">
              <label className="label font-bold text-xs text-gray-800 block">
                {field.label}
              </label>

              {/* 1. TEXT INPUT */}
              {field.type === 'text' && (
                <input
                  type="text"
                  className="input text-xs sm:text-sm"
                  placeholder={field.placeholder || ''}
                  value={val}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                />
              )}

              {/* 1b. PASSWORD INPUT */}
              {field.type === 'password' && (
                <input
                  type="password"
                  className="input text-xs sm:text-sm"
                  placeholder={field.placeholder || ''}
                  value={val}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  autoComplete="new-password"
                />
              )}

              {/* 2. EMAIL INPUT */}
              {field.type === 'email' && (
                <input
                  type="email"
                  className="input text-xs sm:text-sm"
                  placeholder={field.placeholder || 'correo@ejemplo.com'}
                  value={val}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                />
              )}

              {/* 3. TEL INPUT */}
              {field.type === 'tel' && (
                <input
                  type="tel"
                  className="input text-xs sm:text-sm"
                  placeholder={field.placeholder || '+58 412 0000000'}
                  value={val}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                />
              )}

              {/* 4. NUMBER INPUT */}
              {field.type === 'number' && (
                <input
                  type="number"
                  className="input text-xs sm:text-sm"
                  placeholder={field.placeholder || '0'}
                  value={val}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                />
              )}

              {/* 5. TEXTAREA */}
              {field.type === 'textarea' && (
                <textarea
                  rows={3}
                  className="input text-xs sm:text-sm"
                  placeholder={field.placeholder || ''}
                  value={val}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                />
              )}

              {/* 6. SELECT DROPDOWN */}
              {field.type === 'select' && (
                <select
                  className="input text-xs sm:text-sm bg-white cursor-pointer"
                  value={val}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                >
                  <option value="">{t('admission_select_option')}</option>
                  {(field.options || []).map((opt, i) => (
                    <option key={i} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}

              {/* 7. RADIO BUTTONS (SINGLE CHOICE) */}
              {field.type === 'radio' && (
                <div className="space-y-1.5 pt-1">
                  {(field.options || []).map((opt, i) => (
                    <label
                      key={i}
                      className="flex items-center gap-2.5 p-2 rounded-xl border border-gray-200 hover:bg-emerald-50/40 text-xs text-gray-800 cursor-pointer transition"
                    >
                      <input
                        type="radio"
                        name={field.id}
                        value={opt}
                        checked={val === opt}
                        onChange={() => handleFieldChange(field.id, opt)}
                        className="accent-emerald-700"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* 8. CHECKBOXES (MULTI SELECT) */}
              {field.type === 'checkbox' && (
                <div className="space-y-1.5 pt-1">
                  {(field.options || []).map((opt, i) => {
                    const isChecked = Array.isArray(val) && val.includes(opt)
                    return (
                      <label
                        key={i}
                        className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition ${
                          isChecked
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-medium'
                            : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleCheckboxToggle(field.id, opt)}
                          className="accent-emerald-700 rounded"
                        />
                        <span>{opt}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              {field.help_text && (
                <p className="text-[11px] text-gray-500 leading-relaxed pt-0.5">{field.help_text}</p>
              )}
            </div>
          )
        })}

        {/* Aceptacion de reglas de gobernanza (Ley de la Aldea) */}
        {governanceRules.length > 0 && (
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-emerald-900">{t('admission_rules_title')}</h3>
              <button
                type="button"
                onClick={() => setShowRules(!showRules)}
                className="text-xs text-emerald-700 underline"
              >
                {showRules ? t('admission_rules_hide') : t('admission_rules_show')}
              </button>
            </div>
            <p className="text-xs text-gray-600">
              {t('admission_rules_intro', { count: governanceRules.length })}
            </p>
            {showRules && (
              <div className="max-h-64 overflow-y-auto rounded-lg bg-white p-3 space-y-2 border border-gray-200">
                {governanceRules.map((rule: any) => (
                  <div key={rule.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        rule.severity === 'muy_grave' ? 'bg-red-100 text-red-700' :
                        rule.severity === 'grave' ? 'bg-orange-100 text-orange-700' :
                        rule.severity === 'leve' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {rule.severity === 'muy_grave' ? t('admission_severity_muy_grave') :
                         rule.severity === 'grave' ? t('admission_severity_grave') :
                         rule.severity === 'leve' ? t('admission_severity_leve') : t('admission_severity_info')}
                      </span>
                      <span className="font-medium">{rule.title}</span>
                    </div>
                    <p className="text-gray-600 mt-0.5 ml-1">{rule.description}</p>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-start gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={acceptedRules}
                onChange={(e) => setAcceptedRules(e.target.checked)}
                className="accent-emerald-700 rounded mt-0.5"
              />
              <span className="text-xs text-gray-800 font-medium">
                {t('admission_rules_accept')}
              </span>
            </label>
          </div>
        )}

        <div className="pt-3">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white bg-emerald-800 hover:bg-emerald-700 active:scale-95 transition shadow-md text-xs sm:text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? t('admission_submitting') : t('admission_submit')}
            <ArrowRight size={15} />
          </button>
          {error && (
            <div className="mt-3 p-3.5 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 font-medium flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </form>

      {/* Enlace a licencia */}
      <div className="mt-4 text-center">
        <Link to="/licencia" className="text-xs text-gray-400 hover:text-emerald-600 transition flex items-center justify-center gap-1">
          <ScrollText size={12} />
          {t('admission_license')}
        </Link>
      </div>
    </div>
  )
}
