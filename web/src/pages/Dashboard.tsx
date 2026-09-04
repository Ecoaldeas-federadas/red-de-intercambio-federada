import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { useTranslation } from 'react-i18next'
import { Wallet, AlertTriangle, Network, HelpCircle, Send, History as HistoryIcon, ShoppingBag, Calculator, Calendar, ChevronRight, Building2, Users as UsersIcon } from 'lucide-react'
import { fmtTQ } from '../lib/format'

export default function Dashboard() {
  const { currency } = useConfig()
  const { t } = useTranslation('dashboard')
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
    }).catch(() => setError(t('error_loading', 'Error al cargar datos')))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title', 'Panel Principal')}</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>{t('help_what_is')}</strong></p>
          <p>{t('help_what_is_desc', { currency })}</p>

          <p><strong>{t('help_what_for')}</strong></p>
          <p>{t('help_what_for_intro')}</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>{t('help_what_for_1', { currency })}</li>
            <li>{t('help_what_for_2')}</li>
            <li>{t('help_what_for_3')}</li>
            <li>{t('help_what_for_4')}</li>
          </ul>

          <p><strong>{t('help_how_to_use')}</strong></p>
          <p>{t('help_how_to_use_desc')}</p>

          <p className="pt-2"><strong>{t('help_balance_card')}</strong></p>
          <p>{t('help_balance_card_desc', { currency })}</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>{t('help_balance_positive')}</strong> {t('help_balance_positive_desc')}</li>
            <li><strong>{t('help_balance_negative')}</strong> {t('help_balance_negative_desc')}</li>
            <li><strong>{t('help_balance_zero')}</strong> {t('help_balance_zero_desc')}</li>
          </ul>
          <p className="text-xs text-gray-500">{t('help_balance_example', { currency })}</p>

          <p className="pt-2"><strong>{t('help_what_is_balance')}</strong></p>
          <p>{t('help_what_is_balance_desc')}</p>

          <p className="pt-2"><strong>{t('help_limits_title')}</strong></p>
          <p>{t('help_limits_intro')}</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>{t('help_credit_limit')}</strong> {t('help_credit_limit_desc')}</li>
            <li><strong>{t('help_debit_limit')}</strong> {t('help_debit_limit_desc')}</li>
          </ul>
          <p className="text-xs text-gray-500">{t('help_limits_example', { currency })}</p>
          <p>{t('help_limits_community')}</p>

          <p className="pt-2"><strong>{t('help_federated_nodes_card')}</strong></p>
          <p>{t('help_federated_nodes_desc')}</p>

          <p className="pt-2"><strong>{t('help_warnings_card')}</strong></p>
          <p>{t('help_warnings_desc')}</p>

          <p className="pt-2"><strong>{t('help_connected_nodes_section')}</strong></p>
          <p>{t('help_connected_nodes_desc')}</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>{t('help_negative_balance')}</strong> {t('help_negative_balance_desc')}</li>
            <li><strong>{t('help_positive_balance')}</strong> {t('help_positive_balance_desc')}</li>
          </ul>

          <p className="pt-2"><strong>{t('help_quick_actions_title')}</strong></p>
          <p>{t('help_quick_actions_desc')}</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>{t('transfer')}:</strong> {t('help_transfer_desc')}</li>
            <li><strong>{t('history')}:</strong> {t('help_history_desc')}</li>
            <li><strong>{t('help_buy')}:</strong> {t('help_buy_desc')}</li>
            <li><strong>{t('calculator')}:</strong> {t('help_calculator_desc')}</li>
          </ul>
          <p className="text-xs text-gray-500">{t('help_quick_actions_tip')}</p>

          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline block pt-2">{t('close_help')}</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="text-trueque-600" size={24} />
            <h2 className="text-lg font-semibold">{t('balance')}</h2>
          </div>
          {userDisplay && (
            <p className="text-xs text-gray-500 mb-1">@{userName} ({userDisplay})</p>
          )}
          <p className="text-3xl font-bold text-trueque-700">
            {balance !== null ? `${balance >= 0 ? '+' : ''}${fmtTQ(balance)} ${currency}` : '...'}
          </p>
          {creditLimit !== null && debitLimit !== null && (
            <p className="text-xs text-gray-500 mt-2">
              {t('credit_limit_label', { value: fmtTQ(creditLimit), currency })} | {t('debit_limit_label', { value: fmtTQ(debitLimit), currency })}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {t('balance_explanation', { currency })}
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => navigate('/app/wallet')} className="text-sm text-trueque-600 hover:text-trueque-700 font-medium">
              {t('view_wallet')} →
            </button>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <Network className="text-blue-600" size={24} />
            <h2 className="text-lg font-semibold">{t('federated_nodes')}</h2>
          </div>
          <p className="text-3xl font-bold text-blue-700">{nodes.length}</p>
          <p className="text-xs text-gray-400 mt-2">
            {t('federated_nodes_explanation')}
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="text-orange-600" size={24} />
            <h2 className="text-lg font-semibold">{t('active_warnings')}</h2>
          </div>
          <p className="text-3xl font-bold text-orange-600">{warnings.length}</p>
          <p className="text-xs text-gray-400 mt-2">
            {t('warnings_explanation')}
          </p>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-3">{t('limit_warnings')}</h2>
          <p className="text-xs text-gray-500 mb-3">{t('limit_warnings_desc')}</p>
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
        <h2 className="text-lg font-semibold mb-1">{t('quick_actions')}</h2>
        <p className="text-xs text-gray-500 mb-3">{t('quick_actions_desc')}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button onClick={() => navigate('/app/transfer')} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-trueque-400 hover:bg-trueque-50 transition">
            <Send className="text-trueque-600" size={24} />
            <span className="text-sm font-medium">{t('transfer')}</span>
            <span className="text-xs text-gray-400">{t('transfer_desc')}</span>
          </button>
          <button onClick={() => navigate('/app/history')} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition">
            <HistoryIcon className="text-blue-600" size={24} />
            <span className="text-sm font-medium">{t('history')}</span>
            <span className="text-xs text-gray-400">{t('history_desc')}</span>
          </button>
          <button onClick={() => navigate('/app/store')} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-trueque-400 hover:bg-trueque-50 transition">
            <ShoppingBag className="text-trueque-600" size={24} />
            <span className="text-sm font-medium">{t('buy')}</span>
            <span className="text-xs text-gray-400">{t('store_desc')}</span>
          </button>
          <button onClick={() => navigate('/app/calculator')} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition">
            <Calculator className="text-blue-600" size={24} />
            <span className="text-sm font-medium">{t('calculator')}</span>
            <span className="text-xs text-gray-400">{t('calculator_desc')}</span>
          </button>
        </div>
      </div>

      {/* Mis Organizaciones */}
      {myOrgs.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="text-purple-600" size={20} />
              {t('my_organizations')}
            </h2>
            <button onClick={() => navigate('/app/organizations')} className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1">
              {t('view_all')} <ChevronRight size={14} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">{t('organizations_desc')}</p>
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
                    {t('role')}: <span className="font-medium">{org.role}</span>
                    {org.is_board_member && <span className="text-purple-600"> · {t('board_member')}</span>}
                  </div>
                  {org.can_transfer && (
                    <div className="text-xs text-green-600 mt-0.5">{t('can_transfer')}</div>
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
              {t('my_departments')}
            </h2>
            <button onClick={() => navigate('/app/departments')} className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1">
              {t('view_all')} <ChevronRight size={14} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">{t('departments_desc')}</p>
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
                    {t('role')}: <span className="font-medium">{dept.role}</span>
                    {dept.can_manage && <span className="text-teal-600"> · {t('can_manage')}</span>}
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
              {t('upcoming_assemblies')}
            </h2>
            <button onClick={() => navigate('/app/assembly')} className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1">
              {t('view_all')} <ChevronRight size={14} />
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
        <h2 className="text-lg font-semibold mb-1">{t('connected_nodes')}</h2>
        <p className="text-xs text-gray-500 mb-3">{t('connected_nodes_desc')}</p>
        {nodes.length === 0 ? (
          <div className="text-center text-gray-500 py-6">
            <p>{t('no_federated_nodes')}</p>
            <p className="text-xs mt-2">{t('no_federated_nodes_desc')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {nodes.map((n, i) => (
              <div key={i} className="flex items-center justify-between border-b border-gray-100 py-2">
                <span className="font-medium">{n.remote_node}</span>
                <span className={`text-sm ${n.balance < 0 ? 'text-red-600' : 'text-trueque-600'}`}>
                  {fmtTQ(n.balance || 0)} {currency}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
