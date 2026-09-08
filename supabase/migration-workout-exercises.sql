-- Migration: Add normalized workout tables (workout_exercises + lifting_sets)
-- Run this against the linked Supabase project:
--   npx supabase db query --linked --file supabase/migration-workout-exercises.sql

-- workout_exercises: one row per exercise in a workout session
create table if not exists public.workout_exercises (
  id text primary key,
  session_id text not null references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_name text not null,
  position integer default 0,
  notes text,
  created_at timestamptz default now()
);

create index if not exists workout_exercises_session_idx
  on public.workout_exercises(session_id);
create index if not exists workout_exercises_user_idx
  on public.workout_exercises(user_id);

-- lifting_sets: one row per set within a workout exercise
create table if not exists public.lifting_sets (
  id text primary key,
  workout_exercise_id text not null references public.workout_exercises(id) on delete cascade,
  set_number integer not null,
  weight_lbs numeric,
  reps integer default 0,
  is_completed boolean default false,
  is_warmup boolean default false,
  notes text,
  created_at timestamptz default now()
);

create index if not exists lifting_sets_exercise_idx
  on public.lifting_sets(workout_exercise_id);

-- RLS policies
alter table public.workout_exercises enable row level security;
alter table public.lifting_sets enable row level security;

drop policy if exists "Users manage own workout exercises" on public.workout_exercises;
create policy "Users manage own workout exercises" on public.workout_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own lifting sets" on public.lifting_sets;
create policy "Users manage own lifting sets" on public.lifting_sets
  for all using (
    exists (
      select 1 from public.workout_exercises we
      where we.id = lifting_sets.workout_exercise_id and we.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workout_exercises we
      where we.id = lifting_sets.workout_exercise_id and we.user_id = auth.uid()
    )
  );
