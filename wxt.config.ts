import { defineConfig } from 'wxt';

export default defineConfig({
  outDir: 'dist',
  modules: ['@wxt-dev/module-vue'],
  // data_collection_permissions is declared in the manifest below (value 'none'),
  // so the generic reminder is already satisfied.
  suppressWarnings: { firefoxDataCollection: true },
  manifest: ({ browser, manifestVersion }) => {
    // Chromium family (Chrome, Edge, Opera, Arc, Brave) — the only engines with
    // the privileged `_favicon` API and that take the MV3 CSP object form.
    const chromium = browser !== 'firefox' && browser !== 'safari';
    return {
      name: 'TabStyr',
      description: 'Private browsing-time insights — active time per site, trends, heatmaps, focus, and stale-tab nudges. All local.',
      permissions: [
        'tabs', 'storage', 'idle', 'alarms', 'notifications',
        // webNavigation detects in-page (SPA) route changes — pushState/replaceState
        // navigations that don't reload the page — so time on, e.g., successive
        // YouTube videos is attributed to the page actually viewed. Local-only: we
        // read the URL of the focused tab's top frame, never page content.
        'webNavigation',
        // `favicon` exists only on Chromium. Firefox & Safari fall back to the
        // letter-chip in FaviconChip.vue, so requesting it there would be invalid.
        ...(chromium ? ['favicon'] : []),
      ],
      action: { default_title: 'TabStyr' },
      // Explicit, auditable CSP for extension pages — Chromium MV3 only. Tightens
      // the secure MV3 default: no remote scripts/eval, connect-src 'none' (the
      // extension makes zero network requests), img-src limited to same-origin
      // (the chrome-extension://…/_favicon source) + data:. style-src keeps
      // 'unsafe-inline' for Vue's runtime styles. MV2 (Firefox) and Safari keep
      // their own defaults — the MV3 object form is invalid there.
      ...(chromium && manifestVersion === 3
        ? {
            content_security_policy: {
              extension_pages:
                "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'",
            },
          }
        : {}),
      // Firefox (AMO) requirements:
      // - a stable add-on id,
      // - strict_min_version 115 — the floor for `storage.session`,
      // - data_collection_permissions: required since Nov 2025 for new listings.
      //   This extension collects/transmits nothing, so the honest value is 'none'.
      ...(browser === 'firefox'
        ? {
            browser_specific_settings: {
              gecko: { id: 'tabstyr@latreon.github.io', strict_min_version: '115.0' },
            },
            data_collection_permissions: { required: ['none'] },
          }
        : {}),
    };
  },
});
