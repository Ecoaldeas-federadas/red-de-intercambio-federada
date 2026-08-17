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
  ChevronDown,
  Globe,
  Zap,
  Building2,
  Search,
} from 'lucide-react'
import { PageBlocksRenderer } from './public-site/PublicBlocks'
import { FERIA_CONUQUERA_TEMPLATES } from './public-site/defaultSiteData'
import { PublicPageData, HeaderStyleType } from '../types/publicSite'

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
  header_style?: HeaderStyleType
  announcement_text?: string
  show_announcement?: boolean
  footer_style?: string
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, username, logout } = useAuth()
  const location = useLocation()
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [pages, setPages] = useState<PublicPageData[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  useEffect(() => {
    api.get('/public/settings').then((s: any) => setSettings(s)).catch(() => {})
    api.get('/public/pages').then((d: any) => {
      if (Array.isArray(d) && d.length > 0) {
        setPages(d)
      } else {
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

  const headerStyle = settings?.header_style || 'modern_eco'
  const primaryColor = settings?.primary_color || '#162e16'
  const secondaryColor = settings?.secondary_color || '#c2410c'
  const showAnnouncement = settings?.show_announcement ?? true
  const announcementText =
    settings?.announcement_text ||
    '🗓️ Próximo Encuentro Conuquero: Primer sábado de cada mes en Parque Los Caobos, Caracas | 9:00 AM'

  // Navigation categorization for dropdown style
  const aboutPages = pages.filter((p) => ['inicio', 'filosofia', 'campo-soberano'].includes(p.slug))
  const economyPages = pages.filter((p) => ['productos', 'como-funciona'].includes(p.slug))
  const communityPages = pages.filter((p) => ['comunidad', 'faq', 'contacto'].includes(p.slug))
  const otherPages = pages.filter(
    (p) => !['inicio', 'filosofia', 'campo-soberano', 'productos', 'como-funciona', 'comunidad', 'faq', 'contacto'].includes(p.slug)
  )

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-amber-200 selection:text-amber-950 overflow-x-hidden w-full bg-[#fdfbf7]">
      {/* 1. TOP ANNOUNCEMENT BAR */}
      {showAnnouncement && (
        <div
          className="text-white text-[11px] sm:text-xs py-2 px-4 text-center font-medium shadow-xs flex items-center justify-center gap-2"
          style={{ backgroundColor: headerStyle === 'fao_institutional' ? '#1b4d3e' : '#0d1f0d' }}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
          <span className="truncate max-w-4xl">{announcementText}</span>
        </div>
      )}

      {/* 2. DYNAMIC HEADER BY SELECTED STYLE */}

      {/* STYLE A: FAO INSTITUTIONAL / PORTAL BLANCO (Clean white, sub-bar, search, institutional badges) */}
      {headerStyle === 'fao_institutional' && (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3.5">
            <div className="flex items-center justify-between gap-4">
              {/* Brand */}
              <Link to="/p/inicio" className="flex items-center gap-3 group flex-shrink-0">
                {settings?.logo_url ? (
                  <img
                    src={settings.logo_url}
                    alt="logo"
                    className="w-10 h-10 rounded-lg object-cover border border-emerald-200 shadow-xs"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-extrabold shadow-sm">
                    <Building2 size={22} />
                  </div>
                )}
                <div>
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-emerald-950 leading-tight">
                    {settings?.site_title || 'Red de Intercambio Agroecológico'}
                  </h1>
                  <p className="text-[11px] text-emerald-700 font-semibold hidden sm:block">
                    {settings?.site_subtitle || 'Portal Oficial de Soberanía Alimentaria'}
                  </p>
                </div>
              </Link>

              {/* Desktop Nav */}
              <nav className="hidden xl:flex items-center gap-1 text-xs font-bold text-gray-700">
                {pages.map((p) => {
                  const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
                  return (
                    <Link
                      key={p.slug}
                      to={`/p/${p.slug}`}
                      className={`px-3 py-2 rounded-lg transition ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-900 font-black border-b-2 border-emerald-800'
                          : 'hover:bg-gray-100 hover:text-emerald-800'
                      }`}
                    >
                      {p.title}
                    </Link>
                  )
                })}
              </nav>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {settings?.show_join_form && !isAuthenticated && (
                  <Link
                    to="/p/unirse"
                    className="hidden sm:inline-flex px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-700 transition shadow-xs items-center gap-1.5"
                  >
                    <Sparkles size={13} />
                    Solicitar Ingreso
                  </Link>
                )}

                {isAuthenticated ? (
                  <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                    <Link
                      to="/app/website"
                      className="px-2.5 py-1 rounded text-xs font-semibold text-gray-800 hover:bg-white"
                    >
                      <Edit size={13} className="inline mr-1" />
                      Editor
                    </Link>
                    <Link
                      to="/app/dashboard"
                      className="px-2.5 py-1 rounded text-xs font-bold text-white bg-emerald-800"
                    >
                      Escritorio
                    </Link>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    className="hidden sm:inline-block px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-900 border border-emerald-800 hover:bg-emerald-50"
                  >
                    Acceso
                  </Link>
                )}

                <button
                  className="xl:hidden p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  {menuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* STYLE B: EDITORIAL LATAM / REVISTA BIODIVERSIDAD (Double tier header) */}
      {headerStyle === 'editorial_latam' && (
        <header className="sticky top-0 z-50 shadow-md">
          {/* Top Tier: Logo & Social */}
          <div className="bg-white border-b border-amber-200/60 py-3 px-4 sm:px-6">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              <Link to="/p/inicio" className="flex items-center gap-3">
                {settings?.logo_url ? (
                  <img src={settings.logo_url} alt="" className="w-10 h-10 rounded-full object-cover shadow" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-700 text-white flex items-center justify-center font-serif text-xl font-bold">
                    C
                  </div>
                )}
                <div>
                  <h1 className="text-base sm:text-xl font-black text-amber-950 uppercase tracking-tight font-serif">
                    {settings?.site_title || 'Feria Conuquera & Agroecología'}
                  </h1>
                  <p className="text-[11px] text-amber-800 italic hidden sm:block">
                    {settings?.site_subtitle || 'Publicación y Red Comunitaria Autónoma'}
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-2">
                <span className="hidden md:inline-block text-xs font-serif font-bold text-amber-900 bg-amber-100 px-3 py-1 rounded-full">
                  🍃 Semillas Libres & Soberanía
                </span>
                {isAuthenticated && (
                  <Link
                    to="/app/website"
                    className="text-xs font-bold bg-amber-800 text-white px-3 py-1.5 rounded-lg shadow-xs"
                  >
                    Editar Módulos
                  </Link>
                )}
                <button
                  className="xl:hidden p-1.5 text-amber-950 bg-amber-100 rounded-lg"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  {menuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>
          </div>

          {/* Lower Tier: Horizontal Navigation Bar */}
          <div className="bg-[#1f301d] text-white py-2 px-4 sm:px-6 border-b border-black/20">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <nav className="hidden xl:flex items-center gap-1 text-xs uppercase font-bold tracking-wider">
                {pages.map((p) => {
                  const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
                  return (
                    <Link
                      key={p.slug}
                      to={`/p/${p.slug}`}
                      className={`px-3 py-1.5 rounded-md transition ${
                        isActive ? 'bg-amber-600 text-white font-extrabold' : 'text-gray-200 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {p.title}
                    </Link>
                  )
                })}
              </nav>

              <Link
                to="/p/unirse"
                className="hidden sm:inline-flex text-xs font-bold text-amber-300 hover:text-white items-center gap-1 ml-auto"
              >
                Solicitar Admisión →
              </Link>
            </div>
          </div>
        </header>
      )}

      {/* STYLE C: DROPDOWN CATEGORIES (Organized Multi-Level Menu) */}
      {headerStyle === 'dropdown_categories' && (
        <header className="sticky top-0 z-50 shadow-md backdrop-blur-md" style={{ backgroundColor: primaryColor }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3">
            <div className="flex items-center justify-between gap-4">
              <Link to="/p/inicio" className="flex items-center gap-2.5 text-white">
                <div className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">
                  <Leaf size={20} />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold">{settings?.site_title || 'Feria Conuquera'}</h1>
                  <p className="text-[10px] text-emerald-200 hidden sm:block">{settings?.site_subtitle}</p>
                </div>
              </Link>

              {/* Categorized Dropdowns */}
              <nav className="hidden lg:flex items-center gap-2 text-xs font-bold text-white">
                <Link to="/p/inicio" className="px-3 py-2 rounded-xl hover:bg-white/10">
                  Inicio
                </Link>

                {/* Dropdown 1: Sobre la Red */}
                <div className="relative group">
                  <button className="px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-1">
                    Sobre la Red <ChevronDown size={14} />
                  </button>
                  <div className="absolute left-0 top-full hidden group-hover:block bg-white text-gray-900 rounded-2xl shadow-xl border border-gray-100 p-2 w-52 space-y-1">
                    {aboutPages.map((p) => (
                      <Link
                        key={p.slug}
                        to={`/p/${p.slug}`}
                        className="block px-3 py-2 rounded-xl hover:bg-emerald-50 text-xs font-semibold text-gray-800 hover:text-emerald-900"
                      >
                        {p.title}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Dropdown 2: Economía y Cosecha */}
                <div className="relative group">
                  <button className="px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-1">
                    Economía & Cosecha <ChevronDown size={14} />
                  </button>
                  <div className="absolute left-0 top-full hidden group-hover:block bg-white text-gray-900 rounded-2xl shadow-xl border border-gray-100 p-2 w-56 space-y-1">
                    {economyPages.map((p) => (
                      <Link
                        key={p.slug}
                        to={`/p/${p.slug}`}
                        className="block px-3 py-2 rounded-xl hover:bg-emerald-50 text-xs font-semibold text-gray-800 hover:text-emerald-900"
                      >
                        {p.title}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Dropdown 3: Comunidad */}
                <div className="relative group">
                  <button className="px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-1">
                    Comunidad & Saberes <ChevronDown size={14} />
                  </button>
                  <div className="absolute left-0 top-full hidden group-hover:block bg-white text-gray-900 rounded-2xl shadow-xl border border-gray-100 p-2 w-52 space-y-1">
                    {communityPages.map((p) => (
                      <Link
                        key={p.slug}
                        to={`/p/${p.slug}`}
                        className="block px-3 py-2 rounded-xl hover:bg-emerald-50 text-xs font-semibold text-gray-800 hover:text-emerald-900"
                      >
                        {p.title}
                      </Link>
                    ))}
                  </div>
                </div>

                {otherPages.map((p) => (
                  <Link key={p.slug} to={`/p/${p.slug}`} className="px-3 py-2 rounded-xl hover:bg-white/10">
                    {p.title}
                  </Link>
                ))}
              </nav>

              <div className="flex items-center gap-2">
                <Link
                  to="/p/unirse"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow"
                  style={{ backgroundColor: secondaryColor }}
                >
                  Unirse
                </Link>
                <button
                  className="lg:hidden text-white p-2"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  {menuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* STYLE D & DEFAULT: MODERN ECO / ECOVILLAGE (Sleek forest theme) */}
      {(headerStyle === 'modern_eco' || headerStyle === 'agrodigital_mincyt') && (
        <header className="shadow-md sticky top-0 z-50 backdrop-blur-md border-b border-white/10" style={{ backgroundColor: primaryColor }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3">
            <div className="flex items-center justify-between gap-3">
              {/* Logo & Brand */}
              <Link to="/p/inicio" className="flex items-center gap-2.5 text-white group flex-shrink-0">
                {settings?.logo_url ? (
                  <img
                    src={settings.logo_url}
                    alt="logo"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-amber-400/80 shadow-md group-hover:scale-105 transition"
                  />
                ) : (
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-amber-500 to-emerald-400 flex items-center justify-center text-white shadow-md group-hover:rotate-6 transition">
                    <Leaf size={20} />
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-base md:text-lg font-extrabold tracking-tight leading-tight truncate">
                    {settings?.site_title || 'Feria Conuquera Agroecológica'}
                  </h1>
                  <p className="text-[11px] text-emerald-200/90 hidden md:block font-medium truncate">
                    {settings?.site_subtitle || 'Parque Los Caobos, Caracas'}
                  </p>
                </div>
              </Link>

              {/* Energy Badge for Agrodigital Style */}
              {headerStyle === 'agrodigital_mincyt' && (
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-mono border border-white/10">
                  <Zap size={13} />
                  <span>1 TQ = 1 kWh</span>
                </div>
              )}

              {/* Desktop Navigation Links */}
              <nav className="hidden xl:flex items-center gap-1">
                {pages.map((p) => {
                  const Icon = ICONS[p.icon || 'home'] || Home
                  const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
                  return (
                    <Link
                      key={p.slug}
                      to={`/p/${p.slug}`}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
                        isActive
                          ? 'bg-white/20 text-white shadow-inner border border-white/20 font-bold'
                          : 'text-white/85 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Icon size={14} />
                      {p.title}
                    </Link>
                  )
                })}
              </nav>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {settings?.show_join_form && !isAuthenticated && (
                  <Link
                    to="/p/unirse"
                    className="hidden sm:inline-flex px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold text-white transition shadow hover:brightness-110 active:scale-95 items-center gap-1.5"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    <Sparkles size={13} />
                    Solicitar Unirse
                  </Link>
                )}

                {isAuthenticated ? (
                  <div className="flex items-center gap-1 bg-black/25 p-1 rounded-xl border border-white/10">
                    <Link
                      to="/app/website"
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white hover:bg-white/20 transition flex items-center gap-1"
                      title="Editor modular"
                    >
                      <Edit size={13} />
                      <span className="hidden sm:inline">Editor</span>
                    </Link>
                    <Link
                      to="/app/dashboard"
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-white transition flex items-center gap-1 shadow-sm"
                      style={{ backgroundColor: secondaryColor }}
                    >
                      <LayoutDashboard size={13} />
                      <span className="hidden sm:inline">Escritorio</span>
                    </Link>
                    <button
                      onClick={() => {
                        logout()
                        window.location.href = '/'
                      }}
                      className="p-1 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/10 transition"
                      title="Cerrar sesión"
                    >
                      <LogOut size={13} />
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    className="hidden sm:inline-block px-3 py-1.5 rounded-xl text-xs font-medium text-white/90 hover:text-white hover:bg-white/10 transition"
                  >
                    Iniciar sesión
                  </Link>
                )}

                {/* Mobile / Tablet Menu Button */}
                <button
                  className="xl:hidden text-white p-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="Abrir menú"
                >
                  {menuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* MOBILE / TABLET DRAWER (Universal & Responsive) */}
      {menuOpen && (
        <div className="xl:hidden bg-[#102210] text-white p-4 border-b border-white/10 space-y-3 z-40">
          <div className="grid grid-cols-2 gap-2">
            {pages.map((p) => {
              const Icon = ICONS[p.icon || 'home'] || Home
              const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
              return (
                <Link
                  key={p.slug}
                  to={`/p/${p.slug}`}
                  onClick={() => setMenuOpen(false)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 truncate ${
                    isActive ? 'bg-white/20 text-white font-bold' : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  <span className="truncate">{p.title}</span>
                </Link>
              )
            })}
          </div>

          <div className="pt-3 border-t border-white/10 space-y-2">
            {settings?.show_join_form && !isAuthenticated && (
              <Link
                to="/p/unirse"
                onClick={() => setMenuOpen(false)}
                className="block w-full text-center px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow"
                style={{ backgroundColor: secondaryColor }}
              >
                Solicitar Unirse a la Red
              </Link>
            )}

            {!isAuthenticated && (
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="block text-center px-3 py-2 rounded-xl text-xs text-white/90 hover:bg-white/10"
              >
                Iniciar sesión miembros
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 3. MAIN PAGE CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      {/* 4. RICH FOOTER */}
      <footer className="text-white mt-16 pt-12 pb-8 border-t border-white/10 shadow-2xl" style={{ backgroundColor: '#112211' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-white/10">
            {/* Column 1: Brand & Slogan */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold shadow">
                  <Leaf size={18} />
                </div>
                <h3 className="font-extrabold text-sm tracking-tight text-white">
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
              <h4 className="font-bold text-xs uppercase tracking-wider text-amber-400">
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
              <h4 className="font-bold text-xs uppercase tracking-wider text-amber-400">
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
              <h4 className="font-bold text-xs uppercase tracking-wider text-amber-400">
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
// PUBLIC PAGE VIEW (Handles modular blocks or rich template fallback)
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
        let contentToUse = d.content

        // Check if content is valid JSON blocks
        let isValidJson = false
        try {
          const parsed = JSON.parse(d.content)
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) {
            isValidJson = true
          }
        } catch {
          isValidJson = false
        }

        // If not JSON modular blocks, load rich template for this slug
        if (!isValidJson) {
          const tmpl = FERIA_CONUQUERA_TEMPLATES.find((t) => t.slug === targetSlug)
          if (tmpl) {
            contentToUse = JSON.stringify(tmpl.blocks)
          }
        }

        setPage({ ...d, content: contentToUse })
        setLoading(false)
      })
      .catch(() => {
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
