import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { ShoppingCart, Plus, HelpCircle, Trash2, Search, Store as StoreIcon } from 'lucide-react'

export default function Store() {
  const { currency } = useConfig()
  const [view, setView] = useState<'mine' | 'browse'>('mine')
  const [items, setItems] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [allStores, setAllStores] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ product_id: '', stock: 0 })

  // Filtros para browse
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  const load = () => {
    api.get('/store/items').then((d: any) => setItems(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/products').then((d: any) => setProducts(Array.isArray(d) ? d : d?.products ?? [])).catch(() => {})
    api.get('/store/all').then((d: any) => setAllStores(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))]

  const addItem = async () => {
    setError('')
    if (!form.product_id) {
      setError('Selecciona un producto del registro')
      return
    }
    try {
      await api.post('/store/items', form)
      setShowForm(false)
      setForm({ product_id: '', stock: 0 })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar producto')
    }
  }

  const removeItem = async (id: string) => {
    try {
      await api.delete(`/store/items/${id}`)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const buy = async (item: any) => {
    const qty = prompt(`Cuantas unidades de ${item.product_name || 'este producto'} quieres comprar?`)
    if (!qty) return
    try {
      await api.post('/store/purchase', { item_id: item.id, quantity: parseInt(qty) })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al comprar')
    }
  }

  // Filtrar productos del registro por categoria para el formulario
  const filteredProducts = filterCategory
    ? products.filter((p) => p.category === filterCategory)
    : products

  // Filtrar tiendas publicas por busqueda
  const filteredStores = allStores.filter((s) => {
    const matchSearch = !searchQuery ||
      s.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.store_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.owner_name?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchCategory = !filterCategory || s.category === filterCategory
    return matchSearch && matchCategory
  })

  // Agrupar por producto para ver quien tiene que
  const storesByProduct = filteredStores.reduce((acc, s) => {
    const key = s.product_name || 'Sin nombre'
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingCart size={24} />Tienda</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
        </div>
      </div>

      {/* Selector de vista */}
      <div className="flex gap-2">
        <button onClick={() => setView('mine')} className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'mine' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>
          Mi Tienda
        </button>
        <button onClick={() => setView('browse')} className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'browse' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>
          Buscar Productos
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Tienda - Ayuda</strong></p>
          <p><strong>Para que sirve:</strong> La tienda es personal. Cada usuario tiene su propia tienda donde ofrece los productos que tiene disponibles.</p>
          <p><strong>Mi Tienda:</strong> Agrega productos del registro global e indica cuantas unidades tienes. Los precios ya estan fijados en el registro — no puedes cambiarlos.</p>
          <p><strong>Buscar Productos:</strong> Busca que productos estan disponibles y en que tiendas. Puedes filtrar por categoria o buscar por nombre. Asi sabes quien tiene lo que buscas.</p>
          <p><strong>Precios fijos:</strong> El mismo producto cuesta lo mismo en todas las tiendas. Es intercambio, no venta con ganancia. Lo que cambia es la disponibilidad (stock).</p>
          <p><strong>Comprar:</strong> Cuando encuentras lo que buscas, le das comprar y se transfiere el monto al vendedor.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {/* VISTA: MI TIENDA */}
      {view === 'mine' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><StoreIcon size={18} />Mi Tienda Personal</h2>
            <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={18} />Agregar Producto</button>
          </div>

          {showForm && (
            <div className="card space-y-4">
              <h3 className="font-semibold">Agregar Producto a Mi Tienda</h3>
              <p className="text-xs text-gray-500">Selecciona un producto del registro global e indica cuantas unidades tienes disponibles.</p>

              {/* Filtro por categoria */}
              {categories.length > 0 && (
                <div>
                  <label className="label">Filtrar por categoria</label>
                  <select className="input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="">Todas las categorias</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label">Producto</label>
                {products.length === 0 ? (
                  <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                    No hay productos en el registro. La asamblea debe agregar productos primero.
                  </p>
                ) : (
                  <select className="input" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                    <option value="">Seleccionar producto...</option>
                    {filteredProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {p.price_trueque} {currency} ({p.category || 'sin categoria'})</option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-gray-400 mt-1">Solo puedes vender productos del registro global. El precio es fijo.</p>
              </div>

              <div>
                <label className="label">Cantidad disponible (stock)</label>
                <input type="number" className="input" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} />
                <p className="text-xs text-gray-400 mt-1">Cuantas unidades tienes para vender. 0 = agotado.</p>
              </div>

              <button onClick={addItem} className="btn-primary" disabled={!form.product_id}>Agregar a Mi Tienda</button>
            </div>
          )}

          {items.length === 0 && !showForm ? (
            <div className="card text-center text-gray-500 py-8">
              <p>Tu tienda esta vacia.</p>
              <p className="text-xs mt-2">Agrega productos del registro global con el boton de arriba.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {items.map((item, i) => {
                const product = products.find((p) => p.id === item.product_id)
                return (
                  <div key={i} className="card">
                    <h3 className="font-semibold">{item.product_name || product?.name || 'Producto'}</h3>
                    <p className="text-sm text-gray-600">{item.description || product?.description}</p>
                    {item.category && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded mt-1 inline-block">{item.category}</span>}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-lg font-bold text-trueque-700">{item.price_trueque || product?.price_trueque} {currency}</span>
                      <span className={`text-sm ${item.stock === 0 ? 'text-red-500' : 'text-gray-500'}`}>
                        Stock: {item.stock}{item.stock === 0 ? ' (agotado)' : ''}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => buy(item)} className="btn-primary flex-1 flex items-center justify-center gap-2"><ShoppingCart size={16} />Vender</button>
                      <button onClick={() => removeItem(item.id)} className="btn-secondary text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* VISTA: BUSCAR PRODUCTOS */}
      {view === 'browse' && (
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Search size={18} />Buscar Productos Disponibles</h2>
          <p className="text-xs text-gray-500">Busca que productos estan disponibles y en que tiendas. Los precios son los mismos para todos.</p>

          {/* Filtros */}
          <div className="card space-y-3">
            <div>
              <label className="label">Buscar por nombre</label>
              <input className="input" placeholder="Ej: pan, harina, jabon..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div>
              <label className="label">Filtrar por categoria</label>
              <select className="input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="">Todas las categorias</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {Object.keys(storesByProduct).length === 0 ? (
            <div className="card text-center text-gray-500 py-8">
              <p>No hay productos disponibles.</p>
              <p className="text-xs mt-2">Los productos aparecen cuando los usuarios los agregan a sus tiendas.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(storesByProduct).map(([productName, stores]) => (
                <div key={productName} className="card">
                  <h3 className="font-semibold">{productName}</h3>
                  <p className="text-xs text-gray-500 mb-3">Disponible en {stores.length} tienda(s)</p>
                  <div className="space-y-2">
                    {stores.map((s, i) => (
                      <div key={i} className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
                        <div>
                          <span className="font-medium text-sm">{s.store_name || s.owner_name || 'Tienda'}</span>
                          {s.stock === 0 && <span className="ml-2 text-xs text-red-500">Agotado</span>}
                          {s.stock > 0 && <span className="ml-2 text-xs text-gray-500">Stock: {s.stock}</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-trueque-700">{s.price_trueque} {currency}</span>
                          {s.stock > 0 && (
                            <button onClick={() => buy(s)} className="btn-primary text-sm flex items-center gap-1">
                              <ShoppingCart size={14} /> Comprar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
