import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Importar TODAS las traducciones embebidas en el bundle como fallback.
// Esto garantiza que las traducciones funcionen incluso si la API falla.
import esCommon from '../locales/es/common.json'
import enCommon from '../locales/en/common.json'
import esDashboard from '../locales/es/dashboard.json'
import enDashboard from '../locales/en/dashboard.json'
import esTransfer from '../locales/es/transfer.json'
import enTransfer from '../locales/en/transfer.json'
import esNfc from '../locales/es/nfc.json'
import enNfc from '../locales/en/nfc.json'
import esFederation from '../locales/es/federation.json'
import enFederation from '../locales/en/federation.json'
import esAssembly from '../locales/es/assembly.json'
import enAssembly from '../locales/en/assembly.json'
import esOrganizations from '../locales/es/organizations.json'
import enOrganizations from '../locales/en/organizations.json'
import esProducts from '../locales/es/products.json'
import enProducts from '../locales/en/products.json'
import esSettings from '../locales/es/settings.json'
import enSettings from '../locales/en/settings.json'
import esProfile from '../locales/es/profile.json'
import enProfile from '../locales/en/profile.json'
import esNotifications from '../locales/es/notifications.json'
import enNotifications from '../locales/en/notifications.json'
import esExternal from '../locales/es/external.json'
import enExternal from '../locales/en/external.json'
import esServices from '../locales/es/services.json'
import enServices from '../locales/en/services.json'
import esWebsite from '../locales/es/website.json'
import enWebsite from '../locales/en/website.json'
import esPublic from '../locales/es/public.json'
import enPublic from '../locales/en/public.json'
import esErrors from '../locales/es/errors.json'
import enErrors from '../locales/en/errors.json'
import esAudit from '../locales/es/audit.json'
import enAudit from '../locales/en/audit.json'
import esSatellite from '../locales/es/satellite.json'
import enSatellite from '../locales/en/satellite.json'
import esTranslations from '../locales/es/translations.json'
import enTranslations from '../locales/en/translations.json'

// Función para obtener el idioma inicial desde URL, localStorage o navegador
export function getInitialLanguage(): string {
  // 0. URL param ?lang= (máxima prioridad para navegación y enlaces directos)
  try {
    if (typeof window !== 'undefined' && window.location) {
      const urlParams = new URLSearchParams(window.location.search)
      const langParam = urlParams.get('lang')?.toLowerCase()
      if (langParam === 'en' || langParam === 'es') {
        localStorage.setItem('user_language', langParam)
        return langParam
      }
    }
  } catch {}

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

// Recursos embebidos: TODOS los namespaces como fallback.
// La API puede sobrescribir estos con overrides de la BD.
const ALL_NS = [
  'common', 'dashboard', 'transfer', 'nfc', 'federation', 'assembly',
  'organizations', 'products', 'settings', 'profile', 'notifications',
  'external', 'services', 'website', 'public', 'errors', 'audit',
  'satellite', 'translations',
]

const esResources: Record<string, any> = {
  common: esCommon, dashboard: esDashboard, transfer: esTransfer,
  nfc: esNfc, federation: esFederation, assembly: esAssembly,
  organizations: esOrganizations, products: esProducts, settings: esSettings,
  profile: esProfile, notifications: esNotifications, external: esExternal,
  services: esServices, website: esWebsite, public: esPublic,
  errors: esErrors, audit: esAudit, satellite: esSatellite,
  translations: esTranslations,
}

const enResources: Record<string, any> = {
  common: enCommon, dashboard: enDashboard, transfer: enTransfer,
  nfc: enNfc, federation: enFederation, assembly: enAssembly,
  organizations: enOrganizations, products: enProducts, settings: enSettings,
  profile: enProfile, notifications: enNotifications, external: enExternal,
  services: enServices, website: enWebsite, public: enPublic,
  errors: enErrors, audit: enAudit, satellite: enSatellite,
  translations: enTranslations,
}

export const embeddedResources = {
  es: esResources,
  en: enResources,
}

i18n.use(initReactI18next).init({
  resources: embeddedResources as any,
  lng: getInitialLanguage(),
  fallbackLng: 'es',
  defaultNS: 'common',
  ns: ALL_NS,
  interpolation: {
    escapeValue: false, // React ya escapa por defecto
  },
  react: {
    useSuspense: false, // No usar Suspense para evitar flashes
  },
})

// Sync language to window for apiFetch to use in Accept-Language header
if (typeof window !== 'undefined') {
  ;(window as any).__i18n_lang__ = i18n.language || 'es'
  i18n.on('languageChanged', (lng) => {
    ;(window as any).__i18n_lang__ = lng
  })
}

export default i18n
