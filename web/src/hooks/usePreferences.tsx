import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { api } from '../api'
import { useAuth } from './useAuth'
import { setFormatSettings, FormatSettings } from '../lib/format'

export type { FormatSettings }

const DEFAULT_SETTINGS: FormatSettings = {
  locale: 'es',
  number_locale: 'es-VE',
  date_format: 'DD/MM/YYYY',
  time_format: '12h',
  first_day_of_week: 0,
  timezone: 'America/Caracas',
}

const PreferencesContext = createContext<FormatSettings>(DEFAULT_SETTINGS)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<FormatSettings>(() => {
    // Intentar localStorage primero para carga instantanea
    const cached = localStorage.getItem('format_settings')
    if (cached) {
      try { return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) } } catch {}
    }
    return DEFAULT_SETTINGS
  })

  // Sincronizar el store de formato a nivel de modulo cada vez que cambian
  useEffect(() => {
    setFormatSettings(settings)
  }, [settings])

  // Obtener defaults del nodo desde /api/config (publico, sin auth)
  useEffect(() => {
    api.get('/config').then((c: any) => {
      if (c?.format_settings) {
        const merged = { ...DEFAULT_SETTINGS, ...c.format_settings }
        setSettings(merged)
        localStorage.setItem('format_settings', JSON.stringify(merged))
      }
    }).catch(() => {})
  }, [])

  // Cuando el usuario esta logueado, obtener sus preferencias personales.
  // Estas sobreescriben los defaults del nodo.
  const { isAuthenticated } = useAuth()
  useEffect(() => {
    if (!isAuthenticated) return
    api.get('/me/preferences').then((p: any) => {
      if (p && p.locale) {
        const merged = { ...DEFAULT_SETTINGS, ...p }
        setSettings(merged)
        localStorage.setItem('format_settings', JSON.stringify(merged))
      }
    }).catch(() => {})
  }, [isAuthenticated])

  return <PreferencesContext.Provider value={settings}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  return useContext(PreferencesContext)
}

// Hook para actualizar las preferencias del usuario (PUT /api/me/preferences)
export function useUpdatePreferences() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = async (settings: Partial<FormatSettings>): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      await api.put('/me/preferences', settings)
      // Actualizar localStorage
      const current = localStorage.getItem('format_settings')
      const merged = { ...(current ? JSON.parse(current) : {}), ...settings }
      localStorage.setItem('format_settings', JSON.stringify(merged))
      return true
    } catch (e: any) {
      setError(e.message || 'Error al guardar')
      return false
    } finally {
      setSaving(false)
    }
  }

  return { update, saving, error }
}
