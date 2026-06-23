import { dateKey } from '../time';
import type { ClosedSession, DailyStat } from '../types';

export function rollup(sessions: ClosedSession[]): DailyStat[] {
  const map = new Map<string, DailyStat>();
  for (const s of sessions) {
    // Split each session at local midnight so a visit spanning midnight lands on
    // the correct day in each slice (matching the heatmap, which also splits).
    let cursor = s.start;
    while (cursor < s.end) {
      const d = new Date(cursor);
      const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
      // On a DST fall-back edge the computed boundary can fail to advance past the
      // cursor. Rather than `break` (which would drop the rest of the session),
      // attribute the whole remainder to the current day so no time is lost; the
      // assignment below sets cursor past s.end and ends the loop.
      const segEnd = midnight > cursor ? Math.min(s.end, midnight) : s.end;
      const date = dateKey(cursor);
      const key = `${date}|${s.domain}`;
      const stat = map.get(key) ?? { date, domain: s.domain, seconds: 0, audioSeconds: 0 };
      const secs = (segEnd - cursor) / 1000;
      stat.seconds += secs;
      if (s.audio) stat.audioSeconds += secs;
      map.set(key, stat);
      cursor = segEnd;
    }
  }
  // Round once per day+domain bucket so each stored value is whole seconds without
  // per-slice drift. Sessions are pre-filtered (MIN_SESSION_MS guard) so zero/
  // negative durations should not occur.
  return [...map.values()].map((s) => ({
    ...s,
    seconds: Math.round(s.seconds),
    audioSeconds: Math.round(s.audioSeconds),
  }));
}
