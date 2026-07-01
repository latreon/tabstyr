<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { buildWrapped } from '@/lib/wrapped';
import { PERSONA_META, CHRONOTYPE_EMOJI } from '@/lib/wrapped-persona';
import { PERSONA_ICON, ICONS } from '@/lib/wrapped-icons';
import { renderWrappedCard, canvasToImageBlob, type WrappedCardContent } from '@/lib/wrapped-card';
import { downloadBlob } from '@/lib/export';
import { CATEGORY_META, type Category, type CategoryRule, type Productivity } from '@/lib/categories';
import { formatDuration, longDateLabel, dayLabel } from '@/lib/time';
import { displayDomain } from '@/lib/domain';
import { getDateLocale } from '@/lib/locale';
import type { DailyStat, Session } from '@/lib/types';
import { useFocusTrap } from '@/composables/useFocusTrap';

const props = defineProps<{
  dailyStats: DailyStat[];
  sessions: Session[];
  overrides: Record<string, Category>;
  rules?: CategoryRule[];
  productivity?: Record<Category, Productivity>;
}>();
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();

const panel = ref<HTMLElement | null>(null);
const closeBtn = ref<HTMLButtonElement | null>(null);
useFocusTrap(panel);

const data = computed(() =>
  buildWrapped({
    dailyStats: props.dailyStats,
    sessions: props.sessions,
    overrides: props.overrides,
    rules: props.rules ?? [],
    productivity: props.productivity,
  }),
);

const persona = computed(() => (data.value ? PERSONA_META[data.value.persona.id] : null));
const personaIcon = computed(() => (data.value ? ICONS[PERSONA_ICON[data.value.persona.id]] : null));
const personaTitle = computed(() => (data.value ? t(`wrapped.persona.${data.value.persona.id}.title`) : ''));

const periodLabel = computed(() => {
  const d = data.value;
  if (!d) return '';
  const range = d.startDate === d.endDate ? longDateLabel(d.startDate) : `${dayLabel(d.startDate)} – ${dayLabel(d.endDate)}`;
  return `${range} · ${t('wrapped.daysCovered', { count: d.daysCovered }, d.daysCovered)}`;
});

const peakLabel = computed(() => {
  const peak = data.value?.peak;
  if (!peak) return '';
  const ref = new Date(2024, 0, 7 + peak.day, peak.hour); // 2024-01-07 is a Sunday
  return ref.toLocaleString(getDateLocale(), { weekday: 'long', hour: 'numeric' });
});

// Header gradient from the persona accent — colored panel with white text, so it
// reads the same in light and dark.
const headerStyle = computed(() =>
  persona.value ? { background: `linear-gradient(135deg, ${persona.value.accentA}, ${persona.value.accentB})` } : {},
);

// Stat rows for the in-app story.
const stats = computed(() => {
  const d = data.value;
  if (!d) return [];
  const rows: Array<{ label: string; value: string; sub?: string }> = [];
  if (d.topSite) rows.push({ label: t('wrapped.card.topSite'), value: displayDomain(d.topSite.domain), sub: formatDuration(d.topSite.seconds) });
  if (d.topCategory) rows.push({ label: t('wrapped.card.topCategory'), value: t(`categories.${d.topCategory.category}`), sub: `${d.topCategory.pct}%` });
  rows.push({ label: t('wrapped.card.focus'), value: `${d.focusPct}%` });
  if (peakLabel.value) rows.push({ label: t('wrapped.card.peak'), value: peakLabel.value, sub: `${CHRONOTYPE_EMOJI[d.chronotype]} ${t(`wrapped.chrono.${d.chronotype}`)}` });
  if (d.longestStreak > 0) rows.push({ label: t('wrapped.modal.streakStat'), value: t('wrapped.daysCovered', { count: d.longestStreak }, d.longestStreak) });
  if (d.busiestDate) rows.push({ label: t('wrapped.modal.busiestStat'), value: longDateLabel(d.busiestDate), sub: formatDuration(d.busiestDateSeconds) });
  if (d.longestVisitSeconds > 0) rows.push({ label: t('wrapped.modal.longestStat'), value: formatDuration(d.longestVisitSeconds) });
  rows.push({ label: t('wrapped.modal.sitesStat'), value: String(d.distinctDomains) });
  return rows;
});

