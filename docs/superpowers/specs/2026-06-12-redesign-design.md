# Tab Time — Visual Redesign + Interaction Upgrades

**Date:** 2026-06-12
**Status:** Approved design
**Supersedes:** visual sections of `2026-06-11-tab-time-design.md` (tracking engine, storage, and nudge logic unchanged)

## Problem

The MVP works, but the user finds the design dated. Five requirements:
1. Real icon/logo instead of the solid orange square.
2. Redesigned popup: wider, favicons, modern.
3. Trend chart: axis labels + hover tooltips.
4. Clicking a site (top sites) or tab (tab table) should open/focus it.
5. Full visual redesign — elegant, high-value, premium feel.

## Decisions (user-selected from mockups)

| Decision | Choice |
|---|---|
| Design direction | **Dual theme** — dark luxury glass + light premium, system-aware with manual toggle |
| Accent | Violet→blue gradient (`#a78bfa` → `#60a5fa`); amber for stale/warn |
| Icon | **Time ring** — gradient progress ring + clock hands on rounded-square plate |
| Popup layout | **Hero + ranked list** — gradient total, top 5 sites with favicons and progress bars |
| Typography | Inter variable (latin subset, bundled locally, `font-display: swap`) |

## Non-Goals

- No tracking/storage/notification logic changes (except new `theme` setting).
- No remote requests of any kind — including favicons (privacy promise stands).
- No new pages or features beyond the five requirements.

## Architecture

### Theme system

- `assets/theme.css` — the single token source. Two complete token sets under `[data-theme='dark']` and `[data-theme='light']`: surfaces, card/glass backgrounds, borders, three text tiers, gradient accent (as both `--accent-gradient` and solid `--accent`), warn set, shadow set, divider. Components reference tokens only; zero hardcoded colors in components after this change.
- Dark: near-black `#0a0a0f` canvas, radial violet glow at page top, translucent glass tiles (`rgba(255,255,255,.04–.08)` + 1px white-alpha border).
- Light: `#fbfbfd` canvas, white cards, layered soft shadows, same gradient accent.
- `composables/useTheme.ts` — resolves `settings.theme: 'system' | 'dark' | 'light'` (new Settings field, default `'system'`), sets `data-theme` on `<html>`, subscribes to `prefers-color-scheme` when on system. Pure resolution helper `resolveTheme(setting, systemPrefersDark)` unit-tested.
- Theme toggle (cycles system → dark → light) in dashboard header and popup header; persists via `saveSettings`.
- Inter variable font: woff2 latin subset bundled in `public/fonts/`, `@font-face` in theme.css, used for all UI; tabular numerals for stats.

### Icon

- `assets/icon.svg` — master: rounded-square plate, track ring, gradient progress arc (~270°), white clock hands.
- `scripts/make-icons.mjs` rewritten to rasterize the SVG via `sharp` (devDependency, build-time only) to 16/32/48/96/128 PNG. 16px renders a simplified variant (no plate, thicker ring) embedded in the same script for legibility.

### Favicons — `lib/favicon.ts`

- `faviconUrl(domain)`: Chrome/Edge `_favicon/?pageUrl=https://<domain>/&size=32` runtime URL (requires `favicon` permission — Chromium-only manifest key, scoped per-browser in wxt.config).
- `letterChip(domain)`: deterministic fallback — first letter + background color from domain hash (fixed palette of 8 accent-compatible colors). Used on Firefox and on favicon load error (`@error` on img swaps to chip).
- Both pure, unit-tested.

### Chart scale — `lib/chart-scale.ts`

- `yTicks(maxSeconds)`: returns 3 "nice" tick values (e.g. 30m / 1h / 1h 30m) covering max; pure, unit-tested.
- `xTickEvery(mode)`: day → every 2nd label, week/month → every label.

## Surfaces

### Popup (360px, layout A)

- Header: ring logo (inline SVG) + "TabTime" wordmark; right: "N tabs · M stale" (stale amber, hidden at 0); theme toggle.
- Hero: 34px gradient-text total, delta chip (green ↑ / red ↓, hidden when no avg or zero), subline "active today · vs weekly average".
- Top 5 sites: rows of favicon chip + domain + duration + thin gradient progress bar relative to top site. Entire row is a button → `browser.tabs.create({ url: 'https://<domain>' })`.
- Footer: gradient "Dashboard" button; amber "M stale" button → opens `/dashboard.html#stale`.
- Loading: skeleton shimmer blocks. Error state retained.

### Dashboard

- Layout/structure unchanged (bento grid); every component re-skinned with tokens.
- Header: ring logo + wordmark, "Local only · 90 days", theme toggle.
- HeroTile: gradient number, gradient-filled area sparkline.
- TopSitesChart: favicon chips, gradient bars, audio segment lighter with "♪" suffix in time text; row click opens `https://<domain>` in new tab.
- **TrendChart**: Y axis — 3 gridlines + duration labels from `yTicks`; X axis — date labels per `xTickEvery`; hover/focus — bar highlight + floating tooltip div (`<weekday> <date> — <duration>`, week mode: "Week of <date>", month mode: "<Month YYYY>"). Bars are keyboard-focusable (`tabindex="0"`), tooltip shows on focus. No `title` attributes.
- TabTable: favicon in title cell; row click (and Enter on focused row) → `browser.tabs.update(tabId, { active: true })` + `browser.windows.update(windowId, { focused: true })` (windowId via `tabs.get`). Hover affordance.
- StaleList: favicon chips; clicking title focuses the tab (same mechanism); Keep/Close unchanged. Dashboard scrolls to it when URL hash is `#stale`.
- SettingsPanel: re-skinned; new "Theme" select (System/Dark/Light) wired to `settings.theme`.

### Settings change

- `Settings` gains `theme: 'system' | 'dark' | 'light'` (default `'system'`); coerce() validates; background ignores it (UI-only).

## Manifest

- Chromium targets: add `favicon` permission. Firefox: omit (per-browser manifest function already in place).

## Testing

- Unit (new): `resolveTheme`, `faviconUrl`, `letterChip` (determinism + palette bounds), `yTicks` (nice values, covers max), tooltip label formatting.
- Existing 67 unit tests must stay green (no logic changes).
- E2E: update selectors; add theme-toggle test (data-theme attribute flips); add tab-focus test (click row → tab active); Playwright screenshots: popup + dashboard × dark + light, saved to `e2e/__screenshots__/` as review artifacts.

## Risks

| Risk | Mitigation |
|---|---|
| `_favicon` API quirks (needs `favicon` permission, exact URL format) | letter-chip fallback on error; E2E asserts chip OR favicon renders |
| sharp install size/platform | devDependency only; icon PNGs stay committed, regeneration optional |
| Glass effect perf (backdrop-filter) on big tables | apply backdrop-filter only to small tiles, not table containers |
| Inter font licensing | OFL — fine to bundle |
