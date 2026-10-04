import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { api, getStorageKeys } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { useConfig } from '../hooks/useConfig'
import { Plus, HelpCircle, Package, Pencil, Check, X, Upload, Eye, EyeOff, Loader2, Globe, Search, Layers, ArrowUpCircle, Trash2 } from 'lucide-react'
import { assetUrl } from '../utils/assetUrl'
import { fmtTQ, toCents } from '../lib/format'

interface ProductForm {
  name: string
  description: string
  unit: string
  parent_category: string
  category: string
  subcategory: string
  price: number
  product_code: string
  badge: string
  image_url: string
  origin: string
  is_hidden: boolean
}

const emptyForm: ProductForm = {
  name: '', description: '', unit: 'unidad', parent_category: '', category: '', subcategory: '', price: 0,
  product_code: '', badge: '', image_url: '', origin: 'internal', is_hidden: false
}

// Componente de un producto compuesto (catalogo federado + locales)
interface FormComponent {
  component_product_id: string
  component_name: string
  component_unit: string
  component_price: number
  quantity: number
  component_category: string
  component_catalog_key?: string
}

const itemTypeToCategory: Record<string, string> = {
  raw_material: 'materia_prima',
  base_product: 'producto_base',
  composite: 'producto_base',
  service: 'trabajo',
  packaging: 'embalaje',
  shipping: 'envio',
}

const ITEM_TYPES = ['raw_material', 'base_product', 'service', 'packaging', 'shipping']

// Categorias padre predefinidas con sus categorias hijas
const PARENT_CATEGORIES: Record<string, string[]> = {
  'Alimentacion': ['Cosecha Fresca', 'Gastronomia Artesanal', 'Granos y Cereales', 'Endulzantes', 'Carnes y Pescados', 'Bebidas', 'Condimentos'],
  'Agricultura': ['Semillas y Plantulas', 'Insumos Agricolas', 'Tierra y Compost', 'Riego'],
  'Salud y Medicina': ['Medicina Botanica', 'Terapias', 'Higiene', 'Primeros Auxilios'],
  'Textiles': ['Confeccion', 'Tejidos', 'Hilos y Materiales'],
  'Artesania': ['Ceramica', 'Madera', 'Cuero', 'Vidrio', 'Metal Decorativo', 'Joyeria'],
  'Servicios': ['Trabajo Agricola', 'Construccion', 'Reparaciones', 'Transporte', 'Educacion', 'Limpieza', 'Salud'],
  'Construccion': ['Materiales', 'Herramientas', 'Acabados'],
  'Energia': ['Solar', 'Eolica', 'Biogas', 'Lena y Carbon'],
  'Herramientas': ['Manuales', 'Electricas', 'Agricolas'],
  'Tecnologia': ['Computacion', 'Electrodomesticos', 'Telefonos', 'Componentes'],
  'Transporte': ['Vehiculos', 'Repuestos', 'Bicicletas'],
  'Cultura': ['Libros', 'Musica', 'Arte', 'Eventos'],
  'Educacion': ['Talleres', 'Cursos', 'Tutorias', 'Materiales Educativos'],
}

type ProductTab = 'federated' | 'mynode' | 'composite'
type MyNodeSubTab = 'allowed' | 'disallowed'

