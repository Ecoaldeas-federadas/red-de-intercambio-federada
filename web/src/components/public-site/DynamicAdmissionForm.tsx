import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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
    help_text: 'Selecciona cómo deseas participar en la Feria Conuquera.',
    required: true,
    options: [
      'Productor Agrícola / Conuquero',
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
    help_text: 'Nos ayuda a geolocalizar las unidades productivas en la Gran Caracas.',
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
    label: '¿Cómo te enteraste de la Feria Conuquera?',
    type: 'select',
    help_text: 'Para conocer cómo se expande nuestra red popular.',
    required: false,
    options: [
      'Visité el mercado en Parque Los Caobos',
      'Redes Sociales (Instagram / Facebook)',
      'Recomendación de un productor o vecino conuquero',
      'Asamblea popular o taller comunitario',
      'Prensa comunitaria o radio',
    ],
  },
]

export function DynamicAdmissionForm() {
  const [fields, setFields] = useState<FormFieldSchema[]>(DEFAULT_ADMISSION_FIELDS)
  const [title, setTitle] = useState('Solicitud de Ingreso a la Red')
  const [subtitle, setSubtitle] = useState('Completa tus datos para postularte como productor conuquero, artesano o miembro.')
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
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
          setError(`El campo "${f.label.replace('*', '').trim()}" es obligatorio.`)
          return
        }
      }
    }

    setLoading(true)
    try {
      const payload = {
        full_name: answers.full_name || answers[fields[0]?.id] || 'Anónimo',
        email: answers.email || '',
        phone: answers.phone || '',
        location: answers.location || '',
        reason: answers.reason || '',
        skills: answers.skills || '',
        how_heard: answers.how_heard || '',
        custom_fields: answers,
      }

      await api.post('/public/admission-request', payload)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar la solicitud.')
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
          ¡Solicitud enviada con éxito!
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-lg mx-auto">
          Muchas gracias por tu interés en sumarte a la <b>Feria Conuquera Agroecológica</b>. Tus respuestas han sido registradas y serán evaluadas por la asamblea comunitaria. Nos pondremos en contacto contigo a la brevedad.
        </p>
        <div className="pt-3">
          <Link
            to="/p/inicio"
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-bold text-white bg-emerald-800 hover:bg-emerald-700 transition text-xs shadow"
          >
            Volver a la Página Principal
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
          🌱 Postulación Comunitaria
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-gray-600 max-w-lg mx-auto">{subtitle}</p>}
      </div>

      {/* Dynamic Form Card */}
      <form onSubmit={submitForm} className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-gray-200 space-y-4">
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 font-medium">
            {error}
          </div>
        )}

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
                  <option value="">Selecciona una opción...</option>
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

        <div className="pt-3">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white bg-emerald-800 hover:bg-emerald-700 active:scale-95 transition shadow-md text-xs sm:text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Enviando postulación...' : 'Enviar Solicitud a la Asamblea'}
            <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </div>
  )
}
