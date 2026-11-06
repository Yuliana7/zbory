import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { APP_URL, buildReminderIcs, reminderFile, reminderTimes } from './src/utils/reminder'
import insights from './src/i18n/locales/uk/insights.json'

// The app is deployed under this subpath — the manifest's start_url/scope/icon
// paths must be prefixed with it explicitly, since vite-plugin-pwa does not
// auto-derive them from `base` (only the manifest link + precached asset URLs
// get that treatment). A root-absolute path here 404s once actually deployed.
const BASE = '/zbory/'

// iPhones only offer «Add to Calendar» for a calendar file at a real https address (a data: link is
// blocked outright and the share sheet just files it away), and the site has no server to make one,
// so one file per selectable time is built ahead of time.
function reminderFiles(): Plugin {
  const icsFor = (time: string) =>
    buildReminderIcs({ time, title: insights.reminder.event, details: insights.reminder.details, url: APP_URL, now: new Date(2026, 0, 1) })
  return {
    name: 'reminder-files',
    generateBundle() {
      for (const time of reminderTimes()) this.emitFile({ type: 'asset', fileName: reminderFile(time), source: icsFor(time) })
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const time = reminderTimes().find((t) => req.url?.endsWith(reminderFile(t)))
        if (!time) return next()
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
        res.end(icsFor(time))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    reminderFiles(),
    VitePWA({
      registerType: 'prompt',
      devOptions: {
        enabled: true,
        navigateFallback: 'index.html',
        // In dev the plugin generates a stub service worker into dev-dist/ and then
        // globs that same folder for files to precache; it only holds the generated
        // worker files (which are excluded), so workbox warned that the pattern
        // "doesn't match any files". This adds an empty placeholder so it does.
        // Dev-only — the production build is unaffected.
        suppressWarnings: true
      },
      includeAssets: ['icon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Zbory - Аналітика Збору Коштів',
        short_name: 'Zbory',
        description: 'Інструмент для аналізу та візуалізації статистики благодійних зборів',
        theme_color: '#4F46E5',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: BASE,
        start_url: `${BASE}?source=pwa`,
        icons: [
          {
            src: `${BASE}icon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: `${BASE}pwa-192x192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: `${BASE}pwa-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: `${BASE}pwa-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        categories: ['productivity']
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: `${BASE}index.html`,
        // a link to a reminder must reach the file, not the app shell
        navigateFallbackDenylist: [/\/reminders\//],
        runtimeCaching: [
          // Google Fonts - cache first
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Google Fonts CDN - cache first
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        skipWaiting: false,
        clientsClaim: true
      }
    })
  ],
})