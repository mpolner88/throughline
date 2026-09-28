begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id)
values ('00000000-0000-4000-8000-000000000901');

insert into public.throughline_recordings (
  id, user_id, auth_user_id, created_at, duration_seconds, status,
  processing_status, transcript_raw, structured_note, audio, recording
) values
(
  'rec_retention_active', 'test-user',
  '00000000-0000-4000-8000-000000000901', now() - interval '45 days',
  2.5, 'ready', 'processed', 'private transcript',
  jsonb_build_object('title', 'Visible note', 'summary', 'Keep this note'),
  jsonb_build_object(
    'stored', true, 'storage', 'supabase',
    'bucket', 'throughline-audio', 'object_path', 'private/active.m4a',
    'mime_type', 'audio/m4a', 'sha256', repeat('a', 64)
  ),
  jsonb_build_object('id', 'rec_retention_active')
),
(
  'rec_retention_historical', 'test-user',
  '00000000-0000-4000-8000-000000000901', now() - interval '45 days',
  2.5, 'ready', 'processed', 'private transcript',
  jsonb_build_object('title', 'Historical note'),
  jsonb_build_object(
    'stored', true, 'storage', 'supabase',
    'bucket', 'throughline-audio', 'object_path', 'private/historical.m4a',
    'mime_type', 'audio/m4a', 'sha256', repeat('b', 64)
  ),
  jsonb_build_object('id', 'rec_retention_historical')
);

insert into public.throughline_feedback (
  id, recording_id, user_id, auth_user_id, created_at, status, answers,
  feedback
) values (
  'feedback_retention_historical', 'rec_retention_historical', 'test-user',
  '00000000-0000-4000-8000-000000000901', now() - interval '44 days',
  'graded', jsonb_build_object('quality_score', 5), '{}'::jsonb
);

insert into public.throughline_inference_contracts (
  id, contract_sha256, contract_version, provider, transcription_model,
  extraction_model, prompt_sha256, schema_sha256, normalizer_sha256,
  canonical_keyset_sha256, contract_snapshot
) values (
  '00000000-0000-4000-8000-000000000902', repeat('0', 64), 'v1',
  'test', 'test-transcription', 'test-extraction', repeat('1', 64),
  repeat('2', 64), repeat('3', 64), repeat('4', 64), '{}'::jsonb
);

insert into public.throughline_processing_operations (
  operation_id, recording_id, inference_contract_id, status, started_at,
  finished_at
) values (
  '00000000-0000-4000-8000-000000000903', 'rec_retention_active',
  '00000000-0000-4000-8000-000000000902', 'succeeded', now(), now()
);

insert into public.throughline_note_revisions (
  revision_id, recording_id, processing_operation_id, revision_kind,
  canonical_snapshot, canonical_output_sha256, production_schema_sha256,
  production_normalizer_sha256, canonical_keyset_sha256
) values (
  '00000000-0000-4000-8000-000000000904', 'rec_retention_active',
  '00000000-0000-4000-8000-000000000903', 'original_model',
  jsonb_build_object(
    'type', 'freeform', 'title', 'Visible note', 'summary', 'Keep this note',
    'most_important', jsonb_build_array('Keep'), 'todos', '[]'::jsonb,
    'priorities', '[]'::jsonb, 'intentions', '[]'::jsonb,
    'accomplishments', '[]'::jsonb, 'tomorrow_todos', '[]'::jsonb,
    'mood', 'neutral', 'people', '[]'::jsonb, 'projects', '[]'::jsonb,
    'tags', '[]'::jsonb, 'centers_of_balance', '[]'::jsonb
  ), repeat('5', 64), repeat('2', 64), repeat('3', 64), repeat('4', 64)
);

update public.throughline_recordings set
  current_processing_operation_id = '00000000-0000-4000-8000-000000000903',
  current_note_revision_id = '00000000-0000-4000-8000-000000000904'
where id = 'rec_retention_active';

insert into public.throughline_evaluations (
  evaluation_id, recording_id, auth_user_id, processing_operation_id,
  evaluated_revision_id, idempotency_key, evaluator_kind, rubric_version,
  notice_version, disclosure_version, score, issue_codes, agent_ready
) values (
  '00000000-0000-4000-8000-000000000905', 'rec_retention_active',
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000903',
  '00000000-0000-4000-8000-000000000904',
  '00000000-0000-4000-8000-000000000906', 'recording_user',
  'throughline_extraction_quality_v1', 'private_evaluation_notice_v1',
  'private_evaluation_disclosure_v1', 4, array['weak_summary'], false
);

insert into public.throughline_evaluation_contributions (
  contribution_id, recording_id, auth_user_id, evaluation_id,
  note_revision_id, idempotency_key, event_kind, eligibility_source,
  notice_version, disclosure_version, policy_version, created_at
) values (
  '00000000-0000-4000-8000-000000000907', 'rec_retention_active',
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000905',
  '00000000-0000-4000-8000-000000000904',
  '00000000-0000-4000-8000-000000000906', 'created',
  'explicit_grade', 'private_evaluation_notice_v1',
  'private_evaluation_disclosure_v1', 'private_evaluation_policy_v1',
  now() - interval '44 days'
);

