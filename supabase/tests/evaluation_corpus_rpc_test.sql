begin;

create extension if not exists pgtap with schema extensions;
select plan(48);

select has_table(
  'public', 'throughline_evaluation_artifact_receipts',
  'artifact receipt registry exists'
);
select columns_are(
  'public', 'throughline_evaluation_artifact_receipts',
  array[
    'materializer_receipt_sha256', 'state', 'reserved_at',
    'cleanup_claim_token', 'cleanup_claimed_at', 'cleanup_claim_expires_at',
    'committed_at', 'deleted_at', 'committed_case_count'
  ],
  'artifact receipt registry is content-free and location-free'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.throughline_evaluation_artifact_receipts'::regclass
  ),
  'artifact receipt registry has RLS enabled'
);
select ok(
  not exists (
    select 1
    from unnest(array['anon', 'authenticated']) as role_name
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as privilege_name
    where has_table_privilege(
      role_name,
      'public.throughline_evaluation_artifact_receipts',
      privilege_name
    )
  ),
  'client roles cannot directly read or mutate artifact receipts'
);
select has_function(
  'public', 'throughline_reserve_evaluation_artifact_receipt_v1',
  array['jsonb'], 'receipt reservation RPC exists'
);
select has_function(
  'public', 'throughline_claim_stale_evaluation_artifact_receipts_v1',
  array['timestamp with time zone', 'integer', 'integer'],
  'bounded stale-pending claim RPC exists'
);
select has_function(
  'public', 'throughline_acknowledge_evaluation_artifact_deletion_v1',
  array['jsonb'], 'external-deletion acknowledgment RPC exists'
);
select has_function(
  'public', 'throughline_release_evaluation_artifact_cleanup_claim_v1',
  array['jsonb'], 'failed-cleanup claim release RPC exists'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.throughline_reserve_evaluation_artifact_receipt_v1(jsonb)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.throughline_claim_stale_evaluation_artifact_receipts_v1(timestamptz,integer,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.throughline_acknowledge_evaluation_artifact_deletion_v1(jsonb)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.throughline_release_evaluation_artifact_cleanup_claim_v1(jsonb)',
    'EXECUTE'
  ),
  'service role can execute every artifact receipt RPC'
);
select ok(
  not exists (
    select 1
    from unnest(array['anon', 'authenticated']) as role_name
    cross join unnest(array[
      'public.throughline_reserve_evaluation_artifact_receipt_v1(jsonb)',
      'public.throughline_claim_stale_evaluation_artifact_receipts_v1(timestamptz,integer,integer)',
      'public.throughline_acknowledge_evaluation_artifact_deletion_v1(jsonb)',
      'public.throughline_release_evaluation_artifact_cleanup_claim_v1(jsonb)'
    ]) as function_signature
    where has_function_privilege(role_name, function_signature, 'EXECUTE')
  ),
  'client roles cannot execute or observe artifact receipt RPCs'
);

insert into auth.users (id)
values ('00000000-0000-4000-8000-000000000801');

insert into public.throughline_recordings (
  id, user_id, auth_user_id, created_at, duration_seconds, status,
  processing_status, audio, recording
) values (
  'rec_corpus_rpc', 'test-user',
  '00000000-0000-4000-8000-000000000801', now(), 2.5, 'ready',
  'processed', jsonb_build_object(
    'stored', true,
    'object_path', 'private/rec-corpus.m4a',
    'mime_type', 'audio/m4a',
    'sha256', repeat('a', 64)
  ), '{}'::jsonb
);

insert into public.throughline_inference_contracts (
  id, contract_sha256, contract_version, provider, transcription_model,
  extraction_model, prompt_sha256, schema_sha256, normalizer_sha256,
  canonical_keyset_sha256, contract_snapshot
) values (
  '00000000-0000-4000-8000-000000000802', repeat('0', 64), 'v1',
  'test', 'test-transcription', 'test-extraction', repeat('1', 64),
  repeat('2', 64), repeat('3', 64), repeat('4', 64), '{}'::jsonb
);

insert into public.throughline_processing_operations (
  operation_id, recording_id, inference_contract_id, status, started_at,
  finished_at
) values (
  '00000000-0000-4000-8000-000000000803', 'rec_corpus_rpc',
  '00000000-0000-4000-8000-000000000802', 'succeeded', now(), now()
);

