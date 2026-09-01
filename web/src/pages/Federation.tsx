import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Network, Globe, Scale, Server, RefreshCw, MapPin, Wifi, Compass, Satellite } from 'lucide-react'
import { fmtDateTime } from '../lib/format'
import { api } from '../api'
import NetworkConfig from './NetworkConfig'
import FederationPeers from './FederationPeers'
import FederationGov from './FederationGov'
import NodeDiscovery from './NodeDiscovery'
import SatelliteSetup from './SatelliteSetup'

// Pagina unificada de Federacion con 6 tabs:
// 1. Red del Nodo: registro de red (IP, OpenWrt, servicios, instalador)
// 2. Federar Aldeas: agregar y gestionar aldeas federadas (Internet + Intranet)
// 3. Nodos Federados: info de red y servicios de nodos federados (auto-sincronizada)
// 4. Descubrir Nodos: nodos descubiertos via gossip + solicitudes de federacion
// 5. Gobernanza: propuestas, votacion, constantes federadas
// 6. Satelite: configurar nodo satelite para ferias offline
export default function Federation() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as any) || 'network'
  const [tab, setTab] = useState<'network' | 'peers' | 'nodes' | 'discover' | 'gov' | 'satellite'>(initialTab)

  const changeTab = (t: 'network' | 'peers' | 'nodes' | 'discover' | 'gov' | 'satellite') => {
    setTab(t)
    setSearchParams({ tab: t })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Network size={24} className="text-trueque-600" />
        <h1 className="text-2xl font-bold">Federacion</h1>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        <button
          onClick={() => changeTab('network')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${tab === 'network' ? 'bg-trueque-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
        >
          <Network size={14} />
          Red del Nodo
        </button>
        <button
          onClick={() => changeTab('peers')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${tab === 'peers' ? 'bg-trueque-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
        >
          <Globe size={14} />
          Federar Aldeas
        </button>
        <button
          onClick={() => changeTab('nodes')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${tab === 'nodes' ? 'bg-trueque-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
        >
          <Server size={14} />
          Nodos Federados
        </button>
        <button
          onClick={() => changeTab('discover')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${tab === 'discover' ? 'bg-trueque-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
        >
          <Compass size={14} />
          Descubrir Nodos
        </button>
        <button
          onClick={() => changeTab('gov')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${tab === 'gov' ? 'bg-trueque-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
        >
          <Scale size={14} />
          Gobernanza
        </button>
        <button
          onClick={() => changeTab('satellite')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${tab === 'satellite' ? 'bg-trueque-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
        >
          <Satellite size={14} />
          Satelite
        </button>
      </div>

      {/* Tab: Red del Nodo */}
      {tab === 'network' && <NetworkConfig />}

      {/* Tab: Federar Aldeas */}
      {tab === 'peers' && <FederationPeers />}

      {/* Tab: Nodos Federados (info auto-sincronizada) */}
      {tab === 'nodes' && <PeersNetInfo />}

      {/* Tab: Descubrir Nodos (gossip + solicitudes) */}
      {tab === 'discover' && <NodeDiscovery />}

      {/* Tab: Gobernanza */}
      {tab === 'gov' && <FederationGov />}

      {/* Tab: Satelite (nodo portatil para ferias offline) */}
      {tab === 'satellite' && <SatelliteSetup />}
    </div>
  )
}

// PeersNetInfo muestra la info de red y servicios de los nodos federados.
// Esta info se sincroniza automaticamente cuando un nodo cambia su config.
function PeersNetInfo() {
  const [peers, setPeers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)

  const loadPeers = async () => {
    setLoading(true)
    try {
      const res = await api.get('/federation/peers-info')
      setPeers(res as any)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPeers()
  }, [])

  const syncNow = async () => {
    setSyncing(true)
    setMsg(null)
    try {
      // Forzar sincronizacion: llamar al endpoint de mi info para que
      // el backend la envie a los peers
      await api.get('/network/my-info')
      setMsg({ type: 'success', text: 'Sincronizacion iniciada. Los nodos federados recibiran la info actualizada.' })
      await loadPeers()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Error al sincronizar' })
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return <div className="text-center text-gray-500 py-8">Cargando nodos federados...</div>
  }

  return (
    <div className="space-y-4">
      {/* Explicacion */}
      <div className="card p-4 bg-blue-50 border-blue-200">
        <h3 className="font-semibold flex items-center gap-2 mb-2">
          <Server size={18} className="text-blue-600" /> Nodos Federados
        </h3>
        <p className="text-sm text-gray-600">
          Esta informacion se <strong>sincroniza automaticamente</strong> entre nodos federados.
          Cuando un nodo cambia su dominio, IP, WireGuard o servicios, todos los demas
          lo reciben automaticamente. No necesitas compartir nada manualmente.
        </p>
        <button
          onClick={syncNow}
          disabled={syncing}
          className="mt-3 px-3 py-1.5 bg-trueque-600 text-white rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
        </button>
        {msg && (
          <div className={`mt-2 p-2 rounded text-sm ${msg.type === 'success' ? 'bg-green-100 text-green-700' : msg.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            {msg.text}
          </div>
        )}
      </div>

      {/* Lista de nodos federados */}
      {peers.length === 0 ? (
        <div className="card p-6 text-center text-gray-500">
          <Server size={32} className="mx-auto mb-2 text-gray-300" />
          <p>No hay nodos federados con info de red.</p>
          <p className="text-xs mt-1">Federate con otra aldea en "Federar Aldeas" para ver su info aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {peers.map((peer) => (
            <div key={peer.node_domain} className="card p-4 space-y-3">
              {/* Header del nodo */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    <MapPin size={14} className="text-trueque-600" />
                    {peer.node_name || peer.node_domain}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">{peer.node_domain}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${peer.network_mode === 'both' ? 'bg-purple-100 text-purple-700' : peer.network_mode === 'intranet' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                  {peer.network_mode === 'both' ? 'Internet + Intranet' : peer.network_mode === 'intranet' ? 'Intranet' : 'Internet'}
                </span>
              </div>

              {/* Direcciones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {peer.public_domain && (
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-xs text-gray-500">Dominio / IP publica</div>
                    <div className="font-mono text-sm">{peer.public_domain}</div>
                  </div>
                )}
                {peer.ipv6_ula && (
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-xs text-gray-500">IPv6 ULA (intranet)</div>
                    <div className="font-mono text-sm">{peer.ipv6_ula}</div>
                  </div>
                )}
                {peer.wireguard_endpoint && (
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-xs text-gray-500">Endpoint WireGuard</div>
                    <div className="font-mono text-sm">{peer.wireguard_endpoint}</div>
                  </div>
                )}
                {peer.wireguard_public_key && (
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-xs text-gray-500">Clave publica WireGuard</div>
                    <div className="font-mono text-xs break-all">{peer.wireguard_public_key}</div>
                  </div>
                )}
              </div>

              {/* Servicios del nodo */}
              {peer.services && Array.isArray(peer.services) && peer.services.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                    <Wifi size={12} /> Servicios levantados ({peer.services.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {peer.services.map((svc: any, i: number) => (
                      <div key={i} className="bg-trueque-50 border border-trueque-200 px-3 py-1.5 rounded-lg text-sm">
                        <div className="font-medium">{svc.name}</div>
                        {svc.url && <div className="text-xs text-gray-500 font-mono">{svc.url}</div>}
                        {svc.description && <div className="text-xs text-gray-400">{svc.description}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ultima actualizacion */}
              <div className="text-xs text-gray-400 border-t pt-2">
                Actualizado: {fmtDateTime(peer.last_updated)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
