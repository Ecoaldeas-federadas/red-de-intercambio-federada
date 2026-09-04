import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Video, MessageCircle, Image as ImageIcon, Users, MessageSquare, BookOpen, PenTool, Calendar, Phone, Mic, Cloud, FileText, BookMarked, Globe, Film, Music, GitBranch, GraduationCap, Home, Lock, Download, Play, Square, Trash2, RefreshCw, Search, Server, AlertTriangle, CheckCircle, XCircle, Loader, Phone as PhoneIcon, HelpCircle, ExternalLink, Terminal } from 'lucide-react'

interface ServiceItem {
  id: string
  name: string
  category: string
  icon: string
  what_is: string
  replaces: string
  used_for: string
  protocol: string
  docker: boolean
  min_ram_mb: number
  min_disk_gb: number
  default_port: number
  subdomain: string
  status: string
  port?: number
}

interface VoIPConfig {
  village_code: number
  village_name?: string
  enabled: boolean
  server_port: number
  rtp_start: number
  rtp_end: number
  node_domain: string
}

interface VoIPExtension {
  extension: string
  display_name?: string
  user_id?: string
  is_active: boolean
}

interface VoIPRoute {
  remote_village_code: number
  remote_village_name?: string
  remote_endpoint?: string
  remote_domain?: string
  is_active: boolean
}

const iconMap: Record<string, any> = {
  Video, MessageCircle, Image: ImageIcon, Users, MessageSquare, BookOpen, PenTool, Calendar,
  Phone, Mic, Cloud, FileText, BookMarked, Globe, Film, Music, GitBranch, GraduationCap, Home, Lock,
}

const categoryLabels: Record<string, string> = {
  social: 'Redes Sociales',
  comunicacion: 'Comunicacion',
  productividad: 'Productividad',
  multimedia: 'Multimedia',
  desarrollo: 'Desarrollo y Otros',
}

const categoryColors: Record<string, string> = {
  social: 'bg-purple-100 text-purple-700',
  comunicacion: 'bg-blue-100 text-blue-700',
  productividad: 'bg-green-100 text-green-700',
  multimedia: 'bg-orange-100 text-orange-700',
  desarrollo: 'bg-gray-100 text-gray-700',
}

