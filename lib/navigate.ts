import { browser } from 'wxt/browser';
import { isWebDomain } from './domain';

export function openDomain(domain: string): void {
  // Never build `https://chrome/` etc. from an internal-scheme bucket.
  if (!isWebDomain(domain)) return;
  const url = `https://${domain}/`;
  // Belt-and-suspenders: re-parse and confirm it is genuinely https with the same
  // host, so a tampered value can't smuggle a javascript:/data:/file: navigation.
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.hostname !== domain) return;
  } catch {
    return;
  }
  void browser.tabs.create({ url });
}

export function openPage(domain: string, path: string): void {
  // Same hardening as openDomain, but for a specific sub-page path. The re-parse
  // confirms the result is https on the SAME host, so a tampered path can't
  // smuggle a different origin or a javascript:/data:/file: navigation.
  if (!isWebDomain(domain)) return;
  const url = `https://${domain}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.hostname !== domain) return;
  } catch {
    return;
  }
  void browser.tabs.create({ url });
}

export async function focusTab(tabId: number): Promise<void> {
  try {
    const tab = await browser.tabs.update(tabId, { active: true });
    if (tab?.windowId !== undefined) {
      await browser.windows.update(tab.windowId, { focused: true });
    }
  } catch (e) {
    console.error('[tab-time] focusTab failed', e);
  }
}
