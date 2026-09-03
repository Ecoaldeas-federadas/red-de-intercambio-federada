import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { ScrollText, ExternalLink, Shield, Heart, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

export default function LicensePage() {
  const { t } = useTranslation('common')
  const [license, setLicense] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/license').then((d: any) => {
      setLicense(d)
      setLoading(false)
    }).catch((e: any) => {
      setError(e instanceof Error ? e.message : t('license_page.error_load', 'Error al cargar licencia'))
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">{t('license_page.loading', 'Cargando licencia...')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  const fullText = license?.full_text || ''
  const sections = fullText.split(/(?=SECCION \d+\.)/)

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-gray-50">
      {/* Header */}
      <div className="bg-emerald-900 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <ScrollText size={40} />
            <div>
              <h1 className="text-3xl font-bold">{license?.name || t('license_page.default_name', 'Licencia Publica Federada (LPF-1.0)')}</h1>
              <p className="text-emerald-200 text-sm mt-1">{t('license_page.version_prefix', 'Version')} {license?.version || '1.0'} — {t('license_page.copyright', 'Copyright (c) 2026')} {license?.author || 'discapacidad5'}</p>
            </div>
          </div>
          <a
            href={license?.repo || 'https://github.com/discapacidad5/red-de-intercambio-federada'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-emerald-200 hover:text-white text-sm underline"
          >
            <ExternalLink size={14} />
            {t('license_page.repo_link', 'Repositorio Principal')}
          </a>
        </div>
      </div>

      {/* Resumen rapido */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {/* Permitted */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="text-green-600" size={20} />
              <h2 className="font-bold text-green-800">{t('license_page.permitted_title', 'Esta permitido')}</h2>
            </div>
            <ul className="text-sm text-green-700 space-y-1.5">
              <li>✓ {t('license_page.permitted_1', 'Usar el software para cualquier proposito legitimo')}</li>
              <li>✓ {t('license_page.permitted_2', 'Estudiar y auditar el codigo fuente')}</li>
              <li>✓ {t('license_page.permitted_3', 'Copiar y distribuir el software')}</li>
              <li>✓ {t('license_page.permitted_4', 'Modificar y distribuir modificaciones')}</li>
              <li>✓ {t('license_page.permitted_5', 'Hospedar como servicio (SaaS)')}</li>
              <li>✓ {t('license_page.permitted_6', 'Cobrar por instalacion, soporte, capacitacion')}</li>
              <li>✓ {t('license_page.permitted_7', 'Personalizar el diseno visual')}</li>
              <li>✓ {t('license_page.permitted_8', 'Adaptar a cultura, idioma y necesidades locales')}</li>
            </ul>
          </div>

          {/* Prohibited */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="text-red-600" size={20} />
              <h2 className="font-bold text-red-800">{t('license_page.prohibited_title', 'Esta prohibido')}</h2>
            </div>
            <ul className="text-sm text-red-700 space-y-1.5">
              <li>✗ {t('license_page.prohibited_1', 'Vender el codigo fuente como producto')}</li>
              <li>✗ {t('license_page.prohibited_2', 'Licenciar el software a cambio de pago')}</li>
              <li>✗ {t('license_page.prohibited_3', 'Cerrar el codigo de cualquier modificacion')}</li>
              <li>✗ {t('license_page.prohibited_4', 'Combinar con codigo propietario')}</li>
              <li>✗ {t('license_page.prohibited_5', 'Cambiar la licencia (no relicenciamiento)')}</li>
              <li>✗ {t('license_page.prohibited_6', 'Crear un "walled garden" sin federacion')}</li>
              <li>✗ {t('license_page.prohibited_7', 'Modificar el protocolo de federacion unilateralmente')}</li>
              <li>✗ {t('license_page.prohibited_8', 'No registrar tu fork en el Registro de Forks')}</li>
            </ul>
          </div>
        </div>

        {/* Compromisos */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="text-blue-600" size={20} />
            <h2 className="font-bold text-blue-800">{t('license_page.commitments_title', 'Te comprometes a')}</h2>
          </div>
          <ul className="text-sm text-blue-700 space-y-1.5">
            <li>• {t('license_page.commitments_1', 'Publicar toda modificacion bajo LPF-1.0 con codigo fuente completo')}</li>
            <li>• {t('license_page.commitments_2', 'Mantener el codigo en un repositorio publico accesible')}</li>
            <li>• {t('license_page.commitments_3', 'Incluir atribucion al creador (discapacidad5) y el repositorio principal')}</li>
            <li>• {t('license_page.commitments_4', 'Mantener compatibilidad de federacion con el repositorio principal')}</li>
            <li>• {t('license_page.commitments_5', 'Registrar tu fork en forks-registry/registry.md')}</li>
            <li>• {t('license_page.commitments_6', 'Si tu SaaS supera USD 12,000/ano, pagar 2% de regalia sobre el excedente')}</li>
            <li>• {t('license_page.commitments_7', 'Poner el codigo fuente a disposicion de los usuarios del servicio')}</li>
          </ul>
        </div>

        {/* SaaS */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="text-amber-600" size={20} />
            <h2 className="font-bold text-amber-800">{t('license_page.saas_title', 'Regalias por SaaS')}</h2>
          </div>
          <p className="text-sm text-amber-700 mb-2">
            {t('license_page.saas_desc', 'Puedes hospedar el software como servicio cobrando a los usuarios. Si tus ingresos brutos anuales superan USD 12,000:')}
          </p>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>• {t('license_page.saas_1', 'Ingresos de USD 15,000/ano: regalia de USD 60')}</li>
            <li>• {t('license_page.saas_2', 'Ingresos de USD 50,000/ano: regalia de USD 760')}</li>
            <li>• {t('license_page.saas_3', 'Ingresos de USD 100,000/ano: regalia de USD 1,760')}</li>
          </ul>
          <p className="text-xs text-amber-600 mt-2">{t('license_page.saas_note', 'La regalia es 2% sobre el excedente del umbral. Se paga trimestralmente.')}</p>
        </div>

        {/* Texto completo */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ScrollText size={18} />
            {t('license_page.full_text_title', 'Texto completo de la licencia')}
          </h2>
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-xs text-gray-700 font-mono leading-relaxed bg-gray-50 p-4 rounded-lg overflow-x-auto">
              {fullText}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-6 text-sm text-gray-500">
          <p className="flex items-center justify-center gap-2">
            <Heart size={14} className="text-red-400" />
            {t('license_page.footer_text', 'Software libre para redes de trueque y comunidades federadas')}
          </p>
          <p className="mt-1">
            <a
              href={license?.repo || 'https://github.com/discapacidad5/red-de-intercambio-federada'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:underline"
            >
              {license?.repo || 'https://github.com/discapacidad5/red-de-intercambio-federada'}
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
