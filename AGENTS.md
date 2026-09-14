# AGENTS.md

> Instructions for any AI coding agent working on this project.

## Project overview

**JorrelWorksOut** is a mobile-first, offline-first fitness PWA for lifting and running. It is deployed to GitHub Pages at `jorrelrajan.com/JorrelWorksOut`. The owner uses it on iPhone via Add to Home Screen.

**Stack:** React 19 + Vite 8 + Dexie (IndexedDB) + Supabase + Recharts. No test suite — verify via dev server.

**Architecture:** Every data write hits IndexedDB first. Supabase syncs in the background on workout completion. Failed pushes queue in `syncQueue` and drain automatically when the device goes back online. The app works fully offline.

## Commands

```bash
npm run dev       # dev server → localhost:5173/JorrelWorksOut/
npm run build     # production build → dist/
npm run lint      # ESLint (must pass before committing)
npm run preview   # serve dist/ locally
```

Both `lint` and `build` must pass before any commit. The build emits a chunk-size warning for the main JS bundle — this is expected (Recharts + Supabase).

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) deploys to GitHub Pages on push to `main`. Supabase keys are injected from repo secrets during build. The app code has fallback public Supabase values so builds work without secrets too.

## Routing

Uses `HashRouter` for GitHub Pages compatibility. Base path is `/JorrelWorksOut/`.

Routes:
- `/auth` — email+password login + "Continue locally" (guest mode with `local-user` pseudo-id)
- `/onboarding` — first-run exercise setup (skipped if exercises exist locally or in cloud)
- `/dashboard` — mode hub: Lift or Run (default landing for onboarded users)
- **Lifting:** `/home`, `/workout`, `/summary`, `/history`, `/session/:id`, `/edit-weights`, `/progress`
- **Running:** `/run`, `/run/log`, `/run/history`, `/run/:id`, `/run/progress`, `/run/settings`

## Auth flow

1. Supabase email+password, or "Continue locally" (uses `local-user` id, data stays in IndexedDB).
2. On login: check if exercises exist in Dexie → if yes, onboarded. If no, pull from Supabase. If still none, go to `/onboarding`.
3. Background: drain sync queue + pull from Supabase on mount and on `online` event.
4. Local-mode users (`local-user`) skip all cloud sync automatically.

## Data model (current MVP)

Local storage: **Dexie IndexedDB** (`sl5x5` database, 3 schema versions).

Tables (IndexedDB + Supabase mirror):
- `exercises` — per-user exercise definitions with current working weight, sets, target reps, failure streak
- `workout_sessions` (Dexie: `sessions`) — one lifting session per date, type is Push/Pull/Legs
- `lift_results` (Dexie: `liftResults`) — one result per exercise per session, stores `partial_reps[]` and `set_weights[]` as JSON arrays
- `runs` — cardio entries (distance, duration, pace, HR, Z2 time, cadence, elevation, power, calories)
- `run_settings` (Dexie: `runSettings`) — HR zone configuration
- `training_plans` (Dexie: `trainingPlans`) — raw markdown monthly plans
- `import_batches` — audit table for data imports (Supabase only)
- `syncQueue` — offline mutation queue (Dexie only)

Supabase schema: `supabase/schema.sql`. RLS enabled on all tables — policies enforce `auth.uid() = user_id`.

### Known data model gap

`lift_results` stores one row per exercise per session with JSON arrays for sets. The future plan is to normalize to `workout_exercises` + `lifting_sets` (per-set rows). See `docs/database-plan.md` for the normalized schema design.

## Workout structure

**PPL split** (Push / Pull / Legs), rotating in order:

- **Push:** Bench Press, Overhead Press, Dumbbell Shoulder Press, Triceps Pushdown
- **Pull:** Barbell Row, Lat Pulldown, Pullups
- **Legs:** Squat, Deadlift, Leg Curl, Leg Extension, Hip Abductor

All exercises are 3 sets. Target reps vary by exercise (6–12). See `src/lib/workout.js` for defaults.

**Progression:** Pass all sets → +5 lbs. Fail → failure_streak++. At streak ≥ 3 → 10% deload (rounded to nearest 2.5 lbs), reset streak. Progression only applied on workout finish, never mid-session. Abandoned sessions don't affect weights.

## Key source files

| File | Purpose |
|------|---------|
| `src/App.jsx` | Router + auth gate + onboarding check |
| `src/main.jsx` | Entry point + service worker registration |
| `src/lib/db.js` | Dexie schema (3 versions) |
| `src/lib/sync.js` | Cloud sync engine (pull, push, queue, drain) |
| `src/lib/workout.js` | PPL templates, exercise defaults, rotation logic |
| `src/lib/progression.js` | Weight progression/deload calculation |
| `src/lib/supabase.js` | Supabase client + local-mode auth shim |
| `src/lib/runUtils.js` | Run formatting helpers |
| `src/screens/` | 16 screen components |
| `src/components/` | LiftCard, RestTimer, SetCircle, Sheet |
| `src/hooks/useAuth.js` | Supabase auth state + local-mode support |
| `src/hooks/useSync.js` | Background sync on mount + online event |

## Supabase

- **Project:** `gvazsjdtrebpzcuhcrek.supabase.co`
- **Linked via:** `npx supabase link --project-ref gvazsjdtrebpzcuhcrek`
- **Existing auth user:** `542b5f84-79ea-4f93-a3ff-a3281e661dac`
- **Schema files:** `supabase/schema.sql` (create), `supabase/reset-schema.sql` (drop+recreate)
- **Seed data:** `supabase/seed-historical.sql` (gitignored — contains private workout history)

Seed data was generated from markdown notes at `/Users/jorrel/notes/Fitness/Exercise` using `scripts/import-notes.mjs` → `scripts/generate-supabase-seed.mjs`.

## UI status

The CSS was recently stripped to barebones by the owner's request ("UI looks ugly, reduce to barebones HTML"). The modified `src/App.css` and `src/index.css` are uncommitted. The app renders with minimal/default styling. The intent is to **rebuild the UI from scratch** with a deliberate design.

## Private / gitignored files

These files exist locally but must NOT be committed:
- `HANDOFF.md` — internal agent handoff doc
- `.env.local` — Supabase keys
- `supabase/seed-historical.sql` — private workout history
- `src/data/seedData.js` — generated seed module
- `backups/` — pre-MVP snapshots

## Rules for agents

1. **Lint + build must pass** before any commit. Run `npm run lint` and `npm run build`.
2. **Offline-first:** Every write must go to IndexedDB first. Never block the UI on Supabase.
3. **Don't bundle private data.** Seed data and history stay in gitignored files or Supabase.
4. **Preserve existing comments and docstrings** unless directly modifying that code.
5. **HashRouter + base path:** All internal links must work with `HashRouter` and `/JorrelWorksOut/` base.
6. **Mobile-first:** This is an iPhone PWA. Design for touch, small screens, and offline use.
7. **No test suite exists.** Verify changes manually via `npm run dev`.

## Current priorities

1. Rebuild UI with clean, intentional design (CSS was just stripped to barebones)
2. Add settings/export page (JSON export/import, markdown export, manual cloud push)
3. Normalize lifting data model (per-set rows instead of JSON arrays)
4. Allow arbitrary exercise selection during active workouts
5. Body metrics dashboard (weight/waist tracking)
6. Apple Health import for running (future)

## History

The MVP was built in a single session using Claude Sonnet 4.6 (via `pi` CLI), starting from markdown workout notes and an existing minimal GitHub Pages repo. The original app was Stronglifts 5×5 A/B format; it was rebuilt into a PPL split with running support. All 12 git commits are from that session.
