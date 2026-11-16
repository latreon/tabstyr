# Test coverage matrix

The checklist for the test work. Update it in the same PR as any test you add.

Legend: ✅ covered · ◐ partly covered · ❌ not covered · n/a does not apply

Last updated: Phase 2 (Chromium e2e), 2026-11-16, version 2.2.0.

## Baseline

| Suite | Result |
|---|---|
| Vitest (happy-dom, WxtVitest, fakeBrowser) | 72 files, 912 tests, all pass |
| Playwright e2e (Chromium, built `dist/chrome-mv3`) | 84 tests: 82 pass, 2 skipped (blocked worker-stop tests). The update test needs `E2E_OLD_EXTENSION` and skips without it. The old local-only `extension.spec.ts` screenshot capture visits real sites and can exceed 30 s. |
| Firefox e2e | none |

Coverage (v8, `lib/ composables/ components/ entrypoints/`):

| Folder | Lines (Phase 0 → now) | Branches (Phase 0 → now) |
|---|---|---|
| lib | 96.9% → 96.9% | 92.2% → 92.8% |
| lib/tracker | 99.4% → 99.4% | 93.2% → 93.2% |
| lib/db | 93.2% → 96.2% | 75.5% → 91.8% |
| lib/i18n | 84.8% → 84.8% | 78.3% → 78.3% |
| composables | 87.9% → 89.1% | 63.1% → 69.2% |
| components | 73.6% → 85.6% | 70.8% → 79.1% |
| components/ui | 80.5% → 82.0% | 71.6% → 71.6% |
| entrypoints/popup | 82.1% → 82.1% | 70.0% → 70.0% |
| entrypoints (background.ts) | 62.0% → 90.0% | 53.9% → 82.3% |
| entrypoints/dashboard | 0% → 50.0% | 0% → 51.0% |
| **Total** | **82.2% → 89.8%** | **75.2% → 82.9%** |

Thresholds in `vitest.config.ts`: lines 89, statements 88, functions 84, branches 82.

Files still under 80% branch coverage: `components/ui/ColorPicker.vue` (45), `components/TrendChart.vue` (50), `lib/favicon.ts` (50, Chromium-only `_favicon` paths), `entrypoints/dashboard/App.vue` (51, tab close/undo and deep links), `components/DomainDetail.vue` (55), `components/WorkLog.vue` (58), `composables/useStats.ts` (63, tab actions and broadcast paths), `components/HeatmapTile.vue` (65), `lib/chart-scale.ts` (67), `entrypoints/popup/App.vue` (70), `components/ComparisonTile.vue` (70), `components/FocusTrend.vue` (72), `components/HeroTile.vue` (74), `lib/support.ts` (75, build-time constant), `components/ui/DatePicker.vue` (76), `lib/i18n/notify.ts` (76, fallback branches), `components/SettingsPanel.vue` (78), `lib/i18n/index.ts` (80, browser language fallbacks). Most of the remaining branches are chart edge cases (empty, one point, scale steps) and keyboard paths.

## What the extension has (and does not have)

- Entrypoints: `background.ts`, `popup`, `dashboard` (settings live inside the dashboard).
- No content scripts. Tracking runs in the background from `tabs`, `windows`, `idle` and `webNavigation` events.
- No options page, no context menus, no keyboard shortcuts (`commands`), no host permissions.
- Chromium build: MV3 service worker. Firefox build: MV2 with `background.scripts` and no `persistent: false`, which makes it a persistent background page, not an event page.
- Firefox add-on ID is already fixed: `tabstyr@latreon.github.io`.
- 11 locales, none right-to-left: en, de, es, fr, it, ja, ko, pt-BR, ru, tr, zh-CN.

## Tracking on local fixture sites (E2E Chromium)

All `*.test` hosts resolve to a local server (`--host-resolver-rules`), so no test touches the network.

| Page type | Status |
|---|---|
| Static page, time saved when the tab closes | ✅ |
| Switching tabs splits time | ✅ |
| SPA: pushState routes and Back | ✅ |
| Route change inside an iframe ignored | ✅ |
| Slow-loading page (1.5 s) | ✅ |
| Page with `Content-Security-Policy: default-src 'none'` | ✅ |
| Excluded site never tracked | ✅ |
| Paused tracking records nothing | ✅ |
| Content scripts | n/a (the extension has none) |

## Background events

