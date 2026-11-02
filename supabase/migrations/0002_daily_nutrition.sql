-- AUREX V1.4: daily nutrition tracking
create table public.nutrition_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  entry_date date not null default current_date,
  entry_type text not null check (entry_type in ('food','drink')),
  meal_type text check (meal_type in ('breakfast','lunch','dinner','snack')),
  name text not null check (char_length(name) between 1 and 120),
  amount_g numeric(8,2) check (amount_g is null or amount_g between 0 and 20000),
  amount_ml integer check (amount_ml is null or amount_ml between 0 and 20000),
  calories numeric(8,2) not null default 0 check (calories between 0 and 10000),
  protein_g numeric(8,2) not null default 0 check (protein_g between 0 and 1000),
  carbs_g numeric(8,2) not null default 0 check (carbs_g between 0 and 1000),
  fat_g numeric(8,2) not null default 0 check (fat_g between 0 and 1000),
  notes text,
  created_at timestamptz not null default now(),
  constraint nutrition_entry_type_fields check (
    (entry_type='food' and meal_type is not null and amount_g is not null and amount_ml is null)
    or
    (entry_type='drink' and meal_type is null and amount_ml is not null and amount_g is null)
  )
);

create table public.nutrition_targets (
  client_id uuid primary key references public.clients(id) on delete cascade,
  calories integer not null default 2200 check (calories between 500 and 10000),
  protein_g integer not null default 150 check (protein_g between 0 and 1000),
  carbs_g integer not null default 250 check (carbs_g between 0 and 1500),
  fat_g integer not null default 70 check (fat_g between 0 and 500),
  water_ml integer not null default 2500 check (water_ml between 250 and 10000),
  updated_at timestamptz not null default now()
);

create index nutrition_entries_client_day_idx on public.nutrition_entries(client_id, entry_date, created_at desc);

alter table public.nutrition_entries enable row level security;
alter table public.nutrition_targets enable row level security;

create policy nutrition_entries_select_related on public.nutrition_entries
for select to authenticated using (private.owns_client(client_id) or private.is_linked_client(client_id));
create policy nutrition_entries_insert_related on public.nutrition_entries
for insert to authenticated with check (private.owns_client(client_id) or private.is_linked_client(client_id));
create policy nutrition_entries_update_related on public.nutrition_entries
for update to authenticated using (private.owns_client(client_id) or private.is_linked_client(client_id))
with check (private.owns_client(client_id) or private.is_linked_client(client_id));
create policy nutrition_entries_delete_related on public.nutrition_entries
for delete to authenticated using (private.owns_client(client_id) or private.is_linked_client(client_id));

create policy nutrition_targets_select_related on public.nutrition_targets
for select to authenticated using (private.owns_client(client_id) or private.is_linked_client(client_id));
create policy nutrition_targets_manage_trainer on public.nutrition_targets
for all to authenticated using (private.owns_client(client_id) and private.is_trainer())
with check (private.owns_client(client_id) and private.is_trainer());

grant select, insert, update, delete on public.nutrition_entries to authenticated;
grant select, insert, update, delete on public.nutrition_targets to authenticated;
