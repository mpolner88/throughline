-- Short, service-only claim/finalize/release transitions close the gap between
-- selecting expired audio and deleting its Storage object. External deletion
-- happens only after the claim transaction commits; no database lock spans HTTP.

alter table public.throughline_recordings
  add column evaluation_retention_claim_token uuid,
  add column evaluation_retention_claimed_at timestamptz,
  add column evaluation_retention_claim_expires_at timestamptz,
  add column evaluation_retention_claim_reason text,
  add column evaluation_retention_ordinary_cutoff timestamptz,
  add column evaluation_retention_eligibility_cutoff timestamptz,
  add column evaluation_retention_finalized_at timestamptz;

alter table public.throughline_recordings
  add constraint throughline_recordings_evaluation_retention_claim_state_check
  check (
    (
      evaluation_retention_claim_token is null
      and evaluation_retention_claimed_at is null
      and evaluation_retention_claim_expires_at is null
      and evaluation_retention_claim_reason is null
      and evaluation_retention_ordinary_cutoff is null
      and evaluation_retention_eligibility_cutoff is null
      and evaluation_retention_finalized_at is null
    )
    or (
      evaluation_retention_claim_token is not null
      and evaluation_retention_claimed_at is not null
      and evaluation_retention_claim_expires_at is not null
      and evaluation_retention_claim_expires_at >
        evaluation_retention_claimed_at
      and evaluation_retention_claim_reason in (
        'historical_or_no_active_contribution', 'eligibility_ended'
      )
      and evaluation_retention_ordinary_cutoff is not null
      and evaluation_retention_eligibility_cutoff is not null
      and (
        evaluation_retention_finalized_at is null
        or evaluation_retention_finalized_at >=
          evaluation_retention_claimed_at
      )
    )
  );

create unique index throughline_recordings_evaluation_retention_claim_token_idx
  on public.throughline_recordings (evaluation_retention_claim_token)
  where evaluation_retention_claim_token is not null;
create index throughline_recordings_evaluation_retention_claim_expiry_idx
  on public.throughline_recordings (
    evaluation_retention_claim_expires_at, created_at, id
  )
  where evaluation_retention_claim_token is not null
    and evaluation_retention_finalized_at is null;
create index throughline_recordings_stored_audio_created_at_idx
  on public.throughline_recordings (created_at, id)
  where coalesce((audio->>'stored')::boolean, false)
    and nullif(audio->>'object_path', '') is not null;

create or replace function public.throughline_guard_evaluation_contribution_claim_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_claim_token uuid;
  v_finalized_at timestamptz;
begin
  if new.event_kind <> 'created' then
    return new;
  end if;

  -- Always lock the parent row, including when it is currently unclaimed, so
  -- contribution creation and claim acquisition cannot pass each other.
  select
    recording.evaluation_retention_claim_token,
    recording.evaluation_retention_finalized_at
  into v_claim_token, v_finalized_at
  from public.throughline_recordings as recording
  where recording.id = new.recording_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'recording_not_found';
  end if;
  -- Expiry authorizes only atomic service-side token replacement. Owner writes
  -- remain fail-closed until release, finalize, or stale-claim recovery.
  if v_claim_token is not null and v_finalized_at is null then
    raise exception using
      errcode = 'P0001', message = 'retention_deletion_claim_live';
  end if;
  if v_finalized_at is not null then
    raise exception using
      errcode = 'P0001', message = 'retention_audio_already_finalized';
  end if;
  return new;
end $$;

create trigger throughline_evaluation_contributions_claim_guard
before insert on public.throughline_evaluation_contributions
for each row execute function
  public.throughline_guard_evaluation_contribution_claim_v1();

create or replace function public.throughline_claim_retention_candidates_v1(
  ordinary_cutoff timestamptz,
  eligibility_cutoff timestamptz,
  max_rows integer,
  claim_ttl_seconds integer
) returns table(
  recording_id text,
  candidate_reason text,
  claim_token uuid,
  claim_expires_at timestamptz
) language plpgsql security invoker set search_path = '' as $$
declare
  v_claimed_at timestamptz := statement_timestamp();
  v_recording_id text;
  v_locked_recording_ids text[] := '{}'::text[];
