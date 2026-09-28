begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id)
values ('00000000-0000-4000-8000-000000000401');

insert into public.throughline_recordings (
  id, user_id, auth_user_id, created_at, status, processing_status,
  transcript_raw, structured_note, recording
) values (
  'rec_owner_eval', 'test-user',
  '00000000-0000-4000-8000-000000000401', now(), 'ready', 'processed',
  'Original transcript',
  jsonb_build_object(
    'type', 'freeform', 'title', 'Original', 'summary', 'Original summary',
    'most_important', jsonb_build_array('Original point'), 'todos', '[]'::jsonb,
    'priorities', '[]'::jsonb, 'intentions', '[]'::jsonb,
    'accomplishments', '[]'::jsonb, 'tomorrow_todos', '[]'::jsonb,
    'mood', 'neutral', 'people', '[]'::jsonb, 'projects', '[]'::jsonb,
    'tags', '[]'::jsonb, 'centers_of_balance', '[]'::jsonb
  ),
  '{}'::jsonb
);

insert into public.throughline_inference_contracts (
  id, contract_sha256, contract_version, provider, transcription_model,
  extraction_model, prompt_sha256, schema_sha256, normalizer_sha256,
  canonical_keyset_sha256, contract_snapshot
) values (
  '00000000-0000-4000-8000-000000000402', repeat('0', 64), 'v1',
  'test', 'test-transcription', 'test-extraction', repeat('1', 64),
  repeat('2', 64), repeat('3', 64), repeat('4', 64), '{}'::jsonb
);

insert into public.throughline_processing_operations (
  operation_id, recording_id, inference_contract_id, status, started_at, finished_at
) values (
  '00000000-0000-4000-8000-000000000403', 'rec_owner_eval',
  '00000000-0000-4000-8000-000000000402', 'succeeded', now(), now()
);

insert into public.throughline_note_revisions (
  revision_id, recording_id, processing_operation_id, revision_kind,
  canonical_snapshot, canonical_output_sha256, production_schema_sha256,
  production_normalizer_sha256, canonical_keyset_sha256
) select
  '00000000-0000-4000-8000-000000000404', 'rec_owner_eval',
  '00000000-0000-4000-8000-000000000403', 'original_model',
  structured_note, repeat('5', 64), repeat('2', 64), repeat('3', 64), repeat('4', 64)
from public.throughline_recordings where id = 'rec_owner_eval';

update public.throughline_recordings set
  current_processing_operation_id = '00000000-0000-4000-8000-000000000403',
  current_note_revision_id = '00000000-0000-4000-8000-000000000404'
where id = 'rec_owner_eval';

create temporary table owner_payloads (name text primary key, payload jsonb not null);
insert into owner_payloads values (
  'mutation',
  jsonb_build_object(
    'recording_id', 'rec_owner_eval',
    'auth_user_id', '00000000-0000-4000-8000-000000000401',
    'idempotency_key', '00000000-0000-4000-8000-000000000405',
    'expected_current_revision_id', '00000000-0000-4000-8000-000000000404',
    'transcript_after', 'Original transcript',
    'material_change', true,
    'eligibility_source', 'content_correction',
    'revision', jsonb_build_object(
      'revision_id', '00000000-0000-4000-8000-000000000406',
      'recording_id', 'rec_owner_eval',
      'processing_operation_id', '00000000-0000-4000-8000-000000000403',
      'base_revision_id', '00000000-0000-4000-8000-000000000404',
      'revision_kind', 'user_content_correction',
      'canonical_snapshot', (
        select canonical_snapshot || jsonb_build_object('title', 'Corrected')
        from public.throughline_note_revisions
        where revision_id = '00000000-0000-4000-8000-000000000404'
      ),
      'canonical_output_sha256', repeat('6', 64),
      'production_schema_sha256', repeat('2', 64),
      'production_normalizer_sha256', repeat('3', 64),
      'canonical_keyset_sha256', repeat('4', 64),
      'editable_correction_mask', jsonb_build_array('title'),
      'transcript_explicitly_corrected', false,
      'created_at', '2026-08-22T20:00:00.000Z'
    ),
    'contribution', jsonb_build_object(
      'contribution_id', '00000000-0000-4000-8000-000000000407',
      'recording_id', 'rec_owner_eval',
      'auth_user_id', '00000000-0000-4000-8000-000000000401',
      'note_revision_id', '00000000-0000-4000-8000-000000000406',
      'idempotency_key', '00000000-0000-4000-8000-000000000405',
      'event_kind', 'created',
      'eligibility_source', 'content_correction',
      'notice_version', 'private_evaluation_notice_v1',
      'disclosure_version', 'private_evaluation_disclosure_v1',
      'policy_version', 'private_evaluation_policy_v1',
      'created_at', '2026-08-22T20:00:00.000Z'
    )
  )
);