export default function FederatedServices() {
  const { t } = useTranslation(['services', 'common'])
  const { node_domain: nodeDomain } = useConfig()
  const isDemoNode = (window as any).__BASE_PATH__ === '/demo'
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null)
  const [installing, setInstalling] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [showVoIP, setShowVoIP] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [confirmUninstall, setConfirmUninstall] = useState<ServiceItem | null>(null)
  const [serviceURL, setServiceURL] = useState<{ scheme: string, base_domain: string, mode: string } | null>(null)
  // Estado de instalacion por servicio: mensaje y logs al lado del boton
  const [installMsgs, setInstallMsgs] = useState<Record<string, { type: 'success' | 'error' | 'info', text: string, logs?: string }>>({})
  const [installingService, setInstallingService] = useState<string | null>(null)
  const [logsModal, setLogsModal] = useState<{ serviceId: string, serviceName: string, logs: string, loading: boolean } | null>(null)
  // Estado de verificacion de actualizaciones por servicio
  const [serviceUpdateInfo, setServiceUpdateInfo] = useState<Record<string, any>>({})
  const [checkingServiceUpdate, setCheckingServiceUpdate] = useState<string | null>(null)
  // Estado de actualizacion en curso (consola en tiempo real)
  const [serviceUpdateConsole, setServiceUpdateConsole] = useState<{ serviceId: string, serviceName: string } | null>(null)
  const [serviceUpdateState, setServiceUpdateState] = useState<any>(null)
  const [serviceUpdatePoll, setServiceUpdatePoll] = useState<any>(null)

  useEffect(() => {
    loadServices()
    loadServiceURL()
  }, [])

  const loadServiceURL = async () => {
    try {
      const res: any = await api.get('/network/service-url')
      setServiceURL(res)
    } catch (e) {
      // Fallback: usar hostname local
      setServiceURL({ scheme: 'http', base_domain: window.location.hostname, mode: 'local' })
    }
  }

  // Construye la URL para abrir un servicio instalado.
  // Usa el dominio del nodo si esta configurado, sino usa el hostname actual.
  // Todos los servicios se acceden via /<service_id> (ej: /pos-web, /peertube).
  // El backend tiene un proxy reverso que redirige /<service_id> -> localhost:<port>.
  const buildServiceURL = (serviceID: string) => {
    const protocol = window.location.protocol
    const host = nodeDomain && nodeDomain !== 'localhost' ? nodeDomain : window.location.host
    return `${protocol}//${host}/${serviceID}`
  }

  const loadServices = async () => {
    setLoading(true)
    try {
      const res: any = await api.get('/services/catalog')
      setServices(res.services || res || [])
    } catch (e) {
      setMsg({ type: 'error', text: t('error_loading_services', 'Error al cargar servicios') })
    } finally {
      setLoading(false)
    }
  }

  const filtered = services.filter(s => {
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.replaces.toLowerCase().includes(search.toLowerCase()) ||
      s.what_is.toLowerCase().includes(search.toLowerCase())
    const matchCategory = categoryFilter === 'all' || s.category === categoryFilter
    return matchSearch && matchCategory
  }).sort((a, b) => {
    // POS Web siempre arriba (es exclusivo del nodo)
    if (a.id === 'pos-web') return -1
    if (b.id === 'pos-web') return 1
    return 0
  })

  const installService = async (svc: ServiceItem) => {
    setInstalling(true)
    setInstallingService(svc.id)
    setMsg(null)
    // Limpiar mensaje anterior de este servicio
    setInstallMsgs(prev => { const n = { ...prev }; delete n[svc.id]; return n })
    try {
      const res: any = await api.post(`/services/${svc.id}/install`, {})
      if (res.success) {
        setInstallMsgs(prev => ({ ...prev, [svc.id]: { type: 'success', text: res.message, logs: res.logs } }))
      } else {
        setInstallMsgs(prev => ({ ...prev, [svc.id]: { type: 'error', text: res.message, logs: res.logs } }))
      }
      await loadServices()
    } catch (e: any) {
      setInstallMsgs(prev => ({ ...prev, [svc.id]: { type: 'error', text: t('error_installing', 'Error al instalar') + ': ' + (e?.message || 'sin respuesta del servidor') } }))
    } finally {
      setInstalling(false)
      setInstallingService(null)
    }
  }

  const uninstallService = async (svc: ServiceItem) => {
    setConfirmUninstall(svc)
  }

  const doUninstall = async () => {
    if (!confirmUninstall) return
    try {
      await api.post(`/services/${confirmUninstall.id}/uninstall`, {})
      setMsg({ type: 'success', text: t('uninstalled', '{{name}} desinstalado', { name: confirmUninstall.name }) })
      setConfirmUninstall(null)
      await loadServices()
    } catch (e: any) {
      setMsg({ type: 'error', text: t('error_uninstalling', 'Error al desinstalar') })
      setConfirmUninstall(null)
    }
  }

  const startService = async (svc: ServiceItem) => {
    try {
      await api.post(`/services/${svc.id}/start`, {})
      setMsg({ type: 'success', text: t('started', '{{name}} iniciado', { name: svc.name }) })
      await loadServices()
    } catch (e: any) {
      setMsg({ type: 'error', text: t('error_starting', 'Error al iniciar') })
    }
  }

  const stopService = async (svc: ServiceItem) => {
    try {
      await api.post(`/services/${svc.id}/stop`, {})
      setMsg({ type: 'success', text: t('stopped_msg', '{{name}} detenido', { name: svc.name }) })
      await loadServices()
    } catch (e: any) {
      setMsg({ type: 'error', text: t('error_stopping', 'Error al detener') })
    }
  }

  const downloadService = async (svc: ServiceItem) => {
    try {
      const res: any = await api.get(`/services/${svc.id}/download`)
      const content = `# docker-compose.yml\n${res.docker_compose}\n\n---\n# README.md\n${res.readme}`
      const blob = new Blob([content], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${svc.id}-docker-compose.txt`
      a.click()
      window.URL.revokeObjectURL(url)
      setMsg({ type: 'success', text: t('download_generated', 'Descarga de {{name}} generada', { name: svc.name }) })
    } catch (e: any) {
      setMsg({ type: 'error', text: t('error_downloading', 'Error al descargar') })
    }
  }

  const viewLogs = async (svc: ServiceItem) => {
    setLogsModal({ serviceId: svc.id, serviceName: svc.name, logs: '', loading: true })
    try {
      const res: any = await api.get(`/services/${svc.id}/logs`)
      setLogsModal({ serviceId: svc.id, serviceName: svc.name, logs: res.logs || t('no_logs', 'Sin logs disponibles'), loading: false })
    } catch (e: any) {
      setLogsModal({ serviceId: svc.id, serviceName: svc.name, logs: t('error_getting_logs', 'Error al obtener logs') + ': ' + (e?.message || 'sin respuesta'), loading: false })
    }
  }

  const restartService = async (svc: ServiceItem) => {
    try {
      await api.post(`/services/${svc.id}/restart`, {})
      setMsg({ type: 'success', text: t('restarted', '{{name}} reiniciado', { name: svc.name }) })
      await loadServices()
    } catch (e: any) {
      setMsg({ type: 'error', text: t('error_restarting', 'Error al reiniciar') })
    }
  }

  const checkServiceUpdate = async (svc: ServiceItem) => {
    setCheckingServiceUpdate(svc.id)
    try {
      const res: any = await api.get(`/services/${svc.id}/check-update`)
      setServiceUpdateInfo((prev: any) => ({ ...prev, [svc.id]: res }))
      if (res.updates_available) {
        setInstallMsgs((prev: any) => ({ ...prev, [svc.id]: { type: 'info', text: t('updates_available', '{{name}}: hay actualizaciones disponibles', { name: svc.name }), logs: res.changed_files ? `Archivos cambiados:\n${res.changed_files}` : undefined } }))
      } else {
        setInstallMsgs((prev: any) => ({ ...prev, [svc.id]: { type: 'success', text: t('already_updated', '{{name}}: ya esta actualizado', { name: svc.name }) } }))
      }
    } catch (e: any) {
      setInstallMsgs((prev: any) => ({ ...prev, [svc.id]: { type: 'error', text: t('error_checking_updates', 'Error al verificar actualizaciones de {{name}}', { name: svc.name }) } }))
    } finally {
      setCheckingServiceUpdate(null)
    }
  }

  const startServiceUpdate = async (svc: ServiceItem) => {
    try {
      await api.post(`/services/${svc.id}/update`, {})
      setServiceUpdateConsole({ serviceId: svc.id, serviceName: svc.name })
      setServiceUpdateState(null)
      // Iniciar polling del estado
      const interval = setInterval(async () => {
        try {
          const res: any = await api.get(`/services/${svc.id}/update-status`)
          setServiceUpdateState(res)
          if (res.status === 'completed') {
            clearInterval(interval)
            setServiceUpdatePoll(null)
            setInstallMsgs((prev: any) => ({ ...prev, [svc.id]: { type: 'success', text: t('updated_successfully', '{{name}} actualizado correctamente', { name: svc.name }) } }))
            await loadServices()
            // Limpiar info de verificacion
            setServiceUpdateInfo((prev: any) => { const n = { ...prev }; delete n[svc.id]; return n })
          } else if (res.status === 'error') {
            clearInterval(interval)
            setServiceUpdatePoll(null)
            setInstallMsgs((prev: any) => ({ ...prev, [svc.id]: { type: 'error', text: res.message || t('error_updating', 'Error en la actualizacion'), logs: res.log } }))
          }
        } catch (e) {
          // Continuar intentando
        }
      }, 2000)
      setServiceUpdatePoll(interval)
    } catch (e: any) {
      setInstallMsgs((prev: any) => ({ ...prev, [svc.id]: { type: 'error', text: t('error_starting_update', 'Error al iniciar actualizacion') + ': ' + (e?.message || 'sin respuesta') } }))
    }
  }

  const closeServiceUpdateConsole = () => {
    if (serviceUpdatePoll) {
      clearInterval(serviceUpdatePoll)
      setServiceUpdatePoll(null)
    }
    setServiceUpdateConsole(null)
    setServiceUpdateState(null)
  }

  const updateService = async (svc: ServiceItem) => {
    setInstalling(true)
    setMsg(null)
    try {
      const res: any = await api.post(`/services/${svc.id}/update`, {})
      if (res.success) {
        setMsg({ type: 'success', text: res.message })
      } else {
        setMsg({ type: 'error', text: res.message || t('error_update', 'Error al actualizar') })
      }
      await loadServices()
    } catch (e: any) {
      setMsg({ type: 'error', text: t('error_update', 'Error al actualizar') })
    } finally {
      setInstalling(false)
    }
  }

  const updateAllServices = async () => {
    if (!confirm(t('update_all_confirm', 'Actualizar todas las aplicaciones instaladas en este servidor?'))) return
    setInstalling(true)
    setMsg(null)
    try {
      const res: any = await api.post('/services/update-all', {})
      setMsg({ type: res.failed > 0 ? 'info' : 'success', text: res.message })
      await loadServices()
    } catch (e: any) {
      setMsg({ type: 'error', text: t('error_update', 'Error al actualizar') })
    } finally {
      setInstalling(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <><CheckCircle size={14} className="text-green-500" /> {t('status_running', 'Corriendo')}</>
      case 'installing': return <><Loader size={14} className="text-blue-500 animate-spin" /> {t('status_installing', 'Instalando')}</>
      case 'stopped': return <><Square size={14} className="text-gray-400" /> {t('status_stopped', 'Detenido')}</>
      case 'error': return <><XCircle size={14} className="text-red-500" /> {t('status_error', 'Error')}</>
      default: return <><Server size={14} className="text-gray-400" /> {t('status_not_installed', 'No instalado')}</>
    }
  }

  if (loading) return <div className="flex items-center justify-center py-8 text-gray-500"><Loader className="animate-spin mr-2" size={20} /> {t('loading_catalog', 'Cargando catalogo...')}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title', 'Servicios Federados')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('subtitle', 'Reemplaza servicios comerciales con alternativas autohospedadas y federadas')}</p>
        </div>
        <div className="flex gap-2">
          {!isDemoNode && (
            <button
              onClick={updateAllServices}
              disabled={installing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
              title={t('update_all_title', 'Actualizar todas las apps instaladas')}
            >
              <RefreshCw size={16} /> {t('update_all', 'Actualizar todo')}
            </button>
          )}
          <button onClick={() => setShowHelp(!showHelp)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center gap-2">
            <HelpCircle size={16} /> {t('help', 'Ayuda')}
          </button>
          {!isDemoNode && (
            <button onClick={() => setShowVoIP(!showVoIP)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2">
              <PhoneIcon size={16} /> {t('voip', 'Telefonía VoIP')}
            </button>
          )}
        </div>
      </div>

      {isDemoNode && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-2">
          <Lock size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <strong>{t('demo_warning', 'Nodo Demo: Los servicios federados son solo para visualizacion en el demo. No se pueden instalar, desinstalar ni gestionar servicios desde el nodo demo.')}</strong>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4 text-sm">
          <div className="flex items-center gap-2 text-blue-700 font-semibold text-base">
            <HelpCircle size={18} /> {t('help_title', 'Como funcionan los servicios federados')}
          </div>

          <div className="space-y-3 text-gray-700">
            <div>
              <h4 className="font-semibold text-gray-900">{t('help_what_is_catalog', 'Que es este catalogo?')}</h4>
              <p>Es una lista de mas de 20 servicios autohospedados que puedes instalar en el servidor de tu nodo. Cada servicio reemplaza una plataforma comercial (YouTube, WhatsApp, Netflix, etc.) pero sin anuncios, sin vigilancia y sin empresas intermediarias. Los datos se quedan en tu servidor.</p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900">{t('help_how_install', 'Como instalo un servicio?')}</h4>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Busca el servicio en el catalogo (usa el buscador o filtra por categoria).</li>
                <li>Haz clic en <strong>Detalles</strong> para ver requisitos de RAM, disco, puerto y subdominio.</li>
                <li>Verifica que tu servidor tiene suficiente RAM y disco.</li>
                <li>Haz clic en <strong>Instalar</strong>. El sistema genera el <code className="bg-gray-200 px-1 rounded">docker-compose.yml</code> y las instrucciones.</li>
                <li>El servicio aparece como <strong>Corriendo</strong> o <strong>Detenido</strong>. Puedes iniciarlo, detenerlo o desinstalarlo cuando quieras.</li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900">{t('help_download_docker_q', 'Que significa "Descargar Docker"?')}</h4>
              <p>Si prefieres instalar el servicio manualmente en otro servidor (o revisar la configuracion antes de instalar), haz clic en <strong>Descargar</strong>. Se descarga un archivo con el <code className="bg-gray-200 px-1 rounded">docker-compose.yml</code> y un <code className="bg-gray-200 px-1 rounded">README.md</code> con instrucciones paso a paso. Puedes copiar ese archivo al servidor destino y ejecutar <code className="bg-gray-200 px-1 rounded">docker compose up -d</code>.</p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900">{t('help_subdomain_q', 'Que es el subdominio sugerido?')}</h4>
              <p>Cada servicio tiene un subdominio sugerido (ej: <code className="bg-gray-200 px-1 rounded">video.{nodeDomain}</code>). Si tienes OpenWrt configurado, el subdominio se registra automaticamente en la intranet. Si no tienes OpenWrt, puedes configurar el DNS manualmente apuntando ese subdominio a la IP de tu servidor.</p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900">{t('help_add_service_q', 'Como agrego un servicio que no esta en el catalogo?')}</h4>
              <p>El catalogo esta definido en el codigo del backend (<code className="bg-gray-200 px-1 rounded">internal/api/services_catalog.go</code>). Para agregar un servicio nuevo:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2 mt-1">
                <li>Abre el archivo <code className="bg-gray-200 px-1 rounded">internal/api/services_catalog.go</code>.</li>
                <li>Agrega una entrada al slice <code className="bg-gray-200 px-1 rounded">catalog</code> con: <code>id</code>, <code>name</code>, <code>category</code>, <code>icon</code>, <code>what_is</code>, <code>replaces</code>, <code>used_for</code>, <code>protocol</code>, <code>docker</code>, <code>min_ram_mb</code>, <code>min_disk_gb</code>, <code>default_port</code> y <code>subdomain</code>.</li>
                <li>Compila el backend (<code className="bg-gray-200 px-1 rounded">go build ./...</code>).</li>
                <li>Reinicia el nodo. El servicio nuevo aparece automaticamente en el catalogo.</li>
              </ol>
              <p className="mt-1 text-xs text-gray-500">Nota: el instalador con un clic requiere que el servicio tenga una imagen Docker publica. Si el servicio no usa Docker, solo se puede instalar manualmente con "Descargar" y siguiendo las instrucciones.</p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900">{t('help_permission_q', 'Que permiso necesito?')}</h4>
              <p>Para instalar, desinstalar, iniciar o detener servicios necesitas el permiso <code className="bg-gray-200 px-1 rounded">config.manage</code>. La Asamblea decide quien tiene este permiso mediante los roles y departamentos del sistema.</p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900">{t('help_federation', 'Federacion entre aldeas')}</h4>
              <p>Los servicios que soportan ActivityPub (PeerTube, Mastodon, Pixelfed, Friendica, Lemmy, BookWyrm, Funkwhale) pueden federarse con otras aldeas. Esto significa que el contenido publicado en una aldea es visible desde las otras aldeas federadas. Para federar servicios, cada aldea debe instalar el mismo servicio y configurar la federacion entre ellos.</p>
            </div>

            <div className="border-t pt-3">
              <h4 className="font-semibold text-gray-900">{t('help_email_services', 'Servicios de Correo: como funcionan')}</h4>
              <p className="mb-2">El correo electronico tiene tres componentes que se instalan por separado:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Servidor de correo</strong> (Mailu o Mailcow): se instala en el nodo. Recibe y envia correos. Crea cuentas para cada miembro. Configura cuotas de espacio por usuario.</li>
                <li><strong>Webmail</strong> (SnappyMail): interfaz web para leer correo desde el navegador sin instalar nada. Se conecta al servidor de correo.</li>
                <li><strong>Cliente de chat</strong> (Delta Chat): app que se instala en el celular/PC de cada miembro. Se ve como WhatsApp pero usa el servidor de correo del nodo. No se instala en el servidor.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900">{t('help_mailu_vs_mailcow', 'Mailu vs Mailcow: cual elegir?')}</h4>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-white p-3 rounded-lg border">
                  <div className="font-medium text-sm">{t('help_mailu_light', 'Mailu (Ligero)')}</div>
                  <ul className="text-xs space-y-1 mt-1 text-gray-600">
                    <li>1-2 GB RAM</li>
                    <li>Licencia MIT (sin restricciones)</li>
                    <li>SMTP + IMAP + webmail</li>
                    <li>Ideal para hardware limitado</li>
                    <li>Sin calendario compartido</li>
                  </ul>
                </div>
                <div className="bg-white p-3 rounded-lg border">
                  <div className="font-medium text-sm">{t('help_mailcow_full', 'Mailcow (Completo)')}</div>
                  <ul className="text-xs space-y-1 mt-1 text-gray-600">
                    <li>3-4 GB RAM</li>
                    <li>Licencia GPL</li>
                    <li>SMTP + IMAP + groupware</li>
                    <li>Calendario + contactos CalDAV/CardDAV</li>
                    <li>Ideal para servidor dedicado</li>
                  </ul>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Si tu nodo tiene poca RAM, instala Mailu. Si tienes otro servidor con mas RAM, instala Mailcow alli. Ambos federan con cualquier servidor de correo del mundo.</p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900">{t('help_email_clients', 'Como configurar los clientes de correo')}</h4>
              <p>Despues de instalar Mailu o Mailcow, los miembros configuran sus clientes de correo asi:</p>
              <div className="bg-gray-100 p-3 rounded-lg mt-1 text-xs font-mono">
                <div>Servidor entrante (IMAP): correo.{nodeDomain}</div>
                <div>Puerto: 993 (SSL/TLS)</div>
                <div>Servidor saliente (SMTP): correo.{nodeDomain}</div>
                <div>Puerto: 587 (STARTTLS)</div>
                <div>Usuario: miembro@{nodeDomain}</div>
                <div>Contrasena: la que el admin le asigno</div>
              </div>
              <p className="text-xs text-gray-500 mt-1">Clientes recomendados: Thunderbird (PC), K-9 Mail (Android), Mail (iOS). La mayoria se autoconfiguran via Autoconfig/Autodiscover: solo colocas el correo y la contrasena, y el cliente encuentra el servidor automaticamente.</p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900">{t('help_delta_chat', 'Delta Chat: chat estilo WhatsApp via correo')}</h4>
              <p>Delta Chat es un CLIENTE (app) que se instala en el celular o PC de cada miembro, no en el servidor. Para usarlo:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2 mt-1">
                <li>Instala Mailu o Mailcow en el nodo.</li>
                <li>El admin crea una cuenta de correo para cada miembro.</li>
                <li>Cada miembro instala Delta Chat en su celular (Google Play, App Store, F-Droid).</li>
                <li>En Delta Chat, coloca su correo@{nodeDomain} y contrasena.</li>
                <li>Delta Chat se conecta automaticamente al servidor IMAP/SMTP del nodo.</li>
                <li>Para chatear con alguien de otra aldea: agrega su correo@otra-aldea.com.</li>
              </ol>
              <p className="text-xs text-gray-500 mt-1">No hay que configurar servidores manualmente en Delta Chat. Solo correo y contrasena. El chat se ve igual que WhatsApp: mensajes, fotos, archivos, grupos, llamadas.</p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900">{t('help_mail_rules', 'Reglas y cuotas del servidor de correo')}</h4>
              <p>Desde el panel de administracion de Mailu o Mailcow puedes configurar:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mt-1">
                <li><strong>Cuota de espacio</strong> por usuario (ej: 1 GB, 5 GB, ilimitado)</li>
                <li><strong>Limite de tamano</strong> de archivos adjuntos (ej: 25 MB)</li>
                <li><strong>Dominios</strong> aceptados para enviar/recibir</li>
                <li><strong>Aliases</strong> (ej: info@tu-dominio redirige a maria@tu-dominio)</li>
                <li><strong>Filtros antispam</strong> y nivel de sensibilidad</li>
                <li><strong>Antivirus</strong> on/off</li>
                <li><strong>Reglas de reenvio</strong> automatico</li>
                <li><strong>Bloqueo de remitentes</strong> o dominios externos</li>
              </ul>
              <p className="text-xs text-gray-500 mt-1">Estas reglas se configuran desde el panel web del servidor de correo, no desde el sistema de gobernanza. El admin con permiso config.manage decide las reglas segun lo que la Asamblea acuerde.</p>
            </div>
          </div>

          <button onClick={() => setShowHelp(false)} className="text-blue-600 text-xs hover:underline">
            {t('close_help', 'Cerrar ayuda')}
          </button>
        </div>
      )}

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700' : msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
          {msg.text}
        </div>
      )}

      {showVoIP && <VoIPPanel />}

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-10"
            placeholder={t('search_placeholder', 'Buscar servicio o que reemplaza...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input max-w-[200px]" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">{t('all_categories', 'Todas las categorias')}</option>
          <option value="social">{t('cat_social', 'Redes Sociales')}</option>
          <option value="comunicacion">{t('cat_comunicacion', 'Comunicacion')}</option>
          <option value="productividad">{t('cat_productividad', 'Productividad')}</option>
          <option value="multimedia">{t('cat_multimedia', 'Multimedia')}</option>
          <option value="desarrollo">{t('cat_desarrollo', 'Desarrollo y Otros')}</option>
        </select>
      </div>

      {/* Catalogo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((svc) => {
          const Icon = iconMap[svc.icon] || Server
          const isInstalled = svc.status === 'running' || svc.status === 'stopped' || svc.status === 'error'
          const isRunning = svc.status === 'running'
          const isExclusive = svc.id === 'pos-web'
          return (
            <div key={svc.id} className={`card p-4 flex flex-col ${isExclusive ? 'border-2 border-trueque-400 ring-2 ring-trueque-100' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isExclusive ? 'bg-trueque-600 text-white' : categoryColors[svc.category] || 'bg-gray-100'}`}>
                    <Icon size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      {svc.name}
                      {isExclusive && (
                        <span className="text-xs px-2 py-0.5 bg-trueque-600 text-white rounded-full font-medium">
                          {t('node_tool', 'HERRAMIENTA DEL NODO')}
                        </span>
                      )}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${categoryColors[svc.category] || 'bg-gray-100 text-gray-600'}`}>
                      {categoryLabels[svc.category] || svc.category}
                    </span>
                  </div>
                </div>
                <div className="text-xs flex items-center gap-1">
                  {getStatusIcon(svc.status)}
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-2 line-clamp-3">{svc.what_is}</p>

              {isInstalled && isRunning && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-2 text-xs">
                  <div className="text-gray-500 mb-1">{t('access_url', 'URL de acceso:')}</div>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-green-700 flex-1 truncate">{buildServiceURL(svc.id)}</code>
                    <a
                      href={buildServiceURL(svc.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-0.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 flex items-center gap-1"
                    >
                      <ExternalLink size={10} /> {t('open', 'Abrir')}
                    </a>
                  </div>
                </div>
              )}

              {isExclusive && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2 text-xs text-amber-700">
                  <strong>{t('pos_important', 'Importante:')}</strong> {t('pos_important_desc', 'Este POS solo procesa TQ (no dinero tradicional ni criptomonedas). Se descarga desde este nodo y se configura con su direccion, pero acepta pagos de miembros de cualquier nodo federado.')}
                </div>
              )}

              <div className="text-xs text-gray-500 mb-2">
                <strong>{t('replaces_label', 'Reemplaza:')}</strong> {svc.replaces}
              </div>

              <p className="text-sm text-gray-600 mb-2 line-clamp-3">{svc.what_is}</p>

              <div className="text-xs text-gray-500 mb-2">
                <strong>{t('replaces_label', 'Reemplaza:')}</strong> {svc.replaces}
              </div>

              <div className="text-xs text-gray-400 mb-3 flex gap-3">
                <span>{t('ram_short', 'RAM')}: {svc.min_ram_mb >= 1024 ? `${svc.min_ram_mb / 1024}GB` : `${svc.min_ram_mb}MB`}</span>
                <span>{t('disk_short', 'Disco')}: {svc.min_disk_gb}GB</span>
                <span>{t('port_label', 'Puerto')}: {svc.port || svc.default_port}{isInstalled && svc.port ? ' (real)' : ''}</span>
              </div>

              <div className="mt-auto flex gap-2 flex-wrap">
                {!isInstalled && !isDemoNode && (
                  <button
                    onClick={() => installService(svc)}
                    disabled={installing}
                    className="px-3 py-1.5 bg-trueque-600 text-white rounded-lg text-xs disabled:opacity-50 flex items-center gap-1"
                  >
                    {installingService === svc.id ? (
                      <><Loader size={12} className="animate-spin" /> {t('installing', 'Instalando...')}</>
                    ) : (
                      <><Download size={12} /> {t('install', 'Instalar')}</>
                    )}
                  </button>
                )}
                {!isInstalled && isDemoNode && (
                  <span className="px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg text-xs flex items-center gap-1 cursor-not-allowed">
                    <Lock size={12} /> {t('install_demo', 'Instalar (demo: no disponible)')}
                  </span>
                )}
                {isInstalled && isRunning && !isDemoNode && (
                  <button
                    onClick={() => stopService(svc)}
                    className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-xs flex items-center gap-1"
                  >
                    <Square size={12} /> {t('stop', 'Detener')}
                  </button>
                )}
                {isInstalled && !isRunning && !isDemoNode && (
                  <button
                    onClick={() => startService(svc)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs flex items-center gap-1"
                  >
                    <Play size={12} /> {t('start', 'Iniciar')}
                  </button>
                )}
                {isInstalled && !isDemoNode && (
                  <button
                    onClick={() => restartService(svc)}
                    className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs flex items-center gap-1"
                    title={t('restart', 'Reiniciar servicio')}
                  >
                    <RefreshCw size={12} /> {t('restart', 'Reiniciar')}
                  </button>
                )}
                {isInstalled && !isDemoNode && (
                  <button
                    onClick={() => viewLogs(svc)}
                    className="px-3 py-1.5 bg-gray-700 text-white rounded-lg text-xs flex items-center gap-1"
                    title={t('console', 'Ver consola del servicio')}
                  >
                    <Terminal size={12} /> {t('console', 'Consola')}
                  </button>
                )}
                {isInstalled && isRunning && (
                  <a
                    href={buildServiceURL(svc.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs flex items-center gap-1"
                  >
                    <ExternalLink size={12} /> {t('open', 'Abrir')}
                  </a>
                )}
                {isInstalled && !isDemoNode && (
                  <button
                    onClick={() => checkServiceUpdate(svc)}
                    disabled={checkingServiceUpdate === svc.id}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs disabled:opacity-50 flex items-center gap-1"
                    title={t('check_update', 'Verificar si hay actualizaciones')}
                  >
                    {checkingServiceUpdate === svc.id ? (
                      <><Loader size={12} className="animate-spin" /> {t('checking', 'Verificando...')}</>
                    ) : (
                      <><Search size={12} /> {t('check_update', 'Verificar')}</>
                    )}
                  </button>
                )}
                {isInstalled && !isDemoNode && serviceUpdateInfo[svc.id]?.updates_available && (
                  <button
                    onClick={() => startServiceUpdate(svc)}
                    className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs flex items-center gap-1"
                    title={t('update', 'Actualizar a la nueva version')}
                  >
                    <RefreshCw size={12} /> {t('update', 'Actualizar')}
                  </button>
                )}
                {!isDemoNode && (
                  <button
                    onClick={() => downloadService(svc)}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs flex items-center gap-1"
                  >
                    <Download size={12} /> {t('download', 'Descargar')}
                  </button>
                )}
                <button
                  onClick={() => setSelectedService(svc)}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs"
                >
                  {t('details', 'Detalles')}
                </button>
                {isInstalled && !isDemoNode && (
                  <button
                    onClick={() => uninstallService(svc)}
                    className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              {/* Mensaje contextual al lado de los botones */}
              {installMsgs[svc.id] && (
                <div className={`w-full mt-2 p-2 rounded text-xs ${
                  installMsgs[svc.id].type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                  installMsgs[svc.id].type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                  'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  <div className="font-medium">{installMsgs[svc.id].text}</div>
                  {installMsgs[svc.id].logs && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs opacity-70">{t('view_details', 'Ver detalles')}</summary>
                      <pre className="text-xs mt-1 bg-gray-900 text-gray-100 p-2 rounded max-h-40 overflow-auto whitespace-pre-wrap font-mono">{installMsgs[svc.id].logs}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          {t('no_services', 'No se encontraron servicios. Intenta con otra busqueda.')}
        </div>
      )}

      {/* Modal de confirmacion de desinstalacion */}
      {confirmUninstall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConfirmUninstall(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{t('uninstall_confirm_title', 'Desinstalar {{name}}?', { name: confirmUninstall.name })}</h2>
                <p className="text-sm text-gray-500">{t('uninstall_confirm_desc', 'Esta accion no se puede deshacer.')}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {t('uninstall_confirm_body', 'Se detendra y eliminara el contenedor Docker. Los datos del servicio podrian perderse.')}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmUninstall(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm"
              >
                {t('cancel', t('common:cancel'))}
              </button>
              <button
                onClick={doUninstall}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm flex items-center gap-2"
              >
                <Trash2 size={14} /> {t('confirm_uninstall', 'Si, desinstalar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Consola de actualizacion de servicio en tiempo real */}
      {serviceUpdateConsole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { if (serviceUpdateState?.status !== 'running') closeServiceUpdateConsole() }}>
          <div className="bg-gray-900 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center gap-2 text-white">
                <RefreshCw size={20} className={serviceUpdateState?.status === 'running' ? 'animate-spin text-blue-400' : 'text-green-400'} />
                <h2 className="text-lg font-bold">{t('updating_service', 'Actualizando: {{name}}', { name: serviceUpdateConsole.serviceName })}</h2>
              </div>
              <div className="flex gap-2">
                {serviceUpdateState?.status !== 'running' && (
                  <button
                    onClick={closeServiceUpdateConsole}
                    className="px-3 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
                  >
                    {t('close', t('common:close'))}
                  </button>
                )}
              </div>
            </div>
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-sm font-medium ${
                  serviceUpdateState?.status === 'running' ? 'text-blue-400' :
                  serviceUpdateState?.status === 'completed' ? 'text-green-400' :
                  serviceUpdateState?.status === 'error' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {serviceUpdateState?.message || t('starting', 'Iniciando...')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      serviceUpdateState?.status === 'completed' ? 'bg-green-500' :
                      serviceUpdateState?.status === 'error' ? 'bg-red-500' :
                      'bg-blue-500 animate-pulse'
                    }`}
                    style={{ width: serviceUpdateState?.progress ? `${serviceUpdateState.progress}%` : '5%' }}
                  />
                </div>
                <span className="text-xs text-gray-400 font-mono">
                  {serviceUpdateState?.progress ? `${serviceUpdateState.progress}%` : '...'}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap overflow-auto">
                {serviceUpdateState?.log || '$ ' + t('waiting_update', 'Esperando inicio de actualizacion...')}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Modal de consola/logs */}
      {logsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setLogsModal(null)}>
          <div className="bg-gray-900 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center gap-2 text-white">
                <Terminal size={20} />
                <h2 className="text-lg font-bold">{t('console_service', 'Consola: {{name}}', { name: logsModal.serviceName })}</h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => viewLogs({ id: logsModal.serviceId, name: logsModal.serviceName } as any)}
                  className="px-3 py-1 bg-gray-700 text-white rounded text-xs flex items-center gap-1 hover:bg-gray-600"
                  title={t('refresh_logs', 'Actualizar logs')}
                >
                  <RefreshCw size={12} /> {t('refresh_logs', 'Actualizar')}
                </button>
                <button onClick={() => setLogsModal(null)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {logsModal.loading ? (
                <div className="flex items-center justify-center text-gray-400 py-8">
                  <Loader className="animate-spin mr-2" size={20} /> {t('loading_logs', 'Cargando logs...')}
                </div>
              ) : (
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap overflow-auto">{logsModal.logs}</pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalles */}
      {selectedService && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedService(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = iconMap[selectedService.icon] || Server
                  return <div className={`p-3 rounded-lg ${categoryColors[selectedService.category] || 'bg-gray-100'}`}><Icon size={32} /></div>
                })()}
                <div>
                  <h2 className="text-xl font-bold">{selectedService.name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded ${categoryColors[selectedService.category] || 'bg-gray-100 text-gray-600'}`}>
                    {categoryLabels[selectedService.category] || selectedService.category}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedService(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-1">{t('what_is', 'Que es')}</h3>
                <p className="text-sm text-gray-600">{selectedService.what_is}</p>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-1">{t('what_replaces', 'Que reemplaza')}</h3>
                <p className="text-sm text-gray-600">{selectedService.replaces}</p>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-1">{t('used_for', 'Para que sirve')}</h3>
                <p className="text-sm text-gray-600">{selectedService.used_for}</p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-500">{t('ram_label', 'RAM minima')}</div>
                  <div className="font-medium">{selectedService.min_ram_mb >= 1024 ? `${selectedService.min_ram_mb / 1024} GB` : `${selectedService.min_ram_mb} MB`}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-500">{t('disk_label', 'Disco minimo')}</div>
                  <div className="font-medium">{selectedService.min_disk_gb} GB</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-500">{t('protocol_label', 'Protocolo')}</div>
                  <div className="font-medium">{selectedService.protocol}</div>
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg text-sm">
                <strong>{t('subdomain_suggested', 'Subdominio sugerido:')}</strong> {selectedService.subdomain}.{nodeDomain}
                <br />
                <span className="text-xs text-gray-500">{t('subdomain_hint', 'Si tienes OpenWrt, este subdominio se registra automaticamente')}</span>
              </div>

              <div className="flex gap-2 pt-3 border-t flex-wrap">
                {/* Si no esta instalado: mostrar Instalar */}
                {selectedService.status === 'not_installed' && (
                  <button
                    onClick={() => { if (!isDemoNode) { installService(selectedService); setSelectedService(null) } }}
                    disabled={installing || isDemoNode}
                    className="px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    title={isDemoNode ? t('not_available_demo', 'No disponible en nodo demo') : ''}
                  >
                    {installingService === selectedService.id ? (
                      <><Loader size={14} className="animate-spin" /> {t('installing', 'Instalando...')}</>
                    ) : (
                      <><Download size={14} /> {t('install_here', 'Instalar aqui')}</>
                    )}
                  </button>
                )}
                {/* Mensaje de instalacion en el modal */}
                {installMsgs[selectedService.id] && (
                  <div className={`w-full mt-2 p-3 rounded text-sm ${
                    installMsgs[selectedService.id].type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                    installMsgs[selectedService.id].type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                    'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    <div className="font-medium">{installMsgs[selectedService.id].text}</div>
                    {installMsgs[selectedService.id].logs && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs opacity-70">{t('view_logs', 'Ver logs de instalacion')}</summary>
                        <pre className="text-xs mt-1 bg-gray-900 text-gray-100 p-2 rounded max-h-40 overflow-auto whitespace-pre-wrap font-mono">{installMsgs[selectedService.id].logs}</pre>
                      </details>
                    )}
                  </div>
                )}

                {/* Si esta instalado: mostrar Abrir, Actualizar, Detener/Iniciar, Desinstalar */}
                {selectedService.status !== 'not_installed' && (
                  <>
                    {selectedService.status === 'running' && (
                      <a
                        href={buildServiceURL(selectedService.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm flex items-center gap-2"
                      >
                        <ExternalLink size={14} /> {t('open', 'Abrir')}
                      </a>
                    )}
                    <button
                      onClick={() => { if (!isDemoNode) { updateService(selectedService); setSelectedService(null) } }}
                      disabled={installing || isDemoNode}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      title={isDemoNode ? t('not_available_demo', 'No disponible en nodo demo') : ''}
                    >
                      <RefreshCw size={14} /> {t('update', 'Actualizar')}
                    </button>
                    {selectedService.status === 'running' ? (
                      <button
                        onClick={() => { if (!isDemoNode) { stopService(selectedService); setSelectedService(null) } }}
                        disabled={isDemoNode}
                        className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        title={isDemoNode ? t('not_available_demo', 'No disponible en nodo demo') : ''}
                      >
                        <Square size={14} /> {t('stop', 'Detener')}
                      </button>
                    ) : (
                      <button
                        onClick={() => { if (!isDemoNode) { startService(selectedService); setSelectedService(null) } }}
                        disabled={isDemoNode}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        title={isDemoNode ? t('not_available_demo', 'No disponible en nodo demo') : ''}
                      >
                        <Play size={14} /> {t('start', 'Iniciar')}
                      </button>
                    )}
                    <button
                      onClick={() => { if (!isDemoNode) { uninstallService(selectedService); setSelectedService(null) } }}
                      disabled={isDemoNode}
                      className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      title={isDemoNode ? t('not_available_demo', 'No disponible en nodo demo') : ''}
                    >
                      <Trash2 size={14} /> {t('uninstall', 'Desinstalar')}
                    </button>
                    <button
                      onClick={() => { if (!isDemoNode) { restartService(selectedService); setSelectedService(null) } }}
                      disabled={isDemoNode}
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      title={isDemoNode ? t('not_available_demo', 'No disponible en nodo demo') : t('restart', 'Reiniciar servicio')}
                    >
                      <RefreshCw size={14} /> {t('restart', 'Reiniciar')}
                    </button>
                    <button
                      onClick={() => { if (!isDemoNode) { viewLogs(selectedService) } }}
                      disabled={isDemoNode}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      title={isDemoNode ? t('not_available_demo', 'No disponible en nodo demo') : t('console', 'Ver consola del servicio')}
                    >
                      <Terminal size={14} /> {t('console', 'Consola')}
                    </button>
                  </>
                )}

                {/* Descargar siempre disponible (excepto en demo) */}
                <button
                  onClick={() => { if (!isDemoNode) { downloadService(selectedService); setSelectedService(null) } }}
                  disabled={isDemoNode}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  title={isDemoNode ? t('not_available_demo', 'No disponible en nodo demo') : ''}
                >
                  <Download size={14} /> {t('download_docker', 'Descargar Docker')}
                </button>

                {isDemoNode && (
                  <div className="w-full mt-2 p-3 rounded text-sm bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-2">
                    <Lock size={14} /> {t('demo_disabled', 'Los botones de instalacion y descarga estan deshabilitados en el nodo demo.')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// === Panel de VoIP ===
function VoIPPanel() {
  const { t } = useTranslation(['services', 'common'])
  const [config, setConfig] = useState<VoIPConfig | null>(null)
  const [extensions, setExtensions] = useState<VoIPExtension[]>([])
  const [routes, setRoutes] = useState<VoIPRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ type: string, text: string } | null>(null)
  const [newExt, setNewExt] = useState({ extension: '', display_name: '', password: '' })
  const [newRoute, setNewRoute] = useState({ remote_village_code: 0, remote_village_name: '', remote_endpoint: '', remote_domain: '' })
  const [pstnGateways, setPstnGateways] = useState<any[]>([])
  const [newGateway, setNewGateway] = useState({ name: '', provider: '', sip_server: '', sip_username: '', sip_password: '', inbound_number: '', cost_per_minute: 0, max_concurrent_calls: 2 })
  const [balance, setBalance] = useState<{ balance: number, balance_display: string, total_recharged: number, total_spent: number } | null>(null)
  const [rechargeAmount, setRechargeAmount] = useState(0)
  const [rechargeMethod, setRechargeMethod] = useState('transfer')
  const [rechargeRef, setRechargeRef] = useState('')
  const [cdr, setCdr] = useState<any[]>([])

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      await Promise.all([loadConfig(), loadExtensions(), loadRoutes(), loadPSTNGateways(), loadBalance(), loadCDR()])
    } finally {
      setLoading(false)
    }
  }

  const loadPSTNGateways = async () => {
    try {
      const res: any = await api.get('/voip/pstn-gateways')
      setPstnGateways(res?.gateways || [])
    } catch (e) { console.error(e) }
  }

  const loadBalance = async () => {
    try {
      const res: any = await api.get('/voip/balance')
      setBalance(res)
    } catch (e) { console.error(e) }
  }

  const loadCDR = async () => {
    try {
      const res: any = await api.get('/voip/cdr')
      setCdr(res?.calls || [])
    } catch (e) { console.error(e) }
  }

  const autoConfigureRoutes = async () => {
    try {
      const res: any = await api.post('/voip/auto-configure-routes', {})
      setMsg({ type: 'success', text: res.message })
      await loadRoutes()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Error' })
    }
  }

  const createPSTNGateway = async () => {
    if (!newGateway.name || !newGateway.sip_server || !newGateway.sip_username || !newGateway.sip_password) {
      setMsg({ type: 'error', text: 'Nombre, servidor, usuario y password son obligatorios' })
      return
    }
    try {
      const res: any = await api.post('/voip/pstn-gateways', newGateway)
      setMsg({ type: 'success', text: res.message })
      setNewGateway({ name: '', provider: '', sip_server: '', sip_username: '', sip_password: '', inbound_number: '', cost_per_minute: 0, max_concurrent_calls: 2 })
      await loadPSTNGateways()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Error' })
    }
  }

  const deletePSTNGateway = async (id: string) => {
    if (!confirm('Eliminar pasarela PSTN?')) return
    try {
      await api.delete(`/voip/pstn-gateways/${id}`)
      await loadPSTNGateways()
    } catch (e: any) {
      setMsg({ type: 'error', text: 'Error' })
    }
  }

  const rechargeVoIP = async () => {
    if (rechargeAmount <= 0) { setMsg({ type: 'error', text: 'Monto debe ser positivo' }); return }
    try {
      const res: any = await api.post('/voip/recharge', { amount: rechargeAmount, payment_method: rechargeMethod, reference: rechargeRef })
      setMsg({ type: 'success', text: res.message })
      setRechargeAmount(0); setRechargeRef('')
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Error' })
    }
  }

  const loadConfig = async () => {
    try {
      const res: any = await api.get('/voip/config')
      setConfig(res)
    } catch (e) { console.error(e) }
  }

  const loadExtensions = async () => {
    try {
      const res: any = await api.get('/voip/extensions')
      setExtensions(res?.extensions || [])
    } catch (e) { console.error(e) }
  }

  const loadRoutes = async () => {
    try {
      const res: any = await api.get('/voip/routes')
      setRoutes(res?.routes || [])
    } catch (e) { console.error(e) }
  }

  const generateCode = async () => {
    try {
      const res: any = await api.post('/voip/generate-code', {})
      setMsg({ type: 'success', text: res.message })
      await loadConfig()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Error' })
    }
  }

  const saveConfig = async () => {
    if (!config) return
    try {
      await api.put('/voip/config', config)
      setMsg({ type: 'success', text: 'Configuracion VoIP guardada' })
    } catch (e: any) {
      setMsg({ type: 'error', text: 'Error' })
    }
  }

  const createExt = async () => {
    if (!newExt.extension) { setMsg({ type: 'error', text: 'Extension obligatoria' }); return }
    try {
      const res: any = await api.post('/voip/extensions', newExt)
      setMsg({ type: 'success', text: res.message })
      setNewExt({ extension: '', display_name: '', password: '' })
      await loadExtensions()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Error' })
    }
  }

  const deleteExt = async (ext: string) => {
    if (!confirm(`Eliminar extension ${ext}?`)) return
    try {
      await api.delete(`/voip/extensions/${ext}`)
      await loadExtensions()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Error' })
    }
  }

  const createRoute = async () => {
    if (!newRoute.remote_village_code) { setMsg({ type: 'error', text: 'Codigo de aldea remota obligatorio' }); return }
    try {
      const res: any = await api.post('/voip/routes', newRoute)
      setMsg({ type: 'success', text: res.message })
      setNewRoute({ remote_village_code: 0, remote_village_name: '', remote_endpoint: '', remote_domain: '' })
      await loadRoutes()
    } catch (e: any) {
      setMsg({ type: 'error', text: 'Error' })
    }
  }

  const deleteRoute = async (code: string) => {
    if (!confirm(`Eliminar ruta a aldea ${code}?`)) return
    try {
      await api.delete(`/voip/routes/${code}`)
      await loadRoutes()
    } catch (e: any) {
      setMsg({ type: 'error', text: 'Error' })
    }
  }

  if (loading) return <div className="card p-4 text-center text-gray-500">{t('voip_loading', 'Cargando VoIP...')}</div>

  return (
    <div className="card p-4 space-y-4">
      <h2 className="font-semibold flex items-center gap-2"><PhoneIcon size={18} /> {t('voip_title', 'Telefonía VoIP de la Aldea')}</h2>

      {msg && <div className={`p-2 rounded text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}

      {/* Codigo de aldea */}
      <div className="bg-blue-50 p-3 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-blue-600 mb-1">{t('village_code', 'Codigo de Aldea')}</div>
            {config && config.village_code > 0 ? (
              <div className="text-2xl font-bold text-blue-700">{config.village_code}</div>
            ) : (
              <div className="text-sm text-blue-600">{t('not_generated', 'No generado')}</div>
            )}
          </div>
          <button onClick={generateCode} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">
            {t('generate_code', 'Generar codigo')}
          </button>
        </div>
        <p className="text-xs text-blue-600 mt-2">
          Para llamar a esta aldea desde otra: marcar {config?.village_code || 'XXX'} + extension (ej: {config?.village_code || 'XXX'}-2001)
        </p>
      </div>

      {/* Configuracion */}
      {config && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('village_name', 'Nombre aldea')}</label>
            <input className="input" value={config.village_name || ''} onChange={(e) => setConfig({ ...config, village_name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('sip_port', 'Puerto SIP')}</label>
            <input className="input" type="number" value={config.server_port} onChange={(e) => setConfig({ ...config, server_port: parseInt(e.target.value) || 5060 })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('rtp_start', 'RTP inicio')}</label>
            <input className="input" type="number" value={config.rtp_start} onChange={(e) => setConfig({ ...config, rtp_start: parseInt(e.target.value) || 10000 })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('rtp_end', 'RTP fin')}</label>
            <input className="input" type="number" value={config.rtp_end} onChange={(e) => setConfig({ ...config, rtp_end: parseInt(e.target.value) || 20000 })} />
          </div>
        </div>
      )}

      <button onClick={saveConfig} className="px-4 py-2 bg-trueque-600 text-white rounded-lg text-sm">{t('save', t('common:save'))}</button>

      {/* Extensiones */}
      <div className="border-t pt-3">
        <h3 className="font-medium text-sm mb-2">{t('extensions_title', 'Extensiones telefonicas locales')}</h3>
        {extensions.length === 0 ? (
          <p className="text-gray-500 text-xs">{t('no_extensions', 'No hay extensiones. Crea una para cada miembro.')}</p>
        ) : (
          <div className="space-y-1">
            {extensions.map((e) => (
              <div key={e.extension} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                <div>
                  <span className="font-mono font-medium">{e.extension}</span>
                  {e.display_name && <span className="text-gray-500 ml-2">{e.display_name}</span>}
                </div>
                <button onClick={() => deleteExt(e.extension)} className="text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-2">
          <input className="input text-sm" placeholder="Extension (ej: 2001)" value={newExt.extension} onChange={(e) => setNewExt({ ...newExt, extension: e.target.value })} />
          <input className="input text-sm" placeholder="Nombre" value={newExt.display_name} onChange={(e) => setNewExt({ ...newExt, display_name: e.target.value })} />
          <input className="input text-sm" placeholder="Password (auto)" value={newExt.password} onChange={(e) => setNewExt({ ...newExt, password: e.target.value })} />
          <button onClick={createExt} className="px-3 py-2 bg-trueque-600 text-white rounded-lg text-sm whitespace-nowrap">{t('add', 'Agregar')}</button>
        </div>
      </div>

      {/* Rutas federadas */}
      <div className="border-t pt-3">
        <h3 className="font-medium text-sm mb-2">{t('routes_title', 'Rutas a otras aldeas')}</h3>
        <p className="text-xs text-gray-500 mb-2">{t('routes_desc', 'Para llamar a otra aldea, marca su codigo + extension (ej: 105-2001)')}</p>
        {routes.length === 0 ? (
          <p className="text-gray-500 text-xs">{t('no_routes', 'No hay rutas federadas.')}</p>
        ) : (
          <div className="space-y-1">
            {routes.map((r) => (
              <div key={r.remote_village_code} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                <div>
                  <span className="font-mono font-medium">{r.remote_village_code}</span>
                  {r.remote_village_name && <span className="text-gray-500 ml-2">{r.remote_village_name}</span>}
                  {r.remote_domain && <span className="text-gray-400 ml-2 text-xs">{r.remote_domain}</span>}
                </div>
                <button onClick={() => deleteRoute(String(r.remote_village_code))} className="text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
          <input className="input text-sm" type="number" placeholder="Codigo (ej: 105)" value={newRoute.remote_village_code || ''} onChange={(e) => setNewRoute({ ...newRoute, remote_village_code: parseInt(e.target.value) || 0 })} />
          <input className="input text-sm" placeholder="Nombre aldea" value={newRoute.remote_village_name} onChange={(e) => setNewRoute({ ...newRoute, remote_village_name: e.target.value })} />
          <input className="input text-sm" placeholder="Endpoint SIP" value={newRoute.remote_endpoint} onChange={(e) => setNewRoute({ ...newRoute, remote_endpoint: e.target.value })} />
          <button onClick={createRoute} className="px-3 py-2 bg-trueque-600 text-white rounded-lg text-sm">{t('add_route', 'Agregar ruta')}</button>
        </div>
        <button onClick={autoConfigureRoutes} className="mt-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1">
          <RefreshCw size={14} /> {t('auto_configure_routes', 'Auto-configurar rutas desde nodos federados')}
        </button>
      </div>

      {/* Pasarelas PSTN */}
      <div className="border-t pt-3">
        <h3 className="font-medium text-sm mb-2">{t('pstn_title', 'Pasarelas PSTN (llamadas a telefonos normales)')}</h3>
        <p className="text-xs text-gray-500 mb-2">{t('pstn_desc', 'Permite llamar a numeros de telefono fijos/moviles fuera de la red federada. Requiere cuenta con un proveedor SIP trunk.')}</p>
        {pstnGateways.length === 0 ? (
          <p className="text-gray-500 text-xs">{t('no_pstn', 'No hay pasarelas PSTN configuradas. Las llamadas entre nodos federados son gratis.')}</p>
        ) : (
          <div className="space-y-1">
            {pstnGateways.map((gw) => (
              <div key={gw.id} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                <div>
                  <span className="font-medium">{gw.name}</span>
                  {gw.provider && <span className="text-gray-500 ml-2">({gw.provider})</span>}
                  {gw.inbound_number && <span className="text-gray-400 ml-2 text-xs">Entrante: {gw.inbound_number}</span>}
                  <span className="text-gray-400 ml-2 text-xs">{gw.cost_per_minute} TQ/min</span>
                </div>
                <button onClick={() => deletePSTNGateway(String(gw.id))} className="text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
          <input className="input text-sm" placeholder="Nombre (ej: VoIP.ms)" value={newGateway.name} onChange={(e) => setNewGateway({ ...newGateway, name: e.target.value })} />
          <input className="input text-sm" placeholder="Proveedor" value={newGateway.provider} onChange={(e) => setNewGateway({ ...newGateway, provider: e.target.value })} />
          <input className="input text-sm" placeholder="Servidor SIP" value={newGateway.sip_server} onChange={(e) => setNewGateway({ ...newGateway, sip_server: e.target.value })} />
          <input className="input text-sm" placeholder="Usuario SIP" value={newGateway.sip_username} onChange={(e) => setNewGateway({ ...newGateway, sip_username: e.target.value })} />
          <input className="input text-sm" placeholder="Password SIP" type="password" value={newGateway.sip_password} onChange={(e) => setNewGateway({ ...newGateway, sip_password: e.target.value })} />
          <input className="input text-sm" placeholder="Numero entrante (opcional)" value={newGateway.inbound_number} onChange={(e) => setNewGateway({ ...newGateway, inbound_number: e.target.value })} />
          <input className="input text-sm" type="number" placeholder="Costo/min (centavos TQ)" value={newGateway.cost_per_minute || ''} onChange={(e) => setNewGateway({ ...newGateway, cost_per_minute: parseFloat(e.target.value) || 0 })} />
          <input className="input text-sm" type="number" placeholder="Llamadas simultaneas" value={newGateway.max_concurrent_calls || ''} onChange={(e) => setNewGateway({ ...newGateway, max_concurrent_calls: parseInt(e.target.value) || 2 })} />
          <button onClick={createPSTNGateway} className="px-3 py-2 bg-trueque-600 text-white rounded-lg text-sm">{t('add_gateway', 'Agregar pasarela')}</button>
        </div>
      </div>

      {/* Saldo prepago */}
      <div className="border-t pt-3">
        <h3 className="font-medium text-sm mb-2">{t('balance_title', 'Saldo prepago para llamadas externas')}</h3>
        <p className="text-xs text-gray-500 mb-2">{t('balance_desc', 'Las llamadas entre nodos federados son gratis. Las llamadas a telefonos normales (PSTN) requieren saldo.')}</p>
        {balance !== null && (
          <div className="bg-green-50 p-3 rounded-lg mb-2">
            <div className="text-xs text-green-600">{t('my_balance', 'Mi saldo')}</div>
            <div className="text-xl font-bold text-green-700">{balance.balance_display}</div>
            <div className="text-xs text-green-500 mt-1">{t('recharged', 'Recargado:')} {balance.total_recharged} | {t('spent', 'Gastado:')} {balance.total_spent}</div>
          </div>
        )}
        <div className="flex gap-2">
          <input className="input text-sm" type="number" placeholder="Monto a recargar (centavos TQ)" value={rechargeAmount || ''} onChange={(e) => setRechargeAmount(parseInt(e.target.value) || 0)} />
          <input className="input text-sm" placeholder="Metodo (transfer/cash)" value={rechargeMethod} onChange={(e) => setRechargeMethod(e.target.value)} />
          <input className="input text-sm" placeholder="Referencia" value={rechargeRef} onChange={(e) => setRechargeRef(e.target.value)} />
          <button onClick={rechargeVoIP} className="px-3 py-2 bg-trueque-600 text-white rounded-lg text-sm whitespace-nowrap">{t('request_recharge', 'Solicitar recarga')}</button>
        </div>
      </div>

      {/* Registro de llamadas */}
      <div className="border-t pt-3">
        <h3 className="font-medium text-sm mb-2">{t('cdr_title', 'Registro de llamadas (CDR)')}</h3>
        {cdr.length === 0 ? (
          <p className="text-gray-500 text-xs">{t('no_calls', 'No hay llamadas registradas.')}</p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {cdr.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-gray-50 p-2 rounded text-xs">
                <div>
                  <span className="font-mono">{c.destination}</span>
                  <span className={`ml-2 px-1.5 py-0.5 rounded ${c.destination_type === 'internal' ? 'bg-green-100 text-green-700' : c.destination_type === 'federated' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                    {c.destination_type}
                  </span>
                  {c.direction === 'inbound' && <span className="ml-1 text-gray-400">(entrante)</span>}
                </div>
                <div className="text-right">
                  <div>{c.duration}s | {c.cost_display}</div>
                  <div className="text-gray-400">{c.user_name}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
