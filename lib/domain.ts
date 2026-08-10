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

// Stand-in for a path segment that looks like a secret. ASCII and URL-unreserved
// on purpose: it round-trips through `new URL().pathname` unescaped, so pagePath()
// can display it (a '…' came back percent-encoded as %E2%80%A6).
const REDACTED = '~redacted';

// Words that mean "the next segment is a one-time secret".
const SECRET_PATH_WORDS = new Set([
  'reset', 'invite', 'invitation', 'token', 'verify', 'verification', 'confirm',
  'activate', 'activation', 'magic', 'otp', 'unsubscribe', 'session', 'auth',
]);
// An opaque identifier: one long unbroken alphanumeric run mixing letters and
// digits (a document/share id, a hex token), or a UUID. Deliberately conservative:
// anything word-separated is left alone, because real route segments look like that
// ("summer-sale-2026", "2026-06-11-release-notes") and sub-page grouping plus the
// path labels read them. The trade-off is that a hyphen-bearing base64url token can
// still slip through; the query string and fragment — where most tokens live — are
// dropped outright regardless.
const OPAQUE_SEGMENT = /^(?=.{20,})(?=.*\d)(?=.*[a-zA-Z])[A-Za-z0-9]+$/;
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Redact path segments that look like credentials. Stripping `?…`/`#…` keeps
 * secrets out of the query and fragment, but plenty of them live in the PATH —
 * password-reset and invite links, magic-login URLs, share/document ids. Those
 * paths are persisted (tabMeta, sessions) and included verbatim in every JSON
 * export, so they get replaced rather than stored.
 *
 * Two rules: the segment right after a known secret word, and any long opaque
 * alphanumeric segment. Redacted segments still group together, so the sub-page
 * breakdown keeps working — "one row for password resets" instead of one row per
 * token.
 */
function redactPath(pathname: string): string {
  const parts = pathname.split('/');
  return parts
    .map((segment, i) => {
      if (!segment) return segment; // leading/trailing slash
      const prev = parts[i - 1]?.toLowerCase();
      if (prev && SECRET_PATH_WORDS.has(prev)) return REDACTED;
      return OPAQUE_SEGMENT.test(segment) || UUID_SEGMENT.test(segment) ? REDACTED : segment;
    })
    .join('/');
}

/**
 * Normalized page identity for sub-page (SPA) tracking: scheme + host + path
 * (+ a `#/` hash route when present), with the query string and all other
 * fragments stripped and credential-shaped path segments redacted. Dropping
 * `?…`/`#…` keeps secrets and PII (session tokens, search terms) out of what we
 * store and display, and collapses the countless query-only variants of one page
 * into a single entry. Non-web URLs are returned unchanged (the engine never
 * stores them anyway).
 */
export function pageOf(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return `${u.protocol}//${u.host}${redactPath(u.pathname)}${redactPath(hashRoute(u.hash))}`;
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
  if (!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)+$/i.test(domain)) {
    return false;
  }
  // A dotted-numeric value is an IPv4 literal, not a DNS name. Validate its
  // octets explicitly so corrupt imported/storage data such as 999.999.999.999
  // cannot pass this navigation boundary merely because it matches hostname
  // label syntax.
  if (IPV4_RE.test(domain)) return domain.split('.').every((part) => Number(part) <= 255);
  return true;
}

// IPv4 literal (each octet loosely 1–3 digits — host strings come from
// URL.hostname, already well-formed).
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/**
 * A PRIVATE/loopback IPv4 literal — the ranges a local dev server actually lives
 * on. Public IPs (a CDN, a router's WAN address, `8.8.8.8`) are deliberately
 * excluded: they are not dev work and must not be force-labeled Dev. Invalid
 * octets (>255) are rejected too, so a bogus `999.999.999.999` isn't treated as a
 * dev host either.
 */
function isPrivateIpv4(domain: string): boolean {
  if (!IPV4_RE.test(domain)) return false;
  const octets = domain.split('.').map(Number);
  if (octets.some((n) => n > 255)) return false;
  const [a, b] = octets;
  return (
    a === 127 || // loopback 127.0.0.0/8
    a === 10 || // private 10.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) || // private 172.16.0.0/12
    (a === 192 && b === 168) || // private 192.168.0.0/16
    (a === 169 && b === 254) // link-local 169.254.0.0/16
  );
}

/**
 * A local development host: `localhost` or a private/loopback IPv4 literal. These
 * are tracked as web pages (see isWebDomain) and grouped under the Dev category so
 * a dev server doesn't scatter across "Other" by raw IP. A public IP is NOT a dev
 * host and falls through to normal categorization.
 */
export function isLocalDevHost(domain: string): boolean {
  return domain === 'localhost' || isPrivateIpv4(domain);
}
