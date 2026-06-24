<script setup lang="ts">
import { computed } from 'vue';
import { localizedPath, locale, useI18n } from '@/i18n';
import WrappedIcon from './wrapped/WrappedIcon.vue';

const { t } = useI18n();
const href = computed(() => localizedPath(locale.value, 'wrapped'));
</script>

<template>
  <section id="wrapped" class="section wrapped-band">
    <div class="container inner">
      <div class="copy">
        <span class="eyebrow">{{ t('wrapped.eyebrow') }}</span>
        <h2 class="title">{{ t('wrapped.drop.title') }}</h2>
        <p class="lead">{{ t('meta.wrappedDescription') }}</p>
        <a :href="href" class="btn btn-primary cta">
          {{ t('wrapped.cta') }}
          <WrappedIcon name="chevronRight" :size="18" />
        </a>
        <p class="note"><WrappedIcon name="lock" :size="13" /> {{ t('wrapped.drop.hint') }}</p>
      </div>

      <!-- Decorative mock of the shareable card (not real data) -->
      <a :href="href" class="card-mock" aria-hidden="true" tabindex="-1">
        <div class="mock-inner">
          <span class="mock-head">Browsing Wrapped</span>
          <span class="mock-period">Jan – Dec · 312 days</span>
          <span class="mock-badge"><WrappedIcon name="binger" :size="40" /></span>
          <span class="mock-persona">The Binger</span>
          <span class="mock-big">38<small>d</small> 04<small>h</small></span>
          <span class="mock-cap">total active browsing</span>
          <span class="mock-row"><b>Top site</b><span>youtube.com</span></span>
          <span class="mock-row"><b>Focus</b><span>61%</span></span>
        </div>
      </a>
    </div>
  </section>
</template>

<style scoped>
.wrapped-band {
  position: relative;
  /* A touch shorter than the default .section rhythm. */
  padding: 80px 0;
}
@media (max-width: 760px) {
  .wrapped-band {
    padding: 56px 0;
  }
}
.inner {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 56px;
  align-items: center;
}
@media (max-width: 860px) {
  .inner {
    grid-template-columns: 1fr;
    gap: 40px;
  }
}
.copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
}
.title {
  font-size: clamp(34px, 5vw, 52px);
  font-weight: 700;
  background: var(--accent-grad);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.lead {
  font-size: 18px;
  color: var(--text-2);
  margin: 0;
  max-width: 46ch;
  line-height: 1.6;
}
.cta {
  gap: 8px;
  text-decoration: none;
}
.note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-3);
  margin: 0;
}

/* ── Card mock (eye-candy, links to the tool) ───────────────────────────── */
.card-mock {
  justify-self: center;
  width: 280px;
  max-width: 100%;
  border-radius: 26px;
  padding: 28px 24px;
  color: #fff;
  background: linear-gradient(160deg, #7c5cf0, #4f86f7);
  box-shadow: var(--shadow-lg), 0 0 60px -16px rgba(124, 92, 240, 0.55);
  transform: rotate(-2.5deg);
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms ease;
  position: relative;
  overflow: hidden;
}
.card-mock::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255, 255, 255, 0.25), transparent 70%);
  pointer-events: none;
}
.card-mock:hover {
  transform: rotate(0deg) translateY(-4px);
  box-shadow: var(--shadow-lg), 0 0 80px -10px rgba(124, 92, 240, 0.7);
}
.mock-inner {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
}
.mock-head { font-weight: 800; font-size: 15px; letter-spacing: 0.02em; }
.mock-period { font-size: 11px; opacity: 0.8; margin-bottom: 8px; }
.mock-badge {
  width: 62px;
  height: 62px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.25);
  margin-bottom: 4px;
}
.mock-persona { font-weight: 800; font-size: 22px; }
.mock-big {
  font-weight: 800;
  font-size: 48px;
  line-height: 1.1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.mock-big small { font-size: 26px; opacity: 0.85; font-weight: 700; }
.mock-cap { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.78; margin-bottom: 10px; }
.mock-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 10px;
  padding: 9px 13px;
  margin-top: 7px;
}
.mock-row b { font-weight: 700; opacity: 0.78; text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; align-self: center; }
@media (prefers-reduced-motion: reduce) {
  .card-mock { transform: none; }
  .card-mock:hover { transform: translateY(-4px); }
}
</style>
