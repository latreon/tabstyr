import { browser } from 'wxt/browser';
import { isWebDomain } from './domain';

export function openDomain(domain: string): void {
  // Never build `https://chrome/` etc. from an internal-scheme bucket.
  if (!isWebDomain(domain)) return;
  void browser.tabs.create({ url: `https://${domain}/` });
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
