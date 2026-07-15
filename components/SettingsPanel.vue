<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { browser } from 'wxt/browser';
import { getSettings, saveSettings } from '@/lib/settings';
import { useTheme } from '@/composables/useTheme';
import { useLocale } from '@/composables/useLocale';
import { useFocusTrap } from '@/composables/useFocusTrap';
import { SUPPORTED_LOCALES, resolveLocale } from '@/lib/i18n';
import * as repo from '@/lib/db/repo';
import { downloadFile, toJsonBackup } from '@/lib/export';
import { buildExportRows, exportRowsToCsv, exportRowsToJson } from '@/lib/export-data';
import { encryptToEnvelope, isEncryptedEnvelope, decryptFromEnvelope, MIN_PASSPHRASE } from '@/lib/crypto';
import { parseBackup, restoreBackup, MAX_BACKUP_BYTES, type ParsedBackup } from '@/lib/restore';
import { mergeBackup, mergeSettingsMaps } from '@/lib/merge';
import { parseCsvImport } from '@/lib/import-csv';
import { dateKey } from '@/lib/time';
import { getDateLocale } from '@/lib/locale';
import type { Settings, ThemeSetting } from '@/lib/types';
import SelectBox from '@/components/ui/SelectBox.vue';
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue';
import NumberStepper from '@/components/ui/NumberStepper.vue';

const { t } = useI18n();
const locale = useLocale();

// Only explicit choices are offered; "system" stays the default until the user picks.
const THEME_OPTIONS = computed(() => [
  { value: 'light', label: t('settings.light') },
  { value: 'dark', label: t('settings.dark') },
]);

// Explicit locales only — each shown in its own script. No "Automatic": the
// picker always reflects a concrete language.
const LANGUAGE_OPTIONS = computed(() =>
  SUPPORTED_LOCALES.map((l) => ({ value: l.code, label: `${l.flag}  ${l.label}` })),
);
// A stored 'auto' preference resolves to a concrete locale for display/selection.
const currentLocale = computed(() => resolveLocale(locale.language.value));

const emit = defineEmits<{ changed: [] }>();
const theme = useTheme();

const staleDays = ref(3);
const idleSeconds = ref(180);
const audioEnabled = ref(true);
const notificationsEnabled = ref(true);
const sessionAlertMinutes = ref(30);
const focusTarget = ref(50);
const themeChoice = ref<'light' | 'dark'>('light');
// Gate auto-save until the initial values are loaded, so seeding the refs in
// onMounted doesn't immediately persist defaults over stored settings.
const loaded = ref(false);
let saveTimer: ReturnType<typeof setTimeout> | undefined;

const toast = ref<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function showToast(msg: string) {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 2400);
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

onMounted(async () => {
  const s = await getSettings();
  staleDays.value = s.staleDays;
  idleSeconds.value = s.idleSeconds;
  audioEnabled.value = s.audioEnabled;
  notificationsEnabled.value = s.notificationsEnabled;
  sessionAlertMinutes.value = s.sessionAlertMinutes;
  // If still on the implicit "system" default, show the resolved theme in the picker.
  themeChoice.value = s.theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : s.theme;
  focusTarget.value = s.focusTarget;
  loaded.value = true;
});

// Keep the picker in sync if the theme is changed elsewhere (header toggle).
watch(theme.setting, (next) => {
  themeChoice.value = next === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : next;
});

// Apply + persist the theme immediately on pick (consistent with language/rules,
// which also save on change rather than waiting for a button).
async function setTheme(next: 'light' | 'dark') {
  themeChoice.value = next;
  try {
    await theme.set(next);
  } catch (e) {
    console.error('[settings] theme save failed', e);
    showToast(t('settings.saveFailed'));
  }
}

