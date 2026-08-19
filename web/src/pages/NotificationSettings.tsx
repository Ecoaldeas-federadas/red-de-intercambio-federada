import { useState, useEffect } from 'react'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { Bell, Mail, Send, MessageSquare, Globe, Webhook, Save, TestTube, Check, X, Smartphone, BellRing } from 'lucide-react'

const CHANNEL_INFO: Record<string, { label: string; icon: any; color: string; description: string }> = {
  email: { label: 'Email (SMTP)', icon: Mail, color: 'text-blue-600', description: 'Envia notificaciones por correo electronico via SMTP' },
  telegram: { label: 'Telegram', icon: Send, color: 'text-cyan-600', description: 'Bot de Telegram para mensajes directos' },
  matrix: { label: 'Matrix (federada)', icon: MessageSquare, color: 'text-green-600', description: 'Red federada soberana - recomendada' },
  xmpp: { label: 'XMPP (Jabber federado)', icon: MessageSquare, color: 'text-orange-600', description: 'Red federada libre - via API HTTP del servidor' },
  webpush: { label: 'Web Push (navegador)', icon: BellRing, color: 'text-indigo-600', description: 'Notificaciones push del navegador - se auto-configura, no requiere datos manuales' },
  sms: { label: 'SMS', icon: Smartphone, color: 'text-pink-600', description: 'SMS via Twilio, Vonage, o API propia' },
  whatsapp: { label: 'WhatsApp (opcional)', icon: MessageSquare, color: 'text-green-500', description: 'Meta Cloud API o API propia - propietario' },
  webhook: { label: 'Webhook generico', icon: Webhook, color: 'text-purple-600', description: 'POST HTTP a una URL configurable' },
}

const NOTIF_TYPES = [
  { code: 'payment_received', label: 'Pago recibido' },
  { code: 'assembly_scheduled', label: 'Asamblea programada' },
  { code: 'voting_opened', label: 'Votacion abierta' },
  { code: 'proposal_result', label: 'Resultado de propuesta' },
  { code: 'quorum_status', label: 'Estado de quorum' },
  { code: 'minutes_published', label: 'Minuta publicada' },
  { code: 'admission_approved', label: 'Admision aprobada' },
  { code: 'admission_rejected', label: 'Admision rechazada' },
  { code: 'recovery_request_created', label: 'Solicitud de recuperacion' },
  { code: 'department_assigned', label: 'Asignacion a departamento' },
  { code: 'org_board_assigned', label: 'Asignacion a junta' },
  { code: 'org_approved', label: 'Organizacion aprobada' },
  { code: 'federation_peer_registered', label: 'Nodo par registrado' },
  { code: 'federation_product_approved', label: 'Producto federado aprobado' },
]

