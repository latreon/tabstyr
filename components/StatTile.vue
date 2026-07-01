<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
  warn?: boolean;
  /** Render as a button that emits `activate` on click/Enter/Space. */
  clickable?: boolean;
  /** Small affordance text shown at the bottom of a clickable tile. */
  actionHint?: string;
}>();
defineEmits<{ activate: [] }>();
</script>

<template>
  <component
    :is="clickable ? 'button' : 'div'"
    class="tile stat-tile"
    :class="{ warn, clickable }"
    :type="clickable ? 'button' : undefined"
    @click="clickable && $emit('activate')"
  >
    <h2 class="label">{{ label }}</h2>
    <span class="stat-value">{{ value }}</span>
    <!-- Always render the hint line so a zero/non-actionable tile (e.g. 0 stale
         tabs) keeps the same height as its actionable sibling. -->
    <span class="hint" :class="{ placeholder: !(clickable && actionHint) }">
      <template v-if="clickable && actionHint">{{ actionHint }}<span class="arrow" aria-hidden="true">→</span></template>
      <template v-else>&nbsp;</template>
    </span>
  </component>
</template>

<style scoped>
.stat-tile {
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  align-self: start; /* stay compact — don't stretch to the hero's height */
}
/* Reset button defaults so a clickable tile matches the static one exactly. */
button.stat-tile {
  width: 100%;
  text-align: left;
  font-family: inherit;
  color: inherit;
  cursor: pointer;
  transition: border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease;
}
button.stat-tile:hover {
  /* Neutral emphasis (text color, theme-aware) rather than the accent purple. */
  border-color: var(--text-2);
  transform: translateY(-1px);
}
button.stat-tile:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.stat-tile.warn {
  background: var(--warn-bg);
  border-color: var(--warn-border);
}
.stat-tile.warn .stat-value,
.stat-tile.warn .label {
  color: var(--warn);
}
button.stat-tile.warn:hover { border-color: var(--warn); }
.stat-value {
  font-size: var(--text-xl);
  font-weight: 800;
  letter-spacing: -0.5px;
}
.hint {
  margin-top: 2px;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-3);
}
/* Reserves the hint line's height without showing anything (keeps tile heights equal). */
.hint.placeholder { visibility: hidden; }
button.stat-tile:hover .hint { color: var(--text); }
.stat-tile.warn .hint,
button.stat-tile.warn:hover .hint { color: var(--warn); }
.arrow {
  display: inline-block;
  margin-left: 5px;
  transition: transform 120ms ease;
}
button.stat-tile:hover .arrow { transform: translateX(2px); }
@media (prefers-reduced-motion: reduce) {
  button.stat-tile,
  button.stat-tile:hover,
  .arrow { transition: none; transform: none; }
}
</style>
