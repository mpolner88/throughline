-- Additive measurement attribution for schema-v2 product events.
-- Existing events remain schema v1 with unknown distribution and no inferred
-- internal or recording attribution.

alter table public.throughline_product_events
  add column if not exists schema_version smallint not null default 1,
  add column if not exists distribution_channel text not null default 'unknown',
  add column if not exists is_internal_user boolean,
  add column if not exists recording_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.throughline_product_events'::regclass
      and conname = 'throughline_product_events_schema_version_check'
  ) then
    alter table public.throughline_product_events
      add constraint throughline_product_events_schema_version_check
      check (schema_version in (1, 2));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.throughline_product_events'::regclass
      and conname = 'throughline_product_events_distribution_channel_check'
  ) then
    alter table public.throughline_product_events
      add constraint throughline_product_events_distribution_channel_check
      check (distribution_channel in ('debug', 'testflight', 'app_store', 'unknown'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.throughline_product_events'::regclass
      and conname = 'throughline_product_events_recording_id_fkey'
  ) then
    alter table public.throughline_product_events
      add constraint throughline_product_events_recording_id_fkey
      foreign key (recording_id)
      references public.throughline_recordings (id)
      on delete set null;
  end if;
end
$$;

create index if not exists throughline_product_events_recording_id_idx
  on public.throughline_product_events (recording_id)
  where recording_id is not null;

create table if not exists public.throughline_internal_users (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.throughline_internal_users enable row level security;

revoke all on table public.throughline_internal_users from public, anon, authenticated, service_role;
grant select, insert, delete on table public.throughline_internal_users to service_role;
