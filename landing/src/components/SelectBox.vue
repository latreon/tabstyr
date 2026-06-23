<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue';

const props = defineProps<{ modelValue: string; options: string[]; label?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const uid = useId();
const open = ref(false);
const root = ref<HTMLElement | null>(null);
const activeIndex = ref(0);

function toggle() {
  open.value = !open.value;
  if (open.value) {
    const i = props.options.indexOf(props.modelValue);
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
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(props.options[activeIndex.value]); }
}
function onClickOutside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}

const selected = computed(() => props.modelValue || props.options[0]);

onMounted(() => document.addEventListener('click', onClickOutside));
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside));
</script>

<template>
  <div ref="root" class="selectbox">
    <button
      type="button"
      class="trigger"
      :aria-label="label"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-controls="`${uid}-list`"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span>{{ selected }}</span>
      <svg class="chev" :class="{ open }" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
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
        :key="o"
        role="option"
        :aria-selected="o === modelValue"
        :class="{ active: i === activeIndex, selected: o === modelValue }"
        @click="choose(o)"
        @mouseenter="activeIndex = i"
      >
        {{ o }}
        <span v-if="o === modelValue" class="tick" aria-hidden="true">✓</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.selectbox { position: relative; width: 100%; }
.trigger {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  width: 100%; box-sizing: border-box;
  background: var(--bg); border: 1px solid var(--border); border-radius: 10px;
  color: var(--text); font: inherit; font-size: 15px; padding: 11px 13px;
  cursor: pointer; transition: border-color 160ms ease;
}
.trigger:hover { border-color: var(--accent); }
.trigger:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-muted); }
.chev { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; opacity: 0.7; transition: transform 160ms ease; }
.chev.open { transform: rotate(180deg); }
.menu {
  position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 20;
  list-style: none; margin: 0; padding: 5px;
  background: var(--card-solid); border: 1px solid var(--border); border-radius: 12px;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.4);
}
.menu li {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 11px; font-size: 15px; border-radius: 8px; cursor: pointer; color: var(--text-2);
}
.menu li.active { background: var(--accent-muted); color: var(--text); }
.menu li.selected { color: var(--text); font-weight: 600; }
.tick { color: var(--accent); }
</style>
