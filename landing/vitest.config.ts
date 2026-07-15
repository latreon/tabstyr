import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  // Same aliases as vite.config.ts (@ → src, @ext → the extension's shared
  // pure lib/) so tests resolve imports identically to the real build.
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@ext': path.resolve(__dirname, '../lib'),
    },
  },
  test: {
    environment: 'happy-dom',
  },
});