begin
  if ordinary_cutoff is null
    or eligibility_cutoff is null
    or max_rows is null
    or max_rows < 1
    or max_rows > 1000
    or claim_ttl_seconds is null
    or claim_ttl_seconds < 30
    or claim_ttl_seconds > 3600
  then
    raise exception using
      errcode = '22023', message = 'retention_claim_request_invalid';
  end if;

  -- Statement one locks a bounded likely-deletable recording set. Its
  -- contribution snapshot is only a starvation filter, never authorization.
  for v_recording_id in
    select recording.id
    from public.throughline_recordings as recording
    where recording.created_at < ordinary_cutoff
      and coalesce((recording.audio->>'stored')::boolean, false)
      and nullif(recording.audio->>'object_path', '') is not null
      and (
        recording.evaluation_retention_claim_token is null
        or (
          recording.evaluation_retention_finalized_at is null
          and recording.evaluation_retention_claim_expires_at <= v_claimed_at
        )
      )
      and not exists (
        select 1
        from public.throughline_evaluation_contributions as contribution
        where contribution.recording_id = recording.id
          and contribution.auth_user_id = recording.auth_user_id
          and contribution.event_kind = 'created'
          and contribution.notice_version =
            'private_evaluation_notice_v1'
          and contribution.disclosure_version =
            'private_evaluation_disclosure_v1'
          and contribution.policy_version =
            'private_evaluation_policy_v1'
          and contribution.created_at >= eligibility_cutoff
          and not exists (
            select 1
            from public.throughline_evaluation_contributions as later
            where later.supersedes_contribution_id =
              contribution.contribution_id
          )
      )
    order by recording.created_at, recording.id
    limit max_rows
    for update of recording skip locked
  loop
    v_locked_recording_ids := array_append(
      v_locked_recording_ids, v_recording_id
    );
  end loop;

  if cardinality(v_locked_recording_ids) = 0 then
    return;
  end if;

  -- Statement two receives a fresh READ COMMITTED snapshot after the parent
  -- locks are held. Any contribution transaction that held a parent lock has
  -- committed and is now visible; any new one must wait behind these locks.
  return query
  with rechecked as (
    select
      recording.id,
      case
        when exists (
          select 1
          from public.throughline_evaluation_contributions as contribution
          where contribution.recording_id = recording.id
            and contribution.auth_user_id = recording.auth_user_id
            and contribution.event_kind = 'created'
            and contribution.notice_version =
              'private_evaluation_notice_v1'
            and contribution.disclosure_version =
              'private_evaluation_disclosure_v1'
            and contribution.policy_version =
              'private_evaluation_policy_v1'
            and contribution.created_at < eligibility_cutoff
            and not exists (
              select 1
              from public.throughline_evaluation_contributions as later
              where later.supersedes_contribution_id =
                contribution.contribution_id
            )
        ) then 'eligibility_ended'
        else 'historical_or_no_active_contribution'
      end as reason
    from public.throughline_recordings as recording
    where recording.id = any(v_locked_recording_ids)
      and recording.created_at < ordinary_cutoff
      and coalesce((recording.audio->>'stored')::boolean, false)
      and nullif(recording.audio->>'object_path', '') is not null
      and (
        recording.evaluation_retention_claim_token is null
        or (
          recording.evaluation_retention_finalized_at is null
          and recording.evaluation_retention_claim_expires_at <= v_claimed_at
        )
      )
      and not exists (
        select 1
        from public.throughline_evaluation_contributions as contribution
        where contribution.recording_id = recording.id
          and contribution.auth_user_id = recording.auth_user_id
          and contribution.event_kind = 'created'
          and contribution.notice_version =
            'private_evaluation_notice_v1'
          and contribution.disclosure_version =
            'private_evaluation_disclosure_v1'
          and contribution.policy_version =
            'private_evaluation_policy_v1'
          and contribution.created_at >= eligibility_cutoff
          and not exists (
            select 1
            from public.throughline_evaluation_contributions as later
            where later.supersedes_contribution_id =
              contribution.contribution_id
          )
      )
  ), claimed as (
    update public.throughline_recordings as recording
    set evaluation_retention_claim_token = gen_random_uuid(),
        evaluation_retention_claimed_at = v_claimed_at,
        evaluation_retention_claim_expires_at = v_claimed_at +
          make_interval(secs => claim_ttl_seconds),
        evaluation_retention_claim_reason = rechecked.reason,
        evaluation_retention_ordinary_cutoff = ordinary_cutoff,
        evaluation_retention_eligibility_cutoff = eligibility_cutoff,
        evaluation_retention_finalized_at = null
    from rechecked
    where recording.id = rechecked.id
    returning
      recording.id,
      recording.evaluation_retention_claim_reason,
      recording.evaluation_retention_claim_token,
      recording.evaluation_retention_claim_expires_at
  )
  select claimed.id, claimed.evaluation_retention_claim_reason,
    claimed.evaluation_retention_claim_token,
    claimed.evaluation_retention_claim_expires_at
  from claimed
  order by claimed.id;
