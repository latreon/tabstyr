<script setup lang="ts">
import { computed, ref } from 'vue';
import { buildComparison, type ComparePeriod } from '@/lib/comparison';
import { CATEGORY_META, type Category, type CategoryRule } from '@/lib/categories';
import { formatDuration } from '@/lib/time';
import type { DailyStat } from '@/lib/types';

const props = defineProps<{
  stats: DailyStat[];
  todayKey: string;
  overrides: Record<string, Category>;
  rules?: CategoryRule[];
}>();

const period = ref<ComparePeriod>('week');
const MODES: Array<{ value: ComparePeriod; label: string }> = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const cmp = computed(() =>
  buildComparison(props.stats, props.todayKey, period.value, props.overrides, props.rules ?? []),
);

const title = computed(() => (period.value === 'week' ? 'This week vs last week' : 'This month vs last month'));
const subtitle = computed(() =>
  period.value === 'week'
    ? 'Last 7 days vs the 7 before · today still counting'
    : 'Last 30 days vs the 30 before · today still counting',
);

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
        <span class="label">{{ title }}</span>
        <span class="sub">{{ subtitle }}</span>
      </div>
      <div class="toggle" role="tablist" aria-label="Comparison period">
        <button
          v-for="m in MODES"
          :key="m.value"
          role="tab"
          :aria-selected="period === m.value"
          :class="{ active: period === m.value }"
          @click="period = m.value"
        >{{ m.label }}</button>
      </div>
    </div>

    <p v-if="!hasData" class="empty">Not enough history yet — check back after a few days.</p>

    <template v-else>
      <div class="headline">
        <span class="total">{{ formatDuration(cmp.currentSeconds) }}</span>
        <span v-if="cmp.deltaPct !== null" class="delta" :class="dir(cmp.deltaPct)">
          <template v-if="cmp.deltaPct === 0">no change</template>
          <template v-else>
            <span aria-hidden="true">{{ cmp.deltaPct > 0 ? '↑' : '↓' }}</span>
            {{ Math.abs(cmp.deltaPct) }}%
          </template>
        </span>
        <span class="prev">vs {{ formatDuration(cmp.previousSeconds) }} before</span>
      </div>

      <ul class="rows">
        <li v-for="c in cmp.categories" :key="c.category" class="row">
          <span class="dot" :style="{ background: CATEGORY_META[c.category].color }" aria-hidden="true" />
          <span class="name">{{ c.category }}</span>
          <span class="bars" :aria-label="`${c.category}: ${formatDuration(c.current)} now vs ${formatDuration(c.previous)} before`">
            <span class="bar now" :style="{ width: `${(c.current / maxCat) * 100}%`, background: CATEGORY_META[c.category].color }" />
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
  padding: 16px;
  grid-column: span 3;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.head-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.label {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-2);
}
.sub {
  font-size: 11px;
  color: var(--text-3);
}
.toggle {
  display: flex;
  gap: 4px;
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
  font-size: 13px;
  color: var(--text-3);
}
.headline {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}
.total {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -1px;
}
.delta {
  font-size: 13px;
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
  gap: 8px;
}
.row {
  display: grid;
  grid-template-columns: 10px 84px 1fr 64px auto;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
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
