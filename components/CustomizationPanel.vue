<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { browser } from 'wxt/browser';
import { getSettings, saveSettings } from '@/lib/settings';
import {
  allCategoryIds,
  categoryColor,
  categoryLabel,
  type CategoryId,
  type CategoryRule,
  type CustomCategory,
  type Productivity,
} from '@/lib/categories';
import SelectBox from '@/components/ui/SelectBox.vue';
import ColorPicker from '@/components/ui/ColorPicker.vue';

const { t } = useI18n();
const emit = defineEmits<{ changed: [] }>();

// Semantic tint per productivity bucket — same palette the rest of the app
// (streaks, focus %) already uses for productive/distracting, so a category's
// productivity pill reads consistently wherever it shows up.
const PRODUCTIVITY_COLOR: Record<Productivity, string> = {
  productive: 'var(--positive)',
  distracting: 'var(--warn)',
  neutral: 'var(--text-3)',
};

// Built-ins plus any user-added categories — the pool a rule can target.
const customCategories = ref<CustomCategory[]>([]);
const CATEGORY_OPTIONS = computed(() =>
  allCategoryIds(customCategories.value).map((c) => ({ value: c, label: categoryLabel(c, t) })),
);
const rules = ref<CategoryRule[]>([]);
const newPattern = ref('');
const newCategory = ref<CategoryId>('Work');
const ruleError = ref('');

// New custom-category form. No productivity picker here — custom categories
// default to neutral (doesn't move Focus %); nothing else in the app lets you
// reclassify a custom category's productivity later, so keeping this out of
// the form removes a control most people never need to touch.
const NEW_CATEGORY_PRODUCTIVITY: Productivity = 'neutral';
const newCatName = ref('');
const newCatColor = ref('#6366f1');
const catError = ref('');

const toast = ref<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function showToast(msg: string) {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 2400);
}

async function refresh() {
  const s = await getSettings();
  rules.value = s.categoryRules;
  customCategories.value = s.customCategories;
}

// Backup restore/merge (in SettingsPanel) can change rules/categories without
// going through this panel's own add/remove calls — 'settings-changed' is
// already broadcast on every settings write, so listening here keeps this
// panel in sync without coupling it to the settings tile.
function onSettingsChanged(msg: unknown) {
  if ((msg as { type?: string } | undefined)?.type === 'settings-changed') void refresh();
}

onMounted(() => {
  void refresh();
  browser.runtime.onMessage.addListener(onSettingsChanged);
});

onBeforeUnmount(() => {
  clearTimeout(toastTimer);
  browser.runtime.onMessage.removeListener(onSettingsChanged);
});

async function addCustomCategory() {
  const name = newCatName.value.trim();
  catError.value = '';
  if (!name) return;
  // Reject collisions with a built-in or an existing custom (case-insensitive), so
  // the picker never shows two categories the user can't tell apart. allCategoryIds
  // already includes the built-in names, so this one check covers both.
  const key = name.toLowerCase();
  if (allCategoryIds(customCategories.value).some((c) => c.toLowerCase() === key)) {
    catError.value = t('settings.categoryExists');
    return;
  }
  const next = [...customCategories.value, { name, color: newCatColor.value, productivity: NEW_CATEGORY_PRODUCTIVITY }];
  try {
    const saved = await saveSettings({ customCategories: next });
    customCategories.value = saved.customCategories;
    // A sanitizer rejection (bad hex, dupe) leaves the list unchanged — surface it.
    if (!saved.customCategories.some((c) => c.name === name)) {
      catError.value = t('settings.categoryInvalid');
      return;
    }
    newCatName.value = '';
    await browser.runtime.sendMessage({ type: 'settings-changed' });
    emit('changed');
    showToast(t('settings.categoryAdded'));
  } catch (e) {
    console.error('[customization] add category failed', e);
    showToast(t('settings.saveFailed'));
  }
}

async function removeCustomCategory(name: string) {
  const next = customCategories.value.filter((c) => c.name !== name);
  try {
    const saved = await saveSettings({ customCategories: next });
    customCategories.value = saved.customCategories;
    rules.value = saved.categoryRules; // rules referencing the removed name were dropped
    catError.value = '';
    await browser.runtime.sendMessage({ type: 'settings-changed' });
    emit('changed');
    showToast(t('settings.categoryRemoved'));
  } catch (e) {
    console.error('[customization] remove category failed', e);
    showToast(t('settings.saveFailed'));
  }
}

