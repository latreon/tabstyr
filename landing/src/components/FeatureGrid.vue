<script setup lang="ts">
// Inline SVG paths (Lucide-style, thin stroke) keep the bundle dependency-free.
const features = [
  {
    title: 'Active-time tracking',
    body: 'Per tab and per site, second by second. Background audio is counted separately, so totals never exceed real time at the screen.',
    icon: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    big: true,
  },
  {
    title: 'Trends & comparison',
    body: 'Day / week / month activity trends, plus this-week-vs-last-week by category.',
    icon: 'M3 3v18h18M7 14l3-3 3 3 5-6',
  },
  {
    title: 'Focus score',
    body: 'Productive ÷ distracting, a daily streak, and a focus trend over time.',
    icon: 'M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0M12 2v3M12 19v3M2 12h3M19 12h3',
  },
  {
    title: 'Activity heatmap',
    body: 'Which hours of which days you actually browse — at a glance.',
    icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  },
  {
    title: 'Auto-categorized',
    body: 'Work, Dev, Social, Media and more — recognized automatically. Re-classify any site with one click.',
    icon: 'M3 7h18M3 12h18M3 17h12',
  },
  {
    title: 'Encrypted backups',
    body: 'Export JSON or CSV, optionally passphrase-encrypted (AES-256-GCM). Restore on any device.',
    icon: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6zM9.5 12l1.8 1.8L15 10',
  },
];
</script>

<template>
  <section id="features" class="section">
    <div class="container">
      <div class="head reveal">
        <span class="eyebrow">What it does</span>
        <h2 class="h2">Everything you need to understand your time —<br /><span class="gradient-text">nothing you didn't ask for.</span></h2>
      </div>

      <div class="grid">
        <article
          v-for="(f, i) in features"
          :key="f.title"
          class="card glass reveal"
          :class="{ big: f.big }"
          :style="{ transitionDelay: `${(i % 3) * 70}ms` }"
        >
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path :d="f.icon" />
            </svg>
          </span>
          <h3 class="title">{{ f.title }}</h3>
          <p class="body">{{ f.body }}</p>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.head { max-width: 720px; margin-bottom: 52px; }
.h2 { font-size: clamp(2rem, 1.4rem + 2.4vw, 3rem); font-weight: 700; margin-top: 14px; }
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}
.card {
  padding: 26px;
  transition: transform 300ms ease, border-color 300ms ease, background 300ms ease, opacity 700ms cubic-bezier(0.16,1,0.3,1);
}
.card:hover {
  transform: translateY(-4px);
  border-color: var(--border-hover);
  background: rgba(26, 26, 38, 0.78);
}
.card.big {
  grid-column: span 1;
  background: linear-gradient(160deg, rgba(124, 92, 240, 0.12), var(--card));
  border-color: rgba(124, 92, 240, 0.22);
}
.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--accent-muted);
  color: var(--accent);
  margin-bottom: 18px;
}
.icon svg { width: 22px; height: 22px; }
.title { font-size: 1.15rem; font-weight: 600; }
.body { margin: 10px 0 0; font-size: 0.95rem; color: var(--text-2); }
@media (max-width: 920px) { .grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
</style>
