begin;

create extension if not exists pgtap with schema extensions;
select plan(44);

select has_column(
  'public', 'throughline_recordings', 'evaluation_retention_claim_token',
  'recordings carry an exact retention claim token'
);
select has_column(
  'public', 'throughline_recordings', 'evaluation_retention_claimed_at',
  'recordings carry the server claim timestamp'
);
select has_column(
  'public', 'throughline_recordings', 'evaluation_retention_claim_expires_at',
  'recordings carry the server claim expiry'
);
select has_column(
  'public', 'throughline_recordings', 'evaluation_retention_claim_reason',
  'recordings carry the server-derived claim reason'
);
select has_column(
  'public', 'throughline_recordings', 'evaluation_retention_ordinary_cutoff',
  'recordings bind the ordinary cutoff used by the claim'
);
select has_column(
  'public', 'throughline_recordings', 'evaluation_retention_eligibility_cutoff',
  'recordings bind the eligibility cutoff used by the claim'
);
select has_column(
  'public', 'throughline_recordings', 'evaluation_retention_finalized_at',
  'recordings retain exact-token finalize state'
);
select has_index(
  'public', 'throughline_recordings',
  'throughline_recordings_evaluation_retention_claim_token_idx',
  'retention claim tokens are explicitly indexed'
);
select has_index(
  'public', 'throughline_recordings',
  'throughline_recordings_evaluation_retention_claim_expiry_idx',
  'stale retention claims are explicitly indexed'
);
select has_index(
  'public', 'throughline_recordings',
  'throughline_recordings_stored_audio_created_at_idx',
  'stored-audio retention candidates are explicitly indexed'
);
select has_function(
  'public', 'throughline_claim_retention_candidates_v1',
  array[
    'timestamp with time zone', 'timestamp with time zone', 'integer', 'integer'
  ],
  'bounded retention claim RPC exists'
);
select has_function(
  'public', 'throughline_finalize_retention_claim_v1', array['jsonb'],
  'exact-token retention finalize RPC exists'
);
select has_function(
  'public', 'throughline_release_retention_claim_v1', array['jsonb'],
  'exact-token retention release RPC exists'
);
select has_function(
  'public', 'throughline_active_evaluation_eligibility_count_v1', array[]::text[],
  'active eligibility aggregate RPC exists'
);

select ok(
  not exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'throughline_claim_retention_candidates_v1',
        'throughline_finalize_retention_claim_v1',
        'throughline_release_retention_claim_v1',
        'throughline_active_evaluation_eligibility_count_v1'
      )
      and not (coalesce(proconfig, '{}') @> array['search_path=""'])
  ),
  'all retention claim RPCs use a fixed empty search path'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.throughline_claim_retention_candidates_v1(timestamptz,timestamptz,integer,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.throughline_finalize_retention_claim_v1(jsonb)', 'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.throughline_release_retention_claim_v1(jsonb)', 'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.throughline_active_evaluation_eligibility_count_v1()', 'EXECUTE'
  ),
  'service role can execute every retention claim RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.throughline_claim_retention_candidates_v1(timestamptz,timestamptz,integer,integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.throughline_finalize_retention_claim_v1(jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'anon', 'public.throughline_release_retention_claim_v1(jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.throughline_active_evaluation_eligibility_count_v1()', 'EXECUTE'
  ),
  'client roles cannot execute or observe retention claim RPCs'
);
select ok(
  pg_get_functiondef(
    'public.throughline_claim_retention_candidates_v1(timestamptz,timestamptz,integer,integer)'::regprocedure
  ) ilike '%for update of recording skip locked%',
  'claim selection uses non-blocking row locks'
);
select ok(
  pg_get_functiondef(
    'public.throughline_claim_retention_candidates_v1(timestamptz,timestamptz,integer,integer)'::regprocedure
  ) ~* '(?s)for v_recording_id in.*for update of recording skip locked.*end loop;.*return query.*throughline_evaluation_contributions',
  'claim eligibility is rechecked in a later statement after row locking'
);