insert into public.throughline_note_revisions (
  revision_id, recording_id, processing_operation_id, revision_kind,
  canonical_snapshot, canonical_output_sha256, production_schema_sha256,
  production_normalizer_sha256, canonical_keyset_sha256
) values (
  '00000000-0000-4000-8000-000000000804', 'rec_corpus_rpc',
  '00000000-0000-4000-8000-000000000803', 'original_model',
  jsonb_build_object(
    'type', 'freeform', 'title', 'Corpus', 'summary', 'Corpus summary',
    'most_important', jsonb_build_array('Corpus point'), 'todos', '[]'::jsonb,
    'priorities', '[]'::jsonb, 'intentions', '[]'::jsonb,
    'accomplishments', '[]'::jsonb, 'tomorrow_todos', '[]'::jsonb,
    'mood', 'neutral', 'people', '[]'::jsonb, 'projects', '[]'::jsonb,
    'tags', '[]'::jsonb, 'centers_of_balance', '[]'::jsonb
  ), repeat('5', 64), repeat('2', 64), repeat('3', 64), repeat('4', 64)
);

update public.throughline_recordings set
  current_processing_operation_id = '00000000-0000-4000-8000-000000000803',
  current_note_revision_id = '00000000-0000-4000-8000-000000000804'
where id = 'rec_corpus_rpc';

insert into public.throughline_evaluations (
  evaluation_id, recording_id, auth_user_id, processing_operation_id,
  evaluated_revision_id, idempotency_key, evaluator_kind, rubric_version,
  notice_version, disclosure_version, score, issue_codes, agent_ready
) values (
  '00000000-0000-4000-8000-000000000805', 'rec_corpus_rpc',
  '00000000-0000-4000-8000-000000000801',
  '00000000-0000-4000-8000-000000000803',
  '00000000-0000-4000-8000-000000000804',
  '00000000-0000-4000-8000-000000000806', 'recording_user',
  'throughline_extraction_quality_v1', 'private_evaluation_notice_v1',
  'private_evaluation_disclosure_v1', 4, array['weak_summary'], false
);

insert into public.throughline_evaluation_contributions (
  contribution_id, recording_id, auth_user_id, evaluation_id,
  note_revision_id, idempotency_key, event_kind, eligibility_source,
  notice_version, disclosure_version, policy_version
) values (
  '00000000-0000-4000-8000-000000000807', 'rec_corpus_rpc',
  '00000000-0000-4000-8000-000000000801',
  '00000000-0000-4000-8000-000000000805',
  '00000000-0000-4000-8000-000000000804',
  '00000000-0000-4000-8000-000000000806', 'created',
  'explicit_grade', 'private_evaluation_notice_v1',
  'private_evaluation_disclosure_v1', 'private_evaluation_policy_v1'
);

create temporary table corpus_prepare as
select public.throughline_materialize_evaluation_corpus_v1(
  jsonb_build_object(
    'mode', 'prepare',
    'policy_version', 'private_evaluation_policy_v1',
    'production_schema_sha256', repeat('2', 64),
    'production_normalizer_sha256', repeat('3', 64),
    'canonical_keyset_sha256', repeat('4', 64)
  )
) as result;

create temporary table receipt_reserve as
select public.throughline_reserve_evaluation_artifact_receipt_v1(
  jsonb_build_object('materializer_receipt_sha256', repeat('9', 64))
) as result;

select is(
  (select result from receipt_reserve),
  jsonb_build_object('state', 'pending', 'idempotent', false),
  'receipt is reserved as pending before artifact publication'
);
select is(
  (
    select state
    from public.throughline_evaluation_artifact_receipts
    where materializer_receipt_sha256 = repeat('9', 64)
  ),
  'pending',
  'reservation persists only the pending receipt state'
);
select is(
  public.throughline_reserve_evaluation_artifact_receipt_v1(
    jsonb_build_object('materializer_receipt_sha256', repeat('9', 64))
  )->>'idempotent',
  'true',
  'repeating the same pending reservation is idempotent'
);
select throws_ok(
  $$ select public.throughline_reserve_evaluation_artifact_receipt_v1(
       jsonb_build_object('materializer_receipt_sha256', repeat('A', 64))
     ) $$,
  '22023', 'artifact_receipt_reservation_invalid',
  'receipt reservation rejects non-lowercase SHA-256'
);
select throws_ok(
  $$ select public.throughline_materialize_evaluation_corpus_v1(
       jsonb_build_object(
         'mode', 'commit',
         'policy_version', 'private_evaluation_policy_v1',
         'production_schema_sha256', repeat('2', 64),
         'production_normalizer_sha256', repeat('3', 64),
         'canonical_keyset_sha256', repeat('4', 64),
         'source_set_sha256', (
           select result->>'source_set_sha256' from corpus_prepare
         ),
         'stable_split_sha256', repeat('6', 64),
         'content_set_sha256', repeat('7', 64),
         'label_contract_set_sha256', repeat('8', 64),
         'materializer_receipt_sha256', repeat('d', 64),
         'materialized_at', '2026-08-22T23:00:00.000Z'
       )
     ) $$,
  'P0001', 'artifact_receipt_not_pending',
  'corpus commit rejects an unreserved receipt before writing cases'
);

