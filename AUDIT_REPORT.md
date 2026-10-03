# TabStyr Audit Report

> Resolution status: all ten findings were addressed for v2.0.4. Regression tests
> were added for the affected privacy, persistence, validation, import, range-query,
> chart, and keyboard-focus paths.

## Summary

Audited TabStyr v2.0.3 (WXT, Vue 3, TypeScript). Every file under `lib/`, `entrypoints/`, `components/`, and `composables/` was reviewed. The implementation is generally defensive: IndexedDB data-store restore is transactional, session rollups split at local midnight, heatmaps split at local hour boundaries, numeric settings reject non-finite values, navigation helpers revalidate destinations, event handlers are serialized, and all locale catalogs have matching key sets.

Total issues found: 10

Critical: 3 | High: 1 | Medium: 3 | Low: 3

Existing test failures: 0

TypeScript errors: 0

### Exact command output

`npm test` was run first, as requested, and exited 0:

```text
> tabstyr@2.0.3 test
> vitest run

 RUN  v4.1.10 /root/Projects/tabstyr

 Test Files  70 passed (70)
      Tests  768 passed (768)
   Start at  15:54:00
   Duration  91.09s (transform 5.35s, setup 12.37s, import 19.03s, tests 12.60s, environment 30.36s)
```

`npm run typecheck` exited 0:

```text
> tabstyr@2.0.3 typecheck
> vue-tsc --noEmit
```

## Critical Issues (data loss, security, privacy leaks)

### C-1 — A failed history commit permanently loses the already-checkpointed slice

- **Module:** background persistence
- **File:** `entrypoints/background.ts:150-163`
- **Description:** `persist()` writes the rebased `engineState` before committing the closed sessions and their daily rollups. If `commitWithRecovery()` ultimately rejects (quota remains full, IndexedDB aborts, or another non-quota error occurs), the durable engine start time has already advanced past those sessions. No retry queue retains the rejected slice. The next event resumes from the newer start and the elapsed slice is permanently absent from both `sessions` and `dailyDomainStats`.
- **Reproduction scenario:** Fill storage so both the initial `commitSessions()` and its prune-and-retry fail. Let a heartbeat close one minute of an open browsing session. Restart/evict the service worker and then free storage. That minute is not retried and cannot be reconstructed.
- **Expected:** A failed commit remains pending for retry, or engine state and history advance atomically, so recovery cannot discard measured time.
- **Actual:** Engine state advances first and the failed session slice is forgotten. The storage warning makes the failure visible but does not preserve the data.

### C-2 — Destructive restore is not atomic with settings and can report failure after replacing history

- **Module:** backup restore
- **Files:** `lib/restore.ts:183-199`, `components/SettingsPanel.vue:373-386`
- **Description:** The four IndexedDB stores are correctly replaced in one transaction, but settings are written afterward through a separate `storage.local` operation. If `saveSettings()` fails, `restoreBackup()` rejects even though all prior history has already been replaced. The UI reports only a generic restore failure and leaves the confirmation data available, inviting a retry; it cannot roll back the original history.
- **Reproduction scenario:** Start with local history A, select a valid backup B, and make `browser.storage.local.set({settings: ...})` fail (quota/API failure) after `repo.restoreAll()` commits. The UI shows “restore failed,” but reloading shows history B and history A is gone.
- **Expected:** Restore either succeeds completely, or failure leaves the pre-restore data and settings intact; at minimum, a partial-success state must be reported accurately.
- **Actual:** History is destructively replaced, settings remain old, and the operation is presented as a failure.

### C-3 — Base64url-style secrets in ordinary path segments are persisted and exported

- **Module:** URL privacy normalization
- **File:** `lib/domain.ts:24-60`, `lib/domain.ts:72-77`
- **Description:** The opaque-segment detector accepts only alphanumeric characters. Real bearer/share/magic-link identifiers commonly use base64url and therefore contain `-` or `_`. Unless the preceding segment is one of the small `SECRET_PATH_WORDS` set, such a secret is retained verbatim in session URLs and tab metadata and later appears in JSON backups. The source comment explicitly acknowledges the hyphen case; underscore-bearing values fail the same pattern.
- **Reproduction scenario:** Visit `https://files.example/share-doc/AbC_def-1234567890XYZsecret`. `pageOf()` returns the token-bearing path unchanged because `share-doc` is not a secret word and the token fails `OPAQUE_SEGMENT`. Continue browsing and export a backup.
- **Expected:** Credential-like high-entropy path segments are redacted before any persistence or export.
- **Actual:** The full token is stored in `sessions`/`tabMeta` and included in plaintext or decryptable backups.

