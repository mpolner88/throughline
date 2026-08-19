import { createHash } from "node:crypto";

const CONTRACT_VERSION = 1;

function maskSqlLiteralsAndComments(sql) {
  let masked = "";
  let index = 0;
  while (index < sql.length) {
    const character = sql[index];
    const next = sql[index + 1];
    if (character === "'") {
      masked += " ";
      index += 1;
      while (index < sql.length) {
        if (sql[index] === "'" && sql[index + 1] === "'") {
          masked += "  ";
          index += 2;
        } else if (sql[index] === "'") {
          masked += " ";
          index += 1;
          break;
        } else {
          masked += sql[index] === "\n" ? "\n" : " ";
          index += 1;
        }
      }
      continue;
    }
    if (character === '"') {
      masked += " ";
      index += 1;
      while (index < sql.length) {
        if (sql[index] === '"' && sql[index + 1] === '"') {
          masked += "  ";
          index += 2;
        } else if (sql[index] === '"') {
          masked += " ";
          index += 1;
          break;
        } else {
          masked += sql[index] === "\n" ? "\n" : " ";
          index += 1;
        }
      }
      continue;
    }
    if (character === "-" && next === "-") {
      masked += "  ";
      index += 2;
      while (index < sql.length && sql[index] !== "\n") {
        masked += " ";
        index += 1;
      }
      continue;
    }
    if (character === "/" && next === "*") {
      let depth = 1;
      masked += "  ";
      index += 2;
      while (index < sql.length && depth > 0) {
        if (sql[index] === "/" && sql[index + 1] === "*") {
          depth += 1;
          masked += "  ";
          index += 2;
        } else if (sql[index] === "*" && sql[index + 1] === "/") {
          depth -= 1;
          masked += "  ";
          index += 2;
        } else {
          masked += sql[index] === "\n" ? "\n" : " ";
          index += 1;
        }
      }
      if (depth !== 0) return null;
      continue;
    }
    if (character === "$") {
      const delimiter = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/u)?.[0];
      if (delimiter !== undefined) {
        masked += " ".repeat(delimiter.length);
        index += delimiter.length;
        const end = sql.indexOf(delimiter, index);
        if (end === -1) return null;
        while (index < end) {
          masked += sql[index] === "\n" ? "\n" : " ";
          index += 1;
        }
        masked += " ".repeat(delimiter.length);
        index += delimiter.length;
        continue;
      }
    }
    masked += character;
    index += 1;
  }
  return masked;
}

export function isReadOnlyMeasurementContractSql(sql) {
  if (typeof sql !== "string" || sql.length === 0) return false;
  const masked = maskSqlLiteralsAndComments(sql);
  if (masked === null) return false;
  const trimmed = masked.trim();
  if (!/^(?:with|select)\b/iu.test(trimmed)) return false;
  if (
    /\b(?:insert|update|delete|alter|drop|create|grant|revoke|truncate|merge|copy|call|do|vacuum|analyze|refresh|reindex|cluster|set|reset)\b/iu.test(
      trimmed,
    )
  ) {
    return false;
  }
  const semicolons = [...trimmed.matchAll(/;/gu)];
  return semicolons.length === 0 ||
    (semicolons.length === 1 && semicolons[0].index === trimmed.length - 1);
}

const sqlTextArray = (values) =>
  `array[${values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ")}]::text[]`;

const buildContractSql = ({ contract, checks }) => {
  const values = checks.map((expression, index) =>
    `      (${index + 1}::integer, (coalesce((${expression.trim()}), false))::boolean)`
  ).join(",\n");

  return `
    with checks(assertion_number, passed) as (
      values
${values}
    )
    select
      ${CONTRACT_VERSION}::integer as contract_version,
      '${contract}'::text as contract,
      ${checks.length}::integer as planned,
      count(*)::integer as executed,
      coalesce(
        json_agg(assertion_number order by assertion_number)
          filter (where passed is not true),
        '[]'::json
      ) as failed_assertions
    from checks;
  `.trim();
};

const BASELINE_HISTORY = [
  "0001",
  "20260510025558",
  "20260516173641",
  "20260806044304",
];

const BASELINE_TABLES = [
  "throughline_feedback",
  "throughline_mcp_tokens",
  "throughline_product_events",
  "throughline_product_feedback",
  "throughline_profiles",
  "throughline_recordings",
];

const BASELINE_FOREIGN_KEY_NAMES = [
  "throughline_feedback_auth_user_id_fkey",
  "throughline_feedback_recording_id_fkey",
  "throughline_mcp_tokens_user_id_fkey",
  "throughline_product_events_auth_user_id_fkey",
  "throughline_product_feedback_auth_user_id_fkey",
  "throughline_profiles_id_fkey",
  "throughline_recordings_auth_user_id_fkey",
];

const BASELINE_FOREIGN_KEY_DEFINITIONS = [
  "throughline_feedback_auth_user_id_fkey:public.throughline_feedback(auth_user_id)->auth.users(id):delete=c",
  "throughline_feedback_recording_id_fkey:public.throughline_feedback(recording_id)->public.throughline_recordings(id):delete=c",
  "throughline_mcp_tokens_user_id_fkey:public.throughline_mcp_tokens(user_id)->auth.users(id):delete=c",
  "throughline_product_events_auth_user_id_fkey:public.throughline_product_events(auth_user_id)->auth.users(id):delete=c",
  "throughline_product_feedback_auth_user_id_fkey:public.throughline_product_feedback(auth_user_id)->auth.users(id):delete=c",
  "throughline_profiles_id_fkey:public.throughline_profiles(id)->auth.users(id):delete=c",
  "throughline_recordings_auth_user_id_fkey:public.throughline_recordings(auth_user_id)->auth.users(id):delete=c",
];

