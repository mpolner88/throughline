-- Additive, service-only lineage foundation. Runtime writes stay fail-closed
-- until the compatibility API is wired in the following implementation task.

create or replace function public.throughline_is_sha256(value text)
returns boolean language sql immutable set search_path = ''
as $$ select value ~ '^[0-9a-f]{64}$' $$;

create table public.throughline_inference_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_sha256 text not null unique check (public.throughline_is_sha256(contract_sha256)),
  contract_version text not null,
  provider text not null,
  transcription_model text not null,
  extraction_model text not null,
  prompt_sha256 text not null check (public.throughline_is_sha256(prompt_sha256)),
  schema_sha256 text not null check (public.throughline_is_sha256(schema_sha256)),
  normalizer_sha256 text not null check (public.throughline_is_sha256(normalizer_sha256)),
  canonical_keyset_sha256 text not null check (public.throughline_is_sha256(canonical_keyset_sha256)),
  contract_snapshot jsonb not null check (jsonb_typeof(contract_snapshot) = 'object'),
  created_at timestamptz not null default now()
);

create table public.throughline_processing_operations (
  operation_id uuid primary key,
  recording_id text not null references public.throughline_recordings (id) on delete cascade,
  inference_contract_id uuid not null references public.throughline_inference_contracts (id) on delete restrict,
  status text not null check (status in ('started', 'succeeded', 'failed')),
  safe_failure_code text check (safe_failure_code is null or safe_failure_code in (
    'configuration_missing', 'input_missing', 'timeout', 'rate_limited',
    'provider_http', 'provider_response_invalid', 'storage_failed', 'unknown'
  )),
  started_at timestamptz not null,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'started' and finished_at is null and safe_failure_code is null)
    or (status = 'succeeded' and finished_at is not null and safe_failure_code is null)
    or (status = 'failed' and finished_at is not null and safe_failure_code is not null)
  ),
  check (finished_at is null or finished_at >= started_at)
);
create index throughline_processing_operations_recording_id_idx
  on public.throughline_processing_operations (recording_id);
create index throughline_processing_operations_inference_contract_id_idx
  on public.throughline_processing_operations (inference_contract_id);

create table public.throughline_inference_attempts (
  attempt_id uuid primary key,
  operation_id uuid not null references public.throughline_processing_operations (operation_id) on delete cascade,
  recording_id text not null references public.throughline_recordings (id) on delete cascade,
  stage text not null check (stage in ('transcription', 'extraction')),
  attempt_number integer not null check (attempt_number > 0),
  status text not null check (status in ('succeeded', 'failed')),
  safe_failure_code text check (safe_failure_code is null or safe_failure_code in (
    'configuration_missing', 'input_missing', 'timeout', 'rate_limited',
    'provider_http', 'provider_response_invalid', 'storage_failed', 'unknown'
  )),
  input_sha256 text check (input_sha256 is null or public.throughline_is_sha256(input_sha256)),
  output_sha256 text check (output_sha256 is null or public.throughline_is_sha256(output_sha256)),
  private_input_snapshot jsonb check (private_input_snapshot is null or jsonb_typeof(private_input_snapshot) = 'object'),
  private_output_snapshot jsonb check (private_output_snapshot is null or jsonb_typeof(private_output_snapshot) = 'object'),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  usage_snapshot jsonb check (usage_snapshot is null or jsonb_typeof(usage_snapshot) = 'object'),
  cost_microunits bigint check (cost_microunits is null or cost_microunits >= 0),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (operation_id, stage, attempt_number),
  check ((status = 'succeeded' and safe_failure_code is null)
    or (status = 'failed' and safe_failure_code is not null)),
  check (finished_at >= started_at)
);
create index throughline_inference_attempts_operation_id_idx
  on public.throughline_inference_attempts (operation_id);
create index throughline_inference_attempts_recording_id_idx
  on public.throughline_inference_attempts (recording_id);
create index throughline_inference_attempts_recording_stage_idx
  on public.throughline_inference_attempts (recording_id, stage, attempt_number desc);

create table public.throughline_note_revisions (
  revision_id uuid primary key,
  recording_id text not null references public.throughline_recordings (id) on delete cascade,
  processing_operation_id uuid references public.throughline_processing_operations (operation_id) on delete cascade,
  base_revision_id uuid references public.throughline_note_revisions (revision_id) on delete set null,
  revision_kind text not null check (revision_kind in ('original_model', 'user_content_correction', 'action_state')),
  canonical_snapshot jsonb not null check (jsonb_typeof(canonical_snapshot) = 'object'),
  canonical_output_sha256 text not null check (public.throughline_is_sha256(canonical_output_sha256)),
  production_schema_sha256 text not null check (public.throughline_is_sha256(production_schema_sha256)),
  production_normalizer_sha256 text not null check (public.throughline_is_sha256(production_normalizer_sha256)),
  canonical_keyset_sha256 text not null check (public.throughline_is_sha256(canonical_keyset_sha256)),
  editable_correction_mask text[] not null default '{}',
  transcript_explicitly_corrected boolean not null default false,
  created_at timestamptz not null default now(),
  check (revision_kind <> 'original_model' or processing_operation_id is not null),
  check (editable_correction_mask <@ array['title', 'summary', 'most_important', 'todos']::text[])
);
create index throughline_note_revisions_recording_id_idx
  on public.throughline_note_revisions (recording_id);
create index throughline_note_revisions_processing_operation_id_idx
  on public.throughline_note_revisions (processing_operation_id) where processing_operation_id is not null;
create index throughline_note_revisions_base_revision_id_idx
  on public.throughline_note_revisions (base_revision_id) where base_revision_id is not null;

