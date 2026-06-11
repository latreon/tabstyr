<script setup lang="ts">
import { computed } from 'vue';
import { formatDuration } from '@/lib/time';

const props = defineProps<{ domains: Array<{ domain: string; seconds: number; audioSeconds: number }> }>();

const top = computed(() => props.domains.slice(0, 6));
const max = computed(() => Math.max(1, ...top.value.map((d) => d.seconds)));
</script>

<template>
  <div class="tile top-sites">
    <span class="label">Top sites today</span>
    <p v-if="!top.length" class="label">Nothing yet.</p>
    <div v-for="d in top" :key="d.domain" class="row">
      <span class="name" :title="d.domain">{{ d.domain }}</span>
      <svg :viewBox="`0 0 100 8`" preserveAspectRatio="none" class="bar" aria-hidden="true">
        <rect x="0" y="0" :width="(d.seconds / max) * 100" height="8" rx="2" fill="var(--color-accent)" />
        <rect
          v-if="d.audioSeconds"
          x="0" y="0"
          :width="(d.audioSeconds / max) * 100"
          height="8" rx="2"
          fill="#f0a48f"
        />
      </svg>
      <span class="time">
        {{ formatDuration(d.seconds) }}
        <em v-if="d.audioSeconds" class="audio">({{ formatDuration(d.audioSeconds) }} audio)</em>
      </span>
    </div>
  </div>
</template>

<style scoped>
.tile {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  grid-column: span 2;
}
.row {
  display: grid;
  grid-template-columns: 140px 1fr 120px;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar {
  width: 100%;
  height: 8px;
}
.time {
  text-align: right;
  font-weight: 600;
  font-size: 12px;
}
.audio {
  color: var(--color-muted);
  font-style: normal;
  font-weight: 400;
}
</style>
