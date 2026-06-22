<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatDuration } from '@/lib/time';
import { focusTab } from '@/lib/navigate';
import { displayDomain } from '@/lib/domain';
import FaviconChip from '@/components/FaviconChip.vue';
import type { TabRow } from '@/composables/useStats';

const props = defineProps<{ rows: TabRow[] }>();
const { t } = useI18n();

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

// Tab titles are set by the visited page (attacker-controlled). Cap length before
// using them in tooltip/aria attributes so a page can't inject a huge or misleading
// string. (Vue already HTML-escapes attribute values, so this is not an XSS fix.)
const TITLE_MAX = 120;
const clipTitle = (s: string): string => (s.length > TITLE_MAX ? `${s.slice(0, TITLE_MAX)}…` : s);

function ago(ts: number): string {
  if (!ts) return t('tabTable.never'); // tab open but never focused
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 1) return t('tabTable.justNow');
  if (mins < 60) return t('tabTable.minsAgo', { count: mins });
  if (mins < 1440) return t('tabTable.hoursAgo', { count: Math.round(mins / 60) });
  return t('tabTable.daysAgo', { count: Math.round(mins / 1440) });
}
</script>

<template>
  <div class="tile table-tile">
    <div class="tt-head">
      <h2 class="label">{{ t('tabTable.title') }}</h2>
      <span class="tt-sub">{{ t('tabTable.sub') }}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th scope="col" class="plain">{{ t('tabTable.tab') }}</th>
          <th
            scope="col"
            :class="{ active: sortKey === 'seconds' }"
            :aria-sort="sortKey === 'seconds' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'"
          >
            <button @click="setSort('seconds')">
              {{ t('tabTable.tracked') }}
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
              {{ t('tabTable.lastActive') }}
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
          :aria-label="t('tabTable.goToTabAria', { title: clipTitle(r.title) })"
          @click="focusTab(r.tabId)"
          @keydown.enter="focusTab(r.tabId)"
          @keydown.space.prevent="focusTab(r.tabId)"
        >
          <td class="title" :title="clipTitle(r.title)">
            <FaviconChip :domain="r.domain" />
            <span class="title-text">{{ displayDomain(r.domain) }}</span>
            <span v-if="r.tabCount > 1" class="tab-count">{{ t('tabTable.tabCount', { count: r.tabCount }) }}</span>
          </td>
          <td>{{ formatDuration(r.seconds) }}</td>
          <td>{{ ago(r.lastActiveAt) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="!rows.length" class="label">{{ t('tabTable.noTabs') }}</p>
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
  font-size: 12px;
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
.tab-count {
  color: var(--text-3);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  margin-left: 8px;
}
</style>
