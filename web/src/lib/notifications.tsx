import {
  Wallet, Calendar, Vote, UserCheck, UserX, KeyRound, Building2,
  Network, Package, Bell, AlertTriangle, type LucideIcon,
} from 'lucide-react'
import { fmtDate } from './format'
import i18next from 'i18next'

// Mapea el tipo de notificacion a un icono y color
export const NOTIF_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  payment_received: { icon: Wallet, color: 'text-green-600' },
  assembly_scheduled: { icon: Calendar, color: 'text-purple-600' },
  voting_opened: { icon: Vote, color: 'text-blue-600' },
  admission_approved: { icon: UserCheck, color: 'text-green-600' },
  admission_rejected: { icon: UserX, color: 'text-red-600' },
  recovery_request_created: { icon: KeyRound, color: 'text-orange-600' },
  department_assigned: { icon: Building2, color: 'text-indigo-600' },
  org_board_assigned: { icon: Building2, color: 'text-indigo-600' },
  org_approved: { icon: Building2, color: 'text-green-600' },
  federation_peer_registered: { icon: Network, color: 'text-cyan-600' },
  federation_product_approved: { icon: Package, color: 'text-teal-600' },
  proposal_closing: { icon: AlertTriangle, color: 'text-amber-600' },
  proposal_result: { icon: Vote, color: 'text-blue-600' },
  quorum_status: { icon: AlertTriangle, color: 'text-amber-600' },
  minutes_published: { icon: Calendar, color: 'text-purple-600' },
}

export function getNotifIcon(type: string): { icon: LucideIcon; color: string } {
  return NOTIF_ICONS[type] || { icon: Bell, color: 'text-gray-500' }
}

// Formatea una fecha como tiempo relativo en espanol
export function relativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return i18next.t('common:time_just_now', 'just now')
  if (diffMin < 60) return i18next.t('common:time_minutes_ago', { count: diffMin, defaultValue: `${diffMin} min ago` })
  if (diffHour < 24) return i18next.t('common:time_hours_ago', { count: diffHour, defaultValue: `${diffHour}h ago` })
  if (diffDay < 7) return i18next.t('common:time_days_ago', { count: diffDay, defaultValue: `${diffDay}d ago` })
  // Para mas de una semana, mostrar fecha
  return fmtDate(date)
}
