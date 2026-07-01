<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatDuration } from '@/lib/time';
import type { ProductivitySummary } from '@/lib/productivity';

const props = defineProps<{ summary: ProductivitySummary }>();
const { t } = useI18n();

const hasData = computed(() => props.summary.productiveSeconds + props.summary.distractingSeconds > 0);

// ── Focus ring geometry ──────────────────────────────────────────────────────
const R = 42;
const C = 2 * Math.PI * R;
const pct = computed(() => Math.max(0, Math.min(100, props.summary.todayFocusPct)));
const good = computed(() => props.summary.todayFocusPct >= props.summary.focusTarget);
// The daily goal shown as a tick on the ring — degrees clockwise from the top.
const targetDeg = computed(() => 360 * (props.summary.focusTarget / 100));

// Sweep the arc in from empty on mount (and on data change). CSS transition on the
// circle animates it; the reduced-motion media query below disables the transition
// so it snaps for those users.
const dashOffset = ref(C);
function sweep() {
  dashOffset.value = C; // reset to empty…
  requestAnimationFrame(() => requestAnimationFrame(() => {
    dashOffset.value = C * (1 - pct.value / 100); // …then fill to value
  }));
}
onMounted(sweep);
watch(pct, sweep);
</script>

<template>
  <div class="tile prod-tile">
    <h2 class="label">{{ t('focus.title') }}</h2>

    <template v-if="hasData">
      <div class="figure">
        <div class="ring" role="img" :aria-label="t('focus.ariaFocus', { pct: summary.todayFocusPct })">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle class="track" cx="50" cy="50" :r="R" />
            <circle
              class="prog"
              :class="{ good }"
              cx="50"
              cy="50"
              :r="R"
              :stroke-dasharray="C"
              :stroke-dashoffset="dashOffset"
            />
            <g :transform="`rotate(${targetDeg} 50 50)`">
              <line class="target-tick" x1="50" y1="2.5" x2="50" y2="13" />
            </g>
          </svg>
          <div class="ring-center">
            <span class="pct" :class="{ good }">{{ summary.todayFocusPct }}<em>%</em></span>
            <span v-if="summary.streakDays > 0" class="streak" :title="t('focus.streakTitle', { count: summary.streakDays, target: summary.focusTarget })">
              {{ t('focus.streak', { count: summary.streakDays }) }}
            </span>
          </div>
        </div>

        <div class="legend">
          <span class="pl"><span class="sw prod" /> {{ t('focus.productive') }}<b>{{ formatDuration(summary.productiveSeconds) }}</b></span>
          <span class="pl"><span class="sw dist" /> {{ t('focus.distracting') }}<b>{{ formatDuration(summary.distractingSeconds) }}</b></span>
          <span class="pl target" :title="t('focus.note', { target: summary.focusTarget })"><span class="sw tick" /> {{ summary.focusTarget }}%</span>
        </div>
      </div>
    </template>

    <p v-else class="prod-empty">{{ t('focus.empty') }}</p>
  </div>
</template>

<style scoped>
.prod-tile {
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.label {
  font-size: var(--text-sm);
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-2);
}
.figure {
  display: flex;
  align-items: center;
  gap: var(--sp-4) var(--sp-5);
  flex-wrap: wrap; /* legend drops below the ring on a narrow tile / long locale */
}
.ring {
  position: relative;
  flex: none;
  width: 128px;
  height: 128px;
}
.ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg); /* start the arc at 12 o'clock, sweep clockwise */
}
.track {
  fill: none;
  stroke: var(--bar-track);
  stroke-width: 9;
}
.prog {
  fill: none;
  stroke: var(--accent);
  stroke-width: 9;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1), stroke 300ms ease;
}
.prog.good {
  stroke: var(--positive);
}
.target-tick {
  stroke: var(--text-2);
  stroke-width: 3;
  stroke-linecap: round;
  opacity: 0.7;
}
.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
}
.pct {
  font-size: var(--text-2xl);
  font-weight: 800;
  letter-spacing: -1.5px;
  color: var(--text);
  line-height: 1;
}
.pct.good { color: var(--positive); }
.pct em {
  font-size: 16px;
  font-weight: 700;
  font-style: normal;
  margin-left: 1px;
}
.streak {
  font-size: 11px;
  font-weight: 700;
  color: var(--warn);
  white-space: nowrap;
}
.legend {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  font-size: var(--text-sm);
  color: var(--text-2);
  min-width: 0;
  flex: 1 1 auto;
}
.pl {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
  flex-wrap: wrap;
}
.pl b { color: var(--text); font-weight: 700; font-variant-numeric: tabular-nums; }
.pl.target { color: var(--text-3); font-size: var(--text-xs); }
.sw {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex: none;
}
.sw.prod { background: var(--positive); }
.sw.dist { background: var(--negative); }
.sw.tick { width: 3px; height: 12px; border-radius: 2px; background: var(--text-2); opacity: 0.7; }
.prod-empty {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.45;
  color: var(--text-3);
}
@media (prefers-reduced-motion: reduce) {
  .prog { transition: stroke 300ms ease; }
}
</style>
