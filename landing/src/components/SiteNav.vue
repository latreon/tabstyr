<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import RingLogo from './RingLogo.vue';
import { LINKS } from '@/site';

const scrolled = ref(false);
const onScroll = () => (scrolled.value = window.scrollY > 12);
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }));
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll));
</script>

<template>
  <header class="nav" :class="{ scrolled }">
    <div class="container nav-inner">
      <a href="#top" class="brand">
        <RingLogo :size="24" />
        <span>TabStyr</span>
      </a>
      <nav class="links" aria-label="Primary">
        <a href="#features">Features</a>
        <a href="#showcase">Dashboard</a>
        <a href="#privacy">Privacy</a>
        <a href="#faq">FAQ</a>
      </nav>
      <a :href="LINKS.chrome" target="_blank" rel="noopener" class="btn btn-primary cta">
        Add to Chrome
      </a>
    </div>
  </header>
</template>

<style scoped>
.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  transition: background 240ms ease, border-color 240ms ease, backdrop-filter 240ms ease;
  border-bottom: 1px solid transparent;
}
.nav.scrolled {
  background: rgba(10, 10, 15, 0.72);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom-color: var(--border);
}
.nav-inner {
  display: flex;
  align-items: center;
  gap: 24px;
  height: 68px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.01em;
}
.links {
  display: flex;
  gap: 28px;
  margin-left: auto;
}
.links a {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-2);
  transition: color 160ms ease;
}
.links a:hover { color: var(--text); }
.cta { height: 40px; padding: 0 16px; font-size: 14px; }
@media (max-width: 760px) {
  .links { display: none; }
  .cta { margin-left: auto; }
}
</style>
