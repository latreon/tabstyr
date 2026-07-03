<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from '@/i18n';
import { dayLabel, longDateLabel, formatDuration } from '@ext/time';
import { getDateLocale } from '@ext/locale';
import { categoryColor, categoryLabel, type CustomCategory } from '@ext/categories';
import { PERSONA_META } from '@ext/wrapped-persona';
import { PERSONA_ICON, CHRONOTYPE_ICON, type IconName } from '@ext/wrapped-icons';
import type { WrappedData } from '@ext/wrapped';
import { preloadFavicons } from '@/lib/favicon';
import WrappedIcon from './WrappedIcon.vue';
import SiteIcon from './SiteIcon.vue';
import CountUp from './CountUp.vue';
import WrappedShareCard from './WrappedShareCard.vue';

const props = defineProps<{ data: WrappedData; custom?: CustomCategory[] }>();
const emit = defineEmits<{ (e: 'restart'): void }>();
const { t } = useI18n();

interface StorySlide {
  kind: 'msg' | 'num' | 'list' | 'bars' | 'share';
  id: string;
  icon?: IconName;
  kicker?: string;
  title?: string;
  value?: number;
  format?: (n: number) => string;
  caption?: string;
  list?: Array<{ domain: string; label: string; value: string; color: string }>;
  bars?: Array<{ label: string; pct: number; color: string }>;
  dot?: string;
  chip?: { domain: string; color: string };
}

const formatPct = (n: number): string => `${Math.round(n)}%`;

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
  const ref = new Date(2024, 0, 7 + peak.day, peak.hour);
  return ref.toLocaleString(getDateLocale(), { weekday: 'long', hour: 'numeric' });
});

const persona = computed(() => PERSONA_META[props.data.persona.id]);

// Warm every top-site favicon now, while the early slides play, so each icon is
// already resolved and cached before its slide appears — no chip flash, no swap.
function preloadSiteIcons(): void {
  const d = props.data;
  const domains = d.topSites.map((s) => s.domain);
  if (d.topSite) domains.push(d.topSite.domain);
  preloadFavicons(domains);
}

const slides = computed<StorySlide[]>(() => {
  const d = props.data;
  const out: StorySlide[] = [];

  out.push({ kind: 'msg', id: 'intro', icon: 'sparkles', kicker: periodLabel.value, title: t('wrapped.slide.intro.title'), caption: t('wrapped.slide.intro.caption', { days: d.daysCovered }) });

  out.push({ kind: 'num', id: 'total', icon: 'timer', kicker: t('wrapped.slide.total.kicker'), value: d.totalSeconds, format: formatDuration, caption: t('wrapped.slide.total.caption', { avg: formatDuration(d.dailyAverageSeconds) }) });

  out.push({ kind: 'num', id: 'sites', icon: 'globe', kicker: t('wrapped.slide.sites.kicker'), value: d.distinctDomains, caption: t('wrapped.slide.sites.caption') });

  if (d.topSite) {
    const pct = Math.round((d.topSite.seconds / d.totalSeconds) * 100);
    out.push({ kind: 'num', id: 'topSite', icon: 'eye', kicker: t('wrapped.slide.topSite.kicker'), title: d.topSite.label, value: d.topSite.seconds, format: formatDuration, caption: t('wrapped.slide.topSite.caption', { pct }), chip: { domain: d.topSite.domain, color: categoryColor(d.topSite.category, props.custom) } });
  }

  if (d.topSites.length > 1) {
    out.push({ kind: 'list', id: 'top5', icon: 'trophy', kicker: t('wrapped.slide.top5.kicker'), list: d.topSites.map((s) => ({ domain: s.domain, label: s.label, value: formatDuration(s.seconds), color: categoryColor(s.category, props.custom) })) });
  }

  if (d.categories.length) {
    out.push({ kind: 'bars', id: 'breakdown', icon: 'layers', kicker: t('wrapped.slide.category.kicker'), bars: d.categories.slice(0, 5).map((c) => ({ label: categoryLabel(c.category, t), pct: c.pct, color: categoryColor(c.category, props.custom) })) });
  }

  if (d.busiestDate) {
    out.push({ kind: 'num', id: 'busiest', icon: 'calendar', kicker: t('wrapped.slide.busiest.kicker'), title: longDateLabel(d.busiestDate), value: d.busiestDateSeconds, format: formatDuration, caption: t('wrapped.slide.busiest.caption') });
  }

  if (d.peak) {
    out.push({ kind: 'msg', id: 'peak', icon: CHRONOTYPE_ICON[d.chronotype], kicker: t('wrapped.slide.peak.kicker'), title: t(`wrapped.chronotype.${d.chronotype}.title`), caption: t('wrapped.slide.peak.caption', { when: peakLabel.value }) });
  }

  out.push({ kind: 'num', id: 'focus', icon: 'target', kicker: t('wrapped.slide.focus.kicker'), value: d.focusPct, format: formatPct, caption: d.longestStreak > 0 ? t('wrapped.slide.focus.streak', { count: d.longestStreak }) : t('wrapped.slide.focus.caption') });

  out.push({ kind: 'msg', id: 'persona', icon: PERSONA_ICON[d.persona.id], kicker: t('wrapped.slide.persona.kicker'), title: t(`wrapped.persona.${d.persona.id}.title`), caption: t(`wrapped.persona.${d.persona.id}.subtitle`) });

  out.push({ kind: 'share', id: 'share' });
  return out;
});

