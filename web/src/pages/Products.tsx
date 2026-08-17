import { useState, useEffect } from 'react'
import { api } from '../api'
import { Plus, HelpCircle } from 'lucide-react'

interface ProductForm {
  name: string
  description: string
  unit: string
  category: string
  price_trueque: string
  stock: string
  product_code: string
  currency: string
}

const EMPTY_FORM: ProductForm = {
  name: '',
  description: '',
  unit: 'kWh',
  category: '',
  price_trueque: '',
  stock: '',
  product_code: '',
  currency: 'TQ',
}

export default function Products() {
  const [products, setProducts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)

  const load = () => api.get('/pricing/products').then((d: any) => setProducts(Array.isArray(d) ? d : d?.products ?? [])).catch(() => {})

  useEffect(() => { load() }, [])

  const create = async () => {
    const payload = {
      ...form,
      price_trueque: Number(form.price_trueque) || 0,
      stock: Number(form.stock) || 0,
    }
    await api.post('/pricing/products', payload)
    setForm(EMPTY_FORM)
    setShowForm(false)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Productos</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="btn-primary flex items-center gap-2" title="Ayuda"><HelpCircle size={18} />?</button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={18} />Nuevo</button>
        </div>
      </div>

      {showHelp && (
        <div className="card space-y-2 text-sm text-gray-700">
          <p className="font-semibold">Ayuda general</p>
          <p>Esta seccion permite registrar productos y servicios para intercambiarlos en la red federada.</p>
          <p>Cada producto tiene un precio expresado en Trueques (TQ), donde <strong>1 TQ = 1 kWh</strong>. El stock indica cuantas unidades estan disponibles para intercambio (0 significa agotado).</p>
          <p>El codigo de producto permite identificarlo mediante QR o NFC. La moneda interna del nodo puede personalizarse, aunque por defecto es TQ.</p>
        </div>
      )}

      {showForm && (
        <div className="card space-y-3">
          <div className="space-y-1">
            <label className="label">Nombre</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <p className="text-xs text-gray-500">Nombre del producto o servicio</p>
          </div>
          <div className="space-y-1">
            <label className="label">Descripcion</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <p className="text-xs text-gray-500">Descripcion detallada del producto</p>
          </div>
          <div className="flex gap-2">
            <div className="space-y-1 flex-1">
              <label className="label">Unidad</label>
              <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              <p className="text-xs text-gray-500">Unidad de medida (kWh, horas, kilos, litros, etc)</p>
            </div>
            <div className="space-y-1 flex-1">
              <label className="label">Categoria</label>
              <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <p className="text-xs text-gray-500">Categoria del producto (alimentos, servicios, herramientas, etc)</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="space-y-1 flex-1">
              <label className="label">Precio (TQ)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.price_trueque} onChange={(e) => setForm({ ...form, price_trueque: e.target.value })} />
              <p className="text-xs text-gray-500">Precio en Trueques (TQ). 1 TQ = 1 kWh</p>
            </div>
            <div className="space-y-1 flex-1">
              <label className="label">Stock</label>
              <input className="input" type="number" min="0" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              <p className="text-xs text-gray-500">Cantidad disponible (0 = agotado)</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="space-y-1 flex-1">
              <label className="label">Codigo</label>
              <input className="input" value={form.product_code} onChange={(e) => setForm({ ...form, product_code: e.target.value })} />
              <p className="text-xs text-gray-500">Codigo unico del producto para identificarlo en QR y NFC</p>
            </div>
            <div className="space-y-1 flex-1">
              <label className="label">Moneda</label>
              <input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
              <p className="text-xs text-gray-500">Nombre de la moneda interna del nodo (por defecto TQ)</p>
            </div>
          </div>
          <button onClick={create} className="btn-primary">Guardar</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {products.map((p, i) => (
          <div key={i} className="card">
            <h3 className="font-semibold">{p.name}</h3>
            <p className="text-sm text-gray-600">{p.description}</p>
            <p className="text-xs text-gray-400 mt-2">Unidad: {p.unit} | Categoria: {p.category}</p>
            <p className="text-sm mt-2">
              Precio: <span className="font-semibold">{p.price_trueque ?? 0} {p.currency ?? 'TQ'}</span>
            </p>
            <p className="text-sm">
              Stock: <span className="font-semibold">{p.stock ?? 0}</span>
              {(p.stock ?? 0) === 0 && <span className="text-red-500 ml-1">(agotado)</span>}
            </p>
            {p.product_code && <p className="text-xs text-gray-400 mt-1">Codigo: {p.product_code}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
