import { domainOf, isWebDomain, pageOf } from '../domain';
import type { ClosedSession, EngineState, OpenSession } from '../types';

const MIN_SESSION_MS = 1000;
// Sleep/suspend backstop. The heartbeat normally splits active time into ≤1-minute
// chunks, but Chrome can throttle MV3 alarms during long PASSIVE use. We therefore
// only cap sessions that are NOT playing media — a focused tab playing audio/video
// (or a background-audio tab) is genuine continuous use and is counted in full, so
// a 2-hour video watched without input still reports ~2 hours. A non-playing tab
// that spans a long gap (e.g. the machine slept) is capped.
const MAX_SESSION_MS = 30 * 60_000;
// Absolute hard ceiling applied to EVERY session — media included. A single
// continuous slice can never legitimately exceed this; a longer span means the
// system clock jumped forward (NTP correction, manual change, VM resume) while a
// media/audio session was open and uncapped. Without this, one bad timestamp
// books hours or days of bogus time onto an uncapped media session. 24h is well
// beyond any real heartbeat interval, so genuine media is never clipped by it.
const ABSOLUTE_MAX_SESSION_MS = 24 * 60 * 60_000;

export class TrackerEngine {
  private focused: OpenSession | null;
  private audio: Map<number, OpenSession>;
  private idle: boolean;

  constructor(state?: EngineState | null) {
    this.focused = state?.focused ? { ...state.focused } : null;
    this.audio = new Map((state?.audio ?? []).map((s) => [s.tabId, { ...s }]));
    this.idle = state?.isIdle ?? false;
  }

  getState(): EngineState {
    return {
      focused: this.focused ? { ...this.focused } : null,
      audio: [...this.audio.values()].map((s) => ({ ...s })),
      isIdle: this.idle,
    };
  }

  // forceCap = the close happens because the user is away (idle/locked/sleep), so
  // even a media session must be bounded. Otherwise media sessions are never capped.
  private closed(open: OpenSession, now: number, forceCap = false): ClosedSession[] {
    const dur = now - open.start;
    // dur < MIN also covers a backward clock jump (now < start → negative dur):
    // the slice is dropped rather than stored with a negative/zero duration.
    if (dur < MIN_SESSION_MS) return [];
    const cappable = forceCap || (!open.audio && !open.audible);
    // Non-media (or forced) sessions cap at 30min; media caps at the 24h absolute
    // ceiling so a forward clock jump can't book a giant uncapped slice.
    const cap = cappable ? MAX_SESSION_MS : ABSOLUTE_MAX_SESSION_MS;
    const end = dur > cap ? open.start + cap : now;
    return [{ ...open, end }];
  }

  handleFocus(tabId: number, url: string, now: number, audible = false, paused = false): ClosedSession[] {
    this.idle = false;
    const page = pageOf(url);
    // Redundant re-focus of the already-focused tab+page — e.g. a cross-window tab
    // switch fires BOTH windows.onFocusChanged and tabs.onActivated for the same
    // tab, milliseconds apart. Closing + reopening here would drop the just-opened
    // sub-second slice (MIN_SESSION_MS) and lose that time on every such switch.
    // Keep the open session running; only refresh the media flag.
    if (this.focused && this.focused.tabId === tabId && this.focused.url === page) {
      this.focused.audible = audible;
      return [];
    }
    const out: ClosedSession[] = [];
    if (this.focused) out.push(...this.closed(this.focused, now));
    const bgAudio = this.audio.get(tabId);
    if (bgAudio) {
      out.push(...this.closed(bgAudio, now));
      this.audio.delete(tabId);
    }
    // Only track real web pages the user hasn't paused — internal pages
    // (chrome://, newtab, the dashboard) are never counted. Store the normalized
    // page URL (no query/fragment) so the sub-page breakdown groups cleanly and
    // no secrets are persisted.
    const domain = domainOf(url);
    this.focused = isWebDomain(domain) && !paused ? { tabId, url: page, domain, start: now, audio: false, audible } : null;
    return out;
  }

