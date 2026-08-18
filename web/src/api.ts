const API_BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('fmc_token')
}

// Track last logout to avoid redirect loops
let lastLogoutTime = 0

function handleUnauthorized() {
  // Only redirect if the user HAD a token (was authenticated)
  // Public site visitors don't have a token, so don't redirect them
  const hadToken = !!localStorage.getItem('fmc_token')
  if (!hadToken) return

  // Clear all auth data
  localStorage.removeItem('fmc_token')
  localStorage.removeItem('fmc_username')
  // Dispatch event so useAuth hook updates
  window.dispatchEvent(new Event('storage'))
  // Avoid redirect loop: only redirect once per 3 seconds
  const now = Date.now()
  if (now - lastLogoutTime > 3000) {
    lastLogoutTime = now
    // Only redirect if not already on login page
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login?expired=1'
    }
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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
