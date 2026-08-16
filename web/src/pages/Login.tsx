import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api'
import { Fingerprint, AlertCircle, Lock, User } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'password' | 'passkey'>('password')

  const handlePasswordLogin = async () => {
    setError('')
    if (!username || !password) {
      setError('Ingresa usuario y contrasena')
      return
    }
    setLoading(true)
    try {
      const result = await api.post<{ token: string; username: string }>('/auth/login/password', {
        username,
        password,
      })
      login(result.token, result.username)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesion')
    } finally {
      setLoading(false)
    }
  }

  const handlePasskeyLogin = async () => {
    setError('')
    if (!username) {
      setError('Ingresa tu nombre de usuario')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/login/begin', { username })
      const result = await api.post<{ token: string; username: string }>('/auth/login/finish', {
        session_key: 'temp',
        username,
        response: {},
      })
      login(result.token, result.username)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-trueque-50">
      <div className="card max-w-md w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-trueque-600 rounded-full mb-4">
            <Fingerprint className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Trueque</h1>
          <p className="text-gray-600 mt-1">Credito Mutuo Federado</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* Mode tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('password')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              mode === 'password'
                ? 'bg-trueque-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Lock size={16} className="inline mr-1" />
            Contrasena
          </button>
          <button
            onClick={() => setMode('passkey')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              mode === 'passkey'
                ? 'bg-trueque-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Fingerprint size={16} className="inline mr-1" />
            Passkey
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Nombre de usuario</label>
            <input
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@usuario@nodo.org"
              onKeyDown={(e) => e.key === 'Enter' && (mode === 'password' ? handlePasswordLogin() : handlePasskeyLogin())}
            />
          </div>

          {mode === 'password' && (
            <div>
              <label className="label">Contrasena</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contrasena"
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordLogin()}
              />
            </div>
          )}

          {mode === 'password' ? (
            <button
              onClick={handlePasswordLogin}
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Lock size={20} />
              {loading ? 'Conectando...' : 'Iniciar sesion'}
            </button>
          ) : (
            <button
              onClick={handlePasskeyLogin}
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Fingerprint size={20} />
              {loading ? 'Conectando...' : 'Iniciar sesion con Passkey'}
            </button>
          )}

          <div className="text-center text-sm text-gray-500">
            ¿No tienes cuenta? Solicita admision en tu nodo.
          </div>
        </div>
      </div>
    </div>
  )
}
