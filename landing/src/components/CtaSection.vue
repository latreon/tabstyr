<script setup lang="ts">
import { LINKS, STORE_LIVE, ANY_STORE_LIVE } from '@/site';
import { useI18n } from '@/i18n';

const { t } = useI18n();
</script>

<template>
  <section class="section">
    <div class="container">
      <div class="cta glass reveal">
        <div class="glow" aria-hidden="true" />
        <h2 class="h2">{{ t('cta.title') }}</h2>
        <p class="sub">{{ t('cta.sub') }}</p>

        <div class="actions">
          <a v-if="STORE_LIVE.chrome" :href="LINKS.chrome" target="_blank" rel="noopener" class="btn btn-primary">{{ t('cta.primary') }}</a>
          <span v-else class="btn btn-primary is-soon" role="button" aria-disabled="true">{{ t('cta.comingSoon') }}</span>
        </div>

        <div class="stores">
          <a v-if="STORE_LIVE.edge" :href="LINKS.edge" target="_blank" rel="noopener">{{ t('cta.edge') }}</a>
          <span v-else class="muted">{{ t('cta.edgeSoon') }}</span>
          <span aria-hidden="true">·</span>
          <a v-if="STORE_LIVE.firefox" :href="LINKS.firefox" target="_blank" rel="noopener">{{ t('cta.firefox') }}</a>
          <span v-else class="muted">{{ t('cta.firefoxSoon') }}</span>
          <span aria-hidden="true">·</span>
          <span class="muted">{{ t('cta.safariSoon') }}</span>
        </div>
        <p v-if="!ANY_STORE_LIVE" class="soon-note">{{ t('cta.soonNote') }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cta {
  position: relative;
  overflow: hidden;
  text-align: center;
  padding: 72px 32px;
  background: linear-gradient(160deg, rgba(124, 92, 240, 0.16), var(--card));
  border-color: rgba(124, 92, 240, 0.22);
}
.glow {
  position: absolute; bottom: -160px; left: 50%; transform: translateX(-50%);
  width: 600px; height: 360px;
  background: radial-gradient(ellipse, rgba(124, 92, 240, 0.3), transparent 70%);
  filter: blur(80px); pointer-events: none;
}
.h2 { position: relative; font-size: clamp(2rem, 1.5rem + 2.6vw, 3.2rem); font-weight: 700; }
.sub { position: relative; color: var(--text-2); margin: 16px auto 30px; max-width: 520px; }
.actions { position: relative; display: flex; justify-content: center; }
.stores { position: relative; margin-top: 22px; font-size: 14px; color: var(--text-2); display: flex; gap: 12px; justify-content: center; align-items: center; }
.stores a { font-weight: 600; transition: color 160ms ease; }
.stores a:hover { color: var(--accent); }
.stores .muted { color: var(--text-3); }
.is-soon { opacity: 0.6; cursor: not-allowed; pointer-events: none; }
.soon-note { position: relative; margin: 16px 0 0; font-size: 13px; color: var(--text-3); }
</style>
