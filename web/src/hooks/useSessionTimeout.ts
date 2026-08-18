import { useEffect, useRef } from 'react'
import { useAuth } from './useAuth'

const INACTIVITY_LIMIT = 30 * 60 * 1000 // 30 minutes
const WARNING_BEFORE = 5 * 60 * 1000 // warn 5 minutes before

export function useSessionTimeout() {
  const { isAuthenticated, logout } = useAuth()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (warnRef.current) clearTimeout(warnRef.current)

      // Warning 5 min before
      warnRef.current = setTimeout(() => {
        console.warn('Session expiring in 5 minutes')
      }, INACTIVITY_LIMIT - WARNING_BEFORE)

      // Auto logout after inactivity
      timerRef.current = setTimeout(() => {
        logout()
        window.location.href = '/login?expired=1'
      }, INACTIVITY_LIMIT)
    }

    // Activity events
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove']
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }))

    resetTimer()

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
      if (warnRef.current) clearTimeout(warnRef.current)
    }
  }, [isAuthenticated, logout])
}
