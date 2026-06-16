#!/usr/bin/env node
/**
 * Keep the README version badge in lockstep with package.json — without any
 * external service. The repo is private, so shields' github/package-json
 * endpoint can't read it; instead we render a shields-style flat SVG locally
 * and commit it. The README references it by relative path:
 *
 *   ![Version](./.github/badges/version.svg)
 *
 * The version lives only in package.json. The SVG is regenerated from it.
 *
 * Modes:
 *   node scripts/sync-readme-version.mjs           # check (CI): exit 1 on drift
 *   node scripts/sync-readme-version.mjs --write    # regenerate the badge SVG
 *
 * --write runs via the npm "version" lifecycle hook, so `npm version <x>`
 * regenerates and stages the badge automatically.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

const badgePath = join(root, '.github', 'badges', 'version.svg');
const LABEL = 'version';
const COLOR = '#7c5cf0';

// Approximate per-character widths (px) for 11px DejaVu/Verdana, good enough
// for a tidy badge. Narrow glyphs (dots, ones, i/l) are common in semvers.
const NARROW = new Set(['.', ',', ':', ';', 'i', 'l', 'j', "'", '|', '!', '1']);
const charWidth = (c) => (NARROW.has(c) ? 3.5 : c === ' ' ? 4 : 7);
const textWidth = (s) => [...s].reduce((sum, c) => sum + charWidth(c), 0);

function badgeSvg(message) {
  const padX = 9;
  const lw = Math.round(textWidth(LABEL) + padX * 2);
  const mw = Math.round(textWidth(message) + padX * 2);
  const w = lw + mw;
  const lCenter = lw / 2;
  const mCenter = lw + mw / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="20" role="img" aria-label="${LABEL}: ${message}">
  <title>${LABEL}: ${message}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#555"/>
    <rect x="${lw}" width="${mw}" height="20" fill="${COLOR}"/>
    <rect width="${w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lCenter}" y="15" fill="#010101" fill-opacity=".3">${LABEL}</text>
    <text x="${lCenter}" y="14">${LABEL}</text>
    <text x="${mCenter}" y="15" fill="#010101" fill-opacity=".3">${message}</text>
    <text x="${mCenter}" y="14">${message}</text>
  </g>
</svg>
`;
}

const write = process.argv.includes('--write');
const expected = badgeSvg(version);

if (write) {
  mkdirSync(dirname(badgePath), { recursive: true });
  const current = existsSync(badgePath) ? readFileSync(badgePath, 'utf8') : '';
  if (current !== expected) {
    writeFileSync(badgePath, expected);
    console.log(`[sync-readme-version] version badge regenerated for ${version}`);
  } else {
    console.log(`[sync-readme-version] version badge already at ${version}`);
  }
  process.exit(0);
}

// Check mode (CI gate) — no network. Compare the committed SVG to package.json.
if (!existsSync(badgePath)) {
  console.error(`[sync-readme-version] missing ${badgePath}. Run with --write.`);
  process.exit(1);
}
const found = (readFileSync(badgePath, 'utf8').match(/version:\s*(\d+\.\d+\.\d+)/) || [])[1];
if (found !== version) {
  console.error(`[sync-readme-version] badge drift — package.json is ${version}, badge shows ${found ?? 'none'}.`);
  console.error('Run `node scripts/sync-readme-version.mjs --write` (or `npm version <x>`).');
  process.exit(1);
}
console.log(`[sync-readme-version] OK — version badge matches package.json (${version}).`);