export default function Products() {
  const { t, i18n } = useTranslation(['products', 'common'])
  const tc = (name: string) => t(`category.${name}`, { ns: 'products', defaultValue: name })
  const { hasPermission } = usePermissions()
  const { currency } = useConfig()
  const canManage = hasPermission('products.manage')
  const [products, setProducts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [formLang, setFormLang] = useState('es')
  const [defaultLang, setDefaultLang] = useState('es')
  const [languages, setLanguages] = useState<any[]>([])
  const [formTranslations, setFormTranslations] = useState<Record<string, Record<string, string>>>({})
  const [filterParentCategory, setFilterParentCategory] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSubcategory, setFilterSubcategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [fedProposals, setFedProposals] = useState<any[]>([])
  const [showFedPanel, setShowFedPanel] = useState(false)
  const [pendingProducts, setPendingProducts] = useState<any[]>([])
  const [showPending, setShowPending] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [apiOffset, setApiOffset] = useState(0)
  const [fedNodes, setFedNodes] = useState<any[]>([])
  const [fedNodeFilter, setFedNodeFilter] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Nueva: busqueda por nombre
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Nueva: pestañas (Federacion, Mi Nodo, Compuestos)
  const [activeTab, setActiveTab] = useState<ProductTab>('mynode')
  // Sub-tabs dentro de Mi Nodo: Permitidos / No Permitidos
  const [mynodeSubTab, setMynodeSubTab] = useState<MyNodeSubTab>('allowed')

  // Constructor de producto compuesto (todos los productos del nodo son compuestos)
  const [formComponents, setFormComponents] = useState<FormComponent[]>([])
  const [compOptions, setCompOptions] = useState<any[]>([])
  const [compSearch, setCompSearch] = useState('')
  const [compTypeFilter, setCompTypeFilter] = useState('all')
  const [selComponentId, setSelComponentId] = useState('')
  const [selComponentQty, setSelComponentQty] = useState(1)

  // Propuesta de nuevo item al catalogo federado (votacion de la federacion)
  const [showCatalogProposal, setShowCatalogProposal] = useState(false)
  const [catalogForm, setCatalogForm] = useState({
    name: '', description: '', item_type: 'raw_material', parent_category: '',
    category: '', subcategory: '', unit: 'kg', price_per_unit: 0, price_per_kg: 0,
    weight_kg: 0, base_unit: 'kg', badge: '', image_url: '', product_code: '',
  })

  const PAGE_SIZE = 24

  useEffect(() => {
    api.get<any[]>('/languages').then((result) => {
      const enabled = (result || []).filter((lang: any) => lang.enabled)
      const source = enabled.find((lang: any) => lang.is_default)?.code || 'es'
      setLanguages(enabled)
      setDefaultLang(source)
      setFormLang(source)
    }).catch(() => {
      setLanguages([{ code: 'es', native_name: 'Español', is_default: true }, { code: 'en', native_name: 'English' }])
    })
  }, [])

  const load = useCallback((reset = false) => {
    setLoading(true)
    const offset = reset ? 0 : apiOffset
    let url = `/products?limit=${PAGE_SIZE}&offset=${offset}`
    if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`
    // Enviar filtro de sub-tab al backend para filtrado server-side
    // Esto evita el bug de scroll infinito cuando se filtran todos los items
    if (mynodeSubTab === 'disallowed') url += `&is_allowed=false`
    api.get(url).then((d: any) => {
      const newItems = Array.isArray(d) ? d : d?.products ?? []
      setApiOffset(offset + newItems.length)
      // Doble filtrado client-side por si el backend no soporta is_allowed
      const filtered = newItems.filter((p: any) => {
        if (mynodeSubTab === 'allowed') return p.is_allowed !== false
        return p.is_allowed === false
      })
      if (reset) {
        setProducts(filtered)
      } else {
        setProducts(prev => [...prev, ...filtered])
      }
      // hasMore basado en si la API devolvio una pagina completa
      // Si el backend filtra, filtered.length sera > 0 y funciona correctamente
      // Si el backend no filtra y todo se filtra client-side, puede haber problemas
      // pero al menos no sera infinito porque el offset avanza
      setHasMore(newItems.length >= PAGE_SIZE && filtered.length > 0)
    }).catch(() => {
      if (reset) setProducts([])
    }).finally(() => setLoading(false))
  }, [apiOffset, searchTerm, mynodeSubTab])

  // Cargar productos compuestos
  const loadComposite = useCallback(() => {
    setLoading(true)
    let url = '/products/composite'
    if (searchTerm) url += `?search=${encodeURIComponent(searchTerm)}`
    api.get(url).then((d: any) => {
      setProducts(Array.isArray(d) ? d : [])
      setHasMore(false)
    }).catch(() => setProducts([])).finally(() => setLoading(false))
  }, [searchTerm])

  // Cargar productos federados (todos los nodos)
  const loadFederated = useCallback(() => {
    setLoading(true)
    let url = '/products/federated'
    const params: string[] = []
    if (searchTerm) params.push(`search=${encodeURIComponent(searchTerm)}`)
    if (fedNodeFilter) params.push(`organization=${encodeURIComponent(fedNodeFilter)}`)
    if (params.length) url += '?' + params.join('&')
    api.get(url).then((d: any) => {
      setProducts(Array.isArray(d) ? d : [])
      setHasMore(false)
    }).catch(() => setProducts([])).finally(() => setLoading(false))
  }, [searchTerm, fedNodeFilter])

  // Cargar nodos disponibles para filtrar
  const loadFedNodes = () => {
    api.get('/products/federated/nodes').then((d: any) => {
      setFedNodes(Array.isArray(d) ? d : [])
    }).catch(() => {})
  }

  // Recargar cuando cambie la pestana, sub-tab o el termino de busqueda
  useEffect(() => {
    if (activeTab === 'mynode') {
      load(true)
    } else if (activeTab === 'composite') {
      loadComposite()
    } else if (activeTab === 'federated') {
      loadFederated()
      loadFedNodes()
    }
  }, [activeTab, searchTerm, mynodeSubTab, fedNodeFilter, i18n.language])

  // Cargar propuestas de productos federados pendientes
  const loadFedProposals = () => {
    api.get('/federation/products/pending').then((d: any) => setFedProposals(Array.isArray(d) ? d : [])).catch(() => {})
  }
  useEffect(() => { loadFedProposals() }, [])

  // Cargar productos pendientes de aprobacion
  const loadPending = () => {
    api.get('/products/pending').then((d: any) => setPendingProducts(Array.isArray(d) ? d : [])).catch(() => {})
  }
  useEffect(() => { loadPending() }, [])

  const approveFedProduct = async (id: string) => {
    try {
      await api.post(`/federation/products/${id}/approve`, {})
      loadFedProposals()
      if (activeTab === 'mynode') load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_approve_fed', 'Error al aprobar producto federado'))
    }
  }

  const approveProduct = async (id: string) => {
    try {
      await api.post(`/products/${id}/approve`, {})
      loadPending()
      if (activeTab === 'mynode') load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_approve', 'Error al aprobar producto'))
    }
  }

  const rejectProduct = async (id: string) => {
    try {
      await api.post(`/products/${id}/reject`, {})
      loadPending()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_reject', 'Error al rechazar producto'))
    }
  }

  const disapproveProduct = async (p: any) => {
    try {
      await api.post('/assembly/proposals', {
        proposal_type: 'product_disapproval',
        title: `Desaprobar producto: ${p.name}`,
        description: `Proponer desaprobar el producto "${p.name}" del catalogo. El producto no se elimina, solo cambia su estado a no aprobado.`,
        parameters: {
          product_id: p.id,
          product_name: p.name,
        },
      })
      setSuccess(t('success_disapprove_proposal', 'Propuesta creada en la Asamblea para desaprobar "{{name}}". La Asamblea o Junta Directiva decidira.', { name: p.name }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_proposal', 'Error al crear propuesta'))
    }
  }

  const approveFromFederated = async (p: any) => {
    try {
      await api.post('/assembly/proposals', {
        proposal_type: 'product_approval',
        title: `Aprobar producto: ${p.name}`,
        description: `Proponer aprobar el producto "${p.name}" para el catalogo del nodo.`,
        parameters: {
          product_id: p.id,
          product_name: p.name,
        },
      })
      setSuccess(t('success_approve_proposal', 'Propuesta creada en la Asamblea para aprobar "{{name}}". La Asamblea o Junta Directiva decidira.', { name: p.name }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_proposal', 'Error al crear propuesta'))
    }
  }

  const removeProduct = async (p: any) => {
    try {
      await api.post('/assembly/proposals', {
        proposal_type: 'product_remove',
        title: `Eliminar producto: ${p.name}`,
        description: `Proponer ELIMINAR el producto "${p.name}" del catalogo. Esta accion es permanente y no se puede deshacer.`,
        parameters: {
          product_id: p.id,
          product_name: p.name,
        },
      })
      setSuccess(t('success_delete_proposal', 'Propuesta creada en la Asamblea para eliminar "{{name}}". Requiere aprobacion de la Asamblea.', { name: p.name }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_proposal', 'Error al crear propuesta'))
    }
  }

  const rejectFedProduct = async (id: string) => {
    try {
      await api.post(`/federation/products/${id}/reject`, { notes: 'Rechazado por el nodo' })
      loadFedProposals()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_approve_fed', 'Error al rechazar producto federado'))
    }
  }

  // Promover compuesto a producto base
  const promoteComposite = async (id: string) => {
    try {
      await api.post(`/products/${id}/promote`, {})
      loadComposite()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_promote', 'Error al promover producto'))
    }
  }

  // Proponer importar un producto federado a la Asamblea
  const proposeProductToAssembly = async (p: any) => {
    try {
      await api.post('/assembly/proposals', {
        proposal_type: 'product_import',
        title: `Importar producto: ${p.name}`,
        description: `Proponer importar el producto "${p.name}" del nodo ${p.node_domain} al catalogo local. Categoria: ${p.parent_category} > ${p.category}. Precio referencial: ${p.price} ${currency || 'TQ'}.`,
        parameters: {
          product_name: p.name,
          source_node: p.node_domain,
          source_product_id: p.id,
          category: p.parent_category,
          subcategory: p.category,
          price: p.price,
          image_url: p.image_url,
        },
      })
      setSuccess(t('success_import_proposal', 'Propuesta creada en la Asamblea para importar "{{name}}". La Asamblea decidira si se aprueba.', { name: p.name }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_proposal', 'Error al crear propuesta'))
    }
  }

  // Proponer remover un producto del nodo (desaprobar)
  const proposeProductRemoval = async (p: any) => {
    try {
      await api.post('/assembly/proposals', {
        proposal_type: 'product_remove',
        title: `Remover producto: ${p.name}`,
        description: `Proponer remover/desaprobar el producto "${p.name}" del catalogo local.`,
        parameters: {
          product_id: p.id,
          product_name: p.name,
        },
      })
      setSuccess(t('success_remove_proposal', 'Propuesta creada en la Asamblea para remover "{{name}}".', { name: p.name }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_proposal', 'Error al crear propuesta'))
    }
  }

  // Proponer convertir un compuesto a producto base
  const proposeCompositeToBase = async (p: any) => {
    try {
      await api.post('/assembly/proposals', {
        proposal_type: 'product_to_base',
        title: `Convertir a producto base: ${p.name}`,
        description: `Proponer convertir el producto compuesto "${p.name}" en producto base/materia prima para que pueda ser usado como ingrediente de otros productos compuestos.`,
        parameters: {
          product_id: p.id,
          product_name: p.name,
        },
      })
      setSuccess(t('success_to_base_proposal', 'Propuesta creada en la Asamblea para convertir "{{name}}" a producto base.', { name: p.name }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_proposal', 'Error al crear propuesta'))
    }
  }

  // Permitir producto en el nodo
  const allowProduct = async (p: any) => {
    try {
      await api.post(`/products/${p.id}/allow`, {})
      setSuccess(t('success_allowed', '"{{name}}" marcado como permitido en el nodo.', { name: p.name }))
      if (activeTab === 'mynode') load(true)
      if (activeTab === 'federated') loadFederated()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_allow', 'Error al permitir producto'))
    }
  }

  // No permitir producto en el nodo
  const disallowProduct = async (p: any) => {
    try {
      await api.post(`/products/${p.id}/disallow`, {})
      setSuccess(t('success_disallowed', '"{{name}}" marcado como NO permitido en el nodo.', { name: p.name }))
      if (activeTab === 'mynode') load(true)
      if (activeTab === 'federated') loadFederated()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_disallow', 'Error al no permitir producto'))
    }
  }

  // Buscar al presionar Enter o boton
  const doSearch = () => {
    setSearchTerm(searchInput.trim())
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearchTerm('')
  }

  // Infinite scroll observer (solo para mi nodo sin filtros ni busqueda)
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !filterParentCategory && !filterCategory && !filterSubcategory && !searchTerm && activeTab === 'mynode') {
          load(false)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, load, filterParentCategory, filterCategory, filterSubcategory, searchTerm, activeTab])

  // Categorias y subcategorias jerarquicas
  const parentCategoryMap = products.reduce((acc, p) => {
    const pc = p.parent_category || t('no_category', 'Sin categoría')
    const cat = p.category || ''
    if (!acc[pc]) acc[pc] = new Set<string>()
    if (cat) acc[pc].add(cat)
    return acc
  }, {} as Record<string, Set<string>>)

  const parentCategories = Object.keys(parentCategoryMap).sort()
  const categories = filterParentCategory ? Array.from(parentCategoryMap[filterParentCategory] || []).sort() as string[] : []

  const categorySubMap = products.reduce((acc, p) => {
    const cat = p.category || ''
    const sub = p.subcategory || ''
    if (!acc[cat]) acc[cat] = new Set<string>()
    if (sub) acc[cat].add(sub)
    return acc
  }, {} as Record<string, Set<string>>)

  const subcategories = filterCategory ? Array.from(categorySubMap[filterCategory] || []).sort() as string[] : []

  const filteredProducts = products.filter((p) => {
    if (filterParentCategory && p.parent_category !== filterParentCategory) return false
    if (filterCategory && p.category !== filterCategory) return false
    if (filterSubcategory && p.subcategory !== filterSubcategory) return false
    return true
  })

  const selectParentCategory = (pc: string) => {
    setFilterParentCategory(pc)
    setFilterCategory('')
    setFilterSubcategory('')
  }

  const selectCategory = (cat: string) => {
    setFilterCategory(cat)
    setFilterSubcategory('')
  }

  // Cargar opciones de componentes del catalogo federado (materia prima,
  // base, trabajo, embalaje, envio) cuando el formulario esta abierto
  useEffect(() => {
    if (!showForm && !editingId) return
    const params = new URLSearchParams()
    if (compTypeFilter !== 'all') params.set('category', compTypeFilter)
    if (compSearch.trim()) params.set('search', compSearch.trim())
    const qs = params.toString()
    api.get('/products/components' + (qs ? `?${qs}` : ''))
      .then((d: any) => setCompOptions(Array.isArray(d) ? d : []))
      .catch(() => setCompOptions([]))
  }, [showForm, editingId, compTypeFilter, compSearch])

  // Piso de referencia: suma de componentes (precio minimo del producto)
  const componentsFloor = formComponents.reduce((sum, c) => sum + c.component_price * c.quantity, 0)

  const addFormComponent = () => {
    const comp = compOptions.find((c: any) => c.id === selComponentId)
    if (!comp || selComponentQty <= 0) return
    setFormComponents([...formComponents, {
      component_product_id: comp.id,
      component_name: comp.name,
      component_unit: comp.unit || 'unidad',
      component_price: comp.price_per_unit || 0,
      quantity: selComponentQty,
      component_category: itemTypeToCategory[comp.item_type] || 'materia_prima',
      component_catalog_key: comp.catalog_key || '',
    }])
    setSelComponentId('')
    setSelComponentQty(1)
  }

  const removeFormComponent = (idx: number) => {
    setFormComponents(formComponents.filter((_, i) => i !== idx))
  }

  // Proponer un nuevo item al catalogo federado: votacion de la federacion
  // (no de la asamblea local). El item es identico en todos los nodos.
  const proposeCatalogItem = async () => {
    if (!catalogForm.name) {
      setError(t('error_name_required', 'El nombre del item es obligatorio'))
      return
    }
    try {
      // El slug debe ser igual en todos los nodos: replica de CatalogItemSlug
      const slug = 'fed-' + catalogForm.name.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      await api.post('/federation-gov/proposals', {
        proposal_type: 'catalog_item_upsert',
        key: slug,
        proposed_value: { ...catalogForm },
        description: `Agregar/actualizar item del catalogo federado: ${catalogForm.name} (${catalogForm.item_type})`,
      })
      setSuccess(t('success_catalog_proposal', 'Propuesta creada. La federacion votara para agregar "{{name}}" al catalogo global.', { name: catalogForm.name }))
      setShowCatalogProposal(false)
      setCatalogForm({ name: '', description: '', item_type: 'raw_material', parent_category: '', category: '', subcategory: '', unit: 'kg', price_per_unit: 0, price_per_kg: 0, weight_kg: 0, base_unit: 'kg', badge: '', image_url: '', product_code: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_proposal', 'Error al crear propuesta'))
    }
  }

  // Proponer retirar un item del catalogo federado
  const proposeCatalogRemove = async (p: any) => {
    try {
      await api.post('/federation-gov/proposals', {
        proposal_type: 'catalog_item_remove',
        key: p.catalog_key,
        proposed_value: p.catalog_key,
        description: `Retirar del catalogo federado: ${p.name} (${p.catalog_key})`,
      })
      setSuccess(t('success_remove_proposal', 'Propuesta creada. La federacion votara para retirar "{{name}}".', { name: p.name }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_proposal', 'Error al crear propuesta'))
    }
  }

  const setTranslatedField = (field: string, value: string) => {
    setFormTranslations((prev) => ({ ...prev, [formLang]: { ...(prev[formLang] || {}), [field]: value } }))
  }

  const changeFormLanguage = async (lang: string) => {
    setFormLang(lang)
    if (!editingId || lang === defaultLang || formTranslations[lang]) return
    try {
      const translations = await api.get<any[]>(`/products/${editingId}/translations`)
      const current = (translations || []).find((item: any) => item.language === lang)
      setFormTranslations((prev) => ({
        ...prev,
        [lang]: { name: current?.name || '', description: current?.description || '', badge: '', unit: '' },
      }))
    } catch {
      setFormTranslations((prev) => ({ ...prev, [lang]: { name: '', description: '', badge: '', unit: '' } }))
    }
  }

  const startEdit = (p: any) => {
    setEditingId(p.id)
    setForm({
      name: p.name || '',
      description: p.description || '',
      unit: p.unit || 'unidad',
      parent_category: p.parent_category || '',
      category: p.category || '',
      subcategory: p.subcategory || '',
      price: (p.price || 0) / 100,
      product_code: p.product_code || '',
      badge: p.badge || '',
      image_url: p.image_url || '',
      origin: p.origin || 'internal',
      is_hidden: p.is_hidden || false,
    })
    setFormTranslations({})
    setFormLang(defaultLang)
    setShowForm(false)
    // Cargar la composicion existente (productos de nodo = compuestos)
    setFormComponents([])
    api.get(`/store/composite/${p.id}/composition`).then((d: any) => {
      if (Array.isArray(d)) {
        setFormComponents(d.map((c: any) => ({
          component_product_id: c.component_product_id || '',
          component_name: c.component_name,
          component_unit: c.component_unit || 'unidad',
          component_price: c.component_price || 0,
          quantity: c.quantity || 1,
          component_category: c.component_category || 'materia_prima',
          component_catalog_key: c.component_catalog_key || '',
        })))
      }
    }).catch(() => {})
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormTranslations({})
    setFormComponents([])
    setFormLang(defaultLang)
  }

  const save = async () => {
    setError('')
    if (!form.name) {
      setError(t('error_name_required', 'El nombre es obligatorio'))
      return
    }
    // Productos del nodo = compuestos: requieren al menos un componente
    // del catalogo federado. El precio = suma de componentes (piso).
    if (!editingId && formComponents.length === 0) {
      setError(t('error_components_required', 'Agrega al menos un componente del catalogo federado (materia prima, trabajo, embalaje o envio)'))
      return
    }
    try {
      const price = Math.max(form.price, componentsFloor)
      const payload = { ...form, price, translations: formTranslations, components: formComponents }
      if (editingId) {
        await api.put(`/products/${editingId}`, payload)
      } else {
        await api.post('/products', payload)
      }
      setForm(emptyForm)
      setFormTranslations({})
      setFormComponents([])
      setFormLang(defaultLang)
      setEditingId(null)
      setShowForm(false)
      if (activeTab === 'mynode') load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_save', 'Error al guardar producto'))
    }
  }

  const handleImageUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const token = localStorage.getItem(getStorageKeys().tokenKey)
      const res = await fetch('/api/uploads/image', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setForm({ ...form, image_url: data.url })
    } catch {
      setError(t('error_upload_image', 'No se pudo subir la imagen'))
    }
  }

  const ProductFormFields = () => (
    <div className="space-y-4">
      {languages.length > 1 && (
        <div>
          <label className="label flex items-center gap-2"><Globe size={15} />{t('form_language_label', 'Idioma del contenido')}</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {languages.map((lang) => (
              <button key={lang.code} type="button" onClick={() => changeFormLanguage(lang.code)} className={`px-3 py-1 rounded-lg text-xs font-medium border ${formLang === lang.code ? 'bg-trueque-600 text-white border-trueque-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                {lang.code.toUpperCase()}{lang.code === defaultLang ? ` (${t('common:default', 'principal')})` : ''}
              </button>
            ))}
          </div>
          {formLang !== defaultLang && <p className="text-xs text-blue-600 mt-1">{t('form_optional_translation_hint', 'Traducción opcional. Si queda vacía se mostrará el idioma principal.')}</p>}
        </div>
      )}
      <div>
        <label className="label">{t('form_name_label', 'Nombre del producto')}</label>
        <input className="input" placeholder={t('form_name_placeholder', 'Ej: Pan integral 500g')} value={formLang === defaultLang ? form.name : formTranslations[formLang]?.name || ''} onChange={(e) => formLang === defaultLang ? setForm({ ...form, name: e.target.value }) : setTranslatedField('name', e.target.value)} />
      </div>

      <div>
        <label className="label">{t('form_description_label', 'Descripción')}</label>
        <textarea className="input" rows={2} placeholder={t('form_description_placeholder', 'Descripción del producto...')} value={formLang === defaultLang ? form.description : formTranslations[formLang]?.description || ''} onChange={(e) => formLang === defaultLang ? setForm({ ...form, description: e.target.value }) : setTranslatedField('description', e.target.value)} />
      </div>

      <div>
        <label className="label">{t('form_badge_label', 'Etiqueta destacada (badge)')}</label>
        <input className="input" placeholder={t('form_badge_placeholder', 'Ej: Fresco del Día, Plato Estrella, 100% Puro')} value={formLang === defaultLang ? form.badge : formTranslations[formLang]?.badge || ''} onChange={(e) => formLang === defaultLang ? setForm({ ...form, badge: e.target.value }) : setTranslatedField('badge', e.target.value)} />
        <p className="text-xs text-gray-400 mt-1">{t('form_badge_hint', 'Etiqueta que aparece destacada en la tarjeta del producto en la página pública.')}</p>
      </div>

      <div>
        <label className="label">{t('form_photo_label', 'Foto del producto')}</label>
        <div className="flex items-center gap-3">
          {form.image_url && (
            <img src={assetUrl(form.image_url)} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
          )}
          <div className="flex-1 space-y-2">
            <input className="input" placeholder={t('form_photo_url_placeholder', 'URL de la imagen...')} value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold hover:bg-emerald-200 transition cursor-pointer border border-emerald-300">
              <Upload size={14} />
              {t('form_photo_upload', 'Subir desde PC')}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleImageUpload(f)
              }} />
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">{t('form_parent_category_label', 'Categoría Padre')}</label>
          <select
            className="input"
            value={form.parent_category}
            onChange={(e) => setForm({ ...form, parent_category: e.target.value, category: '' })}
          >
            <option value="">{t('form_select_placeholder', 'Seleccionar...')}</option>
            {Object.keys(PARENT_CATEGORIES).map((pc) => (
              <option key={pc} value={pc}>{tc(pc)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t('form_category_label', 'Categoría')}</label>
          <select
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            disabled={!form.parent_category}
          >
            <option value="">{t('form_select_placeholder', 'Seleccionar...')}</option>
            {form.parent_category && PARENT_CATEGORIES[form.parent_category]?.map((c) => (
              <option key={c} value={c}>{tc(c)}</option>
            ))}
            {form.parent_category && !PARENT_CATEGORIES[form.parent_category]?.includes(form.category) && form.category && (
              <option value={form.category}>{tc(form.category)}</option>
            )}
          </select>
        </div>
        <div>
          <label className="label">{t('form_subcategory_label', 'Subcategoría')}</label>
          <input className="input" placeholder={t('form_subcategory_placeholder', 'Ej: Hojas verdes')} value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
        </div>
      </div>

      {/* Componentes: todo producto del nodo es compuesto desde el catalogo federado */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-emerald-800">{t('components_title', 'Componentes (catalogo federado)')}</p>
        <p className="text-xs text-gray-600">{t('components_desc', 'Los productos del nodo se arman con materia prima, productos base, trabajo, embalaje y envio del catalogo de la federacion. El precio es la suma de los componentes.')}</p>
        <div className="flex flex-wrap gap-2">
          <select className="input flex-1 min-w-[120px]" value={compTypeFilter} onChange={(e) => setCompTypeFilter(e.target.value)}>
            <option value="all">{t('store_cat_all', 'Todos')}</option>
            <option value="materia_prima">{t('store_cat_raw_materials', 'Materias Primas')}</option>
            <option value="producto_base">{t('store_cat_base_products', 'Productos Base')}</option>
            <option value="trabajo">{t('store_cat_work', 'Trabajo (h)')}</option>
            <option value="embalaje">{t('store_cat_packaging', 'Embalaje')}</option>
            <option value="envio">{t('store_cat_shipping', 'Envio')}</option>
          </select>
          <input className="input flex-1 min-w-[140px]" placeholder={t('components_search_placeholder', 'Buscar componente...')} value={compSearch} onChange={(e) => setCompSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <select className="input flex-1" value={selComponentId} onChange={(e) => setSelComponentId(e.target.value)}>
            <option value="">{t('components_select', 'Seleccionar componente...')}</option>
            {compOptions.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name} — {fmtTQ(c.price_per_unit || 0)} {currency}/{c.unit || 'unidad'}{c.node_domain === '__FEDERATION__' ? ' 🌐' : ''}
              </option>
            ))}
          </select>
          <input type="number" step="any" min="0" className="input w-24" placeholder={t('components_qty', 'Cant.')} value={selComponentQty} onChange={(e) => setSelComponentQty(parseFloat(e.target.value) || 0)} />
          <button type="button" onClick={addFormComponent} disabled={!selComponentId || selComponentQty <= 0} className="btn-secondary flex items-center gap-1">
            <Plus size={14} /> {t('components_add', 'Agregar')}
          </button>
        </div>
        {formComponents.length > 0 && (
          <div className="space-y-1">
            {formComponents.map((c, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 border border-gray-200 text-sm">
                <span>{c.component_name} <span className="text-xs text-gray-400">({c.component_category})</span></span>
                <span className="text-xs text-gray-600">
                  {c.quantity} {c.component_unit} × {fmtTQ(c.component_price)} = <strong>{fmtTQ(c.component_price * c.quantity)} {currency}</strong>
                  <button type="button" onClick={() => removeFormComponent(i)} className="text-red-500 hover:text-red-700 ml-2"><X size={14} /></button>
                </span>
              </div>
            ))}
            <p className="text-xs font-semibold text-emerald-800 pt-1">
              {t('components_floor', 'Precio minimo (suma de componentes):')} {fmtTQ(componentsFloor)} {currency}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t('form_unit_label', 'Unidad de medida')}</label>
          <input className="input" placeholder={t('form_unit_placeholder', 'Ej: kg, litro, unidad, hora')} value={formLang === defaultLang ? form.unit : formTranslations[formLang]?.unit || ''} onChange={(e) => formLang === defaultLang ? setForm({ ...form, unit: e.target.value }) : setTranslatedField('unit', e.target.value)} />
        </div>
        <div>
          <label className="label">{t('form_price_label', 'Precio')} ({currency})</label>
          <input type="number" className="input" placeholder={t('form_price_placeholder', 'Ej: 50')} value={form.price} onChange={(e) => setForm({ ...form, price: toCents(e.target.value) })} />
          {componentsFloor > 0 && <p className="text-xs text-gray-400 mt-1">{t('form_price_floor_hint', 'Minimo:')} {fmtTQ(componentsFloor)} {currency}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t('form_code_label', 'Código de producto (opcional)')}</label>
          <input className="input" placeholder={t('form_code_placeholder', 'Ej: PAN-001')} value={form.product_code} onChange={(e) => setForm({ ...form, product_code: e.target.value })} />
        </div>
        <div>
          <label className="label">{t('form_visibility_label', 'Visibilidad en página pública')}</label>
          <button
            type="button"
            onClick={() => setForm({ ...form, is_hidden: !form.is_hidden })}
            className={`input flex items-center gap-2 cursor-pointer ${form.is_hidden ? 'text-amber-700' : 'text-emerald-700'}`}
          >
            {form.is_hidden ? <><EyeOff size={16} /> {t('form_visibility_hidden', 'Oculto (no se muestra)')}</> : <><Eye size={16} /> {t('form_visibility_visible', 'Visible (se muestra)')}</>}
          </button>
          <p className="text-xs text-gray-400 mt-1">{t('form_visibility_hint', 'Ocultar no elimina el producto, solo lo quita de la página pública.')}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={save} className="btn-primary flex items-center gap-2">
          <Check size={16} />
          {editingId ? t('form_save_changes', 'Guardar Cambios') : t('form_create_product', 'Crear Producto')}
        </button>
        <button onClick={() => { cancelEdit(); setShowForm(false) }} className="btn-secondary flex items-center gap-2">
          <X size={16} />
          {t('form_cancel', t('common:cancel'))}
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Package size={24} />{t('title', 'Productos')}</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
          {fedProposals.length > 0 && (
            <button onClick={() => { setShowFedPanel(!showFedPanel); loadFedProposals() }} className="btn-secondary flex items-center gap-2 relative">
              <Globe size={18} />
              {t('federated_button', 'Federados')}
              <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {fedProposals.length}
              </span>
            </button>
          )}
          {canManage && (
            <button onClick={() => { setShowPending(!showPending); loadPending() }} className="btn-secondary flex items-center gap-2 relative">
              <Package size={18} />
              {t('pending_button', 'Pendientes')}
              {pendingProducts.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingProducts.length}
                </span>
              )}
            </button>
          )}
          {canManage && activeTab === 'mynode' && (
            <button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); setFormTranslations({}); setFormLang(defaultLang) }} className="btn-primary flex items-center gap-2"><Plus size={18} />{t('new_button', 'Nuevo')}</button>
          )}
        </div>
      </div>

      {/* Panel de productos federados pendientes */}
      {showFedPanel && (
        <div className="card space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Globe size={18} />{t('fed_pending_title', 'Productos Federados Pendientes')}</h2>
          <p className="text-xs text-gray-500">{t('fed_pending_desc', 'Productos base aprobados por la asamblea de otros nodos federados. Para que esten disponibles en este nodo, la asamblea local debe aprobarlos individualmente.')}</p>
          {fedProposals.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">{t('fed_pending_empty', 'No hay productos federados pendientes.')}</p>
          ) : (
            <div className="space-y-2">
              {fedProposals.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t('from_label', 'De:')} {p.source_node}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{fmtTQ(p.price_per_unit)} TQ/{p.unit}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{p.description}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {tc(p.parent_category)} › {tc(p.category)} {p.subcategory ? `› ${tc(p.subcategory)}` : ''}
                      {p.is_composite && <span className="ml-2 text-emerald-600 font-medium">{t('composite_badge', 'Compuesto')}</span>}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <button onClick={() => approveFedProduct(p.id)} className="btn-primary text-sm flex items-center gap-1">
                        <Check size={14} /> {t('approve', 'Aprobar')}
                      </button>
                      <button onClick={() => rejectFedProduct(p.id)} className="btn-secondary text-sm text-red-600 flex items-center gap-1">
                        <X size={14} /> {t('reject', 'Rechazar')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Panel de productos pendientes de aprobacion */}
      {showPending && (
        <div className="card space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Package size={18} />{t('pending_title', 'Productos Pendientes de Aprobacion')}</h2>
          <p className="text-xs text-gray-500">{t('pending_desc', 'Productos que han sido solicitados pero aun no han sido aprobados para el catalogo. Aprobalos para que aparezcan en la lista principal.')}</p>
          {pendingProducts.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">{t('pending_empty', 'No hay productos pendientes de aprobacion.')}</p>
          ) : (
            <div className="space-y-2">
              {pendingProducts.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{fmtTQ(p.price_per_unit)} {currency}/{p.unit}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{p.description}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {tc(p.parent_category)} › {tc(p.category)} {p.subcategory ? `› ${tc(p.subcategory)}` : ''}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <button onClick={() => approveProduct(p.id)} className="btn-primary text-sm flex items-center gap-1">
                        <Check size={14} /> {t('approve', 'Aprobar')}
                      </button>
                      <button onClick={() => rejectProduct(p.id)} className="btn-secondary text-sm text-red-600 flex items-center gap-1">
                        <X size={14} /> {t('reject', 'Rechazar')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>{t('help_title', 'Productos del Catalogo Comunitario - Ayuda')}</strong></p>
          <p><strong>{t('help_tabs_label', 'Tres pestanas:')}</strong></p>
          <p><strong>{t('help_federation_label', '1. Federacion:')}</strong> {t('help_federation_desc', 'El catalogo global de la federacion: materia prima, productos base, servicios, embalaje y envio. Es identico en todos los nodos y sus precios son de referencia (minimo). Solo cambia por votacion de la federacion.')}</p>
          <p><strong>{t('help_my_node_label', '2. Mi Nodo:')}</strong> {t('help_my_node_desc', 'Los productos de tu nodo. Todos son compuestos: se arman desde el catalogo federado + trabajo local. El precio es la suma de sus componentes (piso federado).')}</p>
          <p><strong>{t('help_compounds_label', '3. Compuestos:')}</strong> {t('help_compounds_desc', 'Vista de los productos compuestos del nodo: combinaciones de componentes del catalogo federado (ej: harina + agua + horno = pan).')}</p>
          <p><strong>{t('help_search_label', 'Busqueda:')}</strong> {t('help_search_desc', 'Escribe parte del nombre en el campo de busqueda para encontrar productos rapidamente.')}</p>
          <p><strong>{t('help_public_page_label', 'Pagina publica:')}</strong> {t('help_public_page_desc', 'Los productos aprobados aparecen automaticamente en la pagina publica si usas el bloque Catalogo desde Backend.')}</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('close', t('common:close'))}</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
      {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg">{success}</div>}

      {showForm && canManage && (
        <div className="card">
          <h2 className="font-semibold mb-4">{t('new_product', 'Nuevo Producto')}</h2>
          <ProductFormFields />
        </div>
      )}

      {/* Pestañas: Federacion / Mi Nodo / Compuestos */}
      <div className="flex flex-wrap gap-2 border-b">
        <button
          onClick={() => { setActiveTab('federated'); setFilterParentCategory(''); setFilterCategory(''); setFilterSubcategory('') }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
            activeTab === 'federated'
              ? 'bg-blue-700 text-white shadow'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Globe size={16} />
          {t('tab_federation', 'Federación')}
        </button>
        <button
          onClick={() => { setActiveTab('mynode'); setFilterParentCategory(''); setFilterCategory(''); setFilterSubcategory('') }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
            activeTab === 'mynode'
              ? 'bg-emerald-700 text-white shadow'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Package size={16} />
          {t('tab_my_node', 'Mi Nodo')}
        </button>
        {activeTab === 'mynode' && (
          <div className="flex gap-1 ml-2">
            <button
              onClick={() => { setMynodeSubTab('allowed'); setFilterParentCategory(''); setFilterCategory(''); setFilterSubcategory('') }}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${
                mynodeSubTab === 'allowed'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {t('subtab_allowed', 'Permitidos')}
            </button>
            <button
              onClick={() => { setMynodeSubTab('disallowed'); setFilterParentCategory(''); setFilterCategory(''); setFilterSubcategory('') }}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${
                mynodeSubTab === 'disallowed'
                  ? 'bg-red-100 text-red-800 border border-red-300'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {t('subtab_disallowed', 'No Permitidos')}
            </button>
          </div>
        )}
        <button
          onClick={() => { setActiveTab('composite'); setFilterParentCategory(''); setFilterCategory(''); setFilterSubcategory('') }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
            activeTab === 'composite'
              ? 'bg-purple-700 text-white shadow'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Layers size={16} />
          {t('tab_composite', 'Compuestos')}
        </button>
      </div>

      {/* Campo de busqueda por nombre */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-10"
            placeholder={t('search_placeholder', 'Buscar producto por nombre...')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }}
          />
        </div>
        {/* Filtro por organizacion - solo en pestaña Federacion */}
        {activeTab === 'federated' && fedNodes.length > 0 && (
          <select
            value={fedNodeFilter}
            onChange={(e) => setFedNodeFilter(e.target.value)}
            className="input max-w-[250px]"
          >
            <option value="">{t('all_organizations', 'Todas las organizaciones')}</option>
            {fedNodes.map((n: any) => (
              <option key={n.node_domain} value={n.node_domain}>
                {n.node_domain} ({n.product_count})
              </option>
            ))}
          </select>
        )}
        {/* Proponer nuevo item al catalogo federado (votacion de la federacion) */}
        {activeTab === 'federated' && canManage && (
          <button
            onClick={() => setShowCatalogProposal(!showCatalogProposal)}
            className="btn-secondary flex items-center gap-1 text-sm"
          >
            <Globe size={14} /> {t('propose_catalog_item', 'Proponer item al catalogo')}
          </button>
        )}
        <button onClick={doSearch} className="btn-primary flex items-center gap-2">
          <Search size={16} />
          {t('search_button', 'Buscar')}
        </button>
        {searchTerm && (
          <button onClick={clearSearch} className="btn-secondary flex items-center gap-2">
            <X size={16} />
            {t('clear_button', 'Limpiar')}
          </button>
        )}
      </div>

      {/* Formulario: proponer item al catalogo federado (votacion global) */}
      {showCatalogProposal && activeTab === 'federated' && (
        <div className="card bg-blue-50 border border-blue-200 space-y-3">
          <h3 className="font-semibold flex items-center gap-2 text-blue-900"><Globe size={18} />{t('catalog_proposal_title', 'Proponer item al catalogo federado')}</h3>
          <p className="text-xs text-blue-700">{t('catalog_proposal_desc', 'El item sera identico en todos los nodos. Requiere aprobacion por votacion de la federacion (75% por defecto), no de la asamblea local.')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('form_name_label', 'Nombre del producto')}</label>
              <input className="input" value={catalogForm.name} onChange={(e) => setCatalogForm({ ...catalogForm, name: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('catalog_item_type', 'Tipo de item')}</label>
              <select className="input" value={catalogForm.item_type} onChange={(e) => setCatalogForm({ ...catalogForm, item_type: e.target.value })}>
                {ITEM_TYPES.map((it) => (
                  <option key={it} value={it}>{t(`item_type_${it}`, it)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t('form_description_label', 'Descripción')}</label>
            <textarea className="input" rows={2} value={catalogForm.description} onChange={(e) => setCatalogForm({ ...catalogForm, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">{t('form_parent_category_label', 'Categoría Padre')}</label>
              <input className="input" value={catalogForm.parent_category} onChange={(e) => setCatalogForm({ ...catalogForm, parent_category: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('form_category_label', 'Categoría')}</label>
              <input className="input" value={catalogForm.category} onChange={(e) => setCatalogForm({ ...catalogForm, category: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('form_subcategory_label', 'Subcategoría')}</label>
              <input className="input" value={catalogForm.subcategory} onChange={(e) => setCatalogForm({ ...catalogForm, subcategory: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">{t('form_unit_label', 'Unidad de medida')}</label>
              <input className="input" value={catalogForm.unit} onChange={(e) => setCatalogForm({ ...catalogForm, unit: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('catalog_ref_price', 'Precio referencia')} ({currency})</label>
              <input type="number" step="any" className="input" value={catalogForm.price_per_unit} onChange={(e) => setCatalogForm({ ...catalogForm, price_per_unit: toCents(e.target.value) })} />
              <p className="text-[10px] text-gray-500 mt-1">{t('catalog_ref_price_hint', 'Precio minimo/referencia en todos los nodos')}</p>
            </div>
            <div>
              <label className="label">{t('catalog_price_per_kg', 'Precio por kg')} ({currency})</label>
              <input type="number" step="any" className="input" value={catalogForm.price_per_kg} onChange={(e) => setCatalogForm({ ...catalogForm, price_per_kg: toCents(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('catalog_weight_kg', 'Peso/cantidad base')}</label>
              <input type="number" step="any" className="input" value={catalogForm.weight_kg} onChange={(e) => setCatalogForm({ ...catalogForm, weight_kg: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="label">{t('catalog_base_unit', 'Unidad base')}</label>
              <input className="input" value={catalogForm.base_unit} onChange={(e) => setCatalogForm({ ...catalogForm, base_unit: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={proposeCatalogItem} className="btn-primary flex items-center gap-2">
              <Check size={16} /> {t('catalog_propose_button', 'Proponer a la federacion')}
            </button>
            <button onClick={() => setShowCatalogProposal(false)} className="btn-secondary flex items-center gap-2">
              <X size={16} /> {t('form_cancel', t('common:cancel'))}
            </button>
          </div>
        </div>
      )}

      {products.length === 0 && !showForm ? (
        <div className="card text-center text-gray-500 py-8">
          <p>{loading ? t('loading_products', 'Cargando productos...') : t('no_products', 'No hay productos registrados.')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filtro jerarquico de 3 niveles: Padre > Categoria > Subcategoria */}
          {parentCategories.length > 0 && (
            <div className="space-y-2">
              {/* Nivel 1: Categorias Padre */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setFilterParentCategory(''); setFilterCategory(''); setFilterSubcategory('') }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                    filterParentCategory === '' ? 'bg-emerald-700 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {t('all', 'Todas')} ({products.length})
                </button>
                {parentCategories.map((pc) => {
                  const count = products.filter((p) => (p.parent_category || t('no_category', 'Sin categoría')) === pc).length
                  return (
                    <button
                      key={pc}
                      onClick={() => selectParentCategory(pc)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                        filterParentCategory === pc ? 'bg-emerald-700 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      {tc(pc)} ({count})
                    </button>
                  )
                })}
              </div>
              {/* Nivel 2: Categorias (solo si hay padre seleccionado) */}
              {filterParentCategory && categories.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-4 border-l-2 border-emerald-300">
                  <button
                    onClick={() => { setFilterCategory(''); setFilterSubcategory('') }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                      filterCategory === '' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {t('all', 'Todas')} ({products.filter((p) => (p.parent_category || t('no_category', 'Sin categoría')) === filterParentCategory).length})
                  </button>
                  {categories.map((cat) => {
                    const count = products.filter((p) => p.parent_category === filterParentCategory && p.category === cat).length
                    return (
                      <button
                        key={cat}
                        onClick={() => selectCategory(cat)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                          filterCategory === cat ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        {tc(cat)} ({count})
                      </button>
                    )
                  })}
                </div>
              )}
              {/* Nivel 3: Subcategorias (solo si hay categoria seleccionada) */}
              {filterCategory && subcategories.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-8 border-l-2 border-emerald-200">
                  <button
                    onClick={() => setFilterSubcategory('')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                      filterSubcategory === '' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {t('all', 'Todas')} ({products.filter((p) => p.parent_category === filterParentCategory && p.category === filterCategory).length})
                  </button>
                  {subcategories.map((sub) => {
                    const count = products.filter((p) => p.parent_category === filterParentCategory && p.category === filterCategory && p.subcategory === sub).length
                    return (
                      <button
                        key={sub}
                        onClick={() => setFilterSubcategory(sub)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                          filterSubcategory === sub ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        {tc(sub)} ({count})
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Productos filtrados */}
          {filteredProducts.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">
              <p>{loading ? t('loading', t('common:loading')) : t('no_products_in_category', 'No hay productos en esta categoría.')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((p, i) => (
                <div key={i} className="card overflow-hidden">
                  {editingId === p.id ? (
                    <ProductFormFields />
                  ) : (
                    <>
                      {p.image_url && (
                        <div className="relative -mx-4 -mt-4 mb-3 h-32 overflow-hidden">
                          <img
                            src={assetUrl(p.image_thumb_url || p.image_url)}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onClick={() => window.open(assetUrl(p.image_url), '_blank')}
                            style={{ cursor: 'pointer' }}
                          />
                          {p.badge && (
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-amber-950 shadow">
                              {p.badge}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h3 className="font-semibold">{p.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">{p.description}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {canManage && activeTab === 'mynode' && (
                            <>
                              <button
                                onClick={async () => {
                                  await api.put(`/products/${p.id}`, { ...p, is_hidden: !p.is_hidden })
                                  load(true)
                                }}
                                className={`transition ${p.is_hidden ? 'text-amber-500 hover:text-amber-700' : 'text-gray-400 hover:text-emerald-600'}`}
                                title={p.is_hidden ? t('tooltip_show_public', 'Mostrar en página pública') : t('tooltip_hide_public', 'Ocultar de página pública')}
                              >
                                {p.is_hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                              <button onClick={() => startEdit(p)} className="text-gray-400 hover:text-emerald-600 transition">
                                <Pencil size={16} />
                              </button>
                              {/* Boton permitir/no permitir */}
                              {p.is_allowed === false ? (
                                <button
                                  onClick={() => allowProduct(p)}
                                  className="text-green-500 hover:text-green-700 transition"
                                  title={t('tooltip_allow_node', 'Permitir este producto en el nodo')}
                                >
                                  <Check size={16} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => disallowProduct(p)}
                                  className="text-red-400 hover:text-red-600 transition"
                                  title={t('tooltip_disallow_node', 'No permitir este producto en el nodo')}
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </>
                          )}
                          {canManage && activeTab === 'composite' && (
                            <button
                              onClick={() => promoteComposite(p.id)}
                              className="text-purple-500 hover:text-purple-700 transition"
                              title={t('tooltip_promote_base', 'Promover a producto base (aparece en toda la federacion)')}
                            >
                              <ArrowUpCircle size={18} />
                            </button>
                          )}
                          {activeTab === 'composite' && (
                            <button
                              onClick={() => proposeCompositeToBase(p)}
                              className="text-amber-500 hover:text-amber-700 transition"
                              title={t('tooltip_propose_to_base', 'Proponer en Asamblea convertir a producto base')}
                            >
                              <ArrowUpCircle size={18} />
                            </button>
                          )}
                          {activeTab === 'mynode' && p.is_approved && canManage && (
                            <button
                              onClick={() => disapproveProduct(p)}
                              className="text-amber-500 hover:text-amber-700 transition"
                              title={t('tooltip_propose_disapprove', 'Proponer desaprobar este producto en la Asamblea')}
                            >
                              <EyeOff size={16} />
                            </button>
                          )}
                          {activeTab === 'mynode' && !p.is_approved && canManage && (
                            <button
                              onClick={() => approveFromFederated(p)}
                              className="text-green-500 hover:text-green-700 transition"
                              title={t('tooltip_propose_approve', 'Proponer aprobar este producto en la Asamblea')}
                            >
                              <Check size={16} />
                            </button>
                          )}
                          {activeTab === 'mynode' && canManage && (
                            <button
                              onClick={() => removeProduct(p)}
                              className="text-red-500 hover:text-red-700 transition"
                              title={t('tooltip_propose_delete', 'Proponer ELIMINAR este producto en la Asamblea (permanente)')}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 space-y-1">
                        <p className="text-lg font-bold text-trueque-700">
                          {fmtTQ(p.price)} {currency}
                          {p.unit && <span className="text-sm font-normal text-gray-500"> / {p.unit}</span>}
                        </p>
                        {p.is_federation && (
                          <p className="text-[10px] font-bold text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 inline-block">
                            {t('reference_price_label', 'Precio de referencia (minimo) - catalogo federado')}
                          </p>
                        )}
                        {p.item_type && p.item_type !== 'product' && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full inline-block">
                            {String(t(`item_type_${p.item_type}`, { defaultValue: p.item_type }))}
                          </span>
                        )}
                        {p.price_calculation && (
                          <p className="text-[10px] text-gray-400">{p.price_calculation}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {p.parent_category && <span className="text-gray-600 font-medium">{tc(p.parent_category)}</span>}
                          {p.category && <span> › <span className="text-gray-600 font-medium">{tc(p.category)}</span></span>}
                          {p.subcategory && <span> › <span className="text-gray-600 font-medium">{tc(p.subcategory)}</span></span>}
                        </p>
                        {p.product_code && <p className="text-xs text-gray-400">{t('code_label', 'Código:')} {p.product_code}</p>}
                        {activeTab === 'federated' && p.node_domain && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-blue-600">{t('node_label', 'Nodo:')} {p.is_federation ? t('federation_catalog_name', 'Federacion (catalogo global)') : p.node_domain}</p>
                            {p.available_locally ? (
                              <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Check size={10} /> {t('available_locally', 'Disponible en mi nodo')}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <X size={10} /> {t('not_available_locally', 'No disponible en mi nodo')}
                              </span>
                            )}
                            {/* Estado de permitido/no-permitido */}
                            {p.is_allowed === true && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                {t('allowed', 'Permitido')}
                              </span>
                            )}
                            {p.is_allowed === false && (
                              <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                                {t('not_allowed', 'No Permitido')}
                              </span>
                            )}
                            {p.is_allowed == null && canManage && (
                              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                {t('undecided', 'Sin decidir')}
                              </span>
                            )}
                            {/* Botones permitir/no permitir */}
                            {canManage && p.is_allowed !== true && (
                              <button
                                onClick={() => allowProduct(p)}
                                className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full hover:bg-green-200 transition flex items-center gap-1"
                                title={t('tooltip_allow_node', 'Permitir este producto en el nodo')}
                              >
                                <Check size={10} /> {t('allow', 'Permitir')}
                              </button>
                            )}
                            {canManage && p.is_allowed !== false && (
                              <button
                                onClick={() => disallowProduct(p)}
                                className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full hover:bg-red-200 transition flex items-center gap-1"
                                title={t('tooltip_disallow_node', 'No permitir este producto en el nodo')}
                              >
                                <X size={10} /> {t('disallow', 'No Permitir')}
                              </button>
                            )}
                            {/* Items del catalogo federado: cambios por votacion de la federacion */}
                            {p.is_federation && canManage && (
                              <>
                                <button
                                  onClick={() => {
                                    setCatalogForm({
                                      name: p.name, description: p.description || '',
                                      item_type: p.item_type || 'raw_material',
                                      parent_category: p.parent_category || '', category: p.category || '',
                                      subcategory: p.subcategory || '', unit: p.unit || 'kg',
                                      price_per_unit: (p.price || 0) / 100, price_per_kg: (p.base_price || 0) / 100,
                                      weight_kg: p.weight_kg || 0, base_unit: p.base_unit || 'kg',
                                      badge: p.badge || '', image_url: p.image_url || '',
                                      product_code: p.product_code || '',
                                    })
                                    setShowCatalogProposal(true)
                                  }}
                                  className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full hover:bg-blue-200 transition flex items-center gap-1"
                                  title={t('tooltip_propose_catalog_change', 'Proponer cambio a la federacion (votacion global)')}
                                >
                                  <Pencil size={10} /> {t('propose_catalog_change', 'Proponer cambio')}
                                </button>
                                <button
                                  onClick={() => proposeCatalogRemove(p)}
                                  className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full hover:bg-red-200 transition flex items-center gap-1"
                                  title={t('tooltip_propose_catalog_remove', 'Proponer retirar del catalogo (votacion de la federacion)')}
                                >
                                  <Trash2 size={10} /> {t('propose_catalog_remove', 'Proponer retiro')}
                                </button>
                              </>
                            )}
                            {/* Importar a la asamblea solo aplica a productos de otros nodos, no al catalogo federado */}
                            {!p.available_locally && !p.is_federation && (
                              <button
                                onClick={() => proposeProductToAssembly(p)}
                                className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full hover:bg-amber-200 transition flex items-center gap-1"
                              >
                                <ArrowUpCircle size={10} /> {t('propose_assembly', 'Proponer en Asamblea')}
                              </button>
                            )}
                            {/* Botones aprobar/desaprobar/eliminar para productos del propio nodo */}
                            {p.available_locally && !p.is_federation && canManage && (
                              p.is_approved ? (
                                <button
                                  onClick={() => disapproveProduct(p)}
                                  className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full hover:bg-red-200 transition flex items-center gap-1"
                                  title={t('tooltip_propose_disapprove', 'Proponer desaprobar producto en la Asamblea')}
                                >
                                  <X size={10} /> {t('disapprove', 'Desaprobar')}
                                </button>
                              ) : (
                                <button
                                  onClick={() => approveFromFederated(p)}
                                  className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full hover:bg-green-200 transition flex items-center gap-1"
                                  title={t('tooltip_propose_approve', 'Proponer aprobar producto en la Asamblea')}
                                >
                                  <Check size={10} /> {t('approve', 'Aprobar')}
                                </button>
                              )
                            )}
                            {p.available_locally && !p.is_federation && canManage && (
                              <button
                                onClick={() => removeProduct(p)}
                                className="text-[10px] font-bold text-red-900 bg-red-200 px-2 py-0.5 rounded-full hover:bg-red-300 transition flex items-center gap-1"
                                title={t('tooltip_propose_delete', 'Proponer ELIMINAR producto en la Asamblea (permanente)')}
                              >
                                <Trash2 size={10} /> {t('delete', t('common:delete'))}
                              </button>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          {p.is_approved ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">{t('approved', 'Aprobado')}</span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{t('pending_status', 'Pendiente')}</span>
                          )}
                          {p.is_system && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">{t('system', 'Sistema')}</span>
                          )}
                          {p.is_hidden && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{t('hidden', 'Oculto')}</span>
                          )}
                          {activeTab === 'composite' && (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">{t('composite_badge', 'Compuesto')}</span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sentinel para infinite scroll (solo mi nodo sin filtros ni busqueda) */}
      {activeTab === 'mynode' && !filterParentCategory && !filterCategory && !filterSubcategory && !searchTerm && hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loading ? (
            <Loader2 className="animate-spin text-emerald-600" size={24} />
          ) : (
            <span className="text-xs text-gray-400">{t('scroll_for_more', 'Desliza para cargar más productos...')}</span>
          )}
        </div>
      )}
    </div>
  )
}
