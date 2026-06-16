import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  // vue() compiles .vue SFCs for component tests; WxtVitest provides the
  // browser/extension mocks used by the lib + composable tests.
  plugins: [vue(), WxtVitest()],
  test: { environment: 'happy-dom', exclude: ['e2e/**', 'node_modules/**'] },
});
