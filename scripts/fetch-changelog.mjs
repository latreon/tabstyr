// Pulls GitHub release notes into a static JSON file the landing site's
// changelog page bundles at build time — no live GitHub API call from a
// visitor's browser (rate limits, latency, an extra failure mode for content
// that changes maybe once a release).
//
//   node scripts/fetch-changelog.mjs           # fail loudly on any error
//   node scripts/fetch-changelog.mjs --soft    # warn and keep the committed file
//
// Talks to the REST API directly with fetch(). The repo is public, so no
// credentials are required; a GITHUB_TOKEN / GH_TOKEN in the environment is used
// when present purely to raise the rate limit (60 → 5000 requests/hour), which
// matters on a shared CI or Netlify build IP. Deliberately no `gh` CLI
// dependency any more: this now also runs inside the landing site's build (see
// landing/package.json) and on GitHub Actions, neither of which is guaranteed to
// have an authenticated CLI.
//
// --soft is what the site build uses: a GitHub outage, a rate-limit block or an
// offline checkout must not fail the deploy. It leaves the committed JSON in
// place, so the site still ships the last known-good changelog.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync, readFileSync } from 'node:fs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = resolve(ROOT, 'landing/src/data/changelog.json');
const REPO = process.env.CHANGELOG_REPO || 'latreon/tabstyr';
const SOFT = process.argv.includes('--soft');
const PER_PAGE = 100;
// A hard stop so a pagination bug can't loop forever.
const MAX_PAGES = 20;

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

async function getPage(page) {
  const url = `https://api.github.com/repos/${REPO}/releases?per_page=${PER_PAGE}&page=${page}`;
  const res = await fetch(url, {
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      // GitHub asks every API client to identify itself; an anonymous request
      // without this is more likely to be throttled.
      'user-agent': `${REPO.split('/')[1]}-changelog-sync`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    const hint = remaining === '0' ? ' (rate limit exhausted — set GITHUB_TOKEN)' : '';
    throw new Error(`GitHub API ${res.status} ${res.statusText}${hint}`);
  }
  return res.json();
}

async function fetchReleases() {
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await getPage(page);
    out.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  return out
    // Drafts have no published_at and aren't public yet — they must never reach
    // the site. Pre-releases are kept: they're announced, so they belong.
    .filter((r) => !r.draft && r.published_at)
    // Key order matters: it must match what is already committed (alphabetical, as
    // the previous `gh api -q` pipeline emitted), otherwise a run that changes
    // nothing still rewrites all ~120 lines and the workflow's
    // "commit only if changed" guard fires on pure noise.
    .map((r) => ({ body: r.body ?? '', name: r.name, publishedAt: r.published_at, tag: r.tag_name }))
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

try {
  const releases = await fetchReleases();
  if (!releases.length) throw new Error('the API returned no published releases');

  const next = `${JSON.stringify(releases, null, 2)}\n`;
  let prev = '';
  try {
    prev = readFileSync(OUT, 'utf8');
  } catch {
    /* first run — no file yet */
  }
  if (prev === next) {
    console.log(`[changelog] up to date — ${releases.length} releases, newest ${releases[0].tag}`);
  } else {
    writeFileSync(OUT, next);
    console.log(`[changelog] wrote ${releases.length} releases, newest ${releases[0].tag}`);
  }
} catch (e) {
  if (!SOFT) {
    console.error(`[changelog] ${e.message}`);
    process.exit(1);
  }
  // Soft mode: the committed JSON is the fallback, so say so clearly and let the
  // build continue rather than taking the whole site down over release notes.
  console.warn(`[changelog] could not refresh from GitHub (${e.message}) — using the committed changelog.json`);
}
