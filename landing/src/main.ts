import { createApp } from 'vue';
import App from './App.vue';
// Self-hosted fonts — bundled and served from our own origin so first paint
// never waits on a cross-origin round-trip to fonts.googleapis.com + gstatic.
// Inter is the variable (wght) face for body; Space Grotesk supplies the three
// display weights used by headings. Browsers fetch only the unicode-range
// subsets a page actually renders.
import '@fontsource-variable/inter/wght.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
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
