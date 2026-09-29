create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if (
    select count(*)
    from vault.secrets
    where name in (
      'throughline_project_url',
      'throughline_evaluation_reconciliation_api_token'
    )
  ) <> 2 then
    raise exception using
      errcode = '22023',
      message = 'evaluation_reconciliation_schedule_secrets_missing';
  end if;
end $$;

select cron.schedule(
  'throughline-evaluation-artifact-reconciliation',
  '*/15 * * * *',
  $cron$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'throughline_project_url'
      ) || '/functions/v1/api/maintenance/evaluation-artifact-reconciliation',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'throughline_evaluation_reconciliation_api_token'
        ),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    ) as request_id;
  $cron$
);
