<div align="center">

![TabStyr](docs/store/promo/marquee-1400x560.png)

# TabStyr

**See how you really use your browser — privately.**

Active time per tab and site, trends, an hourly heatmap, category & focus
breakdowns, and gentle stale-tab nudges. Every byte stays on your device.

[Features](#features) · [Privacy](#privacy) · [Install](#install) ·
[How metrics work](#how-the-metrics-work) · [Development](#development) ·
[Architecture](#architecture)

<br/>

[![CI](https://github.com/latreon/tabstyr/actions/workflows/ci.yml/badge.svg)](https://github.com/latreon/tabstyr/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Version](./.github/badges/version.svg)
![Data: 100% local](https://img.shields.io/badge/data-100%25%20local-3fb27f)

<br/>

![Vue 3](https://img.shields.io/badge/Vue_3-42b883?logo=vuedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![WXT](https://img.shields.io/badge/WXT-67d55b?logo=wxt&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646cff?logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6e9f18?logo=vitest&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2ead33?logo=playwright&logoColor=white)
![IndexedDB](https://img.shields.io/badge/IndexedDB-local-f59e0b)

</div>

---

## What is TabStyr?

TabStyr is a browser extension that quietly measures the time you spend on tabs
and websites, then turns it into clear, useful insights — a dashboard, trends, a
when-you-browse heatmap, work/distraction breakdowns, and reminders about tabs
you've forgotten.

It is **100% local**. There are no servers, no accounts, no analytics, and no
network requests. Your data lives in your browser's database and never leaves it.

> **The honest metric.** The headline number is your *active foreground time*.
> Background audio is counted and shown **separately**, so your totals never
> exceed the real time you spent at the computer.

---

## Features

### Tracking
- **Active-time tracking** per tab and per domain, second-by-second.
- **Idle-aware** — pauses when you step away (configurable timeout).
- **Audio-aware** — background audio (music/video in another tab) is tracked and
  reported separately, never inflating your active total.
- **Restart-safe** — per-tab totals use a stable identifier, so they survive the
  browser reassigning tab IDs after a restart.

### Dashboard
- **Today** — active time with a sparkline and a vs-weekly-average delta.
- **Open / stale tab counts.**
- **Trend** — day, week, and month views.
- **This week vs last week** — period comparison (week or month) broken down by
  category, with per-category deltas.
- **Activity heatmap** — which hours of which days you browse most.
- **Today by category** — Work, Dev, Finance, Social, Media, News, Shopping, Other.
  **Click any site's category dot to re-classify it instantly** (a quick colored
  picker); the change applies everywhere.
- **Focus today** — a productive-vs-distracting ratio with a daily streak.
- **Top sites** with a per-domain detail view (its own trend, sessions, share,
  and heatmap).
- **Open tabs by time** — for each site you have open, its total active time over
  the last 90 days, sortable, with a per-site open-tab count.
- **Stale tabs** — list with one-click Close / Keep.
- **What did I work on?** — pick any day and copy a clean site list for standups
  or invoices.

### Popup
- Today's active total, top sites with favicons, and the stale-tab count.

### Data
- **Export** — full JSON backup, or CSV (daily totals or raw session log).
- **Encrypted backup** — optional passphrase-protected export (AES-256-GCM,
  PBKDF2-SHA-256), all in-browser via the Web Crypto API.
- **Restore / import** — load a JSON or encrypted backup on this or another device.
- **One-click wipe** of all stored data.
- **90-day rolling window**, pruned automatically.

### Look & feel
- System-aware **dark / light** themes with a manual toggle.
- **6 languages** — English, Español, Deutsch, Français, 日本語, 中文（简体）.
- Accessible, keyboard-friendly UI.

## Screenshots

| Dashboard (light) | Dashboard (dark) |
|---|---|
| ![Dashboard light](docs/store/screenshots/dashboard-light.png) | ![Dashboard dark](docs/store/screenshots/dashboard-dark.png) |

| Popup (light) | Popup (dark) |
|---|---|
| ![Popup light](docs/store/screenshots/popup-light.png) | ![Popup dark](docs/store/screenshots/popup-dark.png) |

> Captured from the live extension with sample data. Your own dashboard fills in
> as you browse.

## Privacy

TabStyr collects **nothing** and sends **nothing**. All activity is stored locally
in your browser's IndexedDB and pruned to a 90-day window.

- No servers, no cloud sync, no accounts.
- No analytics, no ads, no third-party code.
- It does **not** read page content — only the tab metadata (URL/title) the
  browser already provides to extensions.

Full policy: [docs/store/privacy-policy.md](docs/store/privacy-policy.md). The
policy is also viewable in-app — the **0 bytes leave your device** badge opens it
as an overlay (no new tab, no page navigation).

### Security

- **No network surface** — zero `fetch`/XHR, no remote scripts, no content
  scripts, no cross-origin messaging.
- **Strict CSP** on Chromium extension pages: `script-src 'self'`, `object-src
  'self'`, `connect-src 'none'`.
- **Hardened backup import** — every record is type-checked and capped; the
  passphrase KDF iteration count is clamped to a safe range to block downgrade and
  CPU-exhaustion from a crafted file.
- **Encrypted backups** use authenticated AES-256-GCM (a wrong passphrase or a
  tampered file fails to decrypt rather than returning garbage).

### Permissions

| Permission | Why it's needed |
|---|---|
| `tabs` | Know the active tab's URL/title to attribute time to the right site |
| `storage` | Save your stats and settings locally |
| `idle` | Pause tracking when you're away so totals stay accurate |
| `alarms` | Periodic checkpoints + the once-daily maintenance task |
| `notifications` | Optional, at-most-once-per-day stale-tab reminder |
| `favicon` (Chromium only) | Show site icons in lists |

No host permissions are requested — the extension cannot access page contents.

## Browser support

| Browser | Status |
|---|---|
| Chrome, Edge, Brave, Opera, Vivaldi, Arc (Chromium, MV3) | ✅ Fully supported — install as-is |
| Firefox 115+ (MV2 build) | ✅ Supported — favicons fall back to colored letter chips |
| Safari 16.4+ | ⚠️ Works after an Xcode conversion, with reduced features (see [Safari](#safari)) |

Same codebase, one build per engine; only packaging and a few platform APIs
differ. Full matrix and per-browser publish steps:
[docs/store/browser-support.md](docs/store/browser-support.md).

## Install

### From a store

Coming soon to the Chrome Web Store, Edge Add-ons, and Firefox AMO.

### Unpacked (from source)

```bash
git clone https://github.com/latreon/tabstyr.git
cd tabstyr
npm install
node scripts/make-icons.mjs   # generate icons (once)
npm run build                 # Chromium → dist/chrome-mv3
npm run build:firefox         # Firefox  → dist/firefox-mv2
```

- **Chromium:** open `chrome://extensions` → enable **Developer mode** →
  **Load unpacked** → select `dist/chrome-mv3`.
- **Firefox:** open `about:debugging` → **This Firefox** → **Load Temporary
  Add-on** → pick any file inside `dist/firefox-mv2`.

## How the metrics work

What each number actually means:

- **Active time** = `total tracked − background audio`. This is foreground
  engagement and is the primary number everywhere. It excludes internal pages
  (`chrome://`, `newtab`, …), so the headline total always equals the sum of the
  sites you see listed.
- **Background audio** is shown separately (e.g. `♪ +30m`) — counted, never folded
  into the active total.
- **Focus %** = `productive ÷ (productive + distracting)`. Work and Dev count as
  productive; Social and Media as distracting; the rest are neutral and ignored.
  Re-categorize any site to change how it's counted. Target is 50%.
- **Streak** = consecutive days meeting the focus target.
- **Stale** = a tab you haven't focused for longer than your threshold (default 3
  days) and haven't snoozed.
- **Open tabs by time** = for each site you currently have open, its total active
  time over the 90-day window. Built from daily per-domain totals, so the number is
  stable across browser restarts (it doesn't depend on volatile tab IDs).
- **Sessions** are split every minute by a heartbeat and capped at 30 minutes, so a
  sleeping/suspended machine can't inflate your totals. (Media playback is exempt from
  the cap so a long video still reports its full watch time.)

## Development

```bash
npm run dev                 # Chromium with hot reload
npm run dev -- -b firefox   # Firefox with hot reload
```

### Quality gates

```bash
npm run typecheck   # vue-tsc — zero type errors
npm test            # unit tests (Vitest)
npm run e2e         # Playwright end-to-end in Chromium (run `npm run build` first)
```

### Building for release

```bash
npm run build            # Chromium  → dist/chrome-mv3
npm run build:firefox    # Firefox   → dist/firefox-mv2
npm run build:safari     # Safari    → dist/safari-mv2 (then convert with Xcode)
npm run zip              # Chromium store-ready zip
npm run zip:firefox      # Firefox store-ready zip
node scripts/make-promo.mjs   # regenerate promo images
```

## Architecture

TabStyr separates a pure, well-tested core from a thin platform layer and the UI.

- **`entrypoints/background.ts`** — the tracking driver. Listens to tab/window/idle
  events and alarms, runs the engine, and persists results. Handles Chrome MV3
  (`action`, `service_worker`) vs Firefox MV2 (`browser_action`, background
  scripts), and degrades safely where APIs are missing (e.g. Safari has no `idle`).
- **`lib/tracker/`** — a pure session state machine (`engine.ts`), daily rollup
  (`aggregate.ts`), and stale/notify logic (`stale.ts`). No browser APIs, fully
  unit-tested.
- **`lib/db/`** — IndexedDB access via [idb](https://github.com/jakearchibald/idb).
  Per-tab time is attributed by a stable key so it survives tab-ID reuse; sessions
  and daily stats are committed atomically.
- **`lib/`** — pure helpers: `time`, `trend`, `heatmap`, `categories`,
  `productivity`, `worklog`, `export`, `metrics`, `domain`, plus `crypto` +
  `restore` (encrypted backup / validated import) and `i18n/` (6 locales).
- **`composables/useStats.ts`** — the dashboard's data layer (Vue composable).
- **`components/`, `entrypoints/{popup,dashboard}`** — Vue 3 UI.

### Project structure

```
entrypoints/      background + popup + dashboard
components/       Vue UI (incl. ui/ for SelectBox, ToggleSwitch, NumberStepper)
composables/      useStats, useTheme
lib/              pure logic (tracker/, db/, and helpers)
tests/            Vitest unit tests (mirrors lib/)
e2e/              Playwright end-to-end (Chromium)
scripts/          icon + promo generators
docs/store/       listing copy, privacy policy, QA checklist, promo, screenshots
```

### Tech stack

| Layer | Tooling |
|---|---|
| Framework | [WXT](https://wxt.dev) (cross-browser extension framework) |
| UI | [Vue 3](https://vuejs.org) + `<script setup>`, scoped CSS |
| i18n | [vue-i18n](https://vue-i18n.intlify.dev) — 6 locales |
| Language | [TypeScript](https://www.typescriptlang.org) (strict) |
| Build | [Vite](https://vitejs.dev) (via WXT) |
| Storage | [IndexedDB](https://developer.mozilla.org/docs/Web/API/IndexedDB_API) via [idb](https://github.com/jakearchibald/idb) |
| Unit tests | [Vitest](https://vitest.dev) + fake-indexeddb |
| E2E | [Playwright](https://playwright.dev) (loads the real extension in Chromium) |
| Type-check | [vue-tsc](https://github.com/vuejs/language-tools) |
| CI | GitHub Actions |

Runtime dependencies are just **`vue`**, **`vue-i18n`**, and **`idb`** —
everything else is dev-only.

## Testing

- **Unit** (Vitest) — every `lib/` module, including an end-to-end tracking-flow
  test that runs the real engine → key-stamp → DB → read pipeline.
- **End-to-end** (Playwright) — loads the built extension in Chromium and verifies
  the popup, dashboard tiles, export, theme toggle, live tracking, and tab focus;
  it also captures the screenshots used above.

```bash
npm run build && npm run e2e
```

## Safari

Safari can't load a web-extension folder directly — it must be wrapped in an Xcode
app (requires macOS + Xcode). Build, then convert:

```bash
npm run build:safari   # → dist/safari-mv2
xcrun safari-web-extension-converter dist/safari-mv2 \
  --app-name "TabStyr" --bundle-identifier io.github.latreon.tabstyr --macos-only
```

Open the generated Xcode project, set your signing team, build & run, then enable
**TabStyr** in Safari → Settings → Extensions. Distribute via the App Store.

Safari lacks `idle`, `notifications`, and `favicon`, and needs **16.4+** for
`storage.session`; TabStyr degrades gracefully on each (no idle-pause, no stale
notification, letter-chip icons, and engine state simply rebuilt on cold start
where session storage is missing). Core tracking, dashboard, categories, focus,
export, and stale detection all work. Step-by-step:
[docs/store/browser-support.md](docs/store/browser-support.md).

## Roadmap

- Time budgets / limits per category with badge + alerts
- Day timeline ribbon and year-in-pixels views
- Store releases (Chrome, Edge, Firefox)

## Contributing

Issues and pull requests are welcome. Before opening a PR:

```bash
npm run typecheck && npm test && npm run build
```

Keep changes focused, add tests for new `lib/` logic, and follow the existing
file conventions.

## License

[MIT](LICENSE) © 2026 latreon
