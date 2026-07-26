import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import RingLogo from '@/components/RingLogo.vue';

// The brand mark, rendered beside every heading and inside the privacy dialog. It is
// decorative in all of those places, so it must not add noise for screen readers.

describe('RingLogo', () => {
  test('renders an inline SVG at the requested size', () => {
    const w = mount(RingLogo, { props: { size: 24 } });
    const svg = w.get('svg');
    expect(svg.attributes('width')).toBe('24');
    expect(svg.attributes('height')).toBe('24');
  });

  test('is hidden from assistive tech (the brand name is always next to it)', () => {
    const w = mount(RingLogo, { props: { size: 18 } });
    expect(w.get('svg').attributes('aria-hidden')).toBe('true');
  });

  test('has a default size so it can be dropped in without props', () => {
    const w = mount(RingLogo);
    expect(Number(w.get('svg').attributes('width'))).toBeGreaterThan(0);
  });

  test('needs no network request (no external references)', () => {
    const html = mount(RingLogo, { props: { size: 20 } }).html();
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toContain('<image');
  });
});
