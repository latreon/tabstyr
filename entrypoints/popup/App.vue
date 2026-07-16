<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { browser } from 'wxt/browser';
import { useLocale } from '@/composables/useLocale';
import { getAllTabMeta, getStatsRange } from '@/lib/db/repo';
import { findStale } from '@/lib/tracker/stale';
import { getSettings, saveSettings } from '@/lib/settings';
import { addDays, dateKey, formatDuration } from '@/lib/time';
import { isWebDomain, displayDomain } from '@/lib/domain';
import { resolveDomain } from '@/lib/domain-aliases';
import { activeSeconds as active } from '@/lib/metrics';
import { openDomain } from '@/lib/navigate';
import { COFFEE_URL } from '@/lib/support';
import { CHANGELOG_URL } from '@/lib/links';
import { formatCountdown, remainingMs, startFocusTimer, type FocusTimerState } from '@/lib/focus-timer';
import FaviconChip from '@/components/FaviconChip.vue';
import RingLogo from '@/components/RingLogo.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
import SelectBox from '@/components/ui/SelectBox.vue';

const { t } = useI18n();
const locale = useLocale();
const todaySeconds = ref(0);
const weeklyAvgSeconds = ref(0);
const weeklyActiveDays = ref(0);
const topDomains = ref<Array<{ domain: string; seconds: number }>>([]);
const tabCount = ref(0);
const staleCount = ref(0);
const loading = ref(true);
const loadError = ref(false);
const trackingPaused = ref(false);
const showWhatsNew = ref(false);
const currentVersion = browser.runtime.getManifest().version;

const FOCUS_TIMER_ALARM = 'focus-timer';
const focusTimer = ref<FocusTimerState | null>(null);
const focusRemaining = ref(0);
const focusDuration = ref('25');
const FOCUS_DURATION_OPTIONS = computed(() => [
  { value: '25', label: t('popup.focusMinutes', { minutes: 25 }) },
  { value: '45', label: t('popup.focusMinutes', { minutes: 45 }) },
  { value: '60', label: t('popup.focusMinutes', { minutes: 60 }) },
]);
let focusTickTimer: ReturnType<typeof setInterval> | undefined;

const deltaPct = computed(() => {
  if (!weeklyAvgSeconds.value || weeklyActiveDays.value < 3) return null;
  const pct = Math.round(((todaySeconds.value - weeklyAvgSeconds.value) / weeklyAvgSeconds.value) * 100);
  return pct === 0 ? null : pct;
});
const maxSeconds = computed(() => Math.max(1, ...topDomains.value.map((d) => d.seconds)));

