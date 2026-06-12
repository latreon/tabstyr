import { domainOf, isWebDomain } from '../domain';
import type { ClosedSession, EngineState, OpenSession } from '../types';

const MIN_SESSION_MS = 1000;
// Sleep/suspend backstop. The heartbeat normally splits active time into ≤1-minute
// chunks, but Chrome can throttle MV3 alarms during long PASSIVE use. We therefore
// only cap sessions that are NOT playing media — a focused tab playing audio/video
// (or a background-audio tab) is genuine continuous use and is counted in full, so
// a 2-hour video watched without input still reports ~2 hours. A non-playing tab
// that spans a long gap (e.g. the machine slept) is capped.
const MAX_SESSION_MS = 30 * 60_000;

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
    if (dur < MIN_SESSION_MS) return [];
    const cappable = forceCap || (!open.audio && !open.audible);
    const end = cappable && dur > MAX_SESSION_MS ? open.start + MAX_SESSION_MS : now;
    return [{ ...open, end }];
  }

  handleFocus(tabId: number, url: string, now: number, audible = false): ClosedSession[] {
    this.idle = false;
    const out: ClosedSession[] = [];
    if (this.focused) out.push(...this.closed(this.focused, now));
    const bgAudio = this.audio.get(tabId);
    if (bgAudio) {
      out.push(...this.closed(bgAudio, now));
      this.audio.delete(tabId);
    }
    // Only track real web pages — internal pages (chrome://, newtab, the dashboard)
    // are never counted.
    const domain = domainOf(url);
    this.focused = isWebDomain(domain) ? { tabId, url, domain, start: now, audio: false, audible } : null;
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
    if (this.focused?.audible) return out; // still watching — keep the session open
    if (this.focused) out.push(...this.closed(this.focused, now));
    this.focused = null;
    this.idle = true;
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
      const emitted = this.closed(this.focused, now);
      out.push(...emitted);
      if (emitted.length) this.focused = { ...this.focused, start: now };
    }
    for (const [tabId, open] of this.audio) {
      const emitted = this.closed(open, now);
      out.push(...emitted);
      if (emitted.length) this.audio.set(tabId, { ...open, start: now });
    }
    return out;
  }

  reconcile(liveTabIds: Set<number>, now: number): ClosedSession[] {
    const out: ClosedSession[] = [];
    if (this.focused && !liveTabIds.has(this.focused.tabId)) {
      out.push(...this.closed(this.focused, now));
      this.focused = null;
    }
    for (const [tabId, open] of this.audio) {
      if (!liveTabIds.has(tabId)) {
        out.push(...this.closed(open, now));
        this.audio.delete(tabId);
      }
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
        this.audio.set(tabId, { tabId, url, domain: domainOf(url), start: now, audio: true });
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

  // url in open sessions reflects the url at session-open time;
  // same-domain navigations do not update it.
  handleUrlChange(tabId: number, url: string, now: number): ClosedSession[] {
    const out: ClosedSession[] = [];
    const domain = domainOf(url);
    const web = isWebDomain(domain);
    if (this.focused?.tabId === tabId && this.focused.domain !== domain) {
      const wasAudible = this.focused.audible;
      out.push(...this.closed(this.focused, now));
      this.focused = web ? { tabId, url, domain, start: now, audio: false, audible: wasAudible } : null;
    }
    const a = this.audio.get(tabId);
    if (a && a.domain !== domain) {
      out.push(...this.closed(a, now));
      if (web) this.audio.set(tabId, { tabId, url, domain, start: now, audio: true });
      else this.audio.delete(tabId);
    }
    return out;
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