const BASELINE_INDEX_NAMES = [
  "throughline_feedback_auth_user_created_idx",
  "throughline_feedback_recording_idx",
  "throughline_feedback_user_created_idx",
  "throughline_mcp_tokens_active_hash_idx",
  "throughline_mcp_tokens_user_created_idx",
  "throughline_product_events_name_occurred_idx",
  "throughline_product_events_session_occurred_idx",
  "throughline_product_events_user_occurred_idx",
  "throughline_product_feedback_status_created_idx",
  "throughline_product_feedback_user_created_idx",
  "throughline_recordings_auth_user_created_idx",
  "throughline_recordings_processing_idx",
  "throughline_recordings_type_idx",
  "throughline_recordings_user_created_idx",
];

const BASELINE_INDEX_COLUMNS = [
  "throughline_feedback_auth_user_created_idx:throughline_feedback:auth_user_id,created_at",
  "throughline_feedback_recording_idx:throughline_feedback:recording_id",
  "throughline_feedback_user_created_idx:throughline_feedback:user_id,created_at",
  "throughline_mcp_tokens_active_hash_idx:throughline_mcp_tokens:token_hash",
  "throughline_mcp_tokens_user_created_idx:throughline_mcp_tokens:user_id,created_at",
  "throughline_product_events_name_occurred_idx:throughline_product_events:event_name,occurred_at",
  "throughline_product_events_session_occurred_idx:throughline_product_events:session_id,occurred_at",
  "throughline_product_events_user_occurred_idx:throughline_product_events:auth_user_id,occurred_at",
  "throughline_product_feedback_status_created_idx:throughline_product_feedback:status,created_at",
  "throughline_product_feedback_user_created_idx:throughline_product_feedback:auth_user_id,created_at",
  "throughline_recordings_auth_user_created_idx:throughline_recordings:auth_user_id,created_at",
  "throughline_recordings_processing_idx:throughline_recordings:processing_status",
  "throughline_recordings_type_idx:throughline_recordings:type",
  "throughline_recordings_user_created_idx:throughline_recordings:user_id,created_at",
];

const BASELINE_INDEX_PREDICATES = [
  "throughline_feedback_auth_user_created_idx:throughline_feedback:predicate=auth_user_idisnotnull",
  "throughline_feedback_recording_idx:throughline_feedback:predicate=<null>",
  "throughline_feedback_user_created_idx:throughline_feedback:predicate=<null>",
  "throughline_mcp_tokens_active_hash_idx:throughline_mcp_tokens:predicate=revoked_atisnull",
  "throughline_mcp_tokens_user_created_idx:throughline_mcp_tokens:predicate=<null>",
  "throughline_product_events_name_occurred_idx:throughline_product_events:predicate=<null>",
  "throughline_product_events_session_occurred_idx:throughline_product_events:predicate=<null>",
  "throughline_product_events_user_occurred_idx:throughline_product_events:predicate=auth_user_idisnotnull",
  "throughline_product_feedback_status_created_idx:throughline_product_feedback:predicate=<null>",
  "throughline_product_feedback_user_created_idx:throughline_product_feedback:predicate=<null>",
  "throughline_recordings_auth_user_created_idx:throughline_recordings:predicate=auth_user_idisnotnull",
  "throughline_recordings_processing_idx:throughline_recordings:predicate=<null>",
  "throughline_recordings_type_idx:throughline_recordings:predicate=<null>",
  "throughline_recordings_user_created_idx:throughline_recordings:predicate=<null>",
];

const PROFILE_POLICY_DEFINITIONS = [
  "Users can create their own Throughline profile.:INSERT:PERMISSIVE:authenticated:qual=<null>:with_check=selectauth.uidisnotnullandselectauth.uid=id",
  "Users can read their own Throughline profile.:SELECT:PERMISSIVE:authenticated:qual=selectauth.uidisnotnullandselectauth.uid=id:with_check=<null>",
  "Users can update their own Throughline profile.:UPDATE:PERMISSIVE:authenticated:qual=selectauth.uidisnotnullandselectauth.uid=id:with_check=selectauth.uidisnotnullandselectauth.uid=id",
];

