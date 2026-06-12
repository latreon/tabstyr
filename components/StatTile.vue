<script setup lang="ts">
defineProps<{ label: string; value: string; warn?: boolean }>();
</script>

<template>
  <div class="tile stat-tile" :class="{ warn }">
    <span class="label">{{ label }}</span>
    <span class="stat-value">{{ value }}</span>
  </div>
</template>

<style scoped>
.stat-tile {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-tile.warn {
  background: var(--warn-bg);
  border-color: var(--warn-border);
}
.stat-tile.warn .stat-value,
.stat-tile.warn .label {
  color: var(--warn);
}
.stat-value {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
}
</style>
