import React from 'react'
import { Globe, CheckCircle2, AlertCircle } from 'lucide-react'

export interface LanguageOption {
  code: string
  name?: string
  native_name?: string
  is_default?: boolean
}

export interface LanguageTabsProps {
  languages: LanguageOption[]
  selectedLang: string
  defaultLang: string
  onChange: (code: string) => void
  /**
   * Mapa de estado por código de idioma: 'translated' | 'fallback' | 'stale' | 'missing' | boolean
   */
  statusMap?: Record<string, 'translated' | 'fallback' | 'stale' | 'missing' | boolean>
  className?: string
  onCopyFrom?: (fromCode: string) => void
}

/**
 * Componente reutilizable de pestañas de idiomas para la edición multilingüe.
 * Destaca el idioma principal obligatorio y muestra badges de estado para idiomas secundarios.
 */
export const LanguageTabs: React.FC<LanguageTabsProps> = ({
  languages,
  selectedLang,
  defaultLang,
  onChange,
  statusMap = {},
  className = '',
  onCopyFrom,
}) => {
  if (!languages || languages.length <= 1) return null

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <Globe size={14} className="text-gray-500" />
          <span>Idioma del contenido</span>
        </label>
        {selectedLang !== defaultLang && (
          <span className="text-[11px] text-blue-600 font-medium">
            Traducción opcional (fallback al principal si se deja vacía)
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200">
        {languages.map((l) => {
          const isSelected = l.code === selectedLang
          const isDefault = l.code === defaultLang || l.is_default
          const status = statusMap[l.code]
          const isTranslated = status === 'translated' || status === true
          const isStale = status === 'stale'

          return (
            <button
              key={l.code}
              type="button"
              onClick={() => onChange(l.code)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <span>{l.code.toUpperCase()}</span>
              {isDefault ? (
                <span className={`text-[10px] px-1 py-0.2 rounded font-normal ${isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-gray-100 text-gray-500'}`}>
                  Principal
                </span>
              ) : isTranslated ? (
                <CheckCircle2 size={12} className={isSelected ? 'text-emerald-200' : 'text-emerald-600'} />
              ) : isStale ? (
                <AlertCircle size={12} className={isSelected ? 'text-amber-200' : 'text-amber-500'} />
              ) : null}
            </button>
          )
        })}

        {onCopyFrom && selectedLang !== defaultLang && (
          <button
            type="button"
            onClick={() => onCopyFrom(defaultLang)}
            className="ml-auto px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition"
            title="Copiar texto del idioma principal como borrador"
          >
            Copiar desde {defaultLang.toUpperCase()}
          </button>
        )}
      </div>
    </div>
  )
}
