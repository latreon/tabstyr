<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ modelValue: number; min?: number; max?: number; step?: number; label?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();
const { t } = useI18n();

const step = computed(() => props.step ?? 1);

function clamp(v: number): number {
  let next = v;
  if (props.min !== undefined) next = Math.max(props.min, next);
  if (props.max !== undefined) next = Math.min(props.max, next);
  return next;
}
function bump(dir: number) {
  emit('update:modelValue', clamp(props.modelValue + dir * step.value));
}
// Reconcile only when the edit is COMMITTED (blur / Enter), not on every
// keystroke. Clamping mid-typing corrupted multi-digit entry: with min=15,
// typing "180" clamped "1"→15 on the first digit and rewrote the field, so the
// user could never reach 180; clearing the field snapped to min. On commit we
// parse, clamp, sync the field, and emit; an empty/invalid entry reverts.
function onChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const raw = Number(target.value);
  if (target.value.trim() === '' || !Number.isFinite(raw)) {
    target.value = String(props.modelValue); // revert
    return;
  }
  const next = clamp(Math.round(raw));
  target.value = String(next);
  emit('update:modelValue', next);
}
</script>

<template>
  <div class="stepper">
    <button type="button" :aria-label="t('common.decrease', { label: label ?? '' })" :disabled="min !== undefined && modelValue <= min" @click="bump(-1)">−</button>
    <input
      type="number"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :aria-label="label"
      @change="onChange"
    />
    <button type="button" :aria-label="t('common.increase', { label: label ?? '' })" :disabled="max !== undefined && modelValue >= max" @click="bump(1)">+</button>
  </div>
</template>

<style scoped>
.stepper {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border);
  background: var(--card-strong);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.stepper:focus-within { border-color: var(--accent); }
.stepper button {
  border: none;
  background: transparent;
  color: var(--text-2);
  width: 28px;
  height: 30px;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  font-family: inherit;
}
.stepper button:hover:not(:disabled) { background: var(--row-hover); color: var(--text); }
.stepper button:disabled { opacity: 0.35; cursor: not-allowed; }
.stepper input {
  width: 44px;
  border: none;
  background: transparent;
  color: var(--text);
  text-align: center;
  font-size: var(--text-sm);
  font-family: inherit;
  padding: var(--sp-1) 0;
  -moz-appearance: textfield;
}
.stepper input::-webkit-outer-spin-button,
.stepper input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.stepper input:focus-visible { outline: none; }
</style>
