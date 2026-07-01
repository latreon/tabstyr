// "Browsing Wrapped" — a Spotify-Wrapped-style summary computed entirely from a
// TabStyr backup (or the browser's own stored data). Pure functions only: no DOM,
// no storage, no clock except the `now`/`exportedAt` values the caller passes in,
// so the whole thing is deterministic and unit-testable.
//
// Everything here treats its input as UNTRUSTED — the records arrive from
// parseBackup() (lib/restore.ts), which already drops malformed rows and clamps
// insane values, but we re-clamp defensively (Math.max(0, …)) so a stray negative
// can never poison a headline number.

import { addDays } from './time';
import { displayDomain, isWebDomain } from './domain';
import { activeSeconds } from './metrics';
import { buildHourlyHeatmap, peakHour, type HeatmapData } from './heatmap';
import { coalesceSessions } from './sessionize';
import {
  makeCategorizer,
  CATEGORY_PRODUCTIVITY,
  type Category,
  type CategoryRule,
  type Productivity,
} from './categories';
import type { DailyStat, Session } from './types';

/** The minimum input the builder needs — a subset of a parsed backup. */
export interface WrappedInput {
  dailyStats: DailyStat[];
  sessions: Session[];
  overrides?: Record<string, Category>;
  rules?: readonly CategoryRule[];
  /** Per-category productive/distracting split; defaults to CATEGORY_PRODUCTIVITY. */
  productivity?: Record<Category, Productivity>;
}

export interface WrappedSite {
  /** Real hostname (for favicon + categorize). */
  domain: string;
  /** `www.`-stripped label for display. */
  label: string;
  /** Active foreground seconds across the whole range. */
  seconds: number;
  category: Category;
}

export interface WrappedCategory {
  category: Category;
  seconds: number;
  /** Share of total active time, 0–100 (rounded). */
  pct: number;
}

/** When in the day the person browses most — drives a flavour line + emoji. */
export type Chronotype = 'earlyBird' | 'daytimer' | 'nightOwl' | 'allHours';

/** A derived archetype. The id maps to copy + emoji + accent in the UI layer. */
export type PersonaId =
  | 'builder' // Dev
  | 'operator' // Work
  | 'socialite' // Social
  | 'binger' // Media
  | 'analyst' // News
  | 'tycoon' // Finance
  | 'collector' // Shopping
  | 'wanderer' // Other
  | 'explorer'; // no single dominant category

export interface WrappedPersona {
  id: PersonaId;
  /** The category that drove the persona (null for the diffuse "explorer"). */
  category: Category | null;
}

export interface WrappedData {
  // ── Coverage window ──────────────────────────────────────────────────────
  /** Earliest local date (YYYY-MM-DD) with any active time. */
  startDate: string;
  /** Latest local date (YYYY-MM-DD) with any active time. */
  endDate: string;
  /** Distinct days that actually had activity. */
  daysCovered: number;
  /** Calendar span end−start+1 (≥ daysCovered). */
  spanDays: number;

  // ── Headline ─────────────────────────────────────────────────────────────
  /** Total active foreground seconds. The hero number. */
  totalSeconds: number;
  /** Total background-audio seconds (counted separately, never in totalSeconds). */
  totalAudioSeconds: number;
  /** totalSeconds ÷ daysCovered (a typical active day). */
  dailyAverageSeconds: number;

  // ── Sites ──────────────────────────────────────────────────────────────────
  topSites: WrappedSite[]; // up to 5, time desc
  topSite: WrappedSite | null;
  distinctDomains: number;

  // ── Categories ─────────────────────────────────────────────────────────────
  categories: WrappedCategory[]; // time desc, only non-zero
  topCategory: WrappedCategory | null;

  // ── Time of day ──────────────────────────────────────────────────────────
  peak: { day: number; hour: number; seconds: number } | null;
  chronotype: Chronotype;

  // ── Days ───────────────────────────────────────────────────────────────────
  busiestDate: string | null;
  busiestDateSeconds: number;

  // ── Focus ──────────────────────────────────────────────────────────────────
  /** Productive ÷ (productive + distracting) across the whole range, 0–100. */
  focusPct: number;
  productiveSeconds: number;
  distractingSeconds: number;
  /** Longest run of consecutive judged days at/above the focus target. */
  longestStreak: number;
  focusTarget: number;

  // ── Visit shape ──────────────────────────────────────────────────────────
  /** Longest single coalesced foreground visit, in seconds. */
  longestVisitSeconds: number;
  visitCount: number;

  // ── Identity ─────────────────────────────────────────────────────────────
  persona: WrappedPersona;
}

const FOCUS_TARGET = 50;
/** A top category must own at least this share to define the persona; below it the
 * browsing is too spread out and we award the diffuse "explorer". */
