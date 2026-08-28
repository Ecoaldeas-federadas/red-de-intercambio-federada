// Formatting helpers for the POS.
// Currency, date and time formatting all respect the configurable
// FormatSettings received from the backend (see hooks/usePreferences).
import { getFormatSettings } from '../hooks/usePreferences'

// Convierte centavos a string TQ con 2 decimales usando el locale configurado
export const fmtTQ = (centavos: number): string => {
  const settings = getFormatSettings()
  const tq = (centavos || 0) / 100
  return tq.toLocaleString(settings.number_locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Formatea una fecha segun date_format configurado (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)
export const fmtDate = (date: Date | string): string => {
  const settings = getFormatSettings()
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  switch (settings.date_format) {
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${yyyy}`
    case 'YYYY-MM-DD':
      return `${yyyy}-${mm}-${dd}`
    default:
      return `${dd}/${mm}/${yyyy}`
  }
}

// Formatea la hora segun time_format configurado (24h o 12h)
export const fmtTime = (date: Date | string): string => {
  const settings = getFormatSettings()
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  if (settings.time_format === '12h') {
    return d.toLocaleString(settings.locale, { hour: '2-digit', minute: '2-digit', hour12: true })
  }
  return d.toLocaleString(settings.locale, { hour: '2-digit', minute: '2-digit', hour12: false })
}

// Formatea fecha + hora combinado
export const fmtDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  return `${fmtDate(d)} ${fmtTime(d)}`
}
