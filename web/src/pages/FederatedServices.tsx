import { useState, useEffect } from 'react'
import { api } from '../api'
import { Video, MessageCircle, Image as ImageIcon, Users, MessageSquare, BookOpen, PenTool, Calendar, Phone, Mic, Cloud, FileText, BookMarked, Globe, Film, Music, GitBranch, GraduationCap, Home, Lock, Download, Play, Square, Trash2, RefreshCw, Search, Server, AlertTriangle, CheckCircle, XCircle, Loader, Phone as PhoneIcon } from 'lucide-react'

interface ServiceItem {
  id: string
  name: string
  category: string
  icon: string
  what_is: string
  replaces: string
  used_for: string
  protocol: string
  docker: boolean
  min_ram_mb: number
  min_disk_gb: number
  default_port: number
  subdomain: string
  status: string
}

interface VoIPConfig {
  village_code: number
  village_name?: string
  enabled: boolean
  server_port: number
  rtp_start: number
  rtp_end: number
  node_domain: string
}

interface VoIPExtension {
  extension: string
  display_name?: string
  user_id?: string
  is_active: boolean
}

interface VoIPRoute {
  remote_village_code: number
  remote_village_name?: string
  remote_endpoint?: string
  remote_domain?: string
  is_active: boolean
}

const iconMap: Record<string, any> = {
  Video, MessageCircle, Image: ImageIcon, Users, MessageSquare, BookOpen, PenTool, Calendar,
  Phone, Mic, Cloud, FileText, BookMarked, Globe, Film, Music, GitBranch, GraduationCap, Home, Lock,
}

const categoryLabels: Record<string, string> = {
  social: 'Redes Sociales',
  comunicacion: 'Comunicacion',
  productividad: 'Productividad',
  multimedia: 'Multimedia',
  desarrollo: 'Desarrollo y Otros',
}

const categoryColors: Record<string, string> = {
  social: 'bg-purple-100 text-purple-700',
  comunicacion: 'bg-blue-100 text-blue-700',
  productividad: 'bg-green-100 text-green-700',
  multimedia: 'bg-orange-100 text-orange-700',
  desarrollo: 'bg-gray-100 text-gray-700',
}

