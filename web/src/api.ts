const API_BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('fmc_token')
}

// Session expiration handling: show a re-login modal instead of redirecting
let onSessionExpired: (() => void) | null = null

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler
}

function handleUnauthorized() {
  // Only act if the user HAD a token (was authenticated)
  // Public site visitors don't have a token, so don't redirect them
  const hadToken = !!localStorage.getItem('fmc_token')
  if (!hadToken) return

  // Clear token but DON'T redirect - let the modal handle re-login
  localStorage.removeItem('fmc_token')
  localStorage.removeItem('fmc_username')
  // Dispatch event so useAuth hook updates
  window.dispatchEvent(new Event('storage'))

  // If a session-expired handler is registered, call it (shows modal)
  if (onSessionExpired) {
    onSessionExpired()
  } else {
    // Fallback: redirect to login if no handler registered
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login?expired=1'
    }
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

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
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
