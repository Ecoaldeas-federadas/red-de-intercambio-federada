import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { useConfig } from '../hooks/useConfig'
import { Globe, Plus, Trash2, Key, Copy, CheckCircle, AlertCircle, Link2, HelpCircle, ArrowUpCircle, ArrowDownCircle, FileText, Award, Handshake, Shield, Ban, Unlock } from 'lucide-react'
import { fmtTQ } from '../lib/format'

interface Peer {
  peer_domain: string
  peer_name?: string
  peer_public_key: string
  peer_endpoint?: string
  status: string
  mutual_verified: boolean
  notes?: string
  created_at: string
  auto_accepted?: boolean
  propagated_by?: string
}

interface Block {
  blocker_domain: string
  blocked_domain: string
  reason: string
  blocked_at: string
}

interface NodeKeys {
  node_domain: string
  node_name: string
  node_public_key: string
  initialized: boolean
}

interface NodeLevel {
  peer_domain: string
  level: number
  level_name: string
  limit: number
  effective_limit: number
  held_limit: number
  can_vote: boolean
  can_sponsor: boolean
}

interface Sponsorship {
  id: string
  sponsor_domain: string
  sponsored_domain: string
  sponsored_name?: string
  held_limit: number
  created_at: string
  status: string
}

export default function FederationPeers() {
  const { t } = useTranslation(['federation', 'common'])
  const { currency } = useConfig()
  const { hasPermission } = usePermissions()
  const [peers, setPeers] = useState<Peer[]>([])
  const [nodeKeys, setNodeKeys] = useState<NodeKeys | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [copied, setCopied] = useState(false)
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [expandedPeer, setExpandedPeer] = useState<string | null>(null)
  const [peerTxs, setPeerTxs] = useState<any[]>([])
  const [loadingTxs, setLoadingTxs] = useState(false)
  const [nodeLevels, setNodeLevels] = useState<Record<string, NodeLevel>>({})
  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])

  const canManage = hasPermission('federation.change_config')

  const [newPeer, setNewPeer] = useState({
    peer_domain: '',
    peer_name: '',
    peer_public_key: '',
    peer_endpoint: '',
    notes: '',
  })

  useEffect(() => {
    loadPeers()
    loadNodeKeys()
    loadBalances()
    loadNodeLevels()
    loadSponsorships()
    loadBlocks()
  }, [])

  const loadBalances = async () => {
    try {
      const res = await api.get<any>('/federation/balances')
      const list = Array.isArray(res) ? res : res?.balances ?? []
      const map: Record<string, number> = {}
      list.forEach((b: any) => {
        map[b.remote_node || b.peer_domain] = b.balance ?? 0
      })
      setBalances(map)
    } catch {}
  }

  const loadPeers = async () => {
    try {
      const res = await api.get<Peer[]>('/federation/peers')
      setPeers(res || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const loadNodeKeys = async () => {
    try {
      const res = await api.get<NodeKeys>('/setup/node-keys')
      setNodeKeys(res)
    } catch {
      // El nodo puede no estar inicializado aun
    }
  }

  const loadNodeLevels = async () => {
    try {
      const res = await api.get<any>('/federation/node-levels')
      const list = Array.isArray(res) ? res : res?.levels ?? []
      const map: Record<string, NodeLevel> = {}
      list.forEach((l: any) => {
        map[l.peer_domain || l.node_domain] = l
      })
      setNodeLevels(map)
    } catch {
      // Los niveles pueden no estar disponibles aun
    }
  }

  const loadSponsorships = async () => {
    try {
      const res = await api.get<any>('/federation/sponsorships')
      const list = Array.isArray(res) ? res : res?.sponsorships ?? []
      setSponsorships(list)
    } catch {
      // Los patrocinios pueden no estar disponibles aun
    }
  }

  const loadBlocks = async () => {
    try {
      const res = await api.get<any>('/federation/blocks')
      const list = Array.isArray(res) ? res : res?.blocks ?? []
      setBlocks(list)
    } catch {
      // Los bloqueos pueden no estar disponibles aun
    }
  }

  const isBlocked = (peerDomain: string) => {
    return blocks.some(b =>
      (b.blocker_domain === peerDomain && b.blocked_domain === nodeKeys?.node_domain) ||
      (b.blocker_domain === nodeKeys?.node_domain && b.blocked_domain === peerDomain)
    )
  }

  const isBlockedByMe = (peerDomain: string) => {
    return blocks.some(b => b.blocker_domain === nodeKeys?.node_domain && b.blocked_domain === peerDomain)
  }

  const blockPeer = async (peerDomain: string) => {
    if (!confirm(t('peers_block_confirm', `Bloquear comercio con ${peerDomain}? Esto detendra todas las transacciones con ese nodo. Solo afecta a tu nodo.`, { domain: peerDomain }))) return
    try {
      const reason = prompt(t('peers_block_reason', 'Razon del bloqueo (opcional):')) || ''
      await api.post(`/federation/block/${peerDomain}`, { reason })
      setSuccess(t('peers_block_success', `Comercio bloqueado con ${peerDomain}. Propagado a todos los peers.`, { domain: peerDomain }))
      setTimeout(() => setSuccess(''), 4000)
      loadBlocks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al bloquear')
    }
  }

  const unblockPeer = async (peerDomain: string) => {
    try {
      await api.delete(`/federation/block/${peerDomain}`)
      setSuccess(t('peers_unblock_success', `Comercio reactivado con ${peerDomain}.`, { domain: peerDomain }))
      setTimeout(() => setSuccess(''), 4000)
      loadBlocks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desbloquear')
    }
  }

  const addPeer = async () => {
    setError('')
    try {
      await api.post('/federation/peers', newPeer)
      setShowAdd(false)
      setNewPeer({ peer_domain: '', peer_name: '', peer_public_key: '', peer_endpoint: '', notes: '' })
      setSuccess(t('peers_peer_registered', 'Nodo peer registrado'))
      setTimeout(() => setSuccess(''), 3000)
      loadPeers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar peer')
    }
  }

  const removePeer = async (peerDomain: string) => {
    try {
      await api.delete(`/federation/peers/${peerDomain}`)
      loadPeers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const loadPeerTxs = async (peerDomain: string) => {
    setLoadingTxs(true)
    setPeerTxs([])
    try {
      const res = await api.get<any[]>(`/federation/peer/${peerDomain}/transactions?limit=100`)
      setPeerTxs(Array.isArray(res) ? res : [])
    } catch {
      setPeerTxs([])
    }
    setLoadingTxs(false)
  }

  const togglePeer = (peerDomain: string) => {
    if (expandedPeer === peerDomain) {
      setExpandedPeer(null)
      setPeerTxs([])
    } else {
      setExpandedPeer(peerDomain)
      loadPeerTxs(peerDomain)
    }
  }

  const exportReport = (peerDomain: string) => {
    const lines = ['Fecha,Tipo,Direccion,Monto,Descripcion,Estado']
    peerTxs.forEach(t => {
      const dir = t.direction === 'debit' ? 'Salida' : 'Entrada'
      const date = String(t.created_at || '').slice(0, 19)
      lines.push(`${date},${t.tx_type},${dir},${t.amount},"${t.description || ''}",${t.status}`)
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `federacion_${peerDomain}_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyPublicKey = () => {
    if (nodeKeys) {
      navigator.clipboard.writeText(nodeKeys.node_public_key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Globe size={24} /> {t('peers_title', 'Federacion de Nodos')}</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Federacion de Nodos - Ayuda</strong></p>
          <p><strong>Que es la federacion:</strong> La federacion es un mecanismo que conecta tu nodo local con nodos de otras comunidades, permitiendo que los usuarios de tu red de intercambio puedan comerciar con usuarios de otras redes federadas, sin necesidad de un banco o entidad central.</p>
          <p><strong>Para que sirve:</strong> Permite extender el alcance de la red de intercambio mas alla de tu comunidad local. Por ejemplo, si tu nodo es de una comunidad en Madrid y te federas con un nodo en Barcelona, los usuarios de ambos nodos pueden intercambiar bienes y servicios entre si.</p>
          <p><strong>Que es un nodo peer:</strong> Un nodo peer (par) es otro nodo de la red de intercambio que has registrado en tu sistema para establecer una conexion federada. Cada nodo peer tiene su propio dominio, clave publica y estado de verificacion.</p>
          <p><strong>Como registrar un nodo:</strong> Haz clic en "Registrar Nodo Peer", completa el formulario con el dominio, nombre y clave publica del otro nodo, y guarda. El otro nodo debe hacer lo mismo con tus datos para que la federacion sea mutua.</p>
          <p><strong>Que es el dominio:</strong> Es el identificador unico del nodo en la red federada, normalmente un nombre de dominio de internet. Ejemplo: <code>nodo-b.org</code>. Sirve para localizar y autenticar al nodo remoto.</p>
          <p><strong>Que son las claves publicas:</strong> Son identificadores criptograficos basados en el algoritmo Ed25519 (64 caracteres hexadecimales) que identifican univocamente a cada nodo. No son secretas: puedes compartirlas libremente. Sirven para verificar que los mensajes entre nodos son autenticos y no han sido manipulados.</p>
          <p><strong>Como funciona la comunicacion entre nodos:</strong> Cuando dos nodos se federan mutuamente, establecen un canal seguro usando sus claves publicas. Las transacciones entre usuarios de distintos nodos se envian via HTTPS, firmadas criptograficamente. Cada nodo mantiene un saldo bilateral con cada peer (ver pagina de Limites de Federacion).</p>
          <p><strong>Estados de un nodo peer:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>active:</strong> El nodo esta registrado y la federacion es mutua (ambos se han registrado).</li>
            <li><strong>pending:</strong> El nodo esta registrado de tu lado pero el otro nodo aun no te ha registrado.</li>
            <li><strong>Mutuo:</strong> Indica que ambos nodos se han registrado mutuamente y la federacion esta activa.</li>
          </ul>
          <p><strong>Niveles de nodo federado:</strong> Cada nodo tiene un nivel que determina su limite y capacidades:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Nivel 1 (Nodo Nuevo):</strong> Limite 1.000 TQ, sin voto, sin patrocinio. Minimo 90 dias antes de promocion.</li>
            <li><strong>Nivel 2 (Nodo Aceptado):</strong> Limite 5.000 TQ, con voto y capacidad de patrocinar. Se alcanza por votacion de la federacion.</li>
            <li><strong>Nivel 3 (Nodo Pleno):</strong> Limite 20.000 TQ. Promocion automatica al cumplir reciprocidad y limite promedio.</li>
          </ul>
          <p><strong>Limite efectivo:</strong> El limite efectivo de un nodo es su limite nominal menos el limite retenido por patrocinios activos. Cuando un nodo patrocina a otro, su limite se reduce temporalmente. Se libera cuando el nodo patrocinado alcanza el Nivel 2.</p>
          <p><strong>Piscina global multilateral:</strong> Ademas de los saldos bilaterales entre pares de nodos, existe una piscina global compartida. El saldo que ganas en un nodo es gastable en cualquier otro nodo federado.</p>
          <p><strong>Como usar esta pagina:</strong> Copia tu clave publica y enviasela al admin del otro nodo. Pide la clave publica del otro nodo. Registra el otro nodo aqui (dominio + clave publica). Pide al otro nodo que te registre a ti. Cuando ambos se han registrado, la federacion esta activa.</p>
          <p><strong>Federacion automatica global (NUEVO):</strong> Cuando un nodo nuevo se federa con un sponsor via verificacion de 4 opciones, el sponsor propaga automaticamente la info del nuevo nodo a todos sus peers en cadena exponencial. Cada nodo establece una relacion 1-a-1 individual con el nuevo nodo. No necesitas federarte manualmente con cada nodo — al federarte con uno, entras a toda la red. Los nodos marcados como <strong>Auto-registrado</strong> fueron agregados via propagacion automatica.</p>
          <p><strong>Bloqueo unilateral (NUEVO):</strong> Puedes bloquear comercio con un nodo especifico sin necesidad de acuerdo. Solo afecta a tu nodo — los demas siguen comerciando. Util para dejar de comerciar con un nodo problematico sin afectar a la red.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('peers_help_close', t('common:close'))}</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
      {success && <div className="text-green-600 text-sm flex items-center gap-2"><CheckCircle size={16} /> {success}</div>}

      {/* Tu nodo — clave publica */}
      {nodeKeys && (
        <div className="card bg-blue-50 border-blue-200">
          <h2 className="font-semibold flex items-center gap-2 mb-2"><Key size={18} /> {t('peers_your_node', 'Tu nodo')}</h2>
          <div className="space-y-1 text-sm">
            <p><span className="text-gray-500">{t('peers_name', 'Nombre:')}</span> <strong>{nodeKeys.node_name}</strong></p>
            <p><span className="text-gray-500">{t('peers_domain', 'Dominio:')}</span> <strong>{nodeKeys.node_domain}</strong></p>
          </div>
          <div className="mt-3">
            <label className="text-xs text-gray-500 block mb-1">{t('peers_your_pub_key', 'Tu clave publica (compartir con otros nodos):')}</label>
            <div className="flex gap-2">
              <code className="flex-1 text-xs bg-white p-2 rounded border border-blue-200 break-all font-mono">
                {nodeKeys.node_public_key}
              </code>
              <button onClick={copyPublicKey} className="btn-primary text-sm py-1 px-3 flex items-center gap-1">
                {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copied ? t('peers_copied', 'Copiado') : t('peers_copy', 'Copiar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nodos pares registrados */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold flex items-center gap-2"><Link2 size={18} /> {t('peers_federated_nodes', 'Nodos federados ({{count}})', { count: peers.length })}</h2>
          {canManage && (
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> {t('peers_register_node', 'Registrar Nodo Peer')}
            </button>
          )}
        </div>

        {peers.length === 0 && (
          <div className="card text-center text-gray-500 py-8">
            {t('peers_no_peers', 'No hay nodos pares registrados.')}
            <p className="text-xs mt-2">{t('peers_no_peers_hint', 'Para federarte con otro nodo, registra su dominio y clave publica aqui, y pide al otro nodo que registre tu clave publica.')}</p>
          </div>
        )}

        {peers.map((p) => {
          const bal = balances[p.peer_domain] ?? 0
          const isExpanded = expandedPeer === p.peer_domain
          const levelInfo = nodeLevels[p.peer_domain]
          const levelBadge = levelInfo ? {
            1: { label: 'Nivel 1: Nodo Nuevo', class: 'bg-gray-100 text-gray-600' },
            2: { label: 'Nivel 2: Nodo Aceptado', class: 'bg-emerald-100 text-emerald-700' },
            3: { label: 'Nivel 3: Nodo Pleno', class: 'bg-purple-100 text-purple-700' },
          }[levelInfo.level] || null : null
          return (
          <div key={p.peer_domain} className="card">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Globe size={16} className="text-blue-600" />
                  <p className="font-medium">{p.peer_name || p.peer_domain}</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    p.status === 'active' ? 'bg-green-100 text-green-700' :
                    p.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{p.status}</span>
                  {p.mutual_verified && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded flex items-center gap-1">
                      <CheckCircle size={12} /> {t('peers_mutual', 'Mutuo')}
                    </span>
                  )}
                  {p.auto_accepted && (
                    <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded flex items-center gap-1">
                      <Link2 size={12} /> {t('peers_auto_registered', 'Auto-registrado')}
                    </span>
                  )}
                  {p.propagated_by && (
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
                      via {p.propagated_by}
                    </span>
                  )}
                  {isBlocked(p.peer_domain) && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded flex items-center gap-1">
                      <Ban size={12} /> {t('peers_blocked', 'Bloqueado')}
                    </span>
                  )}
                  {levelBadge && (
                    <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${levelBadge.class}`}>
                      <Award size={12} /> {levelBadge.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{p.peer_domain}</p>
                {p.peer_endpoint && <p className="text-xs text-gray-400">{p.peer_endpoint}</p>}
                <code className="text-xs text-gray-400 block">{p.peer_public_key.substring(0, 24)}...</code>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-600">{t('peers_bilateral_balance', 'Saldo bilateral:')}</span>
                  <span className={`text-sm font-bold ${bal > 0 ? 'text-green-600' : bal < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {bal > 0 ? '+' : ''}{fmtTQ(bal)} {currency}
                  </span>
                  {bal > 0 && <span className="text-xs text-green-600">{t('peers_you_owed', '(te deben)')}</span>}
                  {bal < 0 && <span className="text-xs text-red-600">{t('peers_you_owe', '(debes)')}</span>}
                  {bal === 0 && <span className="text-xs text-gray-400">{t('peers_no_transactions_balance', '(sin transacciones)')}</span>}
                </div>

                {/* Limite efectivo considerando patrocinios */}
                {levelInfo && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-gray-600 flex items-center gap-1">
                      <Shield size={12} /> {t('peers_nominal_limit', 'Limite nominal:')}
                      <strong className="font-bold text-gray-700">{fmtTQ(levelInfo.limit)} {currency}</strong>
                    </span>
                    {levelInfo.held_limit > 0 && (
                      <span className="text-amber-600 flex items-center gap-1">
                        {t('peers_held_limit', 'Retenido por patrocinios:')}
                        <strong className="font-bold">-{fmtTQ(levelInfo.held_limit)} {currency}</strong>
                      </span>
                    )}
                    <span className="text-gray-600 flex items-center gap-1">
                      {t('peers_effective_limit', 'Limite efectivo:')}
                      <strong className={`font-bold ${levelInfo.effective_limit < levelInfo.limit ? 'text-amber-600' : 'text-green-600'}`}>
                        {fmtTQ(levelInfo.effective_limit)} {currency}
                      </strong>
                    </span>
                    {levelInfo.can_vote && (
                      <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle size={10} /> {t('peers_can_vote', 'Voto')}
                      </span>
                    )}
                    {levelInfo.can_sponsor && (
                      <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Handshake size={10} /> {t('peers_can_sponsor', 'Puede patrocinar')}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 items-end">
                <button
                  onClick={() => togglePeer(p.peer_domain)}
                  className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                >
                  <FileText size={14} />
                  {isExpanded ? t('peers_hide', 'Ocultar') : t('peers_view_history', 'Ver historial')}
                </button>
                {canManage && (
                  <div className="flex gap-2">
                    {isBlockedByMe(p.peer_domain) ? (
                      <button
                        onClick={() => unblockPeer(p.peer_domain)}
                        className="text-green-600 hover:text-green-700"
                        title={t('peers_unblock', 'Desbloquear comercio')}
                      >
                        <Unlock size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => blockPeer(p.peer_domain)}
                        className="text-amber-600 hover:text-amber-700"
                        title={t('peers_block', 'Bloquear comercio unilateralmente')}
                      >
                        <Ban size={16} />
                      </button>
                    )}
                    <button onClick={() => removePeer(p.peer_domain)} className="text-red-500 hover:text-red-700" title={t('peers_remove_peer', 'Eliminar peer')}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Historial de transacciones expandible */}
            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold">{t('peers_tx_with', 'Transacciones con {{name}}', { name: p.peer_name || p.peer_domain })}</h4>
                  {peerTxs.length > 0 && (
                    <button
                      onClick={() => exportReport(p.peer_domain)}
                      className="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center gap-1"
                    >
                      <FileText size={14} /> {t('peers_export_csv', 'Exportar CSV')}
                    </button>
                  )}
                </div>

                {loadingTxs ? (
                  <p className="text-gray-500 text-sm py-4">{t('peers_loading_txs', 'Cargando transacciones...')}</p>
                ) : peerTxs.length === 0 ? (
                  <p className="text-gray-500 text-sm py-4">{t('peers_no_txs', 'No hay transacciones con este nodo.')}</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {peerTxs.map((t, i) => {
                      const isDebit = t.direction === 'debit'
                      const amount = t.amount || 0
                      return (
                        <div key={i} className="flex items-center justify-between p-2 border border-gray-100 rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-2">
                            {isDebit ? (
                              <ArrowUpCircle size={16} className="text-red-500" />
                            ) : (
                              <ArrowDownCircle size={16} className="text-green-500" />
                            )}
                            <div>
                              <p className="text-sm font-medium">
                                {isDebit ? t('peers_sent_to', 'Enviado a ') : t('peers_received_from', 'Recibido de ')}
                                <span className="font-semibold">{isDebit ? (t.receiver_display || t.receiver_node) : (t.sender_display || t.sender_node)}</span>
                              </p>
                              <p className="text-xs text-gray-500">
                                {String(t.created_at || '').slice(0, 16).replace('T', ' ')}
                                {t.description ? ` - ${t.description}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className={`font-bold text-sm ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                            {isDebit ? '-' : '+'}{fmtTQ(amount)} {currency}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Resumen */}
                {!loadingTxs && peerTxs.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-4">
                    {/* Tarjetas de totales */}
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="bg-red-50 rounded-lg p-2">
                        <p className="text-gray-600 text-xs">{t('peers_total_sent', 'Total enviado')}</p>
                        <p className="font-bold text-red-600 text-lg">
                          -{fmtTQ(peerTxs.filter(t => t.direction === 'debit').reduce((s, t) => s + Math.abs(t.amount || 0), 0))} {currency}
                        </p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2">
                        <p className="text-gray-600 text-xs">{t('peers_total_received', 'Total recibido')}</p>
                        <p className="font-bold text-green-600 text-lg">
                          +{fmtTQ(peerTxs.filter(t => t.direction === 'credit').reduce((s, t) => s + Math.abs(t.amount || 0), 0))} {currency}
                        </p>
                      </div>
                      <div className={`rounded-lg p-2 ${(peerTxs.filter(t => t.direction === 'credit').reduce((s, t) => s + Math.abs(t.amount || 0), 0) - peerTxs.filter(t => t.direction === 'debit').reduce((s, t) => s + Math.abs(t.amount || 0), 0)) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                        <p className="text-gray-600 text-xs">{t('peers_balance', 'Balance')}</p>
                        <p className={`font-bold text-lg ${(peerTxs.filter(t => t.direction === 'credit').reduce((s, t) => s + Math.abs(t.amount || 0), 0) - peerTxs.filter(t => t.direction === 'debit').reduce((s, t) => s + Math.abs(t.amount || 0), 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(() => {
                            const net = peerTxs.filter(t => t.direction === 'credit').reduce((s, t) => s + Math.abs(t.amount || 0), 0) - peerTxs.filter(t => t.direction === 'debit').reduce((s, t) => s + Math.abs(t.amount || 0), 0)
                            return net >= 0 ? '+' : ''
                          })()}
                          {fmtTQ(peerTxs.filter(t => t.direction === 'credit').reduce((s, t) => s + Math.abs(t.amount || 0), 0) - peerTxs.filter(t => t.direction === 'debit').reduce((s, t) => s + Math.abs(t.amount || 0), 0))} {currency}
                        </p>
                      </div>
                    </div>

                    {/* Grafica de barras mensual */}
                    {(() => {
                      const monthly: Record<string, { in: number; out: number }> = {}
                      peerTxs.forEach(t => {
                        const month = String(t.created_at || '').slice(0, 7)
                        if (!monthly[month]) monthly[month] = { in: 0, out: 0 }
                        if (t.direction === 'credit') monthly[month].in += Math.abs(t.amount || 0)
                        if (t.direction === 'debit') monthly[month].out += Math.abs(t.amount || 0)
                      })
                      const months = Object.keys(monthly).sort()
                      const maxVal = Math.max(...months.map(m => Math.max(monthly[m].in, monthly[m].out)), 1)
                      return (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-gray-600 mb-2">{t('peers_monthly_movements', 'Movimientos por mes')}</p>
                          <div className="flex items-end gap-2 h-32">
                            {months.map(m => (
                              <div key={m} className="flex-1 flex flex-col items-center gap-1">
                                <div className="flex items-end gap-0.5 h-24 w-full justify-center">
                                  <div
                                    className="w-3 bg-green-500 rounded-t"
                                    style={{ height: `${(monthly[m].in / maxVal) * 100}%` }}
                                    title={`Entradas: ${monthly[m].in} ${currency}`}
                                  />
                                  <div
                                    className="w-3 bg-red-500 rounded-t"
                                    style={{ height: `${(monthly[m].out / maxVal) * 100}%` }}
                                    title={`Salidas: ${monthly[m].out} ${currency}`}
                                  />
                                </div>
                                <span className="text-xs text-gray-500">{m.slice(5)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-4 mt-2 justify-center text-xs">
                            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded"></span> {t('peers_inputs', 'Entradas')}</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded"></span> {t('peers_outputs', 'Salidas')}</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
          )
        })}
      </div>

      {/* Patrocinios activos (padrinos) */}
      {sponsorships.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Handshake size={18} /> {t('peers_sponsorships', 'Patrocinios Activos ({{count}})', { count: sponsorships.length })}</h2>
          <div className="card bg-amber-50 border-amber-200 text-sm text-amber-700">
            <p>
              {t('peers_sponsorships_desc', 'Los patrocinios activos muestran los nodos que tu nodo esta respaldando como padrino. El limite retenido por cada patrocinio se libera cuando el nodo patrocinado alcanza el Nivel 2.')}
            </p>
          </div>
          {sponsorships.map((s) => (
            <div key={s.id} className="card border-amber-200">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Handshake size={16} className="text-amber-600" />
                    <p className="font-medium text-sm">
                      {t('peers_sponsor', 'Padrino:')} <span className="text-gray-700">{s.sponsor_domain}</span>
                    </p>
                    <span className="text-gray-400 text-xs">→</span>
                    <p className="font-medium text-sm">
                      {t('peers_sponsored', 'Patrocinado:')} <span className="text-gray-700">{s.sponsored_name || s.sponsored_domain}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-amber-600">
                      {t('peers_held_limit_label', 'Limite retenido:')} <strong>{fmtTQ(s.held_limit)} {currency}</strong>
                    </span>
                    <span className={`px-2 py-0.5 rounded ${
                      s.status === 'active' ? 'bg-green-100 text-green-700' :
                      s.status === 'released' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{s.status}</span>
                    <span className="text-gray-400">
                      {String(s.created_at || '').slice(0, 10)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info: como federar */}
      <div className="card bg-amber-50 border-amber-200">
        <h3 className="font-medium text-amber-800 mb-2">{t('peers_how_to_federate', 'Como federar dos nodos')}</h3>
        <div className="text-sm text-amber-700 space-y-2">
          <p><strong>Metodo recomendado (automatico):</strong> Usa la verificacion de 4 opciones en la pagina de Descubrimiento de Nodos. Al confirmar, el nodo se federara automaticamente con toda la red via propagacion en cadena.</p>
          <p><strong>Metodo manual (casos especiales):</strong></p>
          <ol className="space-y-1 list-decimal list-inside">
            <li>Copia tu clave publica (arriba) y enviasela al admin del otro nodo</li>
            <li>Pide la clave publica del otro nodo</li>
            <li>Registra el otro nodo aqui (dominio + clave publica)</li>
            <li>Pide al otro nodo que te registre a ti</li>
            <li>Cuando ambos se han registrado, la federacion esta activa</li>
          </ol>
          <p className="text-xs text-amber-600 mt-2">Nota: El metodo manual solo registra el peer localmente. Para que el nuevo nodo entre a toda la red automaticamente, usa la verificacion de 4 opciones.</p>
        </div>
      </div>

      {/* Modal: Registrar peer */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-xl p-6 w-96 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">{t('peers_register_modal_title', 'Registrar Nodo Peer')}</h2>
            <div>
              <label className="label">{t('peers_register_modal_domain', 'Dominio del nodo remoto')}</label>
              <input className="input" placeholder="Ej: nodo-b.org" value={newPeer.peer_domain} onChange={(e) => setNewPeer({ ...newPeer, peer_domain: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Identificador unico del otro nodo en la red federada. Ejemplo: <code>nodo-b.org</code></p>
            </div>
            <div>
              <label className="label">{t('peers_register_modal_name', 'Nombre (opcional)')}</label>
              <input className="input" placeholder="Ej: Banco Comunitario B" value={newPeer.peer_name} onChange={(e) => setNewPeer({ ...newPeer, peer_name: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Nombre descriptivo del nodo para identificarlo facilmente. Ejemplo: <code>Banco Comunitario B</code></p>
            </div>
            <div>
              <label className="label">{t('peers_register_modal_pubkey', 'Clave publica (64 caracteres hexadecimales)')}</label>
              <textarea className="input font-mono text-xs" rows={3} placeholder="Ej: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678" value={newPeer.peer_public_key} onChange={(e) => setNewPeer({ ...newPeer, peer_public_key: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">La clave publica Ed25519 del otro nodo (64 hex chars). Te la debe dar su administrador. Ejemplo: <code>a1b2c3d4e5f6...</code></p>
            </div>
            <div>
              <label className="label">{t('peers_register_modal_url', 'URL del nodo (opcional)')}</label>
              <input className="input" placeholder="Ej: https://nodo-b.org" value={newPeer.peer_endpoint} onChange={(e) => setNewPeer({ ...newPeer, peer_endpoint: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Direccion HTTPS para conectarse via federacion. Ejemplo: <code>https://nodo-b.org</code></p>
            </div>
            <div>
              <label className="label">{t('peers_register_modal_notes', 'Notas (opcional)')}</label>
              <input className="input" placeholder="Ej: Nodo de la comunidad vecina del norte" value={newPeer.notes} onChange={(e) => setNewPeer({ ...newPeer, notes: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Notas internas para recordar quien es este nodo. Ejemplo: <code>Nodo de la comunidad vecina del norte</code></p>
            </div>
            <button onClick={addPeer} className="btn-primary w-full">{t('peers_register_btn', 'Registrar')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