const PERSONA_DOMINANCE = 0.35;
/** A chronotype band must own at least this share of hourly time, else "allHours". */
const CHRONOTYPE_DOMINANCE = 0.34;

const PERSONA_BY_CATEGORY: Record<Category, PersonaId> = {
  Dev: 'builder',
  Work: 'operator',
  Social: 'socialite',
  Media: 'binger',
  News: 'analyst',
  Finance: 'tycoon',
  Shopping: 'collector',
  Other: 'wanderer',
};

interface DayAgg {
  productive: number;
  distracting: number;
  neutral: number;
  total: number;
}

/** Per-date productive/distracting/neutral split, in ACTIVE seconds. One source of
 * truth for both the overall focus % and the longest-streak scan. */
function aggregateByDate(
  stats: DailyStat[],
  categoryOf: (domain: string) => Category,
  prod: Record<Category, Productivity> = CATEGORY_PRODUCTIVITY,
): Map<string, DayAgg> {
  const byDate = new Map<string, DayAgg>();
  for (const s of stats) {
    const active = activeSeconds(s);
    if (active <= 0) continue;
    const agg = byDate.get(s.date) ?? { productive: 0, distracting: 0, neutral: 0, total: 0 };
    agg[prod[categoryOf(s.domain)]] += active;
    agg.total += active;
    byDate.set(s.date, agg);
  }
  return byDate;
}

const dayFocusPct = (a: DayAgg): number => {
  const judged = a.productive + a.distracting;
  return judged ? Math.round((a.productive / judged) * 100) : 0;
};

/**
 * Longest run of consecutive calendar days whose focus % meets the target. Days
 * you didn't browse (no active time) and days spent only on neutral sites (nothing
 * to judge) are TRANSPARENT — they neither extend nor break a run, because a day
 * off shouldn't reset a focus streak. A judged day below target breaks it.
 */
function longestFocusStreak(
  byDate: Map<string, DayAgg>,
  start: string,
  end: string,
  target: number,
): number {
  if (start > end) return 0;
  let best = 0;
  let current = 0;
  let cursor = start;
  // Bounded loop: the export retains ~90 days, but accept any sane span without
  // running away on a corrupt start/end pair.
  for (let i = 0; i < 4000 && cursor <= end; i++) {
    const agg = byDate.get(cursor);
    const judged = agg ? agg.productive + agg.distracting : 0;
    if (agg && judged > 0) {
      if (dayFocusPct(agg) >= target) {
        current++;
        if (current > best) best = current;
      } else {
        current = 0;
      }
    }
    // else: empty or neutral-only day — leave `current` untouched (transparent).
    cursor = addDays(cursor, 1);
  }
  return best;
}

/** Aggregate active foreground seconds per real web domain, time desc. */
function topDomains(
  stats: DailyStat[],
  categoryOf: (domain: string) => Category,
): WrappedSite[] {
  const byDomain = new Map<string, number>();
  for (const s of stats) {
    if (!isWebDomain(s.domain)) continue; // belt-and-suspenders; parseBackup already filters
    const active = activeSeconds(s);
    if (active <= 0) continue;
    byDomain.set(s.domain, (byDomain.get(s.domain) ?? 0) + active);
  }
  return [...byDomain.entries()]
    .map(([domain, seconds]) => ({
      domain,
      label: displayDomain(domain),
      seconds,
      category: categoryOf(domain),
    }))
    .sort((a, b) => b.seconds - a.seconds);
}

function buildCategories(sites: WrappedSite[], totalSeconds: number): WrappedCategory[] {
  const byCat = new Map<Category, number>();
  for (const s of sites) byCat.set(s.category, (byCat.get(s.category) ?? 0) + s.seconds);
  return [...byCat.entries()]
    .map(([category, seconds]) => ({
      category,
      seconds,
      pct: totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 100) : 0,
    }))
    .sort((a, b) => b.seconds - a.seconds);
}

/** Sum each hour-of-day across all weekdays from the heatmap grid. */
function chronotypeOf(heatmap: HeatmapData): Chronotype {
  const hourly = new Array<number>(24).fill(0);
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) hourly[hour] += heatmap.grid[day][hour];
  }
  const total = hourly.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return 'allHours';
  const sumBand = (hours: number[]) => hours.reduce((sum, h) => sum + hourly[h], 0);
  const bands: Array<{ type: Chronotype; hours: number[] }> = [
    { type: 'earlyBird', hours: [5, 6, 7, 8, 9, 10] },
    { type: 'daytimer', hours: [11, 12, 13, 14, 15, 16, 17] },
    { type: 'nightOwl', hours: [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4] },
  ];
  let best = { type: 'allHours' as Chronotype, seconds: -1 };
  for (const b of bands) {
    const seconds = sumBand(b.hours);
    if (seconds > best.seconds) best = { type: b.type, seconds };
  }
  return best.seconds / total >= CHRONOTYPE_DOMINANCE ? best.type : 'allHours';
}

