// Synchronous theme cache so an extension page can paint the correct theme BEFORE
// Vue mounts — avoiding a dark↔light flash when the saved theme differs from the OS.
// storage.local (the source of truth, read in useTheme) is async; localStorage is
// synchronous and scoped to the extension origin, so it's a safe pre-paint mirror.
const KEY = 'tabstyr:theme';

export function cacheTheme(theme: string): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage unavailable — the CSS prefers-color-scheme fallback still applies */
  }
}

export function applyCachedTheme(): void {
  try {
    const saved = localStorage.getItem(KEY);
    const setting = saved === 'dark' || saved === 'light' ? saved : 'system';
    const dark =
      setting === 'dark' ||
      (setting === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch {
    /* leave the CSS media-query fallback in place */
  }
}
