import { useState, useRef } from 'react'
import { api } from '../api'
import { QrCode, Nfc, Send, ScanLine, Copy, Check, Camera, Upload, X, HelpCircle, Download, Share2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Html5Qrcode } from 'html5-qrcode'
import jsQR from 'jsqr'

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
  const qrWrapperRef = useRef<HTMLDivElement>(null)

  // QR Scan state
  const [scanResult, setScanResult] = useState<ParseQRResponse | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [scanning, setScanning] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const downloadQR = () => {
    const svg = qrWrapperRef.current?.querySelector('svg')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      canvas.width = 512
      canvas.height = 512
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, 512, 512)
      ctx.drawImage(img, 0, 0, 512, 512)
      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'qr-pago.png'
        a.click()
        URL.revokeObjectURL(url)
      })
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  const shareQR = async () => {
    const svg = qrWrapperRef.current?.querySelector('svg')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.onload = async () => {
      canvas.width = 512
      canvas.height = 512
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, 512, 512)
      ctx.drawImage(img, 0, 0, 512, 512)
      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], 'qr-pago.png', { type: 'image/png' })
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'Codigo QR de Pago',
              text: `Pago para ${qrPaymentReq?.user || ''}`,
            })
          } catch {}
        } else {
          // Fallback: descargar
          downloadQR()
        }
      })
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  const startCamera = async () => {
    setError('')
    setScanResult(null)
    try {
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScannedData(decodedText)
        },
        () => {}
      )
      setScanning(true)
    } catch (err) {
      setError('No se pudo acceder a la camara. Verifica los permisos o usa cargar imagen.')
    }
  }

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch {}
      scannerRef.current = null
    }
    setScanning(false)
  }

  const handleScannedData = async (data: string) => {
    await stopCamera()
    try {
      const res = await api.post<ParseQRResponse>('/payments/qr/parse', { qr_data: data })
      setScanResult(res)
      if (res.payment_req.amount) {
        setPayAmount(String(res.payment_req.amount))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR invalido o no se pudo leer')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          setError('No se pudo procesar la imagen')
          return
        }
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code) {
          handleScannedData(code.data)
        } else {
          setError('No se encontro ningun codigo QR en la imagen')
        }
      }
      img.onerror = () => setError('No se pudo cargar la imagen')
      img.src = event.target?.result as string
    }
    reader.onerror = () => setError('No se pudo leer el archivo')
    reader.readAsDataURL(file)
    // Reset input para poder cargar el mismo archivo otra vez
    e.target.value = ''
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pagos</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
          <p><strong>Pagos - Ayuda</strong></p>
          <p><strong>QR:</strong> Genera un codigo QR para que alguien te pague. La otra persona lo escanea con la camara de su movil o carga una foto del QR.</p>
          <p><strong>NFC:</strong> Pago con tarjeta NFC fisica. El comercio lee la tarjeta del cliente con un lector NFC.</p>
          <p><strong>Manual:</strong> Transferencia directa ingresando el ID del destinatario. Util cuando no hay QR ni NFC.</p>
          <p>El monto puede ser fijo (lo defines al generar el QR) o libre (el que paga decide cuanto).</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      <div className="flex gap-2">
        {([['qr', 'QR'], ['nfc', 'NFC'], ['manual', 'Manual']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === key ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{label}</button>
        ))}
      </div>
      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {tab === 'qr' && (
        <div className="space-y-4">
          {/* Generar QR */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2"><QrCode size={20} /><h2 className="font-semibold">Mi Codigo QR de Pago</h2></div>
            <p className="text-xs text-gray-500">Genera un codigo QR para que alguien te pague. Si especificas un monto, el QR sera para pagar exactamente esa cantidad. Si lo dejas vacio, el que paga decide el monto.</p>

            <div className="space-y-3">
              <div>
                <label className="label">Nombre para mostrar (opcional)</label>
                <input className="input" placeholder="Ej: Juan Perez" value={genDisplayName} onChange={(e) => setGenDisplayName(e.target.value)} />
              </div>
              <div>
                <label className="label">Monto (dejar vacio = monto libre)</label>
                <input className="input" placeholder="Ej: 500" value={genAmount} onChange={(e) => setGenAmount(e.target.value)} type="number" />
              </div>
              <div>
                <label className="label">Etiqueta / descripcion (opcional)</label>
                <input className="input" placeholder="Ej: Pago de productos" value={genLabel} onChange={(e) => setGenLabel(e.target.value)} />
              </div>
              <button onClick={generateQR} className="btn-primary">Generar QR</button>
            </div>

            {qrData && (
              <div className="space-y-3">
                <div ref={qrWrapperRef} className="bg-white border-2 border-gray-200 rounded-lg p-4 flex justify-center">
                  <QRCodeSVG value={qrData} size={256} level="M" includeID={false} />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={downloadQR} className="btn-secondary flex items-center gap-1">
                    <Download size={16} /> Descargar
                  </button>
                  <button onClick={shareQR} className="btn-secondary flex items-center gap-1">
                    <Share2 size={16} /> Compartir
                  </button>
                  <button onClick={copyQR} className="btn-secondary flex items-center gap-1">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copiado' : 'Copiar datos'}
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
            <div className="flex items-center gap-2"><ScanLine size={20} /><h2 className="font-semibold">Escanear QR para Pagar</h2></div>
            <p className="text-xs text-gray-500">Escanea el codigo QR de la persona que va a recibir el pago. Puedes usar la camara o cargar una imagen del QR.</p>

            {!scanning && !scanResult && (
              <div className="space-y-2">
                <button onClick={startCamera} className="btn-primary w-full flex items-center justify-center gap-2">
                  <Camera size={20} /> Abrir camara
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="btn-secondary w-full flex items-center justify-center gap-2">
                  <Upload size={20} /> Cargar imagen del QR
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </div>
            )}

            {scanning && (
              <div className="space-y-2">
                <div id="qr-reader" className="w-full" />
                <button onClick={stopCamera} className="btn-secondary w-full flex items-center justify-center gap-2">
                  <X size={20} /> Cancelar
                </button>
              </div>
            )}

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
                  <div>
                    <label className="label">Ingrese monto a pagar</label>
                    <input className="input" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                  </div>
                )}
                <button onClick={confirmPayment} className="btn-primary w-full">Confirmar Pago</button>
                <button onClick={() => setScanResult(null)} className="btn-secondary w-full">Cancelar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'nfc' && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2"><Nfc size={20} /><h2 className="font-semibold">Pago por NFC</h2></div>
          <p className="text-xs text-gray-500">Ingresa el UID de la tarjeta NFC del usuario. En produccion, este campo se llena automaticamente al acercar la tarjeta al lector NFC conectado al terminal ESP32.</p>
          <div>
            <label className="label">UID de tarjeta NFC</label>
            <input className="input" placeholder="Ej: 04A3B2C1" value={nfcUID} onChange={(e) => setNfcUID(e.target.value)} />
          </div>
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
          <p className="text-xs text-gray-500">Transferencia directa a otro usuario. Necesitas su ID (UUID). El remitente eres tu (se obtiene de tu sesion).</p>
          <div>
            <label className="label">ID del destinatario (UUID)</label>
            <input className="input" placeholder="Ej: a14dd44f-8da1-4bf7-8ad6-762a9d10d562" value={manual.receiver_id} onChange={(e) => setManual({ ...manual, receiver_id: e.target.value })} />
          </div>
          <div>
            <label className="label">Monto</label>
            <input type="number" className="input" placeholder="Ej: 500" value={manual.amount || ''} onChange={(e) => setManual({ ...manual, amount: parseInt(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">Referencia (opcional)</label>
            <input className="input" placeholder="Ej: Pago de productos" value={manual.reference} onChange={(e) => setManual({ ...manual, reference: e.target.value })} />
          </div>
          <button onClick={sendManual} className="btn-primary">Enviar</button>
          {manualResult && <div className="bg-trueque-50 p-3 rounded-lg text-sm">{JSON.stringify(manualResult, null, 2)}</div>}
        </div>
      )}
    </div>
  )
}
