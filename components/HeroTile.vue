<script setup lang="ts">
import { computed } from 'vue';
import { formatDuration } from '@/lib/time';

const props = defineProps<{ todaySeconds: number; weeklyAvgSeconds: number }>();

const deltaPct = computed(() => {
  if (!props.weeklyAvgSeconds) return null;
  return Math.round(((props.todaySeconds - props.weeklyAvgSeconds) / props.weeklyAvgSeconds) * 100);
});
</script>

<template>
  <div class="hero-tile">
    <span class="label hero-label">Today</span>
    <span class="hero-value">{{ formatDuration(todaySeconds) }}</span>
    <span v-if="deltaPct !== null && deltaPct !== 0" class="hero-delta" :class="{ up: deltaPct > 0 }">
      <span aria-hidden="true">{{ deltaPct > 0 ? '↑' : '↓' }}</span>
      <span class="sr-only">{{ deltaPct > 0 ? 'Up' : 'Down' }}</span>
      {{ Math.abs(deltaPct) }}% vs weekly avg
    </span>
  </div>
</template>

<style scoped>
.hero-tile {
  background: var(--color-ink);
  color: #fff;
  border-radius: var(--radius);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  grid-row: span 2;
}
.hero-label {
  color: rgba(255, 255, 255, 0.55);
}
.hero-value {
  font-size: 44px;
  font-weight: 800;
  line-height: 1.05;
}
.hero-delta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}
.hero-delta.up {
  color: #f0a48f;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
