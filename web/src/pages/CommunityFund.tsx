import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { usePermissions } from '../hooks/usePermissions'
import { HelpCircle, Wallet, Users, Vote as VoteIcon, Plus, Check, X } from 'lucide-react'
import { fmtTQ, toCents } from '../lib/format'

export default function CommunityFund() {
  const { t } = useTranslation('common')
  const { currency } = useConfig()
  const { hasPermission } = usePermissions()
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [fund, setFund] = useState<any>(null)
  const [proposals, setProposals] = useState<any[]>([])
  const [showNewProposal, setShowNewProposal] = useState(false)
  const [newProposal, setNewProposal] = useState({ amount: 0, recipient: '', reason: '' })
  const [recipients, setRecipients] = useState<any[]>([])

  const load = () => {
    api.get('/fund/balance').then(setFund).catch(() => {})
    // Las propuestas multi-sig del fondo son propuestas de asamblea de tipo budget_increase
    api.get('/assembly/proposals').then((d: any) => {
      const all = Array.isArray(d) ? d : []
      setProposals(all.filter((p: any) => p.proposal_type === 'budget_increase' || p.proposal_type === 'fund_distribution'))
    }).catch(() => {})
    // Cargar lista de usuarios y organizaciones para el selector de destinatario
    api.get('/accounts/list').then((d: any) => {
      const list = Array.isArray(d) ? d : []
      // Filtrar: incluir usuarios individuales y organizaciones, excluir fondos y la propia cuenta de impuestos
      setRecipients(list.filter((u: any) => u.account_type !== 'fund' && u.username !== 'impuestos'))
    }).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const createProposal = async () => {
    setError('')
    if (newProposal.amount <= 0 || !newProposal.recipient) {
      setError(t('fund.error_amount_recipient', 'Monto y destinatario son obligatorios'))
      return
    }
    try {
      await api.post('/assembly/proposals', {
        proposal_type: 'budget_increase',
        description: `Distribucion del fondo: ${newProposal.reason}`,
        parameters: {
          organizacion: newProposal.recipient,
          monto: newProposal.amount,
        },
      })
      setShowNewProposal(false)
      setNewProposal({ amount: 0, recipient: '', reason: '' })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const vote = async (id: string, vote: string) => {
    try {
      await api.post(`/assembly/proposals/${id}/vote`, { vote })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const execute = async (id: string) => {
    try {
      await api.post(`/assembly/proposals/${id}/execute`, {})
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet size={24} />{t('fund.title', 'Fondo Comunitario')}</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>{t('fund.help_title', 'Fondo Comunitario - Ayuda')}</strong></p>
          <p><strong>{t('fund.help_what_label', 'Que es:')}</strong> {t('fund.help_what', 'El Fondo Comunitario ES la cuenta de la Asamblea General. No son cuentas separadas: es una sola cuenta que recibe los impuestos y sirve como tesoro comunitario.')}</p>
          <p><strong>{t('fund.help_transfer_label', 'Como transferirle:')}</strong> {t('fund.help_transfer', 'Puedes transferir a esta cuenta usando cualquiera de estos 3 nombres (todos llegan a la misma cuenta): @asamblea, @impuestos o @fondo_comunitario.')}</p>
          <p><strong>{t('fund.help_source_label', 'De donde viene el dinero:')}</strong> {t('fund.help_source', 'Cada vez que alguien hace una transferencia, el sistema aplica un porcentaje de impuesto automatico que va a parar a esta cuenta. Por ejemplo, si el impuesto es 2% y se transfieren 100 unidades, 2 unidades van al fondo. Nadie necesita depositar manualmente: se acumula solo con el uso.')}</p>
          <p><strong>{t('fund.help_usage_label', 'Para que se usa:')}</strong> {t('fund.help_usage', 'El dinero del fondo se destina a infraestructura del nodo, servicios publicos, ayuda mutua entre miembros, y proyectos aprobados por la asamblea. No puede gastarse libremente: cada gasto requiere aprobacion colectiva.')}</p>
          <p><strong>{t('fund.help_distribute_label', 'Como se distribuye:')}</strong> {t('fund.help_distribute', 'Para gastar dinero del fondo hay que crear una propuesta de distribucion indicando el destinatario, el monto y la razon. Luego los miembros votan a favor o en contra. Si la propuesta se aprueba, se puede ejecutar y el dinero se transfiere al destinatario.')}</p>
          <p><strong>{t('fund.help_admin_label', 'Quien lo administra:')}</strong> {t('fund.help_admin', 'Nadie individualmente. El balance es visible para todos, pero los gastos solo se realizan mediante votacion de la asamblea. Esto garantiza que el fondo no pueda ser mal utilizado por una sola persona.')}</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('common:close')}</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {/* Balance del fondo */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><Wallet size={18} />{t('fund_balance_title', 'Balance del Fondo')}</h2>
        {fund ? (
          fund.fund_account ? (
            <div className="space-y-2">
              <div className="text-3xl font-bold text-trueque-700">{fund.balance >= 0 ? '+' : ''}{fmtTQ(fund.balance || 0)} {currency}</div>
              <p className="text-sm text-gray-500">{t('fund_account_label', 'Cuenta:')} <b>{fund.display_name || fund.username || 'asamblea'}</b></p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-mono">@asamblea</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-mono">@impuestos</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-mono">@fondo_comunitario</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{t('fund_aliases_hint', 'Los 3 nombres son aliases de la misma cuenta. Puedes usar cualquiera para transferir.')}</p>
              {fund.transaction_count > 0 && (
                <p className="text-xs text-gray-400">{fund.transaction_count} {t('fund_tx_count', 'transacciones registradas')}</p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-amber-600 text-sm">{fund.message}</p>
              <p className="text-xs text-gray-400 mt-2">{t('fund_not_exists_hint', "El Fondo Comunitario es la cuenta de la Asamblea General. Si no existe, crea una cuenta con username 'asamblea'.")}</p>
            </div>
          )
        ) : (
          <p className="text-gray-500 text-sm">{t('common:loading')}</p>
        )}
      </div>

      {/* Propuestas de distribucion */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold flex items-center gap-2"><VoteIcon size={18} />{t('fund_proposals_title', 'Propuestas de Distribucion')}</h2>
          <button onClick={() => setShowNewProposal(!showNewProposal)} className="btn-primary flex items-center gap-2"><Plus size={18} />{t('fund_new_proposal', 'Nueva Propuesta')}</button>
        </div>

        {showNewProposal && (
          <div className="card space-y-4">
            <h3 className="font-semibold">{t('fund_propose_title', 'Proponer Distribucion del Fondo')}</h3>
            <div>
              <label className="label">{t('fund_recipient_label', 'Destinatario (organizacion o usuario)')}</label>
              <select className="input" value={newProposal.recipient} onChange={(e) => setNewProposal({ ...newProposal, recipient: e.target.value })}>
                <option value="">{t('fund_select_recipient', 'Selecciona un destinatario...')}</option>
                {recipients.map((r: any) => (
                  <option key={r.id} value={r.username}>{r.display_name || r.username} ({r.username}) - {r.account_type === 'organization' ? t('fund_org_type', 'Organizacion') : t('fund_user_type', 'Usuario')}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">{t('fund_recipient_hint', 'Selecciona la cuenta que recibira el dinero del fondo. Solo aparecen usuarios y organizaciones validas del nodo.')}</p>
            </div>
            <div>
              <label className="label">{t('fund_amount_label', 'Monto ({currency})', { currency })}</label>
              <input type="number" className="input" placeholder={t('fund_amount_ph', 'Ej: 500')} value={newProposal.amount} onChange={(e) => setNewProposal({ ...newProposal, amount: toCents(e.target.value) })} />
              <p className="text-xs text-gray-400 mt-1">{t('fund_amount_hint', 'Cuanto dinero del fondo se distribuira al destinatario. Debe ser mayor que 0 y no superar el balance disponible. Ej: 500.')}</p>
            </div>
            <div>
              <label className="label">{t('fund_reason_label', 'Razon')}</label>
              <textarea className="input" rows={2} placeholder={t('fund_reason_ph', 'Ej: Compra de materiales para taller comunitario')} value={newProposal.reason} onChange={(e) => setNewProposal({ ...newProposal, reason: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">{t('fund_reason_hint', 'Explica para que se usara el dinero. Esta razon sera visible para todos los votantes. Ej: "Compra de materiales para taller comunitario".')}</p>
            </div>
            <button onClick={createProposal} className="btn-primary">{t('fund_create_proposal', 'Crear Propuesta')}</button>
          </div>
        )}

        {proposals.length === 0 && !showNewProposal ? (
          <div className="card text-center text-gray-500 py-8">
            <p>{t('fund_no_proposals', 'No hay propuestas de distribucion.')}</p>
            <p className="text-xs mt-2">{t('fund_no_proposals_hint', 'Crea una propuesta para distribuir dinero del fondo comunitario.')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((p, i) => (
              <div key={i} className="card">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.description}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    p.status === 'executed' ? 'bg-green-100 text-green-700' :
                    p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{p.status}</span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="text-green-600">{t('fund_votes_for', 'A favor:')} {p.votes_for || 0}</span>
                  <span className="text-red-600">{t('fund_votes_against', 'En contra:')} {p.votes_against || 0}</span>
                </div>
                {p.status === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => vote(p.id, 'for')} className="btn-secondary text-green-600 flex items-center gap-1"><Check size={16} />{t('fund_vote_for', 'A favor')}</button>
                    <button onClick={() => vote(p.id, 'against')} className="btn-secondary text-red-600 flex items-center gap-1"><X size={16} />{t('fund_vote_against', 'En contra')}</button>
                    <button onClick={() => execute(p.id)} className="btn-primary ml-auto">{t('fund_execute', 'Ejecutar')}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
