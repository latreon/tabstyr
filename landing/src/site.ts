// Public site origin (no trailing slash) — used to build absolute social/SEO URLs.
export const SITE_URL = 'https://tabstyr.com';

// Flip a store to `true` once its public listing is live, then paste the real
// listing URL into LINKS below. While a flag is false the UI renders a
// non-clickable "coming soon" state instead of dead-ending at a store homepage.
export const STORE_LIVE: Record<'chrome' | 'edge' | 'firefox', boolean> = {
  chrome: false,
  edge: false,
  firefox: false,
};
export const ANY_STORE_LIVE = Object.values(STORE_LIVE).some(Boolean);

// Fill these in once the extension is live, then flip the matching STORE_LIVE
// flag above. Search the repo for these names to update in one place.
export const LINKS = {
  chrome: 'https://chromewebstore.google.com/', // ← replace with your CWS listing URL
  edge: 'https://microsoftedge.microsoft.com/addons', // ← replace with Edge listing
  firefox: 'https://addons.mozilla.org/firefox/', // ← replace with AMO listing
  // In-app routes (clean URLs, handled by the history router in App.vue).
  privacy: import.meta.env.BASE_URL + 'privacy',
  ideas: import.meta.env.BASE_URL + 'ideas',
  // No public repo links: the source repo is private, so bug reports and ideas
  // route through the in-app /ideas form (Formspree) instead of GitHub issues /
  // Discussions. Re-add github/issues/discussions here if the repo goes public.
  // Support / tip — Polar pay-what-you-want checkout ($5 prefilled, adjustable).
  coffee: 'https://buy.polar.sh/polar_cl_RkZPHoSH8zAQndHySXwKoDhLRykeX8BuMANlE3FoBSo?amount=500',
};

// The person behind the project — shown in the footer. Handle only by default.
export const AUTHOR = { name: 'latreon', url: 'https://github.com/latreon' };

// ── Paste your own values below ──────────────────────────────────────────────
// Formspree endpoint that receives the in-app "Share an idea" form. Create a
// form at https://formspree.io → copy its endpoint (https://formspree.io/f/XXXX).
// Until you paste a real id, the form shows a "not configured yet" notice.
export const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mvzjggkv';

// Cloudflare Web Analytics beacon token (cookieless, no PII). Create a free site
// at https://www.cloudflare.com/web-analytics/ for the deployed URL and paste the
// token. Leave '' to ship with zero analytics — the beacon only loads when set.
export const CF_ANALYTICS_TOKEN = '98d31c2e37914d69ac3870a84b965aa9';

export const STATS = [
  { value: '0', unit: 'bytes', label: 'leave your device' },
  { value: '90', unit: 'days', label: 'of history, auto-pruned' },
  { value: '11', unit: 'languages', label: 'out of the box' },
  { value: '100', unit: '%', label: 'local & open by design' },
];
