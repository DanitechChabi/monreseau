-- Purge quotidienne (RGPD) : inscriptions de plus de 12 mois, compteurs périmés.
-- Garder la durée égale à DATA_RETENTION_MONTHS et à privacy.retentionMonths (event.ts).
-- pg_cron est fourni par Supabase ; ignoré sur un PostgreSQL qui ne l'a pas (tests locaux).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'webinaire-purge';
    perform cron.schedule('webinaire-purge', '15 3 * * *', 'select public.purge_expired_data(12)');
  end if;
end;
$$;
