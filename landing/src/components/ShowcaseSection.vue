<script setup lang="ts">
import { computed, ref } from 'vue';
import popupDark from '@/assets/popup-dark.png';
import popupLight from '@/assets/popup-light.png';

const theme = ref<'light' | 'dark'>('dark');
const popupSrc = computed(() => (theme.value === 'dark' ? popupDark : popupLight));
</script>

<template>
  <section id="showcase" class="section">
    <div class="orb" aria-hidden="true" />
    <div class="container">
      <div class="head reveal">
        <span class="eyebrow">Glance from anywhere</span>
        <h2 class="h2">A quiet, premium view of your day</h2>
        <p class="sub">
          Open the toolbar popup for an instant read; jump to the full dashboard for the
          detail. Both themes, designed to be glanced at — not studied.
        </p>

        <div class="toggle" role="tablist" aria-label="Theme preview">
          <button role="tab" :aria-selected="theme === 'dark'" :class="{ active: theme === 'dark' }" @click="theme = 'dark'">Dark</button>
          <button role="tab" :aria-selected="theme === 'light'" :class="{ active: theme === 'light' }" @click="theme = 'light'">Light</button>
        </div>
      </div>

      <div class="popups reveal">
        <figure>
          <div class="figure-glow" aria-hidden="true" />
          <img :src="popupSrc" :alt="`TabStyr ${theme} popup with today's total and top sites`" width="360" height="600" />
        </figure>
        <div class="popup-copy">
          <h3>Today, in two clicks</h3>
          <p>The popup gives you an instant read on today — then gets out of the way.</p>
          <ul>
            <li>Live "active today" total vs your weekly average</li>
            <li>Top sites with real favicons</li>
            <li>Stale-tab reminder, at most once a day</li>
            <li>Light and dark, following your system or your choice</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.section { overflow: hidden; }
.orb {
  position: absolute; top: 10%; left: -180px; width: 520px; height: 520px;
  background: radial-gradient(circle, rgba(124, 92, 240, 0.14), transparent 70%);
  filter: blur(130px); pointer-events: none;
}
.head { position: relative; text-align: center; margin-bottom: 56px; }
.h2 { font-size: clamp(2rem, 1.4rem + 2.4vw, 3rem); font-weight: 700; margin-top: 14px; }
.sub { color: var(--text-2); margin: 12px auto 0; max-width: 560px; }
.toggle {
  display: inline-flex; gap: 4px; margin-top: 24px; padding: 4px;
  background: var(--card); border: 1px solid var(--border); border-radius: 999px;
}
.toggle button {
  border: none; background: transparent; color: var(--text-2);
  padding: 7px 20px; border-radius: 999px; font-family: var(--font-body);
  font-size: 14px; font-weight: 600; cursor: pointer; transition: all 200ms ease;
}
.toggle button.active { background: var(--accent-grad); color: #0a0a0f; }
.toggle button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.popups {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 56px;
  align-items: center;
  max-width: 880px;
  margin: 0 auto;
}
.popups figure { position: relative; margin: 0; }
.figure-glow {
  position: absolute; inset: -10%;
  background: radial-gradient(ellipse, rgba(124, 92, 240, 0.22), transparent 70%);
  filter: blur(50px); z-index: -1; pointer-events: none;
}
.popups figure img {
  width: 100%; height: auto; border-radius: var(--radius);
  border: 1px solid var(--border); box-shadow: var(--shadow-lg);
}
.popup-copy h3 { font-size: 1.6rem; font-weight: 700; }
.popup-copy p { color: var(--text-2); margin: 14px 0 18px; }
.popup-copy ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 11px; }
.popup-copy li { position: relative; padding-left: 26px; color: var(--text-2); font-size: 0.95rem; }
.popup-copy li::before {
  content: ''; position: absolute; left: 0; top: 6px; width: 13px; height: 7px;
  border-left: 2px solid var(--accent); border-bottom: 2px solid var(--accent);
  transform: rotate(-45deg);
}
@media (max-width: 820px) {
  .popups { grid-template-columns: 1fr; gap: 32px; }
  .popups figure { max-width: 300px; margin: 0 auto; }
}
</style>
