import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../hooks/useAuth'
import { Home, Heart, ShoppingCart, Users, HelpCircle, Mail, Leaf, Menu, X, LayoutDashboard, LogOut, Edit } from 'lucide-react'

const ICONS: Record<string, any> = {
  home: Home, heart: Heart, 'shopping-cart': ShoppingCart, users: Users,
  'help-circle': HelpCircle, mail: Mail, leaf: Leaf,
}

interface PublicPage {
  slug: string
  title: string
  subtitle: string
  icon: string
  menu_order: number
}

interface PublicSettings {
  site_title: string
  site_subtitle: string
  logo_url: string
  primary_color: string
  secondary_color: string
  contact_address: string
  social_instagram: string
  social_facebook: string
  show_join_form: boolean
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, username, logout } = useAuth()
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [pages, setPages] = useState<PublicPage[]>([])
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    api.get('/public/settings').then((s: any) => setSettings(s)).catch(() => {})
    api.get('/public/pages').then((d: any) => setPages(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const primaryColor = settings?.primary_color || '#2d5016'
  const secondaryColor = settings?.secondary_color || '#f4a261'

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#faf8f5' }}>
      {/* Header */}
      <header className="shadow-md sticky top-0 z-50" style={{ backgroundColor: primaryColor }}>
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/p/inicio" className="flex items-center gap-3 text-white">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="logo" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <Leaf size={32} style={{ color: secondaryColor }} />
              )}
              <div>
                <h1 className="text-lg font-bold">{settings?.site_title || 'Feria Conuquera'}</h1>
                <p className="text-xs opacity-80 hidden sm:block">{settings?.site_subtitle}</p>
              </div>
            </Link>

            {/* Desktop menu */}
            <nav className="hidden md:flex items-center gap-1">
              {pages.map((p) => {
                const Icon = ICONS[p.icon] || Home
                return (
                  <Link
                    key={p.slug}
                    to={`/p/${p.slug}`}
                    className="px-3 py-2 rounded-lg text-sm text-white hover:bg-white/20 transition flex items-center gap-1"
                  >
                    <Icon size={16} />
                    {p.title}
                  </Link>
                )
              })}
              {settings?.show_join_form && !isAuthenticated && (
                <Link
                  to="/p/unirse"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white transition"
                  style={{ backgroundColor: secondaryColor }}
                >
                  Solicitar unirse
                </Link>
              )}
              {isAuthenticated ? (
                <>
                  <Link
                    to="/app/website"
                    className="px-3 py-2 rounded-lg text-sm text-white hover:bg-white/20 transition flex items-center gap-1"
                    title="Editar sitio web"
                  >
                    <Edit size={14} />
                    Editar
                  </Link>
                  <Link
                    to="/app/dashboard"
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white transition flex items-center gap-1"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    <LayoutDashboard size={14} />
                    Escritorio
                  </Link>
                  <button
                    onClick={() => { logout(); window.location.href = '/' }}
                    className="px-3 py-2 rounded-lg text-sm text-white/80 hover:text-white hover:bg-white/10 transition flex items-center gap-1"
                    title="Cerrar sesion"
                  >
                    <LogOut size={14} />
                    Salir
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="px-3 py-2 rounded-lg text-sm text-white/80 hover:text-white hover:bg-white/10 transition"
                >
                  Iniciar sesion
                </Link>
              )}
            </nav>

            {/* Mobile menu button */}
            <button
              className="md:hidden text-white"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <nav className="md:hidden mt-3 space-y-1">
              {pages.map((p) => {
                const Icon = ICONS[p.icon] || Home
                return (
                  <Link
                    key={p.slug}
                    to={`/p/${p.slug}`}
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm text-white hover:bg-white/20 transition flex items-center gap-2"
                  >
                    <Icon size={16} />
                    {p.title}
                  </Link>
                )
              })}
              {settings?.show_join_form && !isAuthenticated && (
                <Link
                  to="/p/unirse"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 rounded-lg text-sm font-medium text-white text-center"
                  style={{ backgroundColor: secondaryColor }}
                >
                  Solicitar unirse
                </Link>
              )}
              {isAuthenticated ? (
                <>
                  <Link
                    to="/app/website"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm text-white hover:bg-white/20"
                  >
                    Editar sitio
                  </Link>
                  <Link
                    to="/app/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 rounded-lg text-sm font-medium text-white text-center"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    Escritorio
                  </Link>
                  <button
                    onClick={() => { logout(); window.location.href = '/' }}
                    className="block w-full text-left px-3 py-2 rounded-lg text-sm text-white/80 hover:text-white"
                  >
                    Cerrar sesion ({username})
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm text-white/80 hover:text-white"
                >
                  Iniciar sesion
                </Link>
              )}
            </nav>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-12 py-8 text-white" style={{ backgroundColor: primaryColor }}>
        <div className="max-w-6xl mx-auto px-4 text-center text-sm space-y-2">
          <p className="font-semibold">{settings?.site_title || 'Feria Conuquera Agroecologica'}</p>
          {settings?.contact_address && <p className="opacity-80">{settings.contact_address}</p>}
          <div className="flex justify-center gap-4 pt-2">
            {settings?.social_instagram && (
              <a href={`https://instagram.com/${settings.social_instagram}`} target="_blank" rel="noopener" className="hover:underline">
                Instagram @{settings.social_instagram}
              </a>
            )}
            {settings?.social_facebook && (
              <a href={`https://facebook.com/${settings.social_facebook}`} target="_blank" rel="noopener" className="hover:underline">
                Facebook
              </a>
            )}
          </div>
          {isAuthenticated ? (
            <Link to="/app/dashboard" className="inline-block pt-2 text-white/60 hover:text-white text-xs">
              Ir al escritorio
            </Link>
          ) : (
            <Link to="/login" className="inline-block pt-2 text-white/60 hover:text-white text-xs">
              Iniciar sesion miembros
            </Link>
          )}
        </div>
      </footer>
    </div>
  )
}