select is(
  (select (result->>'case_count')::integer from corpus_prepare),
  1,
  'prepare derives the active case set without caller identifiers'
);
select is(
  (select result->'candidates'->0->>'label_kind' from corpus_prepare),
  'diagnostic_grade',
  'grade without explicit readiness is diagnostic only'
);
select throws_ok(
  $$ select public.throughline_materialize_evaluation_corpus_v1(
       jsonb_build_object(
         'mode', 'prepare',
         'policy_version', 'private_evaluation_policy_v1',
         'production_schema_sha256', repeat('2', 64),
         'production_normalizer_sha256', repeat('3', 64),
         'canonical_keyset_sha256', repeat('4', 64),
         'cases', '[]'::jsonb
       )
     ) $$,
  '22023', 'corpus_request_field_forbidden',
  'caller-supplied case lists are rejected'
);

select lives_ok(
  $$ select public.throughline_materialize_evaluation_corpus_v1(
       jsonb_build_object(
         'mode', 'commit',
         'policy_version', 'private_evaluation_policy_v1',
         'production_schema_sha256', repeat('2', 64),
         'production_normalizer_sha256', repeat('3', 64),
         'canonical_keyset_sha256', repeat('4', 64),
         'source_set_sha256', (
           select result->>'source_set_sha256' from corpus_prepare
         ),
         'stable_split_sha256', repeat('6', 64),
         'content_set_sha256', repeat('7', 64),
         'label_contract_set_sha256', repeat('8', 64),
         'materializer_receipt_sha256', repeat('9', 64),
         'materialized_at', '2026-08-22T23:00:00.000Z'
       )
     ) $$,
  'commit rederives and persists the unchanged active set'
);
select is(
  (select label_kind from public.throughline_evaluation_corpus_cases
   where contribution_id = '00000000-0000-4000-8000-000000000807'),
  'diagnostic_grade',
  'persisted case retains the server-derived label kind'
);
select is(
  (
    select state || ':' || committed_case_count::text
    from public.throughline_evaluation_artifact_receipts
    where materializer_receipt_sha256 = repeat('9', 64)
  ),
  'committed:1',
  'corpus commit atomically binds the committed receipt and case count'
);
select is(
  public.throughline_materialize_evaluation_corpus_v1(
    jsonb_build_object(
      'mode', 'commit',
      'policy_version', 'private_evaluation_policy_v1',
      'production_schema_sha256', repeat('2', 64),
      'production_normalizer_sha256', repeat('3', 64),
      'canonical_keyset_sha256', repeat('4', 64),
      'source_set_sha256', (
        select result->>'source_set_sha256' from corpus_prepare
      ),
      'stable_split_sha256', repeat('6', 64),
      'content_set_sha256', repeat('7', 64),
      'label_contract_set_sha256', repeat('8', 64),
      'materializer_receipt_sha256', repeat('9', 64),
      'materialized_at', '2026-08-22T23:00:00.000Z'
    )
  )->>'idempotent',
  'true',
  'exact corpus commit retry is idempotent'
);
select is(
  (select count(*)::integer from public.throughline_evaluation_corpus_events
   where event_kind = 'materialized' and receipt_sha256 = repeat('9', 64)),
  1,
  'materialization appends one receipt-bound event'
);
select throws_ok(
  $$ select public.throughline_reserve_evaluation_artifact_receipt_v1(
       jsonb_build_object('materializer_receipt_sha256', repeat('9', 64))
     ) $$,
  'P0001', 'artifact_receipt_terminal',
  'a committed receipt cannot be reserved again'
);
select throws_ok(
  $$ select public.throughline_acknowledge_evaluation_artifact_deletion_v1(
       jsonb_build_object(
         'materializer_receipt_sha256', repeat('9', 64),
         'cleanup_claim_token', '00000000-0000-4000-8000-000000000899',
         'deletion_status', 'deleted',
         'deleted_count', 1
       )
     ) $$,
  'P0001', 'artifact_cleanup_claim_mismatch',
  'orphan cleanup cannot delete a committed receipt'
);
select is(
  (
    select result->'candidates'->0->>'stable_split'
    from corpus_prepare
  ),
  (
    select public.throughline_materialize_evaluation_corpus_v1(
      jsonb_build_object(
        'mode', 'prepare',
        'policy_version', 'private_evaluation_policy_v1',
        'production_schema_sha256', repeat('2', 64),
        'production_normalizer_sha256', repeat('3', 64),
        'canonical_keyset_sha256', repeat('4', 64)
      )
    )->'candidates'->0->>'stable_split'
  ),
  'repeated prepare preserves the stable split'
);