// ── Player ─────────────────────────────────────────────────────────────────
const index = ref(0);
const lastIndex = computed(() => slides.value.length - 1);
const current = computed(() => slides.value[index.value]);
const onShare = computed(() => current.value?.kind === 'share');

// Each slide's visual content is aria-hidden (animated/decorative); this single
// polite live region carries the slide's text so screen readers hear each one as
// it changes (the final value, not CountUp's intermediate frames).
const liveText = computed(() => {
  const s = current.value;
  if (!s) return '';
  if (s.kind === 'share') return t('wrapped.card.shareKicker');
  if (s.kind === 'list') {
    return `${s.kicker}. ` + (s.list ?? []).map((it, i) => `${i + 1}. ${it.label}, ${it.value}`).join('. ');
  }
  if (s.kind === 'bars') {
    return `${s.kicker}. ` + (s.bars ?? []).map((b) => `${b.label} ${b.pct}%`).join(', ');
  }
  const value = s.value != null ? (s.format ? s.format(s.value) : String(s.value)) : '';
  return [s.kicker, s.title, value, s.caption].filter(Boolean).join('. ');
});

const motionMedia =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
const reducedMotion = ref(motionMedia?.matches ?? false);
const autoplay = ref(!reducedMotion.value);
const paused = ref(false);
const animating = computed(() => autoplay.value && !paused.value && !onShare.value);
function onMotionChange(e: MediaQueryListEvent): void {
  reducedMotion.value = e.matches;
  if (e.matches) autoplay.value = false;
}

function prev(): void {
  if (index.value > 0) index.value--;
}
function next(): void {
  if (index.value < lastIndex.value) index.value++;
  else autoplay.value = false;
}
function togglePause(): void {
  paused.value = !paused.value;
}

watch(
  () => props.data,
  () => {
    index.value = 0;
    autoplay.value = !reducedMotion.value;
    paused.value = false;
    preloadSiteIcons();
  },
);

function onKey(e: KeyboardEvent): void {
  const el = document.activeElement as HTMLElement | null;
  const tag = el?.tagName.toLowerCase();
  // Never hijack typing/caret movement in a field.
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable) return;
  if (e.key === 'ArrowLeft') prev();
  else if (e.key === 'ArrowRight') next();
  else if (e.key === ' ' || e.key === 'Spacebar') {
    // Let Space activate a focused button instead of toggling pause.
    if (tag === 'button') return;
    e.preventDefault();
    togglePause();
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKey);
  motionMedia?.addEventListener('change', onMotionChange);
  preloadSiteIcons();
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  motionMedia?.removeEventListener('change', onMotionChange);
});

function onZoneClick(e: MouseEvent): void {
  const el = e.currentTarget as HTMLElement;
  const x = (e.clientX - el.getBoundingClientRect().left) / el.offsetWidth;
  if (x < 0.33) prev();
  else next();
}

const rootStyle = computed(() => ({ '--w-a': persona.value.accentA, '--w-b': persona.value.accentB }));
</script>

