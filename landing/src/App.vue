<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue';
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

// Tiny hash router: '#/privacy' = policy page, '#/ideas' = idea form, else landing.
const hash = ref(window.location.hash);
const onHash = () => (hash.value = window.location.hash);
const route = computed(() => hash.value.replace(/^#\/?/, ''));
const isPrivacy = computed(() => route.value === 'privacy');
const isIdeas = computed(() => route.value === 'ideas');

const { run: runReveal } = useReveal();

// On any route change: jump to top and re-scan scroll-reveal targets.
watch(hash, () => {
  window.scrollTo(0, 0);
  void nextTick(() => runReveal());
});

onMounted(() => window.addEventListener('hashchange', onHash));
onBeforeUnmount(() => window.removeEventListener('hashchange', onHash));
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
