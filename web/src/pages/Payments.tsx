import { useState } from 'react'
import { api } from '../api'
import { QrCode, Nfc, Send, ScanLine, Copy, Check } from 'lucide-react'

interface PaymentRequest {
  protocol: string
  type: string
  node: string
  user: string
  user_id: string
  display_name: string
  account: string
  amount: number | null
  label?: string
  nonce: string
  timestamp: string
}

interface ParseQRResponse {
  payment_req: PaymentRequest
  is_local_node: boolean
}

export default function Payments() {
  const [tab, setTab] = useState<'qr' | 'nfc' | 'manual'>('qr')
  const [error, setError] = useState('')

  // QR Generate state
  const [qrData, setQrData] = useState('')
  const [qrPaymentReq, setQrPaymentReq] = useState<PaymentRequest | null>(null)
  const [genAmount, setGenAmount] = useState('')
  const [genLabel, setGenLabel] = useState('')
  const [genDisplayName, setGenDisplayName] = useState('')
  const [copied, setCopied] = useState(false)

  // QR Scan state
  const [scanInput, setScanInput] = useState('')
  const [scanResult, setScanResult] = useState<ParseQRResponse | null>(null)
  const [payAmount, setPayAmount] = useState('')

  // NFC state
  const [nfcUID, setNfcUID] = useState('')
  const [nfcResult, setNfcResult] = useState<any>(null)

  // Manual state
  const [manual, setManual] = useState({ receiver_id: '', amount: 0, reference: '' })
  const [manualResult, setManualResult] = useState<any>(null)

  const generateQR = async () => {
    setError('')
    try {
      const amount = genAmount ? parseInt(genAmount) : null
      const res = await api.post<{ qr_data: string; payment_req: PaymentRequest }>('/payments/qr/generate', {
        display_name: genDisplayName || undefined,
        amount,
        label: genLabel || undefined,
      })
      setQrData(res.qr_data)
      setQrPaymentReq(res.payment_req)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const copyQR = () => {
    navigator.clipboard.writeText(qrData)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const parseQR = async () => {
    setError('')
    setScanResult(null)
    try {
      const res = await api.post<ParseQRResponse>('/payments/qr/parse', { qr_data: scanInput })
      setScanResult(res)
      if (res.payment_req.amount) {
        setPayAmount(String(res.payment_req.amount))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const confirmPayment = async () => {
    setError('')
    try {
      const amount = parseInt(payAmount)
      if (!amount || amount <= 0) {
        setError('Monto invalido')
        return
      }
      await api.post('/payments/manual', {
        receiver_id: scanResult?.payment_req.user_id,
        amount,
        reference: `QR: ${scanResult?.payment_req.account}`,
      })
      setScanResult(null)
      setPayAmount('')
      setScanInput('')
      setManualResult({ status: 'approved', message: 'Pago enviado correctamente' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const lookupNFC = async () => {
    setError('')
    setNfcResult(null)
    try {
      const res = await api.post('/payments/nfc/lookup', { card_uid: nfcUID })
      setNfcResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const sendManual = async () => {
    setError('')
    setManualResult(null)
    try {
      await api.post('/payments/manual', manual)
      setManualResult({ status: 'validated' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pagos</h1>
      <div className="flex gap-2">
        {([['qr', 'QR'], ['nfc', 'NFC'], ['manual', 'Manual']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === key ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{label}</button>
        ))}
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}

      {tab === 'qr' && (
        <div className="space-y-4">
          {/* Generar QR */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2"><QrCode size={20} /><h2 className="font-semibold">Generar Codigo QR</h2></div>
            <div className="space-y-3">
              <input className="input" placeholder="Nombre para mostrar (opcional)" value={genDisplayName} onChange={(e) => setGenDisplayName(e.target.value)} />
              <input className="input" placeholder="Monto (dejar vacio = libre)" value={genAmount} onChange={(e) => setGenAmount(e.target.value)} type="number" />
              <input className="input" placeholder="Etiqueta / descripcion (opcional)" value={genLabel} onChange={(e) => setGenLabel(e.target.value)} />
              <button onClick={generateQR} className="btn-primary">Generar QR</button>
            </div>
            {qrData && (
              <div className="space-y-2">
                <div className="bg-white border-2 border-gray-200 rounded-lg p-4 flex justify-center">
                  <div className="w-48 h-48 bg-gray-50 flex items-center justify-center text-xs text-gray-400 border border-dashed border-gray-300 rounded">
                    [QR Code]
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <textarea readOnly className="input h-16 text-xs flex-1" value={qrData} />
                  <button onClick={copyQR} className="btn-secondary flex items-center gap-1">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                {qrPaymentReq && (
                  <div className="bg-trueque-50 p-3 rounded-lg text-sm space-y-1">
                    <p><strong>Usuario:</strong> {qrPaymentReq.user}</p>
                    <p><strong>Cuenta:</strong> {qrPaymentReq.account}</p>
                    <p><strong>Nodo:</strong> {qrPaymentReq.node}</p>
                    {qrPaymentReq.amount !== null && <p><strong>Monto:</strong> {qrPaymentReq.amount}</p>}
                    {qrPaymentReq.label && <p><strong>Etiqueta:</strong> {qrPaymentReq.label}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Escanear QR */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2"><ScanLine size={20} /><h2 className="font-semibold">Escanear / Pagar QR</h2></div>
            <textarea className="input h-20 text-xs" placeholder="Pegar datos QR (base64) aqui..." value={scanInput} onChange={(e) => setScanInput(e.target.value)} />
            <button onClick={parseQR} className="btn-primary" disabled={!scanInput}>Validar QR</button>
            {scanResult && (
              <div className="space-y-3">
                <div className={`p-3 rounded-lg text-sm ${scanResult.is_local_node ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
                  {scanResult.is_local_node ? 'Mismo nodo' : 'Nodo externo'}: {scanResult.payment_req.node}
                </div>
                <div className="bg-trueque-50 p-3 rounded-lg text-sm space-y-1">
                  <p><strong>Usuario:</strong> {scanResult.payment_req.user}</p>
                  <p><strong>Nombre:</strong> {scanResult.payment_req.display_name || 'N/A'}</p>
                  <p><strong>Cuenta:</strong> {scanResult.payment_req.account}</p>
                  {scanResult.payment_req.amount !== null && <p><strong>Monto solicitado:</strong> {scanResult.payment_req.amount}</p>}
                  {scanResult.payment_req.label && <p><strong>Etiqueta:</strong> {scanResult.payment_req.label}</p>}
                </div>
                {scanResult.payment_req.amount === null && (
                  <input className="input" placeholder="Ingrese monto a pagar" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                )}
                <button onClick={confirmPayment} className="btn-primary">Confirmar Pago</button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'nfc' && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2"><Nfc size={20} /><h2 className="font-semibold">Pago por NFC</h2></div>
          <input className="input" placeholder="UID de tarjeta NFC (ej: nodocodigo:hexhexhex)" value={nfcUID} onChange={(e) => setNfcUID(e.target.value)} />
          <button onClick={lookupNFC} className="btn-primary" disabled={!nfcUID}>Buscar tarjeta</button>
          {nfcResult && (
            <div className="bg-trueque-50 p-3 rounded-lg text-sm space-y-1">
              <p><strong>Card UID:</strong> {nfcResult.card_uid}</p>
              <p><strong>Usuario:</strong> {nfcResult.user_id}</p>
              <p><strong>Activa:</strong> {nfcResult.is_active ? 'Si' : 'No'}</p>
              {nfcResult.is_local === false && (
                <p className="text-amber-700"><strong>Nota:</strong> Tarjeta de otro nodo - se consultara via federation</p>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'manual' && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2"><Send size={20} /><h2 className="font-semibold">Pago Manual</h2></div>
          <input className="input" placeholder="ID destinatario (UUID)" value={manual.receiver_id} onChange={(e) => setManual({ ...manual, receiver_id: e.target.value })} />
          <input type="number" className="input" placeholder="Monto" value={manual.amount} onChange={(e) => setManual({ ...manual, amount: parseInt(e.target.value) || 0 })} />
          <input className="input" placeholder="Referencia" value={manual.reference} onChange={(e) => setManual({ ...manual, reference: e.target.value })} />
          <button onClick={sendManual} className="btn-primary">Enviar</button>
          {manualResult && <div className="bg-trueque-50 p-3 rounded-lg text-sm">{JSON.stringify(manualResult, null, 2)}</div>}
        </div>
      )}
    </div>
  )
}
