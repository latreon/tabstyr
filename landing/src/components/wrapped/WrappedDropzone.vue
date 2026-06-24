<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '@/i18n';
import { parseBackup, sanitizeCategoryConfig, MAX_BACKUP_BYTES } from '@/lib/parse-backup';
import { isEncryptedEnvelope, decryptFromEnvelope } from '@ext/crypto';
import { buildWrapped, type WrappedData } from '@ext/wrapped';
import RingLogo from '@/components/RingLogo.vue';
import WrappedIcon from './WrappedIcon.vue';

const emit = defineEmits<{ (e: 'loaded', data: WrappedData): void }>();
const { t } = useI18n();

const dragging = ref(false);
const busy = ref(false);
const error = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const pendingEnvelope = ref<string | null>(null);
const passphrase = ref('');

function fail(key: string): void {
  error.value = t(key);
  busy.value = false;
}

function finishFromText(text: string): void {
  let parsed;
  try {
    parsed = parseBackup(text);
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('wrapped.error.parse');
    busy.value = false;
    return;
  }
  const { overrides, rules } = sanitizeCategoryConfig(parsed.settings);
  const data = buildWrapped({ dailyStats: parsed.dailyStats, sessions: parsed.sessions, overrides, rules });
  if (!data) {
    fail('wrapped.error.empty');
    return;
  }
  error.value = '';
  busy.value = false;
  emit('loaded', data);
}

async function readFile(file: File): Promise<void> {
  error.value = '';
  pendingEnvelope.value = null;
  if (file.size > MAX_BACKUP_BYTES) {
    fail('wrapped.error.tooLarge');
    return;
  }
  busy.value = true;
  try {
    const text = await file.text();
    if (isEncryptedEnvelope(text)) {
      pendingEnvelope.value = text;
      busy.value = false;
      return;
    }
    finishFromText(text);
  } catch {
    fail('wrapped.error.readFailed');
  }
}

async function unlock(): Promise<void> {
  if (!pendingEnvelope.value || !passphrase.value) return;
  busy.value = true;
  error.value = '';
  try {
    const plaintext = await decryptFromEnvelope(pendingEnvelope.value, passphrase.value);
    pendingEnvelope.value = null;
    passphrase.value = '';
    finishFromText(plaintext);
  } catch {
    fail('wrapped.error.wrongPass');
  }
}

function cancelUnlock(): void {
  pendingEnvelope.value = null;
  passphrase.value = '';
  error.value = '';
}

function onDrop(e: DragEvent): void {
  dragging.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) void readFile(file);
}
function onPick(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) void readFile(file);
}
</script>

<template>
  <div class="dz">
    <RingLogo class="dz-logo" :size="52" />
    <h1 class="dz-title">{{ t('wrapped.drop.title') }}</h1>
    <p class="dz-lede">{{ t('wrapped.drop.lede') }}</p>

    <form v-if="pendingEnvelope" class="dz-pass glass" @submit.prevent="unlock">
      <p class="dz-pass-prompt"><WrappedIcon name="lock" :size="16" /> {{ t('wrapped.drop.passPrompt') }}</p>
      <input
        v-model="passphrase"
        type="password"
        class="dz-input"
        :placeholder="t('wrapped.drop.passLabel')"
        :aria-label="t('wrapped.drop.passLabel')"
        autocomplete="off"
      />
      <div class="dz-pass-actions">
        <button type="button" class="btn btn-ghost" @click="cancelUnlock">{{ t('wrapped.drop.cancel') }}</button>
        <button type="submit" class="btn btn-primary" :disabled="busy || !passphrase">{{ t('wrapped.drop.decrypt') }}</button>
      </div>
    </form>

    <template v-else>
      <button
        type="button"
        class="dz-zone glass"
        :class="{ dragging, busy }"
        :aria-label="t('wrapped.drop.cta')"
        @click="fileInput?.click()"
        @dragover.prevent="dragging = true"
        @dragenter.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <span class="dz-ic"><WrappedIcon name="upload" :size="40" /></span>
        <span class="dz-cta">{{ t('wrapped.drop.cta') }}</span>
        <span class="dz-browse">{{ t('wrapped.drop.browse') }}</span>
      </button>
      <input ref="fileInput" type="file" accept="application/json,.json" class="dz-file" @change="onPick" />
    </template>

    <p v-if="error" class="dz-error" role="alert">{{ error }}</p>
    <p class="dz-hint"><WrappedIcon name="lock" :size="13" /> {{ t('wrapped.drop.hint') }}</p>
  </div>
</template>

<style scoped>
.dz {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
}
.dz-logo { margin-bottom: 4px; }
.dz-title {
  font-family: var(--font-display);
  font-size: clamp(38px, 8vw, 64px);
  font-weight: 700;
  background: var(--accent-grad);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin: 0;
}
.dz-lede {
  font-size: 17px;
  color: var(--text-2);
  margin: 0 0 12px;
}
.dz-zone {
  width: 100%;
  border: 1.5px dashed var(--border-hover);
  background: var(--card);
  padding: 48px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  color: var(--text);
  font: inherit;
  transition: border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}
.dz-zone:hover,
.dz-zone:focus-visible,
.dz-zone.dragging {
  border-color: var(--accent);
  box-shadow: var(--glow-md);
  transform: translateY(-2px);
}
.dz-zone.busy { opacity: 0.6; pointer-events: none; }
.dz-ic { color: var(--accent); }
.dz-cta { font-size: 18px; font-weight: 600; }
.dz-browse { font-size: 14px; color: var(--accent); font-weight: 600; }
.dz-file { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(100%); }

.dz-pass {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 28px;
}
.dz-pass-prompt {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  margin: 0;
  font-size: 14px;
  color: var(--text-2);
}
.dz-input {
  width: 100%;
  box-sizing: border-box;
  padding: 13px 15px;
  border: 1px solid var(--border-hover);
  border-radius: var(--radius-sm);
  background: var(--bg-alt);
  color: var(--text);
  font: inherit;
  font-size: 15px;
}
.dz-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.dz-pass-actions { display: flex; gap: 10px; justify-content: flex-end; }

.btn {
  height: 44px;
  padding: 0 20px;
  border-radius: 12px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-hover);
  background: transparent;
  color: var(--text);
}
.btn-primary {
  background: var(--accent-grad);
  color: #0a0a0f;
  border: none;
}
.btn-ghost { background: var(--surface); color: var(--text-2); }
.btn:disabled { opacity: 0.5; cursor: default; }

.dz-error { color: #fca5a5; font-size: 14px; font-weight: 600; margin: 0; }
.dz-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
  margin: 4px 0 0;
}
</style>
