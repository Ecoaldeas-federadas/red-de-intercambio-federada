import React, { useState, useEffect, useRef } from 'react'
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
  Building2,
  Zap,
  MoreHorizontal,
} from 'lucide-react'
import { PageBlocksRenderer } from './public-site/PublicBlocks'
import { LivePageEditor } from './public-site/LivePageEditor'
import { DynamicAdmissionForm } from './public-site/DynamicAdmissionForm'
import { FERIA_CONUQUERA_TEMPLATES } from './public-site/defaultSiteData'
import { PublicPageData, HeaderStyleType, SiteBlock } from '../types/publicSite'

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
  footer_about?: string
  footer_schedule?: string
}

// Helper to provide concise, clean labels in navigation bars so menus never overflow
function getShortLabel(p: { slug: string; title: string }): string {
  switch (p.slug) {
    case 'inicio':
      return 'Inicio'
    case 'filosofia':
      return 'Historia'
    case 'productos':
      return 'Productos'
    case 'comunidad':
      return 'Comunidad'
    case 'como-funciona':
      return 'Trueque'
    case 'campo-soberano':
      return 'Ecoaldea'
    case 'faq':
      return 'FAQ'
    case 'contacto':
      return 'Contacto'
    default:
      return p.title && p.title.length > 14 ? p.title.slice(0, 12) + '…' : p.title || p.slug
  }
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, username, logout } = useAuth()
  const location = useLocation()
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [pages, setPages] = useState<PublicPageData[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement>(null)

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

  // Close "More" dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const headerStyle = settings?.header_style || 'modern_eco'
  const primaryColor = settings?.primary_color || '#162e16'
  const secondaryColor = settings?.secondary_color || '#c2410c'
  const showAnnouncement = settings?.show_announcement ?? true
  const announcementText =
    settings?.announcement_text ||
    '🗓️ Próximo Encuentro Conuquero: Primer sábado de cada mes en Parque Los Caobos, Caracas | 9:00 AM'

  // Primary visible navigation items (first 5) and extra items in "Más ▾"
  const visiblePages = pages.slice(0, 5)
  const overflowPages = pages.slice(5)

  // Navigation categorization for dropdown style
  const aboutPages = pages.filter((p) => ['inicio', 'filosofia', 'campo-soberano'].includes(p.slug))
  const economyPages = pages.filter((p) => ['productos', 'como-funciona'].includes(p.slug))
  const communityPages = pages.filter((p) => ['comunidad', 'faq', 'contacto'].includes(p.slug))
  const otherPages = pages.filter(
    (p) => !['inicio', 'filosofia', 'campo-soberano', 'productos', 'como-funciona', 'comunidad', 'faq', 'contacto'].includes(p.slug)
  )

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-amber-200 selection:text-amber-950 overflow-x-hidden w-full max-w-full bg-[#fdfbf7]">
      {/* 1. TOP ANNOUNCEMENT BAR */}
      {showAnnouncement && (
        <div
          className="text-white text-[11px] sm:text-xs py-1.5 px-3 sm:px-4 text-center font-medium shadow-xs flex items-center justify-center gap-2 w-full overflow-hidden"
          style={{ backgroundColor: headerStyle === 'fao_institutional' ? '#1b4d3e' : '#0d1f0d' }}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
          <span className="truncate max-w-3xl sm:max-w-4xl">{announcementText}</span>
        </div>
      )}

      {/* 2. DYNAMIC HEADER BY SELECTED STYLE */}

      {/* STYLE A: FAO INSTITUTIONAL / PORTAL BLANCO */}
      {headerStyle === 'fao_institutional' && (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-xs w-full">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-3">
            {/* Brand */}
            <Link to="/p/inicio" className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0 max-w-[200px] sm:max-w-xs md:max-w-sm truncate">
              {settings?.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt="logo"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover border border-emerald-200 shadow-xs flex-shrink-0"
                />
              ) : (
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-extrabold shadow-sm flex-shrink-0">
                  <Building2 size={20} />
                </div>
              )}
              <div className="truncate">
                <h1 className="text-xs sm:text-sm md:text-base font-black tracking-tight text-emerald-950 truncate leading-tight">
                  {settings?.site_title || 'Feria Conuquera Agroecológica'}
                </h1>
                <p className="text-[10px] sm:text-[11px] text-emerald-700 font-semibold hidden md:block truncate">
                  {settings?.site_subtitle || 'Portal Oficial de Soberanía Alimentaria'}
                </p>
              </div>
            </Link>

            {/* Desktop Navigation with Overflow Protection */}
            <nav className="hidden lg:flex items-center gap-1 text-xs font-bold text-gray-700">
              {visiblePages.map((p) => {
                const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
                return (
                  <Link
                    key={p.slug}
                    to={`/p/${p.slug}`}
                    className={`px-2.5 py-1.5 rounded-lg transition ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-900 font-black border-b-2 border-emerald-800'
                        : 'hover:bg-gray-100 hover:text-emerald-800'
                    }`}
                  >
                    {getShortLabel(p)}
                  </Link>
                )
              })}

              {overflowPages.length > 0 && (
                <div className="relative" ref={moreMenuRef}>
                  <button
                    onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                    className="px-2.5 py-1.5 rounded-lg hover:bg-gray-100 hover:text-emerald-800 flex items-center gap-1 text-gray-700"
                  >
                    <span>Más</span>
                    <ChevronDown size={13} />
                  </button>
                  {moreMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5 space-y-0.5 z-50">
                      {overflowPages.map((p) => (
                        <Link
                          key={p.slug}
                          to={`/p/${p.slug}`}
                          onClick={() => setMoreMenuOpen(false)}
                          className="block px-3 py-1.5 rounded-lg text-xs text-gray-700 hover:bg-emerald-50 hover:text-emerald-900"
                        >
                          {p.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {settings?.show_join_form && !isAuthenticated && (
                <Link
                  to="/p/unirse"
                  className="hidden sm:inline-flex px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-700 transition shadow-xs items-center gap-1"
                >
                  <Sparkles size={12} />
                  Ingreso
                </Link>
              )}

              {isAuthenticated ? (
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 sm:p-1 rounded-lg">
                  <Link
                    to="/app/website"
                    className="px-2 py-1 rounded text-[11px] sm:text-xs font-semibold text-gray-800 hover:bg-white"
                  >
                    <Edit size={12} className="inline mr-1" />
                    Editor
                  </Link>
                  <Link
                    to="/app/dashboard"
                    className="px-2 py-1 rounded text-[11px] sm:text-xs font-bold text-white bg-emerald-800"
                  >
                    Escritorio
                  </Link>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="hidden sm:inline-block px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-900 border border-emerald-800 hover:bg-emerald-50"
                >
                  Acceso
                </Link>
              )}

              <button
                className="lg:hidden p-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* STYLE B: EDITORIAL LATAM */}
      {headerStyle === 'editorial_latam' && (
        <header className="sticky top-0 z-50 shadow-md w-full">
          <div className="bg-white border-b border-amber-200/60 py-2.5 px-3 sm:px-6">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
              <Link to="/p/inicio" className="flex items-center gap-2.5 truncate max-w-sm">
                <div className="w-9 h-9 rounded-full bg-amber-700 text-white flex items-center justify-center font-serif text-lg font-bold flex-shrink-0">
                  C
                </div>
                <div className="truncate">
                  <h1 className="text-xs sm:text-sm md:text-base font-black text-amber-950 uppercase tracking-tight font-serif truncate leading-tight">
                    {settings?.site_title || 'Feria Conuquera & Agroecología'}
                  </h1>
                  <p className="text-[10px] text-amber-800 italic hidden sm:block truncate">
                    {settings?.site_subtitle || 'Publicación y Red Comunitaria'}
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="hidden md:inline-block text-[11px] font-serif font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full">
                  🍃 Semillas Libres
                </span>
                {isAuthenticated && (
                  <Link
                    to="/app/website"
                    className="text-xs font-bold bg-amber-800 text-white px-2.5 py-1 rounded-lg shadow-xs"
                  >
                    Editor
                  </Link>
                )}
                <button
                  className="lg:hidden p-1.5 text-amber-950 bg-amber-100 rounded-lg"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  {menuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#1f301d] text-white py-1.5 px-3 sm:px-6 border-b border-black/20">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
              <nav className="hidden lg:flex items-center gap-1 text-[11px] sm:text-xs uppercase font-bold tracking-wider">
                {visiblePages.map((p) => {
                  const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
                  return (
                    <Link
                      key={p.slug}
                      to={`/p/${p.slug}`}
                      className={`px-2.5 py-1 rounded transition ${
                        isActive ? 'bg-amber-600 text-white font-extrabold' : 'text-gray-200 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {getShortLabel(p)}
                    </Link>
                  )
                })}

                {overflowPages.length > 0 && (
                  <div className="relative" ref={moreMenuRef}>
                    <button
                      onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                      className="px-2 py-1 rounded hover:bg-white/10 text-gray-200 hover:text-white flex items-center gap-1"
                    >
                      <span>Más</span>
                      <ChevronDown size={12} />
                    </button>
                    {moreMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-[#1a2818] rounded-xl shadow-xl border border-white/10 p-1.5 space-y-0.5 z-50 text-left normal-case">
                        {overflowPages.map((p) => (
                          <Link
                            key={p.slug}
                            to={`/p/${p.slug}`}
                            onClick={() => setMoreMenuOpen(false)}
                            className="block px-3 py-1.5 rounded-lg text-xs text-gray-200 hover:bg-white/10 hover:text-white"
                          >
                            {p.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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

      {/* STYLE C: DROPDOWN CATEGORIES */}
      {headerStyle === 'dropdown_categories' && (
        <header className="sticky top-0 z-50 shadow-md backdrop-blur-md w-full" style={{ backgroundColor: primaryColor }}>
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-3">
            <Link to="/p/inicio" className="flex items-center gap-2 text-white truncate max-w-xs">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold flex-shrink-0">
                <Leaf size={18} />
              </div>
              <div className="truncate">
                <h1 className="text-xs sm:text-sm md:text-base font-bold truncate leading-tight">
                  {settings?.site_title || 'Feria Conuquera'}
                </h1>
                <p className="text-[10px] text-emerald-200 hidden sm:block truncate">{settings?.site_subtitle}</p>
              </div>
            </Link>

            <nav className="hidden lg:flex items-center gap-1 text-xs font-bold text-white">
              <Link to="/p/inicio" className="px-2.5 py-1.5 rounded-lg hover:bg-white/10">
                Inicio
              </Link>

              {/* Dropdown 1: Sobre la Red */}
              <div className="relative group">
                <button className="px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-1">
                  Sobre la Red <ChevronDown size={13} />
                </button>
                <div className="absolute left-0 top-full hidden group-hover:block bg-white text-gray-900 rounded-xl shadow-xl border border-gray-100 p-1.5 w-48 space-y-0.5 z-50">
                  {aboutPages.map((p) => (
                    <Link
                      key={p.slug}
                      to={`/p/${p.slug}`}
                      className="block px-3 py-1.5 rounded-lg hover:bg-emerald-50 text-xs font-semibold text-gray-800 hover:text-emerald-900"
                    >
                      {p.title}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Dropdown 2: Economía y Cosecha */}
              <div className="relative group">
                <button className="px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-1">
                  Economía & Cosecha <ChevronDown size={13} />
                </button>
                <div className="absolute left-0 top-full hidden group-hover:block bg-white text-gray-900 rounded-xl shadow-xl border border-gray-100 p-1.5 w-52 space-y-0.5 z-50">
                  {economyPages.map((p) => (
                    <Link
                      key={p.slug}
                      to={`/p/${p.slug}`}
                      className="block px-3 py-1.5 rounded-lg hover:bg-emerald-50 text-xs font-semibold text-gray-800 hover:text-emerald-900"
                    >
                      {p.title}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Dropdown 3: Comunidad */}
              <div className="relative group">
                <button className="px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-1">
                  Comunidad & Saberes <ChevronDown size={13} />
                </button>
                <div className="absolute left-0 top-full hidden group-hover:block bg-white text-gray-900 rounded-xl shadow-xl border border-gray-100 p-1.5 w-48 space-y-0.5 z-50">
                  {communityPages.map((p) => (
                    <Link
                      key={p.slug}
                      to={`/p/${p.slug}`}
                      className="block px-3 py-1.5 rounded-lg hover:bg-emerald-50 text-xs font-semibold text-gray-800 hover:text-emerald-900"
                    >
                      {p.title}
                    </Link>
                  ))}
                </div>
              </div>

              {otherPages.map((p) => (
                <Link key={p.slug} to={`/p/${p.slug}`} className="px-2.5 py-1.5 rounded-lg hover:bg-white/10">
                  {getShortLabel(p)}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <Link
                to="/p/unirse"
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow"
                style={{ backgroundColor: secondaryColor }}
              >
                Unirse
              </Link>
              <button
                className="lg:hidden text-white p-1.5"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* STYLE D & DEFAULT: MODERN ECO / ECOVILLAGE */}
      {(headerStyle === 'modern_eco' || headerStyle === 'agrodigital_mincyt') && (
        <header className="shadow-md sticky top-0 z-50 backdrop-blur-md border-b border-white/10 w-full" style={{ backgroundColor: primaryColor }}>
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-3">
            {/* Logo & Brand */}
            <Link to="/p/inicio" className="flex items-center gap-2 sm:gap-2.5 text-white group flex-shrink-0 max-w-[180px] sm:max-w-xs md:max-w-sm truncate">
              {settings?.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt="logo"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border-2 border-amber-400/80 shadow-md group-hover:scale-105 transition flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-amber-500 to-emerald-400 flex items-center justify-center text-white shadow-md group-hover:rotate-6 transition flex-shrink-0">
                  <Leaf size={18} />
                </div>
              )}
              <div className="truncate">
                <h1 className="text-xs sm:text-sm md:text-base font-extrabold tracking-tight leading-tight truncate">
                  {settings?.site_title || 'Feria Conuquera Agroecológica'}
                </h1>
                <p className="text-[10px] sm:text-[11px] text-emerald-200/90 hidden md:block font-medium truncate">
                  {settings?.site_subtitle || 'Parque Los Caobos, Caracas'}
                </p>
              </div>
            </Link>

            {/* Energy Badge for Agrodigital Style */}
            {headerStyle === 'agrodigital_mincyt' && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-amber-300 text-xs font-mono border border-white/10 flex-shrink-0">
                <Zap size={12} />
                <span>1 TQ = 1 kWh</span>
              </div>
            )}

            {/* Desktop Navigation with Overflow Protection */}
            <nav className="hidden lg:flex items-center gap-1">
              {visiblePages.map((p) => {
                const Icon = ICONS[p.icon || 'home'] || Home
                const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
                return (
                  <Link
                    key={p.slug}
                    to={`/p/${p.slug}`}
                    className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 whitespace-nowrap ${
                      isActive
                        ? 'bg-white/20 text-white shadow-inner border border-white/20 font-bold'
                        : 'text-white/85 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon size={13} />
                    {getShortLabel(p)}
                  </Link>
                )
              })}

              {overflowPages.length > 0 && (
                <div className="relative" ref={moreMenuRef}>
                  <button
                    onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                    className="px-2 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 text-white/85 hover:text-white hover:bg-white/10 whitespace-nowrap"
                  >
                    <span>Más</span>
                    <ChevronDown size={13} />
                  </button>
                  {moreMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-[#162e16] text-white rounded-xl shadow-2xl border border-white/15 p-1.5 space-y-0.5 z-50">
                      {overflowPages.map((p) => (
                        <Link
                          key={p.slug}
                          to={`/p/${p.slug}`}
                          onClick={() => setMoreMenuOpen(false)}
                          className="block px-3 py-1.5 rounded-lg text-xs text-white/90 hover:bg-white/15 hover:text-white"
                        >
                          {p.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </nav>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {settings?.show_join_form && !isAuthenticated && (
                <Link
                  to="/p/unirse"
                  className="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-xs font-bold text-white transition shadow hover:brightness-110 active:scale-95 items-center gap-1"
                  style={{ backgroundColor: secondaryColor }}
                >
                  <Sparkles size={12} />
                  Unirse
                </Link>
              )}

              {isAuthenticated ? (
                <div className="flex items-center gap-1 bg-black/25 p-0.5 sm:p-1 rounded-lg border border-white/10">
                  <Link
                    to="/app/website"
                    className="px-2 py-1 rounded text-[11px] sm:text-xs font-semibold text-white hover:bg-white/20 transition flex items-center gap-1"
                    title="Editor modular"
                  >
                    <Edit size={12} />
                    <span className="hidden md:inline">Editor</span>
                  </Link>
                  <Link
                    to="/app/dashboard"
                    className="px-2 py-1 rounded text-[11px] sm:text-xs font-bold text-white transition flex items-center gap-1 shadow-sm"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    <LayoutDashboard size={12} />
                    <span className="hidden md:inline">Escritorio</span>
                  </Link>
                  <button
                    onClick={() => {
                      logout()
                      window.location.href = '/'
                    }}
                    className="p-1 rounded text-xs text-white/80 hover:text-white hover:bg-white/10 transition"
                    title="Cerrar sesión"
                  >
                    <LogOut size={12} />
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="hidden sm:inline-block px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/90 hover:text-white hover:bg-white/10 transition"
                >
                  Entrar
                </Link>
              )}

              {/* Mobile / Tablet Menu Button */}
              <button
                className="lg:hidden text-white p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Abrir menú"
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* MOBILE / TABLET DRAWER */}
      {menuOpen && (
        <div className="lg:hidden bg-[#102210] text-white p-3.5 border-b border-white/10 space-y-2.5 z-40 w-full">
          <div className="grid grid-cols-2 gap-1.5">
            {pages.map((p) => {
              const Icon = ICONS[p.icon || 'home'] || Home
              const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
              return (
                <Link
                  key={p.slug}
                  to={`/p/${p.slug}`}
                  onClick={() => setMenuOpen(false)}
                  className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 truncate ${
                    isActive ? 'bg-white/20 text-white font-bold' : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon size={14} className="flex-shrink-0" />
                  <span className="truncate">{p.title}</span>
                </Link>
              )
            })}
          </div>

          <div className="pt-2 border-t border-white/10 space-y-1.5">
            {settings?.show_join_form && !isAuthenticated && (
              <Link
                to="/p/unirse"
                onClick={() => setMenuOpen(false)}
                className="block w-full text-center px-3 py-2 rounded-lg text-xs font-bold text-white shadow"
                style={{ backgroundColor: secondaryColor }}
              >
                Solicitar Unirse a la Red
              </Link>
            )}

            {!isAuthenticated && (
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="block text-center px-3 py-1.5 rounded-lg text-xs text-white/90 hover:bg-white/10"
              >
                Iniciar sesión miembros
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 3. MAIN PAGE CONTAINER (Guaranteed 100% fluid & responsive) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 box-border overflow-hidden">
        {children}
      </main>

      {/* 4. RICH FOOTER */}
      <footer className="text-white mt-12 sm:mt-16 pt-10 sm:pt-12 pb-8 border-t border-white/10 shadow-2xl w-full overflow-hidden" style={{ backgroundColor: '#112211' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 pb-8 sm:pb-10 border-b border-white/10">
            {/* Column 1: Brand & Slogan */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold shadow">
                  <Leaf size={16} />
                </div>
                <h3 className="font-extrabold text-xs sm:text-sm tracking-tight text-white">
                  {settings?.site_title || 'Feria Conuquera Agroecológica'}
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-300 leading-relaxed">
                {settings?.footer_about || 'Mercado a cielo abierto para todo el público en moneda local, agroecología, trueque y soberanía alimentaria en Caracas desde octubre de 2014.'}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-emerald-300 font-semibold pt-1">
                <ShieldCheck size={14} />
                <span>100% Autogestión & Suelo Vivo</span>
              </div>
            </div>

            {/* Column 2: Quick Links */}
            <div className="space-y-2.5">
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
            <div className="space-y-2.5">
              <h4 className="font-bold text-xs uppercase tracking-wider text-amber-400">
                Lugar de Encuentro
              </h4>
              <div className="text-xs text-gray-300 space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>{settings?.contact_address || 'Parque Los Caobos, Caracas. Zona sur cerca de la Fuente Venezuela.'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>{settings?.footer_schedule || 'Primer sábado de cada mes (9:00 AM a 1:00 PM). Venta en moneda local.'}</span>
                </div>
              </div>
            </div>

            {/* Column 4: Social & Admission */}
            <div className="space-y-2.5">
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
                    <Instagram size={15} className="text-pink-400" />
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
                    <Facebook size={15} className="text-blue-400" />
                    <span>Facebook: Feria Conuquera</span>
                  </a>
                )}
                <div className="pt-1.5">
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
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] sm:text-xs text-gray-400 gap-2 text-center sm:text-left">
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
  const { isAuthenticated } = useAuth()
  const { slug } = useParams<{ slug?: string }>()
  const targetSlug = slug || 'inicio'
  const [page, setPage] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isLiveEditing, setIsLiveEditing] = useState(false)

  const loadPageData = () => {
    setLoading(true)
    api
      .get(`/public/pages/${targetSlug}`)
      .then((d: any) => {
        let contentToUse = d.content

        let isValidJson = false
        try {
          const parsed = JSON.parse(d.content)
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) {
            isValidJson = true
          }
        } catch {
          isValidJson = false
        }

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
  }

  useEffect(() => {
    loadPageData()
    setIsLiveEditing(false)
  }, [targetSlug])

  if (loading) {
    return (
      <div className="text-center py-24 space-y-3">
        <div className="w-10 h-10 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin mx-auto" />
        <p className="text-gray-500 font-medium text-xs">Cargando contenido...</p>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="text-center py-16 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 max-w-lg mx-auto space-y-3">
        <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
          <HelpCircle size={28} />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Página no encontrada</h2>
        <p className="text-xs text-gray-600">La página solicitada no está disponible o ha sido movida.</p>
        <Link
          to="/p/inicio"
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold text-white bg-trueque-700 hover:bg-trueque-800 transition text-xs shadow"
        >
          Volver al Inicio
        </Link>
      </div>
    )
  }

  // Parse blocks for the live editor
  let currentBlocks: SiteBlock[] = []
  try {
    const parsed = JSON.parse(page.content)
    if (Array.isArray(parsed)) currentBlocks = parsed
  } catch {
    currentBlocks = [{ type: 'richtext', title: page.title, content: page.content }]
  }

  return (
    <div className="relative">
      {/* Floating Live Edit Trigger for Logged In Admins */}
      {isAuthenticated && !isLiveEditing && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => setIsLiveEditing(true)}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-900 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-2xl border-2 border-amber-400 active:scale-95 transition-all group"
          >
            <div className="w-6 h-6 rounded-lg bg-amber-400 text-gray-950 flex items-center justify-center group-hover:rotate-12 transition">
              <Sparkles size={14} />
            </div>
            <span>Editar en Vivo Esta Página</span>
          </button>
        </div>
      )}

      {/* When in Live Edit Mode, render the Interactive WYSIWYG Editor */}
      {isLiveEditing ? (
        <LivePageEditor
          pageId={page.id}
          slug={page.slug || targetSlug}
          title={page.title}
          subtitle={page.subtitle}
          icon={page.icon}
          menuOrder={page.menu_order}
          isPublished={page.is_published}
          showInMenu={page.show_in_menu}
          initialBlocks={currentBlocks}
          onExit={() => setIsLiveEditing(false)}
          onSaved={() => {
            loadPageData()
          }}
        />
      ) : (
        /* Normal Clean View */
        <PageBlocksRenderer content={page.content} />
      )}
    </div>
  )
}

// -------------------------------------------------------------
// PUBLIC JOIN FORM (Dynamic Configurable Form Renderer)
// -------------------------------------------------------------
export function PublicJoinForm() {
  return <DynamicAdmissionForm />
}
