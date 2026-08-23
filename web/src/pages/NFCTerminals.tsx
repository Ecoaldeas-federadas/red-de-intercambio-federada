import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, apiFetch } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { useSerialChipId } from '../hooks/useSerialChipId'
import { Nfc, Plus, Trash2, CreditCard, KeyRound, Activity, Cpu, Usb, Download, Lock, HelpCircle } from 'lucide-react'

interface Terminal {
  id: string
  terminal_id: string
  label: string
  terminal_type: string
  location: string
  is_active: boolean
  is_registered: boolean
  last_seen: string | null
  firmware_version: string
  created_at: string
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
  const initialTab = (searchParams.get('tab') as 'terminals' | 'provision' | 'cards' | 'transactions') || 'terminals'
  const [tab, setTab] = useState<'terminals' | 'provision' | 'cards' | 'transactions'>(initialTab)
  const changeTab = (t: 'terminals' | 'provision' | 'cards' | 'transactions') => {
    setTab(t)
    setSearchParams({ tab: t })
  }
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [terminalTypes, setTerminalTypes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [showIssueCard, setShowIssueCard] = useState(false)
  const [showResetPIN, setShowResetPIN] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

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
      setTerminalTypes(res || [])
    } catch {
      setTerminalTypes(['keypad', 'web', 'touch', 'community'])
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
    wifi_ssid: '',
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

  const assignTerminal = async (terminalId: string) => {
    const merchantUserID = prompt('Ingresa el ID del usuario al que se le asignara este terminal:')
    if (!merchantUserID) return
    try {
      await apiFetch(`/nfc/terminal/${terminalId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ merchant_user_id: merchantUserID }),
      })
      loadTerminals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
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
    return new Date(ts).toLocaleString()
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
      const token = localStorage.getItem('fmc_token')
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
      const token = localStorage.getItem('fmc_token')
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
                  const token = localStorage.getItem('fmc_token')
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
                      Tamano: {(compileResult.size / 1024).toFixed(0)} KB · Build ID: {compileResult.build_id.substring(0, 8)}
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

          {terminals.length === 0 && (
            <div className="card text-center text-gray-500 py-8">No hay terminales registrados</div>
          )}

          {terminals.map((t) => (
            <div key={t.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Cpu size={20} className={t.is_active ? 'text-green-600' : 'text-gray-400'} />
                <div>
                  <p className="font-medium">{t.label || t.terminal_id}</p>
                  <p className="text-xs text-gray-500">
                    {t.terminal_type} · {t.location || 'sin ubicacion'} · {formatTime(t.last_seen)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${t.is_registered ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {t.is_registered ? 'Registrado' : 'Pendiente'}
                </span>
                {canRegisterTerminal && t.is_registered && (
                  <button
                    onClick={() => assignTerminal(t.terminal_id)}
                    className="text-blue-500 hover:text-blue-700"
                    title="Asignar a usuario"
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
                  Tarjeta: {tx.card_uid.substring(0, 12)}... · {new Date(tx.created_at).toLocaleString()}
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
          <div className="bg-white rounded-xl p-6 w-96 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">Registrar Terminal</h2>
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
                {terminalTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Tipo de hardware del terminal. Ejemplo: <code>keypad</code> para terminal con encoder.</p>
            </div>
            <div>
              <label className="label">Ubicacion</label>
              <input className="input" placeholder="Ej: Local 5, Mercado Central" value={newTerminal.location} onChange={(e) => setNewTerminal({ ...newTerminal, location: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Direccion o referencia del lugar. Ejemplo: <code>Local 5, Mercado Central</code></p>
            </div>
            <div>
              <label className="label">WiFi SSID</label>
              <input className="input" placeholder="Ej: RedTrueque" value={newTerminal.wifi_ssid} onChange={(e) => setNewTerminal({ ...newTerminal, wifi_ssid: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Nombre de la red WiFi donde se conectara el terminal. Ejemplo: <code>RedTrueque</code></p>
            </div>
            <button onClick={registerTerminal} className="btn-primary w-full">Registrar</button>
          </div>
        </div>
      )}

      {/* Modal: Issue Card */}
      {showIssueCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowIssueCard(false)}>
          <div className="bg-white rounded-xl p-6 w-96 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">Emitir Tarjeta NFC</h2>
            <div>
              <label className="label">User ID (UUID del usuario)</label>
              <input className="input" placeholder="Ej: 550e8400-e29b-41d4-a716-446655440000" value={newCard.user_id} onChange={(e) => setNewCard({ ...newCard, user_id: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Identificador unico del usuario al que se le asigna la tarjeta. Ejemplo: <code>550e8400-e29b-41d4-a716-446655440000</code></p>
            </div>
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
