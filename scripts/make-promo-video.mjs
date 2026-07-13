// Records a real promo walkthrough of the extension dashboard: loads the built
// extension, seeds a realistic 14-day dataset, then drives a synthetic cursor
// through live interactions (toggle trend granularity, hover the heatmap, open a
// site detail, scroll the bento) while Playwright captures video. Output is a
// genuine screen recording — real UI, real transitions — not a stitched slideshow.
//
//   npm run build && node scripts/make-promo-video.mjs
//
// Needs: dist/chrome-mv3 (npm run build) and ffmpeg on PATH.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const EXT = resolve(ROOT, 'dist/chrome-mv3');
const RAW = resolve(ROOT, '.promo-video-raw');
const OUT_DIR = resolve(ROOT, 'docs/store/promo');
const OUT = resolve(OUT_DIR, 'tabstyr-promo.mp4');
const W = 1280, H = 800;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Synthetic cursor: Playwright video never records the OS pointer, so we paint a
// standard arrow pointer that tracks the dispatched mouse events. The SVG is the
// classic OS arrow (black fill, white outline so it reads on the dark UI); its tip
// is the hotspot, offset to sit exactly on the event coordinates.
const CURSOR_JS = `(() => {
  const c = document.createElement('div');
  c.id = '__promoCursor';
  Object.assign(c.style, {
    position:'fixed', zIndex:'2147483647', left:'0', top:'0', width:'24px', height:'30px',
    pointerEvents:'none', willChange:'transform',
    filter:'drop-shadow(0 2px 3px rgba(0,0,0,0.45))',
  });
  // Arrow with the tip at (3,3); margin shifts that tip onto the event point.
  c.style.marginLeft = '-3px'; c.style.marginTop = '-3px';
  c.innerHTML = '<svg width="24" height="30" viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M3 3 L3 23 L8.6 17.7 L12.2 25.6 L15.5 24.1 L11.9 16.4 L20 16 Z" ' +
    'fill="#0b0b10" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  let x=-100,y=-100;
  const render=()=>{ c.style.transform='translate('+x+'px,'+y+'px)'; };
  const add=()=>{ if(document.body){document.body.appendChild(c);render();} else requestAnimationFrame(add); };
  add();
  addEventListener('mousemove',e=>{x=e.clientX;y=e.clientY;render();},{passive:true});
})();`;

