begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

select has_column(
  'public',
  'throughline_product_events',
  'schema_version',
  'product events have schema_version'
);
select col_type_is(
  'public',
  'throughline_product_events',
  'schema_version',
  'smallint',
  'schema_version uses smallint'
);
select col_not_null(
  'public',
  'throughline_product_events',
  'schema_version',
  'schema_version is required'
);
select col_default_is(
  'public',
  'throughline_product_events',
  'schema_version',
  '1',
  'legacy rows default to schema v1'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.throughline_product_events'::regclass
      and conname = 'throughline_product_events_schema_version_check'
      and contype = 'c'
  ),
  'schema_version has the named closed check'
);

select has_column(
  'public',
  'throughline_product_events',
  'distribution_channel',
  'product events have distribution_channel'
);
select col_not_null(
  'public',
  'throughline_product_events',
  'distribution_channel',
  'distribution_channel is required'
);
select col_default_is(
  'public',
  'throughline_product_events',
  'distribution_channel',
  'unknown',
  'legacy rows default to unknown channel'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.throughline_product_events'::regclass
      and conname = 'throughline_product_events_distribution_channel_check'
      and contype = 'c'
  ),
  'distribution_channel has the named closed check'
);

select lives_ok(
  $$
    insert into public.throughline_product_events (
      id,
      session_id,
      occurred_at,
      event_name,
      schema_version,
      distribution_channel
    ) values (
      'evt_00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000201',
      now(),
      'app_opened',
      2,
      'app_store'
    )
  $$,
  'valid schema and distribution values are accepted'
);
select throws_ok(
  $$
    insert into public.throughline_product_events (
      id,
      session_id,
      occurred_at,
      event_name,
      schema_version
    ) values (
      'evt_00000000-0000-4000-8000-000000000202',
      '00000000-0000-4000-8000-000000000202',
      now(),
      'app_opened',
      3
    )
  $$,
  '23514',
  null,
  'unsupported schema versions are rejected'
);
select throws_ok(
  $$
    insert into public.throughline_product_events (
      id,
      session_id,
      occurred_at,
      event_name,
      distribution_channel
    ) values (
      'evt_00000000-0000-4000-8000-000000000203',
      '00000000-0000-4000-8000-000000000203',
      now(),
      'app_opened',
      'sandbox'
    )
  $$,
  '23514',
  null,
  'unsupported distribution channels are rejected'
);

select has_column(
  'public',
  'throughline_product_events',
  'is_internal_user',
  'product events have nullable internal classification'
);
select col_is_null(
  'public',
  'throughline_product_events',
  'is_internal_user',
  'internal classification remains nullable'
);
select has_column(
  'public',
  'throughline_product_events',
  'recording_id',
  'product events have a private recording reference'
);
select col_is_null(
  'public',
  'throughline_product_events',
  'recording_id',
  'recording reference remains nullable'
);
select fk_ok(
  'public',
  'throughline_product_events',
  'recording_id',
  'public',
  'throughline_recordings',
  'id',
  'recording reference targets throughline_recordings'
);
select is(
  (
    select confdeltype
    from pg_constraint
    where conrelid = 'public.throughline_product_events'::regclass
      and conname = 'throughline_product_events_recording_id_fkey'
  ),
  'n'::"char",
  'recording deletion sets the event reference null'
);
select has_index(
  'public',
  'throughline_product_events',
  'throughline_product_events_recording_id_idx',
  'recording reference has an index'
);
select ok(
  (
    select indpred is not null
    from pg_index
    where indexrelid = 'public.throughline_product_events_recording_id_idx'::regclass
  ),
  'recording reference index is partial'
);

select has_table('public', 'throughline_internal_users', 'service-only allowlist exists');
select col_is_pk(
  'public',
  'throughline_internal_users',
  'auth_user_id',
  'allowlist account UUID is the primary key'
);
select fk_ok(
  'public',
  'throughline_internal_users',
  'auth_user_id',
  'auth',
  'users',
  'id',
  'allowlist account UUID targets auth.users'
);
select is(
  (
    select confdeltype
    from pg_constraint
    where conrelid = 'public.throughline_internal_users'::regclass
      and contype = 'f'
  ),
  'c'::"char",
  'account deletion cascades through the allowlist'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.throughline_internal_users'::regclass),
  true,
  'allowlist has RLS enabled'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'throughline_internal_users'),
  0::bigint,
  'allowlist has no client policy'
);
select ok(
  not has_table_privilege('anon', 'public.throughline_internal_users', 'select')
    and not has_table_privilege('authenticated', 'public.throughline_internal_users', 'select'),
  'client roles cannot read the allowlist'
);
select ok(
  not has_table_privilege('anon', 'public.throughline_internal_users', 'insert')
    and not has_table_privilege('authenticated', 'public.throughline_internal_users', 'insert')
    and not has_table_privilege('anon', 'public.throughline_internal_users', 'update')
    and not has_table_privilege('authenticated', 'public.throughline_internal_users', 'update')
    and not has_table_privilege('anon', 'public.throughline_internal_users', 'delete')
    and not has_table_privilege('authenticated', 'public.throughline_internal_users', 'delete'),
  'client roles cannot mutate the allowlist'
);
select ok(
  has_table_privilege('service_role', 'public.throughline_internal_users', 'select')
    and has_table_privilege('service_role', 'public.throughline_internal_users', 'insert')
    and has_table_privilege('service_role', 'public.throughline_internal_users', 'delete')
    and not has_table_privilege('service_role', 'public.throughline_internal_users', 'update')
    and not has_table_privilege('service_role', 'public.throughline_internal_users', 'truncate')
    and not has_table_privilege('service_role', 'public.throughline_internal_users', 'references')
    and not has_table_privilege('service_role', 'public.throughline_internal_users', 'trigger'),
  'service role has only the required allowlist operations'
);
select is(
  (select count(*) from public.throughline_internal_users),
  0::bigint,
  'migration inserts no internal account'
);

select * from finish();

rollback;
