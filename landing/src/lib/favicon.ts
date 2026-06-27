// Real site icons for the Browsing Wrapped story + share card.
//
// PRIVACY NOTE: this is the ONLY place the Wrapped tool touches the network. To
// show a real logo we ask icon.horse for the favicon of each top domain — so those
// (already-public) hostnames are sent there. No stats, totals, sessions, or file
// contents ever leave the browser; only an icon lookup, sent with no referrer.
//
// icon.horse is used because it serves icons with `Access-Control-Allow-Origin: *`,
// so the same image can be displayed in the DOM AND drawn onto the share-card
// canvas (with crossOrigin='anonymous') without tainting it — letting toBlob()
// export still succeed. The card falls back to a letter chip if the icon fails.

import { reactive } from 'vue';

function normalizeDomain(domain: string): string | null {
  const d = domain.replace(/^www\./, '').toLowerCase();
  // Skip non-public hosts — localhost and bare IPv4 literals (a backup is untrusted
  // and may contain 127.0.0.1, 192.168.x, 169.254.169.254, …). No point asking a
  // third party for their icon, and it keeps private/loopback addresses on-device.
  // The caller falls back to a letter chip when this returns null.
  if (d === 'localhost' || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(d)) return null;
  return d;
}

export function faviconUrl(domain: string): string | null {
  const d = normalizeDomain(domain);
  return d ? `https://icon.horse/icon/${encodeURIComponent(d)}` : null;
}

/**
 * Ordered favicon sources for plain DOM <img> display (NOT the export canvas).
 * icon.horse is tried first (matches the share card), with Google's S2 service as
 * a fallback so a single provider being slow/down/rate-limited no longer drops the
 * icon to a letter chip. DOM images need no CORS, so the fallback host is free.
 */
export function faviconSources(domain: string): string[] {
  const d = normalizeDomain(domain);
  if (!d) return [];
  const enc = encodeURIComponent(d);
  return [
    `https://icon.horse/icon/${enc}`,
    `https://www.google.com/s2/favicons?domain=${enc}&sz=64`,
  ];
}

// ── Preload cache ────────────────────────────────────────────────────────────
// Resolving each domain's working favicon AHEAD of the slide that shows it means
// the <img> binds an already-cached URL and paints instantly — no letter-chip
// flash, no visible swap from one source to another. Keyed by the raw domain the
// caller passes (SiteIcon and the preloader use the same value, so keys match).
//   undefined → not looked up yet / still resolving
//   string    → the working favicon URL (image is already in the browser cache)
//   null      → every source failed (or non-public host) → use the letter chip
const cache = reactive<Record<string, string | null>>({});
const inFlight = new Set<string>();

export function resolvedFavicon(domain: string): string | null | undefined {
  return cache[domain];
}

/** Idempotently resolve and warm a domain's favicon into the browser image cache. */
export function preloadFavicon(domain: string): void {
  if (domain in cache || inFlight.has(domain)) return;
  const sources = faviconSources(domain);
  if (!sources.length) {
    cache[domain] = null;
    return;
  }
  inFlight.add(domain);
  let i = 0;
  const tryNext = (): void => {
    if (i >= sources.length) {
      cache[domain] = null;
      inFlight.delete(domain);
      return;
    }
    const url = sources[i++];
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      if (img.naturalWidth > 0) {
        cache[domain] = url;
        inFlight.delete(domain);
      } else {
        tryNext();
      }
    };
    img.onerror = tryNext;
    img.src = url;
  };
  tryNext();
}

export function preloadFavicons(domains: readonly string[]): void {
  for (const d of domains) preloadFavicon(d);
}