const baselineChecks = [
  `
    (select array_agg(version order by version)
      from supabase_migrations.schema_migrations) =
      ${sqlTextArray(BASELINE_HISTORY)}
  `,
  `
    (select array_agg(tablename::text order by tablename)
      from pg_catalog.pg_tables
      where schemaname = 'public'
        and tablename like 'throughline_%') =
      ${sqlTextArray(BASELINE_TABLES)}
  `,
  "to_regclass('public.throughline_internal_users') is null",
  `
    (select count(*) from information_schema.columns
      where table_schema = 'public'
        and table_name = 'throughline_product_events'
        and column_name in (
          'schema_version', 'distribution_channel',
          'is_internal_user', 'recording_id'
        )) = 0
  `,
  `
    (select count(*) from pg_catalog.pg_constraint
      where conrelid = 'public.throughline_product_events'::regclass
        and conname in (
          'throughline_product_events_schema_version_check',
          'throughline_product_events_distribution_channel_check',
          'throughline_product_events_recording_id_fkey'
        )) = 0
  `,
  "to_regclass('public.throughline_product_events_recording_id_idx') is null",
  `
    (select array_agg(conname::text order by conname)
      from pg_catalog.pg_constraint
      where contype = 'f'
        and connamespace = 'public'::regnamespace
        and conrelid in (
          select oid from pg_catalog.pg_class
          where relnamespace = 'public'::regnamespace
            and relname like 'throughline_%'
        )) = ${sqlTextArray(BASELINE_FOREIGN_KEY_NAMES)}
  `,
  `
    (select array_agg(constraint_row order by constraint_row)
      from (
        select
          constraint_record.conname || ':' ||
          source_namespace.nspname || '.' || source_table.relname || '(' ||
          (select string_agg(source_attribute.attname, ',' order by source_key.ordinality)
            from unnest(constraint_record.conkey)
              with ordinality as source_key(attnum, ordinality)
            join pg_catalog.pg_attribute as source_attribute
              on source_attribute.attrelid = constraint_record.conrelid
              and source_attribute.attnum = source_key.attnum) || ')->' ||
          target_namespace.nspname || '.' || target_table.relname || '(' ||
          (select string_agg(target_attribute.attname, ',' order by target_key.ordinality)
            from unnest(constraint_record.confkey)
              with ordinality as target_key(attnum, ordinality)
            join pg_catalog.pg_attribute as target_attribute
              on target_attribute.attrelid = constraint_record.confrelid
              and target_attribute.attnum = target_key.attnum) ||
          '):delete=' || constraint_record.confdeltype::text as constraint_row
        from pg_catalog.pg_constraint as constraint_record
        join pg_catalog.pg_class as source_table
          on source_table.oid = constraint_record.conrelid
        join pg_catalog.pg_namespace as source_namespace
          on source_namespace.oid = source_table.relnamespace
        join pg_catalog.pg_class as target_table
          on target_table.oid = constraint_record.confrelid
        join pg_catalog.pg_namespace as target_namespace
          on target_namespace.oid = target_table.relnamespace
        where constraint_record.contype = 'f'
          and source_namespace.nspname = 'public'
          and source_table.relname like 'throughline_%'
      ) as exact_foreign_keys) =
      ${sqlTextArray(BASELINE_FOREIGN_KEY_DEFINITIONS)}
  `,
  `
    (select array_agg(indexname::text order by indexname)
      from pg_catalog.pg_indexes
      where schemaname = 'public'
        and indexname = any (${sqlTextArray(BASELINE_INDEX_NAMES)})) =
      ${sqlTextArray(BASELINE_INDEX_NAMES)}
  `,
  `
    (select array_agg(
        index_table.relname || ':' ||
        indexed_table.relname || ':' ||
        (select string_agg(index_attribute.attname, ',' order by index_key.ordinality)
          from unnest(index_record.indkey)
            with ordinality as index_key(attnum, ordinality)
          join pg_catalog.pg_attribute as index_attribute
            on index_attribute.attrelid = index_record.indrelid
            and index_attribute.attnum = index_key.attnum
          where index_key.ordinality <= index_record.indnkeyatts)
        order by index_table.relname)
      from pg_catalog.pg_index as index_record
      join pg_catalog.pg_class as index_table
        on index_table.oid = index_record.indexrelid
      join pg_catalog.pg_class as indexed_table
        on indexed_table.oid = index_record.indrelid
      join pg_catalog.pg_namespace as index_namespace
        on index_namespace.oid = index_table.relnamespace
      where index_namespace.nspname = 'public'
        and index_table.relname = any (${sqlTextArray(BASELINE_INDEX_NAMES)})) =
      ${sqlTextArray(BASELINE_INDEX_COLUMNS)}
  `,
  `
    (select array_agg(
        index_table.relname || ':' || indexed_table.relname || ':predicate=' ||
        coalesce(
          regexp_replace(
            lower(pg_get_expr(index_record.indpred, index_record.indrelid)),
            '[[:space:]()]', '', 'g'
          ),
          '<null>'
        )
        order by index_table.relname)
      from pg_catalog.pg_index as index_record
      join pg_catalog.pg_class as index_table
        on index_table.oid = index_record.indexrelid
      join pg_catalog.pg_class as indexed_table
        on indexed_table.oid = index_record.indrelid
      join pg_catalog.pg_namespace as index_namespace
        on index_namespace.oid = index_table.relnamespace
      where index_namespace.nspname = 'public'
        and index_table.relname = any (${sqlTextArray(BASELINE_INDEX_NAMES)})) =
      ${sqlTextArray(BASELINE_INDEX_PREDICATES)}
  `,
  `
    (select count(*) = 6 and bool_and(relrowsecurity)
      from pg_catalog.pg_class
      where relnamespace = 'public'::regnamespace
        and relname = any (${sqlTextArray(BASELINE_TABLES)}))
  `,
  `
    (select array_agg(
        policyname || ':' || cmd || ':' || permissive || ':' ||
        array_to_string(roles, ',') || ':qual=' ||
        replace(
          regexp_replace(lower(coalesce(qual, '<null>')), '[[:space:]()]', '', 'g'),
          'asuid', ''
        ) || ':with_check=' ||
        replace(
          regexp_replace(lower(coalesce(with_check, '<null>')), '[[:space:]()]', '', 'g'),
          'asuid', ''
        )
        order by policyname)
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = 'throughline_profiles') =
      ${sqlTextArray(PROFILE_POLICY_DEFINITIONS)}
  `,
  `
    (select count(*) from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename in (
          'throughline_recordings', 'throughline_feedback',
          'throughline_mcp_tokens', 'throughline_product_events',
          'throughline_product_feedback'
        )) = 0
  `,
  `
    not exists (
      select 1
      from unnest(${sqlTextArray(BASELINE_TABLES)}) as table_name
      where has_any_column_privilege(
        'anon', format('public.%I', table_name),
        'SELECT,INSERT,UPDATE,REFERENCES'
      ) or has_table_privilege(
        'anon', format('public.%I', table_name),
        'DELETE,TRUNCATE,TRIGGER'
      )
    )
  `,
  `
    not exists (
      select 1
      from unnest(array[
        'throughline_recordings', 'throughline_feedback',
        'throughline_mcp_tokens', 'throughline_product_events',
        'throughline_product_feedback'
      ]) as table_name
      where has_any_column_privilege(
        'authenticated', format('public.%I', table_name),
        'SELECT,INSERT,UPDATE,REFERENCES'
      ) or has_table_privilege(
        'authenticated', format('public.%I', table_name),
        'DELETE,TRUNCATE,TRIGGER'
      )
    )
  `,
  `
    (select count(*) from storage.buckets
      where id = 'throughline-audio'
        and name = 'throughline-audio'
        and public = false) = 1
  `,
  "(select count(*) from storage.buckets) = 1",
  `
    (select count(*) from public.throughline_recordings)
      + (select count(*) from public.throughline_feedback)
      + (select count(*) from public.throughline_profiles)
      + (select count(*) from public.throughline_mcp_tokens)
      + (select count(*) from public.throughline_product_events)
      + (select count(*) from public.throughline_product_feedback) = 0
  `,
  "(select count(*) from auth.users) = 0",
  "(select count(*) from storage.objects) = 0",
];

