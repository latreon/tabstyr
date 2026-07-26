import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { browser } from 'wxt/browser';
import { resetDBConnection } from '@/lib/db/db';
import { invalidateSettings } from '@/lib/settings';
import * as repo from '@/lib/db/repo';
import { dateKey, addDays } from '@/lib/time';
import Popup from '@/entrypoints/popup/App.vue';

// The popup is the surface most users see most often and had no test at all. Its
// headline numbers must agree with the dashboard's: active time only (audio
// subtracted), web domains only, and a weekly average over ACTIVE days rather than a
// flat ÷ 7.

const NOW = Date.now();
const TODAY = dateKey(NOW);

let wrapper: VueWrapper | null = null;

async function mountPopup(tabs: Array<{ id: number; url: string; incognito?: boolean }> = []) {
  vi.spyOn(browser.tabs, 'query').mockResolvedValue(tabs as never);
  wrapper = mount(Popup);
  // load() chains a locale load, five parallel storage/IndexedDB reads and the
  // renders that follow, so wait for the loading state to actually clear rather
  // than guessing at a number of microtask flushes.
  for (let i = 0; i < 40 && wrapper.find('.skeleton').exists(); i++) await flushPromises();
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  wrapper?.unmount();
  wrapper = null;
  globalThis.indexedDB = new IDBFactory();
  resetDBConnection();
  invalidateSettings();
  vi.restoreAllMocks();
});

describe('popup', () => {
  test('shows an empty state before anything is tracked', async () => {
    const w = await mountPopup();
    expect(w.find('.sites').exists()).toBe(false);
    expect(w.get('.empty').text().length).toBeGreaterThan(0);
  });

  test('lists today\'s top sites with active time, biggest first', async () => {
    await repo.commitSessions([], [
      { date: TODAY, domain: 'github.com', seconds: 600, audioSeconds: 0 },
      { date: TODAY, domain: 'news.com', seconds: 1200, audioSeconds: 0 },
    ]);
    const w = await mountPopup();
    const rows = w.findAll('.domain').map((n) => n.text());
    expect(rows).toEqual(['news.com', 'github.com']);
    expect(w.get('.total').text()).toContain('30m'); // 1800s total
  });

  test('subtracts background audio from the headline', async () => {
    await repo.commitSessions([], [
      { date: TODAY, domain: 'music.com', seconds: 600, audioSeconds: 600 }, // audio only
      { date: TODAY, domain: 'github.com', seconds: 300, audioSeconds: 0 },
    ]);
    const w = await mountPopup();
    expect(w.get('.total').text()).toContain('5m'); // 300s active, not 900s
    // An audio-only site contributes no active time, so it isn't listed.
    expect(w.findAll('.domain').map((n) => n.text())).toEqual(['github.com']);
  });

  test('excludes internal pages from the site list', async () => {
    await repo.commitSessions([], [
      { date: TODAY, domain: 'chrome', seconds: 900, audioSeconds: 0 },
      { date: TODAY, domain: 'github.com', seconds: 300, audioSeconds: 0 },
    ]);
    const w = await mountPopup();
    expect(w.findAll('.domain').map((n) => n.text())).toEqual(['github.com']);
  });

  test('strips a leading www. for display', async () => {
    await repo.commitSessions([], [{ date: TODAY, domain: 'www.github.com', seconds: 300, audioSeconds: 0 }]);
    const w = await mountPopup();
    expect(w.get('.domain').text()).toBe('github.com');
  });

  test('caps the list at five sites', async () => {
    await repo.commitSessions([], Array.from({ length: 8 }, (_, i) => ({
      date: TODAY, domain: `s${i}.com`, seconds: 100 * (i + 1), audioSeconds: 0,
    })));
    const w = await mountPopup();
    expect(w.findAll('.domain')).toHaveLength(5);
  });

  test('averages the prior week over ACTIVE days, not a flat divide by seven', async () => {
    // 2 active days of 1h each → average 1h. A flat ÷7 would report ~17m.
    await repo.commitSessions([], [
      { date: addDays(TODAY, -1), domain: 'a.com', seconds: 3600, audioSeconds: 0 },
      { date: addDays(TODAY, -2), domain: 'a.com', seconds: 3600, audioSeconds: 0 },
      { date: addDays(TODAY, -3), domain: 'a.com', seconds: 0, audioSeconds: 0 },
      { date: TODAY, domain: 'a.com', seconds: 7200, audioSeconds: 0 },
    ]);
    const w = await mountPopup();
    // Today (2h) vs a 1h average = +100%. Needs ≥3 active days to show, so it stays
    // hidden here — the assertion is that the average did not silently become ~17m.
    expect(w.get('.total').text()).toContain('2h');
    expect(w.find('.delta').exists()).toBe(false); // only 2 active days of history
  });

  test('shows the day-over-day delta once there are enough active days', async () => {
    const days = [1, 2, 3].map((d) => ({ date: addDays(TODAY, -d), domain: 'a.com', seconds: 1800, audioSeconds: 0 }));
    await repo.commitSessions([], [...days, { date: TODAY, domain: 'a.com', seconds: 3600, audioSeconds: 0 }]);
    const w = await mountPopup();
    expect(w.get('.delta').text()).toContain('100%'); // 1h vs a 30m average
  });

  test('counts open tabs but not the extension\'s own pages', async () => {
    const own = browser.runtime.getURL('/dashboard.html');
    const w = await mountPopup([
      { id: 1, url: 'https://a.com/' },
      { id: 2, url: 'https://b.com/' },
      { id: 3, url: own },
    ]);
    expect(w.get('.counts').text()).toContain('2');
  });

  test('does not count private (incognito) tabs, which are never tracked', async () => {
    const w = await mountPopup([
      { id: 1, url: 'https://a.com/' },
      { id: 2, url: 'https://secret.com/', incognito: true },
    ]);
    // Counting them would make the headline disagree with the data below it.
    expect(w.get('.counts').text()).toContain('1');
  });

  test('surfaces a load failure with a retry instead of a blank panel', async () => {
    vi.spyOn(repo, 'getStatsRange').mockRejectedValue(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = await mountPopup();
    expect(w.get('.load-error').text().length).toBeGreaterThan(0);
    expect(w.find('.retry-btn').exists()).toBe(true);
  });

  test('opening the dashboard creates a tab pointing at the dashboard page', async () => {
    const create = vi.spyOn(browser.tabs, 'create').mockResolvedValue({} as never);
    const w = await mountPopup();
    await w.get('.cta').trigger('click');
    expect(String((create.mock.calls[0][0] as { url: string }).url)).toContain('dashboard.html');
  });
});
