<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from '@/composables/useTheme';

const { setting, cycle } = useTheme();
const { t } = useI18n();

// Tooltip/aria: current mode + a "click to switch" hint, localized.
const modeLabel = computed(() =>
  setting.value === 'dark' ? t('settings.dark')
  : setting.value === 'light' ? t('settings.light')
  : t('settings.languageAuto'),
);
const label = computed(() => t('settings.switchTheme', { mode: modeLabel.value }));
</script>

<template>
  <button
    class="theme-toggle tip-right"
    :aria-label="label"
    :data-tip="label"
    @click="cycle"
  >
    <!-- Sun: light (Lucide) -->
    <svg v-if="setting === 'light'" class="ti" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
    <!-- Moon: dark (Lucide) -->
    <svg v-else-if="setting === 'dark'" class="ti" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
    <!-- Monitor: system (Lucide) -->
    <svg v-else class="ti" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  </button>
</template>

<style scoped>
.theme-toggle {
  /* Match the privacy badge sitting next to it: same surface, border, and
     pill shape, with an accent border on hover. */
  background: var(--card-strong);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease;
}
.ti {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
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
