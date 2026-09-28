begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select has_extension(
  'pg_cron',
  'the reconciliation scheduler uses the supported pg_cron extension'
);
select has_extension(
  'pg_net',
  'the reconciliation scheduler uses asynchronous pg_net delivery'
);
select is(
  (
    select count(*)::integer
    from vault.secrets
    where name in (
      'throughline_project_url',
      'throughline_evaluation_reconciliation_api_token'
    )
  ),
  2,
  'the scheduler has exactly both required Vault secrets'
);
select is(
  (
    select count(*)::integer
    from cron.job
    where jobname = 'throughline-evaluation-artifact-reconciliation'
  ),
  1,
  'exactly one reconciliation job is installed'
);
select is(
  (
    select schedule
    from cron.job
    where jobname = 'throughline-evaluation-artifact-reconciliation'
  ),
  '*/15 * * * *',
  'reconciliation runs every fifteen minutes'
);
select ok(
  (
    select active
    from cron.job
    where jobname = 'throughline-evaluation-artifact-reconciliation'
  ),
  'the reconciliation job is active'
);
select ok(
  (
    select command like
      '%/functions/v1/api/maintenance/evaluation-artifact-reconciliation%'
    from cron.job
    where jobname = 'throughline-evaluation-artifact-reconciliation'
  ),
  'the job calls only the fixed reconciliation endpoint'
);
select ok(
  (
    select command like '%throughline_project_url%'
      and command like '%throughline_evaluation_reconciliation_api_token%'
      and command like '%vault.decrypted_secrets%'
    from cron.job
    where jobname = 'throughline-evaluation-artifact-reconciliation'
  ),
  'the job resolves both endpoint and authorization from Vault at execution time'
);
select ok(
  (
    select command like '%timeout_milliseconds := 30000%'
    from cron.job
    where jobname = 'throughline-evaluation-artifact-reconciliation'
  ),
  'the asynchronous request has an explicit bounded timeout'
);
select ok(
  (
    select command !~ '[0-9a-f]{64}'
    from cron.job
    where jobname = 'throughline-evaluation-artifact-reconciliation'
  ),
  'the scheduled command contains no embedded 64-character credential value'
);

select * from finish();
rollback;
