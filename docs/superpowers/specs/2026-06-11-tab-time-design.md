# Tab Time — Browser Tab Activity Tracker

**Date:** 2026-06-11
**Status:** Approved design

## Problem

Too many open tabs, no visibility into browser usage. The user wants to know how much time they spend in the browser, which tabs/sites consume that time, and which open tabs are stale clutter.

## Goals

1. Track active time per tab and per domain, accurately (idle-aware, audio-aware).
2. Show daily/weekly/monthly usage insight in a dashboard.
3. Nudge about stale tabs (badge count + summary notification) and make them easy to close.
4. Work on Chrome (primary), Edge, and Firefox from one codebase.
5. All data stays local. No remote calls of any kind.

## Non-Goals (out of scope)

- Auto-suspending or auto-closing tabs.
- Cross-device sync.
- Per-page content analysis (no content scripts).
- Blocking/limiting site usage (not a focus-control tool).

## Key Decisions

| Decision | Choice |
|---|---|
| Scope | Insight + stale-tab cleanup nudges (no auto-management) |
| Granularity | Per-tab tracking with per-domain rollups |
| Active time | Focused tab + idle-aware (60s default) + background audio counts |
| Storage | Local IndexedDB, rolling 90-day retention |
| UI | Toolbar popup (quick glance) + full-page dashboard (bento grid layout) |
| Nudges | Badge count + max-one-per-day summary notification |
| Stack | WXT + Vue 3 + TypeScript |

## Architecture

```
┌─────────────────────────────────────────────┐
│ Background service worker (plain TS)        │
│  ├─ TrackerEngine: session bookkeeping      │
│  ├─ StaleDetector: lastActiveAt scanning    │
│  ├─ Aggregator: daily domain rollups        │
│  └─ Pruner: 90-day retention                │
├─────────────────────────────────────────────┤
│ Storage layer                                │
│  ├─ IndexedDB: sessions, dailyDomainStats,  │
│  │             tabMeta                       │
│  └─ chrome.storage.session: open-session    │
│     state (worker-death recovery)            │
├─────────────────────────────────────────────┤
│ UI (Vue 3)                                   │
│  ├─ Popup: today total, top 3, stale count  │
│  └─ Dashboard: bento grid, charts, tables,  │
│     stale list, settings                     │
└─────────────────────────────────────────────┘
```

UI reads storage directly (read-only) and sends commands (close tab, snooze, settings change) to the background worker via runtime messaging.

### Tracking engine

A **session** is a continuous interval of active time for one tab: `{id, tabId, url, domain, start, end, audio}`.

Event handling (all in background worker):

- `tabs.onActivated` / `windows.onFocusChanged` — close session for previous tab, open session for newly focused tab. Browser losing OS focus closes the focused session.
- `idle.onStateChanged` (threshold 60s, configurable) — on `idle`/`locked`, close focused session. On `active`, reopen for the currently focused tab. Idle does NOT close audio sessions.
- `tabs.onUpdated` — `audible` becoming true on an unfocused tab opens a parallel audio session (`audio: true`); becoming false closes it. URL change in a tracked tab closes the session and opens a new one under the new URL/domain.
- `tabs.onRemoved` — close any session for that tab; mark tabMeta removed.

Audio rule: background audio sessions run in parallel with the focused-tab session — both accumulate time. The `audio` flag lets the dashboard show "of it Xm background audio."

**MV3 worker-death resilience:**
- Every event immediately persists open-session state to `chrome.storage.session`.
- A `chrome.alarms` heartbeat (1 min) flushes accumulated time to IndexedDB and re-persists open sessions.
- On worker startup, recover open sessions from `chrome.storage.session`, reconcile against actual tab/focus/idle state (query `tabs`, `windows`, `idle`), and close anything that no longer holds.
- Worst-case data loss: ~1 minute.

### Stale-tab detection

