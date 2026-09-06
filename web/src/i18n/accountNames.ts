import i18n from 'i18next'

// Mapa de usernames de cuentas especiales a claves de traducción
const SPECIAL_ACCOUNT_KEYS: Record<string, { displayKey?: string; aliasKey?: string }> = {
  asamblea: { displayKey: 'assembly:assembly_general_assembly', aliasKey: 'assembly:alias_asamblea' },
  impuestos: { displayKey: 'assembly:assembly_general_assembly', aliasKey: 'assembly:alias_impuestos' },
  fondo_comunitario: { displayKey: 'assembly:community_fund', aliasKey: 'assembly:alias_fondo_comunitario' },
}

/**
 * Traduce el display_name de una cuenta especial (asamblea, impuestos, fondo_comunitario)
 * al idioma actual. Si no es una cuenta especial, devuelve el nombre original.
 */
export function translateAccountName(displayName: string, username?: string): string {
  if (!username) return displayName
  const special = SPECIAL_ACCOUNT_KEYS[username.toLowerCase()]
  if (special?.displayKey) {
    const translated = i18n.t(special.displayKey)
    if (translated && translated !== special.displayKey) {
      return translated
    }
  }
  return displayName
}

/**
 * Traduce un alias de cuenta especial al idioma actual.
 * Usa las claves alias_asamblea, alias_impuestos, alias_fondo_comunitario.
 */
export function translateAlias(alias: string): string {
  const special = SPECIAL_ACCOUNT_KEYS[alias.toLowerCase()]
  if (special?.aliasKey) {
    const translated = i18n.t(special.aliasKey)
    if (translated && translated !== special.aliasKey) {
      return translated
    }
  }
  return alias
}