<template>
  <div class="story" :style="rootStyle" role="region" :aria-label="t('wrapped.drop.title')">
    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ liveText }}</p>
    <div class="bars" role="presentation">
      <div v-for="(s, i) in slides" :key="s.id" class="bar">
        <span
          class="bar-fill"
          :class="{ done: i < index, run: i === index && animating, here: i === index && !animating }"
          @animationend="i === index && animating ? next() : null"
        />
      </div>
    </div>

    <div class="top-controls">
      <button v-if="!onShare" type="button" class="icon-btn" :aria-label="paused ? t('wrapped.play') : t('wrapped.pause')" @click="togglePause">
        <WrappedIcon :name="paused ? 'play' : 'pause'" :size="15" />
      </button>
      <span v-else class="spacer" />
      <button type="button" class="icon-btn" :aria-label="t('wrapped.startOver')" @click="emit('restart')">
        <WrappedIcon name="restart" :size="15" />
      </button>
    </div>

    <div class="stage" @click="onShare ? null : onZoneClick($event)">
      <Transition name="slide" mode="out-in">
        <div :key="current?.id" class="slide" :aria-hidden="onShare ? undefined : 'true'">
          <template v-if="current?.kind === 'share'">
            <WrappedShareCard :data="data" :custom="custom" />
          </template>

          <template v-else-if="current?.kind === 'bars'">
            <span class="badge"><WrappedIcon :name="current.icon!" :size="40" /></span>
            <p class="kicker">{{ current.kicker }}</p>
            <ul class="cats">
              <li v-for="(b, i) in current.bars" :key="i" class="cat-row">
                <span class="cat-head">
                  <span class="cat-dot" :style="{ background: b.color }" aria-hidden="true" />
                  <span class="cat-label">{{ b.label }}</span>
                  <span class="cat-pct">{{ b.pct }}%</span>
                </span>
                <span class="cat-track"><span class="cat-fill" :style="{ width: Math.max(b.pct, 2) + '%', background: b.color }" /></span>
              </li>
            </ul>
          </template>

          <template v-else-if="current?.kind === 'list'">
            <span class="badge"><WrappedIcon :name="current.icon!" :size="40" /></span>
            <p class="kicker">{{ current.kicker }}</p>
            <ol class="rank">
              <li v-for="(item, i) in current.list" :key="i" class="rank-row">
                <span class="rank-n">{{ i + 1 }}</span>
                <SiteIcon :domain="item.domain" :label="item.label" :color="item.color" :size="30" />
                <span class="rank-label">{{ item.label }}</span>
                <span class="rank-value">{{ item.value }}</span>
              </li>
            </ol>
          </template>

          <template v-else>
            <span class="badge"><WrappedIcon :name="current!.icon!" :size="46" /></span>
            <p class="kicker">{{ current?.kicker }}</p>
            <p v-if="current?.title" class="title">
              <SiteIcon v-if="current?.chip" :domain="current.chip.domain" :label="current.title ?? ''" :color="current.chip.color" :size="40" />
              <span v-else-if="current?.dot" class="title-dot" :style="{ background: current.dot }" aria-hidden="true" />
              {{ current.title }}
            </p>
            <p v-if="current?.kind === 'num'" class="big"><CountUp :value="current.value ?? 0" :format="current.format" /></p>
            <p v-if="current?.caption" class="caption">{{ current.caption }}</p>
          </template>
        </div>
      </Transition>
    </div>

    <div class="nav">
      <button type="button" class="nav-btn" :disabled="index === 0" :aria-label="t('wrapped.prev')" @click="prev"><WrappedIcon name="chevronLeft" :size="20" /></button>
      <span class="nav-count">{{ index + 1 }} / {{ slides.length }}</span>
      <button type="button" class="nav-btn" :disabled="index === lastIndex" :aria-label="t('wrapped.next')" @click="next"><WrappedIcon name="chevronRight" :size="20" /></button>
    </div>
  </div>
</template>

<style scoped>
.story {
  position: relative;
  width: min(460px, 100%);
  height: min(810px, calc(100vh - 40px));
  margin: 0 auto;
  border-radius: 30px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: #fff;
  background: linear-gradient(160deg, var(--w-a), var(--w-b));
  box-shadow: var(--shadow-lg);
}
.story::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255, 255, 255, 0.2), transparent 70%),
    linear-gradient(180deg, transparent 45%, rgba(0, 0, 0, 0.32));
  pointer-events: none;
}

