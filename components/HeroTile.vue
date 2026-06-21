<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatDuration } from '@/lib/time';
import { buildTrend } from '@/lib/trend';
import type { DailyStat } from '@/lib/types';

const props = defineProps<{
  todaySeconds: number;
  weeklyAvgSeconds: number;
  weeklyActiveDays: number;
  todayAudioSeconds: number;
  stats: DailyStat[];
}>();

const { t } = useI18n();

// On a brand-new install (or any day with zero tracked time) the sparkline is a
// dead-flat line and the "0s" reads as broken. Swap in a one-line hint instead.
const hasActivity = computed(() => props.todaySeconds > 0);

// Hide the comparison until there are at least 3 days of history — a 1–2 day
// baseline produces wild, misleading percentages.
const deltaPct = computed(() => {
  if (!props.weeklyAvgSeconds || props.weeklyActiveDays < 3) return null;
  const pct = Math.round(((props.todaySeconds - props.weeklyAvgSeconds) / props.weeklyAvgSeconds) * 100);
  return pct === 0 ? null : pct;
});

const sparkArea = computed(() => {
  const points = buildTrend(props.stats, 'day', Date.now());
  const max = Math.max(1, ...points.map((p) => p.seconds));
  const span = Math.max(1, points.length - 1); // guard against a 1-point trend (0/0 → NaN)
  const coords = points.map(
    (p, i) => `${(i / span) * 100},${28 - (p.seconds / max) * 26}`,
  );
  return { line: coords.join(' '), area: `0,30 ${coords.join(' ')} 100,30` };
});
</script>

<template>
  <div class="tile hero-tile">
    <h2 class="label">{{ t('hero.todayActive') }}</h2>
    <span class="hero-value gradient-text">{{ formatDuration(todaySeconds) }}</span>
    <template v-if="hasActivity">
      <span v-if="deltaPct !== null" class="hero-delta" :class="deltaPct > 0 ? 'up' : 'down'">
        <span aria-hidden="true">{{ deltaPct > 0 ? '↑' : '↓' }}</span>
        <span class="sr-only">{{ deltaPct > 0 ? t('hero.up') : t('hero.down') }}</span>
        {{ t('hero.vsWeeklyAvg', { pct: Math.abs(deltaPct) }) }}
      </span>
      <span v-if="todayAudioSeconds > 0" class="hero-audio">{{ t('hero.backgroundAudio', { time: formatDuration(todayAudioSeconds) }) }}</span>
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" class="spark" aria-hidden="true">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#a78bfa" stop-opacity="0.45" />
            <stop offset="1" stop-color="#60a5fa" stop-opacity="0" />
          </linearGradient>
        </defs>
        <polygon :points="sparkArea.area" fill="url(#sparkFill)" />
        <polyline :points="sparkArea.line" fill="none" stroke="#a78bfa" stroke-width="1.5" vector-effect="non-scaling-stroke" />
      </svg>
    </template>
    <span v-else class="hero-empty">{{ t('hero.empty') }}</span>
  </div>
</template>

<style scoped>
.hero-tile {
  background: var(--card-strong);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  grid-row: span 2;
  overflow: hidden;
}
@media (max-width: 760px) {
  .hero-tile {
    grid-row: auto;
  }
}
.hero-value {
  font-size: 46px;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -1.5px;
}
.hero-delta {
  font-size: 12px;
  font-weight: 600;
}
.hero-delta.up { color: var(--positive); }
.hero-delta.down { color: var(--negative); }
.hero-audio {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 2px;
}
.hero-empty {
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-3);
  margin-top: 6px;
  max-width: 32ch;
}
.spark {
  display: block;
  width: calc(100% + 40px);
  height: 44px;
  margin: 10px -20px -20px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
