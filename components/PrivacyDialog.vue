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
  <Teleport to="body">
  <div class="backdrop" @click.self="emit('close')">
    <div ref="panel" class="panel tile" role="dialog" aria-modal="true" :aria-label="t('privacy.title')">
      <header class="head">
        <span class="brand"><RingLogo :size="20" /> {{ t('privacy.title') }}</span>
        <button ref="closeBtn" class="close" :aria-label="t('domainDetail.close')" @click="emit('close')">✕</button>
      </header>

      <div class="content">
        <p><strong>{{ t('privacy.intro1') }}</strong> {{ t('privacy.intro2') }}</p>

        <h3>{{ t('privacy.storesTitle') }}</h3>
        <ul>
          <li><strong>{{ t('privacy.store1Label') }}</strong> — {{ t('privacy.store1Body') }}</li>
          <li><strong>{{ t('privacy.store2Label') }}</strong> — {{ t('privacy.store2Body') }}</li>
          <li><strong>{{ t('privacy.store3Label') }}</strong> — {{ t('privacy.store3Body') }}</li>
          <li><strong>{{ t('privacy.store4Label') }}</strong> — {{ t('privacy.store4Body') }}</li>
        </ul>
        <p>{{ t('privacy.retention') }}</p>

        <h3>{{ t('privacy.notTitle') }}</h3>
        <ul>
          <li>{{ t('privacy.not1') }}</li>
          <li>{{ t('privacy.not2') }}</li>
          <li>{{ t('privacy.not3') }}</li>
        </ul>

        <h3>{{ t('privacy.permsTitle') }}</h3>
        <table>
          <thead><tr><th>{{ t('privacy.permCol1') }}</th><th>{{ t('privacy.permCol2') }}</th></tr></thead>
          <tbody>
            <tr><td><code>tabs</code></td><td>{{ t('privacy.permTabs') }}</td></tr>
            <tr><td><code>storage</code></td><td>{{ t('privacy.permStorage') }}</td></tr>
            <tr><td><code>idle</code></td><td>{{ t('privacy.permIdle') }}</td></tr>
            <tr><td><code>alarms</code></td><td>{{ t('privacy.permAlarms') }}</td></tr>
            <tr><td><code>notifications</code></td><td>{{ t('privacy.permNotifications') }}</td></tr>
            <tr><td><code>favicon</code> (Chromium)</td><td>{{ t('privacy.permFavicon') }}</td></tr>
          </tbody>
        </table>
        <p>{{ t('privacy.noHost') }}</p>

        <h3>{{ t('privacy.controlTitle') }}</h3>
        <ul>
          <li><strong>{{ t('privacy.control1Label') }}</strong> — {{ t('privacy.control1Body') }}</li>
          <li><strong>{{ t('privacy.control2Label') }}</strong> — {{ t('privacy.control2Body') }}</li>
          <li><strong>{{ t('privacy.control3Label') }}</strong> — {{ t('privacy.control3Body') }}</li>
        </ul>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4vh var(--sp-4);
  background: var(--backdrop);
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
  gap: var(--sp-4);
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
  gap: var(--sp-2);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.3px;
}
.close {
  margin-left: auto;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-2);
  border-radius: var(--radius-sm);
  width: 30px;
  height: 30px;
  cursor: pointer;
  font-size: var(--text-sm);
}
.close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.content {
  font-size: var(--text-base);
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
  border-radius: var(--radius-pill);
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
  margin: var(--sp-1) 0;
}
.content strong {
  color: var(--text);
}
.content h3 {
  font-size: 16px;
  margin: 22px 0 var(--sp-2);
  letter-spacing: -0.2px;
  color: var(--text);
}
.content table {
  width: 100%;
  border-collapse: collapse;
  margin-top: var(--sp-2);
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
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.content code {
  background: var(--bar-track);
  padding: 1px 6px;
  border-radius: 5px;
  font-size: var(--text-sm);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
