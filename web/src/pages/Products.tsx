import { useState, useEffect } from 'react'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { useConfig } from '../hooks/useConfig'
import { Plus, HelpCircle, Package, Pencil, Check, X, Upload, Eye, EyeOff } from 'lucide-react'

interface ProductForm {
  name: string
  description: string
  unit: string
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
  name: '', description: '', unit: 'unidad', category: '', subcategory: '', price: 0,
  product_code: '', badge: '', image_url: '', origin: 'internal', is_hidden: false
}

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
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSubcategory, setFilterSubcategory] = useState('')

  const load = () => api.get('/products').then((d: any) => setProducts(Array.isArray(d) ? d : d?.products ?? [])).catch(() => {})

  useEffect(() => { load() }, [])

  // Categorias y subcategorias jerarquicas
  const categoryMap = products.reduce((acc, p) => {
    const cat = p.category || 'Sin categoría'
    const sub = p.subcategory || ''
    if (!acc[cat]) acc[cat] = new Set<string>()
    if (sub) acc[cat].add(sub)
    return acc
  }, {} as Record<string, Set<string>>)

  const categories = Object.keys(categoryMap).sort()
  const subcategories = filterCategory ? Array.from(categoryMap[filterCategory] || []).sort() : []

  const filteredProducts = products.filter((p) => {
    if (filterCategory && p.category !== filterCategory) return false
    if (filterSubcategory && p.subcategory !== filterSubcategory) return false
    return true
  })

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
      load()
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
            <img src={form.image_url} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Categoría</label>
          <input className="input" placeholder="Ej: Cosecha Fresca, Gastronomía" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </div>
        <div>
          <label className="label">Subcategoría (opcional)</label>
          <input className="input" placeholder="Ej: Hojas verdes, Tubérculos" value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
          <p className="text-xs text-gray-400 mt-1">Organiza los productos dentro de una categoría.</p>
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
          {canManage && (
            <button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm) }} className="btn-primary flex items-center gap-2"><Plus size={18} />Nuevo</button>
          )}
        </div>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Productos del Catálogo Comunitario - Ayuda</strong></p>
          <p><strong>Qué es esta página:</strong> Este es el registro global de productos y servicios disponibles en la red de intercambio. Aquí se define qué productos existen, sus características y su precio en {currency}.</p>
          <p><strong>Productos de muestra:</strong> Los productos marcados como "Sistema" son productos de muestra preconfigurados. Puedes editarlos (cambiar nombre, foto, descripción, precio) para adaptarlos a tu comunidad, o eliminarlos y crear nuevos.</p>
          <p><strong>Cómo se usa:</strong> Navega por la lista. Si tienes permisos de gestión, puedes editar cualquier producto (icono del lápiz) o crear nuevos con "Nuevo". Cada producto tiene nombre, descripción, foto, etiqueta destacada (badge), unidad, categoría y precio.</p>
          <p><strong>Página pública:</strong> Los productos aprobados aparecen automáticamente en la página pública si usas el bloque "Catálogo desde Backend". Las categorías se generan solas.</p>
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

      {products.length === 0 && !showForm ? (
        <div className="card text-center text-gray-500 py-8">
          <p>No hay productos registrados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filtro jerarquico: Categoria > Subcategoria */}
          {categories.length > 0 && (
            <div className="space-y-2">
              {/* Nivel 1: Categorias */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setFilterCategory(''); setFilterSubcategory('') }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                    filterCategory === '' ? 'bg-emerald-700 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  Todas ({products.length})
                </button>
                {categories.map((cat) => {
                  const count = products.filter((p) => p.category === cat).length
                  return (
                    <button
                      key={cat}
                      onClick={() => selectCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                        filterCategory === cat ? 'bg-emerald-700 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  )
                })}
              </div>
              {/* Nivel 2: Subcategorias (solo si hay categoria seleccionada) */}
              {filterCategory && subcategories.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-4 border-l-2 border-emerald-200">
                  <button
                    onClick={() => setFilterSubcategory('')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                      filterSubcategory === '' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    Todas ({products.filter((p) => p.category === filterCategory).length})
                  </button>
                  {subcategories.map((sub) => {
                    const count = products.filter((p) => p.category === filterCategory && p.subcategory === sub).length
                    return (
                      <button
                        key={sub}
                        onClick={() => setFilterSubcategory(sub)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                          filterSubcategory === sub ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
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
              <p>No hay productos en esta categoría.</p>
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
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
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
                          {canManage && (
                            <>
                              <button
                                onClick={async () => {
                                  await api.put(`/products/${p.id}`, { ...p, is_hidden: !p.is_hidden })
                                  load()
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
                        </div>
                      </div>
                      <div className="mt-3 space-y-1">
                        <p className="text-lg font-bold text-trueque-700">{p.price} {currency}</p>
                        <p className="text-xs text-gray-400">
                          {p.category && <span className="text-gray-600 font-medium">{p.category}</span>}
                          {p.subcategory && <span> › <span className="text-gray-600 font-medium">{p.subcategory}</span></span>}
                          {p.category && ' | '}
                          Unidad: {p.unit}
                        </p>
                        {p.product_code && <p className="text-xs text-gray-400">Código: {p.product_code}</p>}
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
    </div>
  )
}
