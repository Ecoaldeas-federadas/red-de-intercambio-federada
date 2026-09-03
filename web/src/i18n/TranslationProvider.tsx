import { useEffect, useState, ReactNode } from 'react'
import i18n, { getInitialLanguage } from './index'
import { api } from '../api'

// Lista de namespaces que se cargan desde la API
const ALL_NAMESPACES = [
  'common', 'dashboard', 'transfer', 'nfc', 'federation', 'assembly',
  'organizations', 'products', 'settings', 'profile', 'notifications',
  'external', 'services', 'website', 'public', 'errors', 'audit',
  'satellite', 'translations',
]

interface TranslationProviderProps {
  children: ReactNode
}

/**
 * TranslationProvider se encarga de:
 * 1. Inicializar i18next con el idioma guardado o el del navegador
 * 2. Cargar los namespaces desde la API del nodo (merge de JSON defaults + DB overrides)
 * 3. Cambiar el idioma cuando el usuario lo cambie
 */
export function TranslationProvider({ children }: TranslationProviderProps) {
  const [loaded, setLoaded] = useState(false)

  // Cargar todos los namespaces del idioma actual desde la API
  const loadNamespaces = async (lang: string) => {
    try {
      // Cargar todos los namespaces en paralelo
      const promises = ALL_NAMESPACES.map(async (ns) => {
        try {
          const data = await api.get<Record<string, string>>(`/translations/${lang}/${ns}`)
          if (data && typeof data === 'object') {
            i18n.addResourceBundle(lang, ns, data, true, true)
          }
        } catch {
          // Si falla (ej: endpoint no disponible en nodo viejo), usar defaults embebidos
          // Los defaults ya están cargados para 'common'
        }
      })
      await Promise.all(promises)
    } catch {
      // Silencioso: si no podemos cargar desde la API, usamos defaults
    }
  }

  useEffect(() => {
    const init = async () => {
      const lang = getInitialLanguage()
      await loadNamespaces(lang)
      setLoaded(true)
    }
    init()
  }, [])

  // Escuchar cambios de idioma
  useEffect(() => {
    const handleLanguageChange = (newLang: string) => {
      localStorage.setItem('user_language', newLang)
      loadNamespaces(newLang)
    }
    i18n.on('languageChanged', handleLanguageChange)
    return () => {
      i18n.off('languageChanged', handleLanguageChange)
    }
  }, [])

  // Si no ha cargado, mostrar children de todas formas (usará defaults embebidos)
  // Esto evita un flash blanco en la pantalla
  return <>{children}</>
}

/**
 * Cambia el idioma activo y lo guarda en localStorage.
 */
export async function changeLanguage(lang: string) {
  localStorage.setItem('user_language', lang)
  await i18n.changeLanguage(lang)
}

/**
 * Obtiene el idioma activo actual.
 */
export function getCurrentLanguage(): string {
  return i18n.language || 'es'
}
