import { domainOf } from '../domain';
import type { EngineState, OpenSession, Session } from '../types';

const MIN_SESSION_MS = 1000;

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

  private closed(open: OpenSession, now: number): Session[] {
    return now - open.start >= MIN_SESSION_MS ? [{ ...open, end: now }] : [];
  }

  handleFocus(tabId: number, url: string, now: number): Session[] {
    this.idle = false;
    const out: Session[] = [];
    if (this.focused) out.push(...this.closed(this.focused, now));
    const bgAudio = this.audio.get(tabId);
    if (bgAudio) {
      out.push(...this.closed(bgAudio, now));
      this.audio.delete(tabId);
    }
    this.focused = { tabId, url, domain: domainOf(url), start: now, audio: false };
    return out;
  }

  handleBlur(now: number): Session[] {
    const out = this.focused ? this.closed(this.focused, now) : [];
    this.focused = null;
    return out;
  }

  handleIdle(now: number): Session[] {
    this.idle = true;
    const out = this.focused ? this.closed(this.focused, now) : [];
    this.focused = null;
    return out;
  }

  checkpoint(now: number): Session[] {
    const out: Session[] = [];
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

  reconcile(liveTabIds: Set<number>, now: number): Session[] {
    const out: Session[] = [];
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

  syncAudio(audible: Array<{ tabId: number; url: string }>, now: number): Session[] {
    const out: Session[] = [];
    const keep = new Set<number>();
    for (const { tabId, url } of audible) {
      if (tabId === this.focused?.tabId) continue;
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
  handleUrlChange(tabId: number, url: string, now: number): Session[] {
    const out: Session[] = [];
    const domain = domainOf(url);
    if (this.focused?.tabId === tabId && this.focused.domain !== domain) {
      out.push(...this.closed(this.focused, now));
      this.focused = { tabId, url, domain, start: now, audio: false };
    }
    const a = this.audio.get(tabId);
    if (a && a.domain !== domain) {
      out.push(...this.closed(a, now));
      this.audio.set(tabId, { tabId, url, domain, start: now, audio: true });
    }
    return out;
  }

  handleTabRemoved(tabId: number, now: number): Session[] {
    const out: Session[] = [];
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
