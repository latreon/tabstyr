export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0m';
  const m = Math.round(seconds / 60);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) {
    const rem = m % 60;
    return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
  }
  // Roll hours into days so large totals stay legible ("41d 3h", not "987h").
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH === 0 ? `${d}d` : `${d}d ${remH}h`;
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
  return new Date(y, m - 1, d).toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

/** "Jun" from a YYYY-MM key — axis label for month trend ticks. */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short' });
}

/** "Mon, Jun 9" from a YYYY-MM-DD key — human day heading. */
export function longDateLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
