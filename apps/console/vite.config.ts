import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// Separate deployable, in-repo for now, extraction-ready later (DL-038):
// zero shared runtime with the Tauri POS/Head-Office apps or server/ — the
// only alias below is `@shared`, and it is scoped to TYPE-ONLY imports from
// src/types/index.ts (erased at build time, no runtime coupling), never
// components or values. No `vite-plugin-pwa` here — unlike the Executive/
// Rider PWAs, console has no offline-durability requirement and is not
// meant to be installed as an app (DL-038: "standard always-online web
// app").
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Type-only reuse of the shared domain model, per this prompt's own
      // instruction ("reuse src/types/index.ts for shared domain types
      // where applicable"). Never import a component or runtime value
      // through this alias — that would violate DL-038's zero-shared-
      // runtime-code decision and become extraction debt.
      '@shared': path.resolve(__dirname, '../../src'),
    },
  },
  server: {
    port: 3300,
    host: '0.0.0.0',
  },
});
