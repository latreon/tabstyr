import { domainOf, isWebDomain } from '../domain';
import type { ClosedSession, EngineState, OpenSession } from '../types';

const MIN_SESSION_MS = 1000;
// Upper bound on a single session. The 1-minute heartbeat checkpoint splits all
// active time into ≤1-minute chunks while the worker is alive, so this only ever
// clamps a session that spanned a dormant gap — i.e. system sleep/suspend, where
// no alarms fired. Without it, the whole sleep duration would be counted as use.
const MAX_SESSION_MS = 10 * 60_000;

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

  private closed(open: OpenSession, now: number): ClosedSession[] {
    const dur = now - open.start;
    if (dur < MIN_SESSION_MS) return [];
    const end = dur > MAX_SESSION_MS ? open.start + MAX_SESSION_MS : now;
    return [{ ...open, end }];
  }

  handleFocus(tabId: number, url: string, now: number): ClosedSession[] {
    this.idle = false;
    const out: ClosedSession[] = [];
    if (this.focused) out.push(...this.closed(this.focused, now));
    const bgAudio = this.audio.get(tabId);
    if (bgAudio) {
      out.push(...this.closed(bgAudio, now));
      this.audio.delete(tabId);
    }
    // Only track real web pages — internal pages (chrome://, newtab, the extension's
    // own dashboard) are never counted, so they neither add time nor session rows.
    const domain = domainOf(url);
    this.focused = isWebDomain(domain) ? { tabId, url, domain, start: now, audio: false } : null;
    return out;
  }

  handleBlur(now: number): ClosedSession[] {
    const out = this.focused ? this.closed(this.focused, now) : [];
    this.focused = null;
    return out;
  }

  handleIdle(now: number): ClosedSession[] {
    this.idle = true;
    const out: ClosedSession[] = [];
    if (this.focused) out.push(...this.closed(this.focused, now));
    this.focused = null;
    // Stop background audio too — time while you're away shouldn't accrue, and an
    // always-"audible" tab left open would otherwise rack up hours.
    for (const open of this.audio.values()) out.push(...this.closed(open, now));
    this.audio.clear();
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
      out.push(...this.closed(this.focused, now));
      // Navigated to an internal page → stop tracking this tab.
      this.focused = web ? { tabId, url, domain, start: now, audio: false } : null;
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
