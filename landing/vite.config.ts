import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  // Relative base so it works on GitHub Pages project paths, Vercel, Netlify, etc.
  base: './',
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
