import { domainOf } from '../domain';
import type { EngineState, OpenSession, Session } from '../types';

const MIN_SESSION_MS = 1000;

export class TrackerEngine {
  private focused: OpenSession | null;
  private audio: Map<number, OpenSession>;
  private idle: boolean;

  constructor(state?: EngineState | null) {
    this.focused = state?.focused ?? null;
    this.audio = new Map((state?.audio ?? []).map((s) => [s.tabId, s]));
    this.idle = state?.isIdle ?? false;
  }

  getState(): EngineState {
    return { focused: this.focused, audio: [...this.audio.values()], isIdle: this.idle };
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
      out.push(...this.closed(this.focused, now));
      this.focused = { ...this.focused, start: now };
    }
    for (const [tabId, open] of this.audio) {
      out.push(...this.closed(open, now));
      this.audio.set(tabId, { ...open, start: now });
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
}
