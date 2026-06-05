# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (localhost:5173)
npm run build     # production build → dist/
npm run preview   # serve dist/ locally
npm run lint      # ESLint
```

No test suite. Verify changes manually via the dev server.

## What This Is

A Stronglifts 5×5 workout tracker PWA. Offline-first: all writes go to IndexedDB (Dexie) first; UI never waits on Supabase. Deployed to GitHub Pages at base path `/JorrelWorksOut/` using HashRouter.

## Architecture

**Data flow:** Every write hits IndexedDB first. Supabase syncs happen in background on workout completion; failed pushes enqueue in `syncQueue` and drain on the next `window online` event.

**Auth gate (App.jsx):** Three render states — loading splash, unauthenticated → `/auth`, authenticated-but-not-onboarded → `/onboarding`, fully onboarded → main app. "Onboarded" means at least one exercise row exists in IndexedDB for the user.

**Key lib files:**
- `src/lib/db.js` — Dexie schema (tables: `exercises`, `sessions`, `liftResults`, `syncQueue`)
- `src/lib/sync.js` — `pullFromSupabase`, `pushSession`, `drainSyncQueue`
- `src/lib/progression.js` — pure function `computeProgression(weightLbs, failureStreak, failed)` → `{ newWeight, newStreak, deloaded }`
- `src/lib/workout.js` — workout constants (`WORKOUT_LIFTS`, `SETS_REQUIRED`), `nextWorkoutType`, `sortSessionsDesc`, `formatDate`
- `src/lib/supabase.js` — Supabase client (reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`)

**Progression rules:**
- Pass (all sets complete) → `weight += 5`, `failure_streak = 0`
- Fail → `failure_streak += 1`; at streak ≥ 3 → deload: `floor(weight × 0.9 / 2.5) × 2.5`, reset streak
- Progression only applied on Finish confirm, never mid-session
- Abandoned sessions don't advance A/B or affect weights

**Workout structure:**
- Workout A: Squat, Bench Press, Barbell Row
- Workout B: Squat, Overhead Press, Deadlift
- Deadlift is 1 set; all others are 5 sets

## Environment

Copy `.env.example` → `.env` and fill in Supabase project URL + anon key.

## Supabase Schema

Three tables with RLS (user can only access their own rows):
- `exercises` — one row per lift per user, holds `weight_lbs`, `failure_streak`, `sets_required`
- `workout_sessions` — `type` is `'A'` or `'B'`, `is_complete` bool
- `lift_results` — FK to `workout_sessions`; stores `sets_completed`, `partial_reps[]`, `failed`

When deploying, update Supabase Auth → URL Configuration with the production URL so magic link redirects work.
