<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { getSettings, saveSettings } from '@/lib/settings';
import { useTheme } from '@/composables/useTheme';
import type { ThemeSetting } from '@/lib/types';

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
    <label>
      Theme
      <select v-model="themeChoice">
        <option value="system">System</option>
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </select>
    </label>
    <label>
      Stale after (days)
      <input v-model.number="staleDays" type="number" min="1" max="60" />
    </label>
    <label>
      Idle timeout (seconds)
      <input v-model.number="idleSeconds" type="number" min="15" max="600" />
    </label>
    <label class="check">
      <input v-model="audioEnabled" type="checkbox" />
      Count background audio
    </label>
    <div class="actions">
      <button class="save" @click="save">{{ saved ? 'Saved ✓' : 'Save' }}</button>
      <button class="wipe" @click="wipe">Wipe all data</button>
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
label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  gap: 10px;
  color: var(--text-2);
}
input[type='number'],
select {
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text);
  border-radius: 7px;
  padding: 5px 8px;
  font-size: 13px;
  font-family: inherit;
}
input[type='number'] {
  width: 70px;
}
.check {
  justify-content: flex-start;
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
</style>