async function addRule() {
  const pattern = newPattern.value.trim().toLowerCase();
  ruleError.value = '';
  if (!pattern) return;
  if (rules.value.some((r) => r.pattern === pattern)) {
    ruleError.value = t('settings.ruleExists');
    return;
  }
  const next = [...rules.value, { pattern, category: newCategory.value }];
  try {
    const saved = await saveSettings({ categoryRules: next });
    rules.value = saved.categoryRules;
    newPattern.value = '';
    await browser.runtime.sendMessage({ type: 'settings-changed' });
    emit('changed');
    showToast(t('settings.ruleAdded'));
  } catch (e) {
    console.error('[customization] add rule failed', e);
    showToast(t('settings.ruleAddFailed'));
  }
}

async function removeRule(pattern: string) {
  const next = rules.value.filter((r) => r.pattern !== pattern);
  try {
    const saved = await saveSettings({ categoryRules: next });
    rules.value = saved.categoryRules;
    ruleError.value = '';
    await browser.runtime.sendMessage({ type: 'settings-changed' });
    emit('changed');
  } catch (e) {
    console.error('[customization] remove rule failed', e);
    showToast(t('settings.ruleRemoveFailed'));
  }
}
</script>

<template>
  <div class="tile customization-tile">
    <h2 class="label">{{ t('settings.customTitle') }}</h2>

    <div class="rules-grid">
    <div class="rules cats">
      <div class="section-head">
        <span class="field-label">{{ t('settings.customCategories') }}</span>
        <p class="rules-hint">{{ t('settings.customCategoriesHint') }}</p>
      </div>

      <ul v-if="customCategories.length" class="cat-list">
        <li v-for="c in customCategories" :key="c.name" class="cat-card" :style="{ '--cat-color': c.color }">
          <span class="cat-swatch" aria-hidden="true" />
          <span class="cat-name">{{ c.name }}</span>
          <span class="cat-prod" :style="{ color: PRODUCTIVITY_COLOR[c.productivity] }">
            <span class="cat-prod-dot" aria-hidden="true" />
            {{ t(`productivity.${c.productivity}`) }}
          </span>
          <button class="row-del" :aria-label="t('settings.removeCategoryAria', { name: c.name })" @click="removeCustomCategory(c.name)">✕</button>
        </li>
      </ul>
      <p v-else class="empty-hint">{{ t('settings.noCustomCategories') }}</p>

      <form class="composer" @submit.prevent="addCustomCategory">
        <div class="composer-row">
          <ColorPicker v-model="newCatColor" :label="t('settings.categoryColorAria')" />
          <input
            v-model="newCatName"
            class="rule-input"
            type="text"
            :placeholder="t('settings.categoryNamePlaceholder')"
            :aria-label="t('settings.customCategories')"
            maxlength="24"
          />
          <button type="submit" class="rule-add-btn primary" :disabled="!newCatName.trim()">{{ t('settings.add') }}</button>
        </div>
      </form>
      <p v-if="catError" class="rule-error" role="alert">{{ catError }}</p>
    </div>

    <div class="rules">
      <div class="section-head">
        <span class="field-label">{{ t('settings.customRules') }}</span>
        <p class="rules-hint">{{ t('settings.rulesHint') }}</p>
      </div>

      <ul v-if="rules.length" class="rule-list">
        <li v-for="r in rules" :key="r.pattern" class="rule">
          <code class="rule-pattern">{{ r.pattern }}</code>
          <span class="rule-arrow" aria-hidden="true">→</span>
          <span class="rule-cat" :style="{ '--cat-color': categoryColor(r.category, customCategories) }">
            <span class="rule-cat-dot" aria-hidden="true" />
            {{ categoryLabel(r.category, t) }}
          </span>
          <button class="row-del" :aria-label="t('settings.removeRuleAria', { pattern: r.pattern })" @click="removeRule(r.pattern)">✕</button>
        </li>
      </ul>
      <p v-else class="empty-hint">{{ t('settings.noCustomRules') }}</p>

      <form class="composer" @submit.prevent="addRule">
        <div class="composer-row">
          <input
            v-model="newPattern"
            class="rule-input"
            type="text"
            :placeholder="t('settings.rulePlaceholder')"
            :aria-label="t('settings.customRules')"
            maxlength="100"
          />
          <SelectBox
            :model-value="newCategory"
            :options="CATEGORY_OPTIONS"
            :label="t('settings.categoryForRuleAria')"
            @update:model-value="newCategory = $event as CategoryId"
          />
          <button type="submit" class="rule-add-btn primary" :disabled="!newPattern.trim()">{{ t('settings.add') }}</button>
        </div>
      </form>
      <p v-if="ruleError" class="rule-error" role="alert">{{ ruleError }}</p>
    </div>
    </div>

    <!-- Live region is always present so screen readers announce text swaps. -->
    <div class="toast-host" role="status" aria-live="polite">
      <Transition name="toast">
        <div v-if="toast" class="toast">{{ toast }}</div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.customization-tile {
  position: relative;
  grid-column: 1 / -1;
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-self: start;
}
/* Light mode's default --border (#e5e6ef) is too close to the white card
   surfaces this tile is full of (cards, composer, inputs) — bump contrast
   here only. Dark mode's translucent border already reads fine as-is. This
   cascades to every nested control (inputs, ColorPicker, SelectBox) since
   custom properties inherit through the DOM regardless of component scoping. */
