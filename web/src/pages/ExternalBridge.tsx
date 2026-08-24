import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Plus, Check, X, HelpCircle, Globe, Calculator, Save, Edit3, Info, Package, Building2, Wallet, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { EntitySelector } from '../components/EntitySelector'

export default function ExternalBridge() {
  const { currency } = useConfig()
  const [searchParams, setSearchParams] = useSearchParams()
  const [fc, setFc] = useState<any>(null)
  const [ops, setOps] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const initialSubTab = (searchParams.get('tab') as 'summary' | 'bank' | 'purchases' | 'sales' | 'operations' | 'fc' | 'calculator') || 'summary'
  const [subTab, setSubTab] = useState<'summary' | 'bank' | 'purchases' | 'sales' | 'operations' | 'fc' | 'calculator'>(initialSubTab)
  const [calcSearch, setCalcSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [form, setForm] = useState({ operation_type: 'import', product_id: '', product_name: '', quantity: 0, external_price_usd: 0, local_price_trueque: 0, logistics_pct: 0, external_tax_rate: 0 })

  // DEX summary y cuentas bancarias
  const [summary, setSummary] = useState<any>(null)
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [purchases, setPurchases] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [recalcs, setRecalcs] = useState<any[]>([])
  const [showBankForm, setShowBankForm] = useState(false)
  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [showSaleForm, setShowSaleForm] = useState(false)
  const [bankForm, setBankForm] = useState({ account_name: '', bank_name: '', account_number: '', currency: 'USD', balance: 0, is_cash: false })
  const [purchaseForm, setPurchaseForm] = useState({ product_name: '', quantity: 0, unit: 'kg', unit_cost_external: 0, currency: 'USD', bank_account_id: '', supplier: '', invoice_number: '', notes: '' })
  const [saleForm, setSaleForm] = useState({ product_name: '', quantity: 0, unit: 'kg', unit_price_external: 0, currency: 'USD', bank_account_id: '', buyer: '', notes: '' })

  // FC editor state - calculadora de canasta basica
  const [showFCForm, setShowFCForm] = useState(false)
  const [fcForm, setFcForm] = useState({
    external_currency: 'USD',
    basket_cost_external: 0,
    basket_cost_local_tq: 0,
  })
  const [fcPreview, setFcPreview] = useState<number | null>(null)
  const [fcMsg, setFcMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [fcSaving, setFcSaving] = useState(false)

  const EXTERNAL_CURRENCIES = [
    { code: 'USD', name: 'Dolar estadounidense', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'COP', name: 'Peso colombiano', symbol: '$' },
    { code: 'MXN', name: 'Peso mexicano', symbol: '$' },
    { code: 'ARS', name: 'Peso argentino', symbol: '$' },
    { code: 'VES', name: 'Bolivar venezolano', symbol: 'Bs' },
    { code: 'BRL', name: 'Real brasileño', symbol: 'R$' },
    { code: 'CLP', name: 'Peso chileno', symbol: '$' },
    { code: 'PEN', name: 'Sol peruano', symbol: 'S/' },
    { code: 'BOB', name: 'Boliviano', symbol: 'Bs' },
    { code: 'UYU', name: 'Peso uruguayo', symbol: '$U' },
    { code: 'PYG', name: 'Guarani paraguayo', symbol: '₲' },
    { code: 'DOP', name: 'Peso dominicano', symbol: 'RD$' },
    { code: 'CUP', name: 'Peso cubano', symbol: '$' },
    { code: 'HNL', name: 'Lempira hondureño', symbol: 'L' },
    { code: 'GTQ', name: 'Quetzal guatemalteco', symbol: 'Q' },
    { code: 'NIO', name: 'Cordoba nicaraguense', symbol: 'C$' },
    { code: 'SVC', name: 'Colon salvadoreño', symbol: '$' },
    { code: 'CRC', name: 'Colon costarricense', symbol: '₡' },
    { code: 'PAB', name: 'Balboa panameño', symbol: 'B/.' },
  ]

  const getCurrencySymbol = (code: string) => {
    const c = EXTERNAL_CURRENCIES.find((c) => c.code === code)
    return c?.symbol || code
  }

  const getCurrencyName = (code: string) => {
    const c = EXTERNAL_CURRENCIES.find((c) => c.code === code)
    return c?.name || code
  }

  const load = () => {
    api.get('/external/fc').then(setFc).catch(() => {})
    api.get('/external/operations').then((d: any) => setOps(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/products').then((d: any) => setProducts(Array.isArray(d) ? d : d?.products ?? [])).catch(() => {})
    api.get('/external/summary').then(setSummary).catch(() => {})
    api.get('/external/bank-accounts').then((d: any) => setBankAccounts(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/external/purchases').then((d: any) => setPurchases(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/external/sales').then((d: any) => setSales(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/external/basket-recalculations').then((d: any) => setRecalcs(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const createBankAccount = async () => {
    try {
      await api.post('/external/bank-accounts', bankForm)
      setShowBankForm(false)
      setBankForm({ account_name: '', bank_name: '', account_number: '', currency: 'USD', balance: 0, is_cash: false })
      load()
    } catch (e: any) {
      alert(e.message || 'Error al crear cuenta bancaria')
    }
  }

  const createPurchase = async () => {
    try {
      await api.post('/external/purchases', purchaseForm)
      setShowPurchaseForm(false)
      setPurchaseForm({ product_name: '', quantity: 0, unit: 'kg', unit_cost_external: 0, currency: 'USD', bank_account_id: '', supplier: '', invoice_number: '', notes: '' })
      load()
    } catch (e: any) {
      alert(e.message || 'Error al registrar compra')
    }
  }

  const approvePurchase = async (id: string) => {
    try { await api.post(`/external/purchases/${id}/approve`, {}); load() } catch (e: any) { alert(e.message) }
  }

  const createSale = async () => {
    try {
      await api.post('/external/sales', saleForm)
      setShowSaleForm(false)
      setSaleForm({ product_name: '', quantity: 0, unit: 'kg', unit_price_external: 0, currency: 'USD', bank_account_id: '', buyer: '', notes: '' })
      load()
    } catch (e: any) {
      alert(e.message || 'Error al registrar venta')
    }
  }

  const approveSale = async (id: string) => {
    try { await api.post(`/external/sales/${id}/approve`, {}); load() } catch (e: any) { alert(e.message) }
  }

  const approveRecalc = async (id: string) => {
    try { await api.post(`/external/basket-recalculations/${id}/approve`, {}); load() } catch (e: any) { alert(e.message) }
  }

  // Cuando se carga el FC, inicializar el formulario con esos valores
  useEffect(() => {
    if (fc) {
      setFcForm({
        external_currency: fc.external_currency || 'USD',
        basket_cost_external: fc.basket_cost_external || 0,
        basket_cost_local_tq: fc.basket_cost_local_tq || 0,
      })
    }
  }, [fc])

  const calculateFC = async () => {
    if (fcForm.basket_cost_external <= 0 || fcForm.basket_cost_local_tq <= 0) {
      setFcMsg({ type: 'error', text: 'Ambos costos de la canasta deben ser mayores que cero' })
      return
    }
    try {
      const res = await api.post('/external/fc/calculate-basket', {
        external_currency: fcForm.external_currency,
        basket_cost_external: fcForm.basket_cost_external,
        basket_cost_local_tq: fcForm.basket_cost_local_tq,
      })
      setFcPreview(res.factor)
      setFcMsg(null)
    } catch (e: any) {
      setFcMsg({ type: 'error', text: e.message || 'Error al calcular' })
    }
  }

  const saveFC = async () => {
    if (fcPreview === null || fcPreview <= 0) {
      setFcMsg({ type: 'error', text: 'Primero calcula el FC antes de guardar' })
      return
    }
    setFcSaving(true)
    try {
      await api.post('/external/fc/store-basket', {
        factor: fcPreview,
        external_currency: fcForm.external_currency,
        basket_cost_external: fcForm.basket_cost_external,
        basket_cost_local_tq: fcForm.basket_cost_local_tq,
      })
      setFcMsg({ type: 'success', text: 'FC guardado correctamente' })
      setShowFCForm(false)
      setFcPreview(null)
      load()
    } catch (e: any) {
      setFcMsg({ type: 'error', text: e.message || 'Error al guardar. Necesitas permisos de administrador.' })
    } finally {
      setFcSaving(false)
    }
  }

  const create = async () => {
    // El backend espera product_name; enviamos el nombre resuelto al seleccionar
    await api.post('/external/operations', {
      operation_type: form.operation_type,
      product_name: form.product_name,
      quantity: form.quantity,
      external_price_usd: form.external_price_usd,
      local_price_trueque: form.local_price_trueque,
      logistics_pct: form.logistics_pct,
      external_tax_rate: form.external_tax_rate,
    })
    setShowForm(false)
    setForm({ operation_type: 'import', product_id: '', product_name: '', quantity: 0, external_price_usd: 0, local_price_trueque: 0, logistics_pct: 0, external_tax_rate: 0 })
    load()
  }

  const approve = async (id: string) => { await api.post(`/external/operations/${id}/approve`, {}); load() }
  const reject = async (id: string) => { await api.post(`/external/operations/${id}/reject`, {}); load() }

  // Al seleccionar un producto, autocompletar el nombre y el precio local
  const onProductSelect = (productId: string) => {
    const product = products.find((p: any) => String(p.id) === String(productId))
    setForm((prev) => ({
      ...prev,
      product_id: productId,
      product_name: product?.name ?? '',
      local_price_trueque: product?.price_trueque ?? prev.local_price_trueque,
    }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Globe size={24} />Comercio Externo (DEX)</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
          {subTab === 'operations' && (
            <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={18} />Nueva Operacion</button>
          )}
        </div>
      </div>

      {/* Sub-pestanas */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        <button onClick={() => { setSubTab('summary'); setSearchParams({ tab: 'summary' }) }} className={`px-4 py-2 rounded-lg text-sm font-medium ${subTab === 'summary' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Resumen</button>
        <button onClick={() => { setSubTab('bank'); setSearchParams({ tab: 'bank' }) }} className={`px-4 py-2 rounded-lg text-sm font-medium ${subTab === 'bank' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Cuentas Bancarias</button>
        <button onClick={() => { setSubTab('purchases'); setSearchParams({ tab: 'purchases' }) }} className={`px-4 py-2 rounded-lg text-sm font-medium ${subTab === 'purchases' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Compras (Import)</button>
        <button onClick={() => { setSubTab('sales'); setSearchParams({ tab: 'sales' }) }} className={`px-4 py-2 rounded-lg text-sm font-medium ${subTab === 'sales' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Ventas (Export)</button>
        <button onClick={() => { setSubTab('operations'); setSearchParams({ tab: 'operations' }) }} className={`px-4 py-2 rounded-lg text-sm font-medium ${subTab === 'operations' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Operaciones</button>
        <button onClick={() => { setSubTab('fc'); setSearchParams({ tab: 'fc' }) }} className={`px-4 py-2 rounded-lg text-sm font-medium ${subTab === 'fc' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Factor de Conversion</button>
        <button onClick={() => { setSubTab('calculator'); setSearchParams({ tab: 'calculator' }) }} className={`px-4 py-2 rounded-lg text-sm font-medium ${subTab === 'calculator' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Calculadora de Precios</button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
          <p><strong>Comercio Exterior (DEX) - Como funciona</strong></p>
          <p><strong>Que es:</strong> El Comercio Exterior permite comprar productos de fuera de la red y vender productos al exterior. Es la unica parte del sistema que maneja dinero REAL (USD, EUR, COP, etc.).</p>
          <p><strong>Cuenta del DEX:</strong> El Comercio Exterior tiene su propia cuenta en {currency} (como una organizacion). La Asamblea le transfiere {currency} para que pueda comprar afuera. Para fondear el DEX, crea una propuesta de "Fondear Comercio Exterior" en la Asamblea.</p>
          <p><strong>Cuentas bancarias externas:</strong> El DEX tiene cuentas en bancos reales o en efectivo (caja). Cada cuenta tiene una moneda (USD, EUR, COP...) y un saldo. Cuando se compra afuera, se descuenta del banco. Cuando se vende afuera, se suma al banco.</p>
          <p><strong>Compras (Import):</strong> Se registra que producto se compro, cuanto, a que precio en moneda externa, y de que banco salio el dinero. El sistema calcula el precio interno sugerido usando el FC.</p>
          <p><strong>Ventas (Export):</strong> Se registra que producto se vendio, cuanto, a que precio, y a que banco entro el dinero.</p>
          <p><strong>Factor de Conversion (FC):</strong> Relacion entre la moneda externa y el {currency}. Se calcula comparando el costo de la canasta basica alla y aca. Despues de compras reales, el sistema sugiere un recalculo del FC basado en los precios reales pagados.</p>
          <p><strong>Junta Directiva:</strong> El DEX puede requerir multi-firma para aprobar compras/ventas (ej: 2 firmas). Se configura en la pestana Cuentas Bancarias.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {/* ===== RESUMEN ===== */}
      {subTab === 'summary' && summary && (
        <div className="space-y-4">
          <div className="card bg-blue-50">
            <h2 className="font-semibold flex items-center gap-2 mb-3"><Wallet size={18} />Resumen del Comercio Exterior</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Saldo TQ del DEX */}
              <div className="bg-white rounded-lg p-4 border">
                <p className="text-xs text-gray-500">Saldo en {currency} del DEX</p>
                <p className="text-2xl font-bold text-trueque-700">{(summary.dex_balance_tq || 0).toLocaleString()} {currency}</p>
                <p className="text-xs text-gray-400 mt-1">Dinero interno disponible para compras</p>
              </div>
              {/* FC actual */}
              <div className="bg-white rounded-lg p-4 border">
                <p className="text-xs text-gray-500">Factor de Conversion (FC)</p>
                <p className="text-2xl font-bold text-blue-700">1 {summary.fc_currency || 'USD'} = {summary.current_fc || 5} {currency}</p>
                <p className="text-xs text-gray-400 mt-1">Cambio actual moneda externa a {currency}</p>
              </div>
              {/* Operaciones */}
              <div className="bg-white rounded-lg p-4 border">
                <p className="text-xs text-gray-500">Operaciones</p>
                <div className="flex gap-4 mt-1">
                  <div>
                    <p className="text-sm font-bold text-amber-600">{summary.pending_purchases || 0}</p>
                    <p className="text-xs text-gray-400">Compras pend.</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-600">{summary.completed_purchases || 0}</p>
                    <p className="text-xs text-gray-400">Compras hechas</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-600">{summary.completed_sales || 0}</p>
                    <p className="text-xs text-gray-400">Ventas hechas</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Saldos bancarios por moneda */}
          <div className="card">
            <h3 className="font-medium mb-3 flex items-center gap-2"><Building2 size={16} />Saldos en Bancos Externos</h3>
            {summary.bank_balances && summary.bank_balances.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {summary.bank_balances.map((b: any, i: number) => (
                  <div key={i} className="border rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">{b.currency}</p>
                    <p className="text-xl font-bold text-green-700">{b.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {b.currency}</p>
                    <p className="text-xs text-gray-400">{b.accounts} cuenta(s)</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No hay cuentas bancarias configuradas. Ve a "Cuentas Bancarias" para agregar.</p>
            )}
          </div>

          {/* Recalculo de canasta sugerido */}
          {recalcs.length > 0 && (
            <div className="card border-amber-200">
              <h3 className="font-medium mb-3 flex items-center gap-2"><RefreshCw size={16} />Recalculo de Canasta Sugerido</h3>
              {recalcs.slice(0, 3).map((rc: any, i: number) => (
                <div key={i} className={`border rounded-lg p-3 mb-2 ${rc.is_approved ? 'bg-green-50' : 'bg-amber-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        Canasta real: <b>{rc.currency} {rc.basket_cost_external_real}</b> | Canasta local: <b>{rc.basket_cost_local_tq} {currency}</b>
                      </p>
                      <p className="text-sm">FC sugerido: <b className="text-blue-700">1 {rc.currency} = {rc.suggested_fc} {currency}</b>
                        {rc.previous_fc && <span className="text-gray-500"> (anterior: {rc.previous_fc})</span>}
                      </p>
                      {rc.notes && <p className="text-xs text-gray-500 mt-1">{rc.notes}</p>}
                    </div>
                    <div>
                      {rc.is_approved ? (
                        <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded">Aprobado</span>
                      ) : (
                        <button onClick={() => approveRecalc(rc.id)} className="btn-primary text-xs">Aprobar FC</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== CUENTAS BANCARIAS ===== */}
      {subTab === 'bank' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><Building2 size={18} />Cuentas Bancarias Externas</h2>
            <button onClick={() => setShowBankForm(!showBankForm)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />Nueva Cuenta</button>
          </div>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
            <p>El Comercio Exterior maneja dinero <strong>real</strong> (USD, EUR, COP, etc.). Cada cuenta puede ser:</p>
            <ul className="list-disc list-inside ml-2 mt-1">
              <li><strong>Cuenta bancaria:</strong> dinero en un banco real. Registrar nombre del banco y numero de cuenta.</li>
              <li><strong>Efectivo en caja:</strong> dinero fisico guardado en la caja fuerte. No tiene banco ni numero.</li>
            </ul>
            <p className="mt-1">Cada vez que se aprueba una compra o venta, el saldo se actualiza automaticamente.</p>
          </div>

          {showBankForm && (
            <div className="card space-y-3">
              <h3 className="font-medium">Nueva Cuenta Bancaria</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nombre descriptivo</label>
                  <input className="input" placeholder="Ej: Banco Nacional USD" value={bankForm.account_name} onChange={(e) => setBankForm({ ...bankForm, account_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Moneda</label>
                  <select className="input" value={bankForm.currency} onChange={(e) => setBankForm({ ...bankForm, currency: e.target.value })}>
                    {EXTERNAL_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Banco (dejar vacio si es efectivo)</label>
                  <input className="input" placeholder="Ej: Banco Nacional" value={bankForm.bank_name} onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Numero de cuenta (dejar vacio si es efectivo)</label>
                  <input className="input" placeholder="Ej: 1234-5678-90" value={bankForm.account_number} onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })} />
                </div>
                <div>
                  <label className="label">Saldo inicial</label>
                  <input type="number" className="input" placeholder="0" value={bankForm.balance} onChange={(e) => setBankForm({ ...bankForm, balance: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="is_cash" checked={bankForm.is_cash} onChange={(e) => setBankForm({ ...bankForm, is_cash: e.target.checked })} />
                  <label htmlFor="is_cash" className="text-sm">Efectivo en caja (no es cuenta bancaria)</label>
                </div>
              </div>
              <button onClick={createBankAccount} className="btn-primary">Crear Cuenta</button>
            </div>
          )}

          {bankAccounts.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">
              No hay cuentas bancarias configuradas.
              <br />
              <span className="text-sm">Crea una cuenta para empezar a registrar compras y ventas externas.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {bankAccounts.map((ba: any, i: number) => (
                <div key={i} className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {ba.is_cash ? <Wallet size={16} /> : <Building2 size={16} />}
                        {ba.account_name}
                      </p>
                      {ba.bank_name && <p className="text-xs text-gray-500">{ba.bank_name} - {ba.account_number}</p>}
                    </div>
                    <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded">{ba.currency}</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700 mt-2">{ba.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {ba.currency}</p>
                  <p className="text-xs text-gray-400">{ba.is_cash ? 'Efectivo en caja' : 'Cuenta bancaria'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== COMPRAS (IMPORT) ===== */}
      {subTab === 'purchases' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><TrendingDown size={18} />Compras Externas (Import)</h2>
            <button onClick={() => setShowPurchaseForm(!showPurchaseForm)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />Nueva Compra</button>
          </div>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
            <p><strong>Como funciona:</strong> Cuando compras productos afuera, registras que compraste, cuanto, a que precio en moneda externa, y de que banco salio el dinero.</p>
            <p className="mt-1">El sistema calcula automaticamente el <strong>precio interno sugerido</strong> usando el FC: <code>precio_interno = precio_externo x FC</code>. Esto te dice a cuanto puedes vender el producto internamente.</p>
          </div>

          {showPurchaseForm && (
            <div className="card space-y-3">
              <h3 className="font-medium">Registrar Nueva Compra</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Producto</label>
                  <input className="input" placeholder="Ej: Harina de trigo" value={purchaseForm.product_name} onChange={(e) => setPurchaseForm({ ...purchaseForm, product_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Cantidad</label>
                  <input type="number" className="input" placeholder="Ej: 100" value={purchaseForm.quantity} onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">Unidad</label>
                  <input className="input" placeholder="kg, litros, unidades..." value={purchaseForm.unit} onChange={(e) => setPurchaseForm({ ...purchaseForm, unit: e.target.value })} />
                </div>
                <div>
                  <label className="label">Precio unitario externo</label>
                  <input type="number" className="input" placeholder="Ej: 0.80" value={purchaseForm.unit_cost_external} onChange={(e) => setPurchaseForm({ ...purchaseForm, unit_cost_external: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">Moneda</label>
                  <select className="input" value={purchaseForm.currency} onChange={(e) => setPurchaseForm({ ...purchaseForm, currency: e.target.value })}>
                    {EXTERNAL_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Cuenta bancaria (de donde sale)</label>
                  <select className="input" value={purchaseForm.bank_account_id} onChange={(e) => setPurchaseForm({ ...purchaseForm, bank_account_id: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {bankAccounts.filter((ba: any) => ba.currency === purchaseForm.currency).map((ba: any) => (
                      <option key={ba.id} value={ba.id}>{ba.account_name} ({ba.balance} {ba.currency})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Proveedor</label>
                  <input className="input" placeholder="Ej: Distribuidora Andina" value={purchaseForm.supplier} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })} />
                </div>
                <div>
                  <label className="label">Numero de factura</label>
                  <input className="input" placeholder="Opcional" value={purchaseForm.invoice_number} onChange={(e) => setPurchaseForm({ ...purchaseForm, invoice_number: e.target.value })} />
                </div>
              </div>
              <button onClick={createPurchase} className="btn-primary">Registrar Compra</button>
            </div>
          )}

          {purchases.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">No hay compras registradas.</div>
          ) : (
            <div className="space-y-2">
              {purchases.map((p: any, i: number) => (
                <div key={i} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="font-medium">{p.product_name}</span>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2 text-sm">
                        <div><span className="text-gray-500">Cant:</span> <b>{p.quantity} {p.unit}</b></div>
                        <div><span className="text-gray-500">Costo ext:</span> <b>{p.currency} {p.unit_cost_external}</b></div>
                        <div><span className="text-gray-500">Total ext:</span> <b>{p.currency} {p.total_external}</b></div>
                        <div><span className="text-gray-500">Total {currency}:</span> <b className="text-trueque-700">{p.total_local_tq} {currency}</b></div>
                        <div><span className="text-gray-500">Precio sug.:</span> <b className="text-amber-600">{p.suggested_internal_price} {currency}/{p.unit}</b></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {p.supplier && `Proveedor: ${p.supplier} | `}
                        {p.bank_account_name && `Banco: ${p.bank_account_name} | `}
                        Fecha: {String(p.purchase_date).slice(0, 10)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${p.status === 'completed' ? 'bg-green-100 text-green-700' : p.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {p.status === 'completed' ? 'Completado' : p.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                      </span>
                      {p.status === 'pending' && (
                        <button onClick={() => approvePurchase(p.id)} className="btn-secondary flex items-center gap-1 text-sm"><Check size={14} /> Aprobar</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== VENTAS (EXPORT) ===== */}
      {subTab === 'sales' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><TrendingUp size={18} />Ventas Externas (Export)</h2>
            <button onClick={() => setShowSaleForm(!showSaleForm)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />Nueva Venta</button>
          </div>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
            <p><strong>Como funciona:</strong> Cuando vendes productos al exterior, registras que vendiste, cuanto, a que precio en moneda externa, y a que banco entro el dinero.</p>
            <p className="mt-1">El dinero recibido se suma automaticamente al saldo del banco seleccionado al aprobar la venta.</p>
          </div>

          {showSaleForm && (
            <div className="card space-y-3">
              <h3 className="font-medium">Registrar Nueva Venta</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Producto</label>
                  <input className="input" placeholder="Ej: Cafe organico" value={saleForm.product_name} onChange={(e) => setSaleForm({ ...saleForm, product_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Cantidad</label>
                  <input type="number" className="input" placeholder="Ej: 20" value={saleForm.quantity} onChange={(e) => setSaleForm({ ...saleForm, quantity: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">Unidad</label>
                  <input className="input" placeholder="kg, litros..." value={saleForm.unit} onChange={(e) => setSaleForm({ ...saleForm, unit: e.target.value })} />
                </div>
                <div>
                  <label className="label">Precio unitario externo</label>
                  <input type="number" className="input" placeholder="Ej: 8.00" value={saleForm.unit_price_external} onChange={(e) => setSaleForm({ ...saleForm, unit_price_external: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">Moneda</label>
                  <select className="input" value={saleForm.currency} onChange={(e) => setSaleForm({ ...saleForm, currency: e.target.value })}>
                    {EXTERNAL_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Cuenta bancaria (a donde entra)</label>
                  <select className="input" value={saleForm.bank_account_id} onChange={(e) => setSaleForm({ ...saleForm, bank_account_id: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {bankAccounts.filter((ba: any) => ba.currency === saleForm.currency).map((ba: any) => (
                      <option key={ba.id} value={ba.id}>{ba.account_name} ({ba.balance} {ba.currency})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Comprador</label>
                  <input className="input" placeholder="Ej: Cooperativa de Exportacion" value={saleForm.buyer} onChange={(e) => setSaleForm({ ...saleForm, buyer: e.target.value })} />
                </div>
              </div>
              <button onClick={createSale} className="btn-primary">Registrar Venta</button>
            </div>
          )}

          {sales.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">No hay ventas registradas.</div>
          ) : (
            <div className="space-y-2">
              {sales.map((s: any, i: number) => (
                <div key={i} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="font-medium">{s.product_name}</span>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm">
                        <div><span className="text-gray-500">Cant:</span> <b>{s.quantity} {s.unit}</b></div>
                        <div><span className="text-gray-500">Precio ext:</span> <b>{s.currency} {s.unit_price_external}</b></div>
                        <div><span className="text-gray-500">Total ext:</span> <b>{s.currency} {s.total_external}</b></div>
                        <div><span className="text-gray-500">Total {currency}:</span> <b className="text-trueque-700">{s.total_local_tq} {currency}</b></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {s.buyer && `Comprador: ${s.buyer} | `}
                        {s.bank_account_name && `Banco: ${s.bank_account_name} | `}
                        Fecha: {String(s.sale_date).slice(0, 10)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${s.status === 'completed' ? 'bg-green-100 text-green-700' : s.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {s.status === 'completed' ? 'Completado' : s.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                      </span>
                      {s.status === 'pending' && (
                        <button onClick={() => approveSale(s.id)} className="btn-secondary flex items-center gap-1 text-sm"><Check size={14} /> Aprobar</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'fc' && fc && (
        <div className="card bg-blue-50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="font-semibold">Factor de Conversion Actual (FC)</h2>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                1 {fc.external_currency || 'USD'} = {fc.factor} {currency}
              </p>
              {fc.basket_cost_external > 0 && fc.basket_cost_local_tq > 0 ? (
                <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                  <div><span className="text-gray-500">Canasta en {fc.external_currency}:</span> <b>{getCurrencySymbol(fc.external_currency)}{fc.basket_cost_external}</b></div>
                  <div><span className="text-gray-500">Canasta en {currency}:</span> <b>{fc.basket_cost_local_tq} {currency}</b></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                  <div><span className="text-gray-500">CPI externo:</span> <b>{fc.external_cpi}</b></div>
                  <div><span className="text-gray-500">Costo energia local:</span> <b>{fc.local_energy_cost} kWh</b></div>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                El FC indica cuantos {currency} equivale 1 {fc.external_currency || 'USD'}, basado en el costo de la canasta basica.
              </p>
              {fc.is_default && (
                <p className="text-xs text-amber-600 mt-1 font-medium">Valor por defecto - presiona "Editar FC" para configurar el real de tu comunidad</p>
              )}
            </div>
            {!showFCForm && (
              <button onClick={() => setShowFCForm(true)} className="btn-secondary flex items-center gap-1 text-sm">
                <Edit3 size={16} /> Editar FC
              </button>
            )}
          </div>

          {showFCForm && (
            <div className="mt-4 pt-4 border-t border-blue-200 space-y-3">
              <h3 className="font-medium text-sm flex items-center gap-1"><Calculator size={16} /> Calcular FC desde Canasta Basica</h3>
              <p className="text-xs text-gray-500">
                Compara el costo de la <strong>misma canasta basica</strong> (alimentos basicos, servicios esenciales)
                en la moneda externa y en {currency}. El sistema calcula automaticamente el FC.
                No necesitas hacer calculos: solo ingresa los dos precios.
              </p>

              <div className="space-y-3">
                {/* Paso 1: Elegir moneda */}
                <div>
                  <label className="label">1. Moneda externa de referencia</label>
                  <select
                    className="input"
                    value={fcForm.external_currency}
                    onChange={(e) => { setFcForm({ ...fcForm, external_currency: e.target.value }); setFcPreview(null) }}
                  >
                    {EXTERNAL_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.code} - {c.name} ({c.symbol})</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Elige la moneda del pais con el que vas a comerciar. Ej: USD para dolares, COP para pesos colombianos.
                  </p>
                </div>

                {/* Paso 2: Costo canasta externa */}
                <div>
                  <label className="label">
                    2. Costo de la canasta basica alla (en {fcForm.external_currency})
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-medium">{getCurrencySymbol(fcForm.external_currency)}</span>
                    <input
                      type="number"
                      className="input flex-1"
                      placeholder="Ej: 300"
                      value={fcForm.basket_cost_external || ''}
                      onChange={(e) => { setFcForm({ ...fcForm, basket_cost_external: parseFloat(e.target.value) || 0 }); setFcPreview(null) }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Cuanto cuesta una canasta basica de alimentos alla en su moneda.
                    Ej: si alla cuesta 300 {fcForm.external_currency}, escribe 300.
                    Puedes buscar "canasta basica {getCurrencyName(fcForm.external_currency)}" en internet.
                  </p>
                </div>

                {/* Paso 3: Costo canasta local - SOLO LECTURA, viene de la federacion */}
                <div>
                  <label className="label">
                    3. Canasta basica interna (en {currency}) - <span className="text-blue-600">valor federado</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="input flex-1 bg-gray-100"
                      value={fcForm.basket_cost_local_tq || 500}
                      readOnly
                    />
                    <span className="text-gray-500 font-medium">{currency}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    <strong>Este valor no se puede editar.</strong> Es el mismo en todos los nodos de la federacion.
                    Solo se puede cambiar mediante una propuesta federada aprobada por consenso.
                    Ve a "Federacion" para proponer o votar cambios.
                  </p>
                </div>
              </div>

              {/* Ejemplo visual */}
              <div className="text-xs bg-white p-3 rounded border border-blue-100">
                <p className="font-medium text-gray-600 mb-1">Ejemplo de como funciona:</p>
                <p>Si alla la canasta cuesta <b>300 {fcForm.external_currency}</b> y aca cuesta <b>{fcForm.basket_cost_local_tq || 500} {currency}</b>:</p>
                <p className="mt-1">FC = {fcForm.basket_cost_local_tq || 500} / 300 = <b className="text-blue-700">{((fcForm.basket_cost_local_tq || 500) / 300).toFixed(2)} {currency}</b> por cada <b>1 {fcForm.external_currency}</b></p>
                <p className="mt-1 text-gray-400">Esto significa que 1 {fcForm.external_currency} tiene el mismo poder adquisitivo que {((fcForm.basket_cost_local_tq || 500) / 300).toFixed(2)} {currency}.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={calculateFC} className="btn-secondary flex items-center gap-1 text-sm">
                  <Calculator size={16} /> Calcular FC
                </button>
                {fcPreview !== null && (
                  <>
                    <span className="text-sm text-gray-600">
                      Nuevo FC: <b className="text-blue-700">1 {fcForm.external_currency} = {fcPreview.toFixed(2)} {currency}</b>
                    </span>
                    <button onClick={saveFC} disabled={fcSaving} className="btn-primary flex items-center gap-1 text-sm">
                      <Save size={16} /> {fcSaving ? 'Guardando...' : 'Guardar FC'}
                    </button>
                  </>
                )}
                <button onClick={() => { setShowFCForm(false); setFcPreview(null); setFcMsg(null) }} className="text-gray-500 text-sm">
                  Cancelar
                </button>
              </div>

              {fcMsg && (
                <div className={`text-sm p-2 rounded ${fcMsg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {fcMsg.text}
                </div>
              )}

              <div className="text-xs text-gray-400 bg-white p-3 rounded border border-gray-100">
                <p className="font-medium text-gray-600 mb-1">Sobre el FC:</p>
                <p>El FC es una <strong>referencia contable</strong>, no una tasa de cambio especulativa.
                Lo decide la asamblea basandose en el costo de vida real.</p>
                <p className="mt-1"><strong>Cuando actualizarlo:</strong> cuando cambien significativamente los precios
                alla o aca. No sube ni baja solo - lo actualiza un administrador cuando lo considera necesario.</p>
                <p className="mt-1"><strong>Por que no es especulativo:</strong> el {currency} no es una moneda financiera.
                Es una unidad contable comunitaria. El FC solo sirve para saber cuanto vale algo del exterior en terminos locales.</p>
                <p className="mt-1"><strong>Quien puede actualizarlo:</strong> Lo decide la Asamblea en la
                pestana <em>Configuracion</em>. Puede ser: un administrador, la junta directiva,
                una persona autorizada, o solo por votacion de asamblea. En paises con economia
                inestable (ej: Venezuela), conviene asignar una persona que actualice frecuentemente.
                En paises estables, puede decidirse por asamblea.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'operations' && showForm && (
        <div className="card space-y-4">
          <h2 className="font-semibold">Nueva Operacion de Comercio Externo</h2>

          <div>
            <label className="label">Tipo de operacion</label>
            <select className="input" value={form.operation_type} onChange={(e) => setForm({ ...form, operation_type: e.target.value })}>
              <option value="import">Importacion (comprar de fuera)</option>
              <option value="export">Exportacion (vender afuera)</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Define el sentido de la operacion. Ej: Importacion para traer harina de otra red.
            </p>
            {form.operation_type === 'import' ? (
              <p className="text-xs text-blue-600 mt-1">
                <strong>Importacion:</strong> Comprar productos de fuera de la red. Pagas en moneda local ({currency}), el vendedor recibe en su moneda.
              </p>
            ) : (
              <p className="text-xs text-blue-600 mt-1">
                <strong>Exportacion:</strong> Vender productos al exterior. Recibes moneda local ({currency}), el comprador paga en su moneda.
              </p>
            )}
          </div>

          <EntitySelector
            label="Producto"
            helpText="Selecciona un producto existente en el catalogo. Busca por nombre o descripcion. Ej: Harina de trigo, Energia solar."
            placeholder="Ej: Harina de trigo, Energia solar..."
            value={form.product_id}
            onChange={onProductSelect}
            endpoint="/products"
            valueKey="id"
            labelKey="name"
            subLabelKey="description"
            emptyMessage="No se encontraron productos"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cantidad</label>
              <input
                type="number"
                className="input"
                placeholder="Ej: 100"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-gray-400 mt-1">
                Unidades del producto a comerciar. Ej: 100 (kg, litros, kWh, segun la unidad del producto).
              </p>
            </div>
            <div>
              <label className="label">Precio externo (USD)</label>
              <input
                type="number"
                className="input"
                placeholder="Ej: 2.50"
                value={form.external_price_usd}
                onChange={(e) => setForm({ ...form, external_price_usd: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-gray-400 mt-1">
                Precio en dolares por unidad del producto en el mercado externo. Ej: 2.50 USD por kg de harina.
              </p>
            </div>
            <div>
              <label className="label">Precio local ({currency})</label>
              <input
                type="number"
                className="input"
                placeholder="Ej: 150"
                value={form.local_price_trueque}
                onChange={(e) => setForm({ ...form, local_price_trueque: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-gray-400 mt-1">
                Precio en moneda local ({currency}) por unidad. Se autocompleta al seleccionar un producto. Ej: 150 {currency} por kg.
              </p>
            </div>
            <div>
              <label className="label">Logistica (%)</label>
              <input
                type="number"
                className="input"
                placeholder="Ej: 15"
                value={form.logistics_pct}
                onChange={(e) => setForm({ ...form, logistics_pct: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-gray-400 mt-1">
                Porcentaje adicional por transporte, aduana y tramites. Tipico: 10-30%. Ej: 15 (%).
              </p>
            </div>
            <div>
              <label className="label">Impuesto externo (%)</label>
              <input
                type="number"
                className="input"
                placeholder="Ej: 5"
                value={form.external_tax_rate}
                onChange={(e) => setForm({ ...form, external_tax_rate: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-gray-400 mt-1">
                Arancel o impuesto del pais externo. Tipico: 0-20%. Ej: 5 (%).
              </p>
            </div>
          </div>

          <button onClick={create} className="btn-primary">Crear Operacion</button>
        </div>
      )}

      {subTab === 'operations' && (
      <div className="space-y-2">
        {ops.length === 0 && !showForm ? (
          <div className="card text-center text-gray-500 py-8">
            No hay operaciones de comercio externo.
            <br />
            <span className="text-sm">Crea una nueva operacion con el boton de arriba.</span>
          </div>
        ) : ops.map((op, i) => {
          const totalTQ = op.internal_value ?? op.total_trueque ?? 0
          const fcUsed = op.fc_applied ?? op.fc_used ?? 0
          const usdTotal = op.external_value_usd ?? 0
          return (
          <div key={i} className="card">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <span className="font-medium">
                  {op.operation_type === 'import' ? 'Importacion' : 'Exportacion'}: {op.product_name}
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 text-sm">
                  <div>
                    <span className="text-gray-500">Cantidad:</span> <b>{op.quantity}</b>
                  </div>
                  <div>
                    <span className="text-gray-500">Total USD:</span> <b>${usdTotal.toFixed(2)}</b>
                  </div>
                  <div>
                    <span className="text-gray-500">Total {currency}:</span> <b className="text-trueque-700">{totalTQ} {currency}</b>
                  </div>
                  <div>
                    <span className="text-gray-500">FC usado:</span> <b>{fcUsed.toFixed(2)}</b>
                  </div>
                </div>
                {op.buyer_seller && (
                  <p className="text-xs text-gray-500 mt-1">Solicitado por: {op.buyer_seller}</p>
                )}
                {op.completed_at && (
                  <p className="text-xs text-gray-500">Completado: {String(op.completed_at).slice(0, 19)}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${op.status === 'approved' ? 'bg-trueque-100 text-trueque-700' : op.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {op.status === 'approved' ? 'Aprobado' : op.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                </span>
                {op.status === 'pending' && (
                  <>
                    <button onClick={() => approve(op.id)} className="btn-secondary flex items-center gap-1"><Check size={16} /></button>
                    <button onClick={() => reject(op.id)} className="btn-secondary flex items-center gap-1"><X size={16} /></button>
                  </>
                )}
              </div>
            </div>
          </div>
          )
        })}
      </div>
      )}

      {/* ===== CALCULADORA DE PRECIOS ===== */}
      {subTab === 'calculator' && (
        <div className="space-y-4">
          <div className="card p-4 bg-blue-50 border-blue-200">
            <h3 className="font-semibold flex items-center gap-2 mb-2"><Calculator size={18} /> Calculadora de Precios Externos</h3>
            <p className="text-sm text-gray-600">
              Esta tabla muestra el precio de cada producto del nodo convertido a la moneda externa
              usando el FC actual. Es <strong>informativo</strong>: te ayuda a comparar si el FC
              calculado desde la canasta basica esta cerca del precio real externo.
            </p>
            {fc && (
              <p className="text-sm mt-2">
                FC actual: <strong>1 {fc.external_currency || 'USD'} = {fc.factor} {currency}</strong>
                <span className="text-gray-500 text-xs ml-2">
                  (precio externo = precio {currency} / FC)
                </span>
              </p>
            )}
          </div>

          {/* Buscador */}
          <input
            className="input"
            placeholder="Buscar producto por nombre..."
            value={calcSearch}
            onChange={(e) => setCalcSearch(e.target.value)}
          />

          {/* Tabla de productos */}
          {products.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">No hay productos cargados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 px-3">Producto</th>
                    <th className="py-2 px-3 text-right">Precio ({currency})</th>
                    <th className="py-2 px-3 text-right">Base mundial</th>
                    <th className="py-2 px-3 text-right">Precio externo ({fc?.external_currency || 'USD'})</th>
                    <th className="py-2 px-3">Categoria</th>
                  </tr>
                </thead>
                <tbody>
                  {products
                    .filter((p: any) => {
                      if (!calcSearch) return true
                      const name = (p.name || p.title || '').toLowerCase()
                      return name.includes(calcSearch.toLowerCase())
                    })
                    .map((p: any) => {
                      const priceTQ = p.price_tq || p.price || 0
                      const factor = fc?.factor || 1
                      const priceExternal = factor > 0 ? (priceTQ / factor) : 0
                      return (
                        <tr key={p.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3">
                            <button
                              onClick={() => setSelectedProduct(p)}
                              className="text-left flex items-center gap-1.5 hover:text-trueque-600 hover:underline"
                            >
                              <Info size={14} className="text-gray-400" />
                              {p.name || p.title}
                            </button>
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {priceTQ.toLocaleString()}
                            <div className="text-xs text-gray-400">{p.unit || ''}</div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-xs">
                            {(p.base_price || 0) > 0
                              ? `${p.base_price}/${p.base_unit || 'kg'}`
                              : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {priceExternal > 0 ? priceExternal.toFixed(2) : '-'}
                          </td>
                          <td className="py-2 px-3 text-gray-500 text-xs">{p.category || p.type || '-'}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}

          <div className="card p-3 bg-gray-50 text-xs text-gray-500">
            <p>
              <strong>Como usar esta tabla:</strong> Compara el "Precio externo" con lo que realmente
              cuesta ese producto en el pais externo. Si los precios estan cerca, el FC esta bien
              calibrado. Si estan muy diferentes, considera recalcular el FC desde la canasta basica.
            </p>
          </div>
        </div>
      )}

      {/* ===== MODAL: Detalles del producto ===== */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedProduct(null)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full space-y-3 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Package size={20} className="text-trueque-600" />
                <h3 className="font-bold text-lg">{selectedProduct.name || selectedProduct.title}</h3>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {selectedProduct.badge && (
              <span className="inline-block bg-trueque-100 text-trueque-700 text-xs px-2 py-0.5 rounded-full">
                {selectedProduct.badge}
              </span>
            )}

            {selectedProduct.description && (
              <p className="text-sm text-gray-700">{selectedProduct.description}</p>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-xs text-gray-500">Precio</div>
                <div className="font-mono font-medium">{(selectedProduct.price_tq || selectedProduct.price || 0).toLocaleString()} {currency}</div>
                <div className="text-xs text-gray-500">por {selectedProduct.unit || 'unidad'}</div>
              </div>
              <div className="bg-blue-50 p-2 rounded">
                <div className="text-xs text-gray-500">Precio base (base de datos mundial)</div>
                <div className="font-mono font-medium">
                  {(selectedProduct.base_price || 0) > 0
                    ? `${selectedProduct.base_price} ${currency}/${selectedProduct.base_unit || 'kg'}`
                    : 'N/A'}
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-xs text-gray-500">Peso/cantidad del producto</div>
                <div className="font-mono font-medium">
                  {(selectedProduct.weight_kg || 0) > 0
                    ? `${selectedProduct.weight_kg} ${selectedProduct.base_unit === 'L' ? 'L' : 'kg'}`
                    : '-'}
                </div>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <div className="text-xs text-gray-500">Precio externo</div>
                <div className="font-mono font-medium">
                  {fc && fc.factor > 0
                    ? ((selectedProduct.price_tq || selectedProduct.price || 0) / fc.factor).toFixed(2)
                    : '-'} {fc?.external_currency || 'USD'}
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-xs text-gray-500">Categoria</div>
                <div className="font-medium">{selectedProduct.category || selectedProduct.type || '-'}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-xs text-gray-500">Subcategoria</div>
                <div className="font-medium">{selectedProduct.subcategory || '-'}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-xs text-gray-500">Categoria padre</div>
                <div className="font-medium">{selectedProduct.parent_category || '-'}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-xs text-gray-500">Origen</div>
                <div className="font-medium">{selectedProduct.origin || '-'}</div>
              </div>
              {selectedProduct.product_code && (
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-xs text-gray-500">Codigo de producto</div>
                  <div className="font-mono font-medium text-xs">{selectedProduct.product_code}</div>
                </div>
              )}
              {fc && (
                <div className="bg-blue-50 p-2 rounded">
                  <div className="text-xs text-gray-500">Precio externo</div>
                  <div className="font-mono font-medium">
                    {fc.factor > 0
                      ? ((selectedProduct.price_tq || selectedProduct.price || 0) / fc.factor).toFixed(2)
                      : '-'} {fc.external_currency || 'USD'}
                  </div>
                </div>
              )}
            </div>

            {selectedProduct.image_url && (
              <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full max-h-48 object-contain rounded-lg border" />
            )}

            {/* Calculo explicado */}
            {(selectedProduct.base_price || 0) > 0 && (selectedProduct.weight_kg || 0) > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm">
                <div className="font-semibold text-amber-800 mb-1">¿Cómo se calcula el precio?</div>
                <div className="text-amber-700 font-mono text-xs">
                  {selectedProduct.price_calculation || `${selectedProduct.base_price} ${currency}/${selectedProduct.base_unit || 'kg'} × ${selectedProduct.weight_kg} ${selectedProduct.base_unit === 'L' ? 'L' : 'kg'} = ${(selectedProduct.base_price * selectedProduct.weight_kg).toFixed(2)} ${currency}`}
                </div>
                <div className="text-xs text-amber-600 mt-1">
                  El precio base de <strong>{selectedProduct.base_price} {currency}/{selectedProduct.base_unit || 'kg'}</strong> viene de la base de datos mundial
                  (Agribalyse, FAO, Pimentel). Este producto pesa <strong>{selectedProduct.weight_kg} {selectedProduct.base_unit === 'L' ? 'litros' : 'kg'}</strong>,
                  por eso el precio es <strong>{(selectedProduct.price_tq || selectedProduct.price || 0).toLocaleString()} {currency}</strong>.
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500 pt-2 border-t">
              El precio es por unidad de: <strong>{selectedProduct.unit || 'no especificada'}</strong>.
              {selectedProduct.base_price > 0 && selectedProduct.weight_kg > 0 && ` Este producto contiene ${selectedProduct.weight_kg} ${selectedProduct.base_unit === 'L' ? 'litros' : 'kilos'} aproximadamente.`}
            </div>

            <button onClick={() => setSelectedProduct(null)} className="w-full px-4 py-2 bg-gray-200 rounded-lg text-sm">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