create table public.throughline_evaluations (
  evaluation_id uuid primary key,
  recording_id text not null references public.throughline_recordings (id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  processing_operation_id uuid not null references public.throughline_processing_operations (operation_id) on delete cascade,
  evaluated_revision_id uuid not null references public.throughline_note_revisions (revision_id) on delete cascade,
  idempotency_key uuid not null,
  evaluator_kind text not null check (evaluator_kind = 'recording_user'),
  rubric_version text not null,
  notice_version text not null check (notice_version = 'private_evaluation_notice_v1'),
  disclosure_version text not null check (disclosure_version = 'private_evaluation_disclosure_v1'),
  score smallint not null check (score between 1 and 5),
  issue_codes text[] not null default '{}',
  agent_ready boolean not null default false,
  agent_readiness_preview jsonb check (agent_readiness_preview is null or jsonb_typeof(agent_readiness_preview) = 'object'),
  created_at timestamptz not null default now(),
  unique (auth_user_id, idempotency_key),
  check (issue_codes <@ array[
    'missed_action', 'unsupported_action', 'wrong_importance', 'meaning_changed',
    'weak_summary', 'transcription_error', 'schema_invalid', 'other_structured'
  ]::text[]),
  check ((agent_ready and agent_readiness_preview is not null)
    or (not agent_ready and agent_readiness_preview is null))
);
create index throughline_evaluations_recording_id_idx on public.throughline_evaluations (recording_id);
create index throughline_evaluations_auth_user_id_idx on public.throughline_evaluations (auth_user_id);
create index throughline_evaluations_processing_operation_id_idx on public.throughline_evaluations (processing_operation_id);
create index throughline_evaluations_evaluated_revision_id_idx on public.throughline_evaluations (evaluated_revision_id);

create table public.throughline_evaluation_contributions (
  contribution_id uuid primary key,
  recording_id text not null references public.throughline_recordings (id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  evaluation_id uuid references public.throughline_evaluations (evaluation_id) on delete cascade,
  note_revision_id uuid not null references public.throughline_note_revisions (revision_id) on delete cascade,
  supersedes_contribution_id uuid references public.throughline_evaluation_contributions (contribution_id) on delete set null,
  idempotency_key uuid not null,
  event_kind text not null check (event_kind in ('created', 'withdrawn')),
  eligibility_source text check (eligibility_source is null or eligibility_source in ('explicit_grade', 'content_correction')),
  notice_version text not null check (notice_version = 'private_evaluation_notice_v1'),
  disclosure_version text not null check (disclosure_version = 'private_evaluation_disclosure_v1'),
  policy_version text not null,
  created_at timestamptz not null default now(),
  unique (auth_user_id, idempotency_key),
  check ((event_kind = 'created' and eligibility_source is not null)
    or (event_kind = 'withdrawn' and eligibility_source is null and supersedes_contribution_id is not null))
);
create index throughline_evaluation_contributions_recording_id_idx on public.throughline_evaluation_contributions (recording_id);
create index throughline_evaluation_contributions_auth_user_id_idx on public.throughline_evaluation_contributions (auth_user_id);
create index throughline_evaluation_contributions_evaluation_id_idx
  on public.throughline_evaluation_contributions (evaluation_id) where evaluation_id is not null;
create index throughline_evaluation_contributions_note_revision_id_idx
  on public.throughline_evaluation_contributions (note_revision_id);
create index throughline_evaluation_contributions_supersedes_idx
  on public.throughline_evaluation_contributions (supersedes_contribution_id)
  where supersedes_contribution_id is not null;

create table public.throughline_evaluation_text_quarantine (
  quarantine_id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null unique references public.throughline_evaluations (evaluation_id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  explanation text not null check (char_length(explanation) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index throughline_evaluation_text_quarantine_auth_user_id_idx
  on public.throughline_evaluation_text_quarantine (auth_user_id);

create table public.throughline_evaluation_artifact_receipts (
  materializer_receipt_sha256 text primary key
    check (public.throughline_is_sha256(materializer_receipt_sha256)),
  state text not null check (
    state in ('pending', 'deleting', 'committed', 'deleted')
  ),
  reserved_at timestamptz not null default statement_timestamp(),
  cleanup_claim_token uuid,
  cleanup_claimed_at timestamptz,
  cleanup_claim_expires_at timestamptz,
  committed_at timestamptz,
  deleted_at timestamptz,
  committed_case_count integer check (
    committed_case_count is null or committed_case_count > 0
  ),
  check (
    (state = 'pending' and cleanup_claim_token is null
      and cleanup_claimed_at is null and cleanup_claim_expires_at is null
      and committed_at is null and deleted_at is null
      and committed_case_count is null)
    or (state = 'deleting' and cleanup_claim_token is not null
      and cleanup_claimed_at is not null and cleanup_claim_expires_at is not null
      and cleanup_claim_expires_at > cleanup_claimed_at
      and committed_at is null and deleted_at is null
      and committed_case_count is null)
    or (state = 'committed' and cleanup_claim_token is null
      and cleanup_claimed_at is null and cleanup_claim_expires_at is null
      and committed_at is not null and deleted_at is null
      and committed_case_count is not null)
    or (state = 'deleted' and cleanup_claim_token is not null
      and cleanup_claimed_at is not null and cleanup_claim_expires_at is not null
      and committed_at is null and deleted_at is not null
      and committed_case_count is null)
  )
);
create index throughline_evaluation_artifact_receipts_pending_idx
  on public.throughline_evaluation_artifact_receipts (
    reserved_at, materializer_receipt_sha256
  ) where state = 'pending';
create index throughline_evaluation_artifact_receipts_cleanup_expiry_idx
  on public.throughline_evaluation_artifact_receipts (
    cleanup_claim_expires_at, materializer_receipt_sha256
  ) where state = 'deleting';

create table public.throughline_evaluation_corpus_cases (
  case_id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null unique references public.throughline_evaluation_contributions (contribution_id) on delete cascade,
  recording_id text not null references public.throughline_recordings (id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  evaluated_revision_id uuid not null references public.throughline_note_revisions (revision_id) on delete cascade,
  disclosure_version text not null check (disclosure_version = 'private_evaluation_disclosure_v1'),
  policy_version text not null,
  stable_split text not null check (stable_split in ('development', 'sealed_holdout')),
  label_kind text not null check (label_kind in ('diagnostic_grade', 'reviewed_fields', 'accepted_full_output')),
  label_completeness text not null check (label_completeness in ('diagnostic_only', 'reviewed_fields_only', 'complete_structured_output')),
  editable_correction_mask text[] not null default '{}',
  transcript_explicitly_corrected boolean not null default false,
  readiness_preview_sha256 text check (readiness_preview_sha256 is null or public.throughline_is_sha256(readiness_preview_sha256)),
  canonical_output_sha256 text check (canonical_output_sha256 is null or public.throughline_is_sha256(canonical_output_sha256)),
  production_schema_sha256 text not null check (public.throughline_is_sha256(production_schema_sha256)),
  production_normalizer_sha256 text not null check (public.throughline_is_sha256(production_normalizer_sha256)),
  canonical_keyset_sha256 text not null check (public.throughline_is_sha256(canonical_keyset_sha256)),
  audio_sha256 text not null check (public.throughline_is_sha256(audio_sha256)),
  reviewed_fields_sha256 text check (reviewed_fields_sha256 is null or public.throughline_is_sha256(reviewed_fields_sha256)),
  transcript_sha256 text check (transcript_sha256 is null or public.throughline_is_sha256(transcript_sha256)),
  label_provenance_sha256 text not null check (public.throughline_is_sha256(label_provenance_sha256)),
  materializer_receipt_sha256 text not null check (public.throughline_is_sha256(materializer_receipt_sha256)),
  materialized_at timestamptz not null default now(),
  check (editable_correction_mask <@ array['title', 'summary', 'most_important', 'todos']::text[]),
  check (
    (label_kind = 'diagnostic_grade' and label_completeness = 'diagnostic_only'
      and cardinality(editable_correction_mask) = 0 and reviewed_fields_sha256 is null
      and canonical_output_sha256 is null and readiness_preview_sha256 is null)
    or (label_kind = 'reviewed_fields' and label_completeness = 'reviewed_fields_only'
      and (cardinality(editable_correction_mask) > 0 or transcript_explicitly_corrected)
      and canonical_output_sha256 is null and readiness_preview_sha256 is null)
    or (label_kind = 'accepted_full_output' and label_completeness = 'complete_structured_output'
      and canonical_output_sha256 is not null and readiness_preview_sha256 is not null)
  ),
  check ((transcript_explicitly_corrected and transcript_sha256 is not null)
    or (not transcript_explicitly_corrected and transcript_sha256 is null))
);
create index throughline_evaluation_corpus_cases_contribution_id_idx on public.throughline_evaluation_corpus_cases (contribution_id);
create index throughline_evaluation_corpus_cases_recording_id_idx on public.throughline_evaluation_corpus_cases (recording_id);
create index throughline_evaluation_corpus_cases_auth_user_id_idx on public.throughline_evaluation_corpus_cases (auth_user_id);
create index throughline_evaluation_corpus_cases_evaluated_revision_id_idx on public.throughline_evaluation_corpus_cases (evaluated_revision_id);
create index throughline_evaluation_corpus_cases_materializer_receipt_idx
  on public.throughline_evaluation_corpus_cases (materializer_receipt_sha256);

create table public.throughline_evaluation_corpus_events (
  event_id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.throughline_evaluation_corpus_cases (case_id) on delete cascade,
  event_kind text not null check (event_kind in ('materialized', 'revalidated', 'invalidated', 'raw_artifacts_deleted')),
  reason_code text,
  prediction_bundle_sha256 text check (prediction_bundle_sha256 is null or public.throughline_is_sha256(prediction_bundle_sha256)),
  active_content_set_sha256 text check (active_content_set_sha256 is null or public.throughline_is_sha256(active_content_set_sha256)),
  active_label_contract_set_sha256 text check (active_label_contract_set_sha256 is null or public.throughline_is_sha256(active_label_contract_set_sha256)),
  receipt_sha256 text not null check (public.throughline_is_sha256(receipt_sha256)),
  created_at timestamptz not null default now()
);
create index throughline_evaluation_corpus_events_case_id_idx
  on public.throughline_evaluation_corpus_events (case_id);

alter table public.throughline_recordings
  add column current_processing_operation_id uuid,
  add column current_transcription_attempt_id uuid,
  add column current_extraction_attempt_id uuid,
  add column current_note_revision_id uuid;
alter table public.throughline_recordings
  add constraint throughline_recordings_current_processing_operation_id_fkey
    foreign key (current_processing_operation_id) references public.throughline_processing_operations (operation_id)
    on delete set null deferrable initially deferred,
  add constraint throughline_recordings_current_transcription_attempt_id_fkey
    foreign key (current_transcription_attempt_id) references public.throughline_inference_attempts (attempt_id)
    on delete set null deferrable initially deferred,
  add constraint throughline_recordings_current_extraction_attempt_id_fkey
    foreign key (current_extraction_attempt_id) references public.throughline_inference_attempts (attempt_id)
    on delete set null deferrable initially deferred,
  add constraint throughline_recordings_current_note_revision_id_fkey
    foreign key (current_note_revision_id) references public.throughline_note_revisions (revision_id)
    on delete set null deferrable initially deferred;
create index throughline_recordings_current_processing_operation_id_idx
  on public.throughline_recordings (current_processing_operation_id) where current_processing_operation_id is not null;
create index throughline_recordings_current_transcription_attempt_id_idx
  on public.throughline_recordings (current_transcription_attempt_id) where current_transcription_attempt_id is not null;
create index throughline_recordings_current_extraction_attempt_id_idx
  on public.throughline_recordings (current_extraction_attempt_id) where current_extraction_attempt_id is not null;
create index throughline_recordings_current_note_revision_id_idx
  on public.throughline_recordings (current_note_revision_id) where current_note_revision_id is not null;

create or replace function public.throughline_reject_immutable_row()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Parent recording/account cascades run inside a referential trigger and
  -- remain available for privacy deletion; direct ledger deletion does not.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise sqlstate 'P0001' using message = 'immutable_row';
end $$;

create trigger throughline_inference_contracts_immutable before update or delete on public.throughline_inference_contracts
  for each row execute function public.throughline_reject_immutable_row();
create trigger throughline_processing_operations_immutable before update or delete on public.throughline_processing_operations
  for each row execute function public.throughline_reject_immutable_row();
create trigger throughline_inference_attempts_immutable before update or delete on public.throughline_inference_attempts
  for each row execute function public.throughline_reject_immutable_row();
create trigger throughline_note_revisions_immutable before update or delete on public.throughline_note_revisions
  for each row execute function public.throughline_reject_immutable_row();
create trigger throughline_evaluations_immutable before update or delete on public.throughline_evaluations
  for each row execute function public.throughline_reject_immutable_row();
create trigger throughline_evaluation_contributions_immutable before update or delete on public.throughline_evaluation_contributions
  for each row execute function public.throughline_reject_immutable_row();
create trigger throughline_evaluation_corpus_cases_immutable before update or delete on public.throughline_evaluation_corpus_cases
  for each row execute function public.throughline_reject_immutable_row();
create trigger throughline_evaluation_corpus_events_immutable before update or delete on public.throughline_evaluation_corpus_events
  for each row execute function public.throughline_reject_immutable_row();

create or replace function
  public.throughline_reserve_evaluation_artifact_receipt_v1(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_receipt_sha256 text;
  v_state text;
  v_inserted integer;
begin
  if payload is null
    or jsonb_typeof(payload) <> 'object'
    or payload - array['materializer_receipt_sha256'] <> '{}'::jsonb
  then
    raise exception using
      errcode = '22023', message = 'artifact_receipt_reservation_invalid';
  end if;
  v_receipt_sha256 := payload->>'materializer_receipt_sha256';
  if not public.throughline_is_sha256(v_receipt_sha256) then
    raise exception using
      errcode = '22023', message = 'artifact_receipt_reservation_invalid';
  end if;

  insert into public.throughline_evaluation_artifact_receipts (
    materializer_receipt_sha256, state
  ) values (v_receipt_sha256, 'pending')
  on conflict (materializer_receipt_sha256) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    return jsonb_build_object('state', 'pending', 'idempotent', false);
  end if;

  select receipt.state into strict v_state
  from public.throughline_evaluation_artifact_receipts as receipt
  where receipt.materializer_receipt_sha256 = v_receipt_sha256
  for update;
  if v_state <> 'pending' then
    raise exception using errcode = 'P0001', message = 'artifact_receipt_terminal';
  end if;
  return jsonb_build_object('state', 'pending', 'idempotent', true);
end $$;

create or replace function
  public.throughline_claim_stale_evaluation_artifact_receipts_v1(
    stale_before timestamptz,
    max_rows integer,
    claim_ttl_seconds integer
  ) returns table(
    materializer_receipt_sha256 text,
    cleanup_claim_token uuid,
    cleanup_claim_expires_at timestamptz
  )
language plpgsql security definer set search_path = '' as $$
declare
  v_claimed_at timestamptz := statement_timestamp();
begin
  if stale_before is null
    or max_rows is null
    or max_rows < 1
    or max_rows > 1000
    or claim_ttl_seconds is null
    or claim_ttl_seconds < 30
    or claim_ttl_seconds > 3600
  then
    raise exception using
      errcode = '22023', message = 'artifact_receipt_claim_invalid';
  end if;
  return query
  with claimable as (
    select receipt.materializer_receipt_sha256
    from public.throughline_evaluation_artifact_receipts as receipt
    where (
      receipt.state = 'pending'
      and receipt.reserved_at < stale_before
    ) or (
      receipt.state = 'deleting'
      and receipt.cleanup_claim_expires_at <= v_claimed_at
    )
    order by
      case when receipt.state = 'pending'
        then receipt.reserved_at
        else receipt.cleanup_claim_expires_at
      end,
      receipt.materializer_receipt_sha256
    limit max_rows
    for update of receipt skip locked
  ), claimed as (
    update public.throughline_evaluation_artifact_receipts as receipt
    set state = 'deleting',
        cleanup_claim_token = gen_random_uuid(),
        cleanup_claimed_at = v_claimed_at,
        cleanup_claim_expires_at = v_claimed_at +
          make_interval(secs => claim_ttl_seconds)
    from claimable
    where receipt.materializer_receipt_sha256 =
      claimable.materializer_receipt_sha256
    returning
      receipt.materializer_receipt_sha256,
      receipt.cleanup_claim_token,
      receipt.cleanup_claim_expires_at
  )
  select
    claimed.materializer_receipt_sha256,
    claimed.cleanup_claim_token,
    claimed.cleanup_claim_expires_at
  from claimed
  order by claimed.materializer_receipt_sha256;
end $$;

create or replace function
  public.throughline_acknowledge_evaluation_artifact_deletion_v1(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_receipt_sha256 text;
  v_state text;
  v_claim_token uuid;
  v_registered_claim_token uuid;
  v_claim_expires_at timestamptz;
  v_deletion_status text;
  v_deleted_count integer;
begin
  if payload is null
    or jsonb_typeof(payload) <> 'object'
    or payload - array[
      'materializer_receipt_sha256', 'cleanup_claim_token',
      'deletion_status', 'deleted_count'
    ] <> '{}'::jsonb
  then
    raise exception using
      errcode = '22023', message = 'artifact_deletion_proof_invalid';
  end if;
  v_receipt_sha256 := payload->>'materializer_receipt_sha256';
  v_deletion_status := payload->>'deletion_status';
  begin
    v_claim_token := (payload->>'cleanup_claim_token')::uuid;
    v_deleted_count := (payload->>'deleted_count')::integer;
  exception when others then
    raise exception using
      errcode = '22023', message = 'artifact_deletion_proof_invalid';
  end;
  if not public.throughline_is_sha256(v_receipt_sha256)
    or v_claim_token is null
    or v_deletion_status not in ('deleted', 'not_found')
    or v_deleted_count < 0
    or (v_deletion_status = 'not_found' and v_deleted_count <> 0)
  then
    raise exception using
      errcode = '22023', message = 'artifact_deletion_proof_invalid';
  end if;

  select
    receipt.state,
    receipt.cleanup_claim_token,
    receipt.cleanup_claim_expires_at
  into v_state, v_registered_claim_token, v_claim_expires_at
  from public.throughline_evaluation_artifact_receipts as receipt
  where receipt.materializer_receipt_sha256 = v_receipt_sha256
  for update;
  if not found then
    raise exception using
      errcode = 'P0002', message = 'artifact_receipt_not_found';
  end if;
  if v_registered_claim_token is distinct from v_claim_token then
    raise exception using
      errcode = 'P0001', message = 'artifact_cleanup_claim_mismatch';
  end if;
  if v_state = 'deleted' then
    return jsonb_build_object('state', 'deleted', 'idempotent', true);
  end if;
  if v_state <> 'deleting'
    or v_claim_expires_at <= statement_timestamp()
  then
    raise exception using
      errcode = 'P0001', message = 'artifact_cleanup_claim_mismatch';
  end if;

  update public.throughline_evaluation_artifact_receipts as receipt
  set state = 'deleted', deleted_at = statement_timestamp()
  where receipt.materializer_receipt_sha256 = v_receipt_sha256
    and receipt.state = 'deleting'
    and receipt.cleanup_claim_token = v_claim_token;
  return jsonb_build_object('state', 'deleted', 'idempotent', false);
end $$;

create or replace function
  public.throughline_release_evaluation_artifact_cleanup_claim_v1(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_receipt_sha256 text;
  v_claim_token uuid;
  v_state text;
  v_registered_claim_token uuid;
begin
  if payload is null
    or jsonb_typeof(payload) <> 'object'
    or payload - array[
      'materializer_receipt_sha256', 'cleanup_claim_token'
    ] <> '{}'::jsonb
  then
    raise exception using
      errcode = '22023', message = 'artifact_cleanup_release_invalid';
  end if;
  v_receipt_sha256 := payload->>'materializer_receipt_sha256';
  begin
    v_claim_token := (payload->>'cleanup_claim_token')::uuid;
  exception when others then
    raise exception using
      errcode = '22023', message = 'artifact_cleanup_release_invalid';
  end;
  if not public.throughline_is_sha256(v_receipt_sha256)
    or v_claim_token is null
  then
    raise exception using
      errcode = '22023', message = 'artifact_cleanup_release_invalid';
  end if;

  select receipt.state, receipt.cleanup_claim_token
  into v_state, v_registered_claim_token
  from public.throughline_evaluation_artifact_receipts as receipt
  where receipt.materializer_receipt_sha256 = v_receipt_sha256
  for update;
  if not found then
    raise exception using
      errcode = 'P0002', message = 'artifact_receipt_not_found';
  end if;
  if v_state <> 'deleting'
    or v_registered_claim_token is distinct from v_claim_token
  then
    raise exception using
      errcode = 'P0001', message = 'artifact_cleanup_claim_mismatch';
  end if;

  update public.throughline_evaluation_artifact_receipts as receipt
  set state = 'pending',
      cleanup_claim_token = null,
      cleanup_claimed_at = null,
      cleanup_claim_expires_at = null
  where receipt.materializer_receipt_sha256 = v_receipt_sha256
    and receipt.state = 'deleting'
    and receipt.cleanup_claim_token = v_claim_token;
  return jsonb_build_object('state', 'pending', 'idempotent', false);
end $$;

create or replace function public.throughline_commit_processing_v1(payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  contract_payload jsonb := payload->'contract';
  operation_payload jsonb := payload->'operation';
  revision_payload jsonb := nullif(payload->'original_revision', 'null'::jsonb);
  attempt_payload jsonb;
  v_contract_id uuid;
  v_operation_id uuid;
  v_recording_id text;
  v_revision_id uuid;
  v_transcription_attempt_id uuid;
  v_extraction_attempt_id uuid;
begin
  if jsonb_typeof(payload) <> 'object'
    or jsonb_typeof(contract_payload) <> 'object'
    or jsonb_typeof(operation_payload) <> 'object'
    or jsonb_typeof(payload->'attempts') <> 'array'
  then
    raise exception using errcode = '22023', message = 'processing_payload_invalid';
  end if;

  v_operation_id := (operation_payload->>'operation_id')::uuid;
  v_recording_id := operation_payload->>'recording_id';
  perform 1
  from public.throughline_recordings as recording
  where recording.id = v_recording_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'recording_not_found';
  end if;

  if exists (
    select 1 from public.throughline_processing_operations as operation
    where operation.operation_id = v_operation_id
  ) then
    return jsonb_build_object(
      'operation_id', v_operation_id,
      'idempotent', true
    );
  end if;

  insert into public.throughline_inference_contracts (
    id, contract_sha256, contract_version, provider, transcription_model,
    extraction_model, prompt_sha256, schema_sha256, normalizer_sha256,
    canonical_keyset_sha256, contract_snapshot
  ) values (
    (contract_payload->>'id')::uuid,
    contract_payload->>'contract_sha256',
    contract_payload->>'contract_version',
    contract_payload->'provider'->>'name',
    contract_payload->'transcription'->>'model',
    contract_payload->'extraction'->>'model',
    contract_payload->'prompt'->>'sha256',
    contract_payload->'schema'->>'sha256',
    contract_payload->'normalizer'->>'sha256',
    contract_payload->'schema'->>'keyset_sha256',
    contract_payload - 'id'
  )
  on conflict (contract_sha256) do nothing;

  select contract.id into strict v_contract_id
  from public.throughline_inference_contracts as contract
  where contract.contract_sha256 = contract_payload->>'contract_sha256';

  if operation_payload->>'status' = 'succeeded' and revision_payload is null then
    raise exception using errcode = '22023', message = 'successful_operation_requires_revision';
  end if;
  if operation_payload->>'status' = 'failed' and revision_payload is not null then
    raise exception using errcode = '22023', message = 'failed_operation_rejects_revision';
  end if;

  insert into public.throughline_processing_operations (
    operation_id, recording_id, inference_contract_id, status,
    safe_failure_code, started_at, finished_at
  ) values (
    v_operation_id,
    v_recording_id,
    v_contract_id,
    operation_payload->>'status',
    operation_payload->>'safe_failure_code',
    (operation_payload->>'started_at')::timestamptz,
    (operation_payload->>'finished_at')::timestamptz
  );

  for attempt_payload in
    select value from jsonb_array_elements(payload->'attempts')
  loop
    if (attempt_payload->>'operation_id')::uuid <> v_operation_id
      or attempt_payload->>'recording_id' <> v_recording_id
    then
      raise exception using errcode = '22023', message = 'attempt_lineage_mismatch';
    end if;
    insert into public.throughline_inference_attempts (
      attempt_id, operation_id, recording_id, stage, attempt_number, status,
      safe_failure_code, input_sha256, output_sha256, private_input_snapshot,
      private_output_snapshot, latency_ms, usage_snapshot, cost_microunits,
      started_at, finished_at
    ) values (
      (attempt_payload->>'attempt_id')::uuid,
      v_operation_id,
      v_recording_id,
      attempt_payload->>'stage',
      (attempt_payload->>'attempt_number')::integer,
      attempt_payload->>'status',
      attempt_payload->>'safe_failure_code',
      attempt_payload->>'input_sha256',
      attempt_payload->>'output_sha256',
      attempt_payload->'private_input_snapshot',
      nullif(attempt_payload->'private_output_snapshot', 'null'::jsonb),
      (attempt_payload->>'latency_ms')::integer,
      nullif(attempt_payload->'usage_snapshot', 'null'::jsonb),
      (attempt_payload->>'cost_microunits')::bigint,
      (attempt_payload->>'started_at')::timestamptz,
      (attempt_payload->>'finished_at')::timestamptz
    );
  end loop;

  select attempt.attempt_id into v_transcription_attempt_id
  from public.throughline_inference_attempts as attempt
  where attempt.operation_id = v_operation_id
    and attempt.stage = 'transcription'
  order by attempt.attempt_number desc
  limit 1;
  select attempt.attempt_id into v_extraction_attempt_id
  from public.throughline_inference_attempts as attempt
  where attempt.operation_id = v_operation_id
    and attempt.stage = 'extraction'
  order by attempt.attempt_number desc
  limit 1;

  if revision_payload is not null then
    if (revision_payload->>'processing_operation_id')::uuid <> v_operation_id
      or revision_payload->>'recording_id' <> v_recording_id
      or revision_payload->>'revision_kind' <> 'original_model'
      or revision_payload->>'production_schema_sha256' <> contract_payload->'schema'->>'sha256'
      or revision_payload->>'production_normalizer_sha256' <> contract_payload->'normalizer'->>'sha256'
      or revision_payload->>'canonical_keyset_sha256' <> contract_payload->'schema'->>'keyset_sha256'
      or jsonb_typeof(revision_payload->'canonical_output') <> 'object'
      or not (revision_payload->'canonical_output' ?& array[
        'type', 'title', 'summary', 'most_important', 'todos', 'priorities',
        'intentions', 'accomplishments', 'tomorrow_todos', 'mood', 'people',
        'projects', 'tags', 'centers_of_balance'
      ])
      or (
        select count(*) from jsonb_object_keys(revision_payload->'canonical_output')
      ) <> 14
    then
      raise exception using errcode = '22023', message = 'original_revision_contract_invalid';
    end if;
    v_revision_id := (revision_payload->>'revision_id')::uuid;
    insert into public.throughline_note_revisions (
      revision_id, recording_id, processing_operation_id, revision_kind,
      canonical_snapshot, canonical_output_sha256, production_schema_sha256,
      production_normalizer_sha256, canonical_keyset_sha256, created_at
    ) values (
      v_revision_id,
      v_recording_id,
      v_operation_id,
      'original_model',
      revision_payload->'canonical_output',
      revision_payload->>'canonical_output_sha256',
      revision_payload->>'production_schema_sha256',
      revision_payload->>'production_normalizer_sha256',
      revision_payload->>'canonical_keyset_sha256',
      (revision_payload->>'created_at')::timestamptz
    );
  end if;

  update public.throughline_recordings as recording
  set current_processing_operation_id = v_operation_id,
      current_transcription_attempt_id = coalesce(
        v_transcription_attempt_id, recording.current_transcription_attempt_id
      ),
      current_extraction_attempt_id = coalesce(
        v_extraction_attempt_id, recording.current_extraction_attempt_id
      ),
      current_note_revision_id = coalesce(
        v_revision_id, recording.current_note_revision_id
      )
  where recording.id = v_recording_id;

  return jsonb_build_object(
    'operation_id', v_operation_id,
    'current_transcription_attempt_id', v_transcription_attempt_id,
    'current_extraction_attempt_id', v_extraction_attempt_id,
    'current_note_revision_id', v_revision_id,
    'idempotent', false
  );
end $$;

-- Later evaluation/retention entry points remain fail-closed until their
-- runtime tasks are implemented.
create or replace function public.throughline_commit_user_mutation_v1(payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_recording public.throughline_recordings%rowtype;
  v_base public.throughline_note_revisions%rowtype;
  v_revision jsonb := payload->'revision';
  v_contribution jsonb := payload->'contribution';
  v_revision_id uuid;
  v_existing_contribution_id uuid;
  v_existing_revision public.throughline_note_revisions%rowtype;
begin
  if payload is null
    or jsonb_typeof(payload) <> 'object'
    or nullif(payload->>'recording_id', '') is null
    or nullif(payload->>'auth_user_id', '') is null
    or nullif(payload->>'idempotency_key', '') is null
    or nullif(payload->>'expected_current_revision_id', '') is null
  then
    raise exception using errcode = '22023', message = 'user_mutation_payload_invalid';
  end if;

  select contribution.contribution_id into v_existing_contribution_id
  from public.throughline_evaluation_contributions as contribution
  where contribution.auth_user_id = (payload->>'auth_user_id')::uuid
    and contribution.idempotency_key = (payload->>'idempotency_key')::uuid;
  if v_existing_contribution_id is not null then
    select revision.* into strict v_existing_revision
    from public.throughline_evaluation_contributions as contribution
    join public.throughline_note_revisions as revision
      on revision.revision_id = contribution.note_revision_id
    where contribution.contribution_id = v_existing_contribution_id;
    if v_revision is null
      or v_existing_revision.recording_id <> payload->>'recording_id'
      or v_existing_revision.canonical_output_sha256 <>
        v_revision->>'canonical_output_sha256'
      or v_existing_revision.editable_correction_mask <>
        array(select jsonb_array_elements_text(v_revision->'editable_correction_mask'))
      or v_existing_revision.transcript_explicitly_corrected <>
        coalesce(
          (v_revision->>'transcript_explicitly_corrected')::boolean,
          false
        )
    then
      raise exception using errcode = '22023', message = 'idempotency_conflict';
    end if;
    return jsonb_build_object(
      'current_revision_id', v_existing_revision.revision_id,
      'contribution_id', v_existing_contribution_id,
      'material_change', true,
      'eligible', true,
      'idempotent', true
    );
  end if;

  select recording.* into v_recording
  from public.throughline_recordings as recording
  where recording.id = payload->>'recording_id'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'recording_not_found';
  end if;
  if v_recording.auth_user_id is distinct from (payload->>'auth_user_id')::uuid then
    raise exception using errcode = '42501', message = 'recording_owner_mismatch';
  end if;
  if v_recording.current_note_revision_id is distinct from
    (payload->>'expected_current_revision_id')::uuid
  then
    raise exception using errcode = '40001', message = 'revision_conflict';
  end if;

  if coalesce((payload->>'material_change')::boolean, false) = false then
    if v_revision is not null or v_contribution is not null then
      raise exception using errcode = '22023', message = 'noop_mutation_has_lineage';
    end if;
    return jsonb_build_object(
      'current_revision_id', v_recording.current_note_revision_id,
      'contribution_id', null,
      'material_change', false,
      'eligible', false,
      'idempotent', false
    );
  end if;

  if v_revision is null or jsonb_typeof(v_revision) <> 'object' then
    raise exception using errcode = '22023', message = 'mutation_revision_required';
  end if;
  select revision.* into v_base
  from public.throughline_note_revisions as revision
  where revision.revision_id = v_recording.current_note_revision_id
  for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'current_revision_not_found';
  end if;

  if v_revision->>'recording_id' <> v_recording.id
    or (v_revision->>'base_revision_id')::uuid <> v_base.revision_id
    or (v_revision->>'processing_operation_id')::uuid <> v_base.processing_operation_id
    or v_revision->>'revision_kind' not in ('user_content_correction', 'action_state')
    or v_revision->>'production_schema_sha256' <> v_base.production_schema_sha256
    or v_revision->>'production_normalizer_sha256' <> v_base.production_normalizer_sha256
    or v_revision->>'canonical_keyset_sha256' <> v_base.canonical_keyset_sha256
    or jsonb_typeof(v_revision->'canonical_snapshot') <> 'object'
    or not (v_revision->'canonical_snapshot' ?& array[
      'type', 'title', 'summary', 'most_important', 'todos', 'priorities',
      'intentions', 'accomplishments', 'tomorrow_todos', 'mood', 'people',
      'projects', 'tags', 'centers_of_balance'
    ])
    or (select count(*) from jsonb_object_keys(v_revision->'canonical_snapshot')) <> 14
  then
    raise exception using errcode = '22023', message = 'mutation_revision_contract_invalid';
  end if;

  v_revision_id := (v_revision->>'revision_id')::uuid;
  insert into public.throughline_note_revisions (
    revision_id, recording_id, processing_operation_id, base_revision_id,
    revision_kind, canonical_snapshot, canonical_output_sha256,
    production_schema_sha256, production_normalizer_sha256,
    canonical_keyset_sha256, editable_correction_mask,
    transcript_explicitly_corrected, created_at
  ) values (
    v_revision_id, v_recording.id, v_base.processing_operation_id,
    v_base.revision_id, v_revision->>'revision_kind',
    v_revision->'canonical_snapshot', v_revision->>'canonical_output_sha256',
    v_base.production_schema_sha256, v_base.production_normalizer_sha256,
    v_base.canonical_keyset_sha256,
    array(select jsonb_array_elements_text(v_revision->'editable_correction_mask')),
    coalesce((v_revision->>'transcript_explicitly_corrected')::boolean, false),
    (v_revision->>'created_at')::timestamptz
  );

  if v_revision->>'revision_kind' = 'user_content_correction' then
    if v_contribution is null
      or v_contribution->>'recording_id' <> v_recording.id
      or (v_contribution->>'auth_user_id')::uuid <> v_recording.auth_user_id
      or (v_contribution->>'note_revision_id')::uuid <> v_revision_id
      or (v_contribution->>'idempotency_key')::uuid <>
        (payload->>'idempotency_key')::uuid
      or v_contribution->>'event_kind' <> 'created'
      or v_contribution->>'eligibility_source' <> 'content_correction'
      or v_contribution->>'notice_version' <> 'private_evaluation_notice_v1'
      or v_contribution->>'disclosure_version' <>
        'private_evaluation_disclosure_v1'
      or v_contribution->>'policy_version' <> 'private_evaluation_policy_v1'
    then
      raise exception using errcode = '22023', message = 'mutation_contribution_invalid';
    end if;
    insert into public.throughline_evaluation_contributions (
      contribution_id, recording_id, auth_user_id, note_revision_id,
      idempotency_key, event_kind, eligibility_source, notice_version,
      disclosure_version, policy_version, created_at
    ) values (
      (v_contribution->>'contribution_id')::uuid, v_recording.id,
      v_recording.auth_user_id, v_revision_id,
      (payload->>'idempotency_key')::uuid, 'created', 'content_correction',
      'private_evaluation_notice_v1', 'private_evaluation_disclosure_v1',
      'private_evaluation_policy_v1', (v_contribution->>'created_at')::timestamptz
    );
  elsif (v_contribution is not null and v_contribution <> 'null'::jsonb)
    or payload->>'eligibility_source' is not null
  then
    raise exception using errcode = '22023', message = 'action_state_cannot_contribute';
  end if;

  update public.throughline_recordings as recording
  set current_note_revision_id = v_revision_id,
      structured_note = v_revision->'canonical_snapshot',
      transcript_raw = payload->>'transcript_after',
      recording = jsonb_set(
        jsonb_set(
          coalesce(recording.recording, '{}'::jsonb),
          '{structured_note}', v_revision->'canonical_snapshot', true
        ),
        '{transcript_raw}', to_jsonb(payload->>'transcript_after'), true
      )
  where recording.id = v_recording.id;

  return jsonb_build_object(
    'current_revision_id', v_revision_id,
    'contribution_id', case when v_contribution is null then null
      else (v_contribution->>'contribution_id')::uuid end,
    'material_change', true,
    'eligible', v_contribution is not null,
    'idempotent', false
  );
end $$;
create or replace function public.throughline_commit_evaluation_v1(payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_recording public.throughline_recordings%rowtype;
  v_revision public.throughline_note_revisions%rowtype;
  v_contribution jsonb := payload->'contribution';
  v_existing public.throughline_evaluations%rowtype;
  v_contribution_id uuid;
  v_supersedes uuid;
  v_issue_codes text[];
  v_agent_ready boolean := coalesce((payload->>'agent_ready')::boolean, false);
begin
  if payload is null
    or jsonb_typeof(payload) <> 'object'
    or nullif(payload->>'evaluation_id', '') is null
    or nullif(payload->>'recording_id', '') is null
    or nullif(payload->>'auth_user_id', '') is null
    or nullif(payload->>'evaluated_revision_id', '') is null
    or nullif(payload->>'idempotency_key', '') is null
  then
    raise exception using errcode = '22023', message = 'evaluation_payload_invalid';
  end if;

  select evaluation.* into v_existing
  from public.throughline_evaluations as evaluation
  where evaluation.auth_user_id = (payload->>'auth_user_id')::uuid
    and evaluation.idempotency_key = (payload->>'idempotency_key')::uuid;
  if found then
    select contribution.contribution_id into v_contribution_id
    from public.throughline_evaluation_contributions as contribution
    where contribution.evaluation_id = v_existing.evaluation_id;
    if v_existing.evaluation_id <> (payload->>'evaluation_id')::uuid
      or v_existing.recording_id <> payload->>'recording_id'
      or v_existing.evaluated_revision_id <>
        (payload->>'evaluated_revision_id')::uuid
      or v_existing.rubric_version <> payload->>'rubric_version'
      or v_existing.score <> (payload->>'score')::integer
      or v_existing.issue_codes <>
        array(select jsonb_array_elements_text(payload->'issue_codes'))
      or v_existing.agent_ready <>
        coalesce((payload->>'agent_ready')::boolean, false)
      or v_existing.agent_readiness_preview is distinct from (
        case
          when coalesce((payload->>'agent_ready')::boolean, false)
            then payload->'agent_readiness_preview'
          else null
        end
      )
    then
      raise exception using errcode = '22023', message = 'idempotency_conflict';
    end if;
    return jsonb_build_object(
      'evaluation_id', v_existing.evaluation_id,
      'evaluated_revision_id', v_existing.evaluated_revision_id,
      'contribution_id', v_contribution_id,
      'eligible', true,
      'eligibility_source', 'explicit_grade',
      'idempotent', true
    );
  end if;

  select recording.* into v_recording
  from public.throughline_recordings as recording
  where recording.id = payload->>'recording_id'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'recording_not_found';
  end if;
  if v_recording.auth_user_id is distinct from (payload->>'auth_user_id')::uuid then
    raise exception using errcode = '42501', message = 'recording_owner_mismatch';
  end if;
  if v_recording.current_note_revision_id is distinct from
    (payload->>'evaluated_revision_id')::uuid
  then
    raise exception using errcode = '40001', message = 'revision_conflict';
  end if;

  select revision.* into v_revision
  from public.throughline_note_revisions as revision
  where revision.revision_id = v_recording.current_note_revision_id
    and revision.recording_id = v_recording.id
  for share;
  if not found or v_revision.processing_operation_id is null then
    raise exception using errcode = '22023', message = 'evaluation_revision_lineage_invalid';
  end if;
  if nullif(payload->>'processing_operation_id', '') is not null
    and (payload->>'processing_operation_id')::uuid <>
      v_revision.processing_operation_id
  then
    raise exception using errcode = '22023', message = 'evaluation_operation_override_rejected';
  end if;
  if payload->>'evaluator_kind' <> 'recording_user'
    or payload->>'notice_version' <> 'private_evaluation_notice_v1'
    or payload->>'disclosure_version' <> 'private_evaluation_disclosure_v1'
    or payload->>'policy_version' <> 'private_evaluation_policy_v1'
    or nullif(payload->>'rubric_version', '') is null
    or (payload->>'score')::integer not between 1 and 5
    or jsonb_typeof(payload->'issue_codes') <> 'array'
  then
    raise exception using errcode = '22023', message = 'evaluation_contract_invalid';
  end if;
  v_issue_codes := array(select jsonb_array_elements_text(payload->'issue_codes'));
  if not (v_issue_codes <@ array[
    'missed_action', 'unsupported_action', 'wrong_importance', 'meaning_changed',
    'weak_summary', 'transcription_error', 'schema_invalid', 'other_structured'
  ]::text[]) or cardinality(v_issue_codes) > 8 then
    raise exception using errcode = '22023', message = 'evaluation_issue_codes_invalid';
  end if;

  if v_agent_ready then
    if jsonb_typeof(payload->'agent_readiness_preview') <> 'object'
      or payload->'agent_readiness_preview'->>'revision_id' <>
        v_revision.revision_id::text
      or payload->'agent_readiness_preview'->>'canonical_payload_sha256' <>
        v_revision.canonical_output_sha256
      or payload->'agent_readiness_preview'->>'production_schema_sha256' <>
        v_revision.production_schema_sha256
      or payload->'agent_readiness_preview'->>'production_normalizer_sha256' <>
        v_revision.production_normalizer_sha256
      or payload->'agent_readiness_preview'->>'canonical_keyset_sha256' <>
        v_revision.canonical_keyset_sha256
      or not public.throughline_is_sha256(
        payload->'agent_readiness_preview'->>'preview_sha256'
      )
    then
      raise exception using errcode = '22023', message = 'agent_readiness_preview_stale';
    end if;
  elsif coalesce(jsonb_typeof(payload->'agent_readiness_preview'), 'null') <> 'null' then
    raise exception using errcode = '22023', message = 'agent_readiness_preview_without_acceptance';
  end if;

  if v_contribution is null
    or nullif(v_contribution->>'contribution_id', '') is null
    or (v_contribution->>'idempotency_key')::uuid <>
      (payload->>'idempotency_key')::uuid
  then
    raise exception using errcode = '22023', message = 'evaluation_contribution_invalid';
  end if;

  insert into public.throughline_evaluations (
    evaluation_id, recording_id, auth_user_id, processing_operation_id,
    evaluated_revision_id, idempotency_key, evaluator_kind, rubric_version,
    notice_version, disclosure_version, score, issue_codes, agent_ready,
    agent_readiness_preview, created_at
  ) values (
    (payload->>'evaluation_id')::uuid, v_recording.id, v_recording.auth_user_id,
    v_revision.processing_operation_id, v_revision.revision_id,
    (payload->>'idempotency_key')::uuid, 'recording_user',
    payload->>'rubric_version', 'private_evaluation_notice_v1',
    'private_evaluation_disclosure_v1', (payload->>'score')::integer,
    v_issue_codes, v_agent_ready,
    case when v_agent_ready then payload->'agent_readiness_preview' else null end,
    coalesce((payload->>'created_at')::timestamptz, now())
  );

  if nullif(payload->>'explanation', '') is not null then
    insert into public.throughline_evaluation_text_quarantine (
      evaluation_id, auth_user_id, explanation, created_at
    ) values (
      (payload->>'evaluation_id')::uuid, v_recording.auth_user_id,
      payload->>'explanation', coalesce((payload->>'created_at')::timestamptz, now())
    );
  end if;

  select contribution.contribution_id into v_supersedes
  from public.throughline_evaluation_contributions as contribution
  where contribution.recording_id = v_recording.id
    and contribution.auth_user_id = v_recording.auth_user_id
    and contribution.event_kind = 'created'
    and not exists (
      select 1
      from public.throughline_evaluation_contributions as later
      where later.supersedes_contribution_id = contribution.contribution_id
    )
  order by contribution.created_at desc, contribution.contribution_id desc
  limit 1;

  v_contribution_id := (v_contribution->>'contribution_id')::uuid;
  insert into public.throughline_evaluation_contributions (
    contribution_id, recording_id, auth_user_id, evaluation_id,
    note_revision_id, supersedes_contribution_id, idempotency_key,
    event_kind, eligibility_source, notice_version, disclosure_version,
    policy_version, created_at
  ) values (
    v_contribution_id, v_recording.id, v_recording.auth_user_id,
    (payload->>'evaluation_id')::uuid, v_revision.revision_id, v_supersedes,
    (payload->>'idempotency_key')::uuid, 'created', 'explicit_grade',
    'private_evaluation_notice_v1', 'private_evaluation_disclosure_v1',
    'private_evaluation_policy_v1',
    coalesce((payload->>'created_at')::timestamptz, now())
  );

  return jsonb_build_object(
    'evaluation_id', (payload->>'evaluation_id')::uuid,
    'evaluated_revision_id', v_revision.revision_id,
    'contribution_id', v_contribution_id,
    'eligible', true,
    'eligibility_source', 'explicit_grade',
    'idempotent', false
  );
end $$;
create or replace function public.throughline_remove_contribution_v1(payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin raise exception using errcode = 'P0001', message = 'evaluation_runtime_not_enabled'; end $$;
create or replace function public.throughline_materialize_evaluation_corpus_v1(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_mode text := payload->>'mode';
  v_candidates jsonb;
  v_source_set_sha256 text;
  v_case_count integer;
  v_diagnostic_count integer;
  v_reviewed_count integer;
  v_full_count integer;
  v_receipt_state text;
  v_registered_case_count integer;
  v_transitioned integer;
  v_idempotent boolean := false;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception using errcode = '22023', message = 'corpus_request_invalid';
  end if;
  if v_mode = 'prepare' then
    if payload - array[
      'mode', 'policy_version', 'production_schema_sha256',
      'production_normalizer_sha256', 'canonical_keyset_sha256'
    ] <> '{}'::jsonb then
      raise exception using errcode = '22023', message = 'corpus_request_field_forbidden';
    end if;
  elsif v_mode = 'commit' then
    if payload - array[
      'mode', 'policy_version', 'production_schema_sha256',
      'production_normalizer_sha256', 'canonical_keyset_sha256',
      'source_set_sha256', 'stable_split_sha256', 'content_set_sha256',
      'label_contract_set_sha256', 'materializer_receipt_sha256',
      'materialized_at'
    ] <> '{}'::jsonb then
      raise exception using errcode = '22023', message = 'corpus_request_field_forbidden';
    end if;
  else
    raise exception using errcode = '22023', message = 'corpus_mode_invalid';
  end if;
  if payload->>'policy_version' <> 'private_evaluation_policy_v1'
    or not public.throughline_is_sha256(payload->>'production_schema_sha256')
    or not public.throughline_is_sha256(payload->>'production_normalizer_sha256')
    or not public.throughline_is_sha256(payload->>'canonical_keyset_sha256')
  then
    raise exception using errcode = '22023', message = 'corpus_contract_invalid';
  end if;

  with active as (
    select
      contribution.contribution_id,
      contribution.recording_id,
      contribution.auth_user_id,
      contribution.eligibility_source,
      contribution.disclosure_version,
      contribution.policy_version,
      revision.revision_id,
      revision.canonical_snapshot,
      revision.canonical_output_sha256,
      revision.production_schema_sha256,
      revision.production_normalizer_sha256,
      revision.canonical_keyset_sha256,
      revision.editable_correction_mask,
      revision.transcript_explicitly_corrected,
      evaluation.agent_ready,
      evaluation.agent_readiness_preview,
      recording.audio,
      recording.duration_seconds,
      recording.transcript_raw,
      existing_case.stable_split as existing_split,
      latest_transcription.private_input_snapshot->>'audio_sha256'
        as attempt_audio_sha256
    from public.throughline_evaluation_contributions as contribution
    join public.throughline_note_revisions as revision
      on revision.revision_id = contribution.note_revision_id
    join public.throughline_recordings as recording
      on recording.id = contribution.recording_id
      and recording.auth_user_id = contribution.auth_user_id
    left join public.throughline_evaluations as evaluation
      on evaluation.evaluation_id = contribution.evaluation_id
    left join public.throughline_evaluation_corpus_cases as existing_case
      on existing_case.contribution_id = contribution.contribution_id
    left join lateral (
      select attempt.private_input_snapshot
      from public.throughline_inference_attempts as attempt
      where attempt.recording_id = contribution.recording_id
        and attempt.stage = 'transcription'
        and attempt.status = 'succeeded'
      order by attempt.attempt_number desc
      limit 1
    ) as latest_transcription on true
    where contribution.event_kind = 'created'
      and contribution.notice_version = 'private_evaluation_notice_v1'
      and contribution.disclosure_version = 'private_evaluation_disclosure_v1'
      and contribution.policy_version = payload->>'policy_version'
      and revision.production_schema_sha256 =
        payload->>'production_schema_sha256'
      and revision.production_normalizer_sha256 =
        payload->>'production_normalizer_sha256'
      and revision.canonical_keyset_sha256 =
        payload->>'canonical_keyset_sha256'
      and coalesce((recording.audio->>'stored')::boolean, false)
      and nullif(recording.audio->>'object_path', '') is not null
      and not exists (
        select 1
        from public.throughline_evaluation_contributions as later
        where later.supersedes_contribution_id =
          contribution.contribution_id
      )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'contribution_id', active.contribution_id,
        'recording_id', active.recording_id,
        'auth_user_id', active.auth_user_id,
        'eligibility_source', active.eligibility_source,
        'disclosure_version', active.disclosure_version,
        'policy_version', active.policy_version,
        'revision_id', active.revision_id,
        'canonical_snapshot', active.canonical_snapshot,
        'canonical_output_sha256', active.canonical_output_sha256,
        'production_schema_sha256', active.production_schema_sha256,
        'production_normalizer_sha256',
          active.production_normalizer_sha256,
        'canonical_keyset_sha256', active.canonical_keyset_sha256,
        'editable_correction_mask',
          to_jsonb(active.editable_correction_mask),
        'transcript_explicitly_corrected',
          active.transcript_explicitly_corrected,
        'agent_ready', coalesce(active.agent_ready, false),
        'readiness_preview_sha256',
          active.agent_readiness_preview->>'preview_sha256',
        'audio_sha256', coalesce(
          active.audio->>'sha256', active.attempt_audio_sha256
        ),
        'audio_bucket', coalesce(
          active.audio->>'bucket', 'throughline-audio'
        ),
        'audio_object_path', active.audio->>'object_path',
        'audio_mime_type', active.audio->>'mime_type',
        'audio_duration_ms',
          greatest(1, round(coalesce(active.duration_seconds, 0) * 1000)),
        'stable_split', coalesce(
          active.existing_split,
          case
            when get_byte(
              extensions.digest(active.contribution_id::text, 'sha256'), 0
            ) < 51 then 'sealed_holdout'
            else 'development'
          end
        ),
        'label_kind', case
          when active.eligibility_source = 'content_correction'
            then 'reviewed_fields'
          when coalesce(active.agent_ready, false)
            then 'accepted_full_output'
          else 'diagnostic_grade'
        end,
        'label_completeness', case
          when active.eligibility_source = 'content_correction'
            then 'reviewed_fields_only'
          when coalesce(active.agent_ready, false)
            then 'complete_structured_output'
          else 'diagnostic_only'
        end,
        'reviewed_fields_sha256', case
          when active.eligibility_source = 'content_correction'
            and cardinality(active.editable_correction_mask) > 0
          then encode(extensions.digest(
            jsonb_build_object(
              'mask', to_jsonb(active.editable_correction_mask),
              'snapshot', active.canonical_snapshot
            )::text,
            'sha256'
          ), 'hex')
          else null
        end,
        'transcript_sha256', case
          when active.transcript_explicitly_corrected
          then encode(extensions.digest(
            coalesce(active.transcript_raw, ''), 'sha256'
          ), 'hex')
          else null
        end,
        'transcript_snapshot', case
          when active.transcript_explicitly_corrected
          then active.transcript_raw
          else null
        end,
        'label_provenance_sha256', encode(extensions.digest(
          jsonb_build_object(
            'contribution_id', active.contribution_id,
            'revision_id', active.revision_id,
            'eligibility_source', active.eligibility_source,
            'canonical_output_sha256', active.canonical_output_sha256,
            'readiness_preview_sha256',
              active.agent_readiness_preview->>'preview_sha256',
            'editable_correction_mask',
              to_jsonb(active.editable_correction_mask),
            'transcript_explicitly_corrected',
              active.transcript_explicitly_corrected
          )::text,
          'sha256'
        ), 'hex')
      )
      order by active.contribution_id
    ),
    '[]'::jsonb
  ) into v_candidates
  from active;

  v_case_count := jsonb_array_length(v_candidates);
  -- At most four case objects plus one manifest must remain below the
  -- deletion service's 1,000-object receipt cap.
  if v_case_count > 249 then
    raise exception using
      errcode = 'P0001', message = 'corpus_case_limit_exceeded';
  end if;
  if v_case_count = 0 then
    raise exception using errcode = 'P0002', message = 'corpus_no_active_cases';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_candidates) as candidate
    where not public.throughline_is_sha256(candidate->>'audio_sha256')
      or nullif(candidate->>'audio_mime_type', '') is null
      or (
        candidate->>'label_kind' = 'accepted_full_output'
        and (
          not public.throughline_is_sha256(
            candidate->>'readiness_preview_sha256'
          )
          or candidate->>'canonical_output_sha256' is null
        )
      )
      or (
        candidate->>'label_kind' = 'reviewed_fields'
        and jsonb_array_length(
          candidate->'editable_correction_mask'
        ) = 0
        and not coalesce(
          (candidate->>'transcript_explicitly_corrected')::boolean,
          false
        )
      )
  ) then
    raise exception using errcode = '22023', message = 'corpus_candidate_invalid';
  end if;
  v_source_set_sha256 := encode(
    extensions.digest(v_candidates::text, 'sha256'), 'hex'
  );
  if v_mode = 'prepare' then
    return jsonb_build_object(
      'source_set_sha256', v_source_set_sha256,
      'case_count', v_case_count,
      'candidates', v_candidates
    );
  end if;

  if payload->>'source_set_sha256' <> v_source_set_sha256
    or not public.throughline_is_sha256(
      payload->>'stable_split_sha256'
    )
    or not public.throughline_is_sha256(payload->>'content_set_sha256')
    or not public.throughline_is_sha256(
      payload->>'label_contract_set_sha256'
    )
    or not public.throughline_is_sha256(
      payload->>'materializer_receipt_sha256'
    )
    or nullif(payload->>'materialized_at', '') is null
  then
    raise exception using errcode = '40001', message = 'corpus_source_set_changed';
  end if;

  select receipt.state, receipt.committed_case_count
  into v_receipt_state, v_registered_case_count
  from public.throughline_evaluation_artifact_receipts as receipt
  where receipt.materializer_receipt_sha256 =
    payload->>'materializer_receipt_sha256'
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'artifact_receipt_not_pending';
  end if;

  select
    count(*) filter (
      where candidate->>'label_kind' = 'diagnostic_grade'
    ),
    count(*) filter (
      where candidate->>'label_kind' = 'reviewed_fields'
    ),
    count(*) filter (
      where candidate->>'label_kind' = 'accepted_full_output'
    )
  into v_diagnostic_count, v_reviewed_count, v_full_count
  from jsonb_array_elements(v_candidates) as candidate;

  if v_receipt_state = 'committed' then
    if v_registered_case_count is distinct from v_case_count
      or (
        select count(*)
        from public.throughline_evaluation_corpus_events as event
        where event.event_kind = 'materialized'
          and event.receipt_sha256 = payload->>'materializer_receipt_sha256'
      ) <> v_case_count
      or exists (
        select 1
        from jsonb_array_elements(v_candidates) as candidate
        where not exists (
          select 1
          from public.throughline_evaluation_corpus_cases as corpus_case
          join public.throughline_evaluation_corpus_events as event
            on event.case_id = corpus_case.case_id
          where corpus_case.contribution_id =
              (candidate->>'contribution_id')::uuid
            and event.event_kind = 'materialized'
            and event.receipt_sha256 =
              payload->>'materializer_receipt_sha256'
            and event.active_content_set_sha256 =
              payload->>'content_set_sha256'
            and event.active_label_contract_set_sha256 =
              payload->>'label_contract_set_sha256'
            and event.created_at = (payload->>'materialized_at')::timestamptz
        )
      )
    then
      raise exception using
        errcode = '22023', message = 'artifact_receipt_commit_conflict';
    end if;
    v_idempotent := true;
  elsif v_receipt_state <> 'pending' then
    raise exception using errcode = 'P0001', message = 'artifact_receipt_not_pending';
  end if;

  if not v_idempotent then
  insert into public.throughline_evaluation_corpus_cases (
    contribution_id, recording_id, auth_user_id, evaluated_revision_id,
    disclosure_version, policy_version, stable_split, label_kind,
    label_completeness, editable_correction_mask,
    transcript_explicitly_corrected, readiness_preview_sha256,
    canonical_output_sha256, production_schema_sha256,
    production_normalizer_sha256, canonical_keyset_sha256, audio_sha256,
    reviewed_fields_sha256, transcript_sha256, label_provenance_sha256,
    materializer_receipt_sha256, materialized_at
  )
  select
    (candidate->>'contribution_id')::uuid,
    candidate->>'recording_id',
    (candidate->>'auth_user_id')::uuid,
    (candidate->>'revision_id')::uuid,
    'private_evaluation_disclosure_v1',
    'private_evaluation_policy_v1',
    candidate->>'stable_split',
    candidate->>'label_kind',
    candidate->>'label_completeness',
    array(
      select jsonb_array_elements_text(
        candidate->'editable_correction_mask'
      )
    ),
    (candidate->>'transcript_explicitly_corrected')::boolean,
    nullif(candidate->>'readiness_preview_sha256', ''),
    case when candidate->>'label_kind' = 'accepted_full_output'
      then candidate->>'canonical_output_sha256' else null end,
    candidate->>'production_schema_sha256',
    candidate->>'production_normalizer_sha256',
    candidate->>'canonical_keyset_sha256',
    candidate->>'audio_sha256',
    nullif(candidate->>'reviewed_fields_sha256', ''),
    nullif(candidate->>'transcript_sha256', ''),
    candidate->>'label_provenance_sha256',
    payload->>'materializer_receipt_sha256',
    (payload->>'materialized_at')::timestamptz
  from jsonb_array_elements(v_candidates) as candidate
  on conflict (contribution_id) do nothing;

  insert into public.throughline_evaluation_corpus_events (
    case_id, event_kind, active_content_set_sha256,
    active_label_contract_set_sha256, receipt_sha256, created_at
  )
  select
    corpus_case.case_id, 'materialized',
    payload->>'content_set_sha256',
    payload->>'label_contract_set_sha256',
    payload->>'materializer_receipt_sha256',
    (payload->>'materialized_at')::timestamptz
  from public.throughline_evaluation_corpus_cases as corpus_case
  join jsonb_array_elements(v_candidates) as candidate
    on corpus_case.contribution_id =
      (candidate->>'contribution_id')::uuid
  where not exists (
    select 1
    from public.throughline_evaluation_corpus_events as existing_event
    where existing_event.case_id = corpus_case.case_id
      and existing_event.event_kind = 'materialized'
      and existing_event.receipt_sha256 =
        payload->>'materializer_receipt_sha256'
  );

  update public.throughline_evaluation_artifact_receipts as receipt
  set state = 'committed',
      committed_at = statement_timestamp(),
      committed_case_count = v_case_count
  where receipt.materializer_receipt_sha256 =
      payload->>'materializer_receipt_sha256'
    and receipt.state = 'pending';
  get diagnostics v_transitioned = row_count;
  if v_transitioned <> 1 then
    raise exception using errcode = 'P0001', message = 'artifact_receipt_not_pending';
  end if;
  end if;

  return jsonb_build_object(
    'receipt_version', 'throughline-corpus-materializer-receipt-v1',
    'policy_version', 'private_evaluation_policy_v1',
    'disclosure_version', 'private_evaluation_disclosure_v1',
    'stable_split_sha256', payload->>'stable_split_sha256',
    'content_set_sha256', payload->>'content_set_sha256',
    'label_contract_set_sha256', payload->>'label_contract_set_sha256',
    'production_schema_sha256', payload->>'production_schema_sha256',
    'production_normalizer_sha256',
      payload->>'production_normalizer_sha256',
    'canonical_keyset_sha256', payload->>'canonical_keyset_sha256',
    'case_count', v_case_count,
    'diagnostic_case_count', v_diagnostic_count,
    'reviewed_field_case_count', v_reviewed_count,
    'accepted_full_output_case_count', v_full_count,
    'materialized_at', payload->>'materialized_at',
    'receipt_sha256', payload->>'materializer_receipt_sha256',
    'idempotent', v_idempotent
  );
end $$;
create or replace function public.throughline_revalidate_evaluation_corpus_v1(payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_case_count integer;
  v_full_count integer;
  v_content_set_sha256 text;
  v_label_contract_set_sha256 text;
  v_schema_sha256 text;
  v_normalizer_sha256 text;
  v_keyset_sha256 text;
  v_revalidated_at timestamptz := now();
  v_receipt_sha256 text;
begin
  if payload is null
    or jsonb_typeof(payload) <> 'object'
    or payload - array[
      'materializer_receipt_sha256', 'prediction_bundle_sha256'
    ] <> '{}'::jsonb
  then
    raise exception using errcode = '22023', message = 'corpus_request_field_forbidden';
  end if;
  if not public.throughline_is_sha256(
      payload->>'materializer_receipt_sha256'
    )
    or not public.throughline_is_sha256(
      payload->>'prediction_bundle_sha256'
    )
  then
    raise exception using errcode = '22023', message = 'corpus_revalidation_invalid';
  end if;

  select
    count(distinct corpus_case.case_id),
    count(distinct corpus_case.case_id) filter (
      where corpus_case.label_kind = 'accepted_full_output'
    ),
    min(materialized.active_content_set_sha256),
    min(materialized.active_label_contract_set_sha256),
    min(corpus_case.production_schema_sha256),
    min(corpus_case.production_normalizer_sha256),
    min(corpus_case.canonical_keyset_sha256)
  into
    v_case_count, v_full_count, v_content_set_sha256,
    v_label_contract_set_sha256, v_schema_sha256, v_normalizer_sha256,
    v_keyset_sha256
  from public.throughline_evaluation_corpus_events as materialized
  join public.throughline_evaluation_corpus_cases as corpus_case
    on corpus_case.case_id = materialized.case_id
  where materialized.event_kind = 'materialized'
    and materialized.receipt_sha256 =
      payload->>'materializer_receipt_sha256';

  if coalesce(v_case_count, 0) = 0
    or v_content_set_sha256 is null
    or v_label_contract_set_sha256 is null
  then
    raise exception using errcode = 'P0001', message = 'stale_or_revoked_case';
  end if;
  if exists (
    select 1
    from public.throughline_evaluation_corpus_events as materialized
    join public.throughline_evaluation_corpus_cases as corpus_case
      on corpus_case.case_id = materialized.case_id
    join public.throughline_evaluation_contributions as contribution
      on contribution.contribution_id = corpus_case.contribution_id
    join public.throughline_recordings as recording
      on recording.id = corpus_case.recording_id
    left join lateral (
      select attempt.private_input_snapshot
      from public.throughline_inference_attempts as attempt
      where attempt.recording_id = corpus_case.recording_id
        and attempt.stage = 'transcription'
        and attempt.status = 'succeeded'
      order by attempt.attempt_number desc
      limit 1
    ) as latest_transcription on true
    where materialized.event_kind = 'materialized'
      and materialized.receipt_sha256 =
        payload->>'materializer_receipt_sha256'
      and (
        contribution.event_kind <> 'created'
        or contribution.notice_version <> 'private_evaluation_notice_v1'
        or contribution.disclosure_version <>
          'private_evaluation_disclosure_v1'
        or contribution.policy_version <> 'private_evaluation_policy_v1'
        or exists (
          select 1
          from public.throughline_evaluation_contributions as later
          where later.supersedes_contribution_id =
            contribution.contribution_id
        )
        or exists (
          select 1
          from public.throughline_evaluation_corpus_events as invalidated
          where invalidated.case_id = corpus_case.case_id
            and invalidated.event_kind = 'invalidated'
        )
        or not coalesce((recording.audio->>'stored')::boolean, false)
        or nullif(recording.audio->>'object_path', '') is null
        or coalesce(
          recording.audio->>'sha256',
          latest_transcription.private_input_snapshot->>'audio_sha256'
        ) is distinct from corpus_case.audio_sha256
      )
  ) then
    raise exception using errcode = 'P0001', message = 'stale_or_revoked_case';
  end if;
  if (
    select count(distinct materialized.active_content_set_sha256) <> 1
      or count(distinct materialized.active_label_contract_set_sha256) <> 1
      or count(distinct corpus_case.production_schema_sha256) <> 1
      or count(distinct corpus_case.production_normalizer_sha256) <> 1
      or count(distinct corpus_case.canonical_keyset_sha256) <> 1
    from public.throughline_evaluation_corpus_events as materialized
    join public.throughline_evaluation_corpus_cases as corpus_case
      on corpus_case.case_id = materialized.case_id
    where materialized.event_kind = 'materialized'
      and materialized.receipt_sha256 =
        payload->>'materializer_receipt_sha256'
  ) then
    raise exception using errcode = 'P0001', message = 'stale_or_revoked_case';
  end if;

  v_receipt_sha256 := encode(extensions.digest(
    jsonb_build_object(
      'receipt_version', 'throughline-corpus-revalidation-receipt-v1',
      'materializer_receipt_sha256',
        payload->>'materializer_receipt_sha256',
      'prediction_bundle_sha256', payload->>'prediction_bundle_sha256',
      'active_content_set_sha256', v_content_set_sha256,
      'active_label_contract_set_sha256', v_label_contract_set_sha256,
      'production_schema_sha256', v_schema_sha256,
      'production_normalizer_sha256', v_normalizer_sha256,
      'canonical_keyset_sha256', v_keyset_sha256,
      'active_case_count', v_case_count,
      'active_accepted_full_output_case_count', v_full_count,
      'revalidated_at', v_revalidated_at
    )::text,
    'sha256'
  ), 'hex');

  insert into public.throughline_evaluation_corpus_events (
    case_id, event_kind, prediction_bundle_sha256,
    active_content_set_sha256, active_label_contract_set_sha256,
    receipt_sha256, created_at
  )
  select
    materialized.case_id, 'revalidated',
    payload->>'prediction_bundle_sha256',
    v_content_set_sha256, v_label_contract_set_sha256,
    v_receipt_sha256, v_revalidated_at
  from public.throughline_evaluation_corpus_events as materialized
  where materialized.event_kind = 'materialized'
    and materialized.receipt_sha256 =
      payload->>'materializer_receipt_sha256'
    and not exists (
      select 1
      from public.throughline_evaluation_corpus_events as existing_event
      where existing_event.case_id = materialized.case_id
        and existing_event.event_kind = 'revalidated'
        and existing_event.receipt_sha256 = v_receipt_sha256
    );

  return jsonb_build_object(
    'receipt_version', 'throughline-corpus-revalidation-receipt-v1',
    'materializer_receipt_sha256',
      payload->>'materializer_receipt_sha256',
    'prediction_bundle_sha256', payload->>'prediction_bundle_sha256',
    'active_content_set_sha256', v_content_set_sha256,
    'active_label_contract_set_sha256', v_label_contract_set_sha256,
    'production_schema_sha256', v_schema_sha256,
    'production_normalizer_sha256', v_normalizer_sha256,
    'canonical_keyset_sha256', v_keyset_sha256,
    'active_case_count', v_case_count,
    'active_accepted_full_output_case_count', v_full_count,
    'revalidated_at', v_revalidated_at,
    'receipt_sha256', v_receipt_sha256
  );
end $$;
create or replace function public.throughline_invalidate_evaluation_corpus_v1(payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin raise exception using errcode = 'P0001', message = 'corpus_runtime_not_enabled'; end $$;
create or replace function public.throughline_retention_candidates_v1(
  ordinary_cutoff timestamptz, eligibility_cutoff timestamptz, max_rows integer
) returns table(recording_id text, candidate_reason text)
language plpgsql security invoker set search_path = '' as $$
begin raise exception using errcode = 'P0001', message = 'retention_runtime_not_enabled'; end $$;

alter table public.throughline_inference_contracts enable row level security;
alter table public.throughline_processing_operations enable row level security;
alter table public.throughline_inference_attempts enable row level security;
alter table public.throughline_note_revisions enable row level security;
alter table public.throughline_evaluations enable row level security;
alter table public.throughline_evaluation_contributions enable row level security;
alter table public.throughline_evaluation_text_quarantine enable row level security;
alter table public.throughline_evaluation_artifact_receipts enable row level security;
alter table public.throughline_evaluation_corpus_cases enable row level security;
alter table public.throughline_evaluation_corpus_events enable row level security;

revoke all on table
  public.throughline_inference_contracts, public.throughline_processing_operations,
  public.throughline_inference_attempts, public.throughline_note_revisions,
  public.throughline_evaluations, public.throughline_evaluation_contributions,
  public.throughline_evaluation_text_quarantine,
  public.throughline_evaluation_artifact_receipts,
  public.throughline_evaluation_corpus_cases,
  public.throughline_evaluation_corpus_events
from public, anon, authenticated, service_role;
grant select, insert on table public.throughline_inference_contracts to service_role;
grant select, insert on table public.throughline_processing_operations to service_role;
grant select, insert on table public.throughline_inference_attempts to service_role;
grant select, insert on table public.throughline_note_revisions to service_role;
grant select, insert on table public.throughline_evaluations to service_role;
grant select, insert on table public.throughline_evaluation_contributions to service_role;
grant select, insert, delete on table public.throughline_evaluation_text_quarantine to service_role;
grant select, insert on table public.throughline_evaluation_corpus_cases to service_role;
grant select, insert on table public.throughline_evaluation_corpus_events to service_role;

revoke all on function public.throughline_is_sha256(text) from public, anon, authenticated;
grant execute on function public.throughline_is_sha256(text) to service_role;
revoke all on function public.throughline_reserve_evaluation_artifact_receipt_v1(jsonb) from public, anon, authenticated;
revoke all on function public.throughline_claim_stale_evaluation_artifact_receipts_v1(timestamptz, integer, integer) from public, anon, authenticated;
revoke all on function public.throughline_acknowledge_evaluation_artifact_deletion_v1(jsonb) from public, anon, authenticated;
revoke all on function public.throughline_release_evaluation_artifact_cleanup_claim_v1(jsonb) from public, anon, authenticated;
revoke all on function public.throughline_commit_processing_v1(jsonb) from public, anon, authenticated;
revoke all on function public.throughline_commit_user_mutation_v1(jsonb) from public, anon, authenticated;
revoke all on function public.throughline_commit_evaluation_v1(jsonb) from public, anon, authenticated;
revoke all on function public.throughline_remove_contribution_v1(jsonb) from public, anon, authenticated;
revoke all on function public.throughline_materialize_evaluation_corpus_v1(jsonb) from public, anon, authenticated;
revoke all on function public.throughline_revalidate_evaluation_corpus_v1(jsonb) from public, anon, authenticated;
revoke all on function public.throughline_invalidate_evaluation_corpus_v1(jsonb) from public, anon, authenticated;
revoke all on function public.throughline_retention_candidates_v1(timestamptz, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.throughline_commit_processing_v1(jsonb) to service_role;
grant execute on function public.throughline_reserve_evaluation_artifact_receipt_v1(jsonb) to service_role;
grant execute on function public.throughline_claim_stale_evaluation_artifact_receipts_v1(timestamptz, integer, integer) to service_role;
grant execute on function public.throughline_acknowledge_evaluation_artifact_deletion_v1(jsonb) to service_role;
grant execute on function public.throughline_release_evaluation_artifact_cleanup_claim_v1(jsonb) to service_role;
grant execute on function public.throughline_commit_user_mutation_v1(jsonb) to service_role;
grant execute on function public.throughline_commit_evaluation_v1(jsonb) to service_role;
grant execute on function public.throughline_remove_contribution_v1(jsonb) to service_role;
grant execute on function public.throughline_materialize_evaluation_corpus_v1(jsonb) to service_role;
grant execute on function public.throughline_revalidate_evaluation_corpus_v1(jsonb) to service_role;
grant execute on function public.throughline_invalidate_evaluation_corpus_v1(jsonb) to service_role;
grant execute on function public.throughline_retention_candidates_v1(timestamptz, timestamptz, integer) to service_role;
