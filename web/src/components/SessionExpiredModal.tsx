import { useState, useEffect } from 'react'
import { api, setSessionExpiredHandler } from '../api'
import { useAuth } from '../hooks/useAuth'
import { Lock, X } from 'lucide-react'

export function SessionExpiredProvider({ children }: { children: React.ReactNode }) {
  const [showModal, setShowModal] = useState(false)
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setSessionExpiredHandler(() => setShowModal(true))
    return () => setSessionExpiredHandler(null)
  }, [])

  const handleRelogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<{ token: string; username: string }>('/auth/login/password', {
        username,
        password,
      })
      login(res.token, res.username)
      setShowModal(false)
      setUsername('')
      setPassword('')
    } catch (err: any) {
      setError(err?.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {children}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-amber-100 p-2 rounded-lg">
                <Lock size={24} className="text-amber-600" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-gray-900">Sesión expirada</h2>
                <p className="text-sm text-gray-500">
                  Tu sesión se cerró por inactividad. Inicia sesión nuevamente para continuar.
                  No perderás lo que estabas haciendo.
                </p>
              </div>
            </div>
            <form onSubmit={handleRelogin} className="space-y-3">
              <div>
                <label className="label text-sm">Usuario</label>
                <input
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Tu usuario"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="label text-sm">Contraseña</label>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Iniciando sesión...' : 'Iniciar sesión y continuar'}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Al iniciar sesión, volverás a la misma página donde estabas.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
