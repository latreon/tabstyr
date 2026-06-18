import '@/assets/theme.css';
import { createApp } from 'vue';
import { i18n, bootstrapLocale } from '@/lib/i18n';
import { applyCachedTheme } from '@/lib/theme-cache';
import App from './App.vue';
import './style.css';

applyCachedTheme(); // paint the right theme before mount to avoid a flash
// Load the active locale's messages before mounting (no English flash for
// non-English users). English is the default, so this resolves instantly for them.
bootstrapLocale().finally(() => createApp(App).use(i18n).mount('#app'));
