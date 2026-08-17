import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'
import { Image as ImageIcon, X, Check } from 'lucide-react'

// -------------------------------------------------------------
// INLINE EDIT CONTEXT
// -------------------------------------------------------------
interface InlineEditContextType {
  editMode: boolean
  updateField: (field: string, value: any) => void
  updateArrayItem: (arrayField: string, index: number, itemField: string, value: any) => void
  updateNested: (path: string, value: any) => void
}

const InlineEditContext = createContext<InlineEditContextType>({
  editMode: false,
  updateField: () => {},
  updateArrayItem: () => {},
  updateNested: () => {},
})

export function useInlineEdit() {
  return useContext(InlineEditContext)
}

export function InlineEditProvider({
  editMode,
  onFieldChange,
  children,
}: {
  editMode: boolean
  onFieldChange: (path: string, value: any) => void
  children: React.ReactNode
}) {
  const updateField = useCallback((field: string, value: any) => {
    onFieldChange(field, value)
  }, [onFieldChange])

  const updateArrayItem = useCallback((arrayField: string, index: number, itemField: string, value: any) => {
    onFieldChange(`${arrayField}.${index}.${itemField}`, value)
  }, [onFieldChange])

  const updateNested = useCallback((path: string, value: any) => {
    onFieldChange(path, value)
  }, [onFieldChange])

  return (
    <InlineEditContext.Provider value={{ editMode, updateField, updateArrayItem, updateNested }}>
      {children}
    </InlineEditContext.Provider>
  )
}

// -------------------------------------------------------------
// EDITABLE TEXT - contentEditable inline
// -------------------------------------------------------------
interface EdTextProps {
  field: string
  value: string
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div' | 'li'
  className?: string
  placeholder?: string
  multiline?: boolean
}

