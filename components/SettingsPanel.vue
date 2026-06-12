<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { getSettings, saveSettings } from '@/lib/settings';
import { useTheme } from '@/composables/useTheme';
import * as repo from '@/lib/db/repo';
import { dailyStatsToCsv, downloadFile, sessionsToCsv, toJsonBackup } from '@/lib/export';
import { dateKey } from '@/lib/time';
import type { ThemeSetting } from '@/lib/types';
import SelectBox from '@/components/ui/SelectBox.vue';
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue';
import NumberStepper from '@/components/ui/NumberStepper.vue';

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const emit = defineEmits<{ changed: [] }>();
const theme = useTheme();

const staleDays = ref(3);
const idleSeconds = ref(60);
const audioEnabled = ref(true);
const themeChoice = ref<ThemeSetting>('system');
const saved = ref(false);

onMounted(async () => {
  const s = await getSettings();
  staleDays.value = s.staleDays;
  idleSeconds.value = s.idleSeconds;
  audioEnabled.value = s.audioEnabled;
  themeChoice.value = s.theme;
});

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
    saved.value = true;
    setTimeout(() => (saved.value = false), 2000);
    emit('changed');
  } catch (e) {
    console.error('[settings] save failed', e);
  }
}

const exporting = ref(false);

async function exportData(kind: 'json' | 'daily' | 'sessions') {
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
      downloadFile(`tab-time-backup-${stamp}.json`, json, 'application/json');
    } else if (kind === 'daily') {
      downloadFile(`tab-time-daily-${stamp}.csv`, dailyStatsToCsv(await repo.getAllDailyStats()), 'text/csv');
    } else {
      downloadFile(`tab-time-sessions-${stamp}.csv`, sessionsToCsv(await repo.getAllSessions()), 'text/csv');
    }
  } catch (e) {
    console.error('[settings] export failed', e);
  } finally {
    exporting.value = false;
  }
}

async function wipe() {
  if (!confirm('Delete ALL tracked data? This cannot be undone.')) return;
  try {
    await browser.runtime.sendMessage({ type: 'wipe-data' });
    emit('changed');
  } catch (e) {
    console.error('[settings] wipe failed', e);
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
        @update:model-value="themeChoice = $event as ThemeSetting"
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
      <button class="save" @click="save">{{ saved ? 'Saved ✓' : 'Save' }}</button>
      <button class="wipe" @click="wipe">Wipe all data</button>
    </div>

    <div class="export">
      <span class="field-label">Export</span>
      <div class="export-btns">
        <button :disabled="exporting" @click="exportData('json')">JSON backup</button>
        <button :disabled="exporting" @click="exportData('daily')">CSV · daily</button>
        <button :disabled="exporting" @click="exportData('sessions')">CSV · sessions</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-tile {
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
}
.wipe {
  background: transparent;
  color: var(--warn);
  border: 1px solid var(--warn-border);
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
  flex: 1;
  min-width: 96px;
  background: var(--card-strong);
  color: var(--text-2);
  border: 1px solid var(--border);
  font-weight: 600;
}
.export-btns button:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--text);
}
.export-btns button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
