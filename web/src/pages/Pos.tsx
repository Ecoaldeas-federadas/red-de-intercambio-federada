import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { useAuth } from '../hooks/useAuth'
import { QrCode, Nfc, CheckCircle, XCircle, Loader2, Bluetooth } from 'lucide-react'

interface Charge {
  charge_id: string
  charge_token: string
  amount: number
  status: string
  description: string
  expires_at: string
}

export default function Pos() {
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [charge, setCharge] = useState<Charge | null>(null)
  const [status, setStatus] = useState<'idle' | 'creating' | 'waiting' | 'paid' | 'expired' | 'cancelled' | 'error'>('idle')
  const [error, setError] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'qr' | 'nfc'>('qr')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const formatAmount = (cents: number) => `${(cents / 100).toFixed(2)} TQ`

  const createCharge = async () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) {
      setError('Ingresa un monto valido')
      return
    }

    setStatus('creating')
    setError('')
    setCharge(null)

    try {
      const cents = Math.round(amt * 100)
      const res = await api.post<Charge>('/pos/charge', {
        amount: cents,
        description: description || undefined,
      })
      setCharge(res)
      setStatus('waiting')

      // Poll para ver si el pago se completa
      pollRef.current = setInterval(async () => {
        try {
          const st = await api.get<Charge>(`/pos/charge/${res.charge_id}/status`)
          if (st.status === 'paid') {
            setStatus('paid')
            if (pollRef.current) clearInterval(pollRef.current)
          } else if (st.status === 'expired') {
            setStatus('expired')
            if (pollRef.current) clearInterval(pollRef.current)
          } else if (st.status === 'cancelled') {
            setStatus('cancelled')
            if (pollRef.current) clearInterval(pollRef.current)
          }
        } catch {
          // ignore poll errors
        }
      }, 2000)
    } catch (e: any) {
      setError(e.message || 'Error al crear cargo')
      setStatus('error')
    }
  }

  const cancelCharge = async () => {
    if (!charge) return
    try {
      await api.post(`/pos/charge/${charge.charge_id}/cancel`, {})
      setStatus('cancelled')
      if (pollRef.current) clearInterval(pollRef.current)
    } catch (e: any) {
      setError(e.message || 'Error al cancelar')
    }
  }

  const reset = () => {
    setCharge(null)
    setStatus('idle')
    setAmount('')
    setDescription('')
    setError('')
    if (pollRef.current) clearInterval(pollRef.current)
  }

  // Generar URL del QR
  const qrUrl = charge
    ? `${window.location.origin}/pay?t=${charge.charge_token}`
    : ''

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-trueque-600 text-white rounded-xl p-2">
              <QrCode size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Punto de Venta</h1>
              <p className="text-sm text-gray-500">@{user?.username}</p>
            </div>
          </div>

          {status === 'idle' || status === 'error' || status === 'creating' ? (
            <>
              {/* Selector de metodo de pago */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setPaymentMethod('qr')}
                  className={`flex-1 py-3 rounded-xl font-medium transition ${
                    paymentMethod === 'qr'
                      ? 'bg-trueque-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <QrCode size={20} className="inline mr-2" />
                  QR
                </button>
                <button
                  onClick={() => setPaymentMethod('nfc')}
                  className={`flex-1 py-3 rounded-xl font-medium transition ${
                    paymentMethod === 'nfc'
                      ? 'bg-trueque-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Nfc size={20} className="inline mr-2" />
                  NFC
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto (TQ)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full text-2xl font-bold text-center p-4 border-2 border-gray-200 rounded-xl focus:border-trueque-500 focus:outline-none"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Concepto (opcional)
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-200 rounded-xl focus:border-trueque-500 focus:outline-none"
                    placeholder="Ej: Compra de verduras"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {paymentMethod === 'nfc' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
                    <p className="font-medium mb-1">Pago NFC</p>
                    <p className="text-xs">
                      El cliente acerca su tarjeta NFC al lector. Si la tarjeta es segura (DESFire), solo pide PIN.
                      Si es sencilla (UID-only), pide documento de identidad + PIN.
                    </p>
                    <p className="text-xs mt-2 text-blue-500">
                      Nota: El pago NFC desde el navegador requiere un lector Bluetooth conectado.
                      Sin lector Bluetooth, usa QR.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <button
                  onClick={createCharge}
                  disabled={status === 'creating' || !amount}
                  className="w-full bg-trueque-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-trueque-700 disabled:opacity-50 transition"
                >
                  {status === 'creating' ? (
                    <Loader2 className="animate-spin inline mr-2" size={20} />
                  ) : null}
                  {paymentMethod === 'qr' ? 'Generar QR' : 'Crear Cargo NFC'}
                </button>
              </div>
            </>
          ) : status === 'waiting' && charge ? (
            <div className="text-center">
              {paymentMethod === 'qr' ? (
                <>
                  <div className="bg-white p-4 rounded-xl border-2 border-gray-200 inline-block mb-4">
                    {/* QR code usando API publica */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrUrl)}`}
                      alt="QR de pago"
                      className="w-64 h-64"
                    />
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Monto: <span className="font-bold text-lg">{formatAmount(charge.amount)}</span>
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    El cliente escanea este QR con su celular para pagar
                  </p>
                </>
              ) : (
                <>
                  <div className="bg-blue-50 rounded-xl p-8 mb-4">
                    <Nfc className="mx-auto text-blue-500 mb-3" size={64} />
                    <p className="font-bold text-lg">{formatAmount(charge.amount)}</p>
                    <p className="text-sm text-gray-600 mt-2">
                      Esperando lectura de tarjeta NFC...
                    </p>
                  </div>
                </>
              )}

              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
                <Loader2 className="animate-spin" size={16} />
                Esperando pago...
              </div>

              <button
                onClick={cancelCharge}
                className="text-red-500 hover:text-red-700 text-sm font-medium"
              >
                Cancelar cargo
              </button>
            </div>
          ) : status === 'paid' ? (
            <div className="text-center py-8">
              <CheckCircle className="mx-auto text-green-500 mb-4" size={64} />
              <h2 className="text-2xl font-bold text-green-600 mb-2">Pago Completado</h2>
              {charge && (
                <p className="text-xl mb-6">{formatAmount(charge.amount)} TQ</p>
              )}
              <button
                onClick={reset}
                className="bg-trueque-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-trueque-700"
              >
                Nueva venta
              </button>
            </div>
          ) : status === 'expired' ? (
            <div className="text-center py-8">
              <XCircle className="mx-auto text-orange-500 mb-4" size={64} />
              <h2 className="text-xl font-bold text-orange-600 mb-2">El cargo expiro</h2>
              <button
                onClick={reset}
                className="bg-trueque-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-trueque-700"
              >
                Intentar de nuevo
              </button>
            </div>
          ) : status === 'cancelled' ? (
            <div className="text-center py-8">
              <XCircle className="mx-auto text-gray-400 mb-4" size={64} />
              <h2 className="text-xl font-bold text-gray-600 mb-2">Cargo cancelado</h2>
              <button
                onClick={reset}
                className="bg-trueque-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-trueque-700"
              >
                Nueva venta
              </button>
            </div>
          ) : null}
        </div>

        {/* Info BLE reader */}
        <div className="mt-4 bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Bluetooth size={16} />
            <span>Lector NFC Bluetooth: no conectado</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Para pagos NFC en el navegador, conecta un lector BLE.
            Solo funciona en Chrome/Edge (no Safari).
          </p>
        </div>
      </div>
    </div>
  )
}
