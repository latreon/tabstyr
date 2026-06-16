<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { getSettings, saveSettings } from '@/lib/settings';
import { CATEGORIES, type Category, type CategoryRule } from '@/lib/categories';
import { useTheme } from '@/composables/useTheme';
import * as repo from '@/lib/db/repo';
import { dailyStatsToCsv, downloadFile, toJsonBackup } from '@/lib/export';
import { dateKey } from '@/lib/time';
import type { ThemeSetting } from '@/lib/types';
import SelectBox from '@/components/ui/SelectBox.vue';
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue';
import NumberStepper from '@/components/ui/NumberStepper.vue';

// Only explicit choices are offered; "system" stays the default until the user picks.
const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const emit = defineEmits<{ changed: [] }>();
const theme = useTheme();

const staleDays = ref(3);
const idleSeconds = ref(60);
const audioEnabled = ref(true);
const themeChoice = ref<'light' | 'dark'>('light');

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c, label: c }));
const rules = ref<CategoryRule[]>([]);
const newPattern = ref('');
const newCategory = ref<Category>('Work');
const ruleError = ref('');

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
  // If still on the implicit "system" default, show the resolved theme in the picker.
  themeChoice.value = s.theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : s.theme;
  rules.value = s.categoryRules;
});

async function addRule() {
  const pattern = newPattern.value.trim().toLowerCase();
  ruleError.value = '';
  if (!pattern) return;
  if (rules.value.some((r) => r.pattern === pattern)) {
    ruleError.value = 'That pattern already has a rule.';
    return;
  }
  const next = [...rules.value, { pattern, category: newCategory.value }];
  try {
    const saved = await saveSettings({ categoryRules: next });
    rules.value = saved.categoryRules;
    newPattern.value = '';
    await browser.runtime.sendMessage({ type: 'settings-changed' });
    emit('changed');
    showToast('Rule added');
  } catch (e) {
    console.error('[settings] add rule failed', e);
    showToast('Could not add rule');
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
    showToast('Could not remove rule');
  }
}

async function save() {
  try {
    staleDays.value = Math.max(1, staleDays.value);
    idleSeconds.value = Math.max(15, idleSeconds.value);
    await saveSettings({
      staleDays: staleDays.value,
      idleSeconds: idleSeconds.value,
      audioEnabled: audioEnabled.value,
    });
    await theme.set(themeChoice.value);
    await browser.runtime.sendMessage({ type: 'settings-changed' });
    showToast('Settings saved');
  } catch (e) {
    console.error('[settings] save failed', e);
    showToast('Could not save settings');
  }
}

const exporting = ref(false);

async function exportData(kind: 'json' | 'csv') {
  if (exporting.value) return;
  exporting.value = true;
  try {
    const stamp = dateKey(Date.now());
    if (kind === 'json') {
      const [dailyStats, sessions, tabMeta, settings] = await Promise.all([
        repo.getAllDailyStats(),
        repo.getAllSessions(),
        repo.getAllTabMeta(),
        getSettings(),
      ]);
      const json = toJsonBackup({ dailyStats, sessions, tabMeta, settings }, Date.now());
      downloadFile(`tabstyr-backup-${stamp}.json`, json, 'application/json');
      showToast('Exported JSON backup');
    } else {
      const csv = dailyStatsToCsv(await repo.getAllDailyStats());
      downloadFile(`tabstyr-${stamp}.csv`, csv, 'text/csv');
      showToast('Exported CSV');
    }
  } catch (e) {
    console.error('[settings] export failed', e);
    showToast('Export failed');
  } finally {
    exporting.value = false;
  }
}

const showWipeModal = ref(false);
const wiping = ref(false);

async function confirmWipe() {
  if (wiping.value) return;
  wiping.value = true;
  try {
    await browser.runtime.sendMessage({ type: 'wipe-data' });
    showWipeModal.value = false;
    showToast('All data wiped');
    emit('changed'); // reload the dashboard so the cleared state shows
  } catch (e) {
    console.error('[settings] wipe failed', e);
    showToast('Wipe failed');
  } finally {
    wiping.value = false;
  }
}
</script>

