import React, { useState } from 'react'
import {
  Sparkles,
  Plus,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Sliders,
  Check,
  X,
  Image as ImageIcon,
  LayoutGrid,
  Save,
  Eye,
  RotateCcw,
  Layers,
  ArrowRight,
  ExternalLink,
  Code,
  CheckCircle2,
} from 'lucide-react'
import { SiteBlock, BlockType } from '../../types/publicSite'
import { BlockRenderer } from './PublicBlocks'

// Block definitions for the inline module adder
const BLOCK_TEMPLATES: {
  type: BlockType
  name: string
  description: string
  defaultData: () => SiteBlock
}[] = [
  {
    type: 'hero',
    name: 'Hero / Encabezado Destacado',
    description: 'Cabecera con imagen, título, insignias y botones de acción.',
    defaultData: () => ({
      type: 'hero',
      badge: '🌱 Bienvenidos',
      title: 'Nuevo Encabezado Destacado',
      subtitle: 'Soberanía alimentaria y saberes comunitarios',
      description: 'Espacio de encuentro popular y economía solidaria.',
      image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
      primary_cta: { text: 'Conoce Nuestros Productos', link: '/p/productos' },
      secondary_cta: { text: 'Solicitar Unirse', link: '/p/unirse' },
      style: 'split',
    }),
  },
  {
    type: 'carousel',
    name: 'Carrusel / Álbum de Fotos',
    description: 'Galería de fotos interactiva con leyendas y pantalla completa.',
    defaultData: () => ({
      type: 'carousel',
      title: 'Galería Viva de Nuestras Cosechas',
      subtitle: 'Imágenes de las jornadas comunitarias.',
      autoplay: true,
      items: [
        {
          image_url: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=1000&q=80',
          title: 'Hortalizas Frescas',
          caption: 'Cosechadas el mismo día sin agrotóxicos.',
          tag: 'Cosecha',
        },
        {
          image_url: 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=1000&q=80',
          title: 'Botica Conuquera',
          caption: 'Medicina botánica y salud natural.',
          tag: 'Salud',
        },
      ],
    }),
  },
  {
    type: 'features_grid',
    name: 'Cuadrícula de Tarjetas / Pilares',
    description: 'Tarjetas en 2, 3 o 4 columnas con iconos y etiquetas.',
    defaultData: () => ({
      type: 'features_grid',
      title: 'Nuestros Pilares Comunitarios',
      subtitle: 'Principios rectores de la red conuquera.',
      columns: 3,
      items: [
        { icon: 'leaf', title: 'Agroecología', description: 'Producción limpia en armonía con la tierra.', badge: 'Suelo Vivo' },
        { icon: 'users', title: 'Comercio Justo', description: 'Venta directa en moneda local y trueque.', badge: 'Solidario' },
        { icon: 'scale', title: 'Crédito Mutuo', description: 'Contabilidad de suma cero en energía.', badge: 'Moneda Social' },
      ],
    }),
  },
  {
    type: 'split_story',
    name: 'Sección Dividida (Historia & Foto)',
    description: 'Texto descriptivo con imagen lateral, puntos clave y cita conuquera.',
    defaultData: () => ({
      type: 'split_story',
      badge: 'Historia Viva',
      title: 'El Conuco como Proyecto de Vida',
      subtitle: 'Resistencia ecosocialista y saberes campesinos',
      content: 'El conuco es un laboratorio integral de vida comunitaria y soberanía alimentaria.',
      image_url: 'https://images.unsplash.com/photo-1592417817098-8f3d69102a5e?auto=format&fit=crop&w=900&q=80',
      image_position: 'left',
      highlights: ['Producción 100% limpia sin venenos.', 'Semillas criollas y libres.'],
      quote: { text: 'La abundancia nace del respeto a la diversidad.', author: 'Vocería Conuquera' },
    }),
  },
  {
    type: 'stats',
    name: 'Contador de Estadísticas / Impacto',
    description: 'Números y métricas destacadas de la comunidad.',
    defaultData: () => ({
      type: 'stats',
      title: 'Diez Años Construyendo Soberanía',
      subtitle: 'Cifras reales de nuestro movimiento.',
      bg_theme: 'primary',
      items: [
        { value: '+10 Años', label: 'De Trayectoria', description: 'En la comunidad' },
        { value: '+45 Familias', label: 'Productoras', description: 'De la región' },
        { value: '0%', label: 'Agrotóxicos', description: '100% limpia' },
        { value: 'Venta Libre', label: 'Moneda Local', description: 'Abierto a todos' },
      ],
    }),
  },
  {
    type: 'event_schedule',
    name: 'Próxima Cita & Horarios',
    description: 'Tarjeta de fecha, horarios, metro y normas ecológicas de la feria.',
    defaultData: () => ({
      type: 'event_schedule',
      badge: '📍 Mercado Mensual',
      title: 'Encuentro Mensual',
      date_text: 'Primer sábado de cada mes',
      time_text: '9:00 AM a 1:00 PM',
      location_name: '',
      address: 'Zona Sur, cerca de la Fuente Venezuela (Metro Bellas Artes).',
      guidelines: [
        'Venta abierta al público general en moneda local.',
        'Prohibido el uso de bolsas plásticas desechables.',
      ],
      cta_text: 'Solicitar Unirse',
      cta_link: '/p/unirse',
    }),
  },
  {
    type: 'products_showcase',
    name: 'Catálogo de Productos',
    description: 'Muestra de alimentos, hortalizas y gastronomía con filtros por categoría.',
    defaultData: () => ({
      type: 'products_showcase',
      title: 'Nuestros Productos y Sabores',
      subtitle: 'Cosecha fresca, medicina botánica y gastronomía artesanal.',
      categories: ['Cosecha Fresca', 'Medicina Botánica', 'Gastronomía'],
      items: [
        {
          name: 'Hortalizas de Temporada',
          category: 'Cosecha Fresca',
          description: 'Acelgas, col rizada y hierbas aromáticas.',
          badge: 'Fresco del Día',
          image_url: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80',
        },
      ],
    }),
  },
  {
    type: 'products_showcase',
    name: 'Catálogo desde Backend (automático)',
    description: 'Carga automáticamente los productos aprobados del backend. Se actualiza solo cuando agregas productos.',
    defaultData: () => ({
      type: 'products_showcase',
      title: 'Catálogo de Rubros en la Feria',
      subtitle: 'Variedad de alimentos y productos artesanales disponibles en cada jornada.',
      source: 'backend',
      categories: [],
      items: [],
    }),
  },
  {
    type: 'news_feed',
    name: 'Noticias & Boletines',
    description: 'Cuadrícula de artículos y comunicados con fechas y fotos.',
    defaultData: () => ({
      type: 'news_feed',
      badge: 'Boletín Comunitario',
      title: 'Noticias y Articulaciones Populares',
      subtitle: 'Avances de la producción campesina y soberanía alimentaria.',
      items: [
        {
          title: 'Celebración de 10 Años de Encuentro Comunitario',
          date: 'Octubre 2024',
          author: 'Equipo Promotor',
          category: 'Aniversario',
          excerpt: 'Más de 45 familias y marcas se dieron cita en una jornada multitudinaria de mercado y trueque.',
          image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
        },
      ],
    }),
  },
  {
    type: 'timeline_history',
    name: 'Línea de Tiempo Histórica',
    description: 'Hitos cronológicos de la red comunitaria.',
    defaultData: () => ({
      type: 'timeline_history',
      badge: 'Trayectoria',
      title: 'Hitos de Nuestra Historia Colectiva',
      subtitle: 'El camino de la siembra y la soberanía popular.',
      items: [
        { year: '2014', title: 'Nacimiento de la Comunidad', description: 'Primer mercado tras debates de semillas.', badge: 'Fundación' },
        { year: '2015', title: 'Promulgación de la Ley de Semillas', description: 'Victoria popular en la Asamblea Nacional.', badge: 'Ley Popular' },
        { year: '2024', title: '10 Años de Soberanía Activa', description: 'Consolidación de la red y sistema digital de trueque.', badge: 'Presente' },
      ],
    }),
  },
  {
    type: 'calculator_preview',
    name: 'Simulador de Valor Energético (kWh)',
    description: 'Widget interactivo que permite calcular el valor en Trueques (1 TQ = 1 kWh).',
    defaultData: () => ({
      type: 'calculator_preview',
      title: 'Calcula el Valor Energético de tu Producción',
      subtitle: 'Simulador interactivo basado en horas de trabajo y factores de esfuerzo físico.',
    }),
  },
  {
    type: 'testimonials',
    name: 'Testimonios & Voces Conuqueras',
    description: 'Tarjetas de productores y miembros con citas, nombres y fotos.',
    defaultData: () => ({
      type: 'testimonials',
      title: 'Voces de la Comunidad',
      subtitle: 'Experiencias de las familias que construyen la red.',
      items: [
        {
          name: 'Familia Miranda',
          role: 'Alfivegetales',
          project: 'El Junquito Km 38',
          quote: 'Sembrar agroecológicamente es cuidar el futuro de nuestras familias.',
          location: 'El Junquito, Miranda',
        },
      ],
    }),
  },
  {
    type: 'trueque_explainer',
    name: 'Explicador de Trueque / Saldo Cero',
    description: 'Diagrama visual de 4 pasos explicando el crédito mutuo.',
    defaultData: () => ({
      type: 'trueque_explainer',
      title: '¿Cómo Funciona el Trueque?',
      subtitle: 'Sistema contable de crédito mutuo donde lo que das y recibes suma cero.',
      energy_rate_text: '1 TQ = 1 kWh de energía',
      steps: [
        { step: 1, title: 'Empiezas en 0 TQ', description: 'Sin necesidad de aportar dinero.', icon: 'users' },
        { step: 2, title: 'Al Recibir Bienes', description: 'Tu saldo pasa a negativo (-TQ).', icon: 'shopping-cart' },
        { step: 3, title: 'Al Entregar Trabajo', description: 'Tu saldo pasa a positivo (+TQ).', icon: 'leaf' },
        { step: 4, title: 'Suma Siempre Cero', description: 'Sin inflación ni especulación.', icon: 'scale' },
      ],
      key_points: {
        positive_balance: 'Aportes entregados pendientes de retribución por la comunidad.',
        negative_balance: 'Compromiso adquirido de retribuir bienes o trabajo.',
        zero_sum: 'Registro contable de aportes en energía para intercambio diferido.',
      },
    }),
  },
  {
    type: 'faq',
    name: 'Preguntas Frecuentes (FAQ)',
    description: 'Acordeón de preguntas y respuestas desplegables.',
    defaultData: () => ({
      type: 'faq',
      title: 'Preguntas Frecuentes',
      subtitle: 'Dudas sobre compras en moneda local, trueque y asambleas.',
      items: [
        {
          question: '¿Necesito ser miembro para comprar?',
          answer: '¡No! El mercado mensual está abierto a todo el público en moneda local.',
        },
      ],
    }),
  },
  {
    type: 'cta_banner',
    name: 'Llamado a la Acción (CTA Banner)',
    description: 'Banner temático para invitar a unirse o participar.',
    defaultData: () => ({
      type: 'cta_banner',
      badge: 'Únete a la Red',
      title: '¿Quieres ser parte de la Feria?',
      subtitle: 'La asamblea trimestral evalúa postulaciones de productores.',
      button_text: 'Solicitar Admisión',
      button_link: '/p/unirse',
      theme: 'forest',
    }),
  },
  {
    type: 'contact_location',
    name: 'Contacto & Ubicación',
    description: 'Tarjetas de dirección, horarios, metro y redes sociales.',
    defaultData: () => ({
      type: 'contact_location',
      title: 'Visítanos',
      address: '',
      schedule: 'Primer sábado de cada mes de 9:00 AM a 1:00 PM',
      instagram: '',
      facebook: '',
      email: '',
    }),
  },
]

