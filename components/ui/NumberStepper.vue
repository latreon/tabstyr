<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ modelValue: number; min?: number; max?: number; step?: number; label?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();
const { t } = useI18n();

const step = computed(() => props.step ?? 1);
const input = ref<HTMLInputElement | null>(null);
// Text typed but not yet committed (the field commits on change/blur — see onChange).
// null = the field is showing `modelValue`.
const draft = ref<string | null>(null);

function clamp(v: number): number {
  let next = v;
  if (props.min !== undefined) next = Math.max(props.min, next);
  if (props.max !== undefined) next = Math.min(props.max, next);
  return next;
}
// Parse whatever the field currently holds, clamped; null when it holds nothing
// usable. Read from the DOM so it is true even for a value set without an `input`
// event, which is what stepping must be based on: the field only commits on
// change/blur (see onChange), so a value typed but not yet committed was silently
// thrown away the moment the user reached for − or +.
function typedValue(): number | null {
  const el = input.value;
  if (!el || el.value.trim() === '') return null;
  const n = Number(el.value);
  return Number.isFinite(n) ? clamp(Math.round(n)) : null;
}
// Same number, but reactive (the DOM can't be a computed dependency), so the ±
// buttons' disabled state tracks what the user SEES rather than the last committed
// value — typing 60 with max=60 used to leave + looking enabled.
const effectiveValue = computed(() => {
  if (draft.value === null) return props.modelValue;
  const typed = Number(draft.value);
  return draft.value.trim() !== '' && Number.isFinite(typed) ? clamp(Math.round(typed)) : props.modelValue;
});
const atMin = computed(() => props.min !== undefined && effectiveValue.value <= props.min);
const atMax = computed(() => props.max !== undefined && effectiveValue.value >= props.max);

function bump(dir: number) {
  const next = clamp((typedValue() ?? props.modelValue) + dir * step.value);
  draft.value = null;
  // The bound :value only re-renders when modelValue actually changes, so sync the
  // DOM field directly — stepping away from an uncommitted entry that clamps to the
  // same number would otherwise leave the typed text on screen.
  if (input.value) input.value.value = String(next);
  emit('update:modelValue', next);
}
// Reconcile only when the edit is COMMITTED (blur / Enter), not on every
// keystroke. Clamping mid-typing corrupted multi-digit entry: with min=15,
// typing "180" clamped "1"→15 on the first digit and rewrote the field, so the
// user could never reach 180; clearing the field snapped to min. On commit we
// parse, clamp, sync the field, and emit; an empty/invalid entry reverts.
function onChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const raw = Number(target.value);
  draft.value = null; // the edit is over either way
  if (target.value.trim() === '' || !Number.isFinite(raw)) {
    target.value = String(props.modelValue); // revert
    return;
  }
  const next = clamp(Math.round(raw));
  target.value = String(next);
  emit('update:modelValue', next);
}
// Track keystrokes only so the ± buttons reflect the visible number; nothing is
// clamped or emitted here (clamping mid-typing made multi-digit entry impossible).
function onInput(e: Event) {
  draft.value = (e.target as HTMLInputElement).value;
}
</script>

<template>
  <div class="stepper">
    <button type="button" :aria-label="t('common.decrease', { label: label ?? '' })" :disabled="atMin" @click="bump(-1)">−</button>
    <input
      ref="input"
      type="number"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :aria-label="label"
      @input="onInput"
      @change="onChange"
    />
    <button type="button" :aria-label="t('common.increase', { label: label ?? '' })" :disabled="atMax" @click="bump(1)">+</button>
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
