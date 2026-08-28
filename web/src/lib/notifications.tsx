import {
  Wallet, Calendar, Vote, UserCheck, UserX, KeyRound, Building2,
  Network, Package, Bell, AlertTriangle, type LucideIcon,
} from 'lucide-react'
import { fmtDate } from './format'

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

  if (diffSec < 60) return 'hace un momento'
  if (diffMin < 60) return `hace ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`
  if (diffHour < 24) return `hace ${diffHour} ${diffHour === 1 ? 'hora' : 'horas'}`
  if (diffDay < 7) return `hace ${diffDay} ${diffDay === 1 ? 'dia' : 'dias'}`
  // Para mas de una semana, mostrar fecha
  return fmtDate(date)
}
