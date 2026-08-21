import { useState, useEffect, useRef } from 'react'
import { api } from '../../api'
import {
  X, Check, Upload, Eye, EyeOff, ChevronUp, ChevronDown,
  Palette, Layout, Menu as MenuIcon, Image as ImageIcon,
  RotateCcw, Save, Sparkles,
} from 'lucide-react'
import { HEADER_STYLES } from './headerStyles'

export interface ThemeDraft {
  site_title: string
  site_subtitle: string
  logo_url: string
  primary_color: string
  secondary_color: string
  text_color: string
  button_hover_color: string
  module_bg_color: string
  page_bg_color: string
  footer_bg_color: string
  link_color: string
  link_visited_color: string
  header_style: string
  contact_address: string
  social_instagram: string
  social_facebook: string
  footer_about: string
  footer_schedule: string
  footer_col1_title: string
  footer_col2_title: string
  footer_col3_title: string
  footer_col4_title: string
  footer_slogan: string
  footer_admission_text: string
  // Per-header settings
  header_sticky: boolean
  header_banner_image: string
  header_banner_height: number
  header_transparency: number
  header_transparency_color: string
  header_blur: number
  // Banner carousel
  header_banner_images: string   // comma-separated URLs for carousel
  header_banner_duration: number // seconds per image
  header_banner_transition: string // fade, slide, zoom
  // Header colors (empty = use theme palette)
  header_bg_color: string
  header_text_color: string
  header_active_color: string       // color of active/selected menu item text
  header_active_bg_color: string    // background of active/selected menu item
  header_hover_color: string        // background on hover
  // For dual-row headers (editorial_latam)
  header_top_bg_color: string       // top row background
  header_top_text_color: string     // top row text
  header_bottom_bg_color: string    // bottom row background
  header_bottom_text_color: string  // bottom row text
}

export interface PageMenuItem {
  id?: string
  slug: string
  title: string
  icon?: string
  menu_order: number
  show_in_menu: boolean
  is_published: boolean
  parent_slug?: string | null
}

interface ColorPreset {
  name: string
  primary_color: string
  secondary_color: string
  text_color: string
  button_hover_color: string
  module_bg_color: string
  page_bg_color: string
  footer_bg_color: string
  link_color: string
  link_visited_color: string
}

const COLOR_PRESETS: ColorPreset[] = [
  {
    name: 'Verde Comunitario',
    primary_color: '#162e16', secondary_color: '#c2410c',
    text_color: '#1a1a1a', button_hover_color: '#15803d',
    module_bg_color: '#ffffff', page_bg_color: '#f8faf5',
    footer_bg_color: '#112211', link_color: '#15803d', link_visited_color: '#6b21a8',
  },
  {
    name: 'Tierra Barlovento',
    primary_color: '#7c2d12', secondary_color: '#15803d',
    text_color: '#1a1a1a', button_hover_color: '#92400e',
    module_bg_color: '#fefce8', page_bg_color: '#fef9c3',
    footer_bg_color: '#451a03', link_color: '#92400e', link_visited_color: '#6b21a8',
  },
  {
    name: 'Caribe Azul',
    primary_color: '#0c4a6e', secondary_color: '#c2410c',
    text_color: '#1a1a1a', button_hover_color: '#0284c7',
    module_bg_color: '#ffffff', page_bg_color: '#f0f9ff',
    footer_bg_color: '#082f49', link_color: '#0284c7', link_visited_color: '#6b21a8',
  },
  {
    name: 'Sol Andino',
    primary_color: '#92400e', secondary_color: '#166534',
    text_color: '#1a1a1a', button_hover_color: '#b45309',
    module_bg_color: '#fffbeb', page_bg_color: '#fef3c7',
    footer_bg_color: '#451a03', link_color: '#b45309', link_visited_color: '#6b21a8',
  },
  {
    name: 'Bosque Húmedo',
    primary_color: '#14532d', secondary_color: '#a16207',
    text_color: '#1a1a1a', button_hover_color: '#166534',
    module_bg_color: '#f0fdf4', page_bg_color: '#ecfdf5',
    footer_bg_color: '#052e16', link_color: '#166534', link_visited_color: '#6b21a8',
  },
  {
    name: 'Aurora',
    primary_color: '#581c87', secondary_color: '#0e7490',
    text_color: '#1a1a1a', button_hover_color: '#7e22ce',
    module_bg_color: '#faf5ff', page_bg_color: '#f3e8ff',
    footer_bg_color: '#3b0764', link_color: '#7e22ce', link_visited_color: '#6b21a8',
  },
]

function matchesPreset(d: ThemeDraft, p: ColorPreset): boolean {
  return d.primary_color === p.primary_color &&
    d.secondary_color === p.secondary_color &&
    d.text_color === p.text_color &&
    d.button_hover_color === p.button_hover_color &&
    d.module_bg_color === p.module_bg_color &&
    d.page_bg_color === p.page_bg_color &&
    d.footer_bg_color === p.footer_bg_color
}

// --- Custom palette storage (localStorage) ---
const CUSTOM_PALETTES_KEY = 'feria_custom_palettes'

function loadCustomPalettes(): ColorPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PALETTES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    return []
  } catch {
    return []
  }
}

