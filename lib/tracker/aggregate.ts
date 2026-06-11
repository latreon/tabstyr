import { dateKey } from '../time';
import type { DailyStat, Session } from '../types';

export function rollup(sessions: Session[]): DailyStat[] {
  const map = new Map<string, DailyStat>();
  for (const s of sessions) {
    const date = dateKey(s.start);
    const key = `${date}|${s.domain}`;
    const stat = map.get(key) ?? { date, domain: s.domain, seconds: 0, audioSeconds: 0 };
    const secs = Math.round((s.end - s.start) / 1000);
    const next = {
      ...stat,
      seconds: stat.seconds + secs,
      audioSeconds: stat.audioSeconds + (s.audio ? secs : 0),
    };
    map.set(key, next);
  }
  return [...map.values()];
}