| Behaviour | Unit | E2E Chromium | E2E Firefox |
|---|---|---|---|
| `runtime.onInstalled` install: opens dashboard, records install date | ✅ | ✅ | ❌ |
| `runtime.onInstalled` update: no new tab | ✅ | n/a (`--load-extension` reports `install` on every launch) | ❌ |
| `runtime.setUninstallURL` | ✅ | ❌ | ❌ |
| `runtime.onStartup`: re-match tab meta to live tabs by URL | ✅ | ❌ | ❌ |
| `runtime.onSuspend`: flush open session | ✅ | ❌ | ❌ |
| Worker restart: engine state restored from `storage.session` | ✅ | ❌ blocked (see notes) | ❌ |
| `tabs.onActivated` | ✅ | ✅ | ❌ |
| `tabs.onUpdated` (URL, title, private window) | ✅ | ✅ (slow page) | ❌ |
| `tabs.onRemoved` | ✅ | ✅ | ❌ |
| `tabs.onReplaced` | ✅ | ❌ | ❌ |
| `windows.onFocusChanged` (blur on leaving the browser) | ✅ | ◐ (focus only) | ❌ |
| `idle.onStateChanged` (idle, locked, active) | ✅ | ❌ | ❌ |
| `webNavigation.onHistoryStateUpdated` (pushState/replaceState, iframes, duplicates, rapid changes, unfocused tab) | ✅ | ✅ (pushState, iframe) | ❌ |
| `webNavigation.onReferenceFragmentUpdated` (hash routes) | ✅ | ❌ | ❌ |
| popstate / back-forward in an SPA (same event as pushState) | ◐ | ✅ | ❌ |
| `notifications.onClicked` opens `#focus` or `#stale` | ✅ | ❌ | ❌ |
| One-time `keyMigrationV2` backfill | ✅ | ❌ | ❌ |
| IndexedDB upgrades v1, v2, v3 to v4 with data | ✅ | ❌ | ❌ |
| Storage full: warning flag, daily notification, retry without data loss | ✅ | ❌ | ❌ |
| Badge text and throttle | ◐ (throttle only) | ❌ | ❌ |

## Messages (`runtime.onMessage`)

| Message | Unit | E2E Chromium | E2E Firefox |
|---|---|---|---|
| `wipe-data` from own extension | ✅ | ✅ | ❌ |
| `wipe-data` from another sender ignored | ✅ | n/a | n/a |
| `settings-changed`: reload settings, pause/resume, idle interval | ✅ | ✅ | ❌ |
| Unknown type / `null` / non-object payload ignored | ✅ | n/a | n/a |

## Alarms and notifications

| Behaviour | Unit | E2E Chromium | E2E Firefox |
|---|---|---|---|
| `heartbeat` (1 min) and `daily` alarms created once | ✅ | ❌ | ❌ |
| Heartbeat checkpoint commits sessions | ✅ | ◐ | ❌ |
| Budget notification, max once a day | ✅ | ❌ | ❌ |
| Session alert notification (distracting site past threshold) | ✅ | ❌ | ❌ |
| Stale tab notification, max once a day, respects setting | ✅ | ❌ | ❌ |
| Daily prune + monthly archive | ✅ (repo) | ❌ | ❌ |
| Scheduled auto-export download | ✅ | ❌ | ❌ |
| Notification text in user locale | ✅ | ❌ | ❌ |
| Notification text matches dashboard wording | ✅ | n/a | n/a |

## Storage keys

`storage.local`: `settings`, `installedAt`, `reviewPromptDismissed`, `notifyState`, `budgetNotifyState`, `sessionAlertState`, `autoExportState`, `storageWarning`, `storageWarnDate`, `keyMigrationV2`.
`storage.session`: `engineState`, badge throttle.
Page `localStorage`: theme cache, language cache, dashboard open groups.
IndexedDB stores: `sessions`, `dailyDomainStats`, `tabMeta`, `monthlyDomainStats`.

| Area | Unit | E2E Chromium | E2E Firefox |
|---|---|---|---|
| Every setting default + sanitising | ✅ | ✅ (defaults) | ❌ |
| Settings from an older shape (legacy fields dropped) | ✅ | ❌ | ❌ |
| Corrupt stored values fall back to defaults | ✅ | ❌ | ❌ |
| Cross-context cache coherence | ✅ | ❌ | ❌ |
| Concurrent `saveSettings` (Web Locks) | ✅ | ❌ | ❌ |
| Settings persist after page reload | n/a | ✅ | ❌ |
| Settings persist after browser restart | n/a | ✅ | ❌ |
| `storage.session` missing (older browsers) | ✅ | n/a | n/a |
| Corrupted `engineState` in `storage.session` | ✅ | n/a | n/a |
| Write failure / quota (settings, session commit, restore rollback) | ✅ | ❌ | ❌ |
| Upgrade from an older extension build | ✅ (DB fixtures) | ✅ (v2.1.0 build, needs `E2E_OLD_EXTENSION`) | ❌ |

