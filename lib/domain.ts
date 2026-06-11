export function domainOf(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.hostname;
    return u.protocol.replace(':', '');
  } catch {
    return 'other';
  }
}
