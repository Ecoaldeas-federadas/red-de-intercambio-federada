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

export type Screen = 'login' | 'setup' | 'keypad' | 'qr' | 'nfc' | 'sales' | 'settings'

export function App() {
  const [screen, setScreen] = useState<Screen>('login')
  const [amount, setAmount] = useState(0)
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [terminalID, setTerminalID] = useState<string | null>(storage.get('terminalID'))
  const [sessionToken, setSessionToken] = useState<string | null>(storage.get('sessionToken'))
  const [merchantUser, setMerchantUser] = useState<any>(null)

  useEffect(() => {
    // Check if already logged in and terminal is registered
    if (api.isLoggedIn()) {
      setMerchantUser(api.getMerchantUser())
      if (terminalID && storage.get('privateKey')) {
        setScreen('keypad')
      } else {
        setScreen('setup')
      }
    }
  }, [])

  const handleLogin = (user: any) => {
    setMerchantUser(user)
    if (terminalID && storage.get('privateKey')) {
      setScreen('keypad')
    } else {
      setScreen('setup')
    }
  }

  const handleSetupComplete = (termID: string) => {
    setTerminalID(termID)
    storage.set('terminalID', termID)
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
    setSessionToken(null)
    setMerchantUser(null)
    setScreen('login')
  }

  return (
    <div className="safe-top safe-bottom" style={{ minHeight: '100dvh' }}>
      {screen === 'login' && <LoginScreen onLogin={handleLogin} api={api} />}
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
          sessionToken={sessionToken}
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
