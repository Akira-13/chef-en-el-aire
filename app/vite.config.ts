import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    // PWA instalable y modo cocina sin conexión (RF-43, RF-44, RNF-10).
    VitePWA({
      disable: Boolean(process.env.VITEST),
      registerType: 'autoUpdate',
      manifest: {
        name: 'Chef en el Aire',
        short_name: 'Chef',
        description: 'Sigue recetas sin tocar la pantalla: con la voz, con gestos o con un toque.',
        lang: 'es',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#fff8f0',
        background_color: '#fff8f0',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        importScripts: ['/sw-notifications.js'],
        // Incluye el modelo y el wasm de gestos para que también funcionen sin conexión.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,wasm,task}'],
        // Android con Chrome usa la variante SIMD: las otras dos pesan 13 MB y 14 MB más.
        globIgnores: ['wasm/*nosimd*', 'wasm/*module*'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Solo se guardan las recetas: las respuestas del asistente siempre vienen del servidor.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === '/api/recipes',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'chef-recipes', cacheableResponse: { statuses: [200] } },
          },
        ],
      },
    }),
  ],
  server: {
    // Accesible desde la red local y desde el túnel HTTPS para probar en el teléfono.
    host: true,
    port: 5173,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
  },
});
