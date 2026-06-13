// The 1-minute heartbeat checkpoint splits one continuous visit into many ~1-min
// rows in the session store. For visit-level metrics (count, average, longest) we
// stitch those rows back into real visits: consecutive intervals are merged when
// the gap between them is within the heartbeat window. Larger gaps start a new
// visit. Totals/heatmaps don't need this (they just sum), only visit shape does.
const STITCH_GAP_MS = 90_000;

export interface Visit {
  start: number;
  end: number;
}

export function coalesceSessions(
  sessions: Array<{ start: number; end: number }>,
  gapMs = STITCH_GAP_MS,
): Visit[] {
  const sorted = [...sessions].sort((a, b) => a.start - b.start);
  const out: Visit[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start - last.end <= gapMs) {
      if (s.end > last.end) last.end = s.end; // extend the open visit (handles overlap)
    } else {
      out.push({ start: s.start, end: s.end });
    }
  }
  return out;
}