const constraintExpression = (constraintName) => `
  (select pg_get_expr(conbin, conrelid)
    from pg_catalog.pg_constraint
    where conrelid = 'public.throughline_product_events'::regclass
      and conname = '${constraintName}'
      and contype = 'c'
      and convalidated)
`;

const MEASUREMENT_EVENT_CONSTRAINTS = [
  "throughline_product_events_auth_user_id_fkey:f",
  "throughline_product_events_distribution_channel_check:c",
  "throughline_product_events_event_name_check:c",
  "throughline_product_events_pkey:p",
  "throughline_product_events_platform_check:c",
  "throughline_product_events_properties_check:c",
  "throughline_product_events_recording_id_fkey:f",
  "throughline_product_events_schema_version_check:c",
];

const MEASUREMENT_EVENT_COLUMNS = [
  "id:text:true:false::",
  "auth_user_id:uuid:false:false::",
  "session_id:uuid:true:false::",
  "occurred_at:timestamp with time zone:true:false::",
  "received_at:timestamp with time zone:true:true::",
  "event_name:text:true:false::",
  "platform:text:true:true::",
  "app_version:text:false:false::",
  "build_number:text:false:false::",
  "properties:jsonb:true:true::",
  "schema_version:smallint:true:true::",
  "distribution_channel:text:true:true::",
  "is_internal_user:boolean:false:false::",
  "recording_id:text:false:false::",
];

const MEASUREMENT_EVENT_OMITTED_DEFAULTS = [
  "platform:'ios'::text",
  "properties:'{}'::jsonb",
  "received_at:now()",
];

const MEASUREMENT_EVENT_LEGACY_CHECKS = [
  "throughline_product_events_event_name_check:char_lengthevent_name>=1ANDchar_lengthevent_name<=80ANDevent_name~'^[a-z][a-z0-9_]*$'::text",
  "throughline_product_events_platform_check:platform='ios'::text",
  "throughline_product_events_properties_check:jsonb_typeofproperties='object'::text",
];

const MEASUREMENT_EVENT_INDEX_DEFINITIONS = [
  "throughline_product_events_name_occurred_idx:event_name,occurred_at:predicate=<null>:unique=false:primary=false:valid=true:ready=true",
  "throughline_product_events_pkey:id:predicate=<null>:unique=true:primary=true:valid=true:ready=true",
  "throughline_product_events_recording_id_idx:recording_id:predicate=(recording_id IS NOT NULL):unique=false:primary=false:valid=true:ready=true",
  "throughline_product_events_session_occurred_idx:session_id,occurred_at:predicate=<null>:unique=false:primary=false:valid=true:ready=true",
  "throughline_product_events_user_occurred_idx:auth_user_id,occurred_at:predicate=(auth_user_id IS NOT NULL):unique=false:primary=false:valid=true:ready=true",
];

const columnExists = (columnName) => `
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'throughline_product_events'
      and column_name = '${columnName}'
  )
`;

