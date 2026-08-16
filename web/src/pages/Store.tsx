import { useState, useEffect } from 'react'
import { api } from '../api'
import { ShoppingCart, Plus } from 'lucide-react'

export default function Store() {
  const [items, setItems] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ product_name: '', description: '', category: '', origin: 'local', price_trueque: 0, stock: 0 })

  const load = () => api.get('/store/items').then((d: any) => setItems(Array.isArray(d) ? d : [])).catch(() => {})

  useEffect(() => { load() }, [])

  const addItem = async () => {
    await api.post('/store/items', form)
    setShowForm(false)
    setForm({ product_name: '', description: '', category: '', origin: 'local', price_trueque: 0, stock: 0 })
    load()
  }

  const buy = async (id: string) => {
    const qty = prompt('Cantidad a comprar?')
    if (!qty) return
    await api.post('/store/purchase', { item_id: id, buyer_id: 'me', quantity: parseInt(qty) })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tienda Comunitaria</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={18} />Nuevo</button>
      </div>
      {showForm && (
        <div className="card space-y-3">
          <input className="input" placeholder="Nombre" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
          <input className="input" placeholder="Descripcion" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2">
            <input className="input" placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <input className="input" placeholder="Origen" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <input type="number" className="input" placeholder="Precio TQ" value={form.price_trueque} onChange={(e) => setForm({ ...form, price_trueque: parseInt(e.target.value) || 0 })} />
            <input type="number" className="input" placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} />
          </div>
          <button onClick={addItem} className="btn-primary">Guardar</button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((item, i) => (
          <div key={i} className="card">
            <h3 className="font-semibold">{item.product_name}</h3>
            <p className="text-sm text-gray-600">{item.description}</p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-lg font-bold text-trueque-700">{item.price_trueque} TQ</span>
              <span className="text-sm text-gray-500">Stock: {item.stock}</span>
            </div>
            <button onClick={() => buy(item.id)} className="btn-primary w-full mt-3 flex items-center justify-center gap-2"><ShoppingCart size={16} />Comprar</button>
          </div>
        ))}
      </div>
    </div>
  )
}
