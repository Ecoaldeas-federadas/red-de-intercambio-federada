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
  header_style: string
  contact_address: string
  social_instagram: string
  social_facebook: string
  footer_about: string
  footer_schedule: string
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

const COLOR_PRESETS = [
  { name: 'Verde Conuquero', primary: '#162e16', secondary: '#c2410c' },
  { name: 'Tierra Barlovento', primary: '#7c2d12', secondary: '#15803d' },
  { name: 'Caribe Azul', primary: '#0c4a6e', secondary: '#c2410c' },
  { name: 'Sol Andino', primary: '#92400e', secondary: '#166534' },
  { name: 'Bosque Húmedo', primary: '#14532d', secondary: '#a16207' },
  { name: 'Aurora', primary: '#581c87', secondary: '#0e7490' },
]

export function ThemeCustomizer({
  open,
  onClose,
  initialSettings,
  initialPages,
  onSave,
}: {
  open: boolean
  onClose: () => void
  initialSettings: ThemeDraft
  initialPages: PageMenuItem[]
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
    // Reassign menu_order
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

  return (
    <>
      {/* Customizer Panel - slides from left */}
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

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* TAB: CABECERA */}
          {activeTab === 'cabecera' && (
            <div className="space-y-4">
              {/* Logo */}
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

              {/* Title & Subtitle */}
              <div>
                <label className="label text-xs font-bold">Título del nodo</label>
                <input className="input text-xs" value={draft.site_title} onChange={(e) => setDraft({ ...draft, site_title: e.target.value })} />
              </div>
              <div>
                <label className="label text-xs font-bold">Subtítulo</label>
                <input className="input text-xs" value={draft.site_subtitle} onChange={(e) => setDraft({ ...draft, site_subtitle: e.target.value })} />
              </div>

              {/* Header Style - with live preview */}
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
                Reorganiza las páginas del menú. Los cambios se ven en vivo en la cabecera. Sube/baja items y muestra/oculta páginas del menú.
              </p>

              {draftPages.map((page, idx) => (
                <div
                  key={page.slug}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border transition ${
                    page.show_in_menu ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => movePage(idx, 'up')}
                      disabled={idx === 0}
                      className="text-gray-400 hover:text-emerald-600 disabled:opacity-30 transition"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => movePage(idx, 'down')}
                      disabled={idx === draftPages.length - 1}
                      className="text-gray-400 hover:text-emerald-600 disabled:opacity-30 transition"
                    >
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
                      page.show_in_menu
                        ? 'text-emerald-600 hover:bg-emerald-100'
                        : 'text-gray-400 hover:bg-gray-100'
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
                Cambia los colores del tema. Los cambios se ven en vivo. Solo se guardan al darle "Guardar".
              </p>

              {/* Color Presets */}
              <div>
                <label className="label text-xs font-bold">Paletas predefinidas</label>
                <div className="grid grid-cols-2 gap-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => setDraft({ ...draft, primary_color: preset.primary, secondary_color: preset.secondary })}
                      className={`p-2 rounded-xl border-2 transition text-left ${
                        draft.primary_color === preset.primary
                          ? 'border-emerald-600 bg-emerald-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex gap-1 mb-1">
                        <div className="w-5 h-5 rounded" style={{ backgroundColor: preset.primary }} />
                        <div className="w-5 h-5 rounded" style={{ backgroundColor: preset.secondary }} />
                      </div>
                      <p className="text-[10px] font-bold text-gray-700">{preset.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Colors */}
              <div>
                <label className="label text-xs font-bold">Color primario</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={draft.primary_color}
                    onChange={(e) => setDraft({ ...draft, primary_color: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                  />
                  <input
                    className="input text-xs font-mono flex-1"
                    value={draft.primary_color}
                    onChange={(e) => setDraft({ ...draft, primary_color: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label text-xs font-bold">Color secundario</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={draft.secondary_color}
                    onChange={(e) => setDraft({ ...draft, secondary_color: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                  />
                  <input
                    className="input text-xs font-mono flex-1"
                    value={draft.secondary_color}
                    onChange={(e) => setDraft({ ...draft, secondary_color: e.target.value })}
                  />
                </div>
              </div>

              {/* Preview swatch */}
              <div className="p-3 rounded-xl border border-gray-200">
                <p className="text-[10px] text-gray-400 mb-2">Vista previa:</p>
                <div className="flex gap-2">
                  <div className="flex-1 p-2 rounded-lg text-white text-xs font-bold text-center" style={{ backgroundColor: draft.primary_color }}>
                    Primario
                  </div>
                  <div className="flex-1 p-2 rounded-lg text-white text-xs font-bold text-center" style={{ backgroundColor: draft.secondary_color }}>
                    Secundario
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: FOOTER */}
          {activeTab === 'footer' && (
            <div className="space-y-4">
              <p className="text-[11px] text-gray-500 bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                Edita los textos del pie de página. Los cambios se ven en vivo.
              </p>

              <div>
                <label className="label text-xs font-bold">Descripción del nodo</label>
                <textarea rows={3} className="input text-xs" value={draft.footer_about} onChange={(e) => setDraft({ ...draft, footer_about: e.target.value })} />
              </div>

              <div>
                <label className="label text-xs font-bold">Horario</label>
                <input className="input text-xs" value={draft.footer_schedule} onChange={(e) => setDraft({ ...draft, footer_schedule: e.target.value })} />
              </div>

              <div>
                <label className="label text-xs font-bold">Dirección</label>
                <input className="input text-xs" value={draft.contact_address} onChange={(e) => setDraft({ ...draft, contact_address: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs font-bold">Instagram (sin @)</label>
                  <input className="input text-xs" value={draft.social_instagram} onChange={(e) => setDraft({ ...draft, social_instagram: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs font-bold">Facebook</label>
                  <input className="input text-xs" value={draft.social_facebook} onChange={(e) => setDraft({ ...draft, social_facebook: e.target.value })} />
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
    </>
  )
}
