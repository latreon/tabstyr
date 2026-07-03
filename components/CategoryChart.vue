<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { categoryColor, categoryLabel, type CategoryId, type CategorySlice, type CustomCategory } from '@/lib/categories';
import { budgetProgress } from '@/lib/budgets';
import { formatDuration } from '@/lib/time';

const props = defineProps<{
  slices: CategorySlice[];
  budgets?: Partial<Record<CategoryId, number>>;
  custom?: CustomCategory[];
}>();
const { t } = useI18n();

// Category the pointer is over — used to highlight its segment + chip together.
const hovered = ref<string | null>(null);

const total = computed(() => props.slices.reduce((sum, s) => sum + s.seconds, 0));

// Budgets are keyed by category value — built-in or custom name alike.
const budgetFor = (c: CategoryId) => props.budgets?.[c];

const items = computed(() =>
  props.slices
    .filter((s) => s.seconds > 0)
    .map((s) => {
      const budget = budgetFor(s.category);
      // `s.seconds` here is already active-only (todayByCategory is built from
      // useStats' activeStats), so don't let budgetProgress subtract audioSeconds
      // a second time — that's the raw-stats contract background.ts's own budget
      // check relies on.
      const progress = budgetProgress({ seconds: s.seconds, audioSeconds: 0 }, budget);
      return {
        category: s.category,
        label: categoryLabel(s.category, t),
        color: categoryColor(s.category, props.custom),
        seconds: s.seconds,
        pct: total.value ? Math.round((s.seconds / total.value) * 100) : 0,
        budget, // minutes, or undefined
        overBudget: progress >= 1,
      };
    }),
);

// Screen-reader label for the (purely visual) stacked bar — spells out each
// category's share so the role="img" conveys the data, not just "chart".
const stackSummary = computed(() =>
  `${t('category.shareAria')}: ${items.value
    .map((i) => `${i.label} ${i.pct}%`)
    .join(', ')}`,
);
</script>

<template>
  <div class="tile cat-tile">
    <div class="cat-head">
      <h2 class="label">{{ t('category.title') }}</h2>
      <span class="cat-total">{{ formatDuration(total) }}</span>
    </div>

    <p v-if="!total" class="empty">{{ t('common.nothingTracked') }}</p>

    <template v-else>
      <div class="stack" role="img" :aria-label="stackSummary" :class="{ 'has-hover': hovered }">
        <span
          v-for="i in items"
          :key="i.category"
          class="seg"
          :class="{ active: hovered === i.category }"
          :style="{ width: `${i.pct}%`, background: i.color }"
          :title="t('category.segTitle', { category: i.label, time: formatDuration(i.seconds), pct: i.pct })"
          @mouseenter="hovered = i.category"
          @mouseleave="hovered = null"
        />
      </div>

      <ul class="chips" :class="{ 'has-hover': hovered }">
        <li
          v-for="i in items"
          :key="i.category"
          :class="{ active: hovered === i.category }"
          @mouseenter="hovered = i.category"
          @mouseleave="hovered = null"
        >
          <span class="dot" :style="{ background: i.color }" aria-hidden="true" />
          <span class="chip-name">{{ i.label }}</span>
          <span class="chip-time">{{ formatDuration(i.seconds) }}</span>
          <span
            v-if="i.budget"
            class="budget-pill"
            :class="{ over: i.overBudget }"
            :title="t('category.budgetTitle', { budget: i.budget })"
          >{{ i.overBudget ? t('category.overBudget') : t('category.budgetMinutes', { budget: i.budget }) }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.cat-tile {
  padding: var(--sp-4);
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
  font-size: var(--text-sm);
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
  font-size: var(--text-sm);
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
  cursor: pointer;
  transition: width 300ms ease, opacity 150ms ease, filter 150ms ease;
}
/* When hovering, dim the rest and lift the active segment/chip. */
.stack.has-hover .seg { opacity: 0.4; }
.stack.has-hover .seg.active { opacity: 1; filter: brightness(1.12); }
.chips.has-hover li { opacity: 0.45; }
.chips li {
  cursor: pointer;
  transition: opacity 150ms ease;
}
.chips.has-hover li.active { opacity: 1; }
.chips li.active .chip-name { color: var(--text); }
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
  gap: var(--sp-2) 18px;
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
.budget-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  color: var(--text-3);
  background: var(--bar-track);
  white-space: nowrap;
}
.budget-pill.over {
  color: var(--warn);
  background: var(--warn-bg);
}
</style>
