import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
      start_url: '/',
      scope: '/',
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        icons: [
          {
            src: '/icon.svg',
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
