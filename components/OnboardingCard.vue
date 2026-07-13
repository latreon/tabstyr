<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { CATEGORIES, CATEGORY_META } from '@/lib/categories';
import { useFocusTrap } from '@/composables/useFocusTrap';

const emit = defineEmits<{ dismiss: [] }>();
const { t } = useI18n();

const legend = CATEGORIES.map((c) => ({ category: c, color: CATEGORY_META[c].color }));
const panel = ref<HTMLElement | null>(null);
const ctaBtn = ref<HTMLButtonElement | null>(null);

useFocusTrap(panel);

// A real 3-step tour — install (tracking is already on) → use it for a day
// (nothing to configure) → check the dashboard (where the payoff shows up).
// Each step is its own icon/title/body; only the CTA advances — Escape and a
// backdrop click always abandon the tour outright from any step (see close()).
const STEPS = [
  { icon: 'clock', title: 'step1Title', body: 'step1Body' },
  { icon: 'shield', title: 'step2Title', body: 'step2Body' },
  { icon: 'tag', title: 'step3Title', body: 'step3Body' },
] as const;
const TOTAL_STEPS = STEPS.length;
const currentStep = ref(0);
const isLastStep = computed(() => currentStep.value === TOTAL_STEPS - 1);
const step = computed(() => STEPS[currentStep.value]);

function next() {
  if (isLastStep.value) close();
  else currentStep.value += 1;
}
function back() {
  if (currentStep.value > 0) currentStep.value -= 1;
}

// Dismiss persists (onboarded flag), so any close path means "never show again" —
// Escape and a backdrop click abandon the tour from any step, same as before.
function close() {
  emit('dismiss');
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close();
}
onMounted(() => {
  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
  ctaBtn.value?.focus();
});
onUnmounted(() => {
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
  <div class="backdrop" @click.self="close">
    <section ref="panel" class="modal" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
      <button class="close" :aria-label="t('onboarding.close')" @click="close">✕</button>

      <h2 id="onboard-title" class="title">{{ t('onboarding.title') }}</h2>

      <ol class="steps-nav" :aria-label="t('onboarding.stepLabel', { n: currentStep + 1, total: TOTAL_STEPS })">
        <li v-for="i in TOTAL_STEPS" :key="i" :class="{ active: i - 1 === currentStep, done: i - 1 < currentStep }" />
      </ol>

      <div class="point" role="group" :aria-label="t('onboarding.stepLabel', { n: currentStep + 1, total: TOTAL_STEPS })">
        <span class="ico" aria-hidden="true">
          <svg v-if="step.icon === 'clock'" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
          <svg v-else-if="step.icon === 'shield'" viewBox="0 0 24 24"><path d="M12 3l7 3v5.5c0 4-3 7-7 8.5-4-1.5-7-4.5-7-8.5V6z" /><path d="M9 12l2 2 4-4.5" /></svg>
          <svg v-else viewBox="0 0 24 24"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 12.2V5a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8z" /><circle cx="7.6" cy="7.6" r="1.4" /></svg>
        </span>
        <div>
          <h3>{{ t(`onboarding.${step.title}`) }}</h3>
          <p>{{ t(`onboarding.${step.body}`) }}</p>
        </div>
      </div>

      <ul v-if="isLastStep" class="legend" :aria-label="t('onboarding.legendAria')">
        <li v-for="l in legend" :key="l.category">
          <span class="dot" :style="{ background: l.color }" aria-hidden="true" />
          {{ t(`categories.${l.category}`) }}
        </li>
      </ul>

      <div class="actions">
        <button v-if="currentStep > 0" type="button" class="back" @click="back">{{ t('onboarding.back') }}</button>
        <button ref="ctaBtn" class="cta" @click="next">{{ isLastStep ? t('onboarding.gotIt') : t('onboarding.next') }}</button>
      </div>
    </section>
  </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-4);
  background: var(--backdrop);
  backdrop-filter: blur(3px);
  overflow-y: auto;
}
.modal {
  position: relative;
  width: min(480px, 100%);
  /* Stay within the viewport and scroll internally on short screens, while
     remaining centered both ways via the flex backdrop. */
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  margin: auto;
  background: var(--popover, var(--card-strong));
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-modal);
  padding: 26px 28px;
}
.modal::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  background: var(--accent-gradient);
}
.close {
  position: absolute;
  top: var(--sp-4);
  right: var(--sp-4);
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
}
.close:hover { color: var(--text); border-color: var(--accent); }
.close:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.title {
  margin: 0 0 14px;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.4px;
}
.steps-nav {
  display: flex;
  gap: 6px;
  list-style: none;
  margin: 0 0 20px;
  padding: 0;
}
.steps-nav li {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--divider);
}
.steps-nav li.done { background: var(--accent); }
.steps-nav li.active { background: var(--accent-gradient); }
.point {
  display: flex;
  gap: 13px;
  align-items: flex-start;
  min-height: 108px;
  margin-bottom: 20px;
}
.ico {
  flex: none;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: color-mix(in oklab, var(--accent) 14%, transparent);
}
.ico svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.point h3 {
  margin: 0 0 5px;
  font-size: 16px;
  font-weight: 700;
}
.point p {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-3);
}
.legend {
  list-style: none;
  margin: 0 0 22px;
  padding: 14px 0;
  border-top: 1px solid var(--divider);
  border-bottom: 1px solid var(--divider);
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
}
.legend li {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--text-2);
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.back {
  background: transparent;
  color: var(--text-2);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 10px 18px;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.back:hover { border-color: var(--accent); color: var(--accent); }
.back:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cta {
  background: var(--accent-grad-strong);
  color: var(--on-accent);
  border: none;
  border-radius: 9px;
  padding: 10px 22px;
  font-size: var(--text-sm);
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.cta:hover { filter: brightness(1.06); }
.cta:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
