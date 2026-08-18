import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { ShoppingCart, Plus, HelpCircle, Trash2, Search, Store as StoreIcon, Package, Layers, X } from 'lucide-react'

interface CompositeComponent {
  component_product_id: string
  component_name: string
  component_unit: string
  component_price: number
  quantity: number
  component_category: string
  // Campos para display del calculo
  quantity_purchased: number
  yield_products: number
}

export default function Store() {
  const { currency } = useConfig()
  const [view, setView] = useState<'mine' | 'browse'>('mine')
  const [items, setItems] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [allStores, setAllStores] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [formMode, setFormMode] = useState<'simple' | 'composite'>('composite')
  const [form, setForm] = useState({
    product_id: '',
    stock: 0,
    quantity_per_unit: 1,
    extra_costs: 0,
    extra_description: '',
  })

  // Estado para producto compuesto
  const [compositeName, setCompositeName] = useState('')
  const [compositeDesc, setCompositeDesc] = useState('')
  const [compositeCategory, setCompositeCategory] = useState('')
  const [compositeParentCategory, setCompositeParentCategory] = useState('')
  const [compositeSubcategory, setCompositeSubcategory] = useState('')
  const [compositeStock, setCompositeStock] = useState(1)
  const [compositeUnit, setCompositeUnit] = useState('unidad')
  const [compositeQtyPerUnit, setCompositeQtyPerUnit] = useState(1)
  const [components, setComponents] = useState<CompositeComponent[]>([])
  const [componentFilter, setComponentFilter] = useState('all')
  const [availableComponents, setAvailableComponents] = useState<any[]>([])
  const [selectedComponentId, setSelectedComponentId] = useState('')
  const [componentQty, setComponentQty] = useState(1)

  // Modal de busqueda de componentes
  const [showComponentModal, setShowComponentModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [modalFilter, setModalFilter] = useState('all')
  const [modalResults, setModalResults] = useState<any[]>([])

  // Componente seleccionado del modal (para configurar cantidades)
  const [pendingComponent, setPendingComponent] = useState<any>(null)
  const [qtyPurchased, setQtyPurchased] = useState(1)
  const [yieldProducts, setYieldProducts] = useState(1)

  // Categorias jerarquicas del catalogo (3 niveles)
  const [hierarchy, setHierarchy] = useState<any[]>([])
  const [selectedParent, setSelectedParent] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedSubcategory, setSelectedSubcategory] = useState('')

  // Filtros para browse
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  const load = () => {
    api.get('/store/items').then((d: any) => setItems(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/products').then((d: any) => setProducts(Array.isArray(d) ? d : d?.products ?? [])).catch(() => {})
    api.get('/store/all').then((d: any) => setAllStores(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(() => { load() }, [])

  // Cargar jerarquia de categorias (3 niveles)
  useEffect(() => {
    api.get('/products/categories')
      .then((d: any) => setHierarchy(Array.isArray(d?.categories) ? d.categories : []))
      .catch(() => setHierarchy([]))
  }, [])

  // Cargar componentes disponibles del catalogo (para el modal)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')
  useEffect(() => {
    if (!showComponentModal) return
    setModalLoading(true)
    setModalError('')
    const params = new URLSearchParams()
    if (modalFilter !== 'all') params.set('category', modalFilter)
    if (searchTerm.trim()) params.set('search', searchTerm.trim())
    const qs = params.toString()
    api.get('/products/components' + (qs ? `?${qs}` : ''))
      .then((d: any) => {
        setModalResults(Array.isArray(d) ? d : [])
        setModalLoading(false)
      })
      .catch((err) => {
        setModalResults([])
        setModalLoading(false)
        setModalError(err?.message || 'Error al cargar componentes')
      })
  }, [showComponentModal, modalFilter, searchTerm])

  // Calcular precio total del compuesto (con decimales, sin redondear)
  const compositeTotalPrice = components.reduce((sum, c) => sum + (c.component_price * c.quantity), 0)

  const selectComponentFromModal = (comp: any) => {
    setPendingComponent(comp)
    setQtyPurchased(1)
    setYieldProducts(1)
    setShowComponentModal(false)
    setSearchTerm('')
    setModalResults([])
  }

  const confirmAddComponent = () => {
    if (!pendingComponent) return
    if (yieldProducts <= 0) {
      setError('El numero de productos que salen debe ser mayor que cero')
      return
    }
    // Determinar categoria del componente
    let category = 'materia_prima'
    if (pendingComponent.parent_category === 'Embalaje') category = 'embalaje'
    else if (pendingComponent.parent_category === 'Envio') category = 'envio'
    else if (pendingComponent.unit === 'hora') category = 'trabajo'
    else if (pendingComponent.subcategory === 'Materia Prima') category = 'materia_prima'
    else category = 'producto_base'

    // Calcular cantidad por producto: si compro 1 kg y salen 50 productos -> 0.02 kg por producto
    const qtyPerProduct = qtyPurchased / yieldProducts

    setComponents([...components, {
      component_product_id: pendingComponent.id,
      component_name: pendingComponent.name,
      component_unit: pendingComponent.unit || 'unidad',
      component_price: pendingComponent.price_per_unit || 0,
      quantity: qtyPerProduct,
      component_category: category,
      quantity_purchased: qtyPurchased,
      yield_products: yieldProducts,
    }])
    setPendingComponent(null)
    setQtyPurchased(1)
    setYieldProducts(1)
  }

  const cancelAddComponent = () => {
    setPendingComponent(null)
    setQtyPurchased(1)
    setYieldProducts(1)
  }

  const removeComponent = (idx: number) => {
    setComponents(components.filter((_, i) => i !== idx))
  }

  const saveComposite = async () => {
    setError('')
    if (!compositeName) {
      setError('Debes darle un nombre a tu producto')
      return
    }
    if (!selectedParent || !selectedCategory) {
      setError('Debes seleccionar la categoria padre y la categoria de tu producto')
      return
    }
    if (components.length === 0) {
      setError('Debes agregar al menos un componente')
      return
    }
    try {
      await api.post('/store/composite', {
        product_name: compositeName,
        description: compositeDesc,
        parent_category: selectedParent,
        category: selectedCategory,
        subcategory: selectedSubcategory,
        unit: compositeUnit,
        quantity_per_unit: compositeQtyPerUnit,
        stock: compositeStock,
        components: components,
      })
      setShowForm(false)
      setCompositeName('')
      setCompositeDesc('')
      setCompositeCategory('')
      setSelectedParent('')
      setSelectedCategory('')
      setSelectedSubcategory('')
      setCompositeStock(1)
      setComponents([])
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear producto compuesto')
    }
  }

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
            <button onClick={() => { setShowForm(!showForm); setFormMode('composite') }} className="btn-primary flex items-center gap-2"><Plus size={18} />Crear Producto Compuesto</button>
          </div>

          {showForm && (
            <div className="card space-y-4">
              {/* Selector de modo */}
              <div className="flex gap-2 border-b pb-3">
                <button
                  onClick={() => setFormMode('composite')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${formMode === 'composite' ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  <Layers size={14} className="inline mr-1" />Producto Compuesto
                </button>
                <button
                  onClick={() => setFormMode('simple')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${formMode === 'simple' ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  <Package size={14} className="inline mr-1" />Producto del Catalogo
                </button>
              </div>

              {formMode === 'composite' ? (
                <>
                  <h3 className="font-semibold">Crear Producto Compuesto</h3>
                  <p className="text-xs text-gray-500">Crea un producto nuevo seleccionando materias primas, productos base, horas de trabajo, embalaje y envio del catalogo aprobado. El precio se calcula automaticamente. No necesita aprobacion de asamblea porque usa componentes ya aprobados.</p>

                  <div>
                    <label className="label">Nombre de tu producto</label>
                    <input className="input" placeholder="Ej: Jugo de naranja 200ml, Pan integral, Mi mermelada" value={compositeName} onChange={(e) => setCompositeName(e.target.value)} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Unidad de medida del producto</label>
                      <select className="input" value={compositeUnit} onChange={(e) => setCompositeUnit(e.target.value)}>
                        <option value="unidad">Unidad</option>
                        <option value="ml">Mililitro (ml)</option>
                        <option value="L">Litro (L)</option>
                        <option value="gr">Gramo (gr)</option>
                        <option value="kg">Kilogramo (kg)</option>
                        <option value="manojo">Manojo</option>
                        <option value="hora">Hora</option>
                        <option value="carga">Carga</option>
                        <option value="m">Metro (m)</option>
                        <option value="m2">Metro cuadrado (m2)</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Cantidad por unidad</label>
                      <input type="number" step="any" className="input" placeholder="Ej: 200 (para 200ml), 500 (para 500gr), 1 (para 1 unidad)" value={compositeQtyPerUnit} onChange={(e) => setCompositeQtyPerUnit(parseFloat(e.target.value) || 1)} />
                      <p className="text-xs text-gray-500 mt-1">Ej: 200 ml, 500 gr, 1 kg, 1 unidad</p>
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-3">
                    <p className="text-xs font-semibold text-emerald-800">Ubica tu producto en su categoria exacta (3 niveles)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="label text-xs">1. Categoria Padre</label>
                        <select
                          className="input"
                          value={selectedParent}
                          onChange={(e) => {
                            setSelectedParent(e.target.value)
                            setSelectedCategory('')
                            setSelectedSubcategory('')
                          }}
                        >
                          <option value="">-- Selecciona --</option>
                          {hierarchy.map((pc: any) => (
                            <option key={pc.name} value={pc.name}>{pc.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs">2. Categoria</label>
                        <select
                          className="input"
                          value={selectedCategory}
                          onChange={(e) => {
                            setSelectedCategory(e.target.value)
                            setSelectedSubcategory('')
                          }}
                          disabled={!selectedParent}
                        >
                          <option value="">-- Selecciona --</option>
                          {selectedParent && hierarchy
                            .find((pc: any) => pc.name === selectedParent)
                            ?.categories?.map((c: any) => (
                              <option key={c.name} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs">3. Subcategoria (opcional)</label>
                        <select
                          className="input"
                          value={selectedSubcategory}
                          onChange={(e) => setSelectedSubcategory(e.target.value)}
                          disabled={!selectedCategory}
                        >
                          <option value="">-- Sin subcategoria --</option>
                          {selectedParent && selectedCategory && hierarchy
                            .find((pc: any) => pc.name === selectedParent)
                            ?.categories?.find((c: any) => c.name === selectedCategory)
                            ?.subcategories?.map((sc: any) => (
                              <option key={sc.name} value={sc.name}>{sc.name}</option>
                            ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      {selectedParent && selectedCategory
                        ? <>Ubicacion: <strong>{selectedParent} › {selectedCategory}{selectedSubcategory ? ` › ${selectedSubcategory}` : ''}</strong></>
                        : <span className="text-amber-700">Debes seleccionar al menos categoria padre y categoria. Si necesitas una categoria nueva, pide a administracion que la cree en el catalogo.</span>}
                    </p>
                  </div>

                  <div>
                    <label className="label">Descripcion</label>
                    <textarea className="input" rows={2} placeholder="Describe tu producto: como lo haces, que lo hace especial..." value={compositeDesc} onChange={(e) => setCompositeDesc(e.target.value)} />
                  </div>

                  <div>
                    <label className="label">Cantidad disponible (stock)</label>
                    <input type="number" className="input" placeholder="Ej: 10" value={compositeStock} onChange={(e) => setCompositeStock(parseInt(e.target.value) || 1)} />
                  </div>

                  {/* Selector de componentes */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">Agregar componentes</p>
                      <p className="text-xs text-gray-600 mt-1">Selecciona materias primas, productos base, horas de trabajo, embalaje o envio. El precio se calcula automaticamente.</p>
                    </div>

                    {/* Boton para abrir modal de busqueda */}
                    <button
                      onClick={() => setShowComponentModal(true)}
                      className="w-full border-2 border-dashed border-emerald-400 rounded-lg p-3 text-emerald-700 hover:bg-emerald-50 transition flex items-center justify-center gap-2 font-medium text-sm"
                    >
                      <Search size={18} /> Buscar y agregar componente
                    </button>

                    {/* Configuracion del componente seleccionado */}
                    {pendingComponent && (
                      <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-sm text-amber-900">{pendingComponent.name}</p>
                            <p className="text-xs text-amber-700">{pendingComponent.price_per_unit} {currency} / {pendingComponent.unit || 'unidad'}</p>
                            {pendingComponent.description && <p className="text-xs text-gray-500 mt-1">{pendingComponent.description}</p>}
                          </div>
                          <button onClick={cancelAddComponent} className="text-red-500 hover:text-red-700"><X size={18} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="label text-xs">Cantidad que compraste</label>
                            <input
                              type="number"
                              step="0.01"
                              className="input"
                              placeholder="Ej: 1"
                              value={qtyPurchased}
                              onChange={(e) => setQtyPurchased(parseFloat(e.target.value) || 0)}
                            />
                            <p className="text-xs text-gray-400 mt-1">Ej: 1 {pendingComponent.unit || 'kg'}</p>
                          </div>
                          <div>
                            <label className="label text-xs">Cuantos productos salen?</label>
                            <input
                              type="number"
                              step="1"
                              className="input"
                              placeholder="Ej: 50"
                              value={yieldProducts}
                              onChange={(e) => setYieldProducts(parseInt(e.target.value) || 0)}
                            />
                            <p className="text-xs text-gray-400 mt-1">Ej: 50 envases de 200ml</p>
                          </div>
                        </div>
                        {yieldProducts > 0 && qtyPurchased > 0 && (
                          <div className="bg-white rounded-lg p-2 text-xs text-gray-700">
                            <p>Costo por producto: <strong>{(pendingComponent.price_per_unit * qtyPurchased / yieldProducts).toFixed(2)} {currency}</strong></p>
                            <p className="text-gray-500">= {pendingComponent.price_per_unit} {currency} x {qtyPurchased} {pendingComponent.unit} / {yieldProducts} productos = {(qtyPurchased / yieldProducts).toFixed(4)} {pendingComponent.unit} por producto</p>
                          </div>
                        )}
                        <button onClick={confirmAddComponent} className="btn-primary w-full" disabled={yieldProducts <= 0 || qtyPurchased <= 0}>
                          Agregar este componente
                        </button>
                      </div>
                    )}

                    {/* Lista de componentes agregados */}
                    {components.length > 0 && (
                      <div className="space-y-2 mt-3">
                        <p className="text-xs font-semibold text-gray-700">Componentes de tu producto:</p>
                        {components.map((c, i) => (
                          <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-200">
                            <div className="flex-1">
                              <span className="text-sm font-medium">{c.component_name}</span>
                              <span className="text-xs text-gray-500 ml-2">({c.component_category})</span>
                              <span className="text-xs text-gray-500 block">
                                Compro {c.quantity_purchased} {c.component_unit} → {c.yield_products} productos →
                                <strong> {(c.component_price * c.quantity).toFixed(2)} {currency}</strong> por producto
                              </span>
                            </div>
                            <button onClick={() => removeComponent(i)} className="text-red-500 hover:text-red-700">
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Precio total calculado */}
                    {components.length > 0 && (
                      <div className="bg-trueque-100 border border-trueque-300 rounded-lg p-3 flex justify-between items-center">
                        <span className="font-semibold text-trueque-900">Precio total automatico:</span>
                        <span className="text-xl font-bold text-trueque-700">{compositeTotalPrice.toFixed(2)} {currency}</span>
                      </div>
                    )}
                  </div>

                  <button onClick={saveComposite} className="btn-primary" disabled={components.length === 0 || !compositeName || !selectedParent || !selectedCategory}>
                    Publicar en Mi Tienda ({compositeTotalPrice.toFixed(2)} {currency})
                  </button>
                </>
              ) : (
                <>
                  <h3 className="font-semibold">Agregar Producto del Catalogo</h3>
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
                    </div>
                    <div>
                      <label className="label">Unidades por paquete</label>
                      <input type="number" step="0.1" className="input" placeholder="Ej: 1, 0.5, 2" value={form.quantity_per_unit} onChange={(e) => setForm({ ...form, quantity_per_unit: parseFloat(e.target.value) || 1 })} />
                    </div>
                  </div>

                  {/* Costos adicionales */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Costos adicionales (opcionales)</p>
                      <p className="text-xs text-gray-600 mt-1">Para envio o presentacion especial. Si el comprador recoge en tu parcela, deja en 0.</p>
                    </div>
                    <div>
                      <label className="label">Costo adicional en {currency}</label>
                      <input type="number" className="input" placeholder="Ej: 5 (por envio, envase de vidrio, etc.)" value={form.extra_costs} onChange={(e) => setForm({ ...form, extra_costs: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="label">Descripcion del costo adicional</label>
                      <input className="input" placeholder="Ej: Envase de vidrio retornable, entrega a domicilio" value={form.extra_description} onChange={(e) => setForm({ ...form, extra_description: e.target.value })} />
                    </div>
                  </div>

                  {/* Resumen del precio final */}
                  {selectedProduct && (
                    <div className="bg-trueque-50 border border-trueque-200 rounded-lg p-3 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Precio base:</span>
                        <span className="font-medium">{basePrice} {currency}</span>
                      </div>
                      {extraCosts > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Costos adicionales:</span>
                          <span className="font-medium text-amber-700">+{extraCosts} {currency}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-bold pt-1 border-t border-trueque-200">
                        <span className="text-trueque-900">Precio final:</span>
                        <span className="text-trueque-700">{finalPrice} {currency}</span>
                      </div>
                    </div>
                  )}

                  <button onClick={addItem} className="btn-primary" disabled={!form.product_id}>Agregar a Mi Tienda</button>
                </>
              )}
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
                const isComposite = !item.product_id && item.extra_description
                return (
                  <div key={i} className="card">
                    <h3 className="font-semibold">{item.product_name || product?.name || 'Producto'}</h3>
                    <p className="text-sm text-gray-600">{item.description || product?.description}</p>
                    {item.category && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded mt-1 inline-block">{item.category}</span>}
                    {isComposite && (
                      <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded p-2">
                        <p className="text-[10px] font-bold text-emerald-800 uppercase">Compuesto</p>
                        <p className="text-xs text-gray-600 mt-1">{item.extra_description}</p>
                      </div>
                    )}
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-trueque-700">{displayPrice} {currency}</span>
                        <span className="text-xs text-gray-500">por {unit}</span>
                      </div>
                      {extras > 0 && !isComposite && (
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

      {/* Modal de busqueda de componentes */}
      {showComponentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowComponentModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header del modal */}
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-lg">Buscar Componente</h3>
              <button onClick={() => setShowComponentModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            {/* Buscador */}
            <div className="p-4 border-b space-y-3">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="input pl-10"
                  placeholder="Escribe el nombre del componente... (ej: naranja, arcilla, tela, envase)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
              {/* Filtros por categoria */}
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'materia_prima', label: 'Materias Primas' },
                  { id: 'producto_base', label: 'Productos Base' },
                  { id: 'trabajo', label: 'Trabajo (h)' },
                  { id: 'embalaje', label: 'Embalaje' },
                  { id: 'envio', label: 'Envio' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setModalFilter(cat.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                      modalFilter === cat.id ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Resultados */}
            <div className="flex-1 overflow-y-auto p-4">
              {modalLoading ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">Cargando componentes...</p>
                </div>
              ) : modalError ? (
                <div className="text-center py-8 text-red-500">
                  <p className="text-sm">{modalError}</p>
                  <p className="text-xs mt-2">Si tu sesion expiro, guarda tu trabajo y vuelve a iniciar sesion.</p>
                </div>
              ) : modalResults.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Search size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {searchTerm ? `No se encontro "${searchTerm}" en esta categoria` : 'No hay componentes disponibles en esta categoria'}
                  </p>
                  {searchTerm && (
                    <p className="text-xs mt-2">Prueba con otra palabra o cambia de categoria. Si no existe el componente, pide a administracion que lo agregue al catalogo.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 mb-2">{modalResults.length} resultado(s)</p>
                  {modalResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectComponentFromModal(c)}
                      className="w-full text-left bg-white border border-gray-200 rounded-lg p-3 hover:border-emerald-400 hover:bg-emerald-50 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900">{c.name}</p>
                          {c.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.description}</p>}
                          <p className="text-xs text-gray-400 mt-1">
                            {c.parent_category} › {c.category}{c.subcategory ? ` › ${c.subcategory}` : ''}
                          </p>
                        </div>
                        <div className="text-right ml-2">
                          <p className="font-bold text-emerald-700">{c.price_per_unit} {currency}</p>
                          <p className="text-xs text-gray-400">/ {c.unit || 'unidad'}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
