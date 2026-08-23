import { useState, useEffect } from 'react'
import { api } from './api'
import { storage, generateKeyPair, generateTerminalID } from './crypto'
import { LoginScreen } from './screens/LoginScreen'
import { SetupScreen } from './screens/SetupScreen'
import { KeypadScreen } from './screens/KeypadScreen'
import { QRScreen } from './screens/QRScreen'
import { NFCScreen } from './screens/NFCScreen'
import { SalesScreen } from './screens/SalesScreen'
import { SettingsScreen } from './screens/SettingsScreen'

export type Screen = 'url' | 'login' | 'setup' | 'keypad' | 'qr' | 'nfc' | 'sales' | 'settings'

export function App() {
  const [screen, setScreen] = useState<Screen>('url')
  const [amount, setAmount] = useState(0)
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [terminalID, setTerminalID] = useState<string | null>(storage.get('terminalID'))
  const [merchantUser, setMerchantUser] = useState<any>(null)

  useEffect(() => {
    // Determinar pantalla inicial
    const apiURL = storage.get('apiURL')
    const termID = storage.get('terminalID')
    const privKey = storage.get('privateKey')
    const sessionToken = storage.get('sessionToken')
    const jwt = storage.get('merchantToken')

    if (!apiURL) {
      setScreen('url')
    } else {
      api.setBaseURL(apiURL)
      if (termID && privKey && sessionToken && jwt) {
        // Todo configurado - ir directo al keypad
        setTerminalID(termID)
        setMerchantUser(api.getMerchantUser())
        setScreen('keypad')
      } else if (termID && privKey && !sessionToken) {
        // Terminal registrado pero no autenticado
        setTerminalID(termID)
        setScreen('setup')
      } else {
        // Empezar desde URL
        setScreen('url')
      }
    }
  }, [])

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
          onShowSales={() => setScreen('sales')}
          onShowSettings={() => setScreen('settings')}
          terminalID={terminalID}
          sessionToken={storage.get('sessionToken')}
          api={api}
          merchantUser={merchantUser}
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
        />
      )}
    </div>
  )
}
