#!/usr/bin/env node
/**
 * Keep README version references in lockstep with package.json.
 *
 * The version badge is dynamic (shields reads package.json straight from
 * GitHub), so normally there is nothing to rewrite. This script is the
 * safety net for any *static* version literal that creeps back in:
 *   - a static shields badge:  img.shields.io/badge/version-1.2.3-...
 *   - prose:                   **Version:** 1.2.3
 *
 * Modes:
 *   node scripts/sync-readme-version.mjs           # check (CI): exit 1 on drift
 *   node scripts/sync-readme-version.mjs --write    # rewrite literals to match
 *
 * The --write mode runs automatically via the npm "version" lifecycle hook,
 * so `npm version <x>` keeps the README aligned and stages it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const readmePath = join(root, 'README.md');
const readme = readFileSync(readmePath, 'utf8');

// [pattern, human label]. Capture group 1 = prefix, group 2 = the semver.
const PATTERNS = [
  [/(img\.shields\.io\/badge\/version-)(\d+\.\d+\.\d+)/g, 'static version badge'],
  [/(\*\*Version:\*\*\s*)(\d+\.\d+\.\d+)/g, 'prose "**Version:**"'],
];

const write = process.argv.includes('--write');
const mismatches = [];
let updated = readme;

for (const [re, label] of PATTERNS) {
  updated = updated.replace(re, (match, prefix, found) => {
    if (found !== version) mismatches.push({ label, found });
    return `${prefix}${version}`;
  });
}

if (write) {
  if (updated !== readme) {
    writeFileSync(readmePath, updated);
    console.log(`[sync-readme-version] README updated to ${version}`);
  } else {
    console.log(`[sync-readme-version] README already at ${version}`);
  }
  process.exit(0);
}

// Check mode (CI gate).
if (mismatches.length) {
  console.error(`[sync-readme-version] README version drift — package.json is ${version}:`);
  for (const m of mismatches) console.error(`  - ${m.label}: found ${m.found}`);
  console.error('Run `node scripts/sync-readme-version.mjs --write` (or `npm version <x>`).');
  process.exit(1);
}
console.log(`[sync-readme-version] OK — no static version drift (package.json ${version}).`);
