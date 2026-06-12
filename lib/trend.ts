import { addDays, dateKey } from './time';
import type { DailyStat } from './types';

export type TrendMode = 'day' | 'week' | 'month';

export interface TrendPoint {
  key: string;   // YYYY-MM-DD (day/week start) or YYYY-MM (month)
  label: string;
  seconds: number;
}

function rangeDays(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(today, i - (count - 1)));
}

export function buildTrend(stats: DailyStat[], mode: TrendMode, now: number): TrendPoint[] {
  const byDate = new Map<string, number>();
  for (const s of stats) byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.seconds);
  // dateKey, not toISOString(): stats use LOCAL dates, ISO is UTC
  return buildFrom(byDate, mode, dateKey(now));
}

function buildFrom(byDate: Map<string, number>, mode: TrendMode, today: string): TrendPoint[] {
  if (mode === 'day') {
    return rangeDays(today, 14).map((d) => ({ key: d, label: d.slice(5), seconds: byDate.get(d) ?? 0 }));
  }
  if (mode === 'week') {
    const days = rangeDays(today, 84);
    const out: TrendPoint[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      out.push({
        key: chunk[0],
        label: chunk[0].slice(5),
        seconds: chunk.reduce((sum, d) => sum + (byDate.get(d) ?? 0), 0),
      });
    }
    return out;
  }
  const months = new Map<string, number>();
  for (const d of rangeDays(today, 90)) {
    const key = d.slice(0, 7);
    months.set(key, (months.get(key) ?? 0) + (byDate.get(d) ?? 0));
  }
  return [...months.entries()].map(([key, seconds]) => ({ key, label: key, seconds }));
}
