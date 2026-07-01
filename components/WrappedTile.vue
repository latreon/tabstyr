<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { browser } from 'wxt/browser';
import { WRAPPED_URL } from '@/lib/links';
import { ICONS } from '@/lib/wrapped-icons';

const { t } = useI18n();
// Reuse the shared sparkles glyph so the on-brand icon matches the web Wrapped.
const sparklePaths = ICONS.sparkles.paths;

function open() {
  // User-initiated navigation only — the extension makes no network request.
  void browser.tabs.create({ url: WRAPPED_URL });
}
</script>

<template>
  <button type="button" class="tile wrapped-tile" @click="open">
    <span class="glyph" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path v-for="(d, i) in sparklePaths" :key="i" :d="d" /></svg>
    </span>
    <span class="body">
      <span class="title">{{ t('wrapped.title') }}</span>
      <span class="subtitle">{{ t('wrapped.subtitle') }}</span>
    </span>
    <span class="cta">{{ t('wrapped.cta') }}<span class="arrow" aria-hidden="true">→</span></span>
  </button>
</template>

<style scoped>
.wrapped-tile {
  position: relative;
  overflow: hidden;
  grid-column: span 3;
  display: flex;
  align-items: center;
  gap: 18px;
  width: 100%;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  padding: 20px 22px;
  color: var(--text);
  border: 1px solid color-mix(in oklab, var(--accent) 40%, var(--border));
  /* Diagonal accent wash + a soft glow bottom-right. color-mix over --card keeps
     the contrast right in BOTH themes (tints the card surface, never pure accent). */
  background:
    radial-gradient(90% 160% at 100% 120%, color-mix(in oklab, var(--accent) 24%, transparent), transparent 55%),
    linear-gradient(135deg, color-mix(in oklab, var(--accent) 16%, var(--card-strong)), var(--card-strong) 72%);
  transition: border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
}
.wrapped-tile:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
  box-shadow: 0 10px 28px var(--accent-muted);
}
.wrapped-tile:active { transform: translateY(0); }
.wrapped-tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.glyph {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--accent-grad-strong);
}
.glyph svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: var(--on-accent);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.title { font-size: var(--text-base); font-weight: 800; letter-spacing: -0.2px; }
.subtitle { font-size: 12px; color: var(--text-3); line-height: 1.4; }
.cta {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--accent);
}
.arrow { transition: transform 140ms ease; }
.wrapped-tile:hover .arrow { transform: translateX(3px); }
@media (prefers-reduced-motion: reduce) {
  .wrapped-tile, .wrapped-tile:hover, .arrow { transition: none; transform: none; }
}
@media (max-width: 520px) {
  .wrapped-tile { flex-wrap: wrap; }
  .cta { margin-left: 56px; }
}
</style>
