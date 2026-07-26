import { afterEach, describe, expect, test } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import PrivacyDialog from '@/components/PrivacyDialog.vue';

// The privacy overlay is the extension's central promise to the user, deep-linked
// from the marketing site (#privacy). It is also a modal, so the dialog semantics and
// the background inerting matter as much as the copy.

let open: VueWrapper[] = [];

// The dialog teleports to <body>, so its markup is queried through the document
// rather than the wrapper. Every mount is unmounted in afterEach because
// useFocusTrap ref-counts the page lock in module scope — a leaked mount would keep
// the count above zero and make the next test's lock assertions meaningless.
function mountDialog() {
  const app = document.createElement('div');
  app.id = 'app';
  document.body.appendChild(app);
  const w = mount(PrivacyDialog, { attachTo: app });
  open.push(w);
  return w;
}

const panel = () => document.querySelector('.panel')!;
const click = (selector: string) => {
  document.querySelector<HTMLElement>(selector)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

afterEach(() => {
  for (const w of open) w.unmount();
  open = [];
  document.body.innerHTML = '';
});

describe('PrivacyDialog', () => {
  test('is an accessible modal dialog with a name', () => {
    mountDialog();
    expect(panel().getAttribute('role')).toBe('dialog');
    expect(panel().getAttribute('aria-modal')).toBe('true');
    expect(panel().getAttribute('aria-label')).toBeTruthy();
  });

  test('states plainly that nothing leaves the device', () => {
    mountDialog();
    expect(document.body.textContent ?? '').toMatch(/never leaves|leave your device|stays on|local/i);
  });

  test('lists what is stored and what is deliberately not tracked', () => {
    mountDialog();
    const items = panel().querySelectorAll('li');
    expect(items.length).toBeGreaterThanOrEqual(4);
    for (const li of items) expect(li.textContent?.trim()).not.toBe('');
  });

  test('inerts the page behind it and locks scrolling while open', () => {
    const w = mountDialog();
    const app = document.getElementById('app')!;
    expect(app.hasAttribute('inert')).toBe(true);
    expect(app.getAttribute('aria-hidden')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');

    w.unmount();
    open = open.filter((x) => x !== w);
    expect(app.hasAttribute('inert')).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  test('closes on the close button', () => {
    const w = mountDialog();
    click('.close');
    expect(w.emitted('close')).toHaveLength(1);
  });

  test('closes on Escape', () => {
    const w = mountDialog();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(w.emitted('close')).toHaveLength(1);
  });

  test('closes on a backdrop click but not on a click inside the panel', () => {
    const w = mountDialog();
    click('.panel'); // bubbles to the backdrop, but @click.self must ignore it
    expect(w.emitted('close')).toBeUndefined();

    document.querySelector<HTMLElement>('.backdrop')!.dispatchEvent(new MouseEvent('click'));
    expect(w.emitted('close')).toHaveLength(1);
  });

  test('stops listening for Escape once unmounted', () => {
    const w = mountDialog();
    w.unmount();
    open = open.filter((x) => x !== w);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(w.emitted('close')).toBeUndefined();
  });
});
