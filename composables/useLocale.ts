import { ref } from 'vue';
import { broadcastSettingsChanged, getSettings, saveSettings } from '@/lib/settings';
import { setLocale, resolveLocale, cacheLanguagePref } from '@/lib/i18n';

// User preference: 'auto' (follow the browser) or a supported locale code.
const language = ref<string>('auto');

export function useLocale() {
  async function load(): Promise<void> {
    // Fall back to 'auto' (browser locale) if settings can't be read.
    try { language.value = (await getSettings()).language; } catch (e) { console.error('[locale] load failed', e); }
    // Keep the pre-paint mirror in step with the stored preference (it may have been
    // changed on another extension page).
    cacheLanguagePref(language.value);
    await setLocale(resolveLocale(language.value));
  }

  async function setLanguage(pref: string): Promise<void> {
    language.value = pref;
    // Cache the PREFERENCE verbatim, so 'auto' stays 'auto' for the next cold start.
    cacheLanguagePref(pref);
    // Switch the active locale even if persisting the preference fails.
    try {
      await saveSettings({ language: pref });
      // The worker renders every notification (stale tabs, budgets, session alerts)
      // in settings.language from its own cached copy — on Firefox that background
      // page is persistent, so without this broadcast notifications stayed in the
      // previous language for the rest of the browser session.
      await broadcastSettingsChanged();
    } catch (e) { console.error('[locale] save failed', e); }
    await setLocale(resolveLocale(pref));
  }

  return { language, load, setLanguage };
}
