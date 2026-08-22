import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Plus, Check, X, HelpCircle, Globe, Calculator, Save, Edit3 } from 'lucide-react'
import { EntitySelector } from '../components/EntitySelector'

export default function ExternalBridge() {
  const { currency } = useConfig()
  const [fc, setFc] = useState<any>(null)
  const [ops, setOps] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [form, setForm] = useState({ operation_type: 'import', product_id: '', product_name: '', quantity: 0, external_price_usd: 0, local_price_trueque: 0, logistics_pct: 0, external_tax_rate: 0 })

  // FC editor state
  const [showFCForm, setShowFCForm] = useState(false)
  const [fcForm, setFcForm] = useState({ external_cpi: 0, local_energy_cost: 0 })
  const [fcPreview, setFcPreview] = useState<number | null>(null)
  const [fcMsg, setFcMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [fcSaving, setFcSaving] = useState(false)

  const load = () => {
    api.get('/external/fc').then(setFc).catch(() => {})
    api.get('/external/operations').then((d: any) => setOps(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/products').then((d: any) => setProducts(Array.isArray(d) ? d : d?.products ?? [])).catch(() => {})
  }

  useEffect(() => { load() }, [])

  // Cuando se carga el FC, inicializar el formulario con esos valores
  useEffect(() => {
    if (fc) {
      setFcForm({
        external_cpi: fc.external_cpi ?? 0,
        local_energy_cost: fc.local_energy_cost ?? 0,
      })
    }
  }, [fc])

  const calculateFC = async () => {
    if (fcForm.external_cpi <= 0 || fcForm.local_energy_cost <= 0) {
      setFcMsg({ type: 'error', text: 'Ambos valores deben ser mayores que cero' })
      return
    }
    try {
      const res = await api.post('/external/fc/calculate', {
        external_cpi: fcForm.external_cpi,
        local_energy_cost: fcForm.local_energy_cost,
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
      await api.post('/external/fc/store', {
        factor: fcPreview,
        external_cpi: fcForm.external_cpi,
        local_energy_cost: fcForm.local_energy_cost,
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
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={18} />Nueva Operacion</button>
        </div>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
          <p><strong>Comercio Externo (DEX) - Ayuda</strong></p>
          <p><strong>Que es:</strong> El DEX (Decentralized Exchange) permite comprar y vender productos con el exterior de la red federada, usando monedas externas (USD, etc).</p>
          <p><strong>Factor de Conversion (FC):</strong> Relacion entre la moneda externa (USD) y el {currency}. Se calcula comparando el costo de vida externo (CPI) con el costo energetico local.</p>
          <p><strong>Importacion:</strong> Traer productos de fuera. Paga en {currency}, el sistema convierte al precio externo usando el FC.</p>
          <p><strong>Exportacion:</strong> Vender productos al exterior. Recibes {currency}, el externo paga en su moneda.</p>
          <p><strong>Logistica e impuestos:</strong> Se agregan al costo total como porcentajes. La logistica cubre transporte, los impuestos son aranceles externos.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {fc && (
        <div className="card bg-blue-50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="font-semibold">Factor de Conversion Actual (FC)</h2>
              <p className="text-2xl font-bold text-blue-700 mt-1">1 USD = {fc.factor} {currency}</p>
              <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                <div><span className="text-gray-500">CPI externo:</span> <b>{fc.external_cpi}</b></div>
                <div><span className="text-gray-500">Costo energia local:</span> <b>{fc.local_energy_cost} kWh</b></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">El FC indica cuantos {currency} equivale 1 dolar externo, basado en el costo de vida y la energia local.</p>
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
              <h3 className="font-medium text-sm flex items-center gap-1"><Calculator size={16} /> Recalcular Factor de Conversion</h3>
              <p className="text-xs text-gray-500">
                El FC se calcula dividiendo el CPI externo entre el costo de energia local.
                Ingresa los valores actuales de tu comunidad y del pais/moneda externa de referencia.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">CPI externo (indice de precios externo)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="Ej: 300"
                    value={fcForm.external_cpi || ''}
                    onChange={(e) => { setFcForm({ ...fcForm, external_cpi: parseFloat(e.target.value) || 0 }); setFcPreview(null) }}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Indice de precios al consumidor del pais/moneda externa. Representa el costo de vida externo.
                    Busca "CPI" o "indice de precios al consumidor" del pais de referencia.
                  </p>
                </div>
                <div>
                  <label className="label">Costo de energia local (kWh)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="Ej: 60"
                    value={fcForm.local_energy_cost || ''}
                    onChange={(e) => { setFcForm({ ...fcForm, local_energy_cost: parseFloat(e.target.value) || 0 }); setFcPreview(null) }}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Costo energetico promedio de la comunidad en kWh. Representa cuanto cuesta producir
                    un kWh localmente (solar, hidraulica, eolica, etc).
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={calculateFC} className="btn-secondary flex items-center gap-1 text-sm">
                  <Calculator size={16} /> Calcular FC
                </button>
                {fcPreview !== null && (
                  <>
                    <span className="text-sm text-gray-600">
                      Nuevo FC: <b className="text-blue-700">1 USD = {fcPreview.toFixed(2)} {currency}</b>
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
                <p className="font-medium text-gray-600 mb-1">Como funciona el FC:</p>
                <p><strong>Formula:</strong> FC = CPI externo / Costo energia local</p>
                <p><strong>Ejemplo:</strong> 300 / 60 = 5.00 TQ por USD</p>
                <p className="mt-1">El FC es una <strong>referencia contable</strong>, no una tasa de cambio especulativa.
                Lo decide la asamblea basandose en el costo de vida real. Actualizalo cuando cambien
                significativamente los precios externos o los costos energeticos locales.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
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
    </div>
  )
}
