import { useState, useEffect } from 'react'
import { api } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { useConfig } from '../hooks/useConfig'
import { HelpCircle, Plus, Edit, Trash2, Check, Search, Zap, Package } from 'lucide-react'

export default function CalculatorParams() {
  const { hasPermission } = usePermissions()
  const { currency } = useConfig()
  const canManage = hasPermission('calculator.manage_params')

  const [showHelp, setShowHelp] = useState(false)
  const [tab, setTab] = useState<'work' | 'material'>('work')
  const [params, setParams] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({
    type: 'work', category: '', subcategory: '', name: '', description: '',
    unit: 'horas', kwh_per_unit: 0, effort_factor: 1.0,
  })

  const [showCatForm, setShowCatForm] = useState(false)
  const [catForm, setCatForm] = useState({ type: 'work', name: '', description: '' })

  const load = () => {
    api.get(`/calculator/params?type=${tab}${filterCat ? `&category=${filterCat}` : ''}`).then((d: any) => {
      setParams(Array.isArray(d) ? d : [])
    }).catch(() => setParams([]))
    api.get(`/calculator/categories?type=${tab}`).then((d: any) => {
      setCategories(Array.isArray(d) ? d : [])
    }).catch(() => setCategories([]))
  }

  useEffect(() => { load() }, [tab])

  const filtered = params.filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !(p.description || '').toLowerCase().includes(search.toLowerCase())) return false
    if (filterCat && p.category !== filterCat) return false
    return true
  })

  const grouped = filtered.reduce((acc: any, p: any) => {
    const cat = p.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  const save = async () => {
    setError(''); setSuccess('')
    if (!form.name || !form.category) {
      setError('Nombre y categoria son obligatorios')
      return
    }
    if (form.kwh_per_unit <= 0) {
      setError('El costo en kWh debe ser mayor a 0')
      return
    }
    try {
      const payload = { ...form, type: tab }
      if (editing) {
        await api.put(`/calculator/params/${editing.id}`, payload)
        setSuccess('Parametro actualizado. Pendiente de reaprobacion.')
      } else {
        await api.post('/calculator/params', payload)
        setSuccess('Parametro creado. Pendiente de aprobacion de asamblea.')
      }
      setShowForm(false)
      setEditing(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const edit = (p: any) => {
    setEditing(p)
    setForm({
      type: p.type, category: p.category, subcategory: p.subcategory || '',
      name: p.name, description: p.description || '', unit: p.unit || '',
      kwh_per_unit: p.kwh_per_unit, effort_factor: p.effort_factor || 1.0,
    })
    setShowForm(true)
  }

  const approve = async (id: string) => {
    try {
      await api.post(`/calculator/params/${id}/approve`)
      setSuccess('Parametro aprobado')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Eliminar este parametro?')) return
    try {
      await api.delete(`/calculator/params/${id}`)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const saveCategory = async () => {
    setError('')
    if (!catForm.name) {
      setError('Nombre de categoria obligatorio')
      return
    }
    try {
      await api.post('/calculator/categories', { ...catForm, type: tab })
      setSuccess('Categoria creada')
      setShowCatForm(false)
      setCatForm({ type: tab, name: '', description: '' })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Zap size={24} />Parametros de Calculadora</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Parametros de Calculadora - Ayuda</strong></p>
          <p><strong>Para que sirve:</strong> Aqui se gestionan todos los tipos de trabajo e insumos que usa la calculadora de precios. Cada parametro tiene un costo en kWh (energia) que se usa para calcular precios justos.</p>
          <p><strong>Tipos de trabajo:</strong> Definen cuanto energia gasta una hora de cada tipo de trabajo (ej: albañileria = 0.19 kWh/hora).</p>
          <p><strong>Insumos/Materiales:</strong> Definen cuanto energia cuesta cada material (ej: harina = 1.8 kWh/kg).</p>
          <p><strong>Categorias:</strong> Agrupan parametros similares para encontrarlos facil. Puedes crear nuevas categorias.</p>
          <p><strong>Aprobacion:</strong> Todo parametro nuevo o modificado debe ser aprobado por asamblea. Los no aprobados no aparecen en la calculadora.</p>
          <p><strong>Factor de esfuerzo:</strong> Para trabajos especialmente dificiles, multiplica el costo (1.0 = normal, 1.3 = 30% mas).</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
      {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg">{success}</div>}

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('work')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'work' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Tipos de Trabajo</button>
        <button onClick={() => setTab('material')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'material' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Insumos/Materiales</button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <select className="input" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="">Todas las categorias</option>
          {categories.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
        </select>
        {canManage && (
          <>
            <button onClick={() => { setShowCatForm(!showCatForm); setCatForm({ type: tab, name: '', description: '' }) }} className="btn-secondary text-sm">Nueva Categoria</button>
            <button onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ type: tab, category: '', subcategory: '', name: '', description: '', unit: tab === 'work' ? 'horas' : 'unidad', kwh_per_unit: 0, effort_factor: 1.0 }) }} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />Nuevo Parametro</button>
          </>
        )}
      </div>

      {showCatForm && canManage && (
        <div className="card space-y-3">
          <h3 className="font-semibold">Nueva Categoria ({tab === 'work' ? 'Trabajo' : 'Material'})</h3>
          <div>
            <label className="label">Nombre</label>
            <input className="input" placeholder="Ej: Transporte" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Descripcion</label>
            <input className="input" placeholder="Ej: Trabajos relacionados con transporte" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
          </div>
          <button onClick={saveCategory} className="btn-primary">Crear Categoria</button>
        </div>
      )}

      {showForm && canManage && (
        <div className="card space-y-4">
          <h3 className="font-semibold">{editing ? 'Editar Parametro' : 'Nuevo Parametro'} ({tab === 'work' ? 'Tipo de Trabajo' : 'Insumo/Material'})</h3>
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Seleccionar...</option>
              {categories.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">A que categoria pertenece. Si necesitas una nueva, creala primero.</p>
          </div>
          <div>
            <label className="label">Subcategoria (opcional)</label>
            <input className="input" placeholder="Ej: Manual, Electrica" value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
          </div>
          <div>
            <label className="label">Nombre</label>
            <input className="input" placeholder={tab === 'work' ? 'Ej: Carpinteria manual' : 'Ej: Harina de trigo'} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Descripcion</label>
            <input className="input" placeholder="Breve descripcion" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Unidad</label>
              <input className="input" placeholder={tab === 'work' ? 'horas' : 'kg, litros, metros...'} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">{tab === 'work' ? 'Normalmente "horas"' : 'kg, litros, metros, unidades, etc'}</p>
            </div>
            <div>
              <label className="label">Costo energetico (kWh por unidad)</label>
              <input type="number" step="0.0001" className="input" value={form.kwh_per_unit} onChange={(e) => setForm({ ...form, kwh_per_unit: parseFloat(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">1 {currency} = 1 kWh</p>
            </div>
          </div>
          {tab === 'work' && (
            <div>
              <label className="label">Factor de esfuerzo</label>
              <input type="number" step="0.05" className="input" value={form.effort_factor} onChange={(e) => setForm({ ...form, effort_factor: parseFloat(e.target.value) || 1.0 })} />
              <p className="text-xs text-gray-400 mt-1">1.0 = normal, 1.3 = 30% mas esfuerzo, 0.8 = 20% menos. Para trabajos especialmente dificiles o faciles.</p>
            </div>
          )}
          <button onClick={save} className="btn-primary">{editing ? 'Actualizar' : 'Crear'} (pendiente de aprobacion)</button>
        </div>
      )}

      {Object.keys(grouped).length === 0 ? (
        <div className="card text-center text-gray-500 py-8">
          <p>No hay parametros {filterCat ? `en la categoria "${filterCat}"` : ''}.</p>
          {canManage && <p className="text-xs mt-2">Crea uno nuevo con el boton "Nuevo Parametro".</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, items]: any) => (
            <div key={cat} className="card">
              <h3 className="font-semibold text-trueque-700 mb-3 flex items-center gap-2">
                {tab === 'work' ? <Zap size={16} /> : <Package size={16} />}
                {cat}
                <span className="text-xs text-gray-400">({items.length})</span>
              </h3>
              <div className="space-y-2">
                {items.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <b className="text-sm">{p.name}</b>
                        {p.subcategory && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{p.subcategory}</span>}
                        {!p.approved && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Pendiente</span>}
                        {!p.is_active && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Inactivo</span>}
                      </div>
                      {p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.kwh_per_unit} kWh/{p.unit}
                        {tab === 'work' && p.effort_factor !== 1.0 && ` | Esfuerzo: x${p.effort_factor}`}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        {!p.approved && <button onClick={() => approve(p.id)} className="text-green-600 hover:bg-green-50 p-1 rounded" title="Aprobar"><Check size={16} /></button>}
                        <button onClick={() => edit(p)} className="text-blue-500 hover:bg-blue-50 p-1 rounded" title="Editar"><Edit size={16} /></button>
                        <button onClick={() => remove(p.id)} className="text-red-500 hover:bg-red-50 p-1 rounded" title="Eliminar"><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
