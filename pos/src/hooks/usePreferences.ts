// Configurable display format settings for the POS.
// The backend sends `format_settings` in the terminal auth response
// (POST /api/nfc/terminal/auth) and via the public /api/config endpoint.
// We cache them in localStorage so the POS can render correctly even
// before the terminal is authenticated (e.g. on the setup/login screens).

export interface FormatSettings {
  locale: string
  number_locale: string
  date_format: string
  time_format: '24h' | '12h'
  first_day_of_week: number
  timezone: string
}

const STORAGE_KEY = 'pos_format_settings'

export const DEFAULT_SETTINGS: FormatSettings = {
  locale: 'es',
  number_locale: 'es-VE',
  date_format: 'DD/MM/YYYY',
  time_format: '24h',
  first_day_of_week: 1,
  timezone: 'America/Caracas',
}

// Initialize from localStorage so the very first render uses the cached
// settings (avoids a flash of default formatting before the server responds).
let currentSettings: FormatSettings = (() => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) }
  } catch {
    // ignore malformed cache
  }
  return DEFAULT_SETTINGS
})()

export function getFormatSettings(): FormatSettings {
  return currentSettings
}

export function setFormatSettings(s: Partial<FormatSettings>): FormatSettings {
  currentSettings = { ...DEFAULT_SETTINGS, ...currentSettings, ...s }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings))
  } catch {
    // ignore quota / privacy mode errors
  }
  return currentSettings
}
