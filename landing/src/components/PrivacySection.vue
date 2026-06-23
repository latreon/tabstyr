<script setup lang="ts">
import { computed } from 'vue';
import { localizedPath, locale, useI18n } from '@/i18n';

const { t, tm } = useI18n();
const points = computed(() => tm<{ k: string; v: string }[]>('privacyBand.points'));
const privacyHref = computed(() => localizedPath(locale.value, 'privacy'));
</script>

<template>
  <section id="privacy" class="section">
    <div class="container">
      <div class="panel glass reveal">
        <div class="badge-glow" aria-hidden="true" />
        <span class="eyebrow">{{ t('privacyBand.eyebrow') }}</span>
        <h2 class="h2">
          <span class="num gradient-text">{{ t('privacyBand.h2Num') }}</span> {{ t('privacyBand.h2Rest') }}
        </h2>
        <p class="lede">{{ t('privacyBand.lede') }}</p>

        <ul class="points">
          <li v-for="(p, i) in points" :key="i">
            <span class="check" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
            </span>
            <span><strong>{{ p.k }}.</strong> {{ p.v }}</span>
          </li>
        </ul>

        <a :href="privacyHref" class="policy-link">{{ t('privacyBand.policyLink') }}</a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  position: relative;
  padding: 56px;
  overflow: hidden;
  background: linear-gradient(160deg, rgba(124, 92, 240, 0.10), var(--card));
  border-color: rgba(124, 92, 240, 0.2);
}
.badge-glow {
  position: absolute; top: -120px; right: -80px; width: 380px; height: 380px;
  background: radial-gradient(circle, rgba(124,92,240,0.25), transparent 70%);
  filter: blur(80px); pointer-events: none;
}
.h2 { font-size: clamp(2rem, 1.4rem + 2.6vw, 3.2rem); font-weight: 700; margin-top: 16px; }
.num { font-size: 1.05em; }
.lede { max-width: 600px; color: var(--text-2); margin: 18px 0 36px; font-size: 1.1rem; }
.points {
  display: grid; grid-template-columns: 1fr 1fr; gap: 18px 32px;
  margin: 0; padding: 0; list-style: none;
}
.points li { display: flex; gap: 12px; color: var(--text-2); }
.points strong { color: var(--text); }
.check {
  flex: none; width: 26px; height: 26px; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--accent-muted); color: var(--accent);
}
.check svg { width: 15px; height: 15px; }
.policy-link {
  display: inline-block; margin-top: 36px; font-weight: 600; color: var(--accent);
  transition: opacity 160ms ease;
}
.policy-link:hover { opacity: 0.8; }
@media (max-width: 700px) {
  .panel { padding: 36px 26px; }
  .points { grid-template-columns: 1fr; }
}
</style>
