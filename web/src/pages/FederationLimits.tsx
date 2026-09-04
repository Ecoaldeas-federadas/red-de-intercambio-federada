import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useConfig } from '../hooks/useConfig'
import { Plus, HelpCircle, Network, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { fmtTQ, toCents } from '../lib/format'

export default function FederationLimits() {
  const { t } = useTranslation(['federation', 'common'])
  const { currency } = useConfig()
  const [config, setConfig] = useState<any>(null)
  const [bilaterals, setBilaterals] = useState<any[]>([])
  const [nodes, setNodes] = useState<any[]>([])
  const [showPropose, setShowPropose] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [form, setForm] = useState({ remote_node: '', credit_limit: 0, debit_limit: 0 })
  const [changeRequest, setChangeRequest] = useState<{ node: string; currentCredit: number; currentDebit: number } | null>(null)
  const [changeForm, setChangeForm] = useState({ action: 'increase', credit_limit: 0, debit_limit: 0, reason: '' })
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    api.get('/federation/config').then(setConfig).catch(() => {})
    api.get('/federation/bilateral').then((d: any) => setBilaterals(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/federation/nodes').then((d: any) => {
      const arr = Array.isArray(d) ? d : []
      setNodes(arr)
      // Pre-seleccionar el primer nodo si hay
      if (arr.length > 0 && !form.remote_node) {
        setForm((f) => ({ ...f, remote_node: arr[0].remote_node }))
      }
    }).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const propose = async () => {
    if (!form.remote_node) return
    await api.post('/federation/bilateral/propose', form)
    setShowPropose(false)
    setForm({ remote_node: '', credit_limit: 0, debit_limit: 0 })
    load()
  }

  const confirm = async (node: string) => {
    await api.post(`/federation/bilateral/${node}/confirm`, {})
    load()
  }

  const openChangeRequest = (b: any) => {
    setChangeRequest({ node: b.remote_node, currentCredit: b.credit_limit, currentDebit: b.debit_limit })
    setChangeForm({ action: 'increase', credit_limit: b.credit_limit, debit_limit: b.debit_limit, reason: '' })
    setError('')
    setSuccess('')
  }

  const submitChangeRequest = async () => {
    if (!changeRequest) return
    setError('')
    setSuccess('')
    const { action, credit_limit, debit_limit, reason } = changeForm
    if (credit_limit <= 0 || debit_limit <= 0) {
      setError(t('limits_must_be_positive', 'Los limites deben ser mayores a 0'))
      return
    }
    const verb = action === 'increase' ? 'aumentar' : 'reducir'
    const description = `Cambiar limite bilateral con ${changeRequest.node}: ${verb} credito de ${fmtTQ(changeRequest.currentCredit)} a ${fmtTQ(credit_limit)} ${currency} y debito de ${fmtTQ(changeRequest.currentDebit)} a ${fmtTQ(debit_limit)} ${currency}. Razon: ${reason || 'No especificada'}`
    try {
      await api.post('/assembly/proposals', {
        proposal_type: 'federation_limit_change',
        description,
        parameters: {
          remote_node: changeRequest.node,
          action,
          current_credit_limit: changeRequest.currentCredit,
          current_debit_limit: changeRequest.currentDebit,
          new_credit_limit: credit_limit,
          new_debit_limit: debit_limit,
          reason,
        },
      })
      setSuccess(`Solicitud enviada a la asamblea para ${verb} el limite con ${changeRequest.node}.`)
      setChangeRequest(null)
      setTimeout(() => setSuccess(''), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('limits_error_creating', 'Error al crear la solicitud'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Network size={24} />{t('limits_title', 'Limites de Federacion')}</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
            <HelpCircle size={20} />
          </button>
          <button onClick={() => setShowPropose(!showPropose)} className="btn-primary flex items-center gap-2"><Plus size={18} />{t('limits_propose_bilateral', 'Proponer Bilateral')}</button>
        </div>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
          <p><strong>Limites de Federacion - Ayuda</strong></p>
          <p><strong>Que son los limites entre nodos:</strong> Son los topes maximos de saldo (positivo o negativo) que tu nodo puede tener con cada nodo peer federado. Sirven para controlar el riesgo: si tu nodo le debe demasiado a otro nodo y este se desconecta, pierdes ese saldo. Los limites protegen a tu comunidad.</p>
          <p><strong>Para que sirve:</strong> Permiten gestionar el riesgo de credito entre nodos federados. Sin limites, un nodo podria acumular una deuda ilimitada con otro. Con limites, se controla cuanto puede deber cada nodo y cuanto puede prestar.</p>
          <p><strong>Que es el limite de credito:</strong> Es el saldo positivo maximo que tu nodo puede tener con otro nodo. Es decir, lo maximo que el otro nodo te puede deber a ti. Si tu nodo tiene un saldo de +500 {currency} con un peer y el limite de credito es 1000 {currency}, aun puedes aceptar 500 {currency} mas en transacciones a tu favor.</p>
          <p><strong>Que es el limite de debito:</strong> Es el saldo negativo maximo (deuda) que tu nodo puede tener con otro nodo. Es decir, lo maximo que tu nodo le puede deber al otro. Si tu nodo tiene un saldo de -300 {currency} y el limite de debito es 500 {currency}, aun puedes gastar 200 {currency} mas en transacciones a tu contra.</p>
          <p><strong>Como funciona el comercio entre nodos:</strong> Cuando un usuario de tu nodo compra algo a un usuario de otro nodo federado, el saldo bilateral cambia. Tu nodo le debe mas al otro nodo (debito) o el otro nodo te debe mas a ti (credito). El sistema verifica que los limites no se excedan antes de aprobar la transaccion.</p>
          <p><strong>Limite Global:</strong> Deuda/saldo maximo total del nodo con toda la red federada. Aplica a todos los nodos al nivel base.</p>
          <p><strong>Limite Bilateral:</strong> Limite personalizado entre dos nodos especificos. Si dos nodos acuerdan un limite mayor, NO consume el limite global.</p>
          <p><strong>Como funciona el limite efectivo:</strong> El limite efectivo entre dos nodos = min(limite_A_hacia_B, limite_B_hacia_A). Ambos nodos deben subirlo para que aplique el nuevo valor.</p>
          <p><strong>Base bilateral:</strong> Limite inicial igual para todos los pares (ej: 50% del global). Se puede personalizar despues nodo por nodo.</p>
          <p><strong>Umbrales de aviso:</strong> Porcentajes del limite (ej: 50%/75%/90%) que disparan notificaciones cuando el saldo se acerca al limite.</p>
          <p><strong>Como usar esta pagina:</strong> Revisa la configuracion global. Para personalizar el limite con un nodo especifico, haz clic en "Proponer Bilateral", selecciona el nodo e ingresa los nuevos limites. El otro nodo debe confirmar la propuesta para que aplique.</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('limits_close_help', t('common:close'))}</button>
        </div>
      )}

      {config && (
        <div className="card">
          <h2 className="font-semibold mb-3">{t('limits_global_config', 'Configuracion Global')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <label className="label">{t('limits_global_credit', 'Credito Global')}</label>
              <b>{fmtTQ(config.node_global_credit_limit)} {currency}</b>
            </div>
            <div>
              <label className="label">{t('limits_global_debit', 'Debito Global')}</label>
              <b>{fmtTQ(config.node_global_debit_limit)} {currency}</b>
            </div>
            <div>
              <label className="label">{t('limits_bilateral_base', 'Base Bilateral')}</label>
              <b>{fmtTQ(config.node_bilateral_base_limit)} {currency}</b>
            </div>
            <div>
              <label className="label">{t('limits_warning_thresholds', 'Umbrales de aviso')}</label>
              <b>{config.warning_threshold_1}/{config.warning_threshold_2}/{config.warning_threshold_3}%</b>
            </div>
          </div>
        </div>
      )}

      {showPropose && (
        <div className="card space-y-4">
          <h2 className="font-semibold">{t('limits_propose_title', 'Proponer Limite Bilateral')}</h2>
          <p className="text-xs text-gray-500">{t('limits_propose_desc', 'Selecciona un nodo federado y propone nuevos limites. El otro nodo debe confirmar.')}</p>

          <div>
            <label className="label">{t('limits_remote_node', 'Nodo remoto')}</label>
            {nodes.length > 0 ? (
              <select className="input" value={form.remote_node} onChange={(e) => setForm({ ...form, remote_node: e.target.value })}>
                <option value="">{t('limits_select_node', 'Seleccionar nodo...')}</option>
                {nodes.map((n, i) => (
                  <option key={i} value={n.remote_node}>{n.remote_node}</option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                <select className="input bg-gray-100" disabled>
                  <option value="">{t('limits_no_federated_nodes', 'No hay nodos federados registrados')}</option>
                </select>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                  <p>{t('limits_no_federated_nodes', 'No hay nodos federados registrados todavia.')}</p>
                  <p className="text-xs mt-1">{t('limits_no_federated_hint', 'Para proponer un limite bilateral, primero debes registrar un nodo peer.')}</p>
                  <a href={`${import.meta.env.BASE_URL}app/federation/peers`} className="inline-block mt-2 text-blue-600 underline text-sm font-medium">{t('limits_go_register_peer', 'Ir a registrar nodo peer')} →</a>
                </div>
              </div>
            )}
            {nodes.length > 0 && <p className="text-xs text-gray-400 mt-1">Selecciona de la lista de nodos federados registrados. Ejemplo: <code>nodo-b.org</code></p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('limits_credit_limit', `Limite de credito (${currency})`)}</label>
              <input type="number" className="input" placeholder="Ej: 1000" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: toCents(e.target.value) })} />
              <p className="text-xs text-gray-400 mt-1">{t('limits_credit_hint', 'Maximo saldo positivo (a tu favor) con este nodo.')} Ejemplo: <code>1000</code> {currency}</p>
            </div>
            <div>
              <label className="label">{t('limits_debit_limit', `Limite de debito (${currency})`)}</label>
              <input type="number" className="input" placeholder="Ej: 500" value={form.debit_limit} onChange={(e) => setForm({ ...form, debit_limit: toCents(e.target.value) })} />
              <p className="text-xs text-gray-400 mt-1">{t('limits_debit_hint', 'Maximo saldo negativo (deuda) con este nodo.')} Ejemplo: <code>500</code> {currency}</p>
            </div>
          </div>

          <button onClick={propose} className="btn-primary" disabled={!form.remote_node}>{t('limits_send_proposal', 'Enviar Propuesta')}</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
      {success && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg">{success}</div>}

      <div className="card">
        <h2 className="font-semibold mb-3">{t('limits_bilateral_list', 'Limites Bilaterales')}</h2>
        {bilaterals.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('limits_no_bilateral', 'No hay limites bilaterales personalizados. Todos los nodos usan el limite base.')}</p>
        ) : (
          <div className="space-y-2">
            {bilaterals.map((b, i) => (
              <div key={i} className="border-b border-gray-100 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{b.remote_node}</span>
                    {b.is_customized && <span className="ml-2 text-xs bg-trueque-100 text-trueque-700 px-2 py-0.5 rounded">{t('limits_customized', 'Personalizado')}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-600">
                      {t('limits_credit', 'Credito')}: {fmtTQ(b.credit_limit)} {currency} | {t('limits_debit', 'Debito')}: {fmtTQ(b.debit_limit)} {currency}
                      {!b.remote_confirmed && <button onClick={() => confirm(b.remote_node)} className="ml-2 text-blue-600 hover:underline">{t('limits_confirm', 'Confirmar')}</button>}
                    </div>
                    <button
                      onClick={() => openChangeRequest(b)}
                      className="text-xs px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 flex items-center gap-1"
                    >
                      <ArrowUpCircle size={14} /> {t('limits_request_change', 'Solicitar cambio')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Solicitar cambio de limite */}
      {changeRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setChangeRequest(null)}>
          <div className="bg-white rounded-xl p-6 w-96 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">{t('limits_change_title', 'Solicitar cambio de limite')}</h2>
            <p className="text-sm text-gray-600">{t('limits_remote_node', 'Nodo')}: <b>{changeRequest.node}</b></p>
            <p className="text-xs text-gray-500">{t('limits_current_limits', 'Limites actuales')}: {t('limits_credit', 'Credito')} {changeRequest.currentCredit} {currency} | {t('limits_debit', 'Debito')} {changeRequest.currentDebit} {currency}</p>

            <div>
              <label className="label">{t('limits_change_action', 'Accion')}</label>
              <select className="input" value={changeForm.action} onChange={(e) => setChangeForm({ ...changeForm, action: e.target.value })}>
                <option value="increase">{t('limits_increase', 'Aumentar limite')}</option>
                <option value="decrease">{t('limits_decrease', 'Reducir limite')}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('limits_new_credit', `Nuevo limite credito (${currency})`)}</label>
                <input type="number" className="input" value={changeForm.credit_limit} onChange={(e) => setChangeForm({ ...changeForm, credit_limit: toCents(e.target.value) })} />
              </div>
              <div>
                <label className="label">{t('limits_new_debit', `Nuevo limite debito (${currency})`)}</label>
                <input type="number" className="input" value={changeForm.debit_limit} onChange={(e) => setChangeForm({ ...changeForm, debit_limit: toCents(e.target.value) })} />
              </div>
            </div>

            <div>
              <label className="label">{t('limits_reason', 'Razon del cambio')}</label>
              <textarea className="input" rows={2} placeholder="Ej: Aumentamos el comercio con este nodo, necesitamos mas limite" value={changeForm.reason} onChange={(e) => setChangeForm({ ...changeForm, reason: e.target.value })} />
            </div>

            <p className="text-xs text-gray-500">{t('limits_change_hint', 'Esta solicitud pasara a la asamblea para votacion. Los miembros decidiran si aprueban el cambio.')}</p>

            <div className="flex gap-2">
              <button onClick={() => setChangeRequest(null)} className="btn-secondary flex-1">{t('limits_cancel', t('common:cancel'))}</button>
              <button onClick={submitChangeRequest} className="btn-primary flex-1">{t('limits_send_assembly', 'Enviar a Asamblea')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
