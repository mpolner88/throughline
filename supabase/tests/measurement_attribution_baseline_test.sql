begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

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
    select array_agg(
      constraint_row
      order by constraint_row
    )::text
    from (
      select
        constraint_record.conname || ':' ||
        source_namespace.nspname || '.' || source_table.relname || '(' ||
        (
          select string_agg(source_attribute.attname, ',' order by source_key.ordinality)
          from unnest(constraint_record.conkey)
            with ordinality as source_key(attnum, ordinality)
          join pg_attribute as source_attribute
            on source_attribute.attrelid = constraint_record.conrelid
            and source_attribute.attnum = source_key.attnum
        ) || ')->' ||
        target_namespace.nspname || '.' || target_table.relname || '(' ||
        (
          select string_agg(target_attribute.attname, ',' order by target_key.ordinality)
          from unnest(constraint_record.confkey)
            with ordinality as target_key(attnum, ordinality)
          join pg_attribute as target_attribute
            on target_attribute.attrelid = constraint_record.confrelid
            and target_attribute.attnum = target_key.attnum
        ) || '):delete=' || constraint_record.confdeltype::text
        as constraint_row
      from pg_constraint as constraint_record
      join pg_class as source_table
        on source_table.oid = constraint_record.conrelid
      join pg_namespace as source_namespace
        on source_namespace.oid = source_table.relnamespace
      join pg_class as target_table
        on target_table.oid = constraint_record.confrelid
      join pg_namespace as target_namespace
        on target_namespace.oid = target_table.relnamespace
      where constraint_record.contype = 'f'
        and source_namespace.nspname = 'public'
        and source_table.relname like 'throughline_%'
    ) as exact_foreign_keys
  ),
  array[
    'throughline_feedback_auth_user_id_fkey:public.throughline_feedback(auth_user_id)->auth.users(id):delete=c',
    'throughline_feedback_recording_id_fkey:public.throughline_feedback(recording_id)->public.throughline_recordings(id):delete=c',
    'throughline_mcp_tokens_user_id_fkey:public.throughline_mcp_tokens(user_id)->auth.users(id):delete=c',
    'throughline_product_events_auth_user_id_fkey:public.throughline_product_events(auth_user_id)->auth.users(id):delete=c',
    'throughline_product_feedback_auth_user_id_fkey:public.throughline_product_feedback(auth_user_id)->auth.users(id):delete=c',
    'throughline_profiles_id_fkey:public.throughline_profiles(id)->auth.users(id):delete=c',
    'throughline_recordings_auth_user_id_fkey:public.throughline_recordings(auth_user_id)->auth.users(id):delete=c'
  ]::text[]::text,
  'baseline foreign-key targets, columns, and delete actions are exact'
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

select is(
  (
    select array_agg(
      index_table.relname || ':' ||
      (
        select string_agg(index_attribute.attname, ',' order by index_key.ordinality)
        from unnest(index_record.indkey)
          with ordinality as index_key(attnum, ordinality)
        join pg_attribute as index_attribute
          on index_attribute.attrelid = index_record.indrelid
          and index_attribute.attnum = index_key.attnum
        where index_key.ordinality <= index_record.indnkeyatts
      )
      order by index_table.relname
    )::text
    from pg_index as index_record
    join pg_class as index_table
      on index_table.oid = index_record.indexrelid
    join pg_namespace as index_namespace
      on index_namespace.oid = index_table.relnamespace
    where index_namespace.nspname = 'public'
      and index_table.relname in (
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
    'throughline_feedback_auth_user_created_idx:auth_user_id,created_at',
    'throughline_feedback_recording_idx:recording_id',
    'throughline_feedback_user_created_idx:user_id,created_at',
    'throughline_mcp_tokens_active_hash_idx:token_hash',
    'throughline_mcp_tokens_user_created_idx:user_id,created_at',
    'throughline_product_events_name_occurred_idx:event_name,occurred_at',
    'throughline_product_events_session_occurred_idx:session_id,occurred_at',
    'throughline_product_events_user_occurred_idx:auth_user_id,occurred_at',
    'throughline_product_feedback_status_created_idx:status,created_at',
    'throughline_product_feedback_user_created_idx:auth_user_id,created_at',
    'throughline_recordings_auth_user_created_idx:auth_user_id,created_at',
    'throughline_recordings_processing_idx:processing_status',
    'throughline_recordings_type_idx:type',
    'throughline_recordings_user_created_idx:user_id,created_at'
  ]::text[]::text,
  'baseline named index columns are exact'
);

select is(
  (
    select array_agg(
      index_table.relname || ':predicate=' ||
      coalesce(
        regexp_replace(
          lower(pg_get_expr(index_record.indpred, index_record.indrelid)),
          '[[:space:]()]',
          '',
          'g'
        ),
        '<null>'
      )
      order by index_table.relname
    )::text
    from pg_index as index_record
    join pg_class as index_table
      on index_table.oid = index_record.indexrelid
    join pg_namespace as index_namespace
      on index_namespace.oid = index_table.relnamespace
    where index_namespace.nspname = 'public'
      and index_table.relname in (
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
    'throughline_feedback_auth_user_created_idx:predicate=auth_user_idisnotnull',
    'throughline_feedback_recording_idx:predicate=<null>',
    'throughline_feedback_user_created_idx:predicate=<null>',
    'throughline_mcp_tokens_active_hash_idx:predicate=revoked_atisnull',
    'throughline_mcp_tokens_user_created_idx:predicate=<null>',
    'throughline_product_events_name_occurred_idx:predicate=<null>',
    'throughline_product_events_session_occurred_idx:predicate=<null>',
    'throughline_product_events_user_occurred_idx:predicate=auth_user_idisnotnull',
    'throughline_product_feedback_status_created_idx:predicate=<null>',
    'throughline_product_feedback_user_created_idx:predicate=<null>',
    'throughline_recordings_auth_user_created_idx:predicate=auth_user_idisnotnull',
    'throughline_recordings_processing_idx:predicate=<null>',
    'throughline_recordings_type_idx:predicate=<null>',
    'throughline_recordings_user_created_idx:predicate=<null>'
  ]::text[]::text,
  'baseline named index predicates are exact'
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
      policyname || ':' || cmd || ':' || permissive || ':' ||
      array_to_string(roles, ',') || ':qual=' ||
      replace(
        regexp_replace(
          lower(coalesce(qual, '<null>')),
          '[[:space:]()]',
          '',
          'g'
        ),
        'asuid',
        ''
      ) || ':with_check=' ||
      replace(
        regexp_replace(
          lower(coalesce(with_check, '<null>')),
          '[[:space:]()]',
          '',
          'g'
        ),
        'asuid',
        ''
      )
      order by policyname
    )::text
    from pg_policies
    where schemaname = 'public'
      and tablename = 'throughline_profiles'
  ),
  array[
    'Users can create their own Throughline profile.:INSERT:PERMISSIVE:authenticated:qual=<null>:with_check=selectauth.uidisnotnullandselectauth.uid=id',
    'Users can read their own Throughline profile.:SELECT:PERMISSIVE:authenticated:qual=selectauth.uidisnotnullandselectauth.uid=id:with_check=<null>',
    'Users can update their own Throughline profile.:UPDATE:PERMISSIVE:authenticated:qual=selectauth.uidisnotnullandselectauth.uid=id:with_check=selectauth.uidisnotnullandselectauth.uid=id'
  ]::text[]::text,
  'profile policy roles, commands, qualifiers, and checks are exact'
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
