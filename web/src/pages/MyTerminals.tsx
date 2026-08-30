import { useState, useEffect } from 'react'
import { api, apiFetch } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { Smartphone, Lock, Unlock, Eye, Activity, Power, ShoppingBag, Edit2, Globe, Clock, XCircle, CheckCircle, KeyRound, History, Download } from 'lucide-react'
import { fmtTQ, fmtDateTime } from '../lib/format'

interface MyTerminal {
  id: string
  terminal_id: string
  label: string
  terminal_type: string
  location: string
  is_active: boolean
  is_registered: boolean
  is_blocked: boolean
  last_seen: string | null
  created_at: string
}

interface Transaction {
  id: string
  card_uid: string
  amount: number
  status: string
  pin_verified: boolean
  transaction_type: string
  error_message: string
  created_at: string
}

export default function MyTerminals() {
  const { hasPermission } = usePermissions()
  const [terminals, setTerminals] = useState<MyTerminal[]>([])
  const [selectedTerminal, setSelectedTerminal] = useState<MyTerminal | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [renaming, setRenaming] = useState<MyTerminal | null>(null)
  const [renameLabel, setRenameLabel] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)

  // Shift PIN state
  const [shiftPinModal, setShiftPinModal] = useState<MyTerminal | null>(null)
  const [shiftPinValue, setShiftPinValue] = useState('')
  const [shiftPinSaving, setShiftPinSaving] = useState(false)

  // Shift history state
  const [shiftHistoryModal, setShiftHistoryModal] = useState<MyTerminal | null>(null)
  const [shifts, setShifts] = useState<any[]>([])
  const [shiftsLoading, setShiftsLoading] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // POS Web session state
  const [pendingWebSessions, setPendingWebSessions] = useState<any[]>([])
  const [activeWebSessions, setActiveWebSessions] = useState<any[]>([])
  const [webSessionOptions, setWebSessionOptions] = useState<string[]>([])
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null)
  const [selectedCode, setSelectedCode] = useState('')
  const [approvedHours, setApprovedHours] = useState(24)
  const [webSessionAction, setWebSessionAction] = useState('')
  const [showWebSessions, setShowWebSessions] = useState(false)

  const hasWebTerminals = terminals.some(t => t.terminal_type === 'web_pos')

  useEffect(() => {
    loadTerminals()
    // Auto-refresh cada 15 segundos cuando la pagina esta visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadTerminals()
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  // Auto-refresh pending web sessions cuando la seccion esta visible
  useEffect(() => {
    if (showWebSessions && hasWebTerminals) {
      loadPendingWebSessions()
      loadActiveWebSessions()
      const interval = setInterval(() => {
        loadPendingWebSessions()
        loadActiveWebSessions()
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [showWebSessions, hasWebTerminals])

  const loadPendingWebSessions = async () => {
    try {
      const res = await api.get<any[]>('/pos-web/pending-sessions')
      setPendingWebSessions(res || [])
    } catch (err) {
      // ignore errors
    }
  }

  const loadActiveWebSessions = async () => {
    try {
      const res = await api.get<any[]>('/pos-web/sessions')
      setActiveWebSessions(res || [])
    } catch (err) {
      // ignore errors
    }
  }

  const loadWebSessionOptions = async (reqId: string) => {
    setSelectedReqId(reqId)
    setWebSessionOptions([])
    setSelectedCode('')
    try {
      const res = await api.get<any>(`/pos-web/pending-sessions/${reqId}/options`)
      const options = Array.isArray(res) ? res : res?.options ?? []
      setWebSessionOptions(options)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar opciones')
    }
  }

  const handleApproveWebSession = async (reqId: string) => {
    if (!selectedCode) {
      setError('Selecciona un codigo')
      return
    }
    setWebSessionAction(reqId)
    try {
      await api.post(`/pos-web/pending-sessions/${reqId}/approve`, {
        selected_code: selectedCode,
        approved_hours: approvedHours,
      })
      setPendingWebSessions(prev => prev.filter(p => p.id !== reqId))
      setSelectedReqId(null)
      setSelectedCode('')
      setWebSessionOptions([])
      loadActiveWebSessions()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al aprobar sesion')
    } finally {
      setWebSessionAction('')
    }
  }

  const handleRejectWebSession = async (reqId: string) => {
    setWebSessionAction(reqId + '-reject')
    try {
      await api.post(`/pos-web/pending-sessions/${reqId}/reject`, {})
      setPendingWebSessions(prev => prev.filter(p => p.id !== reqId))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al rechazar')
    } finally {
      setWebSessionAction('')
    }
  }

  const handleRevokeWebSession = async (terminalId: string) => {
    setWebSessionAction(terminalId + '-revoke')
    try {
      await api.post(`/pos-web/sessions/${terminalId}/revoke`, {})
      loadActiveWebSessions()
      loadTerminals()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al anular sesion')
    } finally {
      setWebSessionAction('')
    }
  }

  const loadTerminals = async () => {
    setLoading(true)
    try {
      const res = await api.get<MyTerminal[]>('/nfc/my-terminals')
      setTerminals(res || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (terminal: MyTerminal) => {
    try {
      await apiFetch(`/nfc/my-terminals/${terminal.terminal_id}/toggle`, { method: 'POST' })
      loadTerminals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const handleViewTransactions = async (terminal: MyTerminal) => {
    setSelectedTerminal(terminal)
    try {
      const res = await api.get<Transaction[]>(`/nfc/my-terminals/${terminal.terminal_id}/transactions`)
      setTransactions(res || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const handleRename = async () => {
    if (!renaming || !renameLabel.trim()) return
    setRenameSaving(true)
    try {
      await apiFetch(`/nfc/my-terminals/${renaming.terminal_id}/label`, {
        method: 'PUT',
        body: JSON.stringify({ label: renameLabel.trim() }),
      })
      setRenaming(null)
      setRenameLabel('')
      await loadTerminals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al renombrar')
    } finally {
      setRenameSaving(false)
    }
  }

  // Shift PIN management
  const handleSetShiftPin = async () => {
    if (!shiftPinModal || shiftPinValue.length < 4) return
    setShiftPinSaving(true)
    try {
      await apiFetch(`/nfc/my-terminals/${shiftPinModal.terminal_id}/shift-pin`, {
        method: 'POST',
        body: JSON.stringify({ pin: shiftPinValue }),
      })
      setShiftPinModal(null)
      setShiftPinValue('')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al configurar PIN')
    } finally {
      setShiftPinSaving(false)
    }
  }

  // Shift history
  const handleViewShiftHistory = async (terminal: MyTerminal) => {
    setShiftHistoryModal(terminal)
    await loadShifts(terminal.terminal_id)
  }

  const loadShifts = async (terminalId: string) => {
    setShiftsLoading(true)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      const qs = params.toString()
      const res = await api.get<any[]>(`/nfc/my-terminals/${terminalId}/shifts${qs ? '?' + qs : ''}`)
      setShifts(res || [])
    } catch (err) {
      setShifts([])
    } finally {
      setShiftsLoading(false)
    }
  }

  // CSV Export
  const handleExportTransactions = async (terminalId: string) => {
    try {
      const params = new URLSearchParams()
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      const qs = params.toString()
      const resp = await apiFetch(`/nfc/my-terminals/${terminalId}/export/transactions${qs ? '?' + qs : ''}`)
      const text = await resp.text()
      downloadCSV(text, `transacciones_${terminalId}.csv`)
    } catch (err) {
      setError('Error al exportar transacciones')
    }
  }

  const handleExportShifts = async (terminalId: string) => {
    try {
      const params = new URLSearchParams()
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      const qs = params.toString()
      const resp = await apiFetch(`/nfc/my-terminals/${terminalId}/export/shifts${qs ? '?' + qs : ''}`)
      const text = await resp.text()
      downloadCSV(text, `turnos_${terminalId}.csv`)
    } catch (err) {
      setError('Error al exportar turnos')
    }
  }

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatTime = (ts: string | null) => {
    if (!ts) return 'Nunca'
    return fmtDateTime(ts)
  }

  const totalSales = transactions
    .filter(t => t.status === 'approved')
    .reduce((sum, t) => sum + t.amount, 0)

  // Vista de transacciones de un terminal
  if (selectedTerminal) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Transacciones del Terminal</h1>
            <p className="text-gray-500 text-sm mt-1">{selectedTerminal.label}</p>
          </div>
          <button
            onClick={() => { setSelectedTerminal(null); setTransactions([]) }}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            ← Volver
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border">
            <div className="text-gray-500 text-xs mb-1">TOTAL VENTAS</div>
            <div className="text-2xl font-bold text-green-600">{fmtTQ(totalSales)} TQ</div>
          </div>
          <div className="bg-white rounded-xl p-4 border">
            <div className="text-gray-500 text-xs mb-1">TRANSACCIONES</div>
            <div className="text-2xl font-bold">{transactions.length}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border">
            <div className="text-gray-500 text-xs mb-1">APROBADAS</div>
            <div className="text-2xl font-bold text-green-600">
              {transactions.filter(t => t.status === 'approved').length}
            </div>
          </div>
        </div>

        {/* Transactions list */}
        <div className="bg-white rounded-xl border overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Activity className="mx-auto mb-2" size={32} />
              No hay transacciones
            </div>
          ) : (
            <div className="divide-y">
              {transactions.map(tx => (
                <div key={tx.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {tx.card_uid === 'qr_payment' ? '📱 Pago QR' : `💳 ${tx.card_uid.slice(0, 12)}...`}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTime(tx.created_at)}
                      {tx.error_message && ` · ${tx.error_message}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${tx.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.status === 'approved' ? '+' : ''}{fmtTQ(tx.amount)} TQ
                    </div>
                    <div className="text-xs text-gray-500">{tx.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Vista principal: lista de terminales
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingBag size={28} />
          Mis Puntos de Venta
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Terminales asignados a tu cuenta. Puedes activarlos, desactivarlos y ver transacciones.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">Cargando...</div>
      ) : terminals.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <Smartphone className="mx-auto mb-3 text-gray-300" size={48} />
          <h2 className="text-lg font-semibold mb-2">No tienes terminales asignados</h2>
          <p className="text-gray-500 text-sm">
            Si tienes un punto de venta, pide al administrador que te asigne un terminal.
            <br />
            El administrador debe registrar el terminal y asignarlo a tu cuenta.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {terminals.map(term => (
            <div key={term.id} className="bg-white rounded-xl border p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{term.label || 'Sin nombre'}</h3>
                  <p className="text-xs text-gray-500 font-mono mt-1">{term.terminal_id.slice(0, 24)}...</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {term.is_blocked ? (
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                      🔒 Bloqueado
                    </span>
                  ) : term.is_active ? (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                      ● Activo
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                      ○ Inactivo
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{term.terminal_type}</span>
                </div>
              </div>

              <div className="text-sm text-gray-500 mb-4">
                <p>📍 {term.location || 'Sin ubicacion'}</p>
                <p>🕐 Ultima actividad: {formatTime(term.last_seen)}</p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handleViewTransactions(term)}
                  className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 flex items-center justify-center gap-1"
                >
                  <Eye size={16} />
                  Transacciones
                </button>
                <button
                  onClick={() => handleViewShiftHistory(term)}
                  className="px-3 py-2 bg-purple-50 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-100 flex items-center justify-center gap-1"
                >
                  <History size={16} />
                  Turnos
                </button>
                <button
                  onClick={() => { setShiftPinModal(term); setShiftPinValue('') }}
                  className="px-3 py-2 bg-amber-50 text-amber-600 rounded-lg text-sm font-medium hover:bg-amber-100 flex items-center justify-center gap-1"
                >
                  <KeyRound size={16} />
                  PIN Turno
                </button>
                <button
                  onClick={() => { setRenaming(term); setRenameLabel(term.label || '') }}
                  className="px-3 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 flex items-center justify-center gap-1"
                >
                  <Edit2 size={16} />
                </button>
                {!term.is_blocked && (
                  <button
                    onClick={() => handleToggle(term)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 ${
                      term.is_active
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {term.is_active ? <><Power size={16} /> Off</> : <><Power size={16} /> On</>}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* POS Web Sessions - solo si tiene terminales web_pos */}
      {hasWebTerminals && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Globe size={24} />
              Sesiones POS Web
            </h2>
            <button
              onClick={() => setShowWebSessions(!showWebSessions)}
              className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200"
            >
              {showWebSessions ? 'Ocultar' : 'Mostrar'}
              {pendingWebSessions.length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-1.5 rounded-full">
                  {pendingWebSessions.length}
                </span>
              )}
            </button>
          </div>

          {showWebSessions && (
            <>
              {/* Solicitudes pendientes */}
              {pendingWebSessions.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Clock size={18} className="text-orange-500" />
                    Solicitudes Pendientes ({pendingWebSessions.length})
                  </h3>
                  <div className="space-y-3">
                    {pendingWebSessions.map((req) => (
                      <div key={req.id} className="bg-white rounded-xl border p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium">{req.terminal_label || req.terminal_id}</p>
                            <p className="text-xs text-gray-500 font-mono mt-1">
                              Terminal: {req.terminal_id.slice(0, 24)}...
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Solicitado: {formatTime(req.created_at)}
                            </p>
                          </div>
                        </div>

                        {selectedReqId === req.id ? (
                          /* Mostrar opciones de codigo */
                          <div className="border-t pt-3">
                            <p className="text-sm text-gray-600 mb-3">
                              Selecciona el codigo que te comunico la persona del POS web:
                            </p>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {webSessionOptions.map((code) => (
                                <button
                                  key={code}
                                  onClick={() => setSelectedCode(code)}
                                  className={`px-4 py-3 rounded-lg font-mono text-lg font-bold ${
                                    selectedCode === code
                                      ? 'bg-trueque-600 text-white'
                                      : 'bg-gray-100 hover:bg-gray-200'
                                  }`}
                                >
                                  {code}
                                </button>
                              ))}
                            </div>

                            <p className="text-sm text-gray-600 mb-2">Duracion de la sesion:</p>
                            <div className="flex gap-2 mb-3">
                              {[1, 5, 24].map(h => (
                                <button
                                  key={h}
                                  onClick={() => setApprovedHours(h)}
                                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                                    approvedHours === h
                                      ? 'bg-trueque-600 text-white'
                                      : 'bg-gray-100 hover:bg-gray-200'
                                  }`}
                                >
                                  {h}h
                                </button>
                              ))}
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveWebSession(req.id)}
                                disabled={!selectedCode || webSessionAction === req.id}
                                className="btn-primary flex-1 disabled:opacity-50"
                              >
                                {webSessionAction === req.id ? 'Aprobando...' : 'Aprobar'}
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedReqId(null)
                                  setSelectedCode('')
                                  setWebSessionOptions([])
                                }}
                                className="btn-secondary"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => loadWebSessionOptions(req.id)}
                              className="btn-primary flex-1"
                            >
                              Ver codigos
                            </button>
                            <button
                              onClick={() => handleRejectWebSession(req.id)}
                              disabled={webSessionAction === req.id + '-reject'}
                              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100"
                            >
                              {webSessionAction === req.id + '-reject' ? '...' : 'Rechazar'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sesiones activas */}
              <div>
                <h3 className="font-semibold mb-3">Sesiones Activas</h3>
                {activeWebSessions.length === 0 ? (
                  <div className="bg-white rounded-xl border p-6 text-center text-gray-500">
                    No hay sesiones web activas
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeWebSessions.map((session) => (
                      <div key={session.terminal_id} className="bg-white rounded-xl border p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">{session.label || session.terminal_id}</p>
                            <p className="text-xs text-gray-500 font-mono mt-1">
                              {session.terminal_id.slice(0, 24)}...
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {session.expired ? (
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                                Expirada
                              </span>
                            ) : session.is_active ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                ● Activa
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                                ○ Inactiva
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-gray-500 mb-3">
                          {session.expires_at && (
                            <p>⏰ Expira: {formatTime(session.expires_at)}</p>
                          )}
                          <p>🕐 Ultima actividad: {formatTime(session.last_seen)}</p>
                        </div>
                        {!session.expired && session.is_active && (
                          <button
                            onClick={() => handleRevokeWebSession(session.terminal_id)}
                            disabled={webSessionAction === session.terminal_id + '-revoke'}
                            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 flex items-center gap-1"
                          >
                            <XCircle size={16} />
                            {webSessionAction === session.terminal_id + '-revoke' ? 'Anulando...' : 'Anular sesion'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {pendingWebSessions.length === 0 && activeWebSessions.length === 0 && (
                <div className="bg-white rounded-xl border p-6 text-center text-gray-500">
                  No hay solicitudes pendientes ni sesiones activas.
                  <br />
                  <span className="text-sm">Cuando alguien abra el POS web, aparecera aqui una solicitud.</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">💡 Como usar tu terminal</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-600">
          <li>Abre el POS en tu dispositivo (celular o PC)</li>
          <li>Ingresa la URL del nodo e inicia sesion</li>
          <li>Si es terminal fisico (Android/ESP32), el administrador lo registra</li>
          <li>Si es POS Web, el administrador te asigna el terminal y tu apruebas cada sesion de navegador desde aqui</li>
          <li>Usa el teclado para ingresar el monto a cobrar</li>
          <li>Cobra con QR o NFC</li>
          <li>Aqui puedes ver todas tus transacciones y gestionar tus terminales</li>
        </ol>
      </div>

      {/* Modal de configurar PIN del turno */}
      {shiftPinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h2 className="font-bold text-lg mb-2 flex items-center gap-2">
              <KeyRound size={20} />
              PIN del Turno
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Configura el PIN que se requerira para abrir y cerrar turnos en este terminal.
              El POS lo usara localmente para funcionar sin internet.
              <br />
              <span className="font-mono text-xs">{shiftPinModal.label}</span>
            </p>
            <input
              type="password"
              value={shiftPinValue}
              onChange={(e) => setShiftPinValue(e.target.value)}
              placeholder="PIN (minimo 4 digitos)"
              className="input w-full mb-4"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && shiftPinValue.length >= 4) handleSetShiftPin() }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSetShiftPin}
                disabled={shiftPinValue.length < 4 || shiftPinSaving}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {shiftPinSaving ? 'Guardando...' : 'Guardar PIN'}
              </button>
              <button
                onClick={() => { setShiftPinModal(null); setShiftPinValue('') }}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de historial de turnos */}
      {shiftHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <History size={20} />
                Historial de Turnos: {shiftHistoryModal.label}
              </h2>
              <button
                onClick={() => { setShiftHistoryModal(null); setShifts([]); setFromDate(''); setToDate('') }}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cerrar
              </button>
            </div>

            {/* Filtro de fechas */}
            <div className="flex gap-2 mb-4">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="input flex-1"
                placeholder="Desde"
              />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="input flex-1"
                placeholder="Hasta"
              />
              <button
                onClick={() => loadShifts(shiftHistoryModal.terminal_id)}
                className="btn-primary px-4"
              >
                Buscar
              </button>
            </div>

            {/* Export buttons */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => handleExportShifts(shiftHistoryModal.terminal_id)}
                className="px-3 py-2 bg-green-50 text-green-600 rounded-lg text-sm font-medium hover:bg-green-100 flex items-center gap-1"
              >
                <Download size={16} />
                Exportar Turnos CSV
              </button>
              <button
                onClick={() => handleExportTransactions(shiftHistoryModal.terminal_id)}
                className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 flex items-center gap-1"
              >
                <Download size={16} />
                Exportar Transacciones CSV
              </button>
            </div>

            {/* Lista de turnos */}
            {shiftsLoading ? (
              <div className="text-center py-8 text-gray-500">Cargando...</div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay turnos en el rango seleccionado
              </div>
            ) : (
              <div className="space-y-2">
                {shifts.map((s, i) => (
                  <div key={s.id || i} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-medium text-sm">{s.user_name || '—'}</span>
                        <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-medium ${
                          s.status === 'closed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {s.status === 'closed' ? 'Cerrado' : 'Abierto'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{fmtDateTime(s.opened_at)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Apertura: </span>
                        <span className="font-medium">{fmtTQ(s.opening_amount || 0)} TQ</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Ventas: </span>
                        <span className="font-medium text-green-600">{fmtTQ(s.total_sales || 0)} TQ</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Trans: </span>
                        <span className="font-medium">{s.transactions_count || 0}</span>
                      </div>
                    </div>
                    {s.closed_at && (
                      <div className="text-xs text-gray-400 mt-1">
                        Cerrado: {fmtDateTime(s.closed_at)}
                        {s.closing_amount != null && ` · Cierre: ${fmtTQ(s.closing_amount)} TQ`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de renombrar */}
      {renaming && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h2 className="font-bold text-lg mb-2">Renombrar Terminal</h2>
            <p className="text-sm text-gray-500 mb-4">
                ID: <span className="font-mono">{renaming.terminal_id.slice(0, 24)}...</span>
            </p>
            <input
              type="text"
              value={renameLabel}
              onChange={(e) => setRenameLabel(e.target.value)}
              placeholder="Nombre personalizado (ej: Caja 1, Tienda Central)"
              className="input w-full mb-4"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename() }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleRename}
                disabled={!renameLabel.trim() || renameSaving}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {renameSaving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={() => { setRenaming(null); setRenameLabel('') }}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
