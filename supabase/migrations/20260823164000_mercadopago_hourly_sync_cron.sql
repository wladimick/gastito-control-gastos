create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.run_mercadopago_sync_cron()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_token text;
  v_request_id bigint;
begin
  select decrypted_secret
    into v_token
    from vault.decrypted_secrets
   where name = 'mercadopago_cron_token'
   order by created_at desc
   limit 1;

  if v_token is null or length(v_token) < 20 then
    raise exception 'mercadopago_cron_token no configurado';
  end if;

  select net.http_post(
    url := 'https://ravxmljbhbwptqpowamu.supabase.co/functions/v1/mercadopago-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-gastito-cron-token', v_token
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.run_mercadopago_sync_cron() from public, anon, authenticated;

do $$
declare
  v_jobid bigint;
begin
  for v_jobid in select jobid from cron.job where jobname = 'gastito-mercadopago-hourly' loop
    perform cron.unschedule(v_jobid);
  end loop;
end $$;

select cron.schedule(
  'gastito-mercadopago-hourly',
  '23 * * * *',
  'select public.run_mercadopago_sync_cron();'
);

-- El valor real de vault.secret `mercadopago_cron_token` se crea fuera de la
-- migración. Nunca guardar secretos en GitHub.
