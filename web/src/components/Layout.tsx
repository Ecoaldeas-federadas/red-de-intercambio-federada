import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  Home, ArrowLeftRight, History, Package, Calculator, Store,
  Network, Scale, Users, Gavel, FileSearch, Globe, UserPlus, Wallet, Shield,
  Building2, Nfc, Settings, User, PiggyBank,
  LogOut, Menu, X,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/transfer', label: 'Transferir', icon: ArrowLeftRight },
  { to: '/history', label: 'Historial', icon: History },
  { to: '/payments', label: 'Pagos', icon: Wallet },
  { to: '/nfc-terminals', label: 'Terminales NFC', icon: Nfc },
  { to: '/products', label: 'Productos', icon: Package },
  { to: '/calculator', label: 'Calculadora', icon: Calculator },
  { to: '/store', label: 'Tienda', icon: Store },
  { to: '/federation/limits', label: 'Limites Federacion', icon: Network },
  { to: '/federation/parity', label: 'Paridad', icon: Scale },
  { to: '/organizations', label: 'Organizaciones', icon: Users },
  { to: '/departments', label: 'Departamentos', icon: Building2 },
  { to: '/assembly', label: 'Asamblea', icon: Gavel },
  { to: '/audit', label: 'Auditoria', icon: FileSearch },
  { to: '/external', label: 'Comercio Externo', icon: Globe },
  { to: '/admission', label: 'Admision', icon: UserPlus },
  { to: '/recovery', label: 'Recuperacion', icon: Shield },
  { to: '/fund', label: 'Fondo Comunitario', icon: PiggyBank },
  { to: '/profile', label: 'Mi Perfil', icon: User },
  { to: '/settings', label: 'Configuracion', icon: Settings },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { username, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
              end={to === '/'}
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
