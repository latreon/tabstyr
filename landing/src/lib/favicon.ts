// Site icons for the Browsing Wrapped story + share card.
//
// PRIVACY: the Wrapped tool makes ZERO network requests — it must honor the
// prominent "0 bytes leave your device / nothing leaves your browser" promise the
// card itself renders. We previously fetched real favicons from icon.horse and
// Google's S2 service, which disclosed the user's top-site hostnames (derived from
// their private browsing history) to those third parties — a direct contradiction
// of that promise. That network path is removed: every icon is now the letter chip
// the callers already fall back to, so no domain ever leaves the browser.
//
// The functions are kept as no-op stubs so SiteIcon / WrappedShareCard / the story
// preloader need no changes: `faviconUrl` returns null (card → letter chip),
// `resolvedFavicon` stays null (SiteIcon → letter chip), and preloading is inert.

/** Always null — no remote favicon is fetched. Callers render a letter chip. */
export function faviconUrl(_domain: string): string | null {
  return null;
}

/** No remote favicon sources — kept for callers that expect the array shape. */
export function faviconSources(_domain: string): string[] {
  return [];
}

/** Always null — the icon is never resolved to a remote URL. */
export function resolvedFavicon(_domain: string): string | null | undefined {
  return null;
}

/** No-op: nothing is preloaded because nothing is fetched. */
export function preloadFavicon(_domain: string): void {}

/** No-op: nothing is preloaded because nothing is fetched. */
export function preloadFavicons(_domains: readonly string[]): void {}
