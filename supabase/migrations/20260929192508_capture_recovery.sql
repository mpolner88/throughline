-- Capture acceptance is service-only. All owner lifecycle transitions serialize
-- on the same transaction advisory lock; external storage writes are guarded too.
create table if not exists public.throughline_account_deletion_holds (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null default now()
);
create table if not exists public.throughline_account_deletion_receipts (
  token_sha256 text primary key check (token_sha256 ~ '^[a-f0-9]{64}$'),
  owner_id uuid references auth.users(id) on delete set null,
  outcome text not null check (outcome in ('pending', 'deleted')),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index if not exists throughline_deletion_receipts_expiry_idx
  on public.throughline_account_deletion_receipts(expires_at);
create table if not exists public.throughline_capture_reservations (
  owner_id uuid not null references auth.users(id) on delete cascade,
  capture_id uuid not null,
  recording_id text not null unique,
  object_token uuid not null unique default gen_random_uuid(),
  audio_sha256 text not null check (audio_sha256 ~ '^[a-f0-9]{64}$'),
  audio_bytes bigint not null check (audio_bytes > 0),
  metadata jsonb not null,
  receipt jsonb,
  processing_claimed boolean not null default false,
  primary key (owner_id, capture_id)
);
create table if not exists public.throughline_capture_tombstones (
  owner_id uuid not null references auth.users(id) on delete cascade,
  capture_id uuid not null,
  deleted_at timestamptz not null default now(),
  primary key(owner_id, capture_id)
);
alter table public.throughline_recordings add column if not exists capture_id uuid;
create unique index if not exists throughline_recordings_owner_capture_idx
  on public.throughline_recordings(auth_user_id,capture_id) where capture_id is not null;

create or replace function public.throughline_capture_owner_lock_v1(p_owner uuid)
returns void language sql security definer set search_path='' as $$
  select pg_advisory_xact_lock(hashtextextended(p_owner::text, 19301));
$$;

create or replace function public.throughline_capture_status_v1(p_owner uuid,p_capture uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.throughline_capture_reservations; t public.throughline_capture_tombstones;
begin
  perform public.throughline_capture_owner_lock_v1(p_owner);
  if exists(select 1 from public.throughline_account_deletion_holds where owner_id=p_owner)
     or not exists(select 1 from auth.users where id=p_owner) then
    return jsonb_build_object('capture_outcome','account_deletion_pending');
  end if;
  select * into t from public.throughline_capture_tombstones where owner_id=p_owner and capture_id=p_capture;
  if found then return jsonb_build_object('capture_outcome','owner_deleted','owner_deleted',to_jsonb(t)); end if;
  select * into r from public.throughline_capture_reservations where owner_id=p_owner and capture_id=p_capture;
  if not found then return jsonb_build_object('capture_outcome','nothing_held'); end if;
  if r.receipt is not null then return jsonb_build_object('capture_outcome','accepted','capture_receipt',r.receipt); end if;
  return jsonb_build_object('capture_outcome','incomplete');
end $$;

create or replace function public.throughline_reserve_capture_v1(
  p_owner uuid,p_capture uuid,p_sha256 text,p_bytes bigint,p_metadata jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.throughline_capture_reservations; s jsonb;
begin
  perform public.throughline_capture_owner_lock_v1(p_owner);
  if p_bytes <= 0 or p_sha256 !~ '^[a-f0-9]{64}$' or p_metadata is null then
    raise exception 'invalid capture payload';
  end if;
  s := public.throughline_capture_status_v1(p_owner,p_capture);
  if s->>'capture_outcome' in ('account_deletion_pending','owner_deleted') then return s; end if;
  insert into public.throughline_capture_reservations(owner_id,capture_id,recording_id,audio_sha256,audio_bytes,metadata)
    values(p_owner,p_capture,'rec_'||replace(gen_random_uuid()::text,'-',''),p_sha256,p_bytes,p_metadata)
    on conflict(owner_id,capture_id) do nothing;
  select * into strict r from public.throughline_capture_reservations where owner_id=p_owner and capture_id=p_capture;
  if r.audio_sha256 <> p_sha256 or r.audio_bytes <> p_bytes or r.metadata <> p_metadata then
    return jsonb_build_object('capture_outcome','conflict');
  end if;
  if r.receipt is not null then return jsonb_build_object('capture_outcome','accepted','capture_receipt',r.receipt); end if;
  return jsonb_build_object('capture_outcome','incomplete','recording_id',r.recording_id,'object_token',r.object_token);
end $$;

-- The API has verified exact object bytes before calling acceptance. The object
-- must still exist in the private bucket. Row, immutable receipt and claim commit
-- together; there is deliberately no processing-claim lease/reclaim.
create or replace function public.throughline_accept_capture_v1(p_owner uuid,p_capture uuid,p_recording jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.throughline_capture_reservations; s jsonb; accepted_receipt jsonb;
begin
  perform public.throughline_capture_owner_lock_v1(p_owner);
  s := public.throughline_capture_status_v1(p_owner,p_capture);
  if s->>'capture_outcome' <> 'incomplete' then return s; end if;
  select * into strict r from public.throughline_capture_reservations where owner_id=p_owner and capture_id=p_capture;
  if p_recording->>'id' is distinct from r.recording_id
    or p_recording->>'auth_user_id' is distinct from p_owner::text
    or p_recording->>'capture_id' is distinct from p_capture::text
    or p_recording->'audio'->>'object_path' is distinct from 'captures/'||r.object_token::text
    or p_recording->'audio'->>'bucket' is distinct from 'throughline-audio'
    or not exists(select 1 from storage.objects where bucket_id='throughline-audio' and name='captures/'||r.object_token::text) then
    raise exception 'incomplete capture storage';
  end if;
  insert into public.throughline_recordings(id,user_id,auth_user_id,capture_id,created_at,user_local_time,timezone,duration_seconds,type,status,processing_status,transcript_raw,audio,recording)
  values(r.recording_id,p_owner::text,p_owner,p_capture,(r.metadata->>'captured_at')::timestamptz,
    r.metadata->>'user_local_time',r.metadata->>'timezone',(r.metadata->>'duration_seconds')::numeric,
    r.metadata->>'type','uploaded','uploaded',null,p_recording->'audio',p_recording);
  accepted_receipt := jsonb_build_object('version',1,'owner_id',p_owner,'capture_id',p_capture,'recording_id',r.recording_id,
    'accepted_at',clock_timestamp(),'audio_sha256',r.audio_sha256,'audio_bytes',r.audio_bytes,'captured_at',r.metadata->>'captured_at');
  update public.throughline_capture_reservations set receipt=accepted_receipt,processing_claimed=true where owner_id=p_owner and capture_id=p_capture;
  return jsonb_build_object('capture_outcome','accepted','capture_receipt',accepted_receipt,'processing_claim',true);
end $$;

create or replace function public.throughline_capture_recording_guard_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    if old.auth_user_id is not null then perform public.throughline_capture_owner_lock_v1(old.auth_user_id); end if;
    if old.capture_id is not null then
      -- Account deletion needs no tombstone (and the parent may already be gone).
      if exists(select 1 from auth.users where id=old.auth_user_id) and not exists(select 1 from public.throughline_account_deletion_holds where owner_id=old.auth_user_id) then
        insert into public.throughline_capture_tombstones(owner_id,capture_id) values(old.auth_user_id,old.capture_id) on conflict do nothing;
      end if;
      delete from public.throughline_capture_reservations where owner_id=old.auth_user_id and capture_id=old.capture_id;
    end if;
    return old;
  end if;
  if new.auth_user_id is not null then
    perform public.throughline_capture_owner_lock_v1(new.auth_user_id);
    if exists(select 1 from public.throughline_account_deletion_holds where owner_id=new.auth_user_id) then raise exception 'account deletion pending'; end if;
    if new.capture_id is not null and exists(select 1 from public.throughline_capture_tombstones where owner_id=new.auth_user_id and capture_id=new.capture_id) then raise exception 'capture deleted'; end if;
  end if;
  return new;
end $$;
drop trigger if exists throughline_capture_recording_guard on public.throughline_recordings;
create trigger throughline_capture_recording_guard before insert or update or delete on public.throughline_recordings
  for each row execute function public.throughline_capture_recording_guard_v1();

-- Storage calls run outside the reservation transaction. This trigger closes the
-- delayed-upload race: an insert after deletion begins cannot create an orphan.
create or replace function public.throughline_capture_storage_guard_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare r public.throughline_capture_reservations; legacy_owner uuid;
begin
  if new.bucket_id='throughline-audio' and new.name like 'captures/%' then
    select * into r from public.throughline_capture_reservations where object_token=substring(new.name from 10)::uuid;
    if not found then raise exception 'capture storage unavailable'; end if;
    perform public.throughline_capture_owner_lock_v1(r.owner_id);
    if exists(select 1 from public.throughline_account_deletion_holds where owner_id=r.owner_id)
      or not exists(select 1 from public.throughline_capture_reservations where owner_id=r.owner_id and capture_id=r.capture_id and receipt is null)
      then raise exception 'capture storage unavailable'; end if;
    if tg_op='UPDATE' then raise exception 'capture audio is immutable'; end if;
  elsif new.bucket_id='throughline-audio' and split_part(new.name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    -- Public legacy clients still write owner UUID folders before row creation.
    -- Serialize those writes too, preserving their ordinary overwrite behavior.
    legacy_owner := split_part(new.name,'/',1)::uuid;
    perform public.throughline_capture_owner_lock_v1(legacy_owner);
    if exists(select 1 from public.throughline_account_deletion_holds where owner_id=legacy_owner)
      or not exists(select 1 from auth.users where id=legacy_owner) then
      raise exception 'account storage unavailable';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists throughline_capture_storage_guard on storage.objects;
create trigger throughline_capture_storage_guard before insert or update on storage.objects
  for each row execute function public.throughline_capture_storage_guard_v1();

create or replace function public.throughline_begin_account_deletion_v1(p_owner uuid,p_token_sha256 text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform public.throughline_capture_owner_lock_v1(p_owner);
  if not exists(select 1 from auth.users where id=p_owner) then return jsonb_build_object('deletion_outcome','unknown'); end if;
  if exists(select 1 from public.throughline_account_deletion_receipts where token_sha256=p_token_sha256 and owner_id is distinct from p_owner) then
    return jsonb_build_object('deletion_outcome','refused');
  end if;
  insert into public.throughline_account_deletion_holds(owner_id) values(p_owner) on conflict do nothing;
  insert into public.throughline_account_deletion_receipts(token_sha256,owner_id,outcome) values(p_token_sha256,p_owner,'pending')
    on conflict(token_sha256) do update set expires_at=now()+interval '30 days';
  return jsonb_build_object('deletion_outcome','pending');
end $$;
create or replace function public.throughline_account_deletion_status_v1(p_token_sha256 text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result text;
begin
  delete from public.throughline_account_deletion_receipts where expires_at < now();
  select outcome into result from public.throughline_account_deletion_receipts where token_sha256=p_token_sha256;
  return jsonb_build_object('deletion_outcome',coalesce(result,'unknown'),'deleted',coalesce(result='deleted',false));
end $$;
create or replace function public.throughline_finish_account_deletion_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform public.throughline_capture_owner_lock_v1(old.id);
  update public.throughline_account_deletion_receipts set outcome='deleted',owner_id=null,expires_at=now()+interval '30 days' where owner_id=old.id;
  return old;
end $$;
drop trigger if exists throughline_finish_account_deletion on auth.users;
create trigger throughline_finish_account_deletion before delete on auth.users
  for each row execute function public.throughline_finish_account_deletion_v1();

-- No public or signed-in grants; only the API service may call these functions.
do $$ declare n text; f regprocedure; begin
  foreach n in array array['throughline_capture_reservations','throughline_capture_tombstones','throughline_account_deletion_holds','throughline_account_deletion_receipts'] loop
    execute format('alter table public.%I enable row level security',n);
    execute format('revoke all on table public.%I from public,anon,authenticated',n);
    execute format('grant all on table public.%I to service_role',n);
  end loop;
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('throughline_capture_owner_lock_v1','throughline_capture_status_v1','throughline_reserve_capture_v1','throughline_accept_capture_v1','throughline_capture_recording_guard_v1','throughline_capture_storage_guard_v1','throughline_begin_account_deletion_v1','throughline_account_deletion_status_v1','throughline_finish_account_deletion_v1') loop
    execute format('revoke all on function %s from public,anon,authenticated',f);
    execute format('grant execute on function %s to service_role',f);
  end loop;
end $$;

-- Enforce physical expiry even when a deleted account never polls again. This
-- local SQL-only job has no credentials, external destination or user content.
select cron.schedule('throughline-capture-deletion-receipt-retention','17 3 * * *',
  $job$delete from public.throughline_account_deletion_receipts where expires_at < now()$job$);
