import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { Languages, Download, Upload, CheckCircle, AlertCircle, Loader2, Save, Plus } from 'lucide-react'

export default function TranslationEditor() {
  const { t, i18n } = useTranslation('common')
  const [languages, setLanguages] = useState<any[]>([])
  const [selectedLang, setSelectedLang] = useState('en')
  const [status, setStatus] = useState<any[]>([])
  const [missing, setMissing] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingValues, setEditingValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    loadLanguages()
  }, [])

  useEffect(() => {
    if (selectedLang) {
      loadStatus()
      loadMissing()
    }
  }, [selectedLang])

  const loadLanguages = async () => {
    try {
      const langs = await api.get<any[]>('/languages')
      setLanguages(langs || [])
    } catch {
      // Fallback
      setLanguages([
        { code: 'es', name: 'Spanish', native_name: 'Español', enabled: true, is_default: true },
        { code: 'en', name: 'English', native_name: 'English', enabled: true, is_default: false },
      ])
    } finally {
      setLoading(false)
    }
  }

  const loadStatus = async () => {
    try {
      const s = await api.get<any[]>(`/translations/${selectedLang}/status`)
      setStatus(s || [])
    } catch {
      setStatus([])
    }
  }

  const loadMissing = async () => {
    try {
      const m = await api.get<any[]>(`/translations/missing/${selectedLang}`)
      setMissing(m || [])
      // Inicializar valores de edicion con los defaults
      const vals: Record<string, string> = {}
      for (const entry of m || []) {
        const key = `${entry.namespace}.${entry.key}`
        vals[key] = entry.default_value || ''
      }
      setEditingValues(vals)
    } catch {
      setMissing([])
    }
  }

  const handleEdit = (ns: string, key: string, value: string) => {
    setEditingValues((prev) => ({ ...prev, [`${ns}.${key}`]: value }))
  }

  const handleSave = async (ns: string) => {
    setSaving(true)
    setSaveMsg('')
    try {
      // Recopilar todas las traducciones editadas de este namespace
      const nsValues: Record<string, string> = {}
      for (const entry of missing) {
        if (entry.namespace === ns) {
          const val = editingValues[`${ns}.${entry.key}`]
          if (val !== undefined && val !== '') {
            nsValues[entry.key] = val
          }
        }
      }

      if (Object.keys(nsValues).length === 0) {
        setSaveMsg(t('translations.nothing_to_save', 'No hay traducciones para guardar'))
        return
      }

      await api.put(`/translations/${selectedLang}/${ns}`, nsValues)
      setSaveMsg(t('translations.saved', 'Traducciones guardadas'))
      loadStatus()
      loadMissing()
    } catch (e: any) {
      setSaveMsg(e.message || t('translations.save_error', 'Error al guardar'))
    } finally {
      setSaving(false)
    }
  }

  // Agrupar missing por namespace
  const missingByNs = missing.reduce((acc: Record<string, any[]>, entry: any) => {
    if (!acc[entry.namespace]) acc[entry.namespace] = []
    acc[entry.namespace].push(entry)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-trueque-600" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('translations.title', 'Traducciones')}</h1>
      </div>

      {/* Selector de idioma */}
      <div className="card p-4">
        <label className="label flex items-center gap-2 mb-2">
          <Languages size={16} /> {t('translations.select_language', 'Seleccionar idioma')}
        </label>
        <div className="flex gap-2 flex-wrap">
          {languages.filter(l => l.enabled).map((lang) => (
            <button
              key={lang.code}
              onClick={() => setSelectedLang(lang.code)}
              className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                selectedLang === lang.code
                  ? 'border-trueque-600 bg-trueque-50 text-trueque-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="font-medium">{lang.native_name}</span>
              {lang.is_default && (
                <span className="text-xs ml-2 text-gray-500">({t('translations.default', 'default')})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Estado de completitud */}
      {status.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold mb-3">{t('translations.completeness', 'Estado de traducción')}</h2>
          <div className="space-y-2">
            {status.filter(s => s.total > 0).map((s) => (
              <div key={s.namespace} className="flex items-center gap-3">
                <span className="text-sm font-medium w-32">{s.namespace}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-trueque-600 h-2 rounded-full transition-all"
                    style={{ width: `${s.percent}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-20 text-right">
                  {s.translated}/{s.total} ({s.percent}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mensaje de guardado */}
      {saveMsg && (
        <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
          {saveMsg}
        </div>
      )}

      {/* Editor de traducciones faltantes */}
      <div className="card p-4">
        <h2 className="font-semibold mb-3">
          {t('translations.missing_translations', 'Traducciones faltantes')}
          <span className="text-sm font-normal text-gray-500 ml-2">({missing.length})</span>
        </h2>

        {missing.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
            <p>{t('translations.all_translated', 'Todo está traducido')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(missingByNs).map(([ns, entries]) => (
              <div key={ns}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm text-gray-700">{ns}</h3>
                  <button
                    onClick={() => handleSave(ns)}
                    disabled={saving}
                    className="btn-primary text-xs py-1 px-3 flex items-center gap-1"
                  >
                    <Save size={14} />
                    {t('common.save')}
                  </button>
                </div>
                <div className="space-y-2">
                  {entries.map((entry: any) => {
                    const editKey = `${ns}.${entry.key}`
                    return (
                      <div key={entry.key} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="p-2 bg-gray-50 rounded text-sm text-gray-600">
                          <span className="text-xs text-gray-400 font-mono">{entry.key}</span>
                          <p className="mt-1">{entry.default_value}</p>
                        </div>
                        <textarea
                          className="input text-sm"
                          value={editingValues[editKey] || ''}
                          onChange={(e) => handleEdit(ns, entry.key, e.target.value)}
                          placeholder={entry.default_value}
                          rows={2}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
