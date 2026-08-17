import React, { useState, useEffect } from 'react'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import {
  HelpCircle,
  Plus,
  Edit,
  Trash2,
  Save,
  Globe,
  Settings as SettingsIcon,
  FileText,
  Mail,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  Copy,
  Eye,
  Sparkles,
  Layers,
  Image as ImageIcon,
  LayoutGrid,
  Columns,
  BarChart3,
  Calendar,
  ShoppingCart,
  MessageSquare,
  Scale,
  ListOrdered,
  HelpCircle as FaqIcon,
  Phone,
  Code,
  RotateCcw,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { SiteBlock, BlockType, PublicPageData } from '../types/publicSite'
import { FERIA_CONUQUERA_TEMPLATES } from '../components/public-site/defaultSiteData'
import { PageBlocksRenderer } from '../components/public-site/PublicBlocks'

const BLOCK_DEFINITIONS: {
  type: BlockType
  name: string
  description: string
  icon: any
  defaultData: (title?: string) => SiteBlock
}[] = [
  {
    type: 'hero',
    name: 'Encabezado / Hero Banner',
    description: 'Cabecera destacada con título, subtítulo, imagen de fondo o lateral y botones de llamada a la acción.',
    icon: Sparkles,
    defaultData: (t) => ({
      type: 'hero',
      badge: '🌱 Bienvenidos',
      title: t || 'Feria Conuquera Agroecológica',
      subtitle: 'Soberanía alimentaria y economía solidaria',
      description: 'Espacio de encuentro popular y trueque comunitario.',
      image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
      primary_cta: { text: 'Ver Productos', link: '/p/productos' },
      secondary_cta: { text: 'Unirse', link: '/p/unirse' },
      style: 'split',
    }),
  },
  {
    type: 'carousel',
    name: 'Álbum / Carrusel de Fotos',
    description: 'Galería interactiva con transiciones, leyendas y vista en pantalla completa.',
    icon: ImageIcon,
    defaultData: () => ({
      type: 'carousel',
      title: 'Galería de Nuestras Jornadas',
      subtitle: 'Imágenes vivas de cosechas y saberes compartidos.',
      autoplay: true,
      items: [
        {
          image_url: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=1000&q=80',
          title: 'Hortalizas Frescas',
          caption: 'Cosecha de la mañana sin químicos ni agrotóxicos.',
          tag: 'Cosecha',
        },
        {
          image_url: 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=1000&q=80',
          title: 'Botica Conuquera',
          caption: 'Medicina botánica y cosmética natural.',
          tag: 'Salud',
        },
      ],
    }),
  },
  {
    type: 'features_grid',
    name: 'Cuadrícula de Tarjetas / Pilares',
    description: 'Tarjetas informativas en 2, 3 o 4 columnas con iconos, etiquetas y descripciones.',
    icon: LayoutGrid,
    defaultData: () => ({
      type: 'features_grid',
      title: 'Nuestros Pilares Comunitarios',
      subtitle: 'Principios rectores de nuestra red de intercambio.',
      columns: 3,
      items: [
        {
          icon: 'leaf',
          title: 'Agroecología',
          description: 'Producción limpia en armonía con los ciclos de la tierra.',
          badge: 'Suelo Vivo',
        },
        {
          icon: 'users',
          title: 'Comercio Justo',
          description: 'Relación directa sin intermediarios ni usura.',
          badge: 'Solidario',
        },
        {
          icon: 'scale',
          title: 'Trueque & Crédito Mutuo',
          description: 'Contabilidad de suma cero respaldada en energía.',
          badge: 'Moneda Social',
        },
      ],
    }),
  },
  {
    type: 'split_story',
    name: 'Sección Dividida (Texto + Imagen)',
    description: 'Historia o sección descriptiva con foto a un lado, puntos clave y cita textual.',
    icon: Columns,
    defaultData: () => ({
      type: 'split_story',
      badge: 'Historia Viva',
      title: 'El Conuco como Forma de Resistencia',
      subtitle: 'Saberes ancestrales y soberanía popular',
      content: 'El conuco es más que un cultivo: es un laboratorio integral de vida comunitaria.',
      image_url: 'https://images.unsplash.com/photo-1592417817098-8f3d69102a5e?auto=format&fit=crop&w=900&q=80',
      image_position: 'left',
      highlights: ['Sin agrotóxicos ni venenos.', 'Semillas libres y criollas.'],
      quote: { text: 'La abundancia nace del respeto a la diversidad.', author: 'Vocería Conuquera' },
    }),
  },
  {
    type: 'stats',
    name: 'Contador de Estadísticas / Impacto',
    description: 'Bloque de números destacados (años de historia, productores, impacto).',
    icon: BarChart3,
    defaultData: () => ({
      type: 'stats',
      title: 'Impacto Comunitario',
      subtitle: 'Cifras reales de nuestra red agroecológica.',
      bg_theme: 'primary',
      items: [
        { value: '+10 Años', label: 'De Trayectoria', description: 'Encuentros mensuales' },
        { value: '+45 Familias', label: 'Productoras', description: 'Del campo a la ciudad' },
        { value: '0%', label: 'Agrotóxicos', description: '100% limpia' },
        { value: '100%', label: 'Trueque', description: 'Crédito mutuo' },
      ],
    }),
  },
  {
    type: 'event_schedule',
    name: 'Próximo Encuentro / Horarios',
    description: 'Tarjeta destacada de fecha, horario, lugar y normas ecológicas de la feria.',
    icon: Calendar,
    defaultData: () => ({
      type: 'event_schedule',
      badge: '📍 Próxima Cita',
      title: 'Encuentro Mensual en Los Caobos',
      date_text: 'Primer sábado de cada mes',
      time_text: '9:00 AM a 1:00 PM',
      location_name: 'Parque Los Caobos, Caracas',
      address: 'Zona Sur, cerca de la Fuente Venezuela (Metro Bellas Artes).',
      guidelines: [
        'Prohibido el uso de bolsas plásticas desechables.',
        'Trueque libre de semillas y libros disponible.',
      ],
      cta_text: 'Solicitar Unirse',
      cta_link: '/p/unirse',
    }),
  },
  {
    type: 'products_showcase',
    name: 'Catálogo de Productos',
    description: 'Galería filtrable por categorías con fotos, etiquetas y valor en energía.',
    icon: ShoppingCart,
    defaultData: () => ({
      type: 'products_showcase',
      title: 'Nuestros Productos y Sabores',
      subtitle: 'Cosecha fresca, medicina botánica y gastronomía artesanal.',
      categories: ['Cosecha Fresca', 'Medicina Botánica', 'Gastronomía'],
      items: [
        {
          name: 'Hortalizas de Temporada',
          category: 'Cosecha Fresca',
          description: 'Acelgas, col rizada, lechugas y hierbas aromáticas.',
          badge: 'Fresco del Día',
          image_url: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80',
        },
      ],
    }),
  },
  {
    type: 'testimonials',
    name: 'Testimonios / Voces Conuqueras',
    description: 'Tarjetas de productores y miembros con citas, nombres, roles y fotos.',
    icon: MessageSquare,
    defaultData: () => ({
      type: 'testimonials',
      title: 'Voces de la Comunidad',
      subtitle: 'Experiencias de las familias que construyen la red.',
      items: [
        {
          name: 'Familia Miranda',
          role: 'Alfivegetales',
          project: 'El Junquito Km 38',
          quote: 'Sembrar agroecológicamente es cuidar el futuro de nuestras familias y de Caracas.',
          location: 'El Junquito, Miranda',
        },
      ],
    }),
  },
  {
    type: 'trueque_explainer',
    name: 'Explicador de Trueque / Saldo Cero',
    description: 'Diagrama visual de 4 pasos explicando cómo funciona la contabilidad de crédito mutuo.',
    icon: Scale,
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
        positive_balance: 'Compromiso de entrega de la comunidad hacia ti.',
        negative_balance: 'Compromiso de retribuir bienes o trabajo.',
        zero_sum: 'Todo el sistema permanece en equilibrio perfecto.',
      },
    }),
  },
  {
    type: 'faq',
    name: 'Preguntas Frecuentes (FAQ)',
    description: 'Acordeón interactivo de preguntas y respuestas desplegables.',
    icon: FaqIcon,
    defaultData: () => ({
      type: 'faq',
      title: 'Preguntas Frecuentes',
      subtitle: 'Dudas comunes sobre la feria y el trueque.',
      items: [
        {
          question: '¿Cuándo nos reunimos?',
          answer: 'El primer sábado de cada mes en el Parque Los Caobos, Caracas.',
        },
      ],
    }),
  },
  {
    type: 'cta_banner',
    name: 'Llamado a la Acción (CTA Banner)',
    description: 'Banner destacado para invitar a unirse, visitar o participar.',
    icon: Sparkles,
    defaultData: () => ({
      type: 'cta_banner',
      badge: 'Únete a la Red',
      title: '¿Quieres ser parte de la Feria?',
      subtitle: 'La asamblea evalúa postulaciones de productores agroecológicos.',
      button_text: 'Solicitar Admisión',
      button_link: '/p/unirse',
      theme: 'forest',
    }),
  },
  {
    type: 'richtext',
    name: 'Texto Enriquecido / Markdown',
    description: 'Bloque libre para párrafos, manifiestos o comunicados.',
    icon: FileText,
    defaultData: () => ({
      type: 'richtext',
      title: '',
      content: 'Escribe aquí tu contenido en texto o formato Markdown...',
    }),
  },
  {
    type: 'contact_location',
    name: 'Contacto y Ubicación',
    description: 'Información de redes sociales, dirección, metro, teléfono y correo.',
    icon: Phone,
    defaultData: () => ({
      type: 'contact_location',
      title: 'Contacto y Canales',
      address: 'Parque Los Caobos, Caracas, Venezuela.',
      schedule: 'Primer sábado de cada mes de 9:00 AM a 1:00 PM',
      instagram: 'feriaconuquera',
      facebook: 'feriaconuquera',
      email: 'contacto@feriaconuquera.org',
    }),
  },
]