function busiestDay(stats: DailyStat[]): { date: string | null; seconds: number } {
  const byDate = new Map<string, number>();
  for (const s of stats) {
    const active = activeSeconds(s);
    if (active <= 0) continue;
    byDate.set(s.date, (byDate.get(s.date) ?? 0) + active);
  }
  let best = { date: null as string | null, seconds: 0 };
  for (const [date, seconds] of byDate) {
    if (seconds > best.seconds) best = { date, seconds };
  }
  return best;
}

function pickPersona(top: WrappedCategory | null, totalSeconds: number): WrappedPersona {
  if (!top || totalSeconds <= 0) return { id: 'explorer', category: null };
  const dominant = top.seconds / totalSeconds >= PERSONA_DOMINANCE;
  return dominant
    ? { id: PERSONA_BY_CATEGORY[top.category], category: top.category }
    : { id: 'explorer', category: null };
}

/**
 * Build the full Wrapped summary, or `null` when there isn't enough tracked time
 * to say anything (no active foreground seconds at all). The caller shows an empty
 * state on null.
 */
export function buildWrapped(input: WrappedInput): WrappedData | null {
  const categoryOf = makeCategorizer(input.overrides ?? {}, input.rules ?? []);
  const stats = input.dailyStats;

  const sites = topDomains(stats, categoryOf);
  const totalSeconds = sites.reduce((sum, s) => sum + s.seconds, 0);
  if (totalSeconds <= 0) return null;

  const totalAudioSeconds = Math.max(
    0,
    Math.round(stats.reduce((sum, s) => sum + Math.max(0, s.audioSeconds), 0)),
  );

  // aggregateByDate only records dates with active time, so its keys ARE the
  // coverage window — derive the date range from it instead of a separate pass +
  // Set over every stat row.
  const byDate = aggregateByDate(stats, categoryOf, input.productivity ?? CATEGORY_PRODUCTIVITY);
  const activeDates = [...byDate.keys()].sort();
  const startDate = activeDates[0];
  const endDate = activeDates[activeDates.length - 1];
  const daysCovered = activeDates.length;
  const spanDays = daySpan(startDate, endDate);

  let productiveSeconds = 0;
  let distractingSeconds = 0;
  for (const agg of byDate.values()) {
    productiveSeconds += agg.productive;
    distractingSeconds += agg.distracting;
  }
  const judged = productiveSeconds + distractingSeconds;
  const focusPct = judged ? Math.round((productiveSeconds / judged) * 100) : 0;
  const longestStreak = longestFocusStreak(byDate, startDate, endDate, FOCUS_TARGET);

  // Heatmap, peak hour, chronotype, and visit shape come from FOREGROUND web
  // sessions only — background-audio sessions would smear the activity clock.
  const foreground = input.sessions.filter((s) => !s.audio && isWebDomain(s.domain));
  const heatmap = buildHourlyHeatmap(foreground);
  const peak = peakHour(heatmap);
  const chronotype = chronotypeOf(heatmap);

  const visits = coalesceSessions(foreground);
  const longestVisitSeconds = visits.reduce(
    (max, v) => Math.max(max, Math.round((v.end - v.start) / 1000)),
    0,
  );

  const categories = buildCategories(sites, totalSeconds);
  const topCategory = categories[0] ?? null;
  const busiest = busiestDay(stats);

  return {
    startDate,
    endDate,
    daysCovered,
    spanDays,
    totalSeconds: Math.round(totalSeconds),
    totalAudioSeconds,
    dailyAverageSeconds: daysCovered ? Math.round(totalSeconds / daysCovered) : 0,
    topSites: sites.slice(0, 5),
    topSite: sites[0] ?? null,
    distinctDomains: sites.length,
    categories,
    topCategory,
    peak,
    chronotype,
    busiestDate: busiest.date,
    busiestDateSeconds: Math.round(busiest.seconds),
    focusPct,
    productiveSeconds: Math.round(productiveSeconds),
    distractingSeconds: Math.round(distractingSeconds),
    longestStreak,
    focusTarget: FOCUS_TARGET,
    longestVisitSeconds,
    visitCount: visits.length,
    persona: pickPersona(topCategory, totalSeconds),
  };
}

/** Calendar span (inclusive) between two YYYY-MM-DD keys, in days. `0` on bad input. */
function daySpan(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00`);
  const b = Date.parse(`${end}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}
