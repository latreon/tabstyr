# Release QA Checklist

Automated Chromium end-to-end coverage runs via `npm run e2e` (8 tests: popup,
dashboard tiles, analytics tiles, export buttons, theme toggle, live tracking,
tab focus, screenshots). Run it on every release.

The items below must be checked **manually in each target browser**, because
extension loading + the platform APIs can't be fully automated cross-browser.

## Per-browser smoke (Chrome, Edge, Brave, Opera, Firefox)

Load the build (`dist/chrome-mv3`, or `dist/firefox-mv2` for Firefox), then:

- [ ] Browse a normal site for ~30s → it appears in **Open tabs by time** and **Top sites**.
- [ ] Switch away / lock the screen → time stops accruing (idle).
- [ ] Play background audio in another tab (audio counting on) → shows as `♪` separately; headline stays ≤ wall-clock.
- [ ] **Popup** opens: today's active total, top sites, stale count.
- [ ] **Dashboard** opens: every tile renders (hero, focus, category, top sites, trend, heatmap, work-log, tab table, settings).
- [ ] Click a top-site → per-domain detail modal opens; Esc closes.
- [ ] Change a site's category → category/focus update.
- [ ] **Stale tabs**: badge shows the count; reminder fires at most once/day.
- [ ] **Tab manager**: click the **Open tabs** and **Stale tabs** tiles → centered modal lists tabs alphabetically with favicon, domain, and last-active time; Esc / backdrop closes.
- [ ] In the manager: **Jump to tab** focuses it; **Close** removes one; **Close all** clears the list; each shows an **Undo** toast that reopens the tab(s) in their original window.
- [ ] Popup **stale count button** opens the dashboard with the stale-tab manager already open.
- [ ] **Settings** persist across reopen; **Export** downloads JSON; **Wipe** clears everything.
- [ ] Theme: system / dark / light all look correct; favicons (incl. monochrome like GitHub) are visible in both themes.
- [ ] Reload the extension → data persists; no `VersionError` in the console.

## Firefox-specific

- [ ] Requires Firefox **115+** (uses `storage.session`).
- [ ] Site icons fall back to colored letter chips (no `_favicon` API) — expected.
- [ ] Toolbar button (`browserAction`) and badge work.

## Safari (only if packaging for Safari)

Conversion verified: `xcrun safari-web-extension-converter dist/chrome-mv3` succeeds.
Safari ignores `idle`, `notifications`, and `favicon` — the code degrades safely
(no idle-pause, no stale notification, letter-chip icons). Then:

- [ ] Open the generated Xcode project; build & run.
- [ ] Core tracking + dashboard + export work; no console errors at background startup.
- [ ] Confirm `storage.session` (Safari 16.4+) and MV3 service-worker behave.
- [ ] Test on a real build before submission.
- [ ] App Store Connect metadata has the 1024×1024 icon (`docs/store/safari/icon-1024.png`)
      and at least one screenshot (`docs/store/screenshots/safari/{1280x800,2560x1600}/`).

## Store submission

- [ ] Screenshots regenerated (`npm run e2e` writes them to `e2e/__screenshots__/`;
      copy the `dashboard-{light,dark}.png` full-page captures into
      `docs/store/screenshots/` before running the slicer scripts below).
- [ ] Chrome screenshots sliced (`node scripts/make-store-shots.mjs` → `docs/store/screenshots/chrome/`, 1280×800).
- [ ] Firefox AMO + Safari/App Store Connect screenshots sliced
      (`node scripts/make-store-shots-other.mjs` → `docs/store/screenshots/firefox/`
      at 1280×800, and `docs/store/screenshots/safari/{1280x800,2560x1600}/`).
      AMO doesn't enforce a strict size; App Store Connect accepts either Safari size directly.
- [ ] Safari/App Store Connect 1024×1024 opaque marketing icon current
      (`node scripts/make-icons.mjs` → `docs/store/safari/icon-1024.png` — regenerate
      whenever `assets/icon.svg` changes).
- [ ] Promo images generated (`node scripts/make-promo.mjs`).
- [ ] Listing copy from `docs/store/listing.md`.
- [ ] Privacy policy (`docs/store/privacy-policy.md`) hosted and linked.
- [ ] Version bumped in `package.json` / manifest.
