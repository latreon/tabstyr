# Browser support & packaging

TabStyr is built with WXT and the cross-browser `browser.*` (webextension-polyfill)
namespace, so one codebase targets every engine. What differs is **packaging and a
few engine APIs** — summarized here.

| Browser | Build | Install | Favicons | Notes |
|---|---|---|---|---|
| Chrome | `npm run build` → `dist/chrome-mv3` | Load unpacked / Chrome Web Store | Real (`_favicon`) | Reference target |
| Edge | `dist/chrome-mv3` | Load unpacked / Edge Add-ons | Real | Chromium |
| Opera | `dist/chrome-mv3` | Opera Add-ons, or "Install Chrome Extensions" helper | Real | Chromium |
| Arc / Brave / Vivaldi | `dist/chrome-mv3` | Chrome Web Store | Real | Chromium |
| Firefox | `npm run build:firefox` → `dist/firefox-mv2` | `about:debugging` (temp) / AMO | Letter chips | MV2; needs FF 115+ |
| Safari | `npm run build:safari` → `dist/safari-mv2` | Xcode conversion (below) | Letter chips | macOS/iOS app + App Store |

## Engine-API differences (handled in code)

- **`_favicon`** — Chromium only. Firefox/Safari fall back to colored letter chips
  (`lib/favicon.ts` returns `null` → `FaviconChip.vue` renders the chip). The
  `favicon` permission is requested only on Chromium (`wxt.config.ts`).
- **`storage.session`** — MV3-era (Chrome 102+, Firefox 115+, Safari 16.4+). Accessed
  through a guarded `sessionStore` wrapper in `entrypoints/background.ts`; where it's
  absent, the engine simply rebuilds its state from `tabs.query()` on the next cold
  start. No crash, slight loss of in-flight state across worker restarts.
- **`tabs.onReplaced`** — Chromium-centric; its listener is registered with optional
  chaining so it no-ops where unavailable. Only affects the tab-id→key remap.
- **`idle`, `notifications`, `runtime.onSuspend`** — all optional-chained; the
  features degrade silently if an engine lacks them.
- **CSP** — the explicit `content_security_policy` object is emitted for Chromium MV3
  only. Firefox (MV2) and Safari keep their platform defaults.

## Firefox (AMO)

`npm run build:firefox` emits a valid MV2 manifest with:

- `browser_specific_settings.gecko.id` = `tabstyr@latreon.github.io` (change if you
  fork),
- `strict_min_version` = `115.0` (floor for `storage.session`),
- `data_collection_permissions: { required: ["none"] }` — required for new AMO
  listings since Nov 2025; honest here because the extension transmits nothing.

Dev: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick
`dist/firefox-mv2/manifest.json`. Publish: `npm run zip:firefox` and upload to AMO.

## Safari (requires macOS + Xcode)

Safari does **not** load a web-extension folder directly. Convert the Chromium build
into an Xcode project, then build/sign it like any Mac/iOS app:

```sh
npm run build            # produces dist/chrome-mv3 (or: npm run build:safari)
xcrun safari-web-extension-converter dist/chrome-mv3 \
  --app-name "TabStyr" \
  --bundle-identifier io.github.latreon.tabstyr \
  --macos-only          # drop this flag to also generate an iOS target
```

This generates an Xcode project. Then:

1. Open it in Xcode, set your Apple Developer signing team.
2. Build & run — Safari → Settings → Extensions → enable **TabStyr**
   (enable "Allow unsigned extensions" in Safari's Develop menu for local testing).
3. Distribute through the **App Store** (Safari web extensions ship as apps).

Runtime needs **Safari 16.4+** for `storage.session`; on older Safari the extension
still runs but doesn't persist engine state across restarts (rebuilt via reconcile).
Favicons render as letter chips (no `_favicon` API). `--macos-only` is recommended
unless you specifically want the iOS/iPadOS target.
