<script setup lang="ts">
import { computed } from 'vue';
import RingLogo from './RingLogo.vue';
import { localizedPath, locale, useI18n } from '@/i18n';

const { t, tm } = useI18n();
const home = computed(() => localizedPath(locale.value, ''));

const stores = computed(() => tm<{ label: string; body: string }[]>('privacyPage.stores'));
const notItems = computed(() => tm<string[]>('privacyPage.notItems'));
const perms = computed(() => tm<{ perm: string; why: string }[]>('privacyPage.perms'));
const controlItems = computed(() => tm<string[]>('privacyPage.controlItems'));
</script>

<template>
  <div class="privacy">
    <div class="orb" aria-hidden="true" />

    <header class="bar">
      <div class="container bar-inner">
        <a :href="home" class="brand"><RingLogo :size="24" /> <span>TabStyr</span></a>
        <a :href="home" class="back">{{ t('privacyPage.back') }}</a>
      </div>
    </header>

    <main class="container body">
      <span class="eyebrow reveal-static">{{ t('privacyPage.eyebrow') }}</span>
      <h1 class="title"><span class="gradient-text">{{ t('privacyPage.titleNum') }}</span> {{ t('privacyPage.titleRest') }}</h1>
      <p class="updated">{{ t('privacyPage.updated') }}</p>

      <div class="card glass">
        <p class="lead">
          <strong>{{ t('privacyPage.leadStrong') }}</strong>
          {{ t('privacyPage.leadRest') }}
        </p>

        <h2>{{ t('privacyPage.storesTitle') }}</h2>
        <ul>
          <li v-for="(s, i) in stores" :key="i"><strong>{{ s.label }}</strong> — {{ s.body }}</li>
        </ul>
        <p>{{ t('privacyPage.retention') }}</p>

        <h2>{{ t('privacyPage.notTitle') }}</h2>
        <ul>
          <li v-for="(n, i) in notItems" :key="i">{{ n }}</li>
        </ul>

        <h2>{{ t('privacyPage.permsTitle') }}</h2>
        <table>
          <thead><tr><th>{{ t('privacyPage.permCol') }}</th><th>{{ t('privacyPage.purposeCol') }}</th></tr></thead>
          <tbody>
            <tr v-for="p in perms" :key="p.perm"><td><code>{{ p.perm }}</code></td><td>{{ p.why }}</td></tr>
          </tbody>
        </table>
        <p>{{ t('privacyPage.noHost') }}</p>

        <h2>{{ t('privacyPage.controlTitle') }}</h2>
        <ul>
          <li v-for="(c, i) in controlItems" :key="i">{{ c }}</li>
        </ul>
      </div>

      <a :href="home" class="back-cta">{{ t('privacyPage.backCta') }}</a>
    </main>
  </div>
</template>

<style scoped>
.privacy { position: relative; min-height: 100vh; }
.orb {
  position: fixed; top: -160px; left: 50%; transform: translateX(-50%);
  width: 640px; height: 420px; pointer-events: none; z-index: 0;
  background: radial-gradient(ellipse, rgba(124, 92, 240, 0.22), transparent 70%);
  filter: blur(130px);
}
.bar {
  position: sticky; top: 0; z-index: 10;
  background: rgba(10, 10, 15, 0.72); backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
}
.bar-inner { display: flex; align-items: center; justify-content: space-between; height: 64px; }
.brand { display: inline-flex; align-items: center; gap: 9px; font-family: var(--font-display); font-weight: 700; font-size: 18px; }
.back { font-size: 14px; font-weight: 500; color: var(--text-2); transition: color 160ms ease; }
.back:hover { color: var(--text); }
.body { position: relative; z-index: 1; padding-top: 72px; padding-bottom: 96px; }
.title { font-size: clamp(2.2rem, 1.6rem + 3vw, 3.4rem); font-weight: 700; margin-top: 14px; }
.updated { color: var(--text-3); font-size: 14px; margin: 12px 0 32px; }
.card { padding: 40px; }
.lead { font-size: 1.1rem; color: var(--text); margin: 0 0 8px; }
h2 { font-family: var(--font-display); font-size: 1.25rem; font-weight: 600; margin: 34px 0 12px; }
.card p, .card li { color: var(--text-2); }
.card strong { color: var(--text); }
.card ul { margin: 0; padding-left: 22px; display: grid; gap: 8px; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.95rem; }
th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); }
th { color: var(--text-3); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
code {
  background: var(--accent-muted); color: var(--accent);
  padding: 2px 7px; border-radius: 6px; font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.back-cta { display: inline-block; margin-top: 36px; font-weight: 600; color: var(--accent); }
.back-cta:hover { opacity: 0.8; }
@media (max-width: 600px) { .card { padding: 26px; } }
</style>