## Import and export

| Feature | Unit | E2E Chromium | E2E Firefox |
|---|---|---|---|
| JSON backup export (real download) | ✅ | ✅ | ❌ |
| CSV export | ✅ | ◐ (buttons present) | ❌ |
| Encrypted export + passphrase rules | ✅ | ✅ | ❌ |
| Restore (replace) with confirmation / cancel | ✅ | ✅ | ❌ |
| Merge restore | ✅ | ✅ | ❌ |
| Corrupt / oversized / newer-version backup refused | ✅ | ◐ (corrupt only) | ❌ |
| Older-version backup accepted (v1 fixture) | ✅ | ❌ | ❌ |
| Very large backup (100k sessions) | ✅ | ❌ | ❌ |
| Partial backup (daily totals only) | ✅ | ❌ | ❌ |
| Duplicate sessions in a backup | ✅ | ❌ | ❌ |
| CSV import (RescueTime style) | ✅ | ✅ | ❌ |
| Export then import round-trip (download, wipe, upload) | ✅ | ✅ (JSON + encrypted) | ❌ |
| Safety download before replace-restore | ✅ | ✅ | ❌ |
| Wipe all data with confirmation | ✅ | ✅ | ❌ |

## Dashboard and popup UI

| Feature | Unit | E2E Chromium | E2E Firefox |
|---|---|---|---|
| Popup: total, top sites, open dashboard | ✅ | ✅ | ❌ |
| Dashboard boot (`App.vue`) | ✅ | ✅ | ❌ |
| Onboarding card first run + dismiss | ✅ | ✅ | ❌ |
| Review prompt timing + dismiss | ✅ | ❌ | ❌ |
| Privacy dialog (incl. every manifest permission listed) | ✅ | ✅ (keyboard, axe) | ❌ |
| Day navigation / date picker | ✅ | ❌ | ❌ |
| Hero, stat, category, top sites tiles | ◐ | ✅ (render) | ❌ |
| Productivity, focus trend, focus categories | ◐ | ✅ (render) | ❌ |
| Work log | ◐ | ✅ (render) | ❌ |
| Insights, trend chart, comparison, heatmap | ◐ | ✅ (render) | ❌ |
| Tab table: click focuses tab | ✅ | ✅ | ❌ |
| Stale tabs modal (close, snooze) | ✅ | ❌ | ❌ |
| Domain detail modal | ◐ | ✅ (axe) | ❌ |
| Wrapped / report card image | ✅ (lib) | ❌ | ❌ |
| Theme (system, light, dark), persists after restart | ✅ | ✅ | ❌ |
| Empty state (no data) | ◐ | ❌ | ❌ |
| Loading and error states, retry, storage-full banner | ✅ | ❌ | ❌ |

## Settings controls

| Setting | Unit | E2E Chromium | E2E Firefox |
|---|---|---|---|
| staleDays, idleSeconds (buttons and typing) | ✅ | ✅ | ❌ |
| audioEnabled | ✅ | ✅ | ❌ |
| notificationsEnabled | ✅ | ✅ | ❌ |
| sessionAlertMinutes | ✅ | ✅ | ❌ |
| focusTarget | ✅ | ✅ | ❌ |
| categoryBudgets | ✅ | ❌ | ❌ |
| categoryProductivity | ✅ | ❌ | ❌ |
| customCategories | ✅ | ❌ | ❌ |
| categoryOverrides, categoryRules | ✅ | ❌ | ❌ |
| excludedDomains | ✅ | ✅ (tracking) | ❌ |
| trackingPaused | ✅ | ✅ | ❌ |
| autoExportDays | ✅ | ✅ | ❌ |
| language | ✅ | ◐ (set via storage) | ❌ |
| scheduled backup interval | ✅ | ✅ | ❌ |
| show intro again | ✅ | ❌ | ❌ |

## i18n

| Check | Unit | E2E Chromium | E2E Firefox |
|---|---|---|---|
| Every locale has exactly the `en` keys | ✅ | n/a | n/a |
| Placeholders match `en` | ✅ | n/a | n/a |
| Plural forms (ru, others) | ✅ | n/a | n/a |
| Unused keys | ✅ | n/a | n/a |
| Hardcoded user-facing strings in templates | ✅ | n/a | n/a |
| `public/_locales/*/messages.json` key parity + 132-char limit | ✅ | n/a | n/a |
| No horizontal overflow (1440, 768, 380 px + popup) | n/a | ✅ (all 11) | ❌ |
| All 11 locales render with no missing keys or vue-i18n warnings | ◐ (switch test) | ✅ | ❌ |
| RTL layout | n/a (no RTL locale) | n/a | n/a |

