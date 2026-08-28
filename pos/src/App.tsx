import { useState, useEffect } from 'react'
import { api } from './api'
import { storage, generateKeyPair, generateTerminalID, generateDeviceFingerprint } from './crypto'
import { LoginScreen } from './screens/LoginScreen'
import { SetupScreen } from './screens/SetupScreen'
import { KeypadScreen } from './screens/KeypadScreen'
import { QRScreen } from './screens/QRScreen'
import { NFCScreen } from './screens/NFCScreen'
import { SalesScreen } from './screens/SalesScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { ConfirmAmountScreen } from './screens/ConfirmAmountScreen'
import { ShiftScreen } from './screens/ShiftScreen'

export type Screen = 'url' | 'login' | 'setup' | 'keypad' | 'confirm' | 'qr' | 'nfc' | 'sales' | 'settings' | 'shift'

export function App() {
  const [screen, setScreen] = useState<Screen>('url')
  const [amount, setAmount] = useState(0)
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [terminalID, setTerminalID] = useState<string | null>(storage.get('terminalID'))
  const [merchantUser, setMerchantUser] = useState<any>(null)
  const [authenticating, setAuthenticating] = useState(false)

  useEffect(() => {
    // Determinar pantalla inicial
    const apiURL = storage.get('apiURL')
    const termID = storage.get('terminalID')
    const privKey = storage.get('privateKey')
    const sessionToken = storage.get('sessionToken')
    const jwt = storage.get('merchantToken')

    const initApp = async () => {
      let url = apiURL
      if (!url) {
        // Auto-detectar la URL del nodo
        const detected = await api.detectNodeURL()
        if (detected) {
          url = detected
        } else {
          setScreen('url')
          return
        }
      }

      api.setBaseURL(url)

      if (termID && privKey && sessionToken && jwt) {
        // Todo configurado - ir directo al keypad
        setTerminalID(termID)
        setMerchantUser(api.getMerchantUser())
        setScreen('keypad')
      } else if (termID && privKey && jwt) {
        // Hay terminal + claves + JWT, pero no sessionToken (o expiro)
        setTerminalID(termID)
        setMerchantUser(api.getMerchantUser())
        setAuthenticating(true)
        autoReauthTerminal(termID, privKey)
      } else if (termID && privKey && !jwt) {
        // Terminal registrado pero no autenticado como merchant
        setTerminalID(termID)
        setScreen('login')
      } else if (termID && privKey) {
        // Hay claves pero no JWT - ir a login
        setTerminalID(termID)
        setScreen('login')
      } else {
        // No hay terminal - ir a setup
        setScreen('setup')
      }
    }
    initApp()
  }, [])

  // Auto re-autenticar el terminal con el servidor
  // Si las claves existen, intentar re-autenticar en vez de volver a setup
  // NO borrar las claves si falla - solo mostrar error y permitir reintentar
  const autoReauthTerminal = async (termID: string, privKey: string) => {
    try {
      const fingerprint = await api.getDeviceFingerprint()
      const data = await api.terminalAuth(termID, privKey, fingerprint)
      if (data.session_token) {
        // Re-autenticacion exitosa - ir al keypad
        setAuthenticating(false)
        setScreen('keypad')
      } else {
        // El servidor respondio pero no dio session token
        // No borrar claves - ir a login para reintentar
        setAuthenticating(false)
        setScreen('login')
      }
    } catch (e) {
      // Fallo la re-autenticacion (red, servidor caido, etc.)
      // NO borrar las claves - permitir reintentar desde login
      // El usuario puede reintentar o resetear manualmente si es necesario
      setAuthenticating(false)
      setScreen('login')
    }
  }

  const handleURLSet = () => {
    // Después de setear la URL, ir a setup si no hay terminal, o a login si ya hay
    const termID = storage.get('terminalID')
    const privKey = storage.get('privateKey')
    const sessionToken = storage.get('sessionToken')

    if (termID && privKey && sessionToken) {
      setTerminalID(termID)
      setScreen('login')
    } else {
      setScreen('setup')
    }
  }

  const handleSetupComplete = (termID: string) => {
    setTerminalID(termID)
    storage.set('terminalID', termID)
    // Después de activar el terminal, hacer login del merchant
    setScreen('login')
  }

  const handleLogin = (user: any) => {
    setMerchantUser(user)
    setScreen('keypad')
  }

  const handleAmountSet = (amt: number) => {
    setAmount(amt)
  }

  const handleShowConfirm = () => {
    setScreen('confirm')
  }

  const handleShowQR = (token: string) => {
    setQrToken(token)
    setScreen('qr')
  }

  const handleShowNFC = () => {
    setScreen('nfc')
  }

  const handlePaymentDone = () => {
    setAmount(0)
    setQrToken(null)
    setScreen('keypad')
  }

  const handleLogout = () => {
    api.logout()
    storage.clear()
    setTerminalID(null)
    setMerchantUser(null)
    setScreen('url')
  }

  const isDemo = api.isDemoNode()

  if (authenticating) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ fontSize: 60, marginBottom: 16 }} className="pulse">⏳</div>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Verificando terminal...</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 8 }}>
          Conectando con el servidor
        </p>
      </div>
    )
  }

  return (
    <div className="safe-top safe-bottom" style={{ minHeight: '100dvh' }}>
      {screen === 'url' && <LoginScreen onURLSet={handleURLSet} api={api} />}
      {screen === 'login' && <LoginScreen onLogin={handleLogin} api={api} skipURL />}
      {screen === 'setup' && (
        <SetupScreen
          onComplete={handleSetupComplete}
          api={api}
          generateKeyPair={generateKeyPair}
          generateTerminalID={generateTerminalID}
        />
      )}
      {screen === 'keypad' && (
        <KeypadScreen
          amount={amount}
          onAmountChange={handleAmountSet}
          onShowQR={handleShowQR}
          onShowNFC={handleShowNFC}
          onShowConfirm={handleShowConfirm}
          onShowSales={() => setScreen('sales')}
          onShowSettings={() => setScreen('settings')}
          terminalID={terminalID}
          sessionToken={storage.get('sessionToken')}
          api={api}
          merchantUser={merchantUser}
        />
      )}
      {screen === 'confirm' && (
        <ConfirmAmountScreen
          amount={amount}
          onBack={() => setScreen('keypad')}
          onShowQR={handleShowQR}
          onShowNFC={handleShowNFC}
          api={api}
          sessionToken={storage.get('sessionToken')}
        />
      )}
      {screen === 'qr' && (
        <QRScreen
          amount={amount}
          qrToken={qrToken}
          apiURL={api.getBaseURL()}
          onBack={() => setScreen('keypad')}
          onPaid={handlePaymentDone}
          api={api}
          terminalID={terminalID}
        />
      )}
      {screen === 'nfc' && (
        <NFCScreen
          amount={amount}
          onBack={() => setScreen('keypad')}
          onPaid={handlePaymentDone}
          api={api}
          terminalID={terminalID}
          isDemoNode={isDemo}
        />
      )}
      {screen === 'sales' && (
        <SalesScreen
          onBack={() => setScreen('keypad')}
          api={api}
          terminalID={terminalID}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          onBack={() => setScreen('keypad')}
          onLogout={handleLogout}
          api={api}
          terminalID={terminalID}
          merchantUser={merchantUser}
          onShowShift={() => setScreen('shift')}
        />
      )}
      {screen === 'shift' && (
        <ShiftScreen
          onBack={() => setScreen('settings')}
          api={api}
          terminalID={terminalID}
        />
      )}
    </div>
  )
}
