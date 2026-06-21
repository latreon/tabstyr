# Known Limitations & Accepted Edge Cases

These are deliberate trade-offs, not bugs. They are low-impact and documented here
so they aren't mistaken for defects during review or QA.

## Tracking

- **Local-time day keys.** Daily totals are bucketed by the device's local date
  (`lib/time.ts` `dateKey`). If you change timezone while travelling, the rows
  recorded before the change keep their original local-date keys. Counting stays
  correct; only the day a total is filed under can shift on a timezone-change day.
  Chosen over UTC so "today" always matches the user's wall clock.

- **SPA breakdown is path-granular, not per-view.** In-page navigations are
  attributed to the normalized page path (`pageOf` strips the query string). Two
  YouTube videos both map to `youtube.com/watch`, so the per-page breakdown groups
  by path, not by individual video. Domain and category totals are unaffected.

- **Cold-start key attribution (first event after browser restart).** On a cold
  start the engine restores in parallel with `onStartup`'s tab-meta rematch
  (`entrypoints/background.ts`). If a tab-activated event lands in the sub-second
  window before rematch completes, that single session may get a fresh per-tab key
  instead of the restored one. At most one session's per-tab attribution is
  affected; daily/domain totals are never wrong.

- **Restart rematch when several tabs share a domain.** `rematchTabMeta`
  (`lib/tracker/stale.ts`) falls back to a domain-level match when a restored URL
  drifted (dropped fragment, redirect). With two+ tabs on the same domain the
  stable per-tab key can be assigned to the wrong one of them. This only scrambles
  per-tab display attribution after a restart, not totals.

## Performance

- **Domain-detail modal recomputes on open.** Opening a site's detail view filters
  the 90-day session set for that domain and runs `coalesceSessions` /
  `topSubPages` over it (`components/DomainDetail.vue`). For a very heavy single
  domain this is a brief synchronous pass. It is user-initiated and one-shot (not a
  hot path), so it is left un-cached for simplicity.

## i18n

- **Duration unit suffixes are not localized.** `formatDuration` emits compact
  `m` / `h` / `d` suffixes (`"3h 12m"`). These are treated as quasi-universal
  symbols and kept un-translated so the pure time utility (also used by
  background notifications) needs no i18n dependency.
