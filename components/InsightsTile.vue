<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Insight } from '@/lib/insights';
import { getDateLocale } from '@/lib/locale';

const props = defineProps<{ insights: Insight[]; max?: number }>();
const { t } = useI18n();

// 2023-01-01 was a Sunday, so getDay() index i === offset from that date (same
// trick as HeatmapTile — keeps weekday names locale-correct without extra keys).
function weekdayName(index: number): string {
  return new Date(2023, 0, 1 + index).toLocaleString(getDateLocale(), { weekday: 'long' });
}
const pad = (n: number) => String(n).padStart(2, '0');

// Localize each insight's raw params (category key, weekday index, hour) before
// interpolating the template. Numbers (pct/target/days) pass straight through.
function localizedParams(insight: Insight): Record<string, string | number> {
  const out: Record<string, string | number> = { ...insight.params };
  if (typeof out.category === 'string') out.category = t(`categories.${out.category}`);
  if (typeof out.weekday === 'number') out.weekday = weekdayName(out.weekday);
  if (typeof out.hour === 'number') out.hour = `${pad(out.hour)}:00`;
  return out;
}

const lines = computed(() =>
  props.insights.slice(0, props.max ?? 3).map((i) => ({ id: i.id, text: t(`insights.${i.key}`, localizedParams(i)) })),
);
</script>

<template>
  <div v-if="lines.length" class="tile insights-tile">
    <div class="head">
      <span class="glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" /></svg>
      </span>
      <h2 class="label">{{ t('insights.title') }}</h2>
    </div>
    <ul class="lines">
      <li v-for="l in lines" :key="l.id">{{ l.text }}</li>
    </ul>
  </div>
</template>

<style scoped>
.insights-tile {
  grid-column: span 3;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.head {
  display: flex;
  align-items: center;
  gap: 9px;
}
.label {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-2);
}
.glyph {
  flex: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: color-mix(in oklab, var(--accent) 16%, transparent);
}
.glyph svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.lines {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
}
.lines li {
  font-size: 13px;
  color: var(--text);
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--card-strong);
  border: 1px solid var(--border);
}
</style>
