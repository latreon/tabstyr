import { defineConfig } from 'wxt';

export default defineConfig({
  outDir: 'dist',
  modules: ['@wxt-dev/module-vue'],
  // Source zip for AMO review must contain ONLY the buildable extension source —
  // no machine-generated output. Exclude the separate marketing site's bundled
  // build (landing/dist), and the heavy e2e screenshots / store assets that
  // bloat the archive without helping a reviewer reproduce the extension.
  zip: {
    excludeSources: [
      'landing/dist/**',
      'e2e/__screenshots__/**',
      'docs/store/**',
      // Playwright test artifacts (traces, screenshots) — gitignored, but wxt zip
      // doesn't consult .gitignore, so they leak into the source zip otherwise.
      'test-results/**',
    ],
  },
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
        // Optional scheduled backup export (off by default) saves a JSON file to
        // the browser's normal downloads location — no server, no upload.
        'downloads',
        // `favicon` exists only on Chromium. Firefox & Safari fall back to the
        // letter-chip in FaviconChip.vue, so requesting it there would be invalid.
        ...(chromium ? ['favicon'] : []),
      ],
      action: { default_title: 'TabStyr' },
      // Explicit, auditable CSP for extension pages. Tightens the secure MV3
      // default: no remote scripts/eval, connect-src 'none' (the extension makes
      // zero network requests), img-src limited to same-origin (the
      // chrome-extension://…/_favicon source) + data:. style-src keeps
      // 'unsafe-inline' for Vue's runtime styles.
      //
      // `default-src 'self'` is what makes this a whitelist rather than a list of
      // holes: CSP has no implicit fallback, so every directive NOT named here
      // (font-src, media-src, worker-src, child-src …) was previously unrestricted.
      // frame-src 'none' is then spelled out because no page in this extension
      // embeds a frame, and a framed remote document would sidestep connect-src.
      // Shared verbatim by the MV3 object form and the MV2 (Firefox/Safari) string
      // form so the three builds can't drift apart.
      ...(() => {
        const csp =
          "default-src 'self'; script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
        if (chromium && manifestVersion === 3) {
          return { content_security_policy: { extension_pages: csp } };
        }
        if (!chromium && manifestVersion === 2) {
          return { content_security_policy: csp };
        }
        return {};
      })(),
      // Firefox (AMO) requirements:
      // - a stable add-on id,
      // - strict_min_version 115 — the floor for `storage.session`,
      // - data_collection_permissions: required since Nov 2025 for new listings.
      //   This extension collects/transmits nothing, so the honest value is 'none'.
      ...(browser === 'firefox'
        ? {
            browser_specific_settings: {
              gecko: {
                id: 'tabstyr@latreon.github.io',
                strict_min_version: '115.0',
                // AMO only reads data_collection_permissions when it is NESTED
                // here under gecko — a top-level key is ignored and fails
                // validation as "missing". Nothing is collected, so 'none'.
                data_collection_permissions: { required: ['none'] },
              },
            },
          }
        : {}),
    };
  },
});
