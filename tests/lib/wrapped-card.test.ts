import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  canvasToImageBlob,
  renderWrappedCard,
  type WrappedCardContent,
} from '@/lib/wrapped-card';

// happy-dom has no real 2D context, so the drawing commands are recorded through a
// stub — which is the useful contract anyway: what text is drawn, how it's truncated,
// and that the backing store is sized for the export. Mirrors report-card.test.ts.

interface Recorder {
  texts: string[];
  fills: string[];
  gradientStops: string[];
  calls: string[];
}

let rec: Recorder;

function stubContext(charWidth = 10) {
  rec = { texts: [], fills: [], gradientStops: [], calls: [] };
  const gradient = {
    addColorStop: (_: number, color: string) => {
      rec.gradientStops.push(color);
    },
  };
  const ctx = {
    set fillStyle(v: unknown) {
      if (typeof v === 'string') rec.fills.push(v);
    },
    get fillStyle() {
      return '#000';
    },
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    fillText: (t: string) => rec.texts.push(t),
    measureText: (t: string) => ({ width: t.length * charWidth }),
    fillRect: () => rec.calls.push('fillRect'),
    beginPath: () => rec.calls.push('beginPath'),
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arcTo: () => {},
    arc: () => rec.calls.push('arc'),
    fill: () => rec.calls.push('fill'),
    stroke: () => rec.calls.push('stroke'),
    save: () => rec.calls.push('save'),
    restore: () => rec.calls.push('restore'),
    scale: () => rec.calls.push('scale'),
    translate: () => {},
    clip: () => rec.calls.push('clip'),
    drawImage: () => rec.calls.push('drawImage'),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

function canvasWith(ctx: CanvasRenderingContext2D | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as never);
  return canvas;
}

const CONTENT: WrappedCardContent = {
  heading: 'BROWSING WRAPPED',
  periodLabel: 'Jun 1 – Jun 23 · 23 days',
  personaIconPaths: ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6'],
  personaTitle: 'The Builder',
  bigValue: '12h 30m',
  bigCaption: 'total active browsing',
  rows: [
    { label: 'Top site', value: 'github.com', chip: { initial: 'G', color: '#6d5cf0' } },
    { label: 'Busiest day', value: 'Tue, Jun 9' },
    { label: 'Focus', value: '72%' },
  ],
  footer: 'TabStyr · 0 bytes leave your device',
  accentA: '#10b981',
  accentB: '#0f766e',
  theme: 'dark',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('renderWrappedCard', () => {
  test('sizes the backing store to the story format times the scale', () => {
    const canvas = canvasWith(stubContext());
    renderWrappedCard(canvas, CONTENT, 2);
    expect(canvas.width).toBe(CARD_WIDTH * 2);
    expect(canvas.height).toBe(CARD_HEIGHT * 2);
    expect(CARD_WIDTH / CARD_HEIGHT).toBeCloseTo(9 / 16, 5); // 9:16
  });

  test('draws every content string', () => {
    renderWrappedCard(canvasWith(stubContext()), CONTENT, 1);
    // The heading is letter-spaced by hand (canvas has no letter-spacing), so compare
    // it with the spacing stripped rather than pinning the exact spacing scheme.
    expect(rec.texts.map((t) => t.replace(/\s+/g, ''))).toContain('BROWSINGWRAPPED');
    expect(rec.texts).toContain('The Builder');
    expect(rec.texts).toContain('12h 30m');
    expect(rec.texts).toContain('github.com');
    expect(rec.texts).toContain('72%');
    expect(rec.texts.some((t) => t.includes('0 bytes leave your device'))).toBe(true);
  });

  test('uses both accent stops for the background gradient', () => {
    renderWrappedCard(canvasWith(stubContext()), CONTENT, 1);
    expect(rec.gradientStops).toContain('#10b981');
    expect(rec.gradientStops).toContain('#0f766e');
  });

  test('truncates an over-long string with an ellipsis instead of overflowing', () => {
    const long = 'A'.repeat(400);
    renderWrappedCard(canvasWith(stubContext()), { ...CONTENT, personaTitle: long }, 1);
    const drawn = rec.texts.find((t) => t.startsWith('AAA'))!;
    expect(drawn.endsWith('…')).toBe(true);
    expect(drawn.length).toBeLessThan(long.length);
  });

  test('caps the highlight rows at four', () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, value: `V${i}` }));
    renderWrappedCard(canvasWith(stubContext()), { ...CONTENT, rows }, 1);
    const drawnValues = rows.filter((r) => rec.texts.includes(r.value));
    expect(drawnValues.length).toBeLessThanOrEqual(4);
  });

  test('renders a row chip as a letter when no image is supplied', () => {
    renderWrappedCard(canvasWith(stubContext()), CONTENT, 1);
    expect(rec.texts).toContain('G');
    expect(rec.calls).not.toContain('drawImage');
  });

  test('draws a real favicon when the row carries a CORS-clean image', () => {
    const content: WrappedCardContent = {
      ...CONTENT,
      rows: [{ label: 'Top site', value: 'github.com', chip: { initial: 'G', color: '#6d5cf0', image: document.createElement('img') } }],
    };
    renderWrappedCard(canvasWith(stubContext()), content, 1);
    expect(rec.calls).toContain('drawImage');
  });

  test('renders both themes without throwing', () => {
    expect(() => renderWrappedCard(canvasWith(stubContext()), { ...CONTENT, theme: 'light' }, 1)).not.toThrow();
    expect(rec.texts).toContain('The Builder');
  });

  test('is a no-op when the 2D context is unavailable', () => {
    const canvas = canvasWith(null);
    expect(() => renderWrappedCard(canvas, CONTENT, 1)).not.toThrow();
  });
});

describe('canvasToImageBlob', () => {
  test('resolves the encoded blob (JPEG by default — the card is fully opaque)', async () => {
    const canvas = document.createElement('canvas');
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    const toBlob = vi
      .spyOn(canvas, 'toBlob')
      .mockImplementation((cb: BlobCallback) => cb(blob));
    await expect(canvasToImageBlob(canvas)).resolves.toBe(blob);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.9);
  });

  test('resolves null instead of throwing when encoding fails', async () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'toBlob').mockImplementation(() => {
      throw new Error('encoder unavailable');
    });
    await expect(canvasToImageBlob(canvas)).resolves.toBeNull();
  });
});
