// API_BASE: usa basePath si existe (ej: nodo demo con basePath="/demo")
// Esto permite que el frontend del demo llame a /demo/api/... en lugar de /api/...
// Cuando se accede via el proxy del nodo padre, /demo/api/... llega al demo
// y el demo strip /demo -> /api/... internamente.
const API_BASE = (typeof window !== 'undefined' && (window as any).__BASE_PATH__) ? (window as any).__BASE_PATH__ + '/api' : '/api'

// Claves de localStorage separadas por ruta base (padre vs demo)
export function getStorageKeys() {
  const basePath = typeof window !== 'undefined' ? ((window as any).__BASE_PATH__ || '') : ''
  let prefix = 'fmc'
  if (basePath === '/demo') prefix = 'fmc_demo'
  else if (basePath === '/main') prefix = 'fmc_main'
  return {
    tokenKey: `${prefix}_token`,
    usernameKey: `${prefix}_username`,
  }
}

function getToken(): string | null {
  return localStorage.getItem(getStorageKeys().tokenKey)
}

// Session expiration handling: show a re-login modal instead of redirecting
let onSessionExpired: (() => void) | null = null
let sessionExpiredShown = false

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler
  if (!handler) sessionExpiredShown = false
}

// Called by the modal after successful re-login to reset the flag
export function clearSessionExpiredFlag() {
  sessionExpiredShown = false
}

function handleUnauthorized() {
  // Only act if the user HAD a token (was authenticated)
  // Public site visitors don't have a token, so don't redirect them
  const keys = getStorageKeys()
  const hadToken = !!localStorage.getItem(keys.tokenKey)
  if (!hadToken) return

  // If a session-expired handler is registered, show the modal
  // WITHOUT clearing the token or redirecting.
  // The modal handles re-login in-place. The token stays in localStorage
  // so useAuth doesn't redirect to the public site.
  // The old token is invalid (server returned 401) but keeping it
  // prevents the app from unmounting the current page.
  if (onSessionExpired) {
    if (!sessionExpiredShown) {
      sessionExpiredShown = true
      onSessionExpired()
    }
    return
  }

  // Fallback: no handler registered, clear token and redirect to login
  localStorage.removeItem(keys.tokenKey)
  localStorage.removeItem(keys.usernameKey)
  window.dispatchEvent(new Event('storage'))
  if (!window.location.pathname.includes('/login')) {
    const basePath = (window as any).__BASE_PATH__ || ''
    window.location.href = basePath + '/login?expired=1'
  }
}

function getNodeDomain(): string {
  // Intentar obtener el node_domain del cache de configuracion
  try {
    const cached = localStorage.getItem('node_config')
    if (cached) {
      const cfg = JSON.parse(cached)
      if (cfg.node_domain) return cfg.node_domain
    }
  } catch {}
  return 'localhost'
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Node-Domain': getNodeDomain(),
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // cache: 'no-store' evita que el browser cachee las respuestas
  // Critico para polling de estado de actualizacion
  const fetchOptions: RequestInit = { ...options, headers, cache: 'no-store' }
  const res = await fetch(`${API_BASE}${path}`, fetchOptions)
  if (res.status === 401) {
    handleUnauthorized()
    const err = await res.json().catch(() => ({ error: 'Sesión expirada' }))
    throw new Error(err.error || 'Sesión expirada. Por favor inicia sesión nuevamente.')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
}
