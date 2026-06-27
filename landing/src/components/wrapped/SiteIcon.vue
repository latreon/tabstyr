<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { faviconSources } from '@/lib/favicon';

const props = withDefaults(
  defineProps<{ domain: string; label: string; color: string; size?: number }>(),
  { size: 30 },
);

// Try each favicon source in turn; fall back to a category-colored letter chip only
// once every source has failed (or there is none, e.g. a private host).
const sources = computed(() => faviconSources(props.domain));
const sourceIndex = ref(0);
watch(() => props.domain, () => (sourceIndex.value = 0));

function onError(): void {
  sourceIndex.value += 1; // advance to the next source; chip shows when exhausted
}

const src = computed(() => sources.value[sourceIndex.value] ?? null);
const showFav = computed(() => !!src.value);
const initial = computed(() => props.label.replace(/^www\./, '').charAt(0).toUpperCase() || '?');
const px = computed(() => `${props.size}px`);
const radius = computed(() => `${Math.round(props.size * 0.3)}px`);
const fontSize = computed(() => `${Math.round(props.size * 0.46)}px`);
</script>

<template>
  <span
    class="site-icon"
    :class="{ fallback: !showFav }"
    :style="{ width: px, height: px, borderRadius: radius, background: showFav ? '#fff' : color }"
    aria-hidden="true"
  >
    <img
      v-if="showFav"
      :key="src!"
      :src="src!"
      :width="size"
      :height="size"
      alt=""
      class="fav"
      decoding="async"
      referrerpolicy="no-referrer"
      @error="onError"
    />
    <span v-else class="ini" :style="{ fontSize }">{{ initial }}</span>
  </span>
</template>

<style scoped>
.site-icon {
  flex: none;
  display: grid;
  place-items: center;
  overflow: hidden;
  box-shadow: 0 3px 8px -2px rgba(0, 0, 0, 0.35);
}
.fav {
  width: 64%;
  height: 64%;
  object-fit: contain;
  display: block;
}
.ini {
  font-weight: 800;
  color: #fff;
  line-height: 1;
}
</style>
