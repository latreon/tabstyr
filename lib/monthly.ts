/** The local month bucket ('YYYY-MM') a 'YYYY-MM-DD' date key belongs to. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** The 'YYYY-MM' bucket `months` calendar months before the one containing `now`. */
export function monthKeyBefore(now: number, months: number): string {
  const d = new Date(now);
  d.setDate(1); // pin to the 1st first so setMonth can't roll over on a short month
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Aggregation of daily rows into the monthly archive lives inline in
// repo.pruneBefore, which is the only place it happens (it must accumulate inside
// the same transaction that deletes the rows). A separate rollup/merge/combine
// trio used to live here with no production caller; it was removed rather than
// left as a second, drifting implementation of the same arithmetic.
