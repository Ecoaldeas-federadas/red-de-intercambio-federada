import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Image as ImageIcon, X, Check, Plus, Trash2, Upload, Link2 } from 'lucide-react'
import { api } from '../../api'

// -------------------------------------------------------------
// INLINE EDIT CONTEXT
// -------------------------------------------------------------
interface InlineEditContextType {
  editMode: boolean
  updateField: (field: string, value: any) => void
  updateArrayItem: (arrayField: string, index: number, itemField: string, value: any) => void
  updateNested: (path: string, value: any) => void
  addArrayItem: (arrayField: string, template: any) => void
  removeArrayItem: (arrayField: string, index: number) => void
}

const InlineEditContext = createContext<InlineEditContextType>({
  editMode: false,
  updateField: () => {},
  updateArrayItem: () => {},
  updateNested: () => {},
  addArrayItem: () => {},
  removeArrayItem: () => {},
})

export function useInlineEdit() {
  return useContext(InlineEditContext)
}

export function InlineEditProvider({
  editMode,
  onFieldChange,
  onArrayChange,
  children,
}: {
  editMode: boolean
  onFieldChange: (path: string, value: any) => void
  onArrayChange?: (action: 'add' | 'remove', arrayField: string, index?: number, item?: any) => void
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

  const addArrayItem = useCallback((arrayField: string, template: any) => {
    if (onArrayChange) onArrayChange('add', arrayField, undefined, template)
  }, [onArrayChange])

  const removeArrayItem = useCallback((arrayField: string, index: number) => {
    if (onArrayChange) onArrayChange('remove', arrayField, index)
  }, [onArrayChange])

  return (
    <InlineEditContext.Provider value={{ editMode, updateField, updateArrayItem, updateNested, addArrayItem, removeArrayItem }}>
      {children}
    </InlineEditContext.Provider>
  )
}

// -------------------------------------------------------------
// EDITABLE LINK - blocks navigation in edit mode
// -------------------------------------------------------------
export function EdLink({
  to,
  className = '',
  children,
  onClick,
  ...rest
}: {
  to: string
  className?: string
  children: React.ReactNode
  onClick?: (e: any) => void
  [key: string]: any
}) {
  const { editMode } = useInlineEdit()

  if (editMode) {
    // In edit mode: render as a span that looks like a link but doesn't navigate
    return (
      <span
        className={`${className} cursor-default pointer-events-none`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        {...rest}
      >
        {children}
      </span>
    )
  }

  return (
    <Link to={to} className={className} onClick={onClick} {...rest}>
      {children}
    </Link>
  )
}

// -------------------------------------------------------------
// EDITABLE TEXT - contentEditable inline
// -------------------------------------------------------------
interface EdTextProps {
  field: string
  value: string
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div' | 'li' | 'b' | 'a'
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
// EDITABLE ARRAY ITEM TEXT
// -------------------------------------------------------------
interface EdArrayTextProps {
  arrayField: string
  index: number
  itemField: string
  value: string
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div' | 'li' | 'b'
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
// EDITABLE BUTTON - edit text inline, no navigation in edit mode
// -------------------------------------------------------------
interface EdButtonProps {
  textField: string
  textValue: string
  linkField?: string
  linkValue?: string
  className?: string
  icon?: React.ReactNode
  defaultLink?: string
}

export function EdButton({
  textField,
  textValue,
  linkField,
  linkValue,
  className = '',
  icon,
  defaultLink = '/p/unirse',
}: EdButtonProps) {
  const { editMode, updateField } = useInlineEdit()
  const ref = useRef<HTMLSpanElement>(null)
  const [showLinkEditor, setShowLinkEditor] = useState(false)
  const [tempLink, setTempLink] = useState(linkValue || '')

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.textContent = textValue || ''
    }
  }, [textValue])

  if (!editMode) {
    return (
      <span className={className}>
        {textValue}
        {icon}
      </span>
    )
  }

  return (
    <span className="relative inline-block group/btn">
      <span
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => {
          const newText = e.currentTarget.textContent || ''
          if (newText !== textValue) updateField(textField, newText)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
        className={`${className} outline-none cursor-text hover:bg-yellow-100/40 focus:bg-yellow-100/60 focus:ring-2 focus:ring-amber-400 rounded-sm`}
        title="Clic para editar texto del botón"
      />
      {linkField && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setTempLink(linkValue || '')
            setShowLinkEditor(!showLinkEditor)
          }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover/btn:opacity-100 transition shadow-lg"
          title="Editar enlace del botón"
        >
          <Link2 size={11} />
        </button>
      )}
      {showLinkEditor && linkField && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-2 flex items-center gap-1.5 min-w-[220px]">
          <input
            type="text"
            value={tempLink}
            onChange={(e) => setTempLink(e.target.value)}
            placeholder="/p/..."
            className="flex-1 px-2 py-1 text-[11px] border border-gray-300 rounded outline-none focus:border-emerald-500"
            autoFocus
          />
          <button
            onClick={() => {
              updateField(linkField, tempLink || defaultLink)
              setShowLinkEditor(false)
            }}
            className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded hover:bg-emerald-700"
          >
            <Check size={11} />
          </button>
          <button
            onClick={() => setShowLinkEditor(false)}
            className="px-1.5 py-1 bg-gray-200 text-gray-700 text-[10px] font-bold rounded hover:bg-gray-300"
          >
            <X size={11} />
          </button>
        </div>
      )}
    </span>
  )
}

