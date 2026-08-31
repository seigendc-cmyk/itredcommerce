import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { defineConfig } from 'vite';

// Separate deployable from the main app and from executive-pwa (DL-002:
// independent data-access layers, no shared local server) — this PWA
// always talks to Supabase directly, never through the Express backend.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'iTred Commerce — Rider',
        short_name: 'iTred Rider',
        description: 'Delivery broadcast board and confirmation flow for riders.',
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
        // App-shell caching only, per the prompt — "standard PWA app-shell
        // caching is fine; no offline durability engineering needed." Every
        // read/write this app makes is a live Supabase call; nothing here
        // is meant to work while genuinely offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Shared type layer + selected presentational primitives, per DL-002.
      '@shared': path.resolve(__dirname, '../src'),
    },
  },
  server: {
    port: 3200,
    host: '0.0.0.0',
  },
});
