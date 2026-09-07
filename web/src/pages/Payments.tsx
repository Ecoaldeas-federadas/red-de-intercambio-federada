import { useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useTranslation } from 'react-i18next'
import { QrCode, Nfc, Send, ScanLine, Copy, Check, Camera, Upload, X, HelpCircle, Download, Share2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Html5Qrcode } from 'html5-qrcode'
import jsQR from 'jsqr'
import { toCents } from '../lib/format'

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
  const { t } = useTranslation('transfer')
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as 'qr' | 'nfc' | 'manual') || 'qr'
  const [tab, setTab] = useState<'qr' | 'nfc' | 'manual'>(initialTab)
  const changeTab = (t: 'qr' | 'nfc' | 'manual') => {
    setTab(t)
    setSearchParams({ tab: t })
  }
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
      const amount = genAmount ? Math.round(parseFloat(genAmount) * 100) : null
      const res = await api.post<{ qr_data: string; payment_req: PaymentRequest }>('/payments/qr/generate', {
        display_name: genDisplayName || undefined,
        amount,
        label: genLabel || undefined,
      })
      setQrData(res.qr_data)
      setQrPaymentReq(res.payment_req)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('payments.error_generic', 'Error'))
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
              title: t('payments.share_title', 'Codigo QR de Pago'),
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
    // Set scanning=true FIRST so the qr-reader div gets rendered
    setScanning(true)
    // Wait for the DOM to render the qr-reader div
    await new Promise((resolve) => setTimeout(resolve, 100))
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
    } catch (err) {
      console.error('Camera error:', err)
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('Permission') || errMsg.includes('NotAllowed') || errMsg.includes('denied')) {
        setError(t('payments.error_camera_denied', 'Permiso de cámara denegado. Ve a los ajustes del navegador, busca los permisos de esta página y permite el acceso a la cámara.'))
      } else if (errMsg.includes('NotFound') || errMsg.includes('NotReadable') || errMsg.includes('device')) {
        setError(t('payments.error_no_camera', 'No se encontró una cámara en este dispositivo. Usa "Cargar imagen del QR" en su lugar.'))
      } else if (errMsg.includes('element') || errMsg.includes('qr-reader')) {
        setError(t('payments.error_scanner_init', 'Error al inicializar el escáner. Recarga la página e intenta de nuevo.'))
      } else {
        setError(t('payments.error_camera_generic', `No se pudo acceder a la cámara: ${errMsg}. Verifica los permisos o usa cargar imagen.`, { msg: errMsg }))
      }
      setScanning(false)
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
      setError(err instanceof Error ? err.message : t('payments.error_invalid_qr', 'QR invalido o no se pudo leer'))
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
          setError(t('payments.error_process_image', 'No se pudo procesar la imagen'))
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
          setError(t('payments.error_no_qr_found', 'No se encontro ningun codigo QR en la imagen'))
        }
      }
      img.onerror = () => setError(t('payments.error_load_image', 'No se pudo cargar la imagen'))
      img.src = event.target?.result as string
    }
    reader.onerror = () => setError(t('payments.error_read_file', 'No se pudo leer el archivo'))
    reader.readAsDataURL(file)
    // Reset input para poder cargar el mismo archivo otra vez
    e.target.value = ''
  }

  const confirmPayment = async () => {
    setError('')
    try {
      // Convertir input del usuario (TQ con decimales) a centavos
      const amount = Math.round(parseFloat(payAmount) * 100)
      if (!amount || amount <= 0) {
        setError(t('payments.error_invalid_amount', 'Monto invalido'))
        return
      }
      await api.post('/payments/manual', {
        receiver_id: scanResult?.payment_req.user_id,
        amount,
        reference: `QR: ${scanResult?.payment_req.account}`,
      })
      setScanResult(null)
      setPayAmount('')
      setManualResult({ status: 'approved', message: t('payments.success_payment_sent', 'Pago enviado correctamente') })
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
      setError(err instanceof Error ? err.message : t('payments.error_generic', 'Error'))
    }
  }

  const sendManual = async () => {
    setError('')
    setManualResult(null)
    try {
      await api.post('/payments/manual', manual)
      setManualResult({ status: 'validated' })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('payments.error_generic', 'Error'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('payments.title', 'Pagos')}</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
          <p><strong>{t('payments.help_title', 'Pagos - Ayuda')}</strong></p>
          <p><strong>{t('payments.help_what_label', 'Que es un pago:')}</strong> {t('payments.help_what', 'Una transferencia de saldo de tu cuenta a la cuenta de otra persona u organizacion dentro de la red de intercambio. El saldo se descuenta de tu cuenta y se suma a la del destinatario.')}</p>
          <p><strong>{t('payments.help_purpose_label', 'Para que sirve:')}</strong> {t('payments.help_purpose', 'Para comerciar dentro de la red: comprar productos, pagar servicios, saldar deudas, etc. Todo queda registrado en el historial de ambas partes.')}</p>
          <p><strong>{t('payments.help_usage_label', 'Como funciona:')}</strong> {t('payments.help_usage', 'Hay 3 formas de pagar:')}</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>{t('payments.help_qr_label', 'QR:')}</strong> {t('payments.help_qr', 'Genera un codigo QR para que alguien te pague, o escanea el QR de otra persona para pagarle. La otra persona lo escanea con la camara de su movil o carga una foto del QR.')}</li>
            <li><strong>{t('payments.help_nfc_label', 'NFC:')}</strong> {t('payments.help_nfc', 'Pago con tarjeta NFC fisica. El comercio lee la tarjeta del cliente con un lector NFC conectado a un terminal ESP32.')}</li>
            <li><strong>{t('payments.help_manual_label', 'Manual:')}</strong> {t('payments.help_manual', 'Transferencia directa ingresando el ID (UUID) del destinatario. Util cuando no hay QR ni NFC.')}</li>
          </ul>
          <p><strong>{t('payments.help_amount_label', 'Que es el monto:')}</strong> {t('payments.help_amount', 'Es la cantidad de saldo que se transfiere. Se mide en la moneda local del nodo. Puede ser fijo (lo defines al generar el QR) o libre (el que paga decide cuanto).')}</p>
          <p><strong>{t('payments.help_recipient_label', 'Quien recibe:')}</strong> {t('payments.help_recipient', 'La cuenta del destinatario. En QR viene dentro del codigo. En NFC se obtiene del UID de la tarjeta. En manual debes ingresar su ID (UUID).')}</p>
          <p><strong>{t('payments.help_note_label', 'Que es la nota / etiqueta / referencia:')}</strong> {t('payments.help_note', 'Un texto opcional que describe el motivo del pago (ej: "Compra de pan"). Aparece en el historial de ambos para que recuerden de que fue el pago.')}</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('common:close')}</button>
        </div>
      )}

      <div className="flex gap-2">
        {([['qr', 'QR'], ['nfc', 'NFC'], ['manual', 'Manual']] as const).map(([key, label]) => (
          <button key={key} onClick={() => changeTab(key)} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === key ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{label}</button>
        ))}
      </div>
      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {tab === 'qr' && (
        <div className="space-y-4">
          {/* Generar QR */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2"><QrCode size={20} /><h2 className="font-semibold">{t('payments.qr_my_code', 'Mi Codigo QR de Pago')}</h2></div>
            <p className="text-xs text-gray-500">{t('payments.qr_gen_desc', 'Genera un codigo QR para que alguien te pague. Si especificas un monto, el QR sera para pagar exactamente esa cantidad. Si lo dejas vacio, el que paga decide el monto.')}</p>

            <div className="space-y-3">
              <div>
                <label className="label">{t('payments.display_name_label', 'Nombre para mostrar (opcional)')}</label>
                <input className="input" placeholder={t('payments.display_name_ph', 'Ej: Juan Perez')} value={genDisplayName} onChange={(e) => setGenDisplayName(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">{t('payments.display_name_hint', 'Como quieres que te vea quien te paga. Aparece junto al QR. Ej: "Juan Perez" o "Ferreteria Don Jose".')}</p>
              </div>
              <div>
                <label className="label">{t('payments.amount_fixed_label', 'Monto (dejar vacio = monto libre)')}</label>
                <input className="input" placeholder={t('payments.amount_fixed_ph', 'Ej: 500')} value={genAmount} onChange={(e) => setGenAmount(e.target.value)} type="number" />
                <p className="text-xs text-gray-400 mt-1">{t('payments.amount_fixed_hint', 'Cuanto debe pagarte. Si lo dejas vacio, el que paga decide el monto al escanear. Ej: 500 para un pago fijo de 500.')}</p>
              </div>
              <div>
                <label className="label">{t('payments.label_label', 'Etiqueta / descripcion (opcional)')}</label>
                <input className="input" placeholder={t('payments.label_ph', 'Ej: Pago de productos')} value={genLabel} onChange={(e) => setGenLabel(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">{t('payments.label_hint', 'Un texto corto que describe el motivo del pago. Aparece en el historial de ambos. Ej: "Pago de productos" o "Cuota enero".')}</p>
              </div>
              <button onClick={generateQR} className="btn-primary">{t('payments.generate_qr', 'Generar QR')}</button>
            </div>

            {qrData && (
              <div className="space-y-3">
                <div ref={qrWrapperRef} className="bg-white border-2 border-gray-200 rounded-lg p-4 flex justify-center">
                  <QRCodeSVG value={qrData} size={256} level="M" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={downloadQR} className="btn-secondary flex items-center gap-1">
                    <Download size={16} /> {t('payments.download', 'Descargar')}
                  </button>
                  <button onClick={shareQR} className="btn-secondary flex items-center gap-1">
                    <Share2 size={16} /> {t('payments.share', 'Compartir')}
                  </button>
                  <button onClick={copyQR} className="btn-secondary flex items-center gap-1">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? t('payments.copied', 'Copiado') : t('payments.copy_data', 'Copiar datos')}
                  </button>
                </div>
                {qrPaymentReq && (
                  <div className="bg-trueque-50 p-3 rounded-lg text-sm space-y-1">
                    <p><strong>{t('payments.qr_user', 'Usuario:')}</strong> {qrPaymentReq.user}</p>
                    <p><strong>{t('payments.qr_account', 'Cuenta:')}</strong> {qrPaymentReq.account}</p>
                    <p><strong>{t('payments.qr_node', 'Nodo:')}</strong> {qrPaymentReq.node}</p>
                    {qrPaymentReq.amount !== null && <p><strong>{t('payments.qr_amount', 'Monto:')}</strong> {qrPaymentReq.amount}</p>}
                    {qrPaymentReq.label && <p><strong>{t('payments.qr_label', 'Etiqueta:')}</strong> {qrPaymentReq.label}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Escanear QR */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2"><ScanLine size={20} /><h2 className="font-semibold">{t('payments.scan_title', 'Escanear QR para Pagar')}</h2></div>
            <p className="text-xs text-gray-500">{t('payments.scan_desc', 'Escanea el codigo QR de la persona que va a recibir el pago. Puedes usar la camara o cargar una imagen del QR.')}</p>

            {!scanning && !scanResult && (
              <div className="space-y-2">
                <button onClick={startCamera} className="btn-primary w-full flex items-center justify-center gap-2">
                  <Camera size={20} /> {t('payments.open_camera', 'Abrir camara')}
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="btn-secondary w-full flex items-center justify-center gap-2">
                  <Upload size={20} /> {t('payments.upload_image', 'Cargar imagen del QR')}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </div>
            )}

            {scanning && (
              <div className="space-y-2">
                <div id="qr-reader" className="w-full" />
                <button onClick={stopCamera} className="btn-secondary w-full flex items-center justify-center gap-2">
                  <X size={20} /> {t('common:cancel')}
                </button>
              </div>
            )}

            {scanResult && (
              <div className="space-y-3">
                <div className={`p-3 rounded-lg text-sm ${scanResult.is_local_node ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
                  {scanResult.is_local_node ? t('payments.same_node', 'Mismo nodo') : t('payments.external_node', 'Nodo externo')}: {scanResult.payment_req.node}
                </div>
                <div className="bg-trueque-50 p-3 rounded-lg text-sm space-y-1">
                  <p><strong>{t('payments.scan_user', 'Usuario:')}</strong> {scanResult.payment_req.user}</p>
                  <p><strong>{t('payments.scan_name', 'Nombre:')}</strong> {scanResult.payment_req.display_name || 'N/A'}</p>
                  <p><strong>{t('payments.scan_account', 'Cuenta:')}</strong> {scanResult.payment_req.account}</p>
                  {scanResult.payment_req.amount !== null && <p><strong>{t('payments.scan_amount', 'Monto solicitado:')}</strong> {scanResult.payment_req.amount}</p>}
                  {scanResult.payment_req.label && <p><strong>{t('payments.scan_label', 'Etiqueta:')}</strong> {scanResult.payment_req.label}</p>}
                </div>
                {scanResult.payment_req.amount === null && (
                  <div>
                    <label className="label">{t('payments.enter_amount', 'Ingrese monto a pagar')}</label>
                    <input className="input" type="number" placeholder={t('payments.enter_amount_ph', 'Ej: 500')} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                    <p className="text-xs text-gray-400 mt-1">{t('payments.enter_amount_hint', 'Cuanto saldo quieres enviar al destinatario. Debe ser mayor que 0. Ej: 500 para pagar 500 unidades.')}</p>
                  </div>
                )}
                <button onClick={confirmPayment} className="btn-primary w-full">{t('payments.confirm_payment', 'Confirmar Pago')}</button>
                <button onClick={() => setScanResult(null)} className="btn-secondary w-full">{t('common:cancel')}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'nfc' && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2"><Nfc size={20} /><h2 className="font-semibold">{t('payments.nfc_title', 'Pago por NFC')}</h2></div>
          <p className="text-xs text-gray-500">{t('payments.nfc_desc', 'Ingresa el UID de la tarjeta NFC del usuario. En produccion, este campo se llena automaticamente al acercar la tarjeta al lector NFC conectado al terminal ESP32.')}</p>
          <div>
            <label className="label">{t('payments.nfc_uid_label', 'UID de tarjeta NFC')}</label>
            <input className="input" placeholder={t('payments.nfc_uid_ph', 'Ej: 04A3B2C1')} value={nfcUID} onChange={(e) => setNfcUID(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">{t('payments.nfc_uid_hint', 'El identificador unico de la tarjeta NFC del cliente. En produccion se lee automaticamente al acercar la tarjeta al lector. Ej: 04A3B2C1.')}</p>
          </div>
          <button onClick={lookupNFC} className="btn-primary" disabled={!nfcUID}>{t('payments.lookup_card', 'Buscar tarjeta')}</button>
          {nfcResult && (
            <div className="bg-trueque-50 p-3 rounded-lg text-sm space-y-1">
              <p><strong>{t('payments.nfc_card_uid', 'Card UID:')}</strong> {nfcResult.card_uid}</p>
              <p><strong>{t('payments.nfc_user', 'Usuario:')}</strong> {nfcResult.user_id}</p>
              <p><strong>{t('payments.nfc_active', 'Activa:')}</strong> {nfcResult.is_active ? t('payments.nfc_yes', 'Si') : t('payments.nfc_no', 'No')}</p>
              {nfcResult.is_local === false && (
                <p className="text-amber-700"><strong>{t('payments.note_label', 'Nota:')}</strong> {t('payments.nfc_external_note', 'Tarjeta de otro nodo - se consultara via federation')}</p>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'manual' && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2"><Send size={20} /><h2 className="font-semibold">{t('payments.manual_title', 'Pago Manual')}</h2></div>
          <p className="text-xs text-gray-500">{t('payments.manual_desc', 'Transferencia directa a otro usuario. Necesitas su ID (UUID). El remitente eres tu (se obtiene de tu sesion).')}</p>
          <div>
            <label className="label">{t('payments.manual_id_label', 'ID del destinatario (UUID)')}</label>
            <input className="input" placeholder={t('payments.manual_id_ph', 'Ej: a14dd44f-8da1-4bf7-8ad6-762a9d10d562')} value={manual.receiver_id} onChange={(e) => setManual({ ...manual, receiver_id: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">{t('payments.manual_id_hint', 'El identificador unico (UUID) de la cuenta que recibira el pago. Puedes pedirselo al destinatario. Ej: a14dd44f-8da1-4bf7-8ad6-762a9d10d562.')}</p>
          </div>
          <div>
            <label className="label">{t('payments.manual_amount_label', 'Monto')}</label>
            <input type="number" className="input" placeholder={t('payments.manual_amount_ph', 'Ej: 500')} value={manual.amount || ''} onChange={(e) => setManual({ ...manual, amount: toCents(e.target.value) })} />
            <p className="text-xs text-gray-400 mt-1">{t('payments.manual_amount_hint', 'Cuanto saldo quieres enviar. Debe ser mayor que 0 y no superar tu limite de credito. Ej: 500 para enviar 500 unidades.')}</p>
          </div>
          <div>
            <label className="label">{t('payments.manual_ref_label', 'Referencia (opcional)')}</label>
            <input className="input" placeholder={t('payments.manual_ref_ph', 'Ej: Pago de productos')} value={manual.reference} onChange={(e) => setManual({ ...manual, reference: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">{t('payments.manual_ref_hint', 'Una nota breve que describe el motivo del pago. Aparece en el historial de ambos. Ej: "Pago de productos" o "Deuda semana 3".')}</p>
          </div>
          <button onClick={sendManual} className="btn-primary">{t('payments.send', 'Enviar')}</button>
          {manualResult && <div className="bg-trueque-50 p-3 rounded-lg text-sm">{JSON.stringify(manualResult, null, 2)}</div>}
        </div>
      )}
    </div>
  )
}
