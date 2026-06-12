import { browser } from 'wxt/browser';

export function openDomain(domain: string): void {
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
