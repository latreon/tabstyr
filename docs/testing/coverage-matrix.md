# Test coverage matrix

The checklist for the test work. Update it in the same PR as any test you add.

Legend: ✅ covered · ◐ partly covered · ❌ not covered · n/a does not apply

Last updated: Phase 1 (unit and integration gaps), 2026-11-16, version 2.2.0.

## Baseline

| Suite | Result |
|---|---|
| Vitest (happy-dom, WxtVitest, fakeBrowser) | 72 files, 910 tests, all pass |
| Playwright e2e (Chromium, built `dist/chrome-mv3`) | 20 tests, all pass (1 skipped on CI) |
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

## Background events

| Behaviour | Unit | E2E Chromium | E2E Firefox |
|---|---|---|---|
| `runtime.onInstalled` install: opens dashboard, records install date | ✅ | ❌ | ❌ |
| `runtime.onInstalled` update: no new tab | ✅ | ❌ | ❌ |
| `runtime.setUninstallURL` | ✅ | ❌ | ❌ |
| `runtime.onStartup`: re-match tab meta to live tabs by URL | ✅ | ❌ | ❌ |
| `runtime.onSuspend`: flush open session | ✅ | ❌ | ❌ |
| Worker restart: engine state restored from `storage.session` | ✅ | ❌ | ❌ |
| `tabs.onActivated` | ✅ | ✅ | ❌ |
| `tabs.onUpdated` (URL, title, private window) | ✅ | ◐ | ❌ |
| `tabs.onRemoved` | ✅ | ❌ | ❌ |
| `tabs.onReplaced` | ✅ | ❌ | ❌ |
| `windows.onFocusChanged` (blur on leaving the browser) | ✅ | ❌ | ❌ |
| `idle.onStateChanged` (idle, locked, active) | ✅ | ❌ | ❌ |
| `webNavigation.onHistoryStateUpdated` (pushState/replaceState, iframes, duplicates, rapid changes, unfocused tab) | ✅ | ✅ (pushState) | ❌ |
| `webNavigation.onReferenceFragmentUpdated` (hash routes) | ✅ | ❌ | ❌ |
| popstate / back-forward in an SPA (same event as pushState) | ◐ | ❌ | ❌ |
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
| `settings-changed`: reload settings, pause/resume, idle interval | ✅ | ◐ | ❌ |
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
| Every setting default + sanitising | ✅ | ❌ | ❌ |
| Settings from an older shape (legacy fields dropped) | ✅ | ❌ | ❌ |
| Corrupt stored values fall back to defaults | ✅ | ❌ | ❌ |
| Cross-context cache coherence | ✅ | ❌ | ❌ |
| Concurrent `saveSettings` (Web Locks) | ✅ | ❌ | ❌ |
| Settings persist after page reload | n/a | ❌ | ❌ |
| Settings persist after browser restart | n/a | ❌ | ❌ |
| `storage.session` missing (older browsers) | ✅ | n/a | n/a |
| Corrupted `engineState` in `storage.session` | ✅ | n/a | n/a |
| Write failure / quota (settings, session commit, restore rollback) | ✅ | ❌ | ❌ |
| Upgrade from an older extension build | ❌ | ❌ | ❌ |

## Import and export

| Feature | Unit | E2E Chromium | E2E Firefox |
|---|---|---|---|
| JSON backup export | ✅ | ◐ (buttons present) | ❌ |
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
| Export then import round-trip | ✅ | ❌ | ❌ |
| Wipe all data with confirmation | ✅ | ✅ | ❌ |

## Dashboard and popup UI

| Feature | Unit | E2E Chromium | E2E Firefox |
|---|---|---|---|
| Popup: total, top sites, open dashboard | ✅ | ✅ | ❌ |
| Dashboard boot (`App.vue`) | ✅ | ✅ | ❌ |
| Onboarding card first run + dismiss | ✅ | ❌ | ❌ |
| Review prompt timing + dismiss | ✅ | ❌ | ❌ |
| Privacy dialog (incl. every manifest permission listed) | ✅ | ❌ | ❌ |
| Day navigation / date picker | ✅ | ❌ | ❌ |
| Hero, stat, category, top sites tiles | ◐ | ✅ (render) | ❌ |
| Productivity, focus trend, focus categories | ◐ | ✅ (render) | ❌ |
| Work log | ◐ | ✅ (render) | ❌ |
| Insights, trend chart, comparison, heatmap | ◐ | ✅ (render) | ❌ |
| Tab table: click focuses tab | ✅ | ✅ | ❌ |
| Stale tabs modal (close, snooze) | ✅ | ❌ | ❌ |
| Domain detail modal | ◐ | ❌ | ❌ |
| Wrapped / report card image | ✅ (lib) | ❌ | ❌ |
| Theme toggle (system, light, dark) | ✅ | ✅ | ❌ |
| Empty state (no data) | ◐ | ❌ | ❌ |
| Loading and error states, retry, storage-full banner | ✅ | ❌ | ❌ |

## Settings controls

| Setting | Unit | E2E Chromium | E2E Firefox |
|---|---|---|---|
| staleDays, idleSeconds | ✅ | ❌ | ❌ |
| audioEnabled | ✅ | ❌ | ❌ |
| notificationsEnabled | ✅ | ❌ | ❌ |
| sessionAlertMinutes | ✅ | ❌ | ❌ |
| focusTarget | ✅ | ❌ | ❌ |
| categoryBudgets | ✅ | ❌ | ❌ |
| categoryProductivity | ✅ | ❌ | ❌ |
| customCategories | ✅ | ❌ | ❌ |
| categoryOverrides, categoryRules | ✅ | ❌ | ❌ |
| excludedDomains | ✅ | ❌ | ❌ |
| trackingPaused | ✅ | ❌ | ❌ |
| autoExportDays | ✅ | ❌ | ❌ |
| language | ✅ | ◐ (set via storage) | ❌ |
| scheduled backup interval | ✅ | ❌ | ❌ |
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
| No horizontal overflow | n/a | ◐ (de, ja, ru, tr) | ❌ |
| All 11 locales render with no missing keys | ◐ (switch test) | ❌ | ❌ |
| RTL layout | n/a (no RTL locale) | n/a | n/a |

## Cross-cutting

| Check | Status |
|---|---|
| Accessibility scan (axe) light + dark | ❌ |
| Keyboard-only operation | ◐ (focus trap, pickers in unit tests) |
| Visual regression (screenshot compare) | ❌ (screenshots are saved for review, not compared) |
| Service worker killed mid-flow | ❌ |
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

## Test setup notes

- `fakeBrowser.reset()` does not clear `webNavigation` listeners. Tests that fire those events clear them first.
- fake-browser has no `idle.onStateChanged` or `tabs.onReplaced` implementation. Tests capture the listener through a spy instead.
