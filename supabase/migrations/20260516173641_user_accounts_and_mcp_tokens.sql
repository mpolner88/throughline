-- Add publish-ready account ownership without breaking the existing alpha rows.
-- Existing recordings keep their legacy text user_id. New authenticated writes
-- should set auth_user_id from the Supabase Auth subject.

create table if not exists public.throughline_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name text,
  onboarding_completed_at timestamptz
);

alter table public.throughline_recordings
  add column if not exists auth_user_id uuid references auth.users (id) on delete cascade;

alter table public.throughline_feedback
  add column if not exists auth_user_id uuid references auth.users (id) on delete cascade;

create index if not exists throughline_recordings_auth_user_created_idx
  on public.throughline_recordings (auth_user_id, created_at desc)
  where auth_user_id is not null;

create index if not exists throughline_feedback_auth_user_created_idx
  on public.throughline_feedback (auth_user_id, created_at desc)
  where auth_user_id is not null;

create table if not exists public.throughline_mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  name text not null default 'agent token',
  token_hash text not null unique
);

create index if not exists throughline_mcp_tokens_user_created_idx
  on public.throughline_mcp_tokens (user_id, created_at desc);

create index if not exists throughline_mcp_tokens_active_hash_idx
  on public.throughline_mcp_tokens (token_hash)
  where revoked_at is null;

alter table public.throughline_profiles enable row level security;
alter table public.throughline_mcp_tokens enable row level security;

revoke all on table public.throughline_profiles from anon;
revoke all on table public.throughline_mcp_tokens from anon, authenticated;

grant select, insert, update on table public.throughline_profiles to authenticated;
grant all on table public.throughline_mcp_tokens to service_role;
grant all on table public.throughline_profiles to service_role;

drop policy if exists "Users can read their own Throughline profile." on public.throughline_profiles;
create policy "Users can read their own Throughline profile."
on public.throughline_profiles
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id);

drop policy if exists "Users can create their own Throughline profile." on public.throughline_profiles;
create policy "Users can create their own Throughline profile."
on public.throughline_profiles
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = id);

drop policy if exists "Users can update their own Throughline profile." on public.throughline_profiles;
create policy "Users can update their own Throughline profile."
on public.throughline_profiles
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id)
with check ((select auth.uid()) is not null and (select auth.uid()) = id);