[data-theme='light'] .customization-tile {
  --border: #cdd0dd;
}
.field-label {
  color: var(--text-2);
}
button {
  border: none;
  border-radius: var(--radius-sm);
  padding: 7px 14px;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.rules-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-4);
}
@media (max-width: 760px) {
  .rules-grid { grid-template-columns: minmax(0, 1fr); }
}
.rules {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.rules + .rules {
  padding-left: var(--sp-4);
  border-left: 1px solid var(--divider);
}
@media (max-width: 760px) {
  .rules + .rules {
    padding-left: 0;
    border-left: none;
    margin-top: var(--sp-2);
    padding-top: var(--sp-3);
    border-top: 1px solid var(--divider);
  }
}
.rules-hint {
  margin: 2px 0 0;
  font-size: var(--text-xs);
  line-height: 1.45;
  color: var(--text-3);
}
.section-head {
  display: flex;
  flex-direction: column;
}
.empty-hint {
  margin: 0;
  padding: 14px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--text-3);
  text-align: center;
}
.rule-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rule {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 12px;
  transition: background 120ms ease;
}
.rule:hover { background: var(--row-hover); }
.rule:hover .row-del { opacity: 1; }
.rule-pattern {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: var(--card-strong);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 2px 6px;
  color: var(--text);
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rule-arrow {
  color: var(--text-3);
}
.rule-cat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  font-weight: 600;
  color: var(--text-2);
}
.rule-cat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
  background: var(--cat-color, var(--text-3));
}
.row-del {
  flex: none;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-3);
  border-radius: 6px;
  width: 24px;
  height: 24px;
  padding: 0;
  font-size: var(--text-xs);
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 120ms ease, border-color 120ms ease, color 120ms ease;
}
.row-del:hover,
.row-del:focus-visible {
  opacity: 1;
  border-color: var(--warn);
  color: var(--warn);
}
.rule-input {
  flex: 1;
  min-width: 0;
  height: 34px;
  box-sizing: border-box;
  border: 1px solid var(--border);
  background: var(--card-strong);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 0 10px;
  font-size: var(--text-sm);
  font-family: inherit;
}
.rule-input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.rule-add-btn {
  height: 34px;
  box-sizing: border-box;
  padding: 0 16px;
  background: var(--card-strong);
  color: var(--text-2);
  border: 1px solid var(--border);
}
.rule-add-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}
.rule-add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
/* Primary CTA — same filled-gradient treatment as "Download encrypted" in
   Settings, so the one action that actually saves something reads as such. */
.rule-add-btn.primary {
  background: var(--accent-grad-strong);
  color: var(--on-accent);
  border-color: transparent;
  margin-left: auto;
}
.rule-add-btn.primary:hover:not(:disabled) {
  filter: brightness(1.08);
  border-color: transparent;
  color: var(--on-accent);
}
.rule-error {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--warn);
}

/* Composer: the add-category / add-rule forms get their own slightly raised
   surface so they read as an action area, distinct from the list above. */
.composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 2px;
  padding: 10px;
  background: var(--card-strong);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.composer-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
/* Match the row's other controls (color picker trigger, text input, Add
   button) so nothing looks vertically misaligned. */
.composer-row :deep(.selectbox .trigger) {
  height: 34px;
  box-sizing: border-box;
}

/* Custom-category cards: color accent bar · swatch · name · productivity · delete. */
.cat-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cat-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px 8px 14px;
  background: var(--card-strong);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
}
.cat-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: var(--radius-pill);
  background: var(--cat-color, var(--accent));
}
.cat-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in oklab, var(--cat-color, var(--accent)) 45%, var(--border));
  box-shadow: var(--shadow);
}
.cat-card:hover .row-del { opacity: 1; }
.cat-swatch {
  width: 16px;
  height: 16px;
  border-radius: 6px;
  flex: none;
  background: var(--cat-color, var(--text-3));
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.14);
}
.cat-name {
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cat-prod {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 3px 9px;
  border-radius: var(--radius-pill);
  background: color-mix(in oklab, currentColor 12%, var(--card));
  white-space: nowrap;
}
.cat-prod-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
  background: currentColor;
}

/* Toast */
.toast {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 70;
  background: var(--popover);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: var(--text-sm);
  font-weight: 600;
  padding: 10px 18px;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-pop);
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
