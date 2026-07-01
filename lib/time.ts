import { getDateLocale } from './locale';

export function formatDuration(seconds: number): string {
  // Round to whole seconds first so the m/s split is an exact reconstruction of
  // the (integer-seconds) input — no rounding drift, no "<1m" approximation.
  const total = Math.max(0, Math.round(seconds));
  // Under an hour, show exact minutes + seconds ("5m 23s", "45s", "30m").
  if (total < 3600) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    if (m === 0) return `${s}s`;
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
  }
  // An hour or more: hours + minutes (seconds omitted to stay legible).
  const totalMin = Math.floor(total / 60);
  const h = Math.floor(totalMin / 60);
  if (h < 24) {
    const rem = totalMin % 60;
    return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
  }
  // Roll hours into days so large totals stay legible ("41d 3h", not "987h").
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH === 0 ? `${d}d` : `${d}d ${remH}h`;
}

/**
 * Like formatDuration, but keeps up to three units (d / h / m) so a multi-day
 * total still shows its hours AND minutes (e.g. "1d 3h 12m"), instead of dropping
 * minutes at the day scale. Used where precision reads better than compactness —
 * e.g. the "Open tabs by time" table. Zero units are omitted; "0s" when empty.
 */
export function formatDurationLong(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  const totalMin = Math.floor(total / 60);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return parts.join(' ');
}

export function dateKey(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** `key` must be a valid local YYYY-MM-DD string. */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + days).getTime());
}

/** "Jun 11" from a YYYY-MM-DD key — compact axis label for day/week trend ticks. */
export function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleString(getDateLocale(), { month: 'short', day: 'numeric' });
}

/** "Jun" from a YYYY-MM key — axis label for month trend ticks. */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString(getDateLocale(), { month: 'short' });
}

/** "Mon, Jun 9" from a YYYY-MM-DD key — human day heading. */
export function longDateLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleString(getDateLocale(), { weekday: 'short', month: 'short', day: 'numeric' });
}