select is(
  (
    select public.throughline_revalidate_evaluation_corpus_v1(
      jsonb_build_object(
        'materializer_receipt_sha256', repeat('9', 64),
        'prediction_bundle_sha256', repeat('b', 64)
      )
    )->>'active_case_count'
  )::integer,
  1,
  'revalidation confirms the still-active materialized set'
);

select lives_ok(
  $$ select public.throughline_reserve_evaluation_artifact_receipt_v1(
       jsonb_build_object('materializer_receipt_sha256', repeat('e', 64))
     );
     select public.throughline_reserve_evaluation_artifact_receipt_v1(
       jsonb_build_object('materializer_receipt_sha256', repeat('f', 64))
     ) $$,
  'two orphan candidates can be reserved without caller locations'
);
select is(
  (
    select count(*)::integer
    from public.throughline_claim_stale_evaluation_artifact_receipts_v1(
      (
        select reserved_at
        from public.throughline_evaluation_artifact_receipts
        where materializer_receipt_sha256 = repeat('e', 64)
      ),
      100,
      60
    )
    where materializer_receipt_sha256 = repeat('e', 64)
  ),
  0,
  'stale claim uses the exact exclusive cutoff'
);
select ok(
  pg_get_functiondef(
    'public.throughline_claim_stale_evaluation_artifact_receipts_v1(timestamptz,integer,integer)'::regprocedure
  ) ilike '%for update of receipt skip locked%',
  'stale cleanup claims use non-blocking row locks'
);

create temporary table cleanup_claim as
select *
from public.throughline_claim_stale_evaluation_artifact_receipts_v1(
  statement_timestamp() + interval '1 second',
  1,
  60
);

