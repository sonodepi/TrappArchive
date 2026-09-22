import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Percorso da cui l'app viene servita.
 *
 * Su GitHub Pages il sito sta sotto /TrappArchive/, dentro l'app nativa
 * (Capacitor) sta invece alla radice. Un percorso assoluto cablato romperebbe
 * uno dei due, quindi lo decide chi costruisce:
 *   BASE_PATH=/TrappArchive/ npm run build   -> web
 *   npm run build                            -> app nativa e sviluppo
 */
const base = process.env.BASE_PATH || '/';

export default defineConfig(() => {
  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'apple-touch-icon.png',
          'icon-192.svg',
          'icon-512.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: './',
          name: 'TrappArchive',
          short_name: 'TrappArchive',
          description: 'Catalogo musicale personale, gestione tracce, album, testi e bozze collaborative.',
          theme_color: '#060b19',
          background_color: '#060b19',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: './',
          scope: './',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: 'icon-192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: 'icon-512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          // Il chunk dell'SDK Firebase non va precaricato: la sincronizzazione
          // richiede la rete per definizione, quindi precaricarlo costerebbe a
          // ogni installazione ~900 kB di codice inutilizzabile offline. Chi
          // non usa il cloud non lo scarica mai.
          globIgnores: ['**/firebase-*.js'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          // Un nome prevedibile serve a escludere questi chunk dal precache:
          // di default Rollup li chiamerebbe tutti `index.esm-<hash>.js` e non
          // sarebbero distinguibili da nient'altro.
          manualChunks(id: string) {
            if (id.includes('node_modules/@firebase') || id.includes('node_modules/firebase')) {
              return 'firebase';
            }
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    test: {
      // Le skill in .claude/ portano con se' i loro test, scritti per
      // `node:test`. Vitest li raccoglierebbe e fallirebbe con "No test suite
      // found", facendo sembrare rotta l'app quando e' rotto solo il
      // rilevamento: `npm test` guarda il codice del progetto, non gli
      // attrezzi di chi lo controlla.
      exclude: ['node_modules/**', 'dist/**', '.claude/**'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
