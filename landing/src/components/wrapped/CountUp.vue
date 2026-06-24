<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    value: number;
    /** Formats the animated number for display (e.g. formatDuration). */
    format?: (n: number) => string;
    durationMs?: number;
  }>(),
  { durationMs: 1100 },
);

const display = ref(0);
let raf = 0;

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ease = (t: number): number => 1 - Math.pow(1 - t, 3); // easeOutCubic

function animate(to: number): void {
  cancelAnimationFrame(raf);
  if (to <= 0 || props.durationMs <= 0 || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
    display.value = to;
    return;
  }
  let startTs = 0;
  const step = (ts: number): void => {
    if (!startTs) startTs = ts;
    const progress = Math.min(1, (ts - startTs) / props.durationMs);
    display.value = to * ease(progress);
    if (progress < 1) raf = requestAnimationFrame(step);
    else display.value = to;
  };
  raf = requestAnimationFrame(step);
}

watch(() => props.value, animate, { immediate: true });
onBeforeUnmount(() => cancelAnimationFrame(raf));
</script>

<template>
  <span>{{ format ? format(display) : Math.round(display).toLocaleString() }}</span>
</template>
