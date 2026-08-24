import { useState, useEffect, useCallback } from 'react'

// Claves de localStorage separadas por ruta base.
// El padre (/main) y el demo (/demo) usan claves diferentes
// para que las sesiones no se mezclen.
function getStorageKeys() {
  const basePath = typeof window !== 'undefined' ? (window.__BASE_PATH__ || '') : ''
  let prefix = 'fmc'
  if (basePath === '/demo') prefix = 'fmc_demo'
  else if (basePath === '/main') prefix = 'fmc_main'
  return {
    tokenKey: `${prefix}_token`,
    usernameKey: `${prefix}_username`,
  }
}

export function useAuth() {
  const keys = getStorageKeys()
  const [token, setToken] = useState<string | null>(localStorage.getItem(keys.tokenKey))
  const [username, setUsername] = useState<string | null>(localStorage.getItem(keys.usernameKey))

  const login = useCallback((newToken: string, newUser: string) => {
    const k = getStorageKeys()
    localStorage.setItem(k.tokenKey, newToken)
    localStorage.setItem(k.usernameKey, newUser)
    setToken(newToken)
    setUsername(newUser)
  }, [])

  const logout = useCallback(() => {
    const k = getStorageKeys()
    localStorage.removeItem(k.tokenKey)
    localStorage.removeItem(k.usernameKey)
    setToken(null)
    setUsername(null)
  }, [])

  useEffect(() => {
    const handler = () => {
      const k = getStorageKeys()
      setToken(localStorage.getItem(k.tokenKey))
      setUsername(localStorage.getItem(k.usernameKey))
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return {
    token,
    username,
    isAuthenticated: !!token,
    login,
    logout,
  }
}
