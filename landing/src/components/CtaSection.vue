<script setup lang="ts">
import { LINKS } from '@/site';
</script>

<template>
  <section class="section">
    <div class="container">
      <div class="cta glass reveal">
        <div class="glow" aria-hidden="true" />
        <h2 class="h2">Take back your browser time.</h2>
        <p class="sub">Install in two clicks. Your data never leaves the device. Uninstall removes everything.</p>

        <div class="actions">
          <a :href="LINKS.chrome" target="_blank" rel="noopener" class="btn btn-primary">Add to Chrome — free</a>
        </div>

        <div class="stores">
          <a :href="LINKS.edge" target="_blank" rel="noopener">Edge Add-ons</a>
          <span aria-hidden="true">·</span>
          <a :href="LINKS.firefox" target="_blank" rel="noopener">Firefox</a>
          <span aria-hidden="true">·</span>
          <span class="muted">Safari soon</span>
        </div>
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
</style>
