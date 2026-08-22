import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Network, Globe, Scale } from 'lucide-react'
import NetworkConfig from './NetworkConfig'
import FederationPeers from './FederationPeers'
import FederationGov from './FederationGov'

// Pagina unificada de Federacion con 3 tabs:
// 1. Red del Nodo: registro de red (IP, OpenWrt, servicios, instalador)
// 2. Federar Aldeas: agregar y gestionar aldeas federadas (Internet + Intranet)
// 3. Gobernanza: propuestas, votacion, constantes federadas
export default function Federation() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as any) || 'network'
  const [tab, setTab] = useState<'network' | 'peers' | 'gov'>(initialTab)

  const changeTab = (t: 'network' | 'peers' | 'gov') => {
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
          onClick={() => changeTab('gov')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${tab === 'gov' ? 'bg-trueque-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
        >
          <Scale size={14} />
          Gobernanza
        </button>
      </div>

      {/* Tab: Red del Nodo */}
      {tab === 'network' && <NetworkConfig />}

      {/* Tab: Federar Aldeas */}
      {tab === 'peers' && <FederationPeers />}

      {/* Tab: Gobernanza */}
      {tab === 'gov' && <FederationGov />}
    </div>
  )
}
