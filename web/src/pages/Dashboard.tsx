import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Wallet, AlertTriangle, Network, HelpCircle, Send, History as HistoryIcon, ShoppingBag, Calculator, Calendar, ChevronRight, Building2, Users as UsersIcon } from 'lucide-react'

export default function Dashboard() {
  const { currency } = useConfig()
  const navigate = useNavigate()
  const [balance, setBalance] = useState<number | null>(null)
  const [creditLimit, setCreditLimit] = useState<number | null>(null)
  const [debitLimit, setDebitLimit] = useState<number | null>(null)
  const [userName, setUserName] = useState('')
  const [userDisplay, setUserDisplay] = useState('')
  const [warnings, setWarnings] = useState<any[]>([])
  const [nodes, setNodes] = useState<any[]>([])
  const [upcomingAssemblies, setUpcomingAssemblies] = useState<any[]>([])
  const [myOrgs, setMyOrgs] = useState<any[]>([])
  const [myDepts, setMyDepts] = useState<any[]>([])
  const [error, setError] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get<any>('/auth/me').catch(() => null),
      api.get<any>('/federation/warnings').catch(() => ({ warnings: [] })),
      api.get<any[]>('/federation/nodes').catch(() => []),
      api.get<any[]>('/assembly/sessions?filter=upcoming').catch(() => []),
      api.get<any[]>('/my/organizations').catch(() => []),
      api.get<any[]>('/my/departments').catch(() => []),
    ]).then(([user, warn, n, sessions, orgs, depts]) => {
      if (user) {
        setBalance(user.balance ?? 0)
        setCreditLimit(user.credit_limit ?? null)
        setDebitLimit(user.debit_limit ?? null)
        setUserName(user.username || '')
        setUserDisplay(user.display_name || user.username || '')
      }
      setWarnings(warn?.warnings ?? [])
      setNodes(Array.isArray(n) ? n : [])
      setUpcomingAssemblies(Array.isArray(sessions) ? sessions.slice(0, 3) : [])
      setMyOrgs(Array.isArray(orgs) ? orgs : [])
      setMyDepts(Array.isArray(depts) ? depts : [])
    }).catch(() => setError('Error al cargar datos'))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Panel Principal</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>¿Que es el Panel Principal?</strong></p>
          <p>El Panel Principal (Dashboard) es la pantalla de inicio de tu nodo. Es la primera pagina que ves al entrar. Muestra un resumen rapido del estado de tu cuenta personal y de la red federada a la que perteneces. Sirve para saber de un vistazo cuanto tienes, cuanto debes y como esta tu comunidad.</p>

          <p><strong>¿Para que sirve?</strong></p>
          <p>Sirve para:</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Ver tu saldo (balance) actual en Trueques ({currency})</li>
            <li>Saber si te acercas a los limites de credito o debito</li>
            <li>Ver cuantas comunidades estan federadas con la tuya</li>
            <li>Acceder rapidamente a las acciones mas comunes (transferir, ver historial, etc.)</li>
          </ul>

          <p><strong>¿Como se usa?</strong></p>
          <p>Simplemente mira las tres tarjetas de arriba para ver tu balance, nodos federados y avisos. Si hay avisos (numero en naranja), revisa la seccion "Avisos de Limites" mas abajo. Usa los botones de "Acciones Rapidas" para ir directamente a las paginas mas usadas sin buscarlas en el menu.</p>

          <p className="pt-2"><strong>Tarjeta "Mi Balance" - ¿Que muestra?</strong></p>
          <p>Muestra tu saldo actual en Trueques ({currency}). Este numero puede ser:</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Positivo (ej: +350):</strong> Tienes credito. Alguien te debe o recibiste pagos. Significa que la comunidad te debe bienes/servicios por ese monto.</li>
            <li><strong>Negativo (ej: -120):</strong> Debes a la comunidad. Es completamente normal: significa que recibiste bienes/servicios y despues pagaras vendiendo o trabajando. No es una deuda "mala", es como un credito rotatorio.</li>
            <li><strong>Cero (0):</strong> No has hecho transacciones todavia, o tus entradas y salidas se compensaron exactamente.</li>
          </ul>
          <p className="text-xs text-gray-500">Ejemplo: Si tu balance es -80 {currency}, significa que has recibido 80 {currency} en bienes/servicios que aun no has compensado.</p>

          <p className="pt-2"><strong>¿Que es el Balance?</strong></p>
          <p>El balance es la suma de todas tus transacciones. Cada vez que recibes Trueques, sube. Cada vez que envias, baja. El sistema funciona como una contabilidad de doble entrada: lo que uno entrega, otro recibe. La suma de todos los balances de todos los usuarios siempre da cero. Nadie "crea" dinero de la nada.</p>

          <p className="pt-2"><strong>¿Que significan los limites de credito y debito?</strong></p>
          <p>Debajo del balance veras dos numeros:</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Limite credito (ej: +1000):</strong> Es el maximo que puedes tener a favor. Si tu balance llega a +1000, no puedes recibir mas hasta que gastes algo. Evita que una sola persona acumule demasiado credito sin aportar.</li>
            <li><strong>Limite debito (ej: -1000):</strong> Es el maximo que puedes deber. Si tu balance llega a -1000, no puedes gastar mas hasta que recibas Trueques (vendiendo o trabajando). Evita que alguien compre sin limite.</li>
          </ul>
          <p className="text-xs text-gray-500">Ejemplo: Si tu limite de debito es -500 y tu balance es -480, solo puedes gastar 20 {currency} mas antes de llegar al tope.</p>
          <p>Estos limites los define tu comunidad y se pueden ajustar en la configuracion del nodo.</p>

          <p className="pt-2"><strong>Tarjeta "Nodos Federados" - ¿Que muestra?</strong></p>
          <p>Muestra cuantas comunidades (nodos) estan conectadas a la tuya mediante la federacion. La federacion permite intercambiar Trueques entre comunidades distintas. Si dice 0, tu nodo esta solo y solo puedes transferir entre usuarios de tu misma comunidad.</p>

          <p className="pt-2"><strong>Tarjeta "Avisos Activos" - ¿Que muestra?</strong></p>
          <p>Muestra alertas cuando te acercas a los limites de federacion (deuda o credito con otros nodos). Si dice 0, no hay problemas. Si hay avisos, revisa la seccion "Avisos de Limites" para ver el detalle.</p>

          <p className="pt-2"><strong>Seccion "Nodos Conectados"</strong></p>
          <p>Lista cada comunidad federada y el saldo que tienes con ella:</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Saldo negativo (rojo):</strong> Debes a esa comunidad. Compraste a alguien de alli y despues pagaras.</li>
            <li><strong>Saldo positivo (verde):</strong> Te deben. Vendiste a alguien de alli y despues recibiras.</li>
          </ul>

          <p className="pt-2"><strong>Acciones Rapidas - ¿Como se usan?</strong></p>
          <p>Debajo de las tarjetas hay botones grandes que te llevan directamente a las paginas mas usadas:</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Transferir:</strong> Envia Trueques a otra persona</li>
            <li><strong>Historial:</strong> Ver todas tus transacciones pasadas</li>
            <li><strong>Comprar:</strong> Ver productos disponibles en la tienda</li>
            <li><strong>Calcular:</strong> Usar la calculadora de equivalencias</li>
          </ul>
          <p className="text-xs text-gray-500">Solo haz clic en el boton y te llevara a esa pagina. Es un atajo para no buscar en el menu lateral.</p>

          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline block pt-2">Cerrar ayuda</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="text-trueque-600" size={24} />
            <h2 className="text-lg font-semibold">Mi Balance</h2>
          </div>
          {userDisplay && (
            <p className="text-xs text-gray-500 mb-1">@{userName} ({userDisplay})</p>
          )}
          <p className="text-3xl font-bold text-trueque-700">
            {balance !== null ? `${balance >= 0 ? '+' : ''}${balance.toLocaleString()} ${currency}` : '...'}
          </p>
          {creditLimit !== null && debitLimit !== null && (
            <p className="text-xs text-gray-500 mt-2">
              Limite credito: +{creditLimit.toLocaleString()} {currency} (maximo a tu favor) | Limite debito: -{debitLimit.toLocaleString()} {currency} (maximo que puedes deber)
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Saldo positivo = tienes credito (te deben). Saldo negativo = debes (es normal, pagaras despues). Ej: -80 significa que recibiste 80 {currency} en bienes que compensaras despues.
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => navigate('/app/wallet')} className="text-sm text-trueque-600 hover:text-trueque-700 font-medium">
              Ver mi billetera →
            </button>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <Network className="text-blue-600" size={24} />
            <h2 className="text-lg font-semibold">Nodos Federados</h2>
          </div>
          <p className="text-3xl font-bold text-blue-700">{nodes.length}</p>
          <p className="text-xs text-gray-400 mt-2">
            Comunidades conectadas a la tuya para intercambiar. Ej: 3 significa que puedes transferir con usuarios de 3 comunidades distintas.
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="text-orange-600" size={24} />
            <h2 className="text-lg font-semibold">Avisos Activos</h2>
          </div>
          <p className="text-3xl font-bold text-orange-600">{warnings.length}</p>
          <p className="text-xs text-gray-400 mt-2">
            Alertas de limites de federacion cercanos al tope. Ej: 2 significa que te acercas al limite con 2 nodos.
          </p>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-3">Avisos de Limites</h2>
          <p className="text-xs text-gray-500 mb-3">Estas alertas indican que te estas acercando al limite de deuda o credito con otros nodos.</p>
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-orange-50 border border-orange-200 rounded-lg p-3">
                <AlertTriangle size={16} className="text-orange-600" />
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-1">Acciones Rapidas</h2>
        <p className="text-xs text-gray-500 mb-3">Atajos a las paginas mas usadas. Haz clic en cualquier boton para ir directamente.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button onClick={() => navigate('/app/transfer')} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-trueque-400 hover:bg-trueque-50 transition">
            <Send className="text-trueque-600" size={24} />
            <span className="text-sm font-medium">Transferir</span>
            <span className="text-xs text-gray-400">Enviar Trueques</span>
          </button>
          <button onClick={() => navigate('/app/history')} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition">
            <HistoryIcon className="text-blue-600" size={24} />
            <span className="text-sm font-medium">Historial</span>
            <span className="text-xs text-gray-400">Ver transacciones</span>
          </button>
          <button onClick={() => navigate('/app/store')} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-trueque-400 hover:bg-trueque-50 transition">
            <ShoppingBag className="text-trueque-600" size={24} />
            <span className="text-sm font-medium">Comprar</span>
            <span className="text-xs text-gray-400">Ver tienda</span>
          </button>
          <button onClick={() => navigate('/app/calculator')} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition">
            <Calculator className="text-blue-600" size={24} />
            <span className="text-sm font-medium">Calcular</span>
            <span className="text-xs text-gray-400">Equivalencias</span>
          </button>
        </div>
      </div>

      {/* Mis Organizaciones */}
      {myOrgs.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="text-purple-600" size={20} />
              Mis Organizaciones
            </h2>
            <button onClick={() => navigate('/app/organizations')} className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1">
              Ver todas <ChevronRight size={14} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">Organizaciones donde tienes un rol. Entras con tu usuario y la organizacion sabe quien eres y que puedes hacer.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myOrgs.map((org) => (
              <button
                key={org.id}
                onClick={() => navigate(`/app/organizations/${org.id}`)}
                className="text-left flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition"
              >
                <Building2 className="text-purple-600 flex-shrink-0" size={24} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-800">{org.display_name}</div>
                  <div className="text-xs text-gray-500">
                    Rol: <span className="font-medium">{org.role}</span>
                    {org.is_board_member && <span className="text-purple-600"> · Junta Directiva</span>}
                  </div>
                  {org.can_transfer && (
                    <div className="text-xs text-green-600 mt-0.5">Puede transferir</div>
                  )}
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mis Departamentos */}
      {myDepts.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <UsersIcon className="text-teal-600" size={20} />
              Mis Departamentos
            </h2>
            <button onClick={() => navigate('/app/departments')} className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1">
              Ver todos <ChevronRight size={14} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">Comisiones y departamentos donde eres miembro. Entras con tu usuario y ves segun tu rol.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myDepts.map((dept) => (
              <button
                key={dept.id}
                onClick={() => navigate(`/app/departments/${dept.id}`)}
                className="text-left flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition"
              >
                <UsersIcon className="text-teal-600 flex-shrink-0" size={24} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-800">{dept.name}</div>
                  <div className="text-xs text-gray-500">
                    Rol: <span className="font-medium">{dept.role}</span>
                    {dept.can_manage && <span className="text-teal-600"> · Puede gestionar</span>}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Asambleas pendientes */}
      {upcomingAssemblies.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="text-purple-600" size={20} />
              Asambleas Pendientes
            </h2>
            <button onClick={() => navigate('/app/assembly')} className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1">
              Ver todas <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {upcomingAssemblies.map((s, i) => (
              <button
                key={i}
                onClick={() => navigate('/app/assembly')}
                className="w-full text-left flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition"
              >
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {s.is_presential && <span className="text-purple-600">Presencial | </span>}
                    {s.session_type} | {s.start_time?.slice(0, 16).replace('T', ' ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    s.status === 'scheduled' ? 'bg-yellow-100 text-yellow-700' :
                    s.status === 'waiting_quorum' ? 'bg-orange-100 text-orange-700' :
                    s.status === 'active' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{s.status}</span>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-1">Nodos Conectados</h2>
        <p className="text-xs text-gray-500 mb-3">Lista de comunidades federadas y el saldo con cada una. Saldo negativo = debes a esa comunidad. Saldo positivo = te deben.</p>
        {nodes.length === 0 ? (
          <div className="text-center text-gray-500 py-6">
            <p>No hay nodos federados conectados.</p>
            <p className="text-xs mt-2">Para federar con otra comunidad, ve a Limites de Federacion y registra un nodo remoto.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {nodes.map((n, i) => (
              <div key={i} className="flex items-center justify-between border-b border-gray-100 py-2">
                <span className="font-medium">{n.remote_node}</span>
                <span className={`text-sm ${n.balance < 0 ? 'text-red-600' : 'text-trueque-600'}`}>
                  {n.balance?.toLocaleString()} {currency}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