  /** Update whether the focused tab is currently playing media (keeps the cap off). */
  setFocusedAudible(audible: boolean): void {
    if (this.focused) this.focused.audible = audible;
  }

  handleBlur(now: number): ClosedSession[] {
    const out = this.focused ? this.closed(this.focused, now) : [];
    this.focused = null;
    return out;
  }

  /**
   * No user input. If the focused tab is playing media, the user is watching, so
   * keep counting. Otherwise stop. Background audio is stopped either way (you're
   * away from it).
   */
  handleIdle(now: number): ClosedSession[] {
    const out: ClosedSession[] = [];
    for (const open of this.audio.values()) out.push(...this.closed(open, now));
    this.audio.clear();
    // The user IS idle regardless of whether a playing media tab keeps its session
    // open — record that. (checkpoint() caps by elapsed time, not this flag, so the
    // video still counts; on resume, handleFocus's same-tab guard clears it without
    // breaking the session.)
    this.idle = true;
    if (this.focused?.audible) return out; // still watching — keep the session open
    if (this.focused) out.push(...this.closed(this.focused, now));
    this.focused = null;
    return out;
  }

  /** Screen locked / system asleep — definitely away. Close everything, capped. */
  handleLocked(now: number): ClosedSession[] {
    const out: ClosedSession[] = [];
    if (this.focused) out.push(...this.closed(this.focused, now, true));
    this.focused = null;
    for (const open of this.audio.values()) out.push(...this.closed(open, now, true));
    this.audio.clear();
    this.idle = true;
    return out;
  }

  checkpoint(now: number): ClosedSession[] {
    const out: ClosedSession[] = [];
    if (this.focused) {
      // A focused session only survives idle while it is playing media (handleIdle
      // keeps it open for a video the user is watching). Once that media stops the
      // user is idle AND nothing is playing — they're away, so close the session
      // instead of re-basing it. Without this the session would keep booking ~1-min
      // slices every heartbeat until the next real close event (screen lock, tab
      // close), turning an away period into hours of phantom active time.
      if (this.idle && !this.focused.audible) {
        out.push(...this.closed(this.focused, now, true));
        this.focused = null;
      } else {
        const emitted = this.closed(this.focused, now, this.stalled(this.focused, now));
        out.push(...emitted);
        if (emitted.length) this.focused = { ...this.focused, start: now };
      }
    }
    for (const [tabId, open] of this.audio) {
      const emitted = this.closed(open, now, this.stalled(open, now));
      out.push(...emitted);
      if (emitted.length) this.audio.set(tabId, { ...open, start: now });
    }
    return out;
  }

  // The heartbeat fires ~once a minute. A single slice far longer than that means
  // the heartbeat didn't fire on schedule — the system slept or the alarm was
  // heavily throttled, not genuine continuous use. Force-cap even a media session
  // in that case so a multi-hour nap with a video/audio tab left open can't book
  // hours of phantom time. Real playback still accrues fully because each on-time
  // heartbeat emits a ≤1-minute slice (well under this threshold).
  private stalled(open: OpenSession, now: number): boolean {
    return now - open.start > MAX_SESSION_MS;
  }

  /**
   * Service-worker cold start: in-memory continuity was lost and the gap since
   * the last persisted slice is unknown (the machine may have slept for hours).
   * Force-cap EVERY surviving session — media included — so an open audio/video
   * tab can't book the entire offline duration. Sessions whose tab is gone are
   * dropped; survivors re-base to `now` and resume counting.
   */
  reconcile(liveTabIds: Set<number>, now: number): ClosedSession[] {
    const out: ClosedSession[] = [];
    if (this.focused) {
      const emitted = this.closed(this.focused, now, true);
      out.push(...emitted);
      if (!liveTabIds.has(this.focused.tabId)) this.focused = null;
      else if (emitted.length) this.focused = { ...this.focused, start: now };
    }
    for (const [tabId, open] of this.audio) {
      const emitted = this.closed(open, now, true);
      out.push(...emitted);
      if (!liveTabIds.has(tabId)) this.audio.delete(tabId);
      else if (emitted.length) this.audio.set(tabId, { ...open, start: now });
    }
    return out;
  }

