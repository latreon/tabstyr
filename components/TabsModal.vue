<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { displayDomain } from '@/lib/domain';
import type { TabListItem } from '@/composables/useStats';
import FaviconChip from '@/components/FaviconChip.vue';
import { useFocusTrap } from '@/composables/useFocusTrap';

const props = defineProps<{
  mode: 'open' | 'stale';
  items: TabListItem[];
  staleDays: number;
  now: number;
}>();
const emit = defineEmits<{
  close: [];
  goto: [tabId: number];
  closeTab: [item: TabListItem];
  closeAll: [items: TabListItem[]];
}>();

const { t } = useI18n();
const panel = ref<HTMLElement | null>(null);
const closeBtn = ref<HTMLButtonElement | null>(null);
useFocusTrap(panel);

const isStale = computed(() => props.mode === 'stale');
const title = computed(() => (isStale.value ? t('tabs.staleTitle') : t('tabs.openTitle')));
const countLabel = computed(() =>
  isStale.value ? t('tabs.countStale', { count: props.items.length }) : t('tabs.count', { count: props.items.length }),
);
// Always list alphabetically by title (case-insensitive) regardless of mode.
const sortedItems = computed(() =>
  [...props.items].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })),
);
const desc = computed(() =>
  isStale.value ? t('tabs.staleDesc', { days: props.staleDays }) : t('tabs.openDesc'),
);

function lastActiveLabel(ts: number): string {
  if (!ts) return t('tabs.neverActive');
  const mins = Math.floor((props.now - ts) / 60_000);
  if (mins < 1) return t('tabs.justNow');
  if (mins < 60) return t('tabs.minutesAgo', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('tabs.hoursAgo', { count: hrs });
  return t('tabs.daysAgo', { count: Math.floor(hrs / 24) });
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}
onMounted(() => {
  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
  closeBtn.value?.focus();
});
onUnmounted(() => {
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @click.self="emit('close')">
      <div ref="panel" class="panel tile" role="dialog" aria-modal="true" :aria-label="title">
        <header class="head">
          <div class="head-text">
            <h2 class="title">
              {{ title }}
              <span class="count" :class="{ warn: isStale }">({{ countLabel }})</span>
            </h2>
            <p class="desc">{{ desc }}</p>
          </div>
          <button ref="closeBtn" class="close" :aria-label="t('tabs.closeDialog')" @click="emit('close')">✕</button>
        </header>

        <button
          v-if="items.length > 1"
          type="button"
          class="close-all"
          :class="{ warn: isStale }"
          @click="emit('closeAll', items)"
        >
          {{ isStale ? t('tabs.closeAllStale') : t('tabs.closeAll') }}
        </button>

        <ul v-if="items.length" class="list">
          <li v-for="item in sortedItems" :key="item.tabId" class="row">
            <FaviconChip :domain="item.domain" />
            <button
              type="button"
              class="row-main"
              :title="item.title"
              @click="emit('goto', item.tabId)"
            >
              <span class="row-title">{{ item.title }}</span>
              <span class="row-domain">{{ displayDomain(item.domain) }}</span>
            </button>
            <span class="row-time">{{ lastActiveLabel(item.lastActiveAt) }}</span>
            <button
              type="button"
              class="row-close"
              :aria-label="t('tabs.close')"
              :title="t('tabs.close')"
              @click="emit('closeTab', item)"
            >✕</button>
          </li>
        </ul>

        <p v-else class="empty">{{ isStale ? t('tabs.emptyStale') : t('tabs.empty') }}</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center; /* vertically centred; tall panels still scroll via the list */
  justify-content: center;
  padding: var(--sp-4);
  background: var(--backdrop);
  backdrop-filter: blur(3px);
  overflow-y: auto;
}
.panel {
  width: min(620px, 100%);
  background: var(--popover);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.head-text { flex: 1; min-width: 0; }
.title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.3px;
}
.desc {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--text-3);
}
.count {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-3);
  white-space: nowrap;
}
.count.warn { color: var(--warn); }
.close {
  flex: none;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-2);
  border-radius: var(--radius-sm);
  width: 30px;
  height: 30px;
  cursor: pointer;
  font-size: var(--text-sm);
}
.close:focus-visible,
.close-all:focus-visible,
.row-main:focus-visible,
.row-close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.close-all {
  align-self: flex-start;
  padding: 7px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease;
}
.close-all:hover { border-color: var(--accent); }
.close-all.warn { color: var(--warn); border-color: var(--warn-border); background: var(--warn-bg); }
.close-all.warn:hover { border-color: var(--warn); }
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 56vh;
  overflow-y: auto;
  /* Thin, subtle scrollbar that fades into the panel. */
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
  padding-right: 2px;
}
.list::-webkit-scrollbar {
  width: 6px;
}
.list::-webkit-scrollbar-track {
  background: transparent;
}
.list::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: var(--radius-pill);
}
.list::-webkit-scrollbar-thumb:hover {
  background: var(--text-3);
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--sp-2) var(--sp-2) var(--sp-2) 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  /* --surface sits a step away from the panel (--popover) in both themes, so the
     rows read as distinct cards — important in light mode where cards are white. */
  background: var(--surface);
}
.row:hover {
  border-color: var(--text-3);
  background: var(--row-hover);
}
.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
  border-radius: 6px;
}
.row-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-domain {
  font-size: var(--text-xs);
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-time {
  flex: none;
  white-space: nowrap;
  font-size: var(--text-xs);
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}
.row-close {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  font-size: 12px;
  transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
}
.row-close:hover {
  border-color: var(--warn);
  color: var(--warn);
  background: var(--warn-bg, transparent);
}
.empty {
  margin: var(--sp-2) 0;
  padding: var(--sp-5);
  text-align: center;
  font-size: var(--text-sm);
  color: var(--text-3);
}
@media (prefers-reduced-motion: reduce) {
  .close-all, .row-close { transition: none; }
}
</style>
