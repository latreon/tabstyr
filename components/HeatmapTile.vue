<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { WEEK_ORDER, peakHour, type HeatmapData } from '@/lib/heatmap';
import { formatDuration } from '@/lib/time';
import { getDateLocale } from '@/lib/locale';

const props = defineProps<{ data: HeatmapData }>();
const { t, locale } = useI18n();

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const pad = (n: number) => String(n).padStart(2, '0');

// Localized short weekday names indexed by getDay() (0 = Sunday). 2023-01-01 was
// a Sunday; referencing locale.value keeps this reactive to a language switch.
const weekdays = computed(() => {
  void locale.value;
  const loc = getDateLocale();
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2023, 0, 1 + i).toLocaleString(loc, { weekday: 'short' }),
  );
});

const tooltip = ref<{ text: string; x: number; y: number } | null>(null);

function showTip(e: Event, day: number, hour: number) {
  const cell = e.currentTarget as HTMLElement;
  const tile = cell.closest('.heatmap-tile') as HTMLElement | null;
  if (!tile) return;
  const c = cell.getBoundingClientRect();
  const t = tile.getBoundingClientRect();
  const halfW = 80;
  tooltip.value = {
    text: cellLabel(day, hour),
    x: Math.max(halfW, Math.min(c.left - t.left + c.width / 2, t.width - halfW)),
    y: c.top - t.top,
  };
}
function hideTip() {
  tooltip.value = null;
}

// Keyboard access: the grid is a roving-tabindex group — one cell is in the tab
// order at a time, arrow keys move focus between cells (so a screen-reader /
// keyboard user can inspect every hour, not just hover with a mouse).
const activeDay = ref<(typeof WEEK_ORDER)[number]>(WEEK_ORDER[0]);
const activeHour = ref(0);
function isActive(day: number, hour: number): boolean {
  return day === activeDay.value && hour === activeHour.value;
}
function moveFocus(e: KeyboardEvent) {
  const handled = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
  if (!handled.includes(e.key)) return;
  e.preventDefault();
  let row = WEEK_ORDER.indexOf(activeDay.value);
  let h = activeHour.value;
  if (e.key === 'ArrowLeft') h = Math.max(0, h - 1);
  else if (e.key === 'ArrowRight') h = Math.min(23, h + 1);
  else if (e.key === 'ArrowUp') row = Math.max(0, row - 1);
  else if (e.key === 'ArrowDown') row = Math.min(WEEK_ORDER.length - 1, row + 1);
  else if (e.key === 'Home') h = 0;
  else if (e.key === 'End') h = 23;
  activeDay.value = WEEK_ORDER[row];
  activeHour.value = h;
  const grid = e.currentTarget as HTMLElement;
  void nextTick(() => {
    grid.querySelector<HTMLElement>(`[data-cell="${activeDay.value}-${activeHour.value}"]`)?.focus();
  });
}

const peak = computed(() => peakHour(props.data));
const peakLabel = computed(() => {
  const p = peak.value;
  if (!p) return null;
  return `${weekdays.value[p.day]} ${pad(p.hour)}:00 · ${formatDuration(p.seconds)}`;
});

function seconds(day: number, hour: number): number {
  return props.data.grid[day]?.[hour] ?? 0;
}

// Perceptual (sqrt) ramp so light activity is still visible; floor non-zero cells.
// Precomputed into a 7×24 lookup so a re-render (locale switch, tooltip, keyboard
// nav) doesn't re-run the sqrt+string build for all 168 cells — it only recomputes
// when the underlying data changes.
const cellStyles = computed(() => {
  const out: Record<string, string>[][] = [];
  for (let day = 0; day < 7; day++) {
    out[day] = [];
    for (let hour = 0; hour < 24; hour++) {
      const sec = props.data.grid[day]?.[hour] ?? 0;
      const pct = sec ? Math.max(12, Math.round(Math.sqrt(sec / props.data.max) * 100)) : 0;
      out[day][hour] = sec ? { background: `color-mix(in oklab, var(--accent) ${pct}%, transparent)` } : {};
    }
  }
  return out;
});

function cellLabel(day: number, hour: number): string {
  return `${weekdays.value[day]} ${pad(hour)}:00–${pad(hour + 1)}:00 · ${formatDuration(seconds(day, hour))}`;
}

const LEGEND = [0, 25, 50, 75, 100];
</script>

