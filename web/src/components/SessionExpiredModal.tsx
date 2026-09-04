import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api, setSessionExpiredHandler, clearSessionExpiredFlag } from '../api'
import { useAuth } from '../hooks/useAuth'
import { Lock, X } from 'lucide-react'

export function SessionExpiredProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation(['common'])
  const [showModal, setShowModal] = useState(false)
  const { login, logout } = useAuth()
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
      clearSessionExpiredFlag()
    } catch (err: any) {
      setError(err?.message || t('login.error_generic'))
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setShowModal(false)
    clearSessionExpiredFlag()
    logout()
  }

  return (
    <>
      {children}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-amber-100 p-2 rounded-lg">
                <Lock size={24} className="text-amber-600" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-gray-900">{t('login.expired_title')}</h2>
                <p className="text-sm text-gray-500">
                  {t('login.expired_desc')}
                </p>
              </div>
            </div>
            <form onSubmit={handleRelogin} className="space-y-3">
              <div>
                <label className="label text-sm">{t('common:username')}</label>
                <input
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder={t('login.expired_username_placeholder')}
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="label text-sm">{t('common:password')}</label>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.expired_password_placeholder')}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? t('login.expired_submitting') : t('login.expired_submit')}
              </button>
              <p className="text-xs text-gray-400 text-center">
                {t('login.expired_note')}
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
