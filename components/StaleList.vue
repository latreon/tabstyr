<script setup lang="ts">
import type { TabMeta } from '@/lib/types';

defineProps<{ tabs: TabMeta[] }>();
const emit = defineEmits<{ close: [tabId: number]; snooze: [tabId: number] }>();

function days(ts: number): number {
  return Math.floor((Date.now() - ts) / 86_400_000);
}
</script>

<template>
  <div class="tile stale-tile">
    <span class="label">Stale tabs</span>
    <p v-if="!tabs.length" class="label all-clear">All clear — nothing stale.</p>
    <div v-for="t in tabs" :key="t.tabId" class="row">
      <div class="info">
        <span class="title" :title="t.title">{{ t.title || t.url }}</span>
        <span class="meta">last active {{ days(t.lastActiveAt) }}d ago</span>
      </div>
      <button class="keep" :aria-label="`Keep ${t.title || t.url}`" @click="emit('snooze', t.tabId)">Keep</button>
      <button class="close" :aria-label="`Close ${t.title || t.url}`" @click="emit('close', t.tabId)">Close</button>
    </div>
  </div>
</template>

<style scoped>
.tile {
  background: var(--color-warn-bg);
  border: 1px solid var(--color-warn-border);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.all-clear {
  color: var(--color-muted);
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border-radius: 9px;
  padding: 8px 10px;
}
.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.title {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  font-size: 11px;
  color: var(--color-warn);
}
button {
  border: none;
  border-radius: 7px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.keep {
  background: transparent;
  border: 1px solid var(--color-border);
}
.close {
  background: var(--color-warn);
  color: #fff;
}
</style>
