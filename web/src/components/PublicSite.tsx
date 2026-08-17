import React, { useState, useEffect } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../hooks/useAuth'
import {
  Home,
  Heart,
  ShoppingCart,
  Users,
  HelpCircle,
  Mail,
  Leaf,
  Menu,
  X,
  LayoutDashboard,
  LogOut,
  Edit,
  MapPin,
  Calendar,
  Sparkles,
  ArrowRight,
  Instagram,
  Facebook,
  ShieldCheck,
} from 'lucide-react'
import { PageBlocksRenderer } from './public-site/PublicBlocks'
import { FERIA_CONUQUERA_TEMPLATES } from './public-site/defaultSiteData'
import { PublicPageData } from '../types/publicSite'

const ICONS: Record<string, any> = {
  home: Home,
  heart: Heart,
  'shopping-cart': ShoppingCart,
  users: Users,
  'help-circle': HelpCircle,
  mail: Mail,
  leaf: Leaf,
}

interface PublicSettings {
  site_title: string
  site_subtitle: string
  logo_url: string
  primary_color: string
  secondary_color: string
  contact_address: string
  contact_email?: string
  contact_phone?: string
  social_instagram: string
  social_facebook: string
  social_twitter?: string
  show_join_form: boolean
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, username, logout } = useAuth()
  const location = useLocation()
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [pages, setPages] = useState<PublicPageData[]>([])
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    api.get('/public/settings').then((s: any) => setSettings(s)).catch(() => {})
    api.get('/public/pages').then((d: any) => {
      if (Array.isArray(d) && d.length > 0) {
        setPages(d)
      } else {
        // Fallback to default pages
        setPages(
          FERIA_CONUQUERA_TEMPLATES.map((t) => ({
            slug: t.slug,
            title: t.title,
            subtitle: t.subtitle,
            icon: t.icon,
            menu_order: t.menu_order,
            is_published: true,
            show_in_menu: true,
            content: JSON.stringify(t.blocks),
          }))
        )
      }
    }).catch(() => {})
  }, [])

  const primaryColor = settings?.primary_color || '#1e3a1e'
  const secondaryColor = settings?.secondary_color || '#c85a32'

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-amber-200 selection:text-amber-950" style={{ backgroundColor: '#faf8f5' }}>
      {/* Top Notification / Announcement Bar */}
      <div
        className="text-white text-xs sm:text-sm py-2 px-4 text-center font-medium shadow-inner flex items-center justify-center gap-2"
        style={{ backgroundColor: '#142a14' }}
      >
        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span>
          🗓️ <b>Próximo Encuentro Conuquero:</b> Primer sábado de cada mes en <b>Parque Los Caobos, Caracas</b> | 9:00 AM
        </span>
      </div>

      {/* Main Header / Navbar */}
      <header className="shadow-md sticky top-0 z-50 backdrop-blur-md border-b border-white/10" style={{ backgroundColor: primaryColor }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo & Brand */}
            <Link to="/p/inicio" className="flex items-center gap-3 text-white group flex-shrink-0">
              {settings?.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt="logo"
                  className="w-10 h-10 rounded-full object-cover border-2 border-amber-400/80 shadow-md group-hover:scale-105 transition"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-emerald-400 flex items-center justify-center text-white shadow-md group-hover:rotate-6 transition">
                  <Leaf size={22} />
                </div>
              )}
              <div>
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight leading-tight">
                  {settings?.site_title || 'Feria Conuquera Agroecológica'}
                </h1>
                <p className="text-[11px] text-emerald-200/90 hidden sm:block font-medium">
                  {settings?.site_subtitle || 'Parque Los Caobos, Caracas'}
                </p>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
              {pages.map((p) => {
                const Icon = ICONS[p.icon || 'home'] || Home
                const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
                return (
                  <Link
                    key={p.slug}
                    to={`/p/${p.slug}`}
                    className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-white/20 text-white shadow-inner border border-white/20'
                        : 'text-white/85 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon size={15} />
                    {p.title}
                  </Link>
                )
              })}
            </nav>

            {/* Desktop Action Buttons */}
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
              {settings?.show_join_form && !isAuthenticated && (
                <Link
                  to="/p/unirse"
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white transition shadow hover:brightness-110 active:scale-95 flex items-center gap-1.5"
                  style={{ backgroundColor: secondaryColor }}
                >
                  <Sparkles size={14} />
                  Solicitar Unirse
                </Link>
              )}

              {isAuthenticated ? (
                <div className="flex items-center gap-1.5 bg-black/20 p-1 rounded-xl border border-white/10">
                  <Link
                    to="/app/website"
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white hover:bg-white/20 transition flex items-center gap-1"
                    title="Editar módulos del sitio web"
                  >
                    <Edit size={13} />
                    Editar Módulos
                  </Link>
                  <Link
                    to="/app/dashboard"
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition flex items-center gap-1 shadow-sm"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    <LayoutDashboard size={13} />
                    Escritorio
                  </Link>
                  <button
                    onClick={() => {
                      logout()
                      window.location.href = '/'
                    }}
                    className="px-2 py-1.5 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/10 transition"
                    title="Cerrar sesión"
                  >
                    <LogOut size={13} />
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 transition"
                >
                  Iniciar sesión
                </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden text-white p-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Abrir menú"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {/* Mobile Menu Drawer */}
          {menuOpen && (
            <div className="lg:hidden mt-3 pt-3 border-t border-white/10 space-y-1 pb-2">
              {pages.map((p) => {
                const Icon = ICONS[p.icon || 'home'] || Home
                const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
                return (
                  <Link
                    key={p.slug}
                    to={`/p/${p.slug}`}
                    onClick={() => setMenuOpen(false)}
                    className={`block px-3.5 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2.5 ${
                      isActive ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon size={16} />
                    {p.title}
                  </Link>
                )
              })}

              <div className="pt-3 mt-2 border-t border-white/10 space-y-2">
                {settings?.show_join_form && !isAuthenticated && (
                  <Link
                    to="/p/unirse"
                    onClick={() => setMenuOpen(false)}
                    className="block w-full text-center px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    Solicitar unirse
                  </Link>
                )}

                {isAuthenticated ? (
                  <div className="space-y-1">
                    <Link
                      to="/app/website"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 rounded-lg text-sm text-white hover:bg-white/20 flex items-center gap-2"
                    >
                      <Edit size={16} />
                      Editar módulos del sitio
                    </Link>
                    <Link
                      to="/app/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2.5 rounded-xl text-sm font-bold text-white text-center shadow"
                      style={{ backgroundColor: secondaryColor }}
                    >
                      Ir al Escritorio ({username})
                    </Link>
                    <button
                      onClick={() => {
                        logout()
                        window.location.href = '/'
                      }}
                      className="block w-full text-left px-3 py-2 rounded-lg text-sm text-red-200 hover:text-white flex items-center gap-2"
                    >
                      <LogOut size={16} />
                      Cerrar sesión
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="block text-center px-3 py-2 rounded-xl text-sm text-white/90 hover:bg-white/10"
                  >
                    Iniciar sesión
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Page Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>

      {/* Rich Eco Footer (Inspired by ecovillage.org & ecoaldeas.org) */}
      <footer className="text-white mt-16 pt-12 pb-8 border-t border-white/10 shadow-2xl" style={{ backgroundColor: '#152b15' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-white/10">
            {/* Column 1: Brand & Slogan */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold">
                  <Leaf size={18} />
                </div>
                <h3 className="font-extrabold text-base tracking-tight text-white">
                  {settings?.site_title || 'Feria Conuquera Agroecológica'}
                </h3>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Espacio de economía popular solidaria, agroecología, trueque y soberanía alimentaria en Caracas desde octubre de 2014.
              </p>
              <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold pt-1">
                <ShieldCheck size={16} />
                <span>100% Autogestión & Suelo Vivo</span>
              </div>
            </div>

            {/* Column 2: Quick Links */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm uppercase tracking-wider text-amber-400">
                Páginas del Nodo
              </h4>
              <ul className="space-y-1.5 text-xs text-gray-300">
                {pages.slice(0, 6).map((p) => (
                  <li key={p.slug}>
                    <Link to={`/p/${p.slug}`} className="hover:text-amber-300 transition flex items-center gap-1.5">
                      <span>•</span>
                      <span>{p.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Location & Meeting */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm uppercase tracking-wider text-amber-400">
                Lugar de Encuentro
              </h4>
              <div className="text-xs text-gray-300 space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>Parque Los Caobos, Caracas. Zona sur cerca de la Fuente Venezuela.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>Primer sábado de cada mes (9:00 AM a 1:00 PM).</span>
                </div>
              </div>
            </div>

            {/* Column 4: Social & Admission */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm uppercase tracking-wider text-amber-400">
                Comunidad & Redes
              </h4>
              <div className="space-y-2 text-xs text-gray-300">
                {settings?.social_instagram && (
                  <a
                    href={`https://instagram.com/${settings.social_instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-pink-300 transition"
                  >
                    <Instagram size={16} className="text-pink-400" />
                    <span>Instagram @{settings.social_instagram}</span>
                  </a>
                )}
                {settings?.social_facebook && (
                  <a
                    href={`https://facebook.com/${settings.social_facebook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-blue-300 transition"
                  >
                    <Facebook size={16} className="text-blue-400" />
                    <span>Facebook: Feria Conuquera</span>
                  </a>
                )}
                <div className="pt-2">
                  <Link
                    to="/p/unirse"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition"
                  >
                    <span>Llenar Solicitud de Ingreso</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Copyright & Member Login Link */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 gap-3">
            <p>© {new Date().getFullYear()} Red de Intercambio Federada — Feria Conuquera Agroecológica.</p>
            <div>
              {isAuthenticated ? (
                <Link to="/app/dashboard" className="text-amber-400 hover:underline">
                  Ir al escritorio administrativo
                </Link>
              ) : (
                <Link to="/login" className="text-gray-400 hover:text-white transition">
                  Acceso exclusivo miembros y productores
                </Link>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// -------------------------------------------------------------
// PUBLIC PAGE VIEW (Handles modular blocks or markdown)
// -------------------------------------------------------------
export function PublicPageView() {
  const { slug } = useParams<{ slug?: string }>()
  const targetSlug = slug || 'inicio'
  const [page, setPage] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .get(`/public/pages/${targetSlug}`)
      .then((d: any) => {
        setPage(d)
        setLoading(false)
      })
      .catch(() => {
        // Fallback to preconfigured template if not in db yet
        const tmpl = FERIA_CONUQUERA_TEMPLATES.find((t) => t.slug === targetSlug)
        if (tmpl) {
          setPage({
            slug: tmpl.slug,
            title: tmpl.title,
            subtitle: tmpl.subtitle,
            content: JSON.stringify(tmpl.blocks),
          })
        }
        setLoading(false)
      })
  }, [targetSlug])

  if (loading) {
    return (
      <div className="text-center py-24 space-y-3">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin mx-auto" />
        <p className="text-gray-500 font-medium text-sm">Cargando contenido...</p>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl p-8 shadow-sm border border-gray-100 max-w-lg mx-auto space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
          <HelpCircle size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Página no encontrada</h2>
        <p className="text-sm text-gray-600">La página solicitada no está disponible o ha sido movida.</p>
        <Link
          to="/p/inicio"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-trueque-700 hover:bg-trueque-800 transition text-sm shadow"
        >
          Volver al Inicio
        </Link>
      </div>
    )
  }

  return <PageBlocksRenderer content={page.content} />
}

// -------------------------------------------------------------
// PUBLIC JOIN FORM (Interactive Request Admission Flow)
// -------------------------------------------------------------
export function PublicJoinForm() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    location: '',
    reason: '',
    skills: '',
    how_heard: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError('')
    if (!form.full_name) {
      setError('Tu nombre completo es obligatorio.')
      return
    }
    setLoading(true)
    try {
      await api.post('/public/admission-request', form)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar la solicitud.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-3xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-md border border-emerald-100 space-y-4 my-8">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-3xl shadow-inner">
          ✓
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-emerald-900">
          ¡Solicitud enviada con éxito!
        </h2>
        <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
          Muchas gracias por tu interés en sumarte a la <b>Feria Conuquera Agroecológica</b>. Tu solicitud ha sido registrada y será evaluada por la asamblea comunitaria. Nos pondremos en contacto contigo a la brevedad.
        </p>
        <div className="pt-4">
          <Link
            to="/p/inicio"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-trueque-700 hover:bg-trueque-800 transition text-sm shadow"
          >
            Volver a la Página Principal
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto my-6 space-y-6">
      <div className="text-center space-y-2">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
          🌱 Admisión Comunitaria
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
          Solicitud de Ingreso a la Red
        </h1>
        <p className="text-sm sm:text-base text-gray-600 max-w-xl mx-auto">
          Completa tus datos para postularte como productor conuquero, artesano o miembro de la comunidad de intercambio solidario.
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-gray-200 space-y-5">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 text-red-700 text-xs sm:text-sm border border-red-200">
            {error}
          </div>
        )}

        <div>
          <label className="label font-bold text-gray-800">Nombre Completo *</label>
          <input
            className="input"
            placeholder="Ej: María Rodríguez"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label font-bold text-gray-800">Correo Electrónico</label>
            <input
              type="email"
              className="input"
              placeholder="maria@ejemplo.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label font-bold text-gray-800">Teléfono / WhatsApp</label>
            <input
              className="input"
              placeholder="+58 412 0000000"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="label font-bold text-gray-800">Ubicación / Sector donde produces o vives</label>
          <input
            className="input"
            placeholder="Ej: El Junquito Km 18 / La Pastora / Valles del Tuy"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>

        <div>
          <label className="label font-bold text-gray-800">¿Qué produces o qué saberes deseas aportar?</label>
          <textarea
            rows={3}
            className="input"
            placeholder="Ej: Hortalizas agroecológicas, panadería artesanal, medicina botánica, talleres de siembra..."
            value={form.skills}
            onChange={(e) => setForm({ ...form, skills: e.target.value })}
          />
        </div>

        <div>
          <label className="label font-bold text-gray-800">¿Por qué deseas unirte a la red de trueque?</label>
          <textarea
            rows={3}
            className="input"
            placeholder="Explícanos tu motivación para participar en la economía solidaria y la soberanía alimentaria..."
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
        </div>

        <div>
          <label className="label font-bold text-gray-800">¿Cómo te enteraste de la feria?</label>
          <input
            className="input"
            placeholder="Ej: Visité el Parque Los Caobos / Instagram / Recomendación de un productor"
            value={form.how_heard}
            onChange={(e) => setForm({ ...form, how_heard: e.target.value })}
          />
        </div>

        <div className="pt-2">
          <button
            onClick={submit}
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-white bg-trueque-800 hover:bg-trueque-700 active:scale-95 transition shadow-lg text-base disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Enviando solicitud...' : 'Enviar Solicitud a la Asamblea'}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