// Auto-save the numeric/toggle preferences. Debounced so rapid stepper clicks
// collapse into one write + one toast, and one settings-changed broadcast.
async function persistSettings() {
  try {
    await saveSettings({
      staleDays: staleDays.value,
      idleSeconds: idleSeconds.value,
      audioEnabled: audioEnabled.value,
      notificationsEnabled: notificationsEnabled.value,
      sessionAlertMinutes: sessionAlertMinutes.value,
      focusTarget: focusTarget.value,
    });
    await browser.runtime.sendMessage({ type: 'settings-changed' });
    emit('changed'); // refresh the dashboard so the focus goal reflects immediately
    showToast(t('settings.saved'));
  } catch (e) {
    console.error('[settings] save failed', e);
    showToast(t('settings.saveFailed'));
  }
}

watch([staleDays, idleSeconds, audioEnabled, notificationsEnabled, sessionAlertMinutes, focusTarget], () => {
  if (!loaded.value) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistSettings, 400);
});

// Re-show the first-run intro on the dashboard. Clearing `onboarded` makes the
// dashboard's showOnboarding turn true again; emit('changed') reloads it.
async function replayOnboarding() {
  try {
    await saveSettings({ onboarded: false });
    await browser.runtime.sendMessage({ type: 'settings-changed' });
    emit('changed');
    showToast(t('settings.introShown'));
  } catch (e) {
    console.error('[settings] replay onboarding failed', e);
    showToast(t('settings.saveFailed'));
  }
}

const exporting = ref(false);

async function exportData() {
  if (exporting.value) return;
  exporting.value = true;
  try {
    const stamp = dateKey(Date.now());
    const [dailyStats, monthlyStats, sessions, tabMeta, settings] = await Promise.all([
      repo.getAllDailyStats(),
      repo.getAllMonthlyStats(),
      repo.getAllSessions(),
      repo.getAllTabMeta(),
      getSettings(),
    ]);
    const json = toJsonBackup({ dailyStats, monthlyStats, sessions, tabMeta, settings }, Date.now());
    downloadFile(`tabstyr-backup-${stamp}.json`, json, 'application/json');
    showToast(t('settings.exportedJson'));
  } catch (e) {
    console.error('[settings] export failed', e);
    showToast(t('settings.exportFailed'));
  } finally {
    exporting.value = false;
  }
}

// --- Data export (CSV/JSON for spreadsheet analysis; not a restore format) ---
const exportingData = ref(false);

async function buildDataExportRows() {
  const [dailyStats, monthlyStats, settings] = await Promise.all([
    repo.getAllDailyStats(),
    repo.getAllMonthlyStats(),
    getSettings(),
  ]);
  return buildExportRows(dailyStats, monthlyStats, settings);
}

async function exportDataCsv() {
  if (exportingData.value) return;
  exportingData.value = true;
  try {
    const rows = await buildDataExportRows();
    downloadFile(`tabstyr-data-${dateKey(Date.now())}.csv`, exportRowsToCsv(rows), 'text/csv');
    showToast(t('settings.exportedDataCsv'));
  } catch (e) {
    console.error('[settings] csv data export failed', e);
    showToast(t('settings.exportFailed'));
  } finally {
    exportingData.value = false;
  }
}

async function exportDataJson() {
  if (exportingData.value) return;
  exportingData.value = true;
  try {
    const rows = await buildDataExportRows();
    downloadFile(`tabstyr-data-${dateKey(Date.now())}.json`, exportRowsToJson(rows, Date.now()), 'application/json');
    showToast(t('settings.exportedDataJson'));
  } catch (e) {
    console.error('[settings] json data export failed', e);
    showToast(t('settings.exportFailed'));
  } finally {
    exportingData.value = false;
  }
}

// --- Encrypted backup ---
const showEncrypt = ref(false);
const encPass = ref('');
const encPass2 = ref('');
const encError = ref('');

async function buildBackupJson(): Promise<string> {
  const [dailyStats, monthlyStats, sessions, tabMeta, settings] = await Promise.all([
    repo.getAllDailyStats(),
    repo.getAllMonthlyStats(),
    repo.getAllSessions(),
    repo.getAllTabMeta(),
    getSettings(),
  ]);
  return toJsonBackup({ dailyStats, monthlyStats, sessions, tabMeta, settings }, Date.now());
}