end $$;

create or replace function public.throughline_finalize_retention_claim_v1(
  payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_recording public.throughline_recordings%rowtype;
  v_claim_token uuid;
  v_finalized_at timestamptz := statement_timestamp();
  v_expired_audio jsonb;
  v_recording_snapshot jsonb;
begin
  if payload is null
    or jsonb_typeof(payload) <> 'object'
    or payload - array[
      'recording_id', 'claim_token', 'source_audio_deleted',
      'raw_artifacts_deleted', 'raw_artifacts_deleted_count'
    ] <> '{}'::jsonb
    or nullif(payload->>'recording_id', '') is null
    or nullif(payload->>'claim_token', '') is null
    or coalesce((payload->>'source_audio_deleted')::boolean, false) = false
    or coalesce((payload->>'raw_artifacts_deleted_count')::integer, -1) < 0
  then
    raise exception using
      errcode = '22023', message = 'retention_claim_finalize_invalid';
  end if;
  v_claim_token := (payload->>'claim_token')::uuid;

  select recording.* into v_recording
  from public.throughline_recordings as recording
  where recording.id = payload->>'recording_id'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'recording_not_found';
  end if;
  if v_recording.evaluation_retention_claim_token is distinct from
    v_claim_token
  then
    raise exception using
      errcode = 'P0001', message = 'retention_claim_token_mismatch';
  end if;
  if v_recording.evaluation_retention_finalized_at is not null then
    return jsonb_build_object(
      'finalized', true,
      'candidate_reason', v_recording.evaluation_retention_claim_reason,
      'idempotent', true
    );
  end if;
  if v_recording.evaluation_retention_claim_expires_at <= v_finalized_at then
    raise exception using
      errcode = 'P0001', message = 'retention_claim_expired';
  end if;
  if not coalesce((v_recording.audio->>'stored')::boolean, false)
    or nullif(v_recording.audio->>'object_path', '') is null
  then
    raise exception using
      errcode = 'P0001', message = 'retention_claim_audio_state_changed';
  end if;

  -- Re-derive protection from current immutable contribution state. The row
  -- claim guard prevents new eligibility, but this check remains authoritative.
  if exists (
    select 1
    from public.throughline_evaluation_contributions as contribution
    where contribution.recording_id = v_recording.id
      and contribution.auth_user_id = v_recording.auth_user_id
      and contribution.event_kind = 'created'
      and contribution.notice_version = 'private_evaluation_notice_v1'
      and contribution.disclosure_version =
        'private_evaluation_disclosure_v1'
      and contribution.policy_version = 'private_evaluation_policy_v1'
      and contribution.created_at >=
        v_recording.evaluation_retention_eligibility_cutoff
      and not exists (
        select 1
        from public.throughline_evaluation_contributions as later
        where later.supersedes_contribution_id =
          contribution.contribution_id
      )
  ) then
    raise exception using
      errcode = 'P0001', message = 'retention_claim_eligibility_changed';
  end if;

  if v_recording.evaluation_retention_claim_reason = 'eligibility_ended' then
    if coalesce((payload->>'raw_artifacts_deleted')::boolean, false) = false
      or exists (
        select 1
        from public.throughline_evaluation_corpus_cases as corpus_case
        where corpus_case.recording_id = v_recording.id
          and (
            not exists (
              select 1
              from public.throughline_evaluation_corpus_events as event
              where event.case_id = corpus_case.case_id
                and event.event_kind = 'invalidated'
            )
            or not exists (
              select 1
              from public.throughline_evaluation_corpus_events as event
              where event.case_id = corpus_case.case_id
                and event.event_kind = 'raw_artifacts_deleted'
            )
          )
      )
    then
      raise exception using
        errcode = '22023', message = 'retention_claim_cleanup_required';
    end if;
  end if;

  v_expired_audio := jsonb_strip_nulls(jsonb_build_object(
    'stored', false,
    'storage', 'expired',
    'bucket', coalesce(
      v_recording.audio->>'bucket', 'throughline-audio'
    ),
    'mime_type', v_recording.audio->>'mime_type',
    'bytes', v_recording.audio->'bytes',
    'expired_at', v_finalized_at,
    'retention_reason', v_recording.evaluation_retention_claim_reason
  ));
  v_recording_snapshot := coalesce(v_recording.recording, '{}'::jsonb)
    || jsonb_build_object(
      'audio', v_expired_audio,
      'audio_retention', jsonb_build_object(
        'status', 'expired',
        'expired_at', v_finalized_at,
        'reason', v_recording.evaluation_retention_claim_reason
      )
    );

  update public.throughline_recordings as recording
  set audio = v_expired_audio,
      recording = v_recording_snapshot,
      evaluation_retention_finalized_at = v_finalized_at
  where recording.id = v_recording.id
    and recording.evaluation_retention_claim_token = v_claim_token;

  return jsonb_build_object(
    'finalized', true,
    'candidate_reason', v_recording.evaluation_retention_claim_reason,
    'idempotent', false
  );
end $$;

create or replace function public.throughline_release_retention_claim_v1(
  payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_recording public.throughline_recordings%rowtype;
  v_claim_token uuid;
begin
  if payload is null
    or jsonb_typeof(payload) <> 'object'
    or payload - array['recording_id', 'claim_token'] <> '{}'::jsonb
    or nullif(payload->>'recording_id', '') is null
    or nullif(payload->>'claim_token', '') is null
  then
    raise exception using
      errcode = '22023', message = 'retention_claim_release_invalid';
  end if;
  v_claim_token := (payload->>'claim_token')::uuid;

  select recording.* into v_recording
  from public.throughline_recordings as recording
  where recording.id = payload->>'recording_id'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'recording_not_found';
  end if;
  if v_recording.evaluation_retention_claim_token is distinct from
    v_claim_token
  then
    raise exception using
      errcode = 'P0001', message = 'retention_claim_token_mismatch';
  end if;
  if v_recording.evaluation_retention_finalized_at is not null then
    raise exception using
      errcode = 'P0001', message = 'retention_claim_already_finalized';
  end if;

  update public.throughline_recordings as recording
  set evaluation_retention_claim_token = null,
      evaluation_retention_claimed_at = null,
      evaluation_retention_claim_expires_at = null,
      evaluation_retention_claim_reason = null,
      evaluation_retention_ordinary_cutoff = null,
      evaluation_retention_eligibility_cutoff = null,
      evaluation_retention_finalized_at = null
  where recording.id = v_recording.id
    and recording.evaluation_retention_claim_token = v_claim_token;

  return jsonb_build_object(
    'released', true,
    'idempotent', false
  );
end $$;

create or replace function public.throughline_active_evaluation_eligibility_count_v1()
returns bigint language sql stable security invoker set search_path = '' as $$
  select count(*)::bigint
  from public.throughline_evaluation_contributions as contribution
  where contribution.event_kind = 'created'
    and contribution.notice_version = 'private_evaluation_notice_v1'
    and contribution.disclosure_version =
      'private_evaluation_disclosure_v1'
    and contribution.policy_version = 'private_evaluation_policy_v1'
    and not exists (
      select 1
      from public.throughline_evaluation_contributions as later
      where later.supersedes_contribution_id = contribution.contribution_id
    )
$$;

revoke all on function
  public.throughline_guard_evaluation_contribution_claim_v1()
from public, anon, authenticated;
revoke all on function
  public.throughline_claim_retention_candidates_v1(
    timestamptz, timestamptz, integer, integer
  )
from public, anon, authenticated;
revoke all on function
  public.throughline_finalize_retention_claim_v1(jsonb)
from public, anon, authenticated;
revoke all on function
  public.throughline_release_retention_claim_v1(jsonb)
from public, anon, authenticated;
revoke all on function
  public.throughline_active_evaluation_eligibility_count_v1()
from public, anon, authenticated;

grant execute on function
  public.throughline_guard_evaluation_contribution_claim_v1()
to service_role;
grant execute on function
  public.throughline_claim_retention_candidates_v1(
    timestamptz, timestamptz, integer, integer
  )
to service_role;
grant execute on function
  public.throughline_finalize_retention_claim_v1(jsonb)
to service_role;
grant execute on function
  public.throughline_release_retention_claim_v1(jsonb)
to service_role;
grant execute on function
  public.throughline_active_evaluation_eligibility_count_v1()
to service_role;
