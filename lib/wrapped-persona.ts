// Presentational metadata for the Wrapped personas + chronotypes. Pure data (no
// DOM), kept out of wrapped.ts so the computation stays free of look-and-feel. The
// human-readable title/subtitle live in i18n (wrapped.persona.*) — only the emoji
// and gradient accents are here.

import type { PersonaId, Chronotype } from './wrapped';

export interface PersonaMeta {
  emoji: string;
  /** Background gradient stops for the share card + slide accents. */
  accentA: string;
  accentB: string;
}

export const PERSONA_META: Record<PersonaId, PersonaMeta> = {
  builder: { emoji: '🛠️', accentA: '#10b981', accentB: '#0f766e' },
  operator: { emoji: '🗂️', accentA: '#6366f1', accentB: '#4338ca' },
  socialite: { emoji: '💬', accentA: '#ec4899', accentB: '#be185d' },
  binger: { emoji: '🍿', accentA: '#f59e0b', accentB: '#b45309' },
  analyst: { emoji: '📰', accentA: '#06b6d4', accentB: '#0e7490' },
  tycoon: { emoji: '💹', accentA: '#0d9488', accentB: '#115e59' },
  collector: { emoji: '🛍️', accentA: '#8b5cf6', accentB: '#6d28d9' },
  wanderer: { emoji: '🧭', accentA: '#64748b', accentB: '#334155' },
  explorer: { emoji: '🌌', accentA: '#7c3aed', accentB: '#1d4ed8' },
};

export const CHRONOTYPE_EMOJI: Record<Chronotype, string> = {
  earlyBird: '🌅',
  daytimer: '☀️',
  nightOwl: '🦉',
  allHours: '🕛',
};
