import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Search, Globe, Send, CheckCircle, XCircle, RefreshCw, Trash2, Settings, Users, Server, Mail, ExternalLink, AlertTriangle, Clock } from 'lucide-react'

// NodeDiscovery: descubre nodos via gossip, envia solicitudes de federacion
// y configura los intervalos de descubrimiento/verificacion.
export default function NodeDiscovery() {
  const { node_domain: nodeDomain } = useConfig()
  const [tab, setTab] = useState<'discovered' | 'requests' | 'config'>('discovered')
  const [nodes, setNodes] = useState<any[]>([])
  const [federatedNodes, setFederatedNodes] = useState<any[]>([])
  const [inactiveNodes, setInactiveNodes] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [search, setSearch] = useState('')
  const [showRequestModal, setShowRequestModal] = useState<string | null>(null)
  const [requestData, setRequestData] = useState({ to_node_domain: '', message: '', contact_info: '' })
  const [showRespondModal, setShowRespondModal] = useState<any | null>(null)
  const [respondData, setRespondData] = useState({ status: 'accepted', response_message: '', response_contact: '', response_public_key: '' })
  const [syncing, setSyncing] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [disc, fed, inact, reqs, cfg] = await Promise.all([
        api.get('/nodes/discovered') as any,
        api.get('/nodes/federated') as any,
        api.get('/nodes/inactive') as any,
        api.get('/nodes/federation-requests') as any,
        api.get('/nodes/discovery-config') as any,
      ])
      setNodes(disc.discovered_nodes || [])
      setFederatedNodes(fed.federated_nodes || [])
      setInactiveNodes(inact.inactive_nodes || [])
      setRequests(reqs.requests || [])
      setConfig(cfg)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const showMsg = (type: 'success' | 'error' | 'info', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 5000)
  }

  const handleSendRequest = async () => {
    if (!requestData.to_node_domain) {
      showMsg('error', 'Coloca el dominio del nodo')
      return
    }
    try {
      await api.post('/nodes/federation-request', requestData)
      showMsg('success', `Solicitud enviada a ${requestData.to_node_domain}`)
      setShowRequestModal(null)
      setRequestData({ to_node_domain: '', message: '', contact_info: '' })
      loadData()
    } catch (e: any) {
      showMsg('error', e.message || 'Error enviando solicitud')
    }
  }

  const handleRespond = async () => {
    if (!showRespondModal) return
    try {
      await api.post(`/nodes/federation-requests/${showRespondModal.id}/respond`, respondData)
      showMsg('success', `Solicitud ${respondData.status === 'accepted' ? 'aceptada' : 'rechazada'}`)
      setShowRespondModal(null)
      setRespondData({ status: 'accepted', response_message: '', response_contact: '', response_public_key: '' })
      loadData()
    } catch (e: any) {
      showMsg('error', e.message || 'Error respondiendo solicitud')
    }
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      const res = await api.post('/nodes/discovered/sync-now', {}) as any
      showMsg('success', res.message || 'Sincronizacion completada')
      loadData()
    } catch (e: any) {
      showMsg('error', e.message || 'Error sincronizando')
    } finally {
      setSyncing(false)
    }
  }

  const handleCheckNode = async (domain: string) => {
    try {
      const res = await api.post(`/nodes/discovered/${domain}/check`, {}) as any
      showMsg(res.active ? 'success' : 'info', res.message)
      loadData()
    } catch (e: any) {
      showMsg('error', e.message || 'Error verificando nodo')
    }
  }

  const handleRemoveNode = async (domain: string) => {
    if (!confirm(`Eliminar ${domain} de la lista de nodos descubiertos?`)) return
    try {
      await api.delete(`/nodes/discovered/${domain}`)
      showMsg('success', 'Nodo eliminado')
      loadData()
    } catch (e: any) {
      showMsg('error', e.message || 'Error eliminando nodo')
    }
  }

  const handleSaveConfig = async () => {
    try {
      await api.put('/nodes/discovery-config', config)
      showMsg('success', 'Configuracion guardada')
      loadData()
    } catch (e: any) {
      showMsg('error', e.message || 'Error guardando config')
    }
  }

  const filteredNodes = nodes.filter((n: any) => {
    if (!search) return true
    const s = search.toLowerCase()
    return n.node_domain?.toLowerCase().includes(s) || n.node_name?.toLowerCase().includes(s)
  })

  const incomingRequests = requests.filter((r: any) => r.direction === 'incoming' && r.status === 'pending')
  const outgoingRequests = requests.filter((r: any) => r.direction === 'outgoing')

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700' : msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Tabs internos */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        <button onClick={() => setTab('discovered')} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${tab === 'discovered' ? 'bg-trueque-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
          <Globe size={14} /> Nodos Descubiertos ({nodes.length})
        </button>
        <button onClick={() => setTab('requests')} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${tab === 'requests' ? 'bg-trueque-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
          <Mail size={14} /> Solicitudes
          {incomingRequests.length > 0 && <span className="bg-red-500 text-white text-xs px-1.5 rounded-full">{incomingRequests.length}</span>}
        </button>
        <button onClick={() => setTab('config')} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${tab === 'config' ? 'bg-trueque-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
          <Settings size={14} /> Configuracion
        </button>
      </div>

      {/* === TAB: NODOS DESCUBIERTOS === */}
      {tab === 'discovered' && (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700">
            <div className="flex items-start gap-2">
              <Users size={18} className="text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-gray-900 mb-1">Como funciona el descubrimiento de nodos</p>
                <p>No hay un servidor central. Cada nodo comparte su lista de nodos conocidos con los nodos federados, y estos a su vez la comparten con los suyos. Asi, basta con que un nodo se feder con uno solo para que toda la red descubra que existe. Para federar un nodo, envia una solicitud de federacion y comparte las claves publicas.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input type="text" placeholder="Buscar nodo por dominio o nombre..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
            </div>
            <button onClick={handleSyncNow} disabled={syncing} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50">
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /> Sincronizar ahora
            </button>
            <button onClick={() => { setRequestData({ to_node_domain: '', message: '', contact_info: '' }); setShowRequestModal('new') }} className="px-3 py-2 bg-trueque-600 text-white rounded-lg text-sm flex items-center gap-1.5">
              <Send size={16} /> Solicitar federacion
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Cargando nodos...</div>
          ) : filteredNodes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Globe size={48} className="mx-auto mb-2 text-gray-300" />
              <p>No hay nodos descubiertos aun.</p>
              <p className="text-xs mt-1">Federate con un nodo para empezar a descubrir mas nodos en la red.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredNodes.map((n: any) => (
                <div key={n.node_domain} className={`border rounded-lg p-4 space-y-2 ${n.is_this_node ? 'border-trueque-400 bg-trueque-50' : n.is_expelled ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Server size={16} className={n.is_direct_peer ? 'text-green-600' : 'text-gray-400'} />
                        <span className="font-medium text-sm truncate">{n.node_name || n.node_domain}</span>
                      </div>
                      <div className="text-xs text-gray-500 truncate">{n.node_domain}</div>
                    </div>
                    {n.is_this_node && <span className="text-xs bg-trueque-100 text-trueque-700 px-2 py-0.5 rounded">Tu nodo</span>}
                    {n.is_direct_peer && !n.is_this_node && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Federado</span>}
                    {n.is_expelled && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Expulsado</span>}
                  </div>

                  {n.description && <p className="text-xs text-gray-600 line-clamp-2">{n.description}</p>}

                  <div className="flex flex-wrap gap-1 text-xs text-gray-500">
                    {n.node_number > 0 && <span className="bg-gray-100 px-1.5 py-0.5 rounded">#{n.node_number}</span>}
                    {n.discovered_via && <span className="bg-gray-100 px-1.5 py-0.5 rounded">via {n.discovered_via}</span>}
                    {n.last_seen && <span className="bg-gray-100 px-1.5 py-0.5 rounded">visto {new Date(n.last_seen).toLocaleDateString()}</span>}
                  </div>

                  {!n.is_this_node && (
                    <div className="flex flex-wrap gap-1 pt-2 border-t">
                      {n.public_url && (
                        <a href={n.public_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                          <ExternalLink size={12} /> Ver pagina
                        </a>
                      )}
                      {!n.is_direct_peer && !n.is_expelled && (
                        <button onClick={() => { setRequestData({ to_node_domain: n.node_domain, message: '', contact_info: '' }); setShowRequestModal(n.node_domain) }} className="text-xs text-trueque-600 hover:underline flex items-center gap-1">
                          <Send size={12} /> Solicitar federacion
                        </button>
                      )}
                      <button onClick={() => handleCheckNode(n.node_domain)} className="text-xs text-gray-600 hover:underline flex items-center gap-1">
                        <RefreshCw size={12} /> Verificar
                      </button>
                      {!n.is_direct_peer && (
                        <button onClick={() => handleRemoveNode(n.node_domain)} className="text-xs text-red-600 hover:underline flex items-center gap-1">
                          <Trash2 size={12} /> Eliminar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Nodos inactivos */}
          {inactiveNodes.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <AlertTriangle size={16} className="text-yellow-600" /> Nodos inactivos ({inactiveNodes.length})
              </h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-600">Estos nodos no respondieron despues de varios intentos de verificacion. Se limpian automaticamente segun la configuracion.</p>
                {inactiveNodes.map((n: any) => (
                  <div key={n.node_domain} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{n.node_name || n.node_domain}</span>
                      <span className="text-xs text-gray-500 ml-2">{n.failed_checks} intentos fallidos</span>
                      {n.last_checked && <span className="text-xs text-gray-500 ml-2">verificado {new Date(n.last_checked).toLocaleDateString()}</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleCheckNode(n.node_domain)} className="text-xs text-blue-600 hover:underline">Reintentar</button>
                      <button onClick={() => handleRemoveNode(n.node_domain)} className="text-xs text-red-600 hover:underline">Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* === TAB: SOLICITUDES === */}
      {tab === 'requests' && (
        <div className="space-y-4">
          {/* Solicitudes recibidas */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <Mail size={16} className="text-trueque-600" /> Solicitudes recibidas ({incomingRequests.length})
            </h3>
            {incomingRequests.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">No hay solicitudes pendientes</div>
            ) : (
              <div className="space-y-2">
                {incomingRequests.map((r: any) => (
                  <div key={r.id} className="border border-trueque-200 bg-trueque-50 rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-sm">{r.from_node_name || r.from_node_domain}</div>
                        <div className="text-xs text-gray-500">{r.from_node_domain}</div>
                      </div>
                      <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    {r.message && <p className="text-sm text-gray-700">{r.message}</p>}
                    {r.contact_info && <p className="text-xs text-gray-500">Contacto: {r.contact_info}</p>}
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => { setShowRespondModal(r); setRespondData({ status: 'accepted', response_message: '', response_contact: '', response_public_key: '' }) }} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs flex items-center gap-1">
                        <CheckCircle size={14} /> Aceptar
                      </button>
                      <button onClick={() => { setShowRespondModal(r); setRespondData({ status: 'rejected', response_message: '', response_contact: '', response_public_key: '' }) }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs flex items-center gap-1">
                        <XCircle size={14} /> Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Solicitudes enviadas */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <Send size={16} className="text-gray-600" /> Solicitudes enviadas ({outgoingRequests.length})
            </h3>
            {outgoingRequests.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">No has enviado solicitudes</div>
            ) : (
              <div className="space-y-2">
                {outgoingRequests.map((r: any) => (
                  <div key={r.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-medium text-sm">{r.to_node_domain}</span>
                        {r.message && <p className="text-xs text-gray-600 mt-0.5">{r.message}</p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${r.status === 'accepted' ? 'bg-green-100 text-green-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {r.status === 'pending' ? 'Pendiente' : r.status === 'accepted' ? 'Aceptada' : 'Rechazada'}
                      </span>
                    </div>
                    {r.response_message && <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">Respuesta: {r.response_message}</p>}
                    {r.response_contact && <p className="text-xs text-gray-500">Contacto: {r.response_contact}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === TAB: CONFIGURACION === */}
      {tab === 'config' && config && (
        <div className="max-w-2xl space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700">
            <div className="flex items-start gap-2">
              <Clock size={18} className="text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-gray-900 mb-1">Intervalos de descubrimiento</p>
                <p>Configura cada cuanto tiempo tu nodo comparte su lista de nodos, verifica si estan activos y limpia los inactivos. Cada nodo puede tener su propia configuracion.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Compartir lista de nodos (horas)</label>
              <input type="number" min={1} value={config.discovery_interval_hours || 24} onChange={e => setConfig({ ...config, discovery_interval_hours: parseInt(e.target.value) || 24 })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <p className="text-xs text-gray-500 mt-1">Cada cuanto tu nodo comparte su lista de nodos conocidos con los peers. Default: 24 horas.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verificar nodos activos (horas)</label>
              <input type="number" min={1} value={config.health_check_interval_hours || 168} onChange={e => setConfig({ ...config, health_check_interval_hours: parseInt(e.target.value) || 168 })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <p className="text-xs text-gray-500 mt-1">Cada cuanto tu nodo verifica si los nodos descubiertos siguen activos. Default: 168 horas (7 dias).</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Limpiar nodos inactivos (dias)</label>
              <input type="number" min={1} value={config.inactive_cleanup_interval_days || 365} onChange={e => setConfig({ ...config, inactive_cleanup_interval_days: parseInt(e.target.value) || 365 })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <p className="text-xs text-gray-500 mt-1">Cada cuanto se eliminan los nodos inactivos de la lista. Default: 365 dias. Un nodo puede configurar 90 dias (3 meses) si quiere limpiar mas frecuente.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Intentos fallidos antes de marcar inactivo</label>
              <input type="number" min={1} value={config.max_failed_checks || 3} onChange={e => setConfig({ ...config, max_failed_checks: parseInt(e.target.value) || 3 })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <p className="text-xs text-gray-500 mt-1">Cuantas veces un nodo debe fallar la verificacion antes de marcarlo como inactivo. Default: 3.</p>
            </div>

            <div className="pt-2">
              <button onClick={handleSaveConfig} className="px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm">Guardar configuracion</button>
            </div>

            {config.last_discovery_sync && (
              <div className="text-xs text-gray-500 pt-2 border-t">
                Ultima sincronizacion: {new Date(config.last_discovery_sync).toLocaleString()}
              </div>
            )}
            {config.last_health_check && (
              <div className="text-xs text-gray-500">
                Ultima verificacion de salud: {new Date(config.last_health_check).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === MODAL: Enviar solicitud === */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRequestModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">Solicitar federacion</h3>
            <p className="text-sm text-gray-600">Enviaras una solicitud a otro nodo. El administrador del otro nodo vera tu solicitud y podra aceptarla o rechazarla. Cuando acepte, podran intercambiar las claves publicas para federar.</p>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Dominio del nodo</label>
              <input type="text" placeholder="ej: mi-aldea.com" value={requestData.to_node_domain} onChange={e => setRequestData({ ...requestData, to_node_domain: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mensaje (opcional)</label>
              <textarea placeholder="Hola, somos la aldea X y nos gustaria federar con ustedes..." value={requestData.message} onChange={e => setRequestData({ ...requestData, message: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Informacion de contacto</label>
              <input type="text" placeholder="ej: maria@mi-aldea.com o +1234567890" value={requestData.contact_info} onChange={e => setRequestData({ ...requestData, contact_info: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <p className="text-xs text-gray-500 mt-1">Como pueden contactarte del otro nodo</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleSendRequest} className="flex-1 px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm">Enviar solicitud</button>
              <button onClick={() => setShowRequestModal(null)} className="px-4 py-2 bg-gray-200 rounded-lg text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Responder solicitud === */}
      {showRespondModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRespondModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">{respondData.status === 'accepted' ? 'Aceptar solicitud' : 'Rechazar solicitud'}</h3>
            <p className="text-sm text-gray-600">De: <strong>{showRespondModal.from_node_name || showRespondModal.from_node_domain}</strong></p>
            {showRespondModal.message && <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{showRespondModal.message}</p>}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mensaje de respuesta</label>
              <textarea placeholder={respondData.status === 'accepted' ? 'Bienvenidos! Nos alegra federar con ustedes...' : 'Gracias por su interes, pero por ahora...'} value={respondData.response_message} onChange={e => setRespondData({ ...respondData, response_message: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} />
            </div>

            {respondData.status === 'accepted' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Informacion de contacto</label>
                  <input type="text" placeholder="ej: admin@mi-aldea.com" value={respondData.response_contact} onChange={e => setRespondData({ ...respondData, response_contact: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Clave publica para federar</label>
                  <textarea placeholder="Pega aqui la clave publica de tu nodo para que el otro nodo pueda registrarte..." value={respondData.response_public_key} onChange={e => setRespondData({ ...respondData, response_public_key: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm font-mono text-xs" rows={4} />
                  <p className="text-xs text-gray-500 mt-1">La clave publica permite al otro nodo verificar las comunicaciones federadas contigo.</p>
                </div>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={handleRespond} className={`flex-1 px-4 py-2 text-white rounded-lg text-sm ${respondData.status === 'accepted' ? 'bg-green-600' : 'bg-red-600'}`}>
                {respondData.status === 'accepted' ? 'Aceptar y enviar' : 'Rechazar'}
              </button>
              <button onClick={() => setShowRespondModal(null)} className="px-4 py-2 bg-gray-200 rounded-lg text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
