<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { resolvedFavicon, preloadFavicon } from '@/lib/favicon';

const props = withDefaults(
  defineProps<{ domain: string; label: string; color: string; size?: number }>(),
  { size: 30 },
);

// The story preloads every top-site favicon up front, so by the time this slide
// renders the working URL is already resolved and cached — the <img> binds it
// directly and paints with no chip-to-icon flash. Preload here too as a safety net
// (idempotent) in case this domain wasn't part of the batch.
onMounted(() => preloadFavicon(props.domain));
watch(() => props.domain, () => preloadFavicon(props.domain));

// undefined → still resolving (show chip placeholder); string → cached URL; null → no icon.
const src = computed(() => {
  const r = resolvedFavicon(props.domain);
  return typeof r === 'string' ? r : null;
});
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
      :src="src!"
      :width="size"
      :height="size"
      alt=""
      class="fav"
      decoding="async"
      referrerpolicy="no-referrer"
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
