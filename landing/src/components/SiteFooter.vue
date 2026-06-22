<script setup lang="ts">
import RingLogo from './RingLogo.vue';
import { LINKS, AUTHOR, CF_ANALYTICS_TOKEN } from '@/site';
const year = 2026;
const analyticsOn = !!CF_ANALYTICS_TOKEN;
</script>

<template>
  <footer class="footer">
    <div class="container inner">
      <div class="brand-col">
        <a href="#top" class="brand"><RingLogo :size="22" /> <span>TabStyr</span></a>
        <p class="tag">Private, local browser-time insights.</p>
      </div>

      <nav class="cols" aria-label="Footer">
        <div class="col">
          <span class="head">Product</span>
          <a href="#features">Features</a>
          <a href="#showcase">Dashboard</a>
          <a href="#privacy">Privacy</a>
          <a href="#faq">FAQ</a>
        </div>
        <div class="col">
          <span class="head">Install</span>
          <a :href="LINKS.chrome" target="_blank" rel="noopener">Chrome</a>
          <a :href="LINKS.edge" target="_blank" rel="noopener">Edge</a>
          <a :href="LINKS.firefox" target="_blank" rel="noopener">Firefox</a>
        </div>
        <div class="col">
          <span class="head">Community</span>
          <a :href="LINKS.github" target="_blank" rel="noopener">GitHub</a>
          <a :href="LINKS.issues" target="_blank" rel="noopener">Report a bug</a>
          <a :href="LINKS.discussions" target="_blank" rel="noopener">Discussions</a>
          <a :href="LINKS.coffee" target="_blank" rel="noopener">Support on Ko-fi</a>
        </div>
        <div class="col">
          <span class="head">Legal</span>
          <a :href="LINKS.privacy">Privacy policy</a>
          <span class="muted">MIT licensed</span>
          <span v-if="analyticsOn" class="muted">Cookieless analytics</span>
        </div>
      </nav>
    </div>
    <div class="container bottom">
      <span>© {{ year }} TabStyr · Built by
        <a class="author" :href="AUTHOR.url" target="_blank" rel="noopener">{{ AUTHOR.name }}</a>
      </span>
      <span class="badge">0 bytes leave your device</span>
    </div>
  </footer>
</template>

<style scoped>
.footer { border-top: 1px solid var(--border); padding: 64px 0 40px; background: var(--bg-alt); }
.inner { display: grid; grid-template-columns: 1.4fr 2fr; gap: 40px; }
.brand { display: inline-flex; align-items: center; gap: 9px; font-family: var(--font-display); font-weight: 700; font-size: 18px; }
.tag { color: var(--text-3); margin: 14px 0 0; font-size: 14px; max-width: 240px; }
.cols { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
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
