import { NavLink, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import { api } from '../api'
import { getNotifIcon, relativeTime } from '../lib/notifications'
import { useTranslation } from 'react-i18next'
import {
  Home, ArrowLeftRight, History, Package, Calculator, Store, Clock,
  Network, Scale, Users, Gavel, FileSearch, Globe, UserPlus, Wallet, Shield,
  Building2, Nfc, Settings, User, PiggyBank, Zap, Plug,
  LogOut, Menu, X, ExternalLink, Bell, ChevronLeft, ChevronRight, AlertTriangle,
  Server, ShoppingBag, SlidersHorizontal, ScrollText, Languages,
} from 'lucide-react'
import { useState, useEffect } from 'react'

// perm = permiso requerido para ver la pestaña.
// Si perm no esta definido, la pestaña es visible para todos.
// labelKey es la clave de traducción en el namespace 'common' -> 'nav.*'
const navItems: { to: string; labelKey: string; icon: any; perm?: string; end?: boolean }[] = [
  { to: '/app/dashboard', labelKey: 'nav.dashboard', icon: Home, end: true },
  { to: '/app/admission-status', labelKey: 'nav.admission_status', icon: UserPlus },
  { to: '/app/transfer', labelKey: 'nav.transfer', icon: ArrowLeftRight },
  { to: '/app/wallet', labelKey: 'nav.wallet', icon: Wallet },
  { to: '/app/my-services', labelKey: 'nav.my_services', icon: Plug },
  { to: '/app/payments', labelKey: 'nav.payments', icon: Wallet },
  { to: '/app/nfc-terminals', labelKey: 'nav.nfc_terminals', icon: Nfc, perm: 'nfc.register_terminal' },
  { to: '/app/nfc-drivers', labelKey: 'nav.nfc_drivers', icon: Package, perm: 'nfc.issue_card' },
  { to: '/app/my-terminals', labelKey: 'nav.my_terminals', icon: ShoppingBag },
  { to: '/app/products', labelKey: 'nav.products', icon: Package },
  { to: '/app/calculator', labelKey: 'nav.calculator', icon: Calculator },
  { to: '/app/calculator/params', labelKey: 'nav.calculator_params', icon: Zap, perm: 'calculator.manage_params' },
  { to: '/app/store', labelKey: 'nav.store', icon: Store },
  { to: '/app/federation', labelKey: 'nav.federation', icon: Network, perm: 'federation.manage', end: true },
  { to: '/app/federation/limits', labelKey: 'nav.federation_limits', icon: Network, perm: 'federation.set_limits' },
  { to: '/app/federation/parity', labelKey: 'nav.parity', icon: Scale },
  { to: '/app/federation/conflicts', labelKey: 'nav.merge_conflicts', icon: AlertTriangle, perm: 'federation.manage' },
  { to: '/app/organizations', labelKey: 'nav.organizations', icon: Users },
  { to: '/app/governance', labelKey: 'nav.governance', icon: Scale, perm: 'governance.manage' },
  { to: '/app/assembly', labelKey: 'nav.assembly', icon: Gavel },
  { to: '/app/audit', labelKey: 'nav.audit', icon: FileSearch, perm: 'config.manage' },
  { to: '/app/external', labelKey: 'nav.external', icon: Globe, perm: 'external.approve_operation' },
  { to: '/app/admission', labelKey: 'nav.admission', icon: UserPlus, perm: 'admission.manage' },
  { to: '/app/recovery', labelKey: 'nav.recovery', icon: Shield, perm: 'recovery.approve' },
  { to: '/app/fund', labelKey: 'nav.fund', icon: PiggyBank },
  { to: '/app/profile', labelKey: 'nav.profile', icon: User },
  { to: '/app/display-settings', labelKey: 'nav.display_settings', icon: SlidersHorizontal },
  { to: '/app/notifications/settings', labelKey: 'nav.notifications_settings', icon: Bell },
  { to: '/app/settings', labelKey: 'nav.settings', icon: Settings, perm: 'config.manage' },
  { to: '/app/services', labelKey: 'nav.services', icon: Server, perm: 'config.manage' },
  { to: '/app/website', labelKey: 'nav.website', icon: Globe, perm: 'config.manage' },
  { to: '/app/translations', labelKey: 'nav.translations', icon: Languages, perm: 'translations.edit' },
  { to: '/licencia', labelKey: 'nav.license', icon: ScrollText },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { username, logout } = useAuth()
  const { hasPermission } = usePermissions()
  const navigate = useNavigate()
  const { t } = useTranslation('common')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [membershipStatus, setMembershipStatus] = useState<string>('unknown')
  const [isOverLimit, setIsOverLimit] = useState(false)

  // Cargar membership_status e is_over_limit del usuario.
  // Por defecto es 'unknown' hasta que se confirme, para no mostrar
  // accidentalmente el menu completo a usuarios no admitidos.
  useEffect(() => {
    api.get<any>('/auth/me').then((d: any) => {
      setMembershipStatus(d?.membership_status || 'active')
      setIsOverLimit(!!d?.is_over_limit)
    }).catch(() => {
      // Si no podemos verificar, asumir pendiente por seguridad
      setMembershipStatus('pending_admission')
    })
  }, [])

  // Si el usuario es preliminar (pending_admission) o no sabemos su estado,
  // mostrar solo 3 items hasta que se confirme que es active.
  const isPendingAdmission = membershipStatus !== 'active'

  // Filtrar items segun permisos del usuario y estado de membresia
  const visibleItems = isPendingAdmission
    ? navItems.filter(item =>
        item.to === '/app/admission-status' ||
        item.to === '/app/profile' ||
        item.to === '/app/notifications/settings'
      )
    : navItems.filter(item => !item.perm || hasPermission(item.perm))

  // Cargar contador de notificaciones no leidas (polling cada 30s)
  useEffect(() => {
    const loadUnread = () => {
      api.get<any>('/notifications/unread-count').then((d: any) => {
        setUnreadCount(d?.total_unread ?? 0)
      }).catch(() => {})
    }
    loadUnread()
    const interval = setInterval(loadUnread, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadNotifications = () => {
    api.get<any[]>('/notifications').then((d: any) => {
      setNotifications(Array.isArray(d) ? d : [])
    }).catch(() => setNotifications([]))
  }

  const handleBellClick = () => {
    setShowNotif(!showNotif)
    if (!showNotif) loadNotifications()
  }

  const handleNotifClick = (n: any) => {
    api.put(`/notifications/${n.id}/read`).catch(() => {})
    setUnreadCount(Math.max(0, unreadCount - 1))
    setShowNotif(false)
    if (n.link) navigate(n.link)
  }

  const markAllRead = () => {
    api.put('/notifications/read-all').then(() => {
      setUnreadCount(0)
      setNotifications(notifications.map(n => ({ ...n, is_read: true })))
    }).catch(() => {})
  }

  const handleLogout = () => {
    logout()
    // Redirigir al sitio publico despues de cerrar sesion
    navigate('/p/inicio')
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar desktop */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 bg-trueque-800 text-white transform transition-all duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4 flex items-center justify-between">
          {!sidebarCollapsed && <h1 className="text-xl font-bold">Trueque</h1>}
          {sidebarCollapsed && <h1 className="text-xl font-bold mx-auto">T</h1>}
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-scroll px-2 py-4 space-y-1 overflow-y-auto h-[calc(100vh-120px)]">
          {visibleItems.map(({ to, labelKey, icon: Icon, end }) => {
            const label = t(labelKey)
            return (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              title={sidebarCollapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-trueque-600 text-white' : 'text-trueque-100 hover:bg-trueque-700'
                } ${sidebarCollapsed ? 'justify-center' : ''}`
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              {!sidebarCollapsed && label}
            </NavLink>
            )
          })}
          <Link
            to="/p/inicio"
            title={sidebarCollapsed ? t('layout.view_public_site', 'Ver sitio publico') : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-trueque-100 hover:bg-trueque-700 mt-4 border-t border-trueque-700 pt-4 ${sidebarCollapsed ? 'justify-center' : ''}`}
          >
            <ExternalLink size={18} className="flex-shrink-0" />
            {!sidebarCollapsed && t('layout.view_public_site', 'Ver sitio publico')}
          </Link>
        </nav>
        {/* Boton contraer/expander */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-trueque-700 p-2 hidden lg:flex justify-center">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex items-center gap-1 text-xs text-trueque-100 hover:text-white px-2 py-1 rounded hover:bg-trueque-700 transition"
            title={sidebarCollapsed ? t('layout.expand', 'Expandir barra') : t('layout.collapse', 'Contraer barra')}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /> {t('layout.collapse', 'Contraer')}</>}
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-3 ml-auto">
            {/* Campana de notificaciones */}
            <div className="relative">
              <button onClick={handleBellClick} className="relative text-gray-600 hover:text-trueque-600">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotif && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                    <div className="flex items-center justify-between p-3 border-b border-gray-100">
                      <span className="font-semibold text-sm">{t('nav.notifications')}</span>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-800">{t('layout.mark_all_read', 'Marcar todas leidas')}</button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-gray-400 text-sm">
                        <Bell size={24} className="mx-auto mb-2 opacity-30" />
                        {t('layout.no_notifications', 'No hay notificaciones')}
                      </div>
                    ) : (
                      notifications.slice(0, 20).map((n: any) => {
                        const { icon: NotifIcon, color: iconColor } = getNotifIcon(n.notification_type)
                        return (
                          <button
                            key={n.id}
                            onClick={() => handleNotifClick(n)}
                            className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 transition ${!n.is_read ? 'bg-blue-50' : ''}`}
                          >
                            <div className="flex items-start gap-2">
                              {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                              <NotifIcon size={16} className={`${iconColor} mt-0.5 flex-shrink-0 ${n.is_read ? 'ml-2.5' : ''}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                                <p className="text-xs text-gray-400 mt-1">{relativeTime(n.created_at)}</p>
                              </div>
                            </div>
                          </button>
                        )
                      })
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={() => { setShowNotif(false); navigate('/app/notifications') }}
                        className="w-full text-center p-2 text-xs text-blue-600 hover:bg-blue-50 border-t border-gray-100"
                      >
                        {t('layout.view_full_history', 'Ver historial completo')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <Link to="/p/inicio" className="text-sm text-trueque-600 hover:text-trueque-800 flex items-center gap-1">
              <ExternalLink size={16} />
              <span className="hidden sm:inline">{t('layout.public_site', 'Sitio publico')}</span>
            </Link>
            <span className="text-sm text-gray-600">{username}</span>
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-600">
              <LogOut size={20} />
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {isOverLimit && !isPendingAdmission && (
            <div className="mb-4 bg-red-50 border border-red-300 rounded-lg p-3 flex items-start gap-2">
              <span className="text-red-600 text-lg">⚠</span>
              <div className="text-sm text-red-800">
                <strong>{t('over_limit.banner_title')}</strong> {t('over_limit.banner_desc')}
              </div>
            </div>
          )}
          {isPendingAdmission && !window.location.pathname.includes('/app/admission-status') && !window.location.pathname.includes('/app/profile') && !window.location.pathname.includes('/app/notifications') ? (
            <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
              <Clock size={32} className="mx-auto text-amber-500" />
              <h2 className="text-lg font-bold text-gray-900">{t('pending_admission.title')}</h2>
              <p className="text-xs text-gray-600">{t('pending_admission.desc')}</p>
              <button onClick={() => navigate('/app/admission-status')} className="btn-primary text-xs">
                {t('pending_admission.view_status')}
              </button>
            </div>
          ) : children}
        </main>
      </div>
    </div>
  )
}
