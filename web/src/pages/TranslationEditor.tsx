import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { Languages, Download, Upload, CheckCircle, AlertCircle, Loader2, Save, Plus, Network } from 'lucide-react'

export default function TranslationEditor() {
  const { t, i18n } = useTranslation(['translations', 'common'])
  const [languages, setLanguages] = useState<any[]>([])
  const [selectedLang, setSelectedLang] = useState('en')
  const [status, setStatus] = useState<any[]>([])
  const [federatedTranslations, setFederatedTranslations] = useState<any[]>([])
  const [auditData, setAuditData] = useState<any>(null)
  const [missing, setMissing] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingValues, setEditingValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [newLangCode, setNewLangCode] = useState('')
  const [newLangName, setNewLangName] = useState('')
  const [newLangNative, setNewLangNative] = useState('')
  const [uploadMsg, setUploadMsg] = useState('')
  const [uploadError, setUploadError] = useState(false)

  useEffect(() => {
    loadLanguages()
    loadFederatedTranslations()
    loadAuditData()
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

  const loadFederatedTranslations = async () => {
    try {
      const res = await api.get<any[]>('/translations/federated')
      setFederatedTranslations(res || [])
    } catch {
      setFederatedTranslations([])
    }
  }

  const loadAuditData = async () => {
    try {
      // Cargar estado de traducciones por idioma
      const audit: any = { languages: [], namespaces: [] }
      const langs = await api.get<any[]>('/languages')
      const enabledLangs = (langs || []).filter((l: any) => l.enabled)

      for (const lang of enabledLangs) {
        try {
          const status = await api.get<any[]>(`/translations/${lang.code}/status`)
          const totalKeys = status?.reduce((sum: number, s: any) => sum + (s.total || 0), 0) || 0
          const translatedKeys = status?.reduce((sum: number, s: any) => sum + (s.translated || 0), 0) || 0
          const pct = totalKeys > 0 ? Math.round((translatedKeys / totalKeys) * 100) : 0
          audit.languages.push({
            code: lang.code,
            name: lang.native_name,
            total: totalKeys,
            translated: translatedKeys,
            pct,
          })
        } catch {
          audit.languages.push({ code: lang.code, name: lang.native_name, total: 0, translated: 0, pct: 0 })
        }
      }
      setAuditData(audit)
    } catch {
      setAuditData(null)
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
        setSaveMsg(t('nothing_to_save', 'No hay traducciones para guardar'))
        return
      }

      await api.put(`/translations/${selectedLang}/${ns}`, nsValues)
      setSaveMsg(t('saved', 'Traducciones guardadas'))
      loadStatus()
      loadMissing()
    } catch (e: any) {
      setSaveMsg(e.message || t('save_error', 'Error al guardar'))
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = async (lang: string) => {
    try {
      const res = await fetch(`/api/translations/${lang}/download`)
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${lang}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setSaveMsg(e.message || t('download_error', 'Error al descargar'))
    }
  }

  const handleToggleEnabled = async (lang: any) => {
    try {
      await api.put(`/languages/${lang.code}`, { enabled: !lang.enabled })
      loadLanguages()
    } catch (e: any) {
      setSaveMsg(e.message || t('save_error', 'Error al guardar'))
    }
  }

  const handleSetDefault = async (code: string) => {
    try {
      await api.put(`/languages/${code}`, { is_default: true })
      loadLanguages()
    } catch (e: any) {
      setSaveMsg(e.message || t('save_error', 'Error al guardar'))
    }
  }

  const handleAddLanguage = async () => {
    if (!newLangCode || !newLangName) return
    try {
      await api.post('/languages', {
        code: newLangCode,
        name: newLangName,
        native_name: newLangNative || newLangName,
        enabled: true,
      })
      setNewLangCode('')
      setNewLangName('')
      setNewLangNative('')
      loadLanguages()
      setSaveMsg(t('language_added', 'Idioma anadido'))
    } catch (e: any) {
      setSaveMsg(e.message || t('save_error', 'Error al guardar'))
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    setUploadMsg('')
    setUploadError(false)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/translations/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Upload failed')
      }
      setUploadMsg(t('upload_success', 'Archivo subido correctamente'))
      loadStatus()
      loadMissing()
    } catch (err: any) {
      setUploadError(true)
      setUploadMsg(err.message || t('upload_error', 'Error al subir archivo'))
    }
  }

  const handleInstallFederated = async (ft: any) => {
    if (!confirm(t('confirm_apply', 'Aplicar esta traduccion? Sobrescribira tus traducciones actuales de este idioma.'))) {
      return
    }
    try {
      await api.post('/translations/federated/install', {
        source_node: ft.source_node,
        language_code: ft.language_code,
      })
      setSaveMsg(t('installed', 'Instalado'))
      loadFederatedTranslations()
      loadStatus()
      loadMissing()
    } catch (e: any) {
      setSaveMsg(e.message || t('save_error', 'Error al guardar'))
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
        <h1 className="text-2xl font-bold">{t('title', 'Traducciones')}</h1>
      </div>

      {/* Panel de auditoria */}
      {auditData && auditData.languages.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <CheckCircle size={18} /> {t('audit_title', 'Estado de traducciones')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {auditData.languages.map((lang: any) => (
              <div key={lang.code} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm flex items-center gap-1">
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-gray-100">{lang.code.toUpperCase()}</span>
                    {lang.name}
                  </span>
                  <span className={`text-xs font-bold ${
                    lang.pct >= 80 ? 'text-green-600' : lang.pct >= 40 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {lang.pct}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      lang.pct >= 80 ? 'bg-green-500' : lang.pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${lang.pct}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {lang.translated} / {lang.total} {t('keys_translated', 'claves traducidas')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selector de idioma */}
      <div className="card p-4">
        <label className="label flex items-center gap-2 mb-2">
          <Languages size={16} /> {t('select_language', 'Seleccionar idioma')}
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
                <span className="text-xs ml-2 text-gray-500">({t('default', 'default')})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Estado de completitud */}
      {status.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold mb-3">{t('completeness', 'Estado de traducción')}</h2>
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
          {t('missing_translations', 'Traducciones faltantes')}
          <span className="text-sm font-normal text-gray-500 ml-2">({missing.length})</span>
        </h2>

        {missing.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
            <p>{t('all_translated', 'Todo está traducido')}</p>
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
                    {t('common:save')}
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

      {/* Gestion de idiomas */}
      <div className="card p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Plus size={18} /> {t('manage_languages', 'Gestionar idiomas')}
        </h2>

        {/* Lista de idiomas con acciones */}
        <div className="space-y-2 mb-4">
          {languages.map((lang) => (
            <div key={lang.code} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <span className="font-medium text-sm">{lang.native_name}</span>
                <span className="text-xs text-gray-500 ml-2">({lang.code})</span>
                {lang.is_default && (
                  <span className="text-xs ml-2 px-2 py-0.5 rounded bg-trueque-100 text-trueque-700">
                    {t('default', 'default')}
                  </span>
                )}
                {!lang.enabled && (
                  <span className="text-xs ml-2 px-2 py-0.5 rounded bg-gray-200 text-gray-600">
                    {t('disabled', 'deshabilitado')}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload(lang.code)}
                  className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                  title={t('download', 'Descargar archivo')}
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={() => handleToggleEnabled(lang)}
                  className="btn-secondary text-xs py-1 px-2"
                >
                  {lang.enabled ? t('disable', 'Deshabilitar') : t('enable', 'Habilitar')}
                </button>
                {!lang.is_default && (
                  <button
                    onClick={() => handleSetDefault(lang.code)}
                    className="btn-secondary text-xs py-1 px-2"
                  >
                    {t('set_default', 'Establecer como default')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Anadir idioma */}
        <div className="border-t pt-4">
          <h3 className="font-medium text-sm mb-2">{t('add_language', 'Anadir idioma')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder={t('language_code', 'Codigo (ej: en, pt, fr)')}
              className="input text-sm"
              value={newLangCode}
              onChange={(e) => setNewLangCode(e.target.value)}
            />
            <input
              type="text"
              placeholder={t('language_name', 'Nombre (ej: English)')}
              className="input text-sm"
              value={newLangName}
              onChange={(e) => setNewLangName(e.target.value)}
            />
            <input
              type="text"
              placeholder={t('language_native', 'Nombre nativo (ej: English)')}
              className="input text-sm"
              value={newLangNative}
              onChange={(e) => setNewLangNative(e.target.value)}
            />
          </div>
          <button
            onClick={handleAddLanguage}
            disabled={!newLangCode || !newLangName}
            className="btn-primary text-sm mt-2 py-1 px-3 flex items-center gap-1"
          >
            <Plus size={14} /> {t('add_language', 'Anadir idioma')}
          </button>
        </div>

        {/* Subir archivo de traduccion */}
        <div className="border-t pt-4 mt-4">
          <h3 className="font-medium text-sm mb-2">{t('upload', 'Subir archivo')}</h3>
          <input
            type="file"
            accept=".json"
            onChange={handleUpload}
            className="text-sm"
          />
          {uploadMsg && (
            <div className={`mt-2 text-sm p-2 rounded ${uploadError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {uploadMsg}
            </div>
          )}
        </div>
      </div>

      {/* Traducciones de otros nodos federados */}
      <div className="card p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Network size={18} /> {t('federation', 'Traducciones de otros nodos')}
        </h2>
        {federatedTranslations.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Network size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t('no_federation_translations', 'No hay traducciones disponibles de otros nodos')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {federatedTranslations.map((ft: any) => (
              <div key={`${ft.source_node}-${ft.language_code}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium text-sm">{ft.display_name}</span>
                  <span className="text-xs text-gray-500 ml-2">({ft.language_code})</span>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {t('node', 'Nodo')}: {ft.source_node} · v{ft.version} · {ft.num_keys} keys
                  </div>
                </div>
                <div className="flex gap-2">
                  {!ft.installed ? (
                    <button
                      onClick={() => handleInstallFederated(ft)}
                      className="btn-primary text-xs py-1 px-2 flex items-center gap-1"
                    >
                      <Download size={14} /> {t('download', 'Descargar')}
                    </button>
                  ) : (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle size={14} /> {t('installed', 'Instalado')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
