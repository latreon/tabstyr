<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CATEGORIES, CATEGORY_META, PRODUCTIVITY, type Category, type Productivity } from '@/lib/categories';
import SelectBox from '@/components/ui/SelectBox.vue';

const props = defineProps<{ productivity: Record<Category, Productivity> }>();
const emit = defineEmits<{ set: [category: Category, value: Productivity] }>();
const { t } = useI18n();

const OPTIONS = computed(() => PRODUCTIVITY.map((p) => ({ value: p, label: t(`productivity.${p}`) })));
</script>

<template>
  <div class="tile focus-cats-tile">
    <h2 class="label">{{ t('settings.focusCategories') }}</h2>
    <p class="hint">{{ t('settings.focusCategoriesHint') }}</p>
    <ul class="prod-list">
      <li v-for="c in CATEGORIES" :key="c" class="prod-row">
        <span class="prod-cat">
          <span class="cat-dot" :style="{ background: CATEGORY_META[c].color }" aria-hidden="true" />
          {{ t(`categories.${c}`) }}
        </span>
        <SelectBox
          :model-value="productivity[c]"
          :options="OPTIONS"
          :label="t('settings.productivityForAria', { category: t(`categories.${c}`) })"
          @update:model-value="emit('set', c, $event as Productivity)"
        />
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
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
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
</style>
