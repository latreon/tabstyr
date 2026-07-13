<script setup lang="ts">
import { computed } from 'vue';
import RingLogo from './RingLogo.vue';
import LangSwitch from './LangSwitch.vue';
import { localizedPath, locale, useI18n } from '@/i18n';
import { BLOG_POSTS } from '@/data/blog-posts';

const { t } = useI18n();
const home = computed(() => localizedPath(locale.value, ''));

const posts = computed(() =>
  BLOG_POSTS.map((p) => ({
    ...p,
    href: localizedPath(locale.value, `blog/${p.slug}`),
    date: new Date(p.date).toLocaleDateString(locale.value, { year: 'numeric', month: 'long', day: 'numeric' }),
  })),
);
</script>

<template>
  <div class="blog">
    <div class="orb" aria-hidden="true" />

    <header class="bar">
      <div class="container bar-inner">
        <a :href="home" class="brand"><RingLogo :size="24" /> <span>TabStyr</span></a>
        <div class="bar-right">
          <LangSwitch />
          <a :href="home" class="back">{{ t('blogPage.back') }}</a>
        </div>
      </div>
    </header>

    <main class="container body">
      <span class="eyebrow reveal-static">{{ t('blogPage.eyebrow') }}</span>
      <h1 class="title">{{ t('blogPage.title') }}</h1>
      <p class="sub">{{ t('blogPage.sub') }}</p>

      <ol class="list">
        <li v-for="p in posts" :key="p.slug" class="entry card glass">
          <a :href="p.href" class="entry-link">
            <time class="date">{{ p.date }}</time>
            <h2 class="entry-title">{{ p.title }}</h2>
            <p class="excerpt">{{ p.excerpt }}</p>
            <span class="read-more">{{ t('blogPage.readMore') }} →</span>
          </a>
        </li>
      </ol>

      <a :href="home" class="back-cta">{{ t('blogPage.backCta') }}</a>
    </main>
  </div>
</template>

<style scoped>
.blog { position: relative; min-height: 100vh; }
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
.bar-right { display: flex; align-items: center; gap: 20px; }
.back { font-size: 14px; font-weight: 500; color: var(--text-2); transition: color 160ms ease; }
.back:hover { color: var(--text); }
.body { position: relative; z-index: 1; padding-top: 72px; padding-bottom: 96px; }
.title { font-size: clamp(2.2rem, 1.6rem + 3vw, 3.4rem); font-weight: 700; margin-top: 14px; }
.sub { color: var(--text-2); margin: 12px 0 40px; }

.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
.entry { padding: 0; overflow: hidden; }
.entry-link { display: block; padding: 28px 32px; color: inherit; text-decoration: none; }
.date { color: var(--text-3); font-size: 13px; }
.entry-title { font-family: var(--font-display); font-size: 1.3rem; font-weight: 700; margin: 8px 0 10px; }
.excerpt { color: var(--text-2); line-height: 1.6; margin: 0 0 12px; }
.read-more { color: var(--accent); font-weight: 600; font-size: 14px; }
.entry:hover { border-color: rgba(124, 92, 240, 0.35); }

.back-cta {
  display: inline-flex; margin-top: 40px;
  color: var(--accent); font-weight: 600; font-size: 14px;
}
</style>
