<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, nextTick } from 'vue';
import { useReveal } from '@/composables/useReveal';
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

// Clean-URL router (no '#'): '/privacy' = policy page, '/ideas' = idea form, else
// landing. Works on GitHub Pages via a 404.html that mirrors index.html, so a deep
// link boots the SPA and this reads the path. BASE is the Pages subpath ('/tabstyr/').
const BASE = import.meta.env.BASE_URL;
const readRoute = (): string => {
  let p = window.location.pathname;
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  return p.replace(/^\/+|\/+$/g, '');
};
const route = ref(readRoute());
const isPrivacy = computed(() => route.value === 'privacy');
const isIdeas = computed(() => route.value === 'ideas');

const { run: runReveal } = useReveal();

const afterNav = () => {
  window.scrollTo(0, 0);
  void nextTick(() => runReveal());
};
const go = (to: string) => {
  history.pushState(null, '', BASE + to);
  route.value = readRoute();
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
  go(href.slice(BASE.length).replace(/^\/+|\/+$/g, ''));
};
const onPop = () => {
  route.value = readRoute();
  afterNav();
};

onMounted(() => {
  document.addEventListener('click', onClick);
  window.addEventListener('popstate', onPop);
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

    <template v-else>
      <SiteNav />
      <main>
        <HeroSection />
        <FeatureGrid />
        <ShowcaseSection />
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
