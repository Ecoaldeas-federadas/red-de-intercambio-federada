import { useState, useEffect, useRef } from 'react'
import { api } from '../../api'
import {
  X, Check, Upload, Eye, EyeOff, ChevronUp, ChevronDown,
  Palette, Layout, Menu as MenuIcon, Image as ImageIcon,
  RotateCcw, Save, Sparkles,
} from 'lucide-react'

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
}

export interface PageMenuItem {
  id?: string
  slug: string
  title: string
  icon?: string
  menu_order: number
  show_in_menu: boolean
  is_published: boolean
}

const HEADER_STYLES = [
  { id: 'modern_eco', name: 'Eco Moderno', desc: 'Verde con logo, menú horizontal' },
  { id: 'fao_institutional', name: 'Institucional FAO', desc: 'Blanco, portal formal' },
  { id: 'compact', name: 'Compacto', desc: 'Minimalista, poco espacio' },
  { id: 'banner', name: 'Banner', desc: 'Con imagen de fondo' },
]

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
    name: 'Verde Conuquero',
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
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
    ;[newPages[idx], newPages[target]] = [newPages[target], newPages[idx]]
    newPages.forEach((p, i) => { p.menu_order = i })
    setDraftPages(newPages)
  }

  const toggleMenuVisible = (idx: number) => {
    const newPages = [...draftPages]
    newPages[idx] = { ...newPages[idx], show_in_menu: !newPages[idx].show_in_menu }
    setDraftPages(newPages)
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

  const activePreset = COLOR_PRESETS.find((p) => matchesPreset(draft, p))

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-full sm:w-96 md:w-[420px] bg-white shadow-2xl border-r border-gray-200 flex flex-col animate-in slide-in-from-left duration-200">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-emerald-900 to-emerald-800 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-amber-400" />
          <div>
            <h3 className="font-extrabold text-sm">Personalizador del Tema</h3>
            <p className="text-[10px] text-emerald-200">Ves los cambios en vivo. Solo se guardan al darle "Guardar".</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 text-gray-300 hover:text-white rounded-lg">
          <X size={20} />
        </button>
      </div>

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
                        <p className="text-[10px] text-gray-500">{style.desc}</p>
                      </div>
                      {draft.header_style === style.id && (
                        <Check size={16} className="text-emerald-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: MENU */}
        {activeTab === 'menu' && (
          <div className="space-y-3">
            <p className="text-[11px] text-gray-500 bg-blue-50 p-2.5 rounded-xl border border-blue-100">
              Reorganiza las páginas del menú. Los cambios se ven en vivo en la cabecera.
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
              <label className="label text-xs font-bold">Paletas predefinidas</label>
              {activePreset && (
                <p className="text-[10px] text-emerald-700 font-bold mb-2">
                  Activa: {activePreset.name}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {COLOR_PRESETS.map((preset) => {
                  const isActive = matchesPreset(draft, preset)
                  return (
                    <button
                      key={preset.name}
                      onClick={() => setDraft({ ...draft, ...preset })}
                      className={`p-2 rounded-xl border-2 transition text-left ${
                        isActive ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
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
                  )
                })}
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
    </div>
  )
}
