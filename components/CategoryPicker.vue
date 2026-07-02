<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { allCategoryIds, categoryColor, categoryLabel, type CategoryId, type CustomCategory } from '@/lib/categories';

const props = defineProps<{ current: CategoryId; custom?: CustomCategory[] }>();
const emit = defineEmits<{ select: [CategoryId] }>();
const { t } = useI18n();

// Built-ins plus any user-added categories — each with a resolved color + label.
const options = computed(() =>
  allCategoryIds(props.custom).map((c) => ({ value: c, color: categoryColor(c, props.custom), label: categoryLabel(c, t) })),
);

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const menu = ref<HTMLElement | null>(null);
// Open upward when there isn't room below (long lists near the viewport bottom).
const dropUp = ref(false);

function toggle() {
  open.value = !open.value;
  if (open.value) {
    void nextTick(() => {
      const r = root.value?.getBoundingClientRect();
      dropUp.value = !!r && window.innerHeight - r.bottom < 280;
      menu.value?.querySelector<HTMLButtonElement>('.opt.active')?.focus();
    });
  }
}
function choose(c: CategoryId) {
  if (c !== props.current) emit('select', c);
  open.value = false;
}
function onClickOutside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    e.stopPropagation();
    open.value = false;
  }
}
// Roving focus across the menu items (role="menu" promises arrow-key navigation).
function onMenuKey(e: KeyboardEvent) {
  const items = Array.from(menu.value?.querySelectorAll<HTMLButtonElement>('.opt') ?? []);
  if (!items.length) return;
  const idx = items.indexOf(document.activeElement as HTMLButtonElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1 + items.length) % items.length].focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length].focus(); }
  else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
  else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
}
onMounted(() => {
  document.addEventListener('click', onClickOutside);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside);
  document.removeEventListener('keydown', onKey);
});
</script>

<template>
  <div ref="root" class="cat-picker" @click.stop>
    <button
      type="button"
      class="trigger"
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-label="t('worklog.changeCategory', { category: categoryLabel(current, t) })"
      :title="t('worklog.changeCategory', { category: categoryLabel(current, t) })"
      @click="toggle"
    >
      <span class="dot" :style="{ background: categoryColor(current, custom) }" />
    </button>

    <div v-if="open" ref="menu" class="menu" :class="{ up: dropUp }" role="menu" @keydown="onMenuKey">
      <button
        v-for="o in options"
        :key="o.value"
        type="button"
        role="menuitemradio"
        :aria-checked="o.value === current"
        class="opt"
        :class="{ active: o.value === current }"
        @click="choose(o.value)"
      >
        <span class="dot" :style="{ background: o.color }" />
        <span class="opt-label">{{ o.label }}</span>
        <svg v-if="o.value === current" class="check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.cat-picker {
  position: relative;
  display: inline-flex;
}
.trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: background 120ms ease;
}
.trigger:hover {
  background: var(--row-hover);
}
.trigger:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.dot {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  flex: none;
  /* a faint ring makes the dot read as interactive (a swatch, not just a marker) */
  box-shadow: 0 0 0 1px color-mix(in oklab, var(--text-3) 30%, transparent);
}
.menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  min-width: 168px;
  padding: 6px;
  background: var(--popover);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-pop);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.menu.up {
  top: auto;
  bottom: calc(100% + 6px);
}
.opt {
  display: grid;
  grid-template-columns: 12px 1fr 16px;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 9px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  font-size: var(--text-sm);
  color: var(--text-2);
  text-align: left;
}
.opt:hover {
  background: var(--row-hover);
  color: var(--text);
}
.opt.active {
  color: var(--text);
  font-weight: 600;
}
.opt:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.opt .dot {
  width: 11px;
  height: 11px;
  box-shadow: none;
}
.opt-label {
  white-space: nowrap;
}
.check {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
