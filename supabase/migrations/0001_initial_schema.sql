-- AUREX V1 initial schema
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'client' check (role in ('trainer','client','admin')),
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  birth_date date,
  sport text,
  goal text,
  experience_level text not null default 'beginner'
    check (experience_level in ('beginner','intermediate','advanced')),
  status text not null default 'active'
    check (status in ('active','paused','completed')),
  created_at timestamptz not null default now()
);

create table public.client_consents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  consent_type text not null,
  guardian_name text not null,
  granted boolean not null default false,
  consent_version text not null,
  consented_at timestamptz,
  recorded_at timestamptz not null default now()
);

create table public.client_assessments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  height_cm numeric(5,2) check (height_cm is null or height_cm between 50 and 250),
  weight_kg numeric(5,2) check (weight_kg is null or weight_kg between 10 and 300),
  movement_assessment jsonb not null default '{}'::jsonb,
  fitness_notes text,
  assessed_at timestamptz not null default now()
);

create table public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle_group text,
  category text,
  description text,
  video_url text,
  created_by uuid references public.profiles(id),
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  objective text,
  status text not null default 'draft'
    check (status in ('draft','active','completed','archived')),
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create table public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  exercise_id uuid references public.exercise_library(id) on delete set null,
  day_number integer not null default 1 check (day_number between 1 and 7),
  order_number integer not null default 1,
  sets integer check (sets is null or sets between 1 and 20),
  reps text,
  rest_seconds integer check (rest_seconds is null or rest_seconds between 0 and 900),
  notes text
);

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id),
  client_id uuid not null references public.clients(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  scheduled_at timestamptz not null,
  completed_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 5 and 300),
  rpe integer check (rpe is null or rpe between 1 and 10),
  status text not null default 'planned'
    check (status in ('planned','completed','cancelled')),
  client_visible_summary text,
  created_at timestamptz not null default now()
);

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  exercise_id uuid references public.exercise_library(id) on delete set null,
  sets_completed integer,
  reps_completed text,
  load_kg numeric(7,2),
  notes text
);

create table public.progress_records (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  metric_key text not null,
  metric_value numeric(10,2),
  unit text,
  visible_to_client boolean not null default false,
  recorded_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  status text not null default 'active'
    check (status in ('active','completed','cancelled')),
  created_at timestamptz not null default now()
);

create table public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  trainer_id uuid not null references public.profiles(id),
  note text not null,
  created_at timestamptz not null default now()
);

create index clients_trainer_idx on public.clients(trainer_id);
create index clients_auth_user_idx on public.clients(auth_user_id);
create index programs_client_idx on public.programs(client_id);
create index sessions_client_date_idx on public.training_sessions(client_id, scheduled_at);
create index progress_client_date_idx on public.progress_records(client_id, recorded_at);
create index coach_notes_client_idx on public.coach_notes(client_id);

-- A new signup can never choose its own privileged role.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name',''), 'client');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- SECURITY DEFINER helpers avoid recursive RLS policy evaluation.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_trainer()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('trainer','admin')
  );
$$;

create or replace function private.owns_client(target_client uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.clients
    where id = target_client and trainer_id = (select auth.uid())
  );
$$;

create or replace function private.is_linked_client(target_client uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.clients
    where id = target_client and auth_user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_trainer() from public, anon;
revoke all on function private.owns_client(uuid) from public, anon;
revoke all on function private.is_linked_client(uuid) from public, anon;
grant execute on function private.is_trainer() to authenticated;
grant execute on function private.owns_client(uuid) to authenticated;
grant execute on function private.is_linked_client(uuid) to authenticated;

-- Enable RLS everywhere.
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_consents enable row level security;
alter table public.client_assessments enable row level security;
alter table public.exercise_library enable row level security;
alter table public.programs enable row level security;
alter table public.program_exercises enable row level security;
alter table public.training_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.progress_records enable row level security;
alter table public.goals enable row level security;
alter table public.coach_notes enable row level security;

-- Profiles
create policy profiles_select_self on public.profiles
for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self_name on public.profiles
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()) and role = 'client');

-- Clients
create policy clients_select_related on public.clients
for select to authenticated using (
  trainer_id = (select auth.uid()) or auth_user_id = (select auth.uid())
);
create policy clients_insert_trainer on public.clients
for insert to authenticated with check (
  trainer_id = (select auth.uid()) and private.is_trainer()
);
create policy clients_update_trainer on public.clients
for update to authenticated using (
  trainer_id = (select auth.uid()) and private.is_trainer()
) with check (trainer_id = (select auth.uid()) and private.is_trainer());

-- Consents and assessments are trainer-only.
create policy consents_trainer_all on public.client_consents
for all to authenticated using (private.owns_client(client_id) and private.is_trainer())
with check (private.owns_client(client_id) and private.is_trainer());
create policy assessments_trainer_all on public.client_assessments
for all to authenticated using (private.owns_client(client_id) and private.is_trainer())
with check (private.owns_client(client_id) and private.is_trainer());

-- Exercise library: public catalogue readable by signed-in users; trainer's own entries manageable.
create policy exercises_read on public.exercise_library
for select to authenticated using (is_public or created_by = (select auth.uid()));
create policy exercises_insert_trainer on public.exercise_library
for insert to authenticated with check (private.is_trainer() and created_by = (select auth.uid()));
create policy exercises_update_trainer on public.exercise_library
for update to authenticated using (created_by = (select auth.uid()) and private.is_trainer())
with check (created_by = (select auth.uid()) and private.is_trainer());

