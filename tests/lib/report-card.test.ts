import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderReportCard, ensureCardFont, REPORT_WIDTH, REPORT_HEIGHT, REPORT_MAX_ROWS, type ReportCardContent } from '@/lib/report-card';

// happy-dom has no real 2D context, so record the drawing commands through a stub.
// That is the useful thing to assert anyway: which text is drawn, in what order, and
// how it is truncated — the renderer's actual contract.

interface Recorder {
  texts: string[];
  fills: string[];
  calls: string[];
}

let rec: Recorder;

function stubContext(charWidth = 8) {
  rec = { texts: [], fills: [], calls: [] };
  const ctx = {
    canvas: null as unknown,
    set fillStyle(v: string) { rec.fills.push(v); },
    get fillStyle() { return '#000'; },
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    fillText: (t: string) => { rec.texts.push(t); },
    measureText: (t: string) => ({ width: t.length * charWidth }),
    fillRect: () => rec.calls.push('fillRect'),
    strokeRect: () => rec.calls.push('strokeRect'),
    beginPath: () => rec.calls.push('beginPath'),
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arcTo: () => {},
    arc: () => {},
    fill: () => rec.calls.push('fill'),
    stroke: () => rec.calls.push('stroke'),
    save: () => {},
    restore: () => {},
    clip: () => {},
    translate: () => {},
    scale: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
}

function content(over: Partial<ReportCardContent> = {}): ReportCardContent {
  return {
    heading: 'Activity report',
    periodLabel: 'Thu, Jun 11',
    totalLabel: 'Total active',
    totalValue: '4h 12m',
    categoryLabel: 'By category',
    categories: [
      { label: 'Work', pct: 70, color: '#6366f1' },
      { label: 'Social', pct: 30, color: '#ec4899' },
    ],
    sitesLabel: 'By site',
    rows: [
      { label: 'github.com', value: '2h', color: '#10b981' },
      { label: 'news.ycombinator.com', value: '1h', color: '#06b6d4' },
    ],
    moreLabel: '',
    brand: 'TabStyr',
    tagline: 'tabstyr.com',
    theme: 'light',
    ...over,
  };
}

beforeEach(() => stubContext());
afterEach(() => vi.restoreAllMocks());

describe('renderReportCard', () => {
  test('sizes the canvas for the requested pixel ratio', () => {
    const canvas = document.createElement('canvas');
    renderReportCard(canvas, content(), 2);
    expect(canvas.width).toBe(REPORT_WIDTH * 2);
    expect(canvas.height).toBe(REPORT_HEIGHT * 2);
  });

  test('draws every piece of caller-supplied text', () => {
    renderReportCard(document.createElement('canvas'), content(), 1);
    // Section labels are drawn upper-cased as an eyebrow, so compare case-insensitively.
    const drawn = rec.texts.join('|').toLowerCase();
    for (const s of ['Activity report', 'Thu, Jun 11', 'Total active', '4h 12m', 'By category', 'Work', 'By site', 'github.com', '2h', 'TabStyr', 'tabstyr.com']) {
      expect(drawn).toContain(s.toLowerCase());
    }
  });

  test('truncates a label that will not fit, with an ellipsis', () => {
    // 40px per character makes even a short label overflow the row.
    stubContext(40);
    renderReportCard(document.createElement('canvas'), content({
      rows: [{ label: 'an-extremely-long-hostname.example.com', value: '1h', color: '#000' }],
    }), 1);
    const long = rec.texts.find((t) => t.startsWith('an-extremely'));
    expect(long).toBeDefined();
    expect(long).toContain('…');
    expect(long!.length).toBeLessThan('an-extremely-long-hostname.example.com'.length);
  });

  test('caps the site list and draws the "more" note instead', () => {
    const rows = Array.from({ length: REPORT_MAX_ROWS + 5 }, (_, i) => ({ label: `site${i}.com`, value: '1m', color: '#000' }));
    renderReportCard(document.createElement('canvas'), content({ rows, moreLabel: '+5 more' }), 1);
    expect(rec.texts).toContain('site0.com');
    expect(rec.texts).not.toContain(`site${REPORT_MAX_ROWS + 4}.com`);
    expect(rec.texts).toContain('+5 more');
  });

  test('the two themes paint different colours', () => {
    renderReportCard(document.createElement('canvas'), content({ theme: 'light' }), 1);
    const light = rec.fills.join('|');
    renderReportCard(document.createElement('canvas'), content({ theme: 'dark' }), 1);
    const dark = rec.fills.join('|');
    expect(light).not.toBe(dark);
  });

  test('is a safe no-op when there is no 2D context at all', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(() => renderReportCard(document.createElement('canvas'), content(), 1)).not.toThrow();
  });

  test('renders with no categories and no rows', () => {
    expect(() =>
      renderReportCard(document.createElement('canvas'), content({ categories: [], rows: [] }), 1),
    ).not.toThrow();
  });
});

describe('ensureCardFont', () => {
  test('resolves when the FontFaceSet API is absent', async () => {
    await expect(ensureCardFont()).resolves.toBeUndefined();
  });

  test('requests the card font and waits for it when the API exists', async () => {
    const load = vi.fn().mockResolvedValue([]);
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { load, ready: Promise.resolve() },
    });
    await ensureCardFont();
    // Canvas does not trigger webfont loading itself, so the face must be requested
    // explicitly or the PNG silently renders in the fallback font.
    expect(load).toHaveBeenCalled();
    expect(load.mock.calls.flat().join(' ')).toContain('InterVar');
    Reflect.deleteProperty(document, 'fonts');
  });

  test('a font that fails to load does not block the export', async () => {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { load: vi.fn().mockRejectedValue(new Error('nope')), ready: Promise.resolve() },
    });
    await expect(ensureCardFont()).resolves.toBeUndefined();
    Reflect.deleteProperty(document, 'fonts');
  });
});
