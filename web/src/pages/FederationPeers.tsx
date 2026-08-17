import { useState, useEffect } from 'react'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { Globe, Plus, Trash2, Key, Copy, CheckCircle, AlertCircle, Link2, HelpCircle } from 'lucide-react'

interface Peer {
  peer_domain: string
  peer_name?: string
  peer_public_key: string
  peer_endpoint?: string
  status: string
  mutual_verified: boolean
  notes?: string
  created_at: string
}

interface NodeKeys {
  node_domain: string
  node_name: string
  node_public_key: string
  initialized: boolean
}

export default function FederationPeers() {
  const { hasPermission } = usePermissions()
  const [peers, setPeers] = useState<Peer[]>([])
  const [nodeKeys, setNodeKeys] = useState<NodeKeys | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [copied, setCopied] = useState(false)

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
  }, [])

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

  const addPeer = async () => {
    setError('')
    try {
      await api.post('/federation/peers', newPeer)
      setShowAdd(false)
      setNewPeer({ peer_domain: '', peer_name: '', peer_public_key: '', peer_endpoint: '', notes: '' })
      setSuccess('Nodo peer registrado')
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
        <h1 className="text-2xl font-bold flex items-center gap-2"><Globe size={24} /> Federacion de Nodos</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Federacion de Nodos - Ayuda</strong></p>
          <p><strong>Para que sirve:</strong> La federacion conecta tu nodo con nodos de otras comunidades. Esto permite que los usuarios de tu comunidad puedan intercambiar con usuarios de otras comunidades federadas.</p>
          <p><strong>Tu nodo:</strong> Muestra el nombre, dominio y clave publica de tu nodo. Comparte tu clave publica con el administrador del otro nodo para que te registre.</p>
          <p><strong>Nodos federados:</strong> Lista de los nodos que has registrado como pares. Cada uno tiene un estado (activo, pendiente) y muestra si la verificacion es mutua.</p>
          <p><strong>Como federar:</strong> Sigue los pasos que aparecen abajo. Necesitas la clave publica del otro nodo y ellos necesitan la tuya. La federacion solo funciona cuando ambos se registran mutuamente.</p>
          <p><strong>Clave publica:</strong> Es un identificador criptografico (Ed25519) que identifica univocamente a tu nodo. No es secreta, puedes compartirla libremente.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
      {success && <div className="text-green-600 text-sm flex items-center gap-2"><CheckCircle size={16} /> {success}</div>}

      {/* Tu nodo — clave publica */}
      {nodeKeys && (
        <div className="card bg-blue-50 border-blue-200">
          <h2 className="font-semibold flex items-center gap-2 mb-2"><Key size={18} /> Tu nodo</h2>
          <div className="space-y-1 text-sm">
            <p><span className="text-gray-500">Nombre:</span> <strong>{nodeKeys.node_name}</strong></p>
            <p><span className="text-gray-500">Dominio:</span> <strong>{nodeKeys.node_domain}</strong></p>
          </div>
          <div className="mt-3">
            <label className="text-xs text-gray-500 block mb-1">Tu clave publica (compartir con otros nodos):</label>
            <div className="flex gap-2">
              <code className="flex-1 text-xs bg-white p-2 rounded border border-blue-200 break-all font-mono">
                {nodeKeys.node_public_key}
              </code>
              <button onClick={copyPublicKey} className="btn-primary text-sm py-1 px-3 flex items-center gap-1">
                {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nodos pares registrados */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold flex items-center gap-2"><Link2 size={18} /> Nodos federados ({peers.length})</h2>
          {canManage && (
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Registrar Nodo Peer
            </button>
          )}
        </div>

        {peers.length === 0 && (
          <div className="card text-center text-gray-500 py-8">
            No hay nodos pares registrados.
            <p className="text-xs mt-2">Para federarte con otro nodo, registra su dominio y clave publica aqui,
            y pide al otro nodo que registre tu clave publica.</p>
          </div>
        )}

        {peers.map((p) => (
          <div key={p.peer_domain} className="card flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-blue-600" />
                <p className="font-medium">{p.peer_name || p.peer_domain}</p>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  p.status === 'active' ? 'bg-green-100 text-green-700' :
                  p.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{p.status}</span>
                {p.mutual_verified && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle size={12} /> Mutuo
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{p.peer_domain}</p>
              {p.peer_endpoint && <p className="text-xs text-gray-400">{p.peer_endpoint}</p>}
              <code className="text-xs text-gray-400 block">{p.peer_public_key.substring(0, 24)}...</code>
            </div>
            {canManage && (
              <button onClick={() => removePeer(p.peer_domain)} className="text-red-500 hover:text-red-700">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Info: como federar */}
      <div className="card bg-amber-50 border-amber-200">
        <h3 className="font-medium text-amber-800 mb-2">Como federar dos nodos</h3>
        <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
          <li>Copia tu clave publica (arriba) y enviasela al admin del otro nodo</li>
          <li>Pide la clave publica del otro nodo</li>
          <li>Registra el otro nodo aqui (dominio + clave publica)</li>
          <li>Pide al otro nodo que te registre a ti</li>
          <li>Cuando ambos se han registrado, la federacion esta activa</li>
        </ol>
      </div>

      {/* Modal: Registrar peer */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-xl p-6 w-96 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">Registrar Nodo Peer</h2>
            <div>
              <label className="label">Dominio del nodo remoto</label>
              <input className="input" placeholder="Ej: nodo-b.org" value={newPeer.peer_domain} onChange={(e) => setNewPeer({ ...newPeer, peer_domain: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Identificador unico del otro nodo.</p>
            </div>
            <div>
              <label className="label">Nombre (opcional)</label>
              <input className="input" placeholder="Ej: Banco Comunitario B" value={newPeer.peer_name} onChange={(e) => setNewPeer({ ...newPeer, peer_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Clave publica (64 hex chars)</label>
              <textarea className="input font-mono text-xs" rows={3} placeholder="Ej: a1b2c3d4..." value={newPeer.peer_public_key} onChange={(e) => setNewPeer({ ...newPeer, peer_public_key: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">La clave publica Ed25519 del otro nodo. Te la debe dar su administrador.</p>
            </div>
            <div>
              <label className="label">URL del nodo (opcional)</label>
              <input className="input" placeholder="Ej: https://nodo-b.org" value={newPeer.peer_endpoint} onChange={(e) => setNewPeer({ ...newPeer, peer_endpoint: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Direccion HTTPS para conectarse via federacion.</p>
            </div>
            <div>
              <label className="label">Notas (opcional)</label>
              <input className="input" placeholder="Ej: Nodo de la comunidad vecina" value={newPeer.notes} onChange={(e) => setNewPeer({ ...newPeer, notes: e.target.value })} />
            </div>
            <button onClick={addPeer} className="btn-primary w-full">Registrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
