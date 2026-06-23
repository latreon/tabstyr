<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { LOCALES, localeForCode, localizedPath, locale, useI18n } from '@/i18n';

const { t } = useI18n();

// Current locale-less route ('', 'privacy', 'ideas'), provided by App, so each
// language link keeps the visitor on the same page. Defaults to home if absent.
const route = inject<Ref<string>>('route', ref(''));

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const current = computed(() => localeForCode(locale.value));

function toggle() {
  open.value = !open.value;
}
function onClickOutside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
// Real anchor links (App intercepts them for SPA nav). Crawlers follow them too.
const hrefFor = (code: string) => localizedPath(code, route.value);

onMounted(() => document.addEventListener('click', onClickOutside));
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside));
</script>

<template>
  <div ref="root" class="lang">
    <button
      type="button"
      class="trigger"
      :aria-label="t('nav.language')"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
    >
      <span class="flag" aria-hidden="true">{{ current.flag }}</span>
      <span class="code">{{ current.code.split('-')[0].toUpperCase() }}</span>
      <svg class="chev" :class="{ open }" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    <ul v-if="open" class="menu" role="listbox" :aria-label="t('nav.language')">
      <li v-for="l in LOCALES" :key="l.code" role="option" :aria-selected="l.code === locale">
        <a
          :href="hrefFor(l.code)"
          :hreflang="l.hreflang"
          :class="{ selected: l.code === locale }"
          @click="open = false"
        >
          <span class="flag" aria-hidden="true">{{ l.flag }}</span>
          <span class="label">{{ l.label }}</span>
          <span v-if="l.code === locale" class="tick" aria-hidden="true">✓</span>
        </a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.lang { position: relative; }
.trigger {
  display: inline-flex; align-items: center; gap: 7px;
  background: var(--card); border: 1px solid var(--border); border-radius: 999px;
  color: var(--text-2); font: inherit; font-size: 13px; font-weight: 600;
  padding: 7px 11px; cursor: pointer; transition: border-color 160ms ease, color 160ms ease;
}
.trigger:hover { border-color: var(--border-hover); color: var(--text); }
.trigger:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-muted); }
.flag { font-size: 14px; line-height: 1; }
.chev { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; opacity: 0.7; transition: transform 160ms ease; }
.chev.open { transform: rotate(180deg); }
.menu {
  position: absolute; top: calc(100% + 8px); right: 0; z-index: 60;
  list-style: none; margin: 0; padding: 5px; min-width: 200px;
  background: var(--card-solid); border: 1px solid var(--border); border-radius: 12px;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.4);
}
.menu a {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 11px; font-size: 14px; border-radius: 8px; color: var(--text-2);
}
.menu a:hover { background: var(--accent-muted); color: var(--text); }
.menu a.selected { color: var(--text); font-weight: 600; }
.menu .label { flex: 1; }
.tick { color: var(--accent); }
</style>
