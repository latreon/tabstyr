<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { browser } from 'wxt/browser';
import { getSettings, saveSettings } from '@/lib/settings';
import { CATEGORIES, CATEGORY_META, CATEGORY_PRODUCTIVITY, PRODUCTIVITY, type Category, type CategoryRule, type Productivity } from '@/lib/categories';
import { useTheme } from '@/composables/useTheme';
import { useLocale } from '@/composables/useLocale';
import { useFocusTrap } from '@/composables/useFocusTrap';
import { SUPPORTED_LOCALES, resolveLocale } from '@/lib/i18n';
import * as repo from '@/lib/db/repo';
import { downloadFile, toJsonBackup } from '@/lib/export';
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
const focusTarget = ref(50);
// Per-category daily budgets in minutes (only positive entries are kept).
const budgets = ref<Partial<Record<Category, number>>>({});
const themeChoice = ref<'light' | 'dark'>('light');
// Gate auto-save until the initial values are loaded, so seeding the refs in
// onMounted doesn't immediately persist defaults over stored settings.
const loaded = ref(false);
let saveTimer: ReturnType<typeof setTimeout> | undefined;

const CATEGORY_OPTIONS = computed(() => CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) })));
const rules = ref<CategoryRule[]>([]);
const newPattern = ref('');
const newCategory = ref<Category>('Work');
const ruleError = ref('');

// Per-category productive/distracting/neutral classification (drives Focus %).
const categoryProductivity = ref<Record<Category, Productivity>>({ ...CATEGORY_PRODUCTIVITY });
const PRODUCTIVITY_OPTIONS = computed(() =>
  PRODUCTIVITY.map((p) => ({ value: p, label: t(`productivity.${p}`) })),
);

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
  // If still on the implicit "system" default, show the resolved theme in the picker.
  themeChoice.value = s.theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : s.theme;
  rules.value = s.categoryRules;
  categoryProductivity.value = { ...s.categoryProductivity };
  focusTarget.value = s.focusTarget;
  budgets.value = { ...s.categoryBudgets };
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
      focusTarget: focusTarget.value,
      categoryBudgets: budgets.value,
    });
    await browser.runtime.sendMessage({ type: 'settings-changed' });
    emit('changed'); // refresh the dashboard so focus target + budget pills update
    showToast(t('settings.saved'));
  } catch (e) {
    console.error('[settings] save failed', e);
    showToast(t('settings.saveFailed'));
  }
}

watch([staleDays, idleSeconds, audioEnabled, notificationsEnabled, focusTarget], () => {
  if (!loaded.value) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistSettings, 400);
});
// Budgets are an object — deep-watch and debounce onto the same persist path.
watch(budgets, () => {
  if (!loaded.value) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistSettings, 400);
}, { deep: true });

// Set/clear a category's daily budget (minutes). Empty or non-positive removes it.
function onBudgetInput(category: Category, event: Event) {
  const raw = (event.target as HTMLInputElement).value.trim();
  const n = raw === '' ? 0 : Math.floor(Number(raw));
  const next = { ...budgets.value };
  if (Number.isFinite(n) && n > 0) next[category] = Math.min(n, 1440);
  else delete next[category];
  budgets.value = next;
}

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

async function setProductivity(category: Category, value: Productivity) {
  const prev = categoryProductivity.value;
  categoryProductivity.value = { ...prev, [category]: value };
  try {
    const saved = await saveSettings({ categoryProductivity: categoryProductivity.value });
    categoryProductivity.value = { ...saved.categoryProductivity };
    await browser.runtime.sendMessage({ type: 'settings-changed' });
    emit('changed');
    showToast(t('settings.saved'));
  } catch (e) {
    console.error('[settings] productivity save failed', e);
    categoryProductivity.value = prev; // revert the optimistic change
    showToast(t('settings.saveFailed'));
  }
}

async function addRule() {
  const pattern = newPattern.value.trim().toLowerCase();
  ruleError.value = '';
  if (!pattern) return;
  if (rules.value.some((r) => r.pattern === pattern)) {
    ruleError.value = t('settings.ruleExists');
    return;
  }
  const next = [...rules.value, { pattern, category: newCategory.value }];
  try {
    const saved = await saveSettings({ categoryRules: next });
    rules.value = saved.categoryRules;
    newPattern.value = '';
    await browser.runtime.sendMessage({ type: 'settings-changed' });
    emit('changed');
    showToast(t('settings.ruleAdded'));
  } catch (e) {
    console.error('[settings] add rule failed', e);
    showToast(t('settings.ruleAddFailed'));
  }
}

