<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { buildWrapped } from '@/lib/wrapped';
import { PERSONA_META } from '@/lib/wrapped-persona';
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
const canvas = ref<HTMLCanvasElement | null>(null);
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

const peakLabel = computed(() => {
  const peak = data.value?.peak;
  if (!peak) return '';
  const ref = new Date(2024, 0, 7 + peak.day, peak.hour); // 2024-01-07 is a Sunday
  return ref.toLocaleString(getDateLocale(), { weekday: 'long', hour: 'numeric' });
});

// The single source of truth for BOTH the on-screen preview and the downloaded
// file — the modal shows exactly what a share gets.
const content = computed<WrappedCardContent | null>(() => {
  const d = data.value;
  if (!d) return null;
  const persona = PERSONA_META[d.persona.id];
  const icon = ICONS[PERSONA_ICON[d.persona.id]];
  const range = d.startDate === d.endDate ? longDateLabel(d.startDate) : `${dayLabel(d.startDate)} – ${dayLabel(d.endDate)}`;
  const rows: WrappedCardContent['rows'] = [];
  if (d.topSite)
    rows.push({
      label: t('wrapped.card.topSite'),
      value: `${displayDomain(d.topSite.domain)} · ${formatDuration(d.topSite.seconds)}`,
      chip: { initial: displayDomain(d.topSite.domain).charAt(0).toUpperCase() || '?', color: CATEGORY_META[d.topSite.category].color },
    });
  if (d.topCategory) rows.push({ label: t('wrapped.card.topCategory'), value: `${t(`categories.${d.topCategory.category}`)} · ${d.topCategory.pct}%` });
  rows.push({ label: t('wrapped.card.focus'), value: `${d.focusPct}%` });
  rows.push({ label: peakLabel.value ? t('wrapped.card.peak') : t('wrapped.card.days'), value: peakLabel.value || String(d.daysCovered) });
  return {
    heading: t('wrapped.card.heading'),
    periodLabel: `${range} · ${t('wrapped.daysCovered', { count: d.daysCovered }, d.daysCovered)}`,
    personaIconPaths: icon.paths,
    personaIconFilled: icon.filled,
    personaTitle: t(`wrapped.persona.${d.persona.id}.title`),
    bigValue: formatDuration(d.totalSeconds),
    bigCaption: t('wrapped.card.totalCaption'),
    rows,
    footer: t('wrapped.card.footer'),
    accentA: persona.accentA,
    accentB: persona.accentB,
    theme: 'dark',
  };
});

function paint() {
  if (canvas.value && content.value) renderWrappedCard(canvas.value, content.value, 2);
}
onMounted(() => nextTick(paint));
watch(content, () => nextTick(paint));

const downloading = ref(false);
async function downloadCard() {
  if (!canvas.value || !content.value || downloading.value) return;
  downloading.value = true;
  try {
    const blob = await canvasToImageBlob(canvas.value); // exact preview → same file
    if (blob) downloadBlob(`tabstyr-wrapped-${data.value?.endDate ?? 'export'}.jpg`, blob);
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

        <template v-if="content">
          <!-- The preview IS the share card — identical to the downloaded image. -->
          <canvas ref="canvas" class="card" :aria-label="t('wrapped.card.heading')" role="img" />
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
  width: min(360px, 100%);
  max-height: 94vh;
  overflow-y: auto;
  margin: auto;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.close {
  position: absolute;
  top: var(--sp-3);
  right: var(--sp-3);
  z-index: 2;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--text-sm);
}
.close:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
/* Render the 9:16 card responsively; it's the exact bitmap that downloads. */
.card {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--radius);
  box-shadow: var(--shadow-modal);
}
.wr-download {
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
.wr-empty {
  margin: auto;
  padding: var(--sp-6);
  text-align: center;
  color: var(--text);
  background: var(--popover);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: var(--text-sm);
}
</style>
