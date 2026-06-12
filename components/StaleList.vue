<script setup lang="ts">
import { domainOf } from '@/lib/domain';
import { focusTab } from '@/lib/navigate';
import FaviconChip from '@/components/FaviconChip.vue';
import type { TabMeta } from '@/lib/types';

defineProps<{ tabs: TabMeta[] }>();
const emit = defineEmits<{ close: [tabId: number]; snooze: [tabId: number] }>();

function days(ts: number): number {
  return Math.floor((Date.now() - ts) / 86_400_000);
}
</script>

<template>
  <div id="stale-section" class="tile stale-tile">
    <span class="label">Stale tabs</span>
    <p v-if="!tabs.length" class="label all-clear">All clear — nothing stale.</p>
    <div v-for="t in tabs" :key="t.tabId" class="row">
      <FaviconChip :domain="domainOf(t.url)" />
      <button class="info" :aria-label="`Go to tab: ${t.title || t.url}`" @click="focusTab(t.tabId)">
        <span class="title" :title="t.title">{{ t.title || t.url }}</span>
        <span class="meta">last active {{ days(t.lastActiveAt) }}d ago</span>
      </button>
      <button class="keep" :aria-label="`Keep ${t.title || t.url}`" @click="emit('snooze', t.tabId)">Keep</button>
      <button class="close" :aria-label="`Close ${t.title || t.url}`" @click="emit('close', t.tabId)">Close</button>
    </div>
  </div>
</template>

<style scoped>
.stale-tile {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.all-clear {
  color: var(--text-3);
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--card-strong);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  transition: transform 120ms ease;
}
.row:hover {
  transform: translateY(-1px);
}
.info {
  all: unset;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}
.info:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.title {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}
.meta {
  font-size: 11px;
  color: var(--warn);
}
.keep,
.close {
  border: none;
  border-radius: 7px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.keep {
  background: transparent;
  color: var(--text-2);
  border: 1px solid var(--border);
}
.close {
  background: var(--warn);
  color: #fff;
}
.keep:focus-visible,
.close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
