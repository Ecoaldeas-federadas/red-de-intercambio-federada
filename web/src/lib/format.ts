// Helpers para convertir entre centavos (almacenamiento interno) y TQ (display).
// El sistema almacena todos los montos en CENTAVOS: 1.00 TQ = 100 centavos.

// Convierte centavos a string TQ con 2 decimales para display.
// Ej: 100 -> "1,00" | -50000 -> "-500,00" | 1250 -> "12,50"
export const fmtTQ = (centavos: number): string => {
  const tq = (centavos || 0) / 100
  return tq.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Convierte un input del usuario (TQ con decimales) a centavos para enviar al API.
// Ej: "1.50" -> 150 | "0,25" -> 25
export const toCents = (val: string | number): number => {
  const n = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val
  if (isNaN(n)) return 0
  return Math.round(n * 100)
}
