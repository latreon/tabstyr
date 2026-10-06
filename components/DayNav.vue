<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { addDays } from '@/lib/time';
import DatePicker from '@/components/ui/DatePicker.vue';

const props = defineProps<{ modelValue: string; min: string; max: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const { t } = useI18n();

const canPrev = computed(() => props.modelValue > props.min);
const canNext = computed(() => props.modelValue < props.max);

function step(days: number) {
  const next = addDays(props.modelValue, days);
  if (next >= props.min && next <= props.max) emit('update:modelValue', next);
}
</script>

<template>
  <div class="day-nav">
    <button type="button" class="nav" :disabled="!canPrev" :aria-label="t('worklog.prevDay')" @click="step(-1)">‹</button>
    <DatePicker :model-value="modelValue" :min="min" :max="max" @update:model-value="emit('update:modelValue', $event)" />
    <button type="button" class="nav" :disabled="!canNext" :aria-label="t('worklog.nextDay')" @click="step(1)">›</button>
  </div>
</template>

<style scoped>
.day-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}
.nav {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  transition: transform 160ms ease-out;
}
.nav:active:not(:disabled) {
  transform: scale(0.96);
}
.nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.nav:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