// Helper to set a nested field by dot path (e.g. "items.0.title", "quote.text")
function setNestedField(obj: any, path: string, value: any) {
  const parts = path.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (/^\d+$/.test(part)) {
      const idx = parseInt(part)
      if (!Array.isArray(current)) return
      current = current[idx]
    } else {
      if (current[part] === undefined) current[part] = {}
      current = current[part]
    }
  }
  const last = parts[parts.length - 1]
  if (/^\d+$/.test(last)) {
    (current as any[])[parseInt(last)] = value
  } else {
    current[last] = value
  }
}

interface LivePageEditorProps {
  pageId?: string
  slug: string
  title: string
  subtitle?: string
  icon?: string
  menuOrder?: number
  isPublished?: boolean
  showInMenu?: boolean
  initialBlocks: SiteBlock[]
  onExit: () => void
  onSaved?: () => void
}

export function LivePageEditor({
  pageId,
  slug,
  title,
  subtitle,
  icon,
  menuOrder,
  isPublished,
  showInMenu,
  initialBlocks,
  onExit,
  onSaved,
}: LivePageEditorProps) {
  const [blocks, setBlocks] = useState<SiteBlock[]>(initialBlocks)
  const [activeInspectorIndex, setActiveInspectorIndex] = useState<number | null>(null)
  const [insertModalIndex, setInsertModalIndex] = useState<number | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState('')

  // Move block up/down
  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= blocks.length) return
    const updated = [...blocks]
    const temp = updated[index]
    updated[index] = updated[target]
    updated[target] = temp
    setBlocks(updated)
    setHasChanges(true)
    if (activeInspectorIndex === index) setActiveInspectorIndex(target)
    else if (activeInspectorIndex === target) setActiveInspectorIndex(index)
  }

  // Duplicate block
  const duplicateBlock = (index: number) => {
    const clone = JSON.parse(JSON.stringify(blocks[index]))
    const updated = [...blocks.slice(0, index + 1), clone, ...blocks.slice(index + 1)]
    setBlocks(updated)
    setHasChanges(true)
    setActiveInspectorIndex(index + 1)
  }

  // Delete block
  const deleteBlock = (index: number) => {
    if (!confirm('¿Eliminar este módulo de la página?')) return
    const updated = blocks.filter((_, i) => i !== index)
    setBlocks(updated)
    setHasChanges(true)
    if (activeInspectorIndex === index) setActiveInspectorIndex(null)
    else if (activeInspectorIndex !== null && activeInspectorIndex > index) {
      setActiveInspectorIndex(activeInspectorIndex - 1)
    }
  }

  // Insert block at specific index
  const insertBlockAt = (index: number, type: BlockType) => {
    const tmpl = BLOCK_TEMPLATES.find((t) => t.type === type)
    if (!tmpl) return
    const newBlock = tmpl.defaultData()
    const updated = [...blocks.slice(0, index), newBlock, ...blocks.slice(index)]
    setBlocks(updated)
    setHasChanges(true)
    setInsertModalIndex(null)
    setActiveInspectorIndex(index)
  }

  // Update specific block data
  const updateBlock = (index: number, updatedBlock: SiteBlock) => {
    const updated = [...blocks]
    updated[index] = updatedBlock
    setBlocks(updated)
    setHasChanges(true)
  }

  // Save changes to backend
  const saveChanges = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        slug,
        title,
        subtitle: subtitle || '',
        icon: icon || 'home',
        menu_order: menuOrder || 1,
        is_published: isPublished ?? true,
        show_in_menu: showInMenu ?? true,
        content: JSON.stringify(blocks, null, 2),
      }

      await api.put(`/site/pages/by-slug/${slug}`, payload)

      setHasChanges(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      if (onSaved) onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative min-h-screen pb-28">
      {/* 1. TOP FLOATING LIVE BUILDER CONTROLS BAR */}
      <div className="sticky top-14 sm:top-16 z-40 bg-emerald-950/95 text-white backdrop-blur-md border-y border-emerald-700/50 px-3 sm:px-6 py-2.5 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="flex items-center gap-1.5 text-xs font-bold bg-amber-500 text-gray-950 px-3 py-1 rounded-full shadow-xs animate-pulse">
            <Sparkles size={13} />
            Edición en Vivo
          </span>
          <span className="text-xs text-emerald-200 hidden sm:inline font-mono">
            /p/{slug} ({blocks.length} módulos)
          </span>
          <span className="text-[11px] text-amber-200 hidden md:inline">
            💡 Clic en cualquier texto para editarlo · Clic en imágenes para cambiarlas
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-[11px] text-amber-300 font-semibold hidden md:inline">
              ● Cambios pendientes
            </span>
          )}

          <button
            onClick={() => setInsertModalIndex(blocks.length)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 transition shadow-xs"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Añadir Módulo</span>
          </button>

          <button
            onClick={saveChanges}
            disabled={saving}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-extrabold text-white transition shadow-md ${
              hasChanges
                ? 'bg-amber-600 hover:bg-amber-500 ring-2 ring-amber-400/50'
                : 'bg-emerald-700 hover:bg-emerald-600'
            }`}
          >
            {saveSuccess ? (
              <>
                <Check size={14} className="text-white" />
                ¡Guardado!
              </>
            ) : (
              <>
                <Save size={14} />
                {saving ? 'Guardando...' : 'Guardar en Vivo'}
              </>
            )}
          </button>

          <button
            onClick={onExit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition border border-white/15"
            title="Salir del modo edición y ver la página limpia"
          >
            <Eye size={14} />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-3">
          <div className="p-3 bg-red-100 text-red-800 text-xs rounded-xl border border-red-200 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')}><X size={14} /></button>
          </div>
        </div>
      )}

      {/* 2. VISUAL CANVAS (All Blocks Rendered Live with On-Page Toolbars) */}
      <div className="space-y-6 pt-4">
        {/* Top Insert Button */}
        <div className="text-center py-1">
          <button
            onClick={() => setInsertModalIndex(0)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-800 text-white hover:bg-emerald-700 shadow-sm transition opacity-70 hover:opacity-100"
          >
            <Plus size={13} />
            Insertar Módulo al Inicio
          </button>
        </div>

        {blocks.map((block, index) => {
          const isSelected = activeInspectorIndex === index

          return (
            <React.Fragment key={index}>
              {/* Module Visual Container with Live Actions */}
              <div
                className={`relative group rounded-3xl transition-all duration-200 ${
                  isSelected
                    ? 'ring-4 ring-emerald-500/80 shadow-2xl bg-emerald-50/10'
                    : 'hover:ring-2 hover:ring-emerald-400/60'
                }`}
              >
                {/* On-Block Floating Action Toolbar */}
                <div className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-gray-950/90 text-white p-1 rounded-xl shadow-xl border border-white/20 backdrop-blur-sm opacity-90 group-hover:opacity-100 transition">
                  <span className="text-[10px] font-bold text-amber-400 px-2 uppercase tracking-wider">
                    #{index + 1} {block.type}
                  </span>

                  <button
                    onClick={() => moveBlock(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-300 hover:text-white disabled:opacity-20"
                    title="Mover arriba"
                  >
                    <ArrowUp size={14} />
                  </button>

                  <button
                    onClick={() => moveBlock(index, 'down')}
                    disabled={index === blocks.length - 1}
                    className="p-1 text-gray-300 hover:text-white disabled:opacity-20"
                    title="Mover abajo"
                  >
                    <ArrowDown size={14} />
                  </button>

                  <button
                    onClick={() => duplicateBlock(index)}
                    className="p-1 text-gray-300 hover:text-blue-400"
                    title="Duplicar módulo"
                  >
                    <Copy size={14} />
                  </button>

                  <button
                    onClick={() => deleteBlock(index)}
                    className="p-1 text-gray-300 hover:text-red-400"
                    title="Eliminar módulo"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Actual Live Module Rendering - WYSIWYG inline editing */}
                <div className="pointer-events-auto">
                  <BlockRenderer
                    block={block}
                    editMode
                    onFieldChange={(path, value) => {
                      const updated = [...blocks]
                      const newBlock = JSON.parse(JSON.stringify(updated[index])) as SiteBlock
                      setNestedField(newBlock, path, value)
                      updated[index] = newBlock
                      setBlocks(updated)
                      setHasChanges(true)
                    }}
                    onArrayChange={(action, arrayField, index, item) => {
                      const updated = [...blocks]
                      const newBlock = JSON.parse(JSON.stringify(updated[index])) as SiteBlock
                      if (action === 'add') {
                        const arr = (newBlock as any)[arrayField]
                        if (Array.isArray(arr)) {
                          arr.push(item)
                        } else {
                          (newBlock as any)[arrayField] = [item]
                        }
                      } else if (action === 'remove' && index !== undefined) {
                        const arr = (newBlock as any)[arrayField]
                        if (Array.isArray(arr)) {
                          arr.splice(index, 1)
                        }
                      }
                      updated[index] = newBlock
                      setBlocks(updated)
                      setHasChanges(true)
                    }}
                  />
                </div>
              </div>

              {/* In-Between Insert Button */}
              <div className="text-center py-1 opacity-40 hover:opacity-100 transition flex items-center justify-center gap-2">
                <div className="h-px bg-emerald-300 flex-1" />
                <button
                  onClick={() => setInsertModalIndex(index + 1)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-50 shadow-xs transition"
                >
                  <Plus size={12} />
                  Insertar Módulo Aquí
                </button>
                <div className="h-px bg-emerald-300 flex-1" />
              </div>
            </React.Fragment>
          )
        })}

        {blocks.length === 0 && (
          <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-gray-300 space-y-3">
            <Layers size={40} className="mx-auto text-gray-400" />
            <h3 className="text-lg font-bold text-gray-700">Esta página está vacía</h3>
            <p className="text-xs text-gray-500">Comienza insertando un encabezado o un carrusel de fotos.</p>
            <button
              onClick={() => setInsertModalIndex(0)}
              className="btn-primary text-xs inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              Añadir Primer Módulo
            </button>
          </div>
        )}
      </div>

      {/* 3. MODAL: INSERT MODULE */}
      {insertModalIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Plus size={20} className="text-emerald-800" />
                  Insertar Módulo en la Posición #{insertModalIndex + 1}
                </h3>
                <p className="text-xs text-gray-500">Selecciona el tipo de bloque visual que deseas añadir.</p>
              </div>
              <button
                onClick={() => setInsertModalIndex(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-2.5 overflow-y-auto pr-1 flex-1">
              {BLOCK_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.type}
                  onClick={() => insertBlockAt(insertModalIndex, tmpl.type)}
                  className="p-3.5 rounded-2xl border border-gray-200 hover:border-emerald-600 hover:bg-emerald-50/50 text-left transition flex items-start gap-3 group"
                >
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-900 group-hover:bg-emerald-800 group-hover:text-white transition flex-shrink-0">
                    <Plus size={18} />
                  </div>
                  <div className="min-w-0">
                    <b className="text-xs sm:text-sm text-gray-900 block group-hover:text-emerald-900">
                      {tmpl.name}
                    </b>
                    <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">
                      {tmpl.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// LIVE BLOCK CUSTOMIZER (Inspector Fields)
// -------------------------------------------------------------
function LiveBlockCustomizer({
  block,
  onChange,
}: {
  block: SiteBlock
  onChange: (updated: SiteBlock) => void
}) {
  const update = (field: string, val: any) => {
    onChange({ ...block, [field]: val } as SiteBlock)
  }

  return (
    <div className="space-y-3.5">
      {'title' in block && (
        <div>
          <label className="label text-xs font-bold">Título</label>
          <input
            className="input text-xs"
            value={block.title || ''}
            onChange={(e) => update('title', e.target.value)}
          />
        </div>
      )}

      {'subtitle' in block && (
        <div>
          <label className="label text-xs font-bold">Subtítulo</label>
          <input
            className="input text-xs"
            value={block.subtitle || ''}
            onChange={(e) => update('subtitle', e.target.value)}
          />
        </div>
      )}

      {'badge' in block && (
        <div>
          <label className="label text-xs font-bold">Insignia / Badge</label>
          <input
            className="input text-xs"
            value={block.badge || ''}
            onChange={(e) => update('badge', e.target.value)}
          />
        </div>
      )}

      {'image_url' in block && (
        <div>
          <label className="label text-xs font-bold">URL de la Imagen</label>
          <input
            className="input text-xs"
            value={block.image_url || ''}
            onChange={(e) => update('image_url', e.target.value)}
          />
          {/* Preset Photos */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-[10px] text-gray-500 font-bold block w-full">Fotos de muestra:</span>
            {[
              { label: 'Hortalizas', url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80' },
              { label: 'Siembra', url: 'https://images.unsplash.com/photo-1592417817098-8f3d69102a5e?auto=format&fit=crop&w=900&q=80' },
              { label: 'Cosecha', url: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=1000&q=80' },
              { label: 'Ecoaldea', url: 'https://images.unsplash.com/photo-1516253593875-bd7ba052fbc5?auto=format&fit=crop&w=1200&q=80' },
            ].map((pic, i) => (
              <button
                key={i}
                type="button"
                onClick={() => update('image_url', pic.url)}
                className="px-2 py-0.5 rounded bg-gray-100 hover:bg-emerald-100 text-[10px] text-gray-700"
              >
                {pic.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {'description' in block && (
        <div>
          <label className="label text-xs font-bold">Descripción</label>
          <textarea
            rows={3}
            className="input text-xs"
            value={(block as any).description || ''}
            onChange={(e) => update('description', e.target.value)}
          />
        </div>
      )}

      {/* Hero Buttons */}
      {block.type === 'hero' && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <label className="label text-xs font-bold">Botón Principal</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input text-xs"
              placeholder="Texto"
              value={block.primary_cta?.text || ''}
              onChange={(e) =>
                update('primary_cta', { ...block.primary_cta, text: e.target.value, link: block.primary_cta?.link || '/p/productos' })
              }
            />
            <input
              className="input text-xs"
              placeholder="Enlace (/p/...)"
              value={block.primary_cta?.link || ''}
              onChange={(e) =>
                update('primary_cta', { ...block.primary_cta, link: e.target.value, text: block.primary_cta?.text || 'Ver Más' })
              }
            />
          </div>
        </div>
      )}

      {/* Carousel items */}
      {block.type === 'carousel' && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <label className="label text-xs font-bold">Fotos ({block.items.length})</label>
            <button
              type="button"
              onClick={() => {
                const newItems = [
                  ...block.items,
                  {
                    image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
                    title: 'Nueva Foto',
                    caption: 'Descripción de la foto',
                    tag: 'Feria',
                  },
                ]
                update('items', newItems)
              }}
              className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded"
            >
              + Añadir Foto
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {block.items.map((it, idx) => (
              <div key={idx} className="p-2 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-gray-700">
                  <span>Foto #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => update('items', block.items.filter((_, i) => i !== idx))}
                    className="text-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <input
                  className="input text-[11px]"
                  placeholder="URL Imagen"
                  value={it.image_url}
                  onChange={(e) => {
                    const newItems = [...block.items]
                    newItems[idx].image_url = e.target.value
                    update('items', newItems)
                  }}
                />
                <input
                  className="input text-[11px]"
                  placeholder="Título"
                  value={it.title || ''}
                  onChange={(e) => {
                    const newItems = [...block.items]
                    newItems[idx].title = e.target.value
                    update('items', newItems)
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cards items */}
      {block.type === 'features_grid' && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <label className="label text-xs font-bold">Tarjetas ({block.items.length})</label>
            <button
              type="button"
              onClick={() => {
                const newItems = [
                  ...block.items,
                  { icon: 'leaf', title: 'Nueva Tarjeta', description: 'Descripción de la tarjeta', badge: 'Nuevo' },
                ]
                update('items', newItems)
              }}
              className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded"
            >
              + Añadir
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {block.items.map((it, idx) => (
              <div key={idx} className="p-2 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-gray-700">
                  <span>Tarjeta #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => update('items', block.items.filter((_, i) => i !== idx))}
                    className="text-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <input
                  className="input text-[11px] font-bold"
                  placeholder="Título"
                  value={it.title}
                  onChange={(e) => {
                    const newItems = [...block.items]
                    newItems[idx].title = e.target.value
                    update('items', newItems)
                  }}
                />
                <textarea
                  rows={2}
                  className="input text-[11px]"
                  placeholder="Descripción"
                  value={it.description}
                  onChange={(e) => {
                    const newItems = [...block.items]
                    newItems[idx].description = e.target.value
                    update('items', newItems)
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RichText */}
      {block.type === 'richtext' && (
        <div>
          <label className="label text-xs font-bold">Contenido</label>
          <textarea
            rows={6}
            className="input text-xs font-mono"
            value={block.content}
            onChange={(e) => update('content', e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