insert into auth.users (id)
values ('00000000-0000-4000-8000-000000001001');

insert into public.throughline_recordings (
  id, user_id, auth_user_id, created_at, duration_seconds, status,
  processing_status, transcript_raw, structured_note, audio, recording
) values
(
  'rec_claim_standard', 'synthetic-user',
  '00000000-0000-4000-8000-000000001001', now() - interval '60 days',
  1, 'ready', 'processed', null, '{}'::jsonb,
  jsonb_build_object(
    'stored', true, 'storage', 'supabase',
    'bucket', 'throughline-audio', 'object_path', 'synthetic/standard.m4a',
    'mime_type', 'audio/m4a', 'sha256', repeat('a', 64)
  ),
  '{}'::jsonb
),
(
  'rec_claim_protected', 'synthetic-user',
  '00000000-0000-4000-8000-000000001001', now() - interval '59 days',
  1, 'ready', 'processed', null, '{}'::jsonb,
  jsonb_build_object(
    'stored', true, 'storage', 'supabase',
    'bucket', 'throughline-audio', 'object_path', 'synthetic/protected.m4a',
    'mime_type', 'audio/m4a', 'sha256', repeat('b', 64)
  ),
  '{}'::jsonb
),
(
  'rec_claim_retry', 'synthetic-user',
  '00000000-0000-4000-8000-000000001001', now() - interval '58 days',
  1, 'ready', 'processed', null, '{}'::jsonb,
  jsonb_build_object(
    'stored', true, 'storage', 'supabase',
    'bucket', 'throughline-audio', 'object_path', 'synthetic/retry.m4a',
    'mime_type', 'audio/m4a', 'sha256', repeat('c', 64)
  ),
  '{}'::jsonb
);

insert into public.throughline_inference_contracts (
  id, contract_sha256, contract_version, provider, transcription_model,
  extraction_model, prompt_sha256, schema_sha256, normalizer_sha256,
  canonical_keyset_sha256, contract_snapshot
) values (
  '00000000-0000-4000-8000-000000001002', repeat('0', 64), 'v1',
  'synthetic', 'synthetic', 'synthetic', repeat('1', 64), repeat('2', 64),
  repeat('3', 64), repeat('4', 64), '{}'::jsonb
);

insert into public.throughline_processing_operations (
  operation_id, recording_id, inference_contract_id, status, started_at,
  finished_at
) values
(
  '00000000-0000-4000-8000-000000001003', 'rec_claim_standard',
  '00000000-0000-4000-8000-000000001002', 'succeeded', now(), now()
),
(
  '00000000-0000-4000-8000-000000001004', 'rec_claim_protected',
  '00000000-0000-4000-8000-000000001002', 'succeeded', now(), now()
),
(
  '00000000-0000-4000-8000-000000001005', 'rec_claim_retry',
  '00000000-0000-4000-8000-000000001002', 'succeeded', now(), now()
);

