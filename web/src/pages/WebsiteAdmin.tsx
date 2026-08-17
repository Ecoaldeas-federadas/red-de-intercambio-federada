import { useState, useEffect } from 'react'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { HelpCircle, Plus, Edit, Trash2, Save, Globe, Settings as SettingsIcon, FileText, Mail, Check, X } from 'lucide-react'

export default function WebsiteAdmin() {
  const { hasPermission } = usePermissions()
  const canManage = hasPermission('config.manage')

  const [tab, setTab] = useState<'pages' | 'settings' | 'admission'>('pages')
  const [pages, setPages] = useState<any[]>([])
  const [settings, setSettings] = useState<any>({})
  const [admissionRequests, setAdmissionRequests] = useState<any[]>([])
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [editingPage, setEditingPage] = useState<any>(null)
  const [showPageForm, setShowPageForm] = useState(false)
  const [pageForm, setPageForm] = useState({
    slug: '', title: '', subtitle: '', content: '', icon: 'home',
    menu_order: 1, is_published: true, show_in_menu: true,
  })

  const [settingsForm, setSettingsForm] = useState({
    site_title: '', site_subtitle: '', logo_url: '', primary_color: '#2d5016',
    secondary_color: '#f4a261', contact_email: '', contact_phone: '',
    contact_address: '', social_instagram: '', social_facebook: '', social_twitter: '',
    show_join_form: true,
  })

  const load = () => {
    api.get('/site/pages').then((d: any) => setPages(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/site/settings').then(setSettings).catch(() => {})
    api.get('/admission-requests').then((d: any) => setAdmissionRequests(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (settings && settings.site_title) {
      setSettingsForm({
        site_title: settings.site_title || '',
        site_subtitle: settings.site_subtitle || '',
        logo_url: settings.logo_url || '',
        primary_color: settings.primary_color || '#2d5016',
        secondary_color: settings.secondary_color || '#f4a261',
        contact_email: settings.contact_email || '',
        contact_phone: settings.contact_phone || '',
        contact_address: settings.contact_address || '',
        social_instagram: settings.social_instagram || '',
        social_facebook: settings.social_facebook || '',
        social_twitter: settings.social_twitter || '',
        show_join_form: settings.show_join_form ?? true,
      })
    }
  }, [settings])

  const savePage = async () => {
    setError(''); setSuccess('')
    try {
      if (editingPage) {
        await api.put(`/site/pages/${editingPage.id}`, pageForm)
        setSuccess('Pagina actualizada')
      } else {
        await api.post('/site/pages', pageForm)
        setSuccess('Pagina creada')
      }
      setShowPageForm(false)
      setEditingPage(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const editPage = (p: any) => {
    setEditingPage(p)
    setPageForm({
      slug: p.slug, title: p.title, subtitle: p.subtitle || '', content: '',
      icon: p.icon || 'home', menu_order: p.menu_order || 1,
      is_published: p.is_published, show_in_menu: p.show_in_menu,
    })
    // Cargar contenido completo
    api.get(`/public/pages/${p.slug}`).then((d: any) => {
      setPageForm((prev) => ({ ...prev, content: d.content || '' }))
    }).catch(() => {})
    setShowPageForm(true)
  }

  const deletePage = async (id: string) => {
    if (!confirm('¿Eliminar esta pagina?')) return
    try {
      await api.delete(`/site/pages/${id}`)
      setSuccess('Pagina eliminada')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const saveSettings = async () => {
    setError(''); setSuccess('')
    try {
      await api.put('/site/settings', settingsForm)
      setSuccess('Configuracion del sitio guardada')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const approveAdmission = async (id: string) => {
    try {
      await api.post(`/admission-requests/${id}/approve`, {})
      setSuccess('Solicitud aprobada')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const rejectAdmission = async (id: string) => {
    try {
      await api.post(`/admission-requests/${id}/reject`, {})
      setSuccess('Solicitud rechazada')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const ICON_OPTIONS = [
    { value: 'home', label: 'Inicio (casa)' },
    { value: 'heart', label: 'Corazon (filosofia)' },
    { value: 'shopping-cart', label: 'Carrito (productos)' },
    { value: 'users', label: 'Usuarios (comunidad)' },
    { value: 'help-circle', label: 'Ayuda (FAQ)' },
    { value: 'mail', label: 'Correo (contacto)' },
    { value: 'leaf', label: 'Hoja (naturaleza)' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Globe size={24} />Sitio Web Publico</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
          <p><strong>Sitio Web Publico - Ayuda</strong></p>
          <p><strong>Que es:</strong> El sitio web publico es la pagina que ven las personas externas sin iniciar sesion. Contiene informacion sobre la comunidad, filosofia, productos, como funciona el trueque y un formulario para solicitar unirse.</p>
          <p><strong>Paginas:</strong> Puedes crear, editar y eliminar paginas. Cada pagina tiene un slug (URL), titulo, contenido y un icono para el menu.</p>
          <p><strong>Configuracion:</strong> Puedes cambiar el titulo, colores, logo, redes sociales y datos de contacto del sitio.</p>
          <p><strong>Solicitudes de admision:</strong> Cuando alguien llena el formulario publico, aparece aqui para que la asamblea lo apruebe o rechace.</p>
          <p>El sitio publico esta disponible en: <strong>/p/inicio</strong></p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('pages')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'pages' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><FileText size={14} className="inline mr-1" />Paginas</button>
        <button onClick={() => setTab('settings')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'settings' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><SettingsIcon size={14} className="inline mr-1" />Configuracion</button>
        <button onClick={() => setTab('admission')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'admission' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><Mail size={14} className="inline mr-1" />Solicitudes ({admissionRequests.filter(r => r.status === 'pending').length})</button>
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
      {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg">{success}</div>}

      {/* ===== PAGINAS ===== */}
      {tab === 'pages' && (
        <div className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <button onClick={() => { setShowPageForm(!showPageForm); setEditingPage(null); setPageForm({ slug: '', title: '', subtitle: '', content: '', icon: 'home', menu_order: pages.length + 1, is_published: true, show_in_menu: true }) }} className="btn-primary flex items-center gap-2"><Plus size={18} />Nueva Pagina</button>
            </div>
          )}

          {showPageForm && canManage && (
            <div className="card space-y-4">
              <h3 className="font-semibold">{editingPage ? 'Editar Pagina' : 'Nueva Pagina'}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">Slug (URL)</label>
                  <input className="input" placeholder="Ej: inicio, filosofia, productos" value={pageForm.slug} onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })} disabled={!!editingPage} />
                  <p className="text-xs text-gray-400 mt-1">Identificador unico para la URL. Ej: inicio, filosofia, productos. Se accede en /p/slug</p>
                </div>
                <div>
                  <label className="label">Titulo</label>
                  <input className="input" placeholder="Ej: Nuestra Historia y Filosofia" value={pageForm.title} onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })} />
                  <p className="text-xs text-gray-400 mt-1">Titulo principal de la pagina. Ej: Nuestra Historia y Filosofia</p>
                </div>
              </div>

              <div>
                <label className="label">Subtitulo</label>
                <input className="input" placeholder="Ej: Quienes somos y de donde venimos" value={pageForm.subtitle} onChange={(e) => setPageForm({ ...pageForm, subtitle: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Subtitulo o descripcion corta. Aparece debajo del titulo.</p>
              </div>

              <div>
                <label className="label">Contenido (Markdown)</label>
                <textarea className="input min-h-48 font-mono text-sm" placeholder="# Titulo&#10;&#10;Parrafo de contenido...&#10;&#10;## Subtitulo&#10;&#10;- Lista item 1&#10;- Lista item 2" value={pageForm.content} onChange={(e) => setPageForm({ ...pageForm, content: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Contenido de la pagina en formato Markdown. Usa # para titulos, ## para subtitulos, - para listas, **texto** para negritas.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="label">Icono del menu</label>
                  <select className="input" value={pageForm.icon} onChange={(e) => setPageForm({ ...pageForm, icon: e.target.value })}>
                    {ICON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Icono que aparece en el menu de navegacion.</p>
                </div>
                <div>
                  <label className="label">Orden en menu</label>
                  <input type="number" className="input" value={pageForm.menu_order} onChange={(e) => setPageForm({ ...pageForm, menu_order: parseInt(e.target.value) || 1 })} />
                  <p className="text-xs text-gray-400 mt-1">Posicion en el menu. 1 = primera, 2 = segunda, etc.</p>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={pageForm.is_published} onChange={(e) => setPageForm({ ...pageForm, is_published: e.target.checked })} />
                    <span className="text-sm">Publicada</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={pageForm.show_in_menu} onChange={(e) => setPageForm({ ...pageForm, show_in_menu: e.target.checked })} />
                    <span className="text-sm">Mostrar en menu</span>
                  </label>
                </div>
              </div>

              <button onClick={savePage} className="btn-primary flex items-center gap-2"><Save size={18} />{editingPage ? 'Actualizar' : 'Crear'}</button>
            </div>
          )}

          <div className="space-y-2">
            {pages.map((p, i) => (
              <div key={i} className="card flex items-center justify-between">
                <div>
                  <span className="font-medium">{p.title}</span>
                  <span className="text-xs text-gray-500 ml-2">/p/{p.slug}</span>
                  {!p.is_published && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded ml-2">Borrador</span>}
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <button onClick={() => editPage(p)} className="text-blue-500"><Edit size={16} /></button>
                    <button onClick={() => deletePage(p.id)} className="text-red-500"><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
            ))}
            {pages.length === 0 && <p className="text-center text-gray-500 py-8">No hay paginas. Crea la primera.</p>}
          </div>
        </div>
      )}

      {/* ===== CONFIGURACION ===== */}
      {tab === 'settings' && (
        <div className="card space-y-4">
          <h2 className="font-semibold">Configuracion del Sitio Publico</h2>

          <div>
            <label className="label">Titulo del sitio</label>
            <input className="input" placeholder="Ej: Feria Conuquera Agroecologica" value={settingsForm.site_title} onChange={(e) => setSettingsForm({ ...settingsForm, site_title: e.target.value })} disabled={!canManage} />
            <p className="text-xs text-gray-400 mt-1">Nombre principal del sitio. Aparece en el header y footer.</p>
          </div>

          <div>
            <label className="label">Subtitulo / Lema</label>
            <input className="input" placeholder="Ej: Cuando el conuco viene a la ciudad..." value={settingsForm.site_subtitle} onChange={(e) => setSettingsForm({ ...settingsForm, site_subtitle: e.target.value })} disabled={!canManage} />
            <p className="text-xs text-gray-400 mt-1">Frase o lema que aparece debajo del titulo.</p>
          </div>

          <div>
            <label className="label">URL del logo</label>
            <input className="input" placeholder="Ej: https://ejemplo.com/logo.png" value={settingsForm.logo_url} onChange={(e) => setSettingsForm({ ...settingsForm, logo_url: e.target.value })} disabled={!canManage} />
            <p className="text-xs text-gray-400 mt-1">URL de la imagen del logo. Si esta vacio, se muestra un icono de hoja.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Color primario</label>
              <input type="color" className="input h-12" value={settingsForm.primary_color} onChange={(e) => setSettingsForm({ ...settingsForm, primary_color: e.target.value })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Color del header, footer y botones. Ej: verde #2d5016</p>
            </div>
            <div>
              <label className="label">Color secundario</label>
              <input type="color" className="input h-12" value={settingsForm.secondary_color} onChange={(e) => setSettingsForm({ ...settingsForm, secondary_color: e.target.value })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Color de acento y botones destacados. Ej: naranja #f4a261</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Email de contacto</label>
              <input className="input" placeholder="Ej: info@feriaconuquera.org" value={settingsForm.contact_email} onChange={(e) => setSettingsForm({ ...settingsForm, contact_email: e.target.value })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Email donde reciben consultas del publico.</p>
            </div>
            <div>
              <label className="label">Telefono de contacto</label>
              <input className="input" placeholder="Ej: +58 412 1234567" value={settingsForm.contact_phone} onChange={(e) => setSettingsForm({ ...settingsForm, contact_phone: e.target.value })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Telefono o WhatsApp publico.</p>
            </div>
          </div>

          <div>
            <label className="label">Direccion</label>
            <input className="input" placeholder="Ej: Parque Los Caobos, Caracas, Venezuela" value={settingsForm.contact_address} onChange={(e) => setSettingsForm({ ...settingsForm, contact_address: e.target.value })} disabled={!canManage} />
            <p className="text-xs text-gray-400 mt-1">Direccion fisica o ubicacion. Aparece en el footer.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">Instagram</label>
              <input className="input" placeholder="Ej: feriaconuquera" value={settingsForm.social_instagram} onChange={(e) => setSettingsForm({ ...settingsForm, social_instagram: e.target.value })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Usuario de Instagram sin @.</p>
            </div>
            <div>
              <label className="label">Facebook</label>
              <input className="input" placeholder="Ej: feriaconuquera" value={settingsForm.social_facebook} onChange={(e) => setSettingsForm({ ...settingsForm, social_facebook: e.target.value })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Usuario o pagina de Facebook.</p>
            </div>
            <div>
              <label className="label">Twitter / X</label>
              <input className="input" placeholder="Ej: feriaconuquera" value={settingsForm.social_twitter} onChange={(e) => setSettingsForm({ ...settingsForm, social_twitter: e.target.value })} disabled={!canManage} />
              <p className="text-xs text-gray-400 mt-1">Usuario de Twitter sin @.</p>
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settingsForm.show_join_form} onChange={(e) => setSettingsForm({ ...settingsForm, show_join_form: e.target.checked })} disabled={!canManage} />
            <span className="text-sm">Mostrar formulario de "Solicitar unirse" en el sitio publico</span>
          </label>
          <p className="text-xs text-gray-400 -mt-2">Si activas esta opcion, cualquier visitante podra llenar el formulario de solicitud de admision.</p>

          {canManage && (
            <button onClick={saveSettings} className="btn-primary flex items-center gap-2"><Save size={18} />Guardar Configuracion</button>
          )}
        </div>
      )}

      {/* ===== SOLICITUDES DE ADMISION ===== */}
      {tab === 'admission' && (
        <div className="space-y-4">
          <h2 className="font-semibold">Solicitudes de Admision Recibidas</h2>
          <p className="text-sm text-gray-500">Estas son las solicitudes que las personas han enviado desde el formulario publico del sitio web.</p>

          {admissionRequests.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">
              <p>No hay solicitudes de admision pendientes.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {admissionRequests.map((req, i) => (
                <div key={i} className="card space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{req.full_name}</span>
                      {req.status === 'pending' && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded ml-2">Pendiente</span>}
                      {req.status === 'approved' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded ml-2">Aprobada</span>}
                      {req.status === 'rejected' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded ml-2">Rechazada</span>}
                    </div>
                    <span className="text-xs text-gray-400">{new Date(req.created_at).toLocaleDateString()}</span>
                  </div>
                  {req.email && <p className="text-sm"><strong>Email:</strong> {req.email}</p>}
                  {req.phone && <p className="text-sm"><strong>Telefono:</strong> {req.phone}</p>}
                  {req.location && <p className="text-sm"><strong>Ubicacion:</strong> {req.location}</p>}
                  {req.reason && <p className="text-sm"><strong>Motivo:</strong> {req.reason}</p>}
                  {req.skills && <p className="text-sm"><strong>Saberes:</strong> {req.skills}</p>}
                  {req.how_heard && <p className="text-sm"><strong>Como se entero:</strong> {req.how_heard}</p>}
                  {req.status === 'pending' && canManage && (
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => approveAdmission(req.id)} className="btn-primary flex items-center gap-1 text-sm"><Check size={16} />Aprobar</button>
                      <button onClick={() => rejectAdmission(req.id)} className="bg-red-100 text-red-700 px-3 py-1 rounded-lg flex items-center gap-1 text-sm"><X size={16} />Rechazar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
