import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import FaviconChip from '@/components/FaviconChip.vue';
import * as favicon from '@/lib/favicon';

// The chip appears next to every site in the app, and it has three fallback layers
// (real favicon → browser glyph → letter chip) plus a light-icon-on-white guard.
// Untested until now, so a broken fallback would show as an invisible icon.

beforeEach(() => {
  vi.restoreAllMocks();
});

// `naturalWidth` is read-only on the element, so define it on the instance before
// firing `load` — the component reads it off event.target to spot an empty decode.
async function fireLoad(w: ReturnType<typeof mount>, naturalWidth: number) {
  const img = w.get('img');
  Object.defineProperty(img.element, 'naturalWidth', { value: naturalWidth, configurable: true });
  await img.trigger('load');
}

describe('FaviconChip', () => {
  test('renders the letter chip when no favicon API is available (Firefox/Safari)', () => {
    vi.spyOn(favicon, 'faviconUrl').mockReturnValue(null);
    const w = mount(FaviconChip, { props: { domain: 'github.com' } });
    expect(w.find('img').exists()).toBe(false);
    const chip = w.get('.chip');
    expect(chip.text()).toBe('G');
    // Decorative: the domain is always written next to it in the surrounding row.
    expect(chip.attributes('aria-hidden')).toBe('true');
  });

  test('renders the image when the privileged favicon URL exists (Chromium)', () => {
    vi.spyOn(favicon, 'faviconUrl').mockReturnValue('chrome-extension://x/_favicon/?pageUrl=y');
    const w = mount(FaviconChip, { props: { domain: 'github.com' } });
    expect(w.get('img').attributes('src')).toContain('_favicon');
  });

  test('falls back to the letter chip when the image fails to load', async () => {
    vi.spyOn(favicon, 'faviconUrl').mockReturnValue('chrome-extension://x/_favicon/?pageUrl=y');
    const w = mount(FaviconChip, { props: { domain: 'github.com' } });
    await w.get('img').trigger('error');
    expect(w.find('img').exists()).toBe(false);
    expect(w.get('.chip').text()).toBe('G');
  });

  test('a 0×0 decode counts as a failure even though no error fired', async () => {
    vi.spyOn(favicon, 'faviconUrl').mockReturnValue('chrome-extension://x/_favicon/?pageUrl=y');
    const w = mount(FaviconChip, { props: { domain: 'github.com' } });
    await fireLoad(w, 0);
    expect(w.find('img').exists()).toBe(false);
    expect(w.get('.chip').text()).toBe('G');
  });

  test('a near-white favicon gets the dark tile so it stays visible', async () => {
    vi.spyOn(favicon, 'faviconUrl').mockReturnValue('chrome-extension://x/_favicon/?pageUrl=y');
    vi.spyOn(favicon, 'isLightFavicon').mockReturnValue(true);
    const w = mount(FaviconChip, { props: { domain: 'github.com' } });
    await fireLoad(w, 16);
    expect(w.get('img').classes()).toContain('raster-dark');
  });

  test('a normal favicon keeps the default tile', async () => {
    vi.spyOn(favicon, 'faviconUrl').mockReturnValue('chrome-extension://x/_favicon/?pageUrl=y');
    vi.spyOn(favicon, 'isLightFavicon').mockReturnValue(false);
    const w = mount(FaviconChip, { props: { domain: 'github.com' } });
    await fireLoad(w, 16);
    expect(w.get('img').classes()).not.toContain('raster-dark');
  });

  test('internal browser pages get the browser glyph, not a letter', () => {
    vi.spyOn(favicon, 'faviconUrl').mockReturnValue(null);
    for (const domain of ['chrome', 'chrome-untrusted', 'edge']) {
      const w = mount(FaviconChip, { props: { domain } });
      expect(w.find('svg.favicon').exists(), domain).toBe(true);
      expect(w.find('.chip').exists(), domain).toBe(false);
    }
  });

  test('changing the domain resets the failure state so the new icon is attempted', async () => {
    vi.spyOn(favicon, 'faviconUrl').mockReturnValue('chrome-extension://x/_favicon/?pageUrl=y');
    const w = mount(FaviconChip, { props: { domain: 'github.com' } });
    await w.get('img').trigger('error');
    expect(w.find('img').exists()).toBe(false);
    await w.setProps({ domain: 'gitlab.com' });
    expect(w.find('img').exists()).toBe(true);
  });

  test('the letter chip is deterministic per domain', () => {
    vi.spyOn(favicon, 'faviconUrl').mockReturnValue(null);
    const first = mount(FaviconChip, { props: { domain: 'reddit.com' } }).get('.chip');
    const second = mount(FaviconChip, { props: { domain: 'reddit.com' } }).get('.chip');
    expect(first.attributes('style')).toBe(second.attributes('style'));
    expect(first.text()).toBe('R');
  });
});