- `tabMeta.lastActiveAt` updated whenever a tab gains a session.
- Stale = `now - lastActiveAt > threshold` (default 3 days, configurable).
- Checked by daily alarm and on dashboard open.
- Badge shows stale count (hidden at 0).
- One summary system notification per day max, only when *new* tabs cross the threshold ("5 tabs untouched for 3 days"); clicking it opens the dashboard.
- "Keep" on a stale tab snoozes it for one threshold period (sets `snoozedUntil` on tabMeta).

### Data model (IndexedDB)

| Store | Shape | Purpose |
|---|---|---|
| `sessions` | `{id, tabId, url, domain, start, end, audio}` | Raw detail; per-tab stats, timeline-grade data |
| `dailyDomainStats` | `{date, domain, seconds, audioSeconds}` | Pre-aggregated on flush; powers all charts cheaply |
| `tabMeta` | `{tabId, url, title, lastActiveAt, createdAt, snoozedUntil?}` | Stale detection, per-tab table |

- Aggregator updates `dailyDomainStats` on every heartbeat flush.
- Daily prune alarm deletes `sessions` rows and `dailyDomainStats` rows older than 90 days, and `tabMeta` rows for closed tabs.

### Permissions

`tabs`, `storage`, `idle`, `alarms`, `notifications`. No host permissions, no content scripts.

## UI

### Dashboard (extension page, bento grid)

Tiles:
1. **Time today** — hero tile (dark surface), big number, sparkline, % vs weekly average.
2. **Open tabs** — count.
3. **Stale tabs** — count, warm accent surface.
4. **Top sites** — horizontal bar chart, audio time shown as split segment per bar.
5. **Trend** — chart with day/week/month toggle (from `dailyDomainStats`).
6. **Per-tab table** — sortable by time and last-active.
7. **Stale tabs list** — each row: title, domain, last active, [Close] [Keep].
8. **Settings** — stale threshold (days), idle timeout (seconds), audio counting on/off, "wipe all data" button (with confirm).

Visual direction: light theme, deliberate warm coral accent (per chosen bento mock), dark hero tile for contrast. Not a gray template. Charts: chart.js or hand-rolled SVG — decide at implementation against bundle budget (<80KB gzipped JS, microsite class).

### Popup

Mini bento: today total, top 3 domains, stale count, one "Open dashboard" button. No charts — must open instantly.

## Cross-browser

- WXT generates per-browser builds: Chrome/Edge share the Chromium MV3 build; Firefox build via WXT's Firefox target.
- Browser API access through WXT's unified `browser` interface.
- Firefox caveats to verify at implementation: `chrome.storage.session` support, notification behavior, badge API differences.

## Testing

1. **Unit (Vitest)** — TrackerEngine as pure logic with injected browser-API + clock fakes. Scenarios: tab switch, window blur/focus, idle pause/resume, audio parallel sessions, URL change mid-session, worker-restart recovery, rollup aggregation, stale detection + snooze, prune. Target: engine and aggregation fully covered (≥80%).
2. **E2E (Playwright, Chromium)** — load built extension, open tabs, verify popup numbers and dashboard tiles render.
3. **Manual smoke matrix** — Edge + Firefox per release: tracking works, popup/dashboard open, badge updates.

## Risks

| Risk | Mitigation |
|---|---|
| MV3 worker killed mid-session | storage.session checkpoint + 1-min heartbeat; ≤1 min loss |
| Event edge cases (multi-window, fullscreen video, OS sleep) | reconcile-on-wake logic; unit-test event sequences; idle API covers OS lock |
| Firefox API gaps | WXT abstraction + smoke test; fall back to storage.local for session state if needed |
| IndexedDB growth | daily prune + pre-aggregated stats keep reads fast |
| Tab IDs reset on browser restart | on startup, re-match `tabMeta` rows to live tabs by URL (+ window position as tiebreak); unmatched rows treated as closed |
