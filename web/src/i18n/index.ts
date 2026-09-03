import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Importar traducciones por defecto (embebidas en el bundle)
import esCommon from '../locales/es/common.json'
import enCommon from '../locales/en/common.json'

// Función para obtener el idioma inicial desde localStorage o navegador
export function getInitialLanguage(): string {
  // 1. localStorage (preferencia del usuario)
  const stored = localStorage.getItem('user_language')
  if (stored) return stored

  // 2. localStorage (idioma del nodo configurado en setup)
  const nodeLang = localStorage.getItem('node_default_language')
  if (nodeLang) return nodeLang

  // 3. Navegador
  const browserLang = navigator.language?.split('-')[0]
  if (browserLang === 'en') return 'en'
  if (browserLang === 'es') return 'es'

  // 4. Default
  return 'es'
}

// Recursos embebidos para el Setup (antes de que el nodo exista)
// Los demás namespaces se cargan dinámicamente desde la API
export const embeddedResources = {
  es: { common: esCommon },
  en: { common: enCommon },
}

i18n.use(initReactI18next).init({
  resources: embeddedResources,
  lng: getInitialLanguage(),
  fallbackLng: 'es',
  defaultNS: 'common',
  ns: ['common'],
  interpolation: {
    escapeValue: false, // React ya escapa por defecto
  },
  react: {
    useSuspense: false, // No usar Suspense para evitar flashes
  },
})

export default i18n
