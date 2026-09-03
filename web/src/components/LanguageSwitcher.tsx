import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { changeLanguage, getCurrentLanguage } from '../i18n/TranslationProvider'
import { api } from '../api'
import { useAuth } from '../hooks/useAuth'
import { Languages, Check, ChevronDown } from 'lucide-react'

interface LanguageOption {
  code: string
  name: string
  native_name: string
  enabled: boolean
  is_default: boolean
}

interface LanguageSwitcherProps {
  /** 'dark' para fondos oscuros (footer público), 'light' para fondos claros (header app) */
  variant?: 'light' | 'dark'
  /** Tamaño compacto (solo código ES/EN) o completo (nombre nativo) */
  compact?: boolean
  className?: string
}

export function LanguageSwitcher({ variant = 'light', compact = true, className = '' }: LanguageSwitcherProps) {
  const { i18n } = useTranslation('common')
  const { isAuthenticated } = useAuth()
  const [languages, setLanguages] = useState<LanguageOption[]>([])
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(getCurrentLanguage())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadLanguages()
  }, [])

  useEffect(() => {
    const handler = (lng: string) => setCurrent(lng)
    i18n.on('languageChanged', handler)
    return () => { i18n.off('languageChanged', handler) }
  }, [i18n])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadLanguages = async () => {
    try {
      const langs = await api.get<LanguageOption[]>('/languages')
      setLanguages((langs || []).filter(l => l.enabled))
    } catch {
      setLanguages([
        { code: 'es', name: 'Spanish', native_name: 'Español', enabled: true, is_default: true },
        { code: 'en', name: 'English', native_name: 'English', enabled: true, is_default: false },
      ])
    }
  }

  const handleSelect = async (code: string) => {
    setOpen(false)
    if (code === current) return
    await changeLanguage(code)
    setCurrent(code)
    // Si el usuario está logueado, guardar preferencia en el backend
    if (isAuthenticated) {
      try {
        await api.put('/me/preferences', { language: code })
      } catch {
        // Silencioso: el cambio local ya se aplicó
      }
    }
  }

  const isDark = variant === 'dark'
  const textColor = isDark ? 'text-white' : 'text-gray-600'
  const hoverColor = isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'
  const borderColor = isDark ? 'border-white/20' : 'border-gray-200'
  const bgColor = isDark ? 'bg-white/10' : 'bg-white'

  const currentLang = languages.find(l => l.code === current)
  const displayLabel = compact ? (current.toUpperCase()) : (currentLang?.native_name || current)

  if (languages.length <= 1) return null

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${textColor} ${borderColor} ${hoverColor} transition`}
        title={currentLang?.native_name || current}
      >
        <Languages size={14} />
        <span>{displayLabel}</span>
        <ChevronDown size={12} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute right-0 top-full mt-1 ${bgColor} rounded-lg shadow-xl border ${borderColor} z-50 min-w-[140px] overflow-hidden`}>
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs transition ${
                lang.code === current
                  ? (isDark ? 'bg-white/20' : 'bg-trueque-50 text-trueque-700')
                  : (isDark ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50')
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-[10px] opacity-60">{lang.code.toUpperCase()}</span>
                {lang.native_name}
              </span>
              {lang.code === current && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