export function EdText({
  field,
  value,
  as = 'span',
  className = '',
  placeholder = 'Escribe aquí...',
  multiline = false,
}: EdTextProps) {
  const { editMode, updateField } = useInlineEdit()
  const ref = useRef<HTMLElement>(null)

  // Sync external value changes to DOM (only when not focused)
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.textContent = value || ''
    }
  }, [value])

  if (!editMode) {
    const Tag = as as any
    return <Tag className={className}>{value}</Tag>
  }

  const Tag = as as any
  return (
    <Tag
      ref={ref as any}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e: any) => {
        const newText = e.currentTarget.textContent || ''
        if (newText !== value) {
          updateField(field, newText)
        }
      }}
      onKeyDown={(e: any) => {
        if (!multiline && e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      className={`${className} outline-none cursor-text transition-all rounded-sm ${
        editMode ? 'hover:bg-yellow-100/40 focus:bg-yellow-100/60 focus:ring-2 focus:ring-amber-400 focus:ring-offset-1' : ''
      }`}
      data-placeholder={placeholder}
      title={`Clic para editar: ${field}`}
    />
  )
}

// -------------------------------------------------------------
// EDITABLE ARRAY ITEM TEXT - for items inside arrays
// -------------------------------------------------------------
interface EdArrayTextProps {
  arrayField: string
  index: number
  itemField: string
  value: string
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div' | 'li'
  className?: string
  multiline?: boolean
}

export function EdArrayText({
  arrayField,
  index,
  itemField,
  value,
  as = 'span',
  className = '',
  multiline = false,
}: EdArrayTextProps) {
  const { editMode, updateArrayItem } = useInlineEdit()
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.textContent = value || ''
    }
  }, [value])

  if (!editMode) {
    const Tag = as as any
    return <Tag className={className}>{value}</Tag>
  }

  const Tag = as as any
  return (
    <Tag
      ref={ref as any}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e: any) => {
        const newText = e.currentTarget.textContent || ''
        if (newText !== value) {
          updateArrayItem(arrayField, index, itemField, newText)
        }
      }}
      onKeyDown={(e: any) => {
        if (!multiline && e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      className={`${className} outline-none cursor-text transition-all rounded-sm hover:bg-yellow-100/40 focus:bg-yellow-100/60 focus:ring-2 focus:ring-amber-400 focus:ring-offset-1`}
      title={`Clic para editar`}
    />
  )
}

// -------------------------------------------------------------
// EDITABLE IMAGE - click to change URL
// -------------------------------------------------------------
interface EdImageProps {
  field: string
  src: string
  alt?: string
  className?: string
  style?: React.CSSProperties
}

export function EdImage({ field, src, alt = '', className = '', style }: EdImageProps) {
  const { editMode, updateField } = useInlineEdit()
  const [showEditor, setShowEditor] = useState(false)
  const [tempUrl, setTempUrl] = useState(src)

  if (!editMode) {
    return <img src={src} alt={alt} className={className} style={style} />
  }

  return (
    <div className="relative group" style={style}>
      <img
        src={src}
        alt={alt}
        className={`${className} cursor-pointer`}
        onClick={() => {
          setTempUrl(src)
          setShowEditor(true)
        }}
      />
      <div
        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center pointer-events-none"
      >
        <div className="bg-white/90 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-900 flex items-center gap-1.5">
          <ImageIcon size={14} />
          Clic para cambiar imagen
        </div>
      </div>
      {showEditor && (
        <div className="absolute inset-0 z-30 bg-white/95 flex flex-col items-center justify-center p-3 gap-2 rounded-lg">
          <div className="flex items-center gap-2 w-full max-w-xs">
            <input
              type="text"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
              placeholder="URL de la imagen..."
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-lg outline-none focus:border-emerald-500"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                updateField(field, tempUrl)
                setShowEditor(false)
              }}
              className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-1"
            >
              <Check size={12} /> Aplicar
            </button>
            <button
              onClick={() => setShowEditor(false)}
              className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-300 flex items-center gap-1"
            >
              <X size={12} /> Cancelar
            </button>
          </div>
          <div className="flex flex-wrap gap-1 max-w-xs justify-center">
            {[
              { label: 'Hortalizas', url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80' },
              { label: 'Siembra', url: 'https://images.unsplash.com/photo-1592417817098-8f3d69102a5e?auto=format&fit=crop&w=900&q=80' },
              { label: 'Cosecha', url: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=1000&q=80' },
              { label: 'Ecoaldea', url: 'https://images.unsplash.com/photo-1516253593875-bd7ba052fbc5?auto=format&fit=crop&w=1200&q=80' },
              { label: 'Mercado', url: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80' },
            ].map((pic) => (
              <button
                key={pic.label}
                onClick={() => setTempUrl(pic.url)}
                className="px-2 py-0.5 bg-gray-100 hover:bg-emerald-100 text-[10px] text-gray-700 rounded"
              >
                {pic.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// EDITABLE ARRAY ITEM IMAGE
// -------------------------------------------------------------
interface EdArrayImageProps {
  arrayField: string
  index: number
  itemField: string
  src: string
  alt?: string
  className?: string
  style?: React.CSSProperties
}

export function EdArrayImage({
  arrayField,
  index,
  itemField,
  src,
  alt = '',
  className = '',
  style,
}: EdArrayImageProps) {
  const { editMode, updateArrayItem } = useInlineEdit()
  const [showEditor, setShowEditor] = useState(false)
  const [tempUrl, setTempUrl] = useState(src)

  if (!editMode) {
    return <img src={src} alt={alt} className={className} style={style} />
  }

  return (
    <div className="relative group" style={style}>
      <img
        src={src}
        alt={alt}
        className={`${className} cursor-pointer`}
        onClick={() => {
          setTempUrl(src)
          setShowEditor(true)
        }}
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center pointer-events-none">
        <div className="bg-white/90 rounded-lg px-2 py-1 text-[10px] font-bold text-gray-900 flex items-center gap-1">
          <ImageIcon size={12} /> Cambiar
        </div>
      </div>
      {showEditor && (
        <div className="absolute inset-0 z-30 bg-white/95 flex flex-col items-center justify-center p-2 gap-1.5 rounded-lg">
          <input
            type="text"
            value={tempUrl}
            onChange={(e) => setTempUrl(e.target.value)}
            placeholder="URL..."
            className="w-full max-w-[200px] px-2 py-1 text-[11px] border border-gray-300 rounded outline-none focus:border-emerald-500"
            autoFocus
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                updateArrayItem(arrayField, index, itemField, tempUrl)
                setShowEditor(false)
              }}
              className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded hover:bg-emerald-700 flex items-center gap-0.5"
            >
              <Check size={10} /> OK
            </button>
            <button
              onClick={() => setShowEditor(false)}
              className="px-2 py-0.5 bg-gray-200 text-gray-700 text-[10px] font-bold rounded hover:bg-gray-300"
            >
              <X size={10} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
