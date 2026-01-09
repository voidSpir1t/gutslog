import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/gutslog/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-512.png', 'icon-192.png'],
      manifest: {
        name: 'GutsLog - Liquid Glass Fitness',
        short_name: 'GutsLog',
        description: 'Offline-first fitness tracker with liquid glass aesthetics',
        theme_color: '#0ea5e9',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/gutslog/',
        scope: '/gutslog/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
