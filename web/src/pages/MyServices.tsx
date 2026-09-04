import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Plug, CheckCircle, XCircle, Calendar, RefreshCw } from 'lucide-react'
import { fmtTQ, fmtDate } from '../lib/format'

export default function MyServices() {
  const { t } = useTranslation(['services', 'common'])
  const { currency } = useConfig()
  const [assemblyServices, setAssemblyServices] = useState<any[]>([])
  const [voluntaryServices, setVoluntaryServices] = useState<any[]>([])
  const [mySubs, setMySubs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    setLoading(true)
    Promise.all([
      api.get('/my-services').catch(() => ({ assembly_services: [], voluntary_services: [] })),
      api.get('/my-subscriptions').catch(() => []),
    ]).then(([svcData, subs]: any) => {
      setAssemblyServices(svcData?.assembly_services || [])
      setVoluntaryServices(svcData?.voluntary_services || [])
      setMySubs(Array.isArray(subs) ? subs : [])
      setLoading(false)
    })
  }

  const handleSubscribe = (serviceId: string) => {
    api.post(`/organizations/services/${serviceId}/subscribe`, {}).then(() => {
      loadData()
    }).catch((err: any) => {
      alert(err instanceof Error ? err.message : t('my_services_error_subscribe', 'Error al suscribirse'))
    })
  }

  const handleUnsubscribe = (serviceId: string) => {
    if (!confirm(t('my_services_cancel_confirm', 'Seguro que quieres cancelar este servicio?'))) return
    api.delete(`/organizations/services/${serviceId}/subscribe`).then(() => {
      loadData()
    }).catch((err: any) => {
      alert(err instanceof Error ? err.message : t('my_services_error_unsubscribe', 'Error al desuscribirse'))
    })
  }

  const isSubscribed = (serviceId: string) => {
    return mySubs.some((s: any) => s.service_id === serviceId && (s.status === 'active' || s.status === 'auto'))
  }

  const fmtAmount = (n: number) => fmtTQ(n)

  if (loading) {
    return <div className="flex items-center justify-center py-12"><RefreshCw className="animate-spin text-trueque-600" size={24} /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Plug className="text-trueque-600" size={24} />
        <h1 className="text-2xl font-bold">{t('my_services_title', 'Mis Servicios')}</h1>
      </div>

      {/* Servicios obligatorios de la Asamblea */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-1">{t('my_services_mandatory_title', 'Servicios Comunitarios Obligatorios')}</h2>
        <p className="text-sm text-gray-500 mb-4">
          {t('my_services_mandatory_desc', 'Estos servicios son proporcionados por organizaciones de la Asamblea. Todos los miembros deben pagarlos mensualmente.')}
        </p>

        {assemblyServices.length === 0 ? (
          <p className="text-gray-400 py-4 text-center">{t('my_services_no_mandatory', 'No hay servicios comunitarios activos.')}</p>
        ) : (
          <div className="space-y-3">
            {assemblyServices.map((svc: any) => (
              <div key={svc.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{svc.name}</h3>
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{t('my_services_mandatory_badge', 'Obligatorio')}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{svc.description}</p>
                    <p className="text-sm font-medium text-trueque-700 mt-2">
                      {fmtAmount(svc.amount)} {currency} / {svc.frequency === 'monthly' ? t('my_services_month', 'mes') : svc.frequency}
                    </p>
                    {svc.organization_name && (
                      <p className="text-xs text-gray-400 mt-1">{t('my_services_organization', 'Organizacion:')} {svc.organization_name}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <CheckCircle className="text-green-500" size={20} />
                    <p className="text-xs text-green-600 mt-1">{t('my_services_auto_subscribed', 'Auto-suscrito')}</p>
                  </div>
                </div>
                {(svc.obligations || svc.rights || svc.duties) && (
                  <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    {svc.obligations && (
                      <div><strong className="text-gray-700">{t('my_services_obligations', 'Obligaciones:')}</strong> <span className="text-gray-500">{svc.obligations}</span></div>
                    )}
                    {svc.rights && (
                      <div><strong className="text-gray-700">{t('my_services_rights', 'Derechos:')}</strong> <span className="text-gray-500">{svc.rights}</span></div>
                    )}
                    {svc.duties && (
                      <div><strong className="text-gray-700">{t('my_services_duties', 'Deberes:')}</strong> <span className="text-gray-500">{svc.duties}</span></div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Servicios voluntarios */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-1">{t('my_services_voluntary_title', 'Servicios Voluntarios Disponibles')}</h2>
        <p className="text-sm text-gray-500 mb-4">
          {t('my_services_voluntary_desc', 'Puedes suscribirte o cancelar cuando quieras.')}
        </p>

        {voluntaryServices.length === 0 ? (
          <p className="text-gray-400 py-4 text-center">{t('my_services_no_voluntary', 'No hay servicios voluntarios disponibles.')}</p>
        ) : (
          <div className="space-y-3">
            {voluntaryServices.map((svc: any) => {
              const subscribed = isSubscribed(svc.id)
              return (
                <div key={svc.id} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{svc.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{svc.description}</p>
                      <p className="text-sm font-medium text-trueque-700 mt-2">
                        {svc.service_type === 'benefit' ? '+' : ''}{fmtAmount(svc.amount)} {currency} / {svc.frequency === 'monthly' ? t('my_services_month', 'mes') : svc.frequency}
                      </p>
                      {svc.organization_name && (
                        <p className="text-xs text-gray-400 mt-1">{t('my_services_organization', 'Organizacion:')} {svc.organization_name}</p>
                      )}
                    </div>
                    <div>
                      {subscribed ? (
                        <button
                          onClick={() => handleUnsubscribe(svc.id)}
                          className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium"
                        >
                          {t('my_services_cancel', t('common.cancel'))}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSubscribe(svc.id)}
                          className="px-3 py-1.5 bg-trueque-50 text-trueque-600 hover:bg-trueque-100 rounded-lg text-sm font-medium"
                        >
                          {t('my_services_subscribe', 'Suscribirse')}
                        </button>
                      )}
                    </div>
                  </div>
                  {(svc.obligations || svc.rights || svc.duties) && (
                    <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      {svc.obligations && (
                        <div><strong className="text-gray-700">{t('my_services_obligations', 'Obligaciones:')}</strong> <span className="text-gray-500">{svc.obligations}</span></div>
                      )}
                      {svc.rights && (
                        <div><strong className="text-gray-700">{t('my_services_rights', 'Derechos:')}</strong> <span className="text-gray-500">{svc.rights}</span></div>
                      )}
                      {svc.duties && (
                        <div><strong className="text-gray-700">{t('my_services_duties', 'Deberes:')}</strong> <span className="text-gray-500">{svc.duties}</span></div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Mis suscripciones activas */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-1 flex items-center gap-2">
          <Calendar size={18} /> {t('my_services_active_subs_title', 'Mis Suscripciones Activas')}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {t('my_services_active_subs_desc', 'Resumen de tus servicios activos y proximos cobros.')}
        </p>

        {mySubs.length === 0 ? (
          <p className="text-gray-400 py-4 text-center">{t('my_services_no_subs', 'No tienes suscripciones activas.')}</p>
        ) : (
          <div className="space-y-2">
            {mySubs.map((sub: any) => (
              <div key={sub.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{sub.service_name}</p>
                  <p className="text-xs text-gray-500">{sub.org_name}</p>
                  {sub.next_charge_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      {t('my_services_next_charge', 'Proximo cobro:')} {fmtDate(sub.next_charge_at)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-trueque-700">{fmtAmount(sub.amount)} {currency}</p>
                  <p className="text-xs text-gray-400">
                    {sub.status === 'auto' ? t('my_services_mandatory_label', 'Obligatorio') : t('my_services_voluntary_label', 'Voluntario')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
