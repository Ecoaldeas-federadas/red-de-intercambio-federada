import { useEffect, useState, ReactNode } from 'react'
import i18n, { getInitialLanguage, flattenResource, isValidLangCode } from './index'
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
 * Carga todos los namespaces de un idioma desde la API del nodo
 * (merge de JSON defaults + DB overrides) y los inyecta en i18next.
 */
export async function reloadLanguageBundles(lang: string) {
  try {
    const promises = ALL_NAMESPACES.map(async (ns) => {
      try {
        const data = await api.get<Record<string, any>>(`/translations/${lang}/${ns}`)
        if (data && typeof data === 'object') {
          const flat = flattenResource(data)
          if (Object.keys(flat).length > 0) {
            i18n.addResourceBundle(lang, ns, flat, true, true)
          }
        }
      } catch {
        // Si falla (ej: endpoint no disponible), usar defaults embebidos
      }
    })
    await Promise.all(promises)
  } catch {
    // Silencioso: si no podemos cargar desde la API, usamos defaults
  }
}

/**
 * TranslationProvider se encarga de:
 * 1. Sincronizar el idioma predeterminado del nodo (elegido en el instalador de YunoHost/Docker o panel)
 * 2. Cargar los namespaces desde la API del nodo (merge de JSON defaults + DB overrides)
 * 3. Cambiar el idioma cuando el usuario lo cambie
 */
export function TranslationProvider({ children }: TranslationProviderProps) {
  const [, setLoaded] = useState(false)

  useEffect(() => {
    const init = async () => {
      let lang = getInitialLanguage()

      // Consultar los idiomas del nodo para sincronizar node_default_language.
      // Si el visitante no ha elegido manualmente un idioma en localStorage ('user_language'),
      // respetar el idioma por defecto configurado en el nodo (ej. en YunoHost).
      try {
        const langs = await api.get<Array<{ code: string; enabled: boolean; is_default: boolean }>>('/languages')
        const def = Array.isArray(langs) ? langs.find((l) => l.is_default && l.enabled) : undefined
        if (def?.code && isValidLangCode(def.code)) {
          localStorage.setItem('node_default_language', def.code)
          const hasExplicitUserChoice = !!localStorage.getItem('user_language')
          if (!hasExplicitUserChoice && def.code !== lang) {
            lang = def.code
            await i18n.changeLanguage(lang)
          }
        }
      } catch {
        // Si falla /api/languages, continuar con el idioma detectado localmente
      }

      await reloadLanguageBundles(lang)
      setLoaded(true)
    }
    init()
  }, [])

  // Escuchar cambios de idioma
  useEffect(() => {
    const handleLanguageChange = (newLang: string) => {
      reloadLanguageBundles(newLang)
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
  await reloadLanguageBundles(lang)
  await i18n.changeLanguage(lang)
}

/**
 * Obtiene el idioma activo actual.
 */
export function getCurrentLanguage(): string {
  return i18n.language || 'es'
}
