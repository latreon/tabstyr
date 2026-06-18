<script setup lang="ts">
import { LINKS } from '@/site';
const points = [
  { k: 'No servers', v: 'Nothing is uploaded. There is no backend to send data to.' },
  { k: 'No accounts', v: 'Install and go. No sign-up, no email, no profile.' },
  { k: 'No trackers', v: 'No analytics, no ads, no third-party scripts.' },
  { k: 'No page reading', v: 'Only tab metadata (URL/title) from standard browser APIs.' },
];
</script>

<template>
  <section id="privacy" class="section">
    <div class="container">
      <div class="panel glass reveal">
        <div class="badge-glow" aria-hidden="true" />
        <span class="eyebrow">Privacy, not as a feature — as the foundation</span>
        <h2 class="h2">
          <span class="num gradient-text">0 bytes</span> leave your device.
        </h2>
        <p class="lede">
          Your data lives in your browser's own database (IndexedDB), pruned to a rolling
          90-day window. You can export it, restore it, or wipe it — any time, all offline.
        </p>

        <ul class="points">
          <li v-for="p in points" :key="p.k">
            <span class="check" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
            </span>
            <span><strong>{{ p.k }}.</strong> {{ p.v }}</span>
          </li>
        </ul>

        <a :href="LINKS.privacy" class="policy-link">Read the full privacy policy →</a>
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
