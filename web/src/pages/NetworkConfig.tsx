import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { Server, Globe, Wifi, Download, Plus, Trash2, RefreshCw, Network as NetworkIcon, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react'

interface NetworkStatus {
  mode: string
  has_openwrt: boolean
  ipv6_ula: string
  openwrt_address: string
  openwrt_domain: string
  active_peers: number
  node_domain: string
}

interface NetworkConfigData {
  mode: string
  ipv6_ula: string
  subdomain: string
  openwrt_address: string
  openwrt_domain: string
  openwrt_token: string
  stun_server: string
  wireguard_port: number
}

interface IntranetPeer {
  peer_domain: string
  peer_name?: string
  peer_ipv6_ula?: string
  peer_endpoint?: string
  peer_public_key: string
  status: string
  mutual_verified: boolean
  notes?: string
}

interface NetworkService {
  name: string
  ipv6_address: string
  description?: string
  is_registered: boolean
}

export default function NetworkConfig() {
  const { t } = useTranslation('settings')
  const [status, setStatus] = useState<NetworkStatus | null>(null)
  const [config, setConfig] = useState<NetworkConfigData | null>(null)
  const [peers, setPeers] = useState<IntranetPeer[]>([])
  const [services, setServices] = useState<NetworkService[]>([])
  const [myInfo, setMyInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [subTab, setSubTab] = useState<'general' | 'services' | 'installer' | 'myinfo'>('general')

  // Formularios
  const [newPeer, setNewPeer] = useState({ peer_domain: '', peer_name: '', peer_ipv6_ula: '', peer_endpoint: '', peer_public_key: '', notes: '' })
  const [newService, setNewService] = useState({ name: '', ipv6_address: '', description: '' })
  const [imageDomain, setImageDomain] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      await Promise.all([loadStatus(), loadConfig(), loadPeers(), loadServices(), loadMyInfo()])
    } finally {
      setLoading(false)
    }
  }

  const loadMyInfo = async () => {
    try {
      const res = await api.get('/network/my-info')
      setMyInfo(res)
    } catch (e) { console.error(e) }
  }

  const generateWGKeys = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await api.post('/network/generate-wg-keys', {})
      setMsg({ type: 'success', text: (res as any).message })
      await loadMyInfo()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || t('net_error_generating_keys', 'Error al generar claves') })
    } finally {
      setSaving(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setMsg({ type: 'success', text: t('net_copied', '{{label}} copiado al portapapeles', { label }) })
    }).catch(() => {
      setMsg({ type: 'error', text: t('net_copy_failed', 'No se pudo copiar') })
    })
  }

  const loadStatus = async () => {
    try {
      const res = await api.get<NetworkStatus>('/network/status')
      setStatus(res)
    } catch (e) { console.error(e) }
  }

  const loadConfig = async () => {
    try {
      const res = await api.get<NetworkConfigData>('/network/config')
      setConfig(res)
    } catch (e) { console.error(e) }
  }

  const loadPeers = async () => {
    try {
      const res = await api.get('/network/peers')
      setPeers((res as any).peers || [])
    } catch (e) { console.error(e) }
  }

  const loadServices = async () => {
    try {
      const res = await api.get('/network/services')
      setServices((res as any).services || [])
    } catch (e) { console.error(e) }
  }

  const saveConfig = async () => {
    if (!config) return
    setSaving(true)
    setMsg(null)
    try {
      await api.put('/network/config', config)
      setMsg({ type: 'success', text: t('saved', 'Configuracion guardada') })
      await loadStatus()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || t('error_saving', 'Error al guardar') })
    } finally {
      setSaving(false)
    }
  }

  const generateULA = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await api.post('/network/ula/generate', {})
      if (config) setConfig({ ...config, ipv6_ula: (res as any).ipv6_ula })
      setMsg({ type: 'success', text: t('net_ula_generated', 'Prefijo ULA generado: {{ula}}', { ula: (res as any).ipv6_ula }) })
      await loadStatus()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || t('net_error_generating_ula', 'Error al generar ULA') })
    } finally {
      setSaving(false)
    }
  }

  const registerOpenWrt = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await api.post('/network/register-openwrt', {})
      if ((res as any).success) {
        setMsg({ type: 'success', text: (res as any).message })
      } else {
        setMsg({ type: 'info', text: (res as any).message + ((res as any).manual_config ? ` | ${(res as any).manual_config}` : '') })
      }
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || t('net_error_registering_openwrt', 'Error al registrar en OpenWrt') })
    } finally {
      setSaving(false)
    }
  }

  const addPeer = async () => {
    if (!newPeer.peer_domain || !newPeer.peer_public_key) {
      setMsg({ type: 'error', text: t('net_domain_and_key_required', 'Dominio y clave publica son obligatorios') })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      await api.post('/network/peers', newPeer)
      setNewPeer({ peer_domain: '', peer_name: '', peer_ipv6_ula: '', peer_endpoint: '', peer_public_key: '', notes: '' })
      setMsg({ type: 'success', text: t('net_peer_added', 'Peer agregado') })
      await loadPeers()
      await loadStatus()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || t('net_error_adding_peer', 'Error al agregar peer') })
    } finally {
      setSaving(false)
    }
  }

  const removePeer = async (domain: string) => {
    if (!confirm(t('net_remove_peer_confirm', 'Eliminar peer {{domain}}?', { domain }))) return
    try {
      await api.delete(`/network/peers/${domain}`)
      setMsg({ type: 'success', text: t('net_peer_removed', 'Peer eliminado') })
      await loadPeers()
      await loadStatus()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || t('net_error_removing', 'Error al eliminar') })
    }
  }

  const addService = async () => {
    if (!newService.name || !newService.ipv6_address) {
      setMsg({ type: 'error', text: t('net_name_and_ipv6_required', 'Nombre y IPv6 son obligatorios') })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const res = await api.post('/network/services', newService)
      setNewService({ name: '', ipv6_address: '', description: '' })
      setMsg({ type: (res as any).is_registered ? 'success' : 'info', text: (res as any).message })
      await loadServices()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || t('net_error_registering_service', 'Error al registrar servicio') })
    } finally {
      setSaving(false)
    }
  }

  const removeService = async (name: string) => {
    if (!confirm(t('net_remove_service_confirm', 'Eliminar servicio {{name}}?', { name }))) return
    try {
      await api.delete(`/network/services/${name}`)
      setMsg({ type: 'success', text: t('net_service_removed', 'Servicio eliminado') })
      await loadServices()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || t('net_error_removing', 'Error al eliminar') })
    }
  }

  const generateImage = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await api.post('/network/openwrt-image', { for_domain: imageDomain })
      // Descargar archivo
      const url = window.URL.createObjectURL(new Blob([res as any]))
      const a = document.createElement('a')
      a.href = url
      a.download = imageDomain ? `openwrt-${imageDomain}.tar.gz` : 'openwrt-config.tar.gz'
      a.click()
      window.URL.revokeObjectURL(url)
      setMsg({ type: 'success', text: t('net_image_downloaded', 'Imagen descargada') })
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || t('net_error_generating_image', 'Error al generar imagen') })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card p-4 text-center text-gray-500">{t('net_loading', t('common:loading'))}</div>

  return (
    <div className="space-y-4">
      {/* Estado */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><NetworkIcon size={18} /> {t('net_title', 'Red Privada Federada')}</h3>
          <button onClick={loadAll} className="text-gray-500 hover:text-gray-700"><RefreshCw size={16} /></button>
        </div>
        {status && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-gray-500 text-xs mb-1">{t('net_mode', 'Modo')}</div>
              <div className="font-medium capitalize">{status.mode}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-gray-500 text-xs mb-1">{t('net_openwrt', 'OpenWrt')}</div>
              <div className="font-medium flex items-center gap-1">
                {status.has_openwrt ? <><CheckCircle size={14} className="text-green-500" /> {t('net_connected', 'Conectado')}</> : <><XCircle size={14} className="text-gray-400" /> {t('net_not_configured', 'No configurado')}</>}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-gray-500 text-xs mb-1">{t('net_ipv6_ula', 'IPv6 ULA')}</div>
              <div className="font-medium text-xs font-mono">{status.ipv6_ula || t('net_not_generated', 'No generado')}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-gray-500 text-xs mb-1">{t('net_active_peers', 'Peers activos')}</div>
              <div className="font-medium">{status.active_peers}</div>
            </div>
          </div>
        )}
        {!status?.has_openwrt && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-700 flex items-start gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <strong>{t('net_working_internet', 'Funcionando por Internet.')}</strong> {t('net_working_internet_desc', 'Puedes instalar OpenWrt despues para tener red privada federada entre aldeas. El nombre interno del nodo no cambia. OpenWrt solo redirige el subdominio.')}
            </div>
          </div>
        )}
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700' : msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setSubTab('general')} className={`px-3 py-1.5 rounded-lg text-sm ${subTab === 'general' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('net_subtab_general', 'General')}</button>
        <button onClick={() => setSubTab('myinfo')} className={`px-3 py-1.5 rounded-lg text-sm ${subTab === 'myinfo' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('net_subtab_myinfo', 'Mis Datos de Red')}</button>
        <button onClick={() => setSubTab('services')} className={`px-3 py-1.5 rounded-lg text-sm ${subTab === 'services' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('net_subtab_services', 'Servicios Locales')}</button>
        <button onClick={() => setSubTab('installer')} className={`px-3 py-1.5 rounded-lg text-sm ${subTab === 'installer' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('net_subtab_installer', 'Instalador OpenWrt')}</button>
      </div>

      {/* Mis Datos de Red */}
      {subTab === 'myinfo' && myInfo && (
        <div className="space-y-4">
          {/* Explicacion */}
          <div className="card p-4 bg-blue-50 border-blue-200">
            <h3 className="font-semibold flex items-center gap-2 mb-2">
              <Info size={18} className="text-blue-600" /> {t('net_my_info_title', 'Datos de Red de Este Nodo')}
            </h3>
            <p className="text-sm text-gray-600">
              {t('net_my_info_desc', 'Estos son los datos de red de tu nodo. Sirven para que otras aldeas puedan encontrar este nodo y conocer sus servicios. No es federacion — es el registro de red de tu nodo. Para federar con otra aldea, usa la pestana Federar Aldeas.')}
            </p>
          </div>

          {/* DATOS DE RED POR INTERNET */}
          <div className="card p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <Globe size={18} className="text-green-600" />
              {t('net_internet_address', 'Direccion por Internet')}
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t('net_always_available', 'Siempre disponible')}</span>
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('net_internet_desc', 'Como encontrarte por Internet publico. No necesita OpenWrt.')}
            </p>

            <div className="space-y-3">
              {/* Dominio del nodo */}
              <div className="bg-white p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1">{t('net_domain_or_ip', 'Dominio o IP publica')}</div>
                    <div className="font-mono font-medium text-sm">{myInfo.node_domain || t('net_not_configured', 'No configurado')}</div>
                  </div>
                  {myInfo.node_domain && (
                    <button onClick={() => copyToClipboard(myInfo.node_domain, 'Dominio')} className="text-blue-600 text-xs">{t('net_copy', 'Copiar')}</button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {t('net_domain_or_ip_hint', 'Dominio o IP publica de este nodo. Configuralo en la pestana "General".')}
                </p>
              </div>

              {/* Dominio publico (OpenWrt) */}
              {myInfo.openwrt_domain && (
                <div className="bg-white p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">{t('net_public_domain', 'Dominio publico (OpenWrt)')}</div>
                      <div className="font-mono font-medium text-sm">{myInfo.public_domain}</div>
                    </div>
                    <button onClick={() => copyToClipboard(myInfo.public_domain, 'Dominio publico')} className="text-blue-600 text-xs">{t('net_copy', 'Copiar')}</button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {t('net_public_domain_hint', 'Dominio mas amigable si tienes OpenWrt configurado.')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* DATOS DE RED POR INTRANET (OpenWrt) */}
          <div className="card p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <NetworkIcon size={18} className="text-purple-600" />
              {t('net_intranet_address', 'Direccion por Intranet (OpenWrt)')}
              {!myInfo.ipv6_ula && !myInfo.has_wg_keys && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{t('net_requires_openwrt', 'Requiere OpenWrt')}</span>
              )}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('net_intranet_desc', 'Como encontrarte por la intranet privada entre aldeas usando WireGuard. No usa Internet publico — crea un Internet paralelo entre las aldeas. Solo aplica si tienes OpenWrt instalado.')}
            </p>

            {!myInfo.ipv6_ula && !myInfo.has_wg_keys ? (
              <div className="bg-amber-50 p-3 rounded-lg text-sm text-amber-700">
                <strong>{t('net_no_openwrt', 'No tienes OpenWrt configurado.')}</strong>
                <br /><br />
                {t('net_no_openwrt_hint', 'Si quieres crear una intranet privada entre aldeas (que funcione sin Internet publico), instala OpenWrt usando la pestana "Instalador OpenWrt".')}
              </div>
            ) : (
              <div className="space-y-3">
                {/* IPv6 ULA */}
                <div className="bg-white p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">{t('net_village_ipv6', 'IPv6 ULA de la aldea')}</div>
                      <div className="font-mono font-medium text-sm">{myInfo.ipv6_ula || t('net_not_generated', 'No generado')}</div>
                    </div>
                    {myInfo.ipv6_ula && (
                      <button onClick={() => copyToClipboard(myInfo.ipv6_ula, 'IPv6 ULA')} className="text-blue-600 text-xs">{t('net_copy', 'Copiar')}</button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {t('net_village_ipv6_hint', 'Direccion privada de tu aldea dentro de la intranet.')}
                  </p>
                </div>

                {/* Endpoint WireGuard */}
                <div className="bg-white p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">{t('net_wg_endpoint', 'Endpoint WireGuard')}</div>
                      <div className="font-mono font-medium text-sm">{myInfo.endpoint || t('net_not_configured', 'No configurado')}</div>
                    </div>
                    {myInfo.endpoint && (
                      <button onClick={() => copyToClipboard(myInfo.endpoint, 'Endpoint')} className="text-blue-600 text-xs">{t('net_copy', 'Copiar')}</button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {t('net_wg_endpoint_hint', 'Direccion y puerto donde conectarse por WireGuard dentro de la intranet.')}
                  </p>
                </div>

                {/* Clave publica WireGuard */}
                <div className="bg-white p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">{t('net_wg_pubkey', 'Clave publica WireGuard')}</div>
                      {myInfo.wireguard_public_key ? (
                        <div className="font-mono font-medium text-sm break-all">{myInfo.wireguard_public_key}</div>
                      ) : (
                        <div className="text-amber-600 text-sm">{t('net_wg_not_generated', 'No generada')}</div>
                      )}
                    </div>
                    {myInfo.wireguard_public_key && (
                      <button onClick={() => copyToClipboard(myInfo.wireguard_public_key, 'Clave publica')} className="text-blue-600 text-xs">{t('net_copy', 'Copiar')}</button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {t('net_wg_pubkey_hint', 'Clave para el tunel WireGuard de la intranet.')}
                    {!myInfo.has_wg_keys && t('net_wg_generate_keys_hint', ' Genera las claves con el boton de abajo.')}
                  </p>
                  {!myInfo.has_wg_keys && (
                    <button onClick={generateWGKeys} disabled={saving} className="mt-2 px-3 py-1.5 bg-trueque-600 text-white rounded-lg text-sm disabled:opacity-50">
                      {saving ? t('net_generating_keys', 'Generando...') : t('net_generate_wg_keys', 'Generar claves WireGuard')}
                    </button>
                  )}
                </div>

                {/* Puerto WireGuard */}
                <div className="bg-white p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">{t('net_wg_port', 'Puerto WireGuard')}</div>
                      <div className="font-mono font-medium text-sm">{myInfo.wireguard_port}</div>
                    </div>
                    <button onClick={() => copyToClipboard(String(myInfo.wireguard_port), 'Puerto')} className="text-blue-600 text-xs">{t('net_copy', 'Copiar')}</button>
                  </div>
                </div>

                {/* Resumen Intranet */}
                <div className="mt-4 bg-white p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">{t('net_intranet_summary', 'Resumen para federacion por Intranet')}</h4>
                    <button
                      onClick={() => copyToClipboard(
                        `Datos de mi aldea para federacion por Intranet (OpenWrt):
- Dominio intranet: ${myInfo.public_domain || myInfo.node_domain}
- IPv6 ULA: ${myInfo.ipv6_ula || 'No generado'}
- Endpoint WireGuard: ${myInfo.endpoint || 'No configurado'}
- Clave publica WireGuard: ${myInfo.wireguard_public_key || 'No generada'}
- Puerto WireGuard: ${myInfo.wireguard_port}`,
                        'Resumen Intranet'
                      )}
                      className="text-blue-600 text-xs"
                    >
                      {t('net_copy', 'Copiar')}
                    </button>
                  </div>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{`Dominio intranet: ${myInfo.public_domain || myInfo.node_domain}
IPv6 ULA: ${myInfo.ipv6_ula || 'No generado'}
Endpoint WireGuard: ${myInfo.endpoint || 'No configurado'}
Clave publica WireGuard: ${myInfo.wireguard_public_key || 'No generada'}
Puerto WireGuard: ${myInfo.wireguard_port}`}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Nota: para federar, usar la pestana Federar Aldeas */}
          <div className="card p-4 bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-700">
              {t('net_federate_hint', 'Para federar con otra aldea: Usa la pestana "Federar Aldeas" en el menu de Federacion. Ahi podras agregar los datos de la otra aldea (dominio, IPv6 ULA, WireGuard) para establecer la federacion.')}
            </p>
          </div>
        </div>
      )}

      {/* General */}
      {subTab === 'general' && config && (
        <div className="card p-4 space-y-4">
          <h3 className="font-semibold">{t('net_config_title', 'Configuracion de Red')}</h3>

          <div>
            <label className="block text-sm font-medium mb-1">{t('net_mode_label', 'Modo de red')}</label>
            <select className="input" value={config.mode} onChange={(e) => setConfig({ ...config, mode: e.target.value })}>
              <option value="internet">{t('net_mode_internet', 'Internet (sin OpenWrt)')}</option>
              <option value="intranet">{t('net_mode_intranet', 'Intranet (solo red privada)')}</option>
              <option value="both">{t('net_mode_both', 'Ambos (Internet + intranet)')}</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('net_mode_hint', 'El nodo funciona sin OpenWrt. Cambia a "Intranet" cuando OpenWrt este instalado.')}</p>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">{t('net_openwrt_server', 'Servidor OpenWrt (opcional)')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('net_openwrt_address', 'Direccion de OpenWrt (IP o IPv6)')}</label>
                <input className="input" placeholder="ej: 192.168.1.1 o [fd12::1]" value={config.openwrt_address} onChange={(e) => setConfig({ ...config, openwrt_address: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('net_openwrt_domain', 'Dominio de la aldea (manejado por OpenWrt)')}</label>
                <input className="input" placeholder="ej: aldea1.com" value={config.openwrt_domain} onChange={(e) => setConfig({ ...config, openwrt_domain: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('net_subdomain', 'Subdominio del nodo')}</label>
                <input className="input" placeholder="nodo" value={config.subdomain} onChange={(e) => setConfig({ ...config, subdomain: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">{t('net_result_label', 'Resultado:')} {config.subdomain || 'nodo'}.{config.openwrt_domain || 'aldea.com'}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('net_openwrt_token', 'Token API de OpenWrt')}</label>
                <input className="input" type="password" placeholder="Token de la API de OpenWrt" value={config.openwrt_token} onChange={(e) => setConfig({ ...config, openwrt_token: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">{t('net_ipv6_ula', 'IPv6 ULA')}</h4>
            <div className="flex gap-2">
              <input className="input font-mono text-sm" placeholder="fdXX:XXXX:XXXX::/48" value={config.ipv6_ula} onChange={(e) => setConfig({ ...config, ipv6_ula: e.target.value })} />
              <button onClick={generateULA} disabled={saving} className="px-3 py-2 bg-trueque-600 text-white rounded-lg text-sm whitespace-nowrap disabled:opacity-50">
                <RefreshCw size={14} className="inline mr-1" />{t('net_generate', 'Generar')}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">{t('net_ula_hint', 'Prefijo unico para la aldea. Sin colisiones entre aldeas.')}</p>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">{t('net_wg_section', 'WireGuard')}</h4>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('net_wg_port_label', 'Puerto WireGuard')}</label>
              <input className="input" type="number" value={config.wireguard_port} onChange={(e) => setConfig({ ...config, wireguard_port: parseInt(e.target.value) || 51820 })} />
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t">
            <button onClick={saveConfig} disabled={saving} className="px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm disabled:opacity-50">
              {saving ? t('saving', t('common:loading')) : t('save', t('common:save'))}
            </button>
            {config.openwrt_address && config.ipv6_ula && (
              <button onClick={registerOpenWrt} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                <Server size={14} className="inline mr-1" />{t('net_register_openwrt', 'Registrar en OpenWrt')}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">{t('net_openwrt_hint', 'El nombre interno del nodo no cambia. OpenWrt solo redirige el subdominio al nodo.')}</p>
        </div>
      )}

      {/* Services */}
      {subTab === 'services' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold mb-3">{t('net_services_title', 'Servicios Locales (DNS de OpenWrt)')}</h3>
            <p className="text-xs text-gray-500 mb-3">{t('net_services_desc', 'Registra servicios de la aldea en el DNS de OpenWrt. Cada servicio obtiene un subdominio con SSL automatico.')}</p>
            {services.length === 0 ? (
              <p className="text-gray-500 text-sm">{t('net_no_services', 'No hay servicios registrados.')}</p>
            ) : (
              <div className="space-y-2">
                {services.map((s) => (
                  <div key={s.name} className="border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{s.name}.{status?.openwrt_domain || 'aldea.com'}</div>
                      <div className="text-xs text-gray-400 font-mono">{s.ipv6_address}</div>
                      {s.description && <div className="text-xs text-gray-500">{s.description}</div>}
                      <div className="text-xs mt-1">
                        {s.is_registered ? (
                          <span className="text-green-600 flex items-center gap-1"><CheckCircle size={12} /> {t('net_registered_openwrt', 'Registrado en OpenWrt')}</span>
                        ) : (
                          <span className="text-gray-400">{t('net_not_registered', 'No registrado')}</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => removeService(s.name)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus size={18} /> {t('net_register_service', 'Registrar Servicio')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('net_service_name', 'Service name *')}</label>
                <input className="input" placeholder={t('net_service_name_ph', 'e.g: store, voip, video')} value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('net_service_ipv6', 'IPv6 address *')}</label>
                <input className="input font-mono text-sm" placeholder="fd12:3456:7890::20" value={newService.ipv6_address} onChange={(e) => setNewService({ ...newService, ipv6_address: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">{t('net_service_desc', 'Description')}</label>
                <input className="input" placeholder={t('net_service_desc_ph', 'Service description')} value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} />
              </div>
            </div>
            <button onClick={addService} disabled={saving} className="mt-3 px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm disabled:opacity-50">
              <Plus size={14} className="inline mr-1" />{t('net_register_btn', 'Register')}
            </button>
          </div>
        </div>
      )}

      {/* Installer */}
      {subTab === 'installer' && (
        <div className="card p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><Download size={18} /> {t('net_image_title', 'Generate OpenWrt Image')}</h3>

          {/* De donde obtener los datos */}
          <div className="bg-blue-50 p-3 rounded-lg text-sm">
            <p className="font-medium text-blue-700 mb-2">{t('net_image_data_source', 'Where to get OpenWrt data:')}</p>
            <ul className="space-y-2 text-xs text-gray-700">
              <li><strong>{t('net_image_openwrt_address', 'OpenWrt address:')}</strong> {t('net_image_openwrt_addr_desc', 'This is the IP address of the OpenWrt server on your LAN. Default:')}
                <code className="bg-white px-1 rounded">192.168.1.1</code>.
                {t('net_image_openwrt_addr_find', 'You can find it in the OpenWrt panel under')} <em>Network → Interfaces</em>.</li>
              <li><strong>{t('net_image_openwrt_domain', 'Village domain:')}</strong> {t('net_image_openwrt_dom_desc', 'This is the domain you configure in OpenWrt')}
                ({t('net_image_openwrt_dom_eg', 'e.g:')} <code className="bg-white px-1 rounded">village1.com</code>).
                {t('net_image_openwrt_dom_cfg', 'Configure it in')} <em>System → Hostname</em> {t('net_image_openwrt_dom_or', 'or in the OpenWrt DNS')}.</li>
              <li><strong>{t('net_image_openwrt_token', 'OpenWrt API token:')}</strong> {t('net_image_openwrt_token_desc', 'Get it from the OpenWrt panel in')}
                <em> System → Administration → API Token</em>.
                {t('net_image_openwrt_token_opt', 'If you can\'t find it, you can leave it empty and configure it later')}.</li>
              <li><strong>{t('net_image_ipv6_ula', 'IPv6 ULA:')}</strong> {t('net_image_ipv6_ula_desc', 'Generated automatically with the')}
                <strong> "{t('net_generate', 'Generate')}"</strong> {t('net_image_ipv6_ula_btn', 'button below. You don\'t need to look for it anywhere')}.</li>
              <li><strong>{t('net_image_wg_keys', 'WireGuard keys:')}</strong> {t('net_image_wg_keys_desc', 'Generated automatically with the')}
                <strong> "{t('net_generate_wg_keys', 'Generate WireGuard keys')}"</strong> {t('net_image_wg_keys_tab', 'button in the')} "{t('net_my_network_data', 'My Network Data')}" {t('net_image_wg_keys_tab2', 'tab')}.</li>
              <li><strong>{t('net_image_wg_port', 'WireGuard port:')}</strong> {t('net_image_wg_port_def', 'Default')} <code className="bg-white px-1 rounded">51820</code>.
                {t('net_image_wg_port_change', 'Change it only if you have another service on that port')}.</li>
            </ul>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
            <p className="mb-2"><strong>{t('net_image_what_you_need', 'What you need:')}</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>{t('net_image_need_mini_pc', 'Mini-PC x86_64 with 2 network cards (WAN + LAN)')}</li>
              <li>{t('net_image_need_internet', 'Internet connection (fiber, cable, ADSL, radio link)')}</li>
              <li>{t('net_image_need_usb', 'USB or disk to flash the image')}</li>
              <li>{t('net_image_need_flasher', 'BalenaEtcher or Rufus to flash')}</li>
            </ul>
            <p className="mt-2 text-xs">{t('net_image_see', 'See')} <a href="https://github.com/discapacidad5/red-de-intercambio-federada/tree/main/network/docs/EQUIPAMENTO.md" target="_blank" className="underline">{t('net_image_recommended_equipment', 'recommended equipment')}</a></p>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">{t('net_image_for_village', 'Image for this village')}</h4>
            <p className="text-xs text-gray-500 mb-2">{t('net_image_for_village_desc', 'Generate an OpenWrt image with the current configuration of this village.')}</p>
            <button onClick={() => { setImageDomain(''); generateImage(); }} disabled={saving} className="px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm disabled:opacity-50">
              <Download size={14} className="inline mr-1" />{saving ? t('net_generating', 'Generating...') : t('net_download', 'Download for this village')}
            </button>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">{t('net_image_new_village', 'Image for new village (turnkey)')}</h4>
            <p className="text-xs text-gray-500 mb-2">{t('net_image_new_village_desc', 'Generate a pre-configured image to deliver to another village. Includes new IPv6 ULA and WireGuard keys, pre-federated with this village.')}</p>
            <div className="flex gap-2">
              <input className="input" placeholder={t('net_image_new_village_ph', 'e.g: village2.com')} value={imageDomain} onChange={(e) => setImageDomain(e.target.value)} />
              <button onClick={generateImage} disabled={saving || !imageDomain} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm whitespace-nowrap disabled:opacity-50">
                <Download size={14} className="inline mr-1" />{saving ? t('net_generating', 'Generating...') : t('net_generate_btn', 'Generate')}
              </button>
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">{t('net_instructions', 'Instructions')}</h4>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
              <li>{t('net_inst_download', 'Download the OpenWrt image')}</li>
              <li>{t('net_inst_flash', 'Flash with BalenaEtcher onto a USB or disk')}</li>
              <li>{t('net_inst_connect', 'Connect the village server: eth0 to Internet, eth1 to LAN')}</li>
              <li>{t('net_inst_power', 'Power on the server from the USB/disk')}</li>
              <li>{t('net_inst_auto', 'The village configures automatically')}</li>
              <li>{t('net_inst_install_node', 'Install the application node on another server in the village')}</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
