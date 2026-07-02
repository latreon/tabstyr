<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { hexToHsv, hsvToHex, isValidHex, normalizeHex, type Hsv } from '@/lib/color';

// A handful of curated, distinct colors for one-click picks — the full spectrum
// plane below covers everything else, so this stays short instead of turning
// into a wall of swatches.
const PRESETS: readonly string[] = [
  '#6366f1', '#0d9488', '#10b981', '#22c55e',
  '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6',
  '#3b82f6', '#94a3b8',
];

const props = defineProps<{ modelValue: string; label: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const { t } = useI18n();

const uid = useId();
const open = ref(false);
const openUp = ref(false);
const root = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const svPlane = ref<HTMLElement | null>(null);
const hueTrack = ref<HTMLElement | null>(null);
const hexDraft = ref(props.modelValue);
const hexInvalid = ref(false);

// Flip the panel above the trigger when there isn't enough room below it —
// otherwise a picker opened near the bottom of the tile renders half off-screen.
async function updatePlacement() {
  await nextTick();
  const triggerRect = root.value?.getBoundingClientRect();
  const panelRect = panel.value?.getBoundingClientRect();
  if (!triggerRect || !panelRect) return;
  const spaceBelow = window.innerHeight - triggerRect.bottom;
  const spaceAbove = triggerRect.top;
  openUp.value = spaceBelow < panelRect.height + 12 && spaceAbove > spaceBelow;
}

const safeValue = computed(() => (isValidHex(props.modelValue) ? normalizeHex(props.modelValue) : '#6366f1'));
const hsv = ref<Hsv>(hexToHsv(safeValue.value));

// Re-sync from outside changes (e.g. the form resetting after submit), but not
// while the panel is open — that would fight the user's own drag/typing.
watch(
  () => props.modelValue,
  (next) => {
    if (open.value) return;
    hsv.value = hexToHsv(isValidHex(next) ? normalizeHex(next) : '#6366f1');
    hexDraft.value = next;
  },
);

function toggle() {
  open.value = !open.value;
  if (open.value) {
    hsv.value = hexToHsv(safeValue.value);
    hexDraft.value = safeValue.value;
    hexInvalid.value = false;
    void updatePlacement();
  }
}
function close() {
  open.value = false;
}

function commit(hex: string) {
  emit('update:modelValue', hex);
}

function pickPreset(hex: string) {
  hsv.value = hexToHsv(hex);
  hexDraft.value = hex;
  hexInvalid.value = false;
  commit(hex);
}

function fromHsv() {
  const hex = hsvToHex(hsv.value.h, hsv.value.s, hsv.value.v);
  hexDraft.value = hex;
  hexInvalid.value = false;
  commit(hex);
}

// --- Saturation/Value plane ------------------------------------------------
function setSvFromPointer(e: PointerEvent) {
  const rect = svPlane.value?.getBoundingClientRect();
  if (!rect) return;
  const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
  hsv.value = { ...hsv.value, s: x, v: 1 - y };
  fromHsv();
}
function onSvPointerDown(e: PointerEvent) {
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  setSvFromPointer(e);
}
function onSvPointerMove(e: PointerEvent) {
  if (e.buttons !== 1) return;
  setSvFromPointer(e);
}

// --- Hue slider --------------------------------------------------------------
function setHueFromPointer(e: PointerEvent) {
  const rect = hueTrack.value?.getBoundingClientRect();
  if (!rect) return;
  const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  hsv.value = { ...hsv.value, h: x * 360 };
  fromHsv();
}
function onHuePointerDown(e: PointerEvent) {
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  setHueFromPointer(e);
}
function onHuePointerMove(e: PointerEvent) {
  if (e.buttons !== 1) return;
  setHueFromPointer(e);
}
// Arrow-key nudge so the hue slider isn't pointer-only.
function onHueKeydown(e: KeyboardEvent) {
  const step = e.shiftKey ? 10 : 2;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
    e.preventDefault();
    hsv.value = { ...hsv.value, h: (hsv.value.h - step + 360) % 360 };
    fromHsv();
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
    e.preventDefault();
    hsv.value = { ...hsv.value, h: (hsv.value.h + step) % 360 };
    fromHsv();
  }
}

// --- Hex text field ----------------------------------------------------------
function onHexInput() {
  const v = hexDraft.value.trim();
  const withHash = v.startsWith('#') ? v : `#${v}`;
  if (isValidHex(withHash)) {
    hexInvalid.value = false;
    hsv.value = hexToHsv(withHash);
    commit(normalizeHex(withHash));
  } else {
    hexInvalid.value = v.length > 0;
  }
}

function onClickOutside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) close();
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    e.preventDefault();
    close();
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside);
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside);
  document.removeEventListener('keydown', onKeydown);
});