<template>
  <div class="tile settings-tile">
    <span class="label">Settings</span>
    <div class="field">
      <span class="field-label">Theme</span>
      <SelectBox
        :model-value="themeChoice"
        :options="THEME_OPTIONS"
        label="Theme"
        @update:model-value="themeChoice = $event as 'light' | 'dark'"
      />
    </div>
    <div class="field">
      <span class="field-label">Stale after (days)</span>
      <NumberStepper v-model="staleDays" :min="1" :max="60" label="Stale after (days)" />
    </div>
    <div class="field">
      <span class="field-label">Idle timeout (seconds)</span>
      <NumberStepper v-model="idleSeconds" :min="15" :max="600" :step="15" label="Idle timeout (seconds)" />
    </div>
    <div class="field check">
      <span class="field-label">Count background audio</span>
      <ToggleSwitch v-model="audioEnabled" label="Count background audio" />
    </div>
    <div class="actions">
      <button class="save" @click="save">Save</button>
      <button class="wipe" @click="showWipeModal = true">Wipe all data</button>
    </div>

    <div class="rules">
      <span class="field-label">Custom category rules</span>
      <p class="rules-hint">Most popular sites are recognized automatically. Add a rule only for one we don't classify yet: any address containing your text goes to that category (checked before the built-in rules).</p>

      <ul v-if="rules.length" class="rule-list">
        <li v-for="r in rules" :key="r.pattern" class="rule">
          <code class="rule-pattern">{{ r.pattern }}</code>
          <span class="rule-arrow" aria-hidden="true">→</span>
          <span class="rule-cat">{{ r.category }}</span>
          <button class="rule-del" :aria-label="`Remove rule for ${r.pattern}`" @click="removeRule(r.pattern)">✕</button>
        </li>
      </ul>

      <form class="rule-add" @submit.prevent="addRule">
        <input
          v-model="newPattern"
          class="rule-input"
          type="text"
          placeholder="e.g. yandex"
          aria-label="Domain contains"
          maxlength="100"
        />
        <SelectBox
          :model-value="newCategory"
          :options="CATEGORY_OPTIONS"
          label="Category for rule"
          @update:model-value="newCategory = $event as Category"
        />
        <button type="submit" class="rule-add-btn" :disabled="!newPattern.trim()">Add</button>
      </form>
      <p v-if="ruleError" class="rule-error">{{ ruleError }}</p>
    </div>

    <div class="export">
      <span class="field-label">Export</span>
      <div class="export-btns">
        <button :disabled="exporting" @click="exportData('json')">Export JSON</button>
        <button :disabled="exporting" @click="exportData('csv')">Export CSV</button>
      </div>
    </div>

    <!-- Wipe confirmation -->
    <div v-if="showWipeModal" class="backdrop" @click.self="showWipeModal = false">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Confirm wipe all data">
        <h3 class="modal-title">Delete all data?</h3>
        <p class="modal-body">
          This permanently removes every session, daily total, and tab record stored on this
          device. Settings are kept. This cannot be undone.
        </p>
        <div class="modal-actions">
          <button class="cancel" :disabled="wiping" @click="showWipeModal = false">Cancel</button>
          <button class="danger" :disabled="wiping" @click="confirmWipe">
            {{ wiping ? 'Wiping…' : 'Delete everything' }}
          </button>
        </div>
      </div>
    </div>

    <Transition name="toast">
      <div v-if="toast" class="toast" role="status" aria-live="polite">{{ toast }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.settings-tile {
  position: relative;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  gap: 10px;
  min-height: 32px;
}
.field-label {
  color: var(--text-2);
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
.save {
  background: var(--accent-gradient);
  color: var(--on-accent);
  transition: filter 150ms ease;
}
.save:hover {
  filter: brightness(1.08);
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
  flex-wrap: wrap;
  gap: 8px;
}
.export-btns button {
  min-width: 96px;
}
.export-btns button {
  flex: 1;
  background: var(--card-strong);
  color: var(--text-2);
  border: 1px solid var(--border);
  font-weight: 600;
}
.export-btns button:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}
.export-btns button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

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
.danger:disabled,
.cancel:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
