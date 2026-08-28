import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, apiFetch, getStorageKeys } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { useSerialChipId } from '../hooks/useSerialChipId'
import { EntitySelector } from '../components/EntitySelector'
import { Nfc, Plus, Trash2, CreditCard, KeyRound, Activity, Cpu, Usb, Download, Lock, HelpCircle, X, UserPlus, Edit } from 'lucide-react'
import { fmtDateTime, fmtNumber } from '../lib/format'

interface Terminal {
  id: string
  terminal_id: string
  label: string | null
  terminal_type: string
  location: string | null
  is_active: boolean
  is_registered: boolean
  last_seen: string | null
  firmware_version: string | null
  created_at: string
  chip_id?: string | null
  device_fingerprint?: string | null
  device_model?: string | null
  device_manufacturer?: string | null
  android_version?: string | null
  organization_id?: string | null
  organization_name?: string | null
  merchant_user_id?: string | null
  merchant_user_name?: string | null
}

interface Transaction {
  id: string
  terminal_id: string
  card_uid: string
  amount: number
  status: string
  pin_verified: boolean
  transaction_type: string
  error_message: string
  created_at: string
}

export default function NFCTerminals() {
  const { hasPermission } = usePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as 'terminals' | 'provision' | 'cards' | 'transactions' | 'pairing') || 'terminals'
  const [tab, setTab] = useState<'terminals' | 'provision' | 'cards' | 'transactions' | 'pairing'>(initialTab)
  const changeTab = (t: 'terminals' | 'provision' | 'cards' | 'transactions' | 'pairing') => {
    setTab(t)
    setSearchParams({ tab: t })
  }
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [terminalFilter, setTerminalFilter] = useState<'all' | 'assigned' | 'unassigned'>('all')
  const [terminalSearch, setTerminalSearch] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [terminalTypes, setTerminalTypes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [showIssueCard, setShowIssueCard] = useState(false)
  const [showResetPIN, setShowResetPIN] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  // Pairing state
  const [pendingPairings, setPendingPairings] = useState<any[]>([])
  const [pairingPoll, setPairingPoll] = useState<any>(null)
  const [approveLabel, setApproveLabel] = useState('')
  const [approveLocation, setApproveLocation] = useState('')
  const [approvingCode, setApprovingCode] = useState('')
  const [pairingAction, setPairingAction] = useState('')
  const [pairingOptions, setPairingOptions] = useState<string[]>([])
  const [selectedCode, setSelectedCode] = useState('')
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [optionsError, setOptionsError] = useState('')

  // Provisioning state
  const { chipId, scanning, error: serialError, supported: serialSupported, scan } = useSerialChipId()
  const [provisionChipId, setProvisionChipId] = useState('')
  const [provisionType, setProvisionType] = useState('keypad')
  const [provisionLabel, setProvisionLabel] = useState('')
  const [provisionLocation, setProvisionLocation] = useState('')
  const [provisionResult, setProvisionResult] = useState<{ terminal_id: string; config_h_url: string } | null>(null)
  const [provisioning, setProvisioning] = useState(false)
  const [compiling, setCompiling] = useState(false)
  const [compileResult, setCompileResult] = useState<{ build_id: string; download_url: string; size: number } | null>(null)

  const canRegisterTerminal = hasPermission('nfc.register_terminal')
  const canDeactivateTerminal = hasPermission('nfc.deactivate_terminal')
  const canIssueCard = hasPermission('nfc.issue_card')
  const canResetPIN = hasPermission('nfc.reset_pin')

  useEffect(() => {
    loadTerminals()
    loadTerminalTypes()
    loadTransactions()
  }, [])

  // Auto-refresh pending pairings when on pairing tab
  useEffect(() => {
    if (tab === 'pairing') {
      loadPendingPairings()
      const interval = setInterval(loadPendingPairings, 3000)
      setPairingPoll(interval)
      return () => { clearInterval(interval); setPairingPoll(null) }
    }
  }, [tab])

  const loadPendingPairings = async () => {
    try {
      const res = await api.get<any[]>('/nfc/terminal/pair/pending')
      setPendingPairings(res || [])
    } catch (err) {
      // ignore errors silently
    }
  }

  const loadPairingOptions = async (reqId: string) => {
    setLoadingOptions(true)
    setPairingOptions([])
    setSelectedCode('')
    setOptionsError('')
    try {
      const res = await api.get<any>(`/nfc/terminal/pair/request/${reqId}/options`)
      const options = Array.isArray(res) ? res : res?.options ?? []
      if (options.length === 0) {
        setOptionsError('No se pudieron cargar las opciones de verificacion')
      } else {
        setPairingOptions(options)
      }
    } catch (err) {
      setOptionsError(err instanceof Error ? err.message : 'Error al cargar opciones de verificacion')
      setPairingOptions([])
    }
    setLoadingOptions(false)
  }

  const approvePairing = async (reqId: string, mode: string = 'new') => {
    setPairingAction(reqId)
    try {
      await api.post(`/nfc/terminal/pair/request/${reqId}/approve`, {
        label: approveLabel || undefined,
        location: approveLocation || undefined,
        mode,
        selected_code: selectedCode || undefined,
      })
      setPendingPairings(prev => prev.filter(p => p.id !== reqId))
      setApprovingCode('')
      setApproveLabel('')
      setApproveLocation('')
      setSelectedCode('')
      setPairingOptions([])
      setOptionsError('')
      loadTerminals()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al aprobar emparejamiento')
    } finally {
      setPairingAction('')
    }
  }

  const rejectPairing = async (reqId: string) => {
    setPairingAction(reqId + '-reject')
    try {
      await api.post(`/nfc/terminal/pair/request/${reqId}/reject`, {})
      setPendingPairings(prev => prev.filter(p => p.id !== reqId))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al rechazar')
    } finally {
      setPairingAction('')
    }
  }

  const loadTerminals = async () => {
    try {
      const res = await api.get<Terminal[]>('/nfc/terminals')
      setTerminals(res || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const loadTerminalTypes = async () => {
    try {
      const res = await api.get<string[]>('/nfc/terminals/types')
      setTerminalTypes(res || ['keypad', 'web', 'touch', 'community', 'android_pos', 'ble-reader'])
    } catch {
      setTerminalTypes(['keypad', 'web', 'touch', 'community', 'android_pos', 'ble-reader'])
    }
  }

  const loadTransactions = async () => {
    try {
      const res = await api.get<Transaction[]>('/nfc/transactions?limit=50')
      setTransactions(res || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const [newTerminal, setNewTerminal] = useState({
    terminal_id: '',
    label: '',
    terminal_type: 'keypad',
    location: '',
  })
  const [regToken, setRegToken] = useState('')

  const registerTerminal = async () => {
    setError('')
    try {
      const res = await api.post<{ terminal: Terminal; registration_token: string }>('/nfc/terminal/register', newTerminal)
      setRegToken(res.registration_token)
      setShowRegister(false)
      loadTerminals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const deactivateTerminal = async (terminalId: string) => {
    try {
      await api.delete(`/nfc/terminal/${terminalId}`)
      loadTerminals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const [showAssignModal, setShowAssignModal] = useState<string | null>(null)
  const [assignTarget, setAssignTarget] = useState('')
  const [assignType, setAssignType] = useState<'user' | 'org'>('user')
  const [showEditModal, setShowEditModal] = useState<Terminal | null>(null)
  const [editForm, setEditForm] = useState({ label: '', location: '', terminal_type: '' })

  const openEditModal = (t: Terminal) => {
    setEditForm({
      label: t.label || '',
      location: t.location || '',
      terminal_type: t.terminal_type || '',
    })
    setShowEditModal(t)
  }

  const saveEditTerminal = async () => {
    if (!showEditModal) return
    try {
      await apiFetch(`/nfc/terminal/${showEditModal.terminal_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          label: editForm.label,
          location: editForm.location,
        }),
      })
      setShowEditModal(null)
      loadTerminals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al editar terminal')
    }
  }

  const [assigning, setAssigning] = useState(false)
  const assignTerminal = async (terminalId: string) => {
    if (!assignTarget) return
    setAssigning(true)
    try {
      await apiFetch(`/nfc/terminal/${terminalId}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          target_type: assignType,
          target_id: assignTarget,
        }),
      })
      setAssignTarget('')
      await loadTerminals()
      setShowAssignModal(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setAssigning(false)
    }
  }

  const [newCard, setNewCard] = useState({ user_id: '', card_uid: '', card_type: 'uid_only', initial_pin: '' })
  const issueCard = async () => {
    setError('')
    try {
      await api.post('/nfc/cards/issue', newCard)
      setShowIssueCard(false)
      setNewCard({ user_id: '', card_uid: '', card_type: 'uid_only', initial_pin: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const [pinChange, setPinChange] = useState({ card_uid: '', old_pin: '', new_pin: '' })
  const changePIN = async () => {
    setError('')
    try {
      await api.put('/nfc/cards/pin', pinChange)
      setPinChange({ card_uid: '', old_pin: '', new_pin: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const [resetPINValue, setResetPINValue] = useState('')
  const resetPIN = async (cardUID: string) => {
    setError('')
    try {
      await api.put(`/nfc/cards/${cardUID}/pin/reset`, { new_pin: resetPINValue })
      setShowResetPIN(null)
      setResetPINValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const formatAmount = (cents: number) => `${(cents / 100).toFixed(2)}`
  const formatTime = (ts: string | null) => {
    if (!ts) return 'Nunca'
    return fmtDateTime(ts)
  }

  // Cuando el escaneo USB encuentra el chip ID, llenar el campo
  useEffect(() => {
    if (chipId) setProvisionChipId(chipId)
  }, [chipId])

  const provisionTerminal = async () => {
    setError('')
    setProvisioning(true)
    setProvisionResult(null)
    try {
      const res = await api.post<{ terminal: Terminal; registration_token: string; config_h_url: string }>('/nfc/terminal/provision', {
        chip_id: provisionChipId,
        terminal_type: provisionType,
        label: provisionLabel,
        location: provisionLocation,
      })
      setProvisionResult({ terminal_id: res.terminal.terminal_id, config_h_url: res.config_h_url })
      loadTerminals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al provisionar')
    } finally {
      setProvisioning(false)
    }
  }

  const downloadConfigH = async (terminalId: string) => {
    try {
      const token = localStorage.getItem(getStorageKeys().tokenKey)
      const res = await fetch(`/api/nfc/terminal/${terminalId}/config.h`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al descargar config.h')
      const text = await res.text()
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'config.h'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const compileFirmware = async (terminalId: string) => {
    setError('')
    setCompiling(true)
    setCompileResult(null)
    try {
      const res = await api.post<{ status: string; build_id: string; size: number; download_url: string }>(`/nfc/terminal/${terminalId}/compile`)
      setCompileResult({ build_id: res.build_id, download_url: res.download_url, size: res.size })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al compilar')
    } finally {
      setCompiling(false)
    }
  }

  const downloadFirmwareBin = async (terminalId: string, buildId: string) => {
    try {
      const token = localStorage.getItem(getStorageKeys().tokenKey)
      const res = await fetch(`/api/nfc/terminal/${terminalId}/firmware.bin?build_id=${buildId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al descargar firmware.bin')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${terminalId}-firmware.bin`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Nfc size={24} /> Terminales NFC</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Terminales NFC - Ayuda</strong></p>
          <p><strong>Que son:</strong> Los terminales NFC son dispositivos fisicos basados en ESP32 que se instalan en comercios para aceptar pagos con tarjetas NFC. Cada usuario puede tener una tarjeta NFC vinculada a su cuenta que contiene su identificador unico.</p>
          <p><strong>Para que sirve:</strong> Permiten realizar transacciones de la red de intercambio de forma presencial, sin necesidad de un computador o telefono. El usuario acerca su tarjeta al terminal, ingresa el monto y su PIN, y el pago se procesa automaticamente.</p>
          <p><strong>Tipos de terminal:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Keypad (teclado):</strong> Terminal con encoder rotativo y display. El comercio ingresa el monto con el encoder y el usuario confirma con su PIN.</li>
            <li><strong>Touch (pantalla tactil):</strong> Terminal con pantalla tactil ILI9341. El comercio ingresa el monto tocando la pantalla.</li>
            <li><strong>Web:</strong> El monto se envia desde la app web o movil. El terminal solo confirma la tarjeta y el PIN.</li>
            <li><strong>Community (comunitario):</strong> Terminal de doble tarjeta: el usuario acerca su tarjeta y la del comercio. No requiere PIN, ideal para mercados comunitarios.</li>
            <li><strong>BLE Reader (Bluetooth):</strong> Lector NFC que se conecta via Bluetooth a un telefono o computador. Util cuando no hay WiFi disponible.</li>
          </ul>
          <p><strong>Como se usa esta pagina:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Terminales:</strong> Lista de los terminales ESP32 registrados en el nodo. Muestra si estan activos y cuando se vieron por ultima vez.</li>
            <li><strong>Provisionar:</strong> Proceso de configurar un terminal ESP32 nuevo. Necesitas conectarlo por USB, leer su chip ID, y descargar el firmware compilado.</li>
            <li><strong>Tarjetas:</strong> Emitir tarjetas NFC para usuarios y cambiar PINs. La tarjeta solo contiene el ID del usuario, no la clave privada. Si se pierde, se desactiva y se emite otra.</li>
            <li><strong>Transacciones:</strong> Historial de pagos realizados a traves de los terminales NFC.</li>
          </ul>
          <p><strong>Que es el chip ID:</strong> Es un identificador unico de 12 caracteres hexadecimales grabado en cada chip ESP32 de fabrica. No se puede modificar y sirve para identificar univocamente cada terminal fisico. Se lee con el sketch chip-id-reader.ino o escaneando via USB con Web Serial.</p>
          <p><strong>Que es el token de registro:</strong> Es un codigo secreto que genera el servidor al registrar o provisionar un terminal. Se copia en el archivo config.h del firmware del ESP32 para que el terminal pueda autenticarse con el nodo al conectarse por primera vez.</p>
          <p><strong>Como vincular tarjetas:</strong> El administrador emite una tarjeta NFC asignandola a un usuario (User ID) y registrando el UID de la tarjeta fisica. La tarjeta se entrega al usuario con un PIN inicial que debe cambiar la primera vez que la use.</p>
          <p><strong>Que es el PIN:</strong> Es un codigo de 4 digitos que protege la tarjeta NFC. Se pide al usuario en cada transaccion (excepto en modo comunitario). Si se olvida, el administrador puede resetearlo a un valor por defecto.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {/* Terminales y Provisionar: solo admin */}
        {canRegisterTerminal && (
          <button onClick={() => changeTab('terminals')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'terminals' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Terminales</button>
        )}
        {canRegisterTerminal && (
          <button onClick={() => changeTab('provision')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'provision' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Provisionar</button>
        )}
        {canRegisterTerminal && (
          <button onClick={() => changeTab('pairing')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 ${tab === 'pairing' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>
            Emparejamientos
            {pendingPairings.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 rounded-full">{pendingPairings.length}</span>
            )}
          </button>
        )}
        {/* Tarjetas: todos pueden ver (su propia tarjeta) */}
        <button onClick={() => changeTab('cards')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'cards' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Tarjetas</button>
        {/* Transacciones: solo admin */}
        {canRegisterTerminal && (
          <button onClick={() => changeTab('transactions')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'transactions' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>Transacciones</button>
        )}
      </div>

      {/* Si el usuario no es admin y esta en una pestaña admin, forzar a cards */}
      {!canRegisterTerminal && tab !== 'cards' && (
        <div className="card bg-amber-50 border-amber-200 text-sm text-amber-700">
          No tienes permiso para ver esta seccion. Solo puedes gestionar tu tarjeta NFC.
        </div>
      )}

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {/* Provision tab */}
      {tab === 'provision' && (
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Cpu size={18} /> Provisionar Terminal Nuevo</h2>
          <p className="text-sm text-gray-500">
            Conecta el ESP32 por USB al computador. Primero descarga y flashea el sketch <code className="bg-gray-100 px-1 rounded">chip-id-reader.ino</code> para poder leer el chip ID.
            Luego escanea el ESP32 desde el navegador o entra el chip ID manualmente.
          </p>

          {/* Descargar sketch chip-id-reader.ino */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium text-amber-800">Paso 0: Descargar el sketch para leer el chip ID</p>
            <p className="text-xs text-amber-700">
              Descarga el archivo .ino, abrelo en Arduino IDE, conecta el ESP32 por USB y subelo.
              Esto mostrara el chip ID en el monitor serie (115200 baud).
            </p>
            <button
              onClick={async () => {
                try {
                  const token = localStorage.getItem(getStorageKeys().tokenKey)
                  const res = await fetch('/api/nfc/chip-id-reader.ino', {
                    headers: { Authorization: `Bearer ${token}` },
                  })
                  if (!res.ok) throw new Error('Error al descargar')
                  const text = await res.text()
                  const blob = new Blob([text], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'chip-id-reader.ino'
                  a.click()
                  URL.revokeObjectURL(url)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Error al descargar')
                }
              }}
              className="btn-primary flex items-center gap-2"
            >
              <Download size={18} /> Descargar chip-id-reader.ino
            </button>
          </div>

          {/* Paso 1: Leer chip ID */}
          <div className="card space-y-3">
            <h3 className="font-medium flex items-center gap-2"><Usb size={16} /> Paso 1: Leer Chip ID del ESP32</h3>

            {serialSupported ? (
              <button onClick={scan} disabled={scanning} className="btn-primary flex items-center gap-2">
                <Usb size={18} /> {scanning ? 'Escaneando...' : 'Escanear ESP32 via USB'}
              </button>
            ) : (
              <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg">
                Web Serial API no soportada. Usa Chrome o Edge, o entra el chip ID manualmente abajo.
              </p>
            )}

            {serialError && <p className="text-sm text-red-600">{serialError}</p>}
            {chipId && (
              <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">
                Chip ID detectado: <code className="font-bold">{chipId}</code>
              </p>
            )}

            <div>
              <label className="label">Chip ID del ESP32 (12 caracteres hexadecimales)</label>
              <input
                className="input font-mono"
                placeholder="Ej: AABBCCDDEEFF"
                value={provisionChipId}
                maxLength={12}
                onChange={(e) => setProvisionChipId(e.target.value.toUpperCase())}
              />
              <p className="text-xs text-gray-400 mt-1">Identificador unico del chip ESP32. Lo obtienes del monitor serie del sketch chip-id-reader.ino. Ejemplo: <code>AABBCCDDEEFF</code></p>
            </div>
          </div>

          {/* Paso 2: Configurar terminal */}
          <div className="card space-y-3">
            <h3 className="font-medium flex items-center gap-2"><Cpu size={16} /> Paso 2: Configurar Terminal</h3>
            <div>
              <label className="label">Tipo de terminal</label>
              <select className="input" value={provisionType} onChange={(e) => setProvisionType(e.target.value)}>
                <option value="keypad">Keypad (con encoder)</option>
                <option value="touch">Touch (pantalla tactil)</option>
                <option value="web">Web (monto desde app)</option>
                <option value="community">Community (doble tarjeta)</option>
                <option value="ble-reader">BLE Reader (lector Bluetooth)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Selecciona el tipo de hardware del terminal. Ejemplo: <strong>Keypad</strong> para terminal con encoder rotativo, <strong>Community</strong> para mercado de doble tarjeta.</p>
            </div>
            <div>
              <label className="label">Etiqueta del terminal</label>
              <input className="input" placeholder="Ej: Ferreteria Don Jose" value={provisionLabel} onChange={(e) => setProvisionLabel(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Nombre descriptivo para identificar el terminal en la lista. Ejemplo: <code>Ferreteria Don Jose</code></p>
            </div>
            <div>
              <label className="label">Ubicacion del terminal</label>
              <input className="input" placeholder="Ej: Local 5, Mercado Central" value={provisionLocation} onChange={(e) => setProvisionLocation(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Direccion o referencia del lugar donde se instala. Ejemplo: <code>Local 5, Mercado Central</code></p>
            </div>
            <button
              onClick={provisionTerminal}
              disabled={!provisionChipId || provisionChipId.length !== 12 || provisioning}
              className="btn-primary w-full disabled:opacity-50"
            >
              {provisioning ? 'Provisionando...' : 'Provisionar Terminal'}
            </button>
          </div>

          {/* Paso 3: Descargar config.h o compilar .bin */}
          {provisionResult && (
            <div className="card bg-green-50 border-green-200 space-y-3">
              <h3 className="font-medium text-green-800 flex items-center gap-2"><Download size={16} /> Paso 3: Obtener firmware</h3>
              <p className="text-sm text-green-700">
                Terminal <strong>{provisionResult.terminal_id}</strong> provisionado correctamente.
              </p>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Opcion A: Descargar config.h (compilar manualmente)</p>
                <p className="text-xs text-gray-500">
                  Descarga el config.h, copialo a la carpeta del terminal y compila con Arduino IDE.
                </p>
                <button
                  onClick={() => downloadConfigH(provisionResult.terminal_id)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Download size={18} /> Descargar config.h
                </button>
              </div>

              <div className="border-t border-green-200 pt-3 space-y-2">
                <p className="text-sm font-medium text-gray-700">Opcion B: Compilar .bin desde el servidor (un click)</p>
                <p className="text-xs text-gray-500">
                  El servidor compila el firmware completo con el config.h inyectado y devuelve el .bin listo para flashear.
                  Requiere que el servicio compilador este configurado.
                </p>
                <button
                  onClick={() => compileFirmware(provisionResult.terminal_id)}
                  disabled={compiling}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  <Cpu size={18} /> {compiling ? 'Compilando (puede tardar 2-3 min)...' : 'Compilar .bin'}
                </button>

                {compileResult && (
                  <div className="bg-white p-3 rounded-lg border border-green-300 space-y-2">
                    <p className="text-sm text-green-700 font-medium">Compilacion exitosa!</p>
                    <p className="text-xs text-gray-500">
                      Tamano: {fmtNumber(compileResult.size / 1024, 0)} KB · Build ID: {compileResult.build_id.substring(0, 8)}
                    </p>
                    <button
                      onClick={() => downloadFirmwareBin(provisionResult.terminal_id, compileResult.build_id)}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Download size={18} /> Descargar .bin
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Info: flujo completo */}
          <div className="card bg-blue-50 border-blue-200">
            <h3 className="font-medium text-blue-800 mb-2">Flujo completo de instalacion</h3>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Flashea <code className="bg-blue-100 px-1 rounded">chip-id-reader.ino</code> al ESP32 nuevo</li>
              <li>Escanea el ESP32 via USB o lee el chip ID del monitor serie</li>
              <li>Configura el tipo de terminal, etiqueta y ubicacion</li>
              <li>Provisiona → el servidor genera terminal_id y token</li>
              <li>Descarga el config.h generado</li>
              <li>Copia config.h a la carpeta del terminal y compila</li>
              <li>Flashea el firmware al ESP32</li>
              <li>En el sitio: configura WiFi via portal cautivo</li>
            </ol>
          </div>
        </div>
      )}

      {/* Terminals tab */}
      {tab === 'terminals' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><Cpu size={18} /> Terminales registrados</h2>
            {canRegisterTerminal && (
              <button onClick={() => setShowRegister(true)} className="btn-primary flex items-center gap-2">
                <Plus size={18} /> Registrar Terminal
              </button>
            )}
          </div>

          {/* Filtros y busqueda */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex gap-1">
              <button
                onClick={() => setTerminalFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${terminalFilter === 'all' ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                Todos ({terminals.length})
              </button>
              <button
                onClick={() => setTerminalFilter('assigned')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${terminalFilter === 'assigned' ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                Asignados ({terminals.filter(t => t.organization_name || t.merchant_user_name).length})
              </button>
              <button
                onClick={() => setTerminalFilter('unassigned')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${terminalFilter === 'unassigned' ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                No asignados ({terminals.filter(t => !t.organization_name && !t.merchant_user_name).length})
              </button>
            </div>
            <input
              type="text"
              placeholder="Buscar por etiqueta, persona u organizacion..."
              value={terminalSearch}
              onChange={(e) => setTerminalSearch(e.target.value)}
              className="input flex-1 min-w-[200px] text-sm"
            />
          </div>

          {terminals.length === 0 && (
            <div className="card text-center text-gray-500 py-8">No hay terminales registrados</div>
          )}

          {terminals
            .filter((t) => {
              // Filtro de asignacion
              const isAssigned = !!(t.organization_name || t.merchant_user_name)
              if (terminalFilter === 'assigned' && !isAssigned) return false
              if (terminalFilter === 'unassigned' && isAssigned) return false
              // Filtro de busqueda
              if (terminalSearch) {
                const s = terminalSearch.toLowerCase()
                const matches =
                  (t.label || '').toLowerCase().includes(s) ||
                  (t.terminal_id || '').toLowerCase().includes(s) ||
                  (t.organization_name || '').toLowerCase().includes(s) ||
                  (t.merchant_user_name || '').toLowerCase().includes(s) ||
                  (t.location || '').toLowerCase().includes(s)
                if (!matches) return false
              }
              return true
            })
            .map((t) => (
            <div key={t.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Cpu size={20} className={t.is_active ? 'text-green-600' : 'text-gray-400'} />
                <div>
                  <p className="font-medium">{t.label || t.terminal_id}</p>
                  <p className="text-xs text-gray-500">
                    {t.terminal_type} · {t.location || 'sin ubicacion'} · {formatTime(t.last_seen)}
                  </p>
                  {/* Asignacion visible directamente */}
                  {(t.organization_name || t.merchant_user_name) ? (
                    <p className="text-xs text-green-600 font-medium mt-1">
                      ✓ Asignado a: {t.organization_name || t.merchant_user_name}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 font-medium mt-1">
                      ✗ No asignado
                    </p>
                  )}
                  {(t.chip_id || t.device_fingerprint || t.device_model) && (
                    <p className="text-xs text-gray-400 mt-1">
                      {t.chip_id && `Chip: ${t.chip_id} · `}
                      {t.device_fingerprint && !t.chip_id && `Fingerprint: ${t.device_fingerprint.substring(0, 12)}... · `}
                      {t.device_model && `${t.device_manufacturer || ''} ${t.device_model}`}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${t.is_registered ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {t.is_registered ? 'Registrado' : 'Pendiente'}
                </span>
                {canRegisterTerminal && t.is_registered && (
                  <button
                    onClick={() => openEditModal(t)}
                    className="text-gray-500 hover:text-blue-700"
                    title="Editar etiqueta, ubicacion y tipo"
                  >
                    <Edit size={16} />
                  </button>
                )}
                {canRegisterTerminal && t.is_registered && (
                  <button
                    onClick={() => { setShowAssignModal(t.terminal_id); setAssignTarget(''); setAssignType('user') }}
                    className="text-blue-500 hover:text-blue-700"
                    title="Asignar a persona u organizacion"
                  >
                    <UserPlus size={16} />
                  </button>
                )}
                {canDeactivateTerminal && t.is_active && (
                  <button onClick={() => deactivateTerminal(t.terminal_id)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {regToken && (
            <div className="card bg-trueque-50 border-trueque-200">
              <p className="font-medium text-sm">Token de registro generado:</p>
              <code className="text-sm break-all">{regToken}</code>
              <p className="text-xs text-gray-500 mt-1">Copiar este token en config.h del terminal ESP32</p>
            </div>
          )}
        </div>
      )}

      {/* Cards tab */}
      {tab === 'cards' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><CreditCard size={18} /> Tarjetas NFC</h2>
            {canIssueCard && (
              <button onClick={() => setShowIssueCard(true)} className="btn-primary flex items-center gap-2">
                <Plus size={18} /> Emitir Tarjeta
              </button>
            )}
          </div>

          {/* Emitir tarjeta - solo admin */}
          {canIssueCard && (
            <div className="card bg-blue-50 border-blue-200 text-sm text-blue-700">
              <p>Como administrador, puedes emitir tarjetas NFC para los usuarios. La tarjeta se entrega al usuario con un PIN por defecto. El usuario debe cambiar su PIN la primera vez que la use.</p>
            </div>
          )}

          {/* Cambiar PIN - usuario normal solo su tarjeta */}
          <div className="card space-y-3">
            <h3 className="font-medium flex items-center gap-2"><KeyRound size={16} /> Cambiar PIN de mi tarjeta</h3>
            <p className="text-xs text-gray-500">Cambia el PIN de tu propia tarjeta NFC. Necesitas el PIN actual.</p>
            <div>
              <label className="label">UID de mi tarjeta</label>
              <input className="input" placeholder="Ej: 04A3B2C1" value={pinChange.card_uid} onChange={(e) => setPinChange({ ...pinChange, card_uid: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">El UID de tu tarjeta NFC. Aparece en la parte posterior de la tarjeta.</p>
            </div>
            <div>
              <label className="label">PIN actual</label>
              <input className="input" type="password" placeholder="Ej: 1234" value={pinChange.old_pin} onChange={(e) => setPinChange({ ...pinChange, old_pin: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">El PIN de 4 digitos que tienes actualmente. Ejemplo: <code>1234</code></p>
            </div>
            <div>
              <label className="label">PIN nuevo (4 digitos)</label>
              <input className="input" type="password" placeholder="Ej: 5678" maxLength={4} value={pinChange.new_pin} onChange={(e) => setPinChange({ ...pinChange, new_pin: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Elige un PIN de 4 digitos que recuerdes facil. Ejemplo: <code>5678</code></p>
            </div>
            <button onClick={changePIN} className="btn-primary">Cambiar PIN</button>
          </div>

          {/* Reset PIN - solo admin, para resetear a PIN por defecto */}
          {canResetPIN && (
            <div className="card space-y-3 border-amber-200">
              <h3 className="font-medium flex items-center gap-2"><Lock size={16} /> Resetear PIN de tarjeta (Admin)</h3>
              <p className="text-xs text-amber-600">Solo usar si un usuario olvida su PIN. Esto resetea la tarjeta a un PIN por defecto. El usuario debera cambiarlo despues.</p>
              <p className="text-xs text-gray-500">Lista de tarjetas para resetear:</p>
              {/* TODO: cargar lista de tarjetas y permitir seleccionar */}
            </div>
          )}
        </div>
      )}

      {/* Transactions tab */}
      {tab === 'transactions' && (
        <div className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Activity size={18} /> Transacciones recientes</h2>
          {transactions.length === 0 && (
            <div className="card text-center text-gray-500 py-8">No hay transacciones</div>
          )}
          {transactions.map((tx) => (
            <div key={tx.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">
                  {tx.transaction_type === 'community' ? 'Comunitaria' : 'Individual'} · {formatAmount(tx.amount)}
                </p>
                <p className="text-xs text-gray-500">
                  Tarjeta: {tx.card_uid.substring(0, 12)}... · {fmtDateTime(tx.created_at)}
                </p>
                {tx.error_message && <p className="text-xs text-red-500">{tx.error_message}</p>}
              </div>
              <div className="flex items-center gap-2">
                {tx.pin_verified && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">PIN OK</span>}
                <span className={`text-xs px-2 py-1 rounded ${tx.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {tx.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Register Terminal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRegister(false)}>
          <div className="bg-white rounded-xl p-6 w-96 space-y-3 relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowRegister(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg p-1.5 transition"
              title="Cerrar"
            >
              <X size={20} />
            </button>
            <h2 className="font-bold text-lg pr-8">Registrar Terminal</h2>
            <div>
              <label className="label">Terminal ID</label>
              <input className="input" placeholder="Ej: TERM-001" value={newTerminal.terminal_id} onChange={(e) => setNewTerminal({ ...newTerminal, terminal_id: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Identificador unico del terminal. Ejemplo: <code>TERM-001</code></p>
            </div>
            <div>
              <label className="label">Etiqueta</label>
              <input className="input" placeholder="Ej: Ferreteria Don Jose" value={newTerminal.label} onChange={(e) => setNewTerminal({ ...newTerminal, label: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Nombre descriptivo del terminal. Ejemplo: <code>Ferreteria Don Jose</code></p>
            </div>
            <div>
              <label className="label">Tipo de terminal</label>
              <select className="input" value={newTerminal.terminal_type} onChange={(e) => setNewTerminal({ ...newTerminal, terminal_type: e.target.value })}>
                {terminalTypes.filter(t => t !== 'ble-reader').map((t) => {
                  const labels: Record<string, string> = {
                    'keypad': 'Keypad (encoder rotativo)',
                    'web': 'Web (puro software, sin ESP32)',
                    'touch': 'Touch (pantalla tactil)',
                    'community': 'Community (doble tarjeta)',
                    'android_pos': 'POS Android (telefono/tablet)',
                    'ble-reader': 'BLE Reader (lector Bluetooth - accesorio)',
                  }
                  return <option key={t} value={t}>{labels[t] || t}</option>
                })}
              </select>
              <div className="text-xs text-gray-500 mt-1 p-2 bg-gray-50 rounded">
                {newTerminal.terminal_type === 'keypad' && 'Terminal ESP32 con encoder rotativo y pantalla pequena. El usuario gira el encoder para seleccionar el monto y confirma con un clic. Ideal para mercados y ferias donde se necesita un hardware dedicado y resistente.'}
                {newTerminal.terminal_type === 'web' && 'Punto de venta en el navegador. Ideal para iPhone, computadoras o cualquier dispositivo sin app Android. Puede usar lector NFC Bluetooth. El cliente paga escaneando un QR o con tarjeta NFC. NOTA: No se necesitan datos del navegador al registrar. El terminal se asigna a un usuario/organizacion, y el dueño aprueba cada sesion de navegador desde su cuenta (Mis Puntos de Venta > Sesiones POS Web).'}
                {newTerminal.terminal_type === 'touch' && 'Terminal ESP32 con pantalla tactil completa. El vendedor toca los botones en pantalla para entrar el monto. Mas intuitivo que el encoder, ideal para usuarios que no estan familiarizados con hardware dedicado.'}
                {newTerminal.terminal_type === 'community' && 'Terminal ESP32 de doble tarjeta para mercados comunitarios. Lee tanto la tarjeta del vendedor como la del comprador en una sola transaccion. Diseñado para trueque comunitario donde ambos miembros deben estar presentes.'}
                {newTerminal.terminal_type === 'android_pos' && 'Aplicacion Android (telefono o tablet) que funciona como punto de venta. Se empareja con el nodo via codigo corto de 6 digitos. No requiere hardware dedicado — usa el telefono del vendedor. Genera cobros por QR y NFC. Ideal para vendedores que ya tienen un telefono Android.'}
                {newTerminal.terminal_type === 'ble-reader' && 'Lector NFC Bluetooth (accesorio). No es un terminal — se asocia al POS web o Android desde la app del POS. No se registra aqui.'}
                {!['keypad','web','touch','community','android_pos','ble-reader'].includes(newTerminal.terminal_type) && 'Tipo de hardware del terminal.'}
              </div>
            </div>
            <div>
              <label className="label">Ubicacion</label>
              <input className="input" placeholder="Ej: Local 5, Mercado Central" value={newTerminal.location} onChange={(e) => setNewTerminal({ ...newTerminal, location: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Direccion o referencia del lugar. Ejemplo: <code>Local 5, Mercado Central</code></p>
            </div>
            <div className="flex gap-2">
              <button onClick={registerTerminal} className="btn-primary flex-1">Registrar</button>
              <button onClick={() => setShowRegister(false)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Pairing tab - Emparejamientos pendientes de POS Android */}
      {tab === 'pairing' && (
        <div className="space-y-4">
          <div className="card bg-blue-50 border-blue-200">
            <h3 className="font-bold text-blue-900">Emparejamientos Pendientes</h3>
            <p className="text-sm text-blue-700 mt-1">
              Cuando un POS Android inicia un emparejamiento, muestra un codigo de 6 digitos en pantalla.
              Aqui puedes ver los codigos pendientes y aprobarlos con un clic. Los datos del terminal se copian
              automaticamente desde el POS — solo necesitas confirmar la etiqueta y ubicacion (opcional).
            </p>
          </div>

          {pendingPairings.length === 0 ? (
            <div className="card text-center text-gray-500 py-12">
              <Nfc className="mx-auto mb-3 text-gray-300" size={48} />
              <p>No hay emparejamientos pendientes.</p>
              <p className="text-sm mt-1">Cuando un POS Android o ESP32 inicie un emparejamiento, aparecera aqui automaticamente.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingPairings.map((p) => (
                <div key={p.id} className="card border-2 border-trueque-300 bg-trueque-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-trueque-600 text-white text-lg font-bold px-6 py-3 rounded-xl">
                        Codigo oculto
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-lg">{p.terminal_label || 'POS Android'}</p>
                        <p className="text-sm text-gray-600">Tipo: {p.terminal_type}</p>
                        <p className="text-sm text-gray-600">
                          Tiempo restante: <span className={p.remaining_seconds <= 10 ? 'text-red-600 font-bold' : 'font-medium'}>
                            {Math.floor(p.remaining_seconds / 60)}:{String(p.remaining_seconds % 60).padStart(2, '0')}
                          </span>
                        </p>

                        {/* Info del dispositivo */}
                        <div className="mt-2 space-y-1 text-xs">
                          {p.chip_id && (
                            <p className="text-gray-600">
                              <span className="font-semibold">Chip ID (ESP32):</span>{' '}
                              <code className="bg-gray-100 px-1 rounded">{p.chip_id}</code>
                            </p>
                          )}
                          {p.device_fingerprint && (
                            <p className="text-gray-600">
                              <span className="font-semibold">Fingerprint:</span>{' '}
                              <code className="bg-gray-100 px-1 rounded">{p.device_fingerprint.substring(0, 16)}...</code>
                            </p>
                          )}
                          {p.device_model && (
                            <p className="text-gray-600">
                              <span className="font-semibold">Modelo:</span> {p.device_manufacturer} {p.device_model}
                              {p.android_version && ` (Android ${p.android_version})`}
                            </p>
                          )}
                          <p className="text-gray-400">
                            <span className="font-semibold">Clave publica:</span> {p.terminal_public_key?.substring(0, 16)}...
                          </p>
                        </div>

                        {/* Advertencia de re-registro */}
                        {p.existing_terminal_id && (
                          <div className="mt-2 bg-yellow-100 border border-yellow-400 rounded-lg p-3 text-sm">
                            <p className="font-bold text-yellow-800">⚠ Dispositivo ya registrado</p>
                            <p className="text-yellow-700 mt-1">
                              Este dispositivo ya esta registrado como{' '}
                              <code className="bg-yellow-200 px-1 rounded font-bold">{p.existing_terminal_id}</code>
                              {p.existing_label && ` (${p.existing_label})`}
                              {p.existing_is_active ? ' — activo' : ' — inactivo'}
                            </p>
                            <p className="text-yellow-700 mt-1">
                              Al aprobar, elige si reemplazar la clave del terminal existente o crear uno nuevo.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {approvingCode === p.id ? (
                    <div className="mt-4 space-y-3 border-t pt-4">
                      <div>
                        <label className="label">Etiqueta (opcional, pre-llenada por el POS)</label>
                        <input className="input" placeholder={p.terminal_label || 'POS Android'}
                          value={approveLabel}
                          onChange={(e) => setApproveLabel(e.target.value)} />
                      </div>
                      <div>
                        <label className="label">Ubicacion (opcional)</label>
                        <input className="input" placeholder="Ej: Local 5, Mercado Central"
                          value={approveLocation}
                          onChange={(e) => setApproveLocation(e.target.value)} />
                      </div>

                      {/* Verificacion de 4 opciones */}
                      {loadingOptions ? (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-700">
                          Cargando opciones de verificacion...
                        </div>
                      ) : optionsError ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                          <p className="font-semibold">Error al cargar opciones</p>
                          <p className="text-xs mt-1">{optionsError}</p>
                          <button onClick={() => loadPairingOptions(p.id)} className="text-xs text-red-600 underline mt-1">Reintentar</button>
                        </div>
                      ) : pairingOptions.length > 0 ? (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
                          <p className="text-sm font-semibold text-indigo-800">Verificacion: selecciona el codigo correcto</p>
                          <p className="text-xs text-indigo-600">
                            El POS muestra un codigo en su pantalla. Selecciona la opcion que coincida con el codigo mostrado.
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {pairingOptions.map((opt) => (
                              <button
                                key={opt}
                                onClick={() => setSelectedCode(opt)}
                                className={`px-4 py-3 rounded-lg text-lg font-bold font-mono transition ${
                                  selectedCode === opt
                                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                                    : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                          {!selectedCode && (
                            <p className="text-xs text-amber-600">Debes seleccionar un codigo para aprobar.</p>
                          )}
                        </div>
                      ) : null}

                      {p.existing_terminal_id ? (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-gray-700">Este dispositivo ya existe. Que deseas hacer?</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => approvePairing(p.id, 'replace')}
                              disabled={pairingAction === p.id || (pairingOptions.length > 0 && !selectedCode) || (!!optionsError && pairingOptions.length === 0)}
                              className="btn-primary flex-1 disabled:opacity-50">
                              {pairingAction === p.id ? 'Aprobando...' : 'Reemplazar clave existente'}
                            </button>
                            <button
                              onClick={() => approvePairing(p.id, 'new')}
                              disabled={pairingAction === p.id || (pairingOptions.length > 0 && !selectedCode) || (!!optionsError && pairingOptions.length === 0)}
                              className="btn-secondary flex-1 disabled:opacity-50">
                              Crear terminal nuevo
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => approvePairing(p.id, 'new')}
                            disabled={pairingAction === p.id || (pairingOptions.length > 0 && !selectedCode) || (!!optionsError && pairingOptions.length === 0)}
                            className="btn-primary flex-1 disabled:opacity-50">
                            {pairingAction === p.id ? 'Aprobando...' : 'Aprobar y Registrar'}
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => { setApprovingCode(''); setApproveLabel(''); setApproveLocation(''); setSelectedCode(''); setPairingOptions([]); setOptionsError('') }}
                        className="btn-secondary w-full">Cancelar</button>
                    </div>
                  ) : (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => { setApprovingCode(p.id); setApproveLabel(p.terminal_label || ''); setApproveLocation(''); setOptionsError(''); loadPairingOptions(p.id) }}
                        className="btn-primary flex-1">
                        Aprobar
                      </button>
                      <button
                        onClick={() => rejectPairing(p.id)}
                        disabled={pairingAction === p.id + '-reject'}
                        className="btn-secondary text-red-600">
                        {pairingAction === p.id + '-reject' ? 'Rechazando...' : 'Rechazar'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Editar terminal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEditModal(null)}>
          <div className="bg-white rounded-xl p-6 w-[500px] max-w-[90vw] space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Editar Terminal</h2>
              <button onClick={() => setShowEditModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-gray-400">Terminal ID: {showEditModal.terminal_id}</p>

            <div>
              <label className="label">Etiqueta</label>
              <input className="input" placeholder="Ej: POS Local 5"
                value={editForm.label}
                onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Nombre identificador del terminal.</p>
            </div>

            <div>
              <label className="label">Ubicacion</label>
              <input className="input" placeholder="Ej: Local 5, Mercado Central"
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Donde esta fisicamente el terminal.</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
              <p className="font-semibold mb-1">No editables (definidos por el dispositivo):</p>
              <p>Tipo de terminal, clave publica, token de registro, chip ID, fingerprint, modelo de dispositivo. El dispositivo reporta estos datos al emparejarse.</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={saveEditTerminal} className="btn-primary flex-1">Guardar cambios</button>
              <button onClick={() => setShowEditModal(null)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Asignar terminal a persona u organizacion */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAssignModal(null)}>
          <div className="bg-white rounded-xl p-6 w-[500px] max-w-[90vw] space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Asignar Terminal</h2>
              <button onClick={() => setShowAssignModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600">Busca una persona o organizacion existente para asignarle este terminal.</p>

            <div className="flex gap-2">
              <button
                onClick={() => { setAssignType('user'); setAssignTarget('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${assignType === 'user' ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                Persona
              </button>
              <button
                onClick={() => { setAssignType('org'); setAssignTarget('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${assignType === 'org' ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                Organizacion
              </button>
            </div>

            {assignType === 'user' ? (
              <EntitySelector
                label="Buscar persona"
                placeholder="Escribe el nombre para buscar..."
                value={assignTarget}
                onChange={setAssignTarget}
                endpoint="/search/users"
                valueKey="id"
                labelKey="username"
                subLabelKey="display_name"
                emptyMessage="No se encontraron personas"
              />
            ) : (
              <EntitySelector
                label="Buscar organizacion"
                placeholder="Escribe el nombre para buscar..."
                value={assignTarget}
                onChange={setAssignTarget}
                endpoint="/search/organizations"
                valueKey="id"
                labelKey="name"
                subLabelKey="display_name"
                emptyMessage="No se encontraron organizaciones"
              />
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => assignTerminal(showAssignModal)}
                disabled={!assignTarget || assigning}
                className="btn-primary flex-1 disabled:opacity-50">
                {assigning ? 'Asignando...' : 'Asignar'}
              </button>
              <button onClick={() => setShowAssignModal(null)} disabled={assigning} className="btn-secondary">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Issue Card */}
      {showIssueCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowIssueCard(false)}>
          <div className="bg-white rounded-xl p-6 w-[500px] max-w-[90vw] space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">Emitir Tarjeta NFC</h2>
            <EntitySelector
              label="Persona"
              placeholder="Escribe el nombre para buscar..."
              value={newCard.user_id}
              onChange={(v) => setNewCard({ ...newCard, user_id: v })}
              endpoint="/search/users"
              valueKey="id"
              labelKey="username"
              subLabelKey="display_name"
              emptyMessage="No se encontraron personas"
            />
            <div>
              <label className="label">Card UID (hexadecimal)</label>
              <input className="input" placeholder="Ej: 04A3B2C1D2E3F4" value={newCard.card_uid} onChange={(e) => setNewCard({ ...newCard, card_uid: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Identificador unico de la tarjeta NFC fisica, en hexadecimal. Se lee al acercar la tarjeta al lector. Ejemplo: <code>04A3B2C1D2E3F4</code></p>
            </div>
            <div>
              <label className="label">Tipo de tarjeta</label>
              <select className="input" value={newCard.card_type} onChange={(e) => setNewCard({ ...newCard, card_type: e.target.value })}>
                <option value="uid_only">UID Only</option>
                <option value="ntag424">NTAG424 DNA</option>
                <option value="desfire">MIFARE DESFire EV3</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Tipo de tarjeta NFC. <strong>UID Only</strong> = tarjeta simple con solo UID, <strong>NTAG424 DNA</strong> = tarjeta con cifrado, <strong>DESFire EV3</strong> = tarjeta de alta seguridad.</p>
            </div>
            <div>
              <label className="label">PIN inicial (4 digitos)</label>
              <input className="input" type="password" placeholder="Ej: 1234" maxLength={4} value={newCard.initial_pin} onChange={(e) => setNewCard({ ...newCard, initial_pin: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">PIN temporal de 4 digitos. El usuario debera cambiarlo la primera vez que use la tarjeta. Ejemplo: <code>1234</code></p>
            </div>
            <button onClick={issueCard} className="btn-primary w-full">Emitir</button>
          </div>
        </div>
      )}

      {/* Modal: Reset PIN */}
      {showResetPIN && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowResetPIN(null)}>
          <div className="bg-white rounded-xl p-6 w-80 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">Resetear PIN</h2>
            <p className="text-sm text-gray-500">Tarjeta: {showResetPIN}</p>
            <div>
              <label className="label">Nuevo PIN (4 digitos)</label>
              <input className="input" type="password" placeholder="Ej: 0000" maxLength={4} value={resetPINValue} onChange={(e) => setResetPINValue(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">PIN temporal de 4 digitos para resetear la tarjeta. El usuario debera cambiarlo despues. Ejemplo: <code>0000</code></p>
            </div>
            <button onClick={() => resetPIN(showResetPIN)} className="btn-primary w-full">Resetear</button>
          </div>
        </div>
      )}
    </div>
  )
}
