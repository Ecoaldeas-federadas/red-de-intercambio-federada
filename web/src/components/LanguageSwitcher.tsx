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
  /** 'dark' para fondos oscuros (footer publico), 'light' para fondos claros (header app) */
  variant?: 'light' | 'dark'
  /** Tamano compacto (solo codigo ES/EN) o completo (nombre nativo) */
  compact?: boolean
  className?: string
}

export function LanguageSwitcher({ variant = 'light', compact = true, className = '' }: LanguageSwitcherProps) {
  const { i18n } = useTranslation('common')
  const { isAuthenticated } = useAuth()
  const [languages, setLanguages] = useState<LanguageOption[]>([])
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(getCurrentLanguage())
  const [focusIndex, setFocusIndex] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

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
        setFocusIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Enfocar la opcion seleccionada cuando se abre el dropdown
  useEffect(() => {
    if (open && languages.length > 0) {
      const idx = languages.findIndex(l => l.code === current)
      setFocusIndex(idx >= 0 ? idx : 0)
    } else {
      setFocusIndex(-1)
    }
  }, [open, languages, current])

  // Mover el foco al elemento activo
  useEffect(() => {
    if (open && focusIndex >= 0 && listRef.current) {
      const buttons = listRef.current.querySelectorAll('[role="option"]')
      const btn = buttons[focusIndex] as HTMLElement
      if (btn) btn.focus()
    }
  }, [focusIndex, open])

  const loadLanguages = async () => {
    try {
      const langs = await api.get<LanguageOption[]>('/languages')
      setLanguages((langs || []).filter(l => l.enabled))
    } catch {
      setLanguages([
        { code: 'es', name: 'Spanish', native_name: 'Espanol', enabled: true, is_default: true },
        { code: 'en', name: 'English', native_name: 'English', enabled: true, is_default: false },
      ])
    }
  }

  const handleSelect = async (code: string) => {
    setOpen(false)
    setFocusIndex(-1)
    if (code === current) return
    // Marcar cambio manual para que usePreferences no sobrescriba en esta sesion
    sessionStorage.setItem('language_manually_changed', 'true')
    await changeLanguage(code)
    setCurrent(code)
    // Si el usuario esta logueado, guardar preferencia en el backend
    if (isAuthenticated) {
      try {
        await api.put('/me/preferences', { language: code })
      } catch {
        // Silencioso: el cambio local ya se aplico
      }
    }
  }

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const handleOptionKeyDown = (e: React.KeyboardEvent, index: number) => {
    e.stopPropagation()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIndex((index + 1) % languages.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIndex((index - 1 + languages.length) % languages.length)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleSelect(languages[index].code)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      if (triggerRef.current) triggerRef.current.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      setFocusIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setFocusIndex(languages.length - 1)
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

  // En modo dark (footer), el dropdown se abre hacia arriba para no salir de la pagina
  const dropdownPosition = isDark ? 'bottom-full mb-1' : 'top-full mt-1'

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={currentLang?.native_name || `Language: ${current}`}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${textColor} ${borderColor} ${hoverColor} transition focus:outline-none focus:ring-2 focus:ring-emerald-500`}
        title={currentLang?.native_name || current}
      >
        <Languages size={14} />
        <span>{displayLabel}</span>
        <ChevronDown size={12} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          ref={listRef}
          role="listbox"
          aria-label="Select language"
          className={`absolute right-0 ${dropdownPosition} ${bgColor} rounded-lg shadow-xl border ${borderColor} z-50 min-w-[140px] overflow-hidden`}
        >
          {languages.map((lang, index) => (
            <button
              key={lang.code}
              role="option"
              aria-selected={lang.code === current}
              onClick={() => handleSelect(lang.code)}
              onKeyDown={(e) => handleOptionKeyDown(e, index)}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs transition focus:outline-none ${
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
