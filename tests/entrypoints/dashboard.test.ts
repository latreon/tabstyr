import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { resetDBConnection } from '@/lib/db/db';
import * as repo from '@/lib/db/repo';
import { i18n } from '@/lib/i18n';
import { invalidateSettings, saveSettings } from '@/lib/settings';
import { dateKey } from '@/lib/time';
import Dashboard from '@/entrypoints/dashboard/App.vue';

const tr = (key: string) => i18n.global.t(key);
let wrapper: VueWrapper | null = null;

async function mountDashboard() {
  wrapper = mount(Dashboard, { attachTo: document.body });
  await vi.waitFor(() => expect(wrapper!.find('[aria-busy="true"]').exists()).toBe(false));
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDBConnection();
  fakeBrowser.reset();
  invalidateSettings();
  localStorage.clear();
  history.replaceState(null, '', '/dashboard.html');
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('dashboard', () => {
  test('a first run shows the onboarding intro', async () => {
    await mountDashboard();
    expect(document.body.textContent).toContain(tr('onboarding.title'));
  });

  test('once onboarded, the intro stays hidden and tracked sites are listed', async () => {
    await saveSettings({ onboarded: true });
    await repo.applyDailyStatsMax([{ date: dateKey(Date.now()), domain: 'github.com', seconds: 1_800, audioSeconds: 0 }]);

    const w = await mountDashboard();

    expect(document.body.textContent).not.toContain(tr('onboarding.title'));
    expect(w.text()).toContain('github.com');
  });

  test('a failed load shows an error with a retry that recovers', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const read = vi.spyOn(repo, 'getStatsRange').mockRejectedValueOnce(new Error('db down'));
    const w = await mountDashboard();
    expect(w.get('.load-error').text()).toContain(tr('common.loadError'));

    await w.get('.load-error button').trigger('click');
    await vi.waitFor(() => expect(w.find('.load-error').exists()).toBe(false));
    expect(read.mock.calls.length).toBeGreaterThan(1);
  });

  test('a full disk shows the storage warning', async () => {
    await fakeBrowser.storage.local.set({ storageWarning: true });
    const w = await mountDashboard();
    expect(w.get('.storage-warn').text()).toBe(tr('common.storageFull'));
  });

  test('an opened section stays open on the next visit', async () => {
    let w = await mountDashboard();
    const trends = w.findAll('details.group')[0]!;
    (trends.element as HTMLDetailsElement).open = true;
    await trends.trigger('toggle');
    w.unmount();

    w = await mountDashboard();
    expect((w.findAll('details.group')[0]!.element as HTMLDetailsElement).open).toBe(true);
  });

  test('a corrupted saved section state falls back to closed sections', async () => {
    localStorage.setItem('tabstyr:dashboardGroups', '{not json');
    const w = await mountDashboard();
    expect(w.findAll('details.group').map((d) => (d.element as HTMLDetailsElement).open)).toEqual([false, false]);
  });

  test('the #privacy link opens the privacy dialog and drops the hash', async () => {
    history.replaceState(null, '', '/dashboard.html#privacy');
    await mountDashboard();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(location.hash).toBe('');
  });
});
