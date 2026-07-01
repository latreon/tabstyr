import { describe, expect, test } from 'vitest';
import { buildTagReport, tagNames, tagReportCsv } from '@/lib/tags';
import type { ReportData, ReportDomain } from '@/lib/report';

const dom = (domain: string, seconds: number, category: ReportDomain['category'] = 'Other'): ReportDomain => ({
  domain,
  seconds,
  category,
});

const tags = { 'github.com': 'Acme', 'linear.app': 'Acme', 'figma.com': 'Beta Co' };

describe('buildTagReport', () => {
  test('groups domains by tag, sorted by time; leaves untagged separate', () => {
    const r = buildTagReport(
      [dom('github.com', 600, 'Dev'), dom('linear.app', 300), dom('figma.com', 900), dom('news.com', 120)],
      tags,
    );
    // Acme = 600 + 300 = 900; Beta Co = 900 (tie). Assert as a map to avoid tie-order flakiness.
    expect(Object.fromEntries(r.groups.map((g) => [g.tag, g.seconds]))).toEqual({ Acme: 900, 'Beta Co': 900 });
    expect(r.taggedSeconds).toBe(1800);
    expect(r.untagged.seconds).toBe(120);
    expect(r.untagged.domains.map((d) => d.domain)).toEqual(['news.com']);
    expect(r.totalSeconds).toBe(1920);
  });

  test('domains within a group are sorted desc', () => {
    const r = buildTagReport([dom('linear.app', 300), dom('github.com', 600)], tags);
    const acme = r.groups.find((g) => g.tag === 'Acme')!;
    expect(acme.domains.map((d) => d.domain)).toEqual(['github.com', 'linear.app']);
  });

  test('all untagged → empty groups, everything in untagged', () => {
    const r = buildTagReport([dom('a.com', 100), dom('b.com', 50)], {});
    expect(r.groups).toEqual([]);
    expect(r.taggedSeconds).toBe(0);
    expect(r.untagged.seconds).toBe(150);
  });
});

describe('tagNames', () => {
  test('distinct tag names, alphabetical', () => {
    expect(tagNames(tags)).toEqual(['Acme', 'Beta Co']);
  });
});

describe('tagReportCsv', () => {
  const report: ReportData = {
    from: '2026-06-01',
    to: '2026-06-07',
    days: 7,
    totalSeconds: 1920,
    categories: [],
    domains: [dom('github.com', 600, 'Dev'), dom('linear.app', 300), dom('figma.com', 900), dom('news.com', 120)],
  };

  test('emits header, per-domain rows with subtotals per tag, and a grand total', () => {
    const lines = tagReportCsv(report, tags).split('\r\n');
    expect(lines[0]).toBe('tag,domain,category,active_seconds,active_hm');
    // Acme (900) and Beta Co (900) groups, each with SUBTOTAL; untagged news.com; TOTAL.
    expect(lines).toContain('Acme,github.com,Dev,600,0:10');
    expect(lines).toContain('Acme,SUBTOTAL,,900,0:15');
    expect(lines).toContain('Beta Co,figma.com,Other,900,0:15');
    expect(lines).toContain(',news.com,Other,120,0:02'); // untagged → empty tag column
    expect(lines[lines.length - 1]).toBe('TOTAL,,,1920,0:32');
  });

  test('escapes a tag or domain containing a comma', () => {
    const csv = tagReportCsv(
      { ...report, domains: [dom('a.com', 60)] },
      { 'a.com': 'Acme, Inc.' },
    );
    expect(csv).toContain('"Acme, Inc.",a.com');
  });
});
