import { formatDuration } from './time';
import { getDateLocale } from './locale';
import type { TrendMode } from './trend';

// vue-i18n's translate signature, kept structural so this lib stays Vue-free.
type Translate = (key: string, named?: Record<string, unknown>) => string;

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

/**
 * Tooltip / aria-label for a trend bar. Dates are formatted in the user's active
 * locale (getDateLocale). Pass `t` (vue-i18n) to localize the "Week of" prefix and
 * the "partial" marker; without it, falls back to English (used by unit tests).
 */
export function trendTooltip(
  key: string,
  mode: TrendMode,
  seconds: number,
  partial = false,
  t?: Translate,
): string {
  const locale = getDateLocale();
  const partialLabel = partial ? ` · ${t ? t('trend.partial') : 'partial'}` : '';
  const suffix = `${formatDuration(seconds)}${partialLabel}`;
  if (mode === 'month') {
    const [y, m] = key.split('-').map(Number);
    const name = new Date(y, m - 1, 1).toLocaleString(locale, { month: 'long' });
    return `${name} ${y} — ${suffix}`;
  }
  const [y, m, d] = key.split('-').map(Number);
  const human = new Date(y, m - 1, d).toLocaleString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const prefix = mode === 'week' ? (t ? t('trend.weekOf', { date: human }) : `Week of ${human}`) : human;
  return `${prefix} — ${suffix}`;
}