async function exportEncrypted() {
  encError.value = '';
  if (encPass.value.length < MIN_PASSPHRASE) {
    encError.value = t('settings.passTooShort');
    return;
  }
  if (encPass.value !== encPass2.value) {
    encError.value = t('settings.passMismatch');
    return;
  }
  if (exporting.value) return;
  exporting.value = true;
  try {
    const envelope = await encryptToEnvelope(await buildBackupJson(), encPass.value);
    downloadFile(`tabstyr-backup-${dateKey(Date.now())}.enc.json`, envelope, 'application/json');
    showToast(t('settings.exportedEncrypted'));
    showEncrypt.value = false;
    encPass.value = '';
    encPass2.value = '';
  } catch (e) {
    console.error('[settings] encrypted export failed', e);
    showToast(t('settings.encryptionFailed'));
  } finally {
    exporting.value = false;
  }
}

// --- Restore ---
const fileInput = ref<HTMLInputElement | null>(null);
const restoreRaw = ref<string | null>(null); // encrypted text awaiting a passphrase
const restorePass = ref('');
const restoreError = ref('');
const pendingRestore = ref<ParsedBackup | null>(null); // parsed, awaiting confirm
const restoring = ref(false);

function pickRestoreFile() {
  restoreError.value = '';
  fileInput.value?.click();
}

// --- CSV import (seed day-1 data from another tracker; estimated, non-destructive) ---
const csvInput = ref<HTMLInputElement | null>(null);
function pickCsvFile() {
  csvInput.value?.click();
}
async function onCsvFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // allow re-picking the same file
  if (!file) return;
  if (file.size > MAX_BACKUP_BYTES) {
    showToast(t('settings.restoreTooLarge'));
    return;
  }
  try {
    const { stats } = parseCsvImport(await file.text());
    if (!stats.length) {
      showToast(t('settings.importEmpty'));
      return;
    }
    // MAX-merge: seeds days you have no data for, never inflates measured days,
    // idempotent on re-import (see repo.applyDailyStatsMax).
    await repo.applyDailyStatsMax(stats);
    await browser.runtime.sendMessage({ type: 'settings-changed' });
    emit('changed');
    showToast(t('settings.imported', { count: stats.length }));
  } catch (e) {
    console.error('[settings] csv import failed', e);
    showToast(t('settings.importInvalid'));
  }
}

function stageParsed(text: string) {
  try {
    pendingRestore.value = parseBackup(text);
  } catch (e) {
    // Map every parse failure to one generic, localized message rather than
    // surfacing raw library/engine error text to the user.
    console.error('[settings] parse backup failed', e);
    restoreError.value = t('settings.restoreInvalid');
  }
}

async function onRestoreFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // let the same file be picked again later
  if (!file) return;
  restoreError.value = '';
  restoreRaw.value = null;
  restorePass.value = '';
  pendingRestore.value = null;
  // Reject by size before reading — a huge file would freeze the tab in
  // file.text()/JSON.parse() before any per-record cap could apply.
  if (file.size > MAX_BACKUP_BYTES) {
    restoreError.value = t('settings.restoreTooLarge');
    return;
  }
  try {
    const text = await file.text();
    if (isEncryptedEnvelope(text)) restoreRaw.value = text; // prompt for passphrase
    else stageParsed(text);
  } catch (e) {
    console.error('[settings] read backup failed', e);
    restoreError.value = t('settings.restoreReadFailed');
  }
}

async function decryptRestore() {
  restoreError.value = '';
  if (!restoreRaw.value) return;
  try {
    const json = await decryptFromEnvelope(restoreRaw.value, restorePass.value);
    stageParsed(json);
    if (pendingRestore.value) {
      restoreRaw.value = null;
      restorePass.value = '';
    }
  } catch (e) {
    // Wrong passphrase or a corrupted/tampered envelope — one generic message.
    console.error('[settings] decrypt backup failed', e);
    restoreError.value = t('settings.restoreWrongPass');
  }
}

function cancelRestore() {
  restoreRaw.value = null;
  restorePass.value = '';
  pendingRestore.value = null;
  restoreError.value = '';
}

