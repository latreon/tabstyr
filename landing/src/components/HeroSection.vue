<script setup lang="ts">
import { LINKS, STATS } from '@/site';
import dashboardDark from '@/assets/dashboard-dark.png';
</script>

<template>
  <section id="top" class="hero">
    <!-- ambient orbs -->
    <div class="orb orb-1" aria-hidden="true" />
    <div class="orb orb-2" aria-hidden="true" />

    <div class="container hero-inner">
      <span class="eyebrow reveal">
        <span class="dot" aria-hidden="true" /> 100% local · open by design
      </span>

      <h1 class="title reveal">
        See where your browser<br />
        time <span class="gradient-text">really goes.</span>
      </h1>

      <p class="lede reveal">
        TabStyr quietly measures active time per tab and site, then turns it into a
        calm dashboard — trends, an activity heatmap, focus scoring, and gentle
        stale-tab nudges. Every byte stays on your device.
      </p>

      <div class="actions reveal">
        <a :href="LINKS.chrome" target="_blank" rel="noopener" class="btn btn-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.2" /><path d="M12 3v6M21 12h-9M5 18l4.5-7" /></svg>
          Add to Chrome — free
        </a>
      </div>

      <p class="micro reveal">No account · no servers · no tracking · MIT licensed</p>

      <!-- dashboard preview -->
      <div class="preview reveal">
        <div class="preview-glow" aria-hidden="true" />
        <img :src="dashboardDark" alt="TabStyr dashboard showing today's active time, category breakdown, trends and an activity heatmap" width="1120" height="700" />
      </div>

      <dl class="stats reveal">
        <div v-for="s in STATS" :key="s.label" class="stat">
          <dt class="stat-value"><span class="gradient-text">{{ s.value }}</span><em>{{ s.unit }}</em></dt>
          <dd class="stat-label">{{ s.label }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  padding: 150px 0 60px;
  overflow: hidden;
  text-align: center;
}
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(130px);
  pointer-events: none;
  z-index: 0;
}
.orb-1 {
  top: -180px;
  left: 50%;
  transform: translateX(-50%);
  width: 720px;
  height: 480px;
  background: radial-gradient(ellipse, rgba(124, 92, 240, 0.32), transparent 70%);
}
.orb-2 {
  bottom: 120px;
  right: -160px;
  width: 460px;
  height: 460px;
  background: radial-gradient(circle, rgba(79, 134, 247, 0.18), transparent 70%);
}
.hero-inner { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; }
.eyebrow .dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 12px var(--accent);
  animation: pulse 2.4s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.title {
  margin-top: 22px;
  font-size: clamp(2.6rem, 1.2rem + 6vw, 5rem);
  font-weight: 700;
}
.lede {
  margin: 22px auto 0;
  max-width: 620px;
  font-size: clamp(1.05rem, 1rem + 0.4vw, 1.25rem);
  color: var(--text-2);
}
.actions { display: flex; gap: 14px; margin-top: 34px; flex-wrap: wrap; justify-content: center; }
.micro { margin-top: 18px; font-size: 13px; color: var(--text-3); }

.preview {
  position: relative;
  margin-top: 64px;
  width: 100%;
}
.preview-glow {
  position: absolute;
  inset: -8% 4% auto;
  height: 70%;
  background: radial-gradient(ellipse at top, rgba(124, 92, 240, 0.28), transparent 65%);
  filter: blur(50px);
  z-index: -1;
  pointer-events: none; /* decorative — must never intercept the buttons above it */
}
.preview img {
  width: 100%;
  height: auto;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin: 64px 0 0;
  width: 100%;
}
.stat {
  padding: 22px 16px;
  background: var(--card);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.stat-value { font-family: var(--font-display); font-weight: 700; font-size: 2rem; line-height: 1; }
.stat-value em { font-style: normal; font-size: 0.95rem; color: var(--text-3); margin-left: 4px; }
.stat-label { margin: 8px 0 0; font-size: 13px; color: var(--text-3); }
@media (max-width: 760px) {
  .stats { grid-template-columns: repeat(2, 1fr); }
}
</style>
