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
    coverage: {
      provider: 'v8',
      // text = local terminal summary, html = browsable local report,
      // lcov = the machine-readable file Codecov uploads in CI.
      reporter: ['text', 'html', 'lcov'],
      // Only the code that actually ships in the extension. Config, tests, the
      // separate landing package, generated output and the build scripts would
      // otherwise dilute the number into meaninglessness.
      include: ['lib/**', 'composables/**', 'components/**', 'entrypoints/**'],
      exclude: ['**/*.d.ts'],
    },
  },
});
