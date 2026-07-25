<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CATEGORIES, CATEGORY_META, PRODUCTIVITY, categoryLabel, type Category, type CategoryId, type CustomCategory, type Productivity } from '@/lib/categories';
import SelectBox from '@/components/ui/SelectBox.vue';
import NumberStepper from '@/components/ui/NumberStepper.vue';

const props = defineProps<{
  productivity: Record<Category, Productivity>;
  custom?: CustomCategory[];
  /** Daily minute budgets per category value; absent/0 = no budget. */
  budgets?: Partial<Record<CategoryId, number>>;
}>();
const emit = defineEmits<{
  set: [category: Category, value: Productivity];
  setCustom: [name: CategoryId, value: Productivity];
  setBudget: [category: CategoryId, minutes: number | null];
}>();
const { t } = useI18n();

const OPTIONS = computed(() => PRODUCTIVITY.map((p) => ({ value: p, label: t(`productivity.${p}`) })));

// Daily time budget per category, in minutes. 0 means "no budget" — the stepper's
// minimum, so stepping down to 0 clears it (the setter treats 0/null the same).
const MAX_BUDGET_MINUTES = 24 * 60;
const budgetOf = (c: CategoryId): number => props.budgets?.[c] ?? 0;
const onBudget = (c: CategoryId, minutes: number) => emit('setBudget', c, minutes > 0 ? minutes : null);
</script>

<template>
  <div class="tile focus-cats-tile">
    <h2 class="label">{{ t('settings.focusCategories') }}</h2>
    <p class="hint">{{ t('settings.focusCategoriesHint') }}</p>
    <p class="hint">{{ t('settings.dailyBudgetsHint') }}</p>
    <ul class="prod-list" :aria-label="t('settings.categoryProductivityAria')">
      <li v-for="c in CATEGORIES" :key="c" class="prod-row">
        <span class="prod-cat">
          <span class="cat-dot" :style="{ background: CATEGORY_META[c].color }" aria-hidden="true" />
          {{ t(`categories.${c}`) }}
        </span>
        <span class="prod-controls">
          <SelectBox
            :model-value="productivity[c]"
            :options="OPTIONS"
            :label="t('settings.productivityForAria', { category: t(`categories.${c}`) })"
            @update:model-value="emit('set', c, $event as Productivity)"
          />
          <span class="budget">
            <NumberStepper
              :model-value="budgetOf(c)"
              :min="0"
              :max="MAX_BUDGET_MINUTES"
              :step="15"
              :label="t('settings.budgetForAria', { category: t(`categories.${c}`) })"
              @update:model-value="onBudget(c, $event)"
            />
            <span class="budget-unit">{{ budgetOf(c) ? t('settings.budgetUnit') : t('settings.budgetOff') }}</span>
          </span>
        </span>
      </li>
      <!-- Custom categories carry their own productivity — reclassify it here, the
           same way built-ins are remapped above. -->
      <li v-for="c in custom ?? []" :key="c.name" class="prod-row">
        <span class="prod-cat">
          <span class="cat-dot" :style="{ background: c.color }" aria-hidden="true" />
          {{ categoryLabel(c.name, t) }}
        </span>
        <span class="prod-controls">
          <SelectBox
            :model-value="c.productivity"
            :options="OPTIONS"
            :label="t('settings.productivityForAria', { category: c.name })"
            @update:model-value="emit('setCustom', c.name, $event as Productivity)"
          />
          <span class="budget">
            <NumberStepper
              :model-value="budgetOf(c.name)"
              :min="0"
              :max="MAX_BUDGET_MINUTES"
              :step="15"
              :label="t('settings.budgetForAria', { category: c.name })"
              @update:model-value="onBudget(c.name, $event)"
            />
            <span class="budget-unit">{{ budgetOf(c.name) ? t('settings.budgetUnit') : t('settings.budgetOff') }}</span>
          </span>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.focus-cats-tile {
  grid-column: span 3;
  padding: var(--sp-4) 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.label { font-size: var(--text-sm); font-weight: 700; letter-spacing: 0.5px; color: var(--text-2); }
.hint { margin: 0 0 var(--sp-1); font-size: var(--text-xs); line-height: 1.45; color: var(--text-3); }
.prod-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  /* Wider track than before: each row now carries a productivity picker AND a
     budget stepper, so 240px wrapped the two controls onto separate lines. */
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: var(--sp-2) 20px;
}
.prod-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2) 10px;
  flex-wrap: wrap;
}
.prod-cat {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
  flex: 1 1 auto;
  font-size: var(--text-sm);
  color: var(--text-2);
}
.cat-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.prod-controls {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  flex: none;
}
.budget {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.budget-unit {
  min-width: 1.6em; /* reserve room so "off" → "m" doesn't shift the stepper */
  font-size: var(--text-xs);
  color: var(--text-3);
}
</style>
