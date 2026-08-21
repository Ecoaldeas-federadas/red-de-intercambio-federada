import { useState, useEffect } from 'react'
import { api } from '../api'
import { Server, Globe, Wifi, Download, Plus, Trash2, RefreshCw, Network as NetworkIcon, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

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
  const [status, setStatus] = useState<NetworkStatus | null>(null)
  const [config, setConfig] = useState<NetworkConfigData | null>(null)
  const [peers, setPeers] = useState<IntranetPeer[]>([])
  const [services, setServices] = useState<NetworkService[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [subTab, setSubTab] = useState<'general' | 'peers' | 'services' | 'installer'>('general')

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
      await Promise.all([loadStatus(), loadConfig(), loadPeers(), loadServices()])
    } finally {
      setLoading(false)
    }
  }

  const loadStatus = async () => {
    try {
      const res = await api.get('/api/network/status')
      setStatus(res.data)
    } catch (e) { console.error(e) }
  }

  const loadConfig = async () => {
    try {
      const res = await api.get('/api/network/config')
      setConfig(res.data)
    } catch (e) { console.error(e) }
  }

  const loadPeers = async () => {
    try {
      const res = await api.get('/api/network/peers')
      setPeers(res.data.peers || [])
    } catch (e) { console.error(e) }
  }

  const loadServices = async () => {
    try {
      const res = await api.get('/api/network/services')
      setServices(res.data.services || [])
    } catch (e) { console.error(e) }
  }

  const saveConfig = async () => {
    if (!config) return
    setSaving(true)
    setMsg(null)
    try {
      await api.put('/api/network/config', config)
      setMsg({ type: 'success', text: 'Configuracion guardada' })
      await loadStatus()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }

  const generateULA = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await api.post('/api/network/ula/generate', {})
      if (config) setConfig({ ...config, ipv6_ula: res.data.ipv6_ula })
      setMsg({ type: 'success', text: `Prefijo ULA generado: ${res.data.ipv6_ula}` })
      await loadStatus()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error al generar ULA' })
    } finally {
      setSaving(false)
    }
  }

  const registerOpenWrt = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await api.post('/api/network/register-openwrt', {})
      if (res.data.success) {
        setMsg({ type: 'success', text: res.data.message })
      } else {
        setMsg({ type: 'info', text: res.data.message + (res.data.manual_config ? ` | ${res.data.manual_config}` : '') })
      }
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error al registrar en OpenWrt' })
    } finally {
      setSaving(false)
    }
  }

  const addPeer = async () => {
    if (!newPeer.peer_domain || !newPeer.peer_public_key) {
      setMsg({ type: 'error', text: 'Dominio y clave publica son obligatorios' })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      await api.post('/api/network/peers', newPeer)
      setNewPeer({ peer_domain: '', peer_name: '', peer_ipv6_ula: '', peer_endpoint: '', peer_public_key: '', notes: '' })
      setMsg({ type: 'success', text: 'Peer agregado' })
      await loadPeers()
      await loadStatus()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error al agregar peer' })
    } finally {
      setSaving(false)
    }
  }

  const removePeer = async (domain: string) => {
    if (!confirm(`Eliminar peer ${domain}?`)) return
    try {
      await api.delete(`/api/network/peers/${domain}`)
      setMsg({ type: 'success', text: 'Peer eliminado' })
      await loadPeers()
      await loadStatus()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error al eliminar' })
    }
  }

  const addService = async () => {
    if (!newService.name || !newService.ipv6_address) {
      setMsg({ type: 'error', text: 'Nombre y IPv6 son obligatorios' })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const res = await api.post('/api/network/services', newService)
      setNewService({ name: '', ipv6_address: '', description: '' })
      setMsg({ type: res.data.is_registered ? 'success' : 'info', text: res.data.message })
      await loadServices()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error al registrar servicio' })
    } finally {
      setSaving(false)
    }
  }

  const removeService = async (name: string) => {
    if (!confirm(`Eliminar servicio ${name}?`)) return
    try {
      await api.delete(`/api/network/services/${name}`)
      setMsg({ type: 'success', text: 'Servicio eliminado' })
      await loadServices()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error al eliminar' })
    }
  }

  const generateImage = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await api.post('/api/network/openwrt-image', { for_domain: imageDomain }, { responseType: 'blob' })
      // Descargar archivo
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = imageDomain ? `openwrt-${imageDomain}.tar.gz` : 'openwrt-config.tar.gz'
      a.click()
      window.URL.revokeObjectURL(url)
      setMsg({ type: 'success', text: 'Imagen descargada' })
    } catch (e: any) {
      // Si la respuesta es JSON (no blob), mostrar el mensaje
      if (e.response?.data instanceof Blob) {
        const text = await e.response.data.text()
        try {
          const data = JSON.parse(text)
          setMsg({ type: 'info', text: data.message || 'Configuracion generada (ver datos)' })
        } catch {
          setMsg({ type: 'error', text: 'Error al generar imagen' })
        }
      } else {
        setMsg({ type: 'error', text: e.response?.data?.error || 'Error al generar imagen' })
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card p-4 text-center text-gray-500">Cargando...</div>

  return (
    <div className="space-y-4">
      {/* Estado */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><NetworkIcon size={18} /> Red Privada Federada</h3>
          <button onClick={loadAll} className="text-gray-500 hover:text-gray-700"><RefreshCw size={16} /></button>
        </div>
        {status && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-gray-500 text-xs mb-1">Modo</div>
              <div className="font-medium capitalize">{status.mode}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-gray-500 text-xs mb-1">OpenWrt</div>
              <div className="font-medium flex items-center gap-1">
                {status.has_openwrt ? <><CheckCircle size={14} className="text-green-500" /> Conectado</> : <><XCircle size={14} className="text-gray-400" /> No configurado</>}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-gray-500 text-xs mb-1">IPv6 ULA</div>
              <div className="font-medium text-xs font-mono">{status.ipv6_ula || 'No generado'}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-gray-500 text-xs mb-1">Peers activos</div>
              <div className="font-medium">{status.active_peers}</div>
            </div>
          </div>
        )}
        {!status?.has_openwrt && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-700 flex items-start gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <strong>Funcionando por Internet.</strong> Puedes instalar OpenWrt despues para tener red privada federada entre aldeas.
              El nombre interno del nodo no cambia. OpenWrt solo redirige el subdominio.
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
        <button onClick={() => setSubTab('general')} className={`px-3 py-1.5 rounded-lg text-sm ${subTab === 'general' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>General</button>
        <button onClick={() => setSubTab('peers')} className={`px-3 py-1.5 rounded-lg text-sm ${subTab === 'peers' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Aldeas Federadas</button>
        <button onClick={() => setSubTab('services')} className={`px-3 py-1.5 rounded-lg text-sm ${subTab === 'services' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Servicios Locales</button>
        <button onClick={() => setSubTab('installer')} className={`px-3 py-1.5 rounded-lg text-sm ${subTab === 'installer' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Instalador OpenWrt</button>
      </div>

      {/* General */}
      {subTab === 'general' && config && (
        <div className="card p-4 space-y-4">
          <h3 className="font-semibold">Configuracion de Red</h3>

          <div>
            <label className="block text-sm font-medium mb-1">Modo de red</label>
            <select className="input" value={config.mode} onChange={(e) => setConfig({ ...config, mode: e.target.value })}>
              <option value="internet">Internet (sin OpenWrt)</option>
              <option value="intranet">Intranet (solo red privada)</option>
              <option value="both">Ambos (Internet + intranet)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">El nodo funciona sin OpenWrt. Cambia a "Intranet" cuando OpenWrt este instalado.</p>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">Servidor OpenWrt (opcional)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Direccion de OpenWrt (IP o IPv6)</label>
                <input className="input" placeholder="ej: 192.168.1.1 o [fd12::1]" value={config.openwrt_address} onChange={(e) => setConfig({ ...config, openwrt_address: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Dominio de la aldea (manejado por OpenWrt)</label>
                <input className="input" placeholder="ej: aldea1.com" value={config.openwrt_domain} onChange={(e) => setConfig({ ...config, openwrt_domain: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Subdominio del nodo</label>
                <input className="input" placeholder="nodo" value={config.subdomain} onChange={(e) => setConfig({ ...config, subdomain: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Resultado: {config.subdomain || 'nodo'}.{config.openwrt_domain || 'aldea.com'}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Token API de OpenWrt</label>
                <input className="input" type="password" placeholder="Token de la API de OpenWrt" value={config.openwrt_token} onChange={(e) => setConfig({ ...config, openwrt_token: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">IPv6 ULA</h4>
            <div className="flex gap-2">
              <input className="input font-mono text-sm" placeholder="fdXX:XXXX:XXXX::/48" value={config.ipv6_ula} onChange={(e) => setConfig({ ...config, ipv6_ula: e.target.value })} />
              <button onClick={generateULA} disabled={saving} className="px-3 py-2 bg-trueque-600 text-white rounded-lg text-sm whitespace-nowrap disabled:opacity-50">
                <RefreshCw size={14} className="inline mr-1" />Generar
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Prefijo unico para la aldea. Sin colisiones entre aldeas.</p>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">WireGuard</h4>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Puerto WireGuard</label>
              <input className="input" type="number" value={config.wireguard_port} onChange={(e) => setConfig({ ...config, wireguard_port: parseInt(e.target.value) || 51820 })} />
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t">
            <button onClick={saveConfig} disabled={saving} className="px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            {config.openwrt_address && config.ipv6_ula && (
              <button onClick={registerOpenWrt} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                <Server size={14} className="inline mr-1" />Registrar en OpenWrt
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">El nombre interno del nodo no cambia. OpenWrt solo redirige el subdominio al nodo.</p>
        </div>
      )}

      {/* Peers */}
      {subTab === 'peers' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold mb-3">Aldeas Federadas por Intranet</h3>
            {peers.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay aldeas federadas por intranet.</p>
            ) : (
              <div className="space-y-2">
                {peers.map((p) => (
                  <div key={p.peer_domain} className="border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{p.peer_name || p.peer_domain}</div>
                      <div className="text-xs text-gray-500">{p.peer_domain}</div>
                      {p.peer_ipv6_ula && <div className="text-xs text-gray-400 font-mono">{p.peer_ipv6_ula}</div>}
                      {p.peer_endpoint && <div className="text-xs text-gray-400">{p.peer_endpoint}</div>}
                      <div className="text-xs mt-1">
                        <span className={`px-2 py-0.5 rounded ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                      </div>
                    </div>
                    <button onClick={() => removePeer(p.peer_domain)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus size={18} /> Agregar Aldea Federada</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Dominio de la aldea *</label>
                <input className="input" placeholder="ej: aldea2.com" value={newPeer.peer_domain} onChange={(e) => setNewPeer({ ...newPeer, peer_domain: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre descriptivo</label>
                <input className="input" placeholder="ej: Aldea B" value={newPeer.peer_name} onChange={(e) => setNewPeer({ ...newPeer, peer_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">IPv6 ULA de la aldea</label>
                <input className="input font-mono text-sm" placeholder="fdXX:XXXX:XXXX::/48" value={newPeer.peer_ipv6_ula} onChange={(e) => setNewPeer({ ...newPeer, peer_ipv6_ula: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Endpoint (direccion:puerto)</label>
                <input className="input" placeholder="ej: aldea2.com:51820" value={newPeer.peer_endpoint} onChange={(e) => setNewPeer({ ...newPeer, peer_endpoint: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Clave publica WireGuard *</label>
                <textarea className="input font-mono text-xs" rows={2} placeholder="Clave publica de la aldea remota" value={newPeer.peer_public_key} onChange={(e) => setNewPeer({ ...newPeer, peer_public_key: e.target.value })} />
              </div>
            </div>
            <button onClick={addPeer} disabled={saving} className="mt-3 px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm disabled:opacity-50">
              <Plus size={14} className="inline mr-1" />Agregar
            </button>
          </div>
        </div>
      )}

      {/* Services */}
      {subTab === 'services' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold mb-3">Servicios Locales (DNS de OpenWrt)</h3>
            <p className="text-xs text-gray-500 mb-3">Registra servicios de la aldea en el DNS de OpenWrt. Cada servicio obtiene un subdominio con SSL automatico.</p>
            {services.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay servicios registrados.</p>
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
                          <span className="text-green-600 flex items-center gap-1"><CheckCircle size={12} /> Registrado en OpenWrt</span>
                        ) : (
                          <span className="text-gray-400">No registrado</span>
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
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus size={18} /> Registrar Servicio</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre del servicio *</label>
                <input className="input" placeholder="ej: tienda, voip, video" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Direccion IPv6 *</label>
                <input className="input font-mono text-sm" placeholder="fd12:3456:7890::20" value={newService.ipv6_address} onChange={(e) => setNewService({ ...newService, ipv6_address: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Descripcion</label>
                <input className="input" placeholder="Descripcion del servicio" value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} />
              </div>
            </div>
            <button onClick={addService} disabled={saving} className="mt-3 px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm disabled:opacity-50">
              <Plus size={14} className="inline mr-1" />Registrar
            </button>
          </div>
        </div>
      )}

      {/* Installer */}
      {subTab === 'installer' && (
        <div className="card p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><Download size={18} /> Generar Imagen OpenWrt</h3>

          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
            <p className="mb-2"><strong>Que necesitas:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Mini-PC x86_64 con 2 tarjetas de red (WAN + LAN)</li>
              <li>Conexion a Internet (fibra, cable, ADSL, radioenlace)</li>
              <li>USB o disco para flashear la imagen</li>
              <li>BalenaEtcher o Rufus para flashear</li>
            </ul>
            <p className="mt-2 text-xs">Ver <a href="https://github.com/discapacidad5/red-de-intercambio-federada/tree/main/network/docs/HARDWARE.md" target="_blank" className="underline">hardware recomendado</a></p>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">Imagen para esta aldea</h4>
            <p className="text-xs text-gray-500 mb-2">Genera una imagen OpenWrt con la configuracion actual de esta aldea.</p>
            <button onClick={() => { setImageDomain(''); generateImage(); }} disabled={saving} className="px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm disabled:opacity-50">
              <Download size={14} className="inline mr-1" />{saving ? 'Generando...' : 'Descargar para esta aldea'}
            </button>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">Imagen para nueva aldea (llave en mano)</h4>
            <p className="text-xs text-gray-500 mb-2">Genera una imagen pre-configurada para entregar a otra aldea. Incluye IPv6 ULA y claves WireGuard nuevas, pre-federada con esta aldea.</p>
            <div className="flex gap-2">
              <input className="input" placeholder="ej: aldea2.com" value={imageDomain} onChange={(e) => setImageDomain(e.target.value)} />
              <button onClick={generateImage} disabled={saving || !imageDomain} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm whitespace-nowrap disabled:opacity-50">
                <Download size={14} className="inline mr-1" />{saving ? 'Generando...' : 'Generar'}
              </button>
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">Instrucciones</h4>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
              <li>Descargar la imagen OpenWrt</li>
              <li>Flashear con BalenaEtcher en un USB o disco</li>
              <li>Conectar el servidor de aldea: eth0 a Internet, eth1 a la LAN</li>
              <li>Encender el servidor desde el USB/disco</li>
              <li>La aldea se configura automaticamente</li>
              <li>Instalar el nodo de la aplicacion en otro servidor de la aldea</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
