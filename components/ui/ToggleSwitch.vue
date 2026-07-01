<script setup lang="ts">
defineProps<{ modelValue: boolean; label?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
</script>

<template>
  <button
    type="button"
    class="toggle"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    :class="{ on: modelValue }"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="knob" aria-hidden="true" />
  </button>
</template>

<style scoped>
.toggle {
  position: relative;
  width: 44px;
  height: 24px; /* WCAG 2.2 (2.5.8) minimum target height */
  border: 1px solid var(--border);
  background: var(--bar-track);
  border-radius: var(--radius-pill);
  padding: 0;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease;
  flex: none;
}
.toggle.on {
  background: var(--accent-grad-strong);
  border-color: transparent;
}
.toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  transition: transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
}
.toggle.on .knob { transform: translateX(20px); }
</style>
