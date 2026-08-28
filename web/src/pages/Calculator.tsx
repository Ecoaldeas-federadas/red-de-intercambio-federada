import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Calculator as CalcIcon, HelpCircle, Plus, Trash2, X } from 'lucide-react'
import { fmtNumber } from '../lib/format'

// Tipos de trabajo predefinidos con su costo energetico (kWh por hora)
// Basado en estudios de costo energetico humano
const WORK_TYPES: { category: string; types: { name: string; kWhPerHour: number; description: string }[] }[] = [
  {
    category: 'Agricultura',
    types: [
      { name: 'Siembra manual', kWhPerHour: 0.15, description: 'Sembrar semillas a mano en el campo' },
      { name: 'Cosecha manual', kWhPerHour: 0.18, description: 'Recolectar frutos, verduras o granos a mano' },
      { name: 'Cavado de tierra', kWhPerHour: 0.22, description: 'Cavar o arar la tierra con pala/azadon' },
      { name: 'Riego manual', kWhPerHour: 0.12, description: 'Regar plantas con regadera o manguera' },
      { name: 'Cuidado de animales', kWhPerHour: 0.10, description: 'Alimentar, limpiar y cuidar animales' },
      { name: 'Ordeño manual', kWhPerHour: 0.14, description: 'Ordeñar vacas o cabras a mano' },
    ],
  },
  {
    category: 'Produccion de alimentos',
    types: [
      { name: 'Cocina a leña', kWhPerHour: 0.08, description: 'Cocinar usando fogon o leña' },
      { name: 'Cocina a gas', kWhPerHour: 0.06, description: 'Cocinar usando estufa de gas' },
      { name: 'Panaderia manual', kWhPerHour: 0.12, description: 'Amasar, formar y hornear pan a mano' },
      { name: 'Conservas y envasado', kWhPerHour: 0.10, description: 'Preparar conservas, mermeladas, encurtidos' },
      { name: 'Lacteos (queso/yogurt)', kWhPerHour: 0.11, description: 'Elaborar queso, yogurt o mantequilla' },
      { name: 'Molienda manual', kWhPerHour: 0.16, description: 'Moler granos, cafe o especias a mano' },
    ],
  },
  {
    category: 'Artesania y manufactura',
    types: [
      { name: 'Costura a mano', kWhPerHour: 0.07, description: 'Coser, bordar o tejer a mano' },
      { name: 'Costura a maquina', kWhPerHour: 0.05, description: 'Coser con maquina de coser electrica' },
      { name: 'Carpinteria manual', kWhPerHour: 0.17, description: 'Trabajar madera con herramientas manuales' },
      { name: 'Carpinteria electrica', kWhPerHour: 0.09, description: 'Trabajar madera con herramientas electricas' },
      { name: 'Ceramica/alfareria', kWhPerHour: 0.13, description: 'Modelar y cocer ceramica' },
      { name: 'Herreria', kWhPerHour: 0.20, description: 'Trabajar el metal con fragua' },
      { name: 'Joyeria manual', kWhPerHour: 0.08, description: 'Elaborar joyas a mano' },
    ],
  },
  {
    category: 'Construccion',
    types: [
      { name: 'Albañileria', kWhPerHour: 0.19, description: 'Levantar muros, mezclar cemento' },
      { name: 'Pintura', kWhPerHour: 0.09, description: 'Pintar paredes o superficies' },
      { name: 'Plomeria', kWhPerHour: 0.11, description: 'Instalar o reparar tuberias' },
      { name: 'Electricidad', kWhPerHour: 0.10, description: 'Instalar o reparar cableado electrico' },
    ],
  },
  {
    category: 'Servicios',
    types: [
      { name: 'Limpieza', kWhPerHour: 0.06, description: 'Limpieza de espacios o viviendas' },
      { name: 'Cuidado de personas', kWhPerHour: 0.07, description: 'Cuidar niños, ancianos o enfermos' },
      { name: 'Enseñanza', kWhPerHour: 0.05, description: 'Dar clases o talleres' },
      { name: 'Transporte manual', kWhPerHour: 0.14, description: 'Cargar y transportar objetos pesados' },
      { name: 'Reparaciones generales', kWhPerHour: 0.10, description: 'Reparar electrodomesticos, muebles, etc' },
    ],
  },
  {
    category: 'Trabajo intelectual',
    types: [
      { name: 'Oficina/administracion', kWhPerHour: 0.03, description: 'Trabajo de oficina, contabilidad, gestion' },
      { name: 'Computacion/programacion', kWhPerHour: 0.04, description: 'Trabajo con computadora' },
      { name: 'Diseno/escritura', kWhPerHour: 0.04, description: 'Disenar, escribir, crear contenido' },
    ],
  },
]

