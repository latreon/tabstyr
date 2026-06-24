# TabStyr — Store Listing Copy

Copy/paste into the Chrome Web Store, Edge Add-ons, and Firefox AMO listings.
Adjust lengths per store limits where noted.

## Name

TabStyr — Local Browsing Time Tracker

## Short description (≤132 chars, Chrome)

See how you really use your browser — active time per site, trends, heatmaps,
and focus. 100% private, all data stays local.

## Summary (Firefox AMO, ≤250 chars)

TabStyr tracks your active time per tab and site and turns it into trends, an
hourly heatmap, category and focus breakdowns, and gentle stale-tab nudges.
Everything stays on your device — no servers, no accounts, no tracking.

## Detailed description

TabStyr shows how you actually spend time in your browser — and keeps every
byte of it on your own machine.

WHAT YOU GET
• Today at a glance — active time, vs your weekly average, with a sparkline.
• Trends — day, week, and month views.
• Activity heatmap — see which hours of which days you browse most.
• Time by category — Work, Dev, Finance, Social, Media, News, Shopping. Hundreds
  of sites recognized worldwide; re-classify any site or add your own rules.
• Focus — a daily focus % (productive vs distracting time) and a streak.
• Top sites & per-tab table — with a detail view for any site.
• "What did I work on?" — pick a day and copy a tidy list of sites, perfect for
  standups and invoices.
• Stale-tab nudges — a badge count and an optional once-a-day reminder for tabs
  you've forgotten.
• Week-over-week & month-over-month comparison, with per-category deltas.
• Export — your full history as JSON, plus passphrase-encrypted backups you can restore on any device.

PRIVACY FIRST — 0 BYTES LEAVE YOUR DEVICE
• 100% local. Stored in your browser (IndexedDB), pruned to a 90-day window.
• No servers, no accounts, no analytics, no ads. The extension makes no automated
  network requests — the only outbound link is the optional "Buy me a coffee"
  button, which opens a Polar checkout page in a new tab when you choose to click it.
• Doesn't read page content — only the tab info the browser already provides.
• Your data is portable without a cloud: passphrase-encrypted backup (AES-256-GCM),
  restore on any device, or wipe everything in one click.
• Unlike cloud trackers, nothing is ever uploaded — there's no backend to upload to.

HONEST METRICS
The headline number is your active foreground time. Background audio is counted
and shown separately, so your totals never exceed real time at the computer.

Open source. Works on Chrome and other Chromium-based browsers.

> Chrome Web Store note: do NOT list competing browser brands (Edge, Brave, Opera,
> Vivaldi, Arc, Firefox, …) in the CWS description — it is rejected as "keyword
> spam" (irrelevant/excessive keywords). Keep the per-browser support matrix in
> README.md / docs/store/browser-support.md instead.

## Category

Productivity

## Keywords / tags

time tracking, screen time, productivity, browsing time, focus,
privacy, local, heatmap, website usage

## Single purpose (Chrome Web Store requirement)

TabStyr measures and displays the time you spend on browser tabs and websites,
entirely on your own device, to help you understand and manage your browsing.

## Permission justifications (Chrome Web Store review)

- tabs: Read the active tab's URL/title to attribute browsing time to the correct
  site. No page content is accessed.
- storage: Persist usage statistics and user settings locally.
- idle: Pause time tracking when the user is away so totals stay accurate.
- alarms: Run periodic checkpoints and a once-daily maintenance/notification task.
- notifications: Show an optional, at-most-once-per-day stale-tab reminder.
- webNavigation: Detect in-page (single-page-app) route changes on the active tab
  so browsing time is attributed to the page actually viewed. Only the focused
  tab's top-frame URL is read; no page content is accessed.
- favicon: Display website icons in lists (Chromium only).

## Screenshots & promo images

- Promo tiles: `docs/store/promo/*.png` (regenerate with `node scripts/make-promo.mjs`).
- UI screenshots: `docs/store/screenshots/*.png` — popup + dashboard, light + dark,
  refreshed from the current build (`npm run e2e`). These show seeded sample data,
  not empty states. Recapture if the UI changes again before submitting.

## Privacy policy URL

Use the live policy page on the marketing site:

  https://tabstyr.com/privacy

The same policy also ships inside the extension at `/privacy.html` (linked from the
popup and dashboard). Keep the wording on tabstyr.com/privacy, this file, and the
in-extension page in sync.
