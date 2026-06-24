import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig(() => ({
  plugins: [vue()],
  // Served at the ROOT of the custom domain (https://tabstyr.com/). Root base so
  // clean (non-hash) routes and assets resolve at '/'. import.meta.env.BASE_URL
  // follows this, so the history router works in dev and prod alike.
  // (If you ever revert to a GitHub Pages PROJECT path, set base to '/tabstyr/'.)
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // The Browsing Wrapped tool reuses the extension's PURE, unit-tested logic
      // (lib/wrapped*, categories, domain, heatmap, …) as the single source of
      // truth — no fork. Only pure modules are imported via @ext (nothing that
      // pulls in wxt/browser or IndexedDB), so the landing build stays standalone.
      '@ext': path.resolve(__dirname, '../lib'),
    },
  },
  server: {
    // Let the dev server read the sibling extension `lib/` (outside the landing
    // root) so `@ext/*` imports resolve during `vite dev`.
    fs: { allow: [path.resolve(__dirname, '..')] },
  },
}));
