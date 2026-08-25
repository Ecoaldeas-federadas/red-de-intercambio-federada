import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api'
import {
  Settings,
  User,
  Lock,
  Server,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Shield,
  Key,
  Sparkles,
  Search,
} from 'lucide-react'

interface SetupStatus {
  initialized: boolean
  node_domain: string
  node_name: string
  admin_exists: boolean
  jwt_configured: boolean
}

export default function Setup() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [nodePublicKey, setNodePublicKey] = useState('')

  const [form, setForm] = useState({
    node_name: '',
    node_domain: '',
    admin_username: '',
    admin_display_name: '',
    admin_password: '',
    admin_password_confirm: '',
  })

  // Preconfiguraciones (presets)
  const [presets, setPresets] = useState<any[]>([])
  const [selectedPreset, setSelectedPreset] = useState('vacio')
  const [presetSearch, setPresetSearch] = useState('')
  const [presetsLoading, setPresetsLoading] = useState(false)

  useEffect(() => {
    checkStatus()
    loadPresets()
  }, [])

  const loadPresets = async () => {
    setPresetsLoading(true)
    try {
      const res = await fetch('/api/presets')
      if (res.ok) {
        const data = await res.json()
        setPresets(data.presets || [])
      }
    } catch (e) {
      // silencioso - el preset es opcional
    } finally {
      setPresetsLoading(false)
    }
  }

  const checkStatus = async () => {
    try {
      const s = await api.get<SetupStatus>('/setup/status')
      setStatus(s)
      if (s.initialized) {
        setStep(5)
      } else {
        setForm((prev) => ({
          ...prev,
          node_name: s.node_name || '',
          node_domain: s.node_domain || '',
        }))
      }
    } catch {
      setError('No se pudo conectar con el servidor')
    } finally {
      setLoadingStatus(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleNext = () => {
    setError('')
    if (step === 0) {
      if (!form.node_name.trim()) {
        setError('El nombre del nodo es obligatorio')
        return
      }
      if (!form.node_domain.trim()) {
        setError('El dominio del nodo es obligatorio')
        return
      }
      setStep(1)
    } else if (step === 1) {
      // Paso de preconfiguracion - siempre pasa (preset "vacio" es valido)
      setStep(2)
    } else if (step === 2) {
      if (!form.admin_username.trim()) {
        setError('El nombre de usuario es obligatorio')
        return
      }
      if (form.admin_username.length < 3) {
        setError('El nombre de usuario debe tener al menos 3 caracteres')
        return
      }
      setStep(3)
    } else if (step === 3) {
      if (!form.admin_password || form.admin_password.length < 8) {
        setError('La contrasena debe tener al menos 8 caracteres')
        return
      }
      if (form.admin_password !== form.admin_password_confirm) {
        setError('Las contrasenas no coinciden')
        return
      }
      setStep(4)
    }
  }

  const handleBack = () => {
    setError('')
    setStep((prev) => Math.max(0, prev - 1))
  }

  const handleInit = async () => {
    setError('')
    setSubmitting(true)
    try {
      const result = await api.post<{
        token: string
        username: string
        node: string
        message: string
        node_public_key: string
      }>('/setup/init', {
        node_name: form.node_name,
        node_domain: form.node_domain,
        admin_username: form.admin_username,
        admin_display_name: form.admin_display_name || form.admin_username,
        admin_password: form.admin_password,
      })

      // Aplicar preset seleccionado (si no es "vacio")
      if (selectedPreset && selectedPreset !== 'vacio') {
        try {
          await api.post('/setup/apply-preset', { preset_id: selectedPreset })
        } catch (e) {
          // No fallar la inicializacion si el preset falla
          console.warn('Preset application failed:', e)
        }
      }

      login(result.token, result.username)
      setSuccess('Nodo inicializado correctamente')
      setNodePublicKey(result.node_public_key || '')
      setStep(5)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al inicializar el nodo')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-trueque-50">
        <Loader2 className="animate-spin text-trueque-600" size={48} />
      </div>
    )
  }

  if (status?.initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-trueque-50">
        <div className="card max-w-md w-full text-center">
          <CheckCircle className="mx-auto text-green-600 mb-4" size={48} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Nodo ya inicializado</h1>
          <p className="text-gray-600 mb-6">
            Este nodo ya ha sido configurado. Inicia sesion para continuar.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            Ir a inicio de sesion
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    )
  }

  const steps = [
    { label: 'Nodo', icon: Server },
    { label: 'Perfil', icon: Sparkles },
    { label: 'Administrador', icon: User },
    { label: 'Seguridad', icon: Lock },
    { label: 'Revisar', icon: CheckCircle },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center bg-trueque-50 py-8 px-4">
      <div className="card max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-trueque-600 rounded-full mb-4">
            <Settings className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Configuracion Inicial del Nodo</h1>
          <p className="text-gray-600 mt-1">
            Bienvenido. Configuremos tu nodo de credito mutuo federado.
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center justify-between mb-8 px-4">
          {steps.map((s, i) => {
            const Icon = s.icon
            const isActive = i === step
            const isDone = i < step
            return (
              <div key={i} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    isDone
                      ? 'bg-green-600 border-green-600 text-white'
                      : isActive
                      ? 'bg-trueque-600 border-trueque-600 text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}
                >
                  <Icon size={20} />
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-1 ${isDone ? 'bg-green-600' : 'bg-gray-300'}`}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-4 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
            <CheckCircle size={18} />
            {success}
          </div>
        )}

        {/* Step 0: Node config */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="label flex items-center gap-2">
                <Server size={16} /> Nombre del nodo
              </label>
              <input
                type="text"
                className="input"
                value={form.node_name}
                onChange={(e) => handleChange('node_name', e.target.value)}
                placeholder="Banco Comunitario A"
              />
              <p className="text-xs text-gray-500 mt-1">Nombre visible de tu organizacion</p>
            </div>
            <div>
              <label className="label flex items-center gap-2">
                <Server size={16} /> Dominio del nodo
              </label>
              <input
                type="text"
                className="input"
                value={form.node_domain}
                onChange={(e) => handleChange('node_domain', e.target.value)}
                placeholder="tu-dominio.com o localhost"
              />
              <p className="text-xs text-gray-500 mt-1">
                Dominio unico para federacion (no se puede cambiar despues)
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Preconfiguracion (preset) */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="label flex items-center gap-2">
                <Sparkles size={16} /> Preconfiguracion del nodo
              </label>
              <p className="text-xs text-gray-500 mt-1 mb-3">
                Elige un perfil preconfigurado segun la filosofia de tu comunidad.
                Esto aplicara horarios, reglas de catalogo, textos y colores iniciales.
                Puedes elegir "Vacio" para configurar todo manualmente despues.
              </p>
            </div>

            {/* Buscador */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="input pl-9"
                placeholder="Buscar preconfiguracion..."
                value={presetSearch}
                onChange={(e) => setPresetSearch(e.target.value)}
              />
            </div>

            {presetsLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 size={16} className="animate-spin" /> Cargando preconfiguraciones...
              </div>
            )}

            {/* Lista de presets */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {presets
                .filter((p: any) => {
                  if (!presetSearch) return true
                  const q = presetSearch.toLowerCase()
                  return p.name?.toLowerCase().includes(q) ||
                    p.description?.toLowerCase().includes(q) ||
                    p.category?.toLowerCase().includes(q)
                })
                .map((p: any) => (
                  <label
                    key={p.id}
                    className={`block p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedPreset === p.id
                        ? 'border-trueque-600 bg-trueque-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="preset"
                        value={p.id}
                        checked={selectedPreset === p.id}
                        onChange={(e) => setSelectedPreset(e.target.value)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{p.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{p.category}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{p.description}</p>
                      </div>
                    </div>
                  </label>
                ))}
            </div>

            {presets.length === 0 && !presetsLoading && (
              <p className="text-xs text-gray-500">
                No se pudieron cargar las preconfiguraciones. Puedes continuar sin preconfiguracion
                y ajustar todo manualmente despues.
              </p>
            )}
          </div>
        )}

        {/* Step 2: Admin user */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="label flex items-center gap-2">
                <User size={16} /> Nombre de usuario admin
              </label>
              <input
                type="text"
                className="input"
                value={form.admin_username}
                onChange={(e) => handleChange('admin_username', e.target.value)}
                placeholder="admin"
              />
              <p className="text-xs text-gray-500 mt-1">Usuario para iniciar sesion</p>
            </div>
            <div>
              <label className="label flex items-center gap-2">
                <User size={16} /> Nombre para mostrar
              </label>
              <input
                type="text"
                className="input"
                value={form.admin_display_name}
                onChange={(e) => handleChange('admin_display_name', e.target.value)}
                placeholder="Administrador"
              />
              <p className="text-xs text-gray-500 mt-1">Opcional. Nombre visible en el sistema</p>
            </div>
          </div>
        )}

        {/* Step 3: Password */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="label flex items-center gap-2">
                <Lock size={16} /> Contrasena
              </label>
              <input
                type="password"
                className="input"
                value={form.admin_password}
                onChange={(e) => handleChange('admin_password', e.target.value)}
                placeholder="Minimo 8 caracteres"
              />
            </div>
            <div>
              <label className="label flex items-center gap-2">
                <Lock size={16} /> Confirmar contrasena
              </label>
              <input
                type="password"
                className="input"
                value={form.admin_password_confirm}
                onChange={(e) => handleChange('admin_password_confirm', e.target.value)}
                placeholder="Repite la contrasena"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <Shield size={16} className="inline mr-1" />
              Esta contrasena se usa para iniciar sesion. Tambien se generaran
              automaticamente las claves criptograficas Ed25519 del usuario.
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Resumen de configuracion</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Nodo:</span>
                <span className="font-medium">{form.node_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Dominio:</span>
                <span className="font-medium">{form.node_domain}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Preconfiguracion:</span>
                <span className="font-medium">
                  {selectedPreset === 'vacio' ? 'Vacio (manual)' : presets.find((p) => p.id === selectedPreset)?.name || selectedPreset}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Usuario admin:</span>
                <span className="font-medium">{form.admin_username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Nombre:</span>
                <span className="font-medium">
                  {form.admin_display_name || form.admin_username}
                </span>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2 text-sm text-green-800">
              <div className="flex items-center gap-2 font-medium">
                <Key size={16} /> Se generaran automaticamente:
              </div>
              <ul className="ml-6 list-disc space-y-1">
                <li>Claves Ed25519 del usuario administrador</li>
                <li>Departamento "Administracion" con rol "Administrador"</li>
                <li>Todos los permisos asignados al rol administrador</li>
                <li>Credenciales de acceso (bcrypt) para login por contrasena</li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <AlertCircle size={16} className="inline mr-1" />
              Asegurate de recordar tu contrasena. No hay forma de recuperarla
              sin el proceso de recuperacion de cuenta.
            </div>
          </div>
        )}

        {/* Step 5: Already initialized */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle className="mx-auto text-green-600 mb-4" size={48} />
              <p className="text-gray-600">Nodo inicializado correctamente!</p>
            </div>

            {nodePublicKey && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 font-medium text-blue-800">
                  <Key size={16} /> Clave publica de tu nodo
                </div>
                <p className="text-xs text-blue-700">
                  Guarda esta clave. La necesitas para federarte con otros nodos:
                  cada nodo debe registrar la clave publica del otro.
                </p>
                <code className="block text-xs bg-white p-2 rounded border border-blue-200 break-all font-mono">
                  {nodePublicKey}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(nodePublicKey); setSuccess('Clave copiada!'); setTimeout(() => setSuccess(''), 2000) }}
                  className="btn-primary text-sm py-1 px-3"
                >
                  Copiar clave
                </button>
              </div>
            )}

            <button
              onClick={() => { window.location.href = '/' }}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              Ir al dashboard
              <ArrowRight size={20} />
            </button>
          </div>
        )}

        {/* Navigation */}
        {step < 5 && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={handleBack}
              disabled={step === 0}
              className="px-4 py-2 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:text-gray-900"
            >
              Atras
            </button>

            {step < 4 ? (
              <button
                onClick={handleNext}
                className="btn-primary flex items-center gap-2"
              >
                Siguiente
                <ArrowRight size={20} />
              </button>
            ) : (
              <button
                onClick={handleInit}
                disabled={submitting}
                className="btn-primary flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Inicializando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Inicializar nodo
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
