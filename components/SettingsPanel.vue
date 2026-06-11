<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { getSettings, saveSettings } from '@/lib/settings';

const emit = defineEmits<{ changed: [] }>();

const staleDays = ref(3);
const idleSeconds = ref(60);
const audioEnabled = ref(true);
const saved = ref(false);

onMounted(async () => {
  const s = await getSettings();
  staleDays.value = s.staleDays;
  idleSeconds.value = s.idleSeconds;
  audioEnabled.value = s.audioEnabled;
});

async function save() {
  await saveSettings({
    staleDays: Math.max(1, staleDays.value),
    idleSeconds: Math.max(15, idleSeconds.value),
    audioEnabled: audioEnabled.value,
  });
  await browser.runtime.sendMessage({ type: 'settings-changed' });
  saved.value = true;
  setTimeout(() => (saved.value = false), 2000);
  emit('changed');
}

async function wipe() {
  if (!confirm('Delete ALL tracked data? This cannot be undone.')) return;
  await browser.runtime.sendMessage({ type: 'wipe-data' });
  emit('changed');
}
</script>

<template>
  <div class="tile settings-tile">
    <span class="label">Settings</span>
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
.tile {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
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
}
input[type='number'] {
  width: 70px;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  padding: 5px 8px;
  font-size: 13px;
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
}
button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.save {
  background: var(--color-ink);
  color: #fff;
}
.wipe {
  background: transparent;
  color: var(--color-warn);
  border: 1px solid var(--color-warn-border);
}
</style>
