import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue';

// While any trapped dialog is open, hide the app root from assistive tech and
// pointer/focus interaction. Ref-counted so stacked dialogs are safe. Modals are
// teleported to <body> (outside #app), so inerting #app disables only the
// background, never the dialog itself.
let openDialogs = 0;
function lockBackground() {
  if (openDialogs++ === 0) {
    const app = document.getElementById('app');
    app?.setAttribute('inert', '');
    app?.setAttribute('aria-hidden', 'true');
  }
}
function unlockBackground() {
  if (openDialogs > 0 && --openDialogs === 0) {
    const app = document.getElementById('app');
    app?.removeAttribute('inert');
    app?.removeAttribute('aria-hidden');
  }
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Keep keyboard focus inside `container` while a dialog is open, and restore
 * focus to whatever was focused before it opened once it closes.
 *
 * - With no `isActive` ref, the trap follows the component's own lifetime
 *   (activate on mount, release on unmount) — for components that ARE the modal.
 * - With an `isActive` ref, it activates/deactivates as that flag flips — for a
 *   modal rendered with v-if inside a larger component.
 *
 * It does not steal initial focus; the dialog decides what to focus first.
 */
export function useFocusTrap(container: Ref<HTMLElement | null>, isActive?: Ref<boolean>) {
  let previouslyFocused: HTMLElement | null = null;

  function focusable(): HTMLElement[] {
    const root = container.value;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
    );
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const root = container.value;
    if (!root) return;
    const items = focusable();
    if (!items.length) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    const inside = !!active && root.contains(active);
    if (e.shiftKey) {
      if (!inside || active === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (!inside || active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  let active = false;
  function activate() {
    if (active) return;
    active = true;
    previouslyFocused = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', onKeydown, true);
    lockBackground();
  }

  function deactivate() {
    if (!active) return;
    active = false;
    document.removeEventListener('keydown', onKeydown, true);
    unlockBackground();
    previouslyFocused?.focus?.();
    previouslyFocused = null;
  }

  if (isActive) {
    watch(isActive, (on) => (on ? activate() : deactivate()));
    onMounted(() => isActive.value && activate());
    onBeforeUnmount(deactivate);
  } else {
    onMounted(activate);
    onBeforeUnmount(deactivate);
  }
}
