<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { buildTrend, type TrendMode, type TrendPoint } from '@/lib/trend';
import { trendTooltip, xTickEvery, yTicks } from '@/lib/chart-scale';
import type { DailyStat } from '@/lib/types';

const props = defineProps<{ stats: DailyStat[]; now: number }>();
const { t } = useI18n();
const mode = ref<TrendMode>('day');
const MODES: TrendMode[] = ['day', 'week', 'month'];

// `now` is passed in (frozen at dashboard load, like FocusTrend/WorkLog) rather
// than read via Date.now() inside the computed — a bare Date.now() isn't a reactive
// dependency, so the chart's "today" would otherwise go stale past midnight.
const points = computed(() => buildTrend(props.stats, mode.value, props.now));
const ticks = computed(() => yTicks(Math.max(1, ...points.value.map((p) => p.seconds))));
const chartMax = computed(() => ticks.value[2].seconds);
const labelEvery = computed(() => xTickEvery(mode.value));

const tooltip = ref<{ text: string; x: number; bottom: number } | null>(null);

function showTip(e: Event, p: TrendPoint) {
  const target = e.currentTarget as HTMLElement;
  const host = target.closest('.plot') as HTMLElement;
  const rect = target.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const fill = target.querySelector('.bar-fill') as HTMLElement | null;
  const fillH = fill ? fill.getBoundingClientRect().height : 0;
  const halfW = 80;
  tooltip.value = {
    text: trendTooltip(p.key, mode.value, p.seconds, p.partial, t),
    x: Math.max(halfW, Math.min(rect.left - hostRect.left + rect.width / 2, hostRect.width - halfW)),
    bottom: fillH + 8, // sit just above the bar's top, so it tracks bar height
  };
}
function hideTip() {
  tooltip.value = null;
}
</script>

<template>
  <div class="tile trend">
    <div class="trend-head">
      <h2 class="label">{{ t('trend.title') }}</h2>
      <div class="toggle" role="group" :aria-label="t('trend.granularityAria')">
        <button
          v-for="m in MODES"
          :key="m"
          type="button"
          :aria-pressed="mode === m"
          :class="{ active: mode === m }"
          @click="mode = m"
        >{{ t(`trend.${m}`) }}</button>
      </div>
    </div>
    <div class="chart">
      <div class="y-axis" aria-hidden="true">
        <span v-for="t in [...ticks].reverse()" :key="t.seconds" class="y-label">{{ t.label }}</span>
        <span class="y-label">0</span>
      </div>
      <div class="plot">
        <div v-for="t in ticks" :key="t.seconds" class="gridline" :style="{ bottom: `${(t.seconds / chartMax) * 100}%` }" aria-hidden="true" />
        <div class="bars" role="group" :aria-label="t('trend.title')">
          <div
            v-for="(p, i) in points"
            :key="p.key"
            class="bar-col"
            role="img"
            tabindex="0"
            :aria-label="trendTooltip(p.key, mode, p.seconds, p.partial, t)"
            @mouseenter="showTip($event, p)"
            @mouseleave="hideTip"
            @focus="showTip($event, p)"
            @blur="hideTip"
          >
            <div
              class="bar-fill"
              :class="{ partial: p.partial, current: i === points.length - 1 }"
              :style="{ height: `${(p.seconds / chartMax) * 100}%`, animationDelay: `${i * 16}ms` }"
            />
          </div>
        </div>
        <div v-if="tooltip" class="tooltip" :style="{ left: `${tooltip.x}px`, bottom: `${tooltip.bottom}px` }" aria-hidden="true">
          {{ tooltip.text }}
        </div>
      </div>
    </div>
    <div class="x-axis" aria-hidden="true">
      <span v-for="(p, i) in points" :key="p.key" class="x-label">
        {{ i % labelEvery === 0 ? p.label : '' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.trend {
  padding: 16px;
  grid-column: span 3;
}
.trend-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.trend-head .label {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-2);
}
.toggle {
  display: flex;
  gap: 4px;
}
.toggle button {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-2);
  border-radius: 7px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  text-transform: capitalize;
  font-family: inherit;
}
.toggle button.active {
  background: var(--accent-grad-strong);
  color: var(--on-accent);
  border-color: transparent;
  font-weight: 700;
}
.toggle button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.chart {
  display: flex;
  gap: 8px;
  padding: 24px 0;
}
.y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 130px;
  flex: none;
  width: 38px;
  text-align: right;
}
.y-label {
  font-size: 10px;
  color: var(--text-3);
  line-height: 1;
  transform: translateY(-50%);
}
.y-axis .y-label:last-child {
  transform: translateY(0);
}
.plot {
  position: relative;
  flex: 1;
  height: 130px;
}
.gridline {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed var(--divider);
}
.bars {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  padding: 0 10px; /* breathing room so end bars don't touch the plot edges */
}
.bar-col {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
  cursor: default;
  border-radius: 3px 3px 0 0;
}
.bar-col:hover .bar-fill,
.bar-col:focus-visible .bar-fill {
  filter: brightness(1.25);
}
.bar-col:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.bar-fill {
  width: 100%;
  background: var(--accent-gradient);
  border-radius: 3px 3px 0 0;
  min-height: 2px;
  opacity: 0.9;
  transform-origin: bottom;
  animation: bar-rise 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
}
/* The most-recent period ("now") reads as live: full opacity + a soft accent glow. */
.bar-fill.current {
  opacity: 1;
  box-shadow: 0 0 12px -2px var(--accent-muted);
}
@keyframes bar-rise {
  from { transform: scaleY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .bar-fill { animation: none; }
}
/* Partial (in-progress / clipped) period: hatched + dimmed so it isn't read as a full month. */
.bar-fill.partial {
  opacity: 0.55;
  background-image: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 3px,
    rgba(255, 255, 255, 0.35) 3px,
    rgba(255, 255, 255, 0.35) 6px
  );
  background-blend-mode: overlay;
}
.tooltip {
  position: absolute;
  transform: translateX(-50%);
  z-index: 3;
  background: var(--popover);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 5px 9px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: var(--shadow);
  z-index: 2;
}
.x-axis {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  /* 46px = y-axis (38) + chart gap (8); +10px each side matches the bars' padding
     so labels stay centred under their bars. */
  padding-left: 56px;
  padding-right: 10px;
}
.x-label {
  flex: 1;
  font-size: 9px;
  color: var(--text-3);
  text-align: center;
  overflow: hidden;
  white-space: nowrap;
}
</style>
