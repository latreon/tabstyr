<script setup lang="ts">
defineProps<{ size?: number }>();
</script>

<template>
  <svg :width="size ?? 20" :height="size ?? 20" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#a78bfa" />
        <stop offset="1" stop-color="#60a5fa" />
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" opacity="0.15" stroke-width="9" />
    <path d="M 32 10 A 22 22 0 1 1 13.4 43" fill="none" stroke="url(#ringGrad)" stroke-width="9" stroke-linecap="round" />
    <line x1="32" y1="32" x2="32" y2="19" stroke="currentColor" stroke-width="6" stroke-linecap="round" />
    <line x1="32" y1="32" x2="41" y2="37" stroke="currentColor" stroke-width="6" stroke-linecap="round" />
  </svg>
</template>
