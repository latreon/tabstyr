<script setup lang="ts">
import { computed } from 'vue';
import { useTheme } from '@/composables/useTheme';

const { setting, cycle } = useTheme();
const icon = computed(() => (setting.value === 'system' ? '◐' : setting.value === 'dark' ? '☾' : '☀'));
</script>

<template>
  <button
    class="theme-toggle"
    :aria-label="`Theme: ${setting}. Click to change.`"
    :title="`Theme: ${setting}`"
    @click="cycle"
  >
    {{ icon }}
  </button>
</template>

<style scoped>
.theme-toggle {
  /* Match the privacy badge sitting next to it: same surface, border, and
     pill shape, with an accent border on hover. */
  background: var(--card-strong);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-2);
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: border-color 120ms ease, color 120ms ease;
}
.theme-toggle:hover {
  border-color: var(--accent);
  color: var(--text);
}
.theme-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
