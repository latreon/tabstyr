# Changelog

All notable changes to TabStyr. Generated from [GitHub Releases](https://github.com/latreon/tabstyr/releases) — the release page is the source of truth; run `npm run changelog:fetch && node scripts/generate-changelog.mjs` to refresh this file after a new release.

## v2.0.0 — 2026-07-20

TabStyr 2.0.0 — a hardening pass on data export.

### Data export
- **CSV formula-injection guard** — a text cell starting with `=`, `+`, `-`, `@`, tab, or carriage return is now prefixed with a single quote so a crafted category name can't execute as a formula when the exported file is opened in Excel or Google Sheets. Numeric columns are left untouched so they stay machine-parseable.
- **UTF-8 BOM on CSV downloads** — exported CSVs now carry a byte-order mark so Excel decodes non-ASCII domains and category names as UTF-8 instead of the OS legacy codepage.
- **Empty-export feedback** — exporting with no tracked activity now shows a "nothing to export yet" toast instead of silently downloading a header-only CSV or an empty JSON file.

## v1.9.0 — 2026-07-13

TabStyr 1.9.0 — an audit-driven correctness, privacy, and accessibility pass across the extension and website, plus a review-prompt/uninstall-feedback loop and a real `/blog`.

### Highlights

#### Correctness (extension)
- **Idle over-count** — a focused tab that had been playing audio kept booking active minutes every heartbeat after playback stopped while the user was idle. Now closes the session instead of re-basing it.
- **Cross-device sync aborts** — merging a backup from another device could throw `ConstraintError` and abort the whole restore, because both devices numbered sessions from 1. Surrogate ids are now stripped so IndexedDB assigns fresh keys.
- **Worker-death double-count** — a mid-write service-worker eviction could let a slice be re-emitted after already being saved. State is now written before slices, capping the loss at ≤1 minute.
- **Alt-tab audio lost** — switching windows while a background tab kept playing audio silently stopped counting it. Audio focus now re-syncs on window-focus changes, including `WINDOW_ID_NONE`.
- **mergeDaily data loss** — rolling up sessions into a daily total could overwrite a larger already-stored value (e.g. from a CSV import) instead of taking the max.
- **Import domain spoofing** — a crafted backup could pair a trusted `domain` field with an unrelated `url`. Domain is now re-derived from the url on import.
- **Chronotype bias** — unequal morning/afternoon/night band widths skewed the stat toward "night owl" on a raw-sum comparison; now compares per-hour intensity.
- **Wrapped web-only consistency** — coverage window, daily average, and busiest day used to count all domains while totals were web-only; now consistent throughout.
- **Double-subtracted background-audio time** — reports and budget calculations could subtract audio time twice; unified on a single subtraction point.

#### Accessibility
- **NumberStepper** — per-keystroke clamping corrupted multi-digit entry (e.g. typing "180" with a min of 15 could land on the wrong value). Now clamps on commit.
- **Restore/merge dialog** — the destructive confirmation dialog never received keyboard focus on open; now focuses its Cancel button.

#### Privacy
- **Wrapped no longer leaks visited domains** — favicons were being fetched from icon.horse and Google's S2 service, disclosing top-site hostnames despite the "0 bytes leave your device" promise. Replaced with a local letter-chip fallback.
- **Removed a live analytics beacon** — a Cloudflare Web Analytics token had been committed and was loading on every page visit, contradicting the site's "no analytics" claim.

#### Review prompt & uninstall feedback
- A small, dismissible corner card now offers a link to the Chrome Web Store review tab once the extension has been installed for 6+ days.
- Uninstalling now opens the site's existing `/ideas` feedback form (tagged `src=uninstall`) instead of going nowhere.

#### Website
- A real **`/blog`** (three articles) and a **TabStyr vs. RescueTime vs. Toggl Track** comparison table.
- **`CHANGELOG.md`** is now generated from GitHub Releases instead of 404ing.
- **Static prerendering** for all 99 routes (9 pages × 11 locales) so crawlers and no-JS visitors get fully-rendered HTML, not an empty SPA shell.
- **i18n test coverage** extended from 5 to all 11 locales — confirmed translation keys are actually complete.
- **CONTRIBUTING.md** added; GitHub topics and Discussions enabled.
- Restored a GitHub link in the footer now that the repo is public (MIT).

#### Housekeeping
- Removed a short-lived "vs. RescueTime & Toggl" footer link per follow-up feedback.
- Added bottom padding to the activity report card image.

_See the commit history for the full list of smaller fixes._

## v1.8.0 — 2026-07-04

TabStyr 1.8.0 — a big one. Everything since 1.6.4, including the reworked features that were briefly on the 1.7.x line.

### Highlights

#### Categories & Focus
- **Custom categories** — add your own categories with a color, on top of the built-ins.
- **Per-category productivity** — mark any category (built-in *or* custom) as productive / distracting / neutral, and reclassify it right from **Focus categories**. Changes apply live.
- **Category time budgets** + a **daily focus goal**, with gentle nudges when you pass a budget (nothing is blocked).

#### Dashboard
- **Auto-generated Insights** — short, plain-language takeaways derived from your own data.
- **Activity heatmap** now reads as a rolling **last-7-days** window ending today, instead of a fixed Mon–Sun week.
- **Design-system overhaul** — new color system, spacing/scale tokens, and signature data-viz styling.
- Polish: trend charts get breathing room at the edges, the site-detail modal aligns its page rows cleanly, and the headline compares against your **daily average**.

#### Data
- **Work log export** — save your activity report as a PNG image or CSV.
- **Encrypted manual sync** — merge your data across devices via an encrypted sync file.
- **CSV import** — seed day-one data from another time tracker.
- **Monthly rollup archive** kept before pruning old rows.

#### Housekeeping
- Removed the in-extension **Projects/Tags** feature and **Browsing Wrapped** (Wrapped now lives on the website).
- Refreshed Chrome Web Store screenshots and landing-page assets to match the current UI.

_See the commit history for the full list of fixes and smaller improvements._

## v1.6.4 — 2026-06-28

Latest stable release. (Versions 1.7.0–1.7.2 were rolled back — landing-page Browsing Wrapped work, not extension releases.)

## v1.6.3 — 2026-06-23

Private, local-only browsing-time tracker.

### What's new in 1.6.3
Launch-readiness pass — no behavior change to time tracking.

**Security**
- Patched all 4 Dependabot advisories (shell-quote, tmp, uuid, esbuild) via npm overrides. All are transitive, build/dev-only deps — none ship in the extension. `npm audit` now reports 0 vulnerabilities.

**Reliability & correctness**
- DST fall-back edge no longer drops the remainder of a session in daily totals or the heatmap.
- Dashboard load: overlapping refreshes can no longer clobber each other (load token); headline stats now paint before the heavy 90-day session scan + heatmap build.
- Theme/locale: storage failures no longer break the toggle or leave an unhandled rejection.

**Privacy & store readiness**
- Privacy policy + store listing now disclose the optional Ko-fi link (user-initiated navigation; the extension still makes no automated network requests).
- Firefox MV2 CSP hardened with `img-src 'self' data:`.

**Accessibility**
- SelectBox announces the active option to screen readers; CategoryPicker menu gets arrow/Home/End navigation.

### Verification
vue-tsc clean · 278 unit tests · Chrome MV3 + Firefox MV2 builds green at 1.6.3 · npm audit: 0 vulnerabilities.

### Assets
- tabstyr-1.6.3-chrome.zip — Chrome Web Store / Edge / Chromium
- tabstyr-1.6.3-firefox.zip — Firefox AMO
- tabstyr-1.6.3-sources.zip — AMO source review

## v1.6.2 — 2026-06-22

Private, local-only browsing-time tracker.

### What's new in 1.6.2
- **Exact seconds under an hour** — durations now show real minutes + seconds ("5m 23s", "45s") instead of rounding to the nearest minute. Hours and above unchanged.
- **Top sites layout** — active time and the "♪ audio" time now stack on separate rows instead of crowding side by side.
- **Readability** — focus legend/note, comparison subtitle, and tab-table subtitle bumped to 12px.
- **Repo cleanup** — removed internal scaffolding/references ahead of open-sourcing.

### Verification
vue-tsc clean · 278 unit tests · 13/13 e2e against the loaded extension · Chrome MV3 + Firefox MV2 builds green at 1.6.2.

### Assets
- tabstyr-1.6.2-chrome.zip — Chrome Web Store / Edge / Chromium
- tabstyr-1.6.2-firefox.zip — Firefox AMO
- tabstyr-1.6.2-sources.zip — AMO source review

## v1.6.1 — 2026-06-22

Private, local-only browsing-time tracker. Rolls up the 1.6.0 launch-readiness audit and the 1.6.1 launch-quality fixes.

### Highlights
- First-run fixed — installing now opens the dashboard so onboarding is actually seen.
- Notifications opt-out — stale-tab reminder has a real on/off toggle.
- Settings auto-save — steppers/toggles persist on change (no silent loss); "Show intro again" link.
- Sleep accuracy — long unobserved gaps (sleep/throttle) no longer book phantom media time; genuine playback still counts.
- Performance — lighter dashboard memory (shallow session ref), fewer Date allocations, memoized categorization, precomputed heatmap styles.
- A11y — chart roles, listbox labels, non-modal date popover.
- Security — Firefox CSP parity (style-src), restore errors no longer leak raw text.
- Accepted trade-offs documented in docs/KNOWN-LIMITATIONS.md.

### Verification
vue-tsc clean · 275 unit tests · locale parity 237 keys x 11 · Chrome MV3 + Firefox MV2 builds green · 13/13 e2e against the loaded extension.

### Assets
- tabstyr-1.6.1-chrome.zip — Chrome Web Store / Edge / Chromium
- tabstyr-1.6.1-firefox.zip — Firefox AMO
- tabstyr-1.6.1-sources.zip — AMO source review

## v1.6.0 — 2026-06-22

fix(a11y,i18n,tracking,security,perf): launch-readiness audit fixes (1.6.0)

Accessibility
- AA contrast: white text now on darker --accent-grad-strong gradient for all
  primary buttons, active toggles, selected day (was 2.5-3.5:1, now >=5:1)
- Tile titles promoted to <h2> for screen-reader heading navigation
- Replace misapplied tablist roles with role=group + aria-pressed toggles
- role=alert on inline rule/encrypt/restore errors; aria-label on passphrase inputs
- ToggleSwitch >=24px target (WCAG 2.5.8); darker light-mode --positive (AA)

i18n
- Localize the full PrivacyDialog body (33 keys) and the trend tooltip across all
  11 locales; locale-aware dates via getDateLocale()
- Disclose that JSON backups include tab titles (settings.backupNote)

Tracking
- Serialize background event handlers through one promise queue so interleaved
  events can no longer corrupt or stale-overwrite engine state
- Absolute 24h session ceiling (even for media) caps forward clock-jumps; drop
  slices when the clock jumps backward
- Empty-state UX for HeroTile and ProductivityTile on zero-data days

Security
- Reject non-http(s) URLs in imported tabMeta (restore.ts)
- Explicit CSP for Firefox/Safari MV2 (connect-src/base-uri/form-action 'none')

Performance
- Cache settings in-process (invalidated on settings-changed) — removes redundant
  storage reads on every heartbeat
- Batch the v1->v2 key backfill in 1000-row chunks to avoid a long IndexedDB lock

Docs: README scope notes for MV3 long-read undercount and the 24h ceiling.

## v1.5.8 — 2026-06-22

fix(privacy,tracking,settings,a11y): 5 audit findings (1.5.8)

1. Privacy — tabMeta stored raw tab.url (query/token leaked into JSON exports).
   Store pageOf(url); normalize the live url on restart rematch; re-normalize
   imported Session.url/TabMeta.url in restore.

2. Tracking — tab.active is per-window, so a background window's active tab could
   steal focus/audio on URL/audio updates. Gate handleFocus/setFocusedAudible (and
   onActivated focus) on isInFocusedWindow(windowId); degrade-open where the
   windows API is absent.

3. Settings — saveSettings wrote the raw patch; only reads sanitized. Sanitize the
   merged result before persisting and cap categoryOverrides (5000) so a hostile
   backup can't bloat/corrupt stored settings or fail a restore mid-write.

4. a11y/i18n — setLocale now syncs document.documentElement.lang; DatePicker aria
   strings localized via t() (new datePicker.* keys in all 11 locales).

5. e2e — dismiss onboarding in the 'tracking accumulates' test (was flaky: the
   onboarding overlay inerts the background). e2e now 13/13, no flake.

Tests: +3 (url-normalized import, sanitize-on-write, override cap). 271 unit + 13 e2e green.

## v1.5.7 — 2026-06-22

fix(heatmap,ui): no heatmap scrollbar, show all 24 hour labels, audio text margin (1.5.7)

- HeatmapTile: columns use minmax(0,1fr) so the grid always fits — removes the
  persistent horizontal scrollbar and the one the hover pop spawned at the edges
  (dropped the overflow-x:auto scroll container; the scale is transform-only)
- HeatmapTile: show every hour label 0–23 (was every 3rd); smaller font + clip
  so the extra labels don't widen the grid
- TopSitesChart: 6px left margin on the .audio (♪) text

## v1.5.6 — 2026-06-22

feat(a11y,categorize): explicit local-dev policy + chart a11y + forced-colors (1.5.6)

Phase 1 — local-dev host policy (#9):
- domain.ts: document that bare IPv4 hosts are tracked (intended) and IPv6
  literals are an accepted gap; add isLocalDevHost(localhost|IPv4)
- categories.ts: map local-dev hosts to Dev so dev servers don't scatter to Other
- tests for IPv4 tracking + local-dev categorization

Phase 2 — accessibility (#27 + forced-colors):
- TrendChart: role=group on bars container, role=img on each bar (named graphics)
- CategoryChart: role=img label now spells out per-category share (not generic)
- theme.css: add forced-colors block — legible gradient text, visible focus,
  bordered color-only swatches (reduced-motion blanket already present)

## v1.5.5 — 2026-06-22

fix(restore,a11y): atomic restore, import validation, size guard, heatmap keyboard, category boundary match (1.5.5)

- restore.ts/repo.ts: clear+write all stores in ONE transaction (repo.restoreAll)
  so a failed import rolls back and never wipes/half-restores existing data
- restore.ts: validate imported values — reject negative/impossible seconds,
  audioSeconds>seconds, end<=start, bad dates, non-web domains, oversize strings,
  far-future timestamps; bound payload size before parse
- SettingsPanel.vue: reject backup by file.size before read (MAX_BACKUP_BYTES 64MB)
- categories.ts: match built-in tokens on dot-label boundaries, not raw substring
  (notx.com no longer Social, myamazon-clone.com no longer Shopping)
- HeatmapTile.vue: cells are focusable buttons with roving tabindex + arrow/Home/End
  navigation and per-cell aria-label (keyboard + screen-reader access)
- i18n: add common.retry/storageFull (prior) and settings.restoreTooLarge (11 locales)
- tests: import validation, atomic-restore rollback, category boundary

## v1.5.4 — 2026-06-22

fix(storage): surface quota-full + recover from load errors (1.5.4)

- detect QuotaExceededError; auto-prune past-retention + retry once
- on persistent quota: throttled notification + dashboard warning banner
- dashboard/popup load-error screens get Retry button (re-opens DB)
- storageWarning flag in storage.local, cleared on successful write
- localized storage-full text (notify.ts + common.storageFull, 11 locales)
- add common.retry; new lib/db/errors.ts + tests

## v1.5.3 — 2026-06-22

feat: SPA sub-page tracking, stronger backup crypto, i18n verification (v1.5.3)

Tracking
- Attribute time per sub-page on single-page apps: the engine now splits
  the focused session on path changes, not just domain changes, so time on
  successive YouTube videos / Gmail views lands on the page actually viewed.
- Add the webNavigation permission and listen for onHistoryStateUpdated /
  onReferenceFragmentUpdated to catch in-page (pushState / #/ hash-route)
  navigations that tabs.onUpdated misses.
- Store normalized page URLs (scheme+host+path, plus #/ hash routes only),
  stripping query strings and non-route fragments so secrets — OAuth tokens,
  search terms — are never persisted.
- New "Top pages" breakdown in the site detail view.

Backups
- Raise PBKDF2 to 600k iterations (OWASP 2023 floor); honor each file's own
  stored count so older backups still decrypt. Zero the plaintext buffer
  after encrypt.
- Reject backups stamped with a newer schemaVersion than this build supports
  instead of importing partial/garbage data.

i18n / UI
- Add Top-pages strings to all 11 locales.
- Verified German + Japanese render with no overflow at 320/768/1440;
  add overflow-wrap insurance on uppercase labels.

Tests: +unit coverage for pageOf/pagePath, subpages, sub-page splitting,
crypto iterations, schema guard; live e2e proving SPA navigations record
distinct sub-pages with tokens stripped.

## v1.5.2 — 2026-06-22

perf: subset font, lazy-load locales, slim the worker (v1.5.2)

Cuts the shipped package ~23% (924 KB → 708 KB) with no behavior change.

- Font: re-subset InterVariable to Latin + Cyrillic + used symbols/weights
  (CJK already falls back to system fonts), variable axis kept — 352 → 151 KB.
- i18n: English bundled eagerly as default/fallback; the other 10 locales load
  on demand via dynamic import (own chunks). setLocale is async; main.ts awaits
  bootstrapLocale() before mount so non-English users get no English flash. The
  shared Vue+i18n chunk drops from 88 → 60 KB gz (no more 11 bundled catalogs).
- background.js 77 → 19 KB: notify.ts inlines just the 11 stale-notification
  strings instead of importing 6 full locale catalogs into the worker.

vue-tsc clean, 233 unit tests, 8/8 e2e pass.

## v1.5.1 — 2026-06-22

fix: production-readiness a11y/UX hardening + green CI (v1.5.1)

CI: e2e asserted the old "Trend" tile name; updated to "Activity trend" +
"Focus trend" (the rename shipped in 1.5.0 but the test fix was uncommitted).

Accessibility / UX
- Toast is now a persistent role=status live region (announces wipe/restore/
  export results); clear toastTimer on unmount
- Dashboard + popup loading/error states announced (role=status/alert, aria-busy)
- Modals hide the background from AT: useFocusTrap ref-counts open dialogs and
  sets inert+aria-hidden on #app; all five dialogs teleported to <body> so the
  dialog itself stays active
- CategoryPicker tap target 20→24px (WCAG 2.5.8)
- DatePicker malformed role=grid → labeled role=group
- NumberStepper +/- buttons localized (common.decrease/increase, all 11 locales)
- TopSitesChart single shared gradient def (no duplicate ids)
- OnboardingCard: drop redundant aria-label (keep aria-labelledby)

Brand
- Page titles + toolbar tooltip now "TabStyr" (were "Tab Time")

Docs
- Regenerate store screenshots (now show Activity trend + Focus trend tiles)

## v1.5.0 — 2026-06-22

feat: focus trend graph + rename activity trend; bar-anchored tooltips (v1.5.0)

- New Focus trend tile: daily/weekly/monthly focus % (productive ÷ productive +
  distracting), green above target / red below, day-week-month toggle. Built on
  buildFocusTrend() in lib/productivity.ts (weekly/monthly buckets aggregate the
  underlying seconds before computing the ratio); honors category overrides/rules
- Rename the activity "Trend" tile to "Activity trend" (distinct from Focus trend)
- Trend tooltips now anchor just above each bar's tip and track bar height, and use
  an opaque --popover background (was translucent --card-strong, so neighbouring
  bars showed through in dark mode)
- i18n: focus.trendTitle + activity-trend rename across all 6 locales
- +3 unit tests for buildFocusTrend (233 passing)

## v1.4.2 — 2026-06-22

feat: cross-browser support for Firefox & Safari (v1.4.2)

Firefox (AMO-ready)
- Real gecko add-on id + strict_min_version 115 (storage.session floor)
- data_collection_permissions: { required: ['none'] } — required for new AMO
  listings since Nov 2025; honest, the extension transmits nothing
- favicon permission omitted (FF lacks _favicon → letter-chip fallback)
- add zip:firefox script; suppress the now-satisfied WXT data-collection warning

Safari
- build:safari script; manifest branches to MV2 defaults (no favicon perm, no
  MV3 CSP object)
- docs/store/browser-support.md: full matrix + xcrun safari-web-extension-converter
  → Xcode → App Store path, and per-browser install/publish steps

Cross-engine resilience
- storage.session accessed via a guarded sessionStore wrapper — degrades to
  rebuilding engine state from tabs.query() where it's absent (older Safari)
- tabs.onReplaced listener optional-chained (Chromium-centric API)
- manifest now branches cleanly: Chromium gets MV3 CSP + favicon; Firefox gets
  gecko + data-collection; Safari keeps platform defaults

Chromium (Chrome/Edge/Opera/Arc/Brave) unchanged — installs as-is.

## v1.4.1 — 2026-06-22

fix: security hardening + CSP, privacy CSP fix (v1.4.1)

Security (backup import + crypto)
- crypto: clamp file-supplied PBKDF2 iterations to [100k, 2M] (blocks KDF
  downgrade and CPU-exhaustion); validate salt/iv length; enforce a 10-char
  minimum passphrase at the crypto layer, not just the UI
- restore: hard caps on imported record counts (stats/sessions/tabMeta);
  stricter type guards (full tabMeta fields, session url); validate exportedAt
  as a real date; reject settings objects with an absurd key count
- navigate/domain: isWebDomain is now a strict hostname check and openDomain
  re-parses and confirms https + same host before tabs.create
- TabTable: clamp attacker-controlled tab titles in title/aria-label
- SettingsPanel: zero passphrase refs on unmount

Hardening
- Explicit CSP for Chromium MV3 extension pages: script-src/object-src 'self',
  connect-src 'none', img-src 'self' data:, base-uri/form-action 'none'
  (Firefox MV2 keeps its default)

Fixes
- privacy.html: move the theme pre-paint snippet to an external file
  (public/privacy-theme.js) so it satisfies the strict CSP (no inline script)
- revert the dashboard directory-index experiment: extension pages can't serve
  a clean /dashboard/ path (ERR_FILE_NOT_FOUND); open dashboard.html again

Tests
- +8 tests covering iteration clamping, oversized salt, short-passphrase reject,
  stricter tabMeta guard, exportedAt validation, __proto__ non-pollution, and
  settings key-count rejection (230 passing)

## v1.4.0 — 2026-06-22

feat: dashboard polish, per-domain tab table, inline category picker (v1.4.0)

Dashboard / UI
- Tiles use --card-strong; refined light-mode palette (cooler surface,
  accent glow, deeper soft shadow) across dashboard, cards, and modals
- CategoryChart + ComparisonTile: hover highlights the segment/row and its label
- TopSitesChart grid columns widened; clearer log line color
- ThemeToggle: clean Lucide sun/moon/monitor icons; consistent chip radii
- Bigger, uniform WorkLog controls (nav/copy/date picker)

Open tabs by time
- Now aggregated per domain (key-independent, stable across restarts);
  excludes background audio; shows open-tab count per site
- rematchTabMeta: same-domain fallback so a tab's stable key survives a
  cold restart when the restored URL drifted

Category editing
- New CategoryPicker: change a site's category inline from the work log
  via a colored popover; applies instantly as a per-domain override

Privacy
- privacy.html restyled to match the dashboard (tokens, glow, brand, theme sync)
- In-app privacy overlay (PrivacyDialog) so the badge/popup no longer open a
  separate .html page; dashboard opens at /dashboard/ (no .html in the URL)

Settings / i18n
- Language picker drops "Automatic" and always shows a concrete locale
- Trend periods shortened (fewer bars); new strings across all 6 locales

## v1.3.1 — 2026-06-22

fix(tracking): handle tab replacement, flush on suspend, count more reading (v1.3.1)

Tighten tracking-time accuracy at the edges (no permission/identity change).

- tabs.onReplaced: new engine.handleTabReplaced() remaps the focused/audio
  session to the new tabId (continuous, nothing closed); background also remaps
  the stored tabMeta so the stable per-tab key survives. Fixes prerender /
  discard-restore mis-attribution.
- runtime.onSuspend: checkpoint + commit the open session before the worker
  unloads, recovering the ≤1-minute tail lost on every browser close / SW
  eviction (best-effort).
- Raise default idle threshold 60s -> 180s so reading without mouse/keyboard
  input still counts; existing users keep their saved value. Add an in-app hint
  under the Idle setting (all 6 locales).
- Tests: onReplaced remap (focused + audio + no-op), checkpoint-past-cap slice.

Deferred (privacy tradeoff, not adopted): visibility-based "reading mode" would
need a content script + host permissions, breaking the no-host-permissions
guarantee.

Bump version to 1.3.1.

## v1.3.0 — 2026-06-22

feat(i18n): full internationalization with 6 languages (v1.3.0)

Add reactive, in-app internationalization via vue-i18n.

- lib/i18n: vue-i18n instance, SUPPORTED_LOCALES, resolveLocale() (preference →
  browser UI language → English), setLocale() with a localStorage pre-mount
  cache; wired into both popup and dashboard entrypoints.
- Languages: English, Español, Deutsch, Français, 日本語, 中文（简体） —
  full catalogs with matching keys, placeholders, and 3-form plurals.
- composables/useLocale: load/persist the language from settings; both apps
  apply it on mount. New `language` setting ('auto' or a locale code).
- Every component converted to t(): popup, dashboard, all tiles, charts,
  WorkLog, TabTable, DomainDetail, onboarding, settings — including translated
  category names, pluralized summary, and aria labels.
- Localized dates (lib/locale + lib/time): trend axes, worklog, heatmap
  weekdays, and DatePicker month/initials/trigger — reactive to a live switch.
- Background stale notification localized via a vue-i18n-free catalog reader.
- Language picker added to Settings; switching updates the UI instantly.
- Tests: locale key/placeholder/plural parity across all 6 locales, locale
  switching renders, settings language round-trip; global test setup registers
  i18n for component mounts. e2e: dismiss onboarding overlay in 3 tests.
- Bump version to 1.3.0.

## v1.2.0 — 2026-06-22

feat: accessibility hardening + privacy-first backups (v1.2.0)

Accessibility & polish
- Reusable focus trap (composables/useFocusTrap) wired into the onboarding,
  domain-detail, and wipe-confirm dialogs; focus returns to the opener on close.
- DatePicker: full keyboard nav — roving tabindex, arrow keys (±1/±7), Home/End,
  month auto-switch at boundaries, min/max clamping, focus returns to trigger.
- Settings tile sizes to its own content (align-self) instead of stretching to
  the Open-tabs table beside it.
- Light-theme --warn darkened to meet AA contrast on the Wipe action.
- Reduced-motion: gate the JS smooth-scroll (global CSS already covers the rest).
- First component interaction tests (Vue Test Utils + @vitejs/plugin-vue):
  SelectBox, DatePicker, OnboardingCard (focus trap), TabTable.

Privacy as the differentiator
- "0 bytes leave your device" badge in the popup and dashboard, plus a bundled
  privacy page at /privacy.html, all using a shared shield-check icon.
- Encrypted local backup: passphrase-wrapped JSON via Web Crypto
  (PBKDF2 -> AES-256-GCM), and restore (plain or encrypted) from a file, with a
  destructive-action confirm. No server, no network.
- Header theme toggle restyled to match the privacy badge (surface, border,
  28px height, 14px radius).
- Store listing + privacy policy copy updated to lean into local-only privacy
  and the new encrypted backup/restore.

Bump version to 1.2.0.

## v1.1.0 — 2026-06-22

feat: broaden categorization, add Finance + custom rules and onboarding (v1.1.0)

Categorization
- Greatly expand built-in rules with international/global sites so non-US users
  don't land everything in "Other" (Dev, Work, Social, Media, News, Shopping).
- Add a Finance category (banks, payments, crypto, investing) — global + regional.
- User-defined substring rules: precedence is exact override → user rules →
  built-in → Other. Threaded through categorize/groupByCategory/productivity/
  worklog/comparison and every component.
- Settings: manage custom rules (add/list/remove), sanitized and capped.
- Tokens kept specific (brand/brand+TLD) to avoid lookalike collisions
  (e.g. chase.com not bare "chase"); regression test added.

Onboarding
- First-run modal (centered, scroll-locked, SVG icons, category legend)
  explaining what's tracked, the local-only privacy promise, and how
  categories work. Dismissal persists via an `onboarded` flag.

Fixes / polish
- Settings changes now trigger a silent in-place reload, so adding/removing a
  rule no longer jumps the page to the top.
- Export reduced to two options: Export JSON and Export CSV.

Settings schema gains categoryRules + onboarded (sanitized, back-compatible).
Bump version to 1.1.0.

## v1.0.1 — 2026-06-22

fix: repair stale deep-link, drop dead code, expose sessions export (v1.0.1)

- Popup "{n} stale" deep-link now scrolls to and briefly flashes the Stale tabs
  stat tile; the old #stale target was removed with the StaleList view. Honors
  prefers-reduced-motion.
- Remove orphaned StaleList.vue (imported nowhere since the dashboard refactor).
- Settings: add "Sessions CSV" export wiring the already-tested sessionsToCsv;
  relabel exports to JSON backup / Daily CSV / Sessions CSV with clearer filenames.
- README: correct session cap 10 -> 30 min (matches MAX_SESSION_MS) and note the
  media-playback exemption.
- Bump version to 1.0.1.

## v1.0.0 — 2026-06-22

ci: add GitHub Actions (type-check, test, build + non-blocking e2e); bump to 1.0.0

## v0.1.0 — 2026-06-22

fix: hero sparkline, blur on url-less focus, settings range clamp, wipe notify state, firefox signing prep

- HeroTile: add 14-day sparkline polyline using buildTrend; accept stats prop
- App.vue: pass :stats to HeroTile
- background.ts: persist blur before early-returning when tab has no url (onActivated + onFocusChanged)
- settings.ts: clamp staleDays [1,60] and idleSeconds [15,600] in coerce()
- settings.test.ts: add out-of-range clamp test (67 tests total)
- background.ts wipe-data: also remove notifyState from local storage
- package.json: version 0.1.0
- wxt.config.ts: per-browser manifest fn; browser_specific_settings only for firefox
- README.md: add Known limitations section
