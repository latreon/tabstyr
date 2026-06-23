<script setup lang="ts">
import { LINKS } from '@/site';

const cards = [
  {
    href: LINKS.ideas,
    title: 'Share an idea or report a bug',
    body: 'Want a feature, a new metric, or hit something broken? Tell me right here — no account needed.',
    cta: 'Open the form',
    icon: 'spark',
    external: false,
  },
  {
    href: LINKS.coffee,
    title: 'Support the project',
    body: 'TabStyr is free and open source. A small tip keeps it going.',
    cta: 'Buy me a coffee',
    icon: 'heart',
    external: true,
  },
] as const;
</script>

<template>
  <section id="feedback" class="section">
    <div class="container">
      <div class="head reveal">
        <span class="eyebrow">Feedback &amp; ideas</span>
        <h2 class="h2">Built in the open — with you.</h2>
        <p class="sub">
          No tracking, no feedback widgets phoning home. Just a simple form — no account,
          no sign-in, and nothing stored about you.
        </p>
      </div>

      <div class="grid">
        <a
          v-for="c in cards"
          :key="c.title"
          class="card glass reveal"
          :href="c.href"
          :target="c.external ? '_blank' : undefined"
          :rel="c.external ? 'noopener' : undefined"
        >
          <span class="chip" aria-hidden="true">
            <svg v-if="c.icon === 'spark'" viewBox="0 0 24 24"><path d="M9.5 16.5h5M10 20h4M12 3a6 6 0 0 1 3.5 10.9c-.6.5-1 1.2-1 2H9.5c0-.8-.4-1.5-1-2A6 6 0 0 1 12 3Z"/></svg>
            <svg v-else viewBox="0 0 24 24"><path d="M12 20s-7-4.3-9.3-8.5A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 9.3 5.5C19 15.7 12 20 12 20Z"/></svg>
          </span>
          <h3 class="card-title">{{ c.title }}</h3>
          <p class="card-body">{{ c.body }}</p>
          <span class="link">{{ c.cta }} <span aria-hidden="true">→</span></span>
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.head { max-width: 560px; margin-bottom: 40px; }
.eyebrow {
  font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--accent);
}
.h2 { font-size: clamp(1.8rem, 1.3rem + 2.2vw, 2.6rem); font-weight: 700; margin: 12px 0 0; }
.sub { color: var(--text-2); margin: 14px 0 0; font-size: 16px; line-height: 1.6; }

.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }

.card {
  display: flex; flex-direction: column; align-items: flex-start;
  padding: 28px 26px;
  transition: transform 200ms ease, border-color 200ms ease, background 200ms ease;
}
.card:hover {
  transform: translateY(-4px);
  border-color: rgba(124, 92, 240, 0.35);
}
.chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border-radius: 12px;
  background: var(--accent-muted); color: var(--accent);
  margin-bottom: 18px;
}
.chip svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.card-title { font-size: 18px; font-weight: 700; font-family: var(--font-display); }
.card-body { color: var(--text-2); font-size: 14px; line-height: 1.6; margin: 8px 0 18px; flex: 1; }
.link { font-size: 14px; font-weight: 600; color: var(--accent); display: inline-flex; gap: 6px; align-items: center; }
.card:hover .link span { transform: translateX(3px); }
.link span { transition: transform 200ms ease; }

@media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
</style>
