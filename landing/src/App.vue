<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, provide, ref, nextTick } from 'vue';
import { useReveal } from '@/composables/useReveal';
import {
  applyHead,
  DEFAULT_LOCALE,
  localizedPath,
  preferredLocale,
  setLocale,
  splitLocale,
} from '@/i18n';
import SiteNav from '@/components/SiteNav.vue';
import HeroSection from '@/components/HeroSection.vue';
import FeatureGrid from '@/components/FeatureGrid.vue';
import ShowcaseSection from '@/components/ShowcaseSection.vue';
import PrivacySection from '@/components/PrivacySection.vue';
import FaqSection from '@/components/FaqSection.vue';
import FeedbackSection from '@/components/FeedbackSection.vue';
import CtaSection from '@/components/CtaSection.vue';
import SiteFooter from '@/components/SiteFooter.vue';
import PrivacyPage from '@/components/PrivacyPage.vue';
import IdeaPage from '@/components/IdeaPage.vue';
import WrappedPage from '@/components/WrappedPage.vue';
import WrappedSection from '@/components/WrappedSection.vue';

// Clean-URL router (no '#') with a leading locale slug: '/', '/de', '/fr/privacy',
// '/pt-br/ideas'. English is the un-prefixed root. Works on static hosts via a
// 404.html mirroring index.html, so any deep link boots the SPA and this reads it.
// BASE is the deploy base path ('/' on the custom domain).
const BASE = import.meta.env.BASE_URL;
const pathFromBase = (): string => {
  let p = window.location.pathname;
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  return p;
};

// `rest` is the route with any locale slug stripped: '', 'privacy', or 'ideas'.
const rest = ref(splitLocale(pathFromBase()).rest);
const isPrivacy = computed(() => rest.value === 'privacy');
const isIdeas = computed(() => rest.value === 'ideas');
const isWrapped = computed(() => rest.value === 'wrapped');

// Expose the current locale-less route so the language switcher can build links
// that keep the visitor on the same page in another language.
provide('route', rest);

const { run: runReveal } = useReveal();

const afterNav = () => {
  window.scrollTo(0, 0);
  void nextTick(() => runReveal());
};

// Apply the locale dictated by the current URL (URL is the source of truth), then
// refresh <title>/description/hreflang for the new locale + route.
const syncFromUrl = async () => {
  const { code, rest: r } = splitLocale(pathFromBase());
  rest.value = r;
  await setLocale(code, false);
  applyHead(r);
};

const go = async (code: string, to: string) => {
  history.pushState(null, '', localizedPath(code, to));
  await syncFromUrl();
  // Persist an explicit language pick so a future visit to the bare root honors it.
  setLocale(code, true);
  afterNav();
};

// Intercept clicks on internal route links so navigation stays SPA (no reload).
// External links, new-tab/modified clicks, in-page '#anchors', and mailto pass through.
const onClick = (e: MouseEvent) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as HTMLElement)?.closest?.('a');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href || a.target === '_blank' || a.hasAttribute('download')) return;
  // In-page anchors: smooth-scroll without writing '#' into the URL.
  if (href.startsWith('#')) {
    e.preventDefault();
    const id = href.slice(1);
    const el = id && id !== 'top' ? document.getElementById(id) : null;
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (/^(https?:)?\/\//.test(href) || href.startsWith('mailto:')) return;
  if (!href.startsWith(BASE)) return;
  e.preventDefault();
  const { code, rest: r } = splitLocale(href.slice(BASE.length));
  void go(code, r);
};
const onPop = () => {
  void syncFromUrl().then(afterNav);
};

onMounted(() => {
  document.addEventListener('click', onClick);
  window.addEventListener('popstate', onPop);

  // First paint: if the URL carries an explicit locale, honor it. A bare root visit
  // adopts the visitor's stored/browser preference (replaceState — no extra history
  // entry, and crawlers still see '/' as canonical English via the hreflang tags).
  const { code, rest: r } = splitLocale(pathFromBase());
  if (code !== DEFAULT_LOCALE) {
    void syncFromUrl();
  } else {
    const pref = preferredLocale();
    if (pref !== DEFAULT_LOCALE) {
      history.replaceState(null, '', localizedPath(pref, r));
    }
    void syncFromUrl();
  }
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onClick);
  window.removeEventListener('popstate', onPop);
});
</script>

<template>
  <div class="page">
    <div class="grain" aria-hidden="true" />

    <PrivacyPage v-if="isPrivacy" />
    <IdeaPage v-else-if="isIdeas" />
    <WrappedPage v-else-if="isWrapped" />

    <template v-else>
      <SiteNav />
      <main>
        <HeroSection />
        <FeatureGrid />
        <ShowcaseSection />
        <WrappedSection />
        <PrivacySection />
        <FaqSection />
        <FeedbackSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </template>
  </div>
</template>

<style scoped>
.page { position: relative; min-height: 100vh; }
.page::before {
  content: '';
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse 90% 50% at 50% -5%, rgba(124, 92, 240, 0.06), transparent 60%);
  pointer-events: none;
  z-index: 0;
}
.grain {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
main { position: relative; z-index: 1; }
</style>
