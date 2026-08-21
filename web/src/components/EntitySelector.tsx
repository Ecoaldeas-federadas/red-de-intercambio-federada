import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { api } from '../api'

interface EntitySelectorProps {
  label: string
  helpText?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  endpoint: string  // ej: '/organizations' o '/member-levels'
  valueKey: string  // ej: 'id' o 'username' o 'name'
  labelKey: string  // ej: 'username' o 'name'
  subLabelKey?: string  // ej: 'display_name' o 'description'
  filterFn?: (item: any) => boolean
  emptyMessage?: string
}

export function EntitySelector({
  label, helpText, placeholder, value, onChange,
  endpoint, valueKey, labelKey, subLabelKey, filterFn, emptyMessage
}: EntitySelectorProps) {
  const [items, setItems] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [showList, setShowList] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    api.get(endpoint)
      .then(data => {
        const arr = Array.isArray(data) ? data : (data?.items ?? data?.organizations ?? data?.users ?? data?.products ?? [])
        setItems(filterFn ? arr.filter(filterFn) : arr)
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [endpoint])

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowList(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = items.filter(item => {
    if (!search) return true
    const mainLabel = String(item[labelKey] || '').toLowerCase()
    const subLabel = subLabelKey ? String(item[subLabelKey] || '').toLowerCase() : ''
    return mainLabel.includes(search.toLowerCase()) || subLabel.includes(search.toLowerCase())
  })

  const select = (item: any) => {
    onChange(item[valueKey])
    setSelectedItem(item)
    setShowList(false)
    setSearch('')
  }

  const clear = () => {
    onChange('')
    setSelectedItem(null)
  }

  return (
    <div ref={ref} className="relative">
      <label className="label">{label}</label>
      {selectedItem ? (
        <div className="flex items-center justify-between input bg-gray-50">
          <div>
            <b className="text-sm">{selectedItem[labelKey]}</b>
            {subLabelKey && selectedItem[subLabelKey] && (
              <p className="text-xs text-gray-500">{selectedItem[subLabelKey]}</p>
            )}
          </div>
          <button type="button" onClick={clear} className="text-gray-400 hover:text-red-500">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder={placeholder || 'Buscar...'}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowList(true) }}
            onFocus={() => setShowList(true)}
          />
          {showList && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {loading ? (
                <div className="p-3 text-sm text-gray-400">Cargando...</div>
              ) : filtered.length === 0 ? (
                <div className="p-3 text-sm text-gray-400">{emptyMessage || 'No se encontraron resultados'}</div>
              ) : (
                filtered.map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => select(item)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <div className="text-sm font-medium">{item[labelKey]}</div>
                    {subLabelKey && item[subLabelKey] && (
                      <div className="text-xs text-gray-500">{item[subLabelKey]}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
      {helpText && <p className="text-xs text-gray-400 mt-1">{helpText}</p>}
    </div>
  )
}
