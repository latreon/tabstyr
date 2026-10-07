<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/i18n';
import { categoryColor, categoryLabel, type CategoryId } from '@ext/categories';

const { t, tm } = useI18n();
const bullets = computed(() => tm<string[]>('workLog.bullets'));

// Sample day for the illustration.
const EXAMPLE_ROWS: { domain: string; category: CategoryId; time: string }[] = [
  { domain: 'github.com', category: 'Dev', time: '2h 40m' },
  { domain: 'docs.google.com', category: 'Work', time: '1h 55m' },
  { domain: 'scholar.google.com', category: 'Work', time: '1h 05m' },
  { domain: 'youtube.com', category: 'Media', time: '30m' },
];
</script>

<template>
  <section id="work-log" class="section">
    <div class="container">
      <div class="head reveal">
        <span class="eyebrow">{{ t('workLog.eyebrow') }}</span>
        <h2 class="h2">{{ t('workLog.title') }}</h2>
        <p class="sub">{{ t('workLog.sub') }}</p>
      </div>

      <div class="layout reveal">
        <figure class="log glass" :aria-label="t('workLog.exampleAria')">
          <span class="example">{{ t('workLog.exampleLabel') }}</span>
          <p class="summary"><strong>{{ t('workLog.exampleDay') }}</strong> {{ t('workLog.exampleSummary') }}</p>
          <ol class="rows">
            <li v-for="row in EXAMPLE_ROWS" :key="row.domain">
              <span class="dot" :style="{ background: categoryColor(row.category) }" aria-hidden="true" />
              <span class="site">{{ row.domain }}</span>
              <span class="cat">{{ categoryLabel(row.category, t) }}</span>
              <span class="time">{{ row.time }}</span>
            </li>
          </ol>
          <div class="actions" aria-hidden="true">
            <span>{{ t('workLog.copy') }}</span>
            <span>CSV</span>
            <span>PNG</span>
          </div>
        </figure>

        <div class="copy">
          <h3>{{ t('workLog.copyTitle') }}</h3>
          <p>{{ t('workLog.copyBody') }}</p>
          <ul>
            <li v-for="(b, i) in bullets" :key="i">{{ b }}</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.head { text-align: center; margin-bottom: 56px; }
.h2 { font-size: clamp(2rem, 1.4rem + 2.4vw, 3rem); font-weight: 700; margin-top: 14px; }
.sub { color: var(--text-2); margin: 12px auto 0; max-width: 580px; }

.layout {
  display: grid;
  grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
  gap: 56px;
  align-items: center;
  max-width: 920px;
  margin: 0 auto;
}
.log { margin: 0; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.example {
  align-self: flex-start;
  font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--text-3); border: 1px solid var(--border); border-radius: 999px; padding: 4px 10px;
}
.summary { margin: 0; color: var(--text-2); font-size: 0.95rem; }
.summary strong { color: var(--text); }
.rows { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
.rows li {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  font-size: 0.92rem;
}
.dot { width: 10px; height: 10px; border-radius: 50%; }
.site { color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cat { color: var(--text-3); font-size: 0.82rem; }
.time { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }
.actions { display: flex; gap: 8px; }
.actions span {
  font-size: 12px; font-weight: 600; color: var(--text-2);
  border: 1px solid var(--border); border-radius: 8px; padding: 5px 10px;
}

.copy h3 { font-size: 1.6rem; font-weight: 700; }
.copy p { color: var(--text-2); margin: 14px 0 18px; }
.copy ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 11px; }
.copy li { position: relative; padding-left: 26px; color: var(--text-2); font-size: 0.95rem; }
.copy li::before {
  content: ''; position: absolute; left: 0; top: 6px; width: 13px; height: 7px;
  border-left: 2px solid var(--accent); border-bottom: 2px solid var(--accent);
  transform: rotate(-45deg);
}
@media (max-width: 820px) {
  .layout { grid-template-columns: minmax(0, 1fr); gap: 32px; }
}
</style>
