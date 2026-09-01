import { useState, useEffect } from 'react'
import { Satellite, Download, Upload, RefreshCw, Users, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react'
import { api } from '../api'
import { fmtDateTime } from '../lib/format'

export default function SatelliteSetup() {
  const [status, setStatus] = useState<any>(null)
  const [cachedUsers, setCachedUsers] = useState<any[]>([])
  const [pendingTx, setPendingTx] = useState<any[]>([])
  const [nodeUrl, setNodeUrl] = useState('')
  const [syncUrl, setSyncUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const loadStatus = async () => {
    try {
      const s = await api.get<any>('/satellite/snapshot/status')
      setStatus(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar estado')
    }
  }

  const loadCachedUsers = async () => {
    try {
      const users = await api.get<any[]>('/satellite/cached-users')
      setCachedUsers(Array.isArray(users) ? users : [])
    } catch (err) {
      // silencioso
    }
  }

  const loadPendingTx = async () => {
    try {
      const txs = await api.get<any[]>('/satellite/pending-tx')
      setPendingTx(Array.isArray(txs) ? txs : [])
    } catch (err) {
      // silencioso
    }
  }

  useEffect(() => {
    loadStatus()
    loadCachedUsers()
    loadPendingTx()
  }, [])

  const handleSnapshotPull = async () => {
    if (!nodeUrl) {
      setError('Ingresa la URL del nodo origen (ej: https://nodo1.com:8443)')
      return
    }
    setLoading(true)
    setError('')
    setMsg('')
    try {
      const result = await api.post<any>('/satellite/snapshot/pull', { node_url: nodeUrl })
      setMsg(`Snapshot descargado: ${result.users_cached} usuarios, ${result.cards_cached} tarjetas cacheados`)
      loadStatus()
      loadCachedUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al descargar snapshot')
    } finally {
      setLoading(false)
    }
  }

  const handleSyncAll = async () => {
    if (!syncUrl) {
      setError('Ingresa la URL del nodo origen para sincronizar')
      return
    }
    setLoading(true)
    setError('')
    setMsg('')
    try {
      const result = await api.post<any>('/satellite/sync-all', { node_url: syncUrl })
      setMsg(`Sincronizacion completa: ${result.synced} transacciones enviadas, ${result.failed} fallidas`)
      loadStatus()
      loadPendingTx()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al sincronizar')
    } finally {
      setLoading(false)
    }
  }

  const isSatellite = status?.is_satellite === true

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Satellite size={24} className="text-purple-600" />
        <h2 className="text-xl font-bold">Nodo Satelite</h2>
      </div>

      {!isSatellite && (
        <div className="card bg-amber-50 border-amber-200 text-sm text-amber-800">
          <p><strong>Este nodo no esta configurado como satelite.</strong></p>
          <p className="mt-1">Para configurarlo como satelite, establece <code>NODE_TYPE=satellite</code> en las variables de entorno del nodo y reinicia.</p>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
      {msg && <div className="text-green-700 text-sm bg-green-50 p-3 rounded-lg">{msg}</div>}

      {/* Estado del cache */}
      {status && (
        <div className="card">
          <h3 className="font-semibold flex items-center gap-2 mb-3"><RefreshCw size={16} /> Estado del Cache</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <Users size={16} className="text-blue-600 mb-1" />
              <div className="text-gray-500 text-xs">Usuarios cacheados</div>
              <div className="font-bold text-lg">{status.users_cached || 0}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <CreditCard size={16} className="text-indigo-600 mb-1" />
              <div className="text-gray-500 text-xs">Tarjetas cacheadas</div>
              <div className="font-bold text-lg">{status.cards_cached || 0}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <AlertTriangle size={16} className="text-orange-600 mb-1" />
              <div className="text-gray-500 text-xs">Tx pendientes</div>
              <div className="font-bold text-lg">{status.pending_tx || 0}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <CheckCircle size={16} className="text-green-600 mb-1" />
              <div className="text-gray-500 text-xs">Ultimo snapshot</div>
              <div className="font-bold text-xs">{status.last_cached_at ? fmtDateTime(status.last_cached_at) : 'Nunca'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Pull */}
      <div className="card space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Download size={16} /> Descargar Snapshot (antes de desconectar)</h3>
        <p className="text-xs text-gray-500">
          Descarga el estado actual de usuarios y tarjetas del nodo origen. Esto permite operar offline en la feria.
          Debes ejecutar esto ANTES de desconectarte de la red.
        </p>
        <div>
          <label className="label">URL del nodo origen (servidor federado mTLS)</label>
          <input
            className="input"
            placeholder="https://nodo1.com:8443"
            value={nodeUrl}
            onChange={(e) => setNodeUrl(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">La URL del servidor federado del nodo principal. Incluye el puerto mTLS (ej: 8443).</p>
        </div>
        <button
          onClick={handleSnapshotPull}
          disabled={loading || !isSatellite}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Download size={18} />
          {loading ? 'Descargando...' : 'Descargar Snapshot'}
        </button>
      </div>

      {/* Sync Push */}
      <div className="card space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Upload size={16} /> Sincronizar Transacciones (al reconectar)</h3>
        <p className="text-xs text-gray-500">
          Envia las transacciones registradas offline al nodo origen. Ejecuta esto cuando recuperes conexion a internet o intranet.
        </p>
        <div>
          <label className="label">URL del nodo origen</label>
          <input
            className="input"
            placeholder="https://nodo1.com:8443"
            value={syncUrl}
            onChange={(e) => setSyncUrl(e.target.value)}
          />
        </div>
        <button
          onClick={handleSyncAll}
          disabled={loading || !isSatellite || (status?.pending_tx || 0) === 0}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Upload size={18} />
          {loading ? 'Sincronizando...' : `Sincronizar ${status?.pending_tx || 0} transacciones`}
        </button>
      </div>

      {/* Usuarios cacheados */}
      {cachedUsers.length > 0 && (
        <div className="card">
          <h3 className="font-semibold flex items-center gap-2 mb-3"><Users size={16} /> Usuarios en Cache ({cachedUsers.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="pb-2">Usuario</th>
                  <th className="pb-2">Nodo</th>
                  <th className="pb-2">Saldo</th>
                  <th className="pb-2">Limite credito</th>
                  <th className="pb-2">Estado</th>
                  <th className="pb-2">Cacheado</th>
                </tr>
              </thead>
              <tbody>
                {cachedUsers.slice(0, 50).map((u, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 font-medium">{u.username}</td>
                    <td className="py-2 text-xs text-gray-500">{u.node_domain}</td>
                    <td className="py-2">{(u.balance / 100).toFixed(2)} TQ</td>
                    <td className="py-2">{(u.credit_limit / 100).toFixed(2)} TQ</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${u.membership_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {u.membership_status}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-gray-400">{u.cached_at ? fmtDateTime(u.cached_at) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cachedUsers.length > 50 && (
              <p className="text-xs text-gray-400 mt-2">Mostrando 50 de {cachedUsers.length} usuarios</p>
            )}
          </div>
        </div>
      )}

      {/* Transacciones pendientes */}
      {pendingTx.length > 0 && (
        <div className="card">
          <h3 className="font-semibold flex items-center gap-2 mb-3"><AlertTriangle size={16} /> Transacciones Pendientes ({pendingTx.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="pb-2">ID</th>
                  <th className="pb-2">Emisor</th>
                  <th className="pb-2">Nodo emisor</th>
                  <th className="pb-2">Monto</th>
                  <th className="pb-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {pendingTx.map((tx, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 text-xs font-mono">{tx.id?.slice(0, 8)}...</td>
                    <td className="py-2 text-xs font-mono">{tx.sender_id?.slice(0, 8)}...</td>
                    <td className="py-2 text-xs">{tx.sender_node}</td>
                    <td className="py-2 font-medium">{(tx.amount / 100).toFixed(2)} TQ</td>
                    <td className="py-2 text-xs text-gray-400">{tx.created_at ? fmtDateTime(tx.created_at) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
