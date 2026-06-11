import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'Tab Time',
    description: 'Tab and browser time tracking with stale-tab nudges',
    permissions: ['tabs', 'storage', 'idle', 'alarms', 'notifications'],
    action: { default_title: 'Tab Time' },
  },
});
