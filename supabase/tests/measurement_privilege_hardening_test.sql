begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select is(
  (
    select array_agg(version order by version)::text
    from supabase_migrations.schema_migrations
  ),
  array[
    '0001',
    '20260510025558',
    '20260516173641',
    '20260806044304',
    '20260817180709',
    '20260818061933'
  ]::text[]::text,
  'repository history includes measurement then privilege hardening'
);

select ok(
  has_table_privilege('authenticated', 'public.throughline_profiles', 'select')
    and has_table_privilege('authenticated', 'public.throughline_profiles', 'insert')
    and has_table_privilege('authenticated', 'public.throughline_profiles', 'update')
    and not has_table_privilege('authenticated', 'public.throughline_profiles', 'delete')
    and not has_table_privilege('authenticated', 'public.throughline_profiles', 'truncate')
    and not has_table_privilege('authenticated', 'public.throughline_profiles', 'references')
    and not has_table_privilege('authenticated', 'public.throughline_profiles', 'trigger')
    and not has_table_privilege('authenticated', 'public.throughline_profiles', 'maintain'),
  'authenticated profile privileges are exactly select, insert, and update'
);

select ok(
  not exists (
    select 1
    from pg_class as table_record
    cross join lateral aclexplode(
      coalesce(table_record.relacl, acldefault('r', table_record.relowner))
    ) as privilege_record
    where table_record.oid = 'public.throughline_profiles'::regclass
      and privilege_record.grantee = 0
  )
    and not has_any_column_privilege(
      'anon',
      'public.throughline_profiles',
      'SELECT,INSERT,UPDATE,REFERENCES'
    )
    and not has_table_privilege(
      'anon',
      'public.throughline_profiles',
      'DELETE,TRUNCATE,TRIGGER,MAINTAIN'
    ),
  'public and anonymous roles have no profile privileges'
);

select ok(
  has_table_privilege('service_role', 'public.throughline_recordings', 'select')
    and has_table_privilege('service_role', 'public.throughline_recordings', 'insert')
    and has_table_privilege('service_role', 'public.throughline_recordings', 'update')
    and has_table_privilege('service_role', 'public.throughline_recordings', 'delete')
    and not has_table_privilege('service_role', 'public.throughline_recordings', 'truncate')
    and not has_table_privilege('service_role', 'public.throughline_recordings', 'references')
    and not has_table_privilege('service_role', 'public.throughline_recordings', 'trigger')
    and not has_table_privilege('service_role', 'public.throughline_recordings', 'maintain'),
  'service role has exact recording CRUD privileges'
);

select ok(
  has_table_privilege('service_role', 'public.throughline_feedback', 'select')
    and has_table_privilege('service_role', 'public.throughline_feedback', 'insert')
    and has_table_privilege('service_role', 'public.throughline_feedback', 'update')
    and has_table_privilege('service_role', 'public.throughline_feedback', 'delete')
    and not has_table_privilege('service_role', 'public.throughline_feedback', 'truncate')
    and not has_table_privilege('service_role', 'public.throughline_feedback', 'references')
    and not has_table_privilege('service_role', 'public.throughline_feedback', 'trigger')
    and not has_table_privilege('service_role', 'public.throughline_feedback', 'maintain'),
  'service role has exact feedback CRUD privileges'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'throughline_recordings',
      'throughline_feedback'
    ]) as table_name
    cross join unnest(array['anon', 'authenticated']) as role_name
    where has_any_column_privilege(
      role_name,
      format('public.%I', table_name),
      'SELECT,INSERT,UPDATE,REFERENCES'
    )
      or has_table_privilege(
        role_name,
        format('public.%I', table_name),
        'DELETE,TRUNCATE,TRIGGER,MAINTAIN'
      )
  )
    and not exists (
      select 1
      from pg_class as table_record
      cross join lateral aclexplode(
        coalesce(table_record.relacl, acldefault('r', table_record.relowner))
      ) as privilege_record
      where table_record.relnamespace = 'public'::regnamespace
        and table_record.relname in (
          'throughline_recordings',
          'throughline_feedback'
        )
        and privilege_record.grantee = 0
    ),
  'client roles have no recording or feedback privileges'
);

select ok(
  has_table_privilege('service_role', 'public.throughline_profiles', 'select')
    and has_table_privilege('service_role', 'public.throughline_profiles', 'delete')
    and has_table_privilege('service_role', 'public.throughline_product_events', 'select')
    and has_table_privilege('service_role', 'public.throughline_product_feedback', 'select')
    and has_table_privilege('service_role', 'public.throughline_internal_users', 'select'),
  'service role retains every required read and account-cleanup privilege'
);

select * from finish();

rollback;
