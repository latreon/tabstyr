<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { buildComparison, type ComparePeriod } from '@/lib/comparison';
import { categoryColor, categoryLabel, type CategoryId, type CategoryRule, type CustomCategory } from '@/lib/categories';
import { formatDuration } from '@/lib/time';
import type { DailyStat } from '@/lib/types';

const props = defineProps<{
  stats: DailyStat[];
  todayKey: string;
  overrides: Record<string, CategoryId>;
  rules?: CategoryRule[];
  custom?: CustomCategory[];
}>();

const { t } = useI18n();
const period = ref<ComparePeriod>('week');
// Category row the pointer is over — highlights the row and its label.
const hovered = ref<string | null>(null);
const MODES: ComparePeriod[] = ['week', 'month'];

const cmp = computed(() =>
  buildComparison(props.stats, props.todayKey, period.value, props.overrides, props.rules ?? []),
);

const title = computed(() => (period.value === 'week' ? t('comparison.weekTitle') : t('comparison.monthTitle')));
const subtitle = computed(() => (period.value === 'week' ? t('comparison.weekSub') : t('comparison.monthSub')));

const hasData = computed(() => cmp.value.currentSeconds > 0 || cmp.value.previousSeconds > 0);

// Scale each category bar to the largest current value in the period.
const maxCat = computed(() => Math.max(1, ...cmp.value.categories.map((c) => c.current)));

// "more time" is treated as positive (engagement) to match HeroTile's delta.
const dir = (pct: number | null) => (pct === null ? '' : pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat');
</script>

<template>
  <div class="tile compare">
    <div class="head">
      <div class="head-text">
        <h2 class="label">{{ title }}</h2>
        <span class="sub">{{ subtitle }}</span>
      </div>
      <div class="toggle" role="group" :aria-label="t('comparison.periodAria')">
        <button
          v-for="m in MODES"
          :key="m"
          type="button"
          :aria-pressed="period === m"
          :class="{ active: period === m }"
          @click="period = m"
        >{{ t(`comparison.${m}`) }}</button>
      </div>
    </div>

    <p v-if="!hasData" class="empty">{{ t('comparison.notEnough') }}</p>

    <template v-else>
      <div class="headline">
        <span class="total">{{ formatDuration(cmp.currentSeconds) }}</span>
        <span v-if="cmp.deltaPct !== null" class="delta" :class="dir(cmp.deltaPct)">
          <template v-if="cmp.deltaPct === 0">{{ t('comparison.noChange') }}</template>
          <template v-else>
            <span aria-hidden="true">{{ cmp.deltaPct > 0 ? '↑' : '↓' }}</span>
            {{ Math.abs(cmp.deltaPct) }}%
          </template>
        </span>
        <span class="prev">{{ t('comparison.vsBefore', { time: formatDuration(cmp.previousSeconds) }) }}</span>
      </div>

      <ul class="rows" :class="{ 'has-hover': hovered }">
        <li
          v-for="c in cmp.categories"
          :key="c.category"
          class="row"
          :class="{ active: hovered === c.category }"
          @mouseenter="hovered = c.category"
          @mouseleave="hovered = null"
        >
          <span class="dot" :style="{ background: categoryColor(c.category, custom) }" aria-hidden="true" />
          <span class="name">{{ categoryLabel(c.category, t) }}</span>
          <span class="bars" :aria-label="`${categoryLabel(c.category, t)}: ${formatDuration(c.current)} / ${formatDuration(c.previous)}`">
            <span class="bar now" :style="{ width: `${(c.current / maxCat) * 100}%`, background: categoryColor(c.category, custom) }" />
          </span>
          <span class="time">{{ formatDuration(c.current) }}</span>
          <span v-if="c.deltaPct" class="cat-delta" :class="dir(c.deltaPct)">
            {{ c.deltaPct > 0 ? '+' : '' }}{{ c.deltaPct }}%
          </span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.compare {
  padding: var(--sp-4);
  grid-column: span 3;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-3);
}
.head-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.label {
  font-size: var(--text-sm);
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-2);
}
.sub {
  font-size: 12px;
  color: var(--text-3);
}
.toggle {
  display: flex;
  gap: var(--sp-1);
  flex: none;
}
.toggle button {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-2);
  border-radius: 7px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}
.toggle button.active {
  background: var(--accent-gradient);
  color: var(--on-accent);
  border-color: transparent;
  font-weight: 700;
}
.toggle button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.empty {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-3);
}
.headline {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.total {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -1px;
}
.delta {
  font-size: var(--text-sm);
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--text-3);
}
.delta.up { color: var(--positive); }
.delta.down { color: var(--negative); }
.prev {
  font-size: 12px;
  color: var(--text-3);
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.row {
  display: grid;
  grid-template-columns: 10px 84px 1fr 64px auto;
  align-items: center;
  gap: 10px;
  font-size: var(--text-sm);
  padding: var(--sp-1) var(--sp-2);
  margin: 0 -8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 150ms ease, opacity 150ms ease;
}
.rows.has-hover .row { opacity: 0.5; }
.rows.has-hover .row.active {
  opacity: 1;
  background: var(--row-hover);
}
.row.active .name { color: var(--text); font-weight: 600; }
.dot {
  width: 9px;
  height: 9px;
  border-radius: 3px;
}
.name {
  color: var(--text-2);
}
.bars {
  display: flex;
  min-width: 0;
}
.bar {
  height: 8px;
  border-radius: 4px;
  min-width: 2px;
  transition: width 300ms ease;
}
.time {
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}
.cat-delta {
  text-align: right;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-3);
}
.cat-delta.up { color: var(--positive); }
.cat-delta.down { color: var(--negative); }
@media (max-width: 760px) {
  .row {
    grid-template-columns: 10px 72px 1fr 56px auto;
  }
}
@media (prefers-reduced-motion: reduce) {
  .bar { transition: none; }
}
</style>
