import { defineConfig } from 'wxt';

export default defineConfig({
  outDir: 'dist',
  modules: ['@wxt-dev/module-vue'],
  manifest: ({ browser }) => ({
    name: 'Tab Time',
    description: 'Tab and browser time tracking with stale-tab nudges',
    permissions: [
      'tabs', 'storage', 'idle', 'alarms', 'notifications',
      ...(browser === 'firefox' ? [] : ['favicon']),
    ],
    action: { default_title: 'Tab Time' },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: { id: 'tab-time@example.com', strict_min_version: '115.0' },
      },
    }),
  }),
});
