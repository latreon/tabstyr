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
  return /\./.test(domain) && !/\s/.test(domain);
}
