import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { api } from './api'
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
import NFCTerminals from './pages/NFCTerminals'
import FederationPeers from './pages/FederationPeers'
import NodeSettings from './pages/NodeSettings'
import Profile from './pages/Profile'
import CommunityFund from './pages/CommunityFund'
import CalculatorParams from './pages/CalculatorParams'
import WebsiteAdmin from './pages/WebsiteAdmin'

export default function App() {
  const { isAuthenticated } = useAuth()
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

  // Rutas publicas del sitio web (siempre accesibles sin login)
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/p/inicio" element={<PublicLayout><PublicPageView /></PublicLayout>} />
        <Route path="/p/filosofia" element={<PublicLayout><PublicPageView /></PublicLayout>} />
        <Route path="/p/productos" element={<PublicLayout><PublicPageView /></PublicLayout>} />
        <Route path="/p/comunidad" element={<PublicLayout><PublicPageView /></PublicLayout>} />
        <Route path="/p/como-funciona" element={<PublicLayout><PublicPageView /></PublicLayout>} />
        <Route path="/p/campo-soberano" element={<PublicLayout><PublicPageView /></PublicLayout>} />
        <Route path="/p/faq" element={<PublicLayout><PublicPageView /></PublicLayout>} />
        <Route path="/p/contacto" element={<PublicLayout><PublicPageView /></PublicLayout>} />
        <Route path="/p/unirse" element={<PublicLayout><PublicJoinForm /></PublicLayout>} />
        <Route path="/p/:slug" element={<PublicLayout><PublicPageView /></PublicLayout>} />
        <Route path="/p" element={<Navigate to="/p/inicio" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transfer" element={<Transfer />} />
        <Route path="/history" element={<History />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/products" element={<Products />} />
        <Route path="/calculator" element={<Calculator />} />
        <Route path="/store" element={<Store />} />
        <Route path="/federation/limits" element={<FederationLimits />} />
        <Route path="/federation/parity" element={<Parity />} />
        <Route path="/organizations" element={<Organizations />} />
        <Route path="/assembly" element={<Assembly />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/external" element={<ExternalBridge />} />
        <Route path="/admission" element={<Admission />} />
        <Route path="/recovery" element={<Recovery />} />
        <Route path="/departments" element={<Departments />} />
        <Route path="/nfc-terminals" element={<NFCTerminals />} />
        <Route path="/federation/peers" element={<FederationPeers />} />
        <Route path="/settings" element={<NodeSettings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/fund" element={<CommunityFund />} />
        <Route path="/calculator/params" element={<CalculatorParams />} />
        <Route path="/website" element={<WebsiteAdmin />} />
        <Route path="/p/*" element={<PublicLayout><PublicPageView /></PublicLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
