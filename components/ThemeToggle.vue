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
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-2);
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.theme-toggle:hover {
  background: var(--row-hover);
}
.theme-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
