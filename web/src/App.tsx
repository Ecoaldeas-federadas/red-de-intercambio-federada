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
import History from './pages/History'
import Products from './pages/Products'
import Calculator from './pages/Calculator'
import Store from './pages/Store'
import FederationLimits from './pages/FederationLimits'
import Parity from './pages/Parity'
import Assembly from './pages/Assembly'
import Audit from './pages/Audit'
import ExternalBridge from './pages/ExternalBridge'
import Admission from './pages/Admission'
import Organizations from './pages/Organizations'
import Payments from './pages/Payments'
import Recovery from './pages/Recovery'
import Departments from './pages/Departments'
import Governance from './pages/Governance'
import NFCTerminals from './pages/NFCTerminals'
import FederationPeers from './pages/FederationPeers'
import MergeConflicts from './pages/MergeConflicts'
import NodeSettings from './pages/NodeSettings'
import Profile from './pages/Profile'
import CommunityFund from './pages/CommunityFund'
import CalculatorParams from './pages/CalculatorParams'
import WebsiteAdmin from './pages/WebsiteAdmin'
import NotificationSettings from './pages/NotificationSettings'
import Notifications from './pages/Notifications'

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
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    )
  }

  // Rutas del backend (requieren auth) - prefijo /app
  if (isAuthenticated) {
    return (
      <Routes>
        <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/app/dashboard" element={<Layout><Dashboard /></Layout>} />
        <Route path="/app/transfer" element={<Layout><Transfer /></Layout>} />
        <Route path="/app/history" element={<Layout><History /></Layout>} />
        <Route path="/app/payments" element={<Layout><Payments /></Layout>} />
        <Route path="/app/products" element={<Layout><Products /></Layout>} />
        <Route path="/app/calculator" element={<Layout><Calculator /></Layout>} />
        <Route path="/app/store" element={<Layout><Store /></Layout>} />
        <Route path="/app/federation/limits" element={<Layout><FederationLimits /></Layout>} />
        <Route path="/app/federation/parity" element={<Layout><Parity /></Layout>} />
        <Route path="/app/organizations" element={<Layout><Organizations /></Layout>} />
        <Route path="/app/assembly" element={<Layout><Assembly /></Layout>} />
        <Route path="/app/audit" element={<Layout><Audit /></Layout>} />
        <Route path="/app/external" element={<Layout><ExternalBridge /></Layout>} />
        <Route path="/app/admission" element={<Layout><Admission /></Layout>} />
        <Route path="/app/recovery" element={<Layout><Recovery /></Layout>} />
        <Route path="/app/departments" element={<Layout><Departments /></Layout>} />
        <Route path="/app/governance" element={<Layout><Governance /></Layout>} />
        <Route path="/app/nfc-terminals" element={<Layout><NFCTerminals /></Layout>} />
        <Route path="/app/federation/peers" element={<Layout><FederationPeers /></Layout>} />
        <Route path="/app/federation/conflicts" element={<Layout><MergeConflicts /></Layout>} />
        <Route path="/app/settings" element={<Layout><NodeSettings /></Layout>} />
        <Route path="/app/notifications/settings" element={<Layout><NotificationSettings /></Layout>} />
        <Route path="/app/notifications" element={<Layout><Notifications /></Layout>} />
        <Route path="/app/profile" element={<Layout><Profile /></Layout>} />
        <Route path="/app/fund" element={<Layout><CommunityFund /></Layout>} />
        <Route path="/app/calculator/params" element={<Layout><CalculatorParams /></Layout>} />
        <Route path="/app/website" element={<Layout><WebsiteAdmin /></Layout>} />
        <Route path="/login" element={<Navigate to="/app/dashboard" replace />} />
        {/* Sitio publico tambien accesible cuando estas logueado */}
        <Route path="/" element={<Navigate to="/p/inicio" replace />} />
        <Route path="/p/unirse" element={<PublicLayout><PublicJoinForm /></PublicLayout>} />
        <Route path="/p/:slug" element={<PublicLayout><PublicPageView /></PublicLayout>} />
        <Route path="/p" element={<Navigate to="/p/inicio" replace />} />
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
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="*" element={<Navigate to="/p/inicio" replace />} />
    </Routes>
  )
}
