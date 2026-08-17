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
          <p><strong>Como usar esta pagina:</strong> Copia tu clave publica y enviasela al admin del otro nodo. Pide la clave publica del otro nodo. Registra el otro nodo aqui (dominio + clave publica). Pide al otro nodo que te registre a ti. Cuando ambos se han registrado, la federacion esta activa.</p>
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
              <p className="text-xs text-gray-400 mt-1">Identificador unico del otro nodo en la red federada. Ejemplo: <code>nodo-b.org</code></p>
            </div>
            <div>
              <label className="label">Nombre (opcional)</label>
              <input className="input" placeholder="Ej: Banco Comunitario B" value={newPeer.peer_name} onChange={(e) => setNewPeer({ ...newPeer, peer_name: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Nombre descriptivo del nodo para identificarlo facilmente. Ejemplo: <code>Banco Comunitario B</code></p>
            </div>
            <div>
              <label className="label">Clave publica (64 caracteres hexadecimales)</label>
              <textarea className="input font-mono text-xs" rows={3} placeholder="Ej: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678" value={newPeer.peer_public_key} onChange={(e) => setNewPeer({ ...newPeer, peer_public_key: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">La clave publica Ed25519 del otro nodo (64 hex chars). Te la debe dar su administrador. Ejemplo: <code>a1b2c3d4e5f6...</code></p>
            </div>
            <div>
              <label className="label">URL del nodo (opcional)</label>
              <input className="input" placeholder="Ej: https://nodo-b.org" value={newPeer.peer_endpoint} onChange={(e) => setNewPeer({ ...newPeer, peer_endpoint: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Direccion HTTPS para conectarse via federacion. Ejemplo: <code>https://nodo-b.org</code></p>
            </div>
            <div>
              <label className="label">Notas (opcional)</label>
              <input className="input" placeholder="Ej: Nodo de la comunidad vecina del norte" value={newPeer.notes} onChange={(e) => setNewPeer({ ...newPeer, notes: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Notas internas para recordar quien es este nodo. Ejemplo: <code>Nodo de la comunidad vecina del norte</code></p>
            </div>
            <button onClick={addPeer} className="btn-primary w-full">Registrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