select is(
  (
    select count(*)::integer from cleanup_claim
  ),
  1,
  'stale cleanup claim obeys the caller limit'
);
select is(
  (
    select receipt.state || ':' ||
      (receipt.cleanup_claim_token = claim.cleanup_claim_token)::text || ':' ||
      (receipt.cleanup_claim_expires_at = claim.cleanup_claim_expires_at)::text
    from cleanup_claim as claim
    join public.throughline_evaluation_artifact_receipts as receipt
      using (materializer_receipt_sha256)
  ),
  'deleting:true:true',
  'selection atomically persists the exact cleanup claim before returning it'
);
select throws_ok(
  $$ select public.throughline_materialize_evaluation_corpus_v1(
       jsonb_build_object(
         'mode', 'commit',
         'policy_version', 'private_evaluation_policy_v1',
         'production_schema_sha256', repeat('2', 64),
         'production_normalizer_sha256', repeat('3', 64),
         'canonical_keyset_sha256', repeat('4', 64),
         'source_set_sha256', (
           select result->>'source_set_sha256' from corpus_prepare
         ),
         'stable_split_sha256', repeat('6', 64),
         'content_set_sha256', repeat('7', 64),
         'label_contract_set_sha256', repeat('8', 64),
         'materializer_receipt_sha256', (
           select materializer_receipt_sha256 from cleanup_claim
         ),
         'materialized_at', '2026-08-22T23:00:01.000Z'
       )
     ) $$,
  'P0001', 'artifact_receipt_not_pending',
  'a late corpus commit cannot bind a receipt claimed for cleanup'
);
select throws_ok(
  $$ select *
     from public.throughline_claim_stale_evaluation_artifact_receipts_v1(
       statement_timestamp(), 1, 29
     ) $$,
  '22023', 'artifact_receipt_claim_invalid',
  'stale cleanup claim rejects an unsafe lease'
);
select throws_ok(
  $$ select public.throughline_acknowledge_evaluation_artifact_deletion_v1(
       jsonb_build_object(
         'materializer_receipt_sha256', (
           select materializer_receipt_sha256 from cleanup_claim
         ),
         'cleanup_claim_token', (
           select cleanup_claim_token from cleanup_claim
         ),
         'deletion_status', 'not_found',
         'deleted_count', 1
       )
     ) $$,
  '22023', 'artifact_deletion_proof_invalid',
  'cleanup acknowledgment rejects malformed external deletion proof'
);
select throws_ok(
  $$ select public.throughline_acknowledge_evaluation_artifact_deletion_v1(
       jsonb_build_object(
         'materializer_receipt_sha256', (
           select materializer_receipt_sha256 from cleanup_claim
         ),
         'cleanup_claim_token', '00000000-0000-4000-8000-000000000899',
         'deletion_status', 'not_found',
         'deleted_count', 0
       )
     ) $$,
  'P0001', 'artifact_cleanup_claim_mismatch',
  'cleanup acknowledgment rejects a mismatched claim token'
);
select throws_ok(
  $$ select public.throughline_release_evaluation_artifact_cleanup_claim_v1(
       jsonb_build_object(
         'materializer_receipt_sha256', (
           select materializer_receipt_sha256 from cleanup_claim
         ),
         'cleanup_claim_token', '00000000-0000-4000-8000-000000000899'
       )
     ) $$,
  'P0001', 'artifact_cleanup_claim_mismatch',
  'failed cleanup release rejects a mismatched claim token'
);
select is(
  public.throughline_release_evaluation_artifact_cleanup_claim_v1(
    jsonb_build_object(
      'materializer_receipt_sha256', (
        select materializer_receipt_sha256 from cleanup_claim
      ),
      'cleanup_claim_token', (
        select cleanup_claim_token from cleanup_claim
      )
    )
  ),
  jsonb_build_object('state', 'pending', 'idempotent', false),
  'failed cleanup releases the exact claim for retry'
);
select is(
  (
    select receipt.state || ':' ||
      (receipt.cleanup_claim_token is null)::text
    from cleanup_claim as claim
    join public.throughline_evaluation_artifact_receipts as receipt
      using (materializer_receipt_sha256)
  ),
  'pending:true',
  'released cleanup claim becomes safely retryable'
);

create temporary table cleanup_retry as
select *
from public.throughline_claim_stale_evaluation_artifact_receipts_v1(
  statement_timestamp() + interval '1 second',
  100,
  60
);

select isnt(
  (
    select retry.cleanup_claim_token
    from cleanup_retry as retry
    join cleanup_claim as original using (materializer_receipt_sha256)
  ),
  (select cleanup_claim_token from cleanup_claim),
  'retry receives a fresh cleanup claim token'
);
select is(
  public.throughline_acknowledge_evaluation_artifact_deletion_v1(
    jsonb_build_object(
      'materializer_receipt_sha256', (
        select original.materializer_receipt_sha256 from cleanup_claim as original
      ),
      'cleanup_claim_token', (
        select retry.cleanup_claim_token
        from cleanup_retry as retry
        join cleanup_claim as original using (materializer_receipt_sha256)
      ),
      'deletion_status', 'not_found',
      'deleted_count', 0
    )
  ),
  jsonb_build_object('state', 'deleted', 'idempotent', false),
  'valid external not-found proof deletes a pending orphan receipt'
);
select is(
  (
    select state
    from public.throughline_evaluation_artifact_receipts
    where materializer_receipt_sha256 = (
      select materializer_receipt_sha256 from cleanup_claim
    )
  ),
  'deleted',
  'cleanup acknowledgment persists the terminal deleted state'
);
select is(
  public.throughline_acknowledge_evaluation_artifact_deletion_v1(
    jsonb_build_object(
      'materializer_receipt_sha256', (
        select original.materializer_receipt_sha256 from cleanup_claim as original
      ),
      'cleanup_claim_token', (
        select retry.cleanup_claim_token
        from cleanup_retry as retry
        join cleanup_claim as original using (materializer_receipt_sha256)
      ),
      'deletion_status', 'not_found',
      'deleted_count', 0
    )
  )->>'idempotent',
  'true',
  'repeating valid cleanup acknowledgment is idempotent'
);
select throws_ok(
  $$ select public.throughline_reserve_evaluation_artifact_receipt_v1(
       jsonb_build_object(
         'materializer_receipt_sha256', (
           select materializer_receipt_sha256 from cleanup_claim
         )
       )
     ) $$,
  'P0001', 'artifact_receipt_terminal',
  'a deleted receipt cannot be revived'
);
select is(
  (
    select count(*)::integer
    from public.throughline_claim_stale_evaluation_artifact_receipts_v1(
      statement_timestamp() + interval '1 second',
      100,
      60
    )
    where materializer_receipt_sha256 = repeat('9', 64)
      or materializer_receipt_sha256 = (
        select materializer_receipt_sha256 from cleanup_claim
      )
  ),
  0,
  'stale claims exclude committed and deleted receipts'
);

