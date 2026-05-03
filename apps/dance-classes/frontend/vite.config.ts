import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    svelte(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      workbox: {
        // Take over and replace the previously-cached SW immediately on
        // every deploy. Without these two, the new build sits as "waiting"
        // until every tab closes, which on a phone means basically never —
        // the old code keeps serving until you manually clear data.
        skipWaiting: true,
        clientsClaim: true,
        // Cache the API under a network-first strategy with a short timeout
        // so going offline falls back to cache; static assets cache-first.
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api', networkTimeoutSeconds: 4 }
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|woff2?)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'assets' }
          }
        ],
        // Don't try to cache video streams — they're huge and largely
        // unusable from cache anyway. Skip the API call too — workbox
        // handles those via runtimeCaching above.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /\/stream$/, /\/thumb$/, /\/healthz$/]
      },
      manifest: {
        name: "Mimi's Dance Wonderland",
        short_name: 'Mimi',
        description: 'Self-hosted dance class library',
        theme_color: '#fbcfe8',
        background_color: '#fff5f8',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/healthz': 'http://localhost:8080'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022'
  },
  // Build-time version stamp visible in the footer so we can tell at a
  // glance whether the device picked up a fresh deploy or is still serving
  // a stale SW cache.
  define: {
    __APP_BUILD__: JSON.stringify(new Date().toISOString().replace('T', ' ').slice(0, 16))
  }
});