select lives_ok(
  $$ select public.throughline_commit_user_mutation_v1(
       (select payload from owner_payloads where name = 'mutation')
     ) $$,
  'owner mutation atomically commits a current correction'
);
select is(
  (select current_note_revision_id::text from public.throughline_recordings
   where id = 'rec_owner_eval'),
  '00000000-0000-4000-8000-000000000406',
  'mutation advances the current revision pointer'
);
select is(
  (select array_to_string(editable_correction_mask, ',')
   from public.throughline_note_revisions
   where revision_id = '00000000-0000-4000-8000-000000000406'),
  'title',
  'mutation records only the server-built editable correction mask'
);
select is(
  (select count(*)::integer from public.throughline_evaluation_contributions
   where contribution_id = '00000000-0000-4000-8000-000000000407'),
  1,
  'material correction creates one current-disclosure contribution'
);
select lives_ok(
  $$ select public.throughline_commit_user_mutation_v1(
       (select payload from owner_payloads where name = 'mutation')
     ) $$,
  'same mutation idempotency key replays safely'
);
select throws_ok(
  $$ select public.throughline_commit_user_mutation_v1(
       jsonb_set(
         (select payload from owner_payloads where name = 'mutation'),
         '{revision,canonical_output_sha256}',
         to_jsonb(repeat('7', 64))
       )
     ) $$,
  '22023', 'idempotency_conflict',
  'mutation idempotency key cannot be reused for different content'
);

select throws_ok(
  $$ select public.throughline_commit_user_mutation_v1(
       jsonb_set(
         (select payload from owner_payloads where name = 'mutation'),
         '{idempotency_key}',
         '"00000000-0000-4000-8000-000000000499"'::jsonb
       )
     ) $$,
  '40001', 'revision_conflict', 'stale mutations fail optimistic concurrency'
);

insert into owner_payloads values (
  'evaluation',
  jsonb_build_object(
    'evaluation_id', '00000000-0000-4000-8000-000000000408',
    'recording_id', 'rec_owner_eval',
    'auth_user_id', '00000000-0000-4000-8000-000000000401',
    'processing_operation_id', '00000000-0000-4000-8000-000000000403',
    'evaluated_revision_id', '00000000-0000-4000-8000-000000000406',
    'idempotency_key', '00000000-0000-4000-8000-000000000409',
    'evaluator_kind', 'recording_user',
    'rubric_version', 'throughline_extraction_quality_v1',
    'notice_version', 'private_evaluation_notice_v1',
    'disclosure_version', 'private_evaluation_disclosure_v1',
    'policy_version', 'private_evaluation_policy_v1',
    'score', 4,
    'issue_codes', jsonb_build_array('weak_summary'),
    'agent_ready', false,
    'agent_readiness_preview', null,
    'explanation', 'Private explanation',
    'contribution', jsonb_build_object(
      'contribution_id', '00000000-0000-4000-8000-000000000410',
      'idempotency_key', '00000000-0000-4000-8000-000000000409'
    )
  )
);

