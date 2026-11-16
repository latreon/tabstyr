import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: { trace: 'on-first-retry' },
  // Small font-rendering noise passes; a real layout or color change does not.
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
});
