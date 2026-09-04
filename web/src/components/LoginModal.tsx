import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useConfig } from '../hooks/useConfig'
import { api } from '../api'
import {
  Fingerprint, AlertCircle, Lock, Crown, Users, UserCircle, Sparkles, X, ArrowLeft,
} from 'lucide-react'

function bufToBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let str = ''
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBuf(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (b64.length % 4)) % 4
  const padded = b64 + '='.repeat(padLen)
  const binStr = atob(padded)
  const bytes = new Uint8Array(binStr.length)
  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i)
  return bytes.buffer
}

interface LoginModalProps {
  open: boolean
  onClose: () => void
}

export function LoginModal({ open, onClose }: LoginModalProps) {
  const { t } = useTranslation(['common'])
  const { login } = useAuth()
  const { currency } = useConfig()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'password' | 'passkey'>('password')
  const [expiredMsg, setExpiredMsg] = useState(false)
  const [nodeDomain, setNodeDomain] = useState('localhost')
  const [isDemoNode, setIsDemoNode] = useState(false)
  const [demoUsers, setDemoUsers] = useState<any[]>([])
  const [demoLoading, setDemoLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setError('')
    api.get('/setup/status').then((s: any) => {
      if (s?.node_domain) setNodeDomain(s.node_domain)
    }).catch(() => {
      const cached = localStorage.getItem('node_config')
      if (cached) {
        try {
          const cfg = JSON.parse(cached)
          if (cfg?.node_domain) setNodeDomain(cfg.node_domain)
        } catch {}
      }
    })
    api.get('/demo/status').then((s: any) => {
      if (s?.is_demo_node) {
        setIsDemoNode(true)
        api.get('/demo/users').then((users: any) => {
          if (Array.isArray(users)) setDemoUsers(users)
        }).catch(() => {})
      }
    }).catch(() => {})
  }, [open])

  if (!open) return null

  const getFullUsername = () => {
    const trimmed = username.trim()
    if (!trimmed) return ''
    if (trimmed.includes('@')) return trimmed
    return `${trimmed}@${nodeDomain}`
  }

  const handlePasswordLogin = async () => {
    setError('')
    const fullUsername = getFullUsername()
    if (!fullUsername || !password) {
      setError(t('login.error_enter_credentials'))
      return
    }
    setLoading(true)
    try {
      const result = await api.post<{ token: string; username: string }>('/auth/login/password', {
        username: fullUsername,
        password,
      })
      login(result.token, result.username)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.error_generic'))
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async (uname: string, _displayName: string) => {
    setError('')
    setDemoLoading(true)
    try {
      const result = await api.post<{ token: string; username: string }>('/demo/login', {
        username: uname,
        password: 'demo1234',
      })
      login(result.token, result.username)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.error_demo'))
    } finally {
      setDemoLoading(false)
    }
  }

  const handlePasskeyLogin = async () => {
    setError('')
    const fullUsername = getFullUsername()
    if (!fullUsername) {
      setError(t('login.error_enter_username'))
      return
    }
    if (!window.PublicKeyCredential) {
      setError(t('login.error_no_passkey_support'))
      return
    }
    setLoading(true)
    try {
      const beginRes: any = await api.post('/auth/login/begin', { username: fullUsername })
      const options = beginRes.options
      const publicKey: PublicKeyCredentialRequestOptions = {
        challenge: base64UrlToBuf(options.challenge),
        rpId: options.rpId,
        timeout: options.timeout || 60000,
        userVerification: options.userVerification || 'preferred',
        allowCredentials: (options.allowCredentials || []).map((c: any) => ({
          type: c.type,
          id: base64UrlToBuf(c.id),
        })),
      }
      const credential = await navigator.credentials.get({ publicKey }) as PublicKeyCredential
      if (!credential) throw new Error(t('login.error_auth_failed'))
      const response = credential.response as AuthenticatorAssertionResponse
      const result = await api.post<{ token: string; username: string }>('/auth/login/finish', {
        session_key: beginRes.session_key,
        username: fullUsername,
        response: {
          id: credential.id,
          rawId: bufToBase64Url(credential.rawId),
          type: credential.type,
          response: {
            authenticatorData: bufToBase64Url(response.authenticatorData),
            clientDataJSON: bufToBase64Url(response.clientDataJSON),
            signature: bufToBase64Url(response.signature),
            userHandle: response.userHandle ? bufToBase64Url(response.userHandle) : undefined,
          },
        },
      })
      login(result.token, result.username)
      window.location.reload()
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError(t('login.error_auth_cancelled'))
      } else {
        setError(err instanceof Error ? err.message : t('login.error_generic'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="card max-w-md w-full max-h-[90vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl z-10"
          aria-label={t('common:close')}
        >
          <X size={22} />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-trueque-600 rounded-full mb-4">
            <Fingerprint className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Trueque</h1>
          <p className="text-gray-600 mt-1">{t('app.tagline')}</p>
          {isDemoNode && (
            <div className="mt-2 inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-medium">
              <Sparkles size={12} /> {t('login.demo_mode_badge')}
            </div>
          )}
        </div>

        {expiredMsg && !error && (
          <div className="mb-4 flex items-center gap-2 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
            <AlertCircle size={18} />
            {t('login.session_expired')}
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {isDemoNode ? (
          <div className="space-y-4">
            <div className="text-center text-sm text-gray-600 mb-4">
              {t('login.demo_enter_any_role')}
              {t('login.demo_password')}: <code className="bg-gray-100 px-1 rounded">demo1234</code>
            </div>
            {demoUsers.length === 0 && (
              <div className="text-center text-sm text-gray-400 py-4">{t('login.demo_loading')}</div>
            )}
            {demoUsers.filter(u => u.is_super_admin).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                  <Crown size={12} /> {t('login.role_super_admin')}
                </div>
                {demoUsers.filter(u => u.is_super_admin).map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleDemoLogin(u.username, u.display_name)}
                    disabled={demoLoading}
                    className="w-full flex items-center gap-3 p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition text-left"
                  >
                    <Crown className="text-amber-600 flex-shrink-0" size={20} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-800">{u.display_name}</div>
                      <div className="text-xs text-gray-500">@{u.username}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {demoUsers.filter(u => !u.is_super_admin && u.account_type === 'individual' && u.role === 'Directivo').length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                  <Users size={12} /> {t('login.role_board')}
                </div>
                {demoUsers.filter(u => !u.is_super_admin && u.account_type === 'individual' && u.role === 'Directivo').map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleDemoLogin(u.username, u.display_name)}
                    disabled={demoLoading}
                    className="w-full flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition text-left"
                  >
                    <Users className="text-blue-600 flex-shrink-0" size={20} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-800">{u.display_name}</div>
                      <div className="text-xs text-gray-500">@{u.username}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {demoUsers.filter(u => !u.is_super_admin && u.account_type === 'individual' && u.role !== 'Directivo').length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                  <UserCircle size={12} /> {t('login.role_members')}
                </div>
                {demoUsers.filter(u => !u.is_super_admin && u.account_type === 'individual' && u.role !== 'Directivo').map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleDemoLogin(u.username, u.display_name)}
                    disabled={demoLoading}
                    className="w-full flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition text-left"
                  >
                    <UserCircle className="text-green-600 flex-shrink-0" size={20} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-800">{u.display_name}</div>
                      <div className="text-xs text-gray-500">@{u.username} - {u.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {demoLoading && (
              <div className="text-center text-sm text-gray-500 py-2">{t('login.logging_in')}</div>
            )}
            <div className="text-center text-xs text-gray-400 pt-2 border-t">
              {t('login.demo_reset_note')}
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setMode('password')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'password' ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Lock size={16} className="inline mr-1" />
                {t('login.password_login')}
              </button>
              <button
                onClick={() => setMode('passkey')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'passkey' ? 'bg-trueque-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Fingerprint size={16} className="inline mr-1" />
                {t('login.passkey_login')}
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">{t('login.username_label')}</label>
                <div className="flex items-center input p-0">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 rounded-l-lg bg-transparent outline-none"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    placeholder="admin"
                    onKeyDown={(e) => e.key === 'Enter' && (mode === 'password' ? handlePasswordLogin() : handlePasskeyLogin())}
                  />
                  <span className="px-3 py-2 text-gray-500 text-sm border-l border-gray-200 bg-gray-50 rounded-r-lg">
                    {username.includes('@') ? '' : `@${nodeDomain}`}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {t('login.username_hint', { domain: nodeDomain })}
                </p>
              </div>

              {mode === 'password' && (
                <div>
                  <label className="label">{t('login.password_label')}</label>
                  <input
                    type="password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('login.password_placeholder')}
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
                  {loading ? t('login.connecting') : t('login.login_button')}
                </button>
              ) : (
                <button
                  onClick={handlePasskeyLogin}
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Fingerprint size={20} />
                  {loading ? t('login.connecting') : t('login.passkey_button')}
                </button>
              )}

              <div className="text-center text-sm text-gray-500">
                {t('login.no_account')}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