// -------------------------------------------------------------
// ADD / REMOVE ITEM CONTROLS - for arrays
// -------------------------------------------------------------
export function EdAddItem({
  arrayField,
  template,
  label = '+ Añadir',
  className = '',
}: {
  arrayField: string
  template: any
  label?: string
  className?: string
}) {
  const { editMode, addArrayItem } = useInlineEdit()
  if (!editMode) return null
  return (
    <button
      onClick={() => addArrayItem(arrayField, template)}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold hover:bg-emerald-200 transition border border-emerald-300 ${className}`}
    >
      <Plus size={12} />
      {label}
    </button>
  )
}

export function EdRemoveItem({
  arrayField,
  index,
  className = '',
}: {
  arrayField: string
  index: number
  className?: string
}) {
  const { editMode, removeArrayItem } = useInlineEdit()
  if (!editMode) return null
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        removeArrayItem(arrayField, index)
      }}
      className={`inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow ${className}`}
      title="Eliminar este item"
    >
      <Trash2 size={11} />
    </button>
  )
}

// -------------------------------------------------------------
// IMAGE UPLOAD HELPER
// -------------------------------------------------------------
async function uploadImage(file: File): Promise<string | null> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    const token = localStorage.getItem('fmc_token')
    const res = await fetch('/api/uploads/image', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.url || data.path || null
  } catch {
    return null
  }
}

// -------------------------------------------------------------
// IMAGE EDITOR MODAL - URL + Upload + Presets
// -------------------------------------------------------------
function ImageEditorModal({
  initialUrl,
  onApply,
  onCancel,
  compact = false,
}: {
  initialUrl: string
  onApply: (url: string) => void
  onCancel: () => void
  compact?: boolean
}) {
  const [tempUrl, setTempUrl] = useState(initialUrl)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const presets = [
    { label: 'Hortalizas', url: '/placeholder.svg' },
    { label: 'Siembra', url: '/placeholder.svg' },
    { label: 'Cosecha', url: '/placeholder.svg' },
    { label: 'Ecoaldea', url: '/placeholder.svg' },
    { label: 'Mercado', url: '/placeholder.svg' },
    { label: 'Semillas', url: '/placeholder.svg' },
  ]

  const handleUpload = async (file: File) => {
    setUploading(true)
    setUploadError('')
    const url = await uploadImage(file)
    setUploading(false)
    if (url) {
      setTempUrl(url)
    } else {
      setUploadError('No se pudo subir. Verifica que el servidor tenga el endpoint /api/uploads/image')
    }
  }

  return (
    <div className={`bg-white/95 flex flex-col items-center justify-center p-3 gap-2 rounded-lg overflow-y-auto max-h-[90%] ${compact ? '' : 'z-30 absolute inset-0'}`}>
      {/* Close button - always visible */}
      <div className="w-full flex justify-end">
        <button
          onClick={onCancel}
          className="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-gray-600 flex-shrink-0"
          title="Cerrar sin cambiar"
        >
          <X size={14} />
        </button>
      </div>

      {/* Upload area - centered */}
      <div
        onClick={() => fileRef.current?.click()}
        className="w-full max-w-xs border-2 border-dashed border-emerald-400 rounded-xl p-3 text-center cursor-pointer hover:bg-emerald-50 transition"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleUpload(f)
          }}
        />
        {uploading ? (
          <p className="text-xs text-emerald-700 font-bold">Subiendo...</p>
        ) : (
          <>
            <Upload size={20} className="mx-auto text-emerald-600 mb-1" />
            <p className="text-[11px] text-gray-600 font-semibold">Subir imagen desde tu PC</p>
          </>
        )}
      </div>
      {uploadError && <p className="text-[10px] text-red-500">{uploadError}</p>}

      {/* URL input */}
      <div className="flex items-center gap-1.5 w-full max-w-xs">
        <input
          type="text"
          value={tempUrl}
          onChange={(e) => setTempUrl(e.target.value)}
          placeholder="O pega una URL..."
          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-lg outline-none focus:border-emerald-500"
        />
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1 max-w-xs justify-center">
        {presets.map((pic) => (
          <button
            key={pic.label}
            onClick={() => setTempUrl(pic.url)}
            className="px-2 py-0.5 bg-gray-100 hover:bg-emerald-100 text-[10px] text-gray-700 rounded"
          >
            {pic.label}
          </button>
        ))}
      </div>

      {/* Preview */}
      {tempUrl && (
        <img src={tempUrl} alt="" className="max-h-20 rounded-lg object-cover" />
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onApply(tempUrl)}
          className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-1"
        >
          <Check size={12} /> Aplicar
        </button>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// EDITABLE IMAGE
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

  if (!editMode) {
    return <img src={src} alt={alt} className={className} style={style} onError={(e) => { const t = e.currentTarget; t.onerror = null; if (!t.src.startsWith('data:image/svg+xml')) { t.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MDAgMzAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YwZjlmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgZmlsbD0iIzljYTNhZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlNpbiBpbWFnZW48L3RleHQ+PC9zdmc+'; t.className = (t.className || '') + ' object-contain'; } }} />
  }

  return (
    <div className="relative group" style={style}>
      <img
        src={src}
        alt={alt}
        className={`${className} cursor-pointer`}
        onClick={() => setShowEditor(true)}
        onError={(e) => { const t = e.currentTarget; t.onerror = null; if (!t.src.startsWith('data:image/svg+xml')) { t.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MDAgMzAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YwZjlmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgZmlsbD0iIzljYTNhZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlNpbiBpbWFnZW48L3RleHQ+PC9zdmc+'; } }}
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center pointer-events-none">
        <div className="bg-white/90 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-900 flex items-center gap-1.5">
          <ImageIcon size={14} />
          Clic para cambiar imagen
        </div>
      </div>
      {showEditor && (
        <div className="absolute inset-0 z-30">
          <ImageEditorModal
            initialUrl={src}
            onApply={(url) => {
              updateField(field, url)
              setShowEditor(false)
            }}
            onCancel={() => setShowEditor(false)}
          />
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

  if (!editMode) {
    return <img src={src} alt={alt} className={className} style={style} onError={(e) => { const t = e.currentTarget; t.onerror = null; if (!t.src.startsWith('data:image/svg+xml')) { t.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MDAgMzAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YwZjlmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgZmlsbD0iIzljYTNhZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlNpbiBpbWFnZW48L3RleHQ+PC9zdmc+'; t.className = (t.className || '') + ' object-contain'; } }} />
  }

  return (
    <div className="relative group" style={style}>
      <img
        src={src}
        alt={alt}
        className={`${className} cursor-pointer`}
        onClick={() => setShowEditor(true)}
        onError={(e) => { const t = e.currentTarget; t.onerror = null; if (!t.src.startsWith('data:image/svg+xml')) { t.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MDAgMzAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YwZjlmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgZmlsbD0iIzljYTNhZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlNpbiBpbWFnZW48L3RleHQ+PC9zdmc+'; } }}
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center pointer-events-none">
        <div className="bg-white/90 rounded-lg px-2 py-1 text-[10px] font-bold text-gray-900 flex items-center gap-1">
          <ImageIcon size={12} /> Cambiar
        </div>
      </div>
      {showEditor && (
        <div className="absolute inset-0 z-30">
          <ImageEditorModal
            initialUrl={src}
            compact
            onApply={(url) => {
              updateArrayItem(arrayField, index, itemField, url)
              setShowEditor(false)
            }}
            onCancel={() => setShowEditor(false)}
          />
        </div>
      )}
    </div>
  )
}