// Don't leave passphrases lingering in memory if the panel unmounts mid-flow.
onBeforeUnmount(() => {
  encPass.value = '';
  encPass2.value = '';
  restorePass.value = '';
  restoreRaw.value = null;
  clearTimeout(toastTimer);
  clearTimeout(saveTimer);
});

// Sync/merge: combine the imported backup with existing data instead of replacing.
// Additive and idempotent (see lib/merge). Local open-tab metadata is kept as-is.
async function confirmMerge() {
  if (!pendingRestore.value || restoring.value) return;
  restoring.value = true;
  try {
    // Strip Vue proxies (structured clone can't clone them) — same as restoreBackup.
    const data: ParsedBackup = JSON.parse(JSON.stringify(pendingRestore.value));
    const [localSessions, localDaily, localMonthly, localTabMeta] = await Promise.all([
      repo.getAllSessions(),
      repo.getAllDailyStats(),
      repo.getAllMonthlyStats(),
      repo.getAllTabMeta(),
    ]);
    const merged = mergeBackup(
      { sessions: localSessions, dailyStats: localDaily, monthlyStats: localMonthly },
      { sessions: data.sessions, dailyStats: data.dailyStats, monthlyStats: data.monthlyStats },
    );
    // One atomic transaction (reuses restore's clear+write); local tabMeta preserved.
    await repo.restoreAll(merged.sessions, merged.dailyStats, localTabMeta, merged.monthlyStats);
    await saveSettings(mergeSettingsMaps(await getSettings(), data.settings) as Partial<Settings>);
    pendingRestore.value = null;
    await browser.runtime.sendMessage({ type: 'settings-changed' });
    emit('changed');
    showToast(t('settings.merged', { sessions: merged.sessions.length }));
  } catch (e) {
    console.error('[settings] merge failed', e);
    showToast(t('settings.restoreFailed'));
  } finally {
    restoring.value = false;
  }
}

async function confirmRestore() {
  if (!pendingRestore.value || restoring.value) return;
  restoring.value = true;
  try {
    const res = await restoreBackup(pendingRestore.value);
    pendingRestore.value = null;
    await browser.runtime.sendMessage({ type: 'settings-changed' });
    emit('changed');
    showToast(t('settings.restored', { days: res.dailyStats, sessions: res.sessions }));
  } catch (e) {
    console.error('[settings] restore failed', e);
    showToast(t('settings.restoreFailed'));
  } finally {
    restoring.value = false;
  }
}

const showWipeModal = ref(false);
const wiping = ref(false);
const wipeModalEl = ref<HTMLElement | null>(null);
const cancelBtn = ref<HTMLButtonElement | null>(null);
const restoreModalEl = ref<HTMLElement | null>(null);
const showRestoreConfirm = computed(() => !!pendingRestore.value);

const restoreCancelBtn = ref<HTMLButtonElement | null>(null);
useFocusTrap(wipeModalEl, showWipeModal);
useFocusTrap(restoreModalEl, showRestoreConfirm);

// The focus trap intentionally doesn't steal initial focus, so — like the wipe
// modal — move focus to the safe Cancel button when this destructive dialog opens.
// Without it a keyboard/screen-reader user gets no announcement and focus is left
// on the now-inert page body (the file input that opened it was just cleared).
watch(showRestoreConfirm, async (open) => {
  if (open) {
    await nextTick();
    restoreCancelBtn.value?.focus();
  }
});

// Focus the safe (Cancel) action when the destructive dialog opens, and allow Esc to close.
watch(showWipeModal, async (open) => {
  if (open) {
    await nextTick();
    cancelBtn.value?.focus();
  }
});
function onModalKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  if (showWipeModal.value && !wiping.value) showWipeModal.value = false;
  else if ((pendingRestore.value || restoreRaw.value) && !restoring.value) cancelRestore();
}
onMounted(() => document.addEventListener('keydown', onModalKey));
onBeforeUnmount(() => document.removeEventListener('keydown', onModalKey));

