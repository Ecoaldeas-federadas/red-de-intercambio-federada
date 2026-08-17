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
  Building2,
  Newspaper,
  History,
  Download,
  Calculator,
  Layout,
  Sliders,
  CheckSquare,
  List,
  FormInput,
  AlignLeft,
} from 'lucide-react'
import { SiteBlock, BlockType, HeaderStyleType, FormFieldSchema, FormFieldType } from '../types/publicSite'
import { FERIA_CONUQUERA_TEMPLATES } from '../components/public-site/defaultSiteData'
import { DEFAULT_ADMISSION_FIELDS } from '../components/public-site/DynamicAdmissionForm'
import { PageBlocksRenderer } from '../components/public-site/PublicBlocks'
import { HEADER_STYLES } from '../components/public-site/headerStyles'

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
      description: 'Espacio de encuentro popular y trueque comunitario en Caracas.',
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
        'Venta al público general en moneda local.',
        'Prohibido el uso de bolsas plásticas desechables.',
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
    type: 'news_feed',
    name: 'Noticias / Comunicados',
    description: 'Cuadrícula de artículos, boletines y pronunciamientos con fechas y fotos.',
    icon: Newspaper,
    defaultData: () => ({
      type: 'news_feed',
      badge: 'Boletín Conuquero',
      title: 'Noticias y Articulaciones Populares',
      subtitle: 'Avances de la producción campesina y soberanía en Caracas.',
      items: [
        {
          title: 'Celebración de 10 Años de Encuentro en Los Caobos',
          date: 'Octubre 2024',
          author: 'Equipo Promotor',
          category: 'Aniversario',
          excerpt: 'Más de 45 marcas y familias productoras se dieron cita en una jornada multitudinaria de mercado y trueque.',
          image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
          link: '/p/filosofia',
        },
      ],
    }),
  },
  {
    type: 'timeline_history',
    name: 'Línea de Tiempo Histórica',
    description: 'Hitos cronológicos de la red desde sus orígenes hasta la actualidad.',
    icon: History,
    defaultData: () => ({
      type: 'timeline_history',
      badge: 'Trayectoria',
      title: 'Hitos de Nuestra Historia Colectiva',
      subtitle: 'El camino de la siembra y el trueque.',
      items: [
        { year: '2014', title: 'Nacimiento de la Feria Conuquera', description: 'Primer mercado en Los Caobos tras debates de semillas.', badge: 'Fundacional' },
        { year: '2015', title: 'Promulgación de la Ley de Semillas', description: 'Victoria popular en la Asamblea Nacional.', badge: 'Ley Popular' },
        { year: '2024', title: '10 Años de Soberanía Activa', description: 'Consolidación de la red y sistema digital de trueque.', badge: 'Presente' },
      ],
    }),
  },
  {
    type: 'calculator_preview',
    name: 'Simulador / Calculadora de Trueque (kWh)',
    description: 'Widget interactivo que permite calcular el valor justo en energía (kWh/TQ).',
    icon: Calculator,
    defaultData: () => ({
      type: 'calculator_preview',
      title: 'Calcula el Valor Energético de tu Producción',
      subtitle: 'Simulador interactivo basado en horas de trabajo y factores de esfuerzo físico.',
    }),
  },
  {
    type: 'resource_downloads',
    name: 'Biblioteca de Guías & Descargas',
    description: 'Descargas de manuales agroecológicos, guías de semillas y recetas.',
    icon: Download,
    defaultData: () => ({
      type: 'resource_downloads',
      title: 'Guías y Materiales de Formación',
      subtitle: 'Descarga gratuita de saberes conuqueros.',
      items: [
        {
          title: 'Manual de Lombricultura y Bioinsumos',
          category: 'Agroecología',
          description: 'Aprende a preparar compost, biol y humus líquido en casa.',
          file_format: 'PDF',
          file_size: '2.4 MB',
          download_url: '#',
        },
      ],
    }),
  },
  {
    type: 'institutions_partners',
    name: 'Aliados e Instituciones Populares',
    description: 'Logos y menciones de comunas, colectivos e instituciones colaboradoras.',
    icon: Building2,
    defaultData: () => ({
      type: 'institutions_partners',
      title: 'Red de Colectivos y Organizaciones Aliadas',
      subtitle: 'Tejiendo alianzas por la soberanía alimentaria.',
      items: [
        { name: 'Movimiento Semillas del Pueblo', role: 'Custodios de Semillas' },
        { name: 'Organopónico Bolívar 1 (EPAU)', role: 'Agricultura Urbana' },
        { name: 'Colectivo Las Yerbateras', role: 'Medicina Tradicional' },
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
        positive_balance: 'Aportes entregados pendientes de retribución por la comunidad.',
        negative_balance: 'Compromiso adquirido de retribuir bienes o trabajo.',
        zero_sum: 'Registro contable de aportes en energía para intercambio diferido.',
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
      subtitle: 'La asamblea trimestral evalúa postulaciones de productores.',
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

  const [tab, setTab] = useState<'pages' | 'builder' | 'settings' | 'admission'>('pages')
  const [admissionSubTab, setAdmissionSubTab] = useState<'requests' | 'form_builder'>('requests')
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

  // Dynamic Admission Form Builder State
  const [formConfig, setFormConfig] = useState({
    title: 'Solicitud de Ingreso a la Red',
    subtitle: 'Completa tus datos para postularte como productor conuquero, artesano o miembro.',
    schema: DEFAULT_ADMISSION_FIELDS as FormFieldSchema[],
  })
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null)

  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    site_title: '',
    site_subtitle: '',
    logo_url: '',
    primary_color: '#162e16',
    secondary_color: '#c2410c',
    contact_email: '',
    contact_phone: '',
    contact_address: '',
    social_instagram: '',
    social_facebook: '',
    social_twitter: '',
    show_join_form: true,
    header_style: 'modern_eco' as HeaderStyleType,
    announcement_text: '🗓️ Próximo Encuentro Conuquero: Primer sábado de cada mes en Parque Los Caobos, Caracas | 9:00 AM',
    show_announcement: true,
    footer_style: 'columns',
    footer_about: '',
    footer_schedule: '',
  })

  const load = () => {
    api.get('/site/pages').then((d: any) => setPages(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/site/settings').then(setSettings).catch(() => {})
    api.get('/admission-requests').then((d: any) => setAdmissionRequests(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/public/admission-form').then((d: any) => {
      if (d) {
        setFormConfig({
          title: d.title || 'Solicitud de Ingreso a la Red',
          subtitle: d.subtitle || 'Completa tus datos para postularte como productor conuquero, artesano o miembro.',
          schema: Array.isArray(d.schema) && d.schema.length > 0 ? d.schema : DEFAULT_ADMISSION_FIELDS,
        })
      }
    }).catch(() => {})
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
        primary_color: settings.primary_color || '#162e16',
        secondary_color: settings.secondary_color || '#c2410c',
        contact_email: settings.contact_email || '',
        contact_phone: settings.contact_phone || '',
        contact_address: settings.contact_address || '',
        social_instagram: settings.social_instagram || '',
        social_facebook: settings.social_facebook || '',
        social_twitter: settings.social_twitter || '',
        show_join_form: settings.show_join_form ?? true,
        header_style: (settings.header_style || 'modern_eco') as HeaderStyleType,
        announcement_text:
          settings.announcement_text ||
          '🗓️ Próximo Encuentro Conuquero: Primer sábado de cada mes en Parque Los Caobos, Caracas | 9:00 AM',
        show_announcement: settings.show_announcement ?? true,
        footer_style: settings.footer_style || 'columns',
        footer_about: settings.footer_about || '',
        footer_schedule: settings.footer_schedule || '',
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

    let parsedBlocks: SiteBlock[] = []
    try {
      if (page.content) {
        const parsed = JSON.parse(page.content)
        if (Array.isArray(parsed)) {
          parsedBlocks = parsed
        }
      }
    } catch {
      if (page.content) {
        parsedBlocks = [{ type: 'richtext', title: page.title, content: page.content }]
      }
    }

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

  // Apply preconfigured rich templates for all pages
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
      setSuccess('¡Plantilla modular viva aplicada con éxito a todas las páginas!')
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
      setSuccess('¡Ajustes del sitio y estilo de menú guardados con éxito!')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  // Save dynamic admission form schema
  const saveAdmissionFormSchema = async () => {
    setError('')
    setSuccess('')
    try {
      await api.put('/site/admission-form', {
        title: formConfig.title,
        subtitle: formConfig.subtitle,
        schema: formConfig.schema,
      })
      setSuccess('¡Formulario de admisión personalizado guardado con éxito!')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el formulario')
    }
  }

  // Add new field to dynamic form
  const addFormField = (type: FormFieldType = 'text') => {
    const newField: FormFieldSchema = {
      id: `field_${Date.now()}`,
      label: 'Nueva Pregunta / Campo',
      type,
      placeholder: 'Escribe tu respuesta aquí...',
      help_text: 'Explicación de apoyo para el solicitante.',
      required: false,
      options: type === 'select' || type === 'radio' || type === 'checkbox' ? ['Opción 1', 'Opción 2'] : undefined,
    }
    const updated = [...formConfig.schema, newField]
    setFormConfig({ ...formConfig, schema: updated })
    setEditingFieldIndex(updated.length - 1)
  }

  // Move form field Up / Down
  const moveFormField = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= formConfig.schema.length) return
    const updated = [...formConfig.schema]
    const temp = updated[idx]
    updated[idx] = updated[targetIdx]
    updated[targetIdx] = temp
    setFormConfig({ ...formConfig, schema: updated })
    if (editingFieldIndex === idx) setEditingFieldIndex(targetIdx)
    else if (editingFieldIndex === targetIdx) setEditingFieldIndex(idx)
  }

  // Delete form field
  const deleteFormField = (idx: number) => {
    if (!confirm('¿Eliminar este campo del formulario?')) return
    const updated = formConfig.schema.filter((_, i) => i !== idx)
    setFormConfig({ ...formConfig, schema: updated })
    if (editingFieldIndex === idx) setEditingFieldIndex(null)
    else if (editingFieldIndex !== null && editingFieldIndex > idx) {
      setEditingFieldIndex(editingFieldIndex - 1)
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
            <Globe className="text-emerald-700" size={28} />
            Administración del Sitio Web Público
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Editor visual modular de páginas, constructor de formulario de admisión y estilos de menú.
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
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${
            tab === 'pages'
              ? 'bg-emerald-900 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <FileText size={16} />
          Páginas del Sitio ({pages.length})
        </button>

        {selectedPage && (
          <button
            onClick={() => setTab('builder')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${
              tab === 'builder'
                ? 'bg-emerald-900 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Layers size={16} />
            Editor Modular: <span className="text-amber-300 font-normal">{pageMeta.title || selectedPage.title}</span>
          </button>
        )}

        <button
          onClick={() => setTab('settings')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${
            tab === 'settings'
              ? 'bg-emerald-900 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Sliders size={16} />
          Estilos de Menú y Ajustes
        </button>

        <button
          onClick={() => setTab('admission')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${
            tab === 'admission'
              ? 'bg-emerald-900 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Mail size={16} />
          Admisión & Formulario Dinámico ({admissionRequests.filter((r) => r.status === 'pending').length} pendientes)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PAGES LIST                                                        */}
      {/* ========================================================================= */}
      {tab === 'pages' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Estructura de Páginas Públicas</h2>
              <p className="text-xs text-gray-500">Haz clic en "Editar Módulos" para personalizar los bloques de cada página.</p>
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

                    <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-emerald-800 transition">
                      {p.title}
                    </h3>
                    {p.subtitle && (
                      <p className="text-xs text-gray-500 line-clamp-2">{p.subtitle}</p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
                      <Layers size={14} className="text-emerald-700" />
                      <span>{moduleCount} {moduleCount === 1 ? 'módulo' : 'módulos'}</span>
                      <span>•</span>
                      <span>Orden: #{p.menu_order}</span>
                    </div>
                  </div>

                  <div className="pt-4 mt-3 border-t border-gray-100 flex items-center justify-between">
                    <button
                      onClick={() => openPageBuilder(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
                    >
                      <Edit size={14} />
                      Editar Módulos
                    </button>

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
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTab('pages')}
                className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg text-xs font-semibold"
              >
                ← Volver a lista
              </button>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900">
                  Editando: <span className="text-emerald-800">{pageMeta.title}</span>
                </h2>
                <p className="text-xs text-gray-500 font-mono">/p/{pageMeta.slug}</p>
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
                Guardar Módulos
              </button>
            </div>
          </div>

          {previewMode ? (
            <div className="bg-[#fcfbf9] rounded-3xl p-4 sm:p-8 shadow-lg border border-gray-200">
              <div className="border-b border-gray-200 pb-3 mb-6 flex items-center justify-between text-xs text-gray-500">
                <span className="font-bold text-gray-700 flex items-center gap-1.5">
                  <Eye size={15} className="text-amber-500" />
                  Vista Previa en Vivo de /p/{pageMeta.slug}
                </span>
                <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded font-semibold">
                  {blocks.length} módulos cargados
                </span>
              </div>
              <PageBlocksRenderer content={JSON.stringify(blocks)} />
            </div>
          ) : rawJsonMode ? (
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
                  } catch {}
                }}
              />
            </div>
          ) : (
            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 space-y-3">
                  <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                    <FileText size={16} className="text-emerald-700" />
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

                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                      <Layers size={16} className="text-emerald-700" />
                      Módulos en esta Página ({blocks.length})
                    </h3>
                    <button
                      onClick={() => setShowAddBlockModal(true)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-700 transition shadow-xs"
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
                        className="text-emerald-800 font-bold hover:underline"
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
                                ? 'bg-emerald-50 border-emerald-500 shadow-sm'
                                : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                                {idx + 1}
                              </span>
                              <div className="p-1.5 rounded-lg bg-white text-emerald-800 shadow-xs flex-shrink-0">
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

              <div className="lg:col-span-7">
                {editingBlockIndex !== null && blocks[editingBlockIndex] ? (
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                      <div>
                        <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
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
      {/* TAB 3: MENU STYLES & SETTINGS                                            */}
      {/* ========================================================================= */}
      {tab === 'settings' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200 space-y-8 max-w-4xl">
          <div className="border-b border-gray-200 pb-4">
            <h2 className="text-xl font-bold text-gray-900">Estilos de Menú y Ajustes de Identidad</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Elige cómo se ve la cabecera y navegación del portal inspirada en FAO, Mincyt, Ecoaldeas y Revistas Agroecológicas.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
              <Layout size={18} className="text-emerald-800" />
              Selecciona el Estilo de Menú y Cabecera
            </h3>

            <div className="grid sm:grid-cols-2 gap-3">
              {HEADER_STYLES.map((st) => (
                <div
                  key={st.id}
                  onClick={() => setSettingsForm({ ...settingsForm, header_style: st.id })}
                  className={`p-4 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between ${
                    settingsForm.header_style === st.id
                      ? 'border-emerald-700 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                      : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <b className="text-xs sm:text-sm text-gray-900">{st.name}</b>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-gray-200 text-emerald-800">
                        {st.tag}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{st.description}</p>
                  </div>
                  <div className="pt-3 mt-2 border-t border-gray-200/60 flex items-center gap-2 text-xs font-bold text-emerald-800">
                    <input
                      type="radio"
                      name="header_style"
                      checked={settingsForm.header_style === st.id}
                      onChange={() => setSettingsForm({ ...settingsForm, header_style: st.id })}
                      className="accent-emerald-700"
                    />
                    <span>{settingsForm.header_style === st.id ? 'Estilo Activo' : 'Activar este estilo'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-gray-200">
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" />
              Barra Superior de Avisos & Encuentros
            </h3>
            <div>
              <label className="label text-xs font-semibold">Texto del Aviso</label>
              <input
                className="input text-sm"
                value={settingsForm.announcement_text}
                onChange={(e) => setSettingsForm({ ...settingsForm, announcement_text: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={settingsForm.show_announcement}
                onChange={(e) => setSettingsForm({ ...settingsForm, show_announcement: e.target.checked })}
              />
              Mostrar barra superior de avisos
            </label>
          </div>

          <div className="space-y-4 pt-2 border-t border-gray-200">
            <h3 className="font-bold text-sm text-gray-900">Datos de Identidad</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label font-semibold text-xs">Título del Portal *</label>
                <input
                  className="input"
                  value={settingsForm.site_title}
                  onChange={(e) => setSettingsForm({ ...settingsForm, site_title: e.target.value })}
                />
              </div>
              <div>
                <label className="label font-semibold text-xs">Subtítulo / Slogan</label>
                <input
                  className="input"
                  value={settingsForm.site_subtitle}
                  onChange={(e) => setSettingsForm({ ...settingsForm, site_subtitle: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label font-semibold text-xs">URL del Logotipo</label>
              <input
                className="input text-sm"
                placeholder="https://ejemplo.com/logo-conuquero.png"
                value={settingsForm.logo_url}
                onChange={(e) => setSettingsForm({ ...settingsForm, logo_url: e.target.value })}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="label font-semibold text-xs">Color Primario</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200"
                    value={settingsForm.primary_color}
                    onChange={(e) => setSettingsForm({ ...settingsForm, primary_color: e.target.value })}
                  />
                  <input
                    className="input font-mono text-xs"
                    value={settingsForm.primary_color}
                    onChange={(e) => setSettingsForm({ ...settingsForm, primary_color: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label font-semibold text-xs">Color Secundario</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200"
                    value={settingsForm.secondary_color}
                    onChange={(e) => setSettingsForm({ ...settingsForm, secondary_color: e.target.value })}
                  />
                  <input
                    className="input font-mono text-xs"
                    value={settingsForm.secondary_color}
                    onChange={(e) => setSettingsForm({ ...settingsForm, secondary_color: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Settings */}
          <div className="card space-y-3">
            <h3 className="font-bold text-sm text-gray-900">Pie de Página (Footer)</h3>
            <p className="text-xs text-gray-500">Edita los textos que aparecen en el pie de página del sitio público.</p>

            <div>
              <label className="label text-xs font-bold">Descripción del nodo (footer_about)</label>
              <textarea
                rows={3}
                className="input text-xs"
                value={settingsForm.footer_about}
                onChange={(e) => setSettingsForm({ ...settingsForm, footer_about: e.target.value })}
                placeholder="Mercado a cielo abierto para todo el público..."
              />
            </div>

            <div>
              <label className="label text-xs font-bold">Horario del footer (footer_schedule)</label>
              <input
                className="input text-xs"
                value={settingsForm.footer_schedule}
                onChange={(e) => setSettingsForm({ ...settingsForm, footer_schedule: e.target.value })}
                placeholder="Primer sábado de cada mes (9:00 AM a 1:00 PM)..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs font-bold">Instagram (usuario sin @)</label>
                <input
                  className="input text-xs"
                  value={settingsForm.social_instagram}
                  onChange={(e) => setSettingsForm({ ...settingsForm, social_instagram: e.target.value })}
                  placeholder="feriaconuquera"
                />
              </div>
              <div>
                <label className="label text-xs font-bold">Facebook (nombre de página)</label>
                <input
                  className="input text-xs"
                  value={settingsForm.social_facebook}
                  onChange={(e) => setSettingsForm({ ...settingsForm, social_facebook: e.target.value })}
                  placeholder="feriaconuquera"
                />
              </div>
            </div>

            <div>
              <label className="label text-xs font-bold">Dirección (contact_address)</label>
              <input
                className="input text-xs"
                value={settingsForm.contact_address}
                onChange={(e) => setSettingsForm({ ...settingsForm, contact_address: e.target.value })}
                placeholder="Parque Los Caobos, Caracas..."
              />
            </div>
          </div>

          <button onClick={saveSettings} className="btn-primary flex items-center gap-2 shadow">
            <Save size={18} />
            Guardar Todos los Ajustes
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ADMISSION & DYNAMIC FORM BUILDER                                  */}
      {/* ========================================================================= */}
      {tab === 'admission' && (
        <div className="space-y-6">
          {/* Subtabs for Admission */}
          <div className="flex gap-2 border-b border-gray-200 pb-2">
            <button
              onClick={() => setAdmissionSubTab('requests')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
                admissionSubTab === 'requests'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Mail size={15} />
              Solicitudes Recibidas ({admissionRequests.length})
            </button>
            <button
              onClick={() => setAdmissionSubTab('form_builder')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
                admissionSubTab === 'form_builder'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <FormInput size={15} />
              Constructor del Formulario Dinámico
            </button>
          </div>

          {/* SUBTAB 4.1: ADMISSION REQUESTS LIST */}
          {admissionSubTab === 'requests' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Postulaciones y Solicitudes de Admisión</h2>
                  <p className="text-xs text-gray-500">Evalúa las respuestas de los solicitantes antes de elevar a asamblea.</p>
                </div>
                <span className="text-xs text-gray-500">
                  {admissionRequests.length} en total
                </span>
              </div>

              {admissionRequests.length === 0 ? (
                <div className="card text-center py-12 text-gray-500 space-y-2">
                  <Mail size={32} className="mx-auto text-gray-300" />
                  <p>No hay solicitudes de admisión registradas todavía.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {admissionRequests.map((req) => {
                    let customAnswers: Record<string, any> = {}
                    if (req.custom_fields) {
                      if (typeof req.custom_fields === 'object') {
                        customAnswers = req.custom_fields
                      } else {
                        try {
                          customAnswers = JSON.parse(req.custom_fields)
                        } catch {}
                      }
                    }

                    return (
                      <div
                        key={req.id}
                        className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200 space-y-4"
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

                        {/* Custom answers list */}
                        {Object.keys(customAnswers).length > 0 ? (
                          <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs">
                            <b className="text-gray-900 block border-b border-gray-200 pb-1">
                              Respuestas del Formulario Personalizado:
                            </b>
                            {Object.entries(customAnswers).map(([key, val]) => {
                              if (['full_name', 'email', 'phone'].includes(key)) return null
                              const displayVal = Array.isArray(val) ? val.join(', ') : String(val)
                              if (!displayVal) return null

                              return (
                                <div key={key} className="space-y-0.5">
                                  <span className="font-semibold text-gray-700 capitalize">
                                    {key.replace(/_/g, ' ')}:
                                  </span>
                                  <p className="text-gray-800 bg-white p-2 rounded-lg border border-gray-200 leading-relaxed">
                                    {displayVal}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <>
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
                          </>
                        )}

                        {req.status === 'pending' && (
                          <div className="flex gap-2 pt-2 border-t border-gray-100">
                            <button
                              onClick={() => reviewAdmission(req.id, 'approved')}
                              className="btn-primary text-xs flex items-center gap-1.5"
                            >
                              <CheckCircle size={14} />
                              Aprobar Postulación
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
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 4.2: DYNAMIC ADMISSION FORM BUILDER */}
          {admissionSubTab === 'form_builder' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <FormInput size={20} className="text-emerald-800" />
                      Constructor de Preguntas y Formulario de Admisión
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Diseña libremente los campos que llenarán los aspirantes en <span className="font-mono">/p/unirse</span>.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        if (confirm('¿Restablecer al formulario predeterminado agroecológico?')) {
                          setFormConfig({
                            ...formConfig,
                            schema: DEFAULT_ADMISSION_FIELDS,
                          })
                        }
                      }}
                      className="btn-secondary text-xs flex items-center gap-1"
                      title="Cargar formulario predeterminado"
                    >
                      <RotateCcw size={13} />
                      Restablecer Preguntas
                    </button>

                    <button
                      onClick={saveAdmissionFormSchema}
                      className="btn-primary text-xs flex items-center gap-1.5 shadow"
                    >
                      <Save size={14} />
                      Guardar Formulario
                    </button>
                  </div>
                </div>

                {/* Form Title & Subtitle */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label text-xs font-semibold">Título Principal del Formulario</label>
                    <input
                      className="input text-sm"
                      value={formConfig.title}
                      onChange={(e) => setFormConfig({ ...formConfig, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label text-xs font-semibold">Subtítulo Explicativo</label>
                    <input
                      className="input text-sm"
                      value={formConfig.subtitle}
                      onChange={(e) => setFormConfig({ ...formConfig, subtitle: e.target.value })}
                    />
                  </div>
                </div>

                {/* Form Fields List */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-gray-900">
                      Preguntas / Campos del Formulario ({formConfig.schema.length})
                    </h3>
                    <button
                      onClick={() => addFormField('text')}
                      className="btn-primary text-xs flex items-center gap-1 py-1.5 px-3"
                    >
                      <Plus size={14} />
                      Añadir Nueva Pregunta
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formConfig.schema.map((f, idx) => {
                      const isEditing = editingFieldIndex === idx

                      return (
                        <div
                          key={f.id || idx}
                          className={`p-4 rounded-2xl border transition space-y-3 ${
                            isEditing
                              ? 'bg-emerald-50/50 border-emerald-500 shadow-sm'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-6 h-6 rounded-full bg-emerald-800 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <b className="text-xs sm:text-sm text-gray-900 block truncate">
                                  {f.label || 'Campo sin título'}
                                </b>
                                <span className="text-[11px] text-gray-500 font-mono">
                                  Tipo: {f.type} {f.required && '• (Obligatorio *)'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => setEditingFieldIndex(isEditing ? null : idx)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-gray-200 hover:bg-gray-100 text-gray-700"
                              >
                                {isEditing ? 'Cerrar' : 'Editar'}
                              </button>
                              <button
                                onClick={() => moveFormField(idx, 'up')}
                                disabled={idx === 0}
                                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                                title="Mover arriba"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                onClick={() => moveFormField(idx, 'down')}
                                disabled={idx === formConfig.schema.length - 1}
                                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                                title="Mover abajo"
                              >
                                <ArrowDown size={14} />
                              </button>
                              <button
                                onClick={() => deleteFormField(idx)}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title="Eliminar campo"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Field Editor */}
                          {isEditing && (
                            <div className="pt-3 border-t border-gray-200 space-y-3 bg-white p-4 rounded-xl">
                              <div className="grid sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="label text-xs font-semibold">Pregunta / Título del Campo</label>
                                  <input
                                    className="input text-xs"
                                    value={f.label}
                                    onChange={(e) => {
                                      const updated = [...formConfig.schema]
                                      updated[idx].label = e.target.value
                                      setFormConfig({ ...formConfig, schema: updated })
                                    }}
                                  />
                                </div>

                                <div>
                                  <label className="label text-xs font-semibold">Tipo de Respuesta</label>
                                  <select
                                    className="input text-xs bg-white"
                                    value={f.type}
                                    onChange={(e) => {
                                      const updated = [...formConfig.schema]
                                      const newType = e.target.value as FormFieldType
                                      updated[idx].type = newType
                                      if (
                                        (newType === 'select' || newType === 'radio' || newType === 'checkbox') &&
                                        (!updated[idx].options || updated[idx].options!.length === 0)
                                      ) {
                                        updated[idx].options = ['Opción 1', 'Opción 2']
                                      }
                                      setFormConfig({ ...formConfig, schema: updated })
                                    }}
                                  >
                                    <option value="text">Texto Corto (Línea simple)</option>
                                    <option value="textarea">Texto Largo / Párrafo</option>
                                    <option value="select">Menú Desplegable</option>
                                    <option value="radio">Selección Única (Botones circulares)</option>
                                    <option value="checkbox">Selección Múltiple (Casillas)</option>
                                    <option value="email">Correo Electrónico</option>
                                    <option value="tel">Teléfono / WhatsApp</option>
                                    <option value="number">Número</option>
                                  </select>
                                </div>
                              </div>

                              <div className="grid sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="label text-xs font-semibold">Texto de Ejemplo (Placeholder)</label>
                                  <input
                                    className="input text-xs"
                                    value={f.placeholder || ''}
                                    onChange={(e) => {
                                      const updated = [...formConfig.schema]
                                      updated[idx].placeholder = e.target.value
                                      setFormConfig({ ...formConfig, schema: updated })
                                    }}
                                  />
                                </div>

                                <div>
                                  <label className="label text-xs font-semibold">Texto de Ayuda / Explicación</label>
                                  <input
                                    className="input text-xs"
                                    value={f.help_text || ''}
                                    onChange={(e) => {
                                      const updated = [...formConfig.schema]
                                      updated[idx].help_text = e.target.value
                                      setFormConfig({ ...formConfig, schema: updated })
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Options manager for select/radio/checkbox */}
                              {(f.type === 'select' || f.type === 'radio' || f.type === 'checkbox') && (
                                <div className="space-y-2 pt-2 border-t border-gray-100">
                                  <div className="flex items-center justify-between">
                                    <label className="label text-xs font-semibold">
                                      Opciones Disponibles ({(f.options || []).length})
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...formConfig.schema]
                                        const opts = updated[idx].options || []
                                        updated[idx].options = [...opts, `Nueva Opción ${opts.length + 1}`]
                                        setFormConfig({ ...formConfig, schema: updated })
                                      }}
                                      className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded"
                                    >
                                      + Añadir Opción
                                    </button>
                                  </div>

                                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                    {(f.options || []).map((opt, optIdx) => (
                                      <div key={optIdx} className="flex items-center gap-2">
                                        <input
                                          className="input text-xs py-1"
                                          value={opt}
                                          onChange={(e) => {
                                            const updated = [...formConfig.schema]
                                            const opts = [...(updated[idx].options || [])]
                                            opts[optIdx] = e.target.value
                                            updated[idx].options = opts
                                            setFormConfig({ ...formConfig, schema: updated })
                                          }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = [...formConfig.schema]
                                            const opts = (updated[idx].options || []).filter((_, i) => i !== optIdx)
                                            updated[idx].options = opts
                                            setFormConfig({ ...formConfig, schema: updated })
                                          }}
                                          className="text-red-500 hover:text-red-700 p-1"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="pt-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-800 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={f.required ?? false}
                                    onChange={(e) => {
                                      const updated = [...formConfig.schema]
                                      updated[idx].required = e.target.checked
                                      setFormConfig({ ...formConfig, schema: updated })
                                    }}
                                    className="accent-emerald-700"
                                  />
                                  <span>Campo obligatorio para el solicitante (*)</span>
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={saveAdmissionFormSchema}
                    className="btn-primary text-xs sm:text-sm flex items-center gap-1.5 shadow"
                  >
                    <Save size={16} />
                    Guardar Configuración del Formulario
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD NEW BLOCK                                                     */}
      {/* ========================================================================= */}
      {showAddBlockModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-gray-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Plus size={20} className="text-emerald-800" />
                  Añadir Nuevo Módulo a la Página
                </h3>
                <p className="text-xs text-gray-500">Selecciona entre los componentes visuales disponibles.</p>
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
                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 group-hover:bg-emerald-800 group-hover:text-white transition flex-shrink-0">
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
// DYNAMIC BLOCK CUSTOMIZER
// -------------------------------------------------------------
function BlockCustomizer({ block, onChange }: { block: SiteBlock; onChange: (updated: SiteBlock) => void }) {
  const updateField = (field: string, val: any) => {
    onChange({ ...block, [field]: val } as SiteBlock)
  }

  return (
    <div className="space-y-4 text-xs">
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
                updateField('primary_cta', { ...block.primary_cta, link: e.target.value, text: block.primary_cta?.text || 'Ver Más' })
              }
            />
          </div>
        </div>
      )}

      {/* Carousel items */}
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
                    placeholder="Tag"
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

      {/* RichText */}
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
    </div>
  )
}