async function load() {
  loading.value = true;
  loadError.value = false;
  try {
    await locale.load();
    const today = dateKey(Date.now());
    const [stats, weekStats, metas, settings, tabs] = await Promise.all([
      getStatsRange(today, today),
      getStatsRange(addDays(today, -7), addDays(today, -1)),
      getAllTabMeta(),
      getSettings(),
      browser.tabs.query({}),
    ]);
    const webToday = stats.filter((s) => isWebDomain(s.domain));
    // Exclude days with no active time (e.g. background-audio-only) so they don't
    // count as "active days" and dilute the weekly average (matches useStats).
    const webWeek = weekStats.filter((s) => isWebDomain(s.domain) && active(s) > 0);
    todaySeconds.value = webToday.reduce((sum, s) => sum + active(s), 0);
    // Average over days with data, not a flat ÷7 (see useStats.weeklyAvgSeconds).
    weeklyActiveDays.value = new Set(webWeek.map((s) => s.date)).size;
    weeklyAvgSeconds.value = weeklyActiveDays.value
      ? webWeek.reduce((sum, s) => sum + active(s), 0) / weeklyActiveDays.value
      : 0;
    const byDomain = new Map<string, number>();
    for (const s of webToday) {
      const domain = resolveDomain(s.domain, settings.domainAliases);
      byDomain.set(domain, (byDomain.get(domain) ?? 0) + active(s));
    }
    topDomains.value = [...byDomain.entries()]
      .map(([domain, seconds]) => ({ domain, seconds }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5);
    const ownPrefix = browser.runtime.getURL('');
    const realTabs = tabs.filter((t) => t.url && !t.url.startsWith(ownPrefix));
    tabCount.value = realTabs.length;
    const liveIds = new Set(realTabs.flatMap((t) => (t.id ? [t.id] : [])));
    staleCount.value = findStale(
      metas.filter((m) => liveIds.has(m.tabId)),
      Date.now(),
      settings.staleDays,
    ).length;
    trackingPaused.value = settings.trackingPaused;
    // Shown once per version bump: background.ts seeds this on fresh install
    // (so a new user never sees it), and leaves it at the OLD version on
    // 'update' — a mismatch here means an update the user hasn't acknowledged.
    // An existing install from BEFORE this feature shipped has no stored value
    // at all; baseline it silently rather than showing a banner for however
    // many past updates it missed — tracking starts clean from here on.
    const { whatsNewVersion } = await browser.storage.local.get('whatsNewVersion');
    if (whatsNewVersion === undefined) {
      await browser.storage.local.set({ whatsNewVersion: currentVersion });
    } else {
      showWhatsNew.value = whatsNewVersion !== currentVersion;
    }
  } catch (e) {
    console.error('[popup] load failed', e);
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

// Independent of load(): a focus timer's state lives in storage.local (so it
// survives the popup closing) and its completion notification is fired by
// background.ts's alarm handler, not here — this only reflects/controls it.
function tickFocusTimer() {
  focusRemaining.value = remainingMs(focusTimer.value, Date.now());
  if (focusTimer.value && focusRemaining.value <= 0) focusTimer.value = null; // completed while popup was open
}
onMounted(async () => {
  const { focusTimer: stored } = await browser.storage.local.get('focusTimer');
  focusTimer.value = (stored as FocusTimerState | undefined) ?? null;
  tickFocusTimer();
  focusTickTimer = setInterval(tickFocusTimer, 1000);
});
onBeforeUnmount(() => clearInterval(focusTickTimer));

async function startFocus() {
  const state = startFocusTimer(Number(focusDuration.value), Date.now());
  focusTimer.value = state;
  tickFocusTimer();
  await browser.storage.local.set({ focusTimer: state });
  await browser.alarms.create(FOCUS_TIMER_ALARM, { when: state.endsAt });
}
async function cancelFocus() {
  focusTimer.value = null;
  await browser.storage.local.remove('focusTimer');
  await browser.alarms.clear(FOCUS_TIMER_ALARM);
}

function openDashboard(hash = '') {
  void browser.tabs.create({ url: browser.runtime.getURL(`/dashboard.html${hash}`) });
}
function openCoffee() {
  void browser.tabs.create({ url: COFFEE_URL });
}

async function dismissWhatsNew() {
  showWhatsNew.value = false;
  await browser.storage.local.set({ whatsNewVersion: currentVersion });
}
function openWhatsNew() {
  void browser.tabs.create({ url: CHANGELOG_URL });
  void dismissWhatsNew();
}

// Immediate, unlike the debounced save in Settings — this is a quick-access
// action, not a preference being dialed in, so it should feel instant.
async function togglePause() {
  const next = !trackingPaused.value;
  trackingPaused.value = next; // optimistic — this popup is about to close anyway
  try {
    await saveSettings({ trackingPaused: next });
    await browser.runtime.sendMessage({ type: 'settings-changed' });
  } catch (e) {
    console.error('[popup] pause toggle failed', e);
    trackingPaused.value = !next;
  }
}
</script>

<template>
  <main class="popup">
    <div class="glow" aria-hidden="true" />
    <header class="head">
      <span class="brand"><RingLogo :size="18" /> TabStyr</span>
      <span class="counts">
        {{ t('popup.tabs', { count: tabCount }) }}
        <template v-if="staleCount"> · <span class="stale-count">{{ t('popup.stale', { count: staleCount }) }}</span></template>
      </span>
      <button
        class="pause-toggle tip-right"
        :class="{ active: trackingPaused }"
        :aria-label="t(trackingPaused ? 'popup.resumeTracking' : 'popup.pauseTracking')"
        :data-tip="t(trackingPaused ? 'popup.resumeTracking' : 'popup.pauseTracking')"
        @click="togglePause"
      >
        <!-- Play: resume (Lucide) -->
        <svg v-if="trackingPaused" class="ti-fill" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3v18l15-9L6 3Z" />
        </svg>
        <!-- Pause (Lucide) -->
        <svg v-else class="ti-fill" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      </button>
      <ThemeToggle />
    </header>

    <div v-if="showWhatsNew" class="whats-new" role="status">
      <button type="button" class="whats-new-body" @click="openWhatsNew">
        {{ t('popup.whatsNew', { version: currentVersion }) }}
      </button>
      <button type="button" class="whats-new-close" :aria-label="t('common.dismiss')" @click="dismissWhatsNew">✕</button>
    </div>

    <div v-if="loading" class="skeleton" role="status" aria-busy="true" :aria-label="t('common.loading')">
      <div class="sk sk-hero" aria-hidden="true" />
      <div class="sk sk-row" v-for="i in 3" :key="i" aria-hidden="true" />
    </div>

    <div v-else-if="loadError" class="load-error" role="alert">
      <p class="label error">{{ t('popup.loadError') }}</p>
      <button type="button" class="retry-btn" @click="load()">{{ t('common.retry') }}</button>
    </div>

    <template v-else>
      <section class="hero">
        <span class="total gradient-text">{{ formatDuration(todaySeconds) }}</span>
        <span v-if="deltaPct !== null" class="delta" :class="deltaPct > 0 ? 'up' : 'down'">
          <span aria-hidden="true">{{ deltaPct > 0 ? '↑' : '↓' }}</span> {{ Math.abs(deltaPct) }}%
        </span>
        <div class="sub label">{{ t('popup.activeToday') }}</div>
      </section>

      <ul v-if="topDomains.length" class="sites" :aria-label="t('popup.topSitesAria')">
        <li v-for="d in topDomains" :key="d.domain">
          <button class="site-row" :aria-label="t('popup.openAria', { domain: displayDomain(d.domain), time: formatDuration(d.seconds) })" @click="openDomain(d.domain)">
            <FaviconChip :domain="d.domain" />
            <span class="site-main">
              <span class="site-line">
                <span class="domain">{{ displayDomain(d.domain) }}</span>
                <strong>{{ formatDuration(d.seconds) }}</strong>
              </span>
              <span class="track"><span class="fill" :style="{ width: `${(d.seconds / maxSeconds) * 100}%` }" /></span>
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="label empty">{{ t('popup.noActivityToday') }}</p>

      <div class="focus-timer">
        <template v-if="focusTimer && focusRemaining > 0">
          <span class="focus-count">{{ formatCountdown(focusRemaining) }}</span>
          <span class="focus-label label">{{ t('popup.focusRunning') }}</span>
          <button type="button" class="focus-cancel" @click="cancelFocus">{{ t('popup.focusCancel') }}</button>
        </template>
        <template v-else>
          <SelectBox
            :model-value="focusDuration"
            :options="FOCUS_DURATION_OPTIONS"
            :label="t('popup.focusDuration')"
            @update:model-value="focusDuration = $event"
          />
          <button type="button" class="focus-start" @click="startFocus">{{ t('popup.focusStart') }}</button>
        </template>
      </div>

      <footer class="actions">
        <button class="cta" @click="openDashboard()">{{ t('popup.dashboard') }}</button>
        <button v-if="staleCount" class="stale-btn" @click="openDashboard('#stale')">{{ t('popup.stale', { count: staleCount }) }}</button>
      </footer>

      <button v-if="COFFEE_URL" class="coffee" :aria-label="t('support.coffee')" @click="openCoffee">
        <span aria-hidden="true">☕</span>
        <span>{{ t('support.coffee') }}</span>
      </button>
    </template>
  </main>
</template>

<style scoped>
.popup {
  position: relative;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  overflow: hidden;
}
.whats-new {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--accent-muted);
  border: 1px solid color-mix(in oklab, var(--accent) 40%, var(--border));
  border-radius: var(--radius-sm);
  padding: 2px;
}
.whats-new-body {
  all: unset;
  flex: 1;
  box-sizing: border-box;
  padding: 8px 10px;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  border-radius: var(--radius-sm);
}
.whats-new-body:hover { background: var(--row-hover); }
.whats-new-body:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.whats-new-close {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--text-3);
  cursor: pointer;
  border-radius: var(--radius-sm);
}
.whats-new-close:hover { color: var(--text); background: var(--row-hover); }
.whats-new-close:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.load-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.retry-btn {
  height: 30px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.retry-btn:hover { border-color: var(--accent); }
.retry-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.glow {
  position: absolute;
  inset: 0;
  background: var(--surface-glow);
  pointer-events: none;
}
.head {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: -0.2px;
}
.counts {
  margin-left: auto;
  font-size: var(--text-xs);
  color: var(--text-3);
}
.pause-toggle {
  background: var(--card-strong);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
}
.pause-toggle .ti-fill {
  width: 15px;
  height: 15px;
  fill: currentColor;
}
.pause-toggle:hover { border-color: var(--accent); color: var(--text); }
.pause-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pause-toggle.active {
  background: var(--warn-bg);
  border-color: var(--warn-border);
  color: var(--warn);
}
.stale-count {
  color: var(--warn);
  font-weight: 600;
}
.hero {
  position: relative;
}
.total {
  font-size: var(--text-2xl);
  font-weight: 800;
  letter-spacing: -1px;
}
.delta {
  font-size: 12px;
  font-weight: 700;
  margin-left: var(--sp-2);
}
.delta.up { color: var(--positive); }
.delta.down { color: var(--negative); }
.sub { margin-top: 2px; }
.sites {
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
.site-row {
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px var(--sp-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.site-row:hover { background: var(--row-hover); }
.site-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.site-main { flex: 1; min-width: 0; }
.site-line {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
  gap: var(--sp-2);
}
.domain {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-2);
}
.site-line strong { font-weight: 700; }
.track {
  display: block;
  height: 4px;
  border-radius: 2px;
  background: var(--bar-track);
  margin-top: var(--sp-1);
  overflow: hidden;
}
.fill {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--accent-gradient);
}
.focus-timer {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card-strong);
}
.focus-count {
  font-size: var(--text-lg);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.focus-label {
  flex: 1;
}
.focus-start,
.focus-cancel {
  height: 30px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: var(--text-xs);
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.focus-start:hover,
.focus-cancel:hover { border-color: var(--accent); }
.focus-start:focus-visible,
.focus-cancel:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.actions {
  position: relative;
  display: flex;
  gap: var(--sp-2);
}
.cta {
  flex: 1;
  background: var(--accent-gradient);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-sm);
  padding: 10px;
  font-size: var(--text-sm);
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: filter 140ms ease, transform 140ms ease, box-shadow 140ms ease;
}
.cta:hover {
  filter: brightness(1.12);
  transform: translateY(-1px);
  box-shadow: 0 6px 18px var(--accent-muted);
}
.cta:active { transform: translateY(0); }
.cta:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.stale-btn {
  background: var(--warn-bg);
  color: var(--warn);
  border: 1px solid var(--warn-border);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.stale-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.coffee {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  margin-top: 2px;
  padding: var(--sp-2) 10px;
  background: transparent;
  border: 1px solid color-mix(in oklab, var(--accent) 40%, var(--border));
  border-radius: var(--radius-sm);
  color: var(--text-3);
  font-size: var(--text-xs);
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.coffee:hover { border-color: var(--accent); color: var(--text); }
.coffee:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.empty, .error { position: relative; margin: 0; }
.skeleton { position: relative; display: flex; flex-direction: column; gap: var(--sp-2); }
.sk {
  border-radius: var(--radius-sm);
  background: var(--bar-track);
  animation: pulse 1.2s ease-in-out infinite;
}
.sk-hero { height: 56px; }
.sk-row { height: 34px; }
@keyframes pulse {
  50% { opacity: 0.5; }
}
</style>
