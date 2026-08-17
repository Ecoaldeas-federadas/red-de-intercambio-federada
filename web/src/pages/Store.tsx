import { useState, useEffect } from 'react'
import { api } from '../api'
import { ShoppingCart, Plus, HelpCircle, Package } from 'lucide-react'

export default function Store() {
  const [items, setItems] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ product_name: '', description: '', category: '', origin: 'local', price_trueque: 0, stock: 0 })

  const load = () => api.get('/store/items').then((d: any) => setItems(Array.isArray(d) ? d : [])).catch(() => {})
  useEffect(() => { load() }, [])

  const addItem = async () => {
    setError('')
    if (!form.product_name || form.price_trueque <= 0) {
      setError('Nombre y precio son obligatorios')
      return
    }
    try {
      await api.post('/store/items', form)
      setShowForm(false)
      setForm({ product_name: '', description: '', category: '', origin: 'local', price_trueque: 0, stock: 0 })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear item')
    }
  }

  const buy = async (id: string) => {
    const qty = prompt('Cantidad a comprar?')
    if (!qty) return
    try {
      await api.post('/store/purchase', { item_id: id, quantity: parseInt(qty) })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al comprar')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Package size={24} />Tienda Comunitaria</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={18} />Nuevo</button>
        </div>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
          <p><strong>Tienda Comunitaria - Ayuda</strong></p>
          <p><strong>Que es:</strong> La tienda es donde los miembros ofrecen productos y servicios a la comunidad. Los precios estan en Trueques (TQ), la moneda interna anclada a energia (1 TQ = 1 kWh).</p>
          <p><strong>Origen:</strong> "local" = producido en este nodo, "import" = viene de otro nodo federado, "external" = viene de fuera de la red.</p>
          <p><strong>Comprar:</strong> Al comprar, el monto se transfiere de tu cuenta al vendedor. Tu saldo puede quedar negativo (deuda) hasta el limite de debito.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {showForm && (
        <div className="card space-y-4">
          <h2 className="font-semibold">Nuevo Producto en Tienda</h2>

          <div>
            <label className="label">Nombre del producto</label>
            <input className="input" placeholder="Ej: Pan integral" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
          </div>

          <div>
            <label className="label">Descripcion</label>
            <textarea className="input" rows={2} placeholder="Ej: Pan integral hecho con harina organica, 500g" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria</label>
              <input className="input" placeholder="Ej: Alimentos" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Grupo del producto (alimentos, servicios, herramientas, etc).</p>
            </div>
            <div>
              <label className="label">Origen</label>
              <select className="input" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })}>
                <option value="local">Local (producido en este nodo)</option>
                <option value="import">Importado (de otro nodo federado)</option>
                <option value="external">Externo (fuera de la red)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Precio (TQ)</label>
              <input type="number" className="input" value={form.price_trueque} onChange={(e) => setForm({ ...form, price_trueque: parseInt(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Precio en Trueques. 1 TQ = 1 kWh de energia.</p>
            </div>
            <div>
              <label className="label">Stock disponible</label>
              <input type="number" className="input" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Cantidad disponible. 0 = agotado.</p>
            </div>
          </div>

          <button onClick={addItem} className="btn-primary">Guardar</button>
        </div>
      )}

      {items.length === 0 && !showForm ? (
        <div className="card text-center text-gray-500 py-8">
          No hay productos en la tienda.
          <br />
          <span className="text-sm">Agrega el primer producto con el boton de arriba.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {items.map((item, i) => (
            <div key={i} className="card">
              <h3 className="font-semibold">{item.product_name}</h3>
              <p className="text-sm text-gray-600">{item.description}</p>
              {item.category && <p className="text-xs text-gray-400 mt-1">Categoria: {item.category}</p>}
              <div className="flex items-center justify-between mt-3">
                <span className="text-lg font-bold text-trueque-700">{item.price_trueque} TQ</span>
                <span className="text-sm text-gray-500">Stock: {item.stock}</span>
              </div>
              <button onClick={() => buy(item.id)} className="btn-primary w-full mt-3 flex items-center justify-center gap-2"><ShoppingCart size={16} />Comprar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
