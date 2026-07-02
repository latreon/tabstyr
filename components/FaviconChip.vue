<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { faviconUrl, isLightFavicon, letterChip } from '@/lib/favicon';

const props = defineProps<{ domain: string }>();
const failed = ref(false);
const isLight = ref(false);
const src = computed(() => faviconUrl(props.domain));
const chip = computed(() => letterChip(props.domain));
// Internal browser pages (chrome://, edge://, about:) have no real favicon —
// show the browser's own glyph instead of a letter chip.
const special = computed(() => SPECIAL_ICONS[props.domain] ?? null);

watch(() => props.domain, () => {
  failed.value = false;
  isLight.value = false;
});

// Some decode failures resolve as a 0×0 image without firing `error`; treat an
// empty raster as a failure so the letter chip takes over.
function onLoad(e: Event): void {
  const img = e.target as HTMLImageElement;
  if (img.naturalWidth === 0) {
    failed.value = true;
    return;
  }
  // A white/near-white icon (e.g. a mono glyph exported on transparent) would
  // vanish on the tile's default white background — flip to a dark tile instead.
  isLight.value = isLightFavicon(img);
}

const SPECIAL_ICONS: Record<string, 'chrome' | 'edge'> = {
  chrome: 'chrome',
  'chrome-untrusted': 'chrome',
  edge: 'edge',
};
</script>

<template>
  <svg v-if="special === 'chrome'" class="favicon" viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="22" fill="#fff" />
    <!-- three 120° pinwheel sectors -->
    <path fill="#34a853" d="M24 24 L24 45 A21 21 0 0 1 5.81 13.5 Z" />
    <path fill="#fbbc05" d="M24 24 L42.19 13.5 A21 21 0 0 1 24 45 Z" />
    <path fill="#ea4335" d="M24 24 L5.81 13.5 A21 21 0 0 1 42.19 13.5 Z" />
    <circle cx="24" cy="24" r="10.5" fill="#fff" />
    <circle cx="24" cy="24" r="8.5" fill="#4285f4" />
  </svg>
  <svg v-else-if="special === 'edge'" class="favicon" viewBox="0 0 48 48" aria-hidden="true">
    <defs>
      <linearGradient id="edgeGrad" x1="6" y1="34" x2="42" y2="14" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#0c59a4" />
        <stop offset="1" stop-color="#1b9de2" />
      </linearGradient>
    </defs>
    <circle cx="24" cy="24" r="21" fill="url(#edgeGrad)" />
    <path fill="#fff" d="M13 30c0-7 6-12 14-12 4.5 0 8 2.6 8 6.2 0 2.6-1.9 4.3-4.6 4.3H19c-2.6 0-3.6 2.6-1.7 4.4C14 35.7 13 32.6 13 30Z" opacity="0.96" />
  </svg>
  <img
    v-else-if="src && !failed"
    class="favicon raster"
    :class="{ 'raster-dark': isLight }"
    :src="src"
    alt=""
    @error="failed = true"
    @load="onLoad"
  />
  <span v-else class="favicon chip" :style="{ background: chip.color }" aria-hidden="true">{{ chip.letter }}</span>
</template>

<style scoped>
.favicon {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  flex: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.14);
}
/* Real favicons are all over the map — full-colour, transparent, or a monochrome
   mark that would vanish on a same-colour surface (GitHub's dark mark on dark, a
   white mark on light). Seat every one on a crisp white rounded tile (like an app
   icon): guarantees contrast in BOTH themes, and the faint edge keeps the tile
   distinct from a white card in light mode. object-fit + padding centre the glyph. */
.raster {
  box-sizing: border-box;
  padding: 2px;
  object-fit: contain;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
}
/* A predominantly white/light glyph would vanish on the white tile above — this
   dark tile is fixed (not theme-based) since it exists purely for contrast
   against the icon's own color, not to match the page. */
.raster-dark {
  background: #1e2330;
  border-color: rgba(255, 255, 255, 0.14);
}
.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}
</style>