## High Issues (incorrect behavior affecting users)

### H-1 — Simultaneous settings saves still overwrite unrelated changes

- **Module:** cross-context settings synchronization
- **File:** `lib/settings.ts:190-215`, `lib/settings.ts:225-249`
- **Description:** Cache invalidation prevents a later save from using an old snapshot only after `storage.onChanged` has been delivered. It does not make the read-merge-write sequence atomic. Two contexts can both read the same settings, construct different complete objects, and issue `storage.local.set`; last writer wins and silently reverts the other patch.
- **Reproduction scenario:** Open two dashboard tabs (or dashboard and popup). At nearly the same instant, change the focus target in one and theme/category settings in the other. Both `saveSettings()` calls can pass `await getSettings()` before either `onChanged` callback runs. The second full-object write restores the old value for the first field.
- **Expected:** Independent concurrent patches are serialized/merged against the latest stored revision, or conflicts are detected.
- **Actual:** One successful UI save can silently undo another successful UI save.

## Medium Issues (edge cases, minor inaccuracies)

### M-1 — Backup date validation accepts impossible calendar dates

- **Module:** backup validation
- **File:** `lib/restore.ts:36-41`, `lib/restore.ts:51-69`
- **Description:** Daily and monthly keys are checked only with `YYYY-MM-DD` / `YYYY-MM` regular expressions. Values such as `2026-99-99`, `2026-02-31`, or month `2026-00` pass and are written to IndexedDB. Lexicographic range queries, trend grouping, labels, and retention then treat malformed keys inconsistently (JavaScript `Date` constructors normalize some into different real dates).
- **Reproduction scenario:** Restore a valid TabStyr envelope containing a daily row dated `2026-02-31` and a monthly row `2026-13`. Both rows pass their validators and are counted by some string-based reports while labels normalize to other calendar dates.
- **Expected:** Date/month keys must represent actual calendar days/months before being accepted.
- **Actual:** Format-valid but impossible dates survive import and corrupt date-bucket behavior.

### M-2 — CSV parser breaks valid quoted fields containing newlines

- **Module:** CSV import
- **File:** `lib/import-csv.ts:20-37`, `lib/import-csv.ts:121-150`
- **Description:** `splitLine()` handles commas and escaped quotes inside a record, but `parseCsvImport()` splits the input into physical lines before parsing. RFC 4180 permits CR/LF inside a quoted field, so one logical row becomes multiple rows and is skipped or misread.
- **Reproduction scenario:** Import `date,activity,seconds\n2026-08-10,"github.com\nproject",600`. The record is split into two physical rows; neither has the intended column alignment, so the ten minutes are not imported.
- **Expected:** A quoted newline remains part of its field and the logical record is parsed once.
- **Actual:** Valid data is split and lost/misclassified.

### M-3 — Restored tab metadata accepts invalid browser tab IDs

- **Module:** backup validation / stale-tab UI
- **File:** `lib/restore.ts:85-97`
- **Description:** `tabId` is validated only as a finite number. Negative, fractional, and unsafe-integer IDs are accepted into the `tabMeta` key store. These rows cannot identify real browser tabs and can collide or behave unpredictably when passed to tab APIs after rematching/UI operations.
- **Reproduction scenario:** Restore metadata with `tabId: -1` or `tabId: 1.5`. It passes `isMeta()` and is stored, even though extension tab IDs are non-negative safe integers.
- **Expected:** Imported tab IDs are validated as non-negative safe integers (or imported live-tab metadata is discarded/remapped).
- **Actual:** Impossible IDs enter the database; they persist until later cleanup/rematch.

## Low Issues (code quality, missing validations, potential improvements)

### L-1 — Category picker loses keyboard focus when closed with Escape or selection

- **Module:** category picker accessibility
- **File:** `components/CategoryPicker.vue:31-52`, `components/CategoryPicker.vue:64-93`
- **Description:** Opening moves focus from the trigger into an option. Escape and `choose()` then remove the focused menu from the DOM without returning focus to the trigger. Keyboard and screen-reader users are left at the document/body and must rediscover their position.
- **Reproduction scenario:** Focus the category swatch, press Enter, then Escape; or choose an option with Enter. Press Tab afterward.
- **Expected:** Focus returns to the picker trigger after the menu closes.
- **Actual:** The focused option disappears and focus is lost.

### L-2 — Rounded stacked-bar widths do not reliably total 100%

