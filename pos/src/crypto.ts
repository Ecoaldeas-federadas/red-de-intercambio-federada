// Crypto utilities: Ed25519 key generation, signing, device fingerprint,
// and rotating session keys for secure terminal auth
// Uses Web Crypto API (available in modern browsers and PWAs)

const subtle = window.crypto.subtle
const encoder = new TextEncoder()

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
  const sig = await subtle.sign('Ed25519', privKey, encoder.encode(message))
  return bufToHex(sig)
}

export async function verifyMessage(publicKeyHex: string, message: string, signatureHex: string): Promise<boolean> {
  try {
    const pubKey = await subtle.importKey('raw', hexToBuf(publicKeyHex), 'Ed25519', false, ['verify'])
    return await subtle.verify('Ed25519', pubKey, hexToBuf(signatureHex), encoder.encode(message))
  } catch {
    return false
  }
}

// ===== DEVICE FINGERPRINT =====
// Combina multiples señales del dispositivo para generar un identificador unico
// que es estable en el mismo dispositivo pero diferente en otros.
// Esto hace que即使 alguien copie la caché del navegador, el fingerprint
// no coincidira en otro dispositivo.

export async function generateDeviceFingerprint(): Promise<string> {
  const signals: string[] = []

  // 1. Canvas fingerprint - dibuja texto y mide el resultado (varia por GPU/driver)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 240
    canvas.height = 60
    const ctx = canvas.getContext('2d')!
    ctx.textBaseline = 'top'
    ctx.font = '16px Arial'
    ctx.fillStyle = '#F60'
    ctx.fillRect(0, 0, 240, 60)
    ctx.fillStyle = '#069'
    ctx.fillText('POS-Federada-Fingerprint-🛒', 2, 2)
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
    ctx.fillText('POS-Federada-Fingerprint-🛒', 4, 4)
    signals.push('canvas:' + canvas.toDataURL())
  } catch {
    signals.push('canvas:unavailable')
  }

  // 2. WebGL fingerprint - informacion del GPU
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        signals.push('gl_vendor:' + gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
        signals.push('gl_renderer:' + gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
      }
      signals.push('gl_version:' + gl.getParameter(gl.VERSION))
    }
  } catch {
    signals.push('webgl:unavailable')
  }

  // 3. Screen properties
  signals.push(`screen:${screen.width}x${screen.height}x${screen.colorDepth}`)
  signals.push(`avail:${screen.availWidth}x${screen.availHeight}`)
  signals.push(`dpr:${window.devicePixelRatio}`)

  // 4. Hardware properties
  signals.push(`cores:${navigator.hardwareConcurrency || 0}`)
  signals.push(`mem:${(navigator as any).deviceMemory || 0}`)
  signals.push(`touch:${navigator.maxTouchPoints || 0}`)

  // 5. Platform and language
  signals.push(`platform:${navigator.platform}`)
  signals.push(`lang:${navigator.language}`)
  signals.push(`langs:${navigator.languages?.join(',') || ''}`)

  // 6. Timezone
  try {
    signals.push(`tz:${Intl.DateTimeFormat().resolvedOptions().timeZone}`)
    signals.push(`tz_offset:${new Date().getTimezoneOffset()}`)
  } catch {
    signals.push('tz:unavailable')
  }

  // 7. Media capabilities (codecs soportados)
  try {
    const mc = navigator.mediaCapabilities
    if (mc) {
      const result = await mc.decodingInfo({
        type: 'file',
        video: { contentType: 'video/mp4; codecs="avc1.42E01E"', width: 1280, height: 720, bitrate: 1000, framerate: 30 },
        audio: { contentType: 'audio/mp4; codecs="mp4a.40.2"', channels: 2, bitrate: 128, sampleRate: 44100 },
      })
      signals.push(`mc_supported:${result.supported}`)
      signals.push(`mc_smooth:${result.smooth}`)
      signals.push(`mc_power:${result.powerEfficient}`)
    }
  } catch {}

  // 8. Connection info
  try {
    const conn = (navigator as any).connection
    if (conn) {
      signals.push(`conn:${conn.effectiveType}:${conn.downlink}:${conn.rtt}`)
    }
  } catch {}

  // Combinar todas las señales y hacer hash SHA-256
  const combined = signals.join('|')
  const hashBuf = await subtle.digest('SHA-256', encoder.encode(combined))
  return bufToHex(hashBuf)
}

// ===== ROTATING SESSION KEYS =====
// Deriva una clave de sesion que cambia cada ventana de tiempo (ej: 30 segundos).
// El servidor y el cliente derivan la misma clave usando:
//   - El session_token compartido (de la autenticacion inicial)
//   - El numero de ventana de tiempo actual (floor(timestamp / window))
// Esto significa que incluso si alguien copia la caché:
//   1. El fingerprint no coincidira en otro dispositivo
//   2. El session_token expira
//   3. Las claves rotativas cambian cada 30s

const KEY_ROTATION_WINDOW = 30 // segundos

export function getTimeWindow(): number {
  return Math.floor(Date.now() / 1000 / KEY_ROTATION_WINDOW)
}

export async function deriveRotatingKey(sessionToken: string, window?: number): Promise<string> {
  const w = window ?? getTimeWindow()
  const material = `${sessionToken}:${w}`
  const keyBuf = await subtle.importKey(
    'raw',
    encoder.encode(material),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await subtle.sign('HMAC', keyBuf, encoder.encode(material))
  return bufToHex(sig).substring(0, 32) // 16 bytes = 32 hex chars
}

// Firma un mensaje con la clave rotativa actual
export async function signWithRotatingKey(sessionToken: string, message: string): Promise<{ signature: string; window: number }> {
  const w = getTimeWindow()
  const key = await deriveRotatingKey(sessionToken, w)
  const mac = await hmacSign(key, message)
  return { signature: mac, window: w }
}

async function hmacSign(keyHex: string, message: string): Promise<string> {
  const keyBuf = await subtle.importKey(
    'raw',
    hexToBuf(keyHex),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await subtle.sign('HMAC', keyBuf, encoder.encode(message))
  return bufToHex(sig)
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
  deviceFingerprint: 'pos_device_fingerprint',
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
