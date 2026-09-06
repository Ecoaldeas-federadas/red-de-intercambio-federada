import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { Languages, Download, CheckCircle, AlertCircle, Loader2, Save, Plus, Network, Search, Database, X, Pencil, Info, ArrowRight, Upload, ArrowLeft, CheckSquare } from 'lucide-react'

type KeyEntry = {
  key: string
  value: string
  is_default: boolean
  json_value: string
}

type NSResult = {
  namespace: string
  keys: KeyEntry[]
}

type Tab = 'db' | 'diff'

export default function TranslationEditor() {
  const { t } = useTranslation(['translations', 'common'])
  const [languages, setLanguages] = useState<any[]>([])
  const [selectedLang, setSelectedLang] = useState('en')
  const [allKeys, setAllKeys] = useState<NSResult[]>([])
  const [federatedTranslations, setFederatedTranslations] = useState<any[]>([])
  const [auditData, setAuditData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadingKeys, setLoadingKeys] = useState(false)
  // editingValues: valor actual en el textarea. savedValues: ultimo valor conocido del servidor.
  const [editingValues, setEditingValues] = useState<Record<string, string>>({})
  const [savedValues, setSavedValues] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState(false)
  const [newLangCode, setNewLangCode] = useState('')
  const [newLangName, setNewLangName] = useState('')
  const [newLangNative, setNewLangNative] = useState('')
  const [uploadMsg, setUploadMsg] = useState('')
  const [uploadError, setUploadError] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedNs, setSelectedNs] = useState<string>('')
  const [showAddKey, setShowAddKey] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [seeding, setSeeding] = useState(false)
  const [expandedNs, setExpandedNs] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<Tab>('db')
  const [editingSuggested, setEditingSuggested] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(true)
  const [applyingAll, setApplyingAll] = useState(false)
  const [showApplyAllModal, setShowApplyAllModal] = useState(false)

  useEffect(() => {
    loadLanguages()
    loadFederatedTranslations()
    loadAuditData()
  }, [])

  useEffect(() => {
    if (selectedLang) {
      loadAllKeys()
      loadAuditData()
    }
  }, [selectedLang])

  const loadLanguages = async () => {
    try {
      const langs = await api.get<any[]>('/languages')
      setLanguages(langs || [])
    } catch {
      setLanguages([
        { code: 'es', name: 'Spanish', native_name: 'Espanol', enabled: true, is_default: true },
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

  const loadAllKeys = async () => {
    setLoadingKeys(true)
    try {
      const data = await api.get<NSResult[]>(`/translations/${selectedLang}/all`)
      setAllKeys(data || [])
      const vals: Record<string, string> = {}
      for (const ns of data || []) {
        for (const entry of ns.keys) {
          vals[`${ns.namespace}.${entry.key}`] = entry.value
        }
      }
      setEditingValues(vals)
      setSavedValues(vals)
      setEditingSuggested(null)
    } catch {
      setAllKeys([])
    } finally {
      setLoadingKeys(false)
    }
  }

  // Una clave esta "sucia" si el texto editado difiere del ultimo valor guardado
  const isDirty = (editKey: string) =>
    editingValues[editKey] !== undefined && editingValues[editKey] !== savedValues[editKey]

  const dirtyCount = useMemo(
    () => Object.keys(editingValues).filter(isDirty).length,
    [editingValues, savedValues]
  )

  const handleEdit = (ns: string, key: string, value: string) => {
    setEditingValues((prev) => ({ ...prev, [`${ns}.${key}`]: value }))
  }

  const markSaved = (ns: string, key: string, value: string) => {
    const editKey = `${ns}.${key}`
    setSavedValues((prev) => ({ ...prev, [editKey]: value }))
    setAllKeys((prev) =>
      prev.map((nsData) =>
        nsData.namespace === ns
          ? { ...nsData, keys: nsData.keys.map((k) => (k.key === key ? { ...k, value, is_default: false } : k)) }
          : nsData
      )
    )
  }

  const handleSaveKey = async (ns: string, key: string) => {
    const value = editingValues[`${ns}.${key}`]
    if (value === undefined) return
    setSavingKey(`${ns}.${key}`)
    setSaveMsg('')
    setSaveError(false)
    try {
      await api.put(`/translations/${selectedLang}/${ns}/key`, { key, value })
      markSaved(ns, key, value)
      setSaveMsg(t('key_saved'))
      loadAuditData()
    } catch (e: any) {
      setSaveError(true)
      setSaveMsg(e.message || t('save_error', 'Error saving'))
    } finally {
      setSavingKey(null)
    }
  }

  // Aplica una clave sugerida (JSON) a la BD tal cual, sin editar
  const handleApplySuggested = async (ns: string, entry: KeyEntry) => {
    setSavingKey(`${ns}.${entry.key}`)
    setSaveMsg('')
    setSaveError(false)
    try {
      await api.put(`/translations/${selectedLang}/${ns}/key`, { key: entry.key, value: entry.value })
      markSaved(ns, entry.key, entry.value)
      setSaveMsg(t('key_applied'))
      loadAuditData()
    } catch (e: any) {
      setSaveError(true)
      setSaveMsg(e.message || t('save_error', 'Error applying'))
    } finally {
      setSavingKey(null)
    }
  }

  const handleAddKey = async () => {
    if (!newKey || !selectedNs) return
    setSavingKey('new')
    try {
      await api.post(`/translations/${selectedLang}/${selectedNs}/key`, { key: newKey, value: newValue })
      setSaveMsg(t('key_added'))
      setSaveError(false)
      setNewKey('')
      setNewValue('')
      setShowAddKey(false)
      loadAllKeys()
      loadAuditData()
    } catch (e: any) {
      setSaveError(true)
      setSaveMsg(e.message || t('save_error', 'Error adding'))
    } finally {
      setSavingKey(null)
    }
  }

  const handleSeed = async () => {
    if (!confirm(t('seed_force_confirm', { lang: selectedLang }))) {
      return
    }
    setSeeding(true)
    setSaveMsg('')
    setSaveError(false)
    try {
      const res = await api.post<any>(`/translations/seed?lang=${selectedLang}&force=true`, {})
      setSaveMsg(t('seed_done', `Seed completed: ${res?.inserted || 0} inserted/updated, ${res?.skipped || 0} skipped`))
      loadAllKeys()
      loadAuditData()
    } catch (e: any) {
      setSaveError(true)
      setSaveMsg(e.message || t('seed_error', 'Seed error'))
    } finally {
      setSeeding(false)
    }
  }

  const handleApplyAllDiffs = async () => {
    setShowApplyAllModal(false)
    setApplyingAll(true)
    setSaveMsg('')
    setSaveError(false)
    let applied = 0
    let errors = 0
    for (const ns of diffData) {
      for (const entry of ns.keys) {
        if (entry.json_value && entry.value !== entry.json_value) {
          try {
            await api.put(`/translations/${selectedLang}/${ns.namespace}/key`, {
              key: entry.key,
              value: entry.json_value,
            })
            applied++
          } catch {
            errors++
          }
        }
      }
    }
    setApplyingAll(false)
    if (errors === 0) {
      setSaveMsg(t('apply_all_done', { count: applied }))
    } else {
      setSaveError(true)
      setSaveMsg(t('apply_all_partial', { applied, errors }))
    }
    loadAllKeys()
    loadAuditData()
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
      setSaveError(true)
      setSaveMsg(e.message || t('download_error', 'Error downloading'))
    }
  }

  const handleToggleEnabled = async (lang: any) => {
    try {
      await api.put(`/languages/${lang.code}`, { enabled: !lang.enabled })
      loadLanguages()
    } catch (e: any) {
      setSaveError(true)
      setSaveMsg(e.message || t('save_error', 'Error saving'))
    }
  }

  const handleSetDefault = async (code: string) => {
    try {
      await api.put(`/languages/${code}`, { is_default: true })
      loadLanguages()
    } catch (e: any) {
      setSaveError(true)
      setSaveMsg(e.message || t('save_error', 'Error saving'))
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
      setSaveError(false)
      setSaveMsg(t('language_added', 'Language added'))
    } catch (e: any) {
      setSaveError(true)
      setSaveMsg(e.message || t('save_error', 'Error saving'))
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
      setUploadMsg(t('upload_success', 'File uploaded successfully'))
      loadAllKeys()
      loadAuditData()
    } catch (err: any) {
      setUploadError(true)
      setUploadMsg(err.message || t('upload_error', 'Error uploading file'))
    }
  }

  const handleInstallFederated = async (ft: any) => {
    if (!confirm(t('confirm_apply', 'Apply this translation? It will overwrite your current translations for this language.'))) {
      return
    }
    try {
      await api.post('/translations/federated/install', {
        source_node: ft.source_node,
        language_code: ft.language_code,
      })
      setSaveMsg(t('installed', 'Installed'))
      loadFederatedTranslations()
      loadAllKeys()
      loadAuditData()
    } catch (e: any) {
      setSaveError(true)
      setSaveMsg(e.message || t('save_error', 'Error saving'))
    }
  }

  const toggleNs = (ns: string) => {
    setExpandedNs((prev) => {
      const next = new Set(prev)
      if (next.has(ns)) next.delete(ns)
      else next.add(ns)
      return next
    })
  }

  // Divide las claves: en BD (oficiales) vs diferencias (BD != JSON)
  const { dbData, diffData } = useMemo(() => {
    const db: NSResult[] = []
    const dif: NSResult[] = []
    for (const ns of allKeys) {
      const dbKeys = ns.keys.filter((k) => !k.is_default)
      const diffKeys = ns.keys.filter((k) => !k.is_default && k.json_value && k.value !== k.json_value)
      if (dbKeys.length) db.push({ namespace: ns.namespace, keys: dbKeys })
      if (diffKeys.length) dif.push({ namespace: ns.namespace, keys: diffKeys })
    }
    return { dbData: db, diffData: dif }
  }, [allKeys])

  const activeData = tab === 'db' ? dbData : diffData

  const filteredData = useMemo(() => {
    if (!searchTerm) return activeData
    const term = searchTerm.toLowerCase()
    return activeData
      .map((ns) => ({
        ...ns,
        keys: ns.keys.filter(
          (k) => k.key.toLowerCase().includes(term) || k.value.toLowerCase().includes(term)
        ),
      }))
      .filter((ns) => ns.keys.length > 0)
  }, [activeData, searchTerm])

  const dbCount = dbData.reduce((s, ns) => s + ns.keys.length, 0)
  const diffCount = diffData.reduce((s, ns) => s + ns.keys.length, 0)
  const visibleCount = filteredData.reduce((s, ns) => s + ns.keys.length, 0)

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
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="btn-secondary text-sm py-1 px-3 flex items-center gap-2"
          title={t('seed_tooltip')}
        >
          {seeding ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
          {t('seed_btn')}
        </button>
      </div>

      {/* Ayuda: como funciona el sistema de traducciones */}
      <div className="card p-4 border-l-4 border-blue-400 bg-blue-50">
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="w-full flex items-center justify-between text-left"
        >
          <h2 className="font-semibold flex items-center gap-2 text-blue-800">
            <Info size={18} /> {t('help_title')}
          </h2>
          <span className="text-blue-600 text-sm">{showHelp ? '−' : '+'}</span>
        </button>
        {showHelp && (
          <div className="mt-3 text-sm text-blue-900 space-y-2">
            <p>
              <strong>{t('help_db')}</strong>{' '}
              {t('help_db_desc')}
            </p>
            <p>
              <strong>{t('help_json')}</strong>{' '}
              {t('help_json_desc')}
            </p>
            <p>
              <strong>{t('help_dirty')}</strong>{' '}
              {t('help_dirty_desc')}
            </p>
            <p>
              <strong>{t('help_seed')}</strong>{' '}
              {t('help_seed_desc')}
            </p>
          </div>
        )}
      </div>

      {/* Panel de auditoria */}
      {auditData && auditData.languages.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <CheckCircle size={18} /> {t('audit_title', 'Translation status')}
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
                  {lang.translated} / {lang.total} {t('keys_translated', 'keys translated')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selector de idioma */}
      <div className="card p-4">
        <label className="label flex items-center gap-2 mb-2">
          <Languages size={16} /> {t('select_language', 'Language you are editing')}
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

      {/* Mensaje de estado */}
      {saveMsg && (
        <div className={`flex items-center gap-2 text-sm p-3 rounded-lg border ${
          saveError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          {savingKey ? <Loader2 size={16} className="animate-spin" /> : saveError ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {saveMsg}
        </div>
      )}

      {/* Editor de traducciones */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold flex items-center gap-2">
            <Pencil size={18} /> {t('editor_title', 'Key editor')}
            <span className="text-sm font-normal text-gray-500">
              ({visibleCount} {t('visible', 'visible')})
            </span>
          </h2>
          {dirtyCount > 0 && (
            <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 font-medium">
              {dirtyCount} {t('unsaved_count', 'edited unsaved')}
            </span>
          )}
        </div>

        {/* Pestañas: BD vs Sugeridas */}
        <div className="flex gap-1 mb-4 border-b">
          <button
            onClick={() => setTab('db')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === 'db'
                ? 'border-trueque-600 text-trueque-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Database size={14} className="inline mr-1" />
            {t('tab_db', 'In the database')} ({dbCount})
          </button>
          <button
            onClick={() => setTab('diff')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === 'diff'
                ? 'border-trueque-600 text-trueque-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <AlertCircle size={14} className="inline mr-1" />
            {t('tab_diff', 'Differences (JSON vs DB)')} ({diffCount})
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          {tab === 'db'
            ? t('tab_db_hint', 'These keys are already in the database: they are what is shown in the interface. Edit the text and press Save to apply the change.')
            : t('tab_diff_hint', 'These keys have a different value in the database vs the corrected JSON file. The JSON value is the new/corrected translation. Press "Apply JSON" to update the DB with the corrected value.')}
        </p>

        {/* Barra de busqueda */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('search_keys', 'Search keys or values...')}
            className="input text-sm pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loadingKeys ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-trueque-600" size={24} />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {tab === 'db' ? (
              <>
                <AlertCircle size={32} className="mx-auto mb-2 text-amber-500" />
                <p className="mb-2">{t('no_db_keys', 'No keys in the database for this language.')}</p>
                <p className="text-sm mb-3">{t('no_db_keys_hint', 'Use "Restore translations from JSON" to load them all.')}</p>
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  className="btn-primary text-sm py-1 px-3 flex items-center gap-2 mx-auto"
                >
                  {seeding ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                  {t('seed_btn')}
                </button>
              </>
            ) : (
              <>
                <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                <p className="mb-2">{t('no_diff', 'No differences between the DB and the JSON files.')}</p>
                <p className="text-sm">{t('no_diff_hint', 'All values in the database match the corrected JSON files. Nothing to update.')}</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Boton aplicar todas las diferencias */}
            {tab === 'diff' && diffCount > 0 && (
              <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-sm text-amber-800">
                  {diffCount} {t('diff_count_label', 'keys with differences found. You can apply them all at once or one by one.')}
                </span>
                <button
                  onClick={() => setShowApplyAllModal(true)}
                  disabled={applyingAll}
                  className="btn-primary text-sm py-1.5 px-3 flex items-center gap-2 whitespace-nowrap"
                >
                  {applyingAll ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />}
                  {t('apply_all_diffs', 'Apply all')}
                </button>
              </div>
            )}

            {/* Selector de namespace */}
            <div className="flex flex-wrap gap-1 mb-3">
              <button
                onClick={() => setSelectedNs('')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  selectedNs === '' ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t('all_namespaces', 'All')} ({visibleCount})
              </button>
              {activeData.map((ns) => (
                <button
                  key={ns.namespace}
                  onClick={() => setSelectedNs(selectedNs === ns.namespace ? '' : ns.namespace)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    selectedNs === ns.namespace ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {ns.namespace} ({ns.keys.length})
                </button>
              ))}
            </div>

            {/* Boton agregar clave (solo en pestana BD) */}
            {tab === 'db' && selectedNs && (
              <div className="mb-3">
                {!showAddKey ? (
                  <button
                    onClick={() => setShowAddKey(true)}
                    className="btn-secondary text-xs py-1 px-3 flex items-center gap-1"
                  >
                    <Plus size={14} /> {t('add_key', 'Add new key to DB')}
                  </button>
                ) : (
                  <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t('add_key_to', 'Add key to')}: {selectedNs}</span>
                      <button onClick={() => setShowAddKey(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder={t('key_name', 'Key name')}
                        className="input text-sm"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder={t('key_value', 'Value')}
                        className="input text-sm"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                      />
                    </div>
                    <button
                      onClick={handleAddKey}
                      disabled={!newKey || savingKey === 'new'}
                      className="btn-primary text-xs py-1 px-3 flex items-center gap-1"
                    >
                      {savingKey === 'new' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {t('save_to_db', 'Save to DB')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Lista de claves por namespace */}
            {(selectedNs ? filteredData.filter((ns) => ns.namespace === selectedNs) : filteredData).map((ns) => {
              const isExpanded = expandedNs.has(ns.namespace) || !!selectedNs || !!searchTerm
              return (
                <div key={ns.namespace} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleNs(ns.namespace)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <span className="font-medium text-sm">{ns.namespace}</span>
                    <span className="text-xs text-gray-500">{ns.keys.length} {t('keys', 'keys')}</span>
                  </button>
                  {isExpanded && (
                    <div className="divide-y">
                      {ns.keys.map((entry) => {
                        const editKey = `${ns.namespace}.${entry.key}`
                        const dirty = isDirty(editKey)
                        const isEditingSug = editingSuggested === editKey

                        if (tab === 'diff') {
                          // ---- Fila de clave con DIFERENCIA (BD vs JSON) ----
                          return (
                            <div key={entry.key} className="p-3 space-y-2 bg-red-50/30">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-gray-500 truncate">{entry.key}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                                  {t('badge_diff', 'Different')}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {/* Valor actual en BD */}
                                <div className="border border-red-200 rounded-lg p-2 bg-white">
                                  <div className="text-xs font-semibold text-red-600 mb-1 flex items-center gap-1">
                                    <Database size={12} /> {t('current_db_value', 'Current DB')}
                                  </div>
                                  <p className="text-sm text-gray-700">{entry.value}</p>
                                </div>
                                {/* Valor JSON corregido */}
                                <div className="border border-green-200 rounded-lg p-2 bg-green-50">
                                  <div className="text-xs font-semibold text-green-600 mb-1 flex items-center gap-1">
                                    <CheckCircle size={12} /> {t('json_corrected_value', 'Corrected JSON')}
                                  </div>
                                  <p className="text-sm text-gray-700">{entry.json_value}</p>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleApplySuggested(ns.namespace, { key: entry.key, value: entry.json_value, is_default: false, json_value: entry.json_value })}
                                  disabled={savingKey === editKey}
                                  className="btn-primary text-xs py-1 px-3 flex items-center gap-1 whitespace-nowrap"
                                  title={t('apply_json_tooltip', 'Replace the DB value with the corrected JSON value')}
                                >
                                  {savingKey === editKey ? <Loader2 size={12} className="animate-spin" /> : <ArrowLeft size={12} />}
                                  {t('apply_json', 'Apply JSON')}
                                </button>
                                <button
                                  onClick={() => {
                                    handleEdit(ns.namespace, entry.key, entry.json_value)
                                    setEditingSuggested(editKey)
                                  }}
                                  className="btn-secondary text-xs py-1 px-3 flex items-center gap-1 whitespace-nowrap"
                                  title={t('edit_before_apply', 'Edit the JSON value before applying it')}
                                >
                                  <Pencil size={12} />
                                  {t('edit_btn', 'Edit')}
                                </button>
                              </div>
                              {isEditingSug && (
                                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-start pt-1">
                                  <textarea
                                    className="input text-sm py-1"
                                    value={editingValues[editKey] ?? entry.json_value}
                                    onChange={(e) => handleEdit(ns.namespace, entry.key, e.target.value)}
                                    rows={2}
                                  />
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleSaveKey(ns.namespace, entry.key)}
                                      disabled={savingKey === editKey}
                                      className="btn-primary text-xs py-1 px-2 flex items-center gap-1 whitespace-nowrap"
                                    >
                                      {savingKey === editKey ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                      {t('save_to_db', 'Save to DB')}
                                    </button>
                                    <button
                                      onClick={() => setEditingSuggested(null)}
                                      className="btn-secondary text-xs py-1 px-2"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        }

                        // ---- Fila de clave EN BD (oficial) ----
                        return (
                          <div key={entry.key} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 p-2 items-start">
                            <div className="min-w-0">
                              <span className="text-xs font-mono text-gray-500 block truncate">{entry.key}</span>
                              {dirty ? (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                                  {t('badge_unsaved', 'Edited unsaved')}
                                </span>
                              ) : (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                                  {t('badge_saved', 'In DB')}
                                </span>
                              )}
                            </div>
                            <textarea
                              className={`input text-sm py-1 ${dirty ? 'border-amber-400 bg-amber-50' : ''}`}
                              value={editingValues[editKey] ?? entry.value}
                              onChange={(e) => handleEdit(ns.namespace, entry.key, e.target.value)}
                              rows={1}
                            />
                            <button
                              onClick={() => handleSaveKey(ns.namespace, entry.key)}
                              disabled={savingKey === editKey || !dirty}
                              className={`text-xs py-1 px-2 flex items-center gap-1 whitespace-nowrap ${
                                dirty ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed'
                              }`}
                              title={dirty ? t('save_tooltip', 'Save change to the database') : t('saved_tooltip', 'No changes to save')}
                            >
                              {savingKey === editKey ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                              {t('common:save')}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Gestion de idiomas */}
      <div className="card p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Plus size={18} /> {t('manage_languages', 'Manage languages')}
        </h2>

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
                    {t('disabled', 'disabled')}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload(lang.code)}
                  className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                  title={t('download', 'Download')}
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={() => handleToggleEnabled(lang)}
                  className="btn-secondary text-xs py-1 px-2"
                >
                  {lang.enabled ? t('disable', 'Disable') : t('enable', 'Enable')}
                </button>
                {!lang.is_default && (
                  <button
                    onClick={() => handleSetDefault(lang.code)}
                    className="btn-secondary text-xs py-1 px-2"
                  >
                    {t('set_default', 'Set as default')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-4">
          <h3 className="font-medium text-sm mb-2">{t('add_language', 'Add language')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder={t('language_code', 'Code (e.g. en, pt, fr)')}
              className="input text-sm"
              value={newLangCode}
              onChange={(e) => setNewLangCode(e.target.value)}
            />
            <input
              type="text"
              placeholder={t('language_name', 'Name (e.g. English)')}
              className="input text-sm"
              value={newLangName}
              onChange={(e) => setNewLangName(e.target.value)}
            />
            <input
              type="text"
              placeholder={t('language_native', 'Native name (e.g. English)')}
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
            <Plus size={14} /> {t('add_language', 'Add language')}
          </button>
        </div>

        <div className="border-t pt-4 mt-4">
          <h3 className="font-medium text-sm mb-2 flex items-center gap-1">
            <Upload size={14} /> {t('upload', 'Upload file')}
          </h3>
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
          <Network size={18} /> {t('federation', 'Translations from other nodes')}
        </h2>
        {federatedTranslations.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Network size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t('no_federation_translations', 'No translations available from other nodes')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {federatedTranslations.map((ft: any) => (
              <div key={`${ft.source_node}-${ft.language_code}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium text-sm">{ft.display_name}</span>
                  <span className="text-xs text-gray-500 ml-2">({ft.language_code})</span>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {t('node', 'Node')}: {ft.source_node} · v{ft.version} · {ft.num_keys} keys
                  </div>
                </div>
                <div className="flex gap-2">
                  {!ft.installed ? (
                    <button
                      onClick={() => handleInstallFederated(ft)}
                      className="btn-primary text-xs py-1 px-2 flex items-center gap-1"
                    >
                      <Download size={14} /> {t('download', 'Download')}
                    </button>
                  ) : (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle size={14} /> {t('installed', 'Installed')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal interno: confirmar aplicar todas las diferencias */}
      {showApplyAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowApplyAllModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle size={24} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{t('apply_all_title')}</h3>
                <p className="text-sm text-gray-600">
                  {t('apply_all_confirm', { count: diffCount })}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowApplyAllModal(false)}
                className="btn-secondary text-sm py-2 px-4"
              >
                {t('common:cancel', 'Cancel')}
              </button>
              <button
                onClick={handleApplyAllDiffs}
                className="btn-primary text-sm py-2 px-4 flex items-center gap-2"
              >
                <CheckSquare size={16} />
                {t('apply_all_confirm_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
