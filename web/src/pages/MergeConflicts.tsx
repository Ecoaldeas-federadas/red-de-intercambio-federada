import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { AlertTriangle, Users, ArrowRight, Check, X, Search, Vote } from 'lucide-react'
import { fmtTQ } from '../lib/format'

export default function MergeConflicts() {
  const { t } = useTranslation(['federation', 'common'])
  const { currency } = useConfig()
  const [conflicts, setConflicts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [scanDomain, setScanDomain] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [selectedConflict, setSelectedConflict] = useState<any>(null)
  const [resolution, setResolution] = useState({ proposed_resolution: 'a', balance_action: 'combine', notes: '' })
  const [vote, setVote] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/federation/merge-conflicts').then((d: any) => {
      setConflicts(Array.isArray(d) ? d : [])
    }).catch(() => {
      setError(t('merge_error_loading', 'Error al cargar conflictos'))
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const scan = async () => {
    if (!scanDomain) {
      setError(t('merge_error_enter_domain', 'Ingresa el dominio del otro nodo'))
      return
    }
    setScanning(true)
    setError('')
    setScanResult(null)
    try {
      const res: any = await api.post('/federation/scan-conflicts', { other_node_domain: scanDomain })
      setScanResult(res)
      if (res.count > 0) {
        setSuccess(t('merge_conflicts_detected', '{{count}} conflictos detectados. Revisa y propón resoluciones.', { count: res.count }))
        load()
      } else {
        setSuccess(t('merge_no_conflicts_clean', 'No hay conflictos. Los nodos pueden federarse sin duplicados.'))
      }
    } catch (e: any) {
      setError(e?.message || t('merge_error_scanning', 'Error al escanear'))
    } finally {
      setScanning(false)
    }
  }

  const propose = async (id: string) => {
    setError('')
    setSuccess('')
    try {
      const res: any = await api.post(`/federation/merge-conflicts/${id}/propose`, resolution)
      setSuccess(res.message || t('merge_proposal_sent', 'Propuesta enviada'))
      setSelectedConflict(null)
      load()
    } catch (e: any) {
      setError(e?.message || t('merge_error_proposing', 'Error al proponer'))
    }
  }

  const voteOnConflict = async (id: string, voteValue: string) => {
    setError('')
    setSuccess('')
    try {
      const res: any = await api.post(`/federation/merge-conflicts/${id}/vote`, { vote: voteValue })
      setSuccess(res.message || t('merge_vote_registered', 'Voto registrado'))
      load()
    } catch (e: any) {
      setError(e?.message || t('merge_error_voting', 'Error al votar'))
    }
  }

  const execute = async (id: string) => {
    if (!confirm(t('merge_confirm_execute', 'Confirmar ejecucion de la resolucion? Esta accion migrara al usuario y procesara el saldo.'))) return
    setError('')
    setSuccess('')
    try {
      const res: any = await api.post(`/federation/merge-conflicts/${id}/execute`, {})
      setSuccess(res.message || t('merge_executed', 'Resolucion ejecutada'))
      load()
    } catch (e: any) {
      setError(e?.message || t('merge_error_executing', 'Error al ejecutar'))
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
      case 'pending': return t('merge_status_pending')
      case 'voting': return t('merge_status_voting')
      case 'resolved': return t('merge_status_resolved')
      case 'blocked': return t('merge_status_blocked')
      case 'executed': return t('merge_status_executed')
      default: return status
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle size={24} /> {t('merge_title')}
        </h1>
      </div>

      <div className="card bg-amber-50 border-amber-200">
        <h2 className="font-semibold text-amber-800 mb-2">{t('merge_how_works')}</h2>
        <p className="text-sm text-amber-700">
          {t('merge_how_works_desc')}
        </p>
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
      {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg">{success}</div>}

      {/* Escanear conflictos con otro nodo */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><Search size={18} />{t('merge_scan_title')}</h2>
        <p className="text-xs text-gray-500 mb-3">{t('merge_scan_desc')}</p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder={t('merge_scan_placeholder', 'Ej: otraaldea.com')}
            value={scanDomain}
            onChange={(e) => setScanDomain(e.target.value)}
          />
          <button onClick={scan} disabled={scanning} className="btn-primary flex items-center gap-2">
            {scanning ? t('merge_scanning') : t('merge_scan')}
          </button>
        </div>
        {scanResult && (
          <div className="mt-3 text-sm">
            <b>{t('merge_scan_result')}</b> {scanResult.count} {t('merge_conflicts_found')}
          </div>
        )}
      </div>

      {/* Lista de conflictos */}
      {loading ? (
        <div className="card text-center text-gray-500 py-8">{t('merge_loading')}</div>
      ) : conflicts.length === 0 ? (
        <div className="card text-center text-gray-500 py-8">
          {t('merge_no_conflicts')}
          <br />
          <span className="text-sm">{t('merge_no_conflicts_hint')}</span>
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
                  <span className="text-xs text-gray-500">
                    {c.match_type === 'passport' ? t('merge_match_passport') : c.match_type === 'both' ? t('merge_match_both') : t('merge_match_id')}
                  </span>
                  {c.national_id && <span className="text-xs text-gray-400">ID: {c.national_id}</span>}
                  {c.passport_number && <span className="text-xs text-gray-400">Pass: {c.passport_number}</span>}
                </div>
              </div>

              {/* Usuarios en conflicto */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-xs text-blue-600 mb-1">{t('merge_node_a')}</div>
                  <div className="font-medium">{c.node_a_domain}</div>
                  <div className="text-sm">{c.user_a_name}</div>
                  <div className="text-xs text-gray-500 mt-1">{t('merge_balance_label', 'Saldo:')} {fmtTQ(c.balance_a)} {currency}</div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="text-xs text-purple-600 mb-1">{t('merge_node_b')}</div>
                  <div className="font-medium">{c.node_b_domain}</div>
                  <div className="text-sm">{c.user_b_name}</div>
                  <div className="text-xs text-gray-500 mt-1">{t('merge_balance_label', 'Saldo:')} {fmtTQ(c.balance_b)} {currency}</div>
                </div>
              </div>

              {/* Estado de votacion */}
              <div className="flex gap-3 text-xs mb-3">
                <span className={`px-2 py-1 rounded ${c.vote_a_status === 'approved' ? 'bg-green-100 text-green-700' : c.vote_a_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                  {t('merge_node_a_label', 'Nodo A')}: {c.vote_a_status === 'approved' ? t('merge_approved', 'Aprobado') : c.vote_a_status === 'rejected' ? t('merge_rejected', 'Rechazado') : c.vote_a_status === 'open' ? t('merge_voting', 'Votando') : t('merge_pending', 'Pendiente')}
                </span>
                <span className={`px-2 py-1 rounded ${c.vote_b_status === 'approved' ? 'bg-green-100 text-green-700' : c.vote_b_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                  {t('merge_node_b_label', 'Nodo B')}: {c.vote_b_status === 'approved' ? t('merge_approved', 'Aprobado') : c.vote_b_status === 'rejected' ? t('merge_rejected', 'Rechazado') : c.vote_b_status === 'open' ? t('merge_voting', 'Votando') : t('merge_pending', 'Pendiente')}
                </span>
              </div>

              {/* Resolucion propuesta */}
              {c.proposed_resolution && (
                <div className="text-sm bg-gray-50 p-2 rounded mb-3">
                  <b>{t('merge_proposal_label', 'Propuesta:')}</b> {t('merge_stay_node', 'Quedarse en nodo')} {c.proposed_resolution === 'a' ? c.node_a_domain : c.node_b_domain} |
                  <b> {t('merge_balance_label', 'Saldo:')}</b> {c.balance_action === 'combine' ? t('merge_combine_full', 'Combinar (suma algebraica)') : c.balance_action === 'forgive_debt' ? t('merge_forgive_debt_full', 'Condonar deuda') : t('merge_discard_balance', 'Descartar saldo')}
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-2 flex-wrap">
                {c.status === 'pending' && (
                  <button onClick={() => setSelectedConflict(c)} className="btn-primary text-sm flex items-center gap-1">
                    <Vote size={14} /> {t('merge_propose_resolution')}
                  </button>
                )}
                {c.status === 'voting' && c.vote_a_status !== 'approved' && c.vote_b_status !== 'approved' && (
                  <>
                    <button onClick={() => voteOnConflict(c.id, 'approved')} className="btn-primary text-sm flex items-center gap-1">
                      <Check size={14} /> {t('merge_approve')}
                    </button>
                    <button onClick={() => voteOnConflict(c.id, 'rejected')} className="btn-danger text-sm flex items-center gap-1">
                      <X size={14} /> {t('merge_reject')}
                    </button>
                  </>
                )}
                {c.status === 'resolved' && (
                  <button onClick={() => execute(c.id)} className="btn-primary text-sm flex items-center gap-1">
                    <ArrowRight size={14} /> {t('merge_execute')}
                  </button>
                )}
                {c.status === 'blocked' && (
                  <span className="text-xs text-red-600">{t('merge_blocked_hint')}</span>
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
            <h2 className="font-semibold text-lg">{t('merge_proposal_title')}</h2>
            <p className="text-sm text-gray-600">{t('merge_user_label', 'Usuario:')} {selectedConflict.user_a_name} / {selectedConflict.user_b_name}</p>

            <div>
              <label className="label">{t('merge_which_node')}</label>
              <select
                className="input"
                value={resolution.proposed_resolution}
                onChange={(e) => setResolution({ ...resolution, proposed_resolution: e.target.value })}
              >
                <option value="a">{t('merge_node_a_option', 'Nodo A')} ({selectedConflict.node_a_domain})</option>
                <option value="b">{t('merge_node_b_option', 'Nodo B')} ({selectedConflict.node_b_domain})</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">{t('merge_no_dual')}</p>
            </div>

            <div>
              <label className="label">{t('merge_balance_action')}</label>
              <select
                className="input"
                value={resolution.balance_action}
                onChange={(e) => setResolution({ ...resolution, balance_action: e.target.value })}
              >
                <option value="combine">{t('merge_combine')}</option>
                <option value="forgive_debt">{t('merge_forgive_debt')}</option>
                <option value="remove_balance">{t('merge_remove_balance')}</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {t('merge_combine_desc', 'Combinar: suma ambos saldos (positivo+positivo=mas positivo, negativo+negativo=mas negativo, positivo+negativo=se compensan).')}
              </p>
            </div>

            <div>
              <label className="label">{t('merge_notes_label', 'Notas (opcional)')}</label>
              <textarea
                className="input"
                rows={2}
                placeholder={t('merge_notes_placeholder', 'Explica el razonamiento de la asamblea...')}
                value={resolution.notes}
                onChange={(e) => setResolution({ ...resolution, notes: e.target.value })}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setSelectedConflict(null)} className="btn-secondary">{t('common:cancel')}</button>
              <button onClick={() => propose(selectedConflict.id)} className="btn-primary">{t('merge_send_proposal', 'Enviar Propuesta')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
