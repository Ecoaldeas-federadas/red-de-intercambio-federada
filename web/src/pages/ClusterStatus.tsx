import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { Database, AlertTriangle, CheckCircle, Plus, RefreshCw, Server, Activity } from 'lucide-react'
import { fmtDateTime, fmtNumber } from '../lib/format'

interface ClusterStatus {
  min_nodes: number
  current_nodes: number
  configured_nodes: number
  nodes_needed: number
  tablets_used: number
  tablet_limit_total: number
  tablet_limit_per_node: number
  tablet_usage_pct: number
  alert_threshold: number
  needs_more_nodes: boolean
  alert_level: 'ok' | 'warning' | 'critical'
  alert_message: string
  node_details: Array<{
    host: string
    configured: boolean
    reachable: boolean
    is_local: boolean
  }>
  last_checked: string
}

export default function ClusterStatus() {
  const { t } = useTranslation('common')
  const [status, setStatus] = useState<ClusterStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)

  const loadStatus = async () => {
    try {
      const res = await api.get('/cluster/status')
      setStatus(res as ClusterStatus)
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || t('cluster.error_load', 'Error al cargar estado del cluster') })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadStatus() }, [])

  const checkCluster = async () => {
    setChecking(true)
    setMsg(null)
    try {
      const res = await api.post('/cluster/check', {})
      setStatus(res as ClusterStatus)
      if ((res as ClusterStatus).needs_more_nodes) {
        setMsg({ type: 'error', text: (res as ClusterStatus).alert_message })
      } else {
        setMsg({ type: 'success', text: t('cluster.healthy', 'Cluster en buen estado. No necesita mas nodos.') })
      }
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || t('cluster.error_check', 'Error al verificar cluster') })
    } finally {
      setChecking(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><RefreshCw className="animate-spin text-gray-400" /></div>
  }

  if (!status) {
    return <div className="card p-4 text-center text-gray-500">{t('cluster.load_error', 'No se pudo cargar el estado del cluster.')}</div>
  }

  const alertColors = {
    ok: 'border-green-300 bg-green-50 text-green-700',
    warning: 'border-amber-300 bg-amber-50 text-amber-700',
    critical: 'border-red-300 bg-red-50 text-red-700',
  }

  const alertIcons = {
    ok: <CheckCircle size={20} className="text-green-600" />,
    warning: <AlertTriangle size={20} className="text-amber-600" />,
    critical: <AlertTriangle size={20} className="text-red-600" />,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Database size={24} /> Cluster YugabyteDB
        </h2>
        <button
          onClick={checkCluster}
          disabled={checking}
          className="px-3 py-1.5 bg-trueque-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {checking ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {t('cluster.check_now', 'Verificar ahora')}
        </button>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'error' ? 'bg-red-50 text-red-700' : msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Estado general */}
      <div className={`card p-4 border-2 ${alertColors[status.alert_level]}`}>
        <div className="flex items-start gap-3">
          {alertIcons[status.alert_level]}
          <div className="flex-1">
            <h3 className="font-semibold">
              {status.alert_level === 'ok' && t('cluster.status_ok', 'Cluster en buen estado')}
              {status.alert_level === 'warning' && t('cluster.status_warning', 'Cluster necesita atencion')}
              {status.alert_level === 'critical' && t('cluster.status_critical', 'Cluster necesita nodos urgentemente')}
            </h3>
            {status.alert_message && <p className="text-sm mt-1">{status.alert_message}</p>}
            <p className="text-xs mt-2 opacity-75">
              {t('cluster.last_check', 'Ultima verificacion')}: {fmtDateTime(status.last_checked)}
            </p>
          </div>
        </div>
      </div>

      {/* Metricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <Server size={20} className="mx-auto mb-1 text-blue-600" />
          <div className="text-2xl font-bold">{status.current_nodes}</div>
          <div className="text-xs text-gray-500">{t('cluster.active_nodes', 'Nodos activos')}</div>
          <div className="text-xs text-gray-400">{t('cluster.min', 'Min')}: {status.min_nodes}</div>
        </div>
        <div className="card p-3 text-center">
          <Database size={20} className="mx-auto mb-1 text-purple-600" />
          <div className="text-2xl font-bold">{status.tablets_used}</div>
          <div className="text-xs text-gray-500">{t('cluster.tablets_used', 'Tabletas usadas')}</div>
          <div className="text-xs text-gray-400">{t('cluster.of', 'de')} {status.tablet_limit_total}</div>
        </div>
        <div className="card p-3 text-center">
          <Activity size={20} className="mx-auto mb-1 text-amber-600" />
          <div className="text-2xl font-bold">{fmtNumber(status.tablet_usage_pct, 1)}%</div>
          <div className="text-xs text-gray-500">{t('cluster.tablet_usage', 'Uso de tabletas')}</div>
          <div className="text-xs text-gray-400">{t('cluster.alert', 'Alerta')}: {status.alert_threshold}%</div>
        </div>
        <div className={`card p-3 text-center ${status.nodes_needed > 0 ? 'border-red-300 bg-red-50' : ''}`}>
          <Plus size={20} className="mx-auto mb-1 text-red-600" />
          <div className="text-2xl font-bold">{status.nodes_needed}</div>
          <div className="text-xs text-gray-500">{t('cluster.nodes_needed', 'Nodos necesarios')}</div>
          <div className="text-xs text-gray-400">{status.nodes_needed > 0 ? t('cluster.add_soon', 'Agregar pronto') : t('cluster.not_needed', 'No necesita')}</div>
        </div>
      </div>

      {/* Barra de progreso de tabletas */}
      <div className="card p-4">
        <h3 className="font-semibold mb-3">{t('cluster.capacity', 'Capacidad del cluster')}</h3>
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full transition-all ${
              status.tablet_usage_pct >= 90 ? 'bg-red-600' :
              status.tablet_usage_pct >= status.alert_threshold ? 'bg-amber-500' :
              'bg-green-500'
            }`}
            style={{ width: `${Math.min(status.tablet_usage_pct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{status.tablets_used} {t('cluster.tablets', 'tabletas')}</span>
          <span>{status.tablet_limit_total} {t('cluster.total', 'total')} ({status.tablet_limit_per_node} {t('cluster.per_node', 'por nodo')})</span>
        </div>
        {status.tablet_usage_pct >= status.alert_threshold && (
          <div className="mt-3 p-3 bg-amber-50 rounded-lg text-sm text-amber-700">
            <strong>{t('cluster.attention', 'Atencion')}:</strong> {t('cluster.usage_warning', 'El cluster esta usando')} {fmtNumber(status.tablet_usage_pct, 1)}% {t('cluster.usage_warning2', 'de su capacidad.')}
            {t('cluster.usage_warning3', 'Cuando llegue al 100%, no podra crear mas tablas ni indices.')}
            {status.nodes_needed > 0 && ` Agrega ${status.nodes_needed} nodo(s) para aumentar la capacidad.`}
          </div>
        )}
      </div>

      {/* Nodos del cluster */}
      <div className="card p-4">
        <h3 className="font-semibold mb-3">{t('cluster.configured_nodes', 'Nodos configurados')} ({status.configured_nodes})</h3>
        <div className="space-y-2">
          {status.node_details.map((n, i) => (
            <div key={i} className={`p-3 rounded-lg border ${n.is_local ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server size={16} className={n.is_local ? 'text-green-600' : 'text-gray-400'} />
                  <span className="font-mono text-sm">{n.host}</span>
                  {n.is_local && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t('cluster.this_node', 'Este nodo')}</span>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${n.reachable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {n.reachable ? t('cluster.reachable', 'Alcanzable') : t('cluster.unreachable', 'No alcanzable')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Como agregar un nodo */}
      {status.needs_more_nodes && (
        <div className="card p-4 border-2 border-blue-300 bg-blue-50">
          <h3 className="font-semibold flex items-center gap-2 mb-3 text-blue-700">
            <Plus size={18} /> {t('cluster.how_to_add', 'Como agregar un nodo')}
          </h3>
          <div className="space-y-3 text-sm text-blue-700">
            <div>
              <strong>Opcion A: Mismo servidor (desarrollo)</strong>
              <p className="text-xs mt-1">
                Agrega un nuevo servicio en docker-compose.yml copiando yugabytedb2,
                cambiando el hostname, puertos y volumenes.
              </p>
            </div>
            <div>
              <strong>Opcion B: Servidor separado (produccion)</strong>
              <p className="text-xs mt-1">
                Instala YugabyteDB en otro servidor y unelo con --join=IP_DEL_NODO1.
                Cada servidor agrega ~534 tabletas al limite.
              </p>
            </div>
            <div className="bg-white p-3 rounded-lg text-xs text-gray-600">
              <strong>Ejemplo docker-compose:</strong>
              <pre className="mt-1 font-mono text-xs overflow-x-auto">{`yugabytedb3:
  image: yugabytedb/yugabyte:latest
  hostname: yugabytedb3
  command: ["bin/yugabyted", "start",
    "--base_dir=/mnt/master",
    "--background=false",
    "--advertise_address=yugabytedb3",
    "--join=yugabytedb"]
  ports:
    - "5435:5433"
    - "7002:7000"
    - "9002:9000"
  volumes:
    - yb_data3:/mnt/master
    - yb_tserver3:/mnt/tserver`}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