const columnNullable = (columnName, expected) => `
  (select is_nullable = '${expected}'
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'throughline_product_events'
      and column_name = '${columnName}')
`;

const measurementChecks = [
  columnExists("schema_version"),
  `
    (select format_type(attribute.atttypid, attribute.atttypmod) = 'smallint'
      from pg_catalog.pg_attribute as attribute
      where attribute.attrelid = 'public.throughline_product_events'::regclass
        and attribute.attname = 'schema_version'
        and not attribute.attisdropped)
  `,
  columnNullable("schema_version", "NO"),
  `
    (select pg_get_expr(default_record.adbin, default_record.adrelid) = '1'
      from pg_catalog.pg_attribute as attribute
      join pg_catalog.pg_attrdef as default_record
        on default_record.adrelid = attribute.attrelid
        and default_record.adnum = attribute.attnum
      where attribute.attrelid = 'public.throughline_product_events'::regclass
        and attribute.attname = 'schema_version')
  `,
  `
    exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.throughline_product_events'::regclass
        and conname = 'throughline_product_events_schema_version_check'
        and contype = 'c'
        and convalidated
    )
  `,
  columnExists("distribution_channel"),
  columnNullable("distribution_channel", "NO"),
  `
    (select pg_get_expr(default_record.adbin, default_record.adrelid) =
        $$'unknown'::text$$
      from pg_catalog.pg_attribute as attribute
      join pg_catalog.pg_attrdef as default_record
        on default_record.adrelid = attribute.attrelid
        and default_record.adnum = attribute.attnum
      where attribute.attrelid = 'public.throughline_product_events'::regclass
        and attribute.attname = 'distribution_channel')
  `,
  `
    exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.throughline_product_events'::regclass
        and conname = 'throughline_product_events_distribution_channel_check'
        and contype = 'c'
        and convalidated
    )
  `,
  `
    (select array_agg(
        constraint_record.conname || ':' || constraint_record.contype::text
        order by constraint_record.conname
      )
      from pg_catalog.pg_constraint as constraint_record
      where constraint_record.conrelid =
        'public.throughline_product_events'::regclass) =
      ${sqlTextArray(MEASUREMENT_EVENT_CONSTRAINTS)}
    and (select count(*) = 5 and bool_and(convalidated)
      from pg_catalog.pg_constraint
      where conrelid = 'public.throughline_product_events'::regclass
        and contype = 'c')
    and (select array_agg(
        attribute.attname || ':' ||
        format_type(attribute.atttypid, attribute.atttypmod) || ':' ||
        attribute.attnotnull::text || ':' ||
        attribute.atthasdef::text || ':' ||
        attribute.attidentity::text || ':' ||
        attribute.attgenerated::text
        order by attribute.attnum
      )
      from pg_catalog.pg_attribute as attribute
      where attribute.attrelid =
        'public.throughline_product_events'::regclass
        and attribute.attnum > 0
        and not attribute.attisdropped) =
      ${sqlTextArray(MEASUREMENT_EVENT_COLUMNS)}
    and (select array_agg(
        attribute.attname || ':' ||
        pg_get_expr(default_record.adbin, default_record.adrelid)
        order by attribute.attname
      )
      from pg_catalog.pg_attribute as attribute
      join pg_catalog.pg_attrdef as default_record
        on default_record.adrelid = attribute.attrelid
        and default_record.adnum = attribute.attnum
      where attribute.attrelid =
        'public.throughline_product_events'::regclass
        and attribute.attname in ('received_at', 'platform', 'properties')) =
      ${sqlTextArray(MEASUREMENT_EVENT_OMITTED_DEFAULTS)}
    and (select array_agg(
        constraint_record.conname || ':' ||
        regexp_replace(
          pg_get_expr(constraint_record.conbin, constraint_record.conrelid),
          '[[:space:]()]', '', 'g'
        )
        order by constraint_record.conname
      )
      from pg_catalog.pg_constraint as constraint_record
      where constraint_record.conrelid =
        'public.throughline_product_events'::regclass
        and constraint_record.conname in (
          'throughline_product_events_event_name_check',
          'throughline_product_events_platform_check',
          'throughline_product_events_properties_check'
        )) = ${sqlTextArray(MEASUREMENT_EVENT_LEGACY_CHECKS)}
    and (select count(*) = 3 and bool_and(
        case constraint_record.conname
          when 'throughline_product_events_event_name_check' then
            position(
              $$'^[a-z][a-z0-9_]*$'::text$$ in
              pg_get_expr(constraint_record.conbin, constraint_record.conrelid)
            ) > 0
          when 'throughline_product_events_platform_check' then
            position(
              $$'ios'::text$$ in
              pg_get_expr(constraint_record.conbin, constraint_record.conrelid)
            ) > 0
          when 'throughline_product_events_properties_check' then
            position(
              $$'object'::text$$ in
              pg_get_expr(constraint_record.conbin, constraint_record.conrelid)
            ) > 0
          else false
        end
      )
      from pg_catalog.pg_constraint as constraint_record
      where constraint_record.conrelid =
        'public.throughline_product_events'::regclass
        and constraint_record.conname in (
          'throughline_product_events_event_name_check',
          'throughline_product_events_platform_check',
          'throughline_product_events_properties_check'
        ))
    and (select array_agg(
        index_table.relname || ':' ||
        (select string_agg(
            coalesce(index_attribute.attname, '<expression>'), ','
            order by index_key.ordinality
          )
          from unnest(index_record.indkey)
            with ordinality as index_key(attnum, ordinality)
          left join pg_catalog.pg_attribute as index_attribute
            on index_attribute.attrelid = index_record.indrelid
            and index_attribute.attnum = index_key.attnum
          where index_key.ordinality <= index_record.indnkeyatts) ||
        ':predicate=' ||
        coalesce(
          pg_get_expr(index_record.indpred, index_record.indrelid),
          '<null>'
        ) ||
        ':unique=' || index_record.indisunique::text ||
        ':primary=' || index_record.indisprimary::text ||
        ':valid=' || index_record.indisvalid::text ||
        ':ready=' || index_record.indisready::text
        order by index_table.relname
      )
      from pg_catalog.pg_index as index_record
      join pg_catalog.pg_class as index_table
        on index_table.oid = index_record.indexrelid
      where index_record.indrelid =
        'public.throughline_product_events'::regclass) =
      ${sqlTextArray(MEASUREMENT_EVENT_INDEX_DEFINITIONS)}
    and not exists (
      select 1
      from pg_catalog.pg_trigger as trigger_record
      where trigger_record.tgrelid =
        'public.throughline_product_events'::regclass
        and not trigger_record.tgisinternal
        and trigger_record.tgenabled in ('O', 'A')
    )
    and not exists (
      select 1
      from pg_catalog.pg_rewrite as rewrite_record
      where rewrite_record.ev_class =
        'public.throughline_product_events'::regclass
    )
  `,
  `${constraintExpression("throughline_product_events_schema_version_check")} = '(schema_version = ANY (ARRAY[1, 2]))'`,
  `${constraintExpression("throughline_product_events_distribution_channel_check")} = $$(distribution_channel = ANY (ARRAY['debug'::text, 'testflight'::text, 'app_store'::text, 'unknown'::text]))$$`,
  columnExists("is_internal_user"),
  columnNullable("is_internal_user", "YES"),
  columnExists("recording_id"),
  columnNullable("recording_id", "YES"),
  `
    exists (
      select 1
      from pg_catalog.pg_constraint as constraint_record
      where constraint_record.contype = 'f'
        and constraint_record.conrelid = 'public.throughline_product_events'::regclass
        and constraint_record.confrelid = 'public.throughline_recordings'::regclass
        and (select array_agg(attribute.attname order by key.ordinality)
          from unnest(constraint_record.conkey)
            with ordinality as key(attnum, ordinality)
          join pg_catalog.pg_attribute as attribute
            on attribute.attrelid = constraint_record.conrelid
            and attribute.attnum = key.attnum) = array['recording_id']::name[]
        and (select array_agg(attribute.attname order by key.ordinality)
          from unnest(constraint_record.confkey)
            with ordinality as key(attnum, ordinality)
          join pg_catalog.pg_attribute as attribute
            on attribute.attrelid = constraint_record.confrelid
            and attribute.attnum = key.attnum) = array['id']::name[]
    )
  `,
  `
    (select confdeltype = 'n'::"char"
      from pg_catalog.pg_constraint
      where conrelid = 'public.throughline_product_events'::regclass
        and conname = 'throughline_product_events_recording_id_fkey')
  `,
  `
    exists (
      select 1
      from pg_catalog.pg_index as index_record
      join pg_catalog.pg_class as index_table
        on index_table.oid = index_record.indexrelid
      join pg_catalog.pg_namespace as index_namespace
        on index_namespace.oid = index_table.relnamespace
      where index_namespace.nspname = 'public'
        and index_table.relname =
          'throughline_product_events_recording_id_idx'
        and index_record.indrelid =
          'public.throughline_product_events'::regclass
        and index_record.indnkeyatts = 1
        and index_record.indnatts = 1
        and index_record.indisvalid
        and index_record.indisready
        and (select array_agg(attribute.attname order by key.ordinality)
          from unnest(index_record.indkey)
            with ordinality as key(attnum, ordinality)
          join pg_catalog.pg_attribute as attribute
            on attribute.attrelid = index_record.indrelid
            and attribute.attnum = key.attnum) = array['recording_id']::name[]
    )
  `,
  `
    (select pg_get_expr(indpred, indrelid) = '(recording_id IS NOT NULL)'
      from pg_catalog.pg_index
      where indexrelid =
        'public.throughline_product_events_recording_id_idx'::regclass)
  `,
  "to_regclass('public.throughline_internal_users') is not null",
  `
    exists (
      select 1
      from pg_catalog.pg_constraint as constraint_record
      where constraint_record.conrelid = 'public.throughline_internal_users'::regclass
        and constraint_record.contype = 'p'
        and (select array_agg(attribute.attname order by key.ordinality)
          from unnest(constraint_record.conkey)
            with ordinality as key(attnum, ordinality)
          join pg_catalog.pg_attribute as attribute
            on attribute.attrelid = constraint_record.conrelid
            and attribute.attnum = key.attnum) = array['auth_user_id']::name[]
    )
  `,
  `
    exists (
      select 1
      from pg_catalog.pg_constraint as constraint_record
      where constraint_record.contype = 'f'
        and constraint_record.conrelid = 'public.throughline_internal_users'::regclass
        and constraint_record.confrelid = 'auth.users'::regclass
        and (select array_agg(attribute.attname order by key.ordinality)
          from unnest(constraint_record.conkey)
            with ordinality as key(attnum, ordinality)
          join pg_catalog.pg_attribute as attribute
            on attribute.attrelid = constraint_record.conrelid
            and attribute.attnum = key.attnum) = array['auth_user_id']::name[]
        and (select array_agg(attribute.attname order by key.ordinality)
          from unnest(constraint_record.confkey)
            with ordinality as key(attnum, ordinality)
          join pg_catalog.pg_attribute as attribute
            on attribute.attrelid = constraint_record.confrelid
            and attribute.attnum = key.attnum) = array['id']::name[]
    )
  `,
  `
    (select confdeltype = 'c'::"char"
      from pg_catalog.pg_constraint
      where conrelid = 'public.throughline_internal_users'::regclass
        and contype = 'f')
  `,
  `
    (select relrowsecurity
      from pg_catalog.pg_class
      where oid = 'public.throughline_internal_users'::regclass)
  `,
  `
    (select count(*) from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = 'throughline_internal_users') = 0
  `,
  `
    not exists (
      select 1
      from pg_catalog.pg_class as table_record
      cross join lateral aclexplode(
        coalesce(table_record.relacl, acldefault('r', table_record.relowner))
      ) as privilege_record
      where table_record.oid = 'public.throughline_internal_users'::regclass
        and privilege_record.grantee = 0
    )
      and not has_any_column_privilege(
        'anon', 'public.throughline_internal_users', 'SELECT'
      )
      and not has_any_column_privilege(
        'authenticated', 'public.throughline_internal_users', 'SELECT'
      )
  `,
  `
    not has_any_column_privilege(
      'anon', 'public.throughline_internal_users', 'INSERT,UPDATE,REFERENCES'
    )
      and not has_any_column_privilege(
        'authenticated', 'public.throughline_internal_users',
        'INSERT,UPDATE,REFERENCES'
      )
      and not has_table_privilege(
        'anon', 'public.throughline_internal_users',
        'DELETE,TRUNCATE,TRIGGER,MAINTAIN'
      )
      and not has_table_privilege(
        'authenticated', 'public.throughline_internal_users',
        'DELETE,TRUNCATE,TRIGGER,MAINTAIN'
      )
  `,
  `
    has_table_privilege('service_role', 'public.throughline_internal_users', 'select')
      and has_table_privilege(
        'service_role', 'public.throughline_internal_users', 'insert'
      )
      and has_table_privilege(
        'service_role', 'public.throughline_internal_users', 'delete'
      )
      and not has_any_column_privilege(
        'service_role', 'public.throughline_internal_users',
        'UPDATE,REFERENCES'
      )
      and not has_table_privilege(
        'service_role', 'public.throughline_internal_users', 'truncate'
      )
      and not has_table_privilege(
        'service_role', 'public.throughline_internal_users', 'references'
      )
      and not has_table_privilege(
        'service_role', 'public.throughline_internal_users', 'trigger'
      )
      and not has_table_privilege(
        'service_role', 'public.throughline_internal_users', 'maintain'
      )
  `,
  "(select count(*) from public.throughline_internal_users) = 0",
];

