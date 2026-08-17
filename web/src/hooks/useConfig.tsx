import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { api } from '../api'

interface NodeConfig {
  node_name: string
  currency_name: string
  app_name: string
  node_domain: string
}

const ConfigContext = createContext<NodeConfig>({
  node_name: '',
  currency_name: 'TQ',
  app_name: 'Red de Intercambio',
  node_domain: 'localhost',
})

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<NodeConfig>({
    node_name: '',
    currency_name: 'TQ',
    app_name: 'Red de Intercambio',
    node_domain: 'localhost',
  })

  useEffect(() => {
    api.get('/config').then((c: any) => {
      if (c && c.currency_name) {
        setConfig(c)
        localStorage.setItem('node_config', JSON.stringify(c))
      }
    }).catch(() => {
      // Fallback a cache local
      const cached = localStorage.getItem('node_config')
      if (cached) {
        try { setConfig(JSON.parse(cached)) } catch {}
      }
    })
  }, [])

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
}

export function useConfig() {
  const ctx = useContext(ConfigContext)
  return {
    ...ctx,
    currency: ctx.currency_name || 'TQ',
    appName: ctx.app_name || 'Red de Intercambio',
  }
}
