export function isExplicitlyDataLess(branch) {
  return branch !== null &&
    typeof branch === "object" &&
    Object.hasOwn(branch, "with_data") &&
    typeof branch.with_data === "boolean" &&
    branch.with_data === false;
}

export function selectExactBranchByName(branches, expectedName) {
  if (!Array.isArray(branches) || typeof expectedName !== "string") {
    throw new TypeError("Branch selection requires an array and an exact name");
  }

  const matches = branches.filter((branch) =>
    branch !== null &&
    typeof branch === "object" &&
    Object.hasOwn(branch, "name") &&
    branch.name === expectedName
  );
  if (matches.length !== 1) {
    throw new Error("Expected exactly one branch with the exact name");
  }
  return matches[0];
}

const STARTING_STATE_RELATION_KEYS = [
  "migrationHistory",
  "authUsers",
  "storageObjects",
  "storageBuckets",
];

function requireExactRelationInventory(inventory) {
  if (
    inventory === null ||
    typeof inventory !== "object" ||
    Array.isArray(inventory) ||
    Object.keys(inventory).sort().join("\n") !==
      [...STARTING_STATE_RELATION_KEYS].sort().join("\n") ||
    STARTING_STATE_RELATION_KEYS.some((key) =>
      !Object.hasOwn(inventory, key) || typeof inventory[key] !== "boolean"
    )
  ) {
    throw new TypeError("Starting-state SQL requires an exact Boolean relation inventory");
  }
}

export function buildStartingStateClassificationSql(inventory) {
  requireExactRelationInventory(inventory);
  const history = inventory.migrationHistory
    ? `coalesce((
        select json_agg(version order by version)
        from supabase_migrations.schema_migrations
      ), '[]'::json)`
    : "'[]'::json";
  const authUserCount = inventory.authUsers
    ? "(select count(*)::int from auth.users)"
    : "0::int";
  const storageObjectCount = inventory.storageObjects
    ? "(select count(*)::int from storage.objects)"
    : "0::int";
  const bucketCount = inventory.storageBuckets
    ? "(select count(*)::int from storage.buckets)"
    : "0::int";
  const throughlineBucketCount = inventory.storageBuckets
    ? `(select count(*)::int from storage.buckets
        where id = 'throughline-audio')`
    : "0::int";

  return `
    select
      ${history} as history,
      coalesce((
        select json_agg(tablename order by tablename)
        from pg_tables
        where schemaname = 'public'
          and tablename like 'throughline_%'
      ), '[]'::json) as tables,
      (select count(*)::int from information_schema.columns
        where table_schema = 'public'
          and table_name = 'throughline_product_events'
          and column_name in (
            'schema_version', 'distribution_channel',
            'is_internal_user', 'recording_id'
          )) as measurement_column_count,
      (select count(*)::int from pg_constraint
        where conname in (
          'throughline_product_events_schema_version_check',
          'throughline_product_events_distribution_channel_check',
          'throughline_product_events_recording_id_fkey'
        )) as measurement_constraint_count,
      (to_regclass('public.throughline_product_events_recording_id_idx')
        is not null) as measurement_index_exists,
      (to_regclass('public.throughline_internal_users') is not null)
        as allowlist_exists,
      ${authUserCount} as auth_user_count,
      ${storageObjectCount} as storage_object_count,
      ${bucketCount} as bucket_count,
      ${throughlineBucketCount} as throughline_bucket_count;
  `.trim();
}
