import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { getNotifIcon, relativeTime } from '../lib/notifications'
import { useTranslation } from 'react-i18next'
import { Bell, Check, CheckCheck, Trash2, Filter } from 'lucide-react'

export default function Notifications() {
  const navigate = useNavigate()
  const { t } = useTranslation(['notifications', 'common'])
  const [notifications, setNotifications] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  const load = () => {
    setLoading(true)
    api.get<any[]>('/notifications').then((d: any) => {
      setNotifications(Array.isArray(d) ? d : [])
      setLoading(false)
    }).catch(() => {
      setError(t('error_loading', 'Error al cargar notificaciones'))
      setLoading(false)
    })
  }

  const handleNotifClick = (n: any) => {
    if (!n.is_read) {
      api.put(`/notifications/${n.id}/read`).catch(() => {})
      setNotifications(notifications.map(x => x.id === n.id ? { ...x, is_read: true } : x))
    }
    if (n.link) navigate(n.link)
  }

  const markAllRead = () => {
    api.put('/notifications/read-all').then(() => {
      setNotifications(notifications.map(n => ({ ...n, is_read: true })))
    }).catch(() => {})
  }

  const deleteNotif = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    api.delete(`/notifications/${id}`).then(() => {
      setNotifications(notifications.filter(n => n.id !== id))
    }).catch(() => {})
  }

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read
    if (filter === 'read') return n.is_read
    return true
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="text-trueque-600" />
          {t('title', 'Notificaciones')}
        </h1>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-secondary text-sm flex items-center gap-1">
              <CheckCheck size={14} /> {t('mark_all_read', 'Marcar todas leidas')}
            </button>
          )}
          <button onClick={() => navigate('/app/notifications/settings')} className="btn-secondary text-sm">
            {t('configure', 'Configurar')}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded text-sm">{error}</div>}

      {/* Filtros */}
      <div className="flex items-center gap-2">
        <Filter size={16} className="text-gray-400" />
        {(['all', 'unread', 'read'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-3 py-1 rounded-full transition ${
              filter === f
                ? 'bg-trueque-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? t('all_count', 'Todas ({{count}})', { count: notifications.length }) : f === 'unread' ? t('unread_count', 'No leidas ({{count}})', { count: unreadCount }) : t('read', 'Leidas')}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="card p-8 text-center text-gray-400">{t('loading', t('common.loading'))}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">
          <Bell size={32} className="mx-auto mb-2 opacity-30" />
          {filter === 'unread' ? t('no_unread', 'No hay notificaciones sin leer') : filter === 'read' ? t('no_read', 'No hay notificaciones leidas') : t('no_notifications', 'No hay notificaciones')}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const { icon: NotifIcon, color: iconColor } = getNotifIcon(n.notification_type)
            return (
              <div
                key={n.id}
                onClick={() => handleNotifClick(n)}
                className={`card cursor-pointer p-4 flex items-start gap-3 transition hover:shadow-md ${
                  !n.is_read ? 'border-l-4 border-l-blue-500' : ''
                }`}
              >
                <NotifIcon size={20} className={`${iconColor} flex-shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800">{n.title}</p>
                    {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-400">{relativeTime(n.created_at)}</p>
                    <div className="flex items-center gap-2">
                      {n.link && <span className="text-xs text-blue-600">Ver mas</span>}
                      <button
                        onClick={(e) => deleteNotif(n.id, e)}
                        className="text-gray-400 hover:text-red-600"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
