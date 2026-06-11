# Tab Time

Browser extension that tracks how you actually use your browser: active time
per tab and per site, daily/weekly/monthly trends, and stale-tab nudges.
All data stays on your machine (IndexedDB, 90-day rolling window). No remote calls.

## Features

- Idle-aware, audio-aware active-time tracking per tab and domain
- Bento dashboard: today hero, open/stale tab counts, top sites, trends,
  per-tab table, stale-tab list with Close/Keep
- Toolbar popup with today's total and top 3 sites
- Badge count + max-one-per-day notification for stale tabs
- Settings: stale threshold, idle timeout, background-audio counting, data wipe

## Development

```bash
npm install
node scripts/make-icons.mjs   # once, generates placeholder icons
npm run dev                   # Chromium with HMR
npm run dev -- -b firefox     # Firefox
```

## Build

```bash
npm run build            # Chrome/Edge (.output/chrome-mv3)
npm run build:firefox    # Firefox (.output/firefox-mv2)
npm run zip              # store-ready zip
```

Load unpacked: chrome://extensions → Developer mode → Load unpacked → `.output/chrome-mv3`.

## Tests

```bash
npm test                 # unit (Vitest)
npm run e2e              # Playwright (requires npm run build first)
```

## Firefox notes

WXT targets **Manifest V2** for Firefox (`firefox-mv2`). Key manifest differences
from the Chrome MV3 build:

| Feature | Chrome MV3 | Firefox MV2 |
|---|---|---|
| Manifest version | 3 | 2 |
| Toolbar API | `action` | `browser_action` |
| Background | `service_worker` | `scripts` array |

`entrypoints/background.ts` handles this automatically via the `actionApi` shim
on line 11:
```ts
const actionApi = browser.action ?? (browser as any).browserAction;
```

## Release smoke checklist (Chrome + Edge + Firefox)

- [ ] Tracking accrues time while browsing; pauses when idle/unfocused
- [ ] Background YouTube audio counts (when enabled)
- [ ] Popup and dashboard open and show data
- [ ] Badge shows stale count; notification fires at most once/day
- [ ] Settings persist; wipe clears everything

## Known limitations

- After a browser restart, per-tab time in the "Open tabs by time" table starts
  fresh: tab IDs are re-matched by URL for staleness tracking, but historical
  sessions keep their old tab IDs. Per-site stats are unaffected.
- The dashboard reads and writes IndexedDB directly (close/snooze actions);
  only settings changes and data wipe go through the background worker.
- Firefox requires version 115+ (storage.session).
