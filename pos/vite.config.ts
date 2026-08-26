import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // base debe coincidir con el path del proxy inverso del nodo
  // El nodo redirige /pos-web/ -> localhost:3001/
  // Sin esto, los assets se referencian como /assets/... y el browser
  // los pide en el nodo principal (404) en vez de via el proxy
  base: '/pos-web/',
  plugins: [
    react(),
    VitePWA({
      name: 'POS Federada',
      short_name: 'POS',
      description: 'Punto de Venta Web Federado',
      theme_color: '#0f766e',
      background_color: '#0a0a0a',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/pos-web/',
      scope: '/pos-web/',
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        icons: [
          {
            src: '/pos-web/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 3001,
    host: true
  },
  build: {
    outDir: 'dist',
    target: 'es2020'
  }
})
