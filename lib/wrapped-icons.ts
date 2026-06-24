// Shared icon registry for "Browsing Wrapped" — Lucide-style line icons on a
// 24×24 grid, expressed as raw SVG path `d` strings. The SAME data drives both the
// DOM (WrappedIcon.vue renders <path>) and the share card canvas (Path2D stroke),
// so the persona glyph on the downloadable image matches the one on screen exactly.
// Pure data, no DOM — safe to import anywhere.

import type { PersonaId, Chronotype } from './wrapped';

export interface IconDef {
  /** One or more SVG path `d` strings, drawn on a 0 0 24 24 viewBox. */
  paths: readonly string[];
  /** When true the paths are filled rather than stroked (e.g. the play glyph). */
  filled?: boolean;
}

// `RAW` keeps literal keys (for the IconName union); `ICONS` exposes them typed as
// IconDef so `.filled` is always accessible (optional) on any looked-up icon.
const RAW = {
  // ── Personas ───────────────────────────────────────────────────────────
  builder: { paths: ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'] },
  operator: { paths: ['M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16', 'M2 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z'] },
  socialite: { paths: ['M7.9 20A9 9 0 1 0 4 16.1L2 22z'] },
  binger: { paths: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'm10 8 6 4-6 4z'] },
  analyst: { paths: ['M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2', 'M18 14h-8', 'M15 18h-5', 'M10 6h8v4h-8z'] },
  tycoon: { paths: ['M16 7h6v6', 'M22 7l-8.5 8.5-5-5L2 17'] },
  collector: { paths: ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'] },
  wanderer: { paths: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'm16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z'] },
  explorer: { paths: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'] },

  // ── Chronotypes ──────────────────────────────────────────────────────────
  earlyBird: { paths: ['M12 2v8', 'M5.2 11.2l1.4 1.4', 'M2 18h2', 'M20 18h2', 'M17.4 12.6l1.4-1.4', 'M22 22H2', 'M8 6l4-4 4 4', 'M16 18a4 4 0 0 0-8 0'] },
  daytimer: { paths: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M6.3 17.7l-1.4 1.4', 'M19.1 4.9l-1.4 1.4'] },
  nightOwl: { paths: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z'] },
  allHours: { paths: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v6l4 2'] },

  // ── UI / slides ──────────────────────────────────────────────────────────
  sparkles: { paths: ['m12 3-1.9 5.8L4.3 10.7l5.8 1.9L12 18.4l1.9-5.8 5.8-1.9-5.8-1.9z', 'M5 19l.6 1.8L7.4 21.4 5.6 22 5 23.8 4.4 22 2.6 21.4 4.4 20.8z'] },
  timer: { paths: ['M10 2h4', 'M12 14l3-3', 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z'] },
  eye: { paths: ['M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'] },
  trophy: { paths: ['M6 9H4.5a2.5 2.5 0 0 1 0-5H6', 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18', 'M4 22h16', 'M10 14.7V17c0 .6-.5 1-1 1.2-1.2.5-2 2-2 3.8', 'M14 14.7V17c0 .6.5 1 1 1.2 1.2.5 2 2 2 3.8', 'M18 2H6v7a6 6 0 0 0 12 0z'] },
  layers: { paths: ['m12 2 9 5-9 5-9-5z', 'M3 12l9 5 9-5', 'M3 17l9 5 9-5'] },
  target: { paths: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', 'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'] },
  upload: { paths: ['M12 13v8', 'M16 16l-4-4-4 4', 'M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.3'] },
  lock: { paths: ['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'] },
  download: { paths: ['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14'] },
  share: { paths: ['M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M8.6 13.5l6.8 4', 'M15.4 6.5l-6.8 4'] },
  chevronLeft: { paths: ['m15 18-6-6 6-6'] },
  chevronRight: { paths: ['m9 18 6-6-6-6'] },
  play: { paths: ['m6 4 14 8-14 8z'], filled: true },
  pause: { paths: ['M6 4h4v16H6z', 'M14 4h4v16h-4z'], filled: true },
  restart: { paths: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5'] },
  check: { paths: ['M20 6 9 17l-5-5'] },
} as const;

export type IconName = keyof typeof RAW;
export const ICONS: Record<IconName, IconDef> = RAW;

export const PERSONA_ICON: Record<PersonaId, IconName> = {
  builder: 'builder',
  operator: 'operator',
  socialite: 'socialite',
  binger: 'binger',
  analyst: 'analyst',
  tycoon: 'tycoon',
  collector: 'collector',
  wanderer: 'wanderer',
  explorer: 'explorer',
};

export const CHRONOTYPE_ICON: Record<Chronotype, IconName> = {
  earlyBird: 'earlyBird',
  daytimer: 'daytimer',
  nightOwl: 'nightOwl',
  allHours: 'allHours',
};
