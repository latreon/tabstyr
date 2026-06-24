<script setup lang="ts">
import { computed } from 'vue';
import { ICONS, type IconName } from '@ext/wrapped-icons';

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 24 });
const def = computed(() => ICONS[props.name]);
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    class="wicon"
    :class="{ filled: def.filled }"
    aria-hidden="true"
  >
    <path v-for="(d, i) in def.paths" :key="i" :d="d" />
  </svg>
</template>

<style scoped>
.wicon {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  display: block;
}
.wicon.filled {
  fill: currentColor;
  stroke: none;
}
</style>
