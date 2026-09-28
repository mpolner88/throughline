-- Retention-aware evaluation withdrawal. External Storage and private-artifact
-- deletion must finish before these short, atomic ledger transitions run.

create or replace function public.throughline_retention_candidates_v1(
  ordinary_cutoff timestamptz, eligibility_cutoff timestamptz, max_rows integer
) returns table(recording_id text, candidate_reason text)
language plpgsql security invoker set search_path = '' as $$
begin
  if ordinary_cutoff is null
    or eligibility_cutoff is null
    or max_rows is null
    or max_rows < 1
    or max_rows > 1000
  then
    raise exception using
      errcode = '22023', message = 'retention_batch_limit_invalid';
  end if;

  return query
  select recording.id,
    case
      when exists (
        select 1
        from public.throughline_evaluation_contributions as contribution
        where contribution.recording_id = recording.id
          and contribution.auth_user_id = recording.auth_user_id
          and contribution.event_kind = 'created'
          and contribution.notice_version = 'private_evaluation_notice_v1'
          and contribution.disclosure_version =
            'private_evaluation_disclosure_v1'
          and contribution.policy_version = 'private_evaluation_policy_v1'
          and contribution.created_at >= eligibility_cutoff
          and not exists (
            select 1
            from public.throughline_evaluation_contributions as later
            where later.supersedes_contribution_id =
              contribution.contribution_id
          )
      ) then 'active_current_contribution'
      when exists (
        select 1
        from public.throughline_evaluation_contributions as contribution
        where contribution.recording_id = recording.id
          and contribution.auth_user_id = recording.auth_user_id
          and contribution.event_kind = 'created'
          and contribution.notice_version = 'private_evaluation_notice_v1'
          and contribution.disclosure_version =
            'private_evaluation_disclosure_v1'
          and contribution.policy_version = 'private_evaluation_policy_v1'
          and contribution.created_at < eligibility_cutoff
          and not exists (
            select 1
            from public.throughline_evaluation_contributions as later
            where later.supersedes_contribution_id =
              contribution.contribution_id
          )
      ) then 'eligibility_ended'
      else 'historical_or_no_active_contribution'
    end
  from public.throughline_recordings as recording
  where recording.created_at < ordinary_cutoff
    and coalesce((recording.audio->>'stored')::boolean, false)
    and nullif(recording.audio->>'object_path', '') is not null
  order by recording.created_at, recording.id
  limit max_rows;
end $$;

create or replace function public.throughline_invalidate_evaluation_corpus_v1(
  payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_recording public.throughline_recordings%rowtype;
  v_reason text := payload->>'reason_code';
  v_invalidated_at timestamptz;
  v_invalidated_count integer := 0;
  v_raw_deleted_count integer := 0;
begin
  if payload is null
    or jsonb_typeof(payload) <> 'object'
    or payload - array[
      'recording_id', 'auth_user_id', 'reason_code',
      'raw_artifacts_deleted', 'raw_artifacts_deleted_count',
      'invalidated_at'
    ] <> '{}'::jsonb
    or nullif(payload->>'recording_id', '') is null
    or nullif(payload->>'auth_user_id', '') is null
    or v_reason not in (
      'owner_withdrawal', 'note_deleted', 'account_deleted',
      'eligibility_ended'
    )
    or coalesce((payload->>'raw_artifacts_deleted')::boolean, false) = false
    or coalesce((payload->>'raw_artifacts_deleted_count')::integer, -1) < 0
  then
    raise exception using
      errcode = '22023', message = 'corpus_invalidation_cleanup_required';
  end if;

  v_invalidated_at := coalesce(
    nullif(payload->>'invalidated_at', '')::timestamptz, now()
  );

  select recording.* into v_recording
  from public.throughline_recordings as recording
  where recording.id = payload->>'recording_id'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'recording_not_found';
  end if;
  if v_recording.auth_user_id is distinct from
    (payload->>'auth_user_id')::uuid
  then
    raise exception using errcode = '42501', message = 'recording_owner_mismatch';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('evaluation-corpus:' || v_recording.id, 0)
  );
  perform 1
  from public.throughline_evaluation_corpus_cases as corpus_case
  where corpus_case.recording_id = v_recording.id
  order by corpus_case.case_id
  for update;

  insert into public.throughline_evaluation_corpus_events (
    case_id, event_kind, reason_code, receipt_sha256, created_at
  )
  select corpus_case.case_id, 'invalidated', v_reason,
    encode(extensions.digest(
      corpus_case.case_id::text || ':invalidated:' || v_reason || ':' ||
        v_invalidated_at::text,
      'sha256'
    ), 'hex'),
    v_invalidated_at
  from public.throughline_evaluation_corpus_cases as corpus_case
  where corpus_case.recording_id = v_recording.id
    and not exists (
      select 1
      from public.throughline_evaluation_corpus_events as existing_event
      where existing_event.case_id = corpus_case.case_id
        and existing_event.event_kind = 'invalidated'
    );
  get diagnostics v_invalidated_count = row_count;

  insert into public.throughline_evaluation_corpus_events (
    case_id, event_kind, reason_code, receipt_sha256, created_at
  )
  select corpus_case.case_id, 'raw_artifacts_deleted', v_reason,
    encode(extensions.digest(
      corpus_case.case_id::text || ':raw-artifacts-deleted:' || v_reason ||
        ':' || v_invalidated_at::text,
      'sha256'
    ), 'hex'),
    v_invalidated_at
  from public.throughline_evaluation_corpus_cases as corpus_case
  where corpus_case.recording_id = v_recording.id
    and not exists (
      select 1
      from public.throughline_evaluation_corpus_events as existing_event
      where existing_event.case_id = corpus_case.case_id
        and existing_event.event_kind = 'raw_artifacts_deleted'
    );
  get diagnostics v_raw_deleted_count = row_count;

  return jsonb_build_object(
    'invalidated_case_count', v_invalidated_count,
    'raw_artifact_case_count', v_raw_deleted_count
  );
