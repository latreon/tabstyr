<script setup lang="ts">
import { computed, ref } from 'vue';
import { localizedPath, locale, useI18n } from '@/i18n';
import RingLogo from './RingLogo.vue';
import LangSwitch from './LangSwitch.vue';
import WrappedDropzone from './wrapped/WrappedDropzone.vue';
import WrappedStory from './wrapped/WrappedStory.vue';
import type { WrappedData } from '@ext/wrapped';

const { t } = useI18n();
const home = computed(() => localizedPath(locale.value, ''));
const data = ref<WrappedData | null>(null);
</script>

<template>
  <div class="wrapped">
    <div class="orb" aria-hidden="true" />

    <header class="bar">
      <div class="container bar-inner">
        <a :href="home" class="brand"><RingLogo :size="24" /> <span>TabStyr</span></a>
        <div class="bar-right">
          <LangSwitch />
          <a :href="home" class="back">{{ t('wrapped.page.back') }}</a>
        </div>
      </div>
    </header>

    <main class="container body">
      <WrappedDropzone v-if="!data" @loaded="data = $event" />
      <WrappedStory v-else :data="data" @restart="data = null" />
    </main>
  </div>
</template>

<style scoped>
.wrapped { position: relative; min-height: 100vh; display: flex; flex-direction: column; }
.orb {
  position: fixed;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 80vw;
  height: 60vh;
  background: radial-gradient(ellipse at center, rgba(124, 92, 240, 0.16), transparent 65%);
  pointer-events: none;
  z-index: 0;
}
.bar { position: relative; z-index: 2; padding: 20px 0; }
.bar-inner { display: flex; align-items: center; justify-content: space-between; }
.brand { display: inline-flex; align-items: center; gap: 9px; font-family: var(--font-display); font-weight: 700; font-size: 18px; color: var(--text); }
.bar-right { display: flex; align-items: center; gap: 16px; }
.back { font-size: 14px; font-weight: 600; color: var(--text-2); }
.back:hover { color: var(--text); }
.body {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 24px;
  padding-bottom: 48px;
}
</style>
