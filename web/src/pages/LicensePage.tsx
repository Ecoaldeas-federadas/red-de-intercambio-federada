import { useState, useEffect } from 'react'
import { api } from '../api'
import { ScrollText, ExternalLink, Shield, Heart, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

export default function LicensePage() {
  const [license, setLicense] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/license').then((d: any) => {
      setLicense(d)
      setLoading(false)
    }).catch((e: any) => {
      setError(e instanceof Error ? e.message : 'Error al cargar licencia')
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Cargando licencia...</p>
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
              <h1 className="text-3xl font-bold">{license?.name || 'Licencia Publica Federada (LPF-1.0)'}</h1>
              <p className="text-emerald-200 text-sm mt-1">Version {license?.version || '1.0'} — Copyright (c) 2026 {license?.author || 'discapacidad5'}</p>
            </div>
          </div>
          <a
            href={license?.repo || 'https://github.com/discapacidad5/red-de-intercambio-federada'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-emerald-200 hover:text-white text-sm underline"
          >
            <ExternalLink size={14} />
            Repositorio Principal
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
              <h2 className="font-bold text-green-800">Esta permitido</h2>
            </div>
            <ul className="text-sm text-green-700 space-y-1.5">
              <li>✓ Usar el software para cualquier proposito legitimo</li>
              <li>✓ Estudiar y auditar el codigo fuente</li>
              <li>✓ Copiar y distribuir el software</li>
              <li>✓ Modificar y distribuir modificaciones</li>
              <li>✓ Hospedar como servicio (SaaS)</li>
              <li>✓ Cobrar por instalacion, soporte, capacitacion</li>
              <li>✓ Personalizar el diseno visual</li>
              <li>✓ Adaptar a cultura, idioma y necesidades locales</li>
            </ul>
          </div>

          {/* Prohibited */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="text-red-600" size={20} />
              <h2 className="font-bold text-red-800">Esta prohibido</h2>
            </div>
            <ul className="text-sm text-red-700 space-y-1.5">
              <li>✗ Vender el codigo fuente como producto</li>
              <li>✗ Licenciar el software a cambio de pago</li>
              <li>✗ Cerrar el codigo de cualquier modificacion</li>
              <li>✗ Combinar con codigo propietario</li>
              <li>✗ Cambiar la licencia (no relicenciamiento)</li>
              <li>✗ Crear un "walled garden" sin federacion</li>
              <li>✗ Modificar el protocolo de federacion unilateralmente</li>
              <li>✗ No registrar tu fork en el Registro de Forks</li>
            </ul>
          </div>
        </div>

        {/* Compromisos */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="text-blue-600" size={20} />
            <h2 className="font-bold text-blue-800">Te comprometes a</h2>
          </div>
          <ul className="text-sm text-blue-700 space-y-1.5">
            <li>• Publicar toda modificacion bajo LPF-1.0 con codigo fuente completo</li>
            <li>• Mantener el codigo en un repositorio publico accesible</li>
            <li>• Incluir atribucion al creador (discapacidad5) y el repositorio principal</li>
            <li>• Mantener compatibilidad de federacion con el repositorio principal</li>
            <li>• Registrar tu fork en forks-registry/registry.md</li>
            <li>• Si tu SaaS supera USD 12,000/ano, pagar 2% de regalia sobre el excedente</li>
            <li>• Poner el codigo fuente a disposicion de los usuarios del servicio</li>
          </ul>
        </div>

        {/* SaaS */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="text-amber-600" size={20} />
            <h2 className="font-bold text-amber-800">Regalias por SaaS</h2>
          </div>
          <p className="text-sm text-amber-700 mb-2">
            Puedes hospedar el software como servicio cobrando a los usuarios. Si tus ingresos brutos anuales superan USD 12,000:
          </p>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>• Ingresos de USD 15,000/ano: regalia de USD 60</li>
            <li>• Ingresos de USD 50,000/ano: regalia de USD 760</li>
            <li>• Ingresos de USD 100,000/ano: regalia de USD 1,760</li>
          </ul>
          <p className="text-xs text-amber-600 mt-2">La regalia es 2% sobre el excedente del umbral. Se paga trimestralmente.</p>
        </div>

        {/* Texto completo */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ScrollText size={18} />
            Texto completo de la licencia
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
            Software libre para redes de trueque y comunidades federadas
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
