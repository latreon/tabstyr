<script setup lang="ts">
import { computed, ref } from 'vue';
import { buildWorkLog, workLogText } from '@/lib/worklog';
import { CATEGORY_META, type Category } from '@/lib/categories';
import { addDays, dateKey, formatDuration, longDateLabel } from '@/lib/time';
import type { DailyStat } from '@/lib/types';
import FaviconChip from '@/components/FaviconChip.vue';

const props = defineProps<{ stats: DailyStat[]; overrides: Record<string, Category>; now: number }>();
const emit = defineEmits<{ select: [domain: string] }>();

const today = dateKey(props.now);
const minDate = addDays(today, -89);

const selected = ref(today);
const copied = ref(false);

const log = computed(() => buildWorkLog(props.stats, selected.value, props.overrides));
const isToday = computed(() => selected.value === today);

const canPrev = computed(() => selected.value > minDate);
const canNext = computed(() => selected.value < today);

function step(days: number) {
  const next = addDays(selected.value, days);
  if (next >= minDate && next <= today) selected.value = next;
}

async function copy() {
  try {
    await navigator.clipboard.writeText(workLogText(log.value));
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch (e) {
    console.error('[worklog] copy failed', e);
  }
}
</script>

<template>
  <div class="tile worklog-tile">
    <div class="wl-head">
      <span class="label">What did I work on?</span>
      <div class="wl-controls">
        <button class="nav" :disabled="!canPrev" aria-label="Previous day" @click="step(-1)">‹</button>
        <input v-model="selected" class="date" type="date" :min="minDate" :max="today" aria-label="Pick a day" />
        <button class="nav" :disabled="!canNext" aria-label="Next day" @click="step(1)">›</button>
        <button class="copy" :disabled="!log.total" @click="copy">{{ copied ? 'Copied ✓' : 'Copy' }}</button>
      </div>
    </div>

    <p class="wl-line">
      <strong>{{ isToday ? 'Today' : longDateLabel(selected) }}</strong>
      <template v-if="log.total">
        — you spent <strong class="accent">{{ formatDuration(log.total) }}</strong>
        across {{ log.domains.length }} {{ log.domains.length === 1 ? 'site' : 'sites' }}.
      </template>
      <template v-else>— nothing tracked.</template>
    </p>

    <ol v-if="log.total" class="sites">
      <li v-for="d in log.domains" :key="d.domain">
        <button class="site" :aria-label="`View ${d.domain} details`" @click="emit('select', d.domain)">
          <FaviconChip :domain="d.domain" />
          <span class="site-name">{{ d.domain }}</span>
          <span class="dot" :style="{ background: CATEGORY_META[d.category].color }" :title="d.category" aria-hidden="true" />
          <span class="site-time">{{ formatDuration(d.seconds) }}</span>
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.worklog-tile {
  padding: 16px;
  grid-column: span 3;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wl-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.label {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-2);
}
.wl-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}
.nav {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text-2);
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
}
.nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.date {
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  font-family: inherit;
  color-scheme: light dark;
}
.copy {
  margin-left: 4px;
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text-2);
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.copy:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--text);
}
.copy:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.nav:focus-visible,
.copy:focus-visible,
.date:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.wl-line {
  margin: 0;
  font-size: 14px;
  color: var(--text-2);
  line-height: 1.5;
}
.wl-line .accent {
  color: var(--text);
}
.sites {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 2px 16px;
}
.site {
  all: unset;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 18px 1fr 10px auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
}
.site:hover {
  background: var(--row-hover);
}
.site:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.site-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.site-time {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-2);
}
</style>
