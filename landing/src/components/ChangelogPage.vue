<script setup lang="ts">
import { computed } from 'vue';
import RingLogo from './RingLogo.vue';
import { localizedPath, locale, useI18n } from '@/i18n';
import { renderMarkdown } from '@/lib/markdown';
import releases from '@/data/changelog.json';

const { t } = useI18n();
const home = computed(() => localizedPath(locale.value, ''));

const entries = computed(() =>
  releases.map((r) => ({
    tag: r.tag,
    date: new Date(r.publishedAt).toLocaleDateString(locale.value, { year: 'numeric', month: 'long', day: 'numeric' }),
    html: renderMarkdown(r.body),
  })),
);
</script>

<template>
  <div class="changelog">
    <div class="orb" aria-hidden="true" />

    <header class="bar">
      <div class="container bar-inner">
        <a :href="home" class="brand"><RingLogo :size="24" /> <span>TabStyr</span></a>
        <a :href="home" class="back">{{ t('changelogPage.back') }}</a>
      </div>
    </header>

    <main class="container body">
      <span class="eyebrow reveal-static">{{ t('changelogPage.eyebrow') }}</span>
      <h1 class="title">{{ t('changelogPage.title') }}</h1>
      <p class="sub">{{ t('changelogPage.sub') }}</p>

      <ol class="timeline">
        <li v-for="e in entries" :key="e.tag" class="entry card glass">
          <div class="entry-head">
            <span class="tag">{{ e.tag }}</span>
            <time class="date">{{ e.date }}</time>
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -- our own release notes, not user input -->
          <div class="entry-body" v-html="e.html" />
        </li>
      </ol>

      <a :href="home" class="back-cta">{{ t('changelogPage.backCta') }}</a>
    </main>
  </div>
</template>

<style scoped>
.changelog { position: relative; min-height: 100vh; }
.orb {
  position: fixed; top: -160px; left: 50%; transform: translateX(-50%);
  width: 640px; height: 420px; pointer-events: none; z-index: 0;
  background: radial-gradient(ellipse, rgba(124, 92, 240, 0.22), transparent 70%);
  filter: blur(130px);
}
.bar {
  position: sticky; top: 0; z-index: 10;
  background: rgba(10, 10, 15, 0.72); backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
}
.bar-inner { display: flex; align-items: center; justify-content: space-between; height: 64px; }
.brand { display: inline-flex; align-items: center; gap: 9px; font-family: var(--font-display); font-weight: 700; font-size: 18px; }
.back { font-size: 14px; font-weight: 500; color: var(--text-2); transition: color 160ms ease; }
.back:hover { color: var(--text); }
.body { position: relative; z-index: 1; padding-top: 72px; padding-bottom: 96px; max-width: 720px; }
.title { font-size: clamp(2.2rem, 1.6rem + 3vw, 3.4rem); font-weight: 700; margin-top: 14px; }
.sub { color: var(--text-2); margin: 12px 0 40px; }

.timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 20px; }
.entry { padding: 28px 32px; }
.entry-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
.tag { font-family: var(--font-display); font-weight: 700; font-size: 1.1rem; }
.date { color: var(--text-3); font-size: 13px; }

.entry-body :deep(h3) { font-family: var(--font-display); font-size: 1.05rem; font-weight: 600; margin: 20px 0 8px; }
.entry-body :deep(h3:first-child) { margin-top: 0; }
.entry-body :deep(h4) { font-size: 0.95rem; font-weight: 600; color: var(--text-2); margin: 16px 0 6px; }
.entry-body :deep(p) { color: var(--text-2); margin: 0 0 10px; line-height: 1.6; }
.entry-body :deep(ul) { margin: 0 0 10px; padding-left: 20px; }
.entry-body :deep(li) { color: var(--text-2); line-height: 1.6; margin-bottom: 4px; }
.entry-body :deep(strong) { color: var(--text); }
.entry-body :deep(code) {
  background: var(--card); border: 1px solid var(--border); border-radius: 4px;
  padding: 1px 5px; font-size: 0.9em;
}

.back-cta {
  display: inline-flex; margin-top: 40px;
  color: var(--accent); font-weight: 600; font-size: 14px;
}
</style>
