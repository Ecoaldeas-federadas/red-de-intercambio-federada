import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api'
import {
  Home, ArrowLeftRight, History, Package, Calculator, Store,
  Network, Scale, Users, Gavel, FileSearch, Globe, UserPlus, Wallet, Shield,
  Building2, Nfc, Settings, User, PiggyBank, Zap,
  LogOut, Menu, X, ExternalLink, Bell,
} from 'lucide-react'
import { useState, useEffect } from 'react'

const navItems = [
  { to: '/app/dashboard', label: 'Inicio', icon: Home },
  { to: '/app/transfer', label: 'Transferir', icon: ArrowLeftRight },
  { to: '/app/history', label: 'Historial', icon: History },
  { to: '/app/payments', label: 'Pagos', icon: Wallet },
  { to: '/app/nfc-terminals', label: 'Terminales NFC', icon: Nfc },
  { to: '/app/products', label: 'Productos', icon: Package },
  { to: '/app/calculator', label: 'Calculadora', icon: Calculator },
  { to: '/app/calculator/params', label: 'Parametros Calc.', icon: Zap },
  { to: '/app/store', label: 'Tienda', icon: Store },
  { to: '/app/federation/limits', label: 'Limites Federacion', icon: Network },
  { to: '/app/federation/parity', label: 'Paridad', icon: Scale },
  { to: '/app/organizations', label: 'Organizaciones', icon: Users },
  { to: '/app/departments', label: 'Departamentos', icon: Building2 },
  { to: '/app/governance', label: 'Gobernanza', icon: Scale },
  { to: '/app/assembly', label: 'Asamblea', icon: Gavel },
  { to: '/app/audit', label: 'Auditoria', icon: FileSearch },
  { to: '/app/external', label: 'Comercio Externo', icon: Globe },
  { to: '/app/admission', label: 'Admision', icon: UserPlus },
  { to: '/app/recovery', label: 'Recuperacion', icon: Shield },
  { to: '/app/fund', label: 'Fondo Comunitario', icon: PiggyBank },
  { to: '/app/profile', label: 'Mi Perfil', icon: User },
  { to: '/app/settings', label: 'Configuracion', icon: Settings },
  { to: '/app/website', label: 'Sitio Web Publico', icon: Globe },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { username, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])

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
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar desktop */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-trueque-800 text-white transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Trueque</h1>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <nav className="px-2 py-4 space-y-1 overflow-y-auto h-[calc(100vh-64px)]">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/app/dashboard'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-trueque-600 text-white' : 'text-trueque-100 hover:bg-trueque-700'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-trueque-100 hover:bg-trueque-700 mt-4 border-t border-trueque-700 pt-4"
          >
            <ExternalLink size={18} />
            Ver sitio publico
          </a>
        </nav>
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
                      <span className="font-semibold text-sm">Notificaciones</span>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-800">Marcar todas leidas</button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-gray-400 text-sm">
                        <Bell size={24} className="mx-auto mb-2 opacity-30" />
                        No hay notificaciones
                      </div>
                    ) : (
                      notifications.slice(0, 20).map((n: any) => (
                        <button
                          key={n.id}
                          onClick={() => handleNotifClick(n)}
                          className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 transition ${!n.is_read ? 'bg-blue-50' : ''}`}
                        >
                          <div className="flex items-start gap-2">
                            {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(n.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
            <a href="/" target="_blank" rel="noopener" className="text-sm text-trueque-600 hover:text-trueque-800 flex items-center gap-1">
              <ExternalLink size={16} />
              <span className="hidden sm:inline">Sitio publico</span>
            </a>
            <span className="text-sm text-gray-600">{username}</span>
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-600">
              <LogOut size={20} />
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
