import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Search, Globe, Send, CheckCircle, XCircle, RefreshCw, Trash2, Settings, Users, Server, Mail, ExternalLink, AlertTriangle, Clock, MapPin, FileText, Wifi, WifiOff, HelpCircle } from 'lucide-react'
import { fmtDate } from '../lib/format'

// NodeDiscovery: descubre nodos via gossip, envia solicitudes de contacto
// (NO federacion automatica) y verifica salud por consenso.
//
// IMPORTANTE: La federacion NO se hace aceptando/rechazando en el sistema.
// La clave publica se comparte personalmente entre personas.
// El sistema solo muestra info de contacto (pais, ubicacion, gobernanza, web)
// para que la gente se contacte fisicamente.
export default function NodeDiscovery() {
  const { t } = useTranslation(['federation', 'common'])
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as 'discovered' | 'requests' | 'config') || 'discovered'
  const [tab, setTab] = useState<'discovered' | 'requests' | 'config'>(initialTab)
  const changeTab = (t: 'discovered' | 'requests' | 'config') => {
    setTab(t)
    setSearchParams({ tab: t })
  }
  const [nodes, setNodes] = useState<any[]>([])
  const [federatedNodes, setFederatedNodes] = useState<any[]>([])
  const [inactiveNodes, setInactiveNodes] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [search, setSearch] = useState('')
  const [showRequestModal, setShowRequestModal] = useState<string | null>(null)
  const [requestData, setRequestData] = useState({ to_node_domain: '', message: '', contact_info: '' })
  const [showRespondModal, setShowRespondModal] = useState<any | null>(null)
  const [respondData, setRespondData] = useState({ status: 'interested', response_message: '', response_contact: '' })
  const [syncing, setSyncing] = useState(false)
  const [consensusRunning, setConsensusRunning] = useState(false)

  // Federation pairing (4 opciones)
  const [fedPairings, setFedPairings] = useState<any[]>([])
  const [fedApprovingId, setFedApprovingId] = useState('')
  const [fedPairingOptions, setFedPairingOptions] = useState<string[]>([])
  const [fedSelectedCode, setFedSelectedCode] = useState('')
  const [fedLoadingOptions, setFedLoadingOptions] = useState(false)
  const [fedOptionsError, setFedOptionsError] = useState('')
  const [fedAction, setFedAction] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [disc, fed, inact, reqs, cfg, fedPair] = await Promise.all([
        api.get('/nodes/discovered') as any,
        api.get('/nodes/federated') as any,
        api.get('/nodes/inactive') as any,
        api.get('/nodes/contact-requests') as any,
        api.get('/nodes/discovery-config') as any,
        api.get('/federation/pair/pending').catch(() => ({ pending: [] })) as any,
      ])
      setNodes(disc.discovered_nodes || [])
      setFederatedNodes(fed.federated_nodes || [])
      setInactiveNodes(inact.inactive_nodes || [])
      setRequests(reqs.requests || [])
      setConfig(cfg)
      setFedPairings(fedPair.pending || fedPair || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const showMsg = (type: 'success' | 'error' | 'info', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 6000)
  }

  const handleSendRequest = async () => {
    if (!requestData.to_node_domain) {
      showMsg('error', 'Coloca el dominio del nodo')
      return
    }
    try {
      const res = await api.post('/nodes/contact-request', requestData) as any
      showMsg('success', res.message || t('discover_request_sent', `Solicitud de contacto enviada a ${requestData.to_node_domain}`, { domain: requestData.to_node_domain }))
      setShowRequestModal(null)
      setRequestData({ to_node_domain: '', message: '', contact_info: '' })
      loadData()
    } catch (e: any) {
      showMsg('error', e.message || t('discover_error_sending', 'Error enviando solicitud'))
    }
  }

  const handleRespond = async () => {
    if (!showRespondModal) return
    try {
      const res = await api.post(`/nodes/contact-requests/${showRespondModal.id}/respond`, respondData) as any
      showMsg('success', res.message || t('discover_response_sent', 'Respuesta enviada'))
      setShowRespondModal(null)
      setRespondData({ status: 'interested', response_message: '', response_contact: '' })
      loadData()
    } catch (e: any) {
      showMsg('error', e.message || t('discover_error_responding', 'Error respondiendo solicitud'))
    }
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      const res = await api.post('/nodes/discovered/sync-now', {}) as any
      showMsg('success', res.message || t('discover_sync_done', 'Sincronizacion completada'))
      loadData()
    } catch (e: any) {
      showMsg('error', e.message || t('discover_error_syncing', 'Error sincronizando'))
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
      showMsg('error', e.message || t('discover_error_checking', 'Error verificando nodo'))
    }
  }

  const handleConsensusCheck = async () => {
    setConsensusRunning(true)
    try {
      const res = await api.post('/nodes/discovered/consensus-check', {}) as any
      showMsg('success', res.message || t('discover_consensus_done', 'Consenso evaluado'))
      loadData()
    } catch (e: any) {
      showMsg('error', e.message || t('discover_error_consensus', 'Error evaluando consenso'))
    } finally {
      setConsensusRunning(false)
    }
  }

  const handleRemoveNode = async (domain: string) => {
    if (!confirm(t('discover_remove_confirm', `Eliminar ${domain} de la lista de nodos descubiertos?`, { domain }))) return
    try {
      await api.delete(`/nodes/discovered/${domain}`)
      showMsg('success', t('discover_node_removed', 'Nodo eliminado'))
      loadData()
    } catch (e: any) {
      showMsg('error', e.message || t('discover_error_removing', 'Error eliminando nodo'))
    }
  }

  // === Federation pairing: 4 opciones ===
  const loadFedPairingOptions = async (reqId: string) => {
    setFedLoadingOptions(true)
    setFedPairingOptions([])
    setFedSelectedCode('')
    setFedOptionsError('')
    try {
      const res = await api.get<any>(`/federation/pair/request/${reqId}/options`)
      const options = Array.isArray(res) ? res : res?.options ?? []
      if (options.length === 0) {
        setFedOptionsError('No se pudieron cargar las opciones de verificacion')
      } else {
        setFedPairingOptions(options)
      }
    } catch (err) {
      setFedOptionsError(err instanceof Error ? err.message : 'Error al cargar opciones')
      setFedPairingOptions([])
    }
    setFedLoadingOptions(false)
  }

  const confirmFedPairing = async (reqId: string) => {
    setFedAction(reqId)
    try {
      await api.post(`/federation/pair/request/${reqId}/confirm`, {
        selected_code: fedSelectedCode,
      })
      showMsg('success', t('discover_fed_confirmed', 'Nodo federado y confirmado exitosamente. Propagando a toda la red automaticamente...'))
      setFedApprovingId('')
      setFedPairingOptions([])
      setFedSelectedCode('')
      setFedOptionsError('')
      loadData()
    } catch (e: any) {
      showMsg('error', e.message || t('discover_error_confirming', 'Error al confirmar federacion'))
    } finally {
      setFedAction('')
    }
  }

  const rejectFedPairing = async (reqId: string) => {
    setFedAction(reqId + '-reject')
    try {
      await api.post(`/federation/pair/request/${reqId}/reject`, {})
      showMsg('success', t('discover_fed_rejected', 'Solicitud de federacion rechazada'))
      loadData()
    } catch (e: any) {
      showMsg('error', e.message || t('discover_error_rejecting', 'Error al rechazar'))
    } finally {
      setFedAction('')
    }
  }

  const handleSaveConfig = async () => {
    try {
      await api.put('/nodes/discovery-config', config)
      showMsg('success', t('discover_config_saved', 'Configuracion guardada'))
      loadData()
    } catch (e: any) {
      showMsg('error', e.message || t('discover_error_saving_config', 'Error guardando config'))
    }
  }

  const filteredNodes = nodes.filter((n: any) => {
    if (!search) return true
    const s = search.toLowerCase()
    return n.node_domain?.toLowerCase().includes(s) ||
      n.node_name?.toLowerCase().includes(s) ||
      n.country?.toLowerCase().includes(s) ||
      n.location?.toLowerCase().includes(s)
  })

  const incomingRequests = requests.filter((r: any) => r.direction === 'incoming' && r.status === 'pending')
  const outgoingRequests = requests.filter((r: any) => r.direction === 'outgoing')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Globe size={24} /> {t('tab_discover', 'Descubrir Nodos')}</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
          <p><strong>{t('discover_help_title')}</strong></p>
          <p><strong>{t('discover_help_what_label')}</strong> {t('discover_help_what')}</p>
          <p><strong>{t('discover_help_personal_label')}</strong> {t('discover_help_personal')}</p>
          <p><strong>{t('discover_help_requests_label')}</strong> {t('discover_help_requests')}</p>
          <p><strong>{t('discover_help_config_label')}</strong> {t('discover_help_config')}</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('close', { ns: 'common' })}</button>
        </div>
      )}

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700' : msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Aviso importante sobre como funciona la federacion */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-sm text-gray-700">
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-gray-900 mb-1">{t('discover_federation_personal', 'La federacion se hace personalmente, no automaticamente')}</p>
            <p>{t('discover_federation_personal_desc', 'Este sistema NO federa nodos con un clic. La clave publica para federar se comparte personalmente entre las personas, no por el sistema. Aqui solo ves informacion de otros nodos (pais, ubicacion, gobernanza, web, contacto) para que te comuniques con ellos directamente. La idea es que haya contacto humano, que las personas se conozcan, que las asambleas aprueben, y luego compartan las claves en persona.')}</p>
          </div>
        </div>
      </div>

      {/* Tabs internos */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        <button onClick={() => changeTab('discovered')} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${tab === 'discovered' ? 'bg-trueque-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
          <Globe size={14} /> {t('discover_tab_discovered', 'Nodos Descubiertos ({{count}})', { count: nodes.length })}
        </button>
        <button onClick={() => changeTab('requests')} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${tab === 'requests' ? 'bg-trueque-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
          <Mail size={14} /> {t('discover_tab_requests', 'Solicitudes de Contacto')}
          {incomingRequests.length > 0 && <span className="bg-red-500 text-white text-xs px-1.5 rounded-full">{incomingRequests.length}</span>}
        </button>
        <button onClick={() => changeTab('config')} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${tab === 'config' ? 'bg-trueque-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
          <Settings size={14} /> {t('discover_tab_config', 'Configuracion')}
        </button>
      </div>

      {/* === TAB: NODOS DESCUBIERTOS === */}
      {tab === 'discovered' && (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700">
            <div className="flex items-start gap-2">
              <Users size={18} className="text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-gray-900 mb-1">{t('discover_how_works', 'Como funciona el descubrimiento de nodos')}</p>
                <p>{t('discover_how_works_desc', 'No hay un servidor central. Cada nodo comparte su lista de nodos conocidos con los nodos federados, y estos a su vez la comparten con los suyos. Asi, basta con que un nodo se feder con uno solo para que toda la red descubra que existe. Para federar, contacta personalmente a la persona responsable del otro nodo e intercambien las claves publicas.')}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input type="text" placeholder={t('discover_search_placeholder', 'Buscar por dominio, nombre, pais o ubicacion...')} value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
            </div>
            <button onClick={handleSyncNow} disabled={syncing} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50">
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /> {t('discover_sync', 'Sincronizar')}
            </button>
            <button onClick={handleConsensusCheck} disabled={consensusRunning} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50">
              <CheckCircle size={16} className={consensusRunning ? 'animate-spin' : ''} /> {t('discover_consensus', 'Evaluar consenso')}
            </button>
            <button onClick={() => { setRequestData({ to_node_domain: '', message: '', contact_info: '' }); setShowRequestModal('new') }} className="px-3 py-2 bg-trueque-600 text-white rounded-lg text-sm flex items-center gap-1.5">
              <Send size={16} /> {t('discover_request_contact', 'Solicitar contacto')}
            </button>
          </div>

          {/* Nodos federados (peers directos) con estado online/offline */}
          {federatedNodes.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <Server size={16} className="text-green-600" /> {t('discover_federated_nodes', 'Nodos Federados ({{count}})', { count: federatedNodes.length })}
              </h3>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {federatedNodes.map((n: any) => (
                  <div key={n.node_domain} className={`border rounded-lg p-3 flex items-center justify-between ${n.online ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
                    <div>
                      <div className="font-medium text-sm">{n.node_domain}</div>
                      <div className="text-xs text-gray-500">{t('discover_federated_since', 'Federado desde {{date}}', { date: fmtDate(n.created_at) })}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {n.online ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded flex items-center gap-1">
                          <Wifi size={12} /> {t('online', 'En linea')}
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded flex items-center gap-1">
                          <WifiOff size={12} /> {t('discover_no_connection', 'Sin conexion')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">{t('discover_federated_hint', 'Los nodos federados no se eliminan aunque esten sin conexion. Solo muestran su estado actual.')}</p>
            </div>
          )}

          {/* Nodos descubiertos (no federados) */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <Globe size={16} className="text-blue-600" /> {t('discover_discovered_gossip', 'Nodos Descubiertos via Gossip')}
            </h3>
            {loading ? (
              <div className="text-center py-8 text-gray-500">{t('discover_loading_nodes', 'Cargando nodos...')}</div>
            ) : filteredNodes.filter((n: any) => !n.is_direct_peer).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Globe size={48} className="mx-auto mb-2 text-gray-300" />
                <p>{t('discover_no_discovered', 'No hay nodos descubiertos aun.')}</p>
                <p className="text-xs mt-1">{t('discover_no_discovered_hint', 'Federate con un nodo para empezar a descubrir mas nodos en la red via gossip.')}</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredNodes.filter((n: any) => !n.is_direct_peer).map((n: any) => (
                  <div key={n.node_domain} className={`border rounded-lg p-4 space-y-2 ${n.is_this_node ? 'border-trueque-400 bg-trueque-50' : n.is_expelled ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Server size={16} className="text-gray-400" />
                          <span className="font-medium text-sm truncate">{n.node_name || n.node_domain}</span>
                        </div>
                        <div className="text-xs text-gray-500 truncate">{n.node_domain}</div>
                      </div>
                      {n.is_this_node && <span className="text-xs bg-trueque-100 text-trueque-700 px-2 py-0.5 rounded">{t('discover_your_node', 'Tu nodo')}</span>}
                      {n.is_expelled && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{t('discover_expelled', 'Expulsado')}</span>}
                    </div>

                    {n.description && <p className="text-xs text-gray-600 line-clamp-2">{n.description}</p>}

                    {/* Info de ubicacion */}
                    {(n.country || n.location) && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <MapPin size={12} />
                        {n.country && <span>{n.country}</span>}
                        {n.country && n.location && <span>, </span>}
                        {n.location && <span>{n.location}</span>}
                      </div>
                    )}

                    {/* Info de contacto */}
                    {n.contact_info && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Mail size={12} />
                        <span>{n.contact_info}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1 text-xs text-gray-500">
                      {n.node_number > 0 && <span className="bg-gray-100 px-1.5 py-0.5 rounded">#{n.node_number}</span>}
                      {n.discovered_via && <span className="bg-gray-100 px-1.5 py-0.5 rounded">via {n.discovered_via}</span>}
                      {n.member_count > 0 && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{n.member_count} miembros</span>}
                      {n.peer_count > 0 && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{n.peer_count} federados</span>}
                      {n.last_seen && <span className="bg-gray-100 px-1.5 py-0.5 rounded">visto {fmtDate(n.last_seen)}</span>}
                    </div>

                    {/* Links a gobernanza y pagina */}
                    {!n.is_this_node && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        {n.public_url && (
                          <a href={n.public_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            <ExternalLink size={12} /> {t('discover_view_page', 'Ver pagina')}
                          </a>
                        )}
                        {n.governance_url && (
                          <a href={n.governance_url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                            <FileText size={12} /> {t('discover_view_governance', 'Ver gobernanza')}
                          </a>
                        )}
                        {!n.is_expelled && (
                          <button onClick={() => { setRequestData({ to_node_domain: n.node_domain, message: '', contact_info: '' }); setShowRequestModal(n.node_domain) }} className="text-xs text-trueque-600 hover:underline flex items-center gap-1">
                            <Send size={12} /> {t('discover_request_contact', 'Solicitar contacto')}
                          </button>
                        )}
                        <button onClick={() => handleCheckNode(n.node_domain)} className="text-xs text-gray-600 hover:underline flex items-center gap-1">
                          <RefreshCw size={12} /> {t('discover_verify', 'Verificar')}
                        </button>
                        <button onClick={() => handleRemoveNode(n.node_domain)} className="text-xs text-red-600 hover:underline flex items-center gap-1">
                          <Trash2 size={12} /> {t('discover_remove', t('common:delete'))}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Nodos inactivos por consenso (solo visibles para admins) */}
          {inactiveNodes.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <AlertTriangle size={16} className="text-yellow-600" /> {t('discover_inactive_nodes', 'Nodos Inactivos por Consenso ({{count}})', { count: inactiveNodes.length })}
              </h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-600">{t('discover_inactive_desc', 'Estos nodos fueron marcados como inactivos porque todos los nodos de la red reportaron que no pueden conectar con ellos. No es que un solo nodo no pudo (puede ser que no tenga internet), sino que todos confirmaron que no responde. Se mantienen internamente para seguir consultando si algun dia reaparecen, pero no se muestran en la lista principal.')}</p>
                {inactiveNodes.map((n: any) => (
                  <div key={n.node_domain} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{n.node_name || n.node_domain}</span>
                      {n.country && <span className="text-xs text-gray-500 ml-2">{n.country}</span>}
                      {n.location && <span className="text-xs text-gray-500 ml-1">{n.location}</span>}
                      {n.last_checked && <span className="text-xs text-gray-500 ml-2">verificado {fmtDate(n.last_checked)}</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleCheckNode(n.node_domain)} className="text-xs text-blue-600 hover:underline">{t('discover_retry', 'Reintentar')}</button>
                      <button onClick={() => handleRemoveNode(n.node_domain)} className="text-xs text-red-600 hover:underline">{t('discover_remove', t('common:delete'))}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* === TAB: SOLICITUDES DE CONTACTO === */}
      {tab === 'requests' && (
        <div className="space-y-4">
          <div className="bg-blue-50 p-3 rounded-lg text-sm text-gray-700">
            <p>{t('discover_requests_not_auto', 'Las solicitudes de contacto no federan automaticamente. Son una forma de expresar interes y compartir informacion de contacto.')}</p>
            <p className="mt-2">{t('discover_auto_federation', 'Federacion automatica global: Al confirmar un emparejamiento con verificacion de 4 opciones, el nuevo nodo entra automaticamente a toda la red federada. El sponsor propaga la info del nuevo nodo a todos sus peers en cadena exponencial, y cada nodo establece una relacion 1-a-1 individual. No necesitas federarte manualmente con cada nodo.')}</p>
          </div>

          {/* Emparejamientos federados pendientes (4 opciones) */}
          {fedPairings.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle size={16} /> {t('discover_fed_pairings', 'Emparejamientos Federados Pendientes ({{count}})', { count: fedPairings.length })}
              </h3>
              <p className="text-xs text-amber-700">
                {t('discover_fed_pairings_desc', 'Un nodo nuevo solicita federarse. El nodo nuevo le comunico un codigo de 6 digitos por telefono. Haga clic en Confirmar para ver 4 opciones y elegir la correcta. Al confirmar, el nodo entrara automaticamente a toda la red federada via propagacion en cadena.')}
              </p>
              {fedPairings.map((p: any) => (
                <div key={p.id} className="border border-amber-200 bg-white rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-sm">{p.requesting_domain}</div>
                      <div className="text-xs text-gray-500">Clave publica: {p.requesting_public_key?.substring(0, 16)}...</div>
                      {p.requesting_endpoint && (
                        <div className="text-xs text-gray-500">Endpoint: {p.requesting_endpoint}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        {t('discover_hidden_code', 'Codigo oculto')} — {t('discover_hidden_code_hint', 'debe ser verificado por telefono')}
                      </div>
                    </div>
                  </div>

                  {fedApprovingId === p.id ? (
                    <div className="mt-3 space-y-3 border-t pt-3">
                      {fedLoadingOptions ? (
                        <div className="text-sm text-indigo-600">{t('discover_loading_options', 'Cargando opciones de verificacion...')}</div>
                      ) : fedOptionsError ? (
                        <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
                          <p className="font-semibold">{t('discover_error_title', 'Error')}</p>
                          <p className="text-xs">{fedOptionsError}</p>
                          <button onClick={() => loadFedPairingOptions(p.id)} className="text-xs text-red-600 underline mt-1">{t('discover_retry', 'Reintentar')}</button>
                        </div>
                      ) : fedPairingOptions.length > 0 ? (
                        <div>
                          <p className="text-sm font-semibold mb-2">{t('discover_select_code', 'Elija el codigo que le comunico el nodo nuevo:')}</p>
                          <div className="grid grid-cols-2 gap-2">
                            {fedPairingOptions.map((opt) => (
                              <button
                                key={opt}
                                onClick={() => setFedSelectedCode(opt)}
                                className={`py-3 text-xl font-mono font-bold rounded-lg border-2 transition ${
                                  fedSelectedCode === opt
                                    ? 'border-trueque-600 bg-trueque-50 text-trueque-700'
                                    : 'border-gray-200 hover:border-trueque-300'
                                }`}>
                                {opt}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => confirmFedPairing(p.id)}
                              disabled={fedAction === p.id || !fedSelectedCode}
                              className="btn-primary flex-1 disabled:opacity-50">
                              {fedAction === p.id ? t('discover_confirming', 'Confirmando...') : t('discover_confirm_federation', 'Confirmar Federacion')}
                            </button>
                            <button
                              onClick={() => { setFedApprovingId(''); setFedPairingOptions([]); setFedSelectedCode(''); setFedOptionsError('') }}
                              className="btn-secondary">
                              {t('discover_cancel', t('common:cancel'))}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => { setFedApprovingId(p.id); setFedOptionsError(''); loadFedPairingOptions(p.id) }}
                        className="btn-primary text-sm">
                        {t('discover_confirm', 'Confirmar')}
                      </button>
                      <button
                        onClick={() => rejectFedPairing(p.id)}
                        disabled={fedAction === p.id + '-reject'}
                        className="btn-secondary text-sm text-red-600">
                        {fedAction === p.id + '-reject' ? t('discover_rejecting', 'Rechazando...') : t('discover_reject', 'Rechazar')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Solicitudes recibidas */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <Mail size={16} className="text-trueque-600" /> {t('discover_requests_received', 'Solicitudes Recibidas ({{count}})', { count: incomingRequests.length })}
            </h3>
            {incomingRequests.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">{t('discover_no_pending_requests', 'No hay solicitudes pendientes')}</div>
            ) : (
              <div className="space-y-2">
                {incomingRequests.map((r: any) => (
                  <div key={r.id} className="border border-trueque-200 bg-trueque-50 rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-sm">{r.from_node_name || r.from_node_domain}</div>
                        <div className="text-xs text-gray-500">{r.from_node_domain}</div>
                        {(r.from_country || r.from_location) && (
                          <div className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                            <MapPin size={12} /> {r.from_country}{r.from_country && r.from_location ? ', ' : ''}{r.from_location}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{fmtDate(r.created_at)}</span>
                    </div>
                    {r.message && <p className="text-sm text-gray-700">{r.message}</p>}
                    {r.contact_info && <p className="text-xs text-gray-600">{t('discover_contact', 'Contacto:')} {r.contact_info}</p>}
                    {r.from_governance_url && (
                      <a href={r.from_governance_url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                        <FileText size={12} /> {t('discover_view_node_governance', 'Ver gobernanza del nodo')}
                      </a>
                    )}
                    <div className="bg-amber-50 border border-amber-200 p-2 rounded text-xs text-amber-700">
                      {t('discover_federate_hint', 'Para federar: contacta personalmente a esta persona, revisen sus gobernanzas, las asambleas aprueban, y luego comparten las claves publicas en persona. No se federa con un clic.')}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => { setShowRespondModal(r); setRespondData({ status: 'interested', response_message: '', response_contact: '' }) }} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs flex items-center gap-1">
                        <CheckCircle size={14} /> {t('discover_interested', 'Interesado')}
                      </button>
                      <button onClick={() => { setShowRespondModal(r); setRespondData({ status: 'not_interested', response_message: '', response_contact: '' }) }} className="px-3 py-1.5 bg-gray-400 text-white rounded-lg text-xs flex items-center gap-1">
                        <XCircle size={14} /> {t('discover_not_interested', 'No interesado')}
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
              <Send size={16} className="text-gray-600" /> {t('discover_requests_sent', 'Solicitudes Enviadas ({{count}})', { count: outgoingRequests.length })}
            </h3>
            {outgoingRequests.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">{t('discover_no_sent_requests', 'No has enviado solicitudes')}</div>
            ) : (
              <div className="space-y-2">
                {outgoingRequests.map((r: any) => (
                  <div key={r.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-medium text-sm">{r.to_node_domain}</span>
                        {r.message && <p className="text-xs text-gray-600 mt-0.5">{r.message}</p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${r.status === 'interested' ? 'bg-green-100 text-green-700' : r.status === 'not_interested' ? 'bg-gray-200 text-gray-600' : 'bg-yellow-100 text-yellow-700'}`}>
                        {r.status === 'pending' ? t('discover_status_pending', 'Pendiente') : r.status === 'interested' ? t('discover_status_interested', 'Interesado') : t('discover_status_not_interested', 'No interesado')}
                      </span>
                    </div>
                    {r.response_message && <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">{t('discover_response', 'Respuesta:')} {r.response_message}</p>}
                    {r.response_contact && <p className="text-xs text-gray-500">{t('discover_contact', 'Contacto:')} {r.response_contact}</p>}
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
                <p className="font-semibold text-gray-900 mb-1">{t('discover_config_title', 'Intervalos de descubrimiento y verificacion')}</p>
                <p>{t('discover_config_desc', 'Configura cada cuanto tiempo tu nodo comparte su lista, verifica si los nodos estan activos, y limpia los inactivos. Cada nodo puede tener su propia configuracion.')}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('discover_share_interval', 'Compartir lista de nodos (horas)')}</label>
              <input type="number" min={1} value={config.discovery_interval_hours || 24} onChange={e => setConfig({ ...config, discovery_interval_hours: parseInt(e.target.value) || 24 })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <p className="text-xs text-gray-500 mt-1">{t('discover_share_interval_hint', 'Cada cuanto tu nodo comparte su lista de nodos conocidos con los peers. Default: 24 horas.')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('discover_health_interval', 'Verificar nodos activos (horas)')}</label>
              <input type="number" min={1} value={config.health_check_interval_hours || 168} onChange={e => setConfig({ ...config, health_check_interval_hours: parseInt(e.target.value) || 168 })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <p className="text-xs text-gray-500 mt-1">{t('discover_health_interval_hint', 'Cada cuanto tu nodo verifica si los nodos descubiertos siguen activos. Default: 168 horas (7 dias). Un nodo inactivo se decide por consenso de toda la red, no por tu sola verificacion.')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('discover_cleanup_interval', 'Limpiar nodos inactivos (dias)')}</label>
              <input type="number" min={1} value={config.inactive_cleanup_interval_days || 365} onChange={e => setConfig({ ...config, inactive_cleanup_interval_days: parseInt(e.target.value) || 365 })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <p className="text-xs text-gray-500 mt-1">{t('discover_cleanup_interval_hint', 'Cada cuanto se eliminan los nodos inactivos de la lista visible. Se mantienen internamente para seguir consultando. Default: 365 dias.')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('discover_max_failed', 'Intentos fallidos antes de evaluar consenso')}</label>
              <input type="number" min={1} value={config.max_failed_checks || 3} onChange={e => setConfig({ ...config, max_failed_checks: parseInt(e.target.value) || 3 })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <p className="text-xs text-gray-500 mt-1">{t('discover_max_failed_hint', 'Cuantas veces un nodo debe fallar tu verificacion antes de pedir el consenso a los demas nodos. Default: 3.')}</p>
            </div>

            <div className="pt-2">
              <button onClick={handleSaveConfig} className="px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm">{t('discover_save_config', 'Guardar configuracion')}</button>
            </div>

            {config.last_discovery_sync && (
              <div className="text-xs text-gray-500 pt-2 border-t">
                {t('discover_last_sync', 'Ultima sincronizacion:')} {new Date(config.last_discovery_sync).toLocaleString()}
              </div>
            )}
            {config.last_health_check && (
              <div className="text-xs text-gray-500">
                {t('discover_last_health', 'Ultima verificacion de salud:')} {new Date(config.last_health_check).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === MODAL: Enviar solicitud de contacto === */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRequestModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">{t('discover_request_modal_title', 'Solicitar contacto')}</h3>
            <p className="text-sm text-gray-600">{t('discover_request_modal_desc', 'Enviaras una solicitud de contacto a otro nodo. Esto no federa automaticamente. El otro nodo vera tu informacion y podra contactarte personalmente para federar.')}</p>

            <div className="bg-amber-50 border border-amber-200 p-2 rounded text-xs text-amber-700">
              Recuerda: la federacion se hace personalmente. Las personas se contactan, se reúnen, las asambleas aprueban, y luego comparten las claves publicas en persona.
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('discover_request_domain', 'Dominio del nodo')}</label>
              <input type="text" placeholder="ej: mi-aldea.com" value={requestData.to_node_domain} onChange={e => setRequestData({ ...requestData, to_node_domain: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('discover_request_message', 'Mensaje (opcional)')}</label>
              <textarea placeholder="Hola, somos la aldea X de [pais] y nos gustaria conocerlos..." value={requestData.message} onChange={e => setRequestData({ ...requestData, message: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('discover_request_contact_info', 'Informacion de contacto')}</label>
              <input type="text" placeholder="ej: maria@mi-aldea.com o +1234567890" value={requestData.contact_info} onChange={e => setRequestData({ ...requestData, contact_info: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <p className="text-xs text-gray-500 mt-1">{t('discover_request_contact_hint', 'Como pueden contactarte del otro nodo')}</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleSendRequest} className="flex-1 px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm">{t('discover_send_request', 'Enviar solicitud')}</button>
              <button onClick={() => setShowRequestModal(null)} className="px-4 py-2 bg-gray-200 rounded-lg text-sm">{t('discover_cancel', t('common:cancel'))}</button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Responder solicitud de contacto === */}
      {showRespondModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRespondModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">{respondData.status === 'interested' ? t('discover_respond_interested', 'Responder: Interesado') : t('discover_respond_not_interested', 'Responder: No interesado')}</h3>
            <p className="text-sm text-gray-600">De: <strong>{showRespondModal.from_node_name || showRespondModal.from_node_domain}</strong></p>
            {(showRespondModal.from_country || showRespondModal.from_location) && (
              <p className="text-xs text-gray-600 flex items-center gap-1">
                <MapPin size={12} /> {showRespondModal.from_country}{showRespondModal.from_country && showRespondModal.from_location ? ', ' : ''}{showRespondModal.from_location}
              </p>
            )}
            {showRespondModal.message && <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{showRespondModal.message}</p>}
            {showRespondModal.from_governance_url && (
              <a href={showRespondModal.from_governance_url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                <FileText size={12} /> {t('discover_view_node_governance', 'Ver gobernanza del nodo')}
              </a>
            )}

            <div className="bg-amber-50 border border-amber-200 p-2 rounded text-xs text-amber-700">
              {respondData.status === 'interested'
                ? 'Si estan interesados, contacten personalmente. Revisen las gobernanzas de ambos nodos, las asambleas aprueban, y luego comparten las claves publicas en persona. Esto NO federa automaticamente.'
                : 'Si no estan interesados, pueden responder cortesmente. No hay obligacion de federar.'}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('discover_response_message', 'Mensaje de respuesta')}</label>
              <textarea placeholder={respondData.status === 'interested' ? 'Gracias por contactarnos! Nos gustaria conocernos. Podemos coordinar una reunion...' : 'Gracias por su interes, pero por ahora no podemos federar...'} value={respondData.response_message} onChange={e => setRespondData({ ...respondData, response_message: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} />
            </div>

            {respondData.status === 'interested' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('discover_request_contact_info', 'Informacion de contacto')}</label>
                <input type="text" placeholder="ej: admin@mi-aldea.com o +1234567890" value={respondData.response_contact} onChange={e => setRespondData({ ...respondData, response_contact: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <p className="text-xs text-gray-500 mt-1">Como pueden contactarte del otro nodo para coordinar la reunion</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={handleRespond} className={`flex-1 px-4 py-2 text-white rounded-lg text-sm ${respondData.status === 'interested' ? 'bg-green-600' : 'bg-gray-500'}`}>
                {respondData.status === 'interested' ? t('discover_send_and_contact', 'Enviar y contactar despues') : t('discover_send_response', 'Enviar respuesta')}
              </button>
              <button onClick={() => setShowRespondModal(null)} className="px-4 py-2 bg-gray-200 rounded-lg text-sm">{t('discover_cancel', t('common:cancel'))}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