insert into public.throughline_note_revisions (
  revision_id, recording_id, processing_operation_id, revision_kind,
  canonical_snapshot, canonical_output_sha256, production_schema_sha256,
  production_normalizer_sha256, canonical_keyset_sha256
) values
(
  '00000000-0000-4000-8000-000000001006', 'rec_claim_standard',
  '00000000-0000-4000-8000-000000001003', 'original_model',
  jsonb_build_object(
    'type', 'freeform', 'title', '', 'summary', '',
    'most_important', '[]'::jsonb, 'todos', '[]'::jsonb,
    'priorities', '[]'::jsonb, 'intentions', '[]'::jsonb,
    'accomplishments', '[]'::jsonb, 'tomorrow_todos', '[]'::jsonb,
    'mood', null, 'people', '[]'::jsonb, 'projects', '[]'::jsonb,
    'tags', '[]'::jsonb, 'centers_of_balance', '[]'::jsonb
  ), repeat('5', 64), repeat('2', 64), repeat('3', 64), repeat('4', 64)
),
(
  '00000000-0000-4000-8000-000000001007', 'rec_claim_protected',
  '00000000-0000-4000-8000-000000001004', 'original_model',
  jsonb_build_object(
    'type', 'freeform', 'title', '', 'summary', '',
    'most_important', '[]'::jsonb, 'todos', '[]'::jsonb,
    'priorities', '[]'::jsonb, 'intentions', '[]'::jsonb,
    'accomplishments', '[]'::jsonb, 'tomorrow_todos', '[]'::jsonb,
    'mood', null, 'people', '[]'::jsonb, 'projects', '[]'::jsonb,
    'tags', '[]'::jsonb, 'centers_of_balance', '[]'::jsonb
  ), repeat('6', 64), repeat('2', 64), repeat('3', 64), repeat('4', 64)
),
(
  '00000000-0000-4000-8000-000000001008', 'rec_claim_retry',
  '00000000-0000-4000-8000-000000001005', 'original_model',
  jsonb_build_object(
    'type', 'freeform', 'title', '', 'summary', '',
    'most_important', '[]'::jsonb, 'todos', '[]'::jsonb,
    'priorities', '[]'::jsonb, 'intentions', '[]'::jsonb,
    'accomplishments', '[]'::jsonb, 'tomorrow_todos', '[]'::jsonb,
    'mood', null, 'people', '[]'::jsonb, 'projects', '[]'::jsonb,
    'tags', '[]'::jsonb, 'centers_of_balance', '[]'::jsonb
  ), repeat('7', 64), repeat('2', 64), repeat('3', 64), repeat('4', 64));

update public.throughline_recordings
set current_processing_operation_id = case id
      when 'rec_claim_standard' then '00000000-0000-4000-8000-000000001003'::uuid
      when 'rec_claim_protected' then '00000000-0000-4000-8000-000000001004'::uuid
      else '00000000-0000-4000-8000-000000001005'::uuid
    end,
    current_note_revision_id = case id
      when 'rec_claim_standard' then '00000000-0000-4000-8000-000000001006'::uuid
      when 'rec_claim_protected' then '00000000-0000-4000-8000-000000001007'::uuid
      else '00000000-0000-4000-8000-000000001008'::uuid
    end
where id in ('rec_claim_standard', 'rec_claim_protected', 'rec_claim_retry');

insert into public.throughline_evaluation_contributions (
  contribution_id, recording_id, auth_user_id, note_revision_id,
  idempotency_key, event_kind, eligibility_source, notice_version,
  disclosure_version, policy_version, created_at
) values (
  '00000000-0000-4000-8000-000000001009', 'rec_claim_protected',
  '00000000-0000-4000-8000-000000001001',
  '00000000-0000-4000-8000-000000001007',
  '00000000-0000-4000-8000-000000001010', 'created',
  'content_correction', 'private_evaluation_notice_v1',
  'private_evaluation_disclosure_v1', 'private_evaluation_policy_v1',
  now() - interval '10 days'
);

insert into public.throughline_evaluation_contributions (
  contribution_id, recording_id, auth_user_id, note_revision_id,
  idempotency_key, event_kind, eligibility_source, notice_version,
  disclosure_version, policy_version, created_at
) values (
  '00000000-0000-4000-8000-000000001021', 'rec_claim_retry',
  '00000000-0000-4000-8000-000000001001',
  '00000000-0000-4000-8000-000000001008',
  '00000000-0000-4000-8000-000000001022', 'created',
  'content_correction', 'private_evaluation_notice_v1',
  'private_evaluation_disclosure_v1', 'private_evaluation_policy_v1',
  now() - interval '120 days'
);

select is(
  public.throughline_active_evaluation_eligibility_count_v1(), 2::bigint,
  'aggregate compatibility gate counts active current eligibility'
);

