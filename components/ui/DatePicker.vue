<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { longDateLabel } from '@/lib/time';

const props = defineProps<{ modelValue: string; min: string; max: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const open = ref(false);
const root = ref<HTMLElement | null>(null);

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

// Month currently shown in the grid (independent of the selected day).
const view = ref({ y: 2000, m: 0 });
function syncView() {
  const [y, m] = props.modelValue.split('-').map(Number);
  view.value = { y, m: m - 1 };
}
syncView();
watch(() => props.modelValue, syncView);

const monthTitle = computed(() =>
  new Date(view.value.y, view.value.m, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
);

const cells = computed(() => {
  const { y, m } = view.value;
  const startDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const out: Array<{ key: string; day: number; disabled: boolean } | null> = [];
  for (let i = 0; i < startDay; i++) out.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = keyOf(y, m, d);
    out.push({ key, day: d, disabled: key < props.min || key > props.max });
  }
  return out;
});

const canPrev = computed(() => keyOf(view.value.y, view.value.m, 1) > props.min);
const canNext = computed(() => {
  const last = new Date(view.value.y, view.value.m + 1, 0);
  return keyOf(last.getFullYear(), last.getMonth(), last.getDate()) < props.max;
});

function stepMonth(delta: number) {
  const d = new Date(view.value.y, view.value.m + delta, 1);
  view.value = { y: d.getFullYear(), m: d.getMonth() };
}
function choose(key: string) {
  emit('update:modelValue', key);
  open.value = false;
}
function toggle() {
  open.value = !open.value;
  if (open.value) syncView();
}
function onClickOutside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false;
}

onMounted(() => {
  document.addEventListener('click', onClickOutside);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside);
  document.removeEventListener('keydown', onKey);
});
</script>

<template>
  <div ref="root" class="datepicker">
    <button
      type="button"
      class="trigger"
      :aria-expanded="open"
      aria-haspopup="dialog"
      aria-label="Pick a day"
      @click="toggle"
    >
      <svg class="cal-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v4M16 3v4" />
      </svg>
      <span>{{ longDateLabel(modelValue) }}</span>
    </button>

    <div v-if="open" class="cal" role="dialog" aria-label="Choose a date">
      <div class="cal-head">
        <button type="button" class="mnav" :disabled="!canPrev" aria-label="Previous month" @click="stepMonth(-1)">‹</button>
        <span class="cal-title">{{ monthTitle }}</span>
        <button type="button" class="mnav" :disabled="!canNext" aria-label="Next month" @click="stepMonth(1)">›</button>
      </div>
      <div class="weekdays" aria-hidden="true">
        <span v-for="(w, i) in WEEKDAYS" :key="i">{{ w }}</span>
      </div>
      <div class="grid">
        <template v-for="(c, i) in cells" :key="i">
          <span v-if="!c" class="empty" />
          <button
            v-else
            type="button"
            class="day"
            :class="{ selected: c.key === modelValue }"
            :disabled="c.disabled"
            :aria-current="c.key === modelValue ? 'date' : undefined"
            @click="choose(c.key)"
          >{{ c.day }}</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.datepicker {
  position: relative;
}
.trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.trigger:hover { border-color: var(--accent); }
.trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cal-icon {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: var(--text-2);
  stroke-width: 1.8;
  stroke-linecap: round;
}
.cal {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  width: 248px;
  padding: 12px;
  background: var(--popover);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.18);
}
.cal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.cal-title {
  font-size: 13px;
  font-weight: 700;
}
.mnav {
  width: 26px;
  height: 26px;
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text-2);
  border-radius: 7px;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
}
.mnav:disabled { opacity: 0.35; cursor: not-allowed; }
.mnav:not(:disabled):hover { border-color: var(--accent); color: var(--text); }
.weekdays,
.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.weekdays {
  margin-bottom: 4px;
}
.weekdays span {
  text-align: center;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-3);
}
.day {
  aspect-ratio: 1;
  border: none;
  background: transparent;
  color: var(--text);
  border-radius: 7px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}
.day:not(:disabled):hover { background: var(--row-hover); }
.day:disabled { opacity: 0.3; cursor: not-allowed; }
.day.selected {
  background: var(--accent-gradient);
  color: var(--on-accent);
  font-weight: 700;
}
.day:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.empty { aspect-ratio: 1; }
</style>