end $$;

create or replace function public.throughline_remove_contribution_v1(
  payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_recording public.throughline_recordings%rowtype;
  v_contribution public.throughline_evaluation_contributions%rowtype;
  v_existing public.throughline_evaluation_contributions%rowtype;
  v_withdrawal_id uuid := gen_random_uuid();
  v_withdrawn_at timestamptz;
  v_invalidated_count integer := 0;
  v_raw_deleted_count integer := 0;
  v_expired_audio jsonb;
  v_recording_snapshot jsonb;
begin
  if payload is null
    or jsonb_typeof(payload) <> 'object'
    or payload - array[
      'recording_id', 'auth_user_id', 'contribution_id', 'idempotency_key',
      'source_audio_deleted', 'raw_artifacts_deleted',
      'raw_artifacts_deleted_count', 'withdrawn_at'
    ] <> '{}'::jsonb
    or nullif(payload->>'recording_id', '') is null
    or nullif(payload->>'auth_user_id', '') is null
    or nullif(payload->>'contribution_id', '') is null
    or nullif(payload->>'idempotency_key', '') is null
    or coalesce((payload->>'source_audio_deleted')::boolean, false) = false
    or coalesce((payload->>'raw_artifacts_deleted')::boolean, false) = false
    or coalesce((payload->>'raw_artifacts_deleted_count')::integer, -1) < 0
  then
    raise exception using
      errcode = '22023', message = 'evaluation_withdrawal_cleanup_required';
  end if;

  select contribution.* into v_existing
  from public.throughline_evaluation_contributions as contribution
  where contribution.auth_user_id = (payload->>'auth_user_id')::uuid
    and contribution.idempotency_key = (payload->>'idempotency_key')::uuid;
  if found then
    if v_existing.event_kind <> 'withdrawn'
      or v_existing.recording_id <> payload->>'recording_id'
      or v_existing.supersedes_contribution_id is distinct from
        (payload->>'contribution_id')::uuid
    then
      raise exception using errcode = '22023', message = 'idempotency_conflict';
    end if;
    return jsonb_build_object(
      'withdrawn', true,
      'invalidated_case_count', (
        select count(*)::integer
        from public.throughline_evaluation_corpus_cases as corpus_case
        where corpus_case.contribution_id =
          v_existing.supersedes_contribution_id
          and exists (
            select 1
            from public.throughline_evaluation_corpus_events as event
            where event.case_id = corpus_case.case_id
              and event.event_kind = 'invalidated'
          )
      ),
      'idempotent', true
    );
  end if;

  v_withdrawn_at := coalesce(
    nullif(payload->>'withdrawn_at', '')::timestamptz, now()
  );

  select recording.* into v_recording
  from public.throughline_recordings as recording
  where recording.id = payload->>'recording_id'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'recording_not_found';
  end if;
  if v_recording.auth_user_id is distinct from
    (payload->>'auth_user_id')::uuid
  then
    raise exception using errcode = '42501', message = 'recording_owner_mismatch';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('evaluation-corpus:' || v_recording.id, 0)
  );

  select contribution.* into v_contribution
  from public.throughline_evaluation_contributions as contribution
  where contribution.contribution_id = (payload->>'contribution_id')::uuid
    and contribution.recording_id = v_recording.id
    and contribution.auth_user_id = v_recording.auth_user_id
    and contribution.event_kind = 'created'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'contribution_not_found';
  end if;
  if exists (
    select 1
    from public.throughline_evaluation_contributions as later
    where later.supersedes_contribution_id = v_contribution.contribution_id
  ) then
    raise exception using errcode = 'P0001', message = 'contribution_not_active';
  end if;

  perform 1
  from public.throughline_evaluation_corpus_cases as corpus_case
  where corpus_case.contribution_id = v_contribution.contribution_id
  order by corpus_case.case_id
  for update;

  insert into public.throughline_evaluation_corpus_events (
    case_id, event_kind, reason_code, receipt_sha256, created_at
  )
  select corpus_case.case_id, 'invalidated', 'owner_withdrawal',
    encode(extensions.digest(
      corpus_case.case_id::text || ':invalidated:owner-withdrawal:' ||
        v_withdrawal_id::text,
      'sha256'
    ), 'hex'),
    v_withdrawn_at
  from public.throughline_evaluation_corpus_cases as corpus_case
  where corpus_case.contribution_id = v_contribution.contribution_id
    and not exists (
      select 1
      from public.throughline_evaluation_corpus_events as existing_event
      where existing_event.case_id = corpus_case.case_id
        and existing_event.event_kind = 'invalidated'
    );
  get diagnostics v_invalidated_count = row_count;

  insert into public.throughline_evaluation_corpus_events (
    case_id, event_kind, reason_code, receipt_sha256, created_at
  )
  select corpus_case.case_id, 'raw_artifacts_deleted', 'owner_withdrawal',
    encode(extensions.digest(
      corpus_case.case_id::text || ':raw-artifacts-deleted:owner-withdrawal:' ||
        v_withdrawal_id::text,
      'sha256'
    ), 'hex'),
    v_withdrawn_at
  from public.throughline_evaluation_corpus_cases as corpus_case
  where corpus_case.contribution_id = v_contribution.contribution_id
    and not exists (
      select 1
      from public.throughline_evaluation_corpus_events as existing_event
      where existing_event.case_id = corpus_case.case_id
        and existing_event.event_kind = 'raw_artifacts_deleted'
    );
  get diagnostics v_raw_deleted_count = row_count;

  insert into public.throughline_evaluation_contributions (
    contribution_id, recording_id, auth_user_id, note_revision_id,
    supersedes_contribution_id, idempotency_key, event_kind,
    eligibility_source, notice_version, disclosure_version, policy_version,
    created_at
  ) values (
    v_withdrawal_id, v_contribution.recording_id,
    v_contribution.auth_user_id, v_contribution.note_revision_id,
    v_contribution.contribution_id, (payload->>'idempotency_key')::uuid,
    'withdrawn', null, 'private_evaluation_notice_v1',
    'private_evaluation_disclosure_v1', 'private_evaluation_policy_v1',
    v_withdrawn_at
  );

  v_expired_audio := jsonb_strip_nulls(jsonb_build_object(
    'stored', false,
    'storage', 'expired',
    'bucket', coalesce(v_recording.audio->>'bucket', 'throughline-audio'),
    'mime_type', v_recording.audio->>'mime_type',
    'bytes', v_recording.audio->'bytes',
    'expired_at', v_withdrawn_at,
    'retention_reason', 'evaluation_withdrawal'
  ));
  v_recording_snapshot := coalesce(v_recording.recording, '{}'::jsonb)
    || jsonb_build_object(
      'audio', v_expired_audio,
      'audio_retention', jsonb_build_object(
        'status', 'expired',
        'expired_at', v_withdrawn_at,
        'reason', 'evaluation_withdrawal'
      )
    );
  update public.throughline_recordings
  set audio = v_expired_audio,
      recording = v_recording_snapshot
  where id = v_recording.id;

  return jsonb_build_object(
    'withdrawn', true,
    'invalidated_case_count', v_invalidated_count,
    'raw_artifact_case_count', v_raw_deleted_count,
    'idempotent', false
  );
end $$;

revoke all on function public.throughline_remove_contribution_v1(jsonb)
  from public, anon, authenticated;
revoke all on function public.throughline_invalidate_evaluation_corpus_v1(jsonb)
  from public, anon, authenticated;
revoke all on function public.throughline_retention_candidates_v1(
  timestamptz, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.throughline_remove_contribution_v1(jsonb)
  to service_role;
grant execute on function public.throughline_invalidate_evaluation_corpus_v1(jsonb)
  to service_role;
grant execute on function public.throughline_retention_candidates_v1(
  timestamptz, timestamptz, integer
) to service_role;
