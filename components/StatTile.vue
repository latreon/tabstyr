<script setup lang="ts">
defineProps<{ label: string; value: string; warn?: boolean }>();
</script>

<template>
  <div class="stat-tile" :class="{ warn }">
    <span class="label">{{ label }}</span>
    <span class="stat-value">{{ value }}</span>
  </div>
</template>

<style scoped>
.stat-tile {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-tile.warn {
  background: var(--color-warn-bg);
  border-color: var(--color-warn-border);
}
.stat-tile.warn .stat-value,
.stat-tile.warn .label {
  color: var(--color-warn);
}
.stat-value {
  font-size: 26px;
  font-weight: 800;
}
</style>
