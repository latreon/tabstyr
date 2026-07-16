// Static prerendering: visits every real route with a headless browser after
// `vite build`, waits for the SPA to render, and writes the resulting HTML as
// a static file at that exact path. Netlify (and every static host) serves an
// exact file match BEFORE falling back to the SPA _redirects rule, so crawlers
// hitting /privacy or /es/blog/... now get real rendered content instead of
// the same empty shell every route currently returns.
//
// This is prerendering, not SSR/hydration: Vue mounts fresh on load and
// replaces the static markup with its own client-rendered output (there's a
// brief, expected flash of that on a slow connection). The static HTML exists
// purely for the first paint and for crawlers that don't run JS at all.
//
//   node scripts/prerender.mjs   (run after `vite build`, from landing/)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const PORT = 5099;

const LOCALE_SLUGS = ['', 'es', 'de', 'fr', 'it', 'pt-br', 'ru', 'tr', 'ja', 'ko', 'zh-cn'];
const PAGES = [
  '', 'privacy', 'ideas', 'wrapped', 'changelog', 'blog', 'vs-rescuetime',
  'blog/how-tabstyr-counts-active-time',
  'blog/why-tabstyr-has-no-servers',
  'blog/tabstyr-vs-rescuetime-vs-toggl',
];

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp4': 'video/mp4',
  '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon',
};

// Minimal static server mirroring the eventual Netlify behavior: serve a real
// file if one exists at the path, otherwise fall back to the SPA shell — so
// crawling a not-yet-prerendered route still works during this same run.
function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      let filePath = join(DIST, urlPath);
      if (urlPath.endsWith('/') || !extname(urlPath)) {
        filePath = join(DIST, urlPath, 'index.html');
        if (!existsSync(filePath)) filePath = join(DIST, 'index.html');
      }
      if (!existsSync(filePath)) filePath = join(DIST, 'index.html');
      try {
        const body = await readFile(filePath);
        res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(PORT, () => resolve(server));
  });
}

// Write each route as a FLAT `<route>.html` file (not `<route>/index.html`).
// Netlify's pretty-URL serving maps `/privacy` → `/privacy.html` with a 200,
// whereas a `/privacy/index.html` forces a 301 from `/privacy` → `/privacy/`.
// Flat files keep every prerendered route resolving directly at its clean URL.
// The home route ('') stays as dist/index.html.
function writeRoute(routePath, html) {
  if (!routePath) {
    writeFileSync(join(DIST, 'index.html'), html);
    return;
  }
  const outFile = join(DIST, `${routePath}.html`);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, html);
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    throw new Error('dist/index.html not found — run `vite build` first');
  }
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const routes = [];
  for (const slug of LOCALE_SLUGS) {
    for (const p of PAGES) {
      routes.push([slug, p].filter(Boolean).join('/'));
    }
  }

  let done = 0;
  for (const route of routes) {
    await page.goto(`http://localhost:${PORT}/${route}`, { waitUntil: 'networkidle' });
    // Scroll-reveal content mounts via IntersectionObserver on first paint,
    // not a fixed delay — nudge it by scrolling the full page height once so
    // below-the-fold sections (features, changelog entries, blog list) are
    // actually rendered in the captured HTML rather than left in their
    // pre-reveal (opacity: 0) state forever.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 0));
    const html = await page.content();
    writeRoute(route, html);
    done++;
  }

  console.log(`Prerendered ${done} routes`);
  await browser.close();
  server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
