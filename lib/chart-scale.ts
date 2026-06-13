import { formatDuration } from './time';
import type { TrendMode } from './trend';

const NICE_STEPS_SECONDS = [300, 600, 900, 1800, 3600, 7200, 10800, 14400, 21600, 28800, 43200];

export interface YTick {
  seconds: number;
  label: string;
}

/** Three evenly spaced "nice" ticks; ticks[2] always >= maxSeconds. */
export function yTicks(maxSeconds: number): YTick[] {
  const target = Math.max(maxSeconds, 60) / 3;
  const step = NICE_STEPS_SECONDS.find((s) => s >= target) ?? Math.ceil(target / 3600) * 3600;
  return [1, 2, 3].map((i) => ({ seconds: i * step, label: formatDuration(i * step) }));
}

export function xTickEvery(mode: TrendMode): number {
  return mode === 'day' ? 2 : 1;
}

export function trendTooltip(key: string, mode: TrendMode, seconds: number, partial = false): string {
  const suffix = `${formatDuration(seconds)}${partial ? ' · partial' : ''}`;
  if (mode === 'month') {
    const [y, m] = key.split('-').map(Number);
    const name = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long' });
    return `${name} ${y} — ${suffix}`;
  }
  const [y, m, d] = key.split('-').map(Number);
  const human = new Date(y, m - 1, d).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const prefix = mode === 'week' ? `Week of ${human}` : human;
  return `${prefix} — ${suffix}`;
}
