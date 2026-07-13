<script setup lang="ts">
import { computed, onMounted } from 'vue';
import RingLogo from './RingLogo.vue';
import LangSwitch from './LangSwitch.vue';
import { localizedPath, locale, useI18n } from '@/i18n';
import { renderMarkdown } from '@/lib/markdown';
import { BLOG_POSTS } from '@/data/blog-posts';

const props = defineProps<{ slug: string }>();
const { t } = useI18n();
const home = computed(() => localizedPath(locale.value, ''));
const blogHome = computed(() => localizedPath(locale.value, 'blog'));

const post = computed(() => BLOG_POSTS.find((p) => p.slug === props.slug) ?? null);
const date = computed(() =>
  post.value ? new Date(post.value.date).toLocaleDateString(locale.value, { year: 'numeric', month: 'long', day: 'numeric' }) : '',
);
const html = computed(() => (post.value ? renderMarkdown(post.value.body) : ''));

// A single post's title/description is more specific than the generic blog-index
// meta applyHead() sets — override once mounted so social shares and the tab
// title reflect the actual post, not "Blog — TabStyr" for every entry.
onMounted(() => {
  if (!post.value) return;
  document.title = `${post.value.title} — TabStyr`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', post.value.excerpt);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', post.value.title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', post.value.excerpt);
});
</script>

<template>
  <div class="post">
    <div class="orb" aria-hidden="true" />

    <header class="bar">
      <div class="container bar-inner">
        <a :href="home" class="brand"><RingLogo :size="24" /> <span>TabStyr</span></a>
        <div class="bar-right">
          <LangSwitch />
          <a :href="blogHome" class="back">{{ t('blogPage.back') }}</a>
        </div>
      </div>
    </header>

    <main class="container body">
      <template v-if="post">
        <span class="eyebrow reveal-static">{{ t('blogPage.eyebrow') }}</span>
        <h1 class="title">{{ post.title }}</h1>
        <time class="date">{{ date }}</time>

        <div class="card glass article">
          <!-- eslint-disable-next-line vue/no-v-html -- our own authored content, not user input -->
          <div class="article-body" v-html="html" />
        </div>
      </template>
      <p v-else class="not-found">{{ t('blogPage.notFound') }}</p>

      <a :href="blogHome" class="back-cta">{{ t('blogPage.backToBlog') }}</a>
    </main>
  </div>
</template>

<style scoped>
.post { position: relative; min-height: 100vh; }
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
.not-found { color: var(--text-2); }
.title { font-size: clamp(2rem, 1.5rem + 2.6vw, 3rem); font-weight: 700; margin-top: 14px; }
.date { display: block; color: var(--text-3); font-size: 13px; margin: 12px 0 32px; }

.article { padding: 40px; }
.article-body :deep(h3) { font-family: var(--font-display); font-size: 1.3rem; font-weight: 700; margin: 32px 0 12px; }
.article-body :deep(h3:first-child) { margin-top: 0; }
.article-body :deep(h4) { font-size: 1.05rem; font-weight: 600; margin: 24px 0 10px; }
.article-body :deep(p) { color: var(--text-2); margin: 0 0 16px; line-height: 1.7; }
.article-body :deep(ul) { margin: 0 0 16px; padding-left: 22px; }
.article-body :deep(li) { color: var(--text-2); line-height: 1.7; margin-bottom: 8px; }
.article-body :deep(strong) { color: var(--text); }
.article-body :deep(a) { color: var(--accent); text-decoration: underline; text-decoration-color: transparent; transition: text-decoration-color 160ms ease; }
.article-body :deep(a:hover) { text-decoration-color: currentColor; }
.article-body :deep(code) {
  background: var(--card); border: 1px solid var(--border); border-radius: 4px;
  padding: 1px 5px; font-size: 0.9em;
}

.back-cta {
  display: inline-flex; margin-top: 40px;
  color: var(--accent); font-weight: 600; font-size: 14px;
}
</style>
