// Real site icons for the Browsing Wrapped story.
//
// PRIVACY NOTE: this is the ONLY place the Wrapped tool touches the network. To
// show a real logo we ask DuckDuckGo's icon proxy for the favicon of each top
// domain — so those (already-public) hostnames are sent to DuckDuckGo. No stats,
// totals, sessions, or file contents ever leave the browser; only an icon lookup.
// DuckDuckGo is used over Google for its no-logging stance, and requests are sent
// with no referrer. The downloadable share card does NOT use this (it draws a
// letter chip), so the exported image still involves zero network.

export function faviconUrl(domain: string): string | null {
  const d = domain.replace(/^www\./, '').toLowerCase();
  // Skip non-public hosts — localhost and bare IPv4 literals (a backup is untrusted
  // and may contain 127.0.0.1, 192.168.x, 169.254.169.254, …). No point asking a
  // third party for their icon, and it keeps private/loopback addresses on-device.
  // The caller falls back to a letter chip when this returns null.
  if (d === 'localhost' || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(d)) return null;
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(d)}.ico`;
}