// Insumos comunes con su costo energetico aproximado (kWh por unidad)
const COMMON_INPUTS: { name: string; unit: string; kWhPerUnit: number }[] = [
  { name: 'Agua potable', unit: 'litros', kWhPerUnit: 0.0003 },
  { name: 'Electricidad', unit: 'kWh', kWhPerUnit: 1.0 },
  { name: 'Gas natural', unit: 'm3', kWhPerUnit: 10.5 },
  { name: 'Gas de cilindro', unit: 'kg', kWhPerUnit: 13.9 },
  { name: 'Leña', unit: 'kg', kWhPerUnit: 4.0 },
  { name: 'Carbón', unit: 'kg', kWhPerUnit: 8.0 },
  { name: 'Sal', unit: 'kg', kWhPerUnit: 0.7 },
  { name: 'Azúcar', unit: 'kg', kWhPerUnit: 1.5 },
  { name: 'Harina de trigo', unit: 'kg', kWhPerUnit: 1.8 },
  { name: 'Harina de maiz', unit: 'kg', kWhPerUnit: 1.6 },
  { name: 'Arroz', unit: 'kg', kWhPerUnit: 2.0 },
  { name: 'Frijoles', unit: 'kg', kWhPerUnit: 2.2 },
  { name: 'Aceite vegetal', unit: 'litros', kWhPerUnit: 5.0 },
  { name: 'Leche', unit: 'litros', kWhPerUnit: 0.8 },
  { name: 'Huevos', unit: 'docena', kWhPerUnit: 1.2 },
  { name: 'Madera', unit: 'kg', kWhPerUnit: 2.5 },
  { name: 'Cemento', unit: 'kg', kWhPerUnit: 1.4 },
  { name: 'Alambre/hierro', unit: 'kg', kWhPerUnit: 8.5 },
  { name: 'Tela de algodon', unit: 'metros', kWhPerUnit: 3.0 },
  { name: 'Hilo', unit: 'rollos', kWhPerUnit: 0.5 },
]

interface InputItem {
  id: string
  name: string
  unit: string
  quantity: number
  kWhPerUnit: number
}

interface WorkItem {
  id: string
  typeName: string
  kWhPerHour: number
  hours: number
}

