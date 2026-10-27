import { useState, useRef } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api'
import { useTranslation } from 'react-i18next'
import { Nfc, ScanLine, Camera, Upload, X, HelpCircle, Store } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import jsQR from 'jsqr'

export default function Payments() {
  const { t } = useTranslation('transfer')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as 'qr' | 'nfc') === 'nfc' ? 'nfc' : 'qr'
  const [tab, setTab] = useState<'qr' | 'nfc'>(initialTab)
  const changeTab = (next: 'qr' | 'nfc') => {
    setTab(next)
    setSearchParams({ tab: next })
  }
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [scannedBasket, setScannedBasket] = useState<any>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // NFC state
  const [nfcUID, setNfcUID] = useState('')
  const [nfcResult, setNfcResult] = useState<any>(null)

  const startCamera = async () => {
    setError('')
    setScannedBasket(null)
    setScanning(true)
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
      const errMsg = err instanceof Error ? err.message : String(err)
      setError(t('payments.error_camera_generic', `No se pudo acceder a la camara: ${errMsg}.`, { msg: errMsg }))
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
    const trimmed = data.trim()
    // Si es una URL de pago POS (/pay?t=...)
    if (trimmed.includes('/pay?t=')) {
      const token = trimmed.split('/pay?t=')[1]?.split('&')[0]
      if (token) {
        navigate(`/pay?t=${token}`)
        return
      }
    }
    // Si es un codigo de producto/canasta (tq1:... o EAN-13 con peso)
    try {
      const parsed = await api.post<any>('/pos/code/parse', { code: trimmed })
      setScannedBasket(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('payments.error_invalid_qr', 'Codigo QR o de barra invalido'))
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
        if (!ctx) return
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
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const payScannedBasket = async () => {
    if (!scannedBasket || !Array.isArray(scannedBasket.items)) return
    setError('')
    try {
      const charge = await api.post<any>('/pos/charge', {
        seller_id: scannedBasket.seller_id,
        items: scannedBasket.items,
        description: scannedBasket.summary,
      })
      if (charge?.charge_token) {
        navigate(`/pay?t=${charge.charge_token}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar el pago de la canasta')
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('payments.title', 'Pagos por Canasta / QR / NFC')}</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      <div className="card bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3 flex-wrap">
        <span>
          {t('payments.store_only_notice', 'Todo cobro se genera desde los productos o servicios de tu Tienda (codigos de barra con peso, QR de canasta o etiquetas NFC). No existen cobros ni pagos de monto libre.')}
        </span>
        <Link to="/app/store" className="btn-primary text-xs flex items-center gap-1.5">
          <Store size={14} /> {t('payments.go_to_my_store', 'Generar etiquetas en Mi Tienda')}
        </Link>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
          <p><strong>{t('payments.help_title', 'Pagos por Canasta - Ayuda')}</strong></p>
          <p>{t('payments.help_basket_only', 'Para pagar un producto o una canasta, escanea el codigo QR o etiqueta NFC generada por el vendedor desde su Tienda o Punto de Venta. El sistema verifica automaticamente cada producto o servicio real.')}</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('common:close')}</button>
        </div>
      )}

      <div className="flex gap-2">
        {([['qr', 'Escanear QR / Canasta'], ['nfc', 'Verificar Tarjeta NFC']] as const).map(([key, label]) => (
          <button key={key} onClick={() => changeTab(key)} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === key ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{label}</button>
        ))}
      </div>
      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {tab === 'qr' && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2"><ScanLine size={20} /><h2 className="font-semibold">{t('payments.scan_title', 'Escanear QR de Producto o Canasta para Pagar')}</h2></div>
          <p className="text-xs text-gray-500">{t('payments.scan_desc', 'Escanea el codigo QR del Punto de Venta o de la etiqueta de un producto/canasta.')}</p>

          {!scanning && !scannedBasket && (
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

          {scannedBasket && (
            <div className="space-y-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="font-semibold text-sm text-emerald-900">
                {t('payments.scanned_seller', 'Vendedor:')} {scannedBasket.seller_name || scannedBasket.seller_id}
              </p>
              <div className="space-y-1 text-xs">
                {(scannedBasket.items || []).map((it: any, idx: number) => (
                  <div key={idx} className="flex justify-between bg-white p-2 rounded border">
                    <span>{it.item_name} × {it.quantity} {it.unit}</span>
                    <strong>{((it.subtotal_cents || 0) / 100).toFixed(2)} TQ</strong>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-trueque-800 pt-1">
                <span>Total:</span>
                <span>{((scannedBasket.total_cents || 0) / 100).toFixed(2)} TQ</span>
              </div>
              <div className="flex gap-2">
                <button onClick={payScannedBasket} className="btn-primary flex-1">
                  {t('payments.proceed_to_pay', 'Ir a Pagar Canasta')}
                </button>
                <button onClick={() => setScannedBasket(null)} className="btn-secondary">
                  {t('common:cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'nfc' && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2"><Nfc size={20} /><h2 className="font-semibold">{t('payments.nfc_title', 'Verificar Tarjeta NFC')}</h2></div>
          <div>
            <label className="label">{t('payments.nfc_uid_label', 'UID de tarjeta NFC')}</label>
            <input className="input" placeholder={t('payments.nfc_uid_ph', 'Ej: 04A3B2C1')} value={nfcUID} onChange={(e) => setNfcUID(e.target.value)} />
          </div>
          <button onClick={lookupNFC} className="btn-primary" disabled={!nfcUID}>{t('payments.lookup_card', 'Buscar tarjeta')}</button>
          {nfcResult && (
            <div className="bg-trueque-50 p-3 rounded-lg text-sm space-y-1">
              <p><strong>{t('payments.nfc_card_uid', 'Card UID:')}</strong> {nfcResult.card_uid}</p>
              <p><strong>{t('payments.nfc_user', 'Usuario:')}</strong> {nfcResult.user_id}</p>
              <p><strong>{t('payments.nfc_active', 'Activa:')}</strong> {nfcResult.is_active ? t('payments.nfc_yes', 'Si') : t('payments.nfc_no', 'No')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
