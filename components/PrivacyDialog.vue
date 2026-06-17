<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import RingLogo from '@/components/RingLogo.vue';
import { useFocusTrap } from '@/composables/useFocusTrap';

const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();

const panel = ref<HTMLElement | null>(null);
const closeBtn = ref<HTMLButtonElement | null>(null);
useFocusTrap(panel);

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}
onMounted(() => {
  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
  closeBtn.value?.focus();
});
onUnmounted(() => {
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
});
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div ref="panel" class="panel tile" role="dialog" aria-modal="true" :aria-label="t('privacy.title')">
      <header class="head">
        <span class="brand"><RingLogo :size="20" /> {{ t('privacy.title') }}</span>
        <button ref="closeBtn" class="close" :aria-label="t('domainDetail.close')" @click="emit('close')">✕</button>
      </header>

      <div class="content">
        <p><strong>TabStyr does not collect, transmit, or share any data.</strong> Everything stays on your device — no servers, no analytics, no accounts, and no network requests.</p>

        <h3>What it stores (locally, in your browser's IndexedDB)</h3>
        <ul>
          <li><strong>Session records</strong> — start/end times, the page's domain, and whether the tab played audio.</li>
          <li><strong>Daily per-domain totals</strong> — seconds per site per day.</li>
          <li><strong>Open-tab metadata</strong> — title, URL, last-active time, and a random local id used to attribute time.</li>
          <li><strong>Settings</strong> — stale threshold, idle timeout, theme, audio counting, category rules.</li>
        </ul>
        <p>Data is kept for a rolling <strong>90-day window</strong>, then pruned automatically.</p>

        <h3>What it does NOT do</h3>
        <ul>
          <li>Does <strong>not</strong> send data off your device, or use servers, cloud sync, or analytics.</li>
          <li>Does <strong>not</strong> contain ads or trackers.</li>
          <li>Does <strong>not</strong> read page contents — only tab metadata (URL/title) from standard extension APIs.</li>
        </ul>

        <h3>Permissions</h3>
        <table>
          <thead><tr><th>Permission</th><th>Purpose</th></tr></thead>
          <tbody>
            <tr><td><code>tabs</code></td><td>See the active tab's URL/title to attribute time</td></tr>
            <tr><td><code>storage</code></td><td>Save your stats and settings locally</td></tr>
            <tr><td><code>idle</code></td><td>Pause tracking when you step away</td></tr>
            <tr><td><code>alarms</code></td><td>Periodic checkpoints and daily maintenance</td></tr>
            <tr><td><code>notifications</code></td><td>Optional once-a-day stale-tab reminder</td></tr>
            <tr><td><code>favicon</code> (Chromium)</td><td>Show site icons in lists</td></tr>
          </tbody>
        </table>
        <p>No host permissions — the extension can't access page content.</p>

        <h3>Your control</h3>
        <ul>
          <li><strong>Export</strong> your full history (JSON or CSV), optionally <strong>passphrase-encrypted</strong>.</li>
          <li><strong>Restore</strong> from a backup on any device.</li>
          <li><strong>Wipe all data</strong> in one click; removing the extension deletes everything.</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4vh 16px;
  background: rgba(8, 8, 16, 0.55);
  backdrop-filter: blur(3px);
  overflow: hidden; /* the panel scrolls internally — never the page behind it */
}
.panel {
  width: min(1040px, 100%);
  max-height: 92vh;
  background: var(--popover);
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden; /* header + badge stay put; only .content scrolls */
}
.head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.3px;
}
.close {
  margin-left: auto;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-2);
  border-radius: 8px;
  width: 30px;
  height: 30px;
  cursor: pointer;
  font-size: 13px;
}
.close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.content {
  font-size: 15px;
  line-height: 1.65;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin-right: -10px; /* keep text aligned while the scrollbar sits in the padding */
  padding-right: 10px;
  scrollbar-width: thin; /* Firefox */
  scrollbar-color: color-mix(in oklab, var(--text-3) 55%, transparent) transparent;
}
/* Slim, theme-aware scrollbar (Chromium/WebKit) */
.content::-webkit-scrollbar {
  width: 8px;
}
.content::-webkit-scrollbar-track {
  background: transparent;
}
.content::-webkit-scrollbar-thumb {
  background: color-mix(in oklab, var(--text-3) 45%, transparent);
  border-radius: 999px;
}
.content::-webkit-scrollbar-thumb:hover {
  background: color-mix(in oklab, var(--text-3) 70%, transparent);
}
/* First heading shouldn't add big top gap right under the badge. */
.content > h3:first-child,
.content > p:first-child {
  margin-top: 0;
}
.content p,
.content li {
  color: var(--text-2);
}
.content li {
  margin: 4px 0;
}
.content strong {
  color: var(--text);
}
.content h3 {
  font-size: 16px;
  margin: 22px 0 8px;
  letter-spacing: -0.2px;
  color: var(--text);
}
.content table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
}
.content th,
.content td {
  text-align: left;
  padding: 9px 10px;
  border-bottom: 1px solid var(--border);
}
.content th {
  color: var(--text-3);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.content code {
  background: var(--bar-track);
  padding: 1px 6px;
  border-radius: 5px;
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