insert into public.throughline_evaluation_contributions (
  contribution_id, recording_id, auth_user_id, note_revision_id,
  idempotency_key, event_kind, eligibility_source, notice_version,
  disclosure_version, policy_version
)
select
  (
    '10000000-0000-4000-8000-' ||
      lpad(case_number::text, 12, '0')
  )::uuid,
  'rec_corpus_rpc',
  '00000000-0000-4000-8000-000000000801',
  '00000000-0000-4000-8000-000000000804',
  (
    '20000000-0000-4000-8000-' ||
      lpad(case_number::text, 12, '0')
  )::uuid,
  'created', 'explicit_grade', 'private_evaluation_notice_v1',
  'private_evaluation_disclosure_v1', 'private_evaluation_policy_v1'
from generate_series(1, 249) as case_number;

select throws_ok(
  $$ select public.throughline_materialize_evaluation_corpus_v1(
       jsonb_build_object(
         'mode', 'prepare',
         'policy_version', 'private_evaluation_policy_v1',
         'production_schema_sha256', repeat('2', 64),
         'production_normalizer_sha256', repeat('3', 64),
         'canonical_keyset_sha256', repeat('4', 64)
       )
     ) $$,
  'P0001', 'corpus_case_limit_exceeded',
  'prepare rejects a derived corpus that could exceed the deletion cap'
);
select throws_ok(
  $$ select public.throughline_materialize_evaluation_corpus_v1(
       jsonb_build_object(
         'mode', 'commit',
         'policy_version', 'private_evaluation_policy_v1',
         'production_schema_sha256', repeat('2', 64),
         'production_normalizer_sha256', repeat('3', 64),
         'canonical_keyset_sha256', repeat('4', 64),
         'source_set_sha256', repeat('5', 64),
         'stable_split_sha256', repeat('6', 64),
         'content_set_sha256', repeat('7', 64),
         'label_contract_set_sha256', repeat('8', 64),
         'materializer_receipt_sha256', repeat('1', 64),
         'materialized_at', '2026-08-22T23:00:02.000Z'
       )
     ) $$,
  'P0001', 'corpus_case_limit_exceeded',
  'commit rejects a derived corpus that could exceed the deletion cap'
);

insert into public.throughline_evaluation_contributions (
  contribution_id, recording_id, auth_user_id, note_revision_id,
  supersedes_contribution_id, idempotency_key, event_kind,
  eligibility_source, notice_version, disclosure_version, policy_version
) values (
  '00000000-0000-4000-8000-000000000808', 'rec_corpus_rpc',
  '00000000-0000-4000-8000-000000000801',
  '00000000-0000-4000-8000-000000000804',
  '00000000-0000-4000-8000-000000000807',
  '00000000-0000-4000-8000-000000000809', 'withdrawn', null,
  'private_evaluation_notice_v1', 'private_evaluation_disclosure_v1',
  'private_evaluation_policy_v1'
);
select throws_ok(
  $$ select public.throughline_revalidate_evaluation_corpus_v1(
       jsonb_build_object(
         'materializer_receipt_sha256', repeat('9', 64),
         'prediction_bundle_sha256', repeat('c', 64)
       )
     ) $$,
  'P0001', 'stale_or_revoked_case',
  'withdrawal after prediction makes the old receipt unusable'
);

select * from finish();
rollback;
