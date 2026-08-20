import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ConfigProvider } from './hooks/useConfig'
import './index.css'

// El servidor puede inyectar window.__BASE_PATH__ para servir el frontend
// bajo un prefijo de ruta (ej: /demo para el nodo demo).
// Esto separa completamente el service worker y las rutas del demo del nodo principal.
declare global {
  interface Window { __BASE_PATH__?: string }
}
const basePath = window.__BASE_PATH__ || ''

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basePath}>
      <ConfigProvider>
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

// Registrar el Service Worker (necesario para Web Push notifications)
// Se registra bajo el basePath para que el scope sea el correcto
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swPath = basePath + '/sw.js'
    navigator.serviceWorker.register(swPath).then((reg) => {
      console.log('Service Worker registrado:', reg.scope)
    }).catch((err) => {
      console.warn('Error registrando Service Worker:', err)
    })
  })
}
