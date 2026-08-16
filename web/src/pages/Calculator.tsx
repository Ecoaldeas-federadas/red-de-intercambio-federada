import { useState } from 'react'
import { api } from '../api'
import { Calculator as CalcIcon } from 'lucide-react'

export default function Calculator() {
  const [form, setForm] = useState({ e_direct: 0, e_human: 0, e_inputs: 0, e_amortization: 0, product_id: '' })
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const calculate = async () => {
    setError('')
    try {
      const res = await api.post('/pricing/calculate', form)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al calcular')
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Calculadora de Precios</h1>
      <p className="text-sm text-gray-600">E_total = E_directa + E_humana + E_insumos + E_amortizacion</p>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div className="card space-y-3">
        {[
          ['E_directa (kWh)', 'e_direct'],
          ['E_humana (kWh)', 'e_human'],
          ['E_insumos (kWh)', 'e_inputs'],
          ['E_amortizacion (kWh)', 'e_amortization'],
        ].map(([label, key]) => (
          <div key={key}>
            <label className="label">{label}</label>
            <input type="number" className="input" value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: parseFloat(e.target.value) || 0 })} />
          </div>
        ))}
        <button onClick={calculate} className="btn-primary w-full flex items-center justify-center gap-2"><CalcIcon size={18} />Calcular</button>
      </div>
      {result && (
        <div className="card bg-trueque-50">
          <h3 className="font-semibold mb-2">Resultado</h3>
          <p className="text-2xl font-bold text-trueque-700">{result.total_energy} kWh = {result.price_trueque} TQ</p>
        </div>
      )}
    </div>
  )
}
