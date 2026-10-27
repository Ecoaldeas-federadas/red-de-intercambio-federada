import { useState, useEffect } from 'react'
import { API } from '../api'
import { fmtTQ } from '../utils/format'

export interface POSCartLine {
  store_item_id?: string
  product_id?: string
  item_code: string
  item_name: string
  unit: string
  quantity: number
  unit_price_cents: number
  subtotal_cents: number
  is_service?: boolean
}

interface Props {
  amount: number
  onAmountChange: (amount: number) => void
  cartItems?: POSCartLine[]
  onCartChange?: (items: POSCartLine[]) => void
  onShowQR: (token: string) => void
  onShowNFC: () => void
  onShowSales: () => void
  onShowSettings: () => void
  onShowConfirm: () => void
  terminalID: string | null
  sessionToken: string | null
  api: API
  merchantUser: any
}

export function KeypadScreen({
  amount, onAmountChange, cartItems = [], onCartChange, onShowSales, onShowSettings, onShowConfirm,
  terminalID, api, merchantUser
}: Props) {
  const [sessionActive, setSessionActive] = useState(false)
  const [error, setError] = useState('')
  const [catalog, setCatalog] = useState<any[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [search, setSearch] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [qtyInput, setQtyInput] = useState('1')

  useEffect(() => {
    checkTerminalStatus()
    loadVendorCatalog()
  }, [])

  // Listener opcional para etiquetas NFC de producto/canasta (Web NFC)
  useEffect(() => {
    const anyWin = window as any
    if (!('NDEFReader' in anyWin)) return
    const reader = new anyWin.NDEFReader()
    reader.scan().then(() => {
      reader.onreading = (event: any) => {
        for (const record of event.message?.records || []) {
          if (record.recordType === 'text') {
            const decoder = new TextDecoder(record.encoding || 'utf-8')
            const text = decoder.decode(record.data)
            if (text.startsWith('tq1:')) {
              handleScanOrCode(text)
            }
          }
        }
      }
    }).catch(() => {})
  }, [catalog])

  const checkTerminalStatus = async () => {
    if (!terminalID) return
    try {
      const status = await api.getTerminalStatus(terminalID)
      setSessionActive(status.is_active !== false)
    } catch {}
  }

  const loadVendorCatalog = async () => {
    setLoadingCatalog(true)
    try {
      const cachedRaw = localStorage.getItem('pos_vendor_catalog_cache')
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw)
        if (Array.isArray(parsed.items)) setCatalog(parsed.items)
      }
      const res = await api.getVendorCatalog({ sellerID: merchantUser?.id })
      if (res && Array.isArray(res.items)) {
        setCatalog(res.items)
        localStorage.setItem('pos_vendor_catalog_cache', JSON.stringify(res))
      }
    } catch {} finally {
      setLoadingCatalog(false)
    }
  }

  const updateCart = (next: POSCartLine[]) => {
    const total = next.reduce((acc, it) => acc + it.subtotal_cents, 0)
    onCartChange?.(next)
    onAmountChange(total)
  }

  const addCatalogItemToCart = (catItem: any, quantity: number) => {
    if (!catItem || quantity <= 0) return
    const unitPrice = Number(catItem.p || 0)
    const subtotal = Math.max(1, Math.round(unitPrice * quantity))
    const newLine: POSCartLine = {
      store_item_id: catItem.univ ? '' : catItem.id,
      product_id: catItem.pid || (catItem.univ ? catItem.id : ''),
      item_code: catItem.code || '',
      item_name: catItem.name,
      unit: catItem.u || 'unidad',
      quantity,
      unit_price_cents: unitPrice,
      subtotal_cents: subtotal,
      is_service: !!catItem.svc,
    }
    updateCart([...cartItems, newLine])
    setSelectedItem(null)
    setQtyInput('1')
  }

  // Escanear o digitar codigo de barras EAN-13 con peso (21CCCCCQQQQQD), QR/NFC (tq1:...) o codigo corto (10001)
  const handleScanOrCode = async (rawCode?: string) => {
    const code = (rawCode ?? barcodeInput).trim()
    if (!code) return
    setError('')
    try {
      // 1. Intentar decodificar primero localmente si es codigo corto o EAN-13 de nuestra tienda cacheada
      if (/^\d{13}$/.test(code) && ['21', '22', '23'].includes(code.slice(0, 2))) {
        const prefix = code.slice(0, 2)
        const itemCode = code.slice(2, 7)
        const qtyRaw = parseInt(code.slice(7, 12), 10) || 1000
        const qty = prefix === '22' ? qtyRaw / 100 : prefix === '23' ? qtyRaw : qtyRaw / 1000
        const match = catalog.find((c) => c.code === itemCode || c.code === itemCode.replace(/^0+/, ''))
        if (match) {
          addCatalogItemToCart(match, qty)
          setBarcodeInput('')
          return
        }
      }
      const directMatch = catalog.find((c) => c.code === code)
      if (directMatch) {
        setSelectedItem(directMatch)
        setQtyInput('1')
        setBarcodeInput('')
        return
      }
      // 2. Consultar al servidor (soporta tq1:p:..., tq1:b:..., tq1:r:... y EAN-13)
      const parsed = await api.parsePOSCode(code, merchantUser?.id)
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        updateCart([...cartItems, ...parsed.items])
        setBarcodeInput('')
      }
    } catch (e: any) {
      setError(e?.message || 'Codigo no encontrado en la tienda')
    }
  }

  const removeLine = (idx: number) => {
    updateCart(cartItems.filter((_, i) => i !== idx))
  }

  const filteredCatalog = catalog.filter((c) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (c.name || '').toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q) || (c.cat || '').toLowerCase().includes(q)
  })

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: 14, maxWidth: 520, margin: '0 auto', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{merchantUser?.display_name || merchantUser?.username || 'POS Tienda'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {sessionActive ? '🟢 Terminal Activo' : '🔴 Terminal Inactivo'} · {catalog.length} ítems sincronizados
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadVendorCatalog} title="Sincronizar Tienda" style={{ background: 'var(--card)', borderRadius: 10, padding: 10, color: 'var(--text)' }}>
            🔄
          </button>
          <button onClick={onShowSales} style={{ background: 'var(--card)', borderRadius: 10, padding: 10, color: 'var(--text)' }}>
            📊
          </button>
          <button onClick={onShowSettings} style={{ background: 'var(--card)', borderRadius: 10, padding: 10, color: 'var(--text)' }}>
            ⚙️
          </button>
        </div>
      </div>

      {/* Escáner / Entrada de Código de Barra (con peso), QR, NFC o Código Corto */}
      <div className="card" style={{ padding: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
          ESCANEAR CODIGO DE BARRAS (CON PESO), QR, ETIQUETA NFC O CODIGO (#10001)
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleScanOrCode() }}
            placeholder="Escanee barra/QR o digite código..."
            style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: 'white', fontSize: 14 }}
          />
          <button className="btn btn-primary" style={{ padding: '10px 14px', fontSize: 13 }} onClick={() => handleScanOrCode()}>
            + Agregar
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(220,38,38,0.15)', color: 'var(--danger)', padding: 10, borderRadius: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Modal rápido de peso/cantidad cuando se selecciona un producto de la lista */}
      {selectedItem && (
        <div className="card" style={{ padding: 12, border: '2px solid var(--accent-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>[{selectedItem.code}] {selectedItem.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{fmtTQ(selectedItem.p)} TQ por {selectedItem.u}</div>
            </div>
            <button onClick={() => setSelectedItem(null)} style={{ background: 'transparent', color: '#94a3b8', fontSize: 18 }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              step="any"
              min="0.001"
              value={qtyInput}
              onChange={(e) => setQtyInput(e.target.value)}
              style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: 'white', fontSize: 16, fontWeight: 700 }}
              placeholder={`Cantidad en ${selectedItem.u}`}
            />
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{selectedItem.u}</span>
            <button
              className="btn btn-primary"
              style={{ padding: '10px 16px', fontSize: 14 }}
              onClick={() => addCatalogItemToCart(selectedItem, parseFloat(qtyInput) || 1)}
            >
              Confirmar
            </button>
          </div>
        </div>
      )}

      {/* Buscador de Productos y Servicios de la Tienda del Vendedor */}
      <div className="card" style={{ padding: 10, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 170, maxHeight: 240 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Buscar producto o servicio por nombre..."
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: 'white', fontSize: 13, marginBottom: 8 }}
        />
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {loadingCatalog && catalog.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, padding: 16 }}>Sincronizando tienda...</div>
          ) : filteredCatalog.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, padding: 16 }}>
              No hay productos en tu tienda con ese filtro.
            </div>
          ) : (
            filteredCatalog.map((item) => (
              <button
                key={item.id}
                onClick={() => { setSelectedItem(item); setQtyInput('1') }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
                  padding: '8px 10px', color: 'white', textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {item.ic && (
                    <img src={item.ic.startsWith('http') ? item.ic : `${api.getBaseURL()}${item.ic}`} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
                  )}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      <span style={{ color: '#94a3b8', fontFamily: 'monospace', marginRight: 6 }}>#{item.code}</span>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {item.univ ? '🌾 Servicio Universal (Conuco/Mano Vuelta)' : item.svc ? '🛠 Servicio' : `Stock: ${item.s}`}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-light)', fontSize: 14 }}>{fmtTQ(item.p)} TQ</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>/{item.u}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Canasta Actual */}
      <div className="card" style={{ padding: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)' }}>
            🛒 CANASTA ({cartItems.length} {cartItems.length === 1 ? 'ítem' : 'ítems'})
          </span>
          {cartItems.length > 0 && (
            <button onClick={() => updateCart([])} style={{ background: 'transparent', color: 'var(--danger)', fontSize: 11 }}>
              Vaciar
            </button>
          )}
        </div>
        {cartItems.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', padding: 10 }}>
            Seleccione o escanee productos/servicios de su tienda para armar la canasta.
          </div>
        ) : (
          <div style={{ maxHeight: 130, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {cartItems.map((line, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '4px 0', borderBottom: '1px solid #1e293b' }}>
                <div>
                  <strong>{line.item_name}</strong>{' '}
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>× {line.quantity} {line.unit}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700 }}>{fmtTQ(line.subtotal_cents)} TQ</span>
                  <button onClick={() => removeLine(i)} style={{ background: 'transparent', color: 'var(--danger)', fontSize: 14 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid #334155' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>TOTAL CANASTA</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-light)' }}>{fmtTQ(amount)} TQ</span>
        </div>
      </div>

      <button
        className="btn btn-primary"
        style={{ fontSize: 17, padding: 16 }}
        onClick={onShowConfirm}
        disabled={cartItems.length === 0 || amount <= 0 || !sessionActive}
      >
        💳 Cobrar Canasta ({fmtTQ(amount)} TQ)
      </button>
    </div>
  )
}
