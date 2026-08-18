import { useEffect, useRef } from 'react'
import { useAuth } from './useAuth'

const INACTIVITY_LIMIT = 2 * 60 * 60 * 1000 // 2 hours (aumentado de 30 min)

export function useSessionTimeout() {
  const { isAuthenticated, logout } = useAuth()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      // Auto logout after inactivity - NO redirect, just clear token
      // The SessionExpiredModal will handle re-login without losing state
      timerRef.current = setTimeout(() => {
        logout()
      }, INACTIVITY_LIMIT)
    }

    // Activity events - any user interaction resets the timer
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove', 'click', 'input', 'wheel']
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }))

    resetTimer()

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isAuthenticated, logout])
}
