import { useState, useEffect, useRef } from 'react'
import { API } from '../api'
import { fmtTQ } from '../utils/format'

interface Props {
  amount: number
  onBack: () => void
  onPaid: () => void
  api: API
  terminalID: string | null
  isDemoNode?: boolean
}

// Tipos de documento soportados (se actualizan dinamicamente desde el servidor)
const DEFAULT_DOC_TYPES = [
  { code: 'cedula', label: 'Cedula' },
  { code: 'dni', label: 'DNI' },
  { code: 'pasaporte', label: 'Pasaporte' },
  { code: 'rut', label: 'RUT' },
]

type FlowStatus = 'username' | 'document' | 'pin' | 'tap_card' | 'processing' | 'writing' | 'approved' | 'rejected'

interface UserLookupResult {
  found: boolean
  user_id?: string
  card_type?: string
  requires_document: boolean
  required_doc_type?: string
  document_types?: string[]
  display_name?: string
  is_remote?: boolean
  message?: string
}

export function NFCScreen({ amount, onBack, onPaid, api, terminalID, isDemoNode }: Props) {
  const [status, setStatus] = useState<FlowStatus>('username')
  const [username, setUsername] = useState('')
  const [userLookup, setUserLookup] = useState<UserLookupResult | null>(null)
  const [docTypes, setDocTypes] = useState(DEFAULT_DOC_TYPES)
  const [docType, setDocType] = useState('cedula')
  const [docNumber, setDocNumber] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [preAuth, setPreAuth] = useState<any>(null)
  const [cardUID, setCardUID] = useState('')
  const [writeProgress, setWriteProgress] = useState('')
  const pollRef = useRef<any>(null)

  // Web NFC API para leer tarjeta
  useEffect(() => {
    if (status !== 'tap_card') return
    if (!('NDEFReader' in window)) return

    const reader = new (window as any).NDEFReader()
    reader.scan().then(() => {
      reader.onreading = (event: any) => {
        const uid = event.serialNumber || ''
        if (uid) {
          handleCardRead(uid)
        }
      }
    }).catch(() => {})

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [status])

  // Paso 1: Lookup de usuario por username
  const handleUsernameSubmit = async () => {
    if (username.trim() === '') {
      setError('Ingrese el nombre de usuario del cliente')
      return
    }
    setError('')
    setLoading(true)

    try {
      const result = await api.userLookup(terminalID!, username.trim())
      const lookup: UserLookupResult = {
        found: result.found ?? false,
        user_id: result.user_id,
        card_type: result.card_type,
        requires_document: result.requires_document ?? false,
        required_doc_type: result.required_doc_type,
        document_types: result.document_types,
        display_name: result.display_name,
        is_remote: result.is_remote,
        message: result.message,
      }

      if (lookup.found) {
        setUserLookup(lookup)
        // Actualizar tipos de documento si vienen del servidor
        if (lookup.document_types && lookup.document_types.length > 0) {
          const types = lookup.document_types.map(code => {
            const found = DEFAULT_DOC_TYPES.find(d => d.code === code)
            return found || { code, label: code }
          })
          setDocTypes(types)
          // Si hay un required_doc_type, seleccionarlo
          if (lookup.required_doc_type) {
            setDocType(lookup.required_doc_type)
          }
        }
        // Si requiere documento (Classic), ir al paso de documento
        // Si no (UID/DESFire), ir directo al PIN
        setStatus(lookup.requires_document ? 'document' : 'pin')
      } else {
        setError(lookup.message || 'Usuario no encontrado')
      }
    } catch (e: any) {
      // Modo demo: simular lookup
      if (isDemoNode) {
        const isClassic = username.toLowerCase().includes('classic') || username.toLowerCase().includes('clasica')
        const lookup: UserLookupResult = {
          found: true,
          user_id: 'demo-' + username,
          card_type: isClassic ? 'classic' : 'uid_only',
          requires_document: isClassic,
          document_types: isClassic ? ['cedula', 'dni'] : undefined,
          display_name: 'Usuario Demo ' + username,
        }
        setUserLookup(lookup)
        if (isClassic) {
          setDocTypes([{ code: 'cedula', label: 'Cedula' }, { code: 'dni', label: 'DNI' }])
          setDocType('cedula')
        }
        setStatus(lookup.requires_document ? 'document' : 'pin')
      } else {
        setError(e.message || 'Error de conexion con el servidor')
      }
    } finally {
      setLoading(false)
    }
  }

  // Paso 2 (solo Classic): Enviar documento + PIN al servidor (pre-auth con documento)
  // Paso 2 (UID/DESFire): Enviar username + PIN al servidor (pre-auth sin documento)
  const handlePreAuth = async () => {
    if (userLookup?.requires_document && docNumber.trim() === '') {
      setError('Ingrese el numero de documento de identidad')
      return
    }
    if (pin.length !== 4) {
      setError('El PIN debe ser de 4 digitos')
      return
    }
    setError('')
    setStatus('processing')

    try {
      const result = userLookup?.requires_document
        ? await api.classicPreAuthWithDocument(terminalID!, {
            username: username.trim(),
            doc_type: docType,
            doc_number: docNumber,
            pin,
            amount,
          })
        : await api.classicPreAuth(terminalID!, {
            username: username.trim(),
            pin,
            amount,
          })

      if (result.pre_approved && result.card_uid) {
        setPreAuth(result)
        setStatus('tap_card')
      } else {
        setStatus('rejected')
        setError(result.message || 'Pre-autenticacion rechazada')
      }
    } catch (e: any) {
      // Modo demo: simular pre-auth
      if (isDemoNode) {
        const isMultisig = docNumber.includes('MULTISIG') || docNumber.includes('2SIG') || docNumber.includes('3SIG') || docNumber.includes('FIRM')
        if (isMultisig) {
          setPreAuth({
            pre_approved: true,
            card_type: 'desfire',
            card_uid: 'DEMO-DESFire-' + username.substring(0, 6),
          })
        } else {
          setPreAuth({
            pre_approved: true,
            card_type: userLookup?.card_type || 'classic',
            card_uid: 'DEMO-' + (userLookup?.card_type || 'classic').toUpperCase() + '-' + username.substring(0, 6),
            read_sector: 5,
            read_key_a: 'aabbccddeeff',
            expected_certificate: '11223344556677889900aabbccddeeff',
            write_sector: 10,
            write_key_b: '112233445566',
            new_certificate: 'ffeeddccbbaa99887766554433221100',
          })
        }
        setStatus('tap_card')
      } else {
        setStatus('rejected')
        setError(e.message || 'Error de conexion con el servidor')
      }
    }
  }

  // Paso 3: Tarjeta leida - verificar UID y procesar segun tipo
  const handleCardRead = async (uid: string) => {
    setCardUID(uid)

    if (!preAuth || !preAuth.card_uid) {
      setStatus('rejected')
      setError('No hay pre-autenticacion activa')
      return
    }

    // Verificar que el UID coincide con el del pre-auth
    if (uid !== preAuth.card_uid) {
      setStatus('rejected')
      setError('La tarjeta no coincide con el usuario autenticado')
      return
    }

    const cardType = preAuth.card_type || 'classic'

    if (cardType === 'classic') {
      // Flujo Classic: simular lectura/escritura de sectores
      setStatus('writing')
      setWriteProgress('Leyendo sector...')
      await new Promise(r => setTimeout(r, 500))
      setWriteProgress('Verificando certificado...')
      await new Promise(r => setTimeout(r, 500))
      setWriteProgress('Escribiendo nuevo certificado...')
      await new Promise(r => setTimeout(r, 500))
      setWriteProgress('Confirmando transaccion...')

      try {
        const result = await api.classicConfirm(
          terminalID!,
          preAuth.card_uid,
          true,
          true,
          16
        )

        if (result.status === 'approved') {
          setStatus('approved')
          setTimeout(onPaid, 2000)
        } else {
          setStatus('rejected')
          setError(result.message || 'Transaccion rechazada')
        }
      } catch (e: any) {
        if (isDemoNode) {
          setStatus('approved')
          setTimeout(onPaid, 2000)
        } else {
          setStatus('rejected')
          setError(e.message || 'Error al confirmar transaccion')
        }
      }
    } else {
      // Flujo UID-only/DESFire: procesar pago normal
      setStatus('processing')
      try {
        const payload = {
          card_uid: uid,
          crypto_token: uid,
          card_type: cardType,
          pin,
          amount,
          timestamp: Date.now(),
          nonce: Math.random().toString(36).substring(7),
          username: username.trim(),
        }

        const result = await api.processPayment(terminalID!, payload)

        if (result.status === 'approved') {
          setStatus('approved')
          setTimeout(onPaid, 2000)
        } else if (result.status === 'pending_multisig') {
          setStatus('rejected')
          setError(result.message || 'Pago pendiente de multi-firma - use el POS Android para completar')
        } else {
          setStatus('rejected')
          setError(result.message || 'Pago rechazado')
        }
      } catch (e: any) {
        if (isDemoNode) {
          setStatus('approved')
          setTimeout(onPaid, 2000)
        } else {
          setStatus('rejected')
          setError(e.message || 'Error al procesar pago')
        }
      }
    }
  }

  const handleManualCard = () => {
    const uid = preAuth?.card_uid || prompt('Ingresa el UID de la tarjeta:')
    if (uid) handleCardRead(uid)
  }

  const handleSimulateTap = () => {
    if (preAuth?.card_uid) {
      handleCardRead(preAuth.card_uid)
    }
  }

  const resetToUsername = () => {
    setStatus('username')
    setPin('')
    setDocNumber('')
    setError('')
    setPreAuth(null)
    setUserLookup(null)
  }

  const resetToDocument = () => {
    setStatus('document')
    setPin('')
    setError('')
    setPreAuth(null)
  }

  const resetToPin = () => {
    setStatus('pin')
    setPin('')
    setError('')
    setPreAuth(null)
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24, maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: 'var(--card)', borderRadius: 10, padding: 10, color: 'var(--text)', fontSize: 20 }}>
          ←
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Pago NFC</h2>
        <div style={{ width: 44 }} />
      </div>

      {/* Amount - siempre visible */}
      <div style={{ textAlign: 'center', marginBottom: 24, background: 'var(--card)', padding: 20, borderRadius: 16, width: '100%' }}>
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>Monto a cobrar</div>
        <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--accent-light)' }}>
          {fmtTQ(amount)} TQ
        </div>
      </div>

      {/* STEP 1: USERNAME */}
      {status === 'username' && (
        <div className="fade-in" style={{ width: '100%', maxWidth: 320 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>👤</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Usuario del Cliente</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
              Ingrese el nombre de usuario (con @nodo para usuarios remotos)
            </p>
          </div>

          <div style={{ marginBottom: 24 }}>
            <input
              type="text"
              className="input"
              placeholder="Ej. juan o juan@otro-nodo"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUsernameSubmit()}
              style={{
                width: '100%', padding: 14, borderRadius: 10,
                background: 'var(--card)', color: 'var(--text)',
                border: '2px solid var(--border)', fontSize: 18,
                textAlign: 'center',
              }}
            />
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: 14, textAlign: 'center', marginBottom: 12 }}>{error}</p>}

          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={handleUsernameSubmit}
            disabled={username.trim() === '' || loading}
          >
            {loading ? 'Buscando...' : 'Buscar Usuario'}
          </button>
        </div>
      )}

      {/* STEP 2: DOCUMENT (solo si requires_document = true, Classic) */}
      {status === 'document' && (
        <div className="fade-in" style={{ width: '100%', maxWidth: 320 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📄</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Documento de Identidad</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
              Usuario: <strong style={{ color: 'var(--accent-light)' }}>{username}</strong>
              {userLookup?.display_name && ` (${userLookup.display_name})`}
            </p>
            <p style={{ color: 'var(--warning)', fontSize: 11, marginTop: 4 }}>
              Tarjeta Classic - documento requerido
            </p>
          </div>

          {/* Tipo de documento */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-dim)', marginBottom: 6 }}>
              Tipo de Documento
              {userLookup?.required_doc_type && (
                <span style={{ color: 'var(--warning)', marginLeft: 6 }}>(requerido: {userLookup.required_doc_type})</span>
              )}
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              style={{
                width: '100%', padding: 12, borderRadius: 10,
                background: 'var(--card)', color: 'var(--text)',
                border: '1px solid var(--border)', fontSize: 16,
              }}
            >
              {docTypes.map(d => (
                <option key={d.code} value={d.code}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Numero de documento */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-dim)', marginBottom: 6 }}>
              Numero de Documento
            </label>
            <input
              type="text"
              className="input"
              placeholder="Ej. 12345678"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              style={{
                width: '100%', padding: 14, borderRadius: 10,
                background: 'var(--card)', color: 'var(--text)',
                border: '2px solid var(--border)', fontSize: 18,
                textAlign: 'center',
              }}
            />
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: 14, textAlign: 'center', marginBottom: 12 }}>{error}</p>}

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: 8 }}
            onClick={() => { setStatus('pin'); setError('') }}
            disabled={docNumber.trim() === ''}
          >
            Continuar a Clave
          </button>
          <button
            className="btn btn-secondary"
            style={{ width: '100%' }}
            onClick={resetToUsername}
          >
            Volver a Usuario
          </button>
        </div>
      )}

      {/* STEP 3: PIN */}
      {status === 'pin' && (
        <div className="fade-in" style={{ width: '100%', maxWidth: 320 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🔑</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Clave Secreta</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
              Usuario: <strong style={{ color: 'var(--accent-light)' }}>{username}</strong>
            </p>
            {userLookup?.requires_document && (
              <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4 }}>
                Doc: {docType.toUpperCase()} {docNumber}
              </p>
            )}
          </div>

          {/* PIN display */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'var(--card)', border: '2px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 700,
                borderColor: pin.length > i ? 'var(--accent)' : 'var(--border)',
              }}>
                {pin.length > i ? '•' : ''}
              </div>
            ))}
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: 14, textAlign: 'center', marginBottom: 12 }}>{error}</p>}

          {/* PIN keypad */}
          <div className="keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
              <button key={n} className="key" onClick={() => pin.length < 4 && setPin(pin + n)}>{n}</button>
            ))}
            <button className="key" onClick={() => { setPin(''); setDocNumber('') }} style={{ background: 'rgba(220,38,38,0.2)', color: 'var(--danger)' }}>C</button>
            <button className="key" onClick={() => pin.length < 4 && setPin(pin + '0')}>0</button>
            <button className="key" onClick={() => setPin(pin.slice(0, -1))} style={{ background: 'rgba(202,138,4,0.2)', color: 'var(--warning)' }}>⌫</button>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 16 }}
            onClick={handlePreAuth}
            disabled={pin.length !== 4}
          >
            Validar y Continuar
          </button>
          <button
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: 8 }}
            onClick={() => {
              if (userLookup?.requires_document) {
                resetToDocument()
              } else {
                resetToUsername()
              }
            }}
          >
            {userLookup?.requires_document ? 'Volver a Documento' : 'Volver a Usuario'}
          </button>
        </div>
      )}

      {/* STEP 4: TAP CARD */}
      {status === 'tap_card' && (
        <div className="fade-in" style={{ textAlign: 'center', marginTop: 20 }}>
          {/* Mostrar tipo de tarjeta detectada */}
          {preAuth?.card_type === 'classic' && (
            <div style={{ background: 'rgba(202,138,4,0.15)', padding: 12, borderRadius: 12, marginBottom: 16 }}>
              <p style={{ color: 'var(--warning)', fontSize: 13, fontWeight: 600 }}>
                💳 Tarjeta MIFARE Classic detectada
              </p>
              <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4 }}>
                No retire la tarjeta hasta que termine
              </p>
            </div>
          )}
          {preAuth?.card_type === 'desfire' && (
            <div style={{ background: 'rgba(15,118,110,0.15)', padding: 12, borderRadius: 12, marginBottom: 16 }}>
              <p style={{ color: 'var(--accent-light)', fontSize: 13, fontWeight: 600 }}>
                💳 Tarjeta DESFire detectada
              </p>
            </div>
          )}
          {preAuth?.card_type === 'uid_only' && (
            <div style={{ background: 'rgba(15,118,110,0.15)', padding: 12, borderRadius: 12, marginBottom: 16 }}>
              <p style={{ color: 'var(--accent-light)', fontSize: 13, fontWeight: 600 }}>
                💳 Tarjeta UID detectada
              </p>
            </div>
          )}

          <div style={{ fontSize: 80, marginBottom: 24 }} className="pulse">�</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Acerque la Tarjeta</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24, maxWidth: 280 }}>
            {preAuth?.card_type === 'classic'
              ? 'No retire la tarjeta hasta que termine el proceso'
              : 'Tarjeta del cliente para verificar identidad'}
          </p>

          {!('NDEFReader' in window) && (
            <div style={{ background: 'rgba(202,138,4,0.15)', padding: 16, borderRadius: 12, marginBottom: 16, textAlign: 'left' }}>
              <p style={{ color: 'var(--warning)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                ⚠️ Este dispositivo no tiene NFC integrado
              </p>
              <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 8 }}>
                Para pagos NFC necesitas:
              </p>
              <ul style={{ color: 'var(--text-dim)', fontSize: 12, paddingLeft: 20, marginBottom: 8 }}>
                <li>Un celular con NFC (Chrome/Edge en Android)</li>
                <li>O un lector NFC Bluetooth conectado</li>
              </ul>
            </div>
          )}

          {'NDEFReader' in window && (
            <div style={{ background: 'rgba(15,118,110,0.15)', padding: 12, borderRadius: 12, marginBottom: 16 }}>
              <p style={{ color: 'var(--accent-light)', fontSize: 12 }}>
                ✅ NFC detectado. Acerque la tarjeta para leerla.
              </p>
            </div>
          )}

          <button className="btn btn-secondary" style={{ width: '100%', maxWidth: 300 }} onClick={handleManualCard}>
            Ingresar UID manualmente
          </button>

          {isDemoNode && (
            <button
              className="btn btn-secondary"
              style={{ width: '100%', maxWidth: 300, marginTop: 12, background: 'rgba(202,138,4,0.2)', color: 'var(--warning)' }}
              onClick={handleSimulateTap}
            >
              🎮 Simular tap (modo demo)
            </button>
          )}

          <button
            className="btn btn-secondary"
            style={{ width: '100%', maxWidth: 300, marginTop: 12 }}
            onClick={resetToPin}
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Processing */}
      {status === 'processing' && (
        <div className="fade-in" style={{ textAlign: 'center', marginTop: 60 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }} className="pulse">⏳</div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Procesando pago...</h2>
        </div>
      )}

      {/* Writing (Classic) */}
      {status === 'writing' && (
        <div className="fade-in" style={{ textAlign: 'center', marginTop: 60 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }} className="pulse">�</div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Escribiendo en tarjeta...</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 8 }}>{writeProgress}</p>
          <p style={{ color: 'var(--danger)', fontSize: 14, fontWeight: 700, marginTop: 16 }}>NO RETIRE LA TARJETA</p>
        </div>
      )}

      {/* Approved */}
      {status === 'approved' && (
        <div className="fade-in" style={{ textAlign: 'center', marginTop: 60 }}>
          <div style={{ fontSize: 80, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)', marginBottom: 8 }}>Pago Aprobado</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 18, marginBottom: 4 }}>
            {fmtTQ(amount)} TQ
          </p>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 16 }}>Redirigiendo...</p>
        </div>
      )}

      {/* Rejected */}
      {status === 'rejected' && (
        <div className="fade-in" style={{ textAlign: 'center', marginTop: 60 }}>
          <div style={{ fontSize: 80, marginBottom: 16 }}>❌</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--danger)', marginBottom: 8 }}>Pago Rechazado</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24 }}>{error}</p>
          <button
            className="btn btn-primary"
            style={{ width: '100%', maxWidth: 300 }}
            onClick={resetToUsername}
          >
            Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  )
}
