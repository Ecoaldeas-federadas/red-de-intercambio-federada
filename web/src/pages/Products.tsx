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
  const { t } = useTranslation(['products', 'common'])
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

  const PAGE_SIZE = 24

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
  }, [activeTab, searchTerm, mynodeSubTab, fedNodeFilter])

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
    setShowForm(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(emptyForm)
  }

  const save = async () => {
    setError('')
    if (!form.name || form.price <= 0) {
      setError(t('error_name_price_required', 'Nombre y precio son obligatorios'))
      return
    }
    try {
      if (editingId) {
        await api.put(`/products/${editingId}`, form)
      } else {
        await api.post('/products', form)
      }
      setForm(emptyForm)
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
      <div>
        <label className="label">{t('form_name_label', 'Nombre del producto')}</label>
        <input className="input" placeholder={t('form_name_placeholder', 'Ej: Pan integral 500g')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>

      <div>
        <label className="label">{t('form_description_label', 'Descripción')}</label>
        <textarea className="input" rows={2} placeholder={t('form_description_placeholder', 'Descripción del producto...')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>

      <div>
        <label className="label">{t('form_badge_label', 'Etiqueta destacada (badge)')}</label>
        <input className="input" placeholder={t('form_badge_placeholder', 'Ej: Fresco del Día, Plato Estrella, 100% Puro')} value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
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
              <option key={pc} value={pc}>{pc}</option>
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
              <option key={c} value={c}>{c}</option>
            ))}
            {form.parent_category && !PARENT_CATEGORIES[form.parent_category]?.includes(form.category) && form.category && (
              <option value={form.category}>{form.category}</option>
            )}
          </select>
        </div>
        <div>
          <label className="label">{t('form_subcategory_label', 'Subcategoría')}</label>
          <input className="input" placeholder={t('form_subcategory_placeholder', 'Ej: Hojas verdes')} value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t('form_unit_label', 'Unidad de medida')}</label>
          <input className="input" placeholder={t('form_unit_placeholder', 'Ej: kg, litro, unidad, hora')} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        </div>
        <div>
          <label className="label">{t('form_price_label', 'Precio')} ({currency})</label>
          <input type="number" className="input" placeholder={t('form_price_placeholder', 'Ej: 50')} value={form.price} onChange={(e) => setForm({ ...form, price: toCents(e.target.value) })} />
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
            <button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm) }} className="btn-primary flex items-center gap-2"><Plus size={18} />{t('new_button', 'Nuevo')}</button>
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
                      {p.parent_category} › {p.category} {p.subcategory ? `› ${p.subcategory}` : ''}
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
                      {p.parent_category} › {p.category} {p.subcategory ? `› ${p.subcategory}` : ''}
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
          <p><strong>{t('help_federation_label', '1. Federacion:')}</strong> {t('help_federation_desc', 'Todos los productos base que existen en toda la red de nodos federados, INCLUYENDO los de tu propio nodo. Aqui puedes ver todos los productos y decidir cuales estan permitidos o no permitidos en tu nodo.')}</p>
          <p><strong>{t('help_my_node_label', '2. Mi Nodo:')}</strong> {t('help_my_node_desc', 'Los productos base que pertenecen a tu aldea. Tiene dos sub-pestanas: Permitidos (productos que se pueden vender/usar) y No Permitidos (productos explicitamente prohibidos). Puedes editarlos, crear nuevos, y moverlos entre permitido y no permitido.')}</p>
          <p><strong>{t('help_compounds_label', '3. Compuestos:')}</strong> {t('help_compounds_desc', 'Productos creados por la gente de tu aldea combinando productos base (ej: harina + agua = pan). Si todos los ingredientes ya estan permitidos, el compuesto aparece directamente aqui sin necesidad de aprobacion.')}</p>
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
                      {pc} ({count})
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
                        {cat} ({count})
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
                    Todas ({products.filter((p) => p.parent_category === filterParentCategory && p.category === filterCategory).length})
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
                        {sub} ({count})
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
                        {p.price_calculation && (
                          <p className="text-[10px] text-gray-400">{p.price_calculation}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {p.parent_category && <span className="text-gray-600 font-medium">{p.parent_category}</span>}
                          {p.category && <span> › <span className="text-gray-600 font-medium">{p.category}</span></span>}
                          {p.subcategory && <span> › <span className="text-gray-600 font-medium">{p.subcategory}</span></span>}
                        </p>
                        {p.product_code && <p className="text-xs text-gray-400">{t('code_label', 'Código:')} {p.product_code}</p>}
                        {activeTab === 'federated' && p.node_domain && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-blue-600">{t('node_label', 'Nodo:')} {p.node_domain}</p>
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
                            {!p.available_locally && (
                              <button
                                onClick={() => proposeProductToAssembly(p)}
                                className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full hover:bg-amber-200 transition flex items-center gap-1"
                              >
                                <ArrowUpCircle size={10} /> {t('propose_assembly', 'Proponer en Asamblea')}
                              </button>
                            )}
                            {/* Botones aprobar/desaprobar/eliminar para productos del propio nodo */}
                            {p.available_locally && canManage && (
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
                            {p.available_locally && canManage && (
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