## Cross-cutting

| Check | Status |
|---|---|
| Accessibility scan (axe) light + dark: popup, dashboard, dialogs, intro | ✅ Chromium, zero serious or critical violations |
| Keyboard-only operation: every dashboard control reachable with a focus indicator, dialog focus trap and return, settings, popup | ✅ Chromium |
| Visual regression: dashboard + popup, 11 locales × 2 themes, 1% tolerance | ◐ Chromium: macOS baselines only; Linux baselines come from CI in Phase 5 (the spec skips a platform with no baselines) |
| Service worker killed mid-flow | ❌ blocked: stopping the worker closes Playwright's context (`e2e/lifecycle.spec.ts` is `fixme`); unit test covers restart |
| `web-ext lint` | ❌ |
| Manifest permission / version check | ◐ (`check:version` for README badge only) |
| Bundle size budget | ❌ |
| Coverage thresholds in Vitest config | ✅ |

## Problems found in the current setup

1. CI e2e job has `continue-on-error: true`. A failing e2e run never blocks a merge.
2. E2E tests depend on the real network: `extension.spec.ts` and `spa-live.spec.ts` open `https://example.com`.
3. E2E uses fixed sleeps (`waitForTimeout`) in about 25 places.
4. `e2e/__screenshots__` files are captures for store and review, not baselines. Nothing compares them.
5. No coverage thresholds. Coverage can drop without failing CI.

## Bugs found by tests (all fixed)

1. A malformed saved engine state stopped all tracking until the browser restarted. `TrackerEngine` now drops a saved state with the wrong shape. Tests: `background.test.ts` "a corrupted saved engine state does not stop tracking", `engine.test.ts` "a malformed saved state starts empty".
2. Notifications used different category names than the dashboard in 7 locales. `lib/i18n/notify.ts` labels now match the catalogs. Test: `notify.test.ts` "notification text matches the app catalogs".
3. Replace-restore kept duplicate sessions from a backup file. It now removes them like merge does. Test: `restore.test.ts` "the same session listed twice is stored once".
4. The privacy dialog did not list `webNavigation`, `downloads` and `unlimitedStorage`. Added in all 11 locales. Test: `PrivacyDialog.test.ts` "lists every permission the chrome/firefox manifest requests".
5. `settings.save` was an unused translation key. Removed. Test: `i18n.test.ts` "every en key is used somewhere in the code".

## Bugs found in Phase 2 (all fixed)

6. Typing a number into a settings stepper did not stick: the input was re-rendered from the saved value whenever the typed digits reached the min or max. `NumberStepper` now shows the draft while typing. Tests: `NumberStepper.test.ts` "typed digits stay in the field", `e2e/settings.spec.ts` "a typed number is saved".
7. The popup tab count had no plural forms ("1 tabs", "1 вкладок"). `popup.tabs` now has plural forms where the language needs them, and the popup passes the count as the plural choice. Test: `popup.test.ts` "the tab count uses the singular for one tab".
8. Accessibility (axe, serious), now zero violations on every scanned page in both themes:
   - A. Select boxes, the date picker and the color picker include their visible value in the accessible name ("Theme: Light"). Top-site and popup rows take their name from their visible text and keep the longer hint as `title`.
   - B. The comparison bars and site-detail day bars got `role="img"`, which makes their `aria-label` valid.
   - C. The solid red button uses a new `--negative-solid` token (#dc2626, 4.8:1 with white) in both themes.
   - D. The privacy dialog's text is focusable (`tabindex="0"`) with a focus ring, so keyboard users can scroll it.

Still open, found while fixing 7: English `worklog.moreSites` ("+1 more sites") and `settings.imported` ("Imported 1 entries") have the same missing-plural problem.

## Test setup notes

- E2E: Playwright's browser window is not focused by the OS, and the tracker only counts the focused window. `focusTab()` in `e2e/fixtures.ts` activates the tab and focuses its window through the extension API, like a user click.
- E2E: with no human at the keyboard the OS reports idle, and Chrome sends that once about a second after the worker starts. The fixture waits for it (`settleIdle`) before each test.
- E2E: sessions under 250 ms are dropped by design. `dwell()` waits until the open session is old enough instead of sleeping.
- E2E: extensions loaded with `--load-extension` get `onInstalled` with reason `install` on every launch.

- `fakeBrowser.reset()` does not clear `webNavigation` listeners. Tests that fire those events clear them first.
- fake-browser has no `idle.onStateChanged` or `tabs.onReplaced` implementation. Tests capture the listener through a spy instead.
