import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { AlertTriangle, Users, ArrowRight, Check, X, Search, Vote } from 'lucide-react'

export default function MergeConflicts() {
  const { currency } = useConfig()
  const [conflicts, setConflicts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [scanDomain, setScanDomain] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [selectedConflict, setSelectedConflict] = useState<any>(null)
  const [resolution, setResolution] = useState({ proposed_resolution: 'a', balance_action: 'transfer', notes: '' })
  const [vote, setVote] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/federation/merge-conflicts').then((d: any) => {
      setConflicts(Array.isArray(d) ? d : [])
    }).catch(() => {
      setError('Error al cargar conflictos')
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const scan = async () => {
    if (!scanDomain) {
      setError('Ingresa el dominio del otro nodo')
      return
    }
    setScanning(true)
    setError('')
    setScanResult(null)
    try {
      const res = await api.post('/federation/scan-conflicts', { other_node_domain: scanDomain })
      setScanResult(res)
      if (res.count > 0) {
        setSuccess(`${res.count} conflictos detectados. Revisa y propón resoluciones.`)
        load()
      } else {
        setSuccess('No hay conflictos. Los nodos pueden federarse sin duplicados.')
      }
    } catch (e: any) {
      setError(e?.message || 'Error al escanear')
    } finally {
      setScanning(false)
    }
  }

  const propose = async (id: string) => {
    setError('')
    setSuccess('')
    try {
      const res = await api.post(`/federation/merge-conflicts/${id}/propose`, resolution)
      setSuccess(res.message || 'Propuesta enviada')
      setSelectedConflict(null)
      load()
    } catch (e: any) {
      setError(e?.message || 'Error al proponer')
    }
  }

  const voteOnConflict = async (id: string, voteValue: string) => {
    setError('')
    setSuccess('')
    try {
      const res = await api.post(`/federation/merge-conflicts/${id}/vote`, { vote: voteValue })
      setSuccess(res.message || 'Voto registrado')
      load()
    } catch (e: any) {
      setError(e?.message || 'Error al votar')
    }
  }

  const execute = async (id: string) => {
    if (!confirm('Confirmar ejecucion de la resolucion? Esta accion migrara al usuario y procesara el saldo.')) return
    setError('')
    setSuccess('')
    try {
      const res = await api.post(`/federation/merge-conflicts/${id}/execute`, {})
      setSuccess(res.message || 'Resolucion ejecutada')
      load()
    } catch (e: any) {
      setError(e?.message || 'Error al ejecutar')
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700'
      case 'voting': return 'bg-blue-100 text-blue-700'
      case 'resolved': return 'bg-green-100 text-green-700'
      case 'blocked': return 'bg-red-100 text-red-700'
      case 'executed': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente'
      case 'voting': return 'Votando'
      case 'resolved': return 'Aprobado'
      case 'blocked': return 'Bloqueado'
      case 'executed': return 'Ejecutado'
      default: return status
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle size={24} /> Conflictos de Fusion
        </h1>
      </div>

      <div className="card bg-amber-50 border-amber-200">
        <h2 className="font-semibold text-amber-800 mb-2">Como funciona</h2>
        <p className="text-sm text-amber-700">
          Cuando dos nodos se federan, si hay usuarios registrados en ambos con el mismo ID nacional,
          ambas asambleas deben consensuar en cual nodo se queda cada persona y que hacer con el saldo.
          Mientras haya conflictos sin resolver, la federacion no se puede completar.
        </p>
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
      {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg">{success}</div>}

      {/* Escanear conflictos con otro nodo */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><Search size={18} />Escanear Conflictos</h2>
        <p className="text-xs text-gray-500 mb-3">Ingresa el dominio del otro nodo para buscar usuarios duplicados por ID nacional.</p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Ej: otraaldea.com"
            value={scanDomain}
            onChange={(e) => setScanDomain(e.target.value)}
          />
          <button onClick={scan} disabled={scanning} className="btn-primary flex items-center gap-2">
            {scanning ? 'Escaneando...' : 'Escanear'}
          </button>
        </div>
        {scanResult && (
          <div className="mt-3 text-sm">
            <b>Resultado:</b> {scanResult.count} conflicto(s) encontrado(s)
          </div>
        )}
      </div>

      {/* Lista de conflictos */}
      {loading ? (
        <div className="card text-center text-gray-500 py-8">Cargando conflictos...</div>
      ) : conflicts.length === 0 ? (
        <div className="card text-center text-gray-500 py-8">
          No hay conflictos pendientes.
          <br />
          <span className="text-sm">Escanea otro nodo para detectar duplicados.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {conflicts.map((c, i) => (
            <div key={i} className="card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${statusColor(c.status)}`}>
                    {statusLabel(c.status)}
                  </span>
                  <span className="text-xs text-gray-500">ID: {c.national_id}</span>
                </div>
              </div>

              {/* Usuarios en conflicto */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-xs text-blue-600 mb-1">Nodo A</div>
                  <div className="font-medium">{c.node_a_domain}</div>
                  <div className="text-sm">{c.user_a_name}</div>
                  <div className="text-xs text-gray-500 mt-1">Saldo: {c.balance_a} {currency}</div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="text-xs text-purple-600 mb-1">Nodo B</div>
                  <div className="font-medium">{c.node_b_domain}</div>
                  <div className="text-sm">{c.user_b_name}</div>
                  <div className="text-xs text-gray-500 mt-1">Saldo: {c.balance_b} {currency}</div>
                </div>
              </div>

              {/* Estado de votacion */}
              <div className="flex gap-3 text-xs mb-3">
                <span className={`px-2 py-1 rounded ${c.vote_a_status === 'approved' ? 'bg-green-100 text-green-700' : c.vote_a_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                  Nodo A: {c.vote_a_status === 'approved' ? 'Aprobado' : c.vote_a_status === 'rejected' ? 'Rechazado' : c.vote_a_status === 'open' ? 'Votando' : 'Pendiente'}
                </span>
                <span className={`px-2 py-1 rounded ${c.vote_b_status === 'approved' ? 'bg-green-100 text-green-700' : c.vote_b_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                  Nodo B: {c.vote_b_status === 'approved' ? 'Aprobado' : c.vote_b_status === 'rejected' ? 'Rechazado' : c.vote_b_status === 'open' ? 'Votando' : 'Pendiente'}
                </span>
              </div>

              {/* Resolucion propuesta */}
              {c.proposed_resolution && (
                <div className="text-sm bg-gray-50 p-2 rounded mb-3">
                  <b>Propuesta:</b> Quedarse en nodo {c.proposed_resolution === 'a' ? c.node_a_domain : c.proposed_resolution === 'b' ? c.node_b_domain : 'ambos'} |
                  <b> Saldo:</b> {c.balance_action === 'transfer' ? 'Transferir' : c.balance_action === 'forgive_debt' ? 'Condonar deuda' : c.balance_action === 'remove_balance' ? 'Descartar saldo' : 'Mantener ambos'}
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-2 flex-wrap">
                {c.status === 'pending' && (
                  <button onClick={() => setSelectedConflict(c)} className="btn-primary text-sm flex items-center gap-1">
                    <Vote size={14} /> Proponer resolucion
                  </button>
                )}
                {c.status === 'voting' && c.vote_a_status !== 'approved' && c.vote_b_status !== 'approved' && (
                  <>
                    <button onClick={() => voteOnConflict(c.id, 'approved')} className="btn-primary text-sm flex items-center gap-1">
                      <Check size={14} /> Aprobar
                    </button>
                    <button onClick={() => voteOnConflict(c.id, 'rejected')} className="btn-danger text-sm flex items-center gap-1">
                      <X size={14} /> Rechazar
                    </button>
                  </>
                )}
                {c.status === 'resolved' && (
                  <button onClick={() => execute(c.id)} className="btn-primary text-sm flex items-center gap-1">
                    <ArrowRight size={14} /> Ejecutar migracion
                  </button>
                )}
                {c.status === 'blocked' && (
                  <span className="text-xs text-red-600">Bloqueado - ambas asambleas deben llegar a consenso</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de propuesta */}
      {selectedConflict && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4">
            <h2 className="font-semibold text-lg">Proponer Resolucion</h2>
            <p className="text-sm text-gray-600">Usuario: {selectedConflict.user_a_name} / {selectedConflict.user_b_name}</p>

            <div>
              <label className="label">En que nodo se queda?</label>
              <select
                className="input"
                value={resolution.proposed_resolution}
                onChange={(e) => setResolution({ ...resolution, proposed_resolution: e.target.value })}
              >
                <option value="a">Nodo A ({selectedConflict.node_a_domain})</option>
                <option value="b">Nodo B ({selectedConflict.node_b_domain})</option>
                <option value="both">Ambos nodos (membresia dual)</option>
              </select>
            </div>

            <div>
              <label className="label">Que hacer con el saldo?</label>
              <select
                className="input"
                value={resolution.balance_action}
                onChange={(e) => setResolution({ ...resolution, balance_action: e.target.value })}
              >
                <option value="transfer">Transferir saldo al nodo que se queda</option>
                <option value="forgive_debt">Condonar deuda del nodo removido</option>
                <option value="remove_balance">Descartar saldo del nodo removido</option>
                <option value="keep_both">Mantener saldos separados (solo dual)</option>
              </select>
            </div>

            <div>
              <label className="label">Notas (opcional)</label>
              <textarea
                className="input"
                rows={2}
                placeholder="Explica el razonamiento de la asamblea..."
                value={resolution.notes}
                onChange={(e) => setResolution({ ...resolution, notes: e.target.value })}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setSelectedConflict(null)} className="btn-secondary">Cancelar</button>
              <button onClick={() => propose(selectedConflict.id)} className="btn-primary">Enviar Propuesta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
