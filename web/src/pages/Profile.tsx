import { useState, useEffect } from 'react'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { HelpCircle, User, Key, CreditCard, History, Shield, TrendingUp } from 'lucide-react'

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

  const load = () => {
    api.get('/accounts/me').then((d: any) => {
      setMe(d)
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
      }
    }).catch(() => {})

    api.get('/auth/passkey/list').then((d: any) => setPasskeys(Array.isArray(d) ? d : d?.passkeys ?? [])).catch(() => {})
    api.get('/nfc/cards').then((d: any) => setNfcCards(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(() => { load() }, [])

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
          <p><strong>Passkeys:</strong> Son dispositivos con los que puedes iniciar sesion sin contrasena: huella, FaceID, PIN del movil, llaves de seguridad USB. Si pierdes uno, pide al admin que lo elimine.</p>
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
            <div className="flex justify-between"><span className="text-gray-500">Balance:</span> <b>{me.balance} {currency}</b></div>
            <div className="flex justify-between"><span className="text-gray-500">Estado:</span> <b>{me.membership_status}</b></div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Cargando...</p>
        )}
      </div>

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
              <div><span className="text-gray-500">Limite credito:</span> <b>{myLevel.credit_limit} {currency}</b></div>
              <div><span className="text-gray-500">Limite debito:</span> <b>{myLevel.debit_limit} {currency}</b></div>
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
        {passkeys.length === 0 ? (
          <p className="text-gray-500 text-sm">No tienes passkeys registrados.</p>
        ) : (
          <div className="space-y-2">
            {passkeys.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-gray-100 py-2 last:border-0">
                <div>
                  <b>{p.name || `Dispositivo ${i + 1}`}</b>
                  <p className="text-xs text-gray-400">ID: {p.credential_id?.slice(0, 16)}...</p>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Activo</span>
              </div>
            ))}
          </div>
        )}
      </div>

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
                  {t.amount >= 0 ? '+' : ''}{t.amount} {currency}
                </b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