const hardeningChecks = [
  `
    (select array_agg(version order by version)
      from supabase_migrations.schema_migrations) =
      ${sqlTextArray([
        ...BASELINE_HISTORY,
        "20260817180709",
        "20260818061933",
      ])}
  `,
  `
    has_table_privilege('authenticated', 'public.throughline_profiles', 'select')
      and has_table_privilege('authenticated', 'public.throughline_profiles', 'insert')
      and has_table_privilege('authenticated', 'public.throughline_profiles', 'update')
      and not has_table_privilege('authenticated', 'public.throughline_profiles', 'delete')
      and not has_table_privilege('authenticated', 'public.throughline_profiles', 'truncate')
      and not has_table_privilege('authenticated', 'public.throughline_profiles', 'references')
      and not has_table_privilege('authenticated', 'public.throughline_profiles', 'trigger')
      and not has_table_privilege('authenticated', 'public.throughline_profiles', 'maintain')
  `,
  `
    not exists (
      select 1
      from pg_catalog.pg_class as table_record
      cross join lateral aclexplode(
        coalesce(table_record.relacl, acldefault('r', table_record.relowner))
      ) as privilege_record
      where table_record.oid = 'public.throughline_profiles'::regclass
        and privilege_record.grantee = 0
    )
      and not has_any_column_privilege(
        'anon', 'public.throughline_profiles',
        'SELECT,INSERT,UPDATE,REFERENCES'
      )
      and not has_table_privilege(
        'anon', 'public.throughline_profiles',
        'DELETE,TRUNCATE,TRIGGER,MAINTAIN'
      )
  `,
  `
    has_table_privilege('service_role', 'public.throughline_recordings', 'select')
      and has_table_privilege('service_role', 'public.throughline_recordings', 'insert')
      and has_table_privilege('service_role', 'public.throughline_recordings', 'update')
      and has_table_privilege('service_role', 'public.throughline_recordings', 'delete')
      and not has_table_privilege('service_role', 'public.throughline_recordings', 'truncate')
      and not has_table_privilege('service_role', 'public.throughline_recordings', 'references')
      and not has_table_privilege('service_role', 'public.throughline_recordings', 'trigger')
      and not has_table_privilege('service_role', 'public.throughline_recordings', 'maintain')
  `,
  `
    has_table_privilege('service_role', 'public.throughline_feedback', 'select')
      and has_table_privilege('service_role', 'public.throughline_feedback', 'insert')
      and has_table_privilege('service_role', 'public.throughline_feedback', 'update')
      and has_table_privilege('service_role', 'public.throughline_feedback', 'delete')
      and not has_table_privilege('service_role', 'public.throughline_feedback', 'truncate')
      and not has_table_privilege('service_role', 'public.throughline_feedback', 'references')
      and not has_table_privilege('service_role', 'public.throughline_feedback', 'trigger')
      and not has_table_privilege('service_role', 'public.throughline_feedback', 'maintain')
  `,
  `
    not exists (
      select 1
      from unnest(array[
        'throughline_recordings', 'throughline_feedback'
      ]) as table_name
      cross join unnest(array['anon', 'authenticated']) as role_name
      where has_any_column_privilege(
        role_name, format('public.%I', table_name),
        'SELECT,INSERT,UPDATE,REFERENCES'
      ) or has_table_privilege(
        role_name, format('public.%I', table_name),
        'DELETE,TRUNCATE,TRIGGER,MAINTAIN'
      )
    )
      and not exists (
        select 1
        from pg_catalog.pg_class as table_record
        cross join lateral aclexplode(
          coalesce(table_record.relacl, acldefault('r', table_record.relowner))
        ) as privilege_record
        where table_record.relnamespace = 'public'::regnamespace
          and table_record.relname in (
            'throughline_recordings', 'throughline_feedback'
          )
          and privilege_record.grantee = 0
      )
  `,
  `
    has_table_privilege('service_role', 'public.throughline_profiles', 'select')
      and has_table_privilege('service_role', 'public.throughline_profiles', 'delete')
      and has_table_privilege('service_role', 'public.throughline_product_events', 'select')
      and has_table_privilege('service_role', 'public.throughline_product_feedback', 'select')
      and has_table_privilege('service_role', 'public.throughline_internal_users', 'select')
  `,
];