// Pagina individual del sitio publico
export function PublicPageView() {
  const { slug } = useParams()
  const [page, setPage] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/public/pages/${slug}`).then((d: any) => {
      setPage(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-gray-700">Pagina no encontrada</h2>
        <Link to="/p/inicio" className="text-blue-600 hover:underline mt-2 inline-block">Volver al inicio</Link>
      </div>
    )
  }

  return (
    <article className="prose prose-lg max-w-none">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">{page.title}</h1>
      {page.subtitle && <p className="text-lg text-gray-600 italic mb-6">{page.subtitle}</p>}
      <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">{page.content}</div>
    </article>
  )
}

// Formulario de solicitud de admision publica
export function PublicJoinForm() {
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', location: '', reason: '', skills: '', how_heard: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (!form.full_name) {
      setError('Tu nombre completo es obligatorio')
      return
    }
    try {
      await api.post('/public/admission-request', form)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar')
    }
  }

  if (submitted) {
    return (
      <div className="card text-center py-12">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="text-2xl font-bold text-green-700 mb-2">¡Solicitud enviada!</h2>
        <p className="text-gray-600">Gracias por tu interes en unirte a nuestra comunidad. Nos pondremos en contacto contigo pronto.</p>
        <Link to="/p/inicio" className="text-blue-600 hover:underline mt-4 inline-block">Volver al inicio</Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Solicitar unirse a la comunidad</h1>
        <p className="text-gray-600 mt-2">Completa este formulario y nos pondremos en contacto contigo</p>
      </div>

      <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
        <p><strong>¿Quienes somos?</strong> Somos una comunidad agroecologica que practica el trueque y la economia solidaria. Buscamos personas comprometidas con la soberania alimentaria, el cuidado de la tierra y la cooperacion mutua.</p>
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      <div className="card space-y-4">
        <div>
          <label className="label">Nombre completo *</label>
          <input className="input" placeholder="Ej: Maria Gonzalez" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <p className="text-xs text-gray-400 mt-1">Tu nombre y apellido. Ej: Maria Gonzalez.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Correo electronico</label>
            <input className="input" placeholder="Ej: maria@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Para que podamos contactarte. Ej: maria@email.com</p>
          </div>
          <div>
            <label className="label">Telefono</label>
            <input className="input" placeholder="Ej: +58 412 1234567" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Telefono o WhatsApp. Ej: +58 412 1234567</p>
          </div>
        </div>

        <div>
          <label className="label">Ubicacion</label>
          <input className="input" placeholder="Ej: Caracas, La Pastora" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <p className="text-xs text-gray-400 mt-1">Donde vives o donde tienes tu produccion. Ej: Caracas, La Pastora.</p>
        </div>

        <div>
          <label className="label">¿Por que quieres unirte?</label>
          <textarea className="input min-h-24" placeholder="Ej: Soy productor agroecologico y quiero participar en la feria para vender mis productos directamente al consumidor..." value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <p className="text-xs text-gray-400 mt-1">Cuentanos tus motivaciones. Ej: Soy productor agroecologico y quiero vender directamente al consumidor.</p>
        </div>

        <div>
          <label className="label">¿Que saberes o productos aportas?</label>
          <textarea className="input min-h-20" placeholder="Ej: Cultivo hortalizas organicas, hago pan artesanal, se de lombricultura..." value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
          <p className="text-xs text-gray-400 mt-1">Que puedes aportar a la comunidad. Ej: Cultivo hortalizas, hago pan artesanal, se de lombricultura.</p>
        </div>

        <div>
          <label className="label">¿Como te enteraste de nosotros?</label>
          <input className="input" placeholder="Ej: Instagram, un amigo, vi la feria en el parque..." value={form.how_heard} onChange={(e) => setForm({ ...form, how_heard: e.target.value })} />
          <p className="text-xs text-gray-400 mt-1">Como conociste la comunidad. Ej: Instagram, un amigo, vi la feria en el parque.</p>
        </div>

        <button onClick={submit} className="btn-primary w-full">Enviar solicitud</button>
      </div>
    </div>
  )
}