-- Programs
create policy programs_select_related on public.programs
for select to authenticated using (
  trainer_id = (select auth.uid()) or private.is_linked_client(client_id)
);
create policy programs_insert_trainer on public.programs
for insert to authenticated with check (
  trainer_id = (select auth.uid()) and private.is_trainer() and private.owns_client(client_id)
);
create policy programs_update_trainer on public.programs
for update to authenticated using (trainer_id = (select auth.uid()) and private.is_trainer())
with check (trainer_id = (select auth.uid()) and private.is_trainer() and private.owns_client(client_id));
create policy programs_delete_trainer on public.programs
for delete to authenticated using (trainer_id = (select auth.uid()) and private.is_trainer());

-- Program exercises inherit access through parent program.
create policy program_exercises_select on public.program_exercises
for select to authenticated using (
  exists (select 1 from public.programs p where p.id = program_id
    and (p.trainer_id = (select auth.uid()) or private.is_linked_client(p.client_id)))
);
create policy program_exercises_insert on public.program_exercises
for insert to authenticated with check (
  exists (select 1 from public.programs p where p.id = program_id
    and p.trainer_id = (select auth.uid()) and private.is_trainer())
);
create policy program_exercises_update on public.program_exercises
for update to authenticated using (
  exists (select 1 from public.programs p where p.id = program_id
    and p.trainer_id = (select auth.uid()) and private.is_trainer())
) with check (
  exists (select 1 from public.programs p where p.id = program_id
    and p.trainer_id = (select auth.uid()) and private.is_trainer())
);
create policy program_exercises_delete on public.program_exercises
for delete to authenticated using (
  exists (select 1 from public.programs p where p.id = program_id
    and p.trainer_id = (select auth.uid()) and private.is_trainer())
);

-- Sessions
create policy sessions_select_related on public.training_sessions
for select to authenticated using (
  trainer_id = (select auth.uid()) or private.is_linked_client(client_id)
);
create policy sessions_insert_trainer on public.training_sessions
for insert to authenticated with check (
  trainer_id = (select auth.uid()) and private.is_trainer() and private.owns_client(client_id)
);
create policy sessions_update_trainer on public.training_sessions
for update to authenticated using (trainer_id = (select auth.uid()) and private.is_trainer())
with check (trainer_id = (select auth.uid()) and private.is_trainer() and private.owns_client(client_id));
create policy sessions_delete_trainer on public.training_sessions
for delete to authenticated using (trainer_id = (select auth.uid()) and private.is_trainer());

-- Session exercises: trainer controls records; linked client can read records for their session.
create policy session_exercises_select on public.session_exercises
for select to authenticated using (
  exists (select 1 from public.training_sessions s where s.id = session_id
    and (s.trainer_id = (select auth.uid()) or private.is_linked_client(s.client_id)))
);
create policy session_exercises_insert on public.session_exercises
for insert to authenticated with check (
  exists (select 1 from public.training_sessions s where s.id = session_id
    and s.trainer_id = (select auth.uid()) and private.is_trainer())
);
create policy session_exercises_update on public.session_exercises
for update to authenticated using (
  exists (select 1 from public.training_sessions s where s.id = session_id
    and s.trainer_id = (select auth.uid()) and private.is_trainer())
) with check (
  exists (select 1 from public.training_sessions s where s.id = session_id
    and s.trainer_id = (select auth.uid()) and private.is_trainer())
);
create policy session_exercises_delete on public.session_exercises
for delete to authenticated using (
  exists (select 1 from public.training_sessions s where s.id = session_id
    and s.trainer_id = (select auth.uid()) and private.is_trainer())
);

-- Progress
create policy progress_select_related on public.progress_records
for select to authenticated using (
  private.owns_client(client_id) or
  (private.is_linked_client(client_id) and visible_to_client = true)
);
create policy progress_insert_trainer on public.progress_records
for insert to authenticated with check (private.owns_client(client_id) and private.is_trainer());
create policy progress_update_trainer on public.progress_records
for update to authenticated using (private.owns_client(client_id) and private.is_trainer())
with check (private.owns_client(client_id) and private.is_trainer());

-- Goals
create policy goals_select_related on public.goals
for select to authenticated using (private.owns_client(client_id) or private.is_linked_client(client_id));
create policy goals_insert_trainer on public.goals
for insert to authenticated with check (private.owns_client(client_id) and private.is_trainer());
create policy goals_update_trainer on public.goals
for update to authenticated using (private.owns_client(client_id) and private.is_trainer())
with check (private.owns_client(client_id) and private.is_trainer());
create policy goals_delete_trainer on public.goals
for delete to authenticated using (private.owns_client(client_id) and private.is_trainer());

-- Private trainer notes: no client SELECT policy.
create policy notes_trainer_all on public.coach_notes
for all to authenticated using (private.owns_client(client_id) and private.is_trainer())
with check (private.owns_client(client_id) and private.is_trainer());

-- Grant minimum table privileges; RLS still filters rows.
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.clients to authenticated;
grant select, insert, update, delete on public.client_consents to authenticated;
grant select, insert, update, delete on public.client_assessments to authenticated;
grant select, insert, update on public.exercise_library to authenticated;
grant select, insert, update, delete on public.programs to authenticated;
grant select, insert, update, delete on public.program_exercises to authenticated;
grant select, insert, update, delete on public.training_sessions to authenticated;
grant select, insert, update, delete on public.session_exercises to authenticated;
grant select, insert, update on public.progress_records to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.coach_notes to authenticated;
