import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { defineConfig } from 'vite';

// Separate deployable from the main app (DL-002: "independent data-access
// layers... no shared local server between desks" — the same isolation
// principle applies here: this PWA never proxies through the main app's
// Express server, it talks to Supabase directly).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'iTred Commerce — Executive',
        short_name: 'iTred Exec',
        description: 'Cross-branch financial and operational dashboard for executives.',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App-shell caching (static JS/CSS/HTML) so the app *opens* offline —
        // this PWA still has no offline write/transact capability (DL-002:
        // read-only/Supabase-only). Per-page data itself is never cached by
        // the service worker; each page instead keeps its own last-successful
        // rollup result in localStorage (src/lib/offlineCache.ts) and falls
        // back to it on a failed live fetch, so a dropped connection shows
        // stale-but-present figures rather than a blank screen.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Shared type layer + selected presentational primitives, per DL-002
      // ("share src/types/index.ts and as much of the existing UI
      // component library as practical") — same cross-tree relative-import
      // convention server/ already uses for ../../src/types.
      '@shared': path.resolve(__dirname, '../src'),
    },
  },
  server: {
    port: 3100,
    host: '0.0.0.0',
  },
});
