<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/i18n';
import DemoPlayer from './DemoPlayer.vue';

const { t, tm } = useI18n();
const steps = computed(() => tm<{ title: string; body: string }[]>('howItWorks.steps'));
</script>

<template>
  <section id="how-it-works" class="section">
    <div class="container">
      <div class="head reveal">
        <span class="eyebrow">{{ t('howItWorks.eyebrow') }}</span>
        <h2 class="h2">{{ t('howItWorks.title') }}</h2>
        <p class="sub">{{ t('howItWorks.sub') }}</p>
      </div>

      <div class="grid">
        <ol class="steps reveal">
          <li v-for="(step, i) in steps" :key="step.title">
            <span class="num" aria-hidden="true">{{ i + 1 }}</span>
            <div>
              <h3>{{ step.title }}</h3>
              <p>{{ step.body }}</p>
            </div>
          </li>
        </ol>

        <div class="demo reveal">
          <DemoPlayer
            src="/demo/tabstyr-demo.mp4"
            poster="/demo/tabstyr-demo-poster.jpg"
            :label="t('howItWorks.videoAria')"
            :watch-label="t('howItWorks.watchDemo')"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.head { text-align: center; margin-bottom: 56px; }
.h2 { font-size: clamp(2rem, 1.4rem + 2.4vw, 3rem); font-weight: 700; margin-top: 14px; }
.sub { color: var(--text-2); margin: 12px auto 0; max-width: 560px; }
.eyebrow {
  font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--accent);
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: 48px;
  align-items: center;
  max-width: 1080px;
  margin: 0 auto;
}

.steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 28px; }
.steps li { display: flex; gap: 16px; align-items: flex-start; }
.num {
  flex: none;
  width: 34px; height: 34px;
  display: grid; place-items: center;
  border-radius: 999px;
  background: var(--accent-muted);
  color: var(--accent);
  font-weight: 700;
  font-size: 15px;
}
.steps h3 { margin: 4px 0 4px; font-size: 16px; font-weight: 700; font-family: var(--font-display); }
.steps p { margin: 0; color: var(--text-2); font-size: 14px; line-height: 1.6; }

.demo { margin: 0; }

@media (max-width: 860px) {
  .grid { grid-template-columns: 1fr; gap: 32px; }
}
</style>
