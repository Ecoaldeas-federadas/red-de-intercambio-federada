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
  Upload,
  Check,
} from 'lucide-react'
import { PageBlocksRenderer } from './public-site/PublicBlocks'
import { LivePageEditor } from './public-site/LivePageEditor'
import { DynamicAdmissionForm } from './public-site/DynamicAdmissionForm'
import { ThemeCustomizer, ThemeDraft, PageMenuItem } from './public-site/ThemeCustomizer'
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
    case 'semillas':
      return 'Semillas'
    case 'saberes-ancestrales':
      return 'Saberes'
    case 'filosofia-conuquera':
      return 'Filosofía'
    case 'ecoaldeas-mundo':
      return 'Ecoaldeas'
    default:
      return p.title || p.slug
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
  const [showCustomizer, setShowCustomizer] = useState(false)
  const [draftSettings, setDraftSettings] = useState<ThemeDraft | null>(null)
  const [draftPages, setDraftPages] = useState<PageMenuItem[]>([])
  const [showAdminMenu, setShowAdminMenu] = useState(false)

  useEffect(() => {
    api.get('/public/settings').then((s: any) => setSettings(s)).catch(() => {})
    api.get('/public/pages').then((d: any) => {
      if (Array.isArray(d) && d.length > 0) {
        // Merge: keep DB pages, but add any template pages whose slug
        // doesn't exist in the DB yet (so new template pages appear
        // automatically without needing a re-seed or migration).
        const dbSlugs = new Set(d.map((p: any) => p.slug))
        const templateOnly = FERIA_CONUQUERA_TEMPLATES
          .filter((t) => !dbSlugs.has(t.slug))
          .map((t) => ({
            slug: t.slug,
            title: t.title,
            subtitle: t.subtitle,
            icon: t.icon,
            menu_order: t.menu_order,
            is_published: true,
            show_in_menu: true,
            content: JSON.stringify(t.blocks),
          }))
        setPages([...d, ...templateOnly])
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
  const headerSticky = (settings as any)?.header_sticky ?? true
  const headerBannerImage = (settings as any)?.header_banner_image || ''
  const headerBannerHeight = (settings as any)?.header_banner_height || 120
  const headerTransparency = (settings as any)?.header_transparency ?? 25
  const headerTransparencyColor = (settings as any)?.header_transparency_color || '#000000'
  const headerBlur = (settings as any)?.header_blur ?? 4
  const headerBgColor = (settings as any)?.header_bg_color || ''
  const headerTextColor = (settings as any)?.header_text_color || ''
  const primaryColor = headerBgColor || settings?.primary_color || '#162e16'
  const secondaryColor = settings?.secondary_color || '#c2410c'
  const headerTextColorResolved = headerTextColor || (settings as any)?.text_color || '#1a1a1a'
  const stickyClass = headerSticky ? 'sticky top-0' : ''
  const showAnnouncement = settings?.show_announcement ?? true
  const announcementText =
    settings?.announcement_text ||
    '🗓️ Próximo Encuentro Conuquero: Primer sábado de cada mes en Parque Los Caobos, Caracas | 9:00 AM'

  // Primary visible navigation items (first 5) and extra items in "Más ▾"
  // Filter out pages hidden from menu, then sort by menu_order
  const menuPages = pages
    .filter((p) => p.show_in_menu !== false)
    .sort((a, b) => (a.menu_order || 0) - (b.menu_order || 0))
  // Show menu items; "Más" appears when there are too many to fit.
  // Different headers have different space constraints.
  const maxVisibleByStyle: Record<string, number> = {
    modern_eco: 7,
    agrodigital_mincyt: 7,
    fao_institutional: 8,
    editorial_latam: 8,
    dropdown_categories: 10, // uses dropdowns so takes less space
    compact: 8,
    banner: 8,
    sidebar_left: 20, // vertical, plenty of space
    split_center: 10, // split in half
    minimal_underline: 8,
    hero_overlay: 7,
    sticky_pill: 6, // pill is compact
  }
  const maxVisible = maxVisibleByStyle[headerStyle] ?? 8
  const visiblePages = menuPages.slice(0, maxVisible)
  const overflowPages = menuPages.slice(maxVisible)

  // Navigation categorization for dropdown style (use menu-visible pages only)
  const aboutPages = menuPages.filter((p) => ['inicio', 'filosofia', 'filosofia-conuquera', 'campo-soberano'].includes(p.slug))
  const economyPages = menuPages.filter((p) => ['productos', 'como-funciona'].includes(p.slug))
  const communityPages = menuPages.filter((p) => ['comunidad', 'faq', 'contacto', 'semillas', 'saberes-ancestrales', 'ecoaldeas-mundo'].includes(p.slug))
  const otherPages = menuPages.filter(
    (p) => !['inicio', 'filosofia', 'filosofia-conuquera', 'campo-soberano', 'productos', 'como-funciona', 'comunidad', 'faq', 'contacto', 'semillas', 'saberes-ancestrales', 'ecoaldeas-mundo'].includes(p.slug)
  )

  // Hierarchical menu: top-level pages and their children (for dropdown_categories)
  const hasHierarchy = pages.some((p) => (p as any).parent_slug)
  const hierarchicalTop = menuPages.filter((p) => !(p as any).parent_slug)
  const hierarchicalChildren = (parentSlug: string) =>
    pages.filter((p) => (p as any).parent_slug === parentSlug && p.show_in_menu !== false)

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-amber-200 selection:text-amber-950 w-full max-w-full" style={{ backgroundColor: (settings as any)?.page_bg_color || '#fdfbf7' }}>
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

      {/* STYLE A: TARJETAS CON ICONOS — cada item del menu es una tarjeta con icono */}
      {headerStyle === 'fao_institutional' && (
        <header className={`${stickyClass} z-50 shadow-md w-full`} style={{ backgroundColor: (settings as any)?.page_bg_color || '#f8faf5' }}>
          {/* Top bar: logo + actions */}
          <div className="border-b-2" style={{ borderColor: primaryColor }}>
            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
              <Link to="/p/inicio" className="flex items-center gap-2.5 flex-shrink-0 max-w-xs truncate">
                {settings?.logo_url ? (
                  <img src={settings.logo_url} alt="logo" className="w-10 h-10 rounded-xl object-cover shadow-sm flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-sm flex-shrink-0" style={{ backgroundColor: primaryColor }}>
                    <Leaf size={20} />
                  </div>
                )}
                <div className="truncate">
                  <h1 className="text-sm sm:text-base font-black tracking-tight truncate leading-tight" style={{ color: (settings as any)?.text_color || '#1a1a1a' }}>
                    {settings?.site_title || 'Feria Conuquera Agroecológica'}
                  </h1>
                  <p className="text-[10px] sm:text-[11px] font-semibold hidden sm:block truncate" style={{ color: (settings as any)?.link_color || '#15803d' }}>
                    {settings?.site_subtitle || 'Soberanía Alimentaria'}
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                {settings?.show_join_form && !isAuthenticated && (
                  <Link to="/p/unirse" className="hidden sm:inline-flex px-4 py-2 rounded-lg text-xs font-bold text-white shadow transition hover:opacity-90 items-center gap-1" style={{ backgroundColor: secondaryColor }}>
                    <Sparkles size={12} />
                    Ingreso
                  </Link>
                )}
                {isAuthenticated ? (
                  <Link to="/app/dashboard" className="px-3 py-2 rounded-lg text-xs font-bold text-white shadow" style={{ backgroundColor: primaryColor }}>
                    Escritorio
                  </Link>
                ) : (
                  <Link to="/login" className="hidden sm:inline-block px-3 py-2 rounded-lg text-xs font-bold border-2 transition hover:bg-gray-50" style={{ color: primaryColor, borderColor: primaryColor }}>
                    Acceso
                  </Link>
                )}
                <button className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100" style={{ color: (settings as any)?.text_color || '#1a1a1a' }} onClick={() => setMenuOpen(!menuOpen)}>
                  {menuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
              </div>
            </div>
          </div>

          {/* Menu as cards with icons */}
          <div className="max-w-7xl mx-auto px-2 sm:px-4 hidden lg:block">
            <nav className="flex items-center gap-1.5 py-1.5 flex-wrap">
              {visiblePages.map((p) => {
                const Icon = ICONS[p.icon || 'home'] || Home
                const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
                return (
                  <Link
                    key={p.slug}
                    to={`/p/${p.slug}`}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap border-2 ${
                      isActive ? 'text-white shadow-md' : 'border-transparent hover:shadow-sm'
                    }`}
                    style={isActive
                      ? { backgroundColor: primaryColor, borderColor: primaryColor, color: '#fff' }
                      : { color: (settings as any)?.text_color || '#1a1a1a', backgroundColor: (settings as any)?.module_bg_color || '#ffffff', borderColor: 'rgba(0,0,0,0.06)' }
                    }
                  >
                    <Icon size={15} className="flex-shrink-0" />
                    {getShortLabel(p)}
                  </Link>
                )
              })}
              {overflowPages.length > 0 && (
                <div className="relative" ref={moreMenuRef}>
                  <button onClick={() => setMoreMenuOpen(!moreMenuOpen)} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold border-2 border-transparent hover:shadow-sm" style={{ color: (settings as any)?.text_color || '#1a1a1a', backgroundColor: (settings as any)?.module_bg_color || '#ffffff' }}>
                    <span>Más</span><ChevronDown size={13} />
                  </button>
                  {moreMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 rounded-xl shadow-xl border p-1.5 space-y-0.5 z-50" style={{ backgroundColor: (settings as any)?.module_bg_color || '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}>
                      {overflowPages.map((p) => (
                        <Link key={p.slug} to={`/p/${p.slug}`} onClick={() => setMoreMenuOpen(false)} className="block px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-100" style={{ color: (settings as any)?.text_color || '#1a1a1a' }}>
                          {p.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </nav>
          </div>
        </header>
      )}

      {/* STYLE B: EDITORIAL LATAM */}
      {headerStyle === 'editorial_latam' && (
        <header className={`${stickyClass} z-50 shadow-md w-full`}>
          <div className="bg-white border-b border-amber-200/60 py-2.5 px-3 sm:px-6">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
              <Link to="/p/inicio" className="flex items-center gap-2.5 truncate max-w-sm">
                {settings?.logo_url ? (
                  <img src={settings.logo_url} alt="logo" className="w-9 h-9 rounded-full object-cover border border-amber-300 shadow-sm flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-amber-700 text-white flex items-center justify-center font-serif text-lg font-bold flex-shrink-0">
                    <Leaf size={18} />
                  </div>
                )}
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
        <header className={`${stickyClass} z-50 shadow-md backdrop-blur-md w-full`} style={{ backgroundColor: primaryColor }}>
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-3">
            <Link to="/p/inicio" className="flex items-center gap-2 text-white truncate max-w-xs">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="logo" className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-white/30 shadow flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Leaf size={18} />
                </div>
              )}
              <div className="truncate">
                <h1 className="text-xs sm:text-sm md:text-base font-bold truncate leading-tight">
                  {settings?.site_title || 'Feria Conuquera'}
                </h1>
                <p className="text-[10px] text-emerald-200 hidden sm:block truncate">{settings?.site_subtitle}</p>
              </div>
            </Link>

            <nav className="hidden lg:flex items-center gap-1 text-xs font-bold text-white">
              {hasHierarchy ? (
                // Hierarchical mode: use parent_slug from page settings
                hierarchicalTop.map((parent) => {
                  const children = hierarchicalChildren(parent.slug)
                  if (children.length === 0) {
                    // No children: show as direct link
                    return (
                      <Link key={parent.slug} to={`/p/${parent.slug}`} className="px-2.5 py-1.5 rounded-lg hover:bg-white/10">
                        {getShortLabel(parent)}
                      </Link>
                    )
                  }
                  // Has children: show as dropdown
                  return (
                    <div key={parent.slug} className="relative group">
                      <button className="px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-1">
                        {getShortLabel(parent)} <ChevronDown size={13} />
                      </button>
                      <div className="absolute left-0 top-full hidden group-hover:block bg-white text-gray-900 rounded-xl shadow-xl border border-gray-100 p-1.5 w-52 space-y-0.5 z-50">
                        {children.map((child) => (
                          <Link
                            key={child.slug}
                            to={`/p/${child.slug}`}
                            className="block px-3 py-1.5 rounded-lg hover:bg-emerald-50 text-xs font-semibold text-gray-800 hover:text-emerald-900"
                          >
                            {child.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )
                })
              ) : (
                // Fallback: hardcoded categories
                <>
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
                </>
              )}
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

      {/* STYLE E: COMPACT — Logo grande centrado, menú debajo horizontal */}
      {headerStyle === 'compact' && (
        <header className={`${stickyClass} z-50 shadow-md w-full`} style={{ backgroundColor: (settings as any)?.page_bg_color || '#f8faf5' }}>
          {/* Top row: centered logo */}
          <div className="border-b" style={{ borderColor: ((settings as any)?.module_bg_color || '#ffffff') }}>
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col items-center justify-center gap-1">
              <Link to="/p/inicio" className="flex flex-col items-center gap-1.5 text-center">
                {settings?.logo_url ? (
                  <img
                    src={settings.logo_url}
                    alt="logo"
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover shadow-md border-2 flex-shrink-0"
                    style={{ borderColor: secondaryColor }}
                  />
                ) : (
                  <div
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Leaf size={28} />
                  </div>
                )}
                <div className="text-center">
                  <h1
                    className="text-sm sm:text-lg font-black tracking-tight leading-tight"
                    style={{ color: (settings as any)?.text_color || '#1a1a1a' }}
                  >
                    {settings?.site_title || 'Feria Conuquera Agroecológica'}
                  </h1>
                  <p
                    className="text-[10px] sm:text-[11px] font-medium hidden sm:block"
                    style={{ color: (settings as any)?.link_color || '#15803d' }}
                  >
                    {settings?.site_subtitle || 'Parque Los Caobos, Caracas'}
                  </p>
                </div>
              </Link>
            </div>
          </div>

          {/* Bottom row: horizontal menu bar */}
          <div style={{ backgroundColor: primaryColor }}>
            <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-center gap-0.5 py-1.5">
              <nav className="hidden lg:flex items-center gap-0.5 text-xs font-bold text-white">
                {visiblePages.map((p) => {
                  const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
                  return (
                    <Link
                      key={p.slug}
                      to={`/p/${p.slug}`}
                      className={`px-3 py-1.5 rounded-md transition whitespace-nowrap ${
                        isActive ? 'bg-white/25 font-black' : 'hover:bg-white/15'
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
                      className="px-3 py-1.5 rounded-md hover:bg-white/15 flex items-center gap-1 whitespace-nowrap"
                    >
                      <span>Más</span>
                      <ChevronDown size={12} />
                    </button>
                    {moreMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 w-44 rounded-xl shadow-xl border p-1.5 space-y-0.5 z-50" style={{ backgroundColor: primaryColor, borderColor: 'rgba(255,255,255,0.2)' }}>
                        {overflowPages.map((p) => (
                          <Link
                            key={p.slug}
                            to={`/p/${p.slug}`}
                            onClick={() => setMoreMenuOpen(false)}
                            className="block px-3 py-1.5 rounded-lg text-xs text-white/90 hover:bg-white/15"
                          >
                            {p.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </nav>
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

      {/* STYLE F: BANNER — Imagen de fondo, logo superpuesto, menú inferior translúcido */}
      {headerStyle === 'banner' && (
        <header className={`${stickyClass} z-50 w-full shadow-lg`}>
          {/* Banner with background image */}
          <div
            className="relative w-full overflow-hidden"
            style={{
              backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.55)), url(${headerBannerImage || 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80'})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: primaryColor,
              minHeight: `${headerBannerHeight}px`,
            }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between gap-3 relative z-10">
              {/* Logo + brand overlaid on image */}
              <Link to="/p/inicio" className="flex items-center gap-3 text-white group flex-shrink-0 max-w-xs sm:max-w-md truncate">
                {settings?.logo_url ? (
                  <img
                    src={settings.logo_url}
                    alt="logo"
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border-2 border-white/60 shadow-lg flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-lg border border-white/30 flex-shrink-0">
                    <Leaf size={26} />
                  </div>
                )}
                <div className="truncate">
                  <h1 className="text-sm sm:text-xl font-black tracking-tight leading-tight truncate drop-shadow-lg">
                    {settings?.site_title || 'Feria Conuquera Agroecológica'}
                  </h1>
                  <p className="text-[11px] sm:text-xs text-white/80 font-medium hidden sm:block truncate drop-shadow">
                    {settings?.site_subtitle || 'Parque Los Caobos, Caracas'}
                  </p>
                </div>
              </Link>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {settings?.show_join_form && !isAuthenticated && (
                  <Link
                    to="/p/unirse"
                    className="hidden sm:inline-flex px-4 py-2 rounded-lg text-xs font-bold text-white shadow-lg transition hover:brightness-110 items-center gap-1"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    <Sparkles size={12} />
                    Unirse
                  </Link>
                )}
                {isAuthenticated ? (
                  <Link
                    to="/app/dashboard"
                    className="px-3 py-2 rounded-lg text-xs font-bold text-white shadow-lg"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    Escritorio
                  </Link>
                ) : (
                  <Link
                    to="/login"
                    className="hidden sm:inline-block px-3 py-2 rounded-lg text-xs font-medium text-white border border-white/40 hover:bg-white/10 transition"
                  >
                    Acceso
                  </Link>
                )}
                <button
                  className="lg:hidden text-white p-1.5 bg-white/15 rounded-lg"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  {menuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
              </div>
            </div>
          </div>

          {/* Menu bar at bottom of banner - translucent */}
          <div className="w-full backdrop-blur-md" style={{ backgroundColor: primaryColor }}>
            <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-center py-1.5">
              <nav className="hidden lg:flex items-center gap-1 text-xs font-bold text-white">
                {visiblePages.map((p) => {
                  const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
                  return (
                    <Link
                      key={p.slug}
                      to={`/p/${p.slug}`}
                      className={`px-3 py-1.5 rounded-md transition whitespace-nowrap ${
                        isActive ? 'bg-white/25 font-black' : 'hover:bg-white/15'
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
                      className="px-3 py-1.5 rounded-md hover:bg-white/15 flex items-center gap-1 whitespace-nowrap"
                    >
                      <span>Más</span>
                      <ChevronDown size={12} />
                    </button>
                    {moreMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 w-44 rounded-xl shadow-xl border p-1.5 space-y-0.5 z-50" style={{ backgroundColor: primaryColor, borderColor: 'rgba(255,255,255,0.2)' }}>
                        {overflowPages.map((p) => (
                          <Link
                            key={p.slug}
                            to={`/p/${p.slug}`}
                            onClick={() => setMoreMenuOpen(false)}
                            className="block px-3 py-1.5 rounded-lg text-xs text-white/90 hover:bg-white/15"
                          >
                            {p.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </nav>
            </div>
          </div>
        </header>
      )}

      {/* STYLE G: SIDEBAR LEFT — Menu vertical fijo a la izquierda */}
      {headerStyle === 'sidebar_left' && (
        <header className={`${headerSticky ? 'fixed' : 'absolute'} left-0 top-0 bottom-0 w-56 z-50 flex flex-col shadow-xl`} style={{ backgroundColor: primaryColor }}>
          {/* Logo top */}
          <div className="p-4 border-b border-white/10 flex-shrink-0">
            <Link to="/p/inicio" className="flex flex-col items-center gap-2 text-white text-center">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="logo" className="w-12 h-12 rounded-xl object-cover border-2 border-white/40 shadow flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-white flex-shrink-0">
                  <Leaf size={24} />
                </div>
              )}
              <h1 className="text-xs font-black leading-tight">{settings?.site_title || 'Feria Conuquera'}</h1>
              <p className="text-[9px] text-white/60 hidden sm:block">{settings?.site_subtitle}</p>
            </Link>
          </div>

          {/* Vertical menu */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 hidden lg:block">
            {menuPages.map((p) => {
              const Icon = ICONS[p.icon || 'home'] || Home
              const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
              return (
                <Link
                  key={p.slug}
                  to={`/p/${p.slug}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                    isActive ? 'bg-white/20 text-white font-bold' : 'text-white/75 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  <span className="truncate">{p.title}</span>
                </Link>
              )
            })}
          </nav>

          {/* Bottom actions */}
          <div className="p-3 border-t border-white/10 space-y-2 flex-shrink-0 hidden lg:block">
            {settings?.show_join_form && !isAuthenticated && (
              <Link to="/p/unirse" className="block w-full text-center px-3 py-2 rounded-lg text-xs font-bold text-white shadow" style={{ backgroundColor: secondaryColor }}>
                Unirse
              </Link>
            )}
            {!isAuthenticated ? (
              <Link to="/login" className="block w-full text-center px-3 py-1.5 rounded-lg text-xs text-white/80 hover:bg-white/10 border border-white/20">
                Acceso
              </Link>
            ) : (
              <Link to="/app/dashboard" className="block w-full text-center px-3 py-2 rounded-lg text-xs font-bold text-white shadow" style={{ backgroundColor: secondaryColor }}>
                Escritorio
              </Link>
            )}
          </div>

          {/* Mobile button */}
          <button className="lg:hidden text-white p-3 self-end" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>
      )}

      {/* STYLE H: SPLIT CENTER — Logo centrado, menu dividido a lados */}
      {headerStyle === 'split_center' && (
        <header className={`${stickyClass} z-50 shadow-md w-full`} style={{ backgroundColor: primaryColor }}>
          <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between gap-2 py-2">
            {/* Left menu */}
            <nav className="hidden lg:flex items-center gap-1 text-xs font-bold text-white flex-1 justify-end">
              {menuPages.slice(0, Math.ceil(menuPages.length / 2)).map((p) => {
                const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
                return (
                  <Link key={p.slug} to={`/p/${p.slug}`} className={`px-3 py-1.5 rounded-md transition whitespace-nowrap ${isActive ? 'bg-white/25 font-black' : 'hover:bg-white/15'}`}>
                    {getShortLabel(p)}
                  </Link>
                )
              })}
            </nav>

            {/* Center logo */}
            <Link to="/p/inicio" className="flex flex-col items-center gap-1 text-white flex-shrink-0 px-4">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="logo" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-white/50 shadow flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Leaf size={22} />
                </div>
              )}
              <h1 className="text-[10px] sm:text-xs font-black leading-tight text-center max-w-[180px] sm:max-w-[220px]">{settings?.site_title || 'Feria Conuquera'}</h1>
            </Link>

            {/* Right menu */}
            <nav className="hidden lg:flex items-center gap-1 text-xs font-bold text-white flex-1">
              {menuPages.slice(Math.ceil(menuPages.length / 2)).map((p) => {
                const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
                return (
                  <Link key={p.slug} to={`/p/${p.slug}`} className={`px-3 py-1.5 rounded-md transition whitespace-nowrap ${isActive ? 'bg-white/25 font-black' : 'hover:bg-white/15'}`}>
                    {getShortLabel(p)}
                  </Link>
                )
              })}
              {settings?.show_join_form && !isAuthenticated && (
                <Link to="/p/unirse" className="ml-2 px-3 py-1.5 rounded-md text-xs font-bold text-white shadow" style={{ backgroundColor: secondaryColor }}>
                  Unirse
                </Link>
              )}
            </nav>

            <button className="lg:hidden text-white p-1.5" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </header>
      )}

      {/* STYLE I: MINIMAL UNDERLINE — Sin fondo, solo texto con subrayado */}
      {headerStyle === 'minimal_underline' && (
        <header className={`${stickyClass} z-50 w-full bg-white/95 backdrop-blur-md border-b border-gray-100`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 py-3">
            <Link to="/p/inicio" className="flex items-center gap-2 flex-shrink-0">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="logo" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: primaryColor }}>
                  <Leaf size={16} />
                </div>
              )}
              <h1 className="text-sm font-bold tracking-tight hidden sm:block" style={{ color: (settings as any)?.text_color || '#1a1a1a' }}>
                {settings?.site_title || 'Feria Conuquera'}
              </h1>
            </Link>

            <nav className="hidden lg:flex items-center gap-5 text-sm font-medium" style={{ color: (settings as any)?.text_color || '#1a1a1a' }}>
              {menuPages.map((p) => {
                const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
                return (
                  <Link
                    key={p.slug}
                    to={`/p/${p.slug}`}
                    className={`relative py-1 transition hover:opacity-80 group whitespace-nowrap ${isActive ? 'font-bold' : ''}`}
                    style={isActive ? { color: primaryColor } : {}}
                  >
                    {getShortLabel(p)}
                    <span
                      className="absolute left-0 bottom-0 h-0.5 transition-all duration-300 group-hover:w-full"
                      style={{ width: isActive ? '100%' : '0%', backgroundColor: primaryColor }}
                    />
                  </Link>
                )
              })}
            </nav>

            <div className="flex items-center gap-2 flex-shrink-0">
              {settings?.show_join_form && !isAuthenticated && (
                <Link to="/p/unirse" className="hidden sm:inline-block px-4 py-1.5 rounded-full text-xs font-bold text-white transition hover:opacity-90" style={{ backgroundColor: primaryColor }}>
                  Unirse
                </Link>
              )}
              <button className="lg:hidden p-1.5" style={{ color: (settings as any)?.text_color || '#1a1a1a' }} onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* STYLE J: HERO OVERLAY — Menu transparente superpuesto, se vuelve solido al scroll */}
      {headerStyle === 'hero_overlay' && (
        <header className={`${headerSticky ? 'fixed' : 'absolute'} top-0 left-0 right-0 z-50 w-full transition-all duration-300`} style={{ backgroundColor: `${headerTransparencyColor}${Math.round(headerTransparency * 2.55).toString(16).padStart(2, '0')}`, backdropFilter: `blur(${headerBlur}px)` }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3 py-3">
            <Link to="/p/inicio" className="flex items-center gap-2.5 text-white flex-shrink-0 max-w-xs truncate">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="logo" className="w-10 h-10 rounded-lg object-cover border border-white/30 shadow flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center text-white flex-shrink-0">
                  <Leaf size={20} />
                </div>
              )}
              <div className="truncate">
                <h1 className="text-sm font-black tracking-tight truncate drop-shadow">{settings?.site_title || 'Feria Conuquera'}</h1>
                <p className="text-[10px] text-white/70 hidden sm:block truncate">{settings?.site_subtitle}</p>
              </div>
            </Link>

            <nav className="hidden lg:flex items-center gap-1 text-sm font-semibold text-white">
              {visiblePages.map((p) => {
                const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
                return (
                  <Link key={p.slug} to={`/p/${p.slug}`} className={`px-3 py-1.5 rounded-md transition whitespace-nowrap ${isActive ? 'bg-white/25 font-bold' : 'hover:bg-white/15'}`}>
                    {getShortLabel(p)}
                  </Link>
                )
              })}
              {overflowPages.length > 0 && (
                <div className="relative" ref={moreMenuRef}>
                  <button onClick={() => setMoreMenuOpen(!moreMenuOpen)} className="px-3 py-1.5 rounded-md hover:bg-white/15 flex items-center gap-1 whitespace-nowrap">
                    <span>Más</span><ChevronDown size={12} />
                  </button>
                  {moreMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-44 rounded-xl shadow-xl border border-white/20 p-1.5 space-y-0.5 z-50" style={{ backgroundColor: primaryColor }}>
                      {overflowPages.map((p) => (
                        <Link key={p.slug} to={`/p/${p.slug}`} onClick={() => setMoreMenuOpen(false)} className="block px-3 py-1.5 rounded-lg text-xs text-white/90 hover:bg-white/15">
                          {p.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </nav>

            <div className="flex items-center gap-2 flex-shrink-0">
              {settings?.show_join_form && !isAuthenticated && (
                <Link to="/p/unirse" className="hidden sm:inline-flex px-4 py-1.5 rounded-full text-xs font-bold text-white shadow transition hover:opacity-90" style={{ backgroundColor: secondaryColor }}>
                  Unirse
                </Link>
              )}
              <button className="lg:hidden text-white p-1.5" onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* STYLE K: STICKY PILL — Pildora flotante centrada */}
      {headerStyle === 'sticky_pill' && (
        <div className={`${headerSticky ? 'sticky top-3' : 'relative'} z-50 w-full px-4 flex justify-center`}>
          <header className="bg-white rounded-full shadow-lg border border-gray-200/60 flex items-center gap-2 px-3 sm:px-4 py-2 max-w-5xl w-full overflow-hidden">
            <Link to="/p/inicio" className="flex items-center gap-2 flex-shrink-0 min-w-0">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="logo" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: primaryColor }}>
                  <Leaf size={16} />
                </div>
              )}
              <h1 className="text-xs font-bold hidden sm:block truncate max-w-[120px]" style={{ color: (settings as any)?.text_color || '#1a1a1a' }}>
                {settings?.site_title || 'Feria Conuquera'}
              </h1>
            </Link>

            <nav className="hidden lg:flex items-center gap-0.5 text-xs font-semibold flex-1 min-w-0 justify-center overflow-hidden" style={{ color: (settings as any)?.text_color || '#1a1a1a' }}>
              {visiblePages.map((p) => {
                const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
                return (
                  <Link
                    key={p.slug}
                    to={`/p/${p.slug}`}
                    className={`px-3 py-1.5 rounded-full transition whitespace-nowrap ${isActive ? 'text-white font-bold' : 'hover:bg-gray-100'}`}
                    style={isActive ? { backgroundColor: primaryColor, color: '#fff' } : {}}
                  >
                    {getShortLabel(p)}
                  </Link>
                )
              })}
              {overflowPages.length > 0 && (
                <div className="relative" ref={moreMenuRef}>
                  <button onClick={() => setMoreMenuOpen(!moreMenuOpen)} className="px-3 py-1.5 rounded-full hover:bg-gray-100 flex items-center gap-1 whitespace-nowrap">
                    <span>Más</span><ChevronDown size={12} />
                  </button>
                  {moreMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-2xl shadow-xl border border-gray-200 p-1.5 space-y-0.5 z-50">
                      {overflowPages.map((p) => (
                        <Link key={p.slug} to={`/p/${p.slug}`} onClick={() => setMoreMenuOpen(false)} className="block px-3 py-1.5 rounded-lg text-xs hover:bg-gray-100" style={{ color: (settings as any)?.text_color || '#1a1a1a' }}>
                          {p.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </nav>

            <div className="flex items-center gap-2 flex-shrink-0">
              {settings?.show_join_form && !isAuthenticated && (
                <Link to="/p/unirse" className="hidden sm:inline-flex px-4 py-1.5 rounded-full text-xs font-bold text-white shadow transition hover:opacity-90" style={{ backgroundColor: secondaryColor }}>
                  Unirse
                </Link>
              )}
              <button className="lg:hidden p-1.5 rounded-full hover:bg-gray-100" style={{ color: (settings as any)?.text_color || '#1a1a1a' }} onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </header>
        </div>
      )}

      {/* STYLE D & DEFAULT: MODERN ECO / ECOVILLAGE */}
      {(headerStyle === 'modern_eco' || headerStyle === 'agrodigital_mincyt') && (
        <header className={`shadow-md ${stickyClass} z-50 backdrop-blur-md border-b border-white/10 w-full`} style={{ backgroundColor: primaryColor }}>
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

      {/* MOBILE / TABLET DRAWER — style-specific */}
      {/* Overlay clickable para cerrar menús móviles sin overlay propio */}
      {menuOpen && !['sidebar_left', 'hero_overlay', 'sticky_pill'].includes(headerStyle) && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setMenuOpen(false)} />
      )}
      {menuOpen && (

        /* === MOBILE: MODERN ECO / AGRODIGITAL === */
        (headerStyle === 'modern_eco' || headerStyle === 'agrodigital_mincyt') && (
        <div className="lg:hidden text-white p-3.5 border-b border-white/10 space-y-2.5 z-40 w-full" style={{ backgroundColor: primaryColor }}>
          <div className="grid grid-cols-2 gap-1.5">
            {menuPages.map((p) => {
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
              <Link to="/p/unirse" onClick={() => setMenuOpen(false)} className="block w-full text-center px-3 py-2 rounded-lg text-xs font-bold text-white shadow" style={{ backgroundColor: secondaryColor }}>
                Solicitar Unirse a la Red
              </Link>
            )}
            {!isAuthenticated && (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="block text-center px-3 py-1.5 rounded-lg text-xs text-white/90 hover:bg-white/10">
                Iniciar sesión miembros
              </Link>
            )}
          </div>
        </div>
        )

      )}

      {menuOpen && headerStyle === 'fao_institutional' && (
        /* === MOBILE: PORTAL BLANCO — lista formal sobre blanco === */
        <div className="lg:hidden bg-white border-b border-gray-200 p-3 space-y-1 z-40 w-full shadow-md">
          {menuPages.map((p) => {
            const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
            return (
              <Link
                key={p.slug}
                to={`/p/${p.slug}`}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-bold transition ${
                  isActive ? 'border-l-4 pl-2' : 'hover:bg-gray-100'
                }`}
                style={isActive ? { color: primaryColor, borderLeftColor: primaryColor, backgroundColor: ((settings as any)?.module_bg_color || '#f0fdf4') } : { color: (settings as any)?.text_color || '#1a1a1a' }}
              >
                {p.title}
              </Link>
            )
          })}
          <div className="pt-2 border-t border-gray-200 space-y-1.5">
            {settings?.show_join_form && !isAuthenticated && (
              <Link to="/p/unirse" onClick={() => setMenuOpen(false)} className="block w-full text-center px-3 py-2 rounded-lg text-xs font-bold text-white shadow" style={{ backgroundColor: primaryColor }}>
                Solicitar Ingreso
              </Link>
            )}
            {!isAuthenticated && (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="block text-center px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ color: primaryColor, borderColor: primaryColor }}>
                Acceso Miembros
              </Link>
            )}
          </div>
        </div>
      )}

      {menuOpen && headerStyle === 'editorial_latam' && (
        /* === MOBILE: EDITORIAL — fondo oscuro, serif, mayúsculas === */
        <div className="lg:hidden text-white p-4 space-y-1 z-40 w-full" style={{ backgroundColor: '#1f301d' }}>
          <p className="text-[10px] uppercase tracking-widest text-amber-400 font-serif font-bold mb-2">Secciones</p>
          {menuPages.map((p) => {
            const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
            return (
              <Link
                key={p.slug}
                to={`/p/${p.slug}`}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm uppercase font-bold tracking-wider transition font-serif ${
                  isActive ? 'bg-amber-600 text-white' : 'text-gray-200 hover:text-white hover:bg-white/10'
                }`}
              >
                {p.title}
              </Link>
            )
          })}
          <div className="pt-2 border-t border-white/10 space-y-1.5">
            {settings?.show_join_form && !isAuthenticated && (
              <Link to="/p/unirse" onClick={() => setMenuOpen(false)} className="block w-full text-center px-3 py-2 rounded-lg text-xs font-bold text-white bg-amber-700">
                Solicitar Admisión →
              </Link>
            )}
            {!isAuthenticated && (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="block text-center px-3 py-1.5 rounded-lg text-xs text-amber-300 hover:bg-white/10">
                Iniciar sesión miembros
              </Link>
            )}
          </div>
        </div>
      )}

      {menuOpen && headerStyle === 'dropdown_categories' && (
        /* === MOBILE: MEGA MENU — agrupado por categorías === */
        <div className="lg:hidden text-white p-4 space-y-3 z-40 w-full" style={{ backgroundColor: primaryColor }}>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold mb-1.5">Sobre la Red</p>
            <div className="space-y-0.5">
              {aboutPages.map((p) => (
                <Link key={p.slug} to={`/p/${p.slug}`} onClick={() => setMenuOpen(false)} className="block px-3 py-1.5 rounded-lg text-sm hover:bg-white/10">
                  {p.title}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold mb-1.5">Economía & Cosecha</p>
            <div className="space-y-0.5">
              {economyPages.map((p) => (
                <Link key={p.slug} to={`/p/${p.slug}`} onClick={() => setMenuOpen(false)} className="block px-3 py-1.5 rounded-lg text-sm hover:bg-white/10">
                  {p.title}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold mb-1.5">Comunidad & Saberes</p>
            <div className="space-y-0.5">
              {communityPages.map((p) => (
                <Link key={p.slug} to={`/p/${p.slug}`} onClick={() => setMenuOpen(false)} className="block px-3 py-1.5 rounded-lg text-sm hover:bg-white/10">
                  {p.title}
                </Link>
              ))}
            </div>
          </div>
          {otherPages.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold mb-1.5">Otros</p>
              <div className="space-y-0.5">
                {otherPages.map((p) => (
                  <Link key={p.slug} to={`/p/${p.slug}`} onClick={() => setMenuOpen(false)} className="block px-3 py-1.5 rounded-lg text-sm hover:bg-white/10">
                    {p.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="pt-2 border-t border-white/10 space-y-1.5">
            {settings?.show_join_form && !isAuthenticated && (
              <Link to="/p/unirse" onClick={() => setMenuOpen(false)} className="block w-full text-center px-3 py-2 rounded-lg text-xs font-bold text-white shadow" style={{ backgroundColor: secondaryColor }}>
                Unirse a la Red
              </Link>
            )}
            {!isAuthenticated && (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="block text-center px-3 py-1.5 rounded-lg text-xs text-white/90 hover:bg-white/10">
                Iniciar sesión miembros
              </Link>
            )}
          </div>
        </div>
      )}

      {menuOpen && headerStyle === 'compact' && (
        /* === MOBILE: LOGO CENTRADO — lista centrada sobre fondo claro === */
        <div className="lg:hidden p-4 space-y-1 z-40 w-full border-b" style={{ backgroundColor: (settings as any)?.page_bg_color || '#f8faf5', borderColor: ((settings as any)?.module_bg_color || '#e5e7eb') }}>
          {menuPages.map((p) => {
            const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
            return (
              <Link
                key={p.slug}
                to={`/p/${p.slug}`}
                onClick={() => setMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-lg text-center text-sm font-bold transition ${
                  isActive ? 'text-white shadow' : 'hover:bg-gray-100'
                }`}
                style={isActive ? { backgroundColor: primaryColor, color: '#fff' } : { color: (settings as any)?.text_color || '#1a1a1a' }}
              >
                {p.title}
              </Link>
            )
          })}
          <div className="pt-2 border-t space-y-1.5" style={{ borderColor: ((settings as any)?.module_bg_color || '#e5e7eb') }}>
            {settings?.show_join_form && !isAuthenticated && (
              <Link to="/p/unirse" onClick={() => setMenuOpen(false)} className="block w-full text-center px-3 py-2 rounded-lg text-xs font-bold text-white shadow" style={{ backgroundColor: secondaryColor }}>
                Unirse a la Red
              </Link>
            )}
            {!isAuthenticated && (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="block text-center px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ color: primaryColor, borderColor: primaryColor }}>
                Acceso Miembros
              </Link>
            )}
          </div>
        </div>
      )}

      {menuOpen && headerStyle === 'banner' && (
        /* === MOBILE: BANNER — overlay oscuro con imagen de fondo === */
        <div
          className="lg:hidden text-white p-4 space-y-1 z-40 w-full"
          style={{
            backgroundColor: primaryColor,
            backgroundImage: 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url(https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {menuPages.map((p) => {
            const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
            return (
              <Link
                key={p.slug}
                to={`/p/${p.slug}`}
                onClick={() => setMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-lg text-sm font-bold transition ${
                  isActive ? 'bg-white/25' : 'hover:bg-white/15'
                }`}
              >
                {p.title}
              </Link>
            )
          })}
          <div className="pt-2 border-t border-white/20 space-y-1.5">
            {settings?.show_join_form && !isAuthenticated && (
              <Link to="/p/unirse" onClick={() => setMenuOpen(false)} className="block w-full text-center px-3 py-2 rounded-lg text-xs font-bold text-white shadow" style={{ backgroundColor: secondaryColor }}>
                Unirse a la Red
              </Link>
            )}
            {!isAuthenticated && (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="block text-center px-3 py-1.5 rounded-lg text-xs text-white/90 hover:bg-white/10 border border-white/30">
                Acceso Miembros
              </Link>
            )}
          </div>
        </div>
      )}

      {menuOpen && headerStyle === 'sidebar_left' && (
        /* === MOBILE: SIDEBAR LEFT — panel deslizable desde la izquierda === */
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 h-full text-white p-4 space-y-1 overflow-y-auto" style={{ backgroundColor: primaryColor }}>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
              <span className="text-sm font-black">{settings?.site_title || 'Feria Conuquera'}</span>
              <button onClick={() => setMenuOpen(false)} className="text-white/80 hover:text-white"><X size={18} /></button>
            </div>
            {menuPages.map((p) => {
              const Icon = ICONS[p.icon || 'home'] || Home
              const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
              return (
                <Link key={p.slug} to={`/p/${p.slug}`} onClick={() => setMenuOpen(false)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${isActive ? 'bg-white/20 font-bold' : 'hover:bg-white/10'}`}>
                  <Icon size={16} /><span className="truncate">{p.title}</span>
                </Link>
              )
            })}
            <div className="pt-3 border-t border-white/10 space-y-2">
              {settings?.show_join_form && !isAuthenticated && (
                <Link to="/p/unirse" onClick={() => setMenuOpen(false)} className="block w-full text-center px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ backgroundColor: secondaryColor }}>Unirse</Link>
              )}
              {!isAuthenticated && (
                <Link to="/login" onClick={() => setMenuOpen(false)} className="block w-full text-center px-3 py-1.5 rounded-lg text-xs text-white/80 border border-white/20">Acceso</Link>
              )}
            </div>
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      {menuOpen && headerStyle === 'split_center' && (
        /* === MOBILE: SPLIT CENTER — lista simple sobre color primario === */
        <div className="lg:hidden text-white p-4 space-y-1 z-40 w-full" style={{ backgroundColor: primaryColor }}>
          {menuPages.map((p) => {
            const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
            return (
              <Link key={p.slug} to={`/p/${p.slug}`} onClick={() => setMenuOpen(false)} className={`block px-4 py-2.5 rounded-lg text-sm font-bold text-center transition ${isActive ? 'bg-white/25' : 'hover:bg-white/15'}`}>
                {p.title}
              </Link>
            )
          })}
          <div className="pt-2 border-t border-white/10 space-y-1.5">
            {settings?.show_join_form && !isAuthenticated && (
              <Link to="/p/unirse" onClick={() => setMenuOpen(false)} className="block w-full text-center px-3 py-2 rounded-lg text-xs font-bold text-white shadow" style={{ backgroundColor: secondaryColor }}>Unirse</Link>
            )}
            {!isAuthenticated && (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="block text-center px-3 py-1.5 rounded-lg text-xs text-white/90 hover:bg-white/10">Acceso Miembros</Link>
            )}
          </div>
        </div>
      )}

      {menuOpen && headerStyle === 'minimal_underline' && (
        /* === MOBILE: MINIMAL UNDERLINE — lista limpia sobre blanco === */
        <div className="lg:hidden bg-white border-b border-gray-100 p-3 space-y-0.5 z-40 w-full shadow-md">
          {menuPages.map((p) => {
            const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
            return (
              <Link key={p.slug} to={`/p/${p.slug}`} onClick={() => setMenuOpen(false)} className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition ${isActive ? 'font-bold' : 'hover:bg-gray-100'}`} style={isActive ? { color: primaryColor } : { color: (settings as any)?.text_color || '#1a1a1a' }}>
                {p.title}
              </Link>
            )
          })}
          <div className="pt-2 border-t border-gray-100 space-y-1.5">
            {settings?.show_join_form && !isAuthenticated && (
              <Link to="/p/unirse" onClick={() => setMenuOpen(false)} className="block w-full text-center px-3 py-2 rounded-full text-xs font-bold text-white" style={{ backgroundColor: primaryColor }}>Unirse</Link>
            )}
            {!isAuthenticated && (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="block text-center px-3 py-1.5 rounded-full text-xs font-medium border" style={{ color: primaryColor, borderColor: primaryColor }}>Acceso</Link>
            )}
          </div>
        </div>
      )}

      {menuOpen && headerStyle === 'hero_overlay' && (
        /* === MOBILE: HERO OVERLAY — overlay oscuro translucido === */
        <div className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <span className="text-white font-black text-sm">{settings?.site_title || 'Feria Conuquera'}</span>
            <button onClick={() => setMenuOpen(false)} className="text-white p-1.5 bg-white/10 rounded-lg"><X size={18} /></button>
          </div>
          <div className="space-y-1 flex-1">
            {menuPages.map((p) => {
              const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
              return (
                <Link key={p.slug} to={`/p/${p.slug}`} onClick={() => setMenuOpen(false)} className={`block px-4 py-3 rounded-xl text-base font-bold transition ${isActive ? 'bg-white/25 text-white' : 'text-white/80 hover:bg-white/10'}`}>
                  {p.title}
                </Link>
              )
            })}
          </div>
          <div className="pt-3 border-t border-white/10 space-y-2">
            {settings?.show_join_form && !isAuthenticated && (
              <Link to="/p/unirse" onClick={() => setMenuOpen(false)} className="block w-full text-center px-3 py-2.5 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: secondaryColor }}>Unirse a la Red</Link>
            )}
            {!isAuthenticated && (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="block w-full text-center px-3 py-2 rounded-xl text-sm text-white/90 border border-white/30">Acceso Miembros</Link>
            )}
          </div>
        </div>
      )}

      {menuOpen && headerStyle === 'sticky_pill' && (
        /* === MOBILE: STICKY PILL — panel redondeado flotante === */
        <div className="lg:hidden fixed inset-0 z-50 bg-black/30 p-4 flex items-start justify-center" onClick={() => setMenuOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl p-4 w-full max-w-sm mt-16 space-y-1" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
              <span className="text-sm font-bold" style={{ color: (settings as any)?.text_color || '#1a1a1a' }}>Menu</span>
              <button onClick={() => setMenuOpen(false)} className="p-1.5 rounded-full hover:bg-gray-100"><X size={18} /></button>
            </div>
            {menuPages.map((p) => {
              const isActive = location.pathname === `/p/${p.slug}` || (location.pathname === '/' && p.slug === 'inicio')
              return (
                <Link key={p.slug} to={`/p/${p.slug}`} onClick={() => setMenuOpen(false)} className={`block px-4 py-2.5 rounded-full text-sm font-semibold transition ${isActive ? 'text-white font-bold' : 'hover:bg-gray-100'}`} style={isActive ? { backgroundColor: primaryColor, color: '#fff' } : { color: (settings as any)?.text_color || '#1a1a1a' }}>
                  {p.title}
                </Link>
              )
            })}
            <div className="pt-3 border-t border-gray-100 space-y-2">
              {settings?.show_join_form && !isAuthenticated && (
                <Link to="/p/unirse" onClick={() => setMenuOpen(false)} className="block w-full text-center px-3 py-2 rounded-full text-xs font-bold text-white" style={{ backgroundColor: secondaryColor }}>Unirse</Link>
              )}
              {!isAuthenticated && (
                <Link to="/login" onClick={() => setMenuOpen(false)} className="block w-full text-center px-3 py-1.5 rounded-full text-xs font-medium border" style={{ color: primaryColor, borderColor: primaryColor }}>Acceso</Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN PAGE CONTAINER (Guaranteed 100% fluid & responsive) */}
      <main className={`flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 box-border ${headerStyle === 'sidebar_left' ? 'lg:ml-56' : ''}`}>
        {children}
      </main>

      {/* 4. RICH FOOTER */}
      <footer className="text-white mt-12 sm:mt-16 pt-10 sm:pt-12 pb-8 border-t border-white/10 shadow-2xl w-full overflow-hidden" style={{ backgroundColor: settings?.footer_bg_color || '#112211' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 pb-8 sm:pb-10 border-b border-white/10">
            {/* Column 1: Brand & Slogan */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                {settings?.logo_url ? (
                  <img src={settings.logo_url} alt="logo" className="w-7 h-7 rounded-full object-cover shadow" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold shadow">
                    <Leaf size={16} />
                  </div>
                )}
                {settings?.footer_col1_title && (
                  <h3 className="font-extrabold text-xs sm:text-sm tracking-tight text-white">
                    {settings.footer_col1_title}
                  </h3>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-gray-300 leading-relaxed">
                {settings?.footer_about || 'Mercado a cielo abierto para todo el público en moneda local, agroecología, trueque y soberanía alimentaria en Caracas desde octubre de 2014.'}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-emerald-300 font-semibold pt-1">
                <ShieldCheck size={14} />
                <span>{settings?.footer_slogan || '100% Autogestión & Suelo Vivo'}</span>
              </div>
            </div>

            {/* Column 2: Quick Links */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-xs uppercase tracking-wider text-amber-400">
                {settings?.footer_col2_title || 'Páginas del Nodo'}
              </h4>
              <ul className="space-y-1.5 text-xs text-gray-300">
                {pages.filter((p) => p.show_in_menu !== false).slice(0, 6).map((p) => (
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
                {settings?.footer_col3_title || 'Lugar de Encuentro'}
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
                {settings?.footer_col4_title || 'Comunidad & Redes'}
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
                    <span>Facebook: {settings.social_facebook}</span>
                  </a>
                )}
                <div className="pt-1.5">
                  <Link
                    to="/p/unirse"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition"
                  >
                    <span>{settings?.footer_admission_text || 'Llenar Solicitud de Ingreso'}</span>
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

      {/* SINGLE FLOATING BUTTON: Admin actions (expands to show options) */}
      {isAuthenticated && (
        <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
          {showAdminMenu && (
            <>
              <button
                onClick={() => {
                  window.dispatchEvent(new Event('start-live-edit'))
                  setShowAdminMenu(false)
                }}
                className="bg-emerald-900 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold transition border-2 border-amber-400"
              >
                <Sparkles size={16} className="text-amber-400" />
                Editar en Vivo Esta Página
              </button>
              <button
                onClick={() => {
                  setDraftSettings({
                    site_title: settings?.site_title || '',
                    site_subtitle: settings?.site_subtitle || '',
                    logo_url: settings?.logo_url || '',
                    primary_color: settings?.primary_color || '#162e16',
                    secondary_color: settings?.secondary_color || '#c2410c',
                    text_color: (settings as any)?.text_color || '#1a1a1a',
                    button_hover_color: (settings as any)?.button_hover_color || '#15803d',
                    module_bg_color: (settings as any)?.module_bg_color || '#ffffff',
                    page_bg_color: (settings as any)?.page_bg_color || '#f8faf5',
                    footer_bg_color: (settings as any)?.footer_bg_color || '#112211',
                    link_color: (settings as any)?.link_color || '#15803d',
                    link_visited_color: (settings as any)?.link_visited_color || '#6b21a8',
                    header_style: settings?.header_style || 'modern_eco',
                    contact_address: settings?.contact_address || '',
                    social_instagram: settings?.social_instagram || '',
                    social_facebook: settings?.social_facebook || '',
                    footer_about: settings?.footer_about || '',
                    footer_schedule: settings?.footer_schedule || '',
                    footer_col1_title: (settings as any)?.footer_col1_title || '',
                    footer_col2_title: (settings as any)?.footer_col2_title || 'Páginas del Nodo',
                    footer_col3_title: (settings as any)?.footer_col3_title || 'Lugar de Encuentro',
                    footer_col4_title: (settings as any)?.footer_col4_title || 'Comunidad & Redes',
                    footer_slogan: (settings as any)?.footer_slogan || '100% Autogestión & Suelo Vivo',
                    footer_admission_text: (settings as any)?.footer_admission_text || 'Llenar Solicitud de Ingreso',
                    header_sticky: (settings as any)?.header_sticky ?? true,
                    header_banner_image: (settings as any)?.header_banner_image || '',
                    header_banner_height: (settings as any)?.header_banner_height || 120,
                    header_transparency: (settings as any)?.header_transparency ?? 25,
                    header_transparency_color: (settings as any)?.header_transparency_color || '#000000',
                    header_blur: (settings as any)?.header_blur ?? 4,
                    header_bg_color: (settings as any)?.header_bg_color || '',
                    header_text_color: (settings as any)?.header_text_color || '',
                  })
                  setDraftPages(pages.map((p) => ({
                    slug: p.slug,
                    title: p.title,
                    icon: p.icon,
                    menu_order: p.menu_order || 0,
                    show_in_menu: p.show_in_menu ?? true,
                    is_published: p.is_published ?? true,
                  })))
                  setShowAdminMenu(false)
                  setShowCustomizer(true)
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold transition"
              >
                <Sparkles size={16} />
                Personalizar Tema
              </button>
              <Link
                to="/app/website"
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold transition"
                onClick={() => setShowAdminMenu(false)}
              >
                <LayoutDashboard size={16} />
                Panel Web
              </Link>
            </>
          )}
          <button
            onClick={() => setShowAdminMenu(!showAdminMenu)}
            className="bg-gray-900 hover:bg-gray-800 text-white w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition"
            title="Opciones de administración"
          >
            {showAdminMenu ? <X size={22} /> : <Edit size={22} />}
          </button>
        </div>
      )}

      {/* THEME CUSTOMIZER PANEL */}
      <ThemeCustomizer
        open={showCustomizer}
        onClose={() => {
          // Revert to original settings
          api.get('/public/settings').then((s: any) => setSettings(s)).catch(() => {})
          api.get('/public/pages').then((d: any) => {
            if (Array.isArray(d)) setPages(d)
          }).catch(() => {})
          setShowCustomizer(false)
        }}
        initialSettings={draftSettings || {
          site_title: '', site_subtitle: '', logo_url: '',
          primary_color: '#162e16', secondary_color: '#c2410c',
          text_color: '#1a1a1a', button_hover_color: '#15803d',
          module_bg_color: '#ffffff', page_bg_color: '#f8faf5',
          footer_bg_color: '#112211', link_color: '#15803d', link_visited_color: '#6b21a8',
          header_style: 'modern_eco', contact_address: '',
          social_instagram: '', social_facebook: '',
          footer_about: '', footer_schedule: '',
          footer_col1_title: '', footer_col2_title: 'Páginas del Nodo',
          footer_col3_title: 'Lugar de Encuentro', footer_col4_title: 'Comunidad & Redes',
          footer_slogan: '100% Autogestión & Suelo Vivo',
          footer_admission_text: 'Llenar Solicitud de Ingreso',
          header_sticky: true, header_banner_image: '',
          header_banner_height: 120, header_transparency: 25,
          header_transparency_color: '#000000', header_blur: 4,
          header_bg_color: '', header_text_color: '',
        }}
        initialPages={draftPages}
        onDraftChange={(newDraft, newPages) => {
          // Apply draft to settings for live preview (colors, header style, etc.)
          setSettings((prev) => ({ ...prev, ...newDraft } as any))
          // Apply draft page order for live menu preview — but ONLY update
          // menu_order and show_in_menu, preserving all other page data
          // (content, id, subtitle, etc.) and preserving any pages that
          // are not in the draft (e.g. merged template pages).
          setPages((prev) => {
            // Build a map of draft pages by slug for quick lookup
            const draftMap = new Map(newPages.map((dp) => [dp.slug, dp]))
            // For each existing page, apply draft changes if present
            return prev.map((p) => {
              const dp = draftMap.get(p.slug)
              if (!dp) return p // keep pages not in draft unchanged
              return { ...p, menu_order: dp.menu_order, show_in_menu: dp.show_in_menu }
            })
          })
        }}
        onSave={async (newSettings, newPages) => {
          await api.put('/site/settings', newSettings)
          for (const page of newPages) {
            const existing = pages.find((p) => p.slug === page.slug)
            if (existing && existing.id) {
              await api.put(`/site/pages/${existing.id}`, {
                ...existing,
                menu_order: page.menu_order,
                show_in_menu: page.show_in_menu,
              }).catch(() => {})
            }
          }
          await api.get('/public/settings').then((s: any) => setSettings(s))
          await api.get('/public/pages').then((d: any) => {
            if (Array.isArray(d)) setPages(d)
          })
        }}
      />
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

  // Listen for "start live edit" event from the consolidated admin button in PublicLayout
  useEffect(() => {
    const handleStartLiveEdit = () => setIsLiveEditing(true)
    window.addEventListener('start-live-edit', handleStartLiveEdit)
    return () => window.removeEventListener('start-live-edit', handleStartLiveEdit)
  }, [])

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
