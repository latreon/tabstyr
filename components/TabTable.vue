<script setup lang="ts">
import { computed, ref } from 'vue';
import { formatDuration } from '@/lib/time';
import { focusTab } from '@/lib/navigate';
import FaviconChip from '@/components/FaviconChip.vue';
import type { TabRow } from '@/composables/useStats';

const props = defineProps<{ rows: TabRow[] }>();

type SortKey = 'seconds' | 'lastActiveAt';
type SortDir = 'asc' | 'desc';
const sortKey = ref<SortKey>('seconds');
const sortDir = ref<SortDir>('desc');
const sorted = computed(() => {
  const sign = sortDir.value === 'desc' ? 1 : -1;
  return [...props.rows].sort((a, b) => sign * (b[sortKey.value] - a[sortKey.value]));
});

function setSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc';
  } else {
    sortKey.value = key;
    sortDir.value = 'desc';
  }
}

function ago(ts: number): string {
  if (!ts) return '—'; // tab open but never focused
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}
</script>

<template>
  <div class="tile table-tile">
    <div class="tt-head">
      <span class="label">Open tabs by time</span>
      <span class="tt-sub">Total tracked per tab · last 90 days</span>
    </div>
    <table>
      <thead>
        <tr>
          <th scope="col" class="plain">Tab</th>
          <th
            scope="col"
            :class="{ active: sortKey === 'seconds' }"
            :aria-sort="sortKey === 'seconds' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'"
          >
            <button @click="setSort('seconds')">
              Tracked
              <svg class="caret" viewBox="0 0 12 14" aria-hidden="true">
                <path class="up" :class="{ on: sortKey === 'seconds' && sortDir === 'asc' }" d="M6 1.5 9.5 6 2.5 6 Z" />
                <path class="down" :class="{ on: sortKey === 'seconds' && sortDir === 'desc' }" d="M2.5 8 9.5 8 6 12.5 Z" />
              </svg>
            </button>
          </th>
          <th
            scope="col"
            :class="{ active: sortKey === 'lastActiveAt' }"
            :aria-sort="sortKey === 'lastActiveAt' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'"
          >
            <button @click="setSort('lastActiveAt')">
              Last active
              <svg class="caret" viewBox="0 0 12 14" aria-hidden="true">
                <path class="up" :class="{ on: sortKey === 'lastActiveAt' && sortDir === 'asc' }" d="M6 1.5 9.5 6 2.5 6 Z" />
                <path class="down" :class="{ on: sortKey === 'lastActiveAt' && sortDir === 'desc' }" d="M2.5 8 9.5 8 6 12.5 Z" />
              </svg>
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in sorted"
          :key="r.tabId"
          class="tab-row"
          tabindex="0"
          :aria-label="`Go to tab: ${r.title}`"
          @click="focusTab(r.tabId)"
          @keydown.enter="focusTab(r.tabId)"
          @keydown.space.prevent="focusTab(r.tabId)"
        >
          <td class="title" :title="r.title">
            <FaviconChip :domain="r.domain" />
            <span class="title-text">{{ r.title }}</span>
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
.table-tile {
  padding: 16px;
  grid-column: span 2;
}
.tt-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tt-head .label {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-2);
}
.tt-sub {
  font-size: 11px;
  color: var(--text-3);
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
  border-bottom: 1px solid var(--border);
}
th button {
  all: unset;
  cursor: pointer;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-3);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
th button:hover {
  color: var(--text-2);
}
.caret {
  width: 11px;
  height: 13px;
  flex: none;
}
.caret path {
  fill: var(--text-3);
  opacity: 0.4;
  transition: fill 120ms ease, opacity 120ms ease;
}
.caret path.on {
  fill: var(--accent-a);
  opacity: 1;
}
th.plain {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-3);
  font-weight: 600;
}
th.active button {
  color: var(--accent-a);
}
th button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
td {
  padding: 8px;
  border-bottom: 1px solid var(--divider);
  white-space: nowrap;
}
.tab-row {
  cursor: pointer;
}
.tab-row:hover td {
  background: var(--row-hover);
}
.tab-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
td.title {
  max-width: 0;
  width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
}
td.title .favicon {
  vertical-align: -4px;
  margin-right: 8px;
}
.title-text {
  color: var(--text);
}
.domain {
  color: var(--text-3);
  font-size: 11px;
  margin-left: 6px;
}
</style>
