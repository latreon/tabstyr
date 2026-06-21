<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { buildFocusTrend, type FocusPoint } from '@/lib/productivity';
import { xTickEvery } from '@/lib/chart-scale';
import type { TrendMode } from '@/lib/trend';
import type { Category, CategoryRule } from '@/lib/categories';
import type { DailyStat } from '@/lib/types';

const props = defineProps<{
  stats: DailyStat[];
  overrides: Record<string, Category>;
  rules?: CategoryRule[];
  now: number;
  target?: number;
}>();
const { t } = useI18n();
const mode = ref<TrendMode>('day');
const MODES: TrendMode[] = ['day', 'week', 'month'];
const target = computed(() => props.target ?? 50);

const points = computed(() => buildFocusTrend(props.stats, mode.value, props.now, props.overrides, props.rules ?? []));
const hasData = computed(() => points.value.some((p) => p.judged > 0));
const labelEvery = computed(() => xTickEvery(mode.value));

const tooltip = ref<{ text: string; x: number; bottom: number } | null>(null);
function tipText(p: FocusPoint): string {
  return p.judged > 0 ? `${p.label} · ${p.focusPct}%` : `${p.label} · —`;
}
function showTip(e: Event, p: FocusPoint) {
  const target = e.currentTarget as HTMLElement;
  const host = target.closest('.plot') as HTMLElement;
  const rect = target.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const fill = target.querySelector('.bar-fill, .bar-empty') as HTMLElement | null;
  const fillH = fill ? fill.getBoundingClientRect().height : 0;
  const halfW = 70;
  tooltip.value = {
    text: tipText(p),
    x: Math.max(halfW, Math.min(rect.left - hostRect.left + rect.width / 2, hostRect.width - halfW)),
    bottom: fillH + 8, // sit just above the bar's top, tracking bar height
  };
}
const hideTip = () => (tooltip.value = null);
</script>

<template>
  <div class="tile focus-trend">
    <div class="ft-head">
      <h2 class="label">{{ t('focus.trendTitle') }}</h2>
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

    <p v-if="!hasData" class="empty">{{ t('comparison.notEnough') }}</p>

    <template v-else>
      <div class="chart">
        <div class="y-axis" aria-hidden="true">
          <span class="y-label">100%</span>
          <span class="y-label">50%</span>
          <span class="y-label">0%</span>
        </div>
        <div class="plot">
          <div class="bars">
            <div
              v-for="p in points"
              :key="p.key"
              class="bar-col"
              role="img"
              tabindex="0"
              :aria-label="tipText(p)"
              @mouseenter="showTip($event, p)"
              @mouseleave="hideTip"
              @focus="showTip($event, p)"
              @blur="hideTip"
            >
              <div
                v-if="p.judged > 0"
                class="bar-fill"
                :class="{ good: p.focusPct >= target, partial: p.partial }"
                :style="{ height: `${Math.max(p.focusPct, 2)}%` }"
              />
              <div v-else class="bar-empty" />
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
    </template>
  </div>
</template>

<style scoped>
.focus-trend {
  padding: 16px;
  grid-column: span 3;
}
.ft-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.ft-head .label {
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
.empty {
  margin: 0;
  font-size: 13px;
  color: var(--text-3);
}
.chart {
  display: flex;
  gap: 8px;
  padding: 24px 0 0;
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
.bars {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  gap: 4px;
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
  filter: brightness(1.15);
}
.bar-col:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.bar-fill {
  width: 100%;
  background: var(--negative);
  border-radius: 3px 3px 0 0;
  min-height: 2px;
  opacity: 0.85;
  transition: height 300ms ease;
}
.bar-fill.good {
  background: var(--positive);
}
.bar-fill.partial {
  opacity: 0.5;
  background-image: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 3px,
    rgba(255, 255, 255, 0.35) 3px,
    rgba(255, 255, 255, 0.35) 6px
  );
  background-blend-mode: overlay;
}
.bar-empty {
  width: 100%;
  height: 2px;
  border-radius: 2px;
  background: var(--bar-track);
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
  padding-left: 46px;
}
.x-label {
  flex: 1;
  font-size: 9px;
  color: var(--text-3);
  text-align: center;
  overflow: hidden;
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  .bar-fill { transition: none; }
}
</style>
