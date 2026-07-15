import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  // vue() compiles .vue SFCs for component tests; WxtVitest provides the
  // browser/extension mocks used by the lib + composable tests.
  plugins: [vue(), WxtVitest()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['tests/setup.ts'],
    // landing/ is a separate npm package with its own vitest.config.ts (its
    // own aliases: @ → landing/src, @ext → the extension's shared lib/) and
    // its own `npm test` — running it from here would fail to resolve those.
    exclude: ['e2e/**', 'node_modules/**', 'landing/**'],
  },
});