async function main() {
  if (!existsSync(EXT)) throw new Error('build the extension first: npm run build');
  rmSync(RAW, { recursive: true, force: true });
  mkdirSync(RAW, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const ctx = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    recordVideo: { dir: RAW, size: { width: W, height: H } },
  });

  let [worker] = ctx.serviceWorkers();
  if (!worker) worker = await ctx.waitForEvent('serviceworker');
  const extId = worker.url().split('/')[2];

  // Warm Chrome's favicon cache (best-effort, parallel, short) so top-site logos
  // render as real icons instead of generic globes.
  await Promise.all(
    ['github.com', 'mail.google.com', 'www.reddit.com', 'youtube.com', 'amazon.com'].map(async (d) => {
      const p = await ctx.newPage();
      await p.goto(`https://${d}/`, { waitUntil: 'domcontentloaded', timeout: 12_000 }).catch(() => {});
      await sleep(800);
      await p.close().catch(() => {});
    }),
  );

  // Seed a realistic 14-day dataset (mirrors the screenshot capture), dark theme.
  const seeder = await ctx.newPage();
  await seeder.goto(`chrome-extension://${extId}/dashboard.html`);
  await seeder.waitForSelector('.bento, .label', { state: 'visible' });
  await sleep(800);
  await seeder.evaluate(async () => {
    await new Promise((res) =>
      chrome.storage.local.set({ settings: {
        staleDays: 3, idleSeconds: 180, audioEnabled: true, theme: 'dark',
        categoryOverrides: {}, categoryRules: [], onboarded: true, language: 'auto',
      } }, () => res()));
    const sites = [
      { d: 'github.com', s: 5400, h: 10 }, { d: 'mail.google.com', s: 2700, h: 9 },
      { d: 'www.reddit.com', s: 1500, h: 21 }, { d: 'youtube.com', s: 1800, a: 1500, h: 20 },
      { d: 'amazon.com', s: 600, h: 13 },
    ];
    const mult = [1, 0.85, 0.95, 1.1, 0.7, 0.5, 1, 0.9, 0.8, 1.05, 0.75, 0.6, 1, 0.9];
    const pad = (n) => String(n).padStart(2, '0');
    const dayStart = (off) => { const t = new Date(); t.setHours(0,0,0,0); t.setDate(t.getDate()-off); return t; };
    const keyOf = (t) => `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`;
    const stats = [], sessions = []; let tabId = 100;
    for (let off = 0; off < 14; off++) {
      const m = mult[off] ?? 0.9; const start0 = dayStart(off).getTime(); const date = keyOf(dayStart(off));
      for (const site of sites) {
        const seconds = Math.round(site.s * m); if (seconds <= 0) continue;
        stats.push({ date, domain: site.d, seconds, audioSeconds: Math.round((site.a ?? 0) * m) });
        const start = start0 + site.h * 3_600_000;
        sessions.push({ tabId: tabId++, tabKey: `seed-${site.d}-${off}`, url: `https://${site.d}/`, domain: site.d, start, end: start + Math.min(seconds, 1800), audio: false });
      }
    }
    const db = await new Promise((res, rej) => { const r = indexedDB.open('tab-time'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res, rej) => {
      const tx = db.transaction(['dailyDomainStats', 'sessions'], 'readwrite');
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
      const ds = tx.objectStore('dailyDomainStats'), ss = tx.objectStore('sessions');
      ds.clear(); ss.clear(); for (const s of stats) ds.put(s); for (const s of sessions) ss.put(s);
    });
    db.close();
  });
  await seeder.close();

  // The recorded page.
  const page = await ctx.newPage();
  await page.addInitScript(CURSOR_JS);
  await page.goto(`chrome-extension://${extId}/dashboard.html`);
  await page.waitForSelector('.bento, .label', { state: 'visible' });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await page.waitForTimeout(700);

  // ── cursor motion helpers ──────────────────────────────────────────────────
  let cur = { x: W / 2, y: 120 };
  await page.mouse.move(cur.x, cur.y);
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  async function glide(tx, ty, ms = 750) {
    const from = { ...cur }; const n = Math.max(14, Math.round(ms / 18));
    for (let i = 1; i <= n; i++) {
      const e = ease(i / n);
      await page.mouse.move(from.x + (tx - from.x) * e, from.y + (ty - from.y) * e);
      await sleep(ms / n);
    }
    cur = { x: tx, y: ty };
  }
  async function centerOf(sel, idx = 0) {
    const b = await page.locator(sel).nth(idx).boundingBox();
    if (!b) return null;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }
  async function moveTo(sel, idx = 0, ms = 750) {
    const c = await centerOf(sel, idx); if (!c) return false;
    await glide(c.x, Math.max(20, Math.min(H - 20, c.y)), ms); return true;
  }
  async function click(sel, idx = 0, ms = 700) {
    if (!(await moveTo(sel, idx, ms))) return false;
    await sleep(120); await page.mouse.down(); await sleep(90); await page.mouse.up(); return true;
  }
  async function smoothScroll(toY, ms = 700) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), toY);
    await sleep(ms);
  }
  const scrollToSel = async (sel, ms = 750) => {
    await page.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {});
    await sleep(ms);
  };

  // ── choreography (~36s) ─────────────────────────────────────────────────────
  await sleep(1200); // hold on the hero: today active, focus, categories
  await glide(360, 150, 650); await sleep(600); // drift over the headline

  // Activity trend: switch granularity — real bar transitions.
  await scrollToSel('.trend', 700);
  await click('.trend .toggle button', 1); await sleep(900);          // Week
  await click('.trend .toggle button', 2); await sleep(900);          // Month
  await click('.trend .toggle button', 0); await sleep(600);          // Day
  await moveTo('.trend .bar-col', 6, 550); await sleep(900);          // hover → tooltip

  // Heatmap: sweep across a few cells (tooltips fire live).
  await scrollToSel('.heatmap-tile', 700);
  await moveTo('.hm-cell', 33, 600); await sleep(600);
  await moveTo('.hm-cell', 105, 520); await sleep(600);
  await moveTo('.hm-cell', 130, 460); await sleep(800);

  // Top sites → open a real site-detail modal.
  await scrollToSel('.top-sites', 700);
  await sleep(400);
  await click('.top-sites .row', 0, 700); await sleep(1500);          // modal opens
  await moveTo('.panel .stat', 3, 650).catch(() => {}); await sleep(900);
  await click('.panel .close', 0, 600).catch(() => {}); await sleep(700);

  // Daily work log — "What did I work on?": show the per-day list + export controls.
  await scrollToSel('.worklog-tile', 750);
  await sleep(500);
  await moveTo('.worklog-tile .copy', 2, 650); await sleep(850);      // hover Image export
  await moveTo('.worklog-tile .copy', 0, 450); await sleep(850);      // hover Copy

  // Focus categories — open a productivity selector to show reclassification.
  await scrollToSel('.focus-cats-tile', 750);
  await sleep(400);
  await click('.focus-cats-tile .selectbox', 0, 700); await sleep(1300); // dropdown opens
  await page.keyboard.press('Escape').catch(() => {}); await sleep(600);

  // Settings — controls for stale days, idle timeout, language, theme, audio.
  await scrollToSel('.settings-tile', 750);
  await sleep(400);
  await moveTo('.settings-tile', 0, 700); await sleep(1500);          // glide in, hold to read

  // Return home for a clean ending.
  await smoothScroll(0, 900);
  await sleep(1300);

  const vid = page.video();
  await ctx.close();
  const raw = await vid.path();
  console.log('raw video:', raw);

  // Encode to a clean, shareable mp4 (H.264, yuv420p, 30fps) with a gentle fade.
  execFileSync('ffmpeg', [
    '-y', '-i', raw,
    '-vf', `scale=${W}:${H}:flags=lanczos,fps=30,fade=t=in:st=0:d=0.4`,
    '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
    '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', OUT,
  ], { stdio: 'inherit' });
  rmSync(RAW, { recursive: true, force: true });
  console.log('\nwrote', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