  syncAudio(audible: Array<{ tabId: number; url: string }>, now: number): ClosedSession[] {
    const out: ClosedSession[] = [];
    const keep = new Set<number>();
    for (const { tabId, url } of audible) {
      if (tabId === this.focused?.tabId) continue;
      if (!isWebDomain(domainOf(url))) continue; // ignore audio from internal pages
      keep.add(tabId);
      if (!this.audio.has(tabId)) {
        this.audio.set(tabId, { tabId, url: pageOf(url), domain: domainOf(url), start: now, audio: true });
      }
    }
    for (const [tabId, open] of this.audio) {
      if (!keep.has(tabId)) {
        out.push(...this.closed(open, now));
        this.audio.delete(tabId);
      }
    }
    return out;
  }

  // A navigation in `tabId`. For the FOCUSED tab we split on any page change —
  // domain OR sub-page path — so in-page (SPA) navigations like flipping between
  // YouTube videos are attributed to the page actually viewed, not lumped onto
  // the first URL the tab opened with. Background-AUDIO sessions split on domain
  // only: the sub-page of a music/video tab you're not looking at is noise, and
  // splitting it would multiply rows for no insight.
  handleUrlChange(tabId: number, url: string, now: number): ClosedSession[] {
    const out: ClosedSession[] = [];
    const domain = domainOf(url);
    const web = isWebDomain(domain);
    const page = pageOf(url);
    if (this.focused?.tabId === tabId && this.focused.url !== page) {
      const wasAudible = this.focused.audible;
      const emitted = this.closed(this.focused, now);
      out.push(...emitted);
      if (web) {
        // If the prior slice was sub-1s (rapid SPA churn), `closed` emits nothing;
        // keep the original start so that brief time rolls into the new page's
        // session instead of being dropped (mirrors checkpoint's sub-1s handling).
        const start = emitted.length ? now : this.focused.start;
        this.focused = { tabId, url: page, domain, start, audio: false, audible: wasAudible };
      } else {
        this.focused = null;
      }
    }
    const a = this.audio.get(tabId);
    if (a && a.domain !== domain) {
      out.push(...this.closed(a, now));
      if (web) this.audio.set(tabId, { tabId, url: page, domain, start: now, audio: true });
      else this.audio.delete(tabId);
    }
    return out;
  }

  /**
   * The browser swapped a tab's id while keeping its content (prerender
   * activation, discard/restore) — `tabs.onReplaced`. Remap any open session
   * from the old id to the new one so time keeps accruing continuously instead
   * of being orphaned (and later mis-closed by reconcile). No session is closed.
   * `now` is unused but kept for signature symmetry with the other handlers.
   */
  handleTabReplaced(removedTabId: number, addedTabId: number, _now: number): ClosedSession[] {
    // Replace, don't mutate in place — the rest of the engine treats OpenSession
    // as immutable (handleUrlChange/checkpoint always build new objects).
    if (this.focused?.tabId === removedTabId) this.focused = { ...this.focused, tabId: addedTabId };
    const a = this.audio.get(removedTabId);
    if (a) {
      this.audio.delete(removedTabId);
      this.audio.set(addedTabId, { ...a, tabId: addedTabId });
    }
    return [];
  }

  handleTabRemoved(tabId: number, now: number): ClosedSession[] {
    const out: ClosedSession[] = [];
    if (this.focused?.tabId === tabId) {
      out.push(...this.closed(this.focused, now));
      this.focused = null;
    }
    const a = this.audio.get(tabId);
    if (a) {
      out.push(...this.closed(a, now));
      this.audio.delete(tabId);
    }
    return out;
  }
}