// Pure-hue background for the SV plane, independent of the current s/v.
const hueBackground = computed(() => hsvToHex(hsv.value.h, 1, 1));
const thumbStyle = computed(() => ({ left: `${hsv.value.s * 100}%`, top: `${(1 - hsv.value.v) * 100}%` }));
const hueThumbStyle = computed(() => ({ left: `${(hsv.value.h / 360) * 100}%` }));
</script>

<template>
  <div ref="root" class="color-picker">
    <button
      type="button"
      class="trigger"
      :aria-label="label"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :aria-controls="`${uid}-panel`"
      @click="toggle"
    >
      <span class="trigger-swatch" :style="{ background: safeValue }" aria-hidden="true" />
      <span class="trigger-hex">{{ safeValue.toUpperCase() }}</span>
      <svg class="chevron" :class="{ open }" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <div
      v-if="open"
      :id="`${uid}-panel`"
      ref="panel"
      class="panel"
      :class="{ 'open-up': openUp }"
      role="dialog"
      :aria-label="label"
    >
      <span class="section-label">{{ t('settings.colorPresets') }}</span>
      <div class="presets" role="group" :aria-label="t('settings.colorPresets')">
        <button
          v-for="c in PRESETS"
          :key="c"
          type="button"
          class="preset"
          :style="{ background: c }"
          :aria-label="c"
          :aria-pressed="safeValue === c"
          @click="pickPreset(c)"
        >
          <svg v-if="safeValue === c" class="check" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>

      <span class="section-label custom-label">{{ t('settings.colorCustom') }}</span>
      <div
        ref="svPlane"
        class="sv-plane"
        :style="{ backgroundColor: hueBackground }"
        @pointerdown="onSvPointerDown"
        @pointermove="onSvPointerMove"
      >
        <div class="sv-white" aria-hidden="true" />
        <div class="sv-black" aria-hidden="true" />
        <div class="sv-thumb" :style="thumbStyle" aria-hidden="true" />
      </div>

      <div
        ref="hueTrack"
        class="hue-track"
        role="slider"
        tabindex="0"
        :aria-label="t('settings.colorHueAria')"
        :aria-valuenow="Math.round(hsv.h)"
        aria-valuemin="0"
        aria-valuemax="359"
        @pointerdown="onHuePointerDown"
        @pointermove="onHuePointerMove"
        @keydown="onHueKeydown"
      >
        <div class="hue-thumb" :style="hueThumbStyle" aria-hidden="true" />
      </div>

      <div class="hex-row">
        <span class="preview" :style="{ background: safeValue }" aria-hidden="true" />
        <input
          v-model="hexDraft"
          class="hex-input"
          :class="{ invalid: hexInvalid }"
          type="text"
          maxlength="7"
          spellcheck="false"
          autocomplete="off"
          :aria-label="t('settings.colorHexAria')"
          @input="onHexInput"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-picker {
  position: relative;
}
.trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px 0 6px;
  border: 1px solid var(--border);
  background: var(--card-strong);
  border-radius: var(--radius-sm);
  color: var(--text);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}
.trigger:hover { border-color: var(--accent); }
.trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.trigger-swatch {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  flex: none;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.14);
}
.trigger-hex {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.02em;
  color: var(--text-2);
}
.chevron {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: var(--text);
  stroke-width: 2.25;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.6;
  transition: transform 150ms ease;
}
.chevron.open { transform: rotate(180deg); }

.panel {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  left: 0;
  width: 220px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--popover);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-pop);
}
/* Flipped when there isn't enough viewport space below the trigger — see
   updatePlacement(). */
.panel.open-up {
  top: auto;
  bottom: calc(100% + 6px);
}
.section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
}
.custom-label { margin-top: 4px; }

.presets {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}
.preset {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border: none;
  border-radius: 8px;
  padding: 0;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.14);
  transition: transform 120ms ease;
}
.preset:hover { transform: scale(1.1); }
.preset:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.preset .check {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: #fff;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
}

.sv-plane {
  position: relative;
  width: 100%;
  height: 120px;
  border-radius: 10px;
  cursor: crosshair;
  touch-action: none;
  overflow: hidden;
}
.sv-white,
.sv-black {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.sv-white { background: linear-gradient(to right, #fff, rgba(255, 255, 255, 0)); }
.sv-black { background: linear-gradient(to top, #000, rgba(0, 0, 0, 0)); }
.sv-thumb {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.4);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.hue-track {
  position: relative;
  width: 100%;
  height: 14px;
  border-radius: var(--radius-pill);
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  cursor: pointer;
  touch-action: none;
}
.hue-track:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.hue-thumb {
  position: absolute;
  top: 50%;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid rgba(0, 0, 0, 0.2);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.hex-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}
.preview {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  flex: none;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.14);
}
.hex-input {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text);
  border-radius: var(--radius-sm);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--text-sm);
  text-transform: uppercase;
}
.hex-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.hex-input.invalid { border-color: var(--warn); color: var(--warn); }
</style>
