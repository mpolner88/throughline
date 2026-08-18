begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

select is(
  (
    select array_agg(version order by version)::text
    from supabase_migrations.schema_migrations
  ),
  array[
    '0001',
    '20260510025558',
    '20260516173641',
    '20260806044304'
  ]::text[]::text,
  'repository history is exactly the first four migrations'
);

select is(
  (
    select array_agg(tablename order by tablename)::text
    from pg_tables
    where schemaname = 'public'
      and tablename like 'throughline_%'
  ),
  array[
    'throughline_feedback',
    'throughline_mcp_tokens',
    'throughline_product_events',
    'throughline_product_feedback',
    'throughline_profiles',
    'throughline_recordings'
  ]::name[]::text,
  'baseline has exactly six Throughline tables'
);

select hasnt_table(
  'public',
  'throughline_internal_users',
  'measurement allowlist is absent from the baseline'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'throughline_product_events'
      and column_name in (
        'schema_version',
        'distribution_channel',
        'is_internal_user',
        'recording_id'
      )
  ),
  0::bigint,
  'measurement event columns are absent from the baseline'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.throughline_product_events'::regclass
      and conname in (
        'throughline_product_events_schema_version_check',
        'throughline_product_events_distribution_channel_check',
        'throughline_product_events_recording_id_fkey'
      )
  ),
  0::bigint,
  'measurement constraints are absent from the baseline'
);

select hasnt_index(
  'public',
  'throughline_product_events',
  'throughline_product_events_recording_id_idx',
  'measurement recording index is absent from the baseline'
);

select is(
  (
    select array_agg(conname order by conname)::text
    from pg_constraint
    where contype = 'f'
      and connamespace = 'public'::regnamespace
      and conrelid in (
        select oid
        from pg_class
        where relnamespace = 'public'::regnamespace
          and relname like 'throughline_%'
      )
  ),
  array[
    'throughline_feedback_auth_user_id_fkey',
    'throughline_feedback_recording_id_fkey',
    'throughline_mcp_tokens_user_id_fkey',
    'throughline_product_events_auth_user_id_fkey',
    'throughline_product_feedback_auth_user_id_fkey',
    'throughline_profiles_id_fkey',
    'throughline_recordings_auth_user_id_fkey'
  ]::name[]::text,
  'baseline foreign keys are exact'
);

select is(
  (
    select array_agg(indexname order by indexname)::text
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'throughline_recordings_user_created_idx',
        'throughline_recordings_type_idx',
        'throughline_recordings_processing_idx',
        'throughline_feedback_recording_idx',
        'throughline_feedback_user_created_idx',
        'throughline_recordings_auth_user_created_idx',
        'throughline_feedback_auth_user_created_idx',
        'throughline_mcp_tokens_user_created_idx',
        'throughline_mcp_tokens_active_hash_idx',
        'throughline_product_events_user_occurred_idx',
        'throughline_product_events_session_occurred_idx',
        'throughline_product_events_name_occurred_idx',
        'throughline_product_feedback_user_created_idx',
        'throughline_product_feedback_status_created_idx'
      )
  ),
  array[
    'throughline_feedback_auth_user_created_idx',
    'throughline_feedback_recording_idx',
    'throughline_feedback_user_created_idx',
    'throughline_mcp_tokens_active_hash_idx',
    'throughline_mcp_tokens_user_created_idx',
    'throughline_product_events_name_occurred_idx',
    'throughline_product_events_session_occurred_idx',
    'throughline_product_events_user_occurred_idx',
    'throughline_product_feedback_status_created_idx',
    'throughline_product_feedback_user_created_idx',
    'throughline_recordings_auth_user_created_idx',
    'throughline_recordings_processing_idx',
    'throughline_recordings_type_idx',
    'throughline_recordings_user_created_idx'
  ]::name[]::text,
  'baseline supporting indexes are exact'
);

