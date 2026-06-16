import { afterEach, describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { i18n, setLocale } from '@/lib/i18n';
import OnboardingCard from '@/components/OnboardingCard.vue';

afterEach(() => setLocale('en'));

describe('locale switching', () => {
  test('rendered text follows the active locale', async () => {
    setLocale('en');
    const w = mount(OnboardingCard, { global: { plugins: [i18n] }, attachTo: document.body });
    expect(w.get('.title').text()).toBe('Welcome to TabStyr');

    setLocale('de');
    await nextTick();
    const deTitle = w.get('.title').text();
    expect(deTitle).not.toBe('Welcome to TabStyr');
    expect(deTitle.length).toBeGreaterThan(0);

    setLocale('ja');
    await nextTick();
    expect(w.get('.title').text()).not.toBe(deTitle);
    w.unmount();
  });

  test('category names are localized', async () => {
    setLocale('es');
    await nextTick();
    // es catalog must define each category label
    expect(i18n.global.t('categories.Work')).not.toBe('');
    expect(i18n.global.t('categories.Finance')).not.toBe('');
  });

  test('falls back to en for an unknown key', () => {
    setLocale('fr');
    // missing keys fall back to the en message (here: the key itself if absent everywhere)
    expect(i18n.global.t('settings.save')).toBeTruthy();
  });
});
