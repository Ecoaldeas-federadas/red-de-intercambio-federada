import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { ShoppingCart, Plus, HelpCircle, Trash2, Search, Store as StoreIcon, Package, Layers, X, QrCode, Nfc, Briefcase } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { assetUrl } from '../utils/assetUrl'
import { fmtTQ, toCents, fmtNumber } from '../lib/format'

interface CompositeComponent {
  component_product_id: string
  component_name: string
  component_unit: string
  component_price: number
  quantity: number
  component_category: string
  component_catalog_key?: string
  // Campos para display del calculo
  quantity_purchased: number
  yield_products: number
}

// Clasificacion del componente segun el item_type del catalogo federado
const itemTypeToCategory: Record<string, string> = {
  raw_material: 'materia_prima',
  base_product: 'producto_base',
  composite: 'producto_base',
  service: 'trabajo',
  packaging: 'embalaje',
  shipping: 'envio',
}

export default function Store() {
  const { t, i18n } = useTranslation(['products', 'common'])
  const tc = (name: string) => t(`category.${name}`, { ns: 'products', defaultValue: name })
  const { currency } = useConfig()
  const [view, setView] = useState<'mine' | 'browse'>('mine')
  const [items, setItems] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [allStores, setAllStores] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [formMode, setFormMode] = useState<'simple' | 'composite' | 'service'>('composite')
  const [servicesCatalog, setServicesCatalog] = useState<any[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [serviceExtraDesc, setServiceExtraDesc] = useState('')

  // Modal de generacion de etiqueta (Codigo de barras con peso / QR / Etiqueta NFC)
  const [tagModalItem, setTagModalItem] = useState<any>(null)
  const [tagQty, setTagQty] = useState<number>(1)
  const [tagIncludeSeller, setTagIncludeSeller] = useState<boolean>(true)
  const [generatedTag, setGeneratedTag] = useState<any>(null)
  const [nfcWriteStatus, setNfcWriteStatus] = useState('')

  // Constructor de etiqueta de canasta completa (para grabar en etiqueta NFC o QR)
  const [showBasketBuilder, setShowBasketBuilder] = useState(false)
  const [basketLabel, setBasketLabel] = useState('')
  const [basketLines, setBasketLines] = useState<{ item: any; qty: number }[]>([])
  const [basketSelId, setBasketSelId] = useState('')
  const [basketSelQty, setBasketSelQty] = useState<number>(1)
  const [savedBasketTag, setSavedBasketTag] = useState<any>(null)
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
    api.get('/store/services-catalog').then((d: any) => setServicesCatalog(Array.isArray(d) ? d : [])).catch(() => {})
  }

  const addServiceToMyStore = async () => {
    setError('')
    const svc = servicesCatalog.find((s) => s.id === selectedServiceId)
    if (!svc) {
      setError(t('store_select_service_err', 'Selecciona un servicio del catalogo'))
      return
    }
    try {
      await api.post('/store/items', {
        product_id: svc.id,
        product_name: svc.name,
        description: svc.description || '',
        parent_category: svc.parent_category || 'Servicios',
        category: svc.category || 'Servicios',
        subcategory: svc.subcategory || '',
        origin: 'internal',
        unit: svc.unit || 'hora',
        quantity_per_unit: 1,
        base_price: svc.price_per_unit || 0,
        extra_costs: 0,
        final_price: svc.price_per_unit || 0,
        extra_description: serviceExtraDesc || '',
        price_trueque: svc.price_per_unit || 0,
        stock: 999999,
      })
      setShowForm(false)
      setSelectedServiceId('')
      setServiceExtraDesc('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar servicio')
    }
  }

  const openTagModal = async (item: any) => {
    setTagModalItem(item)
    setTagQty(1)
    setTagIncludeSeller(true)
    setNfcWriteStatus('')
    try {
      const res = await api.post('/pos/code/generate', {
        include_seller: true,
        item_code: item.item_code || item.id,
        quantity: 1,
      })
      setGeneratedTag(res)
    } catch {
      setGeneratedTag(null)
    }
  }

  const refreshGeneratedTag = async (qty: number, includeSeller: boolean) => {
    if (!tagModalItem) return
    try {
      const res = await api.post('/pos/code/generate', {
        include_seller: includeSeller,
        item_code: tagModalItem.item_code || tagModalItem.id,
        quantity: qty > 0 ? qty : 1,
      })
      setGeneratedTag(res)
    } catch {}
  }

  const writePayloadToNfcTag = async (payload: string) => {
    setNfcWriteStatus('')
    const anyWin = window as any
    if (!('NDEFReader' in anyWin)) {
      setNfcWriteStatus(t('store_nfc_not_supported', 'Tu navegador no soporta Web NFC directo. Usa Chrome en Android o la App POS Android para grabar la etiqueta NFC, o copia el codigo: ') + payload)
      return
    }
    try {
      setNfcWriteStatus(t('store_nfc_approach_tag', 'Acerca la etiqueta NFC (NTAG213/215) al reverso del telefono...'))
      const ndef = new anyWin.NDEFReader()
      await ndef.write({ records: [{ recordType: 'text', data: payload }] })
      setNfcWriteStatus(t('store_nfc_write_ok', 'Etiqueta NFC grabada correctamente con: ') + payload)
    } catch (err: any) {
      setNfcWriteStatus(t('store_nfc_write_err', 'Error al grabar etiqueta NFC: ') + (err?.message || String(err)))
    }
  }

  const addLineToBasketBuilder = () => {
    const found = items.find((it) => String(it.id) === basketSelId)
    if (!found || basketSelQty <= 0) return
    setBasketLines([...basketLines, { item: found, qty: basketSelQty }])
    setBasketSelId('')
    setBasketSelQty(1)
  }

  const savePresetBasketTag = async () => {
    if (basketLines.length === 0) return
    setError('')
    try {
      const res = await api.post('/pos/baskets', {
        label: basketLabel,
        is_reusable: true,
        items: basketLines.map((l) => ({
          store_item_id: l.item.is_universal_service ? '' : String(l.item.id),
          product_id: l.item.product_id ? String(l.item.product_id) : '',
          item_code: l.item.item_code || '',
          item_name: l.item.product_name,
          unit: l.item.unit || 'unidad',
          quantity: l.qty,
        })),
      })
      setSavedBasketTag(res)
      setSuccessMsg(t('store_basket_tag_created', 'Canasta generada para codigo de barra, QR y etiqueta NFC.'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar canasta')
    }
  }

  useEffect(() => { load() }, [i18n.language])

  // Cargar jerarquia de categorias (3 niveles)
  useEffect(() => {
    api.get('/products/categories')
      .then((d: any) => setHierarchy(Array.isArray(d?.categories) ? d.categories : []))
      .catch(() => setHierarchy([]))
  }, [i18n.language])

  // Cargar componentes disponibles del catalogo (para el modal)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')
  const [modalSearchTerm, setModalSearchTerm] = useState('')
  useEffect(() => {
    if (!showComponentModal) return
    setModalLoading(true)
    setModalError('')
    const params = new URLSearchParams()
    if (modalFilter !== 'all') params.set('category', modalFilter)
    if (modalSearchTerm.trim()) params.set('search', modalSearchTerm.trim())
    const qs = params.toString()
    const controller = new AbortController()
    api.get('/products/components' + (qs ? `?${qs}` : ''))
      .then((d: any) => {
        if (controller.signal.aborted) return
        setModalResults(Array.isArray(d) ? d : [])
        setModalLoading(false)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setModalResults([])
        setModalLoading(false)
        setModalError(err?.message || t('error_load_components', 'Error al cargar componentes'))
      })
    return () => controller.abort()
  }, [showComponentModal, modalFilter, modalSearchTerm])

  // Debounce: copiar searchTerm a modalSearchTerm despues de 300ms sin escribir
  useEffect(() => {
    const t = setTimeout(() => setModalSearchTerm(searchTerm), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

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
      setError(t('error_yield_zero', 'El numero de productos que salen debe ser mayor que cero'))
      return
    }
    // Clasificar por item_type del catalogo federado (fallback: heuristica vieja)
    let category = itemTypeToCategory[pendingComponent.item_type]
    if (!category) {
      if (pendingComponent.parent_category === 'Embalaje') category = 'embalaje'
      else if (pendingComponent.parent_category === 'Envio') category = 'envio'
      else if (pendingComponent.unit === 'hora') category = 'trabajo'
      else category = 'producto_base'
    }

    // Calcular cantidad por producto: si compro 1 kg y salen 50 productos -> 0.02 kg por producto
    const qtyPerProduct = qtyPurchased / yieldProducts

    setComponents([...components, {
      component_product_id: pendingComponent.id,
      component_name: pendingComponent.name,
      component_unit: pendingComponent.unit || 'unidad',
      component_price: pendingComponent.price_per_unit || 0,
      quantity: qtyPerProduct,
      component_category: category,
      component_catalog_key: pendingComponent.catalog_key || '',
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
      setError(t('error_name_required', 'Debes darle un nombre a tu producto'))
      return
    }
    if (!selectedParent || !selectedCategory) {
      setError(t('error_category_required', 'Debes seleccionar la categoria padre y la categoria de tu producto'))
      return
    }
    if (components.length === 0) {
      setError(t('error_components_required', 'Debes agregar al menos un componente'))
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
      setError(err instanceof Error ? err.message : t('error_create_composite', 'Error al crear producto compuesto'))
    }
  }

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))]
  const storeCategories = [...new Set(allStores.map((s) => s.parent_category || s.category).filter(Boolean))].sort()

  const addItem = async () => {
    setError('')
    if (!form.product_id) {
      setError(t('error_select_product', 'Selecciona un producto del registro'))
      return
    }
    // Find the selected product to send its info
    const product = products.find((p) => p.id === form.product_id)
    if (!product) {
      setError(t('error_product_not_found', 'Producto no encontrado'))
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
      setError(err instanceof Error ? err.message : t('error_add_item', 'Error al agregar producto'))
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
      setError(err instanceof Error ? err.message : t('error_buy', 'Error al comprar'))
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
    const matchCategory = !filterCategory || s.parent_category === filterCategory || s.category === filterCategory
    return matchSearch && matchCategory
  }).sort((a, b) => (a.product_name || '').localeCompare(b.product_name || ''))

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
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingCart size={24} />{t('store_title', 'Tienda')}</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
        </div>
      </div>

      {/* Selector de vista */}
      <div className="flex gap-2">
        <button onClick={() => setView('mine')} className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'mine' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>
          {t('store_my_store', 'Mi Tienda')}
        </button>
        <button onClick={() => setView('browse')} className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'browse' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>
          {t('store_all_stores', 'Todas las Tiendas')}
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>{t('help_title', 'Tienda Personal - Ayuda')}</strong></p>
          <p><strong>{t('help_what_label', 'Que es la tienda personal:')}</strong> {t('help_what', 'Cada usuario tiene su propia tienda donde ofrece los productos que tiene disponibles para intercambiar. Es como tu vitrina personal: muestras que tienes y otros pueden verlo y comprarlo. Tu tienda es independiente de las demas.')}</p>
          <p><strong>{t('help_purpose_label', 'Para que sirve:')}</strong> {t('help_purpose', 'Sirve para que cada miembro gestione su inventario personal. Indicas que productos del catalogo comunitario tienes disponibles y en que cantidad. Asi otros miembros saben a quien acudir para conseguir lo que buscan.')}</p>
          <p><strong>{t('help_usage_label', 'Como se usa:')}</strong> {t('help_usage', '1) Ve a "Mi Tienda" y presiona "Agregar Producto". 2) Selecciona un producto del catalogo comunitario (registro global). 3) Indica cuantas unidades tienes (stock). 4) El producto aparece en tu tienda con su precio fijo. Para comprar, ve a "Buscar Productos" y encuentra lo que necesitas.')}</p>
          <p><strong>{t('help_add_label', 'Como agregar productos del catalogo a tu tienda:')}</strong> {t('help_add', 'Solo puedes vender productos que ya existen en el registro global de productos. Si necesitas un producto que no esta en el registro, debe aprobarse en asamblea primero. Una vez agregado al catalogo, puedes incluirlo en tu tienda indicando tu stock.')}</p>
          <p><strong>{t('help_stock_label', 'Que es el stock:')}</strong> {t('help_stock', 'Es la cantidad de unidades que tienes disponibles para vender. Cuando alguien compra, el stock disminuye automaticamente. Si el stock llega a 0, el producto aparece como "agotado". Puedes actualizar el stock cuando tengas mas unidades disponibles.')}</p>
          <p><strong>{t('help_price_label', 'Que es el precio:')}</strong> {t('help_price', 'El precio es fijo y viene del registro global de productos. No puedes cambiarlo: el mismo producto cuesta lo mismo en todas las tiendas. Esto garantiza equidad: es intercambio, no venta con ganancia.')}</p>
          <p><strong>{t('help_sale_label', 'Como funciona la venta:')}</strong> {t('help_sale', `Cuando alguien encuentra tu producto en "Buscar Productos" y lo compra, se transfiere el monto en ${currency} de su cuenta a la tuya, y el stock se reduce. La transaccion es automatica y transparente.`, { currency })}</p>
          <p><strong>{t('help_my_store_label', 'Mi Tienda:')}</strong> {t('help_my_store', 'Muestra los productos que tu ofreces y tu inventario personal.')}</p>
          <p><strong>{t('help_search_label', 'Buscar Productos:')}</strong> {t('help_search', 'Busca que productos estan disponibles en todas las tiendas de la red. Puedes filtrar por categoria o buscar por nombre. Asi sabes quien tiene lo que buscas.')}</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('close', t('common:close'))}</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {/* VISTA: MI TIENDA */}
      {view === 'mine' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="font-semibold flex items-center gap-2"><StoreIcon size={18} />{t('store_my_personal_store', 'Mi Tienda Personal (Productos y Servicios)')}</h2>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setShowBasketBuilder(!showBasketBuilder); setSavedBasketTag(null) }} className="btn-secondary flex items-center gap-2 text-sm">
                <QrCode size={16} />{t('store_basket_tag_btn', 'Etiqueta / QR de Canasta')}
              </button>
              <button onClick={() => { setShowForm(!showForm); setFormMode('composite') }} className="btn-primary flex items-center gap-2"><Plus size={18} />{t('store_create_composite', 'Agregar Producto o Servicio')}</button>
            </div>
          </div>

          {successMsg && <div className="text-emerald-700 text-sm bg-emerald-50 border border-emerald-200 p-3 rounded-lg">{successMsg}</div>}

          {/* Constructor de Etiqueta / QR / NFC para una Canasta Completa */}
          {showBasketBuilder && (
            <div className="card bg-blue-50 border border-blue-200 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                  <QrCode size={18} /> {t('store_basket_builder_title', 'Generar Codigo de Barra / QR / Etiqueta NFC de una Canasta Completa')}
                </h3>
                <button onClick={() => setShowBasketBuilder(false)} className="text-gray-500 hover:text-gray-700"><X size={18} /></button>
              </div>
              <p className="text-xs text-blue-800">
                {t('store_basket_builder_desc', 'Arma una lista de productos o servicios con su peso/cantidad. El codigo generado incluye tus datos de vendedor: en el Punto de Venta el comprador solo escanea la etiqueta y acerca su tarjeta para pagar.')}
              </p>
              <div>
                <label className="label text-xs">{t('store_basket_label', 'Nombre de la canasta o pedido (opcional)')}</label>
                <input className="input" placeholder="Ej: Combo Conuquero Semanal / Pedido Mesa 3" value={basketLabel} onChange={(e) => setBasketLabel(e.target.value)} />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select className="input flex-1 min-w-[200px]" value={basketSelId} onChange={(e) => setBasketSelId(e.target.value)}>
                  <option value="">{t('store_select_item_for_basket', '-- Selecciona producto o servicio de tu tienda --')}</option>
                  {items.map((it) => (
                    <option key={it.id} value={String(it.id)}>
                      [{it.item_code || '---'}] {it.product_name} — {it.final_price || it.price_trueque} {currency}/{it.unit || 'unidad'}
                    </option>
                  ))}
                </select>
                <input type="number" step="any" min="0.001" className="input w-28" placeholder="Peso/Cant." value={basketSelQty} onChange={(e) => setBasketSelQty(parseFloat(e.target.value) || 0)} />
                <button type="button" onClick={addLineToBasketBuilder} className="btn-secondary text-sm">
                  + {t('store_add_to_basket_btn', 'Agregar a canasta')}
                </button>
              </div>
              {basketLines.length > 0 && (
                <div className="space-y-1 bg-white p-3 rounded-lg border">
                  {basketLines.map((l, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b last:border-b-0">
                      <span><strong>[{l.item.item_code}]</strong> {l.item.product_name} × {l.qty} {l.item.unit}</span>
                      <button onClick={() => setBasketLines(basketLines.filter((_, i) => i !== idx))} className="text-red-500"><X size={14} /></button>
                    </div>
                  ))}
                  <div className="pt-2">
                    <button onClick={savePresetBasketTag} className="btn-primary text-sm w-full">
                      {t('store_generate_basket_codes', 'Generar Codigo de Barra, QR y Etiqueta NFC de esta Canasta')}
                    </button>
                  </div>
                </div>
              )}
              {savedBasketTag && (
                <div className="bg-white rounded-xl p-4 border space-y-3 text-center">
                  <p className="text-xs font-bold text-emerald-800">
                    {t('store_basket_short_code', 'Codigo corto de canasta:')} <span className="font-mono text-base">{savedBasketTag.short_code}</span>
                    {savedBasketTag.barcode_ean13 && <span className="ml-3">EAN-13: <span className="font-mono">{savedBasketTag.barcode_ean13}</span></span>}
                  </p>
                  <div className="flex justify-center">
                    <QRCodeSVG value={savedBasketTag.qr_payload || savedBasketTag.nfc_payload} size={180} level="M" />
                  </div>
                  <p className="text-[11px] font-mono bg-gray-100 p-2 rounded break-all">{savedBasketTag.nfc_inline_payload || savedBasketTag.nfc_payload}</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    <button onClick={() => writePayloadToNfcTag(savedBasketTag.nfc_inline_payload || savedBasketTag.nfc_payload)} className="btn-primary text-xs flex items-center gap-1.5">
                      <Nfc size={15} /> {t('store_write_nfc_tag_btn', 'Grabar en Etiqueta NFC (con vendedor incluido)')}
                    </button>
                  </div>
                  {nfcWriteStatus && <p className="text-xs text-blue-700 font-medium">{nfcWriteStatus}</p>}
                </div>
              )}
            </div>
          )}

          {showForm && (
            <div className="card space-y-4">
              {/* Selector de modo */}
              <div className="flex gap-2 border-b pb-3 flex-wrap">
                <button
                  onClick={() => setFormMode('composite')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${formMode === 'composite' ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  <Layers size={14} className="inline mr-1" />{t('store_composite_product', 'Producto Compuesto')}
                </button>
                <button
                  onClick={() => setFormMode('service')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${formMode === 'service' ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  <Briefcase size={14} className="inline mr-1" />{t('store_offer_service_tab', 'Ofrecer Servicio / Horas de Trabajo')}
                </button>
                <button
                  onClick={() => setFormMode('simple')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${formMode === 'simple' ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  <Package size={14} className="inline mr-1" />{t('store_catalog_product', 'Producto del Catalogo')}
                </button>
              </div>

              {formMode === 'composite' ? (
                <>
                  <h3 className="font-semibold">{t('store_composite_title', 'Crear Producto Compuesto')}</h3>
                  <p className="text-xs text-gray-500">{t('store_composite_desc', 'Crea un producto nuevo seleccionando materias primas, productos base, horas de trabajo, embalaje y envio del catalogo aprobado. El precio se calcula automaticamente. No necesita aprobacion de asamblea porque usa componentes ya aprobados.')}</p>

                  <div>
                    <label className="label">{t('store_product_name_label', 'Nombre de tu producto')}</label>
                    <input className="input" placeholder={t('store_product_name_placeholder', 'Ej: Jugo de naranja 200ml, Pan integral, Mi mermelada')} value={compositeName} onChange={(e) => setCompositeName(e.target.value)} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t('store_unit_label', 'Unidad de medida del producto')}</label>
                      <select className="input" value={compositeUnit} onChange={(e) => setCompositeUnit(e.target.value)}>
                        <option value="unidad">{t('unit_unidad', 'Unidad')}</option>
                        <option value="ml">{t('unit_ml', 'Mililitro (ml)')}</option>
                        <option value="L">{t('unit_l', 'Litro (L)')}</option>
                        <option value="gr">{t('unit_gr', 'Gramo (gr)')}</option>
                        <option value="kg">{t('unit_kg', 'Kilogramo (kg)')}</option>
                        <option value="manojo">{t('unit_manojo', 'Manojo')}</option>
                        <option value="hora">{t('unit_hora', 'Hora')}</option>
                        <option value="carga">{t('unit_carga', 'Carga')}</option>
                        <option value="m">{t('unit_m', 'Metro (m)')}</option>
                        <option value="m2">{t('unit_m2', 'Metro cuadrado (m2)')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">{t('store_qty_per_unit_label', 'Cantidad por unidad')}</label>
                      <input type="number" step="any" className="input" placeholder={t('store_qty_per_unit_placeholder', 'Ej: 200 (para 200ml), 500 (para 500gr), 1 (para 1 unidad)')} value={compositeQtyPerUnit} onChange={(e) => setCompositeQtyPerUnit(parseFloat(e.target.value) || 1)} />
                      <p className="text-xs text-gray-500 mt-1">{t('store_qty_per_unit_hint', 'Ej: 200 ml, 500 gr, 1 kg, 1 unidad')}</p>
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-3">
                    <p className="text-xs font-semibold text-emerald-800">{t('store_category_location', 'Ubica tu producto en su categoria exacta (3 niveles)')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="label text-xs">{t('store_parent_cat_step', '1. Categoria Padre')}</label>
                        <select
                          className="input"
                          value={selectedParent}
                          onChange={(e) => {
                            setSelectedParent(e.target.value)
                            setSelectedCategory('')
                            setSelectedSubcategory('')
                          }}
                        >
                          <option value="">{t('store_select_option', '-- Selecciona --')}</option>
                          {hierarchy.map((pc: any) => (
                            <option key={pc.name} value={pc.name}>{pc.label || tc(pc.name)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs">{t('store_category_step', '2. Categoria')}</label>
                        <select
                          className="input"
                          value={selectedCategory}
                          onChange={(e) => {
                            setSelectedCategory(e.target.value)
                            setSelectedSubcategory('')
                          }}
                          disabled={!selectedParent}
                        >
                          <option value="">{t('store_select_option', '-- Selecciona --')}</option>
                          {selectedParent && hierarchy
                            .find((pc: any) => pc.name === selectedParent)
                            ?.categories?.map((c: any) => (
                              <option key={c.name} value={c.name}>{c.label || tc(c.name)}</option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs">{t('store_subcategory_step', '3. Subcategoria (opcional)')}</label>
                        <select
                          className="input"
                          value={selectedSubcategory}
                          onChange={(e) => setSelectedSubcategory(e.target.value)}
                          disabled={!selectedCategory}
                        >
                          <option value="">{t('store_no_subcategory', '-- Sin subcategoria --')}</option>
                          {selectedParent && selectedCategory && hierarchy
                            .find((pc: any) => pc.name === selectedParent)
                            ?.categories?.find((c: any) => c.name === selectedCategory)
                            ?.subcategories?.map((sc: any) => (
                              <option key={sc.name} value={sc.name}>{sc.label || tc(sc.name)}</option>
                            ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      {selectedParent && selectedCategory
                        ? <>{t('store_location_label', 'Ubicacion:')} <strong>{tc(selectedParent)} › {tc(selectedCategory)}{selectedSubcategory ? ` › ${tc(selectedSubcategory)}` : ''}</strong></>
                        : <span className="text-amber-700">{t('store_location_required', 'Debes seleccionar al menos categoria padre y categoria. Si necesitas una categoria nueva, pide a administracion que la cree en el catalogo.')}</span>}
                    </p>
                  </div>

                  <div>
                    <label className="label">{t('store_description_label', 'Descripcion')}</label>
                    <textarea className="input" rows={2} placeholder={t('store_description_placeholder', 'Describe tu producto: como lo haces, que lo hace especial...')} value={compositeDesc} onChange={(e) => setCompositeDesc(e.target.value)} />
                  </div>

                  <div>
                    <label className="label">{t('store_stock_label', 'Cantidad disponible (stock)')}</label>
                    <input type="number" className="input" placeholder={t('store_stock_placeholder', 'Ej: 10')} value={compositeStock} onChange={(e) => setCompositeStock(parseInt(e.target.value) || 1)} />
                  </div>

                  {/* Selector de componentes */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">{t('store_add_components', 'Agregar componentes')}</p>
                      <p className="text-xs text-gray-600 mt-1">{t('store_add_components_desc', 'Selecciona materias primas, productos base, horas de trabajo, embalaje o envio. El precio se calcula automaticamente.')}</p>
                    </div>

                    {/* Boton para abrir modal de busqueda */}
                    <button
                      onClick={() => setShowComponentModal(true)}
                      className="w-full border-2 border-dashed border-emerald-400 rounded-lg p-3 text-emerald-700 hover:bg-emerald-50 transition flex items-center justify-center gap-2 font-medium text-sm"
                    >
                      <Search size={18} /> {t('store_search_component', 'Buscar y agregar componente')}
                    </button>

                    {/* Configuracion del componente seleccionado */}
                    {pendingComponent && (
                      <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-sm text-amber-900">{pendingComponent.name}</p>
                            <p className="text-xs text-amber-700">{fmtTQ(pendingComponent.price_per_unit || 0)} {currency} / {pendingComponent.unit || 'unidad'}</p>
                            {pendingComponent.description && <p className="text-xs text-gray-500 mt-1">{pendingComponent.description}</p>}
                          </div>
                          <button onClick={cancelAddComponent} className="text-red-500 hover:text-red-700"><X size={18} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="label text-xs">{t('store_qty_purchased_label', 'Cantidad que compraste')}</label>
                            <input
                              type="number"
                              step="0.01"
                              className="input"
                              placeholder={t('store_qty_purchased_placeholder', 'Ej: 1')}
                              value={qtyPurchased}
                              onChange={(e) => setQtyPurchased(parseFloat(e.target.value) || 0)}
                            />
                            <p className="text-xs text-gray-400 mt-1">Ej: 1 {pendingComponent.unit || 'kg'}</p>
                          </div>
                          <div>
                            <label className="label text-xs">{t('store_yield_label', 'Cuantos productos salen?')}</label>
                            <input
                              type="number"
                              step="1"
                              className="input"
                              placeholder={t('store_yield_placeholder', 'Ej: 50')}
                              value={yieldProducts}
                              onChange={(e) => setYieldProducts(parseInt(e.target.value) || 0)}
                            />
                            <p className="text-xs text-gray-400 mt-1">{t('store_yield_hint', 'E.g.: 50 containers of 200ml')}</p>
                          </div>
                        </div>
                        {yieldProducts > 0 && qtyPurchased > 0 && (
                          <div className="bg-white rounded-lg p-2 text-xs text-gray-700">
                            <p>{t('store_cost_per_product', 'Costo por producto:')} <strong>{fmtTQ((pendingComponent.price_per_unit || 0) * qtyPurchased / yieldProducts)} {currency}</strong></p>
                            <p className="text-gray-500">= {fmtTQ(pendingComponent.price_per_unit || 0)} {currency} x {qtyPurchased} {pendingComponent.unit} / {yieldProducts} productos = {fmtNumber(qtyPurchased / yieldProducts, 4)} {pendingComponent.unit} por producto</p>
                          </div>
                        )}
                        <button onClick={confirmAddComponent} className="btn-primary w-full" disabled={yieldProducts <= 0 || qtyPurchased <= 0}>
                          {t('store_add_this_component', 'Agregar este componente')}
                        </button>
                      </div>
                    )}

                    {/* Lista de componentes agregados */}
                    {components.length > 0 && (
                      <div className="space-y-2 mt-3">
                        <p className="text-xs font-semibold text-gray-700">{t('store_components_list', 'Componentes de tu producto:')}</p>
                        {components.map((c, i) => (
                          <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-200">
                            <div className="flex-1">
                              <span className="text-sm font-medium">{c.component_name}</span>
                              <span className="text-xs text-gray-500 ml-2">({c.component_category})</span>
                              <span className="text-xs text-gray-500 block">
                                {t('store_bought', 'Compro')} {c.quantity_purchased} {c.component_unit} → {c.yield_products} {t('store_products', 'productos')} →
                                <strong> {fmtTQ((c.component_price || 0) * c.quantity)} {currency}</strong> por producto
                              </span>
                            </div>
                            <button onClick={() => removeComponent(i)} className="text-red-500 hover:text-red-700">
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Precio total calculado (piso de referencia del catalogo federado) */}
                    {components.length > 0 && (
                      <div className="bg-trueque-100 border border-trueque-300 rounded-lg p-3 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-trueque-900">{t('store_total_price', 'Precio total automatico:')}</span>
                          <span className="text-xl font-bold text-trueque-700">{fmtNumber(compositeTotalPrice, 2)} {currency}</span>
                        </div>
                        <p className="text-[10px] text-trueque-600">{t('store_reference_price_hint', 'Los precios del catalogo federado son de referencia (minimo). Tu producto no puede costar menos que la suma de sus componentes.')}</p>
                      </div>
                    )}
                  </div>

                  <button onClick={saveComposite} className="btn-primary" disabled={components.length === 0 || !compositeName || !selectedParent || !selectedCategory}>
                    {t('store_publish', 'Publicar en Mi Tienda')} ({fmtNumber(compositeTotalPrice, 2)} {currency})
                  </button>
                </>
              ) : formMode === 'service' ? (
                <>
                  <h3 className="font-semibold">{t('store_service_title', 'Agregar Servicio Profesional / Oficio a Mi Tienda')}</h3>
                  <p className="text-xs text-gray-600">
                    {t('store_service_desc', 'El servicio universal de Trabajo en el Conuco / Mano Vuelta ya esta incluido automaticamente en la tienda de todos los miembros. Aqui puedes agregar los servicios tecnicos, intelectuales u oficios que tu ofreces personalmente para que aparezcan en tu Punto de Venta.')}
                  </p>
                  <div>
                    <label className="label">{t('store_select_service_label', 'Servicio del catalogo federado')}</label>
                    <select className="input" value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)}>
                      <option value="">{t('store_select_service_ph', '-- Seleccionar servicio que ofreces --')}</option>
                      {servicesCatalog.map((s) => (
                        <option key={s.id} value={s.id}>
                          [{s.item_code || 'SVC'}] {s.name} — {s.price_per_unit} {currency}/{s.unit || 'hora'} ({s.category})
                          {s.is_universal_service ? ' [Universal]' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">{t('store_service_specialty_label', 'Detalle o especialidad que ofreces (opcional)')}</label>
                    <input className="input" placeholder="Ej: Clases de matematicas, electricidad residencial, reparacion de bombas..." value={serviceExtraDesc} onChange={(e) => setServiceExtraDesc(e.target.value)} />
                  </div>
                  <button onClick={addServiceToMyStore} className="btn-primary" disabled={!selectedServiceId}>
                    {t('store_add_service_btn', 'Agregar Servicio a Mi Tienda')}
                  </button>
                </>
              ) : (
                <>
                  <h3 className="font-semibold">{t('store_add_catalog_title', 'Agregar Producto del Catalogo')}</h3>
                  <p className="text-xs text-gray-500">{t('store_add_catalog_desc', 'Selecciona un producto del registro global e indica cuantas unidades tienes disponibles.')}</p>

                  {/* Filtro por categoria */}
                  {categories.length > 0 && (
                    <div>
                      <label className="label">{t('store_filter_category', 'Filtrar por categoria')}</label>
                      <select className="input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                        <option value="">{t('store_all_categories', 'Todas las categorias')}</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>{tc(c)}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="label">{t('store_catalog_product_label', 'Producto del catalogo')}</label>
                    {products.length === 0 ? (
                      <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                        {t('store_no_products_registry', 'No hay productos en el registro. La asamblea debe agregar productos primero.')}
                      </p>
                    ) : (
                      <select className="input" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value, extra_costs: 0, extra_description: '' })}>
                        <option value="">{t('store_select_product', 'Seleccionar producto...')}</option>
                        {filteredProducts.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} — {p.price_trueque || p.price} {currency}/{p.unit || 'unidad'} ({p.category || t('store_no_category', 'sin categoria')})</option>
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
                        <span className="text-xs text-gray-500">{t('store_base_price_label', 'Precio base del catalogo:')}</span>
                        <span className="font-bold text-emerald-700">{basePrice} {currency} / {selectedProduct.unit || 'unidad'}</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t('store_stock_label', 'Cantidad disponible (stock)')}</label>
                      <input type="number" className="input" placeholder={t('store_stock_placeholder', 'Ej: 10')} value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="label">{t('store_units_per_package', 'Unidades por paquete')}</label>
                      <input type="number" step="0.1" className="input" placeholder={t('store_units_ph', 'E.g.: 1, 0.5, 2')} value={form.quantity_per_unit} onChange={(e) => setForm({ ...form, quantity_per_unit: parseFloat(e.target.value) || 1 })} />
                    </div>
                  </div>

                  {/* Costos adicionales */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-amber-900">{t('store_extra_costs_title', 'Costos adicionales (opcionales)')}</p>
                      <p className="text-xs text-gray-600 mt-1">{t('store_extra_costs_desc', 'Para envio o presentacion especial. Si el comprador recoge en tu parcela, deja en 0.')}</p>
                    </div>
                    <div>
                      <label className="label">{t('store_extra_cost_label', 'Costo adicional en')} {currency}</label>
                      <input type="number" className="input" placeholder={t('store_extra_cost_placeholder', 'Ej: 5 (por envio, envase de vidrio, etc.)')} value={form.extra_costs} onChange={(e) => setForm({ ...form, extra_costs: toCents(e.target.value) })} />
                    </div>
                    <div>
                      <label className="label">{t('store_extra_desc_label', 'Descripcion del costo adicional')}</label>
                      <input className="input" placeholder={t('store_extra_desc_placeholder', 'Ej: Envase de vidrio retornable, entrega a domicilio')} value={form.extra_description} onChange={(e) => setForm({ ...form, extra_description: e.target.value })} />
                    </div>
                  </div>

                  {/* Resumen del precio final */}
                  {selectedProduct && (
                    <div className="bg-trueque-50 border border-trueque-200 rounded-lg p-3 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t('store_price_base', 'Precio base:')}</span>
                        <span className="font-medium">{basePrice} {currency}</span>
                      </div>
                      {extraCosts > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{t('store_extra_costs', 'Costos adicionales:')}</span>
                          <span className="font-medium text-amber-700">+{extraCosts} {currency}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-bold pt-1 border-t border-trueque-200">
                        <span className="text-trueque-900">{t('store_final_price', 'Precio final:')}</span>
                        <span className="text-trueque-700">{finalPrice} {currency}</span>
                      </div>
                    </div>
                  )}

                  <button onClick={addItem} className="btn-primary" disabled={!form.product_id}>{t('store_add_to_store', 'Agregar a Mi Tienda')}</button>
                </>
              )}
            </div>
          )}

          {items.length === 0 && !showForm ? (
            <div className="card text-center text-gray-500 py-8">
              <p>{t('store_empty', 'Tu tienda esta vacia.')}</p>
              <p className="text-xs mt-2">{t('store_empty_hint', 'Agrega productos del registro global con el boton de arriba.')}</p>
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
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold">{item.product_name || product?.name || 'Producto'}</h3>
                      {item.item_code && (
                        <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border">
                          #{item.item_code}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{item.description || product?.description}</p>
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {item.category && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded inline-block">{item.category}</span>}
                      {item.is_universal_service && (
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                          {t('store_universal_service_badge', 'Servicio Universal (Todos)')}
                        </span>
                      )}
                      {item.is_service && !item.is_universal_service && (
                        <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                          {t('store_service_badge', 'Servicio')}
                        </span>
                      )}
                    </div>
                    {isComposite && (
                      <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded p-2">
                        <p className="text-[10px] font-bold text-emerald-800 uppercase">{t('composite_badge', 'Compuesto')}</p>
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
                      {!item.is_service && (
                        <span className={`text-sm ${item.stock === 0 ? 'text-red-500' : 'text-gray-500'}`}>
                          {t('store_stock', 'Stock:')} {item.stock}{item.stock === 0 ? ` (${t('store_sold_out', 'agotado')})` : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <button onClick={() => openTagModal(item)} className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs">
                        <QrCode size={14} /> {t('store_tag_barcode_btn', 'Barra / QR / NFC')}
                      </button>
                      {!item.is_universal_service && (
                        <button onClick={() => removeItem(item.id)} className="btn-secondary text-red-600"><Trash2 size={16} /></button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* VISTA: TODAS LAS TIENDAS (MARKETPLACE) */}
      {view === 'browse' && (
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><StoreIcon size={18} />{t('store_all_stores', 'Todas las Tiendas')}</h2>
          <p className="text-xs text-gray-500">{t('store_browse_desc', 'Explora todos los productos disponibles en la comunidad. Cada producto muestra quien lo vende y su precio.')}</p>

          {/* Filtros */}
          <div className="card space-y-3">
            <div className="flex gap-2 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="label">{t('store_search_seller', 'Buscar producto o vendedor')}</label>
                <input className="input" placeholder={t('store_search_placeholder', 'Ej: pan, quinua, elena, tienda...')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className="min-w-[180px]">
                <label className="label">{t('store_category_label', 'Categoria')}</label>
                <select className="input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                  <option value="">{t('store_all_categories', 'Todas las categorias')}</option>
                  {storeCategories.map((c) => (
                    <option key={c} value={c}>{tc(c)}</option>
                  ))}
                </select>
              </div>
            </div>
            {(searchQuery || filterCategory) && (
              <button onClick={() => { setSearchQuery(''); setFilterCategory('') }} className="text-xs text-blue-600 hover:underline">
                {t('store_clear_filters', 'Limpiar filtros')}
              </button>
            )}
            <p className="text-xs text-gray-400">
              {t('store_results_count', '{{count}} producto(s) disponible(s) en {{stores}} tienda(s)', { count: filteredStores.length, stores: new Set(filteredStores.map(s => s.owner_name).filter(Boolean)).size })}
            </p>
          </div>

          {/* Grid de productos estilo marketplace */}
          {filteredStores.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">
              <StoreIcon size={48} className="mx-auto mb-3 opacity-30" />
              <p>{t('store_no_products_filters', 'No hay productos disponibles')}{searchQuery || filterCategory ? t('store_no_products_filters_suffix', ' con esos filtros') : ''}.</p>
              <p className="text-xs mt-2">
                {searchQuery || filterCategory
                  ? t('store_try_clear', 'Intenta limpiar los filtros o buscar otro termino.')
                  : t('store_products_appear', 'Los productos aparecen cuando los miembros los agregan a sus tiendas.')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredStores.map((s) => (
                <div key={s.id} className="card overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                  {/* Imagen / placeholder */}
                  <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
                    {s.image_url ? (
                      <img
                        src={assetUrl(s.image_url)}
                        alt={s.product_name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                          const parent = (e.target as HTMLImageElement).parentElement
                          if (parent) {
                            parent.innerHTML = '<div class="text-gray-300 text-4xl"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>'
                          }
                        }}
                      />
                    ) : (
                      <div className="text-gray-300">
                        <Package size={48} />
                      </div>
                    )}
                  </div>

                  {/* Info del producto */}
                  <div className="p-3 flex-1 flex flex-col gap-2">
                    <div>
                      <h3 className="font-semibold text-sm leading-tight line-clamp-2">{s.product_name}</h3>
                      {(s.parent_category || s.category) && (
                        <span className="inline-block text-[10px] text-gray-400 mt-1">{tc(s.parent_category)}{s.subcategory ? ` · ${tc(s.subcategory)}` : ''}</span>
                      )}
                    </div>

                    {/* Vendedor */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-2 py-1.5">
                      <StoreIcon size={12} className="flex-shrink-0 text-trueque-600" />
                      <span className="font-medium truncate">{s.owner_name || s.store_name || t('store_store_label', 'Tienda')}</span>
                    </div>

                    {/* Precio y stock */}
                    <div className="flex items-end justify-between mt-auto pt-2">
                      <div>
                        <span className="font-bold text-trueque-700 text-lg">{s.final_price || s.price_trueque} {currency}</span>
                        {s.unit && <span className="block text-[10px] text-gray-400">por {s.unit}</span>}
                      </div>
                      <div className="text-right">
                        {s.stock === 0 ? (
                          <span className="text-xs text-red-500 font-medium">{t('store_out_of_stock', 'Agotado')}</span>
                        ) : (
                          <span className="text-xs text-gray-500">{t('store_stock', 'Stock:')} {s.stock}</span>
                        )}
                      </div>
                    </div>

                    {s.extra_costs > 0 && s.extra_description && (
                      <p className="text-[10px] text-amber-600 italic">{s.extra_description} (+{s.extra_costs} {currency})</p>
                    )}

                    {/* Botón comprar */}
                    {s.stock > 0 && (
                      <button onClick={() => buy(s)} className="btn-primary text-sm flex items-center justify-center gap-1 w-full mt-1">
                        <ShoppingCart size={14} /> {t('store_buy', 'Comprar')}
                      </button>
                    )}
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
              <h3 className="font-bold text-lg">{t('store_search_component_title', 'Buscar Componente')}</h3>
              <button onClick={() => setShowComponentModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            {/* Buscador */}
            <div className="p-4 border-b space-y-3">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="input pl-10"
                  placeholder={t('store_component_search_placeholder', 'Escribe el nombre del componente... (ej: naranja, arcilla, tela, envase)')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
              {/* Filtros por categoria */}
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: t('store_cat_all', 'Todos') },
                  { id: 'materia_prima', label: t('store_cat_raw_materials', 'Materias Primas') },
                  { id: 'producto_base', label: t('store_cat_base_products', 'Productos Base') },
                  { id: 'trabajo', label: t('store_cat_work', 'Trabajo (h)') },
                  { id: 'embalaje', label: t('store_cat_packaging', 'Embalaje') },
                  { id: 'envio', label: t('store_cat_shipping', 'Envio') },
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
                  <p className="text-sm">{t('store_loading_components', 'Cargando componentes...')}</p>
                </div>
              ) : modalError ? (
                <div className="text-center py-8 text-red-500">
                  <p className="text-sm">{modalError}</p>
                  <p className="text-xs mt-2">{t('store_session_expired_hint', 'Si tu sesion expiro, guarda tu trabajo y vuelve a iniciar sesion.')}</p>
                </div>
              ) : modalResults.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Search size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {modalSearchTerm ? t('store_no_results_search', 'No se encontro "{{term}}" en esta categoria', { term: modalSearchTerm }) : t('store_no_results_category', 'No hay componentes disponibles en esta categoria')}
                  </p>
                  {modalSearchTerm && (
                    <p className="text-xs mt-2">{t('store_no_results_hint', 'Prueba con otra palabra o cambia de categoria. Si no existe el componente, pide a administracion que lo agregue al catalogo.')}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 mb-2">{t('store_results_count_label', '{{count}} resultado(s)', { count: modalResults.length })}</p>
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
                            {tc(c.parent_category)} › {tc(c.category)}{c.subcategory ? ` › ${tc(c.subcategory)}` : ''}
                            {c.node_domain === '__FEDERATION__' && (
                              <span className="ml-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{t('store_federated_badge', 'Federado')}</span>
                            )}
                          </p>
                        </div>
                        <div className="text-right ml-2">
                          <p className="font-bold text-emerald-700">{fmtTQ(c.price_per_unit || 0)} {currency}</p>
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

      {/* Modal para generar Codigo de Barra con peso/cantidad, QR y grabar Etiqueta NFC de un producto/servicio */}
      {tagModalItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setTagModalItem(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-base">{tagModalItem.product_name}</h3>
                <p className="text-xs text-gray-500">
                  Codigo corto: <strong className="font-mono">#{tagModalItem.item_code || '---'}</strong> · {tagModalItem.final_price || tagModalItem.price_trueque} {currency} / {tagModalItem.unit || 'unidad'}
                </p>
              </div>
              <button onClick={() => setTagModalItem(null)} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label text-xs">
                  {t('store_tag_qty_label', `Peso / Cantidad empaquetada en ${tagModalItem.unit || 'unidad'} (ej: 2.5 kg, 10 L, 10 m, 1 unidad)`)}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  className="input"
                  value={tagQty}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 1
                    setTagQty(v)
                    refreshGeneratedTag(v, tagIncludeSeller)
                  }}
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tagIncludeSeller}
                  onChange={(e) => {
                    setTagIncludeSeller(e.target.checked)
                    refreshGeneratedTag(tagQty, e.target.checked)
                  }}
                />
                {t('store_tag_include_seller', 'Incluir mis datos de vendedor en el QR / Etiqueta NFC (el comprador paga directo sin pedir mi tarjeta)')}
              </label>

              {generatedTag && (
                <div className="bg-gray-50 rounded-xl p-4 border space-y-3 text-center">
                  {generatedTag.barcode_ean13 && (
                    <div className="bg-white p-3 rounded-lg border">
                      <p className="text-[11px] text-gray-500 uppercase font-semibold">
                        {t('store_ean13_weight_label', 'Codigo de Barra EAN-13 con peso/cantidad incrustada')}
                      </p>
                      <p className="font-mono text-xl font-bold tracking-widest mt-1">{generatedTag.barcode_ean13}</p>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        {tagModalItem.product_name} × {tagQty} {tagModalItem.unit || 'unidad'} = <strong>{fmtNumber((tagModalItem.final_price || tagModalItem.price_trueque || 0) * tagQty, 2)} {currency}</strong>
                      </p>
                    </div>
                  )}

                  <div className="flex justify-center bg-white p-3 rounded-lg border">
                    <QRCodeSVG value={generatedTag.qr_payload || ''} size={160} level="M" />
                  </div>

                  <p className="text-[11px] font-mono bg-white p-2 rounded border break-all">{generatedTag.nfc_payload}</p>

                  <button
                    type="button"
                    onClick={() => writePayloadToNfcTag(generatedTag.nfc_payload)}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                  >
                    <Nfc size={16} /> {t('store_write_product_nfc_btn', 'Grabar en Etiqueta NFC (NTAG213/215)')}
                  </button>
                  {nfcWriteStatus && <p className="text-xs text-blue-700">{nfcWriteStatus}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
