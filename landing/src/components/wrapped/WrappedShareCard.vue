<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue';
import { useI18n } from '@/i18n';
import { dayLabel, longDateLabel, formatDuration } from '@ext/time';
import { getDateLocale } from '@ext/locale';
import { PERSONA_ICON, ICONS } from '@ext/wrapped-icons';
import { PERSONA_META } from '@ext/wrapped-persona';
import { CATEGORY_META } from '@ext/categories';
import { renderWrappedCard, canvasToImageBlob, type WrappedCardContent } from '@ext/wrapped-card';
import type { WrappedData } from '@ext/wrapped';
import WrappedIcon from './WrappedIcon.vue';

const props = defineProps<{ data: WrappedData }>();
const { t } = useI18n();

const canvas = ref<HTMLCanvasElement | null>(null);
const status = ref(''); // error message only
const canShareFiles = ref(false);
const preparing = ref(false);
const saved = ref(false);

// The encoded PNG is cached so repeated Save/Share clicks never re-encode the
// 2160×3840 canvas; it's invalidated whenever the card is redrawn.
let pngBlob: Blob | null = null;
let savedTimer = 0;
let idleHandle = 0;

const personaIcon = computed(() => ICONS[PERSONA_ICON[props.data.persona.id]]);
const personaAccent = computed(() => PERSONA_META[props.data.persona.id]);

function daysLabel(n: number): string {
  return t(n === 1 ? 'wrapped.daysCoveredOne' : 'wrapped.daysCovered', { count: n });
}

const periodLabel = computed(() => {
  const d = props.data;
  const range = d.startDate === d.endDate ? longDateLabel(d.startDate) : `${dayLabel(d.startDate)} – ${dayLabel(d.endDate)}`;
  return `${range} · ${daysLabel(d.daysCovered)}`;
});

const peakLabel = computed(() => {
  const peak = props.data.peak;
  if (!peak) return '';
  const ref = new Date(2024, 0, 7 + peak.day, peak.hour); // 2024-01-07 is a Sunday
  return ref.toLocaleString(getDateLocale(), { weekday: 'long', hour: 'numeric' });
});

const content = computed<WrappedCardContent>(() => {
  const d = props.data;
  const rows: WrappedCardContent['rows'] = [];
  if (d.topSite)
    rows.push({
      label: t('wrapped.card.topSite'),
      value: `${d.topSite.label} · ${formatDuration(d.topSite.seconds)}`,
      chip: {
        initial: d.topSite.label.replace(/^www\./, '').charAt(0).toUpperCase() || '?',
        color: CATEGORY_META[d.topSite.category].color,
      },
    });
  if (d.topCategory) rows.push({ label: t('wrapped.card.topCategory'), value: `${t('categories.' + d.topCategory.category)} · ${d.topCategory.pct}%` });
  rows.push({ label: t('wrapped.card.focus'), value: `${d.focusPct}%` });
  rows.push({ label: peakLabel.value ? t('wrapped.card.peak') : t('wrapped.card.days'), value: peakLabel.value || String(d.daysCovered) });

  return {
    heading: t('wrapped.card.heading'),
    periodLabel: periodLabel.value,
    personaIconPaths: personaIcon.value.paths,
    personaIconFilled: personaIcon.value.filled,
    personaTitle: t(`wrapped.persona.${d.persona.id}.title`),
    bigValue: formatDuration(d.totalSeconds),
    bigCaption: t('wrapped.card.totalCaption'),
    rows,
    footer: t('wrapped.card.footer'),
    accentA: personaAccent.value.accentA,
    accentB: personaAccent.value.accentB,
    theme: 'dark',
  };
});

const fileName = computed(() => `tabstyr-wrapped-${props.data.endDate}.jpg`);

function draw(): void {
  if (!canvas.value) return;
  renderWrappedCard(canvas.value, content.value);
  pngBlob = null; // invalidate cache — content changed
  schedulePreencode(); // warm the cache while the user reads, so the first click is instant
}

// Encode once, lazily; subsequent calls reuse the cached blob.
async function ensureBlob(): Promise<Blob | null> {
  if (pngBlob || !canvas.value) return pngBlob;
  preparing.value = true;
  try {
    pngBlob = await canvasToImageBlob(canvas.value); // JPEG q0.9 — small + shareable
  } finally {
    preparing.value = false;
  }
  return pngBlob;
}

