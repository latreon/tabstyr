<script setup lang="ts">
import { computed } from 'vue';
import RingLogo from './RingLogo.vue';
import { LINKS, AUTHOR, STORE_LIVE } from '@/site';
import { localizedPath, locale, useI18n } from '@/i18n';

const { t } = useI18n();
const year = 2026;
const ideasHref = computed(() => localizedPath(locale.value, 'ideas'));
const changelogHref = computed(() => localizedPath(locale.value, 'changelog'));
const blogHref = computed(() => localizedPath(locale.value, 'blog'));
const compareHref = computed(() => localizedPath(locale.value, 'blog/tabstyr-vs-rescuetime-vs-toggl'));
</script>

<template>
  <footer class="footer">
    <div class="container inner">
      <div class="brand-col">
        <a href="#top" class="brand"><RingLogo :size="22" /> <span>TabStyr</span></a>
        <p class="tag">{{ t('footer.tag') }}</p>
      </div>

      <nav class="cols" aria-label="Footer">
        <div class="col">
          <span class="head">{{ t('footer.product') }}</span>
          <a href="#features">{{ t('nav.features') }}</a>
          <a href="#showcase">{{ t('nav.dashboard') }}</a>
          <a href="#privacy">{{ t('nav.privacy') }}</a>
          <a href="#faq">{{ t('nav.faq') }}</a>
          <a :href="blogHref">{{ t('blogPage.eyebrow') }}</a>
          <a :href="compareHref">{{ t('footer.compare') }}</a>
          <a :href="changelogHref">{{ t('changelogPage.eyebrow') }}</a>
          <a :href="LINKS.github" target="_blank" rel="noopener">GitHub</a>
        </div>
        <div class="col">
          <span class="head">{{ t('footer.install') }}</span>
          <a v-if="STORE_LIVE.chrome" :href="LINKS.chrome" target="_blank" rel="noopener">Chrome</a>
          <span v-else class="muted">{{ t('footer.chromeSoon') }}</span>
          <a v-if="STORE_LIVE.edge" :href="LINKS.edge" target="_blank" rel="noopener">Edge</a>
          <span v-else class="muted">{{ t('footer.edgeSoon') }}</span>
          <a v-if="STORE_LIVE.firefox" :href="LINKS.firefox" target="_blank" rel="noopener">Firefox</a>
          <span v-else class="muted">{{ t('footer.firefoxSoon') }}</span>
        </div>
        <div class="col">
          <span class="head">{{ t('footer.feedback') }}</span>
          <a :href="ideasHref">{{ t('footer.shareIdea') }}</a>
          <a v-if="LINKS.coffee" :href="LINKS.coffee" target="_blank" rel="noopener">{{ t('footer.coffee') }}</a>
        </div>
      </nav>
    </div>
    <div class="container bottom">
      <span>© {{ year }} TabStyr · {{ t('footer.builtBy') }}
        <a class="author" :href="AUTHOR.url" target="_blank" rel="noopener">{{ AUTHOR.name }}</a>
      </span>
      <span class="badge">{{ t('footer.badge') }}</span>
    </div>
  </footer>
</template>

<style scoped>
.footer { border-top: 1px solid var(--border); padding: 64px 0 40px; background: var(--bg-alt); }
.inner { display: grid; grid-template-columns: 1.4fr 2fr; gap: 40px; }
.brand { display: inline-flex; align-items: center; gap: 9px; font-family: var(--font-display); font-weight: 700; font-size: 18px; }
.tag { color: var(--text-3); margin: 14px 0 0; font-size: 14px; max-width: 240px; }
.cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.col { display: flex; flex-direction: column; gap: 10px; }
.col .head { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); margin-bottom: 4px; }
.col a { font-size: 14px; color: var(--text-2); transition: color 160ms ease; }
.col a:hover { color: var(--text); }
.col .muted { font-size: 14px; color: var(--text-3); }
.bottom {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--border);
  font-size: 13px; color: var(--text-3);
}
.badge {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 6px 12px; border-radius: 999px;
  background: var(--accent-muted); color: var(--accent); font-weight: 600;
}
.author { color: var(--text-2); font-weight: 600; transition: color 160ms ease; }
.author:hover { color: var(--accent); }
@media (max-width: 760px) {
  .inner { grid-template-columns: 1fr; gap: 32px; }
  .cols { grid-template-columns: repeat(2, 1fr); }
  .bottom { flex-direction: column; gap: 12px; }
}
@media (max-width: 460px) { .cols { grid-template-columns: 1fr 1fr; } }
</style>
