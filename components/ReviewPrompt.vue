<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { CHROME_STORE_REVIEW_URL } from '@/lib/links';

const emit = defineEmits<{ dismiss: [] }>();
const { t } = useI18n();

function rate() {
  window.open(CHROME_STORE_REVIEW_URL, '_blank', 'noopener');
  emit('dismiss');
}
</script>

<template>
  <!-- No backdrop, by design: this floats over the corner rather than gating the
       page like the onboarding modal, so it can never intercept an unrelated click. -->
  <div class="review-prompt" role="dialog" aria-labelledby="review-prompt-title">
    <button class="close" :aria-label="t('onboarding.close')" @click="emit('dismiss')">✕</button>
    <p id="review-prompt-title" class="title">{{ t('reviewPrompt.title') }}</p>
    <p class="body">{{ t('reviewPrompt.body') }}</p>
    <div class="actions">
      <button class="btn btn-ghost btn-sm" @click="emit('dismiss')">{{ t('reviewPrompt.dismiss') }}</button>
      <button class="btn btn-primary btn-sm" @click="rate">{{ t('reviewPrompt.rate') }}</button>
    </div>
  </div>
</template>

<style scoped>
.review-prompt {
  position: fixed;
  right: var(--sp-4);
  bottom: 28px;
  z-index: 60;
  width: min(280px, calc(100vw - 32px));
  background: var(--popover, var(--card-strong));
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-pop);
  padding: 16px 18px;
}
.close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 11px;
}
.close:hover { color: var(--text); }
.close:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.title {
  margin: 0 22px 4px 0;
  font-size: 14px;
  font-weight: 700;
}
.body {
  margin: 0 0 14px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-2);
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
