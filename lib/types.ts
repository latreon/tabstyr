export interface OpenSession {
  tabId: number;
  url: string;
  domain: string;
  start: number;
  audio: boolean; // a background-audio session (not the focused tab)
  audible?: boolean; // the focused tab is currently playing media — keeps the cap off
}

/** An open session that has been closed (gained an end), as emitted by the engine. */
export interface ClosedSession extends OpenSession {
  end: number;
}

/** A closed session as persisted — carries the stable per-tab key for attribution. */
export interface Session extends ClosedSession {
  tabKey: string;
}

export interface EngineState {
  focused: OpenSession | null;
  audio: OpenSession[];
  isIdle: boolean;
}

export interface DailyStat {
  date: string; // local YYYY-MM-DD
  domain: string;
  seconds: number;
  audioSeconds: number;
}

export interface TabMeta {
  tabId: number; // volatile — reassigned by the browser across restarts
  key: string; // stable identity, survives restart; used to attribute sessions
  url: string;
  title: string;
  lastActiveAt: number;
  createdAt: number;
  snoozedUntil?: number;
}

export type ThemeSetting = 'system' | 'dark' | 'light';

export interface Settings {
  staleDays: number;
  idleSeconds: number;
  audioEnabled: boolean;
  theme: ThemeSetting;
  /** User reassignments of domain → category, overriding the default rules. */
  categoryOverrides: Record<string, import('./categories').Category>;
}
