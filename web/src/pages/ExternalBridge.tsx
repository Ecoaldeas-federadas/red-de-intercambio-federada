import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Plus, Check, X, HelpCircle, Globe, Calculator, Save, Edit3, Info, Package, Building2, Wallet, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { EntitySelector } from '../components/EntitySelector'
import { toCents, fmtNumber } from '../lib/format'

export default function ExternalBridge() {
  const { t } = useTranslation(['external', 'common'])
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
  const [bankForm, setBankForm] = useState({ account_name: '', bank_name: '', account_number: '', currency: 'USD', balance: 0, is_cash: false, account_type: 'corriente', country: '' })
  const [editingBankId, setEditingBankId] = useState<string | null>(null)
  const [viewingMovements, setViewingMovements] = useState<string | null>(null)
  const [movements, setMovements] = useState<any[]>([])
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
      if (editingBankId) {
        await api.put(`/external/bank-accounts/${editingBankId}`, bankForm)
      } else {
        await api.post('/external/bank-accounts', bankForm)
      }
      setShowBankForm(false)
      setEditingBankId(null)
      setBankForm({ account_name: '', bank_name: '', account_number: '', currency: 'USD', balance: 0, is_cash: false, account_type: 'corriente', country: '' })
      load()
    } catch (e: any) {
      alert(e.message || t('error_save_bank', 'Error al guardar cuenta bancaria'))
    }
  }

  const editBankAccount = (ba: any) => {
    setEditingBankId(ba.id)
    setBankForm({
      account_name: ba.account_name || '',
      bank_name: ba.bank_name || '',
      account_number: ba.account_number || '',
      currency: ba.currency || 'USD',
      balance: ba.balance || 0,
      is_cash: ba.is_cash || false,
      account_type: ba.account_type || 'corriente',
      country: ba.country || '',
    })
    setShowBankForm(true)
  }

  const deleteBankAccount = async (id: string) => {
    if (!confirm(t('delete_account_confirm', '¿Eliminar esta cuenta? Se desactivara pero no se borrara el historial.'))) return
    try {
      await api.delete(`/external/bank-accounts/${id}`)
      load()
    } catch (e: any) {
      alert(e.message || t('error_delete_account', 'Error al eliminar cuenta'))
    }
  }

  const viewMovements = async (id: string) => {
    if (viewingMovements === id) {
      setViewingMovements(null)
      return
    }
    setViewingMovements(id)
    try {
      const d = await api.get<any[]>(`/external/bank-accounts/${id}/movements`)
      setMovements(Array.isArray(d) ? d : [])
    } catch {
      setMovements([])
    }
  }

  const createPurchase = async () => {
    try {
      await api.post('/external/purchases', purchaseForm)
      setShowPurchaseForm(false)
      setPurchaseForm({ product_name: '', quantity: 0, unit: 'kg', unit_cost_external: 0, currency: 'USD', bank_account_id: '', supplier: '', invoice_number: '', notes: '' })
      load()
    } catch (e: any) {
      alert(e.message || t('error_register_purchase', 'Error al registrar compra'))
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
      alert(e.message || t('error_register_sale', 'Error al registrar venta'))
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
      setFcMsg({ type: 'error', text: t('error_both_costs_positive', 'Ambos costos de la canasta deben ser mayores que cero') })
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
      setFcMsg({ type: 'error', text: e.message || t('error_calculate', 'Error al calcular') })
    }
  }

  const saveFC = async () => {
    if (fcPreview === null || fcPreview <= 0) {
      setFcMsg({ type: 'error', text: t('error_calculate_first', 'Primero calcula el FC antes de guardar') })
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
      setFcMsg({ type: 'success', text: t('success_fc_saved', 'FC guardado correctamente') })
      setShowFCForm(false)
      setFcPreview(null)
      load()
    } catch (e: any) {
      setFcMsg({ type: 'error', text: e.message || t('error_save_fc', 'Error al guardar. Necesitas permisos de administrador.') })
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
        <h1 className="text-2xl font-bold flex items-center gap-2"><Globe size={24} />{t('title', 'Comercio Externo (DEX)')}</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
          {subTab === 'operations' && (
            <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={18} />{t('new_operation', 'Nueva Operacion')}</button>
          )}
        </div>
      </div>

      {/* Sub-pestanas */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        <button onClick={() => { setSubTab('summary'); setSearchParams({ tab: 'summary' }) }} className={`px-4 py-2 rounded-lg text-sm font-medium ${subTab === 'summary' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('tab_summary', 'Resumen')}</button>
        <button onClick={() => { setSubTab('bank'); setSearchParams({ tab: 'bank' }) }} className={`px-4 py-2 rounded-lg text-sm font-medium ${subTab === 'bank' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('tab_bank', 'Cuentas Bancarias')}</button>
        <button onClick={() => { setSubTab('purchases'); setSearchParams({ tab: 'purchases' }) }} className={`px-4 py-2 rounded-lg text-sm font-medium ${subTab === 'purchases' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('tab_purchases', 'Compras (Import)')}</button>
        <button onClick={() => { setSubTab('sales'); setSearchParams({ tab: 'sales' }) }} className={`px-4 py-2 rounded-lg text-sm font-medium ${subTab === 'sales' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('tab_sales', 'Ventas (Export)')}</button>
        <button onClick={() => { setSubTab('operations'); setSearchParams({ tab: 'operations' }) }} className={`px-4 py-2 rounded-lg text-sm font-medium ${subTab === 'operations' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('tab_operations', 'Operaciones')}</button>
        <button onClick={() => { setSubTab('fc'); setSearchParams({ tab: 'fc' }) }} className={`px-4 py-2 rounded-lg text-sm font-medium ${subTab === 'fc' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('tab_fc', 'Factor de Conversion')}</button>
        <button onClick={() => { setSubTab('calculator'); setSearchParams({ tab: 'calculator' }) }} className={`px-4 py-2 rounded-lg text-sm font-medium ${subTab === 'calculator' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('tab_calculator', 'Calculadora de Precios')}</button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
          <p><strong>{t('help_title', 'Comercio Exterior (DEX) - Como funciona')}</strong></p>
          <p><strong>{t('help_what_label', 'Que es:')}</strong> {t('help_what', 'El Comercio Exterior permite comprar productos de fuera de la red y vender productos al exterior. Es la unica parte del sistema que maneja dinero REAL (USD, EUR, COP, etc.).')}</p>
          <p><strong>{t('help_account_label', 'Cuenta del DEX:')}</strong> {t('help_account', 'El Comercio Exterior tiene su propia cuenta en TQ (como una organizacion). La Asamblea le transfiere TQ para que pueda comprar afuera. Para fondear el DEX, crea una propuesta de Fondear Comercio Exterior en la Asamblea.', { currency })}</p>
          <p><strong>{t('help_banks_label', 'Cuentas bancarias externas:')}</strong> {t('help_banks', 'El DEX tiene cuentas en bancos reales o en efectivo (caja). Cada cuenta tiene una moneda (USD, EUR, COP...) y un saldo. Cuando se compra afuera, se descuenta del banco. Cuando se vende afuera, se suma al banco.')}</p>
          <p><strong>{t('help_import_label', 'Compras (Import):')}</strong> {t('help_import', 'Se registra que producto se compro, cuanto, a que precio en moneda externa, y de que banco salio el dinero. El sistema calcula el precio interno sugerido usando el FC.')}</p>
          <p><strong>{t('help_export_label', 'Ventas (Export):')}</strong> {t('help_export', 'Se registra que producto se vendio, cuanto, a que precio, y a que banco entro el dinero.')}</p>
          <p><strong>{t('help_fc_label', 'Factor de Conversion (FC):')}</strong> {t('help_fc', 'Relacion entre la moneda externa y el TQ. Se calcula comparando el costo de la canasta basica alla y aca. Despues de compras reales, el sistema sugiere un recalculo del FC basado en los precios reales pagados.', { currency })}</p>
          <p><strong>{t('help_board_label', 'Junta Directiva:')}</strong> {t('help_board', 'El DEX puede requerir multi-firma para aprobar compras/ventas (ej: 2 firmas). Se configura en la pestana Cuentas Bancarias.')}</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('close', t('common:close'))}</button>
        </div>
      )}

      {/* ===== RESUMEN ===== */}
      {subTab === 'summary' && summary && (
        <div className="space-y-4">
          {/* Tutorial del modelo economico */}
          <div className="card bg-blue-50 border-blue-200">
            <h2 className="font-semibold flex items-center gap-2 mb-3"><Info size={18} />{t('dex_tutorial_title', 'Como funciona el Comercio Exterior (DEX)')}</h2>
            <div className="text-sm text-gray-700 space-y-3">
              <p><strong>{t('dex_intro', 'El DEX es el departamento de Comercio Exterior de la comunidad.')}</strong> {t('dex_intro_desc', 'Su funcion es conectar la economia interna (TQ) con la economia externa (dinero real: USD, EUR, COP, etc.).')}</p>
              <div className="bg-white rounded-lg p-3 border">
                <p className="font-medium mb-2">{t('dex_flow_title', 'Flujo del comercio exterior:')}</p>
                <ol className="list-decimal list-inside ml-2 space-y-1">
                  <li><strong>{t('dex_flow_1_label', 'Productor interno vende al DEX:')}</strong> {t('dex_flow_1', 'Un productor de la comunidad le vende su producto al departamento de Comercio Exterior. El DEX le paga en TQ (moneda interna).')}</li>
                  <li><strong>{t('dex_flow_2_label', 'DEX vende afuera (Export):')}</strong> {t('dex_flow_2', 'El DEX vende ese producto en el mercado externo y recibe dinero real (USD, EUR, etc.) en una cuenta bancaria externa.')}</li>
                  <li><strong>{t('dex_flow_3_label', 'DEX compra afuera (Import):')}</strong> {t('dex_flow_3', 'Con ese dinero real, el DEX compra los productos que la comunidad necesita pero no produce (medicinas, herramientas, insumos, etc.).')}</li>
                  <li><strong>{t('dex_flow_4_label', 'DEX vende internamente:')}</strong> {t('dex_flow_4', 'El DEX trae esos productos y los vende dentro de la comunidad en TQ. Los miembros pueden comprarlos con su saldo interno.')}</li>
                  <li><strong>{t('dex_flow_5_label', 'El ciclo se repite:')}</strong> {t('dex_flow_5', 'El dinero de las ventas internas se usa para comprar mas productos a los productores, y asi sigue el ciclo.')}</li>
                </ol>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <p className="font-medium mb-2">{t('dex_accounting_title', 'Doble contabilidad:')}</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li><strong>{t('dex_accounting_banks_label', 'Cuentas bancarias externas:')}</strong> {t('dex_accounting_banks', 'Reflejan el dinero REAL disponible (USD, EUR, COP). Se actualizan con cada compra y venta externa.')}</li>
                  <li><strong>{t('dex_accounting_tq_label', 'Saldo TQ del DEX:')}</strong> {t('dex_accounting_tq', 'Refleja la deuda/credito interno del departamento. Cuando compra productos a un productor, le paga en TQ. Cuando vende productos internamente, recibe TQ.')}</li>
                </ul>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <p className="font-medium mb-2">{t('dex_fc_title', 'Factor de Conversion (FC):')}</p>
                <p>{t('dex_fc_desc', 'El FC es el tipo de cambio entre moneda externa y TQ. Por ejemplo, si FC = 5, entonces 1 USD = 5 TQ. El FC se calcula comparando el costo de una canasta basica en moneda externa vs en TQ local. El FC sugerido se recalcula automaticamente desde las compras reales registradas.')}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <p className="font-medium mb-2">{t('dex_approvals_title', 'Aprobaciones:')}</p>
                <p>{t('dex_approvals_desc', 'Las compras y ventas externas pueden requerir aprobacion multiple (multi-firma). Esto significa que varias personas autorizadas deben aprobar antes de que el dinero se mueva. Esto evita que una sola persona tenga control total sobre el dinero real.')}</p>
              </div>
            </div>
          </div>

          <div className="card bg-blue-50">
            <h2 className="font-semibold flex items-center gap-2 mb-3"><Wallet size={18} />{t('summary_title', 'Resumen del Comercio Exterior')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Saldo TQ del DEX */}
              <div className="bg-white rounded-lg p-4 border">
                <p className="text-xs text-gray-500">{t('summary_dex_balance', 'Saldo en {{currency}} del DEX', { currency })}</p>
                <p className="text-2xl font-bold text-trueque-700">{fmtNumber(summary.dex_balance_tq || 0)} {currency}</p>
                <p className="text-xs text-gray-400 mt-1">{t('summary_dex_balance_desc', 'Dinero interno disponible para compras')}</p>
              </div>
              {/* FC actual */}
              <div className="bg-white rounded-lg p-4 border">
                <p className="text-xs text-gray-500">{t('summary_fc', 'Factor de Conversion (FC)')}</p>
                <p className="text-2xl font-bold text-blue-700">1 {summary.fc_currency || 'USD'} = {summary.current_fc || 5} {currency}</p>
                <p className="text-xs text-gray-400 mt-1">{t('summary_fc_desc', 'Cambio actual moneda externa a {{currency}}', { currency })}</p>
              </div>
              {/* Operaciones */}
              <div className="bg-white rounded-lg p-4 border">
                <p className="text-xs text-gray-500">{t('summary_operations', 'Operaciones')}</p>
                <div className="flex gap-4 mt-1">
                  <div>
                    <p className="text-sm font-bold text-amber-600">{summary.pending_purchases || 0}</p>
                    <p className="text-xs text-gray-400">{t('summary_pending_purchases', 'Compras pend.')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-600">{summary.completed_purchases || 0}</p>
                    <p className="text-xs text-gray-400">{t('summary_completed_purchases', 'Compras hechas')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-600">{summary.completed_sales || 0}</p>
                    <p className="text-xs text-gray-400">{t('summary_completed_sales', 'Ventas hechas')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Saldos bancarios por moneda */}
          <div className="card">
            <h3 className="font-medium mb-3 flex items-center gap-2"><Building2 size={16} />{t('bank_balances_title', 'Saldos en Bancos Externos')}</h3>
            {summary.bank_balances && summary.bank_balances.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {summary.bank_balances.map((b: any, i: number) => (
                  <div key={i} className="border rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">{b.currency}</p>
                    <p className="text-xl font-bold text-green-700">{fmtNumber(b.balance)} {b.currency}</p>
                    <p className="text-xs text-gray-400">{t('bank_accounts_count', '{{count}} cuenta(s)', { count: b.accounts })}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t('no_bank_accounts_summary', 'No hay cuentas bancarias configuradas. Ve a "Cuentas Bancarias" para agregar.')}</p>
            )}
          </div>

          {/* Recalculo de canasta sugerido */}
          {recalcs.length > 0 && (
            <div className="card border-amber-200">
              <h3 className="font-medium mb-3 flex items-center gap-2"><RefreshCw size={16} />{t('recalc_title', 'Recalculo de Canasta Sugerido')}</h3>
              {recalcs.slice(0, 3).map((rc: any, i: number) => (
                <div key={i} className={`border rounded-lg p-3 mb-2 ${rc.is_approved ? 'bg-green-50' : 'bg-amber-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {t('recalc_real_basket', 'Canasta real:')} <b>{rc.currency} {rc.basket_cost_external_real}</b> | {t('recalc_local_basket', 'Canasta local:')} <b>{rc.basket_cost_local_tq} {currency}</b>
                      </p>
                      <p className="text-sm">{t('recalc_suggested_fc', 'FC sugerido:')} <b className="text-blue-700">1 {rc.currency} = {rc.suggested_fc} {currency}</b>
                        {rc.previous_fc && <span className="text-gray-500"> ({t('recalc_previous', 'anterior:')} {rc.previous_fc})</span>}
                      </p>
                      {rc.notes && <p className="text-xs text-gray-500 mt-1">{rc.notes}</p>}
                    </div>
                    <div>
                      {rc.is_approved ? (
                        <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded">{t('recalc_approved', 'Aprobado')}</span>
                      ) : (
                        <button onClick={() => approveRecalc(rc.id)} className="btn-primary text-xs">{t('recalc_approve_fc', 'Aprobar FC')}</button>
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
            <h2 className="font-semibold flex items-center gap-2"><Building2 size={18} />{t('bank_title', 'Cuentas Bancarias Externas')}</h2>
            <button onClick={() => { setShowBankForm(!showBankForm); setEditingBankId(null); setBankForm({ account_name: '', bank_name: '', account_number: '', currency: 'USD', balance: 0, is_cash: false, account_type: 'corriente', country: '' }) }} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />{t('bank_new', 'Nueva Cuenta')}</button>
          </div>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
            <p>{t('ext_accounts_help', 'El Comercio Exterior maneja dinero')} <strong>{t('ext_real', 'real')}</strong> {t('ext_accounts_help2', '(USD, EUR, COP, etc.). Cada cuenta puede ser:')}</p>
            <ul className="list-disc list-inside ml-2 mt-1">
              <li><strong>{t('ext_bank_account', 'Cuenta bancaria:')}</strong> {t('ext_bank_account_desc', 'dinero en un banco real. Registrar nombre del banco, numero de cuenta, tipo y pais.')}</li>
              <li><strong>{t('ext_cash', 'Efectivo en caja:')}</strong> {t('ext_cash_desc', 'dinero fisico guardado en la caja fuerte. No tiene banco ni numero.')}</li>
            </ul>
            <p className="mt-1">{t('ext_accounts_help3', 'Cada vez que se aprueba una compra o venta, el saldo se actualiza automaticamente. Puedes editar o eliminar cualquier cuenta, y ver sus movimientos.')}</p>
          </div>

          {showBankForm && (
            <div className="card space-y-3">
              <h3 className="font-medium">{editingBankId ? t('bank_edit_title', 'Editar Cuenta Bancaria') : t('bank_new_title', 'Nueva Cuenta Bancaria')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('bank_label_name', 'Nombre descriptivo')}</label>
                  <input className="input" placeholder="Ej: Banco Nacional USD" value={bankForm.account_name} onChange={(e) => setBankForm({ ...bankForm, account_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t('bank_label_currency', 'Moneda')}</label>
                  <select className="input" value={bankForm.currency} onChange={(e) => setBankForm({ ...bankForm, currency: e.target.value })}>
                    {EXTERNAL_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('bank_label_bank', 'Banco (dejar vacio si es efectivo)')}</label>
                  <input className="input" placeholder="Ej: Banco Nacional" value={bankForm.bank_name} onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })} disabled={bankForm.is_cash} />
                </div>
                <div>
                  <label className="label">{t('bank_label_account_number', 'Numero de cuenta (dejar vacio si es efectivo)')}</label>
                  <input className="input" placeholder="Ej: 1234-5678-90" value={bankForm.account_number} onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })} disabled={bankForm.is_cash} />
                </div>
                <div>
                  <label className="label">{t('bank_label_account_type', 'Tipo de cuenta')}</label>
                  <select className="input" value={bankForm.account_type} onChange={(e) => setBankForm({ ...bankForm, account_type: e.target.value })} disabled={bankForm.is_cash}>
                    <option value="corriente">{t('bank_account_type_corriente', 'Cuenta corriente')}</option>
                    <option value="ahorro">{t('bank_account_type_ahorro', 'Cuenta de ahorro')}</option>
                  </select>
                </div>
                <div>
                  <label className="label">{t('bank_label_country', 'Pais del banco')}</label>
                  <input className="input" placeholder="Ej: VE, CO, US" value={bankForm.country} onChange={(e) => setBankForm({ ...bankForm, country: e.target.value })} disabled={bankForm.is_cash} />
                </div>
                <div>
                  <label className="label">{t('bank_label_balance', 'Saldo inicial')}</label>
                  <input type="number" className="input" placeholder="0" value={bankForm.balance} onChange={(e) => setBankForm({ ...bankForm, balance: parseFloat(e.target.value) || 0 })} disabled={!!editingBankId} />
                  {editingBankId && <p className="text-xs text-gray-400 mt-1">{t('bank_balance_no_edit', 'El saldo no se edita aqui. Se actualiza automaticamente con compras y ventas.')}</p>}
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="is_cash" checked={bankForm.is_cash} onChange={(e) => setBankForm({ ...bankForm, is_cash: e.target.checked, bank_name: '', account_number: '', account_type: '', country: '' })} />
                  <label htmlFor="is_cash" className="text-sm">{t('bank_is_cash', 'Efectivo en caja (no es cuenta bancaria)')}</label>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={createBankAccount} className="btn-primary">{editingBankId ? t('bank_save_changes', 'Guardar Cambios') : t('bank_create', 'Crear Cuenta')}</button>
                <button onClick={() => { setShowBankForm(false); setEditingBankId(null) }} className="btn-secondary">{t('cancel', t('common:cancel'))}</button>
              </div>
            </div>
          )}

          {bankAccounts.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">
              {t('bank_no_accounts', 'No hay cuentas bancarias configuradas.')}
              <br />
              <span className="text-sm">{t('bank_no_accounts_hint', 'Crea una cuenta para empezar a registrar compras y ventas externas.')}</span>
            </div>
          ) : (
            <div className="space-y-3">
              {bankAccounts.map((ba: any, i: number) => (
                <div key={i} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium flex items-center gap-2">
                        {ba.is_cash ? <Wallet size={16} /> : <Building2 size={16} />}
                        {ba.account_name}
                      </p>
                      {!ba.is_cash && (
                        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                          <p><strong>{t('bank_label_bank_short', 'Banco:')}</strong> {ba.bank_name || 'N/A'}</p>
                          <p><strong>{t('bank_label_number_short', 'Numero:')}</strong> {ba.account_number || 'N/A'}</p>
                          <p><strong>{t('bank_label_type_short', 'Tipo:')}</strong> {ba.account_type === 'ahorro' ? t('bank_account_type_ahorro', 'Cuenta de ahorro') : t('bank_account_type_corriente', 'Cuenta corriente')}</p>
                          {ba.country && <p><strong>{t('bank_label_country_short', 'Pais:')}</strong> {ba.country}</p>}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded">{ba.currency}</span>
                      <p className="text-2xl font-bold text-green-700 mt-1">{fmtNumber(ba.balance)} {ba.currency}</p>
                      <p className="text-xs text-gray-400">{ba.is_cash ? t('bank_cash', 'Efectivo en caja') : t('bank_account', 'Cuenta bancaria')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <button onClick={() => viewMovements(ba.id)} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                      <Info size={14} /> {viewingMovements === ba.id ? t('bank_hide_movements', 'Ocultar movimientos') : t('bank_view_movements', 'Ver movimientos')}
                    </button>
                    <button onClick={() => editBankAccount(ba)} className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1">
                      <Edit3 size={14} /> {t('bank_edit', t('common:edit'))}
                    </button>
                    <button onClick={() => deleteBankAccount(ba.id)} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
                      <X size={14} /> {t('bank_delete', t('common:delete'))}
                    </button>
                  </div>
                  {viewingMovements === ba.id && (
                    <div className="mt-3 pt-3 border-t">
                      <h4 className="text-sm font-medium mb-2">{t('bank_movements_title', 'Movimientos de la cuenta')}</h4>
                      {movements.length === 0 ? (
                        <p className="text-sm text-gray-500">{t('bank_no_movements', 'No hay movimientos registrados en esta cuenta.')}</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead><tr className="border-b text-left text-gray-600">
                            <th className="py-1">{t('bank_mov_date', 'Fecha')}</th><th>{t('bank_mov_type', 'Tipo')}</th><th>{t('bank_mov_product', 'Producto')}</th><th>{t('bank_mov_amount', 'Monto')}</th><th>{t('bank_mov_status', 'Estado')}</th><th>{t('bank_mov_counterparty', 'Contraparte')}</th>
                          </tr></thead>
                          <tbody>
                            {movements.map((m, mi) => (
                              <tr key={mi} className="border-b border-gray-100">
                                <td className="py-1">{m.date?.slice(0, 10)}</td>
                                <td><span className={`px-1.5 py-0.5 rounded ${m.type === 'compra' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{m.type}</span></td>
                                <td>{m.product_name}</td>
                                <td className={m.type === 'compra' ? 'text-red-600' : 'text-green-600'}>{m.type === 'compra' ? '-' : '+'}{fmtNumber(m.amount)} {m.currency}</td>
                                <td>{m.status}</td>
                                <td className="text-gray-500">{m.counterparty || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
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
            <h2 className="font-semibold flex items-center gap-2"><TrendingDown size={18} />{t('purchases_title', 'Compras Externas (Import)')}</h2>
            <button onClick={() => setShowPurchaseForm(!showPurchaseForm)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />{t('purchases_new', 'Nueva Compra')}</button>
          </div>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
            <p><strong>{t('ext_purchases_how', 'Como funciona:')}</strong> {t('ext_purchases_how_desc', 'Cuando compras productos afuera, registras que compraste, cuanto, a que precio en moneda externa, y de que banco salio el dinero.')}</p>
            <p className="mt-1">{t('ext_purchases_calc', 'El sistema calcula automaticamente el')} <strong>{t('ext_purchases_suggested', 'precio interno sugerido')}</strong> {t('ext_purchases_calc2', 'usando el FC:')} <code>{t('ext_purchases_formula', 'precio_interno = precio_externo x FC')}</code>. {t('ext_purchases_calc3', 'Esto te dice a cuanto puedes vender el producto internamente.')}</p>
          </div>

          {showPurchaseForm && (
            <div className="card space-y-3">
              <h3 className="font-medium">{t('purchases_form_title', 'Registrar Nueva Compra')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('purchases_label_product', 'Producto')}</label>
                  <input className="input" placeholder="Ej: Harina de trigo" value={purchaseForm.product_name} onChange={(e) => setPurchaseForm({ ...purchaseForm, product_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t('purchases_label_quantity', 'Cantidad')}</label>
                  <input type="number" className="input" placeholder="Ej: 100" value={purchaseForm.quantity} onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">{t('purchases_label_unit', 'Unidad')}</label>
                  <input className="input" placeholder="kg, litros, unidades..." value={purchaseForm.unit} onChange={(e) => setPurchaseForm({ ...purchaseForm, unit: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t('purchases_label_unit_cost', 'Precio unitario externo')}</label>
                  <input type="number" className="input" placeholder="Ej: 0.80" value={purchaseForm.unit_cost_external} onChange={(e) => setPurchaseForm({ ...purchaseForm, unit_cost_external: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">{t('purchases_label_currency', 'Moneda')}</label>
                  <select className="input" value={purchaseForm.currency} onChange={(e) => setPurchaseForm({ ...purchaseForm, currency: e.target.value })}>
                    {EXTERNAL_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('purchases_label_bank_account_from', 'Cuenta bancaria (de donde sale)')}</label>
                  <select className="input" value={purchaseForm.bank_account_id} onChange={(e) => setPurchaseForm({ ...purchaseForm, bank_account_id: e.target.value })}>
                    <option value="">{t('ext_select_dots', 'Seleccionar...')}</option>
                    {bankAccounts.filter((ba: any) => ba.currency === purchaseForm.currency).map((ba: any) => (
                      <option key={ba.id} value={ba.id}>{ba.account_name} ({ba.balance} {ba.currency})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t('purchases_label_supplier', 'Proveedor')}</label>
                  <input className="input" placeholder="Ej: Distribuidora Andina" value={purchaseForm.supplier} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t('purchases_label_invoice', 'Numero de factura')}</label>
                  <input className="input" placeholder="Opcional" value={purchaseForm.invoice_number} onChange={(e) => setPurchaseForm({ ...purchaseForm, invoice_number: e.target.value })} />
                </div>
              </div>
              <button onClick={createPurchase} className="btn-primary">{t('purchases_register', 'Registrar Compra')}</button>
            </div>
          )}

          {purchases.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">{t('purchases_none', 'No hay compras registradas.')}</div>
          ) : (
            <div className="space-y-2">
              {purchases.map((p: any, i: number) => (
                <div key={i} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="font-medium">{p.product_name}</span>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2 text-sm">
                        <div><span className="text-gray-500">{t('purchases_qty', 'Cant:')}</span> <b>{p.quantity} {p.unit}</b></div>
                        <div><span className="text-gray-500">{t('purchases_ext_cost', 'Costo ext:')}</span> <b>{p.currency} {p.unit_cost_external}</b></div>
                        <div><span className="text-gray-500">{t('purchases_ext_total', 'Total ext:')}</span> <b>{p.currency} {p.total_external}</b></div>
                        <div><span className="text-gray-500">{t('purchases_local_total', 'Total {{currency}}:', { currency })}</span> <b className="text-trueque-700">{p.total_local_tq} {currency}</b></div>
                        <div><span className="text-gray-500">{t('ext_price_sug', 'Precio sug.:')}</span> <b className="text-amber-600">{p.suggested_internal_price} {currency}/{p.unit}</b></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {p.supplier && `${t('purchases_supplier', 'Proveedor:')} ${p.supplier} | `}
                        {p.bank_account_name && `${t('purchases_bank', 'Banco:')} ${p.bank_account_name} | `}
                        {t('purchases_date', 'Fecha:')} {String(p.purchase_date).slice(0, 10)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${p.status === 'completed' ? 'bg-green-100 text-green-700' : p.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {p.status === 'completed' ? t('status_completed', 'Completado') : p.status === 'rejected' ? t('status_rejected', 'Rechazado') : t('status_pending', 'Pendiente')}
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
            <h2 className="font-semibold flex items-center gap-2"><TrendingUp size={18} />{t('sales_title', 'Ventas Externas (Export)')}</h2>
            <button onClick={() => setShowSaleForm(!showSaleForm)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />{t('sales_new', 'Nueva Venta')}</button>
          </div>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
            <p><strong>{t('ext_sales_how', 'Como funciona:')}</strong> {t('ext_sales_how_desc', 'Cuando vendes productos al exterior, registras que vendiste, cuanto, a que precio en moneda externa, y a que banco entro el dinero.')}</p>
            <p className="mt-1">{t('ext_sales_help', 'El dinero recibido se suma automaticamente al saldo del banco seleccionado al aprobar la venta.')}</p>
          </div>

          {showSaleForm && (
            <div className="card space-y-3">
              <h3 className="font-medium">{t('sales_form_title', 'Registrar Nueva Venta')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('sales_label_product', 'Producto')}</label>
                  <input className="input" placeholder="Ej: Cafe organico" value={saleForm.product_name} onChange={(e) => setSaleForm({ ...saleForm, product_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t('sales_label_quantity', 'Cantidad')}</label>
                  <input type="number" className="input" placeholder="Ej: 20" value={saleForm.quantity} onChange={(e) => setSaleForm({ ...saleForm, quantity: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">{t('sales_label_unit', 'Unidad')}</label>
                  <input className="input" placeholder="kg, litros..." value={saleForm.unit} onChange={(e) => setSaleForm({ ...saleForm, unit: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t('sales_label_unit_price', 'Precio unitario externo')}</label>
                  <input type="number" className="input" placeholder="Ej: 8.00" value={saleForm.unit_price_external} onChange={(e) => setSaleForm({ ...saleForm, unit_price_external: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">{t('sales_label_currency', 'Moneda')}</label>
                  <select className="input" value={saleForm.currency} onChange={(e) => setSaleForm({ ...saleForm, currency: e.target.value })}>
                    {EXTERNAL_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('sales_label_bank_account_to', 'Cuenta bancaria (a donde entra)')}</label>
                  <select className="input" value={saleForm.bank_account_id} onChange={(e) => setSaleForm({ ...saleForm, bank_account_id: e.target.value })}>
                    <option value="">{t('ext_select_dots', 'Seleccionar...')}</option>
                    {bankAccounts.filter((ba: any) => ba.currency === saleForm.currency).map((ba: any) => (
                      <option key={ba.id} value={ba.id}>{ba.account_name} ({ba.balance} {ba.currency})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t('sales_label_buyer', 'Comprador')}</label>
                  <input className="input" placeholder="Ej: Cooperativa de Exportacion" value={saleForm.buyer} onChange={(e) => setSaleForm({ ...saleForm, buyer: e.target.value })} />
                </div>
              </div>
              <button onClick={createSale} className="btn-primary">{t('sales_register', 'Registrar Venta')}</button>
            </div>
          )}

          {sales.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">{t('sales_none', 'No hay ventas registradas.')}</div>
          ) : (
            <div className="space-y-2">
              {sales.map((s: any, i: number) => (
                <div key={i} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="font-medium">{s.product_name}</span>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm">
                        <div><span className="text-gray-500">{t('sales_qty', 'Cant:')}</span> <b>{s.quantity} {s.unit}</b></div>
                        <div><span className="text-gray-500">{t('ext_price_ext', 'Precio ext:')}</span> <b>{s.currency} {s.unit_price_external}</b></div>
                        <div><span className="text-gray-500">{t('sales_ext_total', 'Total ext:')}</span> <b>{s.currency} {s.total_external}</b></div>
                        <div><span className="text-gray-500">{t('sales_local_total', 'Total {{currency}}:', { currency })}</span> <b className="text-trueque-700">{s.total_local_tq} {currency}</b></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {s.buyer && `${t('sales_buyer', 'Comprador:')} ${s.buyer} | `}
                        {s.bank_account_name && `${t('sales_bank', 'Banco:')} ${s.bank_account_name} | `}
                        {t('sales_date', 'Fecha:')} {String(s.sale_date).slice(0, 10)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${s.status === 'completed' ? 'bg-green-100 text-green-700' : s.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {s.status === 'completed' ? t('status_completed', 'Completado') : s.status === 'rejected' ? t('status_rejected', 'Rechazado') : t('status_pending', 'Pendiente')}
                      </span>
                      {s.status === 'pending' && (
                        <button onClick={() => approveSale(s.id)} className="btn-secondary flex items-center gap-1 text-sm"><Check size={14} /> {t('ext_approve', 'Aprobar')}</button>
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
              <h2 className="font-semibold">{t('fc_current_title', 'Factor de Conversion Actual (FC)')}</h2>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                1 {fc.external_currency || 'USD'} = {fc.factor} {currency}
              </p>
              {fc.basket_cost_external > 0 && fc.basket_cost_local_tq > 0 ? (
                <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                  <div><span className="text-gray-500">{t('ext_basket_in', 'Canasta en')} {fc.external_currency}:</span> <b>{getCurrencySymbol(fc.external_currency)}{fc.basket_cost_external}</b></div>
                  <div><span className="text-gray-500">{t('ext_basket_in', 'Canasta en')} {currency}:</span> <b>{fc.basket_cost_local_tq} {currency}</b></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                  <div><span className="text-gray-500">{t('ext_cpi_external', 'CPI externo:')}</span> <b>{fc.external_cpi}</b></div>
                  <div><span className="text-gray-500">{t('ext_energy_cost_local', 'Costo energia local:')}</span> <b>{fc.local_energy_cost} kWh</b></div>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                {t('fc_current_desc', 'El FC indica cuantos')} {currency} {t('fc_current_desc2', 'equivale 1')} {fc.external_currency || 'USD'}, {t('fc_current_desc3', 'basado en el costo de la canasta basica.')}
              </p>
              {fc.is_default && (
                <p className="text-xs text-amber-600 mt-1 font-medium">{t('fc_default_warning', 'Valor por defecto - presiona "Editar FC" para configurar el real de tu comunidad')}</p>
              )}
            </div>
            {!showFCForm && (
              <button onClick={() => setShowFCForm(true)} className="btn-secondary flex items-center gap-1 text-sm">
                <Edit3 size={16} /> {t('fc_edit', 'Editar FC')}
              </button>
            )}
          </div>

          {showFCForm && (
            <div className="mt-4 pt-4 border-t border-blue-200 space-y-3">
              <h3 className="font-medium text-sm flex items-center gap-1"><Calculator size={16} /> {t('fc_calc_title', 'Calcular FC desde Canasta Basica')}</h3>
              <p className="text-xs text-gray-500">
                {t('fc_calc_desc', 'Compara el costo de la')} <strong>{t('fc_calc_same_basket', 'misma canasta basica')}</strong> {t('fc_calc_desc2', '(alimentos basicos, servicios esenciales) en la moneda externa y en')} {currency}. {t('fc_calc_desc3', 'El sistema calcula automaticamente el FC. No necesitas hacer calculos: solo ingresa los dos precios.')}
              </p>

              <div className="space-y-3">
                {/* Paso 1: Elegir moneda */}
                <div>
                  <label className="label">1. {t('fc_step1_label', 'Moneda externa de referencia')}</label>
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
                    {t('fc_step2_hint', 'Cuanto cuesta una canasta basica de alimentos alla en su moneda. Ej: si alla cuesta 300')} {fcForm.external_currency}, {t('fc_step2_hint2', 'escribe 300. Puedes buscar')} "canasta basica {getCurrencyName(fcForm.external_currency)}" {t('fc_step2_hint3', 'en internet.')}
                  </p>
                </div>

                {/* Paso 3: Costo canasta local - SOLO LECTURA, viene de la federacion */}
                <div>
                  <label className="label">
                    3. {t('fc_step3_label', 'Canasta basica interna (en')} {currency}) - <span className="text-blue-600">{t('fc_federated_value', 'valor federado')}</span>
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
                    <strong>{t('fc_readonly', 'Este valor no se puede editar.')}</strong> {t('fc_readonly_desc', 'Es el mismo en todos los nodos de la federacion. Solo se puede cambiar mediante una propuesta federada aprobada por consenso. Ve a "Federacion" para proponer o votar cambios.')}
                  </p>
                </div>
              </div>

              {/* Ejemplo visual */}
              <div className="text-xs bg-white p-3 rounded border border-blue-100">
                <p className="font-medium text-gray-600 mb-1">{t('fc_example_title', 'Ejemplo de como funciona:')}</p>
                <p>{t('fc_example_desc', 'Si alla la canasta cuesta')} <b>300 {fcForm.external_currency}</b> {t('fc_example_and_here', 'y aca cuesta')} <b>{fcForm.basket_cost_local_tq || 500} {currency}</b>:</p>
                <p className="mt-1">FC = {fcForm.basket_cost_local_tq || 500} / 300 = <b className="text-blue-700">{fmtNumber((fcForm.basket_cost_local_tq || 500) / 300)} {currency}</b> {t('fc_example_per', 'por cada')} <b>1 {fcForm.external_currency}</b></p>
                <p className="mt-1 text-gray-400">{t('fc_example_meaning', 'Esto significa que 1')} {fcForm.external_currency} {t('fc_example_meaning2', 'tiene el mismo poder adquisitivo que')} {fmtNumber((fcForm.basket_cost_local_tq || 500) / 300)} {currency}.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={calculateFC} className="btn-secondary flex items-center gap-1 text-sm">
                  <Calculator size={16} /> {t('fc_calculate', 'Calcular FC')}
                </button>
                {fcPreview !== null && (
                  <>
                    <span className="text-sm text-gray-600">
                      {t('fc_new_fc', 'Nuevo FC:')} <b className="text-blue-700">1 {fcForm.external_currency} = {fmtNumber(fcPreview)} {currency}</b>
                    </span>
                    <button onClick={saveFC} disabled={fcSaving} className="btn-primary flex items-center gap-1 text-sm">
                      <Save size={16} /> {fcSaving ? t('fc_saving', t('common:loading')) : t('fc_save', 'Guardar FC')}
                    </button>
                  </>
                )}
                <button onClick={() => { setShowFCForm(false); setFcPreview(null); setFcMsg(null) }} className="text-gray-500 text-sm">
                  {t('cancel', t('common:cancel'))}
                </button>
              </div>

              {fcMsg && (
                <div className={`text-sm p-2 rounded ${fcMsg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {fcMsg.text}
                </div>
              )}

              <div className="text-xs text-gray-400 bg-white p-3 rounded border border-gray-100">
                <p className="font-medium text-gray-600 mb-1">{t('fc_about_title', 'Sobre el FC:')}</p>
                <p>{t('fc_about_desc', 'El FC es una')} <strong>{t('fc_about_ref', 'referencia contable')}</strong>, {t('fc_about_desc2', 'no una tasa de cambio especulativa. Lo decide la asamblea basandose en el costo de vida real.')}</p>
                <p className="mt-1"><strong>{t('fc_when_update', 'Cuando actualizarlo:')}</strong> {t('fc_when_update_desc', 'cuando cambien significativamente los precios alla o aca. No sube ni baja solo - lo actualiza un administrador cuando lo considera necesario.')}</p>
                <p className="mt-1"><strong>{t('fc_why_not_spec', 'Por que no es especulativo:')}</strong> {t('fc_why_not_spec_desc', 'el')} {currency} {t('fc_why_not_spec_desc2', 'no es una moneda financiera. Es una unidad contable comunitaria. El FC solo sirve para saber cuanto vale algo del exterior en terminos locales.')}</p>
                <p className="mt-1"><strong>{t('fc_who_update', 'Quien puede actualizarlo:')}</strong> {t('fc_who_update_desc', 'Lo decide la Asamblea en la pestana')} <em>{t('fc_config_tab', 'Configuracion')}</em>. {t('fc_who_update_desc2', 'Puede ser: un administrador, la junta directiva, una persona autorizada, o solo por votacion de asamblea. En paises con economia inestable (ej: Venezuela), conviene asignar una persona que actualice frecuentemente. En paises estables, puede decidirse por asamblea.')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'operations' && showForm && (
        <div className="card space-y-4">
          <h2 className="font-semibold">{t('operations_new_title', 'Nueva Operacion de Comercio Externo')}</h2>

          <div>
            <label className="label">{t('operations_label_type', 'Tipo de operacion')}</label>
            <select className="input" value={form.operation_type} onChange={(e) => setForm({ ...form, operation_type: e.target.value })}>
              <option value="import">{t('operations_type_import', 'Importacion (comprar de fuera)')}</option>
              <option value="export">{t('operations_type_export', 'Exportacion (vender afuera)')}</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {t('operations_type_hint', 'Define el sentido de la operacion. Ej: Importacion para traer harina de otra red.')}
            </p>
            {form.operation_type === 'import' ? (
              <p className="text-xs text-blue-600 mt-1">
                <strong>{t('ext_import_label', 'Importacion:')}</strong> {t('ext_import_desc', 'Comprar productos de fuera de la red. Pagas en moneda local ({currency}), el vendedor recibe en su moneda.', { currency })}
              </p>
            ) : (
              <p className="text-xs text-blue-600 mt-1">
                <strong>{t('ext_export_label', 'Exportacion:')}</strong> {t('ext_export_desc', 'Vender productos al exterior. Recibes moneda local ({currency}), el comprador paga en su moneda.', { currency })}
              </p>
            )}
          </div>

          <EntitySelector
            label={t('operations_label_product', 'Producto')}
            helpText={t('operations_product_help', 'Selecciona un producto existente en el catalogo. Busca por nombre o descripcion. Ej: Harina de trigo, Energia solar.')}
            placeholder={t('operations_product_ph', 'Ej: Harina de trigo, Energia solar...')}
            value={form.product_id}
            onChange={onProductSelect}
            endpoint="/products"
            valueKey="id"
            labelKey="name"
            subLabelKey="description"
            emptyMessage={t('operations_no_products', 'No se encontraron productos')}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('operations_label_quantity', 'Cantidad')}</label>
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
              <label className="label">{t('operations_label_external_price', 'Precio externo (USD)')}</label>
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
              <label className="label">{t('operations_label_local_price', 'Precio local ({{currency}})', { currency })}</label>
              <input
                type="number"
                className="input"
                placeholder="Ej: 150"
                value={form.local_price_trueque}
                onChange={(e) => setForm({ ...form, local_price_trueque: toCents(e.target.value) })}
              />
              <p className="text-xs text-gray-400 mt-1">
                Precio en moneda local ({currency}) por unidad. Se autocompleta al seleccionar un producto. Ej: 150 {currency} por kg.
              </p>
            </div>
            <div>
              <label className="label">{t('operations_label_logistics', 'Logistica (%)')}</label>
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
              <label className="label">{t('operations_label_external_tax', 'Impuesto externo (%)')}</label>
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

          <button onClick={create} className="btn-primary">{t('operations_create', 'Crear Operacion')}</button>
        </div>
      )}

      {subTab === 'operations' && (
      <div className="space-y-2">
        {ops.length === 0 && !showForm ? (
          <div className="card text-center text-gray-500 py-8">
            {t('operations_none', 'No hay operaciones de comercio externo.')}
            <br />
            <span className="text-sm">{t('operations_none_hint', 'Crea una nueva operacion con el boton de arriba.')}</span>
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
                  {op.operation_type === 'import' ? t('operations_import', 'Importacion') : t('operations_export', 'Exportacion')}: {op.product_name}
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 text-sm">
                  <div>
                    <span className="text-gray-500">{t('operations_quantity', 'Cantidad:')}</span> <b>{op.quantity}</b>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('operations_total_usd', 'Total USD:')}</span> <b>${fmtNumber(usdTotal)}</b>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('operations_total_local', 'Total {{currency}}:', { currency })}</span> <b className="text-trueque-700">{totalTQ} {currency}</b>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('operations_fc_used', 'FC usado:')}</span> <b>{fmtNumber(fcUsed)}</b>
                  </div>
                </div>
                {op.buyer_seller && (
                  <p className="text-xs text-gray-500 mt-1">{t('operations_requested_by', 'Solicitado por:')} {op.buyer_seller}</p>
                )}
                {op.completed_at && (
                  <p className="text-xs text-gray-500">{t('operations_completed', 'Completado:')} {String(op.completed_at).slice(0, 19)}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${op.status === 'approved' ? 'bg-trueque-100 text-trueque-700' : op.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {op.status === 'approved' ? t('status_approved', 'Aprobado') : op.status === 'rejected' ? t('status_rejected', 'Rechazado') : t('status_pending', 'Pendiente')}
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
            <h3 className="font-semibold flex items-center gap-2 mb-2"><Calculator size={18} /> {t('calculator_title', 'Calculadora de Precios Externos')}</h3>
            <p className="text-sm text-gray-600">
              {t('calc_table_desc', 'Esta tabla muestra el precio de cada producto del nodo convertido a la moneda externa usando el FC actual. Es')} <strong>{t('calc_table_informative', 'informativo')}</strong>: {t('calc_table_desc2', 'te ayuda a comparar si el FC calculado desde la canasta basica esta cerca del precio real externo.')}
            </p>
            {fc && (
              <p className="text-sm mt-2">
                {t('calculator_current_fc', 'FC actual:')} <strong>1 {fc.external_currency || 'USD'} = {fc.factor} {currency}</strong>
                <span className="text-gray-500 text-xs ml-2">
                  ({t('calc_external_formula', 'precio externo = precio')} {currency} / FC)
                </span>
              </p>
            )}
          </div>

          {/* Buscador */}
          <input
            className="input"
            placeholder={t('calculator_search_placeholder', 'Buscar producto por nombre...')}
            value={calcSearch}
            onChange={(e) => setCalcSearch(e.target.value)}
          />

          {/* Tabla de productos */}
          {products.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">{t('calculator_no_products', 'No hay productos cargados.')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 px-3">{t('calculator_col_product', 'Producto')}</th>
                    <th className="py-2 px-3 text-right">{t('calculator_col_price', 'Precio ({{currency}})', { currency })}</th>
                    <th className="py-2 px-3 text-right">{t('calculator_col_base', 'Base mundial')}</th>
                    <th className="py-2 px-3 text-right">{t('calculator_col_external', 'Precio externo ({{currency}})', { currency: fc?.external_currency || 'USD' })}</th>
                    <th className="py-2 px-3">{t('calculator_col_category', 'Categoria')}</th>
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
                            {fmtNumber(priceTQ)}
                            <div className="text-xs text-gray-400">{p.unit || ''}</div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-xs">
                            {(p.base_price || 0) > 0
                              ? `${p.base_price}/${p.base_unit || 'kg'}`
                              : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {priceExternal > 0 ? fmtNumber(priceExternal) : '-'}
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
              <strong>{t('calc_how_to_use', 'Como usar esta tabla:')}</strong> {t('calc_how_to_use_desc', 'Compara el "Precio externo" con lo que realmente cuesta ese producto en el pais externo. Si los precios estan cerca, el FC esta bien calibrado. Si estan muy diferentes, considera recalcular el FC desde la canasta basica.')}
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
                <div className="text-xs text-gray-500">{t('modal_price', 'Precio')}</div>
                <div className="font-mono font-medium">{fmtNumber(selectedProduct.price_tq || selectedProduct.price || 0)} {currency}</div>
                <div className="text-xs text-gray-500">{t('modal_per_unit', 'por')} {selectedProduct.unit || 'unidad'}</div>
              </div>
              <div className="bg-blue-50 p-2 rounded">
                <div className="text-xs text-gray-500">{t('modal_base_price_label', 'Precio base (base de datos mundial)')}</div>
                <div className="font-mono font-medium">
                  {(selectedProduct.base_price || 0) > 0
                    ? `${selectedProduct.base_price} ${currency}/${selectedProduct.base_unit || 'kg'}`
                    : 'N/A'}
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-xs text-gray-500">{t('modal_weight_label', 'Peso/cantidad del producto')}</div>
                <div className="font-mono font-medium">
                  {(selectedProduct.weight_kg || 0) > 0
                    ? `${selectedProduct.weight_kg} ${selectedProduct.base_unit === 'L' ? 'L' : 'kg'}`
                    : '-'}
                </div>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <div className="text-xs text-gray-500">{t('modal_external_price', 'Precio externo')}</div>
                <div className="font-mono font-medium">
                  {fc && fc.factor > 0
                    ? fmtNumber((selectedProduct.price_tq || selectedProduct.price || 0) / fc.factor)
                    : '-'} {fc?.external_currency || 'USD'}
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-xs text-gray-500">{t('modal_category', 'Categoria')}</div>
                <div className="font-medium">{selectedProduct.category || selectedProduct.type || '-'}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-xs text-gray-500">{t('modal_subcategory', 'Subcategoria')}</div>
                <div className="font-medium">{selectedProduct.subcategory || '-'}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-xs text-gray-500">{t('modal_parent_category', 'Categoria padre')}</div>
                <div className="font-medium">{selectedProduct.parent_category || '-'}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-xs text-gray-500">{t('modal_origin', 'Origen')}</div>
                <div className="font-medium">{selectedProduct.origin || '-'}</div>
              </div>
              {selectedProduct.product_code && (
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-xs text-gray-500">{t('modal_product_code', 'Codigo de producto')}</div>
                  <div className="font-mono font-medium text-xs">{selectedProduct.product_code}</div>
                </div>
              )}
              {fc && (
                <div className="bg-blue-50 p-2 rounded">
                  <div className="text-xs text-gray-500">{t('modal_external_price', 'Precio externo')}</div>
                  <div className="font-mono font-medium">
                    {fc.factor > 0
                      ? fmtNumber((selectedProduct.price_tq || selectedProduct.price || 0) / fc.factor)
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
                <div className="font-semibold text-amber-800 mb-1">{t('modal_price_calc_title', '¿Como se calcula el precio?')}</div>
                <div className="text-amber-700 font-mono text-xs">
                  {selectedProduct.price_calculation || `${selectedProduct.base_price} ${currency}/${selectedProduct.base_unit || 'kg'} × ${selectedProduct.weight_kg} ${selectedProduct.base_unit === 'L' ? 'L' : 'kg'} = ${fmtNumber(selectedProduct.base_price * selectedProduct.weight_kg)} ${currency}`}
                </div>
                <div className="text-xs text-amber-600 mt-1">
                  {t('modal_price_calc_desc', 'El precio base de')} <strong>{selectedProduct.base_price} {currency}/{selectedProduct.base_unit || 'kg'}</strong> {t('modal_price_calc_desc2', 'viene de la base de datos mundial (Agribalyse, FAO, Pimentel). Este producto pesa')} <strong>{selectedProduct.weight_kg} {selectedProduct.base_unit === 'L' ? t('modal_liters', 'litros') : 'kg'}</strong>, {t('modal_price_calc_desc3', 'por eso el precio es')} <strong>{fmtNumber(selectedProduct.price_tq || selectedProduct.price || 0)} {currency}</strong>.
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500 pt-2 border-t">
              {t('modal_unit_label', 'El precio es por unidad de:')} <strong>{selectedProduct.unit || t('modal_not_specified', 'no especificada')}</strong>.
              {selectedProduct.base_price > 0 && selectedProduct.weight_kg > 0 && ` ${t('modal_contains_label', 'Este producto contiene')} ${selectedProduct.weight_kg} ${selectedProduct.base_unit === 'L' ? t('modal_liters', 'litros') : t('modal_kilos', 'kilos')} ${t('modal_approximately', 'aproximadamente.')}`}
            </div>

            <button onClick={() => setSelectedProduct(null)} className="w-full px-4 py-2 bg-gray-200 rounded-lg text-sm">
              {t('modal_close', t('common:close'))}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
