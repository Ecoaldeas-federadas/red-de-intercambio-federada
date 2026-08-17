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
          <p><strong>Que son los parametros:</strong> Los parametros son los valores de referencia que usa la calculadora de precios para determinar el costo energetico (en kWh) de cualquier trabajo o insumo. Sin estos parametros, la calculadora no puede asignar un precio justo a los productos y servicios del nodo. Cada parametro define cuanto energia representa una unidad de trabajo o de material.</p>
          <p><strong>Para que sirve esta pagina:</strong> Aqui se gestionan todos los tipos de trabajo e insumos que usa la calculadora de precios. Puedes crear, editar, aprobar y desactivar parametros, asi como organizarlos en categorias. Es el panel de control del sistema de precios del nodo.</p>
          <p><strong>Como se usa:</strong> 1) Selecciona la pestana "Tipos de Trabajo" o "Insumos/Materiales" segun lo que quieras gestionar. 2) Usa el buscador y el filtro de categoria para encontrar parametros existentes. 3) Crea categorias nuevas si las necesitas. 4) Crea parametros nuevos con el boton "Nuevo Parametro". 5) Aprueba los parametros pendientes con el boton de check verde. 6) Edita o elimina parametros existentes segun sea necesario.</p>
          <p><strong>Tipos de trabajo (administrativo, tecnico, agricola):</strong> Definen cuanto energia gasta una hora de cada tipo de trabajo. Por ejemplo: trabajo administrativo (ej: atencion al publico = 0.05 kWh/hora), trabajo tecnico (ej: albañileria = 0.19 kWh/hora, programacion = 0.12 kWh/hora), trabajo agricola (ej: cosecha manual = 0.15 kWh/hora, tractor = 0.30 kWh/hora). El costo energetico refleja el esfuerzo fisico/intelectual y las herramientas necesarias.</p>
          <p><strong>Insumos/Materiales:</strong> Definen cuanto energia cuesta cada material que se usa en la produccion. Por ejemplo: harina de trigo = 1.8 kWh/kg, madera = 2.5 kWh/m3, electricidad = 1.0 kWh/kWh. Estos valores representan la energia total invertida en producir, transportar y almacenar cada insumo.</p>
          <p><strong>Categorias:</strong> Agrupan parametros similares para encontrarlos facil. Por ejemplo: "Construccion" agrupa albañileria, plomeria, electricidad; "Alimentos" agrupa harina, azucar, verduras. Puedes crear nuevas categorias segun las necesidades de tu nodo.</p>
          <p><strong>Factor de esfuerzo:</strong> Para trabajos especialmente dificiles o faciles, multiplica el costo energetico base. 1.0 = esfuerzo normal (sin cambio), 1.3 = 30% mas esfuerzo (trabajo pesado, condiciones adversas), 0.8 = 20% menos esfuerzo (trabajo ligero, con maquinaria que facilita la tarea). Solo aplica a tipos de trabajo, no a insumos.</p>
          <p><strong>Como se aprueban los parametros:</strong> Todo parametro nuevo o modificado queda en estado "Pendiente" y debe ser aprobado por asamblea. Los parametros no aprobados no aparecen en la calculadora. Un usuario con permiso de gestion (calculator.manage_params) puede aprobarlos con el boton de check verde. Esto asegura que la comunidad valide cada cambio en el sistema de precios.</p>
          <p><strong>Quien los puede cambiar:</strong> Solo los usuarios con el permiso "calculator.manage_params" pueden crear, editar, aprobar y eliminar parametros. El resto de usuarios puede verlos pero no modificarlos. La aprobacion final requiere decision asamblearia.</p>
          <p><strong>Moneda local:</strong> Los costos se expresan en kWh (1 {currency} = 1 kWh). El simbolo de tu moneda local es "{currency}" y aparece en los textos de ayuda de los campos.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
      {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg">{success}</div>}

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('work')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'work' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Tipos de Trabajo</button>
        <button onClick={() => setTab('material')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'material' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Insumos/Materiales</button>
      </div>

      <div className="flex gap-2 flex-wrap items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Buscar parametro</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input className="input pl-9" placeholder="Ej: carpinteria, harina, albañileria..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <p className="text-xs text-gray-400 mt-1">Escribe parte del nombre o descripcion del parametro que buscas. Ej: "carpinteria" para encontrar todos los parametros relacionados con carpinteria.</p>
        </div>
        <div>
          <label className="label">Filtrar por categoria</label>
          <select className="input" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">Todas las categorias</option>
            {categories.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
          </select>
          <p className="text-xs text-gray-400 mt-1">Selecciona una categoria para ver solo sus parametros. Ej: "Construccion" para ver albañileria, plomeria, etc.</p>
        </div>
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
            <label className="label">Nombre de la categoria</label>
            <input className="input" placeholder="Ej: Transporte" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Nombre corto que agrupa parametros similares. Ej: "Transporte", "Construccion", "Alimentos", "Salud".</p>
          </div>
          <div>
            <label className="label">Descripcion de la categoria</label>
            <input className="input" placeholder="Ej: Trabajos relacionados con transporte de personas y mercancias" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Breve explicacion de que tipos de parametros pertenecen a esta categoria. Ej: "Trabajos manuales relacionados con la construccion de edificios".</p>
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
              <option value="">Seleccionar categoria...</option>
              {categories.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">A que categoria pertenece este parametro. Ej: "Construccion" para albañileria, "Alimentos" para harina. Si necesitas una categoria nueva, creala primero con el boton "Nueva Categoria".</p>
          </div>
          <div>
            <label className="label">Subcategoria (opcional)</label>
            <input className="input" placeholder="Ej: Manual, Electrica, Pesada" value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Subgrupo dentro de la categoria para mayor detalle. Ej: dentro de "Carpinteria" podrias tener "Manual" y "Electrica". Dejar vacio si no aplica.</p>
          </div>
          <div>
            <label className="label">Nombre del parametro</label>
            <input className="input" placeholder={tab === 'work' ? 'Ej: Carpinteria manual' : 'Ej: Harina de trigo'} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Nombre claro del trabajo o insumo. {tab === 'work' ? 'Ej: "Carpinteria manual", "Programacion web", "Atencion al publico".' : 'Ej: "Harina de trigo", "Madera de pino", "Electricidad".'}</p>
          </div>
          <div>
            <label className="label">Descripcion del parametro</label>
            <input className="input" placeholder={tab === 'work' ? 'Ej: Trabajo manual con herramientas basicas de carpinteria' : 'Ej: Harina de trigo refinada, paquete de 1 kg'} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Breve descripcion que ayude a identificar el parametro. Ej: "Trabajo manual con herramientas basicas, sin maquinaria electrica".</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Unidad de medida</label>
              <input className="input" placeholder={tab === 'work' ? 'Ej: horas' : 'Ej: kg, litros, metros, unidades'} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">{tab === 'work' ? 'Normalmente "horas" (costo por hora de trabajo). Ej: "horas", "jornada".' : 'Unidad en que se mide el material. Ej: "kg", "litros", "metros", "unidades", "m3".'}</p>
            </div>
            <div>
              <label className="label">Costo energetico (kWh por unidad)</label>
              <input type="number" step="0.0001" className="input" placeholder="Ej: 0.19" value={form.kwh_per_unit} onChange={(e) => setForm({ ...form, kwh_per_unit: parseFloat(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Cuanta energia (kWh) representa una unidad. 1 {currency} = 1 kWh. {tab === 'work' ? 'Ej: albañileria = 0.19 kWh/hora, atencion al publico = 0.05 kWh/hora.' : 'Ej: harina = 1.8 kWh/kg, madera = 2.5 kWh/m3.'}</p>
            </div>
          </div>
          {tab === 'work' && (
            <div>
              <label className="label">Factor de esfuerzo</label>
              <input type="number" step="0.05" className="input" placeholder="Ej: 1.0 (normal), 1.3 (30% mas), 0.8 (20% menos)" value={form.effort_factor} onChange={(e) => setForm({ ...form, effort_factor: parseFloat(e.target.value) || 1.0 })} />
              <p className="text-xs text-gray-400 mt-1">Multiplica el costo energetico segun la dificultad del trabajo. 1.0 = normal (sin cambio), 1.3 = 30% mas esfuerzo (ej: trabajo pesado con condiciones adversas), 0.8 = 20% menos (ej: trabajo asistido por maquinaria).</p>
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
