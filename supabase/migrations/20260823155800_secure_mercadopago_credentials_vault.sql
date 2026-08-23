create or replace function public.save_mercadopago_credentials(
  p_public_key text,
  p_access_token text,
  p_client_id text,
  p_client_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_secret_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id = v_uid;
  if coalesce(v_role, '') <> 'super_admin' then raise exception 'Insufficient privileges'; end if;
  if coalesce(length(trim(p_public_key)), 0) < 10
     or coalesce(length(trim(p_access_token)), 0) < 20
     or coalesce(length(trim(p_client_id)), 0) < 5
     or coalesce(length(trim(p_client_secret)), 0) < 10 then
    raise exception 'Invalid Mercado Pago credentials';
  end if;

  select id into v_secret_id from vault.secrets where name = 'mercadopago_public_key' order by created_at desc limit 1;
  if v_secret_id is null then perform vault.create_secret(trim(p_public_key), 'mercadopago_public_key', 'Mercado Pago production Public Key');
  else perform vault.update_secret(v_secret_id, trim(p_public_key), 'mercadopago_public_key', 'Mercado Pago production Public Key'); end if;

  v_secret_id := null;
  select id into v_secret_id from vault.secrets where name = 'mercadopago_access_token' order by created_at desc limit 1;
  if v_secret_id is null then perform vault.create_secret(trim(p_access_token), 'mercadopago_access_token', 'Mercado Pago production Access Token');
  else perform vault.update_secret(v_secret_id, trim(p_access_token), 'mercadopago_access_token', 'Mercado Pago production Access Token'); end if;

  v_secret_id := null;
  select id into v_secret_id from vault.secrets where name = 'mercadopago_client_id' order by created_at desc limit 1;
  if v_secret_id is null then perform vault.create_secret(trim(p_client_id), 'mercadopago_client_id', 'Mercado Pago production Client ID');
  else perform vault.update_secret(v_secret_id, trim(p_client_id), 'mercadopago_client_id', 'Mercado Pago production Client ID'); end if;

  v_secret_id := null;
  select id into v_secret_id from vault.secrets where name = 'mercadopago_client_secret' order by created_at desc limit 1;
  if v_secret_id is null then perform vault.create_secret(trim(p_client_secret), 'mercadopago_client_secret', 'Mercado Pago production Client Secret');
  else perform vault.update_secret(v_secret_id, trim(p_client_secret), 'mercadopago_client_secret', 'Mercado Pago production Client Secret'); end if;

  update public.mercadopago_sync_config
  set credential_state = 'configured', status = 'idle', last_error = null, updated_at = now()
  where user_id = v_uid;

  return jsonb_build_object('ok', true, 'credential_state', 'configured');
end;
$$;

revoke all on function public.save_mercadopago_credentials(text, text, text, text) from public;
grant execute on function public.save_mercadopago_credentials(text, text, text, text) to authenticated;
