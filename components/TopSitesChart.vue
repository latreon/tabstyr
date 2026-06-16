<script setup lang="ts">
import { computed } from 'vue';
import { formatDuration } from '@/lib/time';
import { displayDomain } from '@/lib/domain';
import FaviconChip from '@/components/FaviconChip.vue';

const props = defineProps<{ domains: Array<{ domain: string; seconds: number; audioSeconds: number }> }>();
const emit = defineEmits<{ select: [domain: string] }>();

const top = computed(() => props.domains.slice(0, 6));
// Scale to active + audio so the two stacked segments fit the track.
const max = computed(() => Math.max(1, ...top.value.map((d) => d.seconds + d.audioSeconds)));
</script>

<template>
  <div class="tile top-sites">
    <span class="label">Top sites today</span>
    <p v-if="!top.length" class="label">Nothing yet.</p>
    <button
      v-for="d in top"
      :key="d.domain"
      class="row"
      :aria-label="`View ${d.domain} details — ${formatDuration(d.seconds)} active today`"
      @click="emit('select', d.domain)"
    >
      <FaviconChip :domain="d.domain" />
      <span class="name" :title="displayDomain(d.domain)">{{ displayDomain(d.domain) }}</span>
      <svg :viewBox="`0 0 100 8`" preserveAspectRatio="none" class="bar" aria-hidden="true">
        <defs>
          <linearGradient id="siteBar" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#a78bfa" />
            <stop offset="1" stop-color="#60a5fa" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="8" rx="2" fill="var(--bar-track)" />
        <rect x="0" y="0" :width="(d.seconds / max) * 100" height="8" rx="2" fill="url(#siteBar)" />
        <rect
          v-if="d.audioSeconds"
          :x="(d.seconds / max) * 100"
          y="0"
          :width="(d.audioSeconds / max) * 100"
          height="8" rx="2"
          fill="#f0c6ff" opacity="0.75"
        />
      </svg>
      <span class="time">
        {{ formatDuration(d.seconds) }}
        <em v-if="d.audioSeconds" class="audio">♪ {{ formatDuration(d.audioSeconds) }}</em>
      </span>
    </button>
  </div>
</template>

<style scoped>
.top-sites {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  grid-column: span 2;
}
.row {
  all: unset;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 18px 180px 1fr 70px;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  padding: 5px 6px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.row:hover { background: var(--row-hover); }
.row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-2);
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
  color: var(--text-3);
  font-style: normal;
  font-weight: 400;
}
</style>
