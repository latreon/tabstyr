import { rollup } from './tracker/aggregate';
import type { DailyStat, MonthlyStat, Session, Settings } from './types';

// Merges an imported (decrypted) backup INTO the existing local data — the "sync"
// path, as opposed to restore's destructive replace. Pure and idempotent: importing
// the same file twice yields the same result.
//
// Strategy:
//  - sessions: union by event identity (tabKey+start+end+domain+audio). Distinct
//    sessions from another device are all kept; exact duplicates collapse.
//  - dailyDomainStats: RE-DERIVED from the merged session union (rollup) for every
//    session-covered (date, domain) — so recent history is the true combined total
//    and stays consistent with the per-domain detail. (date, domain) rows with no
//    backing session (legacy/edge) fall back to the max of the two sources.
//  - monthlyDomainStats: the archive has no event identity, so take the MAX per
//    (month, domain). Never inflates, idempotent; combining two devices' archives
//    keeps the larger month (a documented approximation for pruned data).
//  - tabMeta: NOT merged — it's this browser's live open-tab/stale state; importing
//    another device's open tabs would pollute it. Callers keep local tabMeta.

export interface MergeInput {
  sessions: Session[];
  dailyStats: DailyStat[];
  monthlyStats: MonthlyStat[];
}

export interface MergeResult {
  sessions: Session[];
  dailyStats: DailyStat[];
  monthlyStats: MonthlyStat[];
}

/** Identity of a session as an immutable event — duplicates share this key. */
export function sessionKey(s: Session): string {
  return `${s.tabKey}|${s.start}|${s.end}|${s.domain}|${s.audio ? 1 : 0}`;
}

export function mergeSessions(local: Session[], incoming: Session[]): Session[] {
  const byKey = new Map<string, Session>();
  for (const s of local) byKey.set(sessionKey(s), s);
  for (const s of incoming) {
    const k = sessionKey(s);
    if (!byKey.has(k)) byKey.set(k, s);
  }
  return [...byKey.values()];
}

/** Max per (month, domain) across both archives. */
export function maxMonthly(local: MonthlyStat[], incoming: MonthlyStat[]): MonthlyStat[] {
  const map = new Map<string, MonthlyStat>();
  for (const m of [...local, ...incoming]) {
    const k = `${m.month}|${m.domain}`;
    const cur = map.get(k);
    if (!cur) map.set(k, { ...m });
    else {
      cur.seconds = Math.max(cur.seconds, m.seconds);
      cur.audioSeconds = Math.max(cur.audioSeconds, m.audioSeconds);
    }
  }
  return [...map.values()];
}

/** Daily merged: rollup of the merged sessions, with a max-fallback for session-less keys. */
export function mergeDaily(local: DailyStat[], incoming: DailyStat[], mergedSessions: Session[]): DailyStat[] {
  const key = (d: DailyStat) => `${d.date}|${d.domain}`;
  const out = new Map<string, DailyStat>();
  for (const d of rollup(mergedSessions)) out.set(key(d), d); // session-backed → authoritative
  const derivedKeys = new Set(out.keys());
  for (const d of [...local, ...incoming]) {
    const k = key(d);
    if (derivedKeys.has(k)) continue; // trust the session-derived value
    const cur = out.get(k);
    if (!cur) out.set(k, { ...d });
    else {
      cur.seconds = Math.max(cur.seconds, d.seconds);
      cur.audioSeconds = Math.max(cur.audioSeconds, d.audioSeconds);
    }
  }
  return [...out.values()];
}

/** Merge an imported backup's data into the local data (tabMeta handled by caller). */
export function mergeBackup(local: MergeInput, incoming: MergeInput): MergeResult {
  const sessions = mergeSessions(local.sessions, incoming.sessions);
  return {
    sessions,
    dailyStats: mergeDaily(local.dailyStats, incoming.dailyStats, sessions),
    monthlyStats: maxMonthly(local.monthlyStats, incoming.monthlyStats),
  };
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * Union the map-like settings from an imported backup into the local ones, LOCAL
 * winning on key conflicts (never silently override this device's choices) while
 * adopting the other device's extra classifications/tags. Scalar prefs (theme,
 * language, focusTarget, …) are left untouched. The result is re-sanitized by
 * saveSettings, so untyped imported values are safe here.
 */
export function mergeSettingsMaps(local: Settings, incoming: unknown): Record<string, unknown> {
  const inc = obj(incoming);
  const rulesIn = Array.isArray(inc.categoryRules) ? (inc.categoryRules as Array<{ pattern?: unknown }>) : [];
  const seen = new Set(local.categoryRules.map((r) => r.pattern));
  const mergedRules = [...local.categoryRules];
  for (const r of rulesIn) {
    if (r && typeof r.pattern === 'string' && !seen.has(r.pattern)) {
      seen.add(r.pattern);
      mergedRules.push(r as { pattern: string; category: never });
    }
  }
  return {
    categoryOverrides: { ...obj(inc.categoryOverrides), ...local.categoryOverrides },
    domainTags: { ...obj(inc.domainTags), ...local.domainTags },
    categoryBudgets: { ...obj(inc.categoryBudgets), ...local.categoryBudgets },
    categoryRules: mergedRules,
  };
}
