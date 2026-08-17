import { useState, useEffect } from 'react'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { useConfig } from '../hooks/useConfig'
import { Plus, HelpCircle, Package } from 'lucide-react'

export default function Products() {
  const { hasPermission } = usePermissions()
  const { currency } = useConfig()
  const canManage = hasPermission('assembly.propose') || hasPermission('pricing.manage')
  const [products, setProducts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', description: '', unit: 'kWh', category: '', price_trueque: 0, product_code: '' })

  const load = () => api.get('/pricing/products').then((d: any) => setProducts(Array.isArray(d) ? d : d?.products ?? [])).catch(() => {})

  useEffect(() => { load() }, [])

  const create = async () => {
    setError('')
    if (!form.name || form.price_trueque <= 0) {
      setError('Nombre y precio son obligatorios')
      return
    }
    try {
      await api.post('/pricing/products', form)
      setForm({ name: '', description: '', unit: 'kWh', category: '', price_trueque: 0, product_code: '' })
      setShowForm(false)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear producto')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Package size={24} />Productos</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
          {canManage && (
            <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={18} />Nuevo</button>
          )}
        </div>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Productos - Ayuda</strong></p>
          <p><strong>Para que sirve:</strong> Este es el registro global de productos y servicios de la comunidad. Define que productos existen y cuanto cuestan. Los precios son fijos para todos: el mismo producto cuesta lo mismo para todos los miembros.</p>
          <p><strong>Precios fijos:</strong> Los precios se basan en el costo energetico real de producir el bien o servicio (E_total = energia directa + humana + insumos + amortizacion). No hay ganancia: es intercambio, no venta con lucro.</p>
          <p><strong>Quien crea productos:</strong> La asamblea decide que productos se agregan al registro y a que precio. Un usuario individual no puede crear productos por su cuenta. Si alguien tiene un producto nuevo, debe proponerlo en la asamblea.</p>
          <p><strong>NO es un inventario:</strong> Este registro no maneja cantidades. Cada usuario tiene su propia tienda donde maneja su inventario personal. Aqui solo se define el producto y su precio.</p>
          <p><strong>Tu tienda:</strong> Para vender productos, ve a la seccion Tienda. Ahi puedes agregar productos de este registro a tu tienda personal y manejar tu inventario.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {!canManage && (
        <div className="card bg-amber-50 border-amber-200 text-sm text-amber-700">
          Solo la asamblea puede agregar productos al registro. Si tienes un producto nuevo, propónlo en la sección Asamblea.
        </div>
      )}

      {showForm && canManage && (
        <div className="card space-y-4">
          <h2 className="font-semibold">Nuevo Producto</h2>
          <p className="text-xs text-gray-500">Registra un producto con su precio fijo. El precio se basa en el costo energetico de producirlo.</p>

          <div>
            <label className="label">Nombre del producto</label>
            <input className="input" placeholder="Ej: Pan integral 500g" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Nombre del producto o servicio.</p>
          </div>

          <div>
            <label className="label">Descripcion</label>
            <textarea className="input" rows={2} placeholder="Ej: Pan integral hecho con harina organica" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Descripcion detallada del producto.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Unidad de medida</label>
              <input className="input" placeholder="Ej: kWh, horas, kilos" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Como se mide el producto.</p>
            </div>
            <div>
              <label className="label">Categoria</label>
              <input className="input" placeholder="Ej: Alimentos" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Grupo del producto.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Precio ({currency})</label>
              <input type="number" className="input" value={form.price_trueque} onChange={(e) => setForm({ ...form, price_trueque: parseInt(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Precio fijo en Trueques. 1 {currency} = 1 kWh. Use la Calculadora para calcular el costo energetico.</p>
            </div>
            <div>
              <label className="label">Codigo de producto (opcional)</label>
              <input className="input" placeholder="Ej: PAN-001" value={form.product_code} onChange={(e) => setForm({ ...form, product_code: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Codigo unico para identificar el producto en QR/NFC.</p>
            </div>
          </div>

          <button onClick={create} className="btn-primary">Guardar</button>
        </div>
      )}

      {products.length === 0 && !showForm ? (
        <div className="card text-center text-gray-500 py-8">
          <p>No hay productos registrados.</p>
          <p className="text-xs mt-2">La asamblea debe agregar productos al registro. Usa el boton de ayuda (?) para entender como funciona.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {products.map((p, i) => (
            <div key={i} className="card">
              <h3 className="font-semibold">{p.name}</h3>
              <p className="text-sm text-gray-600">{p.description}</p>
              <div className="mt-3 space-y-1">
                <p className="text-lg font-bold text-trueque-700">{p.price_trueque} {currency}</p>
                <p className="text-xs text-gray-400">Unidad: {p.unit} | Categoria: {p.category || 'N/A'}</p>
                {p.product_code && <p className="text-xs text-gray-400">Codigo: {p.product_code}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