async function confirmWipe() {
  if (wiping.value) return;
  wiping.value = true;
  try {
    await browser.runtime.sendMessage({ type: 'wipe-data' });
    showWipeModal.value = false;
    showToast(t('settings.wiped'));
    emit('changed'); // reload the dashboard so the cleared state shows
  } catch (e) {
    console.error('[settings] wipe failed', e);
    showToast(t('settings.wipeFailed'));
  } finally {
    wiping.value = false;
  }
}
</script>

<template>
  <div class="tile settings-tile">
    <h2 class="label">{{ t('settings.title') }}</h2>
    <div class="field">
      <span class="field-label">{{ t('settings.language') }}</span>
      <SelectBox
        :model-value="currentLocale"
        :options="LANGUAGE_OPTIONS"
        :label="t('settings.language')"
        wide
        @update:model-value="locale.setLanguage($event)"
      />
    </div>
    <div class="field">
      <span class="field-label">{{ t('settings.theme') }}</span>
      <SelectBox
        :model-value="themeChoice"
        :options="THEME_OPTIONS"
        :label="t('settings.theme')"
        @update:model-value="setTheme($event as 'light' | 'dark')"
      />
    </div>
    <div class="field">
      <span class="field-label">{{ t('settings.staleDays') }}</span>
      <NumberStepper v-model="staleDays" :min="1" :max="60" :label="t('settings.staleDays')" />
    </div>
    <div class="field">
      <span class="field-label">{{ t('settings.idleSeconds') }}</span>
      <NumberStepper v-model="idleSeconds" :min="15" :max="600" :step="15" :label="t('settings.idleSeconds')" />
    </div>
    <p class="field-hint">{{ t('settings.idleHint') }}</p>
    <div class="field check">
      <span class="field-label">{{ t('settings.countAudio') }}</span>
      <ToggleSwitch v-model="audioEnabled" :label="t('settings.countAudio')" />
    </div>
    <div class="field check">
      <span class="field-label">{{ t('settings.notifications') }}</span>
      <ToggleSwitch v-model="notificationsEnabled" :label="t('settings.notifications')" />
    </div>
    <p class="field-hint">{{ t('settings.notificationsHint') }}</p>
    <div class="field">
      <span class="field-label">{{ t('settings.sessionAlert') }}</span>
      <NumberStepper v-model="sessionAlertMinutes" :min="0" :max="180" :step="5" :label="t('settings.sessionAlert')" />
    </div>
    <p class="field-hint">{{ t('settings.sessionAlertHint') }}</p>
    <div class="field">
      <span class="field-label">{{ t('settings.focusTarget') }}</span>
      <NumberStepper v-model="focusTarget" :min="10" :max="90" :step="5" :label="t('settings.focusTarget')" />
    </div>
    <p class="field-hint">{{ t('settings.focusTargetHint') }}</p>
    <div class="actions">
      <button type="button" class="btn btn-ghost btn-sm" @click="replayOnboarding">{{ t('settings.showIntro') }}</button>
      <button class="btn btn-danger btn-sm" @click="showWipeModal = true">{{ t('settings.wipe') }}</button>
    </div>

    <div class="export">
      <span class="field-label">{{ t('settings.backupRestore') }}</span>
      <p class="rules-hint">{{ t('settings.backupNote') }}</p>
      <p class="rules-hint">{{ t('settings.uninstallHint') }}</p>
      <div class="export-btns">
        <button class="btn btn-ghost btn-sm btn-block" :disabled="exporting" @click="exportData()">{{ t('settings.exportJson') }}</button>
        <div class="export-btns-row">
          <button class="btn btn-ghost btn-sm" :disabled="exporting" :aria-expanded="showEncrypt" @click="showEncrypt = !showEncrypt">{{ t('settings.encrypted') }}</button>
          <button class="btn btn-ghost btn-sm" :disabled="exporting" @click="pickRestoreFile">{{ t('settings.restore') }}</button>
          <button class="btn btn-ghost btn-sm" :disabled="exporting" @click="pickCsvFile">{{ t('settings.importCsv') }}</button>
        </div>
      </div>
      <p class="rules-hint">{{ t('settings.importCsvHint') }}</p>
      <input ref="fileInput" type="file" accept="application/json,.json" class="sr-only" aria-hidden="true" tabindex="-1" @change="onRestoreFile" />
      <input ref="csvInput" type="file" accept="text/csv,.csv" class="sr-only" aria-hidden="true" tabindex="-1" @change="onCsvFile" />

      <form v-if="showEncrypt" class="enc-form" @submit.prevent="exportEncrypted">
        <p class="rules-hint">{{ t('settings.encHint') }}</p>
        <input v-model="encPass" type="password" class="rule-input" :placeholder="t('settings.passphrase')" :aria-label="t('settings.passphrase')" autocomplete="new-password" />
        <input v-model="encPass2" type="password" class="rule-input" :placeholder="t('settings.confirmPassphrase')" :aria-label="t('settings.confirmPassphrase')" autocomplete="new-password" />
        <div class="enc-actions">
          <button type="submit" class="btn btn-primary btn-sm" :disabled="exporting">{{ t('settings.downloadEncrypted') }}</button>
          <button type="button" class="cancel-link" @click="showEncrypt = false">{{ t('settings.cancel') }}</button>
        </div>
        <p v-if="encError" class="rule-error" role="alert">{{ encError }}</p>
      </form>

      <form v-if="restoreRaw" class="enc-form" @submit.prevent="decryptRestore">
        <p class="rules-hint">{{ t('settings.restoreEncryptedPrompt') }}</p>
        <input v-model="restorePass" type="password" class="rule-input" :placeholder="t('settings.passphrase')" :aria-label="t('settings.passphrase')" autocomplete="off" />
        <div class="enc-actions">
          <button type="submit" class="btn btn-ghost btn-sm">{{ t('settings.decrypt') }}</button>
          <button type="button" class="cancel-link" @click="cancelRestore">{{ t('settings.cancel') }}</button>
        </div>
        <p v-if="restoreError" class="rule-error" role="alert">{{ restoreError }}</p>
      </form>
      <p v-else-if="restoreError" class="rule-error" role="alert">{{ restoreError }}</p>
    </div>

    <div class="export">
      <span class="field-label">{{ t('settings.dataExport') }}</span>
      <p class="rules-hint">{{ t('settings.dataExportHint') }}</p>
      <div class="export-btns">
        <div class="export-btns-row">
          <button :disabled="exportingData" @click="exportDataCsv()">{{ t('settings.exportCsv') }}</button>
          <button :disabled="exportingData" @click="exportDataJson()">{{ t('settings.exportDataJson') }}</button>
        </div>
      </div>
    </div>

    <!-- Restore confirmation (destructive) -->
    <Teleport to="body">
    <div v-if="pendingRestore" class="backdrop" @click.self="cancelRestore">
      <div ref="restoreModalEl" class="modal" role="dialog" aria-modal="true" :aria-label="t('settings.confirmRestoreAria')">
        <h3 class="modal-title">{{ t('settings.replaceTitle') }}</h3>
        <p class="modal-body">{{ t('settings.replaceBody', {
          days: pendingRestore.dailyStats.length,
          sessions: pendingRestore.sessions.length,
          from: pendingRestore.exportedAt ? t('settings.replaceBodyFrom', { date: new Date(pendingRestore.exportedAt).toLocaleDateString(getDateLocale()) }) : '',
        }) }}</p>
        <p class="modal-hint">{{ t('settings.mergeHint') }}</p>
        <div class="modal-actions">
          <button ref="restoreCancelBtn" class="btn btn-ghost btn-sm" :disabled="restoring" @click="cancelRestore">{{ t('settings.cancel') }}</button>
          <button class="btn btn-primary btn-sm" :disabled="restoring" @click="confirmMerge">
            {{ restoring ? t('settings.restoring') : t('settings.mergeData') }}
          </button>
          <button class="btn btn-danger-solid btn-sm" :disabled="restoring" @click="confirmRestore">
            {{ restoring ? t('settings.restoring') : t('settings.replaceData') }}
          </button>
        </div>
      </div>
    </div>
    </Teleport>

    <!-- Wipe confirmation -->
    <Teleport to="body">
    <div v-if="showWipeModal" class="backdrop" @click.self="showWipeModal = false">
      <div ref="wipeModalEl" class="modal" role="dialog" aria-modal="true" :aria-label="t('settings.confirmWipeAria')">
        <h3 class="modal-title">{{ t('settings.wipeTitle') }}</h3>
        <p class="modal-body">{{ t('settings.wipeBody') }}</p>
        <div class="modal-actions">
          <button ref="cancelBtn" class="btn btn-ghost btn-sm" :disabled="wiping" @click="showWipeModal = false">{{ t('settings.cancel') }}</button>
          <button class="btn btn-danger-solid btn-sm" :disabled="wiping" @click="confirmWipe">
            {{ wiping ? t('settings.wiping') : t('settings.deleteEverything') }}
          </button>
        </div>
      </div>
    </div>
    </Teleport>

    <!-- Live region is always present so screen readers announce text swaps
         (wipe/restore/export results). Only the inner toast animates in/out. -->
    <div class="toast-host" role="status" aria-live="polite">
      <Transition name="toast">
        <div v-if="toast" class="toast">{{ toast }}</div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.settings-tile {
  position: relative;
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: 10px;
  /* Size to our own content instead of stretching to the tile beside us
     (Open tabs by time) in the same bento row. */
  align-self: start;
}
.field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-sm);
  gap: 10px;
  min-height: 32px;
  /* In a narrow bento track the label + control (e.g. the 190px language
     SelectBox) can't sit on one line; wrap the control below instead of
     overflowing the tile. */
  flex-wrap: wrap;
}
.field-label {
  color: var(--text-2);
}
.field-hint {
  margin: -4px 0 2px;
  font-size: var(--text-xs);
  line-height: 1.45;
  color: var(--text-3);
}
.actions {
  display: flex;
  flex-wrap: wrap; /* long i18n labels wrap to a second row instead of overflowing */
  gap: var(--sp-2);
  justify-content: space-between;
  margin-top: var(--sp-1);
}
/* Base styling for raw buttons only. Excludes .btn (shared system in
   theme.css) and .toggle (the ToggleSwitch child's root <button>, which Vue
   scoped styles otherwise bleed onto — this rule would tie on specificity and
   override the switch's own pill radius). */
