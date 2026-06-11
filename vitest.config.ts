import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  plugins: [WxtVitest()],
  test: { environment: 'happy-dom', exclude: ['e2e/**', 'node_modules/**'] },
});
