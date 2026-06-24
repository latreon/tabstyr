<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { faviconUrl } from '@/lib/favicon';

const props = withDefaults(
  defineProps<{ domain: string; label: string; color: string; size?: number }>(),
  { size: 30 },
);

// Falls back to a category-colored letter chip if the real favicon 404s or fails.
const failed = ref(false);
watch(() => props.domain, () => (failed.value = false));

const src = computed(() => faviconUrl(props.domain));
// Show the letter chip when there's no favicon URL (non-public host) or it failed.
const showFav = computed(() => !!src.value && !failed.value);
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
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      @error="failed = true"
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