create temporary table first_claim as
select * from public.throughline_claim_retention_candidates_v1(
  now() - interval '30 days', now() - interval '90 days', 1, 300
);
select is(
  (select recording_id from first_claim), 'rec_claim_standard',
  'first worker atomically claims the oldest deletable row'
);
select is(
  (select count(*)::integer from first_claim
   where candidate_reason = 'historical_or_no_active_contribution'
     and claim_token is not null and claim_expires_at > now()),
  1,
  'claim returns one exact live token and server-derived reason'
);
select is(
  (select count(*)::integer from public.throughline_recordings
   where id = 'rec_claim_protected'
     and evaluation_retention_claim_token is not null),
  0,
  'active protected audio is never claimed for deletion'
);

create temporary table second_claim as
select * from public.throughline_claim_retention_candidates_v1(
  now() - interval '30 days', now() - interval '90 days', 1, 300
);
select isnt(
  (select recording_id from second_claim),
  (select recording_id from first_claim),
  'a second worker cannot claim the row already owned by the first worker'
);
select is(
  (select candidate_reason from second_claim), 'eligibility_ended',
  'an active contribution before the rollout cutoff is claimed for cleanup'
);

create temporary table owner_payloads (name text primary key, payload jsonb not null);
insert into owner_payloads values
(
  'evaluation',
  jsonb_build_object(
    'evaluation_id', '00000000-0000-4000-8000-000000001011',
    'recording_id', 'rec_claim_standard',
    'auth_user_id', '00000000-0000-4000-8000-000000001001',
    'evaluated_revision_id', '00000000-0000-4000-8000-000000001006',
    'idempotency_key', '00000000-0000-4000-8000-000000001012',
    'evaluator_kind', 'recording_user',
    'rubric_version', 'throughline_extraction_quality_v1',
    'notice_version', 'private_evaluation_notice_v1',
    'disclosure_version', 'private_evaluation_disclosure_v1',
    'policy_version', 'private_evaluation_policy_v1',
    'score', 4, 'issue_codes', '[]'::jsonb, 'agent_ready', false,
    'agent_readiness_preview', null,
    'contribution', jsonb_build_object(
      'contribution_id', '00000000-0000-4000-8000-000000001013',
      'idempotency_key', '00000000-0000-4000-8000-000000001012'
    )
  )
),
(
  'correction',
  jsonb_build_object(
    'recording_id', 'rec_claim_standard',
    'auth_user_id', '00000000-0000-4000-8000-000000001001',
    'idempotency_key', '00000000-0000-4000-8000-000000001014',
    'expected_current_revision_id', '00000000-0000-4000-8000-000000001006',
    'transcript_after', null, 'material_change', true,
    'eligibility_source', 'content_correction',
    'revision', jsonb_build_object(
      'revision_id', '00000000-0000-4000-8000-000000001015',
      'recording_id', 'rec_claim_standard',
      'processing_operation_id', '00000000-0000-4000-8000-000000001003',
      'base_revision_id', '00000000-0000-4000-8000-000000001006',
      'revision_kind', 'user_content_correction',
      'canonical_snapshot', (
        select canonical_snapshot || jsonb_build_object('title', 'synthetic')
        from public.throughline_note_revisions
        where revision_id = '00000000-0000-4000-8000-000000001006'
      ),
      'canonical_output_sha256', repeat('8', 64),
      'production_schema_sha256', repeat('2', 64),
      'production_normalizer_sha256', repeat('3', 64),
      'canonical_keyset_sha256', repeat('4', 64),
      'editable_correction_mask', jsonb_build_array('title'),
      'transcript_explicitly_corrected', false, 'created_at', now()
    ),
    'contribution', jsonb_build_object(
      'contribution_id', '00000000-0000-4000-8000-000000001016',
      'recording_id', 'rec_claim_standard',
      'auth_user_id', '00000000-0000-4000-8000-000000001001',
      'note_revision_id', '00000000-0000-4000-8000-000000001015',
      'idempotency_key', '00000000-0000-4000-8000-000000001014',
      'event_kind', 'created', 'eligibility_source', 'content_correction',
      'notice_version', 'private_evaluation_notice_v1',
      'disclosure_version', 'private_evaluation_disclosure_v1',
      'policy_version', 'private_evaluation_policy_v1', 'created_at', now()
    )
  )
),
(
  'noop',
  jsonb_build_object(
    'recording_id', 'rec_claim_standard',
    'auth_user_id', '00000000-0000-4000-8000-000000001001',
    'idempotency_key', '00000000-0000-4000-8000-000000001017',
    'expected_current_revision_id', '00000000-0000-4000-8000-000000001006',
    'material_change', false
  )
),
(
  'action_state',
  jsonb_build_object(
    'recording_id', 'rec_claim_standard',
    'auth_user_id', '00000000-0000-4000-8000-000000001001',
    'idempotency_key', '00000000-0000-4000-8000-000000001018',
    'expected_current_revision_id', '00000000-0000-4000-8000-000000001006',
    'transcript_after', '', 'material_change', true,
    'eligibility_source', null,
    'revision', jsonb_build_object(
      'revision_id', '00000000-0000-4000-8000-000000001019',
      'recording_id', 'rec_claim_standard',
      'processing_operation_id', '00000000-0000-4000-8000-000000001003',
      'base_revision_id', '00000000-0000-4000-8000-000000001006',
      'revision_kind', 'action_state',
      'canonical_snapshot', (
        select canonical_snapshot
        from public.throughline_note_revisions
        where revision_id = '00000000-0000-4000-8000-000000001006'
      ),
      'canonical_output_sha256', repeat('9', 64),
      'production_schema_sha256', repeat('2', 64),
      'production_normalizer_sha256', repeat('3', 64),
      'canonical_keyset_sha256', repeat('4', 64),
      'editable_correction_mask', '[]'::jsonb,
      'transcript_explicitly_corrected', false, 'created_at', now()
    ),
    'contribution', null
  )
);