const downloading = ref(false);
async function downloadCard() {
  const d = data.value;
  if (!d || !persona.value || !personaIcon.value || downloading.value) return;
  downloading.value = true;
  try {
    const rows: WrappedCardContent['rows'] = [];
    if (d.topSite) rows.push({ label: t('wrapped.card.topSite'), value: `${displayDomain(d.topSite.domain)} · ${formatDuration(d.topSite.seconds)}`, chip: { initial: displayDomain(d.topSite.domain).charAt(0).toUpperCase() || '?', color: CATEGORY_META[d.topSite.category].color } });
    if (d.topCategory) rows.push({ label: t('wrapped.card.topCategory'), value: `${t(`categories.${d.topCategory.category}`)} · ${d.topCategory.pct}%` });
    rows.push({ label: t('wrapped.card.focus'), value: `${d.focusPct}%` });
    rows.push({ label: peakLabel.value ? t('wrapped.card.peak') : t('wrapped.card.days'), value: peakLabel.value || String(d.daysCovered) });
    const content: WrappedCardContent = {
      heading: t('wrapped.card.heading'),
      periodLabel: periodLabel.value,
      personaIconPaths: personaIcon.value.paths,
      personaIconFilled: personaIcon.value.filled,
      personaTitle: personaTitle.value,
      bigValue: formatDuration(d.totalSeconds),
      bigCaption: t('wrapped.card.totalCaption'),
      rows,
      footer: t('wrapped.card.footer'),
      accentA: persona.value.accentA,
      accentB: persona.value.accentB,
      theme: 'dark',
    };
    const canvas = document.createElement('canvas');
    renderWrappedCard(canvas, content, 2);
    const blob = await canvasToImageBlob(canvas);
    if (blob) downloadBlob(`tabstyr-wrapped-${d.endDate}.jpg`, blob);
  } catch (e) {
    console.error('[wrapped] card export failed', e);
  } finally {
    downloading.value = false;
  }
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
      <div ref="panel" class="wrapped-panel" role="dialog" aria-modal="true" :aria-label="t('wrapped.title')">
        <button ref="closeBtn" class="close" :aria-label="t('domainDetail.close')" @click="emit('close')">✕</button>

        <template v-if="data">
          <header class="wr-head" :style="headerStyle">
            <span class="wr-glyph" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path v-for="(p, i) in personaIcon?.paths" :key="i" :d="p" :fill="personaIcon?.filled ? 'currentColor' : 'none'" /></svg>
            </span>
            <p class="wr-eyebrow">{{ t('wrapped.card.heading') }}</p>
            <h2 class="wr-persona">{{ personaTitle }}</h2>
            <p class="wr-period">{{ periodLabel }}</p>
            <div class="wr-total">
              <span class="wr-total-val">{{ formatDuration(data.totalSeconds) }}</span>
              <span class="wr-total-cap">{{ t('wrapped.card.totalCaption') }}</span>
            </div>
          </header>

          <ul class="wr-stats">
            <li v-for="(s, i) in stats" :key="i">
              <span class="wr-stat-label">{{ s.label }}</span>
              <span class="wr-stat-value">{{ s.value }}<em v-if="s.sub"> · {{ s.sub }}</em></span>
            </li>
          </ul>

          <button class="wr-download" :disabled="downloading" @click="downloadCard">
            {{ downloading ? t('wrapped.modal.downloading') : t('wrapped.modal.download') }}
          </button>
        </template>

        <p v-else class="wr-empty">{{ t('wrapped.modal.empty') }}</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4vh var(--sp-4);
  background: var(--backdrop);
  backdrop-filter: blur(3px);
  overflow-y: auto;
}
.wrapped-panel {
  position: relative;
  width: min(440px, 100%);
  max-height: 92vh;
  overflow-y: auto;
  background: var(--popover);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-modal);
  margin: auto;
}
.close {
  position: absolute;
  top: var(--sp-3);
  right: var(--sp-3);
  z-index: 1;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--text-sm);
}
.close:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.wr-head {
  padding: var(--sp-6) var(--sp-5) var(--sp-5);
  color: #fff;
  text-align: center;
  border-radius: var(--radius) var(--radius) 0 0;
}
.wr-glyph {
  display: inline-grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.18);
  margin-bottom: var(--sp-3);
}
.wr-glyph svg { width: 34px; height: 34px; stroke: #fff; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.wr-eyebrow { margin: 0; font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.85; }
.wr-persona { margin: var(--sp-1) 0 var(--sp-1); font-size: var(--text-2xl); font-weight: 800; letter-spacing: -0.5px; }
.wr-period { margin: 0; font-size: var(--text-sm); opacity: 0.85; }
.wr-total { margin-top: var(--sp-4); display: flex; flex-direction: column; gap: 2px; }
.wr-total-val { font-size: var(--text-hero); font-weight: 900; line-height: 1; letter-spacing: -2px; }
.wr-total-cap { font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.85; }
.wr-stats { list-style: none; margin: 0; padding: var(--sp-4) var(--sp-5); display: flex; flex-direction: column; gap: 0; }
.wr-stats li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3) 0;
  border-bottom: 1px solid var(--divider);
}
.wr-stats li:last-child { border-bottom: none; }
.wr-stat-label { font-size: var(--text-sm); color: var(--text-3); }
.wr-stat-value { font-size: var(--text-sm); font-weight: 700; color: var(--text); text-align: right; min-width: 0; }
.wr-stat-value em { font-style: normal; font-weight: 600; color: var(--text-2); }
.wr-download {
  display: block;
  width: calc(100% - var(--sp-5) * 2);
  margin: 0 var(--sp-5) var(--sp-5);
  padding: var(--sp-3);
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent-grad-strong);
  color: var(--on-accent);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.wr-download:hover:not(:disabled) { filter: brightness(1.08); }
.wr-download:disabled { opacity: 0.6; cursor: not-allowed; }
.wr-download:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.wr-empty { margin: 0; padding: var(--sp-6); text-align: center; color: var(--text-3); font-size: var(--text-sm); }
</style>