type IdleWin = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (h: number) => void;
};
function schedulePreencode(): void {
  cancelPreencode();
  const w = window as IdleWin;
  idleHandle = w.requestIdleCallback
    ? w.requestIdleCallback(() => void ensureBlob(), { timeout: 1500 })
    : window.setTimeout(() => void ensureBlob(), 250);
}
function cancelPreencode(): void {
  if (!idleHandle) return;
  const w = window as IdleWin;
  if (w.cancelIdleCallback) w.cancelIdleCallback(idleHandle);
  else clearTimeout(idleHandle);
  idleHandle = 0;
}

function flashSaved(): void {
  saved.value = true;
  clearTimeout(savedTimer);
  savedTimer = window.setTimeout(() => (saved.value = false), 2200);
}

function triggerDownload(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.value;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after a tick — some browsers need the URL alive until the download starts.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function download(): Promise<void> {
  if (preparing.value) return;
  status.value = '';
  const blob = await ensureBlob();
  if (!blob) {
    status.value = t('wrapped.card.saveFailed');
    return;
  }
  triggerDownload(blob);
  flashSaved();
}

async function share(): Promise<void> {
  if (preparing.value) return;
  status.value = '';
  const blob = await ensureBlob();
  if (!blob) {
    status.value = t('wrapped.card.saveFailed');
    return;
  }
  const file = new File([blob], fileName.value, { type: 'image/jpeg' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: t('wrapped.card.heading'), text: t('wrapped.card.shareText') });
      return;
    }
    triggerDownload(blob);
    flashSaved();
  } catch (e) {
    // User dismissing the share sheet throws AbortError — silent, not an error.
    if (e instanceof Error && e.name !== 'AbortError') status.value = t('wrapped.card.saveFailed');
  }
}

onMounted(() => {
  canShareFiles.value = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';
  void nextTick(draw);
});
watch(content, () => void nextTick(draw));
onBeforeUnmount(() => {
  cancelPreencode();
  clearTimeout(savedTimer);
});

const downloadLabel = computed(() =>
  preparing.value ? t('wrapped.card.preparing') : saved.value ? t('wrapped.card.saved') : t('wrapped.card.download'),
);
</script>

<template>
  <div class="card-slide">
    <p class="card-kicker">{{ t('wrapped.card.shareKicker') }}</p>
    <div class="card-frame">
      <canvas ref="canvas" class="card-canvas" :aria-label="t('wrapped.card.heading')" role="img" />
    </div>
    <div class="card-actions">
      <button type="button" class="btn btn-primary" :class="{ ok: saved }" :disabled="preparing" @click="download">
        <span class="ic">
          <span v-if="preparing" class="spinner" aria-hidden="true" />
          <WrappedIcon v-else :name="saved ? 'check' : 'download'" :size="18" />
        </span>
        {{ downloadLabel }}
      </button>
      <button v-if="canShareFiles" type="button" class="btn btn-ghost" :disabled="preparing" @click="share">
        <WrappedIcon name="share" :size="18" /> {{ t('wrapped.card.share') }}
      </button>
    </div>
    <p v-if="status" class="card-status" role="alert">{{ status }}</p>
  </div>
</template>

<style scoped>
.card-slide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
}
.card-kicker {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
  margin: 0;
}
/* Height-bounded so the card + buttons always fit the story without a scrollbar:
   it shrinks with the viewport, leaving room for the chrome, and never exceeds the
   card's natural size. Aspect ratio drives the width. */
.card-frame {
  aspect-ratio: 1080 / 1920;
  height: min(540px, calc(100vh - 300px));
  width: auto;
  max-width: 100%;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: var(--shadow-lg), var(--glow-md);
  border: 1px solid var(--border-hover);
}
.card-canvas { display: block; width: 100%; height: 100%; }

.card-actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 50px;
  padding: 0 26px;
  border-radius: 999px;
  font: inherit;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
  border: none;
  color: #fff;
  transition: transform 120ms ease, filter 160ms ease, box-shadow 200ms ease, background 240ms ease;
}
/* Primary: deep brand gradient, white text, soft brand glow. */
.btn-primary {
  background: linear-gradient(135deg, #8b5cf6, #4f86f7);
  box-shadow: 0 8px 24px -8px rgba(124, 92, 240, 0.7);
}
.btn-primary.ok { background: linear-gradient(135deg, #34d399, #10b981); box-shadow: 0 8px 24px -8px rgba(16, 185, 129, 0.6); }
/* Share: glass with a hairline border. */
.btn-ghost {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border-hover);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
.btn:active:not(:disabled) { transform: scale(0.97); }
.btn:disabled { cursor: default; opacity: 0.85; }
.ic { display: inline-flex; width: 18px; height: 18px; align-items: center; justify-content: center; }
.spinner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  animation: spin 700ms linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 1.4s; } }
.card-status { font-size: 13px; color: #fca5a5; font-weight: 600; margin: 0; }
</style>
