import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api } from '../api'
import {
  Clock, CheckCircle2, XCircle, Gavel, Shield, AlertCircle,
  Calendar, MessageSquare, ArrowRight, Home
} from 'lucide-react'

interface AdmissionStatus {
  id: string
  status: string
  full_name: string
  submitted_at: string
  reviewed_at: string | null
  elevated_at: string | null
  next_assembly: string | null
  rejection_reason: string
  rejection_expires_at: string | null
  defense_text: string
  defense_status: string | null
  defense_submitted_at: string | null
}

export default function AdmissionStatus() {
  const { t } = useTranslation('common')
  const [status, setStatus] = useState<AdmissionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [defenseText, setDefenseText] = useState('')
  const [submittingDefense, setSubmittingDefense] = useState(false)

  const load = async () => {
    try {
      const data = await api.get<AdmissionStatus>('/my/admission-status')
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admission_status.error_load'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const submitDefense = async () => {
    if (defenseText.trim().length < 10) {
      setError(t('admission_status.defense_min_length'))
      return
    }
    setSubmittingDefense(true)
    setError('')
    try {
      await api.post('/my/admission-defense', { defense_text: defenseText })
      setDefenseText('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admission_status.error_defense'))
    } finally {
      setSubmittingDefense(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto" />
        <p className="text-xs text-gray-500 mt-3">{t('admission_status.loading')}</p>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-3">
        <AlertCircle size={32} className="mx-auto text-gray-300" />
        <p className="text-sm text-gray-600">{error || t('admission_status.not_found')}</p>
      </div>
    )
  }

  const statusConfig: Record<string, { icon: any; color: string; bg: string; title: string; desc: string }> = {
    pending_review: {
      icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200',
      title: t('admission_status.s_pending_review'),
      desc: t('admission_status.s_pending_review_desc'),
    },
    elevated_to_assembly: {
      icon: Gavel, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200',
      title: t('admission_status.s_elevated'),
      desc: t('admission_status.s_elevated_desc'),
    },
    approved: {
      icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200',
      title: t('admission_status.s_approved'),
      desc: t('admission_status.s_approved_desc'),
    },
    rejected: {
      icon: XCircle, color: 'text-red-700', bg: 'bg-red-50 border-red-200',
      title: t('admission_status.s_rejected'),
      desc: t('admission_status.s_rejected_desc'),
    },
    defense_pending: {
      icon: Shield, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200',
      title: t('admission_status.s_defense_pending'),
      desc: t('admission_status.s_defense_pending_desc'),
    },
  }

  const cfg = statusConfig[status.status] || statusConfig.pending_review
  const StatusIcon = cfg.icon

  const daysLeft = status.rejection_expires_at
    ? Math.max(0, Math.ceil((new Date(status.rejection_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-5">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-extrabold text-gray-900">{t('admission_status.title')}</h1>
        <p className="text-xs text-gray-500">{t('admission_status.subtitle')}</p>
      </div>

      {/* Status card */}
      <div className={`rounded-2xl p-6 border-2 ${cfg.bg} space-y-3`}>
        <div className="flex items-center gap-3">
          <StatusIcon size={28} className={cfg.color} />
          <div>
            <h2 className={`text-lg font-bold ${cfg.color}`}>{cfg.title}</h2>
            <p className="text-xs text-gray-600">{cfg.desc}</p>
          </div>
        </div>

        {status.next_assembly && status.status === 'elevated_to_assembly' && (
          <div className="flex items-center gap-2 text-xs text-blue-700 bg-white rounded-lg p-2.5 border border-blue-100">
            <Calendar size={15} />
            <span>{t('admission_status.next_assembly')}: <b>{new Date(status.next_assembly).toLocaleString('es')}</b></span>
          </div>
        )}

        {status.rejection_reason && (
          <div className="bg-white rounded-lg p-3 border border-red-100 text-xs space-y-1">
            <b className="text-red-800 block">{t('admission_status.rejection_reason')}</b>
            <p className="text-gray-700">{status.rejection_reason}</p>
          </div>
        )}

        {daysLeft !== null && status.status === 'rejected' && (
          <div className="flex items-center gap-2 text-xs text-red-700 bg-white rounded-lg p-2.5 border border-red-100">
            <Clock size={15} />
            <span>{t('admission_status.days_left')} <b>{daysLeft} {t('admission_status.days')}</b> {t('admission_status.days_left_desc')}</span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3">
        <h3 className="text-sm font-bold text-gray-900">{t('admission_status.history')}</h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status.submitted_at ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            <span className="text-gray-700">{t('admission_status.submitted')}: {status.submitted_at ? new Date(status.submitted_at).toLocaleString('es') : '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status.elevated_at ? 'bg-blue-500' : 'bg-gray-300'}`} />
            <span className="text-gray-700">{t('admission_status.elevated')}: {status.elevated_at ? new Date(status.elevated_at).toLocaleString('es') : '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status.defense_submitted_at ? 'bg-purple-500' : 'bg-gray-300'}`} />
            <span className="text-gray-700">{t('admission_status.defense_sent')}: {status.defense_submitted_at ? new Date(status.defense_submitted_at).toLocaleString('es') : '—'}</span>
          </div>
        </div>
      </div>

      {/* Defense form (only if rejected and not expired) */}
      {status.status === 'rejected' && daysLeft !== null && daysLeft > 0 && !status.defense_text && (
        <div className="bg-white rounded-2xl p-5 border border-purple-200 space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-purple-700" />
            <h3 className="text-sm font-bold text-purple-900">{t('admission_status.send_defense')}</h3>
          </div>
          <p className="text-xs text-gray-600">
            {t('admission_status.defense_desc')}
          </p>
          <textarea
            rows={4}
            className="input text-xs sm:text-sm"
            placeholder={t('admission_status.defense_placeholder')}
            value={defenseText}
            onChange={(e) => setDefenseText(e.target.value)}
          />
          <button
            onClick={submitDefense}
            disabled={submittingDefense || defenseText.trim().length < 10}
            className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {submittingDefense ? t('admission_status.sending') : t('admission_status.send_defense_btn')}
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Defense already submitted */}
      {status.defense_text && (
        <div className="bg-white rounded-2xl p-5 border border-purple-200 space-y-2">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-purple-700" />
            <h3 className="text-sm font-bold text-purple-900">{t('admission_status.your_defense')}</h3>
            {status.defense_status && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                status.defense_status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                status.defense_status === 'rejected' ? 'bg-red-100 text-red-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {status.defense_status === 'accepted' ? t('admission_status.defense_accepted') :
                 status.defense_status === 'rejected' ? t('admission_status.defense_rejected') : t('admission_status.defense_review')}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-700 bg-purple-50 p-3 rounded-lg border border-purple-100">{status.defense_text}</p>
        </div>
      )}

      {/* Approved → link to dashboard */}
      {status.status === 'approved' && (
        <div className="text-center">
          <Link to="/app/dashboard" className="btn-primary text-xs inline-flex items-center gap-1.5">
            <Home size={15} /> {t('admission_status.go_dashboard')}
          </Link>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 flex items-center gap-2">
          <AlertCircle size={15} /> {error}
        </div>
      )}
    </div>
  )
}