async function removeRule(pattern: string) {
  const next = rules.value.filter((r) => r.pattern !== pattern);
  try {
    const saved = await saveSettings({ categoryRules: next });
    rules.value = saved.categoryRules;
    await browser.runtime.sendMessage({ type: 'settings-changed' });
    emit('changed');
  } catch (e) {
    console.error('[settings] remove rule failed', e);
    showToast(t('settings.ruleRemoveFailed'));
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
    rules.value = (await getSettings()).categoryRules;
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
    rules.value = (await getSettings()).categoryRules; // reflect any restored rules
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

useFocusTrap(wipeModalEl, showWipeModal);
useFocusTrap(restoreModalEl, showRestoreConfirm);

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
      <span class="field-label">{{ t('settings.focusTarget') }}</span>
      <NumberStepper v-model="focusTarget" :min="10" :max="90" :step="5" :label="t('settings.focusTarget')" />
    </div>
    <p class="field-hint">{{ t('settings.focusTargetHint') }}</p>
    <div class="actions">
      <button type="button" class="intro-link" @click="replayOnboarding">{{ t('settings.showIntro') }}</button>
      <button class="wipe" @click="showWipeModal = true">{{ t('settings.wipe') }}</button>
    </div>

    <div class="rules focus-cats">
      <span class="field-label">{{ t('settings.focusCategories') }}</span>
      <p class="rules-hint">{{ t('settings.focusCategoriesHint') }}</p>
      <ul class="prod-list">
        <li v-for="c in CATEGORIES" :key="c" class="prod-row">
          <span class="prod-cat">
            <span class="cat-dot" :style="{ background: CATEGORY_META[c].color }" aria-hidden="true" />
            {{ t(`categories.${c}`) }}
          </span>
          <span class="prod-controls">
            <SelectBox
              :model-value="categoryProductivity[c]"
              :options="PRODUCTIVITY_OPTIONS"
              :label="t('settings.productivityForAria', { category: t(`categories.${c}`) })"
              @update:model-value="setProductivity(c, $event as Productivity)"
            />
            <span class="budget-field">
              <input
                class="budget-input"
                type="number"
                min="0"
                max="1440"
                inputmode="numeric"
                :value="budgets[c] ?? ''"
                :placeholder="t('settings.budgetOff')"
                :aria-label="t('settings.budgetForAria', { category: t(`categories.${c}`) })"
                @input="onBudgetInput(c, $event)"
              />
              <span class="budget-unit" aria-hidden="true">{{ t('settings.budgetUnit') }}</span>
            </span>
          </span>
        </li>
      </ul>
      <p class="rules-hint">{{ t('settings.dailyBudgetsHint') }}</p>
    </div>

    <div class="rules">
      <span class="field-label">{{ t('settings.customRules') }}</span>
      <p class="rules-hint">{{ t('settings.rulesHint') }}</p>

      <ul v-if="rules.length" class="rule-list">
        <li v-for="r in rules" :key="r.pattern" class="rule">
          <code class="rule-pattern">{{ r.pattern }}</code>
          <span class="rule-arrow" aria-hidden="true">→</span>
          <span class="rule-cat">{{ t(`categories.${r.category}`) }}</span>
          <button class="rule-del" :aria-label="t('settings.removeRuleAria', { pattern: r.pattern })" @click="removeRule(r.pattern)">✕</button>
        </li>
      </ul>

      <form class="rule-add" @submit.prevent="addRule">
        <input
          v-model="newPattern"
          class="rule-input"
          type="text"
          :placeholder="t('settings.rulePlaceholder')"
          :aria-label="t('settings.customRules')"
          maxlength="100"
        />
        <SelectBox
          :model-value="newCategory"
          :options="CATEGORY_OPTIONS"
          :label="t('settings.categoryForRuleAria')"
          @update:model-value="newCategory = $event as Category"
        />
        <button type="submit" class="rule-add-btn" :disabled="!newPattern.trim()">{{ t('settings.add') }}</button>
      </form>
      <p v-if="ruleError" class="rule-error" role="alert">{{ ruleError }}</p>
    </div>

    <div class="export">
      <span class="field-label">{{ t('settings.backupRestore') }}</span>
      <p class="rules-hint">{{ t('settings.backupNote') }}</p>
      <div class="export-btns">
        <button class="export-json" :disabled="exporting" @click="exportData()">{{ t('settings.exportJson') }}</button>
        <div class="export-btns-row">
          <button :disabled="exporting" :aria-expanded="showEncrypt" @click="showEncrypt = !showEncrypt">{{ t('settings.encrypted') }}</button>
          <button :disabled="exporting" @click="pickRestoreFile">{{ t('settings.restore') }}</button>
          <button :disabled="exporting" @click="pickCsvFile">{{ t('settings.importCsv') }}</button>
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
          <button type="submit" class="rule-add-btn primary" :disabled="exporting">{{ t('settings.downloadEncrypted') }}</button>
          <button type="button" class="cancel-link" @click="showEncrypt = false">{{ t('settings.cancel') }}</button>
        </div>
        <p v-if="encError" class="rule-error" role="alert">{{ encError }}</p>
      </form>

      <form v-if="restoreRaw" class="enc-form" @submit.prevent="decryptRestore">
        <p class="rules-hint">{{ t('settings.restoreEncryptedPrompt') }}</p>
        <input v-model="restorePass" type="password" class="rule-input" :placeholder="t('settings.passphrase')" :aria-label="t('settings.passphrase')" autocomplete="off" />
        <div class="enc-actions">
          <button type="submit" class="rule-add-btn">{{ t('settings.decrypt') }}</button>
          <button type="button" class="cancel-link" @click="cancelRestore">{{ t('settings.cancel') }}</button>
        </div>
        <p v-if="restoreError" class="rule-error" role="alert">{{ restoreError }}</p>
      </form>
      <p v-else-if="restoreError" class="rule-error" role="alert">{{ restoreError }}</p>
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
          <button class="cancel" :disabled="restoring" @click="cancelRestore">{{ t('settings.cancel') }}</button>
          <button class="merge" :disabled="restoring" @click="confirmMerge">
            {{ restoring ? t('settings.restoring') : t('settings.mergeData') }}
          </button>
          <button class="danger" :disabled="restoring" @click="confirmRestore">
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
          <button ref="cancelBtn" class="cancel" :disabled="wiping" @click="showWipeModal = false">{{ t('settings.cancel') }}</button>
          <button class="danger" :disabled="wiping" @click="confirmWipe">
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
  padding: 16px;
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
  font-size: 13px;
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
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-3);
}
.actions {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
}
button {
  border: none;
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.intro-link {
  background: transparent;
  color: var(--text-3);
  border: 1px solid var(--border);
  transition: border-color 150ms ease, color 150ms ease;
}
.intro-link:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.wipe {
  background: transparent;
  color: var(--warn);
  border: 1px solid var(--warn-border);
  transition: background 150ms ease, border-color 150ms ease;
}
.wipe:hover {
  background: var(--warn-bg);
  border-color: var(--warn);
}
.rules {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--divider);
}
.rules-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-3);
}
.prod-list {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.prod-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.prod-cat {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-2);
}
.prod-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.budget-field {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.budget-input {
  width: 56px;
  height: 30px;
  box-sizing: border-box;
  padding: 0 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text);
  font: inherit;
  font-size: 12px;
  text-align: right;
}
.budget-input::placeholder { color: var(--text-3); }
.budget-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.budget-unit { font-size: 11px; color: var(--text-3); }
@media (max-width: 420px) {
  .prod-row { flex-wrap: wrap; }
}
.cat-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
}
.rule-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rule {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.rule-pattern {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: var(--card-strong);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 2px 6px;
  color: var(--text);
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rule-arrow {
  color: var(--text-3);
}
.rule-cat {
  font-weight: 600;
  color: var(--text-2);
}
.rule-del {
  margin-left: auto;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-3);
  border-radius: 6px;
  width: 24px;
  height: 24px;
  padding: 0;
  font-size: 11px;
  cursor: pointer;
}
.rule-del:hover {
  border-color: var(--warn);
  color: var(--warn);
}
.rule-add {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.rule-input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
  font-family: inherit;
}
.rule-input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.rule-add-btn {
  background: var(--card-strong);
  color: var(--text-2);
  border: 1px solid var(--border);
}
.rule-add-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}
.rule-add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rule-error {
  margin: 0;
  font-size: 11px;
  color: var(--warn);
}
.export {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--divider);
}
.export-btns {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.export-btns button {
  /* Transparent, bordered look — matches the "Show intro again" button. */
  background: transparent;
  color: var(--text-2);
  border: 1px solid var(--border);
  font-weight: 600;
  /* overflow-wrap is the last-resort break for long locales (ru/tr/de). */
  overflow-wrap: anywhere;
}
/* Export JSON sits full-width on top; Encrypted + Restore share the row below. */
.export-json {
  width: 100%;
}
.export-btns-row {
  display: flex;
  gap: 8px;
}
.export-btns-row button {
  flex: 1;
  min-width: 0;
}
.export-btns button:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}
.export-btns button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
/* Download-encrypted: filled primary so the actual download action stands out. */
.rule-add-btn.primary {
  background: var(--accent-grad-strong);
  color: var(--on-accent);
  border-color: transparent;
}
.rule-add-btn.primary:hover:not(:disabled) {
  filter: brightness(1.08);
  border-color: transparent;
  color: var(--on-accent);
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
  gap: 8px;
  margin-top: 4px;
  padding: 12px;
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
  padding: 4px;
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
  padding: 16px;
  background: rgba(8, 8, 16, 0.55);
  backdrop-filter: blur(3px);
}
.modal {
  width: min(380px, 100%);
  background: var(--popover);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  padding: 20px;
}
.modal-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 700;
}
.modal-body {
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-2);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.cancel {
  background: var(--card-strong);
  border: 1px solid var(--border);
  color: var(--text-2);
}
.danger {
  background: var(--negative);
  color: #fff;
}
.merge {
  background: var(--accent-grad-strong, var(--accent));
  color: var(--on-accent, #fff);
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.merge:hover:not(:disabled) { filter: brightness(1.08); }
.merge:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.danger:disabled,
.cancel:disabled,
.merge:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.modal-hint {
  margin: -8px 0 16px;
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
  font-size: 13px;
  font-weight: 600;
  padding: 10px 18px;
  border-radius: 999px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3);
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
