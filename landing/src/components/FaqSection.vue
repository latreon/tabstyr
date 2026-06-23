<script setup lang="ts">
import { ref } from 'vue';

const faqs = [
  { q: 'Is my browsing data really private?', a: 'Yes. TabStyr makes zero network requests — its content-security policy even blocks them. Everything is stored locally in your browser and pruned after 90 days. You can export or wipe it anytime.' },
  { q: 'What exactly does it track?', a: 'Active foreground time per site — the tab you are actually looking at — plus background audio counted separately. It never reads page contents, only the URL/title the browser already exposes to extensions.' },
  { q: 'Does it slow down my browser?', a: 'No. It is event-driven with a once-a-minute checkpoint, uses an efficient local database, and ships ~130 KB of gzipped JavaScript. No background polling, no remote calls.' },
  { q: 'Which browsers are supported?', a: 'Chrome, Edge, Brave, Opera, Arc and other Chromium browsers fully. Firefox 115+ is supported (favicons show as letter chips). Safari works after an Xcode conversion.' },
  { q: 'Is it free? Open source?', a: 'Free to use and MIT-licensed. No ads, no account, no paid wall on the core experience.' },
  { q: 'Can I move my data to another device?', a: 'Yes — export a full backup (JSON, optionally passphrase-encrypted with AES-256-GCM) and restore it anywhere.' },
];

const open = ref<number | null>(0);
const toggle = (i: number) => (open.value = open.value === i ? null : i);

// Animate to the answer's ACTUAL height (not an arbitrary max-height), so the
// open/close motion is smooth and finishes exactly when the content does.
function onEnter(el: Element) {
  const e = el as HTMLElement;
  e.style.height = '0px';
  void e.offsetHeight; // force reflow so the transition has a start value
  e.style.height = `${e.scrollHeight}px`;
}
function onAfterEnter(el: Element) {
  (el as HTMLElement).style.height = 'auto';
}
function onLeave(el: Element) {
  const e = el as HTMLElement;
  e.style.height = `${e.scrollHeight}px`;
  void e.offsetHeight;
  e.style.height = '0px';
}
</script>

<template>
  <section id="faq" class="section">
    <div class="container">
      <div class="head reveal">
        <span class="eyebrow">Questions</span>
        <h2 class="h2">Good to know</h2>
      </div>

      <ul class="list">
        <li v-for="(f, i) in faqs" :key="i" class="item glass" :class="{ open: open === i }">
          <button class="q" :aria-expanded="open === i" @click="toggle(i)">
            <span>{{ f.q }}</span>
            <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <Transition name="acc" @enter="onEnter" @after-enter="onAfterEnter" @leave="onLeave">
            <div v-show="open === i" class="a-wrap">
              <p class="a">{{ f.a }}</p>
            </div>
          </Transition>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.head { text-align: center; margin-bottom: 40px; }
.h2 { font-size: clamp(1.9rem, 1.4rem + 2vw, 2.6rem); font-weight: 700; margin-top: 12px; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.item { overflow: hidden; transition: border-color 240ms ease; }
.item.open { border-color: var(--border-hover); }
.q {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 20px 22px; background: transparent; border: none; cursor: pointer;
  font-family: var(--font-body); font-size: 1.02rem; font-weight: 600; color: var(--text); text-align: left;
}
.q:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: var(--radius); }
.chev { width: 20px; height: 20px; flex: none; color: var(--text-3); transition: transform 260ms ease; }
.item.open .chev { transform: rotate(180deg); color: var(--accent); }

.a-wrap { overflow: hidden; }
.a { margin: 0; padding: 0 22px 22px; color: var(--text-2); font-size: 0.97rem; }

/* Height is set imperatively in the JS hooks; the transition eases between them. */
.acc-enter-active,
.acc-leave-active { transition: height 300ms cubic-bezier(0.16, 1, 0.3, 1); }

@media (prefers-reduced-motion: reduce) {
  .acc-enter-active,
  .acc-leave-active { transition: none; }
}
</style>