export default function WebsiteAdmin() {
  const { hasPermission } = usePermissions()
  const canManage = hasPermission('config.manage')

  const [tab, setTab] = useState<'pages' | 'builder' | 'settings' | 'admission'>('pages')
  const [pages, setPages] = useState<any[]>([])
  const [settings, setSettings] = useState<any>({})
  const [admissionRequests, setAdmissionRequests] = useState<any[]>([])
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Builder State
  const [selectedPage, setSelectedPage] = useState<any>(null)
  const [pageMeta, setPageMeta] = useState({
    title: '',
    subtitle: '',
    slug: '',
    icon: 'home',
    menu_order: 1,
    is_published: true,
    show_in_menu: true,
  })
  const [blocks, setBlocks] = useState<SiteBlock[]>([])
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null)
  const [showAddBlockModal, setShowAddBlockModal] = useState(false)
  const [rawJsonMode, setRawJsonMode] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    site_title: '',
    site_subtitle: '',
    logo_url: '',
    primary_color: '#1e3a1e',
    secondary_color: '#c85a32',
    contact_email: '',
    contact_phone: '',
    contact_address: '',
    social_instagram: '',
    social_facebook: '',
    social_twitter: '',
    show_join_form: true,
  })

  const load = () => {
    api.get('/site/pages').then((d: any) => setPages(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/site/settings').then(setSettings).catch(() => {})
    api.get('/admission-requests').then((d: any) => setAdmissionRequests(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (settings && settings.site_title) {
      setSettingsForm({
        site_title: settings.site_title || '',
        site_subtitle: settings.site_subtitle || '',
        logo_url: settings.logo_url || '',
        primary_color: settings.primary_color || '#1e3a1e',
        secondary_color: settings.secondary_color || '#c85a32',
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

  // Open a page in the Modular Builder
  const openPageBuilder = (page: any) => {
    setSelectedPage(page)
    setPageMeta({
      title: page.title || '',
      subtitle: page.subtitle || '',
      slug: page.slug || '',
      icon: page.icon || 'home',
      menu_order: page.menu_order || 1,
      is_published: page.is_published ?? true,
      show_in_menu: page.show_in_menu ?? true,
    })

    // Parse blocks from content
    let parsedBlocks: SiteBlock[] = []
    try {
      if (page.content) {
        const parsed = JSON.parse(page.content)
        if (Array.isArray(parsed)) {
          parsedBlocks = parsed
        }
      }
    } catch {
      // Fallback: convert markdown string to a rich text block
      if (page.content) {
        parsedBlocks = [{ type: 'richtext', title: page.title, content: page.content }]
      }
    }

    // If still empty, check default templates
    if (parsedBlocks.length === 0) {
      const tmpl = FERIA_CONUQUERA_TEMPLATES.find((t) => t.slug === page.slug)
      if (tmpl) {
        parsedBlocks = JSON.parse(JSON.stringify(tmpl.blocks))
      }
    }

    setBlocks(parsedBlocks)
    setEditingBlockIndex(null)
    setTab('builder')
  }

  // Save the page with all modular blocks
  const saveCurrentPage = async () => {
    setError('')
    setSuccess('')
    if (!pageMeta.title || !pageMeta.slug) {
      setError('El título y el slug son obligatorios')
      return
    }

    try {
      const payload = {
        ...pageMeta,
        content: JSON.stringify(blocks, null, 2),
      }

      if (selectedPage?.id) {
        await api.put(`/site/pages/${selectedPage.id}`, payload)
        setSuccess('¡Página y módulos guardados con éxito!')
      } else {
        await api.post('/site/pages', payload)
        setSuccess('¡Página creada con éxito!')
      }
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la página')
    }
  }

  // Add block to current page
  const addBlock = (type: BlockType) => {
    const def = BLOCK_DEFINITIONS.find((b) => b.type === type)
    if (def) {
      const newBlock = def.defaultData(pageMeta.title)
      const updated = [...blocks, newBlock]
      setBlocks(updated)
      setEditingBlockIndex(updated.length - 1)
      setShowAddBlockModal(false)
    }
  }

  // Move block Up / Down
  const moveBlock = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= blocks.length) return
    const updated = [...blocks]
    const temp = updated[idx]
    updated[idx] = updated[targetIdx]
    updated[targetIdx] = temp
    setBlocks(updated)
    if (editingBlockIndex === idx) setEditingBlockIndex(targetIdx)
    else if (editingBlockIndex === targetIdx) setEditingBlockIndex(idx)
  }

  // Duplicate block
  const duplicateBlock = (idx: number) => {
    const cloned = JSON.parse(JSON.stringify(blocks[idx]))
    const updated = [...blocks.slice(0, idx + 1), cloned, ...blocks.slice(idx + 1)]
    setBlocks(updated)
    setEditingBlockIndex(idx + 1)
  }

  // Delete block
  const deleteBlock = (idx: number) => {
    if (!confirm('¿Eliminar este módulo?')) return
    const updated = blocks.filter((_, i) => i !== idx)
    setBlocks(updated)
    if (editingBlockIndex === idx) setEditingBlockIndex(null)
    else if (editingBlockIndex !== null && editingBlockIndex > idx) {
      setEditingBlockIndex(editingBlockIndex - 1)
    }
  }

  // Reset / Populate all preconfigured templates for Feria Conuquera
  const applyAllFeriaTemplates = async () => {
    if (
      !confirm(
        '¿Deseas aplicar la plantilla completa con todos los módulos y fotos de la Feria Conuquera en Caracas? Esto actualizará las páginas públicas existentes con el diseño enriquecido.'
      )
    )
      return

    setError('')
    setSuccess('')
    try {
      for (const tmpl of FERIA_CONUQUERA_TEMPLATES) {
        const existing = pages.find((p) => p.slug === tmpl.slug)
        const payload = {
          slug: tmpl.slug,
          title: tmpl.title,
          subtitle: tmpl.subtitle,
          icon: tmpl.icon,
          menu_order: tmpl.menu_order,
          is_published: true,
          show_in_menu: true,
          content: JSON.stringify(tmpl.blocks, null, 2),
        }

        if (existing?.id) {
          await api.put(`/site/pages/${existing.id}`, payload)
        } else {
          await api.post('/site/pages', payload)
        }
      }
      setSuccess('¡Plantilla modular de la Feria Conuquera aplicada con éxito a todas las páginas!')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al aplicar plantillas')
    }
  }

  // Save site settings
  const saveSettings = async () => {
    setError('')
    setSuccess('')
    try {
      await api.put('/site/settings', settingsForm)
      setSuccess('Configuración del sitio guardada')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  // Review admission request
  const reviewAdmission = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await api.put(`/admission-requests/${id}`, { status })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-2.5">
            <Globe className="text-trueque-600" size={28} />
            Administración del Sitio Web Público
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Editor visual modular, personalización de temas y gestión de solicitudes de admisión.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs sm:text-sm flex items-center gap-1.5"
          >
            <Eye size={16} />
            Ver Sitio Público
          </a>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            title="Ayuda"
          >
            <HelpCircle size={22} />
          </button>
        </div>
      </div>

      {/* Help Banner */}
      {showHelp && (
        <div className="card bg-emerald-50/70 border-emerald-200 text-sm text-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-emerald-900 flex items-center gap-1.5">
              <Sparkles size={18} className="text-amber-500" />
              Guía del Editor Modular del Sitio Web
            </h3>
            <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <p>
            <b>¿Cómo funciona el editor de módulos?</b> Cada página pública se compone de bloques modulares independientes (encabezados, carruseles de fotos, tarjetas de pilares, contadores, testimonios, explicador de trueque, etc.).
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs text-gray-700">
            <li><b>Añadir módulos:</b> Pulsa en "Añadir Módulo" y selecciona una plantilla prediseñada.</li>
            <li><b>Reordenar:</b> Usa las flechas (↑ / ↓) para cambiar el orden en que aparecen.</li>
            <li><b>Editar contenido:</b> Haz clic en "Editar" sobre cualquier módulo para modificar sus textos, imágenes y listas.</li>
            <li><b>Plantilla completa:</b> Puedes pulsar "Aplicar Plantilla Viva de Feria Conuquera" para cargar automáticamente todo el contenido auténtico de Caracas con un solo clic.</li>
          </ul>
        </div>
      )}

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 text-sm border border-emerald-200 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Check size={16} className="text-emerald-600" />
            {success}
          </span>
          <button onClick={() => setSuccess('')}><X size={16} /></button>
        </div>
      )}

      {/* Top Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setTab('pages')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${
            tab === 'pages'
              ? 'bg-trueque-800 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <FileText size={16} />
          Páginas del Sitio ({pages.length})
        </button>

        {selectedPage && (
          <button
            onClick={() => setTab('builder')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${
              tab === 'builder'
                ? 'bg-trueque-800 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Layers size={16} />
            Editor Modular: <span className="text-amber-300 font-normal">{pageMeta.title || selectedPage.title}</span>
          </button>
        )}

        <button
          onClick={() => setTab('settings')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${
            tab === 'settings'
              ? 'bg-trueque-800 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <SettingsIcon size={16} />
          Ajustes Generales y Tema
        </button>

        <button
          onClick={() => setTab('admission')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${
            tab === 'admission'
              ? 'bg-trueque-800 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Mail size={16} />
          Solicitudes de Admisión ({admissionRequests.filter((r) => r.status === 'pending').length} pendientes)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PAGES LIST                                                        */}
      {/* ========================================================================= */}
      {tab === 'pages' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Estructura de Páginas Públicas</h2>
              <p className="text-xs text-gray-500">Selecciona una página para editar sus módulos o crea una nueva.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={applyAllFeriaTemplates}
                className="btn-secondary text-xs sm:text-sm flex items-center gap-1.5 border-amber-300 text-amber-900 hover:bg-amber-50"
                title="Cargar todas las plantillas ricas prediseñadas"
              >
                <RotateCcw size={15} className="text-amber-600" />
                Cargar Plantilla Viva (Feria Conuquera)
              </button>

              <button
                onClick={() => {
                  openPageBuilder({
                    title: 'Nueva Página',
                    slug: `pagina-${pages.length + 1}`,
                    icon: 'leaf',
                    menu_order: pages.length + 1,
                    is_published: true,
                    show_in_menu: true,
                    content: '[]',
                  })
                }}
                className="btn-primary text-xs sm:text-sm flex items-center gap-1.5"
              >
                <Plus size={16} />
                Nueva Página
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map((p) => {
              // Count modules
              let moduleCount = 0
              try {
                const parsed = JSON.parse(p.content)
                if (Array.isArray(parsed)) moduleCount = parsed.length
              } catch {
                if (p.content) moduleCount = 1
              }

              return (
                <div
                  key={p.slug}
                  className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition border border-gray-200 flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                        /p/{p.slug}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          p.is_published ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {p.is_published ? 'Publicada' : 'Borrador'}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-trueque-700 transition">
                      {p.title}
                    </h3>
                    {p.subtitle && (
                      <p className="text-xs text-gray-500 line-clamp-2">{p.subtitle}</p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
                      <Layers size={14} className="text-trueque-600" />
                      <span>{moduleCount} {moduleCount === 1 ? 'módulo' : 'módulos'}</span>
                      <span>•</span>
                      <span>Orden menú: #{p.menu_order}</span>
                    </div>
                  </div>

                  <div className="pt-4 mt-3 border-t border-gray-100 flex items-center justify-between">
                    <button
                      onClick={() => openPageBuilder(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-trueque-700 hover:bg-trueque-800 text-white text-xs font-bold transition shadow-xs"
                    >
                      <Edit size={14} />
                      Editar Módulos
                    </button>

                    <div className="flex items-center gap-1">
                      <a
                        href={`/p/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
                        title="Ver en vivo"
                      >
                        <Eye size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: VISUAL MODULAR BUILDER                                            */}
      {/* ========================================================================= */}
      {tab === 'builder' && selectedPage && (
        <div className="space-y-6">
          {/* Builder Toolbar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTab('pages')}
                className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg text-xs font-semibold"
              >
                ← Volver a lista
              </button>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Editando: <span className="text-trueque-700">{pageMeta.title}</span>
                </h2>
                <p className="text-xs text-gray-500 font-mono">Ruta pública: /p/{pageMeta.slug}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  previewMode
                    ? 'bg-amber-500 text-white shadow'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Eye size={15} />
                {previewMode ? 'Modo Editor' : 'Vista Previa'}
              </button>

              <button
                onClick={() => setRawJsonMode(!rawJsonMode)}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition flex items-center gap-1"
                title="Editar JSON sin formato"
              >
                <Code size={15} />
                JSON
              </button>

              <button
                onClick={saveCurrentPage}
                className="btn-primary text-xs sm:text-sm flex items-center gap-1.5 shadow"
              >
                <Save size={16} />
                Guardar Cambios
              </button>
            </div>
          </div>

          {/* Live Preview Screen */}
          {previewMode ? (
            <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-lg border border-gray-200">
              <div className="border-b border-gray-200 pb-3 mb-6 flex items-center justify-between text-xs text-gray-500">
                <span className="font-bold text-gray-700 flex items-center gap-1.5">
                  <Eye size={15} className="text-amber-500" />
                  Vista Previa en Vivo de /p/{pageMeta.slug}
                </span>
                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                  {blocks.length} módulos cargados
                </span>
              </div>
              <PageBlocksRenderer content={JSON.stringify(blocks)} />
            </div>
          ) : rawJsonMode ? (
            /* Raw JSON Editor */
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
              <h3 className="font-bold text-sm text-gray-800">Editor Directo de Bloques JSON</h3>
              <textarea
                rows={18}
                className="input font-mono text-xs w-full leading-relaxed"
                value={JSON.stringify(blocks, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value)
                    if (Array.isArray(parsed)) setBlocks(parsed)
                  } catch {
                    // Invalid JSON while typing
                  }
                }}
              />
            </div>
          ) : (
            /* Visual Modular Block Builder */
            <div className="grid lg:grid-cols-12 gap-6">
              {/* Left Column: Page Metadata & Block List */}
              <div className="lg:col-span-5 space-y-4">
                {/* Metadata Card */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 space-y-3">
                  <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                    <FileText size={16} className="text-trueque-600" />
                    Propiedades de la Página
                  </h3>

                  <div>
                    <label className="label text-xs font-semibold">Título de la Página</label>
                    <input
                      className="input text-sm"
                      value={pageMeta.title}
                      onChange={(e) => setPageMeta({ ...pageMeta, title: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label text-xs font-semibold">Subtítulo Descriptivo</label>
                    <input
                      className="input text-sm"
                      value={pageMeta.subtitle}
                      onChange={(e) => setPageMeta({ ...pageMeta, subtitle: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs font-semibold">Slug (URL)</label>
                      <input
                        className="input text-sm font-mono"
                        value={pageMeta.slug}
                        onChange={(e) => setPageMeta({ ...pageMeta, slug: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label text-xs font-semibold">Orden en Menú</label>
                      <input
                        type="number"
                        className="input text-sm"
                        value={pageMeta.menu_order}
                        onChange={(e) =>
                          setPageMeta({ ...pageMeta, menu_order: parseInt(e.target.value) || 1 })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-1">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={pageMeta.show_in_menu}
                        onChange={(e) => setPageMeta({ ...pageMeta, show_in_menu: e.target.checked })}
                      />
                      Mostrar en Menú
                    </label>

                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={pageMeta.is_published}
                        onChange={(e) => setPageMeta({ ...pageMeta, is_published: e.target.checked })}
                      />
                      Publicada
                    </label>
                  </div>
                </div>

                {/* Blocks List & Reorder */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                      <Layers size={16} className="text-trueque-600" />
                      Módulos en esta Página ({blocks.length})
                    </h3>
                    <button
                      onClick={() => setShowAddBlockModal(true)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-600 transition shadow-xs"
                    >
                      <Plus size={14} />
                      Añadir Módulo
                    </button>
                  </div>

                  {blocks.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-xs border-2 border-dashed border-gray-200 rounded-xl space-y-2">
                      <Layers size={28} className="mx-auto text-gray-300" />
                      <p>Esta página no tiene módulos aún.</p>
                      <button
                        onClick={() => setShowAddBlockModal(true)}
                        className="text-trueque-700 font-bold hover:underline"
                      >
                        Añadir el primer módulo
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                      {blocks.map((b, idx) => {
                        const def = BLOCK_DEFINITIONS.find((d) => d.type === b.type)
                        const Icon = def?.icon || Layers
                        const isSelected = editingBlockIndex === idx

                        return (
                          <div
                            key={idx}
                            onClick={() => setEditingBlockIndex(idx)}
                            className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                              isSelected
                                ? 'bg-trueque-50 border-trueque-500 shadow-sm'
                                : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                                {idx + 1}
                              </span>
                              <div className="p-1.5 rounded-lg bg-white text-trueque-700 shadow-xs flex-shrink-0">
                                <Icon size={16} />
                              </div>
                              <div className="min-w-0">
                                <b className="text-xs text-gray-900 block truncate">
                                  {def?.name || b.type}
                                </b>
                                <span className="text-[11px] text-gray-500 block truncate">
                                  {(b as any).title || (b as any).badge || def?.description}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => moveBlock(idx, 'up')}
                                disabled={idx === 0}
                                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                                title="Mover arriba"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                onClick={() => moveBlock(idx, 'down')}
                                disabled={idx === blocks.length - 1}
                                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                                title="Mover abajo"
                              >
                                <ArrowDown size={14} />
                              </button>
                              <button
                                onClick={() => duplicateBlock(idx)}
                                className="p-1 text-gray-400 hover:text-blue-600"
                                title="Duplicar módulo"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={() => deleteBlock(idx)}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title="Eliminar módulo"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Active Block Customizer */}
              <div className="lg:col-span-7">
                {editingBlockIndex !== null && blocks[editingBlockIndex] ? (
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                      <div>
                        <span className="text-[11px] font-bold text-trueque-600 uppercase tracking-wider block">
                          Módulo #{editingBlockIndex + 1}
                        </span>
                        <h3 className="font-bold text-base text-gray-900">
                          Personalizar {BLOCK_DEFINITIONS.find((d) => d.type === blocks[editingBlockIndex].type)?.name}
                        </h3>
                      </div>
                      <button
                        onClick={() => setEditingBlockIndex(null)}
                        className="text-xs text-gray-500 hover:text-gray-800"
                      >
                        Cerrar editor
                      </button>
                    </div>

                    {/* Dynamic Block Editor Component */}
                    <BlockCustomizer
                      block={blocks[editingBlockIndex]}
                      onChange={(updated) => {
                        const newBlocks = [...blocks]
                        newBlocks[editingBlockIndex] = updated
                        setBlocks(newBlocks)
                      }}
                    />
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200 text-gray-400 space-y-3">
                    <Layers size={40} className="mx-auto text-gray-300" />
                    <h4 className="font-bold text-gray-600 text-base">Selecciona un módulo para editarlo</h4>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      Haz clic en cualquier módulo de la lista izquierda para modificar sus títulos, imágenes, tarjetas y textos en tiempo real.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SETTINGS & THEME                                                  */}
      {/* ========================================================================= */}
      {tab === 'settings' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200 space-y-6 max-w-4xl">
          <div className="border-b border-gray-200 pb-4">
            <h2 className="text-xl font-bold text-gray-900">Ajustes Generales e Identidad Visual</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Configura el nombre del nodo, logotipo, paleta de colores y enlaces de contacto de la comunidad.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label font-semibold">Título del Sitio Web *</label>
              <input
                className="input"
                value={settingsForm.site_title}
                onChange={(e) => setSettingsForm({ ...settingsForm, site_title: e.target.value })}
              />
            </div>
            <div>
              <label className="label font-semibold">Subtítulo / Slogan</label>
              <input
                className="input"
                value={settingsForm.site_subtitle}
                onChange={(e) => setSettingsForm({ ...settingsForm, site_subtitle: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label font-semibold">URL del Logotipo</label>
            <input
              className="input"
              placeholder="https://ejemplo.com/logo-conuquero.png"
              value={settingsForm.logo_url}
              onChange={(e) => setSettingsForm({ ...settingsForm, logo_url: e.target.value })}
            />
            <p className="text-xs text-gray-400 mt-1">
              URL de una imagen cuadrada o circular con el logo de la feria/nodo.
            </p>
          </div>

          {/* Color Scheme Picker */}
          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-sm text-gray-900">Paleta de Colores</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label font-semibold">Color Primario (Encabezado/Fondo)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200"
                    value={settingsForm.primary_color}
                    onChange={(e) => setSettingsForm({ ...settingsForm, primary_color: e.target.value })}
                  />
                  <input
                    className="input font-mono text-sm"
                    value={settingsForm.primary_color}
                    onChange={(e) => setSettingsForm({ ...settingsForm, primary_color: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label font-semibold">Color Secundario (Botones/Acciones)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200"
                    value={settingsForm.secondary_color}
                    onChange={(e) => setSettingsForm({ ...settingsForm, secondary_color: e.target.value })}
                  />
                  <input
                    className="input font-mono text-sm"
                    value={settingsForm.secondary_color}
                    onChange={(e) => setSettingsForm({ ...settingsForm, secondary_color: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-xs text-gray-500 font-semibold self-center">Estilos predefinidos:</span>
              {[
                { name: 'Bosque Conuquero', p: '#1e3a1e', s: '#c85a32' },
                { name: 'Sol & Conuco', p: '#1b3815', s: '#e9a825' },
                { name: 'Terracota Ecoaldea', p: '#2d2013', s: '#d96b27' },
                { name: 'Montaña Esmeralda', p: '#0f2b1d', s: '#10b981' },
              ].map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() =>
                    setSettingsForm({
                      ...settingsForm,
                      primary_color: preset.p,
                      secondary_color: preset.s,
                    })
                  }
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-3 border-t border-gray-200">
            <h4 className="font-bold text-sm text-gray-900">Ubicación y Contacto</h4>
            <div>
              <label className="label font-semibold">Dirección de Encuentro</label>
              <input
                className="input"
                placeholder="Parque Los Caobos, Caracas, Venezuela"
                value={settingsForm.contact_address}
                onChange={(e) => setSettingsForm({ ...settingsForm, contact_address: e.target.value })}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label font-semibold">Usuario de Instagram</label>
                <input
                  className="input"
                  placeholder="feriaconuquera"
                  value={settingsForm.social_instagram}
                  onChange={(e) => setSettingsForm({ ...settingsForm, social_instagram: e.target.value })}
                />
              </div>
              <div>
                <label className="label font-semibold">Usuario de Facebook</label>
                <input
                  className="input"
                  placeholder="feriaconuquera"
                  value={settingsForm.social_facebook}
                  onChange={(e) => setSettingsForm({ ...settingsForm, social_facebook: e.target.value })}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label font-semibold">Correo de Contacto</label>
                <input
                  className="input"
                  placeholder="contacto@feriaconuquera.org"
                  value={settingsForm.contact_email}
                  onChange={(e) => setSettingsForm({ ...settingsForm, contact_email: e.target.value })}
                />
              </div>
              <div>
                <label className="label font-semibold">Teléfono / WhatsApp</label>
                <input
                  className="input"
                  placeholder="+58 212 0000000"
                  value={settingsForm.contact_phone}
                  onChange={(e) => setSettingsForm({ ...settingsForm, contact_phone: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200">
            <label className="flex items-center gap-2.5 text-sm font-semibold text-gray-800">
              <input
                type="checkbox"
                checked={settingsForm.show_join_form}
                onChange={(e) => setSettingsForm({ ...settingsForm, show_join_form: e.target.checked })}
              />
              Habilitar botón y formulario público de "Solicitar Unirse" (/p/unirse)
            </label>
          </div>

          <button onClick={saveSettings} className="btn-primary flex items-center gap-2 shadow">
            <Save size={18} />
            Guardar Configuración General
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ADMISSION REQUESTS                                                */}
      {/* ========================================================================= */}
      {tab === 'admission' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Solicitudes de Admisión Recibidas</h2>
            <span className="text-xs text-gray-500">
              {admissionRequests.length} solicitudes en total
            </span>
          </div>

          {admissionRequests.length === 0 ? (
            <div className="card text-center py-12 text-gray-500 space-y-2">
              <Mail size={32} className="mx-auto text-gray-300" />
              <p>No hay solicitudes de admisión registradas todavía.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {admissionRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div>
                      <h3 className="font-bold text-base text-gray-900">{req.full_name}</h3>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                        {req.email && <span>📧 {req.email}</span>}
                        {req.phone && <span>📞 {req.phone}</span>}
                        {req.location && <span>📍 {req.location}</span>}
                      </div>
                    </div>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-bold self-start ${
                        req.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : req.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {req.status === 'approved'
                        ? 'Aprobada'
                        : req.status === 'rejected'
                        ? 'Rechazada'
                        : 'Pendiente de Asamblea'}
                    </span>
                  </div>

                  {req.skills && (
                    <div className="text-xs text-gray-700">
                      <b className="text-gray-900 block mb-0.5">Producción / Saberes que aporta:</b>
                      <p className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 leading-relaxed">
                        {req.skills}
                      </p>
                    </div>
                  )}

                  {req.reason && (
                    <div className="text-xs text-gray-700">
                      <b className="text-gray-900 block mb-0.5">Motivo para unirse:</b>
                      <p className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 leading-relaxed">
                        {req.reason}
                      </p>
                    </div>
                  )}

                  {req.how_heard && (
                    <p className="text-xs text-gray-400">
                      <b>Cómo se enteró:</b> {req.how_heard}
                    </p>
                  )}

                  {req.status === 'pending' && (
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => reviewAdmission(req.id, 'approved')}
                        className="btn-primary text-xs flex items-center gap-1.5"
                      >
                        <CheckCircle size={14} />
                        Aprobar Solicitud
                      </button>
                      <button
                        onClick={() => reviewAdmission(req.id, 'rejected')}
                        className="btn-secondary text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5 border-red-200"
                      >
                        <XCircle size={14} />
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD NEW BLOCK                                                     */}
      {/* ========================================================================= */}
      {showAddBlockModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Plus size={20} className="text-emerald-700" />
                  Añadir Nuevo Módulo a la Página
                </h3>
                <p className="text-xs text-gray-500">Selecciona el tipo de componente que deseas integrar.</p>
              </div>
              <button
                onClick={() => setShowAddBlockModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 overflow-y-auto pr-1 flex-1">
              {BLOCK_DEFINITIONS.map((def) => {
                const Icon = def.icon
                return (
                  <button
                    key={def.type}
                    onClick={() => addBlock(def.type)}
                    className="p-3.5 rounded-2xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-left transition flex items-start gap-3 group"
                  >
                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white transition flex-shrink-0">
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0">
                      <b className="text-xs sm:text-sm text-gray-900 block group-hover:text-emerald-900">
                        {def.name}
                      </b>
                      <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">
                        {def.description}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// DYNAMIC BLOCK CUSTOMIZER (Form for each block type)
// -------------------------------------------------------------
function BlockCustomizer({ block, onChange }: { block: SiteBlock; onChange: (updated: SiteBlock) => void }) {
  const updateField = (field: string, val: any) => {
    onChange({ ...block, [field]: val } as SiteBlock)
  }

  return (
    <div className="space-y-4 text-xs">
      {/* Title & Subtitle for almost all blocks */}
      {'title' in block && (
        <div>
          <label className="label text-xs font-semibold">Título del Módulo</label>
          <input
            className="input text-sm"
            value={block.title || ''}
            onChange={(e) => updateField('title', e.target.value)}
          />
        </div>
      )}

      {'subtitle' in block && (
        <div>
          <label className="label text-xs font-semibold">Subtítulo</label>
          <input
            className="input text-sm"
            value={block.subtitle || ''}
            onChange={(e) => updateField('subtitle', e.target.value)}
          />
        </div>
      )}

      {'badge' in block && (
        <div>
          <label className="label text-xs font-semibold">Insignia / Badge Superior</label>
          <input
            className="input text-sm"
            value={block.badge || ''}
            onChange={(e) => updateField('badge', e.target.value)}
          />
        </div>
      )}

      {'image_url' in block && (
        <div>
          <label className="label text-xs font-semibold">URL de la Imagen</label>
          <input
            className="input text-sm"
            value={block.image_url || ''}
            onChange={(e) => updateField('image_url', e.target.value)}
          />
        </div>
      )}

      {'description' in block && (
        <div>
          <label className="label text-xs font-semibold">Descripción</label>
          <textarea
            rows={3}
            className="input text-sm"
            value={(block as any).description || ''}
            onChange={(e) => updateField('description', e.target.value)}
          />
        </div>
      )}

      {/* Hero Specific */}
      {block.type === 'hero' && (
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label className="label text-xs font-semibold">Texto Botón Primario</label>
            <input
              className="input text-sm"
              value={block.primary_cta?.text || ''}
              onChange={(e) =>
                updateField('primary_cta', { ...block.primary_cta, text: e.target.value, link: block.primary_cta?.link || '/p/productos' })
              }
            />
          </div>
          <div>
            <label className="label text-xs font-semibold">Enlace Botón Primario</label>
            <input
              className="input text-sm"
              value={block.primary_cta?.link || ''}
              onChange={(e) =>
                updateField('primary_cta', { ...block.primary_cta, link: e.target.value, text: block.primary_cta?.text || 'Conoce Más' })
              }
            />
          </div>
        </div>
      )}

      {/* Carousel Specific items manager */}
      {block.type === 'carousel' && (
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-gray-800">Fotos del Carrusel ({block.items.length})</h4>
            <button
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
                updateField('items', newItems)
              }}
              className="btn-secondary text-[11px] py-1 px-2.5"
            >
              + Añadir Foto
            </button>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {block.items.map((it, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-700">Foto #{i + 1}</span>
                  <button
                    onClick={() => {
                      const newItems = block.items.filter((_, idx) => idx !== i)
                      updateField('items', newItems)
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <input
                  className="input text-xs"
                  placeholder="URL Imagen"
                  value={it.image_url}
                  onChange={(e) => {
                    const newItems = [...block.items]
                    newItems[i].image_url = e.target.value
                    updateField('items', newItems)
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input text-xs"
                    placeholder="Título"
                    value={it.title || ''}
                    onChange={(e) => {
                      const newItems = [...block.items]
                      newItems[i].title = e.target.value
                      updateField('items', newItems)
                    }}
                  />
                  <input
                    className="input text-xs"
                    placeholder="Etiqueta / Tag"
                    value={it.tag || ''}
                    onChange={(e) => {
                      const newItems = [...block.items]
                      newItems[i].tag = e.target.value
                      updateField('items', newItems)
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features Grid Specific items manager */}
      {block.type === 'features_grid' && (
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-gray-800">Tarjetas ({block.items.length})</h4>
            <button
              onClick={() => {
                const newItems = [
                  ...block.items,
                  { icon: 'leaf', title: 'Nuevo Pilar', description: 'Descripción del pilar', badge: 'Nuevo' },
                ]
                updateField('items', newItems)
              }}
              className="btn-secondary text-[11px] py-1 px-2.5"
            >
              + Añadir Tarjeta
            </button>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {block.items.map((it, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-700">Tarjeta #{i + 1}</span>
                  <button
                    onClick={() => {
                      const newItems = block.items.filter((_, idx) => idx !== i)
                      updateField('items', newItems)
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input text-xs font-bold"
                    placeholder="Título"
                    value={it.title}
                    onChange={(e) => {
                      const newItems = [...block.items]
                      newItems[i].title = e.target.value
                      updateField('items', newItems)
                    }}
                  />
                  <input
                    className="input text-xs"
                    placeholder="Etiqueta / Badge"
                    value={it.badge || ''}
                    onChange={(e) => {
                      const newItems = [...block.items]
                      newItems[i].badge = e.target.value
                      updateField('items', newItems)
                    }}
                  />
                </div>
                <textarea
                  rows={2}
                  className="input text-xs"
                  placeholder="Descripción"
                  value={it.description}
                  onChange={(e) => {
                    const newItems = [...block.items]
                    newItems[i].description = e.target.value
                    updateField('items', newItems)
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAQ Specific items manager */}
      {block.type === 'faq' && (
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-gray-800">Preguntas y Respuestas ({block.items.length})</h4>
            <button
              onClick={() => {
                const newItems = [
                  ...block.items,
                  { question: '¿Nueva pregunta?', answer: 'Respuesta explicativa...' },
                ]
                updateField('items', newItems)
              }}
              className="btn-secondary text-[11px] py-1 px-2.5"
            >
              + Añadir Pregunta
            </button>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {block.items.map((it, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-700">FAQ #{i + 1}</span>
                  <button
                    onClick={() => {
                      const newItems = block.items.filter((_, idx) => idx !== i)
                      updateField('items', newItems)
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <input
                  className="input text-xs font-bold"
                  placeholder="Pregunta"
                  value={it.question}
                  onChange={(e) => {
                    const newItems = [...block.items]
                    newItems[i].question = e.target.value
                    updateField('items', newItems)
                  }}
                />
                <textarea
                  rows={2}
                  className="input text-xs"
                  placeholder="Respuesta"
                  value={it.answer}
                  onChange={(e) => {
                    const newItems = [...block.items]
                    newItems[i].answer = e.target.value
                    updateField('items', newItems)
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RichText Specific */}
      {block.type === 'richtext' && (
        <div>
          <label className="label text-xs font-semibold">Contenido (Markdown / Texto)</label>
          <textarea
            rows={8}
            className="input text-xs font-mono"
            value={block.content}
            onChange={(e) => updateField('content', e.target.value)}
          />
        </div>
      )}

      {/* CTA Banner Specific */}
      {block.type === 'cta_banner' && (
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label className="label text-xs font-semibold">Texto del Botón</label>
            <input
              className="input text-sm"
              value={block.button_text}
              onChange={(e) => updateField('button_text', e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs font-semibold">Enlace del Botón</label>
            <input
              className="input text-sm"
              value={block.button_link}
              onChange={(e) => updateField('button_link', e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