button:not(.btn):not(.toggle) {
  border: none;
  border-radius: var(--radius-sm);
  padding: 7px 14px;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.rules-hint {
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.45;
  color: var(--text-3);
}
.rule-input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  font-size: var(--text-sm);
  font-family: inherit;
}
.rule-input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.rule-error {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--warn);
}
.export {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin-top: var(--sp-2);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--divider);
}
.export-btns {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
/* Export JSON sits full-width on top; the actions wrap onto the row below. */
.export-btns-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
/* Row actions share width and wrap on narrow layouts (look comes from .btn). */
.export-btns-row .btn {
  flex: 1 1 auto;
  min-width: 104px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.enc-form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin-top: var(--sp-1);
  padding: var(--sp-3);
  background: var(--card-strong);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.enc-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cancel-link {
  background: transparent;
  border: none;
  color: var(--text-3);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  padding: var(--sp-1);
}
.cancel-link:hover { color: var(--text); }
.cancel-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Wipe modal */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-4);
  background: var(--backdrop);
  backdrop-filter: blur(3px);
}
.modal {
  width: min(380px, 100%);
  background: var(--popover);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-modal);
  padding: 20px;
}
.modal-title {
  margin: 0 0 var(--sp-2);
  font-size: 16px;
  font-weight: 700;
}
.modal-body {
  margin: 0 0 18px;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--text-2);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-2);
}
.modal-hint {
  margin: -8px 0 var(--sp-4);
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-3);
}

/* Toast */
.toast {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 70;
  background: var(--popover);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: var(--text-sm);
  font-weight: 600;
  padding: 10px 18px;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-pop);
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
