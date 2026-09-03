import { useTranslation } from 'react-i18next'

/**
 * Hook wrapper para useTranslation.
 * Usa el namespace 'common' por defecto.
 * 
 * Uso:
 *   const { t } = useT()
 *   t('dashboard.title')  // busca en common
 *   
 *   const { t } = useT('dashboard')
 *   t('title')  // busca en dashboard
 */
export function useT(namespace?: string) {
  const { t, i18n } = useTranslation(namespace || 'common')
  return { t, i18n, lang: i18n.language }
}
