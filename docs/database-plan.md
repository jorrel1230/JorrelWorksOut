# JorrelWorksOut database plan

## MVP implemented now

The current app is a GitHub Pages PWA. It is local-first with IndexedDB via Dexie and syncs to Supabase after `supabase/schema.sql` is applied. The production bundle should not include private historical seed data; historical notes are seeded into Supabase with local scripts instead.

MVP tables:

- `exercises`: current exercise definitions and current working weight/rep target.
- `workout_sessions`: one lifting workout/session by date.
- `lift_results`: one exercise result inside a lifting session, preserving `partial_reps`, `set_weights`, total reps, and volume from the markdown import.
- `runs`: run/cardio entries.
- `run_settings`: HR zone settings.
- `training_plans`: raw markdown monthly plans.
- `import_batches`: future audit table for imports.

Historical seed data was generated locally from `/Users/jorrel/notes/Fitness/Exercise` with:

```bash
node scripts/import-notes.mjs /Users/jorrel/notes/Fitness/Exercise src/data/seedData.js
node scripts/generate-supabase-seed.mjs 542b5f84-79ea-4f93-a3ff-a3281e661dac supabase/seed-historical.sql
npx supabase db query --linked --file supabase/seed-historical.sql
```

`src/data/seedData.js` and `supabase/seed-historical.sql` are intentionally gitignored because they contain private workout history.

Counts in this seed:

- 12 exercises
- 29 lifting sessions
- 94 lifting exercise results
- 22 runs
- 2 training plans

When the existing user signs in, the app pulls these seeded rows from Supabase into local IndexedDB. Local mode starts with onboarding/defaults and does not bundle private historical data.

## Future normalized schema

For a more scalable app, migrate from `lift_results` to normalized per-set rows:

```text
workouts
  id
  user_id
  date
  type: push | pull | legs | run | custom
  title
  notes
  source

workout_exercises
  id
  workout_id
  exercise_id
  position
  notes

lifting_sets
  id
  workout_exercise_id
  set_number
  weight_lbs
  reps
  rpe
  rir
  is_warmup
  is_failure
  notes

cardio_sessions
  id
  workout_id
  activity_type
  distance_miles
  duration_seconds
  pace_seconds_per_mile
  avg_hr
  zone
  temp_f
  humidity
  humidex
  efficiency
  notes

body_metrics
  id
  user_id
  date
  weight_lbs
  waist_inches
  notes
```

Why not start with this full schema immediately? The existing code already had an MVP flow using session/result rows. For speed, the MVP keeps that working shape, while preserving enough raw imported data (`partial_reps`, `set_weights`, `source_file`) to migrate cleanly later.
