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
    alias: { '@': path.resolve(__dirname, './src') },
  },
}));
