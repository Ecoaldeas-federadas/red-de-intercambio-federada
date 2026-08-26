// API client - communicates with the backend node via REST API
// Uses Ed25519 for terminal identity + device fingerprint + rotating session keys
import { storage, signMessage, generateNonce, generateDeviceFingerprint, signWithRotatingKey } from './crypto'

export class API {
  private baseURL: string

  constructor() {
    this.baseURL = storage.get('apiURL') || ''
  }

  setBaseURL(url: string) {
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

    // Attach JWT if available (for merchant endpoints)
    const jwt = storage.get('merchantToken')
    if (jwt) {
      headers['Authorization'] = `Bearer ${jwt}`
    }

    // Attach terminal auth headers if we have a terminal session
    const terminalID = storage.get('terminalID')
    const sessionToken = storage.get('sessionToken')
    if (terminalID && sessionToken && !headers['X-Terminal-ID']) {
      headers['X-Terminal-ID'] = terminalID
      headers['X-Session-Token'] = sessionToken
      // Rotating key signature for this request
      const method = (options.method || 'GET').toUpperCase()
      const body = options.body ? await this.hashBody(options.body as string) : ''
      const reqSignature = `${method}:${path}:${body}:${generateNonce()}`
      try {
        const { signature, window } = await signWithRotatingKey(sessionToken, reqSignature)
        headers['X-Request-Sig'] = signature
        headers['X-Request-Window'] = String(window)
        headers['X-Request-Nonce'] = generateNonce()
      } catch {}
    }

    const resp = await fetch(url, { ...options, headers })
    const data = await resp.json().catch(() => ({}))

    if (!resp.ok) {
      throw new Error(data.error || data.message || `HTTP ${resp.status}`)
    }
    return data
  }

  private async hashBody(body: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // ===== AUTH (merchant login) =====
  async login(username: string, password: string): Promise<any> {
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
  // Sends device fingerprint so server can verify it on every future request
  async registerTerminal(terminalID: string, label: string, location: string, fingerprint: string): Promise<any> {
    return this.request('/api/nfc/terminal/register', {
      method: 'POST',
      body: JSON.stringify({
        terminal_id: terminalID,
        label,
        terminal_type: 'web_pos',
        location,
        device_fingerprint: fingerprint,
      }),
    })
  }

  // Step 2: Complete registration with terminal's public key + fingerprint
  async completeRegistration(terminalID: string, registrationToken: string, publicKey: string, fingerprint: string): Promise<any> {
    return this.request('/api/nfc/terminal/complete-registration', {
      method: 'POST',
      body: JSON.stringify({
        terminal_id: terminalID,
        registration_token: registrationToken,
        terminal_public_key: publicKey,
        device_fingerprint: fingerprint,
      }),
    })
  }

  // ===== TERMINAL AUTH (Ed25519 mutual auth + fingerprint) =====
  async terminalAuth(terminalID: string, privateKeyHex: string, fingerprint: string): Promise<any> {
    const nonce = generateNonce()
    // Sign: terminal_id:nonce:fingerprint (includes fingerprint so server verifies both)
    const message = `${terminalID}:${nonce}:${fingerprint}`
    const signature = await signMessage(privateKeyHex, message)

    const data = await this.request('/api/nfc/terminal/auth', {
      method: 'POST',
      body: JSON.stringify({
        terminal_id: terminalID,
        signature,
        nonce,
        device_fingerprint: fingerprint,
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

  // ===== HEARTBEAT (with fingerprint verification) =====
  async heartbeat(terminalID: string, fingerprint: string): Promise<any> {
    return this.request('/api/nfc/terminal/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        terminal_id: terminalID,
        device_fingerprint: fingerprint,
      }),
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

  // ===== POS CHARGE (create QR payment) =====
  // Crea un cargo registrado en el backend. El QR contiene un token unico
  // que el backend conoce. Cuando el cliente paga, el backend marca el cargo
  // como pagado y el POS lo detecta via polling.
  async createCharge(amount: number, description?: string): Promise<any> {
    return this.request('/api/pos/charge', {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    })
  }

  // Consultar estado de un cargo (para polling)
  async getChargeStatus(chargeID: string): Promise<any> {
    return this.request(`/api/pos/charge/${chargeID}/status`)
  }

  // Cancelar cargo
  async cancelCharge(chargeID: string): Promise<any> {
    return this.request(`/api/pos/charge/${chargeID}/cancel`, { method: 'POST' })
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

  // ===== DEVICE FINGERPRINT =====
  async getDeviceFingerprint(): Promise<string> {
    let fp = storage.get('deviceFingerprint')
    if (!fp) {
      fp = await generateDeviceFingerprint()
      storage.set('deviceFingerprint', fp)
    }
    return fp
  }

  // ===== BLOCK / UNBLOCK (local, with code) =====
  async blockTerminal(terminalID: string, code: string): Promise<any> {
    return this.request(`/api/nfc/terminal/${terminalID}/block`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  }

  async unblockTerminal(terminalID: string, code: string): Promise<any> {
    return this.request(`/api/nfc/terminal/${terminalID}/unblock`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  }

  // ===== CARD CRYPTO (DESFire EV3 + dual mode) =====
  async requestCardKey(cardUID: string, terminalID?: string): Promise<any> {
    const params = terminalID ? `?terminal_id=${terminalID}` : ''
    return this.request(`/api/nfc/cards/${cardUID}/request-key${params}`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async verifyCardResponse(cardUID: string, challengeID: string, response: string): Promise<any> {
    return this.request(`/api/nfc/cards/${cardUID}/verify-response`, {
      method: 'POST',
      body: JSON.stringify({ challenge_id: challengeID, response }),
    })
  }

  async prepareRotation(cardUID: string, terminalID?: string): Promise<any> {
    const params = terminalID ? `?terminal_id=${terminalID}` : ''
    return this.request(`/api/nfc/cards/${cardUID}/prepare-rotation${params}`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async confirmRotation(cardUID: string, durationMS?: number): Promise<any> {
    return this.request(`/api/nfc/cards/${cardUID}/confirm-rotation`, {
      method: 'POST',
      body: JSON.stringify({ duration_ms: durationMS || 0 }),
    })
  }

  async failRotation(cardUID: string, errorMessage: string): Promise<any> {
    return this.request(`/api/nfc/cards/${cardUID}/fail-rotation`, {
      method: 'POST',
      body: JSON.stringify({ error_message: errorMessage }),
    })
  }

  async getCardTypeConfig(): Promise<any> {
    return this.request('/api/nfc/card-type/config')
  }

  async setCardTypeConfig(config: { card_type_mode: string; require_crypto: boolean; auto_rotate_key: boolean; max_write_fails?: number }): Promise<any> {
    return this.request('/api/nfc/card-type/config', {
      method: 'POST',
      body: JSON.stringify(config),
    })
  }

  async getCardCryptoStatus(cardUID: string): Promise<any> {
    return this.request(`/api/nfc/cards/${cardUID}/crypto-status`)
  }

  async listRotations(cardUID: string): Promise<any> {
    return this.request(`/api/nfc/cards/${cardUID}/rotations`)
  }
}

export const api = new API()
