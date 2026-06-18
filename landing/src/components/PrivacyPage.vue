<script setup lang="ts">
import RingLogo from './RingLogo.vue';

const stores = [
  { perm: 'tabs', why: 'See the active tab’s URL/title to attribute time to the right site.' },
  { perm: 'storage', why: 'Save your stats and settings locally.' },
  { perm: 'idle', why: 'Pause tracking when you step away so totals stay accurate.' },
  { perm: 'alarms', why: 'Periodic checkpoints and the once-daily maintenance task.' },
  { perm: 'notifications', why: 'Optional, at-most-once-a-day stale-tab reminder.' },
  { perm: 'favicon (Chromium)', why: 'Show site icons in lists.' },
];
</script>

<template>
  <div class="privacy">
    <div class="orb" aria-hidden="true" />

    <header class="bar">
      <div class="container bar-inner">
        <a href="#/" class="brand"><RingLogo :size="24" /> <span>TabStyr</span></a>
        <a href="#/" class="back">← Back to site</a>
      </div>
    </header>

    <main class="container body">
      <span class="eyebrow reveal-static">Privacy policy</span>
      <h1 class="title"><span class="gradient-text">0 bytes</span> leave your device.</h1>
      <p class="updated">Last updated: 2026-06-12</p>

      <div class="card glass">
        <p class="lead">
          <strong>TabStyr does not collect, transmit, or share any data.</strong>
          Everything it records stays on your device. There are no servers, no analytics,
          no accounts, and no network requests of any kind.
        </p>

        <h2>What it stores (locally, in your browser’s IndexedDB)</h2>
        <ul>
          <li><strong>Session records</strong> — start/end times, the page’s domain, and whether the tab played audio.</li>
          <li><strong>Daily per-domain totals</strong> — seconds per site per day.</li>
          <li><strong>Open-tab metadata</strong> — title, URL, last-active time, and a random local id used to attribute time.</li>
          <li><strong>Settings</strong> — stale threshold, idle timeout, theme, audio counting, category rules.</li>
        </ul>
        <p>Data is kept for a rolling <strong>90-day window</strong>, then pruned automatically.</p>

        <h2>What it does NOT do</h2>
        <ul>
          <li>Does <strong>not</strong> send data off your device, or use servers, cloud sync, or analytics.</li>
          <li>Does <strong>not</strong> contain ads or trackers.</li>
          <li>Does <strong>not</strong> read page contents — only tab metadata (URL/title) from standard extension APIs.</li>
        </ul>

        <h2>Permissions</h2>
        <table>
          <thead><tr><th>Permission</th><th>Purpose</th></tr></thead>
          <tbody>
            <tr v-for="s in stores" :key="s.perm"><td><code>{{ s.perm }}</code></td><td>{{ s.why }}</td></tr>
          </tbody>
        </table>
        <p>No host permissions are requested — the extension cannot access the content of the pages you visit.</p>

        <h2>Your control</h2>
        <ul>
          <li><strong>Export</strong> your full history (JSON or CSV), optionally passphrase-encrypted (AES-256-GCM).</li>
          <li><strong>Restore</strong> from a backup on this or another device.</li>
          <li><strong>Wipe all data</strong> in one click; removing the extension deletes everything.</li>
        </ul>
      </div>

      <a href="#/" class="back-cta">← Back to TabStyr</a>
    </main>
  </div>
</template>

<style scoped>
.privacy { position: relative; min-height: 100vh; }
.orb {
  position: fixed; top: -160px; left: 50%; transform: translateX(-50%);
  width: 640px; height: 420px; pointer-events: none; z-index: 0;
  background: radial-gradient(ellipse, rgba(124, 92, 240, 0.22), transparent 70%);
  filter: blur(130px);
}
.bar {
  position: sticky; top: 0; z-index: 10;
  background: rgba(10, 10, 15, 0.72); backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
}
.bar-inner { display: flex; align-items: center; justify-content: space-between; height: 64px; }
.brand { display: inline-flex; align-items: center; gap: 9px; font-family: var(--font-display); font-weight: 700; font-size: 18px; }
.back { font-size: 14px; font-weight: 500; color: var(--text-2); transition: color 160ms ease; }
.back:hover { color: var(--text); }
.body { position: relative; z-index: 1; padding-top: 72px; padding-bottom: 96px; }
.title { font-size: clamp(2.2rem, 1.6rem + 3vw, 3.4rem); font-weight: 700; margin-top: 14px; }
.updated { color: var(--text-3); font-size: 14px; margin: 12px 0 32px; }
.card { padding: 40px; }
.lead { font-size: 1.1rem; color: var(--text); margin: 0 0 8px; }
h2 { font-family: var(--font-display); font-size: 1.25rem; font-weight: 600; margin: 34px 0 12px; }
.card p, .card li { color: var(--text-2); }
.card strong { color: var(--text); }
.card ul { margin: 0; padding-left: 22px; display: grid; gap: 8px; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.95rem; }
th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); }
th { color: var(--text-3); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
code {
  background: var(--accent-muted); color: var(--accent);
  padding: 2px 7px; border-radius: 6px; font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.back-cta { display: inline-block; margin-top: 36px; font-weight: 600; color: var(--accent); }
.back-cta:hover { opacity: 0.8; }
@media (max-width: 600px) { .card { padding: 26px; } }
</style>
