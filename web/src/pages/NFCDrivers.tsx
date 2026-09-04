import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'

interface DriverInfo {
  id: string
  type: string
  display_name: string
  version: string
  description: string
  manufacturer: string
  capacity: string
  is_active: boolean
  is_builtin: boolean
  signed_by: string
  trust_level: string
  installed_at: string
  shared_with_federation: boolean
  manifest: {
    memory?: { total_bytes: number; user_bytes: number }
    security?: { level: string; algorithm: string }
    protocol?: { slots: number; active_slots: number; backup_slots: number }
    compatibility?: { android: string; ios: string }
  }
}

interface AvailableDriver {
  type: string
  version: string
  display_name: string
  shared_by: string
  signed_by: string
  package_hash: string
  received_at: string
}

interface SigningKey {
  id: string
  label: string
  node_domain: string
  public_key: string
  trust_level: string
  is_active: boolean
  added_at: string
}

type Tab = 'installed' | 'available' | 'keys'

export default function NFCDrivers() {
  const { t } = useTranslation(['nfc', 'common'])
  const [tab, setTab] = useState<Tab>('installed')
  const [drivers, setDrivers] = useState<DriverInfo[]>([])
  const [available, setAvailable] = useState<AvailableDriver[]>([])
  const [keys, setKeys] = useState<SigningKey[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [installing, setInstalling] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [d, a, k] = await Promise.all([
        api.get<DriverInfo[]>('/nfc/drivers'),
        api.get<AvailableDriver[]>('/nfc/drivers/available'),
        api.get<SigningKey[]>('/nfc/drivers/signing-keys'),
      ])
      setDrivers(d || [])
      setAvailable(a || [])
      setKeys(k || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleActivate = async (type: string) => {
    try { await api.post(`/nfc/drivers/${type}/activate`); setMsg(t('driver_activated', 'Driver activado')); loadData() }
    catch (e: any) { setError(e.message) }
  }

  const handleDeactivate = async (type: string) => {
    if (!confirm(`Desactivar driver ${type}? Las tarjetas de este tipo no funcionaran hasta reactivarlo.`)) return
    try { await api.post(`/nfc/drivers/${type}/deactivate`); setMsg(t('driver_deactivated', 'Driver desactivado')); loadData() }
    catch (e: any) { setError(e.message) }
  }

  const handleUninstall = async (type: string) => {
    if (!confirm(`Desinstalar driver ${type}? Esto NO borra las tarjetas ya provisionadas.`)) return
    try { await api.delete(`/nfc/drivers/${type}`); setMsg(t('driver_uninstalled', 'Driver desinstalado')); loadData() }
    catch (e: any) { setError(e.message) }
  }

  const handleShare = async (type: string) => {
    try { await api.post(`/nfc/drivers/${type}/share`); setMsg(t('driver_shared', 'Driver marcado para compartir con federacion')); loadData() }
    catch (e: any) { setError(e.message) }
  }

  const handleInstallFromPeer = async (type: string) => {
    if (!confirm(`Instalar driver ${type} desde nodo federado?`)) return
    setInstalling(true)
    setError('')
    try {
      const result = await api.post<any>(`/nfc/drivers/install-from-peer`, { type })
      setMsg(result.message || t('driver_installed_peer', 'Driver instalado desde peer'))
      loadData()
    } catch (e: any) { setError(e.message) }
    finally { setInstalling(false) }
  }

  const handleRemoveKey = async (id: string) => {
    if (!confirm('Remover esta clave de firma?')) return
    try { await api.delete(`/nfc/drivers/signing-keys/${id}`); setMsg(t('key_removed', 'Clave removida')); loadData() }
    catch (e: any) { setError(e.message) }
  }

  const trustBadge = (level: string) => {
    const styles: Record<string, string> = {
      self: 'bg-green-100 text-green-800',
      federated: 'bg-blue-100 text-blue-800',
      manual: 'bg-purple-100 text-purple-800',
      unknown: 'bg-red-100 text-red-800',
    }
    const labels: Record<string, string> = {
      self: t('trust_self', 'Propio'),
      federated: t('trust_federated', 'Federado'),
      manual: t('trust_manual', 'Manual'),
      unknown: t('trust_unknown', 'Desconocido'),
    }
    return <span className={`px-2 py-1 rounded text-xs font-medium ${styles[level] || styles.unknown}`}>{labels[level] || level}</span>
  }

  if (loading) return <div className="p-8 text-center text-gray-500">{t('loading_drivers', 'Cargando drivers...')}</div>

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">{t('drivers_title', 'Drivers de Tarjetas NFC')}</h1>
      <p className="text-gray-600 text-sm">
        {t('drivers_desc', 'Instala y gestiona drivers para nuevos tipos de tarjetas NFC sin programar.')}
      </p>

      {msg && <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded">{msg}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button onClick={() => setTab('installed')} className={`px-4 py-2 font-medium ${tab === 'installed' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
          {t('tab_installed', 'Instalados ({{count}})', { count: drivers.length })}
        </button>
        <button onClick={() => setTab('available')} className={`px-4 py-2 font-medium ${tab === 'available' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
          {t('tab_available', 'Disponibles ({{count}})', { count: available.length })}
        </button>
        <button onClick={() => setTab('keys')} className={`px-4 py-2 font-medium ${tab === 'keys' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
          {t('tab_keys', 'Claves de Firma ({{count}})', { count: keys.length })}
        </button>
      </div>

      {/* Tab: Installed */}
      {tab === 'installed' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowUpload(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              + {t('upload_driver', 'Subir Driver')}
            </button>
          </div>
          {drivers.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {t('no_drivers', 'No hay drivers instalados. Sube un archivo .nfcpkg para empezar.')}
            </div>
          ) : (
            drivers.map(d => (
              <div key={d.id} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{d.display_name}</h3>
                      <span className="text-sm text-gray-500">v{d.version}</span>
                      {d.is_active ? (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">{t('active_status', 'Activo')}</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{t('inactive_status', 'Inactivo')}</span>
                      )}
                      {d.is_builtin && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">{t('builtin', 'Built-in')}</span>}
                      {trustBadge(d.trust_level)}
                      {d.shared_with_federation && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs">{t('shared', 'Compartido')}</span>}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{d.description}</p>
                    <div className="text-xs text-gray-500 mt-2 flex gap-4 flex-wrap">
                      {d.manifest.memory && <span>Memoria: {d.manifest.memory.user_bytes} bytes</span>}
                      {d.manifest.security && <span>Seguridad: {d.manifest.security.algorithm}</span>}
                      {d.manifest.protocol && <span>Slots: {d.manifest.protocol.slots} ({d.manifest.protocol.active_slots} activos)</span>}
                      {d.manifest.compatibility && <span>Android: {d.manifest.compatibility.android}</span>}
                      <span>Firmado por: {d.signed_by || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {!d.is_active && !d.is_builtin && (
                      <button onClick={() => handleActivate(d.type)} className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700">{t('activate', 'Activar')}</button>
                    )}
                    {d.is_active && !d.is_builtin && (
                      <button onClick={() => handleDeactivate(d.type)} className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600">{t('deactivate_driver', 'Desactivar')}</button>
                    )}
                    {!d.is_builtin && (
                      <>
                        {!d.shared_with_federation && (
                          <button onClick={() => handleShare(d.type)} className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">{t('share', 'Compartir')}</button>
                        )}
                        <button onClick={() => handleUninstall(d.type)} className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">{t('uninstall_driver', 'Desinstalar')}</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Available from peers */}
      {tab === 'available' && (
        <div className="space-y-3">
          {available.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {t('no_available_drivers', 'No hay drivers disponibles de nodos federados. Cuando otros nodos compartan drivers, apareceran aqui.')}
            </div>
          ) : (
            available.map(d => (
              <div key={d.type + d.version} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{d.display_name || d.type}</h3>
                      <span className="text-sm text-gray-500">v{d.version}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {t('shared_by', 'Compartido por:')} <strong>{d.shared_by}</strong> | {t('signed_by', 'Firmado por:')} {d.signed_by}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{t('received', 'Recibido:')} {new Date(d.received_at).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleInstallFromPeer(d.type)}
                      disabled={installing}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {installing ? t('installing_driver', 'Instalando...') : t('install', 'Instalar')}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Signing Keys */}
      {tab === 'keys' && (
        <SigningKeysTab keys={keys} onRemove={handleRemoveKey} onAdded={() => { setMsg(t('key_added', 'Clave agregada')); loadData() }} onError={setError} />
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onInstalled={(m: string) => { setMsg(m); setShowUpload(false); loadData() }}
          onError={setError}
        />
      )}
    </div>
  )
}

// ===== Upload Modal =====
function UploadModal({ onClose, onInstalled, onError }: { onClose: () => void; onInstalled: (msg: string) => void; onError: (e: string) => void }) {
  const { t } = useTranslation(['nfc', 'common'])
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setProgress(t('uploading', 'Subiendo paquete...'))
    onError('')
    try {
      const formData = new FormData()
      formData.append('package', file)
      setProgress(t('installing_driver_server', 'Instalando driver (verificando firma, migrando DB, compilando)...'))
      const result = await api.upload<any>('/nfc/drivers/upload', formData)
      onInstalled(result.message || t('driver_installed', 'Driver instalado correctamente'))
    } catch (e: any) {
      onError(e.message)
    } finally {
      setUploading(false)
      setProgress('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{t('upload_title', 'Subir Driver NFC')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f) }}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400"
        >
          {file ? (
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div className="text-gray-500">
              <p>{t('drag_file', 'Arrastra un archivo .nfcpkg aqui')}</p>
              <p className="text-sm mt-1">{t('or_click', 'o click para seleccionar')}</p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".nfcpkg,.zip"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f) }}
          />
        </div>

        {progress && <div className="mt-3 text-sm text-blue-600">{progress}</div>}

        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">{t('cancel', t('common.cancel'))}</button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? t('installing_driver', 'Instalando...') : t('install_driver_btn', 'Instalar Driver')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ===== Signing Keys Tab =====
function SigningKeysTab({ keys, onRemove, onAdded, onError }: {
  keys: SigningKey[]
  onRemove: (id: string) => void
  onAdded: () => void
  onError: (e: string) => void
}) {
  const { t } = useTranslation(['nfc', 'common'])
  const [showAdd, setShowAdd] = useState(false)
  const [label, setLabel] = useState('')
  const [pubKey, setPubKey] = useState('')
  const [trustLevel, setTrustLevel] = useState('manual')

  const handleAdd = async () => {
    if (!label || !pubKey) { onError(t('label_and_key_required', 'Label y clave publica son obligatorios')); return }
    try {
      await api.post('/nfc/drivers/signing-keys', { label, public_key: pubKey, trust_level: trustLevel })
      setLabel(''); setPubKey(''); setTrustLevel('manual'); setShowAdd(false)
      onAdded()
    } catch (e: any) { onError(e.message) }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + {t('add_key', 'Agregar Clave')}
        </button>
      </div>

      {showAdd && (
        <div className="border rounded-lg p-4 bg-white space-y-3">
          <h3 className="font-semibold">{t('add_key_title', 'Agregar Clave Publica de Firma')}</h3>
          <div>
            <label className="block text-sm font-medium mb-1">{t('key_label', 'Label (nombre descriptivo)')}</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ej: Programador X" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('pub_key', 'Clave Publica (hex, 128 chars)')}</label>
            <textarea value={pubKey} onChange={e => setPubKey(e.target.value)} placeholder="abc123..." rows={3} className="w-full border rounded px-3 py-2 font-mono text-xs" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('trust_level', 'Nivel de Confianza')}</label>
            <select value={trustLevel} onChange={e => setTrustLevel(e.target.value)} className="border rounded px-3 py-2">
              <option value="manual">Manual — agregada por el admin</option>
              <option value="federated">Federado — de un nodo federado</option>
              <option value="self">Self — clave de este nodo</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1 text-gray-600">{t('cancel', t('common.cancel'))}</button>
            <button onClick={handleAdd} className="px-3 py-1 bg-blue-600 text-white rounded">{t('add_btn', 'Agregar')}</button>
          </div>
        </div>
      )}

      {keys.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          {t('no_keys', 'No hay claves de firma configuradas.')}
          <br />{t('no_keys_hint', 'La clave de este nodo se genera automaticamente al instalar el primer driver.')}
        </div>
      ) : (
        keys.map(k => (
          <div key={k.id} className="border rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{k.label}</h3>
                  {k.is_active ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">{t('active_key', 'Activa')}</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{t('inactive_key', 'Inactiva')}</span>
                  )}
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{k.trust_level}</span>
                </div>
                {k.node_domain && <p className="text-sm text-gray-500 mt-1">{t('node_label', 'Nodo:')} {k.node_domain}</p>}
                <p className="text-xs text-gray-400 font-mono mt-1 break-all">{k.public_key.substring(0, 40)}...</p>
                <p className="text-xs text-gray-400 mt-1">{t('added', 'Agregada:')} {new Date(k.added_at).toLocaleString()}</p>
              </div>
              <button onClick={() => onRemove(k.id)} className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">{t('remove', 'Remover')}</button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
