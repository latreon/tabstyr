// Domains the user has opted out of tracking entirely. Distinct from
// re-categorizing a site (which still tracks time, just buckets it
// differently) — an excluded domain never starts a session, never gets a
// tabMeta row, and never appears anywhere in the dashboard.

const MAX_EXCLUSIONS = 200;
const MAX_PATTERN_LEN = 253; // longest legal DNS name

// Exact domain or any subdomain of it — an entry for "reddit.com" matches
// "reddit.com" and "old.reddit.com" but not "notreddit.com". Deliberately
// narrower than categories.ts's domainMatches (which also allows a "leading
// labels" prefix match, meant for bare brand-label needles like "amazon"):
// user-entered excluded domains are full hostnames, and a prefix match on
// those would wrongly treat a spoofing domain like "reddit.com.evil.com" as
// the real reddit.com.
function domainMatches(domain: string, needle: string): boolean {
  return domain === needle || domain.endsWith(`.${needle}`);
}

export function isExcludedDomain(domain: string, excluded: readonly string[]): boolean {
  if (!excluded.length) return false;
  const d = domain.toLowerCase();
  return excluded.some((e) => domainMatches(d, e));
}

// Keep only well-formed, deduplicated entries, capped so a crafted/imported
// settings value can't bloat storage or the UI.
export function sanitizeExcludedDomains(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().toLowerCase().slice(0, MAX_PATTERN_LEN);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= MAX_EXCLUSIONS) break;
  }
  return out;
}
