import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves a project repo under /<repo>/. Set BASE_PATH=/gittok/ for that; a custom domain or any other host keeps /.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  define: { __COMMIT__: JSON.stringify((process.env.GITHUB_SHA ?? 'dev').slice(0, 7)) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'GitTok',
        short_name: 'GitTok',
        id: base,
        start_url: base,
        scope: base,
        display: 'standalone',
        theme_color: '#000000',
        background_color: '#000000',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell is precached by default. Avatars are the only runtime cache; never API responses.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/avatars\.githubusercontent\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'avatars',
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
