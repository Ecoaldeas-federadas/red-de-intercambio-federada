import { useState } from 'react'
import { usePreferences, useUpdatePreferences, FormatSettings } from '../hooks/usePreferences'
import { SlidersHorizontal, Check, AlertCircle, Save } from 'lucide-react'

const LOCALES = [
  { value: 'es', label: 'Espanol' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Portugues' },
]

const NUMBER_LOCALES = [
  { value: 'es-VE', label: '1.234,56 (coma decimal)' },
  { value: 'es-ES', label: '1.234,56 (coma decimal)' },
  { value: 'en-US', label: '1,234.56 (punto decimal)' },
  { value: 'pt-BR', label: '1.234,56 (coma decimal)' },
]

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
]

const TIMEZONES = [
  { value: 'America/Caracas', label: 'Caracas (UTC-4)' },
  { value: 'America/Bogota', label: 'Bogota (UTC-5)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (UTC-3)' },
  { value: 'America/Mexico_City', label: 'Ciudad de Mexico (UTC-6)' },
  { value: 'America/Lima', label: 'Lima (UTC-5)' },
  { value: 'America/Santiago', label: 'Santiago (UTC-4)' },
  { value: 'Europe/Madrid', label: 'Madrid (UTC+1)' },
  { value: 'UTC', label: 'UTC' },
]

export default function Settings() {
  const current = usePreferences()
  const { update, saving, error } = useUpdatePreferences()
  const [form, setForm] = useState<FormatSettings>(current)
  const [success, setSuccess] = useState(false)

  const set = <K extends keyof FormatSettings>(key: K, value: FormatSettings[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setSuccess(false)
  }

  const handleSave = async () => {
    setSuccess(false)
    const ok = await update(form)
    if (ok) setSuccess(true)
  }

  const today = new Date()
  const previewDate = (() => {
    const dd = String(today.getDate()).padStart(2, '0')
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const yyyy = today.getFullYear()
    switch (form.date_format) {
      case 'MM/DD/YYYY': return `${mm}/${dd}/${yyyy}`
      case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`
      case 'DD/MM/YYYY':
      default: return `${dd}/${mm}/${yyyy}`
    }
  })()
  const previewTime = today.toLocaleString(form.locale, {
    hour: '2-digit', minute: '2-digit', hour12: form.time_format === '12h',
  })
  const previewNumber = (1234.56).toLocaleString(form.number_locale, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SlidersHorizontal size={24} /> Ajustes de visualizacion
        </h1>
      </div>

      <p className="text-sm text-gray-500">
        Personaliza como se muestran los numeros, fechas y horas en tu cuenta.
        Estos ajustes se guardan en tu perfil y se aplican en todos tus dispositivos.
      </p>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg flex items-center gap-2 text-sm">
          <Check size={18} /> Ajustes guardados correctamente.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Idioma */}
      <div className="card">
        <h2 className="font-semibold mb-3">Idioma</h2>
        <label className="label">Idioma de la interfaz</label>
        <select
          value={form.locale}
          onChange={(e) => set('locale', e.target.value)}
          className="input"
        >
          {LOCALES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* Formato de numeros */}
      <div className="card">
        <h2 className="font-semibold mb-3">Formato de numeros</h2>
        <label className="label">Separador decimal y de miles</label>
        <select
          value={form.number_locale}
          onChange={(e) => set('number_locale', e.target.value)}
          className="input"
        >
          {NUMBER_LOCALES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-2">
          Vista previa: <span className="font-mono font-medium">{previewNumber}</span>
        </p>
      </div>

      {/* Formato de fecha */}
      <div className="card">
        <h2 className="font-semibold mb-3">Formato de fecha</h2>
        <label className="label">Como se muestran las fechas</label>
        <select
          value={form.date_format}
          onChange={(e) => set('date_format', e.target.value)}
          className="input"
        >
          {DATE_FORMATS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-2">
          Vista previa (hoy): <span className="font-mono font-medium">{previewDate}</span>
        </p>
      </div>

      {/* Formato de hora */}
      <div className="card">
        <h2 className="font-semibold mb-3">Formato de hora</h2>
        <div className="flex gap-2">
          <button
            onClick={() => set('time_format', '24h')}
            className={`flex-1 px-4 py-2 rounded-lg border text-sm transition ${
              form.time_format === '24h'
                ? 'bg-trueque-600 text-white border-trueque-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-trueque-400'
            }`}
          >
            24 horas
          </button>
          <button
            onClick={() => set('time_format', '12h')}
            className={`flex-1 px-4 py-2 rounded-lg border text-sm transition ${
              form.time_format === '12h'
                ? 'bg-trueque-600 text-white border-trueque-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-trueque-400'
            }`}
          >
            12 horas (AM/PM)
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Vista previa (ahora): <span className="font-mono font-medium">{previewTime}</span>
        </p>
      </div>

      {/* Primer dia de la semana */}
      <div className="card">
        <h2 className="font-semibold mb-3">Primer dia de la semana</h2>
        <label className="label">Inicio de la semana en calendarios</label>
        <select
          value={String(form.first_day_of_week)}
          onChange={(e) => set('first_day_of_week', Number(e.target.value))}
          className="input"
        >
          <option value="0">Domingo</option>
          <option value="1">Lunes</option>
        </select>
      </div>

      {/* Zona horaria */}
      <div className="card">
        <h2 className="font-semibold mb-3">Zona horaria</h2>
        <label className="label">Zona horaria para mostrar fechas y horas</label>
        <select
          value={form.timezone}
          onChange={(e) => set('timezone', e.target.value)}
          className="input"
        >
          {TIMEZONES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Boton guardar */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? 'Guardando...' : 'Guardar ajustes'}
        </button>
      </div>
    </div>
  )
}
