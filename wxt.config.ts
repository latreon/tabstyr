import { defineConfig } from 'wxt';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  outDir: 'dist',
  modules: ['@wxt-dev/module-vue'],
  hooks: {
    // Also emit the dashboard as a directory index (dashboard/index.html) so it can
    // be opened at chrome-extension://<id>/dashboard/ — a clean path with no ".html"
    // in the address bar. Asset URLs in the HTML are absolute, so they resolve from
    // any path. The flat dashboard.html stays too (harmless fallback).
    'build:done'(wxt) {
      const src = resolve(wxt.config.outDir, 'dashboard.html');
      if (!existsSync(src)) return;
      const dir = resolve(wxt.config.outDir, 'dashboard');
      mkdirSync(dir, { recursive: true });
      copyFileSync(src, resolve(dir, 'index.html'));
    },
  },
  manifest: ({ browser }) => ({
    name: 'TabStyr',
    description: 'Private browsing-time insights — active time per site, trends, heatmaps, focus, and stale-tab nudges. All local.',
    permissions: [
      'tabs', 'storage', 'idle', 'alarms', 'notifications',
      ...(browser === 'firefox' ? [] : ['favicon']),
    ],
    action: { default_title: 'TabStyr' },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: { id: 'tabstyr@example.com', strict_min_version: '115.0' },
      },
    }),
  }),
});
