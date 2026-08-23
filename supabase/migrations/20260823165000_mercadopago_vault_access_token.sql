create or replace function public.get_mercadopago_access_token()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'mercadopago_access_token'
  order by created_at desc
  limit 1
$$;

revoke all on function public.get_mercadopago_access_token() from public, anon, authenticated;
grant execute on function public.get_mercadopago_access_token() to service_role;

-- El secreto real se crea fuera de GitHub con Supabase Vault:
-- select vault.create_secret('<TOKEN>', 'mercadopago_access_token', 'Mercado Pago production access token', null);
