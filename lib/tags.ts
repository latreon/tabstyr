import type { ReportData, ReportDomain } from './report';

// Groups a report's per-domain active time by project/client tag (an axis
// independent of category) and serializes it for invoicing. Pure — the Projects
// tile and CSV/PNG exporters consume this.

export interface TagGroup {
  tag: string;
  seconds: number; // active foreground seconds for the tag over the range
  domains: ReportDomain[]; // desc, the tagged domains contributing
}

export interface TagReport {
  groups: TagGroup[]; // tagged groups, time desc
  untagged: { seconds: number; domains: ReportDomain[] }; // domains with no tag
  taggedSeconds: number; // sum across groups (billable total)
  totalSeconds: number; // tagged + untagged
}

/** Group report domains by their assigned tag; domains with no tag land in `untagged`. */
export function buildTagReport(domains: ReportDomain[], domainTags: Record<string, string>): TagReport {
  const byTag = new Map<string, TagGroup>();
  const untaggedDomains: ReportDomain[] = [];
  let taggedSeconds = 0;
  let untaggedSeconds = 0;

  for (const d of domains) {
    const tag = domainTags[d.domain];
    if (!tag) {
      untaggedDomains.push(d);
      untaggedSeconds += d.seconds;
      continue;
    }
    const g = byTag.get(tag) ?? { tag, seconds: 0, domains: [] };
    g.seconds += d.seconds;
    g.domains.push(d);
    byTag.set(tag, g);
    taggedSeconds += d.seconds;
  }

  const groups = [...byTag.values()].sort((a, b) => b.seconds - a.seconds);
  for (const g of groups) g.domains.sort((a, b) => b.seconds - a.seconds);

  return {
    groups,
    untagged: { seconds: untaggedSeconds, domains: untaggedDomains },
    taggedSeconds,
    totalSeconds: taggedSeconds + untaggedSeconds,
  };
}

/** Distinct tag names in use, sorted alphabetically (for pickers / datalists). */
export function tagNames(domainTags: Record<string, string>): string[] {
  return [...new Set(Object.values(domainTags))].sort((a, b) => a.localeCompare(b));
}

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const hm = (secs: number) => {
  const m = Math.round(secs / 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * Invoice-style CSV grouped by tag: a header, then per-domain rows carrying their
 * tag, ending with per-tag subtotals and a grand TOTAL. Numeric column stays
 * machine-parseable (no locale formatting).
 */
export function tagReportCsv(report: ReportData, domainTags: Record<string, string>): string {
  const tags = buildTagReport(report.domains, domainTags);
  const rows = [['tag', 'domain', 'category', 'active_seconds', 'active_hm'].join(',')];
  for (const g of tags.groups) {
    for (const d of g.domains) {
      rows.push([g.tag, d.domain, d.category, d.seconds, hm(d.seconds)].map(csvField).join(','));
    }
    rows.push([g.tag, 'SUBTOTAL', '', g.seconds, hm(g.seconds)].map(csvField).join(','));
  }
  for (const d of tags.untagged.domains) {
    rows.push(['', d.domain, d.category, d.seconds, hm(d.seconds)].map(csvField).join(','));
  }
  rows.push(['TOTAL', '', '', report.totalSeconds, hm(report.totalSeconds)].map(csvField).join(','));
  return rows.join('\r\n');
}
