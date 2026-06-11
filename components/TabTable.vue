<script setup lang="ts">
import { computed, ref } from 'vue';
import { formatDuration } from '@/lib/time';
import type { TabRow } from '@/composables/useStats';

const props = defineProps<{ rows: TabRow[] }>();

type SortKey = 'seconds' | 'lastActiveAt';
const sortKey = ref<SortKey>('seconds');
const sorted = computed(() => [...props.rows].sort((a, b) => b[sortKey.value] - a[sortKey.value]));

function ago(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}
</script>

<template>
  <div class="tile table-tile">
    <span class="label">Open tabs by time</span>
    <table>
      <thead>
        <tr>
          <th scope="col">Tab</th>
          <th
            scope="col"
            class="sortable"
            :class="{ active: sortKey === 'seconds' }"
            :aria-sort="sortKey === 'seconds' ? 'descending' : 'none'"
          >
            <button @click="sortKey = 'seconds'">Time</button>
          </th>
          <th
            scope="col"
            class="sortable"
            :class="{ active: sortKey === 'lastActiveAt' }"
            :aria-sort="sortKey === 'lastActiveAt' ? 'descending' : 'none'"
          >
            <button @click="sortKey = 'lastActiveAt'">Last active</button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in sorted" :key="r.tabId">
          <td class="title" :title="r.title">
            {{ r.title }}
            <span class="domain">{{ r.domain }}</span>
          </td>
          <td>{{ formatDuration(r.seconds) }}</td>
          <td>{{ ago(r.lastActiveAt) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="!rows.length" class="label">No tracked tabs yet.</p>
  </div>
</template>

<style scoped>
.tile {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 16px;
  grid-column: span 2;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-top: 8px;
}
th {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid var(--color-border);
}
th button {
  all: unset;
  cursor: pointer;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-muted);
}
th:first-child {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-muted);
}
th.active button {
  color: var(--color-accent);
}
th button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}
td.title {
  max-width: 0;
  width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.domain {
  color: var(--color-muted);
  font-size: 11px;
  margin-left: 6px;
}
</style>
