import { ref } from 'vue';
import { getSettings, saveSettings } from '@/lib/settings';
import { setLocale, resolveLocale } from '@/lib/i18n';

// User preference: 'auto' (follow the browser) or a supported locale code.
const language = ref<string>('auto');

export function useLocale() {
  async function load(): Promise<void> {
    // Fall back to 'auto' (browser locale) if settings can't be read.
    try { language.value = (await getSettings()).language; } catch (e) { console.error('[locale] load failed', e); }
    await setLocale(resolveLocale(language.value));
  }

  async function setLanguage(pref: string): Promise<void> {
    language.value = pref;
    // Switch the active locale even if persisting the preference fails.
    try { await saveSettings({ language: pref }); } catch (e) { console.error('[locale] save failed', e); }
    await setLocale(resolveLocale(pref));
  }

  return { language, load, setLanguage };
}
