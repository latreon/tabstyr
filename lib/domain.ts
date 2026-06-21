/** Strip the noisy leading `www.` for display only. The stored/real domain is
 * kept intact for navigation, category rules, and detail lookups. */
export function displayDomain(domain: string): string {
  return domain.replace(/^www\./, '');
}

/**
 * A path-like hash route (`#/inbox`) as used by hash-router SPAs, or '' for any
 * other fragment. We deliberately keep ONLY `#/…` routes and drop everything
 * else — bare anchors (`#section`) and, critically, OAuth implicit-flow tokens
 * (`#access_token=…`) must never be stored. Any query inside the hash route
 * (`#/cb?token=…`) is also stripped, so secrets in the fragment can't leak.
 */
function hashRoute(hash: string): string {
  if (!hash.startsWith('#/')) return '';
  return hash.split('?')[0];
}

/**
 * Normalized page identity for sub-page (SPA) tracking: scheme + host + path
 * (+ a `#/` hash route when present), with the query string and all other
 * fragments stripped. Dropping `?…`/`#…` keeps secrets and PII (session tokens,
 * search terms) out of what we store and display, and collapses the countless
 * query-only variants of one page into a single entry. Non-web URLs are returned
 * unchanged (the engine never stores them anyway).
 */
export function pageOf(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return `${u.protocol}//${u.host}${u.pathname}${hashRoute(u.hash)}`;
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * The display path for a stored page URL — the `pathname` (trailing slash
 * trimmed, except the bare root) plus any `#/` hash route. Used as the sub-page
 * label; the bare root is surfaced via a "Home" label by the caller.
 */
export function pagePath(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 1 ? u.pathname.replace(/\/$/, '') : '/';
    const route = hashRoute(u.hash);
    if (!route) return path;
    return path === '/' ? route : path + route;
  } catch {
    return '/';
  }
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
  // `localhost` has no dot but is a real, trackable dev host (see local-dev policy).
  if (domain === 'localhost') return true;
  // A pure hostname only: dot-separated alphanumeric/hyphen labels, ≥1 dot. Rejects
  // anything carrying a path/query/fragment/credentials/whitespace (`/ ? # @ :` …),
  // so a tampered stored value can't smuggle navigation when openDomain builds
  // `https://${domain}/`. (URL.hostname is ASCII/punycode, so this is sufficient.)
  //
  // Local-dev policy: bare IPv4 hosts (127.0.0.1, 192.168.x.y, …) satisfy this
  // pattern and ARE tracked — intended, since local servers are real dev work.
  // IPv6 literals (`[::1]`) carry brackets/colons and are deliberately rejected
  // here (the `:`-ban is what blocks navigation smuggling); they're a rare,
  // accepted gap rather than tracked.
  return /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)+$/i.test(domain);
}

// IPv4 literal (each octet loosely 1–3 digits — host strings come from
// URL.hostname, already well-formed, so range-checking adds no real safety).
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/**
 * A local development host: `localhost` or any bare IPv4 literal. These are
 * tracked as web pages (see isWebDomain) and grouped under the Dev category so a
 * dev server doesn't scatter across "Other" by raw IP.
 */
export function isLocalDevHost(domain: string): boolean {
  return domain === 'localhost' || IPV4_RE.test(domain);
}
