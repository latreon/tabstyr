<script setup lang="ts">
import { computed, ref } from 'vue';
import { WEEKDAYS, WEEK_ORDER, peakHour, type HeatmapData } from '@/lib/heatmap';
import { formatDuration } from '@/lib/time';

const props = defineProps<{ data: HeatmapData }>();

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const pad = (n: number) => String(n).padStart(2, '0');

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

const peak = computed(() => peakHour(props.data));
const peakLabel = computed(() => {
  const p = peak.value;
  if (!p) return null;
  return `${WEEKDAYS[p.day]} ${pad(p.hour)}:00 · ${formatDuration(p.seconds)}`;
});

function seconds(day: number, hour: number): number {
  return props.data.grid[day]?.[hour] ?? 0;
}

// Perceptual (sqrt) ramp so light activity is still visible; floor non-zero cells.
function cellStyle(day: number, hour: number): Record<string, string> {
  const sec = seconds(day, hour);
  if (!sec) return {};
  const pct = Math.max(12, Math.round(Math.sqrt(sec / props.data.max) * 100));
  return { background: `color-mix(in oklab, var(--accent) ${pct}%, transparent)` };
}

function cellLabel(day: number, hour: number): string {
  return `${WEEKDAYS[day]} ${pad(hour)}:00–${pad(hour + 1)}:00 · ${formatDuration(seconds(day, hour))}`;
}

const LEGEND = [0, 25, 50, 75, 100];
</script>

<template>
  <div class="tile heatmap-tile">
    <div class="hm-head">
      <span class="label">Activity heatmap</span>
      <span v-if="peakLabel" class="peak">Peak · {{ peakLabel }}</span>
    </div>

    <p v-if="data.total === 0" class="label empty">No activity tracked yet.</p>

    <template v-else>
      <div class="hm-grid" role="img" aria-label="Browsing activity by weekday and hour of day">
        <template v-for="day in WEEK_ORDER" :key="day">
          <span class="hm-row-label">{{ WEEKDAYS[day] }}</span>
          <span
            v-for="h in HOURS"
            :key="`${day}-${h}`"
            class="hm-cell"
            :style="cellStyle(day, h)"
            :aria-label="cellLabel(day, h)"
            @mouseenter="showTip($event, day, h)"
            @mouseleave="hideTip"
          />
        </template>
        <span class="hm-corner" aria-hidden="true" />
        <span v-for="h in HOURS" :key="`hour-${h}`" class="hm-hour" aria-hidden="true">
          {{ h % 3 === 0 ? h : '' }}
        </span>
      </div>

      <div class="hm-legend" aria-hidden="true">
        <span>Less</span>
        <span
          v-for="p in LEGEND"
          :key="p"
          class="hm-swatch"
          :style="{ background: p === 0 ? 'var(--bar-track)' : `color-mix(in oklab, var(--accent) ${Math.max(12, p)}%, transparent)` }"
        />
        <span>More</span>
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
}
.peak {
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
}
.empty {
  margin: 0;
}
.hm-grid {
  display: grid;
  grid-template-columns: 32px repeat(24, 1fr);
  gap: 3px;
  align-items: center;
}
.hm-row-label {
  font-size: 10px;
  color: var(--text-3);
  text-align: right;
  padding-right: 8px;
  line-height: 1;
}
.hm-cell {
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
.hm-corner {
  height: 1px;
}
.hm-hour {
  font-size: 9px;
  color: var(--text-3);
  text-align: center;
  line-height: 1;
  margin-top: 2px;
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
