// API client - communicates with the backend node via REST API
import { storage, signMessage, generateNonce } from './crypto'

export class API {
  private baseURL: string

  constructor() {
    this.baseURL = storage.get('apiURL') || ''
  }

  setBaseURL(url: string) {
    // Normalize: remove trailing slash
    this.baseURL = url.replace(/\/$/, '')
    storage.set('apiURL', this.baseURL)
  }

  getBaseURL(): string {
    return this.baseURL
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseURL}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    // Attach JWT if available
    const jwt = storage.get('merchantToken')
    if (jwt) {
      headers['Authorization'] = `Bearer ${jwt}`
    }

    const resp = await fetch(url, { ...options, headers })
    const data = await resp.json().catch(() => ({}))

    if (!resp.ok) {
      throw new Error(data.error || data.message || `HTTP ${resp.status}`)
    }
    return data
  }

  // ===== AUTH (merchant login) =====
  async login(username: string, password: string): Promise<any> {
    // Use passkey auth or simple login - depends on backend
    // For now, use the challenge-response or simple JWT login
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    if (data.token) {
      storage.set('merchantToken', data.token)
      storage.set('merchantUser', JSON.stringify(data.user || {}))
    }
    return data
  }

  logout() {
    localStorage.removeItem('pos_merchant_jwt')
    localStorage.removeItem('pos_merchant_user')
  }

  getMerchantUser(): any {
    const raw = storage.get('merchantUser')
    return raw ? JSON.parse(raw) : null
  }

  isLoggedIn(): boolean {
    return !!storage.get('merchantToken')
  }

  // ===== TERMINAL REGISTRATION =====
  // Step 1: Register terminal (requires JWT with nfc.register_terminal permission)
  async registerTerminal(terminalID: string, label: string, location: string): Promise<any> {
    return this.request('/api/nfc/terminal/register', {
      method: 'POST',
      body: JSON.stringify({
        terminal_id: terminalID,
        label,
        terminal_type: 'web_pos',
        location,
      }),
    })
  }

  // Step 2: Complete registration with terminal's public key
  async completeRegistration(terminalID: string, registrationToken: string, publicKey: string): Promise<any> {
    return this.request('/api/nfc/terminal/complete-registration', {
      method: 'POST',
      body: JSON.stringify({
        terminal_id: terminalID,
        registration_token: registrationToken,
        terminal_public_key: publicKey,
      }),
    })
  }

  // ===== TERMINAL AUTH (Ed25519 mutual auth) =====
  async terminalAuth(terminalID: string, privateKeyHex: string): Promise<any> {
    const nonce = generateNonce()
    const message = `${terminalID}:${nonce}`
    const signature = await signMessage(privateKeyHex, message)

    const data = await this.request('/api/nfc/terminal/auth', {
      method: 'POST',
      body: JSON.stringify({
        terminal_id: terminalID,
        signature,
        nonce,
      }),
    })

    if (data.session_token) {
      storage.set('sessionToken', data.session_token)
    }
    if (data.server_public_key) {
      storage.set('serverPublicKey', data.server_public_key)
    }
    return data
  }

  // ===== HEARTBEAT =====
  async heartbeat(terminalID: string): Promise<any> {
    return this.request('/api/nfc/terminal/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ terminal_id: terminalID }),
    })
  }

  // ===== SESSION MANAGEMENT =====
  async createSession(terminalID: string, merchantUserID?: string): Promise<any> {
    return this.request('/api/nfc/terminal/session', {
      method: 'POST',
      body: JSON.stringify({
        terminal_id: terminalID,
        merchant_user_id: merchantUserID || null,
      }),
    })
  }

  async setSessionAmount(sessionToken: string, amount: number): Promise<any> {
    return this.request('/api/nfc/terminal/session/amount', {
      method: 'PUT',
      body: JSON.stringify({
        session_token: sessionToken,
        amount,
      }),
    })
  }

  async getTerminalSession(terminalID: string): Promise<any> {
    return this.request(`/api/nfc/terminal/${terminalID}/session`)
  }

  // ===== NFC PAYMENT (from physical NFC card) =====
  async processPayment(terminalID: string, encryptedPayload: any): Promise<any> {
    return this.request('/api/nfc/terminal/payment', {
      method: 'POST',
      body: JSON.stringify({
        terminal_id: terminalID,
        encrypted_payload: encryptedPayload,
      }),
    })
  }

  // ===== TERMINAL STATUS =====
  async getTerminalStatus(terminalID: string): Promise<any> {
    return this.request(`/api/nfc/terminal/${terminalID}/status`)
  }

  // ===== TERMINAL MANAGEMENT (from main app) =====
  async listTerminals(): Promise<any> {
    return this.request('/api/nfc/terminals')
  }

  async deactivateTerminal(terminalID: string): Promise<any> {
    return this.request(`/api/nfc/terminal/${terminalID}`, { method: 'DELETE' })
  }

  // ===== ACCOUNT INFO =====
  async getMe(): Promise<any> {
    return this.request('/api/accounts/me')
  }

  async getBalance(userID: string): Promise<any> {
    return this.request(`/api/accounts/${userID}`)
  }

  // ===== TRANSACTIONS =====
  async listTransactions(terminalID?: string): Promise<any> {
    const params = terminalID ? `?terminal_id=${terminalID}` : ''
    return this.request(`/api/nfc/transactions${params}`)
  }
}

export const api = new API()
