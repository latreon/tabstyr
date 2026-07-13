// Renders CHANGELOG.md from the same release data the website's /changelog
// page uses (landing/src/data/changelog.json), so both stay in sync from one
// source. Run `npm run changelog:fetch` first if that file is stale.
//
//   node scripts/generate-changelog.mjs
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const releases = JSON.parse(readFileSync(resolve(ROOT, 'landing/src/data/changelog.json'), 'utf8'));

// Each release's own body uses ##/### as top-level headings; nest them one
// level deeper (###/####) so they sit properly under this release's ## header
// instead of becoming sibling h2s in the combined document.
const nestHeadings = (body) => body.replace(/^(#{2,3})\s/gm, '#$1 ');

const sections = releases.map((r) => {
  const date = new Date(r.publishedAt).toISOString().slice(0, 10);
  return `## ${r.tag} — ${date}\n\n${nestHeadings(r.body.trim())}\n`;
});

const out = `# Changelog

All notable changes to TabStyr. Generated from [GitHub Releases](https://github.com/latreon/tabstyr/releases) — the release page is the source of truth; run \`npm run changelog:fetch && node scripts/generate-changelog.mjs\` to refresh this file after a new release.

${sections.join('\n')}`;

writeFileSync(resolve(ROOT, 'CHANGELOG.md'), out);
console.log(`Wrote CHANGELOG.md with ${releases.length} releases`);