select lives_ok(
  $$ select public.throughline_commit_evaluation_v1(
       (select payload from owner_payloads where name = 'evaluation')
     ) $$,
  'owner evaluation atomically commits against the exact current revision'
);
select lives_ok(
  $$ select public.throughline_commit_evaluation_v1(
       (select payload from owner_payloads where name = 'evaluation')
     ) $$,
  'same evaluation idempotency key replays safely'
);
select throws_ok(
  $$ select public.throughline_commit_evaluation_v1(
       jsonb_set(
         (select payload from owner_payloads where name = 'evaluation'),
         '{score}', '5'::jsonb
       )
     ) $$,
  '22023', 'idempotency_conflict',
  'evaluation idempotency key cannot be reused for a different grade'
);
select is(
  (select processing_operation_id::text from public.throughline_evaluations
   where evaluation_id = '00000000-0000-4000-8000-000000000408'),
  '00000000-0000-4000-8000-000000000403',
  'evaluation operation is derived through its immutable revision'
);
select is(
  (select explanation from public.throughline_evaluation_text_quarantine
   where evaluation_id = '00000000-0000-4000-8000-000000000408'),
  'Private explanation',
  'optional explanation stays in the separate quarantine table'
);
select throws_ok(
  $$ select public.throughline_commit_evaluation_v1(
       jsonb_set(
         jsonb_set(
           jsonb_set(
             (select payload from owner_payloads where name = 'evaluation'),
             '{evaluation_id}', '"00000000-0000-4000-8000-000000000498"'::jsonb
           ),
           '{idempotency_key}', '"00000000-0000-4000-8000-000000000497"'::jsonb
         ),
         '{evaluated_revision_id}', '"00000000-0000-4000-8000-000000000404"'::jsonb
       )
     ) $$,
  '40001', 'revision_conflict', 'stale evaluations fail optimistic concurrency'
);

insert into owner_payloads values (
  'action_state',
  jsonb_build_object(
    'recording_id', 'rec_owner_eval',
    'auth_user_id', '00000000-0000-4000-8000-000000000401',
    'idempotency_key', '00000000-0000-4000-8000-000000000411',
    'expected_current_revision_id', '00000000-0000-4000-8000-000000000406',
    'transcript_after', 'Original transcript',
    'material_change', true,
    'eligibility_source', null,
    'revision', jsonb_build_object(
      'revision_id', '00000000-0000-4000-8000-000000000412',
      'recording_id', 'rec_owner_eval',
      'processing_operation_id', '00000000-0000-4000-8000-000000000403',
      'base_revision_id', '00000000-0000-4000-8000-000000000406',
      'revision_kind', 'action_state',
      'canonical_snapshot', (
        select canonical_snapshot || jsonb_build_object(
          'most_important', jsonb_build_array('Original point', 'Ship action state'),
          'todos', jsonb_build_array(jsonb_build_object(
            'text', 'Ship action state', 'status', 'completed',
            'priority', null, 'due', null, 'for_date', null, 'context', null
          ))
        )
        from public.throughline_note_revisions
        where revision_id = '00000000-0000-4000-8000-000000000406'
      ),
      'canonical_output_sha256', repeat('8', 64),
      'production_schema_sha256', repeat('2', 64),
      'production_normalizer_sha256', repeat('3', 64),
      'canonical_keyset_sha256', repeat('4', 64),
      'editable_correction_mask', '[]'::jsonb,
      'transcript_explicitly_corrected', false,
      'created_at', '2026-08-22T21:00:00.000Z'
    ),
    'contribution', null
  )
);

select lives_ok(
  $$ select public.throughline_commit_user_mutation_v1(
       (select payload from owner_payloads where name = 'action_state')
     ) $$,
  'action toggle atomically appends workflow state'
);
select is(
  (select revision_kind from public.throughline_note_revisions
   where revision_id = '00000000-0000-4000-8000-000000000412'),
  'action_state',
  'action toggle is preserved as an immutable action-state revision'
);
select is(
  (select count(*)::integer from public.throughline_evaluation_contributions
   where note_revision_id = '00000000-0000-4000-8000-000000000412'),
  0,
  'action state creates no evaluation contribution'
);

select * from finish();
rollback;
