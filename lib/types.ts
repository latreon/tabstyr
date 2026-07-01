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

/**
 * A per-domain monthly total. Written only when daily rows fall off the 90-day
 * raw-retention edge (see repo.pruneBefore): the pruned days are aggregated here
 * so long-range views (yearly Wrapped, multi-month trends) survive pruning without
 * keeping every raw session. A given (date, domain) lives in EITHER dailyDomainStats
 * (recent) OR the month bucket here (archived) — never both — so summing the two
 * sources never double-counts.
 */
export interface MonthlyStat {
  month: string; // local YYYY-MM
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
  /** User-defined substring → category rules, checked before the built-in rules. */
  categoryRules: import('./categories').CategoryRule[];
  /**
   * How each category counts toward Focus % — productive, distracting, or neutral.
   * Seeded from CATEGORY_PRODUCTIVITY; the user can remap any category (e.g. a
   * social-media manager marking Social as productive).
   */
  categoryProductivity: Record<import('./categories').Category, import('./categories').Productivity>;
  /** Daily Focus-% goal (0–100). The streak counts days meeting this target. */
  focusTarget: number;
  /**
   * Optional per-category daily time budgets, in MINUTES. A category present here
   * with a positive value nudges (once/day) when today's active time crosses it.
   * Absent/zero = no budget. Analytics-only — never blocks a site.
   */
  categoryBudgets: Partial<Record<import('./categories').Category, number>>;
  /** Whether the first-run onboarding intro has been dismissed. */
  onboarded: boolean;
  /** Whether the once-a-day stale-tab reminder notification is shown. */
  notificationsEnabled: boolean;
  /** UI language: 'auto' (follow the browser) or a supported locale code. */
  language: string;
}