select throws_ok(
  $$ select public.throughline_commit_evaluation_v1(
       (select payload from owner_payloads where name = 'evaluation')
     ) $$,
  'P0001', 'retention_deletion_claim_live',
  'a live deletion claim rejects a new explicit evaluation contribution'
);
select throws_ok(
  $$ select public.throughline_commit_user_mutation_v1(
       (select payload from owner_payloads where name = 'correction')
     ) $$,
  'P0001', 'retention_deletion_claim_live',
  'a live deletion claim rejects an eligibility-creating content correction'
);
select is(
  public.throughline_commit_user_mutation_v1(
    (select payload from owner_payloads where name = 'noop')
  )->>'eligible',
  'false',
  'a claimed recording keeps the legacy no-op mutation path compatible'
);
select lives_ok(
  $$ select public.throughline_commit_user_mutation_v1(
       (select payload from owner_payloads where name = 'action_state')
     ) $$,
  'a claimed recording keeps the non-eligible action-state path compatible'
);
select is(
  (select count(*)::integer
   from public.throughline_evaluation_contributions
   where note_revision_id = '00000000-0000-4000-8000-000000001019'),
  0,
  'action-state compatibility creates no evaluation eligibility'
);

select throws_ok(
  $$ select public.throughline_finalize_retention_claim_v1(
       jsonb_build_object(
         'recording_id', 'rec_claim_standard',
         'claim_token', '00000000-0000-4000-8000-000000001099',
         'source_audio_deleted', true,
         'raw_artifacts_deleted', false,
         'raw_artifacts_deleted_count', 0
       )
     ) $$,
  'P0001', 'retention_claim_token_mismatch',
  'finalize rejects a wrong claim token'
);

select throws_ok(
  $$ select public.throughline_finalize_retention_claim_v1(
       jsonb_build_object(
         'recording_id', 'rec_claim_retry',
         'claim_token', (select claim_token from second_claim),
         'source_audio_deleted', true,
         'raw_artifacts_deleted', false,
         'raw_artifacts_deleted_count', 0
       )
     ) $$,
  '22023', 'retention_claim_cleanup_required',
  'eligibility-ended finalize requires private-artifact cleanup proof'
);