<template>
  <div class="tile heatmap-tile">
    <div class="hm-head">
      <h2 class="label">{{ t('heatmap.title') }}</h2>
      <span v-if="peakLabel" class="peak">{{ t('heatmap.peak', { label: peakLabel }) }}</span>
    </div>

    <p v-if="data.total === 0" class="label empty">{{ t('common.noActivity') }}</p>

    <template v-else>
      <div class="hm-grid" role="group" :aria-label="t('heatmap.gridAria')" @keydown="moveFocus">
        <template v-for="day in WEEK_ORDER" :key="day">
          <span class="hm-row-label" aria-hidden="true">{{ weekdays[day] }}</span>
          <button
            v-for="h in HOURS"
            :key="`${day}-${h}`"
            type="button"
            class="hm-cell"
            :style="cellStyles[day][h]"
            :aria-label="cellLabel(day, h)"
            :tabindex="isActive(day, h) ? 0 : -1"
            :data-cell="`${day}-${h}`"
            @focus="showTip($event, day, h)"
            @blur="hideTip"
            @mouseenter="showTip($event, day, h)"
            @mouseleave="hideTip"
          />
        </template>
        <span class="hm-corner" aria-hidden="true" />
        <span v-for="h in HOURS" :key="`hour-${h}`" class="hm-hour" aria-hidden="true">{{ h }}</span>
      </div>

      <div class="hm-legend" aria-hidden="true">
        <span>{{ t('heatmap.less') }}</span>
        <span
          v-for="p in LEGEND"
          :key="p"
          class="hm-swatch"
          :style="{ background: p === 0 ? 'var(--bar-track)' : `color-mix(in oklab, var(--accent) ${Math.max(12, p)}%, transparent)` }"
        />
        <span>{{ t('heatmap.more') }}</span>
      </div>

      <div v-if="tooltip" class="hm-tooltip" :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }" aria-hidden="true">
        {{ tooltip.text }}
      </div>
    </template>
  </div>
</template>

<style scoped>
.heatmap-tile {
  position: relative;
  padding: 16px;
  grid-column: span 3;
}
.hm-tooltip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 8px));
  background: var(--popover);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 5px 9px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
  z-index: 3;
}
.hm-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 16px;
  gap: 12px;
}
.hm-head .label {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-2);
  min-width: 0; /* allow shrink in the flex row so long titles can't push width */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.peak {
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
  min-width: 0; /* shrink + truncate instead of overflowing the tile in long locales */
  overflow: hidden;
  text-overflow: ellipsis;
}
.empty {
  margin: 0;
}
.hm-grid {
  display: grid;
  /* minmax(0,1fr): columns always shrink to fit the tile, so the grid never
     overflows and needs no scrollbar. The hover pop (scale) is transform-only —
     with no overflow container it can't spawn a scrollbar. */
  grid-template-columns: 40px repeat(24, minmax(0, 1fr));
  gap: 3px;
  align-items: center;
}
.hm-row-label {
  font-size: 10px;
  color: var(--text-3);
  text-align: right;
  padding-right: 8px;
  line-height: 1;
  /* Cyrillic/long weekday abbreviations (Пнд, Чтв) must clip cleanly inside the
     label column instead of bleeding into the first hour cell. */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hm-cell {
  appearance: none;
  border: none;
  margin: 0;
  padding: 0;
  font: inherit;
  cursor: pointer;
  aspect-ratio: 1;
  min-height: 12px;
  border-radius: 3px;
  background: var(--bar-track);
  transition: transform 100ms ease;
}
.hm-cell:hover {
  transform: scale(1.35);
  outline: 1px solid var(--accent);
  z-index: 1;
}
.hm-cell:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  transform: scale(1.35);
  z-index: 2;
}
.hm-corner {
  height: 1px;
}
.hm-hour {
  font-size: 8px;
  color: var(--text-3);
  text-align: center;
  line-height: 1;
  margin-top: 2px;
  /* All 24 labels now shown — let each clip to its (narrow) column instead of
     widening the grid. */
  min-width: 0;
  overflow: hidden;
}
.hm-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
  margin-top: 12px;
  font-size: 10px;
  color: var(--text-3);
}
.hm-swatch {
  width: 14px;
  height: 12px;
  border-radius: 3px;
  border: 1px solid var(--border);
}
@media (max-width: 760px) {
  .hm-cell {
    min-height: 9px;
  }
}
</style>
