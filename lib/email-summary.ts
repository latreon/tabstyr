import type { ReportData } from './report';

// Builds the mailto: draft for the local-only daily/weekly email summary nudge.
// Pure — no clock, no network. Nothing here ever leaves the device: this only
// shapes a mailto: URL that the OS/browser hands to the user's OWN mail client,
// which they review and send (or don't) themselves. Same "TabStyr makes zero
// network requests" model as every export in lib/export.ts.

const MAX_DOMAINS_LISTED = 8;
// Most mail clients start truncating a mailto: body well before the ~2000-char
// floor browsers enforce on the URL itself; keep comfortably under it so the
// draft is never cut off mid-line on a heavy-usage day.
const MAX_BODY_CHARS = 1500;

function hm(seconds: number): string {
  const m = Math.round(seconds / 60);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return h > 0 ? `${h}h ${rem}m` : `${rem}m`;
}

/** Draft subject line. Deterministic (no locale formatting) — matches the plain, machine-stable convention of reportCsv(). */
export function summarySubject(report: ReportData, frequency: 'daily' | 'weekly'): string {
  const range = report.days > 1 ? `${report.from} to ${report.to}` : report.from;
  return frequency === 'weekly' ? `TabStyr weekly summary — ${range}` : `TabStyr daily summary — ${range}`;
}

/** Plain-text draft body: total, per-category breakdown, top sites. Capped so a heavy day never blows past a mail client's practical mailto: body limit. */
export function summaryBody(report: ReportData): string {
  const lines: string[] = [];
  lines.push(`Total active time: ${hm(report.totalSeconds)}`);
  lines.push('');
  lines.push('By category:');
  for (const c of report.categories) lines.push(`  ${c.category}: ${hm(c.seconds)}`);
  lines.push('');
  lines.push('Top sites:');
  for (const d of report.domains.slice(0, MAX_DOMAINS_LISTED)) lines.push(`  ${d.domain}: ${hm(d.seconds)}`);
  const remaining = report.domains.length - MAX_DOMAINS_LISTED;
  if (remaining > 0) lines.push(`  …and ${remaining} more`);
  lines.push('');
  lines.push("— Sent from your own device. TabStyr never transmits this data anywhere; you're sending it yourself.");
  const body = lines.join('\n');
  return body.length > MAX_BODY_CHARS ? `${body.slice(0, MAX_BODY_CHARS - 1)}…` : body;
}

/**
 * Full mailto: URL for the draft. `recipient` may be '' (user picks one in
 * their mail client) — a blank `to` in a mailto: URL is valid and simply opens
 * an unaddressed compose window.
 */
export function summaryMailto(report: ReportData, frequency: 'daily' | 'weekly', recipient: string): string {
  const subject = encodeURIComponent(summarySubject(report, frequency));
  const body = encodeURIComponent(summaryBody(report));
  return `mailto:${encodeURIComponent(recipient)}?subject=${subject}&body=${body}`;
}
