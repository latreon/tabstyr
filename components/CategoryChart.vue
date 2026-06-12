<script setup lang="ts">
import { computed } from 'vue';
import { CATEGORY_META, type CategorySlice } from '@/lib/categories';
import { formatDuration } from '@/lib/time';

const props = defineProps<{ slices: CategorySlice[] }>();

const total = computed(() => props.slices.reduce((sum, s) => sum + s.seconds, 0));

const items = computed(() =>
  props.slices
    .filter((s) => s.seconds > 0)
    .map((s) => ({
      category: s.category,
      color: CATEGORY_META[s.category].color,
      seconds: s.seconds,
      pct: total.value ? Math.round((s.seconds / total.value) * 100) : 0,
    })),
);
</script>

<template>
  <div class="tile cat-tile">
    <div class="cat-head">
      <span class="label">Today by category</span>
      <span class="cat-total">{{ formatDuration(total) }}</span>
    </div>

    <p v-if="!total" class="empty">Nothing tracked yet.</p>

    <template v-else>
      <div class="stack" role="img" aria-label="Share of time by category">
        <span
          v-for="i in items"
          :key="i.category"
          class="seg"
          :style="{ width: `${i.pct}%`, background: i.color }"
          :title="`${i.category} · ${formatDuration(i.seconds)} · ${i.pct}%`"
        />
      </div>

      <ul class="chips">
        <li v-for="i in items" :key="i.category">
          <span class="dot" :style="{ background: i.color }" aria-hidden="true" />
          <span class="chip-name">{{ i.category }}</span>
          <span class="chip-time">{{ formatDuration(i.seconds) }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.cat-tile {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  grid-column: span 2;
}
.cat-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.label {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-2);
}
.cat-total {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.empty {
  margin: 0;
  font-size: 13px;
  color: var(--text-3);
}
.stack {
  display: flex;
  height: 14px;
  border-radius: 7px;
  overflow: hidden;
  background: var(--bar-track);
  gap: 2px;
}
.seg {
  height: 100%;
  min-width: 3px;
  transition: width 300ms ease;
}
.seg:first-child {
  border-radius: 7px 0 0 7px;
}
.seg:last-child {
  border-radius: 0 7px 7px 0;
}
.chips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
}
.chips li {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
}
.dot {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  flex: none;
}
.chip-name {
  color: var(--text-2);
}
.chip-time {
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
</style>
