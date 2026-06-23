# TabStyr — Privacy Policy

_Last updated: 2026-06-12_

## Summary

**TabStyr does not collect, transmit, or share any data.** Everything it records
stays on your device. There are no servers, no analytics, no accounts, and the
extension makes no automated network requests. The only outbound connection is
one you initiate yourself: clicking the optional "Buy me a coffee" link opens
a Polar checkout page (buy.polar.sh) in a new browser tab.

## What the extension stores

To show you your usage statistics, TabStyr stores the following **locally**, in
your browser's IndexedDB:

- **Session records** — start/end timestamps, the page's domain, and whether the
  tab was playing audio.
- **Daily per-domain totals** — aggregated seconds per site per day.
- **Open-tab metadata** — for tabs you've visited: title, URL, last-active time,
  and a randomly generated local identifier used to attribute time correctly.
- **Settings** — your preferences (stale threshold, idle timeout, theme,
  background-audio counting, category overrides and custom rules).

This data is kept for a rolling **90-day window** and older data is pruned
automatically.

## What it does NOT do

- It does **not** send any data off your device.
- It does **not** use remote servers, cloud sync, or third-party analytics.
- It does **not** contain ads or trackers.
- It does **not** read page contents — only tab metadata (URL/title) provided by
  the browser's standard extension APIs.
- It does **not** contact any server on its own. The optional "Buy me a coffee"
  link only opens a Polar checkout page in a new tab when you click it; nothing is sent.

## Permissions and why they're needed

| Permission | Purpose |
|---|---|
| `tabs` | See which tab is active and its URL/title to attribute time |
| `storage` | Save your stats and settings locally |
| `idle` | Pause tracking when you step away |
| `alarms` | Periodic checkpoints and the daily maintenance/notification |
| `notifications` | Optional once-a-day stale-tab reminder |
| `webNavigation` | Detect in-page (SPA) route changes on the active tab so time is credited to the page you're actually on |
| `favicon` (Chromium only) | Show site icons in lists |

No host permissions are requested; the extension cannot access the content of the
pages you visit.

## Your control over your data

- **Export** your full history any time (JSON) from Settings.
- **Encrypted backup** — optionally protect a JSON backup with a passphrase
  (AES-256-GCM, key derived via PBKDF2). The passphrase never leaves your device
  and cannot be recovered.
- **Restore** from a backup file (plain or encrypted), on this or another device —
  portability with no server involved.
- **Wipe all data** with one click in Settings; this permanently deletes
  everything stored locally.
- Removing the extension deletes its local storage.

## Contact

Questions about privacy: open an issue on the project's repository.