insert into public.throughline_evaluation_corpus_cases (
  case_id, contribution_id, recording_id, auth_user_id,
  evaluated_revision_id, disclosure_version, policy_version, stable_split,
  label_kind, label_completeness, audio_sha256,
  production_schema_sha256, production_normalizer_sha256,
  canonical_keyset_sha256, label_provenance_sha256,
  materializer_receipt_sha256
) values (
  '00000000-0000-4000-8000-000000000908',
  '00000000-0000-4000-8000-000000000907', 'rec_retention_active',
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000904',
  'private_evaluation_disclosure_v1', 'private_evaluation_policy_v1',
  'development', 'diagnostic_grade', 'diagnostic_only', repeat('a', 64),
  repeat('2', 64), repeat('3', 64), repeat('4', 64), repeat('6', 64),
  repeat('9', 64)
);

insert into public.throughline_evaluation_corpus_events (
  case_id, event_kind, receipt_sha256
) values (
  '00000000-0000-4000-8000-000000000908', 'materialized', repeat('9', 64)
);

select is(
  (select candidate_reason from public.throughline_retention_candidates_v1(
    now() - interval '30 days', now() - interval '90 days', 100
  ) where recording_id = 'rec_retention_active'),
  'active_current_contribution',
  'a current disclosed contribution protects old eligible audio'
);
select is(
  (select candidate_reason from public.throughline_retention_candidates_v1(
    now() - interval '30 days', now() - interval '90 days', 100
  ) where recording_id = 'rec_retention_historical'),
  'historical_or_no_active_contribution',
  'a historical legacy grade never extends audio retention'
);
select throws_ok(
  $$ select public.throughline_retention_candidates_v1(
       now() - interval '30 days', now() - interval '90 days', 0
     ) $$,
  '22023', 'retention_batch_limit_invalid',
  'retention batches reject an unsafe zero limit'
);
select lives_ok(
  $$ select public.throughline_retention_candidates_v1(
       now() - interval '30 days', now(), 100
     ) $$,
  'the rollout eligibility boundary is independent of the ordinary cutoff'
);
select throws_ok(
  $$ select public.throughline_remove_contribution_v1(jsonb_build_object(
       'recording_id', 'rec_retention_active',
       'auth_user_id', '00000000-0000-4000-8000-000000000901',
       'contribution_id', '00000000-0000-4000-8000-000000000907',
       'idempotency_key', '00000000-0000-4000-8000-000000000909',
       'source_audio_deleted', false,
       'raw_artifacts_deleted', true,
       'raw_artifacts_deleted_count', 1
     )) $$,
  '22023', 'evaluation_withdrawal_cleanup_required',
  'withdrawal cannot commit before source audio deletion'
);

create temporary table retention_withdrawal as
select public.throughline_remove_contribution_v1(jsonb_build_object(
  'recording_id', 'rec_retention_active',
  'auth_user_id', '00000000-0000-4000-8000-000000000901',
  'contribution_id', '00000000-0000-4000-8000-000000000907',
  'idempotency_key', '00000000-0000-4000-8000-000000000909',
  'source_audio_deleted', true,
  'raw_artifacts_deleted', true,
  'raw_artifacts_deleted_count', 1,
  'withdrawn_at', '2026-08-22T23:30:00.000Z'
)) as result;

select is(
  (select result->>'withdrawn' from retention_withdrawal), 'true',
  'cleanup-complete withdrawal commits'
);
select is(
  (select (result->>'invalidated_case_count')::integer from retention_withdrawal),
  1, 'withdrawal reports aggregate invalidated case count only'
);
select is(
  (select count(*)::integer from public.throughline_evaluation_contributions
   where event_kind = 'withdrawn'
     and supersedes_contribution_id = '00000000-0000-4000-8000-000000000907'),
  1, 'withdrawal appends immutable contribution state'
);
select is(
  (select count(*)::integer from public.throughline_evaluation_corpus_events
   where case_id = '00000000-0000-4000-8000-000000000908'
     and event_kind = 'invalidated'),
  1, 'withdrawal appends corpus invalidation'
);
select is(
  (select count(*)::integer from public.throughline_evaluation_corpus_events
   where case_id = '00000000-0000-4000-8000-000000000908'
     and event_kind = 'raw_artifacts_deleted'),
  1, 'withdrawal records content-free private artifact cleanup'
);
select is(
  (select audio->>'stored' from public.throughline_recordings
   where id = 'rec_retention_active'),
  'false', 'withdrawal atomically removes source-audio availability'
);
select is(
  (select structured_note->>'title' from public.throughline_recordings
   where id = 'rec_retention_active'),
  'Visible note', 'withdrawing evaluation use preserves the visible note'
);
select throws_ok(
  $$ select public.throughline_revalidate_evaluation_corpus_v1(
       jsonb_build_object(
         'materializer_receipt_sha256', repeat('9', 64),
         'prediction_bundle_sha256', repeat('c', 64)
       )
     ) $$,
  'P0001', 'stale_or_revoked_case',
  'invalidation makes the old materializer receipt unusable'
);
select is(
  (select public.throughline_remove_contribution_v1(jsonb_build_object(
    'recording_id', 'rec_retention_active',
    'auth_user_id', '00000000-0000-4000-8000-000000000901',
    'contribution_id', '00000000-0000-4000-8000-000000000907',
    'idempotency_key', '00000000-0000-4000-8000-000000000909',
    'source_audio_deleted', true,
    'raw_artifacts_deleted', true,
    'raw_artifacts_deleted_count', 1,
    'withdrawn_at', '2026-08-22T23:30:00.000Z'
  ))->>'idempotent'),
  'true', 'repeating the same withdrawal is idempotent'
);
select ok(
  position(
    'rec_retention_active' in
    (select result::text from retention_withdrawal)
  ) = 0,
  'withdrawal receipt contains aggregate fields but no recording identifier'
);

select * from finish();
rollback;
