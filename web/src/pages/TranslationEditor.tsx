import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { Languages, Download, Upload, CheckCircle, AlertCircle, Loader2, Save, Plus, Network, Search, Database, Edit3, X } from 'lucide-react'

type KeyEntry = {
  key: string
  value: string
  is_default: boolean
}

type NSResult = {
  namespace: string
  keys: KeyEntry[]
}

export default function TranslationEditor() {
  const { t } = useTranslation(['translations', 'common'])
  const [languages, setLanguages] = useState<any[]>([])
  const [selectedLang, setSelectedLang] = useState('en')
  const [allKeys, setAllKeys] = useState<NSResult[]>([])
  const [federatedTranslations, setFederatedTranslations] = useState<any[]>([])
  const [auditData, setAuditData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [editingValues, setEditingValues] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState('')
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
    } catch {
      setAllKeys([])
    } finally {
      setLoadingKeys(false)
    }
  }

  const handleEdit = (ns: string, key: string, value: string) => {
    setEditingValues((prev) => ({ ...prev, [`${ns}.${key}`]: value }))
  }

  const handleSaveKey = async (ns: string, key: string) => {
    const value = editingValues[`${ns}.${key}`]
    if (value === undefined) return
    setSavingKey(`${ns}.${key}`)
    setSaveMsg('')
    try {
      await api.put(`/translations/${selectedLang}/${ns}/key`, { key, value })
      setSaveMsg(t('key_saved', 'Clave guardada'))
      setAllKeys(prev => prev.map(nsData =>
        nsData.namespace === ns
          ? { ...nsData, keys: nsData.keys.map(k => k.key === key ? { ...k, value, is_default: false } : k) }
          : nsData
      ))
      loadAuditData()
    } catch (e: any) {
      setSaveMsg(e.message || t('save_error', 'Error al guardar'))
    } finally {
      setSavingKey(null)
    }
  }

  const handleAddKey = async () => {
    if (!newKey || !selectedNs) return
    setSavingKey('new')
    try {
      await api.post(`/translations/${selectedLang}/${selectedNs}/key`, { key: newKey, value: newValue })
      setSaveMsg(t('key_added', 'Clave agregada'))
      setNewKey('')
      setNewValue('')
      setShowAddKey(false)
      loadAllKeys()
      loadAuditData()
    } catch (e: any) {
      setSaveMsg(e.message || t('save_error', 'Error al agregar'))
    } finally {
      setSavingKey(null)
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    setSaveMsg('')
    try {
      const res = await api.post<any>('/translations/seed', {})
      setSaveMsg(t('seed_done', `Seed completado: ${res?.inserted || 0} insertadas, ${res?.skipped || 0} omitidas`))
      loadAllKeys()
      loadAuditData()
    } catch (e: any) {
      setSaveMsg(e.message || t('seed_error', 'Error en seed'))
    } finally {
      setSeeding(false)
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
      loadAllKeys()
      loadAuditData()
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
      loadAllKeys()
      loadAuditData()
    } catch (e: any) {
      setSaveMsg(e.message || t('save_error', 'Error al guardar'))
    }
  }

  const toggleNs = (ns: string) => {
    setExpandedNs(prev => {
      const next = new Set(prev)
      if (next.has(ns)) next.delete(ns)
      else next.add(ns)
      return next
    })
  }

  const filteredData = useMemo(() => {
    if (!searchTerm) return allKeys
    const term = searchTerm.toLowerCase()
    return allKeys.map(ns => ({
      ...ns,
      keys: ns.keys.filter(k =>
        k.key.toLowerCase().includes(term) ||
        k.value.toLowerCase().includes(term)
      ),
    })).filter(ns => ns.keys.length > 0)
  }, [allKeys, searchTerm])

  const totalKeys = allKeys.reduce((sum, ns) => sum + ns.keys.length, 0)
  const defaultKeys = allKeys.reduce((sum, ns) => sum + ns.keys.filter(k => k.is_default).length, 0)
  const overrideKeys = totalKeys - defaultKeys

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
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="btn-secondary text-sm py-1 px-3 flex items-center gap-2"
          title={t('seed_tooltip', 'Cargar todas las claves de los JSON a la base de datos')}
        >
          {seeding ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
          {t('seed_btn', 'Cargar claves a BD')}
        </button>
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

      {/* Mensaje de guardado */}
      {saveMsg && (
        <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
          {savingKey ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
          {saveMsg}
        </div>
      )}

      {/* Editor de traducciones - TODAS las claves */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Edit3 size={18} /> {t('all_keys', 'Todas las claves')}
            <span className="text-sm font-normal text-gray-500">
              ({totalKeys} {t('total', 'total')})
            </span>
          </h2>
        </div>

        {/* Barra de busqueda */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('search_keys', 'Buscar claves o valores...')}
            className="input text-sm pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loadingKeys ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-trueque-600" size={24} />
          </div>
        ) : filteredData.length === 0 || totalKeys === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <AlertCircle size={32} className="mx-auto mb-2 text-amber-500" />
            <p className="mb-2">{t('no_keys', 'No hay claves cargadas.')}</p>
            <p className="text-sm mb-3">{t('seed_hint', 'Haz clic en "Cargar claves a BD" para importar todas las claves de los archivos JSON a la base de datos.')}</p>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="btn-primary text-sm py-1 px-3 flex items-center gap-2 mx-auto"
            >
              {seeding ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
              {t('seed_btn', 'Cargar claves a BD')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Selector de namespace */}
            <div className="flex flex-wrap gap-1 mb-3">
              <button
                onClick={() => setSelectedNs('')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  selectedNs === '' ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t('all_namespaces', 'Todos')} ({totalKeys})
              </button>
              {allKeys.map(ns => {
                const count = ns.keys.length
                if (count === 0) return null
                return (
                  <button
                    key={ns.namespace}
                    onClick={() => setSelectedNs(selectedNs === ns.namespace ? '' : ns.namespace)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                      selectedNs === ns.namespace ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {ns.namespace} ({count})
                  </button>
                )
              })}
            </div>

            {/* Boton agregar clave */}
            {selectedNs && (
              <div className="mb-3">
                {!showAddKey ? (
                  <button
                    onClick={() => setShowAddKey(true)}
                    className="btn-secondary text-xs py-1 px-3 flex items-center gap-1"
                  >
                    <Plus size={14} /> {t('add_key', 'Agregar clave')}
                  </button>
                ) : (
                  <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t('add_key_to', 'Agregar clave a')}: {selectedNs}</span>
                      <button onClick={() => setShowAddKey(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder={t('key_name', 'Nombre de la clave')}
                        className="input text-sm"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder={t('key_value', 'Valor')}
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
                      {t('common:save')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Lista de claves por namespace */}
            {(selectedNs ? filteredData.filter(ns => ns.namespace === selectedNs) : filteredData).map(ns => {
              const isExpanded = expandedNs.has(ns.namespace) || !!selectedNs || !!searchTerm
              return (
                <div key={ns.namespace} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleNs(ns.namespace)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <span className="font-medium text-sm">{ns.namespace}</span>
                    <span className="text-xs text-gray-500">{ns.keys.length} {t('keys', 'claves')}</span>
                  </button>
                  {isExpanded && (
                    <div className="divide-y">
                      {ns.keys.map((entry) => {
                        const editKey = `${ns.namespace}.${entry.key}`
                        return (
                          <div key={entry.key} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 p-2 items-start">
                            <div className="min-w-0">
                              <span className="text-xs font-mono text-gray-500 block truncate">{entry.key}</span>
                              {entry.is_default ? (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">JSON</span>
                              ) : (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">BD</span>
                              )}
                            </div>
                            <textarea
                              className="input text-sm py-1"
                              value={editingValues[editKey] ?? entry.value}
                              onChange={(e) => handleEdit(ns.namespace, entry.key, e.target.value)}
                              rows={1}
                            />
                            <button
                              onClick={() => handleSaveKey(ns.namespace, entry.key)}
                              disabled={savingKey === editKey}
                              className="btn-primary text-xs py-1 px-2 flex items-center gap-1 whitespace-nowrap"
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
          <Plus size={18} /> {t('manage_languages', 'Gestionar idiomas')}
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