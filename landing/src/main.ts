import { createApp } from 'vue';
import App from './App.vue';
import './style.css';
import { CF_ANALYTICS_TOKEN } from './site';

createApp(App).mount('#app');

// Privacy-friendly, cookieless analytics for the MARKETING SITE ONLY — the
// extension itself ships zero tracking. The beacon loads only when a token is
// configured in site.ts, so an unconfigured site makes no third-party request.
if (CF_ANALYTICS_TOKEN) {
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_ANALYTICS_TOKEN }));
  document.head.appendChild(s);
}
