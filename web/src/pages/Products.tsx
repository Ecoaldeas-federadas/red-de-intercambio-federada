import { useState, useEffect } from 'react'
import { api } from '../api'
import { Plus } from 'lucide-react'

export default function Products() {
  const [products, setProducts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', unit: 'kWh', category: '' })

  const load = () => api.get('/pricing/products').then((d: any) => setProducts(Array.isArray(d) ? d : d?.products ?? [])).catch(() => {})

  useEffect(() => { load() }, [])

  const create = async () => {
    await api.post('/pricing/products', form)
    setForm({ name: '', description: '', unit: 'kWh', category: '' })
    setShowForm(false)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Productos</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={18} />Nuevo</button>
      </div>
      {showForm && (
        <div className="card space-y-3">
          <input className="input" placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Descripcion" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2">
            <input className="input" placeholder="Unidad" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <input className="input" placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
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
          </div>
        ))}
      </div>
    </div>
  )
}
