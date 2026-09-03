import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { useSessionTimeout } from './hooks/useSessionTimeout'
import { api } from './api'
import { SessionExpiredProvider } from './components/SessionExpiredModal'
import Layout from './components/Layout'
import { PublicLayout, PublicPageView, PublicJoinForm } from './components/PublicSite'
import Login from './pages/Login'
import Setup from './pages/Setup'
import Dashboard from './pages/Dashboard'
import Transfer from './pages/Transfer'
import Wallet from './pages/Wallet'
import MyServices from './pages/MyServices'
import Products from './pages/Products'
import Calculator from './pages/Calculator'
import Store from './pages/Store'
import FederationLimits from './pages/FederationLimits'
import Parity from './pages/Parity'
import Assembly from './pages/Assembly'
import Audit from './pages/Audit'
import ExternalBridge from './pages/ExternalBridge'
import Admission from './pages/Admission'
import AdmissionStatus from './pages/AdmissionStatus'
import Organizations from './pages/Organizations'
import OrganizationDetail from './pages/OrganizationDetail'
import Payments from './pages/Payments'
import Recovery from './pages/Recovery'
import Departments from './pages/Departments'
import DepartmentDetail from './pages/DepartmentDetail'
import Governance from './pages/Governance'
import NFCTerminals from './pages/NFCTerminals'
import NFCDrivers from './pages/NFCDrivers'
import FederationPeers from './pages/FederationPeers'
import MergeConflicts from './pages/MergeConflicts'
import NodeSettings from './pages/NodeSettings'
import FederatedServices from './pages/FederatedServices'
import FederationGov from './pages/FederationGov'
import Federation from './pages/Federation'
import Profile from './pages/Profile'
import CommunityFund from './pages/CommunityFund'
import CalculatorParams from './pages/CalculatorParams'
import WebsiteAdmin from './pages/WebsiteAdmin'
import NotificationSettings from './pages/NotificationSettings'
import Notifications from './pages/Notifications'
import Pay from './pages/Pay'
import MyTerminals from './pages/MyTerminals'
import SoftwareAdaptations from './pages/SoftwareAdaptations'
import Settings from './pages/Settings'
import LicensePage from './pages/LicensePage'

// Rutas permitidas para usuarios pending_admission.
// Cualquier otra ruta /app/* redirige a /app/admission-status.
const PENDING_ADMISSION_ALLOWED = new Set([
  '/app/admission-status',
  '/app/profile',
  '/app/notifications/settings',
  '/app/notifications',
  '/app/display-settings',
])

// PendingAdmissionGuard envuelve rutas /app/* y redirige a los usuarios
// que no estan fully admitted a su pagina de estado de solicitud.
// Esto previene que usuarios preliminares accedan a funciones del sistema
// navegando directamente por URL.
function PendingAdmissionGuard({ children }: { children: React.ReactNode }) {
  const [membershipStatus, setMembershipStatus] = useState<string>('unknown')

  useEffect(() => {
    api.get<any>('/auth/me').then((d: any) => {
      setMembershipStatus(d?.membership_status || 'active')
    }).catch(() => {
      setMembershipStatus('pending_admission')
    })
  }, [])

  // Mientras no sepamos el estado, dejar pasar (Layout.tsx tambien protege)
  if (membershipStatus === 'unknown') return <>{children}</>

  if (membershipStatus !== 'active') {
    const path = window.location.pathname
    if (!PENDING_ADMISSION_ALLOWED.has(path)) {
      return <Navigate to="/app/admission-status" replace />
    }
  }

  return <>{children}</>
}

// updateFavicon cambia el favicon del navegador dinamicamente.
// Si se pasa una URL de logo, lo usa como favicon.
// Si se pasa null, restaura el favicon por defecto.
function updateFavicon(logoUrl: string | null) {
  // Remover favicons existentes
  document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(el => el.remove())

  const link = document.createElement('link')
  link.rel = 'icon'
  if (logoUrl) {
    link.href = logoUrl
  } else {
    link.href = '/icon.svg'
  }
  document.head.appendChild(link)
}

export default function App() {
  return (
    <SessionExpiredProvider>
      <AppInner />
    </SessionExpiredProvider>
  )
}

