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
    // Explicit, auditable CSP for extension pages (Chromium MV3). Tightens the
    // already-secure MV3 default: no remote scripts, no eval, and — since the
    // extension makes zero network requests — connect-src 'none'. img-src allows
    // only same-origin (the privileged chrome-extension://…/_favicon source) plus
    // data:; style-src keeps 'unsafe-inline' for Vue's runtime style handling.
    // Firefox (MV2) keeps its default CSP — the MV3 object form would be invalid there.
    ...(browser === 'firefox'
      ? {}
      : {
          content_security_policy: {
            extension_pages:
              "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'",
          },
        }),
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: { id: 'tabstyr@example.com', strict_min_version: '115.0' },
      },
    }),
  }),
});
