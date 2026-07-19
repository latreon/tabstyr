<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { browser } from 'wxt/browser';
import { getSettings, saveSettings } from '@/lib/settings';
import SelectBox from '@/components/ui/SelectBox.vue';
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue';

const { t } = useI18n();
const emit = defineEmits<{ changed: [] }>();

const enabled = ref(false);
const frequency = ref<'daily' | 'weekly'>('weekly');
const address = ref('');
const FREQUENCY_OPTIONS = computed(() => [
  { value: 'daily', label: t('settings.emailSummaryDaily') },
  { value: 'weekly', label: t('settings.emailSummaryWeekly') },
]);

// Gate auto-save until the initial values are loaded, so seeding the refs
// below doesn't immediately persist defaults over stored settings.
const loaded = ref(false);
let saveTimer: ReturnType<typeof setTimeout> | undefined;

const toast = ref<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function showToast(msg: string) {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 2400);
}

async function refresh() {
  const s = await getSettings();
  enabled.value = s.emailSummaryEnabled;
  frequency.value = s.emailSummaryFrequency;
  address.value = s.emailSummaryAddress;
  loaded.value = true;
}

// Backup restore/merge (in SettingsPanel) can change these fields without going
// through this panel's own watcher — 'settings-changed' is already broadcast on
// every settings write, so listening here keeps this panel in sync without
// coupling it to the settings tile. Re-assigning to the same value below is a
// no-op for the persist watcher (Vue skips a ref set that doesn't change).
function onSettingsChanged(msg: unknown) {
  if ((msg as { type?: string } | undefined)?.type === 'settings-changed') void refresh();
}

onMounted(() => {
  void refresh();
  browser.runtime.onMessage.addListener(onSettingsChanged);
});

onBeforeUnmount(() => {
  browser.runtime.onMessage.removeListener(onSettingsChanged);
  clearTimeout(toastTimer);
  clearTimeout(saveTimer);
});

async function persist() {
  try {
    await saveSettings({
      emailSummaryEnabled: enabled.value,
      emailSummaryFrequency: frequency.value,
      emailSummaryAddress: address.value,
    });
    await browser.runtime.sendMessage({ type: 'settings-changed' });
    emit('changed');
    showToast(t('settings.saved'));
  } catch (e) {
    console.error('[email-summary] save failed', e);
    showToast(t('settings.saveFailed'));
  }
}

// Debounced so rapid typing in the recipient field collapses into one write.
watch([enabled, frequency, address], () => {
  if (!loaded.value) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 400);
});
</script>

<template>
  <div class="tile email-summary-tile">
    <div class="tile-head">
      <span class="tile-icon" aria-hidden="true">✉️</span>
      <div class="tile-head-text">
        <h2 class="label">{{ t('settings.emailSummary') }}</h2>
        <p class="tile-hint">{{ t('settings.emailSummaryHint') }}</p>
      </div>
      <ToggleSwitch v-model="enabled" :label="t('settings.emailSummary')" class="tile-toggle" />
    </div>
    <template v-if="enabled">
      <div class="field">
        <span class="field-label">{{ t('settings.emailSummaryFrequency') }}</span>
        <SelectBox
          :model-value="frequency"
          :options="FREQUENCY_OPTIONS"
          :label="t('settings.emailSummaryFrequency')"
          @update:model-value="frequency = $event as 'daily' | 'weekly'"
        />
      </div>
      <div class="field">
        <span class="field-label">{{ t('settings.emailSummaryAddress') }}</span>
        <input
          v-model="address"
          type="email"
          class="rule-input email-input"
          :placeholder="t('settings.emailSummaryAddressPlaceholder')"
          :aria-label="t('settings.emailSummaryAddress')"
          autocomplete="email"
        />
      </div>
    </template>

    <!-- Live region is always present so screen readers announce text swaps. -->
    <div class="toast-host" role="status" aria-live="polite">
      <Transition name="toast">
        <div v-if="toast" class="toast">{{ toast }}</div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.email-summary-tile {
  position: relative;
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-self: start;
}
.tile-head {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
}
.tile-icon {
  flex: none;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: color-mix(in oklab, var(--accent) 16%, var(--card));
  font-size: 15px;
}
.tile-head-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tile-hint {
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.45;
  color: var(--text-3);
}
.tile-toggle {
  flex: none;
  margin-left: auto;
}
.field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-sm);
  gap: 10px;
  min-height: 32px;
  flex-wrap: wrap;
}
.field-label {
  color: var(--text-2);
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
.email-input {
  flex: 0 1 220px;
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
