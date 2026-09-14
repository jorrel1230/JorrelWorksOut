# JorrelWorksOut

A local-first fitness notebook rebuilt with React and native semantic HTML. No CSS, inline styles, visual frameworks, charts, onboarding, prescribed templates, or automatic progression.

## Use

- **Workouts:** choose any date and workout type; add, remove and reorder arbitrary exercises. Every set has its own decimal weight (lb), integer reps, warmup/completed flags and notes. Session and exercise notes are independent. Complete a workout explicitly; unchecked sets stay unchecked. Completed normalized records remain editable. Original `lift_results` are displayed read-only, never automatically converted.
- **Runs:** create, read, edit and delete all schema-backed metrics. Existing units remain miles, seconds, feet and pounds; optional metrics can be left blank.
- **Exercise catalog:** optional references, not a required program. Changes do not rewrite workouts.
- **Training plans:** create, read, edit and delete raw markdown without interpreting or executing it.
- **Account / data:** existing Supabase email/password access, account creation, local mode, account-scoped JSON export, sync status/retry, preserved run settings (read-only), and cloud import audit (read-only).

Each editor automatically stores a recoverable draft in IndexedDB, including incomplete/invalid input. Wait for “Editor draft saved” before closing. Saving to history is explicit and validated. Errors remain visible; drafts can be retried, downloaded or discarded. Completed-record saves compare content against the original snapshot: a concurrent edit causes a conflict, not a silent overwrite. Download your draft, discard it and reopen to reconcile a conflict. Deletions and draft discards require confirmation.

## Development and validation

Requires Node 22.12+ (or another Vite-supported release).

```sh
npm ci
npm run dev        # http://localhost:5173/JorrelWorksOut/
npm test           # Node tests using isolated fake IndexedDB and mocked cloud clients
npm run lint
npm run build
npm run preview    # production shell, including service worker
npm run test:browser
```

Browser tests require Google Chrome installed (`channel: 'chrome'` in `playwright.config.js`). They launch their own dev and preview servers on ports 5173 and 4173 and use fresh temporary browser contexts. Supabase requests are blocked. They cover native navigation, per-set notes/weights, draft reload, completion/editing, legacy history, runs/catalog/plans, export, signout retention, 390px/320px layout, no styles, production cache replacement and offline reload. No personal browser profile or real remote data is used.

Node tests cover validation, independent set roundtrip, local transaction rollback if queue persistence fails, version-3 history upgrading to the unchanged version-4 schema, account isolation, raw draft persistence, resource CRUD, queue replay/deletions, failed pushes, writes racing a pull, account changes, legacy queue retention and legacy-only cloud deployments. Auth tests also cover cached access after expiry, account switching, stale auth responses, immediate offline signout, preserved data/queue and refusal to issue cloud table requests without a current matching session. Live Supabase credentials/RLS and an installed iPhone/Safari PWA are **not** verified by these tests.

The production build may report a main JS chunk-size warning (React, Dexie and Supabase). It is nonfatal. GitHub Pages deployment configuration is retained; nothing needs a new database migration. Internal navigation is plain hash links under `/JorrelWorksOut/`.

## Data compatibility and architecture

`src/lib/db.js` is unchanged: database **sl5x5**, Dexie schema versions **1–4**, same stores and indexes. All SQL files/migrations are unchanged. Existing IndexedDB and cloud history is retained, including legacy set arrays. No startup reset, seeding, history clearing or automatic data conversion occurs. Private/gitignored data, schema design notes and offline data-import utilities are retained, but never imported by the application.

Small modules:

- `src/lib/model.js`: record constructors, field definitions, validation and content fingerprints.
- `src/lib/repository.js`: owner-scoped reads, transactional local writes and JSON export.
- `src/lib/sync.js`: durable outbox replay and guarded, paginated cloud pull.
- `src/lib/supabase.js`: normal Supabase client, without auth method monkey-patching. Existing public client configuration/environment variable names and auth storage remain compatible.
- `src/lib/accountAccess.js`: remembered local account identity and immediate app signout, separate from cloud credentials.
- `src/ui/`: native editors, lists and account/data page; `src/App.jsx` owns hash navigation and background sync.

No local database schema addition was needed. The existing flexible `syncQueue` store contains two new tagged records:

