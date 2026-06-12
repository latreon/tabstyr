<script setup lang="ts">
import { computed, ref } from 'vue';
import { faviconUrl, letterChip } from '@/lib/favicon';

const props = defineProps<{ domain: string }>();
const failed = ref(false);
const src = computed(() => faviconUrl(props.domain));
const chip = computed(() => letterChip(props.domain));
</script>

<template>
  <img v-if="src && !failed" class="favicon" :src="src" alt="" @error="failed = true" />
  <span v-else class="favicon chip" :style="{ background: chip.color }" aria-hidden="true">{{ chip.letter }}</span>
</template>

<style scoped>
.favicon {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  flex: none;
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
