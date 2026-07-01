<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue';

interface Option {
  value: string;
  label: string;
}

const props = defineProps<{ modelValue: string; options: Option[]; label?: string; wide?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const uid = useId();
const open = ref(false);
const root = ref<HTMLElement | null>(null);
const activeIndex = ref(0);

const selected = computed(() => props.options.find((o) => o.value === props.modelValue) ?? props.options[0]);

function toggle() {
  open.value = !open.value;
  if (open.value) {
    const i = props.options.findIndex((o) => o.value === props.modelValue);
    activeIndex.value = i >= 0 ? i : 0;
  }
}
function choose(value: string) {
  emit('update:modelValue', value);
  open.value = false;
}
function onKeydown(e: KeyboardEvent) {
  if (!open.value && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
    e.preventDefault();
    toggle();
    return;
  }
  if (!open.value) return;
  if (e.key === 'Escape') { open.value = false; return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex.value = Math.min(props.options.length - 1, activeIndex.value + 1); }
  if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex.value = Math.max(0, activeIndex.value - 1); }
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(props.options[activeIndex.value].value); }
}
function onClickOutside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}

onMounted(() => document.addEventListener('click', onClickOutside));
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside));
</script>

<template>
  <div ref="root" class="selectbox" :class="{ wide }">
    <button
      type="button"
      class="trigger"
      :aria-label="label"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-controls="`${uid}-list`"
      :aria-activedescendant="open ? `${uid}-opt-${activeIndex}` : undefined"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span>{{ selected?.label }}</span>
      <svg class="chevron" :class="{ open }" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
    <ul
      v-if="open"
      :id="`${uid}-list`"
      class="menu"
      role="listbox"
      :aria-label="label"
      :aria-activedescendant="`${uid}-opt-${activeIndex}`"
    >
      <li
        v-for="(o, i) in options"
        :id="`${uid}-opt-${i}`"
        :key="o.value"
        role="option"
        :aria-selected="o.value === modelValue"
        :class="{ active: i === activeIndex, selected: o.value === modelValue }"
        @click="choose(o.value)"
        @mouseenter="activeIndex = i"
      >
        {{ o.label }}
        <span v-if="o.value === modelValue" class="tick" aria-hidden="true">✓</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.selectbox {
  position: relative;
  min-width: 120px;
}
.selectbox.wide {
  min-width: 190px;
}
.trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  width: 100%;
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  font-size: var(--text-sm);
  font-family: inherit;
  cursor: pointer;
}
.trigger:hover { border-color: var(--accent); }
.trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.chevron {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: var(--text);
  stroke-width: 2.25;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.7;
  transition: transform 150ms ease;
}
.trigger:hover .chevron {
  opacity: 1;
}
.chevron.open { transform: rotate(180deg); }
.menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  left: 0;
  z-index: 10;
  list-style: none;
  margin: 0;
  padding: var(--sp-1);
  background: var(--popover);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-pop);
}
.menu li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  font-size: var(--text-sm);
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-2);
}
.menu li.active { background: var(--row-hover); color: var(--text); }
.menu li.selected { color: var(--text); font-weight: 600; }
.tick { color: var(--accent); font-size: 12px; }
</style>