export default function Calculator() {
  const { currency } = useConfig()
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple')
  const [showHelp, setShowHelp] = useState(false)
  const [products, setProducts] = useState<any[]>([])
  const [error, setError] = useState('')

  // Parametros dinamicos desde la BD
  const [workParams, setWorkParams] = useState<any[]>([])
  const [materialParams, setMaterialParams] = useState<any[]>([])
  const [tariff, setTariff] = useState<any>(null)

  // Simple mode state
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [inputs, setInputs] = useState<InputItem[]>([])
  const [selectedWorkCategory, setSelectedWorkCategory] = useState('')
  const [selectedWorkType, setSelectedWorkType] = useState('')
  const [workHours, setWorkHours] = useState(1)
  const [selectedInput, setSelectedInput] = useState('')
  const [inputQty, setInputQty] = useState(1)
  const [result, setResult] = useState<{ workKWh: number; inputsKWh: number; totalKWh: number; totalTQ: number } | null>(null)

  // Advanced mode state
  const [advForm, setAdvForm] = useState({ e_direct: 0, e_human: 0, e_inputs: 0, e_amortization: 0, effort_factor: 1.0, tariff: 1.0 })

  useEffect(() => {
    api.get('/products').then((d: any) => setProducts(Array.isArray(d) ? d : d?.products ?? [])).catch(() => {})
    // Cargar parametros aprobados desde la BD
    api.get('/calculator/params?type=work&approved=true').then((d: any) => setWorkParams(Array.isArray(d) ? d : [])).catch(() => setWorkParams([]))
    api.get('/calculator/params?type=material&approved=true').then((d: any) => setMaterialParams(Array.isArray(d) ? d : [])).catch(() => setMaterialParams([]))
    // Cargar tarifa energetica para calculo dinamico
    api.get('/calculator/tariff').then((d: any) => setTariff(d)).catch(() => setTariff(null))
  }, [])

  // Categorias dinamicas agrupadas desde workParams
  const workCategories = workParams.reduce((acc: any, p: any) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {})

  // Insumos filtrados por la categoria de trabajo seleccionada
  // Si hay categoria seleccionada, mostrar solo insumos de esa categoria
  // Si no, mostrar todos
  const filteredMaterialParams = selectedWorkCategory
    ? materialParams.filter((m: any) => m.category === selectedWorkCategory)
    : materialParams

  // Calcular base_rate dinamico desde la tarifa energetica (canasta vital)
  // base_rate = (vital_food + vital_water + vital_domestic + vital_services) / work_hours_per_day
  const baseRate = tariff
    ? (tariff.vital_food + tariff.vital_water + tariff.vital_domestic + tariff.vital_services) / (tariff.work_hours_per_day || 8)
    : 1.0

  // Obtener el factor de esfuerzo de la tarifa segun tariff_category
  const getTariffEffortFactor = (tariffCategory: string): number => {
    if (!tariff || !tariffCategory) return 1.0
    switch (tariffCategory) {
      case 'agricultural': return tariff.effort_agricultural || 0.61
      case 'technical': return tariff.effort_technical || 3.0
      case 'admin': return tariff.effort_admin || 1.0
      default: return 1.0
    }
  }

  // Calcular kWh por hora para un parametro de trabajo
  // SIEMPRE usa la tarifa base (canasta vital / horas por dia) como minimo.
  // El effort_factor de la tarifa AJUSTA hacia arriba (trabajo mas dificil).
  // Si el effort_factor < 1.0, se usa 1.0 como minimo (nunca paga menos que la base).
  // El kwh_per_unit manual se SUMA al base, no lo reemplaza.
  const getKwhPerHour = (param: any): number => {
    const effortFromTariff = param.tariff_category ? getTariffEffortFactor(param.tariff_category) : 1.0
    const amplification = param.effort_factor || 1.0
    // Base: tarifa base × max(1.0, esfuerzo) × amplificacion
    // max(1.0, esfuerzo) asegura que el pago nunca sea menor que la tarifa base
    const base = baseRate * Math.max(1.0, effortFromTariff) * amplification
    // Adicional: kwh_per_unit manual se SUMA al base, no lo reemplaza
    const additional = param.kwh_per_unit > 0 ? param.kwh_per_unit : 0
    return base + additional
  }

  const addWork = () => {
    if (!selectedWorkType) return
    const param = workParams.find((p: any) => p.name === selectedWorkType && p.category === selectedWorkCategory)
    if (!param) return
    setWorkItems([...workItems, {
      id: crypto.randomUUID(),
      typeName: param.name,
      kWhPerHour: getKwhPerHour(param),
      hours: workHours,
    }])
    setSelectedWorkType('')
    setWorkHours(1)
  }

  const removeWork = (id: string) => setWorkItems(workItems.filter((w) => w.id !== id))

  const addInput = () => {
    if (!selectedInput) return
    const item = materialParams.find((i: any) => i.name === selectedInput)
    if (!item) return
    setInputs([...inputs, {
      id: crypto.randomUUID(),
      name: item.name,
      unit: item.unit || 'unidad',
      quantity: inputQty,
      kWhPerUnit: item.kwh_per_unit,
    }])
    setSelectedInput('')
    setInputQty(1)
  }

  const addProductAsInput = (product: any) => {
    setInputs([...inputs, {
      id: crypto.randomUUID(),
      name: product.name,
      unit: product.unit || 'unidad',
      quantity: 1,
      kWhPerUnit: product.price_trueque || 0,
    }])
  }

  const removeInput = (id: string) => setInputs(inputs.filter((i) => i.id !== id))

  const calculate = () => {
    setError('')
    const workKWh = workItems.reduce((sum, w) => sum + w.kWhPerHour * w.hours, 0)
    const inputsKWh = inputs.reduce((sum, i) => sum + i.kWhPerUnit * i.quantity, 0)
    const totalKWh = workKWh + inputsKWh
    const totalTQ = totalKWh // 1 TQ = 1 kWh
    setResult({ workKWh, inputsKWh, totalKWh, totalTQ })
  }

  const calculateAdvanced = async () => {
    setError('')
    try {
      const res = await api.post('/pricing/calculate', advForm)
      setResult({
        workKWh: advForm.e_human,
        inputsKWh: advForm.e_inputs + advForm.e_direct,
        totalKWh: res.total_energy ?? (advForm.e_direct + advForm.e_human + advForm.e_inputs + advForm.e_amortization) * advForm.effort_factor * advForm.tariff,
        totalTQ: res.price_trueque ?? (advForm.e_direct + advForm.e_human + advForm.e_inputs + advForm.e_amortization) * advForm.effort_factor * advForm.tariff,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al calcular')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><CalcIcon size={24} />Calculadora de Precios</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
        </div>
      </div>

      {/* Selector de modo */}
      <div className="flex gap-2">
        <button onClick={() => setMode('simple')} className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === 'simple' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>
          Modo facil (cuestionario)
        </button>
        <button onClick={() => setMode('advanced')} className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === 'advanced' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>
          Modo avanzado (numeros)
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Calculadora de Precios - Ayuda</strong></p>
          <p><strong>Que es la calculadora:</strong> Es una herramienta que calcula el precio justo de un producto o servicio basandose en su costo energetico real. El precio en {currency} equivale a la energia total invertida en producirlo: 1 {currency} = 1 kWh. No hay ganancia ni especulacion: el precio refleja el trabajo y los materiales.</p>
          <p><strong>Para que sirve:</strong> Sirve para determinar el precio energetico de cualquier producto o servicio antes de proponerlo a la asamblea. Asi todos los precios son justos, transparentes y comparables. El resultado lo llevas a la asamblea para que lo aprueben y lo agreguen al catalogo.</p>
          <p><strong>Como funciona:</strong> Tienes dos modos. El <strong>Modo facil</strong> te guia con un cuestionario: seleccionas el tipo de trabajo, las horas, y los materiales usaste; el sistema calcula todo. El <strong>Modo avanzado</strong> permite ingresar los valores energeticos directamente en kWh si los conoces.</p>
          <p><strong>Que es la energia directa:</strong> Es la energia consumida directamente en el proceso: electricidad, gas o combustible usado en la produccion. <strong>Ejemplo:</strong> 2 kWh de electricidad para hornear pan.</p>
          <p><strong>Que es la energia humana:</strong> Es la energia del trabajo humano invertido. Se calcula multiplicando las horas trabajadas por la tarifa energetica (canasta vital / horas por dia). <strong>Ejemplo:</strong> 3 horas de trabajo x 1.0 TQ/hora (tarifa base) = 3.0 TQ. Los factores de esfuerzo ajustan hacia arriba para trabajos mas dificiles.</p>
          <p><strong>Que es la energia de insumos:</strong> Es la energia incorporada en los materiales y materias primas usadas. Cada insumo tiene un costo energetico por unidad. <strong>Ejemplo:</strong> 1 kg de harina = 1.8 kWh, 0.5 kg de sal = 0.35 kWh.</p>
          <p><strong>Que es el factor de esfuerzo:</strong> Es un multiplicador que ajusta el costo si el trabajo es especialmente dificil o facil. 1.0 = normal, 1.5 = 50% mas esfuerzo, 0.8 = 20% menos. <strong>Ejemplo:</strong> Cavar tierra a 40°C tiene factor 1.5.</p>
          <p><strong>Como se calcula el precio final:</strong> Precio = (Energia directa + Energia humana + Energia de insumos + Amortizacion) x Factor de esfuerzo x Tarifa. El resultado es el precio sugerido en {currency}.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {/* MODO FACIL */}
      {mode === 'simple' && (
        <div className="space-y-4">
          {/* Paso 1: Trabajo */}
          <div className="card space-y-4">
            <h2 className="font-semibold">Paso 1: Que trabajo hiciste?</h2>
            <p className="text-xs text-gray-500">Selecciona el tipo de trabajo y cuantas horas trabajaste. El sistema sabe cuanto energia gasta cada tipo de trabajo.</p>

            <div>
              <label className="label">Categoria de trabajo</label>
              <select className="input" value={selectedWorkCategory} onChange={(e) => { setSelectedWorkCategory(e.target.value); setSelectedWorkType('') }}>
                <option value="">Seleccionar categoria...</option>
                {Object.keys(workCategories).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Las categorias y tipos se gestionan en Parametros de Calculadora.</p>
            </div>

            {selectedWorkCategory && (
              <div>
                <label className="label">Tipo de trabajo</label>
                <select className="input" value={selectedWorkType} onChange={(e) => setSelectedWorkType(e.target.value)}>
                  <option value="">Seleccionar tipo...</option>
                  {workCategories[selectedWorkCategory]?.map((t: any) => (
                    <option key={t.name} value={t.name}>{t.name} — {t.description || ''}</option>
                  ))}
                </select>
                {selectedWorkType && (
                  <p className="text-xs text-gray-400 mt-1">
                    Costo energetico: {(() => {
                      const p = workParams.find((pp: any) => pp.name === selectedWorkType)
                      if (!p) return '?'
                      const kwh = getKwhPerHour(p)
                      const effort = p.tariff_category ? getTariffEffortFactor(p.tariff_category) : 1.0
                      const effortUsed = Math.max(1.0, effort)
                      const additional = p.kwh_per_unit > 0 ? ` + ${p.kwh_per_unit} adicional` : ''
                      return `${fmtNumber(kwh, 2)} kWh/hora (base ${fmtNumber(baseRate, 1)} x esfuerzo ${effortUsed}${additional})`
                    })()}
                  </p>
                )}
              </div>
            )}

            {selectedWorkType && (
              <div>
                <label className="label">Horas trabajadas</label>
                <input type="number" min="0.5" step="0.5" className="input" value={workHours} onChange={(e) => setWorkHours(parseFloat(e.target.value) || 1)} />
                <p className="text-xs text-gray-400 mt-1">Cuantas horas dedicaste a este trabajo.</p>
              </div>
            )}

            {selectedWorkType && (
              <button onClick={addWork} className="btn-secondary flex items-center gap-2"><Plus size={16} /> Agregar trabajo</button>
            )}

            {/* Lista de trabajos agregados */}
            {workItems.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Trabajos agregados:</h3>
                {workItems.map((w) => (
                  <div key={w.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 text-sm">
                    <div>
                      <span className="font-medium">{w.typeName}</span>
                      <span className="text-gray-500 ml-2">{w.hours}h x {w.kWhPerHour} kWh/h = {fmtNumber(w.kWhPerHour * w.hours, 2)} kWh</span>
                    </div>
                    <button onClick={() => removeWork(w.id)} className="text-red-500"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Paso 2: Insumos */}
          <div className="card space-y-4">
            <h2 className="font-semibold">Paso 2: Que materiales/insumos usaste?</h2>
            <p className="text-xs text-gray-500">Agrega los materiales que usaste. Puedes seleccionar de la lista comun o de los productos ya registrados en la plataforma.</p>

            <div>
              <label className="label">Insumo comun {selectedWorkCategory && `(categoria: ${selectedWorkCategory})`}</label>
              <select className="input" value={selectedInput} onChange={(e) => setSelectedInput(e.target.value)}>
                <option value="">Seleccionar insumo...</option>
                {filteredMaterialParams.map((i: any) => (
                  <option key={i.name} value={i.name}>{i.name} (por {i.unit}) — {i.kwh_per_unit} kWh</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {selectedWorkCategory
                  ? `Mostrando insumos de la categoria "${selectedWorkCategory}". Los insumos se filtran segun el trabajo seleccionado.`
                  : 'Los insumos se gestionan en Parametros de Calculadora. Selecciona un trabajo para filtrar.'}
              </p>
            </div>

            {selectedInput && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="label">Cantidad ({materialParams.find((i: any) => i.name === selectedInput)?.unit})</label>
                  <input type="number" min="0.1" step="0.1" className="input" value={inputQty} onChange={(e) => setInputQty(parseFloat(e.target.value) || 1)} />
                </div>
                <button onClick={addInput} className="btn-secondary flex items-center gap-2"><Plus size={16} /> Agregar</button>
              </div>
            )}

            {/* Productos del registro como insumos */}
            {products.length > 0 && (
              <div>
                <label className="label">O agrega un producto del registro como insumo</label>
                <div className="flex gap-2 flex-wrap">
                  {products.slice(0, 10).map((p) => (
                    <button key={p.id} onClick={() => addProductAsInput(p)} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">
                      + {p.name} ({p.price_trueque} {currency})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de insumos agregados */}
            {inputs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Insumos agregados:</h3>
                {inputs.map((i) => (
                  <div key={i.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 text-sm">
                    <div>
                      <span className="font-medium">{i.name}</span>
                      <span className="text-gray-500 ml-2">{i.quantity} {i.unit} x {i.kWhPerUnit} kWh = {fmtNumber(i.kWhPerUnit * i.quantity, 2)} kWh</span>
                    </div>
                    <button onClick={() => removeInput(i.id)} className="text-red-500"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Calcular */}
          <button onClick={calculate} className="btn-primary w-full flex items-center justify-center gap-2" disabled={workItems.length === 0 && inputs.length === 0}>
            <CalcIcon size={18} /> Calcular precio
          </button>
        </div>
      )}

      {/* MODO AVANZADO */}
      {mode === 'advanced' && (
        <div className="card space-y-4">
          <h2 className="font-semibold">Modo avanzado</h2>
          <p className="text-xs text-gray-500">Para usuarios avanzados que conocen los valores exactos en kWh. Si no sabes que significa cada campo, usa el modo facil.</p>

          <div>
            <label className="label">Energia directa (kWh)</label>
            <input type="number" className="input" value={advForm.e_direct} onChange={(e) => setAdvForm({ ...advForm, e_direct: parseFloat(e.target.value) || 0 })} />
            <p className="text-xs text-gray-400 mt-1">Electricidad, gas o combustible consumido directamente.</p>
          </div>
          <div>
            <label className="label">Energia humana (kWh)</label>
            <input type="number" className="input" value={advForm.e_human} onChange={(e) => setAdvForm({ ...advForm, e_human: parseFloat(e.target.value) || 0 })} />
            <p className="text-xs text-gray-400 mt-1">Energia del trabajo humano (horas x tarifa energetica).</p>
          </div>
          <div>
            <label className="label">Energia de insumos (kWh)</label>
            <input type="number" className="input" value={advForm.e_inputs} onChange={(e) => setAdvForm({ ...advForm, e_inputs: parseFloat(e.target.value) || 0 })} />
            <p className="text-xs text-gray-400 mt-1">Energia incorporada en materiales e insumos.</p>
          </div>
          <div>
            <label className="label">Amortizacion (kWh)</label>
            <input type="number" className="input" value={advForm.e_amortization} onChange={(e) => setAdvForm({ ...advForm, e_amortization: parseFloat(e.target.value) || 0 })} />
            <p className="text-xs text-gray-400 mt-1">Energia amortizada de herramientas y equipos.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Factor de esfuerzo</label>
              <input type="number" step="0.1" className="input" value={advForm.effort_factor} onChange={(e) => setAdvForm({ ...advForm, effort_factor: parseFloat(e.target.value) || 1 })} />
              <p className="text-xs text-gray-400 mt-1">1.0 = normal, 1.5 = alto esfuerzo.</p>
            </div>
            <div>
              <label className="label">Tarifa de conversion</label>
              <input type="number" step="0.1" className="input" value={advForm.tariff} onChange={(e) => setAdvForm({ ...advForm, tariff: parseFloat(e.target.value) || 1 })} />
              <p className="text-xs text-gray-400 mt-1">kWh a {currency} (por defecto 1:1).</p>
            </div>
          </div>
          <button onClick={calculateAdvanced} className="btn-primary w-full flex items-center justify-center gap-2"><CalcIcon size={18} /> Calcular</button>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="card bg-trueque-50 space-y-3">
          <h3 className="font-semibold">Resultado del calculo</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Energia del trabajo humano:</span>
              <span className="font-medium">{fmtNumber(result.workKWh, 2)} kWh</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Energia de insumos y materiales:</span>
              <span className="font-medium">{fmtNumber(result.inputsKWh, 2)} kWh</span>
            </div>
            <div className="border-t border-trueque-200 pt-2 flex justify-between text-lg">
              <span className="font-bold text-trueque-700">Precio total:</span>
              <span className="font-bold text-trueque-700">{fmtNumber(result.totalTQ, 2)} {currency}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500">Este es el precio sugerido para tu producto. Llevalo a la asamblea para que lo aprueben y lo agreguen al registro de productos.</p>
        </div>
      )}
    </div>
  )
}
