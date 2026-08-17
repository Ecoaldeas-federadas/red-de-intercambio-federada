import { useState, useEffect } from 'react'
import { api } from '../api'
import { ShoppingCart, Plus, HelpCircle, Package, Trash2 } from 'lucide-react'

export default function Store() {
  const [items, setItems] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ product_id: '', stock: 0 })

  const load = () => {
    api.get('/store/items').then((d: any) => setItems(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/pricing/products').then((d: any) => setProducts(Array.isArray(d) ? d : d?.products ?? [])).catch(() => {})
  }

  useEffect(() => { load() }, [])

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
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingCart size={24} />Mi Tienda</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={18} />Agregar Producto</button>
        </div>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Mi Tienda - Ayuda</strong></p>
          <p><strong>Para que sirve:</strong> Esta es tu tienda personal. Aqui administras los productos que vendes y tu inventario (cuantas unidades tienes de cada uno).</p>
          <p><strong>Productos del registro:</strong> Solo puedes vender productos que estan en el registro global de productos. Los precios ya estan fijados por la asamblea — no puedes cambiarlos.</p>
          <p><strong>Inventario:</strong> Tu manejas cuantas unidades tienes de cada producto. Cuando alguien te compra, el stock baja automaticamente. Si llegas a 0, el producto aparece como agotado.</p>
          <p><strong>Comprar:</strong> Otros usuarios pueden comprar productos de tu tienda. El monto se transfiere de su cuenta a la tuya al precio fijado.</p>
          <p><strong>Precios fijos:</strong> No puedes cambiar el precio de un producto. El precio lo establece la asamblea basado en el costo energetico. Es intercambio, no venta con ganancia.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {showForm && (
        <div className="card space-y-4">
          <h2 className="font-semibold">Agregar Producto a Mi Tienda</h2>
          <p className="text-xs text-gray-500">Selecciona un producto del registro global e indica cuantas unidades tienes disponibles.</p>

          <div>
            <label className="label">Producto</label>
            {products.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                No hay productos en el registro. La asamblea debe agregar productos primero.
              </p>
            ) : (
              <select className="input" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                <option value="">Seleccionar producto...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.price_trueque} TQ</option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-400 mt-1">Solo puedes vender productos del registro global. El precio es fijo.</p>
          </div>

          <div>
            <label className="label">Stock disponible</label>
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
                <div className="flex items-center justify-between mt-3">
                  <span className="text-lg font-bold text-trueque-700">{item.price_trueque || product?.price_trueque} TQ</span>
                  <span className={`text-sm ${item.stock === 0 ? 'text-red-500' : 'text-gray-500'}`}>
                    Stock: {item.stock}{item.stock === 0 ? ' (agotado)' : ''}
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => buy(item.id)} className="btn-primary flex-1 flex items-center justify-center gap-2"><ShoppingCart size={16} />Comprar</button>
                  <button onClick={() => removeItem(item.id)} className="btn-secondary text-red-600"><Trash2 size={16} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
