import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { ShoppingCart, Plus, HelpCircle, Trash2, Search, Store as StoreIcon, Package } from 'lucide-react'

export default function Store() {
  const { currency } = useConfig()
  const [view, setView] = useState<'mine' | 'browse'>('mine')
  const [items, setItems] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [allStores, setAllStores] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    product_id: '',
    stock: 0,
    quantity_per_unit: 1,
    extra_costs: 0,
    extra_description: '',
  })

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
    // Find the selected product to send its info
    const product = products.find((p) => p.id === form.product_id)
    if (!product) {
      setError('Producto no encontrado')
      return
    }
    const basePrice = product.price_trueque || product.price || 0
    const finalPrice = basePrice + (form.extra_costs || 0)
    try {
      await api.post('/store/items', {
        product_id: form.product_id,
        product_name: product.name,
        description: product.description || '',
        category: product.category || '',
        origin: product.origin || 'internal',
        unit: product.unit || 'unidad',
        quantity_per_unit: form.quantity_per_unit || 1,
        base_price: basePrice,
        extra_costs: form.extra_costs || 0,
        final_price: finalPrice,
        extra_description: form.extra_description || '',
        price_trueque: finalPrice,
        stock: form.stock,
      })
      setShowForm(false)
      setForm({ product_id: '', stock: 0, quantity_per_unit: 1, extra_costs: 0, extra_description: '' })
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

  // Producto seleccionado para mostrar info
  const selectedProduct = products.find((p) => p.id === form.product_id)
  const basePrice = selectedProduct?.price_trueque || selectedProduct?.price || 0
  const extraCosts = form.extra_costs || 0
  const finalPrice = basePrice + extraCosts

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
          <p><strong>Tienda Personal - Ayuda</strong></p>
          <p><strong>Que es la tienda personal:</strong> Cada usuario tiene su propia tienda donde ofrece los productos que tiene disponibles para intercambiar. Es como tu vitrina personal: muestras que tienes y otros pueden verlo y comprarlo. Tu tienda es independiente de las demas.</p>
          <p><strong>Para que sirve:</strong> Sirve para que cada miembro gestione su inventario personal. Indicas que productos del catalogo comunitario tienes disponibles y en que cantidad. Asi otros miembros saben a quien acudir para conseguir lo que buscan.</p>
          <p><strong>Como se usa:</strong> 1) Ve a "Mi Tienda" y presiona "Agregar Producto". 2) Selecciona un producto del catalogo comunitario (registro global). 3) Indica cuantas unidades tienes (stock). 4) El producto aparece en tu tienda con su precio fijo. Para comprar, ve a "Buscar Productos" y encuentra lo que necesitas.</p>
          <p><strong>Como agregar productos del catalogo a tu tienda:</strong> Solo puedes vender productos que ya existen en el registro global de productos. Si necesitas un producto que no esta en el registro, debe aprobarse en asamblea primero. Una vez agregado al catalogo, puedes incluirlo en tu tienda indicando tu stock.</p>
          <p><strong>Que es el stock:</strong> Es la cantidad de unidades que tienes disponibles para vender. Cuando alguien compra, el stock disminuye automaticamente. Si el stock llega a 0, el producto aparece como "agotado". Puedes actualizar el stock cuando tengas mas unidades disponibles.</p>
          <p><strong>Que es el precio:</strong> El precio es fijo y viene del registro global de productos. No puedes cambiarlo: el mismo producto cuesta lo mismo en todas las tiendas. Esto garantiza equidad: es intercambio, no venta con ganancia.</p>
          <p><strong>Como funciona la venta:</strong> Cuando alguien encuentra tu producto en "Buscar Productos" y lo compra, se transfiere el monto en {currency} de su cuenta a la tuya, y el stock se reduce. La transaccion es automatica y transparente.</p>
          <p><strong>Mi Tienda:</strong> Muestra los productos que tu ofreces y tu inventario personal.</p>
          <p><strong>Buscar Productos:</strong> Busca que productos estan disponibles en todas las tiendas de la red. Puedes filtrar por categoria o buscar por nombre. Asi sabes quien tiene lo que buscas.</p>
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
                  <p className="text-xs text-gray-400 mt-1">Filtra la lista de productos del catalogo por categoria para encontrar mas rapido lo que quieres agregar. <strong>Ejemplo:</strong> Selecciona "Alimentos" para ver solo productos alimenticios.</p>
                </div>
              )}

              <div>
                <label className="label">Producto del catalogo</label>
                {products.length === 0 ? (
                  <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                    No hay productos en el registro. La asamblea debe agregar productos primero.
                  </p>
                ) : (
                  <select className="input" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value, extra_costs: 0, extra_description: '' })}>
                    <option value="">Seleccionar producto...</option>
                    {filteredProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {p.price_trueque || p.price} {currency}/{p.unit || 'unidad'} ({p.category || 'sin categoria'})</option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-gray-400 mt-1">Solo puedes vender productos del registro global. El precio base es fijo. <strong>Ejemplo:</strong> Selecciona "Pan integral" para ofrecer pan en tu tienda.</p>
              </div>

              {/* Info del producto seleccionado */}
              {selectedProduct && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Package size={16} className="text-emerald-700" />
                    <span className="font-semibold text-emerald-900">{selectedProduct.name}</span>
                  </div>
                  <p className="text-xs text-gray-600">{selectedProduct.description}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-gray-500">Precio base del catalogo:</span>
                    <span className="font-bold text-emerald-700">{basePrice} {currency} / {selectedProduct.unit || 'unidad'}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Cantidad disponible (stock)</label>
                  <input type="number" className="input" placeholder="Ej: 10" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} />
                  <p className="text-xs text-gray-400 mt-1">Cuantas unidades tienes. 0 = agotado.</p>
                </div>
                <div>
                  <label className="label">Unidades por paquete</label>
                  <input type="number" step="0.1" className="input" placeholder="Ej: 1, 0.5, 2" value={form.quantity_per_unit} onChange={(e) => setForm({ ...form, quantity_per_unit: parseFloat(e.target.value) || 1 })} />
                  <p className="text-xs text-gray-400 mt-1">Cuantas unidades del catalogo contiene cada paquete que vendes. <strong>Ej:</strong> 0.5 = medio kg, 2 = paquete de 2 kg.</p>
                </div>
              </div>

              {/* Costos adicionales */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-amber-900">Costos adicionales (opcionales)</p>
                  <p className="text-xs text-gray-600 mt-1">Agrega costos por envio, traslado, envase especial, presentacion, etc. Si el comprador recoge en tu parcela, el precio debe ser el base sin extras.</p>
                </div>
                <div>
                  <label className="label">Costo adicional en {currency}</label>
                  <input type="number" className="input" placeholder="Ej: 5 (por envio, envase de vidrio, etc.)" value={form.extra_costs} onChange={(e) => setForm({ ...form, extra_costs: parseInt(e.target.value) || 0 })} />
                  <p className="text-xs text-gray-400 mt-1"><strong>Ejemplos:</strong> Envase de vidrio (+3 TQ), traslado en moto (+5 TQ), entrega a domicilio (+8 TQ). Si vendes en el mismo punto, deja en 0.</p>
                </div>
                <div>
                  <label className="label">Descripcion del costo adicional</label>
                  <input className="input" placeholder="Ej: Envase de vidrio retornable, entrega a domicilio en moto" value={form.extra_description} onChange={(e) => setForm({ ...form, extra_description: e.target.value })} />
                  <p className="text-xs text-gray-400 mt-1">Explica que incluye el costo adicional para que el comprador sepa por que paga mas.</p>
                </div>
              </div>

              {/* Resumen del precio final */}
              {selectedProduct && (
                <div className="bg-trueque-50 border border-trueque-200 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Precio base ({selectedProduct.unit || 'unidad'}):</span>
                    <span className="font-medium">{basePrice} {currency}</span>
                  </div>
                  {extraCosts > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Costos adicionales:</span>
                        <span className="font-medium text-amber-700">+{extraCosts} {currency}</span>
                      </div>
                      {form.extra_description && (
                        <p className="text-xs text-gray-500 italic">{form.extra_description}</p>
                      )}
                    </>
                  )}
                  <div className="flex justify-between text-base font-bold pt-1 border-t border-trueque-200">
                    <span className="text-trueque-900">Precio final:</span>
                    <span className="text-trueque-700">{finalPrice} {currency}</span>
                  </div>
                </div>
              )}

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
                const displayPrice = item.final_price || item.price_trueque || product?.price_trueque || 0
                const baseP = item.base_price || item.price_trueque || product?.price_trueque || 0
                const extras = item.extra_costs || 0
                const unit = item.unit || product?.unit || 'unidad'
                return (
                  <div key={i} className="card">
                    <h3 className="font-semibold">{item.product_name || product?.name || 'Producto'}</h3>
                    <p className="text-sm text-gray-600">{item.description || product?.description}</p>
                    {item.category && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded mt-1 inline-block">{item.category}</span>}
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-trueque-700">{displayPrice} {currency}</span>
                        <span className="text-xs text-gray-500">por {unit}</span>
                      </div>
                      {extras > 0 && (
                        <div className="text-xs text-gray-500 bg-amber-50 rounded px-2 py-1">
                          <span className="text-gray-600">Base: {baseP} {currency}</span>
                          <span className="text-amber-700"> +{extras} (extras)</span>
                          {item.extra_description && <span className="block italic text-gray-500">{item.extra_description}</span>}
                        </div>
                      )}
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
              <p className="text-xs text-gray-400 mt-1">Escribe el nombre del producto, tienda o persona que buscas. La busqueda es por coincidencia parcial. <strong>Ejemplo:</strong> "pan" encuentra "Pan integral", "Pan dulce", etc.</p>
            </div>
            <div>
              <label className="label">Filtrar por categoria</label>
              <select className="input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="">Todas las categorias</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Filtra los productos disponibles por categoria. <strong>Ejemplo:</strong> Selecciona "Alimentos" para ver solo productos alimenticios disponibles en todas las tiendas.</p>
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
                          {s.extra_costs > 0 && s.extra_description && (
                            <span className="block text-xs text-amber-600 italic">{s.extra_description} (+{s.extra_costs} {currency})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="font-bold text-trueque-700">{s.final_price || s.price_trueque} {currency}</span>
                            {s.unit && <span className="block text-[10px] text-gray-400">por {s.unit}</span>}
                          </div>
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
