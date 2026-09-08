-- JorrelWorksOut MVP Supabase schema
-- Apply in Supabase SQL editor. This supports the current GitHub Pages PWA
-- while keeping the shape close to the future normalized model.

create extension if not exists pgcrypto;

create table if not exists public.exercises (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text,
  category text default 'lifting',
  muscle_group text,
  equipment text,
  weight_lbs numeric,
  sets_required integer default 3,
  target_reps integer default 8,
  failure_streak integer default 0,
  updated_at timestamptz default now(),
  seeded_at timestamptz
);

create unique index if not exists exercises_user_name_idx on public.exercises(user_id, name);

create table if not exists public.workout_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  type text not null,
  is_complete boolean default true,
  note text,
  source text default 'manual',
  created_at timestamptz default now(),
  seeded_at timestamptz
);

create index if not exists workout_sessions_user_date_idx on public.workout_sessions(user_id, date desc);

create table if not exists public.lift_results (
  id text primary key,
  session_id text not null references public.workout_sessions(id) on delete cascade,
  exercise_name text not null,
  weight_lbs numeric,
  set_weights jsonb,
  sets_required integer,
  target_reps integer,
  sets_completed integer,
  partial_reps jsonb,
  total_reps integer,
  volume_lbs numeric,
  failed boolean default false,
  notes text,
  source_file text,
  seeded_at timestamptz
);

create index if not exists lift_results_session_idx on public.lift_results(session_id);

create table if not exists public.runs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  distance numeric,
  duration_seconds integer,
  avg_pace text,
  avg_hr integer,
  z2_time_seconds integer,
  avg_cadence integer,
  elevation_gain numeric,
  avg_power integer,
  calories integer,
  zone text,
  weight_lbs numeric,
  temp_f numeric,
  humidity numeric,
  humidex numeric,
  efficiency numeric,
  notes text,
  source_file text,
  created_at timestamptz default now(),
  seeded_at timestamptz
);

create index if not exists runs_user_date_idx on public.runs(user_id, date desc);

create table if not exists public.run_settings (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  hr_zones jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  seeded_at timestamptz
);

create unique index if not exists run_settings_user_idx on public.run_settings(user_id);

create table if not exists public.training_plans (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  markdown text not null,
  source_file text,
  seeded_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  notes text,
  imported_at timestamptz default now()
);

alter table public.exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.lift_results enable row level security;
alter table public.runs enable row level security;
alter table public.run_settings enable row level security;
alter table public.training_plans enable row level security;
alter table public.import_batches enable row level security;

drop policy if exists "Users manage own exercises" on public.exercises;
create policy "Users manage own exercises" on public.exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own workout sessions" on public.workout_sessions;
create policy "Users manage own workout sessions" on public.workout_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own lift results" on public.lift_results;
create policy "Users manage own lift results" on public.lift_results
  for all using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = lift_results.session_id and s.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workout_sessions s
      where s.id = lift_results.session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users manage own runs" on public.runs;
create policy "Users manage own runs" on public.runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own run settings" on public.run_settings;
create policy "Users manage own run settings" on public.run_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own training plans" on public.training_plans;
create policy "Users manage own training plans" on public.training_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own import batches" on public.import_batches;
create policy "Users manage own import batches" on public.import_batches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