select ok(
  (
    select count(*) = 6 and bool_and(relrowsecurity)
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in (
        'throughline_recordings',
        'throughline_feedback',
        'throughline_profiles',
        'throughline_mcp_tokens',
        'throughline_product_events',
        'throughline_product_feedback'
      )
  ),
  'RLS is enabled on all six baseline tables'
);

select is(
  (
    select array_agg(
      policyname || ':' || cmd || ':' || array_to_string(roles, ',')
      order by policyname
    )::text
    from pg_policies
    where schemaname = 'public'
      and tablename = 'throughline_profiles'
  ),
  array[
    'Users can create their own Throughline profile.:INSERT:authenticated',
    'Users can read their own Throughline profile.:SELECT:authenticated',
    'Users can update their own Throughline profile.:UPDATE:authenticated'
  ]::text[]::text,
  'profile policies are exact'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'throughline_recordings',
        'throughline_feedback',
        'throughline_mcp_tokens',
        'throughline_product_events',
        'throughline_product_feedback'
      )
  ),
  0::bigint,
  'service-only baseline tables have no client policies'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'throughline_recordings',
      'throughline_feedback',
      'throughline_profiles',
      'throughline_mcp_tokens',
      'throughline_product_events',
      'throughline_product_feedback'
    ]) as table_name
    where has_any_column_privilege(
      'anon',
      format('public.%I', table_name),
      'SELECT,INSERT,UPDATE,REFERENCES'
    )
      or has_table_privilege(
        'anon',
        format('public.%I', table_name),
        'DELETE,TRUNCATE,TRIGGER'
      )
  ),
  'anonymous clients have no baseline table access'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'throughline_recordings',
      'throughline_feedback',
      'throughline_mcp_tokens',
      'throughline_product_events',
      'throughline_product_feedback'
    ]) as table_name
    where has_any_column_privilege(
      'authenticated',
      format('public.%I', table_name),
      'SELECT,INSERT,UPDATE,REFERENCES'
    )
      or has_table_privilege(
        'authenticated',
        format('public.%I', table_name),
        'DELETE,TRUNCATE,TRIGGER'
      )
  ),
  'authenticated clients cannot access service-only baseline tables'
);

select ok(
  has_table_privilege('authenticated', 'public.throughline_profiles', 'select')
    and has_table_privilege('authenticated', 'public.throughline_profiles', 'insert')
    and has_table_privilege('authenticated', 'public.throughline_profiles', 'update')
    and not has_table_privilege('authenticated', 'public.throughline_profiles', 'delete')
    and not has_table_privilege('authenticated', 'public.throughline_profiles', 'truncate')
    and not has_table_privilege('authenticated', 'public.throughline_profiles', 'references')
    and not has_table_privilege('authenticated', 'public.throughline_profiles', 'trigger'),
  'authenticated profile privileges match the three policies'
);

select ok(
  has_table_privilege('service_role', 'public.throughline_recordings', 'select')
    and has_table_privilege('service_role', 'public.throughline_feedback', 'select')
    and has_table_privilege('service_role', 'public.throughline_product_events', 'select')
    and has_table_privilege('service_role', 'public.throughline_product_feedback', 'select'),
  'service role can read the four API REST tables'
);

select is(
  (
    select count(*)
    from storage.buckets
    where id = 'throughline-audio'
      and name = 'throughline-audio'
      and public = false
  ),
  1::bigint,
  'the one Throughline bucket is private'
);

select is(
  (select count(*) from storage.buckets),
  1::bigint,
  'no additional Storage bucket exists'
);

select is(
  (select count(*) from public.throughline_recordings)
    + (select count(*) from public.throughline_feedback)
    + (select count(*) from public.throughline_profiles)
    + (select count(*) from public.throughline_mcp_tokens)
    + (select count(*) from public.throughline_product_events)
    + (select count(*) from public.throughline_product_feedback),
  0::bigint,
  'all six Throughline tables are empty'
);

select is(
  (select count(*) from auth.users),
  0::bigint,
  'Auth has zero users'
);

select is(
  (select count(*) from storage.objects),
  0::bigint,
  'Storage has zero objects'
);

select * from finish();

rollback;
