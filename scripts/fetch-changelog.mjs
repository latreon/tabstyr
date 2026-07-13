// Pulls GitHub release notes into a static JSON file the landing site's
// changelog page bundles at build time — no live GitHub API call from a
// visitor's browser (rate limits, latency, an extra failure mode for content
// that changes maybe once a release).
//
//   node scripts/fetch-changelog.mjs
//
// Needs: gh CLI, authenticated, with read access to latreon/tabstyr.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = resolve(ROOT, 'landing/src/data/changelog.json');

const raw = execFileSync(
  'gh',
  ['api', 'repos/latreon/tabstyr/releases', '--paginate', '-q',
    '[.[] | {tag: .tag_name, name: .name, publishedAt: .published_at, body: .body}]'],
  { encoding: 'utf8' },
);
const releases = JSON.parse(raw).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

writeFileSync(OUT, JSON.stringify(releases, null, 2) + '\n');
console.log(`Wrote ${releases.length} releases to ${OUT}`);