- **Module:** category chart
- **File:** `components/CategoryChart.vue:18-41`, `components/CategoryChart.vue:63-73`
- **Description:** Each category percentage is independently rounded to an integer and the rounded value is also used as its CSS width. Equal thirds become 33% + 33% + 33% (a gap); sufficiently many small slices can round upward and exceed 100%, with later segments clipped by `overflow: hidden`. The accessible percentages inherit the same rounding discrepancy.
- **Reproduction scenario:** Supply three equal positive category slices. The displayed stack occupies 99% rather than 100%. With many near-half-percent slices, total declared width can exceed 100%.
- **Expected:** Visual widths are based on unrounded ratios or use a remainder allocation that totals exactly 100%; labels may still be rounded separately.
- **Actual:** Independent rounding produces gaps or clipping.

### L-3 — Session range lookup excludes sessions overlapping the cutoff

- **Module:** session repository / dashboard detail
- **Files:** `lib/db/repo.ts:75-79`, `composables/useStats.ts:334-343`
- **Description:** `getSessionsSince()` filters on `start >= cutoff`, so a session beginning before the 90-day cutoff but ending after it is excluded wholesale. The dashboard does clipping later for the seven-day heatmap, but it can only clip rows returned by this query. Normally heartbeat slices bound the discrepancy, but a restored or stalled/media slice may be much longer.
- **Reproduction scenario:** Store a valid session from cutoff minus 30 minutes to cutoff plus 30 minutes, then load the dashboard. The entire session is absent from `recentSessions`, including the 30 minutes inside the requested window.
- **Expected:** Overlapping sessions are returned and clipped to the requested boundary.
- **Actual:** The query drops them based solely on start time.

## Test Coverage Gaps

- `entrypoints/background.ts:150-163`: no failure-path test proves that a session remains recoverable when both commit attempts fail after engine state is saved.
- `lib/restore.ts:183-193`: no integration test covers `storage.local` settings failure after a successful IndexedDB replacement.
- `lib/settings.ts:200-215`: tests cover stale-cache invalidation, but not two truly concurrent read-merge-write calls from separate contexts.
- `lib/domain.ts:29-36`: no privacy regression cases for base64url path tokens containing `-` or `_` outside the known secret-word routes.
- `lib/restore.ts:51-69`: no invalid-calendar cases such as February 31, month 00, or month 13.
- `lib/import-csv.ts:121-150`: no multiline quoted-field case.
- `lib/restore.ts:85-97`: no negative, fractional, or unsafe `tabId` cases.
- `components/CategoryPicker.vue:31-52`: keyboard tests do not assert focus restoration after Escape/selection.
- `components/CategoryChart.vue:23-41`: no assertion that visual segment widths sum to 100% for rounding-sensitive inputs.
- `lib/db/repo.ts:75-79`: no overlap-at-cutoff session query case.

## Recommendations

1. Make closed-session persistence recoverable across commit failure; do not durably advance the engine past data that has not committed.
2. Treat restore of IndexedDB plus settings as a coordinated operation with rollback/staging, and surface partial success if platform storage cannot be transactional across both backends.
3. Strengthen path-secret redaction for base64url/high-entropy segments and add privacy regression fixtures representing real share and magic-link URL shapes.
4. Serialize settings mutations in one authority (for example, the background context) or add revisioned compare-and-retry semantics.
5. Validate actual calendar dates/months and browser ID integer ranges at the backup boundary.
6. Replace physical-line CSV splitting with a record-aware parser.
7. Return overlapping sessions at range boundaries and clip them in the consumer/repository.
8. Restore picker focus and separate exact chart geometry from rounded display labels.

## Modules Reviewed Without Additional Findings

No additional concrete correctness defect was found in the remaining reviewed modules. In particular, `lib/db/db.ts`, `lib/db/errors.ts`, `lib/tracker/aggregate.ts`, `lib/tracker/engine.ts`, `lib/tracker/session-alert.ts`, `lib/tracker/stale.ts`, `lib/time.ts`, `lib/heatmap.ts`, `lib/metrics.ts`, `lib/monthly.ts`, `lib/navigate.ts`, `lib/crypto.ts`, `lib/export.ts`, `lib/merge.ts`, `lib/categories.ts`, `lib/budgets.ts`, `lib/chart-scale.ts`, `lib/comparison.ts`, `lib/insights.ts`, `lib/productivity.ts`, `lib/report.ts`, `lib/report-card.ts`, `lib/sessionize.ts`, `lib/subpages.ts`, `lib/trend.ts`, `lib/worklog.ts`, the Wrapped modules, i18n loaders/notification catalogs, the other Vue components/composables, and both entrypoint shells were consistent with their apparent contracts for the reviewed cases. All 11 locale JSON files contain the same 327 scalar keys.
