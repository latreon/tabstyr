import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig(({ command }) => ({
  plugins: [vue()],
  // Dev serves at root ('/') for convenience; the production build targets the
  // GitHub Pages PROJECT path (https://latreon.github.io/tabstyr/). An absolute
  // base is required for clean (non-hash) routes to resolve assets at any path.
  // import.meta.env.BASE_URL follows this, so the router works in both. If you
  // move to a custom domain at the ROOT, change the build base to '/'.
  base: command === 'serve' ? '/' : '/tabstyr/',
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
}));
