import { coalesceSessions } from './sessionize';
import { pagePath } from './domain';

export interface SubPage {
  path: string; // display pathname, e.g. "/watch" ("/" for the site root)
  seconds: number;
  visits: number;
}

export interface SubPageBreakdown {
  pages: SubPage[];
  otherCount: number; // distinct paths beyond `limit`, folded away
}

/**
 * Aggregate already domain-filtered sessions into per-sub-page totals, ranked by
 * time. Each session's `url` is the normalized page URL the engine stores (no
 * query/fragment), so grouping by `pagePath` yields one row per real page.
 *
 * `visits` stitches the 1-minute heartbeat rows back into real visits (via
 * coalesceSessions) so the count reflects genuine page views, not checkpoints.
 */
export function topSubPages(
  sessions: Array<{ url: string; start: number; end: number }>,
  limit = 8,
): SubPageBreakdown {
  const byPath = new Map<string, Array<{ start: number; end: number }>>();
  for (const s of sessions) {
    const path = pagePath(s.url);
    const rows = byPath.get(path);
    if (rows) rows.push({ start: s.start, end: s.end });
    else byPath.set(path, [{ start: s.start, end: s.end }]);
  }

  const all: SubPage[] = [];
  for (const [path, rows] of byPath) {
    const seconds = Math.round(rows.reduce((sum, r) => sum + (r.end - r.start), 0) / 1000);
    if (seconds <= 0) continue;
    all.push({ path, seconds, visits: coalesceSessions(rows).length });
  }
  all.sort((a, b) => b.seconds - a.seconds || a.path.localeCompare(b.path));

  return { pages: all.slice(0, limit), otherCount: Math.max(0, all.length - limit) };
}
