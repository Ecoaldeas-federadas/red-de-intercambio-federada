import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { useTranslation } from 'react-i18next'
import { getCurrentLanguage, changeLanguage } from '../i18n/TranslationProvider'
import { HelpCircle, User, Key, CreditCard, History, Shield, TrendingUp, Plus, Trash2, Globe, Copy, Check, Heart } from 'lucide-react'
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
  const { t } = useTranslation(['profile', 'common'])
  const [showHelp, setShowHelp] = useState(false)
  const [me, setMe] = useState<any>(null)
  const [copiedUuid, setCopiedUuid] = useState(false)
  const [myLevel, setMyLevel] = useState<any>(null)
  const [levelLoading, setLevelLoading] = useState(true)
  const [passkeys, setPasskeys] = useState<any[]>([])
  const [nfcCards, setNfcCards] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [sponsorships, setSponsorships] = useState<{ asSponsor: any[], asSponsored: any }>({ asSponsor: [], asSponsored: null })
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

  // === Modales de tarjetas NFC (sin prompt/alert nativos) ===
  const [cardModal, setCardModal] = useState<{
    type: 'changePin' | 'toggle' | 'changeDoc'
    cardUid: string
    cardType?: string
    isActive?: boolean
    currentDoc?: string
  } | null>(null)
  const [authPassword, setAuthPassword] = useState('')
  const [newPin1, setNewPin1] = useState('')
  const [newPin2, setNewPin2] = useState('')
  const [selectedDocType, setSelectedDocType] = useState('')
  const [cardActionLoading, setCardActionLoading] = useState(false)
  const [cardActionMsg, setCardActionMsg] = useState('')
  const [cardActionError, setCardActionError] = useState('')

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
        api.get(`/member-levels?lang=${getCurrentLanguage()}`).then((levels: any) => {
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
        // Cargar sponsorships (como padrino y como ahijado)
        api.get('/user/sponsorships').then((s: any) => {
          setSponsorships({ asSponsor: Array.isArray(s?.as_sponsor) ? s.as_sponsor : [], asSponsored: s?.as_sponsored || null })
        }).catch(() => {})
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

  // === Acciones de tarjetas NFC — abren modales internos ===

  const openChangePinModal = (cardUid: string) => {
    setCardModal({ type: 'changePin', cardUid })
    setAuthPassword('')
    setNewPin1('')
    setNewPin2('')
    setCardActionMsg('')
    setCardActionError('')
  }

  const openToggleCardModal = (cardUid: string, isActive: boolean) => {
    setCardModal({ type: 'toggle', cardUid, isActive })
    setAuthPassword('')
    setCardActionMsg('')
    setCardActionError('')
  }

  const openChangeDocModal = (cardUid: string, currentDoc?: string) => {
    setCardModal({ type: 'changeDoc', cardUid, currentDoc })
    setAuthPassword('')
    setSelectedDocType(currentDoc || '')
    setCardActionMsg('')
    setCardActionError('')
  }

  // Re-autenticar al usuario antes de una acción sensible
  const reauthenticate = async (): Promise<boolean> => {
    if (!me?.username) {
      setCardActionError('No se pudo determinar el usuario actual')
      return false
    }
    try {
      // El endpoint de login valida la contraseña y devuelve un token nuevo
      // No reemplazamos el token de sesión — solo validamos que la contraseña es correcta
      await api.post('/auth/login/password', {
        username: me.username,
        password: authPassword,
      })
      return true
    } catch (err) {
      setCardActionError('Contraseña incorrecta — no se pudo verificar tu identidad')
      return false
    }
  }

  const executeCardAction = async () => {
    if (!cardModal) return
    setCardActionLoading(true)
    setCardActionError('')
    setCardActionMsg('')

    // Re-autenticar
    const authOk = await reauthenticate()
    if (!authOk) {
      setCardActionLoading(false)
      return
    }

    try {
      if (cardModal.type === 'changePin') {
        if (newPin1.length !== 4 || !/^\d{4}$/.test(newPin1)) {
          setCardActionError('El PIN debe ser 4 dígitos numéricos')
          setCardActionLoading(false)
          return
        }
        if (newPin1 !== newPin2) {
          setCardActionError('Los PINs no coinciden')
          setCardActionLoading(false)
          return
        }
        await api.put('/nfc/cards/pin', { card_uid: cardModal.cardUid, new_pin: newPin1 })
        setCardActionMsg('PIN cambiado correctamente')
        if (me?.id) loadNfcCards(me.id)
      } else if (cardModal.type === 'toggle') {
        await api.put(`/nfc/my-cards/${cardModal.cardUid}/toggle`, { is_active: !cardModal.isActive })
        setCardActionMsg(cardModal.isActive ? 'Tarjeta desactivada' : 'Tarjeta activada')
        if (me?.id) loadNfcCards(me.id)
      } else if (cardModal.type === 'changeDoc') {
        await api.put(`/nfc/cards/${cardModal.cardUid}/document`, { document_type_code: selectedDocType.trim() })
        setCardActionMsg('Documento de la tarjeta actualizado')
        if (me?.id) loadNfcCards(me.id)
      }
    } catch (err) {
      setCardActionError(err instanceof Error ? err.message : 'Error al procesar la acción')
    }
    setCardActionLoading(false)
  }

  const closeCardModal = () => {
    setCardModal(null)
    setAuthPassword('')
    setNewPin1('')
    setNewPin2('')
    setSelectedDocType('')
    setCardActionMsg('')
    setCardActionError('')
    setCardActionLoading(false)
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
        <h1 className="text-2xl font-bold flex items-center gap-2"><User size={24} />{t('title')}</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>{t('help_title')}</strong></p>
          <p><strong>{t('help_what_label')}</strong> {t('help_what')}</p>
          <p><strong>{t('help_purpose_label')}</strong> {t('help_purpose')}</p>
          <p><strong>{t('help_usage_label')}</strong> {t('help_usage')}</p>
          <p><strong>{t('help_info_label')}</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>{t('help_info_user_label')}</strong> {t('help_info_user')}</li>
            <li><strong>{t('help_info_name_label')}</strong> {t('help_info_name')}</li>
            <li><strong>{t('help_info_type_label')}</strong> {t('help_info_type')}</li>
            <li><strong>{t('help_info_balance_label')}</strong> {t('help_info_balance')}</li>
            <li><strong>{t('help_info_status_label')}</strong> {t('help_info_status')}</li>
          </ul>
          <p><strong>{t('help_level_label')}</strong> {t('help_level')}</p>
          <p><strong>{t('help_limits_label')}</strong> {t('help_limits')}</p>
          <p><strong>{t('help_passkeys_label')}</strong> {t('help_passkeys')}</p>
          <p><strong>{t('help_nfc_label')}</strong> {t('help_nfc')}</p>
          <p><strong>{t('help_pin_label')}</strong> {t('help_pin')}</p>
          <p><strong>{t('help_activity_label')}</strong> {t('help_activity')}</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('common:close')}</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {/* Informacion personal */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><User size={18} />{t('profile_info_title')}</h2>
        {me ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">{t('profile_username')}</span> <b>{me.username}</b></div>
            <div className="flex justify-between"><span className="text-gray-500">{t('profile_name')}</span> <b>{me.display_name || '-'}</b></div>
            <div className="flex justify-between"><span className="text-gray-500">{t('profile_type')}</span> <b>{me.account_type}</b></div>
            <div className="flex justify-between"><span className="text-gray-500">{t('profile_balance')}</span> <b>{fmtTQ(me.balance)} {currency}</b></div>
            <div className="flex justify-between"><span className="text-gray-500">{t('profile_status')}</span> <b>{me.membership_status}</b></div>
            {me.is_over_limit && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-2 mt-2 text-sm text-red-800">
                <strong>{t('profile_over_limit')}</strong> — {t('profile_over_limit_desc')}
              </div>
            )}
            {me.id && (
              <div className="border-t pt-2 mt-2">
                <div className="text-gray-500 text-xs mb-1">{t('profile_uuid_label')}</div>
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  <code className="text-xs text-gray-700 flex-1 break-all">{me.id}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(me.id); setCopiedUuid(true); setTimeout(() => setCopiedUuid(false), 2000) }}
                    className="flex-shrink-0 p-1.5 rounded hover:bg-gray-200 transition"
                    title={t('profile_copy_uuid')}
                  >
                    {copiedUuid ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-gray-500" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">{t('profile_uuid_hint')}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">{t('common:loading')}</p>
        )}
      </div>

      {/* Idioma preferido */}
      <PreferredLanguageCard />

      {/* Documentos de identidad (multiples, con modal) */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><Shield size={18} />{t('profile_docs_title')}</h2>
        <p className="text-xs text-gray-500 mb-3">{t('profile_docs_desc')}</p>

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
          <p className="text-sm text-gray-400 mb-4">{t('profile_no_docs')}</p>
        )}

        {docMsg && <div className="text-sm bg-blue-50 text-blue-700 p-2 rounded-lg mb-3">{docMsg}</div>}

        <button
          onClick={() => setShowDocModal(true)}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Plus size={16} /> {t('profile_add_doc_btn')}
        </button>
      </div>

      {/* Modal: Agregar documento de identidad */}
      {showDocModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">{t('profile_add_doc')}</h2>
              <button onClick={() => { setShowDocModal(false); setNewDoc({ document_type: '', document_number: '', country_iso2: '' }); setDocPhoto(null); setDocMsg('') }} className="text-gray-400 hover:text-gray-600">
                <Trash2 size={20} />
              </button>
            </div>

            <div>
              <label className="label">{t('profile_doc_type')}</label>
              <select
                value={newDoc.document_type}
                onChange={(e) => setNewDoc({ ...newDoc, document_type: e.target.value })}
                className="input"
              >
                <option value="">{t('profile_select_type')}</option>
                {docTypes.map((t: any) => (
                  <option key={t.code} value={t.code}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">{t('profile_doc_number')}</label>
              <input
                type="text"
                value={newDoc.document_number}
                onChange={(e) => setNewDoc({ ...newDoc, document_number: e.target.value })}
                placeholder={t('profile_doc_number_ph')}
                className="input"
              />
            </div>

            <div>
              <label className="label">{t('profile_doc_country')}</label>
              <select
                value={newDoc.country_iso2}
                onChange={(e) => setNewDoc({ ...newDoc, country_iso2: e.target.value })}
                className="input"
              >
                <option value="">{t('profile_select_country')}</option>
                {countries.map((c: any) => (
                  <option key={c.iso2} value={c.iso2}>{c.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">{t('profile_country_hint')}</p>
            </div>

            <div>
              <label className="label">{t('profile_doc_photo')}</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setDocPhoto(e.target.files?.[0] || null)}
                className="input text-sm"
              />
              {docPhoto && <p className="text-xs text-gray-500 mt-1">{t('profile_file_selected')} {docPhoto.name}</p>}
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowDocModal(false); setNewDoc({ document_type: '', document_number: '', country_iso2: '' }); setDocPhoto(null); setDocMsg('') }} className="btn-secondary">{t('common:cancel')}</button>
              <button onClick={addDocument} disabled={savingDoc} className="btn-primary">
                {savingDoc ? t('common:loading') : t('profile_save_doc')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nivel de miembro */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><Shield size={18} />{t('profile_level_title')}</h2>
        {upgradeMsg && <div className="text-sm bg-blue-50 text-blue-700 p-3 rounded-lg mb-3">{upgradeMsg}</div>}
        <button onClick={tryUpgrade} className="btn-secondary flex items-center gap-2 mb-3 text-sm"><TrendingUp size={16} />{t('profile_request_upgrade')}</button>
        {levelLoading ? (
          <p className="text-gray-500 text-sm">{t('profile_loading_level')}</p>
        ) : myLevel ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">{t('profile_level')}</span> <b>{myLevel.name}</b></div>
            {myLevel.description && <p className="text-gray-600">{myLevel.description}</p>}
            <div className="flex gap-2 mt-2 flex-wrap">
              {myLevel.has_voice && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t('profile_voice')}</span>}
              {myLevel.has_vote && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t('profile_vote')}</span>}
              {myLevel.counts_in_quorum && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{t('profile_quorum')}</span>}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div><span className="text-gray-500">{t('profile_credit_limit')}</span> <b>{fmtTQ(myLevel.credit_limit)} {currency}</b></div>
              <div><span className="text-gray-500">{t('profile_debit_limit')}</span> <b>{fmtTQ(myLevel.debit_limit)} {currency}</b></div>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {myLevel.can_create_organization && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">{t('profile_can_create_org')}</span>}
              {myLevel.can_cross_node_trade && <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded">{t('profile_cross_node_trade')}</span>}
              {myLevel.can_receive_nfc_card && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">{t('profile_nfc_card')}</span>}
              {myLevel.can_view_audit && <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{t('profile_view_audit')}</span>}
              {myLevel.can_use_external_bridge && <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded">{t('profile_external_bridge')}</span>}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">{t('profile_no_level')}</p>
        )}
      </div>

      {/* Apadrinamiento */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><Heart size={18} />{t('profile_sponsorship_title')}</h2>

        {/* Como ahijado */}
        {sponsorships.asSponsored ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
            <p className="text-sm font-medium text-blue-700 mb-1">{t('profile_you_are_sponsored')}</p>
            <div className="text-sm space-y-1">
              <div><span className="text-gray-500">{t('profile_sponsor')}</span> <b>{sponsorships.asSponsored.sponsor_username || sponsorships.asSponsored.sponsor_id}</b></div>
              <div><span className="text-gray-500">{t('profile_assigned_amount')}</span> <b>{fmtTQ(sponsorships.asSponsored.amount_held)} {currency}</b></div>
            </div>
            <p className="text-xs text-gray-400 mt-2">{t('profile_sponsor_hint')}</p>
          </div>
        ) : (
          <p className="text-xs text-gray-400 mb-3">{t('profile_no_sponsor')}</p>
        )}

        {/* Como padrino */}
        {sponsorships.asSponsor.length > 0 ? (
          <div>
            <p className="text-sm font-medium mb-2">{t('profile_active_godchildren')}</p>
            <div className="space-y-2">
              {sponsorships.asSponsor.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg text-sm">
                  <div>
                    <span className="font-medium">{s.sponsored_id?.slice(0, 8)}...</span>
                    <span className="text-gray-500 ml-2">{fmtTQ(s.amount_held)} {currency}</span>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">{t('profile_active')}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {t('profile_total_held')} {fmtTQ(sponsorships.asSponsor.reduce((sum: number, s: any) => sum + (s.amount_held || 0), 0))} {currency}
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-400">{t('profile_not_sponsoring')}</p>
        )}
      </div>

      {/* Passkeys */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><Key size={18} />{t('profile_passkeys_title')}</h2>
        {passkeyMsg && <div className="text-sm bg-green-50 text-green-700 p-3 rounded-lg mb-3">{passkeyMsg}</div>}
        <button
          onClick={openPasskeyModal}
          disabled={passkeyLoading}
          className="btn-secondary flex items-center gap-2 mb-3 text-sm"
        >
          <Plus size={16} />
          {passkeyLoading ? t('profile_registering') : t('profile_register_device')}
        </button>
        <p className="text-xs text-gray-500 mb-3">
          {t('profile_passkeys_desc')}
        </p>
        {passkeys.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('profile_no_passkeys')}</p>
        ) : (
          <div className="space-y-2">
            {passkeys.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-gray-100 py-2 last:border-0">
                <div>
                  <b>{p.name || t('profile_device_n', { n: i + 1 })}</b>
                  <p className="text-xs text-gray-400">
                    {p.created_at && `${t('profile_registered')} ${p.created_at?.slice(0, 10)}`}
                    {p.last_used_at && ` | ${t('profile_last_used')} ${p.last_used_at?.slice(0, 10)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t('profile_active')}</span>
                  <button
                    onClick={() => deletePasskey(p.id)}
                    className="text-red-500 hover:text-red-700"
                    title={t('profile_delete_device')}
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
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Key size={20} />{t('profile_register_new_device')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('profile_passkey_modal_desc')}
            </p>
            <input
              type="text"
              className="input w-full mb-4"
              value={passkeyLabel}
              onChange={(e) => setPasskeyLabel(e.target.value)}
              placeholder={t('profile_device_name')}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && registerPasskey()}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowPasskeyModal(false)} className="btn-secondary text-sm">{t('common:cancel')}</button>
              <button
                onClick={registerPasskey}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Plus size={16} />
                {t('profile_continue')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tarjetas NFC */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><CreditCard size={18} />{t('profile_nfc_cards_title')}</h2>
        {nfcCards.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('profile_no_nfc_cards')}</p>
        ) : (
          <div className="space-y-3">
            {nfcCards.map((c, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <b className="text-sm">UID: {c.card_uid?.slice(0, 16)}...</b>
                    {c.card_type && <p className="text-xs text-gray-400">{t('profile_card_type')} {c.card_type}</p>}
                    {c.required_doc_type && <p className="text-xs text-blue-600">{t('profile_doc_label')} {c.required_doc_type}</p>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {c.is_active ? t('profile_card_active') : t('profile_card_inactive')}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => openChangePinModal(c.card_uid)} className="btn-secondary text-xs">{t('profile_change_pin')}</button>
                  <button
                    onClick={() => openToggleCardModal(c.card_uid, c.is_active)}
                    className={`text-xs px-3 py-1 rounded ${c.is_active ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                  >
                    {c.is_active ? t('profile_deactivate') : t('profile_activate')}
                  </button>
                  <button
                    onClick={() => openChangeDocModal(c.card_uid, c.required_doc_type)}
                    className="text-xs px-3 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                  >
                    {t('profile_change_doc')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial reciente */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><History size={18} />{t('profile_activity_title')}</h2>
        {history.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('profile_no_transactions')}</p>
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

      {/* === Modal interno para acciones de tarjetas NFC === */}
      {cardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={closeCardModal}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {cardModal.type === 'changePin' && t('profile_modal_change_pin')}
                {cardModal.type === 'toggle' && (cardModal.isActive ? t('profile_modal_deactivate') : t('profile_modal_activate'))}
                {cardModal.type === 'changeDoc' && t('profile_modal_change_doc')}
              </h3>
              <button onClick={closeCardModal} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">
              {t('profile_card_label')} <b>{cardModal.cardUid.slice(0, 16)}...</b>
            </p>

            {/* Re-autenticación obligatoria */}
            <div className="space-y-2">
              <label className="label flex items-center gap-1"><Shield size={14} /> {t('profile_verify_identity')}</label>
              <input
                type="password"
                className="input w-full"
                placeholder={t('profile_current_password')}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-gray-400">{t('profile_auth_hint')}</p>
            </div>

            {/* Campos según el tipo de acción */}
            {cardModal.type === 'changePin' && (
              <>
                <div className="space-y-2">
                  <label className="label">{t('profile_new_pin')}</label>
                  <input
                    type="password"
                    className="input w-full"
                    placeholder={t('profile_pin_ph')}
                    maxLength={4}
                    value={newPin1}
                    onChange={(e) => setNewPin1(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="label">{t('profile_confirm_pin')}</label>
                  <input
                    type="password"
                    className="input w-full"
                    placeholder={t('profile_repeat_pin')}
                    maxLength={4}
                    value={newPin2}
                    onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, ''))}
                  />
                  {newPin1 && newPin2 && newPin1 !== newPin2 && (
                    <p className="text-xs text-red-500">{t('profile_pins_dont_match')}</p>
                  )}
                </div>
              </>
            )}

            {cardModal.type === 'changeDoc' && (
              <div className="space-y-2">
                <label className="label">{t('profile_doc_for_card')}</label>
                <select
                  className="input w-full"
                  value={selectedDocType}
                  onChange={(e) => setSelectedDocType(e.target.value)}
                >
                  <option value="">{t('profile_default_doc')}</option>
                  {documents.map((d: any, i: number) => (
                    <option key={i} value={d.document_type}>
                      {d.document_type_name || d.document_type}: {d.document_number}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400">{t('profile_doc_for_card_hint')}</p>
              </div>
            )}

            {cardModal.type === 'toggle' && (
              <p className="text-sm text-gray-600">
                {cardModal.isActive
                  ? t('profile_deactivate_desc')
                  : t('profile_activate_desc')}
              </p>
            )}

            {/* Mensajes */}
            {cardActionError && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{cardActionError}</p>}
            {cardActionMsg && <p className="text-sm text-green-600 bg-green-50 rounded p-2">{cardActionMsg}</p>}

            {/* Botones */}
            <div className="flex gap-2 justify-end">
              <button onClick={closeCardModal} className="btn-secondary text-sm">
                {cardActionMsg ? t('common:close') : t('common:cancel')}
              </button>
              {!cardActionMsg && (
                <button
                  onClick={executeCardAction}
                  disabled={cardActionLoading || !authPassword || (cardModal.type === 'changePin' && (newPin1.length !== 4 || newPin1 !== newPin2))}
                  className="btn-primary text-sm"
                >
                  {cardActionLoading ? t('profile_processing') : t('profile_confirm')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// === Seccion de idioma preferido del usuario ===
function PreferredLanguageCard() {
  const { t } = useTranslation(['profile', 'common'])
  const { i18n } = useTranslation('common')
  const [languages, setLanguages] = useState<any[]>([])
  const [selected, setSelected] = useState(i18n.language || 'es')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.get<any[]>('/languages').then((langs) => {
      setLanguages((langs || []).filter(l => l.enabled))
    }).catch(() => {
      setLanguages([
        { code: 'es', native_name: 'Español', enabled: true },
        { code: 'en', native_name: 'English', enabled: true },
      ])
    })
    // Cargar preferencia actual
    api.get<any>('/me/preferences').then((p) => {
      if (p?.language) setSelected(p.language)
    }).catch(() => {})
  }, [])

  const handleSave = async (lang: string) => {
    setSelected(lang)
    setSaving(true)
    setMsg('')
    try {
      await api.put('/me/preferences', { language: lang })
      // Aplicar el cambio inmediatamente
      await changeLanguage(lang)
      sessionStorage.setItem('language_manually_changed', '1')
      setMsg(t('language.saved'))
    } catch (e: any) {
      setMsg(e.message || t('language.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <h2 className="font-semibold flex items-center gap-2 mb-3">
        <Globe size={18} /> {t('language.title')}
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        {t('language.description')}
      </p>
      <div className="flex flex-wrap gap-2">
        {languages.map((l) => (
          <button
            key={l.code}
            onClick={() => handleSave(l.code)}
            disabled={saving}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
              selected === l.code
                ? 'bg-trueque-600 text-white border-trueque-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-trueque-400'
            }`}
          >
            <span className="font-mono text-xs opacity-60 mr-1">{l.code.toUpperCase()}</span>
            {l.native_name}
            {selected === l.code && <Check size={14} className="inline ml-1.5" />}
          </button>
        ))}
      </div>
      {msg && (
        <div className="mt-3 text-sm p-2 rounded bg-green-50 text-green-700">{msg}</div>
      )}
    </div>
  )
}
