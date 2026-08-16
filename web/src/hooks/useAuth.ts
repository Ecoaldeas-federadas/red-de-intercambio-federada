import { useState, useEffect, useCallback } from 'react'

export function useAuth() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('fmc_token'))
  const [username, setUsername] = useState<string | null>(localStorage.getItem('fmc_username'))

  const login = useCallback((newToken: string, newUser: string) => {
    localStorage.setItem('fmc_token', newToken)
    localStorage.setItem('fmc_username', newUser)
    setToken(newToken)
    setUsername(newUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('fmc_token')
    localStorage.removeItem('fmc_username')
    setToken(null)
    setUsername(null)
  }, [])

  useEffect(() => {
    const handler = () => {
      setToken(localStorage.getItem('fmc_token'))
      setUsername(localStorage.getItem('fmc_username'))
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
