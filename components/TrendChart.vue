<script setup lang="ts">
import { computed, ref } from 'vue';
import { buildTrend, type TrendMode } from '@/lib/trend';
import { formatDuration } from '@/lib/time';
import type { DailyStat } from '@/lib/types';

const props = defineProps<{ stats: DailyStat[] }>();
const mode = ref<TrendMode>('day');
const MODES: TrendMode[] = ['day', 'week', 'month'];

const points = computed(() => buildTrend(props.stats, mode.value, Date.now()));
const max = computed(() => Math.max(1, ...points.value.map((p) => p.seconds)));
</script>

<template>
  <div class="tile trend">
    <div class="trend-head">
      <span class="label">Trend</span>
      <div class="toggle" role="tablist" aria-label="Trend granularity">
        <button
          v-for="m in MODES"
          :key="m"
          role="tab"
          :aria-selected="mode === m"
          :class="{ active: mode === m }"
          @click="mode = m"
        >{{ m }}</button>
      </div>
    </div>
    <div class="bars">
      <div
        v-for="p in points"
        :key="p.label"
        class="bar-col"
        :title="`${p.label}: ${formatDuration(p.seconds)}`"
      >
        <div class="bar-fill" :style="{ height: `${(p.seconds / max) * 100}%` }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tile {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 16px;
  grid-column: span 3;
}
.trend-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.toggle {
  display: flex;
  gap: 4px;
}
.toggle button {
  border: 1px solid var(--color-border);
  background: transparent;
  border-radius: 7px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  text-transform: capitalize;
}
.toggle button.active {
  background: var(--color-ink);
  color: #fff;
  border-color: var(--color-ink);
}
.toggle button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 110px;
}
.bar-col {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
}
.bar-fill {
  width: 100%;
  background: var(--color-accent);
  border-radius: 3px 3px 0 0;
  min-height: 2px;
  opacity: 0.9;
}
</style>
