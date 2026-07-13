export interface BlogPost {
  slug: string;
  title: string;
  date: string; // YYYY-MM-DD
  excerpt: string;
  body: string; // markdown, rendered via @/lib/markdown
}

// Written by the maker, grounded in the actual codebase — no fabricated
// stats, quotes, or user counts. Body markdown covers the subset
// lib/markdown.ts supports: ##/### headings, bullets, bold/italic/code,
// [text](url) links.
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'how-tabstyr-counts-active-time',
    title: 'How TabStyr counts your active time',
    date: '2026-07-13',
    excerpt:
      "Second-by-second tracking sounds simple until you hit idle time, background audio, sleeping laptops, and browser crashes. Here's what actually happens under the hood.",
    body: `"Active time" sounds like a simple thing to measure. It isn't, once you account for how people actually use a browser.

## The basic idea

TabStyr watches which tab has focus and books time to it while your browser window is focused, your OS isn't idle, and (if the tab isn't producing audio) you've interacted recently enough to count as "here." Switch tabs, and the clock moves with you. Nothing is measured server-side — there's no server. It's a background script counting seconds and writing them to your browser's own IndexedDB.

## Where it gets interesting

**Idle detection.** If you stop moving the mouse or typing for longer than your configured threshold (default: 3 minutes), the active tab stops accruing time. Reading a long article without touching the keyboard for 10 minutes will eventually pause — unless that tab is also playing audio, which brings us to:

**Audio is tracked separately.** A YouTube video playing in a background tab while you work in another one is real usage, but it isn't *active* usage of the tab playing it. TabStyr counts it, but as its own bucket, so your active-time total never gets inflated by "a video was open somewhere."

**Sleep and lock are capped, not exact.** Close your laptop lid for three hours and TabStyr doesn't book three hours of active time. Non-media sessions open when the OS sleeps or locks get closed and capped at 30 minutes — long enough to not lose a real short break, short enough that a multi-hour sleep never shows up as multi-hour "activity."

**Crashes lose at most a minute.** Time is checkpointed to storage every 60 seconds. If Chrome crashes or gets force-quit, you lose at most the seconds since the last checkpoint for whichever tab was in focus — everything before that is already saved.

**There's a 24-hour ceiling.** No single session — even an uncapped media session — can accumulate more than 24 hours. If your system clock jumps (an NTP correction, a VM resuming from a snapshot), TabStyr can't be tricked into showing days of bogus activity.

## Why this level of detail matters

Most of the value of a time tracker is trust. If the number on the dashboard doesn't match what you *feel* like you did today, you stop looking at it. Getting idle detection, audio handling, and crash recovery right isn't glamorous, but it's the difference between a number you check because it's honest and a number you ignore because it's noise.

If you want the exhaustive list of edge cases and deliberate limitations (there are a few — calendar-day-only buckets, no cross-app tracking, local-dev hosts grouped together), the [README's Scope & limitations section](https://github.com/latreon/tabstyr#scope--limitations) has all of them.`,
  },
  {
    slug: 'why-tabstyr-has-no-servers',
    title: "Why TabStyr has no servers (and what that actually means)",
    date: '2026-07-13',
    excerpt:
      'No account, no cloud sync, no analytics beacon — not as a privacy slogan, but as an actual architectural constraint. Here is what that rules out and what it costs.',
    body: `"Privacy-focused" gets printed on a lot of software that still phones home for analytics, crash reports, or a sign-in check. TabStyr's claim is narrower and more literal: there is no server for it to phone home *to*.

## What "no servers" actually means

Every session TabStyr records — which tab, how long, when — is written to [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) inside your browser profile. That's it. There's no account to create because there's nowhere to send an account's data. There's no cloud sync because there's no cloud. The extension's [Content Security Policy](https://developer.chrome.com/docs/extensions/mv3/manifest/content_security_policy/) is set to \`connect-src 'none'\` on its own pages — a network request to anywhere isn't just avoided, it's blocked at the platform level.

## What that rules out

Being local-only isn't free. It rules out:

- **Cross-device sync**, automatically. If you want your data on a second machine, you export a backup file and import it there yourself — optionally encrypted with a passphrase before it ever leaves the device.
- **Any second opinion on your data.** There's no dashboard you can check from your phone. It's a browser extension; your data lives where the browser lives.
- **Remote debugging or crash reporting.** If something breaks, we find out from a GitHub issue, not a telemetry beacon.

For a tool whose entire premise is "tell me the truth about my own screen time," that trade felt like the right one to make deliberately, not something to work around later with an opt-out toggle.

## The parts people don't think about

Local-only also shapes decisions that aren't obviously "privacy" features:

**Encrypted backups use real cryptography**, not obfuscation — AES-256-GCM with a PBKDF2-derived key, computed with the browser's own [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API). A wrong passphrase fails to decrypt cleanly rather than returning garbage data, because authenticated encryption catches tampering by construction.

**Import is hardened, not just parsed.** A backup file is untrusted input the moment it's dropped into the restore dialog — even if it's your own file. Every record is type-checked, sizes are capped, and the passphrase KDF's iteration count is clamped to a safe range, so a crafted file can't be used to exhaust CPU or corrupt the database.

**The marketing site doesn't get a pass either.** The landing page you're reading this on ships with zero analytics by default — no Cloudflare beacon, no Plausible, nothing — until a token is deliberately pasted into a config file before a build. "No tracking" isn't a claim that stops at the extension's edge.

## Verifying it yourself

The whole point of "no servers" as a claim rather than a slogan is that it's checkable. The repo is [open source (MIT)](https://github.com/latreon/tabstyr) — open a network tab, use the extension, and count the requests. There should be exactly zero to anywhere but the browser's own extension pages.`,
  },
  {
    slug: 'tabstyr-vs-rescuetime-vs-toggl',
    title: 'TabStyr vs. RescueTime vs. Toggl Track: which one do you actually need?',
    date: '2026-07-13',
    excerpt:
      "They all show you where your time went, but they solve different problems for different people. A quick breakdown of who each tool is actually for.",
    body: `People land on TabStyr's page after searching for a "RescueTime alternative" or a "private screen time tracker," and the honest answer is: it depends what you're trying to measure.

## What each tool actually is

**RescueTime** watches everything on your computer — every app, every window, not just the browser — and sends that activity to its own servers for the dashboards and weekly reports. If you want to know how much time you spend in Slack vs. your code editor vs. your browser, RescueTime is built for exactly that, and it requires an account.

**Toggl Track** is a manual-first time tracker built for billing and project accounting — you start a timer, tag it to a client or project, and stop it. Some automatic capture exists, but the core workflow assumes you're deliberately tracking work to invoice against, and it's also account-based with data on Toggl's servers.

**TabStyr** only sees browser tabs. It doesn't know or care what's happening in your terminal or your email client. In exchange, there's no account, no server, and no setup beyond installing the extension — it starts working the moment you add it.

## The actual decision

If the honest answer to "where does my time go" requires knowing about apps outside the browser, TabStyr isn't going to give you that picture — you want RescueTime. If you're tracking billable hours against specific clients or projects, you want Toggl's tagging and invoicing workflow, not a passive tracker.

If the question is narrower — "how much of my browser time today was GitHub vs. Twitter vs. actual work sites, and can I see that without creating an account or sending my browsing history anywhere" — that's the specific problem TabStyr is built to answer, and it's the one thing the other two can't do without a server in the loop.

## A quick side-by-side

- **Scope** — TabStyr: browser tabs only. RescueTime: all apps + browser. Toggl: manual/automatic entries.
- **Data location** — TabStyr: your device only. RescueTime: RescueTime's servers. Toggl: Toggl's servers.
- **Account** — TabStyr: not required. RescueTime: required. Toggl: required.
- **Price** — TabStyr: free. RescueTime: free tier + paid plans. Toggl: free tier + paid plans.
- **Best for** — TabStyr: browser-only insight without an account. RescueTime: a whole-computer usage picture. Toggl: billable time & project accounting.

None of these are strictly "better" — they're answering different questions. Pick based on which question you're actually asking.

The [full README comparison table](https://github.com/latreon/tabstyr#tabstyr-vs-rescuetime--toggl-track) has the same breakdown if you want it at a glance.`,
  },
];
