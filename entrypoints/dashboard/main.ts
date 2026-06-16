import '@/assets/theme.css';
import { createApp } from 'vue';
import { i18n } from '@/lib/i18n';
import { applyCachedTheme } from '@/lib/theme-cache';
import App from './App.vue';
import './style.css';

applyCachedTheme(); // paint the right theme before mount to avoid a flash
createApp(App).use(i18n).mount('#app');