export default function NotificationSettings() {
  const { hasPermission } = usePermissions()
  const canManageGateways = hasPermission('config.manage')
  const [tab, setTab] = useState<'preferences' | 'gateways' | 'contacts'>('preferences')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Preferencias del usuario
  const [preferences, setPreferences] = useState<Record<string, Record<string, boolean>>>({})
  const [channels, setChannels] = useState<any[]>([])

  // Configuracion de pasarelas (admin)
  const [gateways, setGateways] = useState<any[]>([])
  const [editingGateway, setEditingGateway] = useState<string | null>(null)
  const [gatewayForms, setGatewayForms] = useState<Record<string, any>>({})
  const [testingChannel, setTestingChannel] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string } | null>>({})

  // Contactos del usuario
  const [contacts, setContacts] = useState({ email: '', phone: '', telegram_chat_id: '', matrix_user_id: '', xmpp_jid: '', quiet_hours_start: '', quiet_hours_end: '', digest_mode: 'instant' })
  const [webpushSupported, setWebpushSupported] = useState(false)
  const [webpushSubscribed, setWebpushSubscribed] = useState(false)
  const [webpushLoading, setWebpushLoading] = useState(false)

  useEffect(() => {
    loadAll()
    // Verificar soporte de WebPush
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setWebpushSupported(true)
      // Verificar si ya esta suscrito
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setWebpushSubscribed(!!sub)
        })
      }).catch(() => {})
    }
  }, [])

  const subscribeWebPush = async () => {
    setWebpushLoading(true)
    setError('')
    try {
      // 0. Verificar que el navegador soporta Service Worker y Push
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setError('Tu navegador no soporta notificaciones push')
        setWebpushLoading(false)
        return
      }

      // 1. Asegurar que el Service Worker esté registrado
      const reg = await navigator.serviceWorker.register('/sw.js')
      console.log('SW registrado:', reg.scope)

      // 2. Obtener la VAPID public key del backend (se auto-genera si no existe)
      const vapidRes = await api.get<any>('/notifications/webpush/vapid-key')
      const vapidKey = vapidRes?.vapid_public_key

      if (!vapidKey) {
        setError('No se pudo obtener la clave VAPID del servidor')
        setWebpushLoading(false)
        return
      }

      // 3. Solicitar permiso de notificaciones al usuario
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Permiso de notificaciones denegado por el navegador')
        setWebpushLoading(false)
        return
      }

      // 4. Convertir la VAPID key de Base64URL a ArrayBuffer (requerido por PushManager)
      const applicationServerKey = urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer

      // 5. Suscribirse al push manager
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })

      // 6. Enviar subscription al backend
      await api.post('/notifications/webpush/subscribe', sub.toJSON())
      setWebpushSubscribed(true)
      setSuccess('Suscrito a notificaciones push del navegador')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      console.error('Error WebPush:', e)
      setError('Error al suscribirse: ' + (e?.message || 'desconocido'))
    }
    setWebpushLoading(false)
  }

  // Convierte una clave Base64URL a Uint8Array (requerido por PushManager)
  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  const unsubscribeWebPush = async () => {
    setWebpushLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      await api.delete('/notifications/webpush/subscribe')
      setWebpushSubscribed(false)
      setSuccess('Suscripcion cancelada')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError('Error: ' + (e.message || 'desconocido'))
    }
    setWebpushLoading(false)
  }

  const loadAll = () => {
    api.get<any[]>('/notifications/channels').then((d: any) => setChannels(Array.isArray(d) ? d : [])).catch(() => {})
    api.get<any>('/notifications/preferences').then((d: any) => {
      const prefs: Record<string, Record<string, boolean>> = {}
      if (Array.isArray(d)) {
        d.forEach((p: any) => {
          if (!prefs[p.notification_type]) prefs[p.notification_type] = {}
          prefs[p.notification_type][p.channel_code] = p.is_enabled
        })
      }
      setPreferences(prefs)
    }).catch(() => {})
    if (canManageGateways) {
      api.get<any>('/notifications/gateways').then((d: any) => setGateways(Array.isArray(d) ? d : [])).catch(() => {})
    }
    // Cargar contactos del perfil
    api.get<any>('/auth/me').then((d: any) => {
      if (d) {
        setContacts({
          email: d.email || '',
          phone: d.phone || '',
          telegram_chat_id: d.telegram_chat_id || '',
          matrix_user_id: d.matrix_user_id || '',
          xmpp_jid: d.xmpp_jid || '',
          quiet_hours_start: d.quiet_hours_start != null ? String(d.quiet_hours_start) : '',
          quiet_hours_end: d.quiet_hours_end != null ? String(d.quiet_hours_end) : '',
          digest_mode: d.digest_mode || 'instant',
        })
      }
    }).catch(() => {})
  }

  const togglePreference = (notifType: string, channel: string, enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [notifType]: { ...(prev[notifType] || {}), [channel]: enabled }
    }))
  }

  // Activar/desactivar todos los canales para un evento (fila)
  const toggleAllForEvent = (notifType: string, enabled: boolean) => {
    setPreferences(prev => {
      const updated = { ...prev }
      const row: Record<string, boolean> = {}
      activeChannels.forEach(c => { row[c.channel_code] = enabled })
      updated[notifType] = row
      return updated
    })
  }

  // Activar/desactivar todos los eventos para un canal (columna)
  const toggleAllForChannel = (channel: string, enabled: boolean) => {
    setPreferences(prev => {
      const updated = { ...prev }
      NOTIF_TYPES.forEach(nt => {
        updated[nt.code] = { ...(updated[nt.code] || {}), [channel]: enabled }
      })
      return updated
    })
  }

  // Activar/desactivar absolutamente todo
  const enableAll = (enabled: boolean) => {
    setPreferences(prev => {
      const updated: Record<string, Record<string, boolean>> = {}
      NOTIF_TYPES.forEach(nt => {
        const row: Record<string, boolean> = {}
        activeChannels.forEach(c => { row[c.channel_code] = enabled })
        updated[nt.code] = row
      })
      return updated
    })
  }

  // Canales activos: solo los que tienen gateway configurado (excluyendo in_app que siempre esta activo)
  const activeChannels = channels.filter(c => c.channel_code !== 'in_app' && c.gateway_active === true)

  const savePreferences = () => {
    setError(''); setSuccess('')
    const payload = []
    for (const [notifType, chans] of Object.entries(preferences)) {
      for (const [channel, enabled] of Object.entries(chans)) {
        payload.push({ notification_type: notifType, channel_code: channel, is_enabled: enabled })
      }
    }
    api.put('/notifications/preferences', { preferences: payload }).then(() => {
      setSuccess('Preferencias guardadas')
      setTimeout(() => setSuccess(''), 3000)
    }).catch(() => setError('Error al guardar preferencias'))
  }

  const saveContacts = () => {
    setError(''); setSuccess('')
    const payload = {
      email: contacts.email || null,
      phone: contacts.phone || null,
      telegram_chat_id: contacts.telegram_chat_id || null,
      matrix_user_id: contacts.matrix_user_id || null,
      xmpp_jid: contacts.xmpp_jid || null,
      quiet_hours_start: contacts.quiet_hours_start !== '' ? parseInt(contacts.quiet_hours_start) : null,
      quiet_hours_end: contacts.quiet_hours_end !== '' ? parseInt(contacts.quiet_hours_end) : null,
      digest_mode: contacts.digest_mode || 'instant',
    }
    api.put('/auth/me/contacts', payload).then(() => {
      setSuccess('Datos de contacto guardados')
      setTimeout(() => setSuccess(''), 3000)
    }).catch(() => setError('Error al guardar contactos'))
  }

  const updateGatewayField = (channel: string, field: string, value: any) => {
    setGatewayForms(prev => ({
      ...prev,
      [channel]: { ...(prev[channel] || {}), [field]: value }
    }))
  }

  const saveGateway = (channel: string) => {
    setError(''); setSuccess('')
    const form = gatewayForms[channel] || {}
    const config: Record<string, any> = {}
    Object.keys(form).forEach(k => {
      if (form[k] !== '' && form[k] !== null) config[k] = form[k]
    })
    api.put(`/notifications/gateways/${channel}`, {
      is_active: config.is_active ?? true,
      config: config
    }).then(() => {
      setSuccess(`Pasarela ${channel} guardada`)
      setEditingGateway(null)
      loadAll()
      setTimeout(() => setSuccess(''), 3000)
    }).catch(() => setError(`Error al guardar pasarela ${channel}`))
  }

  const testGateway = (channel: string) => {
    setTestingChannel(channel)
    setTestResults(prev => ({ ...prev, [channel]: null }))
    api.post(`/notifications/gateways/${channel}/test`, {}).then((d: any) => {
      const success = d?.success !== false
      const message = d?.error ? `${d.message}: ${d.error}` : (d?.message || `Test de ${channel} enviado`)
      setTestResults(prev => ({ ...prev, [channel]: { success, message } }))
    }).catch((e: any) => {
      const msg = e?.message || `Error en test de ${channel}`
      setTestResults(prev => ({ ...prev, [channel]: { success: false, message: msg } }))
    }).finally(() => setTestingChannel(null))
  }

  const renderGatewayFields = (channel: string): React.ReactNode => {
    const form = gatewayForms[channel] || {}
    const existing = gateways.find(g => g.channel_code === channel)
    const currentConfig = existing?.config || {}

    const fieldDefs: Record<string, { key: string; label: string; type?: string; placeholder?: string }[]> = {
      email: [
        { key: 'host', label: 'Servidor SMTP', placeholder: 'smtp.gmail.com' },
        { key: 'port', label: 'Puerto', placeholder: '587' },
        { key: 'username', label: 'Usuario SMTP', placeholder: 'user@example.com' },
        { key: 'password', label: 'Contrasena', type: 'password' },
        { key: 'from_email', label: 'Email remitente', placeholder: 'noreply@midominio.org' },
        { key: 'from_name', label: 'Nombre remitente', placeholder: 'Red Federada' },
      ],
      telegram: [
        { key: 'bot_token', label: 'Bot Token', type: 'password', placeholder: '123456:ABC-DEF...' },
      ],
      matrix: [
        { key: 'homeserver_url', label: 'Homeserver URL', placeholder: 'https://matrix.org' },
        { key: 'access_token', label: 'Access Token', type: 'password' },
        { key: 'default_room_id', label: 'Room ID por defecto', placeholder: '!room:matrix.org' },
      ],
      xmpp: [
        { key: 'endpoint_url', label: 'URL API XMPP (Prosody/ejabberd/bridge)', placeholder: 'https://xmpp.midominio.org/rest' },
        { key: 'auth_token', label: 'Token auth', type: 'password' },
        { key: 'from_jid', label: 'JID remitente', placeholder: 'bot@midominio.org' },
      ],
      webpush: [], // VAPID keys se auto-generan, no requiere config manual
      sms: [
        { key: 'provider', label: 'Proveedor', placeholder: 'twilio | vonage | custom' },
        { key: 'account_sid', label: 'Account SID (Twilio)', placeholder: 'AC...' },
        { key: 'auth_token', label: 'Auth Token (Twilio)', type: 'password' },
        { key: 'from_number', label: 'Numero remitente (Twilio)', placeholder: '+1234567890' },
        { key: 'api_key', label: 'API Key (Vonage)', placeholder: 'Solo Vonage' },
        { key: 'api_secret', label: 'API Secret (Vonage)', type: 'password' },
        { key: 'endpoint_url', label: 'URL API propia (custom)', placeholder: 'Solo custom' },
      ],
      whatsapp: [
        { key: 'phone_number_id', label: 'Phone Number ID (Meta)', placeholder: 'Solo para Meta Cloud API' },
        { key: 'access_token', label: 'Access Token (Meta)', type: 'password' },
        { key: 'endpoint_url', label: 'URL API propia', placeholder: 'Alternativo a Meta' },
        { key: 'auth_token', label: 'Token API propia', type: 'password' },
      ],
      webhook: [
        { key: 'endpoint_url', label: 'URL del webhook', placeholder: 'https://...' },
        { key: 'auth_token', label: 'Token (Bearer)', type: 'password' },
      ],
    }

    const fields = fieldDefs[channel] || []
    return (
      <div className="space-y-3">
        {channel === 'webpush' && fields.length === 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded p-3 text-sm text-indigo-700">
            <p className="font-medium mb-1">Web Push se configura automaticamente</p>
            <p className="text-xs">
              Las claves VAPID se generan solas cuando un usuario activa las notificaciones push
              desde su pagina de contactos. No necesitas configurar nada aqui.
              Solo activa la pasarela y los usuarios podran suscribirse desde sus ajustes.
            </p>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active ?? existing?.is_active ?? false}
            onChange={e => updateGatewayField(channel, 'is_active', e.target.checked)}
          />
          Activar pasarela
        </label>
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-xs text-gray-600 mb-1">{f.label}</label>
            <input
              type={f.type || 'text'}
              value={form[f.key] ?? currentConfig[f.key] ?? ''}
              onChange={e => updateGatewayField(channel, f.key, e.target.value)}
              placeholder={f.placeholder}
              className="input text-sm"
            />
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <button onClick={() => saveGateway(channel)} className="btn-primary text-sm flex items-center gap-1">
            <Save size={14} /> Guardar
          </button>
          <button onClick={() => testGateway(channel)} disabled={testingChannel === channel} className="btn-secondary text-sm flex items-center gap-1">
            <TestTube size={14} /> {testingChannel === channel ? 'Enviando...' : 'Probar'}
          </button>
          <button onClick={() => setEditingGateway(null)} className="btn-secondary text-sm">Cancelar</button>
        </div>
        {testResults[channel] && (
          <div className={`text-sm p-2 rounded mt-2 ${testResults[channel]!.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {testResults[channel]!.success ? <Check size={14} className="inline mr-1" /> : <X size={14} className="inline mr-1" />}
            {testResults[channel]!.message}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="text-trueque-600" />
          Notificaciones
        </h1>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded text-sm flex items-center gap-2"><X size={16} />{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-3 rounded text-sm flex items-center gap-2"><Check size={16} />{success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('preferences')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'preferences' ? 'border-trueque-600 text-trueque-600' : 'border-transparent text-gray-500'}`}
        >
          Mis preferencias
        </button>
        <button
          onClick={() => setTab('contacts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'contacts' ? 'border-trueque-600 text-trueque-600' : 'border-transparent text-gray-500'}`}
        >
          Mis contactos
        </button>
        {canManageGateways && (
          <button
            onClick={() => setTab('gateways')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'gateways' ? 'border-trueque-600 text-trueque-600' : 'border-transparent text-gray-500'}`}
          >
            Pasarelas (admin)
          </button>
        )}
      </div>

      {/* Tab: Preferencias */}
      {tab === 'preferences' && (
        <div className="card">
          <p className="text-sm text-gray-600 mb-4">
            Selecciona por que canal quieres recibir cada tipo de notificacion.
            El canal <strong>in_app</strong> (campana) siempre esta activo.
            Solo se muestran los canales que el administrador ha configurado.
          </p>
          {activeChannels.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">
              <Bell size={24} className="mx-auto mb-2 opacity-30" />
              No hay pasarelas configuradas. El administrador debe activar al menos una pasarela
              (Email, Telegram, Matrix, etc.) para que puedas elegir canales de envio.
              Mientras tanto, recibiras notificaciones en la campana de la aplicacion.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2">
                      <div className="flex items-center gap-2">
                        <span>Evento</span>
                      </div>
                    </th>
                    {activeChannels.map(c => {
                      const info = CHANNEL_INFO[c.channel_code]
                      const Icon = info?.icon || Bell
                      // Checkbox cabecera columna: activar todos los eventos para este canal
                      const allOn = activeChannels.length > 0 && NOTIF_TYPES.every(nt => preferences[nt.code]?.[c.channel_code] === true)
                      const someOn = NOTIF_TYPES.some(nt => preferences[nt.code]?.[c.channel_code] === true)
                      return (
                        <th key={c.channel_code} className="text-center py-2 px-2">
                          <div className="flex flex-col items-center gap-1">
                            <Icon size={16} className={info?.color} />
                            <span className="text-xs">{info?.label || c.channel_code}</span>
                            <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={allOn}
                                ref={el => { if (el) el.indeterminate = !allOn && someOn }}
                                onChange={e => toggleAllForChannel(c.channel_code, e.target.checked)}
                              />
                              Todos
                            </label>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {NOTIF_TYPES.map(nt => {
                    // Checkbox cabecera fila: activar todos los canales para este evento
                    const allChannelsOn = activeChannels.length > 0 && activeChannels.every(c => preferences[nt.code]?.[c.channel_code] === true)
                    const someChannelsOn = activeChannels.some(c => preferences[nt.code]?.[c.channel_code] === true)
                    return (
                      <tr key={nt.code} className="border-b border-gray-50">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={allChannelsOn}
                              ref={el => { if (el) el.indeterminate = !allChannelsOn && someChannelsOn }}
                              onChange={e => toggleAllForEvent(nt.code, e.target.checked)}
                            />
                            <span>{nt.label}</span>
                          </div>
                        </td>
                        {activeChannels.map(c => (
                          <td key={c.channel_code} className="text-center py-2 px-2">
                            <input
                              type="checkbox"
                              checked={preferences[nt.code]?.[c.channel_code] ?? false}
                              onChange={e => togglePreference(nt.code, c.channel_code, e.target.checked)}
                            />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button onClick={savePreferences} className="btn-primary flex items-center gap-2">
              <Save size={16} /> Guardar preferencias
            </button>
            {activeChannels.length > 0 && (
              <>
                <button onClick={() => enableAll(true)} className="btn-secondary text-sm">
                  Activar todo
                </button>
                <button onClick={() => enableAll(false)} className="btn-secondary text-sm">
                  Desactivar todo
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab: Contactos */}
      {tab === 'contacts' && (
        <div className="card space-y-4">
          <p className="text-sm text-gray-600">
            Tus datos de contacto para recibir notificaciones por los distintos canales.
            Estos datos son privados y no se comparten.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" value={contacts.email} onChange={e => setContacts({ ...contacts, email: e.target.value })} className="input" placeholder="tu@email.org" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefono (WhatsApp)</label>
              <input type="tel" value={contacts.phone} onChange={e => setContacts({ ...contacts, phone: e.target.value })} className="input" placeholder="+1234567890" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telegram Chat ID</label>
              <input type="text" value={contacts.telegram_chat_id} onChange={e => setContacts({ ...contacts, telegram_chat_id: e.target.value })} className="input" placeholder="123456789" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Matrix User ID</label>
              <input type="text" value={contacts.matrix_user_id} onChange={e => setContacts({ ...contacts, matrix_user_id: e.target.value })} className="input" placeholder="@usuario:matrix.org" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">XMPP JID</label>
              <input type="text" value={contacts.xmpp_jid} onChange={e => setContacts({ ...contacts, xmpp_jid: e.target.value })} className="input" placeholder="usuario@jabber.org" />
            </div>
          </div>

          {/* Horas silenciosas */}
          <div className="border-t border-gray-200 pt-4 mt-2">
            <h3 className="font-medium text-sm mb-1">Horas Silenciosas (Quiet Hours)</h3>
            <p className="text-xs text-gray-500 mb-3">
              Durante este rango no se enviaran notificaciones por pasarelas externas (email, telegram, etc.).
              Las notificaciones in-app (campana) siempre se entregan. Deja vacio para desactivar.
            </p>
            <div className="grid grid-cols-2 gap-4 max-w-xs">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Desde (hora)</label>
                <select
                  value={contacts.quiet_hours_start}
                  onChange={e => setContacts({ ...contacts, quiet_hours_start: e.target.value })}
                  className="input text-sm"
                >
                  <option value="">Desactivado</option>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i}:00</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Hasta (hora)</label>
                <select
                  value={contacts.quiet_hours_end}
                  onChange={e => setContacts({ ...contacts, quiet_hours_end: e.target.value })}
                  className="input text-sm"
                  disabled={contacts.quiet_hours_start === ''}
                >
                  <option value="">-</option>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i}:00</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Modo digest de email */}
          <div className="border-t border-gray-200 pt-4 mt-2">
            <h3 className="font-medium text-sm mb-1">Modo de envio por email</h3>
            <p className="text-xs text-gray-500 mb-3">
              Elige como recibir las notificaciones por email.
              "Instantaneo" envia cada notificacion por separado.
              "Resumen diario" agrupa todas las notificaciones del dia en un solo email (a las 8:00 AM).
            </p>
            <select
              value={contacts.digest_mode}
              onChange={e => setContacts({ ...contacts, digest_mode: e.target.value })}
              className="input text-sm max-w-xs"
            >
              <option value="instant">Instantaneo (cada notificacion por separado)</option>
              <option value="daily">Resumen diario (un email por la manana)</option>
            </select>
          </div>
          <div>
            <button onClick={saveContacts} className="btn-primary flex items-center gap-2">
              <Save size={16} /> Guardar contactos
            </button>
          </div>

          {/* WebPush del navegador */}
          {webpushSupported && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <BellRing size={18} className="text-indigo-600" />
                <h3 className="font-medium text-sm">Notificaciones Push del Navegador</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Recibe notificaciones directamente en tu navegador, incluso cuando la app no esta abierta.
                No requiere terceros - funciona con el estandar W3C Push.
              </p>
              {webpushSubscribed ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <Check size={16} /> Suscrito
                  </span>
                  <button onClick={unsubscribeWebPush} disabled={webpushLoading} className="btn-secondary text-sm">
                    {webpushLoading ? '...' : 'Cancelar suscripcion'}
                  </button>
                </div>
              ) : (
                <button onClick={subscribeWebPush} disabled={webpushLoading} className="btn-primary text-sm flex items-center gap-2">
                  <BellRing size={16} /> {webpushLoading ? 'Suscribiendo...' : 'Activar notificaciones push'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Pasarelas (admin) */}
      {tab === 'gateways' && canManageGateways && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Configura las pasarelas de envio. Prioriza redes federadas y libres (Matrix, XMPP, Telegram) sobre canales propietarios.
          </p>
          {Object.entries(CHANNEL_INFO).map(([code, info]) => {
            const Icon = info.icon
            const existing = gateways.find(g => g.channel_code === code)
            const isActive = existing?.is_active ?? false
            return (
              <div key={code} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon size={24} className={info.color} />
                    <div>
                      <p className="font-medium">{info.label}</p>
                      <p className="text-xs text-gray-500">{info.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {isActive ? 'Activa' : 'Inactiva'}
                    </span>
                    <button onClick={() => setEditingGateway(editingGateway === code ? null : code)} className="btn-secondary text-sm">
                      {editingGateway === code ? 'Cerrar' : 'Configurar'}
                    </button>
                  </div>
                </div>
                {editingGateway === code && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {renderGatewayFields(code)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
