# Tabtelo

A privacy-first browser extension that shows how you actually use your browser —
active time per tab and per site, trends, an activity heatmap, category and focus
breakdowns, and gentle stale-tab nudges.

**All data stays on your device** (IndexedDB, 90-day rolling window). No servers,
no accounts, no network requests, no tracking.

![Tabtelo](docs/store/promo/marquee-1400x560.png)

## Features

- **Active-time tracking** — idle-aware and audio-aware, per tab and per domain.
  The headline metric is *active foreground time*; background audio is shown
  separately so totals never exceed wall-clock time.
- **Dashboard** — today's total, open/stale tab counts, top sites, day/week/month
  trend, **hourly activity heatmap**, **time-by-category** (Work/Dev/Social/Media/…),
  **focus % + streak**, **per-tab table**, and a stale-tab list with Close/Keep.
- **Per-domain detail** — click any site for its trend, sessions, share of time,
  and its own hourly heatmap.
- **"What did I work on?"** — pick any day, get a clean, copy-pasteable list of the
  sites you were on. Handy for standups and invoices.
- **Categories** — domains auto-grouped, fully re-classifiable per site.
- **Export** — JSON backup + CSV (daily totals or raw session log).
- **Toolbar popup** — today's active total, top sites, stale count.
- **Stale-tab nudges** — badge count + at most one notification per day.
- **Themes** — system-aware dark/light with a manual toggle.

## Privacy

Tabtelo is 100% local. It stores activity in the browser's IndexedDB and never
sends anything anywhere. See [PRIVACY.md](docs/store/privacy-policy.md).

Permissions used: `tabs`, `storage`, `idle`, `alarms`, `notifications`, and
`favicon` (Chromium only, for site icons). No host permissions.

## Browser support

| Browser | Status |
|---|---|
| Chrome, Edge, Brave, Opera, Vivaldi, Arc (Chromium MV3) | ✅ Supported |
| Firefox 115+ (MV2 build) | ✅ Supported (favicons fall back to letter chips) |
| Safari 16.4+ | ⚠️ Works after Xcode conversion, with reduced features (see below) |

## Install (unpacked, for development)

```bash
npm install
node scripts/make-icons.mjs   # generate icons (once)
npm run build                 # Chrome/Edge  → dist/chrome-mv3
npm run build:firefox         # Firefox      → dist/firefox-mv2
```

- **Chromium:** `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome-mv3`
- **Firefox:** `about:debugging` → This Firefox → Load Temporary Add-on → pick any file in `dist/firefox-mv2`

## Development

```bash
npm run dev                 # Chromium with HMR
npm run dev -- -b firefox   # Firefox with HMR
```

## Quality gates

```bash
npm run typecheck   # vue-tsc, zero errors
npm test            # unit tests (Vitest)
npm run e2e         # Playwright end-to-end in Chromium (run `npm run build` first)
```

## Safari

Not built by WXT — convert the Chromium build:

```bash
xcrun safari-web-extension-converter dist/chrome-mv3
```

The conversion succeeds. Safari does **not** support three APIs the extension
uses, which the code degrades gracefully around (verified):

- **`idle`** — no idle-pause; the 10-minute per-session cap still bounds away-time.
- **`notifications`** — no daily stale-tab reminder (the badge count still works).
- **`favicon`** — site icons fall back to colored letter chips.

Core tracking, the dashboard, categories, focus, export, and stale detection all
work. Open the generated Xcode project, test on a real build, and distribute via
the App Store or notarization (Apple Developer account required).

## Architecture

- `entrypoints/background.ts` — the tracking engine driver (events, alarms,
  persistence). Handles Chrome MV3 `action` vs Firefox MV2 `browserAction`.
- `lib/tracker/` — pure session state machine + rollup/stale logic.
- `lib/db/` — IndexedDB (idb) repository; per-tab time attributed by a stable key
  so totals survive tab-ID reuse across restarts.
- `lib/` — pure, unit-tested helpers (time, trend, heatmap, categories,
  productivity, worklog, export, metrics).
- `components/`, `entrypoints/{popup,dashboard}` — Vue 3 UI.

## License

[MIT](LICENSE) © 2026 Farda Karimov
