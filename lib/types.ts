export interface OpenSession {
  tabId: number;
  url: string;
  domain: string;
  start: number;
  audio: boolean;
}

export interface Session extends OpenSession {
  end: number;
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
  tabId: number;
  url: string;
  title: string;
  lastActiveAt: number;
  createdAt: number;
  snoozedUntil?: number;
}

export interface Settings {
  staleDays: number;
  idleSeconds: number;
  audioEnabled: boolean;
}