- `editorDraft`: `{ user_id, key, value, base, saved_at }`, never uploaded. Stores raw editor input and its base content fingerprint.
- `mutation`: `{ user_id, data: JSON.stringify({ version: 1, operations }), synced_at: null }`. Written in the **same IndexedDB transaction** as the records/deletions. Local-mode saves do not generate cloud mutations.

Workouts save session → workout exercises → individual sets in one local transaction, together with explicit child deletions, queue insertion and draft removal. Legacy results are untouched unless the user explicitly deletes the entire workout. Metadata is preserved during edits. Export includes the active account’s records, drafts and verifiably owned queue entries, but no credentials or another account’s data. Export is for backup/inspection; this version has no import/restore UI.

## Sync and account safety

Local writes never await the network. Sync attempts run on account opening, saved changes, reconnect, every minute while open, or manual retry. It replays only the active account’s queue, parent-first upserts and child-first deletions. Failed operations retain the entire idempotent entry. Web Locks serialize drains between modern browser tabs; the module also guards same-tab concurrency. Active auth ownership is checked between requests.

Verified old `session`, `workout`, `run` and `runSettings` queue payloads can replay without changing their owner. Unknown, malformed or ambiguous entries are retained, not dropped or reassigned. Unverified ownership pauses sync; recovery requires inspecting the retained entry with a trusted local data tool, not guessing an account in the UI. They are excluded from account exports when ownership cannot be established.

A pull is merged only after pending mutations have drained and only if no new pending write/deletion arrived while fetching. Child rows are restricted to the account’s parent records, ID/ownership conflicts abort the local transaction, and editor drafts are never replaced by a pull. All pages and exports scope by account. Signing out does not clear any records or queue; switching to local mode does not automatically import or upload data from another identity.

After a successful sign-in in this rebuild, `jwo.accountAccess` remembers only the account ID/email so its local records can open immediately offline, including after token expiry. This is device-local access, not cloud authorization: every sync request/page and import-audit request requires a matching, unexpired Supabase session with an access token. Supabase/RLS still performs server-side token authorization. The account page identifies cached access and offers sign-in to renew authorization. An existing valid SDK session initializes this remembered identity; a legacy installation that has never opened the rebuild with a valid session may need one online sign-in first.

Explicit signout synchronously replaces the remembered identity with a signed-out marker and removes local-mode selection, then attempts SDK logout without waiting for the network. A failed/offline logout or late SDK response cannot restore app access across reload; server-side session revocation is best-effort, not guaranteed while offline. Fresh explicit sign-in clears the marker. Cached identities are not a device encryption/security boundary: anyone with access to the same unlocked browser profile can inspect its local storage and IndexedDB. No credentials are copied into the remembered-identity record.

Limitations without changing the cloud schema:

- Local completion is transactional; separate cloud table requests are not. A partially pushed workout can be temporarily incomplete in the cloud until retry succeeds.
- There are no server revisions or tombstones. Pulls merge rather than delete local rows merely because they are absent remotely; deletions made on a different device are not automatically pruned here. Cross-device simultaneous edits are not a distributed conflict-resolution system. Use one active editing device and export before reconciling competing histories.
- A cloud deployment missing the existing normalized tables can still supply legacy history. New normalized workouts work locally; attempted normalized pushes remain queued with an explicit error until those existing tables are available. No migration is executed by the app.
- iOS can evict site storage. Keep private JSON backups and/or a synced cloud copy. Browser Web Locks are needed for cross-tab drain serialization.

## Offline shell and installed-app updates

The old decorative assets and styling are removed. `public/sw.js` replaces the old worker at the same URL; Vite fills a build-specific cache and precaches the generated JS, HTML and minimal manifest. Navigation is network-first with an offline fallback. Activation removes only this app’s old shell caches (including `jorrel-works-out-v1`), never IndexedDB or unrelated app caches. The worker is registered only in production with cache-bypassing update checks.

An already-open old page is not force-reloaded, avoiding loss of its in-memory work. Reopen/refresh online to receive the replacement shell; after installation, the new shell can reopen offline. Dev mode does not register a worker. iPhone Add to Home Screen behavior and migration of a real installed profile still require a manual check; do not clear website data as an update step.

Do not commit private seeds, exports, `.env.local`, `HANDOFF.md`, or backups. No reset SQL should be run as part of building or testing this application.
