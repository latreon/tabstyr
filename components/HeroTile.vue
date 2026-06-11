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
    <span v-if="deltaPct !== null" class="hero-delta" :class="{ up: deltaPct > 0 }">
      {{ deltaPct > 0 ? '↑' : '↓' }} {{ Math.abs(deltaPct) }}% vs weekly avg
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
</style>
