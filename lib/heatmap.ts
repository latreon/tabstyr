/** Weekday labels indexed by JS `Date.getDay()` (0 = Sunday). */
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Display order: Monday first, weekend last. Maps row → getDay() index. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export interface HeatmapData {
  /** grid[getDay()][hour] = seconds. 7 rows × 24 cols. */
  grid: number[][];
  /** Largest single-cell value, for scaling the colour ramp (≥1 to avoid /0). */
  max: number;
  /** Total seconds across the whole grid. */
  total: number;
}

function emptyGrid(): number[][] {
  return Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
}

/**
 * Aggregate sessions into a local-time weekday × hour grid of seconds. Sessions
 * that cross an hour (or midnight/weekday) boundary are split so each slice lands
 * in the correct bucket — important because local time, DST, and the engine's
 * session cap all interact at hour edges.
 */
export function buildHourlyHeatmap(sessions: Array<{ start: number; end: number }>): HeatmapData {
  const grid = emptyGrid();
  let total = 0;

  for (const s of sessions) {
    let cursor = s.start;
    while (cursor < s.end) {
      const d = new Date(cursor);
      const dow = d.getDay();
      const hour = d.getHours();
      // setHours mutates `d` (already read above) and returns the timestamp of the
      // next local-hour boundary — one Date allocation per iteration instead of two,
      // while still honouring local time + DST (plain ms arithmetic would break for
      // half-hour timezones and DST shifts).
      const boundary = d.setHours(hour + 1, 0, 0, 0);
      // On a DST fall-back edge the next-hour boundary can fail to advance past the
      // cursor. Rather than `break` (which would drop the rest of the session),
      // attribute the remainder to the current hour bucket so no time is lost; the
      // assignment below sets cursor past s.end and ends the loop.
      const segEnd = boundary > cursor ? Math.min(s.end, boundary) : s.end;
      const secs = (segEnd - cursor) / 1000;
      grid[dow][hour] += secs;
      total += secs;
      cursor = segEnd;
    }
  }

  // Round once at the end so display values are whole seconds without drift.
  let max = 0;
  for (const row of grid) {
    for (let h = 0; h < 24; h++) {
      row[h] = Math.round(row[h]);
      if (row[h] > max) max = row[h];
    }
  }
  return { grid, max: Math.max(1, max), total: Math.round(total) };
}

/** Hour with the most accumulated time, or null when the grid is empty. */
export function peakHour(data: HeatmapData): { day: number; hour: number; seconds: number } | null {
  if (data.total === 0) return null;
  let best = { day: 0, hour: 0, seconds: -1 };
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      if (data.grid[day][hour] > best.seconds) best = { day, hour, seconds: data.grid[day][hour] };
    }
  }
  return best;
}
