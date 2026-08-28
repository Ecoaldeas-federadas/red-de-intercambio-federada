import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { HelpCircle, User, Key, CreditCard, History, Shield, TrendingUp, Plus, Trash2, Globe } from 'lucide-react'
import { fmtTQ } from '../lib/format'

// === Utilidades WebAuthn ===

function bufToBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let str = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i])
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBuf(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (b64.length % 4)) % 4
  const padded = b64 + '='.repeat(padLen)
  const binStr = atob(padded)
  const bytes = new Uint8Array(binStr.length)
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i)
  }
  return bytes.buffer
}

// Convierte las opciones del backend al formato que espera navigator.credentials.create
function prepareCreationOptions(opts: any): PublicKeyCredentialCreationOptions {
  return {
    challenge: base64UrlToBuf(opts.challenge),
    rp: opts.rp,
    user: {
      id: base64UrlToBuf(opts.user.id),
      name: opts.user.name,
      displayName: opts.user.displayName,
    },
    pubKeyCredParams: opts.pubKeyCredParams || [],
    timeout: opts.timeout || 60000,
    attestation: opts.attestation || 'none',
    authenticatorSelection: opts.authenticatorSelection || {
      userVerification: 'preferred',
      requireResidentKey: false,
    },
    excludeCredentials: (opts.excludeCredentials || []).map((c: any) => ({
      type: c.type,
      id: base64UrlToBuf(c.id),
    })),
  } as PublicKeyCredentialCreationOptions
}

