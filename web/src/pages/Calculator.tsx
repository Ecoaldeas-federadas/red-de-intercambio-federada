import { useState } from 'react'
import { api } from '../api'
import { Calculator as CalcIcon, HelpCircle, X } from 'lucide-react'

interface CalcForm {
  e_direct: number
  e_human: number
  e_inputs: number
  e_amortization: number
  effort_factor: number
  work_hours: number
  work_days: number
  human_energy_rate: number
  tariff: number
  product_id: string
}

const defaultForm: CalcForm = {
  e_direct: 0,
  e_human: 0,
  e_inputs: 0,
  e_amortization: 0,
  effort_factor: 1.0,
  work_hours: 0,
  work_days: 0,
  human_energy_rate: 0.1,
  tariff: 1,
  product_id: '',
}

const fieldHelp: Record<string, string> = {
  e_direct: 'Energia consumida directamente en el proceso (electricidad, gas, combustible)',
  e_human: 'Energia del trabajo humano. Calcula: horas_trabajo x tarifa_energetica_humana',
  e_inputs: 'Energia incorporada en los materiales e insumos utilizados',
  e_amortization: 'Energia amortizada de herramientas y equipos (costo_energetico / vida_util)',
  effort_factor: 'Multiplicador segun dificultad/esfuerzo del trabajo (1.0 = normal, 1.5 = alto esfuerzo)',
  work_hours: 'Horas de trabajo humano invertidas',
  work_days: 'Dias de trabajo invertidos',
  human_energy_rate: 'kWh por hora de trabajo humano (ej: 0.1 kWh/h)',
  tariff: 'Tarifa de conversion kWh a Trueques (por defecto 1:1)',
}

const fieldLabels: Record<string, string> = {
  e_direct: 'E_directa (Energia directa)',
  e_human: 'E_humana (Energia humana)',
  e_inputs: 'E_insumos (Energia insumos)',
  e_amortization: 'E_amortizacion (Amortizacion)',
  effort_factor: 'effort_factor (Factor de esfuerzo)',
  work_hours: 'work_hours (Horas de trabajo)',
  work_days: 'work_days (Dias de trabajo)',
  human_energy_rate: 'human_energy_rate (Tarifa energia humana)',
  tariff: 'tariff (Tarifa)',
}

const energyFields: { key: keyof CalcForm; unit: string }[] = [
  { key: 'e_direct', unit: 'kWh' },
  { key: 'e_human', unit: 'kWh' },
  { key: 'e_inputs', unit: 'kWh' },
  { key: 'e_amortization', unit: 'kWh' },
]

const extraFields: { key: keyof CalcForm; unit: string }[] = [
  { key: 'effort_factor', unit: 'x' },
  { key: 'work_hours', unit: 'h' },
  { key: 'work_days', unit: 'd' },
  { key: 'human_energy_rate', unit: 'kWh/h' },
  { key: 'tariff', unit: 'TQ/kWh' },
]

export default function Calculator() {
  const [form, setForm] = useState<CalcForm>(defaultForm)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  const calculate = async () => {
    setError('')
    try {
      const res = await api.post('/pricing/calculate', form)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al calcular')
    }
  }

  const handleChange = (key: keyof CalcForm, value: string) => {
    setForm({ ...form, [key]: parseFloat(value) || 0 })
  }

  // Calculo local para desglose (independiente del backend)
  const baseEnergy = form.e_direct + form.e_human + form.e_inputs + form.e_amortization
  const totalEnergy = baseEnergy * form.effort_factor
  const totalTrueque = totalEnergy * form.tariff

  const renderField = (key: keyof CalcForm, unit: string) => (
    <div key={key}>
      <label className="label">{fieldLabels[key]}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="any"
          className="input"
          value={form[key]}
          onChange={(e) => handleChange(key, e.target.value)}
        />
        <span className="text-xs text-gray-500 whitespace-nowrap">{unit}</span>
      </div>
      <p className="text-xs text-gray-500 mt-1">{fieldHelp[key]}</p>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calculadora de Precios</h1>
        <button
          onClick={() => setShowHelp(true)}
          className="btn-primary flex items-center gap-1 px-3 py-1 text-sm"
          title="Ayuda del modelo energetico"
        >
          <HelpCircle size={16} /> ?
        </button>
      </div>

      <p className="text-sm text-gray-600">
        E_total = (E_directa + E_humana + E_insumos + E_amortizacion) x factor_esfuerzo x tarifa
      </p>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="card space-y-3">
        <h2 className="font-semibold text-sm uppercase text-gray-500">Componentes de energia</h2>
        {energyFields.map((f) => renderField(f.key, f.unit))}

        <h2 className="font-semibold text-sm uppercase text-gray-500 pt-2">Parametros adicionales</h2>
        {extraFields.map((f) => renderField(f.key, f.unit))}

        <button onClick={calculate} className="btn-primary w-full flex items-center justify-center gap-2">
          <CalcIcon size={18} /> Calcular
        </button>
      </div>

      {/* Resultado desglosado */}
      {result && (
        <div className="card bg-trueque-50 space-y-2">
          <h3 className="font-semibold">Resultado desglosado</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>E_directa</span>
              <span>{form.e_direct} kWh</span>
            </div>
            <div className="flex justify-between">
              <span>E_humana</span>
              <span>{form.e_human} kWh</span>
            </div>
            <div className="flex justify-between">
              <span>E_insumos</span>
              <span>{form.e_inputs} kWh</span>
            </div>
            <div className="flex justify-between">
              <span>E_amortizacion</span>
              <span>{form.e_amortization} kWh</span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span>Subtotal (base)</span>
              <span>{baseEnergy} kWh</span>
            </div>
            <div className="flex justify-between">
              <span>x factor_esfuerzo ({form.effort_factor})</span>
              <span>{totalEnergy} kWh</span>
            </div>
            <div className="flex justify-between">
              <span>x tarifa ({form.tariff} TQ/kWh)</span>
              <span>{totalTrueque} TQ</span>
            </div>
          </div>
          <div className="border-t pt-2 mt-2">
            <p className="text-2xl font-bold text-trueque-700">
              {result.total_energy ?? totalEnergy} kWh = {result.price_trueque ?? totalTrueque} TQ
            </p>
          </div>
        </div>
      )}

      {/* Modal de ayuda */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card bg-white max-w-md space-y-3 relative">
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
            <h3 className="font-semibold text-lg">Modelo energetico</h3>
            <p className="text-sm text-gray-600">
              El precio de un producto o servicio se calcula en funcion de la energia total invertida,
              expresada en kWh y convertida a Trueques (TQ).
            </p>
            <div className="text-sm space-y-1">
              <p className="font-semibold">Formula:</p>
              <p className="bg-gray-100 p-2 rounded">
                E_total = (E_directa + E_humana + E_insumos + E_amortizacion) x factor_esfuerzo x tarifa
              </p>
            </div>
            <ul className="text-sm space-y-1 text-gray-600">
              <li><strong>E_directa:</strong> {fieldHelp.e_direct}</li>
              <li><strong>E_humana:</strong> {fieldHelp.e_human}</li>
              <li><strong>E_insumos:</strong> {fieldHelp.e_inputs}</li>
              <li><strong>E_amortizacion:</strong> {fieldHelp.e_amortization}</li>
              <li><strong>factor_esfuerzo:</strong> {fieldHelp.effort_factor}</li>
              <li><strong>tarifa:</strong> {fieldHelp.tariff}</li>
            </ul>
            <p className="text-xs text-gray-500">
              La energia humana puede calcularse como: work_hours x human_energy_rate.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
