// Crypto utilities: Ed25519 key generation, signing, and ECDH for terminal auth
// Uses Web Crypto API (available in modern browsers and PWAs)

const subtle = window.crypto.subtle

export interface KeyPair {
  publicKey: string  // hex
  privateKey: string // hex (stored in localStorage for persistence)
}

export async function generateKeyPair(): Promise<KeyPair> {
  const kp = await subtle.generateKey('Ed25519', true, ['sign', 'verify'])
  const privBuf = await subtle.exportKey('pkcs8', kp.privateKey)
  const pubBuf = await subtle.exportKey('raw', kp.publicKey)
  return {
    publicKey: bufToHex(pubBuf),
    privateKey: bufToHex(privBuf),
  }
}

export async function signMessage(privateKeyHex: string, message: string): Promise<string> {
  const privKey = await subtle.importKey('pkcs8', hexToBuf(privateKeyHex), 'Ed25519', false, ['sign'])
  const sig = await subtle.sign('Ed25519', privKey, new TextEncoder().encode(message))
  return bufToHex(sig)
}

export async function verifyMessage(publicKeyHex: string, message: string, signatureHex: string): Promise<boolean> {
  try {
    const pubKey = await subtle.importKey('raw', hexToBuf(publicKeyHex), 'Ed25519', false, ['verify'])
    return await subtle.verify('Ed25519', pubKey, hexToBuf(signatureHex), new TextEncoder().encode(message))
  } catch {
    return false
  }
}

// Generate a random nonce
export function generateNonce(): string {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  return bufToHex(buf)
}

// Generate a random terminal ID
export function generateTerminalID(): string {
  const buf = new Uint8Array(16)
  crypto.getRandomValues(buf)
  return 'web-' + bufToHex(buf)
}

// Helpers
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBuf(hex: string): ArrayBuffer {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return arr.buffer
}

// Storage helpers - persist keys in localStorage so the terminal survives reloads
const STORAGE_KEYS = {
  privateKey: 'pos_private_key',
  publicKey: 'pos_public_key',
  terminalID: 'pos_terminal_id',
  serverPublicKey: 'pos_server_public_key',
  sessionToken: 'pos_session_token',
  apiURL: 'pos_api_url',
  merchantToken: 'pos_merchant_jwt', // JWT from login
  merchantUser: 'pos_merchant_user',
}

export const storage = {
  get(key: keyof typeof STORAGE_KEYS): string | null {
    return localStorage.getItem(STORAGE_KEYS[key])
  },
  set(key: keyof typeof STORAGE_KEYS, value: string) {
    localStorage.setItem(STORAGE_KEYS[key], value)
  },
  clear() {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k))
  },
  keys: STORAGE_KEYS,
}