export default function FederatedServices() {
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null)
  const [installing, setInstalling] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [showVoIP, setShowVoIP] = useState(false)

  useEffect(() => {
    loadServices()
  }, [])

  const loadServices = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/services/catalog')
      setServices(res.data.services || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filtered = services.filter(s => {
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.replaces.toLowerCase().includes(search.toLowerCase()) ||
      s.what_is.toLowerCase().includes(search.toLowerCase())
    const matchCategory = categoryFilter === 'all' || s.category === categoryFilter
    return matchSearch && matchCategory
  })

  const installService = async (svc: ServiceItem) => {
    setInstalling(true)
    setMsg(null)
    try {
      const res = await api.post(`/api/services/${svc.id}/install`, {})
      if (res.data.success) {
        setMsg({ type: 'success', text: res.data.message })
      } else {
        setMsg({ type: 'info', text: res.data.message })
      }
      await loadServices()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error al instalar' })
    } finally {
      setInstalling(false)
    }
  }

  const uninstallService = async (svc: ServiceItem) => {
    if (!confirm(`Desinstalar ${svc.name}?`)) return
    try {
      await api.post(`/api/services/${svc.id}/uninstall`, {})
      setMsg({ type: 'success', text: `${svc.name} desinstalado` })
      await loadServices()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error al desinstalar' })
    }
  }

  const startService = async (svc: ServiceItem) => {
    try {
      await api.post(`/api/services/${svc.id}/start`, {})
      setMsg({ type: 'success', text: `${svc.name} iniciado` })
      await loadServices()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error al iniciar' })
    }
  }

  const stopService = async (svc: ServiceItem) => {
    try {
      await api.post(`/api/services/${svc.id}/stop`, {})
      setMsg({ type: 'success', text: `${svc.name} detenido` })
      await loadServices()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error al detener' })
    }
  }

  const downloadService = async (svc: ServiceItem) => {
    try {
      const res = await api.get(`/api/services/${svc.id}/download`)
      const content = `# docker-compose.yml\n${res.data.docker_compose}\n\n---\n# README.md\n${res.data.readme}`
      const blob = new Blob([content], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${svc.id}-docker-compose.txt`
      a.click()
      window.URL.revokeObjectURL(url)
      setMsg({ type: 'success', text: `Descarga de ${svc.name} generada` })
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error al descargar' })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <><CheckCircle size={14} className="text-green-500" /> Corriendo</>
      case 'installing': return <><Loader size={14} className="text-blue-500 animate-spin" /> Instalando</>
      case 'stopped': return <><Square size={14} className="text-gray-400" /> Detenido</>
      case 'error': return <><XCircle size={14} className="text-red-500" /> Error</>
      default: return <><Server size={14} className="text-gray-400" /> No instalado</>
    }
  }

  if (loading) return <div className="flex items-center justify-center py-8 text-gray-500"><Loader className="animate-spin mr-2" size={20} /> Cargando catalogo...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Servicios Federados</h1>
          <p className="text-gray-500 text-sm mt-1">Reemplaza servicios comerciales con alternativas autohospedadas y federadas</p>
        </div>
        <button onClick={() => setShowVoIP(!showVoIP)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2">
          <PhoneIcon size={16} /> Telefonía VoIP
        </button>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700' : msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
          {msg.text}
        </div>
      )}

      {showVoIP && <VoIPPanel />}

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-10"
            placeholder="Buscar servicio o que reemplaza..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input max-w-[200px]" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">Todas las categorias</option>
          <option value="social">Redes Sociales</option>
          <option value="comunicacion">Comunicacion</option>
          <option value="productividad">Productividad</option>
          <option value="multimedia">Multimedia</option>
          <option value="desarrollo">Desarrollo y Otros</option>
        </select>
      </div>

      {/* Catalogo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((svc) => {
          const Icon = iconMap[svc.icon] || Server
          const isInstalled = svc.status === 'running' || svc.status === 'stopped' || svc.status === 'error'
          const isRunning = svc.status === 'running'
          return (
            <div key={svc.id} className="card p-4 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${categoryColors[svc.category] || 'bg-gray-100'}`}>
                    <Icon size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{svc.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${categoryColors[svc.category] || 'bg-gray-100 text-gray-600'}`}>
                      {categoryLabels[svc.category] || svc.category}
                    </span>
                  </div>
                </div>
                <div className="text-xs flex items-center gap-1">
                  {getStatusIcon(svc.status)}
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-2 line-clamp-3">{svc.what_is}</p>

              <div className="text-xs text-gray-500 mb-2">
                <strong>Reemplaza:</strong> {svc.replaces}
              </div>

              <div className="text-xs text-gray-400 mb-3 flex gap-3">
                <span>RAM: {svc.min_ram_mb >= 1024 ? `${svc.min_ram_mb / 1024}GB` : `${svc.min_ram_mb}MB`}</span>
                <span>Disco: {svc.min_disk_gb}GB</span>
                <span>Puerto: {svc.default_port}</span>
              </div>

              <div className="mt-auto flex gap-2 flex-wrap">
                {!isInstalled && (
                  <button
                    onClick={() => installService(svc)}
                    disabled={installing}
                    className="px-3 py-1.5 bg-trueque-600 text-white rounded-lg text-xs disabled:opacity-50 flex items-center gap-1"
                  >
                    <Download size={12} /> Instalar
                  </button>
                )}
                {isInstalled && isRunning && (
                  <button
                    onClick={() => stopService(svc)}
                    className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-xs flex items-center gap-1"
                  >
                    <Square size={12} /> Detener
                  </button>
                )}
                {isInstalled && !isRunning && (
                  <button
                    onClick={() => startService(svc)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs flex items-center gap-1"
                  >
                    <Play size={12} /> Iniciar
                  </button>
                )}
                <button
                  onClick={() => downloadService(svc)}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs flex items-center gap-1"
                >
                  <Download size={12} /> Descargar
                </button>
                <button
                  onClick={() => setSelectedService(svc)}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs"
                >
                  Detalles
                </button>
                {isInstalled && (
                  <button
                    onClick={() => uninstallService(svc)}
                    className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No se encontraron servicios. Intenta con otra busqueda.
        </div>
      )}

      {/* Modal de detalles */}
      {selectedService && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedService(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = iconMap[selectedService.icon] || Server
                  return <div className={`p-3 rounded-lg ${categoryColors[selectedService.category] || 'bg-gray-100'}`}><Icon size={32} /></div>
                })()}
                <div>
                  <h2 className="text-xl font-bold">{selectedService.name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded ${categoryColors[selectedService.category] || 'bg-gray-100 text-gray-600'}`}>
                    {categoryLabels[selectedService.category] || selectedService.category}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedService(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-1">Que es</h3>
                <p className="text-sm text-gray-600">{selectedService.what_is}</p>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-1">Que reemplaza</h3>
                <p className="text-sm text-gray-600">{selectedService.replaces}</p>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-1">Para que sirve</h3>
                <p className="text-sm text-gray-600">{selectedService.used_for}</p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-500">RAM minima</div>
                  <div className="font-medium">{selectedService.min_ram_mb >= 1024 ? `${selectedService.min_ram_mb / 1024} GB` : `${selectedService.min_ram_mb} MB`}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-500">Disco minimo</div>
                  <div className="font-medium">{selectedService.min_disk_gb} GB</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-500">Protocolo</div>
                  <div className="font-medium">{selectedService.protocol}</div>
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg text-sm">
                <strong>Subdominio sugerido:</strong> {selectedService.subdomain}.tu-aldea.com
                <br />
                <span className="text-xs text-gray-500">Si tienes OpenWrt, este subdominio se registra automaticamente</span>
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <button
                  onClick={() => { installService(selectedService); setSelectedService(null) }}
                  disabled={installing}
                  className="px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  <Download size={14} /> Instalar aqui
                </button>
                <button
                  onClick={() => { downloadService(selectedService); setSelectedService(null) }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center gap-2"
                >
                  <Download size={14} /> Descargar Docker
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// === Panel de VoIP ===
function VoIPPanel() {
  const [config, setConfig] = useState<VoIPConfig | null>(null)
  const [extensions, setExtensions] = useState<VoIPExtension[]>([])
  const [routes, setRoutes] = useState<VoIPRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ type: string, text: string } | null>(null)
  const [newExt, setNewExt] = useState({ extension: '', display_name: '', password: '' })
  const [newRoute, setNewRoute] = useState({ remote_village_code: 0, remote_village_name: '', remote_endpoint: '', remote_domain: '' })

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      await Promise.all([loadConfig(), loadExtensions(), loadRoutes()])
    } finally {
      setLoading(false)
    }
  }

  const loadConfig = async () => {
    try {
      const res = await api.get('/api/voip/config')
      setConfig(res.data)
    } catch (e) { console.error(e) }
  }

  const loadExtensions = async () => {
    try {
      const res = await api.get('/api/voip/extensions')
      setExtensions(res.data.extensions || [])
    } catch (e) { console.error(e) }
  }

  const loadRoutes = async () => {
    try {
      const res = await api.get('/api/voip/routes')
      setRoutes(res.data.routes || [])
    } catch (e) { console.error(e) }
  }

  const generateCode = async () => {
    try {
      const res = await api.post('/api/voip/generate-code', {})
      setMsg({ type: 'success', text: res.data.message })
      await loadConfig()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error' })
    }
  }

  const saveConfig = async () => {
    if (!config) return
    try {
      await api.put('/api/voip/config', config)
      setMsg({ type: 'success', text: 'Configuracion VoIP guardada' })
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error' })
    }
  }

  const createExt = async () => {
    if (!newExt.extension) { setMsg({ type: 'error', text: 'Extension obligatoria' }); return }
    try {
      const res = await api.post('/api/voip/extensions', newExt)
      setMsg({ type: 'success', text: res.data.message })
      setNewExt({ extension: '', display_name: '', password: '' })
      await loadExtensions()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error' })
    }
  }

  const deleteExt = async (ext: string) => {
    if (!confirm(`Eliminar extension ${ext}?`)) return
    try {
      await api.delete(`/api/voip/extensions/${ext}`)
      await loadExtensions()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error' })
    }
  }

  const createRoute = async () => {
    if (!newRoute.remote_village_code) { setMsg({ type: 'error', text: 'Codigo de aldea remota obligatorio' }); return }
    try {
      const res = await api.post('/api/voip/routes', newRoute)
      setMsg({ type: 'success', text: res.data.message })
      setNewRoute({ remote_village_code: 0, remote_village_name: '', remote_endpoint: '', remote_domain: '' })
      await loadRoutes()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error' })
    }
  }

  const deleteRoute = async (code: string) => {
    if (!confirm(`Eliminar ruta a aldea ${code}?`)) return
    try {
      await api.delete(`/api/voip/routes/${code}`)
      await loadRoutes()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Error' })
    }
  }

  if (loading) return <div className="card p-4 text-center text-gray-500">Cargando VoIP...</div>

  return (
    <div className="card p-4 space-y-4">
      <h2 className="font-semibold flex items-center gap-2"><PhoneIcon size={18} /> Telefonía VoIP de la Aldea</h2>

      {msg && <div className={`p-2 rounded text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}

      {/* Codigo de aldea */}
      <div className="bg-blue-50 p-3 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-blue-600 mb-1">Codigo de Aldea</div>
            {config && config.village_code > 0 ? (
              <div className="text-2xl font-bold text-blue-700">{config.village_code}</div>
            ) : (
              <div className="text-sm text-blue-600">No generado</div>
            )}
          </div>
          <button onClick={generateCode} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">
            Generar codigo
          </button>
        </div>
        <p className="text-xs text-blue-600 mt-2">
          Para llamar a esta aldea desde otra: marcar {config?.village_code || 'XXX'} + extension (ej: {config?.village_code || 'XXX'}-2001)
        </p>
      </div>

      {/* Configuracion */}
      {config && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nombre aldea</label>
            <input className="input" value={config.village_name || ''} onChange={(e) => setConfig({ ...config, village_name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Puerto SIP</label>
            <input className="input" type="number" value={config.server_port} onChange={(e) => setConfig({ ...config, server_port: parseInt(e.target.value) || 5060 })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">RTP inicio</label>
            <input className="input" type="number" value={config.rtp_start} onChange={(e) => setConfig({ ...config, rtp_start: parseInt(e.target.value) || 10000 })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">RTP fin</label>
            <input className="input" type="number" value={config.rtp_end} onChange={(e) => setConfig({ ...config, rtp_end: parseInt(e.target.value) || 20000 })} />
          </div>
        </div>
      )}

      <button onClick={saveConfig} className="px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm">Guardar</button>

      {/* Extensiones */}
      <div className="border-t pt-3">
        <h3 className="font-medium text-sm mb-2">Extensiones telefonicas locales</h3>
        {extensions.length === 0 ? (
          <p className="text-gray-500 text-xs">No hay extensiones. Crea una para cada miembro.</p>
        ) : (
          <div className="space-y-1">
            {extensions.map((e) => (
              <div key={e.extension} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                <div>
                  <span className="font-mono font-medium">{e.extension}</span>
                  {e.display_name && <span className="text-gray-500 ml-2">{e.display_name}</span>}
                </div>
                <button onClick={() => deleteExt(e.extension)} className="text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-2">
          <input className="input text-sm" placeholder="Extension (ej: 2001)" value={newExt.extension} onChange={(e) => setNewExt({ ...newExt, extension: e.target.value })} />
          <input className="input text-sm" placeholder="Nombre" value={newExt.display_name} onChange={(e) => setNewExt({ ...newExt, display_name: e.target.value })} />
          <input className="input text-sm" placeholder="Password (auto)" value={newExt.password} onChange={(e) => setNewExt({ ...newExt, password: e.target.value })} />
          <button onClick={createExt} className="px-3 py-2 bg-trueque-600 text-white rounded-lg text-sm whitespace-nowrap">Agregar</button>
        </div>
      </div>

      {/* Rutas federadas */}
      <div className="border-t pt-3">
        <h3 className="font-medium text-sm mb-2">Rutas a otras aldeas</h3>
        <p className="text-xs text-gray-500 mb-2">Para llamar a otra aldea, marca su codigo + extension (ej: 105-2001)</p>
        {routes.length === 0 ? (
          <p className="text-gray-500 text-xs">No hay rutas federadas.</p>
        ) : (
          <div className="space-y-1">
            {routes.map((r) => (
              <div key={r.remote_village_code} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                <div>
                  <span className="font-mono font-medium">{r.remote_village_code}</span>
                  {r.remote_village_name && <span className="text-gray-500 ml-2">{r.remote_village_name}</span>}
                  {r.remote_domain && <span className="text-gray-400 ml-2 text-xs">{r.remote_domain}</span>}
                </div>
                <button onClick={() => deleteRoute(String(r.remote_village_code))} className="text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
          <input className="input text-sm" type="number" placeholder="Codigo (ej: 105)" value={newRoute.remote_village_code || ''} onChange={(e) => setNewRoute({ ...newRoute, remote_village_code: parseInt(e.target.value) || 0 })} />
          <input className="input text-sm" placeholder="Nombre aldea" value={newRoute.remote_village_name} onChange={(e) => setNewRoute({ ...newRoute, remote_village_name: e.target.value })} />
          <input className="input text-sm" placeholder="Endpoint SIP" value={newRoute.remote_endpoint} onChange={(e) => setNewRoute({ ...newRoute, remote_endpoint: e.target.value })} />
          <button onClick={createRoute} className="px-3 py-2 bg-trueque-600 text-white rounded-lg text-sm">Agregar ruta</button>
        </div>
      </div>
    </div>
  )
}
