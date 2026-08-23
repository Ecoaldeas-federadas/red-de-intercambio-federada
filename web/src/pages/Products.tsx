import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { useConfig } from '../hooks/useConfig'
import { Plus, HelpCircle, Package, Pencil, Check, X, Upload, Eye, EyeOff, Loader2, Globe, Search, Layers, ArrowUpCircle } from 'lucide-react'
import { assetUrl } from '../utils/assetUrl'

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

export default function Products() {
  const { hasPermission } = usePermissions()
  const { currency } = useConfig()
  const canManage = hasPermission('products.manage')
  const [products, setProducts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
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
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Nueva: busqueda por nombre
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Nueva: pestañas (Federacion, Mi Nodo, Compuestos)
  const [activeTab, setActiveTab] = useState<ProductTab>('mynode')

  const PAGE_SIZE = 24

  const load = useCallback((reset = false) => {
    setLoading(true)
    const offset = reset ? 0 : products.length
    let url = `/products?limit=${PAGE_SIZE}&offset=${offset}`
    if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`
    api.get(url).then((d: any) => {
      const newItems = Array.isArray(d) ? d : d?.products ?? []
      if (reset) {
        setProducts(newItems)
        setHasMore(newItems.length >= PAGE_SIZE)
      } else {
        setProducts(prev => [...prev, ...newItems])
        setHasMore(newItems.length >= PAGE_SIZE)
      }
    }).catch(() => {
      if (reset) setProducts([])
    }).finally(() => setLoading(false))
  }, [products.length, searchTerm])

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
    if (searchTerm) url += `?search=${encodeURIComponent(searchTerm)}`
    api.get(url).then((d: any) => {
      setProducts(Array.isArray(d) ? d : [])
      setHasMore(false)
    }).catch(() => setProducts([])).finally(() => setLoading(false))
  }, [searchTerm])

  // Recargar cuando cambie la pestana o el termino de busqueda
  useEffect(() => {
    if (activeTab === 'mynode') {
      load(true)
    } else if (activeTab === 'composite') {
      loadComposite()
    } else if (activeTab === 'federated') {
      loadFederated()
    }
  }, [activeTab, searchTerm])

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
      setError(err instanceof Error ? err.message : 'Error al aprobar producto federado')
    }
  }

  const approveProduct = async (id: string) => {
    try {
      await api.post(`/products/${id}/approve`, {})
      loadPending()
      if (activeTab === 'mynode') load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al aprobar producto')
    }
  }

  const rejectProduct = async (id: string) => {
    try {
      await api.post(`/products/${id}/reject`, {})
      loadPending()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al rechazar producto')
    }
  }

  const rejectFedProduct = async (id: string) => {
    try {
      await api.post(`/federation/products/${id}/reject`, { notes: 'Rechazado por el nodo' })
      loadFedProposals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al rechazar producto federado')
    }
  }

  // Promover compuesto a producto base
  const promoteComposite = async (id: string) => {
    try {
      await api.post(`/products/${id}/promote`, {})
      loadComposite()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al promover producto')
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
    const pc = p.parent_category || 'Sin categoría'
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
      price: p.price || 0,
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
      setError('Nombre y precio son obligatorios')
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
      setError(err instanceof Error ? err.message : 'Error al guardar producto')
    }
  }

  const handleImageUpload = async (file: File) => {
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
      setForm({ ...form, image_url: data.url })
    } catch {
      setError('No se pudo subir la imagen')
    }
  }

  const ProductFormFields = () => (
    <div className="space-y-4">
      <div>
        <label className="label">Nombre del producto</label>
        <input className="input" placeholder="Ej: Pan integral 500g" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>

      <div>
        <label className="label">Descripción</label>
        <textarea className="input" rows={2} placeholder="Descripción del producto..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>

      <div>
        <label className="label">Etiqueta destacada (badge)</label>
        <input className="input" placeholder="Ej: Fresco del Día, Plato Estrella, 100% Puro" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
        <p className="text-xs text-gray-400 mt-1">Etiqueta que aparece destacada en la tarjeta del producto en la página pública.</p>
      </div>

      <div>
        <label className="label">Foto del producto</label>
        <div className="flex items-center gap-3">
          {form.image_url && (
            <img src={assetUrl(form.image_url)} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
          )}
          <div className="flex-1 space-y-2">
            <input className="input" placeholder="URL de la imagen..." value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold hover:bg-emerald-200 transition cursor-pointer border border-emerald-300">
              <Upload size={14} />
              Subir desde PC
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
          <label className="label">Categoría Padre</label>
          <select
            className="input"
            value={form.parent_category}
            onChange={(e) => setForm({ ...form, parent_category: e.target.value, category: '' })}
          >
            <option value="">Seleccionar...</option>
            {Object.keys(PARENT_CATEGORIES).map((pc) => (
              <option key={pc} value={pc}>{pc}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Categoría</label>
          <select
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            disabled={!form.parent_category}
          >
            <option value="">Seleccionar...</option>
            {form.parent_category && PARENT_CATEGORIES[form.parent_category]?.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            {form.parent_category && !PARENT_CATEGORIES[form.parent_category]?.includes(form.category) && form.category && (
              <option value={form.category}>{form.category}</option>
            )}
          </select>
        </div>
        <div>
          <label className="label">Subcategoría</label>
          <input className="input" placeholder="Ej: Hojas verdes" value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Unidad de medida</label>
          <input className="input" placeholder="Ej: kg, litro, unidad, hora" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        </div>
        <div>
          <label className="label">Precio ({currency})</label>
          <input type="number" className="input" placeholder="Ej: 50" value={form.price} onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Código de producto (opcional)</label>
          <input className="input" placeholder="Ej: PAN-001" value={form.product_code} onChange={(e) => setForm({ ...form, product_code: e.target.value })} />
        </div>
        <div>
          <label className="label">Visibilidad en página pública</label>
          <button
            type="button"
            onClick={() => setForm({ ...form, is_hidden: !form.is_hidden })}
            className={`input flex items-center gap-2 cursor-pointer ${form.is_hidden ? 'text-amber-700' : 'text-emerald-700'}`}
          >
            {form.is_hidden ? <><EyeOff size={16} /> Oculto (no se muestra)</> : <><Eye size={16} /> Visible (se muestra)</>}
          </button>
          <p className="text-xs text-gray-400 mt-1">Ocultar no elimina el producto, solo lo quita de la página pública.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={save} className="btn-primary flex items-center gap-2">
          <Check size={16} />
          {editingId ? 'Guardar Cambios' : 'Crear Producto'}
        </button>
        <button onClick={() => { cancelEdit(); setShowForm(false) }} className="btn-secondary flex items-center gap-2">
          <X size={16} />
          Cancelar
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Package size={24} />Productos</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
          {fedProposals.length > 0 && (
            <button onClick={() => { setShowFedPanel(!showFedPanel); loadFedProposals() }} className="btn-secondary flex items-center gap-2 relative">
              <Globe size={18} />
              Federados
              <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {fedProposals.length}
              </span>
            </button>
          )}
          {canManage && (
            <button onClick={() => { setShowPending(!showPending); loadPending() }} className="btn-secondary flex items-center gap-2 relative">
              <Package size={18} />
              Pendientes
              {pendingProducts.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingProducts.length}
                </span>
              )}
            </button>
          )}
          {canManage && activeTab === 'mynode' && (
            <button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm) }} className="btn-primary flex items-center gap-2"><Plus size={18} />Nuevo</button>
          )}
        </div>
      </div>

      {/* Panel de productos federados pendientes */}
      {showFedPanel && (
        <div className="card space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Globe size={18} />Productos Federados Pendientes</h2>
          <p className="text-xs text-gray-500">Productos base aprobados por la asamblea de otros nodos federados. Para que esten disponibles en este nodo, la asamblea local debe aprobarlos individualmente.</p>
          {fedProposals.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No hay productos federados pendientes.</p>
          ) : (
            <div className="space-y-2">
              {fedProposals.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">De: {p.source_node}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.price_per_unit} TQ/{p.unit}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{p.description}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {p.parent_category} › {p.category} {p.subcategory ? `› ${p.subcategory}` : ''}
                      {p.is_composite && <span className="ml-2 text-emerald-600 font-medium">Compuesto</span>}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <button onClick={() => approveFedProduct(p.id)} className="btn-primary text-sm flex items-center gap-1">
                        <Check size={14} /> Aprobar
                      </button>
                      <button onClick={() => rejectFedProduct(p.id)} className="btn-secondary text-sm text-red-600 flex items-center gap-1">
                        <X size={14} /> Rechazar
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
          <h2 className="font-semibold flex items-center gap-2"><Package size={18} />Productos Pendientes de Aprobacion</h2>
          <p className="text-xs text-gray-500">Productos que han sido solicitados pero aun no han sido aprobados para el catalogo. Aprobalos para que aparezcan en la lista principal.</p>
          {pendingProducts.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No hay productos pendientes de aprobacion.</p>
          ) : (
            <div className="space-y-2">
              {pendingProducts.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.price_per_unit} {currency}/{p.unit}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{p.description}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {p.parent_category} › {p.category} {p.subcategory ? `› ${p.subcategory}` : ''}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <button onClick={() => approveProduct(p.id)} className="btn-primary text-sm flex items-center gap-1">
                        <Check size={14} /> Aprobar
                      </button>
                      <button onClick={() => rejectProduct(p.id)} className="btn-secondary text-sm text-red-600 flex items-center gap-1">
                        <X size={14} /> Rechazar
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
          <p><strong>Productos del Catálogo Comunitario - Ayuda</strong></p>
          <p><strong>Tres pestañas:</strong></p>
          <p><strong>1. Federación:</strong> Todos los productos base que existen en toda la red de nodos federados. Cuando un nodo se federa, sus productos aparecen aquí. Un producto nuevo en cualquier nodo aparece automáticamente en todos.</p>
          <p><strong>2. Mi Nodo:</strong> Los productos base que pertenecen a tu aldea. Puedes editarlos, crear nuevos y publicarlos en la tienda.</p>
          <p><strong>3. Compuestos:</strong> Productos creados por la gente de tu aldea combinando productos base (ej: harina + agua = pan). Se pueden vender en la tienda. Un compuesto se puede promover a producto base para que aparezca en toda la federación y pueda usarse como ingrediente de otros compuestos (ej: pan promovido a base, se puede hacer sándwich con pan + queso).</p>
          <p><strong>Búsqueda:</strong> Escribe parte del nombre en el campo de búsqueda para encontrar productos rápidamente.</p>
          <p><strong>Página pública:</strong> Los productos aprobados aparecen automáticamente en la página pública si usas el bloque "Catálogo desde Backend".</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {showForm && canManage && (
        <div className="card">
          <h2 className="font-semibold mb-4">Nuevo Producto</h2>
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
          Federación
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
          Mi Nodo
        </button>
        <button
          onClick={() => { setActiveTab('composite'); setFilterParentCategory(''); setFilterCategory(''); setFilterSubcategory('') }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
            activeTab === 'composite'
              ? 'bg-purple-700 text-white shadow'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Layers size={16} />
          Compuestos
        </button>
      </div>

      {/* Campo de busqueda por nombre */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-10"
            placeholder="Buscar producto por nombre..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }}
          />
        </div>
        <button onClick={doSearch} className="btn-primary flex items-center gap-2">
          <Search size={16} />
          Buscar
        </button>
        {searchTerm && (
          <button onClick={clearSearch} className="btn-secondary flex items-center gap-2">
            <X size={16} />
            Limpiar
          </button>
        )}
      </div>

      {products.length === 0 && !showForm ? (
        <div className="card text-center text-gray-500 py-8">
          <p>{loading ? 'Cargando productos...' : 'No hay productos registrados.'}</p>
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
                  Todas ({products.length})
                </button>
                {parentCategories.map((pc) => {
                  const count = products.filter((p) => (p.parent_category || 'Sin categoría') === pc).length
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
                    Todas ({products.filter((p) => (p.parent_category || 'Sin categoría') === filterParentCategory).length})
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
              <p>{loading ? 'Cargando...' : 'No hay productos en esta categoría.'}</p>
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
                          <img src={assetUrl(p.image_url)} alt={p.name} className="w-full h-full object-cover" />
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
                                title={p.is_hidden ? 'Mostrar en página pública' : 'Ocultar de página pública'}
                              >
                                {p.is_hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                              <button onClick={() => startEdit(p)} className="text-gray-400 hover:text-emerald-600 transition">
                                <Pencil size={16} />
                              </button>
                            </>
                          )}
                          {canManage && activeTab === 'composite' && (
                            <button
                              onClick={() => promoteComposite(p.id)}
                              className="text-purple-500 hover:text-purple-700 transition"
                              title="Promover a producto base (aparece en toda la federacion)"
                            >
                              <ArrowUpCircle size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 space-y-1">
                        <p className="text-lg font-bold text-trueque-700">
                          {p.price} {currency}
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
                        {p.product_code && <p className="text-xs text-gray-400">Código: {p.product_code}</p>}
                        {activeTab === 'federated' && p.node_domain && (
                          <p className="text-xs text-blue-600">Nodo: {p.node_domain}</p>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          {p.is_approved ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Aprobado</span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Pendiente</span>
                          )}
                          {p.is_system && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Sistema</span>
                          )}
                          {p.is_hidden && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Oculto</span>
                          )}
                          {activeTab === 'composite' && (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">Compuesto</span>
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
            <span className="text-xs text-gray-400">Desliza para cargar más productos...</span>
          )}
        </div>
      )}
    </div>
  )
}