const rawDefinitions = [
  {
    phase: "baseline",
    contract: "measurement_baseline",
    transportStage: "measurement_contract_baseline",
    checks: baselineChecks,
  },
  {
    phase: "measurement_attribution",
    contract: "measurement_attribution",
    transportStage: "measurement_contract_attribution",
    checks: measurementChecks,
  },
  {
    phase: "privilege_hardening",
    contract: "measurement_privilege_hardening",
    transportStage: "measurement_contract_hardening",
    checks: hardeningChecks,
  },
];

const definitions = new Map(rawDefinitions.map((definition) => {
  const sql = buildContractSql(definition);
  if (!isReadOnlyMeasurementContractSql(sql)) {
    throw new Error("Measurement contract SQL must be one read-only statement");
  }
  return [definition.phase, Object.freeze({
    phase: definition.phase,
    contract: definition.contract,
    planned: definition.checks.length,
    transportStage: definition.transportStage,
    sql,
    sha256: createHash("sha256").update(sql).digest("hex"),
  })];
}));

const definitionsByTransportStage = new Map(
  [...definitions.values()].map((definition) => [
    definition.transportStage,
    definition,
  ]),
);

export function measurementContractDefinition(phase) {
  const definition = definitions.get(phase);
  if (definition === undefined) {
    throw new Error("Unknown measurement contract phase");
  }
  return { ...definition };
}

