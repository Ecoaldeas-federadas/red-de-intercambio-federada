import { useState, useEffect } from 'react'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { Bell, Mail, Send, MessageSquare, Globe, Webhook, Save, TestTube, Check, X } from 'lucide-react'

const CHANNEL_INFO: Record<string, { label: string; icon: any; color: string; description: string }> = {
  email: { label: 'Email (SMTP)', icon: Mail, color: 'text-blue-600', description: 'Envia notificaciones por correo electronico via SMTP' },
  telegram: { label: 'Telegram', icon: Send, color: 'text-cyan-600', description: 'Bot de Telegram para mensajes directos' },
  matrix: { label: 'Matrix (federada)', icon: MessageSquare, color: 'text-green-600', description: 'Red federada soberana - recomendada' },
  xmpp: { label: 'XMPP (Jabber federado)', icon: MessageSquare, color: 'text-orange-600', description: 'Red federada libre - via API HTTP del servidor' },
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

  // Contactos del usuario
  const [contacts, setContacts] = useState({ email: '', phone: '', telegram_chat_id: '', matrix_user_id: '', xmpp_jid: '' })

  useEffect(() => {
    loadAll()
  }, [])

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
    api.get<any>('/accounts/me').then((d: any) => {
      if (d) {
        setContacts({
          email: d.email || '',
          phone: d.phone || '',
          telegram_chat_id: d.telegram_chat_id || '',
          matrix_user_id: d.matrix_user_id || '',
          xmpp_jid: d.xmpp_jid || '',
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
    api.put('/accounts/me/contacts', contacts).then(() => {
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
    api.post(`/notifications/gateways/${channel}/test`, {}).then(() => {
      setSuccess(`Test de ${channel} enviado`)
      setTimeout(() => setSuccess(''), 3000)
    }).catch(() => setError(`Error en test de ${channel}`)).finally(() => setTestingChannel(null))
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
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2">Evento</th>
                  {channels.filter(c => c.channel_code !== 'in_app').map(c => {
                    const info = CHANNEL_INFO[c.channel_code]
                    const Icon = info?.icon || Bell
                    return (
                      <th key={c.channel_code} className="text-center py-2 px-2">
                        <div className="flex flex-col items-center gap-1">
                          <Icon size={16} className={info?.color} />
                          <span className="text-xs">{info?.label || c.channel_code}</span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {NOTIF_TYPES.map(nt => (
                  <tr key={nt.code} className="border-b border-gray-50">
                    <td className="py-2 px-2">{nt.label}</td>
                    {channels.filter(c => c.channel_code !== 'in_app').map(c => (
                      <td key={c.channel_code} className="text-center py-2 px-2">
                        <input
                          type="checkbox"
                          checked={preferences[nt.code]?.[c.channel_code] ?? false}
                          onChange={e => togglePreference(nt.code, c.channel_code, e.target.checked)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <button onClick={savePreferences} className="btn-primary flex items-center gap-2">
              <Save size={16} /> Guardar preferencias
            </button>
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
          <div>
            <button onClick={saveContacts} className="btn-primary flex items-center gap-2">
              <Save size={16} /> Guardar contactos
            </button>
          </div>
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
