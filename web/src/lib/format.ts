// Helpers para convertir entre centavos (almacenamiento interno) y TQ (display).
// El sistema almacena todos los montos en CENTAVOS: 1.00 TQ = 100 centavos.
//
// Los formatos (locale, separadores, fecha, hora) son configurables via las
// preferencias del usuario (ver hooks/usePreferences.tsx). El PreferencesProvider
// llama a setFormatSettings() para actualizar este store a nivel de modulo,
// de modo que las funciones de formato puedan usarse desde cualquier sitio
// sin necesidad de hooks.

export interface FormatSettings {
  locale: string
  number_locale: string
  date_format: string
  time_format: '24h' | '12h'
  first_day_of_week: number
  timezone: string
}

// Store a nivel de modulo (actualizado por PreferencesProvider)
let currentSettings: FormatSettings = {
  locale: 'es',
  number_locale: 'es-VE',
  date_format: 'DD/MM/YYYY',
  time_format: '24h',
  first_day_of_week: 1,
  timezone: 'America/Caracas',
}

export function setFormatSettings(s: FormatSettings) {
  currentSettings = s
}

export function getFormatSettings(): FormatSettings {
  return currentSettings
}

// Convierte centavos a string TQ con 2 decimales usando el locale configurado.
// Ej (es-VE): 100 -> "1,00" | -50000 -> "-500,00" | 1250 -> "12,50"
// Ej (en-US): 100 -> "1.00" | -50000 -> "-500.00" | 1250 -> "12.50"
export const fmtTQ = (centavos: number): string => {
  const tq = (centavos || 0) / 100
  return tq.toLocaleString(currentSettings.number_locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Formatea un numero generico usando el locale configurado.
export const fmtNumber = (n: number, decimals = 2): string => {
  return (n || 0).toLocaleString(currentSettings.number_locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// Convierte un input del usuario (TQ con decimales) a centavos para enviar al API.
// Es tolerante a ambos estilos de separador:
//   - es-VE / es-ES: "." miles, "," decimal  -> "1.234,56" => 123456
//   - en-US:        "," miles, "." decimal  -> "1,234.56" => 123456
// Si solo hay un separador, se trata como decimal.
export const toCents = (val: string | number): number => {
  if (typeof val === 'number') return Math.round(val * 100)
  if (!val) return 0
  const str = String(val).trim()
  const hasComma = str.includes(',')
  const hasDot = str.includes('.')
  let normalized: string
  if (hasComma && hasDot) {
    // El ultimo separador es el decimal
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Coma es decimal (es-VE): quitar puntos, coma -> punto
      normalized = str.replace(/\./g, '').replace(',', '.')
    } else {
      // Punto es decimal (en-US): quitar comas
      normalized = str.replace(/,/g, '')
    }
  } else if (hasComma) {
    // Solo coma: tratar como decimal
    normalized = str.replace(',', '.')
  } else {
    normalized = str
  }
  const n = parseFloat(normalized)
  if (isNaN(n)) return 0
  return Math.round(n * 100)
}

// Formatea una fecha segun date_format configurado.
export const fmtDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  switch (currentSettings.date_format) {
    case 'MM/DD/YYYY': return `${mm}/${dd}/${yyyy}`
    case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`
    case 'DD/MM/YYYY':
    default: return `${dd}/${mm}/${yyyy}`
  }
}

// Formatea una hora segun time_format configurado (24h o 12h).
export const fmtTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  if (currentSettings.time_format === '12h') {
    return d.toLocaleString(currentSettings.locale, {
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  }
  return d.toLocaleString(currentSettings.locale, {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// Formatea fecha y hora combinadas.
export const fmtDateTime = (date: Date | string): string => {
  return `${fmtDate(date)} ${fmtTime(date)}`
}
