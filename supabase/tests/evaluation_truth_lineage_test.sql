begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

select has_table('public', 'throughline_inference_contracts', 'inference contracts exist');
select has_table('public', 'throughline_processing_operations', 'processing operations exist');
select has_table('public', 'throughline_inference_attempts', 'inference attempts exist');
select has_table('public', 'throughline_note_revisions', 'note revisions exist');
select has_table('public', 'throughline_evaluations', 'evaluations exist');
select has_table('public', 'throughline_evaluation_contributions', 'evaluation contributions exist');
select has_table('public', 'throughline_evaluation_text_quarantine', 'evaluation text quarantine exists');
select has_table('public', 'throughline_evaluation_corpus_cases', 'corpus cases exist');
select has_table('public', 'throughline_evaluation_corpus_events', 'corpus events exist');

select has_column('public', 'throughline_recordings', 'current_processing_operation_id', 'recordings link the current operation');
select has_column('public', 'throughline_recordings', 'current_transcription_attempt_id', 'recordings link the current transcription attempt');
select has_column('public', 'throughline_recordings', 'current_extraction_attempt_id', 'recordings link the current extraction attempt');
select has_column('public', 'throughline_recordings', 'current_note_revision_id', 'recordings link the current note revision');
select has_index('public', 'throughline_inference_attempts', 'throughline_inference_attempts_recording_stage_idx', 'attempt lookup is indexed');
select has_index('public', 'throughline_recordings', 'throughline_recordings_current_processing_operation_id_idx', 'current operation is indexed');

insert into public.throughline_recordings (
  id, user_id, created_at, status, processing_status, recording
) values (
  'rec_eval_immutable', 'test-user', now(), 'ready', 'processed', '{}'::jsonb
);
insert into public.throughline_inference_contracts (
  id, contract_sha256, contract_version, provider, transcription_model,
  extraction_model, prompt_sha256, schema_sha256, normalizer_sha256,
  canonical_keyset_sha256, contract_snapshot
) values (
  '00000000-0000-4000-8000-000000000201', repeat('a', 64), 'v1',
  'test', 'test-transcription', 'test-extraction', repeat('b', 64),
  repeat('c', 64), repeat('d', 64), repeat('e', 64), '{}'::jsonb
);
insert into public.throughline_processing_operations (
  operation_id, recording_id, inference_contract_id, status, started_at, finished_at
) values (
  '00000000-0000-4000-8000-000000000202', 'rec_eval_immutable',
  '00000000-0000-4000-8000-000000000201', 'succeeded', now(), now()
);
insert into public.throughline_note_revisions (
  revision_id, recording_id, processing_operation_id, revision_kind,
  canonical_snapshot, canonical_output_sha256, production_schema_sha256,
  production_normalizer_sha256, canonical_keyset_sha256
) values (
  '00000000-0000-4000-8000-000000000203', 'rec_eval_immutable',
  '00000000-0000-4000-8000-000000000202', 'original_model', '{}'::jsonb,
  repeat('f', 64), repeat('c', 64), repeat('d', 64), repeat('e', 64)
);

select throws_ok(
  $$ update public.throughline_note_revisions set revision_kind = 'action_state'
     where revision_id = '00000000-0000-4000-8000-000000000203' $$,
  'P0001', 'immutable_row', 'note revisions reject updates'
);
select throws_ok(
  $$ delete from public.throughline_processing_operations
     where operation_id = '00000000-0000-4000-8000-000000000202' $$,
  'P0001', 'immutable_row', 'processing operations reject deletes'
);

select has_function('public', 'throughline_commit_processing_v1', array['jsonb'], 'processing commit RPC exists');
select has_function('public', 'throughline_commit_user_mutation_v1', array['jsonb'], 'mutation commit RPC exists');
select has_function('public', 'throughline_commit_evaluation_v1', array['jsonb'], 'evaluation commit RPC exists');
select has_function('public', 'throughline_materialize_evaluation_corpus_v1', array['jsonb'], 'materializer RPC exists');
select has_function('public', 'throughline_revalidate_evaluation_corpus_v1', array['jsonb'], 'revalidator RPC exists');
select has_function('public', 'throughline_remove_contribution_v1', array['jsonb'], 'withdrawal RPC exists');
select has_function('public', 'throughline_invalidate_evaluation_corpus_v1', array['jsonb'], 'invalidation RPC exists');
select has_function(
  'public',
  'throughline_retention_candidates_v1',
  array['timestamp with time zone', 'timestamp with time zone', 'integer'],
  'retention selector exists'
);

select ok(
  not exists (
    select 1
    from pg_class
    where oid in (
      'public.throughline_inference_contracts'::regclass,
      'public.throughline_processing_operations'::regclass,
      'public.throughline_inference_attempts'::regclass,
      'public.throughline_note_revisions'::regclass,
      'public.throughline_evaluations'::regclass,
      'public.throughline_evaluation_contributions'::regclass,
      'public.throughline_evaluation_text_quarantine'::regclass,
      'public.throughline_evaluation_corpus_cases'::regclass,
      'public.throughline_evaluation_corpus_events'::regclass
    )
      and not relrowsecurity
  ),
  'all lineage and evaluation tables have RLS enabled'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'throughline_inference_contracts', 'throughline_processing_operations',
      'throughline_inference_attempts', 'throughline_note_revisions',
      'throughline_evaluations', 'throughline_evaluation_contributions',
      'throughline_evaluation_text_quarantine', 'throughline_evaluation_corpus_cases',
      'throughline_evaluation_corpus_events'
    ]) table_name
    cross join unnest(array['anon', 'authenticated']) role_name
    where has_table_privilege(role_name, format('public.%I', table_name), 'SELECT,INSERT,UPDATE,DELETE')
  ),
  'client roles have no lineage or private evaluation table access'
);

select ok(
  has_function_privilege('service_role', 'public.throughline_commit_processing_v1(jsonb)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.throughline_commit_evaluation_v1(jsonb)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.throughline_materialize_evaluation_corpus_v1(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.throughline_commit_processing_v1(jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.throughline_commit_evaluation_v1(jsonb)', 'EXECUTE'),
  'RPC execution is service-only'
);

select ok(
  not exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname like 'throughline_%_v1'
      and not (coalesce(proconfig, '{}') @> array['search_path=""'])
  ),
  'all versioned RPCs use a fixed empty search path'
);

select throws_ok(
  $$ insert into public.throughline_processing_operations (
       operation_id, recording_id, inference_contract_id, status,
       safe_failure_code, started_at, finished_at
     ) values (
       '00000000-0000-4000-8000-000000000204', 'rec_eval_immutable',
       '00000000-0000-4000-8000-000000000201', 'succeeded',
       'timeout', now(), now()
     ) $$,
  '23514', null, 'successful operations cannot carry a failure code'
);

insert into public.throughline_recordings (
  id, user_id, created_at, status, processing_status, recording
) values (
  'rec_eval_delete', 'test-user', now(), 'ready', 'processed', '{}'::jsonb
);
insert into public.throughline_processing_operations (
  operation_id, recording_id, inference_contract_id, status, started_at, finished_at
) values (
  '00000000-0000-4000-8000-000000000205', 'rec_eval_delete',
  '00000000-0000-4000-8000-000000000201', 'succeeded', now(), now()
);
update public.throughline_recordings
set current_processing_operation_id = '00000000-0000-4000-8000-000000000205'
where id = 'rec_eval_delete';
select lives_ok(
  $$ delete from public.throughline_recordings where id = 'rec_eval_delete' $$,
  'recording deletion safely clears the pointer cycle and cascades private lineage'
);

select * from finish();
rollback;