create temporary table release_result as
select public.throughline_release_retention_claim_v1(jsonb_build_object(
  'recording_id', 'rec_claim_retry',
  'claim_token', (select claim_token from second_claim)
)) as result;
select is(
  (select result->>'released' from release_result), 'true',
  'exact-token release succeeds after a retryable external failure'
);
select is(
  (select audio->>'stored' from public.throughline_recordings
   where id = 'rec_claim_retry'),
  'true',
  'release preserves stored audio and retryability'
);

create temporary table retry_claim as
select * from public.throughline_claim_retention_candidates_v1(
  now() - interval '30 days', now() - interval '90 days', 1, 300
);
select is(
  (select recording_id from retry_claim), 'rec_claim_retry',
  'a released row can be claimed again'
);
select isnt(
  (select claim_token::text from retry_claim),
  (select claim_token::text from second_claim),
  'retry receives a fresh exact token'
);

update public.throughline_recordings
set evaluation_retention_claimed_at = now() - interval '2 minutes',
    evaluation_retention_claim_expires_at = now() - interval '1 minute'
where id = 'rec_claim_retry';
select throws_ok(
  $$ select public.throughline_commit_evaluation_v1(
       jsonb_set(
         jsonb_set(
           jsonb_set(
             (select payload from owner_payloads where name = 'evaluation'),
             '{evaluation_id}',
             '"00000000-0000-4000-8000-000000001020"'::jsonb
           ),
           '{recording_id}', '"rec_claim_retry"'::jsonb
         ),
         '{evaluated_revision_id}',
         '"00000000-0000-4000-8000-000000001008"'::jsonb
       )
     ) $$,
  'P0001', 'retention_deletion_claim_live',
  'an expired but unreclaimed claim still blocks owner eligibility creation'
);
create temporary table stale_reclaim as
select * from public.throughline_claim_retention_candidates_v1(
  now() - interval '30 days', now() - interval '90 days', 1, 300
);
select is(
  (select recording_id from stale_reclaim), 'rec_claim_retry',
  'an expired claim is safely reclaimed'
);
select isnt(
  (select claim_token::text from stale_reclaim),
  (select claim_token::text from retry_claim),
  'stale takeover replaces the old token'
);
select throws_ok(
  $$ select public.throughline_finalize_retention_claim_v1(
       jsonb_build_object(
         'recording_id', 'rec_claim_retry',
         'claim_token', (select claim_token from retry_claim),
         'source_audio_deleted', true,
         'raw_artifacts_deleted', false,
         'raw_artifacts_deleted_count', 0
       )
     ) $$,
  'P0001', 'retention_claim_token_mismatch',
  'a stale worker cannot finalize after safe takeover'
);

create temporary table finalize_result as
select public.throughline_finalize_retention_claim_v1(jsonb_build_object(
  'recording_id', 'rec_claim_standard',
  'claim_token', (select claim_token from first_claim),
  'source_audio_deleted', true,
  'raw_artifacts_deleted', false,
  'raw_artifacts_deleted_count', 0
)) as result;
select is(
  (select result->>'idempotent' from finalize_result), 'false',
  'exact-token finalize commits once after external deletion'
);
select is(
  public.throughline_finalize_retention_claim_v1(jsonb_build_object(
    'recording_id', 'rec_claim_standard',
    'claim_token', (select claim_token from first_claim),
    'source_audio_deleted', true,
    'raw_artifacts_deleted', false,
    'raw_artifacts_deleted_count', 0
  ))->>'idempotent',
  'true',
  'repeating exact-token finalize is idempotent'
);
select is(
  (select audio->>'stored' from public.throughline_recordings
   where id = 'rec_claim_standard'),
  'false',
  'finalize expires source-audio metadata atomically'
);
select ok(
  position('rec_claim_standard' in (
    select result::text from finalize_result
  )) = 0
  and position((select claim_token::text from first_claim) in (
    select result::text from finalize_result
  )) = 0,
  'finalize response exposes aggregates but no recording id or claim token'
);

select * from finish();
rollback;
