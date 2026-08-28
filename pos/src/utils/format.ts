// Convierte centavos a string TQ con 2 decimales (formato es: coma decimal)
export const fmtTQ = (centavos: number): string => {
  const tq = (centavos || 0) / 100
  return tq.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