export function isAllowedMeasurementContractQuery(transportStage, sql) {
  if (typeof transportStage !== "string" || typeof sql !== "string") {
    return false;
  }
  const definition = definitionsByTransportStage.get(transportStage);
  return definition !== undefined && sql === definition.sql;
}

const RESPONSE_KEYS = [
  "contract_version",
  "contract",
  "planned",
  "executed",
  "failed_assertions",
];

const hasExactKeys = (value, expected) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join("\n") === [...expected].sort().join("\n");

export function parseMeasurementContractRows(phase, rows) {
  const definition = measurementContractDefinition(phase);
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    !hasExactKeys(rows[0], RESPONSE_KEYS)
  ) {
    throw new Error(`${definition.contract} returned an invalid structured contract response`);
  }

  const row = rows[0];
  const failures = row.failed_assertions;
  const validFailures = Array.isArray(failures) && failures.every((value, index) =>
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= definition.planned &&
    (index === 0 || failures[index - 1] < value)
  );
  if (
    row.contract_version !== CONTRACT_VERSION ||
    row.contract !== definition.contract ||
    row.planned !== definition.planned ||
    row.executed !== definition.planned ||
    !validFailures
  ) {
    throw new Error(`${definition.contract} returned an invalid structured contract response`);
  }

  return {
    contract: definition.contract,
    planned: definition.planned,
    executed: definition.planned,
    failedAssertions: [...failures],
  };
}

export function assertMeasurementContractPass(phase, rows) {
  const result = parseMeasurementContractRows(phase, rows);
  if (result.failedAssertions.length > 0) {
    throw new Error(
      `${result.contract} failed assertions: ${result.failedAssertions.join(",")}`,
    );
  }
  return result;
}
