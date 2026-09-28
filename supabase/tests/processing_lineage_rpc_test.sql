begin;

create extension if not exists pgtap with schema extensions;
select plan(7);

insert into public.throughline_recordings (
  id, user_id, created_at, status, processing_status, recording
) values (
  'rec_lineage_rpc', 'test-user', now(), 'ready', 'processed', '{}'::jsonb
);

create temporary table processing_payloads (payload jsonb not null);
insert into processing_payloads values (jsonb_build_object(
  'contract', jsonb_build_object(
    'id', '00000000-0000-4000-8000-000000000301',
    'contract_sha256', repeat('0', 64),
    'contract_version', 'throughline-inference-contract-v1',
    'provider', jsonb_build_object('name', 'test'),
    'transcription', jsonb_build_object('model', 'test-transcription'),
    'extraction', jsonb_build_object('model', 'test-extraction'),
    'prompt', jsonb_build_object('sha256', repeat('1', 64)),
    'schema', jsonb_build_object(
      'sha256', repeat('2', 64),
      'keyset_sha256', repeat('4', 64)
    ),
    'normalizer', jsonb_build_object('sha256', repeat('3', 64))
  ),
  'operation', jsonb_build_object(
    'operation_id', '00000000-0000-4000-8000-000000000302',
    'recording_id', 'rec_lineage_rpc',
    'inference_contract_id', '00000000-0000-4000-8000-000000000301',
    'status', 'succeeded',
    'safe_failure_code', null,
    'started_at', '2026-08-22T18:00:00.000Z',
    'finished_at', '2026-08-22T18:00:01.000Z'
  ),
  'attempts', jsonb_build_array(jsonb_build_object(
    'attempt_id', '00000000-0000-4000-8000-000000000303',
    'operation_id', '00000000-0000-4000-8000-000000000302',
    'recording_id', 'rec_lineage_rpc',
    'stage', 'extraction',
    'attempt_number', 1,
    'status', 'succeeded',
    'safe_failure_code', null,
    'input_sha256', repeat('7', 64),
    'output_sha256', repeat('6', 64),
    'private_input_snapshot', '{}'::jsonb,
    'private_output_snapshot', '{}'::jsonb,
    'latency_ms', 1000,
    'usage_snapshot', null,
    'cost_microunits', null,
    'started_at', '2026-08-22T18:00:00.000Z',
    'finished_at', '2026-08-22T18:00:01.000Z'
  )),
  'original_revision', jsonb_build_object(
    'revision_id', '00000000-0000-4000-8000-000000000304',
    'recording_id', 'rec_lineage_rpc',
    'processing_operation_id', '00000000-0000-4000-8000-000000000302',
    'revision_kind', 'original_model',
    'canonical_output', jsonb_build_object(
      'type', 'freeform',
      'title', 'Test',
      'summary', 'Test summary',
      'most_important', jsonb_build_array('Test'),
      'todos', '[]'::jsonb,
      'priorities', '[]'::jsonb,
      'intentions', '[]'::jsonb,
      'accomplishments', '[]'::jsonb,
      'tomorrow_todos', '[]'::jsonb,
      'mood', 'neutral',
      'people', '[]'::jsonb,
      'projects', '[]'::jsonb,
      'tags', '[]'::jsonb,
      'centers_of_balance', '[]'::jsonb
    ),
    'canonical_output_sha256', repeat('5', 64),
    'production_schema_sha256', repeat('2', 64),
    'production_normalizer_sha256', repeat('3', 64),
    'canonical_keyset_sha256', repeat('4', 64),
    'created_at', '2026-08-22T18:00:01.000Z'
  )
));

select lives_ok(
  $$ select public.throughline_commit_processing_v1(
       (select payload from processing_payloads limit 1)
     ) $$,
  'atomic processing commit accepts complete matching lineage'
);
select is(
  (
    select concat_ws(
      ':',
      current_processing_operation_id,
      current_extraction_attempt_id,
      current_note_revision_id
    )
    from public.throughline_recordings
    where id = 'rec_lineage_rpc'
  ),
  '00000000-0000-4000-8000-000000000302:00000000-0000-4000-8000-000000000303:00000000-0000-4000-8000-000000000304',
  'one atomic commit advances operation, attempt, and revision pointers'
);
select lives_ok(
  $$ select public.throughline_commit_processing_v1(
       (select payload from processing_payloads limit 1)
     ) $$,
  'replaying an operation is idempotent'
);
select is(
  (
    select concat_ws(
      ':',
      count(distinct operation_id),
      count(distinct attempt_id),
      count(distinct revision_id)
    )
    from public.throughline_processing_operations
    left join public.throughline_inference_attempts using (operation_id)
    left join public.throughline_note_revisions
      on processing_operation_id = operation_id
    where operation_id = '00000000-0000-4000-8000-000000000302'
  ),
  '1:1:1',
  'idempotent replay creates no duplicate lineage'
);
select is(
  (
    select count(*)::integer
    from public.throughline_inference_contracts
    where contract_sha256 = repeat('0', 64)
  ),
  1,
  'resolved inference contracts deduplicate by immutable hash'
);

insert into public.throughline_recordings (
  id, user_id, created_at, status, processing_status, recording
) values (
  'rec_lineage_failed_rpc', 'test-user', now(), 'ready', 'uploaded', '{}'::jsonb
);
insert into processing_payloads
select jsonb_set(
  jsonb_set(
    jsonb_set(
      payload,
      '{operation}',
      (payload->'operation') || jsonb_build_object(
        'operation_id', '00000000-0000-4000-8000-000000000305',
        'recording_id', 'rec_lineage_failed_rpc',
        'status', 'failed',
        'safe_failure_code', 'rate_limited'
      )
    ),
    '{attempts}',
    jsonb_build_array(
      (payload->'attempts'->0) || jsonb_build_object(
        'attempt_id', '00000000-0000-4000-8000-000000000306',
        'operation_id', '00000000-0000-4000-8000-000000000305',
        'recording_id', 'rec_lineage_failed_rpc',
        'status', 'failed',
        'safe_failure_code', 'rate_limited',
        'output_sha256', null,
        'private_output_snapshot', null,
        'usage_snapshot', null
      )
    )
  ),
  '{original_revision}',
  'null'::jsonb
)
from processing_payloads
limit 1;
select lives_ok(
  $$ select public.throughline_commit_processing_v1(
       (
         select payload from processing_payloads
         where payload->'operation'->>'recording_id' = 'rec_lineage_failed_rpc'
       )
     ) $$,
  'failed operation atomically persists safe attempt lineage'
);
select is(
  (
    select concat_ws(
      ':',
      operation.status,
      operation.safe_failure_code,
      count(revision.revision_id)
    )
    from public.throughline_processing_operations operation
    left join public.throughline_note_revisions revision
      on revision.processing_operation_id = operation.operation_id
    where operation.operation_id = '00000000-0000-4000-8000-000000000305'
    group by operation.status, operation.safe_failure_code
  ),
  'failed:rate_limited:0',
  'failed operation creates no fake original revision'
);

select * from finish();
rollback;
