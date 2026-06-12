import { defineConfig } from 'wxt';

export default defineConfig({
  outDir: 'dist',
  modules: ['@wxt-dev/module-vue'],
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