.bars { display: flex; gap: 5px; padding: 14px 14px 0; position: relative; z-index: 2; }
.bar { flex: 1; height: 3px; border-radius: 2px; background: rgba(255, 255, 255, 0.3); overflow: hidden; }
.bar-fill { display: block; height: 100%; width: 0; background: #fff; border-radius: 2px; }
.bar-fill.done, .bar-fill.here { width: 100%; }
.bar-fill.run { width: 0; animation: fillbar 5500ms linear forwards; }
@keyframes fillbar { to { width: 100%; } }

.top-controls { display: flex; justify-content: space-between; padding: 10px 16px 0; position: relative; z-index: 2; }
.spacer { width: 34px; }
.icon-btn {
  width: 34px; height: 34px; border-radius: 50%; border: none;
  background: rgba(255, 255, 255, 0.18); color: #fff; cursor: pointer;
  display: grid; place-items: center;
}
.icon-btn:hover { background: rgba(255, 255, 255, 0.3); }

.stage { flex: 1; display: grid; place-items: center; padding: 16px 30px; position: relative; z-index: 1; cursor: pointer; min-height: 0; overflow-y: auto; }
.slide { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; }
.badge {
  width: 92px; height: 92px; border-radius: 26px;
  display: grid; place-items: center;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: #fff;
  box-shadow: 0 10px 30px -8px rgba(0, 0, 0, 0.4);
}
.kicker { font-size: 13px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.85; margin: 0; }
.title {
  font-family: var(--font-display);
  font-size: clamp(28px, 6vw, 42px); font-weight: 700; letter-spacing: -0.01em; margin: 0;
  overflow-wrap: anywhere; display: inline-flex; align-items: center; gap: 10px;
}
.title-dot { width: 18px; height: 18px; border-radius: 50%; flex: none; }
.big {
  font-family: var(--font-display);
  font-size: clamp(56px, 15vw, 96px); font-weight: 700; letter-spacing: -0.03em; line-height: 1; margin: 0;
  text-shadow: 0 6px 24px rgba(0, 0, 0, 0.25); font-variant-numeric: tabular-nums;
}
.caption { font-size: 16px; font-weight: 500; opacity: 0.92; margin: 0; max-width: 30ch; line-height: 1.45; }

.rank { list-style: none; margin: 0; padding: 0; width: 100%; display: flex; flex-direction: column; gap: 10px; }
.rank-row { display: flex; align-items: center; gap: 12px; background: rgba(255, 255, 255, 0.15); border-radius: 14px; padding: 13px 16px; }
.rank-n { font-weight: 800; opacity: 0.8; width: 16px; text-align: center; }
.rank-label { flex: 1; font-weight: 600; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-value { font-weight: 700; font-variant-numeric: tabular-nums; opacity: 0.95; }

.cats { list-style: none; margin: 0; padding: 0; width: 100%; display: flex; flex-direction: column; gap: 16px; }
.cat-row { display: flex; flex-direction: column; gap: 8px; }
.cat-head { display: flex; align-items: center; gap: 9px; font-size: 15px; font-weight: 600; }
.cat-dot { width: 12px; height: 12px; border-radius: 50%; flex: none; box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.12); }
.cat-label { flex: 1; text-align: left; }
.cat-pct { font-weight: 700; font-variant-numeric: tabular-nums; opacity: 0.9; }
.cat-track { height: 10px; border-radius: 6px; background: rgba(255, 255, 255, 0.18); overflow: hidden; }
.cat-fill { display: block; height: 100%; border-radius: 6px; }

.nav { display: flex; align-items: center; justify-content: center; gap: 18px; padding: 14px; position: relative; z-index: 2; }
.nav-btn {
  width: 42px; height: 42px; border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.4); background: rgba(255, 255, 255, 0.12);
  color: #fff; cursor: pointer; display: grid; place-items: center;
}
.nav-btn:disabled { opacity: 0.3; cursor: default; }
.nav-count { font-size: 12px; font-weight: 700; opacity: 0.8; min-width: 48px; text-align: center; font-variant-numeric: tabular-nums; }

.slide-enter-active { transition: opacity 360ms ease, transform 360ms cubic-bezier(0.16, 1, 0.3, 1); }
.slide-leave-active { transition: opacity 200ms ease; }
.slide-enter-from { opacity: 0; transform: translateY(24px) scale(0.98); }
.slide-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .slide-enter-active, .slide-leave-active { transition-duration: 0.01ms; }
  .bar-fill.run { animation: none; width: 100%; }
}
</style>