export default function Profile() {
  const { currency } = useConfig()
  const [showHelp, setShowHelp] = useState(false)
  const [me, setMe] = useState<any>(null)
  const [myLevel, setMyLevel] = useState<any>(null)
  const [levelLoading, setLevelLoading] = useState(true)
  const [passkeys, setPasskeys] = useState<any[]>([])
  const [nfcCards, setNfcCards] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [error, setError] = useState('')
  const [upgradeMsg, setUpgradeMsg] = useState('')
  const [passkeyMsg, setPasskeyMsg] = useState('')
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [showPasskeyModal, setShowPasskeyModal] = useState(false)
  const [passkeyLabel, setPasskeyLabel] = useState('')
  const [nationalID, setNationalID] = useState('')
  const [nationalIDType, setNationalIDType] = useState('')
  const [nationalIDCountry, setNationalIDCountry] = useState('')
  const [passportNumber, setPassportNumber] = useState('')
  const [passportCountry, setPassportCountry] = useState('')
  const [savingID, setSavingID] = useState(false)
  const [idMsg, setIdMsg] = useState('')
  const [documents, setDocuments] = useState<any[]>([])
  const [countries, setCountries] = useState<any[]>([])
  const [docTypes, setDocTypes] = useState<any[]>([])
  const [newDoc, setNewDoc] = useState({ document_type: '', document_number: '', country_iso2: '' })
  const [savingDoc, setSavingDoc] = useState(false)
  const [docMsg, setDocMsg] = useState('')
  const [showDocModal, setShowDocModal] = useState(false)
  const [docPhoto, setDocPhoto] = useState<File | null>(null)

  const load = () => {
    api.get('/auth/me').then((d: any) => {
      setMe(d)
      setNationalID(d?.national_id || '')
      setNationalIDType(d?.national_id_type || '')
      setNationalIDCountry(d?.national_id_country || '')
      setPassportNumber(d?.passport_number || '')
      setPassportCountry(d?.passport_country || '')
      // Cargar nivel del usuario
      setLevelLoading(true)
      if (d?.member_level_id) {
        api.get('/member-levels').then((levels: any) => {
          const level = (Array.isArray(levels) ? levels : []).find((l: any) => l.id === d.member_level_id)
          setMyLevel(level || null)
          setLevelLoading(false)
        }).catch(() => { setLevelLoading(false) })
      } else if (d?.level_name) {
        setMyLevel({ name: d.level_name, description: d.level_description, credit_limit: d.credit_limit, debit_limit: d.debit_limit })
        setLevelLoading(false)
      } else {
        setMyLevel(null)
        setLevelLoading(false)
      }
      // Cargar historial
      if (d?.id) {
        api.get(`/accounts/${d.id}/history`).then((h: any) => setHistory(Array.isArray(h) ? h : h?.transactions ?? [])).catch(() => {})
        loadNfcCards(d.id)
      }
    }).catch(() => {})

    api.get('/auth/passkey/list').then((d: any) => setPasskeys(Array.isArray(d) ? d : d?.passkeys ?? [])).catch(() => {})
  }

  // Cargar tarjetas NFC despues de tener el user ID
  const loadNfcCards = (userId: string) => {
    api.get(`/nfc/cards?user_id=${userId}`).then((d: any) => setNfcCards(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(() => { load() }, [])

  // Cargar documentos, paises y tipos de documento
  useEffect(() => {
    api.get('/countries').then((d: any) => setCountries(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/document-types').then((d: any) => setDocTypes(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/auth/me/documents').then((d: any) => setDocuments(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const changePin = async (cardUid: string) => {
    const newPin = prompt('Nuevo PIN (4 digitos):')
    if (!newPin || newPin.length !== 4) return
    try {
      await api.put('/nfc/cards/pin', { card_uid: cardUid, new_pin: newPin })
      alert('PIN cambiado')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const saveNationalID = async () => {
    setSavingID(true)
    setIdMsg('')
    try {
      await api.put('/auth/me/contacts', {
        national_id: nationalID,
        national_id_type: nationalIDType,
        national_id_country: nationalIDCountry,
        passport_number: passportNumber,
        passport_country: passportCountry,
      })
      setIdMsg('Identificacion guardada correctamente')
    } catch (e: any) {
      setIdMsg(e?.message || 'Error al guardar')
    } finally {
      setSavingID(false)
    }
  }

  const addDocument = async () => {
    if (!newDoc.document_type || !newDoc.document_number) {
      setDocMsg('Tipo y numero de documento son obligatorios')
      return
    }
    if (!newDoc.country_iso2) {
      setDocMsg('Debes seleccionar el pais emisor del documento')
      return
    }
    setSavingDoc(true)
    setDocMsg('')
    try {
      // Si hay foto, subir con FormData; sino, JSON normal
      if (docPhoto) {
        const formData = new FormData()
        formData.append('document_type', newDoc.document_type)
        formData.append('document_number', newDoc.document_number)
        formData.append('country_iso2', newDoc.country_iso2)
        formData.append('photo', docPhoto)
        await fetch('/api/auth/me/documents', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: formData,
        })
      } else {
        await api.post('/auth/me/documents', newDoc)
      }
      setDocMsg('Documento agregado correctamente')
      setNewDoc({ document_type: '', document_number: '', country_iso2: '' })
      setDocPhoto(null)
      setShowDocModal(false)
      // Recargar documentos
      api.get('/auth/me/documents').then((d: any) => setDocuments(Array.isArray(d) ? d : []))
    } catch (e: any) {
      setDocMsg(e?.message || 'Error al agregar documento')
    } finally {
      setSavingDoc(false)
    }
  }

  const deleteDocument = async (id: string) => {
    if (!confirm('Eliminar este documento?')) return
    try {
      await api.delete(`/auth/me/documents/${id}`)
      setDocuments(documents.filter((d: any) => d.id !== id))
      setDocMsg('Documento eliminado')
    } catch (e: any) {
      setDocMsg(e?.message || 'Error al eliminar')
    }
  }

  const tryUpgrade = async () => {
    setUpgradeMsg('')
    try {
      const res: any = await api.post('/member-levels/auto-upgrade', {})
      setUpgradeMsg(res.message || 'Procesado')
      if (res.upgraded) load()
    } catch (err) {
      setUpgradeMsg(err instanceof Error ? err.message : 'Error')
    }
  }

  const registerPasskey = async () => {
    setPasskeyMsg('')
    setError('')

    // Verificar soporte WebAuthn
    if (!window.PublicKeyCredential) {
      setError('Tu navegador no soporta Passkeys/WebAuthn. Usa un navegador moderno (Chrome, Firefox, Safari, Edge).')
      return
    }

    const label = passkeyLabel.trim() || 'Mi dispositivo'
    setShowPasskeyModal(false)

    setPasskeyLoading(true)
    try {
      // 1. Pedir opciones al backend
      const beginRes: any = await api.post('/auth/passkey/add/begin', { label })
      const options = prepareCreationOptions(beginRes.options)

      // 2. Invocar WebAuthn del navegador
      const credential = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential
      if (!credential) {
        throw new Error('No se pudo crear el passkey')
      }

      const response = credential.response as AuthenticatorAttestationResponse

      // 3. Enviar respuesta al backend para verificar y guardar
      const finishRes: any = await api.post('/auth/passkey/add/finish', {
        label,
        response: {
          id: credential.id,
          rawId: bufToBase64Url(credential.rawId),
          type: credential.type,
          response: {
            attestationObject: bufToBase64Url(response.attestationObject),
            clientDataJSON: bufToBase64Url(response.clientDataJSON),
          },
        },
      })

      setPasskeyMsg(finishRes.message || 'Dispositivo registrado correctamente.')
      setPasskeyLabel('')
      load()
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Registro cancelado o no autorizado. Intenta de nuevo.')
      } else {
        setError(err instanceof Error ? err.message : 'Error al registrar passkey')
      }
    } finally {
      setPasskeyLoading(false)
    }
  }

  const openPasskeyModal = () => {
    setPasskeyLabel('')
    setShowPasskeyModal(true)
  }

  const deletePasskey = async (passkeyId: string) => {
    if (!confirm('Seguro que quieres eliminar este dispositivo? No podras iniciar sesion con el.')) return
    try {
      await api.delete(`/auth/passkey/${passkeyId}`)
      setPasskeyMsg('Dispositivo eliminado.')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar passkey')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><User size={24} />Mi Perfil</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>Mi Perfil - Ayuda</strong></p>
          <p><strong>Que es esta pagina:</strong> Es tu panel personal dentro de la red de intercambio. Aqui ves quien eres dentro del sistema, que puedes hacer y que dispositivos de seguridad tienes asociados.</p>
          <p><strong>Para que sirve:</strong> Muestra tu informacion personal, tu nivel de miembro, tus dispositivos de seguridad (Passkeys), tus tarjetas NFC y tu historial de transacciones recientes. Tambien te permite verificar si puedes ascender de nivel automaticamente.</p>
          <p><strong>Como se usa:</strong> Solo lectura. No hay formularios aqui. Para cambiar el PIN de una tarjeta NFC usa el boton "Cambiar PIN" junto a cada tarjeta. Para pedir que la asamblea revise tu ascenso de nivel, pulsa "Pedir ascenso".</p>
          <p><strong>Informacion que se muestra:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Usuario:</strong> tu nombre de inicio de sesion.</li>
            <li><strong>Nombre:</strong> nombre para mostrar (puede estar vacio).</li>
            <li><strong>Tipo:</strong> tipo de cuenta (persona u organizacion).</li>
            <li><strong>Balance:</strong> cuanto tienes disponible en tu moneda local.</li>
            <li><strong>Estado:</strong> estado de tu membresia (activa, suspendida, etc.).</li>
          </ul>
          <p><strong>Nivel de miembro:</strong> Es la categoria que define tus limites de credito/debito, tus derechos (voz, voto, quorum) y tus permisos (crear organizaciones, comerciar entre nodos, recibir tarjeta NFC, ver auditoria, usar puente externo). Cuanto mas participes, mas subiras de nivel.</p>
          <p><strong>Limites de credito y debito:</strong> El limite de credito es el maximo que puedes deber (saldo negativo). El limite de debito es el maximo que puedes tener a favor (saldo positivo). Los define tu nivel de miembro.</p>
          <p><strong>Passkeys:</strong> Son dispositivos con los que puedes iniciar sesion sin contrasena: huella, FaceID, PIN del movil, llaves de seguridad USB. Usa el boton "Registrar dispositivo" para anadir uno nuevo. Si pierdes uno, puedes eliminarlo aqui o pedir al admin que lo elimine.</p>
          <p><strong>Tarjetas NFC:</strong> Tarjetas fisicas asociadas a tu cuenta para pagar en terminales NFC de los comercios. Cada tarjeta tiene un UID unico. Si la pierdes, avisa al admin para desactivarla.</p>
          <p><strong>PIN de NFC:</strong> Es un codigo de 4 digitos que protege tu tarjeta NFC. Se pide al hacer pagos en terminales con teclado. Cambialo con el boton "Cambiar PIN" si crees que alguien lo sabe.</p>
          <p><strong>Actividad reciente:</strong> Tus ultimas 10 transacciones (ingresos en verde, egresos en rojo).</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">Cerrar</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {/* Informacion personal */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><User size={18} />Informacion</h2>
        {me ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Usuario:</span> <b>{me.username}</b></div>
            <div className="flex justify-between"><span className="text-gray-500">Nombre:</span> <b>{me.display_name || '-'}</b></div>
            <div className="flex justify-between"><span className="text-gray-500">Tipo:</span> <b>{me.account_type}</b></div>
            <div className="flex justify-between"><span className="text-gray-500">Balance:</span> <b>{fmtTQ(me.balance)} {currency}</b></div>
            <div className="flex justify-between"><span className="text-gray-500">Estado:</span> <b>{me.membership_status}</b></div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Cargando...</p>
        )}
      </div>

      {/* Documentos de identidad (multiples, con modal) */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><Shield size={18} />Documentos de Identidad</h2>
        <p className="text-xs text-gray-500 mb-3">Agrega todos tus documentos: cedula, pasaporte, carnet de conducir, etc. La comparacion entre nodos federados se hace por tipo + numero + pais. No puede haber dos documentos iguales del mismo pais.</p>

        {/* Lista de documentos existentes */}
        {documents.length > 0 ? (
          <div className="space-y-2 mb-4">
            {documents.map((doc: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <div className="text-sm">
                  <span className="font-medium">{doc.document_type_name || doc.document_type}</span>
                  <span className="text-gray-700 ml-2">{doc.document_number}</span>
                  {doc.country_name && <span className="text-gray-400 ml-2">- {doc.country_name}</span>}
                  {doc.is_verified && <span className="text-xs text-green-600 ml-2">✓ Verificado</span>}
                  {doc.photo_url && <span className="text-xs text-blue-600 ml-2">📷</span>}
                </div>
                <button onClick={() => deleteDocument(doc.id)} className="text-red-500 hover:text-red-700">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 mb-4">No has agregado documentos todavia.</p>
        )}

        {docMsg && <div className="text-sm bg-blue-50 text-blue-700 p-2 rounded-lg mb-3">{docMsg}</div>}

        <button
          onClick={() => setShowDocModal(true)}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Plus size={16} /> Agregar documento de identidad
        </button>
      </div>

      {/* Modal: Agregar documento de identidad */}
      {showDocModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Agregar Documento de Identidad</h2>
              <button onClick={() => { setShowDocModal(false); setNewDoc({ document_type: '', document_number: '', country_iso2: '' }); setDocPhoto(null); setDocMsg('') }} className="text-gray-400 hover:text-gray-600">
                <Trash2 size={20} />
              </button>
            </div>

            <div>
              <label className="label">Tipo de documento</label>
              <select
                value={newDoc.document_type}
                onChange={(e) => setNewDoc({ ...newDoc, document_type: e.target.value })}
                className="input"
              >
                <option value="">Seleccionar tipo...</option>
                {docTypes.map((t: any) => (
                  <option key={t.code} value={t.code}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Numero de documento</label>
              <input
                type="text"
                value={newDoc.document_number}
                onChange={(e) => setNewDoc({ ...newDoc, document_number: e.target.value })}
                placeholder="Ej: V-12345678"
                className="input"
              />
            </div>

            <div>
              <label className="label">Pais emisor</label>
              <select
                value={newDoc.country_iso2}
                onChange={(e) => setNewDoc({ ...newDoc, country_iso2: e.target.value })}
                className="input"
              >
                <option value="">Seleccionar pais...</option>
                {countries.map((c: any) => (
                  <option key={c.iso2} value={c.iso2}>{c.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">El pais es obligatorio para evitar duplicados: dos cedulas del mismo pais no pueden tener el mismo numero, pero una cedula de Venezuela y una de Colombia pueden tener el mismo numero sin problema.</p>
            </div>

            <div>
              <label className="label">Foto del documento (opcional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setDocPhoto(e.target.files?.[0] || null)}
                className="input text-sm"
              />
              {docPhoto && <p className="text-xs text-gray-500 mt-1">Archivo seleccionado: {docPhoto.name}</p>}
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowDocModal(false); setNewDoc({ document_type: '', document_number: '', country_iso2: '' }); setDocPhoto(null); setDocMsg('') }} className="btn-secondary">Cancelar</button>
              <button onClick={addDocument} disabled={savingDoc} className="btn-primary">
                {savingDoc ? 'Guardando...' : 'Guardar documento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nivel de miembro */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><Shield size={18} />Nivel de Miembro</h2>
        {upgradeMsg && <div className="text-sm bg-blue-50 text-blue-700 p-3 rounded-lg mb-3">{upgradeMsg}</div>}
        <button onClick={tryUpgrade} className="btn-secondary flex items-center gap-2 mb-3 text-sm"><TrendingUp size={16} />Pedir ascenso</button>
        {levelLoading ? (
          <p className="text-gray-500 text-sm">Cargando nivel...</p>
        ) : myLevel ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Nivel:</span> <b>{myLevel.name}</b></div>
            {myLevel.description && <p className="text-gray-600">{myLevel.description}</p>}
            <div className="flex gap-2 mt-2 flex-wrap">
              {myLevel.has_voice && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Voz</span>}
              {myLevel.has_vote && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Voto</span>}
              {myLevel.counts_in_quorum && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Quorum</span>}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div><span className="text-gray-500">Limite credito:</span> <b>{fmtTQ(myLevel.credit_limit)} {currency}</b></div>
              <div><span className="text-gray-500">Limite debito:</span> <b>{fmtTQ(myLevel.debit_limit)} {currency}</b></div>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {myLevel.can_create_organization && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Crea org</span>}
              {myLevel.can_cross_node_trade && <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded">Comercio nodos</span>}
              {myLevel.can_receive_nfc_card && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Tarjeta NFC</span>}
              {myLevel.can_view_audit && <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">Ver auditoria</span>}
              {myLevel.can_use_external_bridge && <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded">Puente externo</span>}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Sin nivel asignado. Pide un ascenso para que la asamblea te asigne un nivel.</p>
        )}
      </div>

      {/* Passkeys */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><Key size={18} />Dispositivos (Passkeys)</h2>
        {passkeyMsg && <div className="text-sm bg-green-50 text-green-700 p-3 rounded-lg mb-3">{passkeyMsg}</div>}
        <button
          onClick={openPasskeyModal}
          disabled={passkeyLoading}
          className="btn-secondary flex items-center gap-2 mb-3 text-sm"
        >
          <Plus size={16} />
          {passkeyLoading ? 'Registrando...' : 'Registrar dispositivo'}
        </button>
        <p className="text-xs text-gray-500 mb-3">
          Puedes registrar multiples dispositivos: huella, FaceID, PIN del movil, llave de seguridad USB, etc.
          Cada uno te permitira iniciar sesion sin contrasena.
        </p>
        {passkeys.length === 0 ? (
          <p className="text-gray-500 text-sm">No tienes passkeys registrados.</p>
        ) : (
          <div className="space-y-2">
            {passkeys.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-gray-100 py-2 last:border-0">
                <div>
                  <b>{p.name || `Dispositivo ${i + 1}`}</b>
                  <p className="text-xs text-gray-400">
                    {p.created_at && `Registrado: ${p.created_at?.slice(0, 10)}`}
                    {p.last_used_at && ` | Ultimo uso: ${p.last_used_at?.slice(0, 10)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Activo</span>
                  <button
                    onClick={() => deletePasskey(p.id)}
                    className="text-red-500 hover:text-red-700"
                    title="Eliminar dispositivo"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Registrar nuevo passkey */}
      {showPasskeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowPasskeyModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Key size={20} />Registrar nuevo dispositivo</h3>
            <p className="text-sm text-gray-600 mb-4">
              Dale un nombre a este dispositivo para identificarlo (ej: "Mi celular", "Huella laptop", "Llave USB").
              Luego tu navegador te pedira confirmar con huella, PIN, FaceID o la llave de seguridad.
            </p>
            <input
              type="text"
              className="input w-full mb-4"
              value={passkeyLabel}
              onChange={(e) => setPasskeyLabel(e.target.value)}
              placeholder="Nombre del dispositivo"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && registerPasskey()}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowPasskeyModal(false)} className="btn-secondary text-sm">Cancelar</button>
              <button
                onClick={registerPasskey}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Plus size={16} />
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tarjetas NFC */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><CreditCard size={18} />Mis Tarjetas NFC</h2>
        {nfcCards.length === 0 ? (
          <p className="text-gray-500 text-sm">No tienes tarjetas NFC asociadas.</p>
        ) : (
          <div className="space-y-2">
            {nfcCards.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-gray-100 py-2 last:border-0">
                <div>
                  <b>UID: {c.card_uid?.slice(0, 16)}...</b>
                  {c.card_type && <p className="text-xs text-gray-400">Tipo: {c.card_type}</p>}
                </div>
                <button onClick={() => changePin(c.card_uid)} className="btn-secondary text-xs">Cambiar PIN</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial reciente */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><History size={18} />Actividad Reciente</h2>
        {history.length === 0 ? (
          <p className="text-gray-500 text-sm">Sin transacciones.</p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 10).map((t, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-gray-100 py-2 last:border-0">
                <div>
                  <span className="text-gray-600">{t.tx_type || 'transfer'}</span>
                  <p className="text-xs text-gray-400">{t.created_at?.slice(0, 10)}</p>
                </div>
                <b className={t.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {t.amount >= 0 ? '+' : ''}{fmtTQ(t.amount)} {currency}
                </b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
