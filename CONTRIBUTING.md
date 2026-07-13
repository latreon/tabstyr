# Contributing to TabStyr

Thanks for taking a look. TabStyr is a small, local-first browser extension —
contributions of any size (typo fixes, bug reports, new locales, features)
are welcome.

## Ground rules

- **Privacy first.** Nothing should call out to a third-party server. If a
  change adds a network request of any kind, explain why in the PR — it will
  get extra scrutiny.
- **Tests before merge.** New code paths need a test; bug fixes need a
  regression test that fails without the fix.
- **Small PRs.** One fix or feature per PR is easier to review than a bundle
  of unrelated changes.

## Getting started

```bash
git clone https://github.com/latreon/tabstyr.git
cd tabstyr
npm install
npm run dev          # Chromium with hot reload
```

Load the unpacked extension from `.output/chrome-mv3` (or `dist/chrome-mv3`
after `npm run build`) via `chrome://extensions` → Load unpacked.

## Quality gates

Run these before opening a PR — CI runs the same checks:

```bash
npm run typecheck   # vue-tsc — zero type errors
npm test            # unit tests (Vitest)
npm run build        # required before e2e — builds dist/chrome-mv3
npm run e2e         # Playwright end-to-end (Chromium)
```

## Reporting bugs

Open an issue with:
- What you expected vs. what happened
- Browser + OS
- Steps to reproduce

If it's a privacy concern (an unexpected network call, data leaving the
device), please flag it as such in the title — those get treated as
critical.

## Submitting a PR

1. Fork the repo, branch off `main`.
2. Make your change with tests.
3. Run the quality gates above.
4. Open a PR describing what changed and why.

By contributing, you agree your changes are licensed under the project's
[MIT License](LICENSE).