function saveCustomPalettes(palettes: ColorPreset[]) {
  try {
    localStorage.setItem(CUSTOM_PALETTES_KEY, JSON.stringify(palettes))
  } catch {
    // ignore
  }
}

export function ThemeCustomizer({
  open,
  onClose,
  initialSettings,
  initialPages,
  onDraftChange,
  onSave,
}: {
  open: boolean
  onClose: () => void
  initialSettings: ThemeDraft
  initialPages: PageMenuItem[]
  onDraftChange: (settings: ThemeDraft, pages: PageMenuItem[]) => void
  onSave: (settings: ThemeDraft, pages: PageMenuItem[]) => Promise<void>
}) {
  const [draft, setDraft] = useState<ThemeDraft>(initialSettings)
  const [draftPages, setDraftPages] = useState<PageMenuItem[]>(initialPages)
  const [activeTab, setActiveTab] = useState<'cabecera' | 'menu' | 'colores' | 'footer'>('cabecera')
  const [menuMode, setMenuMode] = useState<'plano' | 'jerarquico'>('plano')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Custom palettes (persisted in localStorage)
  const [customPalettes, setCustomPalettes] = useState<ColorPreset[]>([])
  const [newPaletteName, setNewPaletteName] = useState('')
  const [showSavePalette, setShowSavePalette] = useState(false)

  useEffect(() => {
    setCustomPalettes(loadCustomPalettes())
  }, [])

  // Panel position and minimization state
  const [minimized, setMinimized] = useState(false)
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 })

  const handleDragStart = (e: React.MouseEvent) => {
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, posX: panelPos.x, posY: panelPos.y }
  }

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      setPanelPos({ x: dragStart.current.posX + dx, y: dragStart.current.posY + dy })
    }
    const handleUp = () => setDragging(false)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging])

  // Reset draft when opening
  useEffect(() => {
    if (open) {
      setDraft({ ...initialSettings })
      setDraftPages([...initialPages])
    }
  }, [open])

  // Notify parent of every draft change for live preview
  useEffect(() => {
    if (open) {
      onDraftChange(draft, draftPages)
    }
  }, [draft, draftPages, open])

  if (!open) return null

  const handleLogoUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const token = localStorage.getItem('fmc_token')
      const res = await fetch('/api/uploads/image', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setDraft({ ...draft, logo_url: data.url })
    } catch {
      alert('No se pudo subir el logo')
    }
  }

  const movePage = (idx: number, dir: 'up' | 'down') => {
    const newPages = [...draftPages]
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= newPages.length) return
    const tmp = newPages[idx]
    newPages[idx] = newPages[target]
    newPages[target] = tmp
    // Reassign menu_order based on new position, creating new objects to avoid mutation
    const reordered = newPages.map((p, i) => ({ ...p, menu_order: i }))
    setDraftPages(reordered)
  }

  const toggleMenuVisible = (idx: number) => {
    const newPages = [...draftPages]
    newPages[idx] = { ...newPages[idx], show_in_menu: !newPages[idx].show_in_menu }
    setDraftPages(newPages)
  }

  // === Hierarchical menu functions ===

  // Top-level pages (no parent)
  const topLevelPages = draftPages.filter((p) => !p.parent_slug)
  // Children of a given parent slug
  const childrenOf = (parentSlug: string) => draftPages.filter((p) => p.parent_slug === parentSlug)

  // Move a page to be a top-level item (remove from any parent)
  const makeTopLevel = (slug: string) => {
    setDraftPages(draftPages.map((p) => p.slug === slug ? { ...p, parent_slug: null } : p))
  }

  // Move a page to be a child of a parent
  const makeChild = (slug: string, parentSlug: string) => {
    if (slug === parentSlug) return // can't be child of itself
    // Check for circular reference
    let parent = draftPages.find((p) => p.slug === parentSlug)
    while (parent) {
      if (parent.slug === slug) return // would create a cycle
      parent = draftPages.find((p) => p.slug === parent?.parent_slug)
    }
    setDraftPages(draftPages.map((p) => p.slug === slug ? { ...p, parent_slug: parentSlug } : p))
  }

  // Move a top-level page up/down
  const moveTopLevel = (slug: string, dir: 'up' | 'down') => {
    const tops = topLevelPages
    const idx = tops.findIndex((p) => p.slug === slug)
    if (idx < 0) return
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= tops.length) return
    // Swap menu_order between the two top-level items
    const slugA = tops[idx].slug
    const slugB = tops[target].slug
    const orderA = tops[idx].menu_order
    const orderB = tops[target].menu_order
    setDraftPages(draftPages.map((p) => {
      if (p.slug === slugA) return { ...p, menu_order: orderB }
      if (p.slug === slugB) return { ...p, menu_order: orderA }
      return p
    }))
  }

  // Move a child page up/down within its parent
  const moveChild = (slug: string, parentSlug: string, dir: 'up' | 'down') => {
    const siblings = childrenOf(parentSlug)
    const idx = siblings.findIndex((p) => p.slug === slug)
    if (idx < 0) return
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= siblings.length) return
    const slugA = siblings[idx].slug
    const slugB = siblings[target].slug
    const orderA = siblings[idx].menu_order
    const orderB = siblings[target].menu_order
    setDraftPages(draftPages.map((p) => {
      if (p.slug === slugA) return { ...p, menu_order: orderB }
      if (p.slug === slugB) return { ...p, menu_order: orderA }
      return p
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(draft, draftPages)
      onClose()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar')
    }
    setSaving(false)
  }

  const handleReset = () => {
    setDraft({ ...initialSettings })
    setDraftPages([...initialPages])
  }

  const allPresets = [...COLOR_PRESETS, ...customPalettes]
  const activePreset = allPresets.find((p) => matchesPreset(draft, p))

  const handleSavePalette = () => {
    const name = newPaletteName.trim()
    if (!name) return
    const newPalette: ColorPreset = {
      name,
      primary_color: draft.primary_color,
      secondary_color: draft.secondary_color,
      text_color: draft.text_color,
      button_hover_color: draft.button_hover_color,
      module_bg_color: draft.module_bg_color,
      page_bg_color: draft.page_bg_color,
      footer_bg_color: draft.footer_bg_color,
      link_color: draft.link_color,
      link_visited_color: draft.link_visited_color,
    }
    // Replace if name already exists
    const filtered = customPalettes.filter((p) => p.name !== name)
    const updated = [...filtered, newPalette]
    setCustomPalettes(updated)
    saveCustomPalettes(updated)
    setNewPaletteName('')
    setShowSavePalette(false)
  }

  const handleDeletePalette = (name: string) => {
    const updated = customPalettes.filter((p) => p.name !== name)
    setCustomPalettes(updated)
    saveCustomPalettes(updated)
  }

  return (
    <div
      className="fixed z-50 bg-white shadow-2xl border border-gray-200 flex flex-col rounded-lg overflow-hidden"
      style={{
        top: 0,
        left: 0,
        width: minimized ? 'auto' : '100%',
        maxWidth: minimized ? '200px' : '420px',
        height: minimized ? 'auto' : '100vh',
        transform: `translate(${panelPos.x}px, ${panelPos.y}px)`,
        cursor: dragging ? 'grabbing' : 'default',
      }}
    >
      {/* Header - draggable */}
      <div
        className="p-4 bg-gradient-to-r from-emerald-900 to-emerald-800 text-white flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-amber-400" />
          <div>
            <h3 className="font-extrabold text-sm">Personalizador del Tema</h3>
            <p className="text-[10px] text-emerald-200">Arrastra para mover · Ves cambios en vivo</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized(!minimized)}
            className="p-1 text-gray-300 hover:text-white rounded-lg transition"
            title={minimized ? 'Expandir' : 'Minimizar'}
          >
            {minimized ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
          <button onClick={onClose} className="p-1 text-gray-300 hover:text-white rounded-lg transition" title="Cerrar">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Minimized view - just show expand hint */}
      {minimized && (
        <div className="p-3 bg-emerald-50 text-center">
          <p className="text-xs text-emerald-700 font-medium">Panel minimizado</p>
          <button
            onClick={() => setMinimized(false)}
            className="mt-1 text-[10px] text-emerald-600 hover:text-emerald-800 font-bold underline"
          >
            Expandir para editar
          </button>
        </div>
      )}

      {/* Full view */}
      {!minimized && (
        <>
      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {[
          { id: 'cabecera', label: 'Cabecera', icon: Layout },
          { id: 'menu', label: 'Menú', icon: MenuIcon },
          { id: 'colores', label: 'Colores', icon: Palette },
          { id: 'footer', label: 'Pie', icon: ImageIcon },
        ].map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 px-2 py-2.5 text-[11px] font-bold flex flex-col items-center gap-0.5 transition ${
                activeTab === tab.id
                  ? 'bg-white text-emerald-800 border-b-2 border-emerald-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* TAB: CABECERA */}
        {activeTab === 'cabecera' && (
          <div className="space-y-4">
            <div>
              <label className="label text-xs font-bold">Logo del nodo</label>
              <p className="text-[10px] text-gray-400 mb-2">El mismo logo aparece en cabecera y pie de página.</p>
              <div className="flex items-center gap-3">
                {draft.logo_url && (
                  <img src={draft.logo_url} alt="logo" className="w-14 h-14 rounded-lg object-cover border border-gray-200" />
                )}
                <div className="flex-1 space-y-2">
                  <input
                    className="input text-xs"
                    placeholder="URL del logo..."
                    value={draft.logo_url}
                    onChange={(e) => setDraft({ ...draft, logo_url: e.target.value })}
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold hover:bg-emerald-200 transition cursor-pointer border border-emerald-300">
                    <Upload size={14} />
                    Subir desde PC
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleLogoUpload(f)
                    }} />
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="label text-xs font-bold">Título del nodo</label>
              <input className="input text-xs" value={draft.site_title} onChange={(e) => setDraft({ ...draft, site_title: e.target.value })} />
            </div>
            <div>
              <label className="label text-xs font-bold">Subtítulo</label>
              <input className="input text-xs" value={draft.site_subtitle} onChange={(e) => setDraft({ ...draft, site_subtitle: e.target.value })} />
            </div>

            <div>
              <label className="label text-xs font-bold">Tipo de cabecera (vista previa en vivo)</label>
              <div className="space-y-2">
                {HEADER_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setDraft({ ...draft, header_style: style.id })}
                    className={`w-full text-left p-3 rounded-xl border-2 transition ${
                      draft.header_style === style.id
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-gray-900">{style.name}</p>
                        <p className="text-[10px] text-gray-500">{style.description}</p>
                      </div>
                      {draft.header_style === style.id && (
                        <Check size={16} className="text-emerald-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Per-header settings */}
            <div className="space-y-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-xs font-bold text-gray-700">Ajustes de la cabecera</p>

              {/* Sticky toggle — for all headers */}
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-[11px] font-semibold text-gray-600">Menú fijo (anclado arriba al hacer scroll)</span>
                <button
                  onClick={() => setDraft({ ...draft, header_sticky: !draft.header_sticky })}
                  className={`relative w-10 h-5 rounded-full transition ${draft.header_sticky ? 'bg-emerald-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${draft.header_sticky ? 'left-5' : 'left-0.5'}`} />
                </button>
              </label>

              {/* Colors override for this header */}
              <div className="space-y-2 pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-gray-600">Colores de la cabecera</p>
                  <button
                    onClick={() => setDraft({
                      ...draft,
                      header_bg_color: '', header_text_color: '',
                      header_active_color: '', header_active_bg_color: '', header_hover_color: '',
                      header_top_bg_color: '', header_top_text_color: '',
                      header_bottom_bg_color: '', header_bottom_text_color: '',
                    })}
                    className="text-[10px] text-emerald-600 hover:text-emerald-800 font-bold"
                  >
                    Usar tema
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">Deja vacío para usar los colores de la paleta general.</p>

                {/* Color picker helper component */}
                {(() => {
                  // Calculate resolved colors based on the selected header style
                  const coloredStyles = ['modern_eco', 'agrodigital_mincyt', 'dropdown_categories', 'compact', 'banner', 'sidebar_left', 'split_center', 'hero_overlay']
                  const isColored = coloredStyles.includes(draft.header_style)
                  const resolvedBg = draft.header_bg_color || draft.primary_color
                  const resolvedText = draft.header_text_color || (isColored ? '#ffffff' : draft.text_color)
                  const resolvedActive = draft.header_active_color || (isColored ? '#ffffff' : draft.primary_color)
                  const resolvedActiveBg = draft.header_active_bg_color || draft.secondary_color
                  const resolvedHover = draft.header_hover_color || draft.primary_color

                  const ColorRow = ({ label, value, onChange, resolvedColor }: { label: string; value: string; onChange: (v: string) => void; resolvedColor: string }) => (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={value || resolvedColor}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer flex-shrink-0"
                      />
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-gray-700">{label}</p>
                        <div className="flex items-center gap-1.5">
                          <input
                            className="input text-[10px] font-mono py-0.5 flex-1"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={resolvedColor}
                          />
                          {!value && (
                            <span className="text-[9px] text-gray-400 font-bold whitespace-nowrap">tema</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                  return (
                    <>
                      <ColorRow label="Color de fondo" value={draft.header_bg_color} onChange={(v) => setDraft({ ...draft, header_bg_color: v })} resolvedColor={resolvedBg} />
                      <ColorRow label="Color de texto" value={draft.header_text_color} onChange={(v) => setDraft({ ...draft, header_text_color: v })} resolvedColor={resolvedText} />
                      <ColorRow label="Color texto activo" value={draft.header_active_color} onChange={(v) => setDraft({ ...draft, header_active_color: v })} resolvedColor={resolvedActive} />
                      <ColorRow label="Color fondo botón activo" value={draft.header_active_bg_color} onChange={(v) => setDraft({ ...draft, header_active_bg_color: v })} resolvedColor={resolvedActiveBg} />
                      <ColorRow label="Color hover (pasar mouse)" value={draft.header_hover_color} onChange={(v) => setDraft({ ...draft, header_hover_color: v })} resolvedColor={resolvedHover} />

                      {/* Dual-row colors for editorial_latam */}
                      {draft.header_style === 'editorial_latam' && (
                        <div className="pt-2 mt-2 border-t border-gray-200 space-y-2">
                          <p className="text-[10px] font-bold text-gray-600">Fila superior (marca)</p>
                          <ColorRow label="Fondo fila superior" value={draft.header_top_bg_color} onChange={(v) => setDraft({ ...draft, header_top_bg_color: v })} resolvedColor={draft.header_top_bg_color || '#ffffff'} />
                          <ColorRow label="Texto fila superior" value={draft.header_top_text_color} onChange={(v) => setDraft({ ...draft, header_top_text_color: v })} resolvedColor={draft.header_top_text_color || draft.text_color} />
                          <p className="text-[10px] font-bold text-gray-600 pt-1">Fila inferior (menú)</p>
                          <ColorRow label="Fondo fila inferior" value={draft.header_bottom_bg_color} onChange={(v) => setDraft({ ...draft, header_bottom_bg_color: v })} resolvedColor={draft.header_bottom_bg_color || '#1f301d'} />
                          <ColorRow label="Texto fila inferior" value={draft.header_bottom_text_color} onChange={(v) => setDraft({ ...draft, header_bottom_text_color: v })} resolvedColor={draft.header_bottom_text_color || '#ffffff'} />
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>

              {/* Banner image (for banner style) */}
              {draft.header_style === 'banner' && (
                <div className="space-y-3 pt-2 border-t border-gray-200">
                  <p className="text-[11px] font-bold text-gray-600">Imagen del banner</p>
                  <div className="flex items-center gap-2">
                    {draft.header_banner_image && (
                      <img src={draft.header_banner_image} alt="banner" className="w-16 h-10 rounded object-cover border border-gray-200" />
                    )}
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={draft.header_banner_image}
                        onChange={(e) => setDraft({ ...draft, header_banner_image: e.target.value })}
                        placeholder="URL de la imagen..."
                        className="input text-[11px]"
                      />
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold hover:bg-emerald-200 transition cursor-pointer border border-emerald-300">
                        <Upload size={14} />
                        Subir imagen
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) handleLogoUpload(f).then((url: string) => setDraft({ ...draft, header_banner_image: url }))
                        }} />
                      </label>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400">Deja vacío para usar imagen por defecto</p>

                  {/* Carousel: multiple images */}
                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <p className="text-[11px] font-bold text-gray-600">Carrusel (múltiples imágenes)</p>
                    <p className="text-[10px] text-gray-400">Pega varias URLs separadas por comas para un carrusel automático.</p>
                    <textarea
                      value={draft.header_banner_images}
                      onChange={(e) => setDraft({ ...draft, header_banner_images: e.target.value })}
                      placeholder="https://imagen1.jpg, https://imagen2.jpg, https://imagen3.jpg"
                      className="input text-[10px] min-h-[60px] resize-y"
                    />
                    {/* Preview thumbnails */}
                    {draft.header_banner_images && (
                      <div className="flex gap-1.5 flex-wrap">
                        {draft.header_banner_images.split(',').map((s, i) => {
                          const url = s.trim()
                          if (!url) return null
                          return (
                            <div key={i} className="relative group">
                              <img src={url} alt={`slide ${i+1}`} className="w-14 h-10 rounded object-cover border border-gray-200" />
                              <button
                                onClick={() => {
                                  const imgs = draft.header_banner_images.split(',').filter((_, idx) => idx !== i).join(',')
                                  setDraft({ ...draft, header_banner_images: imgs })
                                }}
                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {/* Add image by upload to carousel */}
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold hover:bg-emerald-200 transition cursor-pointer border border-emerald-300">
                      <Upload size={14} />
                      Subir imagen al carrusel
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleLogoUpload(f).then((url: string) => {
                          const current = draft.header_banner_images ? draft.header_banner_images.split(',').map(s => s.trim()).filter(Boolean) : []
                          setDraft({ ...draft, header_banner_images: [...current, url].join(', ') })
                        })
                      }} />
                    </label>
                  </div>

                  {/* Carousel duration */}
                  <div>
                    <label className="label text-[11px] font-bold">Duración por imagen: {draft.header_banner_duration}s</label>
                    <input
                      type="range"
                      min="2"
                      max="15"
                      step="1"
                      value={draft.header_banner_duration}
                      onChange={(e) => setDraft({ ...draft, header_banner_duration: parseInt(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                  </div>

                  {/* Transition type */}
                  <div>
                    <label className="label text-[11px] font-bold">Tipo de transición</label>
                    <div className="flex gap-1.5">
                      {['fade', 'slide', 'zoom'].map((t) => (
                        <button
                          key={t}
                          onClick={() => setDraft({ ...draft, header_banner_transition: t })}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition ${
                            draft.header_banner_transition === t
                              ? 'bg-emerald-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {t === 'fade' ? 'Desvanecer' : t === 'slide' ? 'Deslizar' : 'Zoom'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Banner height (for banner style) */}
              {draft.header_style === 'banner' && (
                <div>
                  <label className="label text-[11px] font-bold">Altura del banner: {draft.header_banner_height}px</label>
                  <input
                    type="range"
                    min="80"
                    max="300"
                    step="10"
                    value={draft.header_banner_height}
                    onChange={(e) => setDraft({ ...draft, header_banner_height: parseInt(e.target.value) })}
                    className="w-full accent-emerald-600"
                  />
                </div>
              )}

              {/* Transparency settings (for hero_overlay style) */}
              {draft.header_style === 'hero_overlay' && (
                <div className="space-y-3 pt-2 border-t border-gray-200">
                  <p className="text-[11px] font-bold text-gray-600">Transparencia y distorsión</p>

                  <div>
                    <label className="label text-[11px] font-bold">Nivel de transparencia: {draft.header_transparency}%</label>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      step="5"
                      value={draft.header_transparency}
                      onChange={(e) => setDraft({ ...draft, header_transparency: parseInt(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">0% = solido, 80% = muy transparente</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draft.header_transparency_color}
                      onChange={(e) => setDraft({ ...draft, header_transparency_color: e.target.value })}
                      className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer flex-shrink-0"
                    />
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-gray-700">Color de la transparencia</p>
                      <p className="text-[10px] text-gray-400">Negro = oscuro, azul = vidrio, etc.</p>
                    </div>
                  </div>

                  <div>
                    <label className="label text-[11px] font-bold">Distorsión (blur): {draft.header_blur}px</label>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="1"
                      value={draft.header_blur}
                      onChange={(e) => setDraft({ ...draft, header_blur: parseInt(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">0 = sin distorsión, 20 = muy borroso</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: MENU */}
        {activeTab === 'menu' && (
          <div className="space-y-3">
            {/* Sub-tabs: Plano vs Jerarquico */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
              <button
                onClick={() => setMenuMode('plano')}
                className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-bold transition ${
                  menuMode === 'plano' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Menú Plano
              </button>
              <button
                onClick={() => setMenuMode('jerarquico')}
                className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-bold transition ${
                  menuMode === 'jerarquico' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Menú con Submenús
              </button>
            </div>

            {menuMode === 'plano' ? (
              <>
                <p className="text-[11px] text-gray-500 bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                  Reorganiza las páginas del menú en una lista plana. Los cambios se ven en vivo en la cabecera.
                </p>
                {draftPages.map((page, idx) => (
                  <div
                    key={page.slug}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border transition ${
                      page.show_in_menu ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => movePage(idx, 'up')} disabled={idx === 0} className="text-gray-400 hover:text-emerald-600 disabled:opacity-30 transition">
                        <ChevronUp size={14} />
                      </button>
                      <button onClick={() => movePage(idx, 'down')} disabled={idx === draftPages.length - 1} className="text-gray-400 hover:text-emerald-600 disabled:opacity-30 transition">
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-gray-900">{page.title}</p>
                      <p className="text-[10px] text-gray-400">/p/{page.slug}</p>
                    </div>
                    <button
                      onClick={() => toggleMenuVisible(idx)}
                      className={`p-1.5 rounded-lg transition ${
                        page.show_in_menu ? 'text-emerald-600 hover:bg-emerald-100' : 'text-gray-400 hover:bg-gray-100'
                      }`}
                      title={page.show_in_menu ? 'Ocultar del menú' : 'Mostrar en menú'}
                    >
                      {page.show_in_menu ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <>
                <p className="text-[11px] text-gray-500 bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                  Arrastra páginas dentro de otras para crear submenús. Las páginas de nivel superior aparecen en la cabecera; las hijas se despliegan al pasar el mouse. Ideal para el estilo <b>Mega Menú</b>.
                </p>

                {/* Top-level pages with their children */}
                {topLevelPages.map((parent, pIdx) => {
                  const children = childrenOf(parent.slug)
                  return (
                    <div key={parent.slug} className="rounded-xl border-2 border-emerald-200 overflow-hidden">
                      {/* Parent header */}
                      <div className={`flex items-center gap-2 p-2.5 bg-emerald-50 ${parent.show_in_menu ? '' : 'opacity-50'}`}>
                        <div className="flex flex-col gap-0.5">
                          <button onClick={() => moveTopLevel(parent.slug, 'up')} disabled={pIdx === 0} className="text-gray-400 hover:text-emerald-600 disabled:opacity-30">
                            <ChevronUp size={14} />
                          </button>
                          <button onClick={() => moveTopLevel(parent.slug, 'down')} disabled={pIdx === topLevelPages.length - 1} className="text-gray-400 hover:text-emerald-600 disabled:opacity-30">
                            <ChevronDown size={14} />
                          </button>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-emerald-900">{parent.title}</p>
                          <p className="text-[10px] text-emerald-600">/p/{parent.slug} · Menú principal</p>
                        </div>
                        <button
                          onClick={() => {
                            const fullIdx = draftPages.findIndex((p) => p.slug === parent.slug)
                            toggleMenuVisible(fullIdx)
                          }}
                          className={`p-1.5 rounded-lg transition ${parent.show_in_menu ? 'text-emerald-600 hover:bg-emerald-100' : 'text-gray-400'}`}
                        >
                          {parent.show_in_menu ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                      </div>

                      {/* Children */}
                      {children.length > 0 && (
                        <div className="p-2 space-y-1.5 bg-white">
                          {children.map((child, cIdx) => (
                            <div key={child.slug} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200 ml-4">
                              <div className="flex flex-col gap-0.5">
                                <button onClick={() => moveChild(child.slug, parent.slug, 'up')} disabled={cIdx === 0} className="text-gray-400 hover:text-emerald-600 disabled:opacity-30">
                                  <ChevronUp size={12} />
                                </button>
                                <button onClick={() => moveChild(child.slug, parent.slug, 'down')} disabled={cIdx === children.length - 1} className="text-gray-400 hover:text-emerald-600 disabled:opacity-30">
                                  <ChevronDown size={12} />
                                </button>
                              </div>
                              <span className="text-gray-300 text-xs">↳</span>
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-gray-700">{child.title}</p>
                                <p className="text-[10px] text-gray-400">/p/{child.slug}</p>
                              </div>
                              <button
                                onClick={() => makeTopLevel(child.slug)}
                                className="text-[10px] text-emerald-600 hover:text-emerald-800 font-bold px-2 py-1 rounded hover:bg-emerald-50"
                                title="Sacar del submenú"
                              >
                                ↑ Subir
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Drop zone: assign a page as child */}
                      <div className="p-2 bg-gray-50 border-t border-gray-200">
                        <select
                          onChange={(e) => { if (e.target.value) { makeChild(e.target.value, parent.slug); e.target.value = '' } }}
                          className="input text-[11px] py-1"
                          defaultValue=""
                        >
                          <option value="">+ Añadir página como submenú...</option>
                          {draftPages
                            .filter((p) => !p.parent_slug && p.slug !== parent.slug && !childrenOf(parent.slug).some(c => c.slug === p.slug))
                            .map((p) => (
                              <option key={p.slug} value={p.slug}>{p.title}</option>
                            ))}
                        </select>
                      </div>
                    </div>
                  )
                })}

                {/* Unassigned pages (no parent, not shown as top-level yet) */}
                {(() => {
                  const assignedSlugs = new Set(topLevelPages.map(p => p.slug))
                  const unassigned = draftPages.filter((p) => !p.parent_slug && !assignedSlugs.has(p.slug))
                  // Actually topLevelPages already includes all without parent, so this is for orphaned pages with parents that don't exist
                  const orphans = draftPages.filter((p) => p.parent_slug && !draftPages.some(parent => parent.slug === p.parent_slug))
                  if (orphans.length === 0) return null
                  return (
                    <div className="rounded-xl border border-dashed border-gray-300 p-3">
                      <p className="text-[10px] text-gray-400 font-bold mb-2">Páginas huérfanas (sin padre válido):</p>
                      {orphans.map((p) => (
                        <div key={p.slug} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                          <span className="text-xs text-gray-600 flex-1">{p.title}</span>
                          <button onClick={() => makeTopLevel(p.slug)} className="text-[10px] text-emerald-600 font-bold">↑ Subir a menú principal</button>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        )}

        {/* TAB: COLORES */}
        {activeTab === 'colores' && (
          <div className="space-y-4">
            <p className="text-[11px] text-gray-500 bg-blue-50 p-2.5 rounded-xl border border-blue-100">
              Cada paleta define 8 colores: primario, secundario, texto, hover de botones, fondo de módulos, fondo de página, fondo del pie, y color de enlaces. Los cambios se ven en vivo.
            </p>

            {/* Color Presets */}
            <div>
              <label className="label text-xs font-bold">Paletas</label>
              {/* Always show active palette indicator */}
              <div className="mb-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-[10px] text-emerald-800 font-bold">
                  ✓ Activa: {activePreset ? activePreset.name : 'Personalizada (sin guardar)'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {allPresets.map((preset) => {
                  const isActive = matchesPreset(draft, preset)
                  const isCustom = customPalettes.some((cp) => cp.name === preset.name)
                  return (
                    <div
                      key={preset.name}
                      className={`p-2 rounded-xl border-2 transition text-left relative ${
                        isActive ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <button
                        onClick={() => setDraft({ ...draft, ...preset })}
                        className="w-full text-left"
                      >
                        <div className="flex gap-1 mb-1 flex-wrap">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.primary_color }} />
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.secondary_color }} />
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.button_hover_color }} />
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.module_bg_color }} />
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.page_bg_color }} />
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.footer_bg_color }} />
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.link_color }} />
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.text_color }} />
                        </div>
                        <p className="text-[10px] font-bold text-gray-700">{preset.name}</p>
                        {isActive && <p className="text-[9px] text-emerald-600 font-bold">✓ Activa</p>}
                      </button>
                      {isCustom && (
                        <button
                          onClick={() => handleDeletePalette(preset.name)}
                          className="absolute top-1 right-1 text-red-400 hover:text-red-600 transition"
                          title="Eliminar paleta"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Save current colors as named palette */}
              <div className="mt-3">
                {!showSavePalette ? (
                  <button
                    onClick={() => setShowSavePalette(true)}
                    className="w-full px-3 py-2 rounded-lg border-2 border-dashed border-emerald-300 text-emerald-700 text-[11px] font-bold hover:bg-emerald-50 transition flex items-center justify-center gap-1.5"
                  >
                    <Save size={14} />
                    Guardar colores actuales como paleta
                  </button>
                ) : (
                  <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 space-y-2">
                    <p className="text-[10px] font-bold text-emerald-800">Nombre de la paleta:</p>
                    <input
                      type="text"
                      value={newPaletteName}
                      onChange={(e) => setNewPaletteName(e.target.value)}
                      placeholder="Ej: Mi Paleta Verde"
                      className="input text-xs"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSavePalette() }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSavePalette}
                        disabled={!newPaletteName.trim()}
                        className="btn-primary text-[11px] flex-1 justify-center"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => { setShowSavePalette(false); setNewPaletteName('') }}
                        className="btn-secondary text-[11px] flex-1 justify-center"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Colors - all 8 */}
            <div className="space-y-2.5">
              <label className="label text-xs font-bold">Colores personalizados</label>
              {[
                { key: 'primary_color', label: 'Color primario (cabecera, botones)' },
                { key: 'secondary_color', label: 'Color secundario (acentos, badges)' },
                { key: 'button_hover_color', label: 'Hover de botones' },
                { key: 'text_color', label: 'Color de texto' },
                { key: 'link_color', label: 'Color de enlaces' },
                { key: 'link_visited_color', label: 'Color de enlaces visitados' },
                { key: 'module_bg_color', label: 'Fondo de módulos/tarjetas' },
                { key: 'page_bg_color', label: 'Fondo de la página' },
                { key: 'footer_bg_color', label: 'Fondo del pie de página' },
              ].map((c) => (
                <div key={c.key} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={(draft as any)[c.key]}
                    onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })}
                    className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-gray-700">{c.label}</p>
                    <input
                      className="input text-[10px] font-mono py-0.5"
                      value={(draft as any)[c.key]}
                      onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="p-3 rounded-xl border border-gray-200 space-y-2">
              <p className="text-[10px] text-gray-400">Vista previa:</p>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-lg text-white text-xs font-bold" style={{ backgroundColor: draft.primary_color }}>
                  Botón primario
                </button>
                <button className="px-3 py-1.5 rounded-lg text-white text-xs font-bold" style={{ backgroundColor: draft.button_hover_color }}>
                  Hover
                </button>
              </div>
              <div className="p-2 rounded-lg" style={{ backgroundColor: draft.module_bg_color }}>
                <p className="text-xs" style={{ color: draft.text_color }}>Texto dentro de un módulo</p>
                <a className="text-xs underline" style={{ color: draft.link_color }}>Enlace de ejemplo</a>
              </div>
              <div className="p-2 rounded-lg" style={{ backgroundColor: draft.page_bg_color }}>
                <p className="text-[10px] text-gray-500">Fondo de página</p>
              </div>
              <div className="p-2 rounded-lg" style={{ backgroundColor: draft.footer_bg_color }}>
                <p className="text-[10px] text-white">Fondo del pie de página</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB: FOOTER */}
        {activeTab === 'footer' && (
          <div className="space-y-4">
            <p className="text-[11px] text-gray-500 bg-blue-50 p-2.5 rounded-xl border border-blue-100">
              Edita los textos del pie de página. Los cambios se ven en vivo abajo.
            </p>

            {/* Column 1: Brand */}
            <div className="border-t border-gray-200 pt-3">
              <h4 className="font-bold text-xs text-gray-700 mb-2">Columna 1: Marca</h4>
              <div className="space-y-2">
                <div>
                  <label className="label text-[10px] font-bold">Título (vacío = sin título, solo logo)</label>
                  <input className="input text-xs" value={draft.footer_col1_title} onChange={(e) => setDraft({ ...draft, footer_col1_title: e.target.value })} placeholder="(vacío = solo logo)" />
                </div>
                <div>
                  <label className="label text-[10px] font-bold">Descripción del nodo</label>
                  <textarea rows={2} className="input text-xs" value={draft.footer_about} onChange={(e) => setDraft({ ...draft, footer_about: e.target.value })} />
                </div>
                <div>
                  <label className="label text-[10px] font-bold">Slogan (debajo de la descripción)</label>
                  <input className="input text-xs" value={draft.footer_slogan} onChange={(e) => setDraft({ ...draft, footer_slogan: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Column 2: Pages */}
            <div className="border-t border-gray-200 pt-3">
              <h4 className="font-bold text-xs text-gray-700 mb-2">Columna 2: Páginas</h4>
              <div>
                <label className="label text-[10px] font-bold">Título de la columna</label>
                <input className="input text-xs" value={draft.footer_col2_title} onChange={(e) => setDraft({ ...draft, footer_col2_title: e.target.value })} />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Las páginas se reorganizan desde la pestaña "Menú".</p>
            </div>

            {/* Column 3: Location */}
            <div className="border-t border-gray-200 pt-3">
              <h4 className="font-bold text-xs text-gray-700 mb-2">Columna 3: Lugar de Encuentro</h4>
              <div className="space-y-2">
                <div>
                  <label className="label text-[10px] font-bold">Título de la columna</label>
                  <input className="input text-xs" value={draft.footer_col3_title} onChange={(e) => setDraft({ ...draft, footer_col3_title: e.target.value })} />
                </div>
                <div>
                  <label className="label text-[10px] font-bold">Dirección</label>
                  <input className="input text-xs" value={draft.contact_address} onChange={(e) => setDraft({ ...draft, contact_address: e.target.value })} />
                </div>
                <div>
                  <label className="label text-[10px] font-bold">Horario</label>
                  <input className="input text-xs" value={draft.footer_schedule} onChange={(e) => setDraft({ ...draft, footer_schedule: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Column 4: Social & Admission */}
            <div className="border-t border-gray-200 pt-3">
              <h4 className="font-bold text-xs text-gray-700 mb-2">Columna 4: Comunidad & Redes</h4>
              <div className="space-y-2">
                <div>
                  <label className="label text-[10px] font-bold">Título de la columna</label>
                  <input className="input text-xs" value={draft.footer_col4_title} onChange={(e) => setDraft({ ...draft, footer_col4_title: e.target.value })} />
                </div>
                <div>
                  <label className="label text-[10px] font-bold">Instagram (sin @)</label>
                  <input className="input text-xs" value={draft.social_instagram} onChange={(e) => setDraft({ ...draft, social_instagram: e.target.value })} />
                </div>
                <div>
                  <label className="label text-[10px] font-bold">Facebook</label>
                  <input className="input text-xs" value={draft.social_facebook} onChange={(e) => setDraft({ ...draft, social_facebook: e.target.value })} />
                </div>
                <div>
                  <label className="label text-[10px] font-bold">Texto del botón de admisión</label>
                  <input className="input text-xs" value={draft.footer_admission_text} onChange={(e) => setDraft({ ...draft, footer_admission_text: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Save / Reset */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2">
        <button
          onClick={handleReset}
          className="px-3 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200 transition flex items-center gap-1.5"
        >
          <RotateCcw size={14} />
          Descartar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary text-xs flex items-center gap-1.5 shadow flex-1 justify-center"
        >
          <Save size={14} />
          {saving ? 'Guardando...' : 'Guardar Todo'}
        </button>
      </div>
        </>
      )}
    </div>
  )
}
