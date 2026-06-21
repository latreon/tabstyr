<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatDuration } from '@/lib/time';
import type { ProductivitySummary } from '@/lib/productivity';

const props = defineProps<{ summary: ProductivitySummary }>();
const { t } = useI18n();

const hasData = computed(() => props.summary.productiveSeconds + props.summary.distractingSeconds > 0);
const prodWidth = computed(() => `${props.summary.todayFocusPct}%`);
</script>

<template>
  <div class="tile prod-tile">
    <h2 class="label">{{ t('focus.title') }}</h2>

    <template v-if="hasData">
      <div class="figure">
        <span class="pct" :class="{ good: summary.todayFocusPct >= summary.focusTarget }">
          {{ summary.todayFocusPct }}<em>%</em>
        </span>
        <span v-if="summary.streakDays > 0" class="streak" :title="t('focus.streakTitle', { count: summary.streakDays, target: summary.focusTarget })">
          {{ t('focus.streak', { count: summary.streakDays }) }}
        </span>
      </div>

      <div class="split" :aria-label="t('focus.ariaFocus', { pct: summary.todayFocusPct })">
        <div class="split-bar">
          <span class="prod" :style="{ width: prodWidth }" />
        </div>
        <div class="split-legend">
          <span class="pl"><span class="sw prod" /> {{ t('focus.productive') }} · {{ formatDuration(summary.productiveSeconds) }}</span>
          <span class="pl"><span class="sw dist" /> {{ t('focus.distracting') }} · {{ formatDuration(summary.distractingSeconds) }}</span>
        </div>
      </div>
    </template>

    <p v-else class="prod-empty">{{ t('focus.empty') }}</p>

    <p class="prod-note">{{ t('focus.note', { target: summary.focusTarget }) }}</p>
  </div>
</template>

<style scoped>
.prod-tile {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.label {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-2);
}
.figure {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.pct {
  font-size: 40px;
  font-weight: 800;
  letter-spacing: -1.5px;
  color: var(--text);
  line-height: 1;
}
.pct.good {
  color: var(--positive);
}
.pct em {
  font-size: 18px;
  font-weight: 700;
  font-style: normal;
  margin-left: 1px;
}
.streak {
  font-size: 12px;
  font-weight: 700;
  color: var(--warn);
  white-space: nowrap;
}
.split {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.split-bar {
  height: 8px;
  border-radius: 4px;
  background: var(--negative);
  overflow: hidden;
}
.split-bar .prod {
  display: block;
  height: 100%;
  background: var(--positive);
  border-radius: 4px;
  transition: width 300ms ease;
}
.split-legend {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;
  color: var(--text-3);
}
.pl {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sw {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  flex: none;
}
.sw.prod {
  background: var(--positive);
}
.sw.dist {
  background: var(--negative);
}
.prod-empty {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-3);
}
.prod-note {
  margin: 0;
  font-size: 10px;
  line-height: 1.4;
  color: var(--text-3);
}
</style>
