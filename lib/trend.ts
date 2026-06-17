import { addDays, dateKey, dayLabel, monthLabel } from './time';
import type { DailyStat } from './types';

export type TrendMode = 'day' | 'week' | 'month';

export interface TrendPoint {
  key: string;   // YYYY-MM-DD (day/week start) or YYYY-MM (month)
  label: string;
  seconds: number;
  partial?: boolean; // month bucket only partly inside the window (don't compare as full)
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
    return rangeDays(today, 10).map((d) => ({ key: d, label: dayLabel(d), seconds: byDate.get(d) ?? 0 }));
  }
  if (mode === 'week') {
    const days = rangeDays(today, 56);
    const out: TrendPoint[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      out.push({
        key: chunk[0],
        label: dayLabel(chunk[0]),
        seconds: chunk.reduce((sum, d) => sum + (byDate.get(d) ?? 0), 0),
      });
    }
    return out;
  }
  const days = rangeDays(today, 60);
  // The oldest bucket only includes the tail of its month if the window didn't
  // start on the 1st; the newest bucket is the current month, still in progress.
  const startPartial = !days[0].endsWith('-01');
  const firstMonth = days[0].slice(0, 7);
  const lastMonth = today.slice(0, 7);
  const months = new Map<string, number>();
  for (const d of days) {
    const key = d.slice(0, 7);
    months.set(key, (months.get(key) ?? 0) + (byDate.get(d) ?? 0));
  }
  return [...months.entries()].map(([key, seconds]) => ({
    key,
    label: monthLabel(key),
    seconds,
    partial: (key === firstMonth && startPartial) || key === lastMonth,
  }));
}