function AppInner() {
  const { isAuthenticated } = useAuth()
  useSessionTimeout()
  const [setupChecked, setSetupChecked] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)

  // Actualizar favicon dinamicamente con el logo del nodo
  useEffect(() => {
    api.get('/public/settings').then((s: any) => {
      if (s?.logo_url) {
        updateFavicon(s.logo_url)
      }
      if (s?.site_title) {
        document.title = s.site_title
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    api.get<{ initialized: boolean }>('/setup/status')
      .then((s) => {
        setNeedsSetup(!s.initialized)
        setSetupChecked(true)
      })
      .catch(() => {
        setSetupChecked(true)
      })
  }, [])

  if (!setupChecked) {
    return <div className="min-h-screen flex items-center justify-center bg-trueque-50" />
  }

  if (needsSetup && !isAuthenticated) {
    return (
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="/pay" element={<Pay />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    )
  }

  // Rutas del backend (requieren auth) - prefijo /app
  // PendingAdmissionGuard envuelve cada ruta para redirigir a usuarios
  // no admitidos a su pagina de estado de solicitud.
  if (isAuthenticated) {
    return (
      <Routes>
        <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/app/dashboard" element={<PendingAdmissionGuard><Layout><Dashboard /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/transfer" element={<PendingAdmissionGuard><Layout><Transfer /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/wallet" element={<PendingAdmissionGuard><Layout><Wallet /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/my-services" element={<PendingAdmissionGuard><Layout><MyServices /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/history" element={<PendingAdmissionGuard><Layout><Wallet /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/payments" element={<PendingAdmissionGuard><Layout><Payments /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/products" element={<PendingAdmissionGuard><Layout><Products /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/calculator" element={<PendingAdmissionGuard><Layout><Calculator /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/store" element={<PendingAdmissionGuard><Layout><Store /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/federation/limits" element={<PendingAdmissionGuard><Layout><FederationLimits /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/federation/parity" element={<PendingAdmissionGuard><Layout><Parity /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/organizations" element={<PendingAdmissionGuard><Layout><Organizations /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/organizations/:id" element={<PendingAdmissionGuard><Layout><OrganizationDetail /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/assembly" element={<PendingAdmissionGuard><Layout><Assembly /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/audit" element={<PendingAdmissionGuard><Layout><Audit /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/external" element={<PendingAdmissionGuard><Layout><ExternalBridge /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/admission" element={<PendingAdmissionGuard><Layout><Admission /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/admission-status" element={<Layout><AdmissionStatus /></Layout>} />
        <Route path="/app/recovery" element={<PendingAdmissionGuard><Layout><Recovery /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/departments" element={<PendingAdmissionGuard><Layout><Departments /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/departments/:id" element={<PendingAdmissionGuard><Layout><DepartmentDetail /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/governance" element={<PendingAdmissionGuard><Layout><Governance /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/nfc-terminals" element={<PendingAdmissionGuard><Layout><NFCTerminals /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/nfc-drivers" element={<PendingAdmissionGuard><Layout><NFCDrivers /></Layout></PendingAdmissionGuard>} />
      <Route path="/app/my-terminals" element={<PendingAdmissionGuard><Layout><MyTerminals /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/federation/peers" element={<PendingAdmissionGuard><Layout><Federation /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/federation/conflicts" element={<PendingAdmissionGuard><Layout><MergeConflicts /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/settings" element={<PendingAdmissionGuard><Layout><NodeSettings /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/services" element={<PendingAdmissionGuard><Layout><FederatedServices /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/federation" element={<PendingAdmissionGuard><Layout><Federation /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/notifications/settings" element={<Layout><NotificationSettings /></Layout>} />
        <Route path="/app/notifications" element={<Layout><Notifications /></Layout>} />
        <Route path="/app/profile" element={<Layout><Profile /></Layout>} />
        <Route path="/app/display-settings" element={<Layout><Settings /></Layout>} />
        <Route path="/app/fund" element={<PendingAdmissionGuard><Layout><CommunityFund /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/calculator/params" element={<PendingAdmissionGuard><Layout><CalculatorParams /></Layout></PendingAdmissionGuard>} />
        <Route path="/app/website" element={<PendingAdmissionGuard><Layout><WebsiteAdmin /></Layout></PendingAdmissionGuard>} />
        <Route path="/pay" element={<Pay />} />
        <Route path="/login" element={<Navigate to="/app/dashboard" replace />} />
        {/* Sitio publico tambien accesible cuando estas logueado */}
        <Route path="/" element={<Navigate to="/p/inicio" replace />} />
        <Route path="/p/unirse" element={<PublicLayout><PublicJoinForm /></PublicLayout>} />
        <Route path="/p/adaptaciones" element={<SoftwareAdaptations />} />
        <Route path="/p/:slug" element={<PublicLayout><PublicPageView /></PublicLayout>} />
        <Route path="/p" element={<Navigate to="/p/inicio" replace />} />
        <Route path="/licencia" element={<LicensePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  // Rutas publicas del sitio web (sin login)
  // La raiz "/" muestra el sitio publico, no el login
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/p/inicio" replace />} />
      <Route path="/p/unirse" element={<PublicLayout><PublicJoinForm /></PublicLayout>} />
      <Route path="/p/:slug" element={<PublicLayout><PublicPageView /></PublicLayout>} />
      <Route path="/p" element={<Navigate to="/p/inicio" replace />} />
      <Route path="/licencia" element={<LicensePage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/pay" element={<Pay />} />
      <Route path="*" element={<Navigate to="/p/inicio" replace />} />
    </Routes>
  )
}
