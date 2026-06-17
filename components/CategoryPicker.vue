<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { CATEGORIES, CATEGORY_META, type Category } from '@/lib/categories';

const props = defineProps<{ current: Category }>();
const emit = defineEmits<{ select: [Category] }>();
const { t } = useI18n();

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
function choose(c: Category) {
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
      :aria-label="t('worklog.changeCategory', { category: t(`categories.${current}`) })"
      :title="t('worklog.changeCategory', { category: t(`categories.${current}`) })"
      @click="toggle"
    >
      <span class="dot" :style="{ background: CATEGORY_META[current].color }" />
    </button>

    <div v-if="open" ref="menu" class="menu" :class="{ up: dropUp }" role="menu">
      <button
        v-for="c in CATEGORIES"
        :key="c"
        type="button"
        role="menuitemradio"
        :aria-checked="c === current"
        class="opt"
        :class="{ active: c === current }"
        @click="choose(c)"
      >
        <span class="dot" :style="{ background: CATEGORY_META[c].color }" />
        <span class="opt-label">{{ t(`categories.${c}`) }}</span>
        <svg v-if="c === current" class="check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
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
  width: 20px;
  height: 20px;
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
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22), 0 2px 8px rgba(0, 0, 0, 0.12);
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
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
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
