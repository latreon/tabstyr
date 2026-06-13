import '@/assets/theme.css';
import { createApp } from 'vue';
import { applyCachedTheme } from '@/lib/theme-cache';
import App from './App.vue';
import './style.css';

applyCachedTheme(); // paint the right theme before mount to avoid a flash
createApp(App).mount('#app');
