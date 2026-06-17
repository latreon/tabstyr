/** Strip the noisy leading `www.` for display only. The stored/real domain is
 * kept intact for navigation, category rules, and detail lookups. */
export function displayDomain(domain: string): string {
  return domain.replace(/^www\./, '');
}

export function domainOf(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.hostname;
    return u.protocol.replace(':', '');
  } catch {
    return 'other';
  }
}

/**
 * True only for real, openable web hostnames (e.g. `github.com`). Excludes the
 * scheme-word buckets `domainOf` returns for internal pages (`chrome`, `extension`,
 * `file`, `other`, …), which must not be rendered as clickable sites nor reopened
 * as `https://<scheme>/`.
 */
export function isWebDomain(domain: string): boolean {
  // `localhost` has no dot but is a real, trackable dev host (and a Dev category rule).
  if (domain === 'localhost') return true;
  // A pure hostname only: dot-separated alphanumeric/hyphen labels, ≥1 dot. Rejects
  // anything carrying a path/query/fragment/credentials/whitespace (`/ ? # @ :` …),
  // so a tampered stored value can't smuggle navigation when openDomain builds
  // `https://${domain}/`. (URL.hostname is ASCII/punycode, so this is sufficient.)
  return /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)+$/i.test(domain);
}
